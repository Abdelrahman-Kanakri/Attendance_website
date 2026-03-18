/// <reference types="https://esm.sh/@supabase/functions-js@2.4.4/src/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';

type Role = 'employee' | 'admin' | 'manager';

type CreateEmployeeBody = {
  email: string;
  full_name: string;
  role: Role;
  department?: string | null;
  position?: string | null;
  password?: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function makeTempPassword() {
  // 16+ chars, mixed; avoid confusing characters
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function isRole(value: unknown): value is Role {
  return value === 'employee' || value === 'admin' || value === 'manager';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');


  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Missing Supabase environment configuration on Edge Function' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  // Client (caller) context - validates JWT.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();

  if (userError || !user) {
    return json(401, { error: 'Unauthorized' });
  }

  // Admin client - bypasses RLS and can create auth users.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authorize: only admin role can create employees.
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return json(500, { error: profileError.message });
  }

  if (!callerProfile?.is_active) {
    return json(403, { error: 'Account is inactive' });
  }

  if (callerProfile.role !== 'admin') {
    return json(403, { error: 'Forbidden (admin only)' });
  }

  let body: CreateEmployeeBody;
  try {
    body = (await req.json()) as CreateEmployeeBody;
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const full_name = (body.full_name ?? '').trim();
  const role = body.role;
  const department = (body.department ?? null) || null;
  const position = (body.position ?? null) || null;
  const password = (body.password ?? '').trim() || makeTempPassword();

  if (!email || !email.includes('@')) {
    return json(400, { error: 'Invalid email' });
  }
  if (!full_name || full_name.length < 2) {
    return json(400, { error: 'Invalid full_name' });
  }
  if (!isRole(role)) {
    return json(400, { error: 'Invalid role' });
  }

  // Create Auth user
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !created?.user) {
    return json(400, { error: createError?.message ?? 'Failed to create user' });
  }

  const newUser = created.user;

  // Create profile row (FK target for attendance/leave/salary)
  const { error: insertProfileError } = await admin.from('profiles').insert({
    id: newUser.id,
    full_name,
    email,
    role,
    department,
    position,
    is_active: true,
  });

  if (insertProfileError) {
    // Rollback: delete auth user if profile insert fails
    await admin.auth.admin.deleteUser(newUser.id);
    return json(400, { error: insertProfileError.message });
  }

  return json(200, {
    id: newUser.id,
    email,
    full_name,
    role,
    temp_password: password,
  });
});

