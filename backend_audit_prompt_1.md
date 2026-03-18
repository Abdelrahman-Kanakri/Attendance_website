# Comprehensive Backend, Security & HR System Audit Suite (Supabase)

This document provides five professional, ready‑to‑use assets for evaluating an HR web application built on Supabase: 
1) AI Automated Testing Agent Prompt
2) Security / Penetration Testing Plan
3) Supabase‑Specific Technical Checklist
4) HR System Compliance Audit
5) Step‑by‑Step Manual Test Cases

---

## 1) 🔎 AI Automated Testing Agent — Master Prompt

**Objective:** Autonomously evaluate system health, configuration integrity, authorization controls, and database completeness.

**Instructions for the Agent:**

Perform a full technical audit of the application backend, APIs, database, and Supabase configuration.

### A. System Health
- Verify all services, endpoints, and background jobs are operational
- Detect crashes, timeouts, high latency, or failed dependencies
- Inspect logs for recurring errors or unhandled exceptions

### B. Configuration Validation
- Validate environment variables and secrets usage
- Check deployment configuration consistency
- Detect missing or invalid integrations

### C. Authorization & Access Control
- Evaluate Role‑Based Access Control (RBAC)
- Confirm sensitive employee data modification is restricted to HR roles only:
  - Name
  - Phone number
  - Role/position
  - Salary details
  - Personal information
- Attempt privilege escalation scenarios

### D. Database Integrity
Verify existence and structure of core HR tables:
- Employee Data
- Attendance
- Leave Management
- Salaries / Payroll

For each table:
- Validate schema correctness
- Confirm relationships and constraints
- Check for orphaned or inconsistent records

### E. Supabase Policies
- Review Row Level Security (RLS)
- Validate authentication enforcement
- Detect publicly exposed tables or functions

### F. Output
Provide a structured report including:
- System status (Operational / Degraded / Broken)
- Critical vulnerabilities
- Misconfigurations
- Missing components
- Recommended remediation steps

---

## 2) 🛡️ Security / Penetration Testing Plan

### Authentication Attacks
- Test brute‑force protections
- Attempt login bypass
- Validate password policies
- Check session expiration and token revocation

### Authorization Attacks
- Access HR‑only endpoints as non‑HR user
- Modify employee data without permission
- Direct API calls bypassing frontend controls
- Horizontal privilege escalation (employee → other employee data)
- Vertical escalation (employee → HR/admin)

### API Security
- Test for IDOR (Insecure Direct Object Reference)
- Validate input sanitization
- Attempt injection attacks (SQL, NoSQL, command)
- Check rate limiting

### Data Exposure
- Inspect responses for sensitive data leakage
- Verify salaries and personal data are protected
- Check storage buckets for public access

### Infrastructure & Secrets
- Search for exposed API keys or service keys
- Validate HTTPS enforcement
- Check CORS configuration

---

## 3) ⚙️ Supabase‑Specific Checklist

### Authentication (Supabase Auth)
- Email/password rules enforced
- MFA enabled (if required)
- Proper session handling
- Secure redirect URLs

### Row Level Security (RLS)
Ensure RLS is ENABLED on ALL sensitive tables.

Verify policies such as:
- Employees can view their own data only
- Managers can view team data (if applicable)
- HR can view and modify all employee records
- Non‑HR users cannot update sensitive fields

### Database
Confirm presence of tables:
- employees
- attendance
- leaves
- salaries

Check:
- Foreign keys and constraints
- Audit fields (created_at, updated_at)
- Soft delete strategy (if used)

### Storage (Supabase Storage)
- Buckets are private unless explicitly required
- Signed URLs used for file access
- No public exposure of sensitive documents

### API & Service Keys
- Service role key NOT exposed to client
- Public anon key used appropriately
- Edge functions secured

---

## 4) 📊 HR System Compliance Audit

### Data Governance
- Personal data access restricted by role
- Salary data visible only to HR/authorized finance roles
- Audit trail for sensitive changes

### Operational Requirements
System must support:
- Employee records management
- Attendance tracking
- Leave management workflow
- Payroll information storage

### Change Control
Verify that ONLY HR can modify:
- Employee name
- Phone number
- Role/position
- Salary information
- Employment status

### Record Integrity
- Historical records preserved
- No silent overwrites of critical data
- Proper approval workflows for leave and salary updates

---

## 5) 🧪 Step‑by‑Step Manual Test Cases

### Test Case 1 — HR Data Modification
1. Log in as HR user
2. Edit employee name, phone, role
3. Save changes
4. Confirm update succeeds
5. Verify audit log entry (if available)

Expected: Success

---

### Test Case 2 — Non‑HR Restriction
1. Log in as regular employee
2. Attempt to edit another employee's data
3. Attempt to edit own role or salary

Expected: Access denied / operation blocked

---

### Test Case 3 — Attendance Table
1. Perform check‑in action
2. Perform check‑out action
3. Verify records stored with timestamps

Expected: Accurate attendance entry created

---

### Test Case 4 — Leave Management
1. Submit leave request as employee
2. Approve/reject as HR or manager
3. Verify status updates and history tracking

Expected: Workflow operates correctly

---

### Test Case 5 — Payroll Data Protection
1. Log in as non‑HR user
2. Attempt to view salary table via UI and API

Expected: Access denied

---

### Test Case 6 — API Authorization Bypass
1. Capture a legitimate HR API request
2. Replay request using non‑HR credentials

Expected: Request rejected

---

## Final Deliverable

Produce a consolidated report including:
- Overall system health
- Security posture
- Compliance status
- Identified risks and severity
- Missing features or tables
- Prioritized remediation plan

---

*End of Audit Suite*

