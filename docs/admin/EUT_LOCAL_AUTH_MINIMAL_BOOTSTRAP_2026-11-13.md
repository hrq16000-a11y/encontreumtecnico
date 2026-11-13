# EUT - Supabase local Auth foundation: one disposable-runner micro-round

Scope: real local GoTrue, PostgREST, JWT, and RLS, but NOT real R1 imported-technician QA.

The hosted project has 66 recorded migration versions and the Git repository contains only six SQL migration files. The six reproduce baseline profiles/user roles/technicians and basic RLS. The R1 SQL fixtures in the PR simulate auth.uid() and installed triggers, but are NOT a real GoTrue-backed Supabase project.

The existing workflow starts a fresh temporary local project with ONLY six tracked foundational migrations; uses Supabase CLI v2 pinned, no hosted login or link, no production secret or data; excludes optional containers while keeping GoTrue and PostgREST. The test creates two synthetic local users via ephemeral local-only key, authenticates over HTTP, tests JWT-backed profile and role access, creates a legitimate Auth-owned pending technician, reads after request, and verifies anon cannot read it. All local values are scoped to the runner and the stack is discarded.

The test deliberately DOES NOT claim that an R1 Auth-less import works. That requires a reproducible current contract for the subset: technicians with optional user_id, R1 admin RPCs, provenance by canonical ID, private contact by ID, operational ban checks, audit log, service/IBGE taxonomy, and compatible grants/triggers/RLS. The existing R1 proposal/SQL fixtures are the starting point; the sixty missing SQL bodies need not be recovered individually, but equivalence of that subset must be demonstrated.

No hosted SQL, credentials, user data, email delivery, preview, payments, DNS, merge or deployment authorized. If local bootstrap fails, report the exact step instead of treating PostgreSQL synthetic tests as complete Auth QA.
