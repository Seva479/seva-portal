# SEVA Portal Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Application Intake Isolation (PII Protection):** Public NGO applicants may ONLY `create` a document in `/applications/{applicationId}` with `status == 'New Application'`, `priority == 'Medium'`, `id == applicationId`, bounded string/array sizes, and `server_created_at == request.time`. Public users can NEVER `get`, `list`, `update`, or `delete` any application (preventing PII exposure of NGO emails, phones, and addresses).
2. **Contact Inquiry Isolation:** Public visitors may ONLY `create` a document in `/contact_messages/{messageId}` with `status == 'Unread'`, `id == messageId`, bounded string sizes, and `server_created_at == request.time`. Public users can NEVER read, update, or delete messages.
3. **Verified Admin Access:** Only verified SEVA admins (`request.auth != null && request.auth.token.email_verified == true` matching bootstrapped admin `seva.ecology@gmail.com` or an existing `/admins/{uid}` doc) may `get`, `list`, `update`, or `delete` applications and contact messages.
4. **Immutability & Temporal Integrity:** `id` and `server_created_at` are immutable on update; `server_updated_at` must equal `request.time` on every write.
5. **Path Hardening:** Every single-document operation validates `isValidId(...)` (`<= 128` chars matching `^[a-zA-Z0-9_\-]+$`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated PII Read:** Anonymous user attempts `get` or `list` on `/applications` or `/contact_messages`.
2. **Unverified Admin Email Spoof:** User signs in with `seva.ecology@gmail.com` but `email_verified: false` and attempts `list` on `/applications`.
3. **Non-Admin Authenticated Read:** Signed-in user `random@example.com` (`email_verified: true`) attempts `get` or `list` on `/applications`.
4. **Shadow Field Injection on Create:** Public applicant submits `/applications/SEVA-2026-1119-1001` with extra ghost field `isAdminApproved: true`.
5. **Status Shortcutting on Create:** Public applicant submits `/applications/SEVA-2026-1119-1002` with `status: "Approved"` instead of `"New Application"`.
6. **Priority Escalation on Create:** Public applicant submits `/applications/SEVA-2026-1119-1003` with `priority: "High"` instead of `"Medium"`.
7. **Timestamp Forgery on Create:** Public applicant submits `server_created_at: "2020-01-01T00:00:00Z"` instead of `request.time`.
8. **ID Mismatch / Path Poisoning:** Public applicant writes to `/applications/../../../evil` or sets `data.id != applicationId`.
9. **Denial-of-Wallet Oversized String:** Public applicant submits a 100KB `brief_description` exceeding `4000` chars.
10. **Unbounded Array Poisoning:** Public applicant submits 50 items in `key_areas_of_work` (exceeding max `20`) or non-string element `[123]`.
11. **Public Update/Delete Attempt:** Non-admin attempts `update` or `delete` on `/applications/{id}` or `/contact_messages/{id}`.
12. **Self-Assigned Admin Escalation:** Non-admin user attempts `create` on `/admins/{request.auth.uid}` with `{ role: "super_admin" }`.
