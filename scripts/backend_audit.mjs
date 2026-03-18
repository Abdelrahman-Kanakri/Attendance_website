import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function nowIso() {
  return new Date().toISOString();
}

function formatHeading(text) {
  return text.trim();
}

function env(name) {
  const value = process.env[name];
  return value === undefined || value === '' ? null : value;
}

function safeSnippet(value, { keepStart = 6, keepEnd = 4 } = {}) {
  if (!value) return null;
  if (value.length <= keepStart + keepEnd + 3) return value;
  return `${value.slice(0, keepStart)}…${value.slice(-keepEnd)}`;
}

function readTextIfExists(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

function loadDotEnvFileIntoProcessEnv(absPath) {
  const raw = readTextIfExists(absPath);
  if (!raw) return { loaded: false, keys: [] };

  const keys = [];
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Don't overwrite explicit environment variables.
    if (process.env[key] === undefined) {
      process.env[key] = value;
      keys.push(key);
    }
  }

  return { loaded: true, keys };
}

function severityRank(sev) {
  switch (sev) {
    case 'Critical':
      return 4;
    case 'High':
      return 3;
    case 'Medium':
      return 2;
    case 'Low':
      return 1;
    default:
      return 0;
  }
}

function classifyOverallStatus(issues) {
  const max = issues.reduce((m, i) => Math.max(m, severityRank(i.severity)), 0);
  if (max >= 4) return 'Broken';
  if (max >= 3) return 'Degraded';
  return 'Operational';
}

function addIssue(issues, issue) {
  issues.push({
    severity: issue.severity,
    area: issue.area ?? 'General',
    title: issue.title,
    details: issue.details ?? '',
    remediation: issue.remediation ?? '',
    evidence: issue.evidence ?? '',
  });
}

function normalizeSql(sql) {
  return sql.replace(/\r\n/g, '\n');
}

function sqlIncludes(sql, fragment) {
  return normalizeSql(sql).toLowerCase().includes(fragment.toLowerCase());
}

function parseRoleEnumFromMigration(sql) {
  // Looks for: check (role in ('employee', 'admin', 'manager'))
  const m = sql.match(/check\s*\(\s*role\s+in\s*\(([^)]+)\)\s*\)/i);
  if (!m) return null;
  const inside = m[1];
  const roles = [...inside.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  return roles.length ? roles : null;
}

async function trySignIn(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error };
  return { ok: true, session: data.session };
}

async function runQuery(supabase, table, select, options = {}) {
  const q = supabase.from(table).select(select);
  if (options.eq) q.eq(options.eq.column, options.eq.value);
  if (options.limit) q.limit(options.limit);
  if (options.maybeSingle) q.maybeSingle();
  return await q;
}

async function main() {
  const startedAt = nowIso();

  // Vite loads `.env*` automatically for the dev server, but `node scripts/...`
  // does not. Load local env files for audit runs.
  const dotenvLocal = loadDotEnvFileIntoProcessEnv(path.join(repoRoot, '.env.local'));
  const dotenv = loadDotEnvFileIntoProcessEnv(path.join(repoRoot, '.env'));

  const supabaseUrl =
    env('VITE_SUPABASE_URL') ?? env('SUPABASE_URL') ?? env('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey =
    env('VITE_SUPABASE_ANON_KEY') ??
    env('SUPABASE_ANON_KEY') ??
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const issues = [];
  const notes = [];

  if (dotenvLocal.loaded) {
    notes.push(`Loaded ${dotenvLocal.keys.length} env vars from .env.local for audit run.`);
  }
  if (dotenv.loaded) {
    notes.push(`Loaded ${dotenv.keys.length} env vars from .env for audit run.`);
  }

  const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '001_initial_schema.sql');
  const migrationSql = readTextIfExists(migrationPath);

  // --- Website configuration / env checks ---
  if (!supabaseUrl || !supabaseAnonKey) {
    addIssue(issues, {
      severity: 'Critical',
      area: 'Website Configuration',
      title: 'Missing Supabase environment variables',
      details:
        'Expected `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or compatible aliases). Without these, the app cannot authenticate or query data.',
      remediation:
        'Create `.env.local` (or set environment variables) with valid Supabase URL + anon key, then restart the app.',
      evidence: `VITE_SUPABASE_URL=${String(supabaseUrl)}; VITE_SUPABASE_ANON_KEY=${String(
        supabaseAnonKey,
      )}`,
    });
  } else {
    notes.push(
      `Supabase URL detected: ${supabaseUrl} | anon key: ${safeSnippet(supabaseAnonKey)}`,
    );
  }

  // --- Static audit: migration presence + core objects ---
  if (!migrationSql) {
    addIssue(issues, {
      severity: 'High',
      area: 'Database Schema Validation',
      title: 'Missing migration file for initial schema',
      details:
        'The audit expected `supabase/migrations/001_initial_schema.sql` but could not read it. Schema/RLS validation will be incomplete.',
      remediation:
        'Ensure migrations are committed and the expected file exists (or update the audit script to match your migration naming).',
      evidence: migrationPath,
    });
  } else {
    const requiredTables = [
      { logical: 'Employee Data', physical: 'profiles' },
      { logical: 'Attendance', physical: 'daily_attendance' },
      { logical: 'Leave Management', physical: 'leave_log' },
      { logical: 'Salary/Payroll', physical: 'salary' },
    ];

    for (const t of requiredTables) {
      const has = sqlIncludes(migrationSql, `create table if not exists public.${t.physical}`);
      if (!has) {
        addIssue(issues, {
          severity: 'High',
          area: 'Database Schema Validation',
          title: `Missing required table: ${t.physical}`,
          details: `The prompt expects a ${t.logical} table. This project maps that to \`${t.physical}\`.`,
          remediation: `Add the \`${t.physical}\` table (and its RLS policies) or update mappings in the audit.`,
          evidence: `Not found in ${path.relative(repoRoot, migrationPath)}`,
        });
      }
    }

    const rlsTables = ['profiles', 'daily_attendance', 'leave_log', 'salary'];
    for (const t of rlsTables) {
      const enabled = sqlIncludes(migrationSql, `alter table public.${t} enable row level security`);
      if (!enabled) {
        addIssue(issues, {
          severity: 'Critical',
          area: 'Security & Compliance Checks',
          title: `Row Level Security not enabled on ${t}`,
          details:
            'Without RLS enabled, the anon key can potentially read/write data depending on grants and API settings.',
          remediation: `Enable RLS on \`${t}\` and add least-privilege policies.`,
          evidence: `Missing: alter table public.${t} enable row level security`,
        });
      }
    }

    const roles = parseRoleEnumFromMigration(migrationSql);
    if (roles) {
      if (!roles.includes('admin')) {
        addIssue(issues, {
          severity: 'High',
          area: 'Supabase Configuration & Access Control',
          title: 'No admin role detected in profiles role constraint',
          details:
            'Your RLS policies reference `role = admin/manager`. The role constraint should include these roles.',
          remediation:
            'Align role constraint with policy expectations (admin/manager/employee) or update policies to match your RBAC model.',
          evidence: `Detected roles: ${roles.join(', ')}`,
        });
      }

      if (!roles.includes('hr')) {
        addIssue(issues, {
          severity: 'Medium',
          area: 'Supabase Configuration & Access Control',
          title: 'Prompt expects HR role; schema uses admin/manager/employee',
          details:
            'The audit prompt refers to an HR-authorized role for sensitive modifications. This schema uses `admin` for privileged operations. This is OK if "admin" is your HR role, but it’s a naming mismatch that can cause policy drift.',
          remediation:
            'Either introduce an explicit `hr` role (and update policies + UI) or document that `admin` represents HR authorization.',
          evidence: `Detected roles: ${roles.join(', ')}`,
        });
      }
    }

    // Sensitive fields: confirm policies exist to restrict updates
    const hasSelfRead = sqlIncludes(migrationSql, 'create policy self_read on public.profiles');
    const hasAdminAll = sqlIncludes(migrationSql, 'create policy admin_all on public.profiles');
    if (!hasSelfRead) {
      addIssue(issues, {
        severity: 'High',
        area: 'Supabase Configuration & Access Control',
        title: 'Missing self-read policy on profiles',
        details: 'Employees should at least be able to read their own profile to function normally.',
        remediation:
          'Add a `FOR SELECT` policy on `profiles` using `(auth.uid() = id)` or equivalent.',
        evidence: 'Expected `create policy self_read on public.profiles`',
      });
    }
    if (!hasAdminAll) {
      addIssue(issues, {
        severity: 'Critical',
        area: 'Supabase Configuration & Access Control',
        title: 'Missing admin_all policy on profiles',
        details:
          'Without an admin/HR privileged policy, HR operations (admin UI) will fail or require overly broad grants elsewhere.',
        remediation:
          'Add a privileged policy for HR/admin to manage `profiles` with strict `USING` and `WITH CHECK` clauses.',
        evidence: 'Expected `create policy admin_all on public.profiles`',
      });
    }
  }

  // --- Live checks (optional but recommended) ---
  let supabase = null;
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Basic connectivity: a cheap request that should succeed even if RLS blocks.
    try {
      const { error } = await supabase.auth.getSession();
      if (error) {
        addIssue(issues, {
          severity: 'High',
          area: 'Backend Process Health',
          title: 'Supabase auth session API not reachable',
          details: 'The client could not reach Supabase auth endpoints successfully.',
          remediation:
            'Verify the Supabase URL/anon key, network connectivity, and that the Supabase project is up.',
          evidence: error.message,
        });
      }
    } catch (e) {
      addIssue(issues, {
        severity: 'High',
        area: 'Backend Process Health',
        title: 'Supabase client initialization/connectivity failed',
        details: 'An unexpected error occurred during a basic Supabase call.',
        remediation: 'Verify env vars and network connectivity.',
        evidence: String(e),
      });
    }

    // If test users are provided, run authorization simulations.
    const adminEmail = env('AUDIT_ADMIN_EMAIL');
    const adminPassword = env('AUDIT_ADMIN_PASSWORD');
    const managerEmail = env('AUDIT_MANAGER_EMAIL');
    const managerPassword = env('AUDIT_MANAGER_PASSWORD');
    const employeeEmail = env('AUDIT_EMPLOYEE_EMAIL');
    const employeePassword = env('AUDIT_EMPLOYEE_PASSWORD');

    const haveAnyCreds =
      (adminEmail && adminPassword) ||
      (managerEmail && managerPassword) ||
      (employeeEmail && employeePassword);

    if (!haveAnyCreds) {
      notes.push(
        'Role simulation tests were skipped (set AUDIT_*_EMAIL and AUDIT_*_PASSWORD to enable).',
      );
    } else {
      // Employee simulation: ensure they cannot read other profiles or salary.
      if (employeeEmail && employeePassword) {
        const empClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const signed = await trySignIn(empClient, employeeEmail, employeePassword);
        if (!signed.ok) {
          addIssue(issues, {
            severity: 'High',
            area: 'Functional Authorization Testing',
            title: 'Employee sign-in failed (audit test user)',
            details: 'Could not authenticate the configured employee user for authorization testing.',
            remediation:
              'Verify AUDIT_EMPLOYEE_EMAIL/AUDIT_EMPLOYEE_PASSWORD and that the user exists in Supabase Auth.',
            evidence: signed.error.message,
          });
        } else {
          const me = signed.session?.user?.id ?? null;
          notes.push(`Employee test user authenticated (id=${me ?? 'unknown'})`);

          const otherProfile = await runQuery(empClient, 'profiles', '*', { limit: 5 });
          if (!otherProfile.error && Array.isArray(otherProfile.data)) {
            // With self_read policy, this should return exactly 1 row (self) or be empty if profile missing.
            if (otherProfile.data.length > 1) {
              addIssue(issues, {
                severity: 'Critical',
                area: 'Security & Compliance Checks',
                title: 'Employee can read multiple profiles (potential RLS leak)',
                details:
                  'With `self_read`, an employee should only read their own profile. Reading multiple profiles indicates overly broad select policy or misconfigured RLS.',
                remediation:
                  'Review `profiles` SELECT policies. Ensure `USING (auth.uid() = id)` is the only non-admin read policy.',
                evidence: `profiles select returned ${otherProfile.data.length} rows for employee`,
              });
            }
          }

          const salaryAttempt = await runQuery(empClient, 'salary', '*', { limit: 2 });
          if (!salaryAttempt.error && Array.isArray(salaryAttempt.data)) {
            if (salaryAttempt.data.length > 1) {
              addIssue(issues, {
                severity: 'Critical',
                area: 'Security & Compliance Checks',
                title: 'Employee can read multiple salary rows (potential RLS leak)',
                details:
                  'Salary records are highly sensitive. An employee should only see their own rows.',
                remediation:
                  'Review `salary` SELECT policies and confirm RLS is enabled. Ensure `USING (employee_id = auth.uid())`.',
                evidence: `salary select returned ${salaryAttempt.data.length} rows for employee`,
              });
            }
          }

          // Attempt to update their own role (should be blocked unless admin).
          if (me) {
            const updateRole = await empClient
              .from('profiles')
              .update({ role: 'admin' })
              .eq('id', me)
              .select('*')
              .maybeSingle();
            if (!updateRole.error) {
              addIssue(issues, {
                severity: 'Critical',
                area: 'Supabase Configuration & Access Control',
                title: 'Privilege escalation: employee can update their own role',
                details:
                  'Employees must not be able to self-promote to admin/HR roles. This indicates an overly broad `FOR UPDATE` policy on profiles.',
                remediation:
                  'Remove non-admin UPDATE policies on `profiles` or restrict `WITH CHECK` to disallow role changes except for admin.',
                evidence: 'Update succeeded on profiles.role for employee user',
              });
            }
          }
        }
      }

      // Admin simulation: verify admin can manage tables (basic health check).
      if (adminEmail && adminPassword) {
        const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const signed = await trySignIn(adminClient, adminEmail, adminPassword);
        if (!signed.ok) {
          addIssue(issues, {
            severity: 'High',
            area: 'Functional Authorization Testing',
            title: 'Admin sign-in failed (audit test user)',
            details: 'Could not authenticate the configured admin user for authorization testing.',
            remediation:
              'Verify AUDIT_ADMIN_EMAIL/AUDIT_ADMIN_PASSWORD and that the user exists in Supabase Auth.',
            evidence: signed.error.message,
          });
        } else {
          const adminId = signed.session?.user?.id ?? null;
          notes.push(`Admin test user authenticated (id=${adminId ?? 'unknown'})`);

          const tables = ['profiles', 'daily_attendance', 'leave_log', 'salary'];
          for (const t of tables) {
            const res = await runQuery(adminClient, t, '*', { limit: 1 });
            if (res.error) {
              addIssue(issues, {
                severity: 'High',
                area: 'Backend Process Health',
                title: `Admin cannot query ${t}`,
                details:
                  'An admin/HR user should be able to access operational tables. This may indicate incorrect RLS policies or missing role assignment in `profiles`.',
                remediation:
                  'Ensure the admin user has `profiles.role = admin` and policies allow access.',
                evidence: res.error.message,
              });
            }
          }
        }
      }
    }
  }

  // --- Secrets / compliance: local repo scan (lightweight) ---
  const envLocalPath = path.join(repoRoot, '.env.local');
  const envLocal = readTextIfExists(envLocalPath);
  if (envLocal && /password\s*:/i.test(envLocal)) {
    addIssue(issues, {
      severity: 'High',
      area: 'Security & Compliance Checks',
      title: 'Potential credential present in .env.local comments',
      details:
        'The `.env.local` file appears to contain a password in a comment. Even if untracked, it is high risk and may leak via screenshots, backups, or accidental commits.',
      remediation:
        'Remove passwords from repo files. Store credentials in a password manager and rotate any exposed secrets.',
      evidence: `Found pattern "password:" in ${path.relative(repoRoot, envLocalPath)}`,
    });
  }

  const overall = classifyOverallStatus(issues);

  // --- Report ---
  const reportLines = [];
  reportLines.push(`# Backend & Configuration Audit Report`);
  reportLines.push('');
  reportLines.push(`- **Generated at**: ${startedAt}`);
  reportLines.push(`- **Overall system health**: **${overall}**`);
  reportLines.push('');

  reportLines.push(`## Identified issues`);
  if (issues.length === 0) {
    reportLines.push('');
    reportLines.push('No issues detected by the automated audit runner.');
  } else {
    const sorted = [...issues].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    for (const i of sorted) {
      reportLines.push('');
      reportLines.push(`### [${i.severity}] ${formatHeading(i.title)}`);
      reportLines.push(`- **Area**: ${i.area}`);
      if (i.details) reportLines.push(`- **Details**: ${i.details}`);
      if (i.evidence) reportLines.push(`- **Evidence**: ${i.evidence}`);
      if (i.remediation) reportLines.push(`- **Recommended remediation**: ${i.remediation}`);
    }
  }

  reportLines.push('');
  reportLines.push('## Security risks and misconfigurations');
  const securityIssues = issues.filter(
    (i) => i.area === 'Security & Compliance Checks' || i.area === 'Supabase Configuration & Access Control',
  );
  if (securityIssues.length === 0) {
    reportLines.push('');
    reportLines.push('No security risks detected by the automated audit runner.');
  } else {
    reportLines.push('');
    for (const i of securityIssues) {
      reportLines.push(`- **[${i.severity}]** ${i.title}`);
    }
  }

  reportLines.push('');
  reportLines.push('## Missing components or tables (if any)');
  const missing = issues.filter((i) => i.title.toLowerCase().includes('missing required table'));
  if (missing.length === 0) {
    reportLines.push('');
    reportLines.push('No missing tables detected from migrations.');
  } else {
    reportLines.push('');
    for (const i of missing) reportLines.push(`- **[${i.severity}]** ${i.title}`);
  }

  reportLines.push('');
  reportLines.push('## Recommended remediation steps');
  reportLines.push('');
  const remediation = issues
    .filter((i) => i.remediation)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map((i) => `- **[${i.severity}]** ${i.remediation}`);
  reportLines.push(remediation.length ? remediation.join('\n') : '- No remediation steps generated.');

  reportLines.push('');
  reportLines.push('## Priority actions for stabilization');
  reportLines.push('');
  const priority = issues
    .filter((i) => severityRank(i.severity) >= 3)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 8)
    .map((i) => `- **[${i.severity}]** ${i.title}`);
  reportLines.push(priority.length ? priority.join('\n') : '- No high-priority actions detected.');

  if (notes.length) {
    reportLines.push('');
    reportLines.push('## Notes');
    reportLines.push('');
    for (const n of notes) reportLines.push(`- ${n}`);
  }

  reportLines.push('');
  reportLines.push('---');
  reportLines.push(
    'This report was generated by `scripts/backend_audit.mjs`. Some checks require live credentials and may be skipped when not provided.',
  );
  reportLines.push('');

  const outPath = path.join(repoRoot, 'backend_audit_report.md');
  fs.writeFileSync(outPath, reportLines.join('\n'), 'utf8');

  // Also print a short summary to stdout for CI/terminal use.
  const critical = issues.filter((i) => i.severity === 'Critical').length;
  const high = issues.filter((i) => i.severity === 'High').length;
  const medium = issues.filter((i) => i.severity === 'Medium').length;
  const low = issues.filter((i) => i.severity === 'Low').length;
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        overall,
        counts: { critical, high, medium, low, total: issues.length },
        report: outPath,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

