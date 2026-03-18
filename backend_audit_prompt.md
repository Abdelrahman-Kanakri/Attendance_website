# Backend & Configuration Audit Prompt (Professional)

**Objective:**  
Conduct a comprehensive technical audit of the backend systems, database, and configuration to determine operational integrity, identify failures, and detect any misconfigurations or security issues.

**Scope of Review:**

1. **Backend Process Health**
   - Verify that all backend services, APIs, scheduled jobs, and workers are running as expected.
   - Identify any crashes, stalled processes, unhandled exceptions, or performance bottlenecks.
   - Confirm proper logging, error handling, and monitoring are in place.
   - Report any endpoints that return errors or abnormal responses.

2. **Website Configuration**
   - Inspect application configuration for inconsistencies or misconfigurations.
   - Validate environment variables, authentication flows, and deployment settings.
   - Ensure routing, middleware, and integrations function correctly.

3. **Supabase Configuration & Access Control**
   - Review Supabase project settings, database policies, and authentication rules.
   - Verify Role‑Based Access Control (RBAC) is correctly implemented.
   - Confirm that sensitive employee data modification permissions (e.g., name, phone number, role, and personal details) are restricted exclusively to HR‑authorized roles.
   - Detect any privilege escalation risks or improperly exposed operations.

4. **Database Schema Validation**
   Confirm the existence, structure, and integrity of the following tables, including relationships, constraints, and indexes:

   - **Employee Data Table** — Core employee records and personal information.
   - **Attendance Table** — Check‑in/out logs, timestamps, and status tracking.
   - **Leave Management Table** — Leave requests, approvals, balances, and history.
   - **Salary/Payroll Table** — Compensation details, payment records, and adjustments.

   For each table:
   - Validate schema correctness and required fields.
   - Check data consistency and referential integrity.
   - Ensure appropriate access permissions and row‑level security policies.

5. **Security & Compliance Checks**
   - Verify encryption, data protection measures, and secure storage of sensitive information.
   - Check for exposed secrets, weak permissions, or publicly accessible data.
   - Ensure audit logs exist for sensitive operations.

6. **Functional Authorization Testing**
   - Simulate user roles (HR, manager, employee, guest) to confirm permission boundaries.
   - Verify that only HR personnel can modify sensitive employee attributes.
   - Ensure non‑authorized roles cannot bypass restrictions via API calls or direct database access.

7. **Deliverables**
   Provide a structured report including:
   - Overall system health status (Operational / Degraded / Broken)
   - Identified issues and severity levels
   - Security risks and misconfigurations
   - Missing components or tables (if any)
   - Recommended remediation steps
   - Priority actions for stabilization

**Output Format:**  
Produce a clear, professional audit report suitable for technical stakeholders and management.

