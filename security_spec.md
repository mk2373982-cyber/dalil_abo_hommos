# Security Specification — دليل أبوحمص (Abu Homs Guide)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path not explicitly matched is denied for both read and write.
2. **Public Civic Catalog vs. Operational PII**:
   - Non-PII public catalog collections (`categories`, `places`, `properties`, `agencies`, `offers`, `campaigns`, `emergency_contacts`, `public_settings`, `clinic_queues`) are publicly readable for zero-login civic browsing, and writable only by verified admins (with tightly bounded +1 counter updates on `clinic_queues.lastTicketNumber` and `public_settings.visitsCount`).
   - Operational records containing citizen phone numbers (`clinic_tickets`, `restaurant_orders`, `delivery_rides`, `submissions`) NEVER permit unauthenticated `list` queries; citizens can only `create` with strict initial status & schema validation and `get` their own specific document via its unguessable ID/token.
   - Internal business collections (`whatsapp_queue`, `finance_config`, `finance_settlements`, `admins`, `analytics_events` reads) are strictly restricted to verified admins (`isAdmin()`).
3. **Partner Finance Integrity (`SCREEN_12`)**:
   - `finance_config` enforces `raedPercent + mohamedPercent == 100` (within floating-point tolerance) whenever `isConfigured == true`, rejecting negative values or values > 100.
   - Closed `finance_settlements` (`existing().status == 'closed'`) cannot be retroactively modified.
4. **Bootstrapped Verified Admin**:
   - Admin checks strictly verify `request.auth != null && request.auth.token.email_verified == true` and either match the bootstrapped project owner email or exist in `/admins/$(request.auth.uid)`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Shadow Field Injection on Category Create**: `{ name: "مخابز", slug: "bakeries", ..., isAdmin: true }` -> Blocked by `hasOnly()`.
2. **Unauthenticated List Scrape on `clinic_tickets`**: `list /clinic_tickets` without admin auth -> Blocked (`allow list: if isAdmin()`).
3. **Unauthenticated List Scrape on `restaurant_orders`**: `list /restaurant_orders` without admin auth -> Blocked.
4. **Unauthenticated List Scrape on `submissions`**: `list /submissions` without admin auth -> Blocked.
5. **Email Spoofing Attack**: `email: "mk2373982@gmail.com"`, `email_verified: false` -> Blocked by `email_verified == true`.
6. **Privilege Escalation on `/admins/{uid}`**: Non-admin attempting `create /admins/attackerUid` -> Blocked.
7. **Status Shortcutting on Order Create**: Creating `restaurant_orders` with `status: "delivered"` instead of `"new"` -> Blocked.
8. **Retroactive Settlement Tampering**: Attempting to update `raedPercentLocked` on a `finance_settlements` doc where `existing().status == 'closed'` -> Blocked.
9. **Invalid Profit Split Math**: Setting `raedPercent: 130, mohamedPercent: -30` on `finance_config` -> Blocked.
10. **ID Poisoning Attack**: Creating a document with a 500-char or invalid-char ID (`../../evil`) -> Blocked by `isValidId()`.
11. **Oversized String Payload (Denial of Wallet)**: Submitting a 50KB `notes` string on `clinic_tickets` -> Blocked by `.size() <= 300`.
12. **Queue Manipulation by Citizen**: Unauthenticated user trying to change `clinic_queues.currentNumber` or `status` -> Blocked by `affectedKeys().hasOnly(['lastTicketNumber', 'updatedAt'])`.
