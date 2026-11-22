# Security Specification — دليل أبوحمص (Zero-Trust Audit & Hardening)

## 1. Access Control Matrix (RBAC + Partner Tenant Isolation)

| Role | Directory Catalog | Clinic Queues & Tickets | Restaurant Orders | Delivery Rides | Submissions & WhatsApp | Finance Ledger | Admins Registry |
|---|---|---|---|---|---|---|---|
| `super_admin` | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD (except self-delete) |
| `moderator` | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Denied | Self `get` only |
| `auditor` | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only | Self `get` only |
| `partner` (`clinic`) | Public Read | Read/Write **ONLY** `doctorId in managedPlaceIds` | Denied | Denied | Denied | Denied | Self `get` only |
| `partner` (`restaurant`) | Public Read | Denied | Read/Update **ONLY** `restaurantId in managedPlaceIds` (`new→preparing→ready\|cancelled`) | Denied | Denied | Denied | Self `get` only |
| `partner` (`captain`) | Public Read | Denied | Read `ready` or `captainUid==uid`; atomic claim `ready→on_the_way`; complete `on_the_way→delivered` | Read `pending` or `captainUid==uid`; atomic claim `pending→accepted`; advance own ride | Denied | Denied | Self `get` only |
| Public Citizen | Read | Public queue board; atomic booking when `status=='open'` + linked ticket; token `get` | Authoritative catalog-verified `create`; token `get` | `create` (`pending`); token `get` | `create` (`received`); token `get` | Denied | Denied |

## 2. Threat Payloads & Enforced Defenses

1. **Cross-Tenant Partner Access**:
   - *Attack*: Clinic Partner A (`managedPlaceIds: ['ahmed-mahmoud']`) queries or updates `clinic_tickets` for `doctorId == 'mona-abdelaziz'`, or accesses `restaurant_orders` / `delivery_rides`.
   - *Defense*: `isClinicPartnerFor(existing().doctorId)` fails immediately on both `list`, `get`, and `update`. Restaurant and Captain collections require their respective scopes (`hasPartnerScope`).
2. **Auditor Privilege Escalation**:
   - *Attack*: Account with `role: 'auditor'` attempts to edit a place, update an order, or approve a submission.
   - *Defense*: `isAdminWriter()` explicitly excludes `auditor`. Only `isAdminPanelReader()` includes `auditor`.
3. **Client Order Price / Total / Foreign Item Tampering**:
   - *Attack*: Browser submits `restaurant_orders` with `items[0].price = 1` instead of catalog price `220`, or submits a `menuItemId` belonging to another restaurant, or sends `quantity = -2` or `deliveryFee = 0`.
   - *Defense*: `verifyOrderAgainstCatalog()` reads `places/{restaurantId}.menuPriceMap` server-side in Firestore Rules, validates item membership, integer quantity `1..20`, exact unit price match, exact computed `subtotal`, exact `deliveryFee`, and `total == subtotal + deliveryFee`.
4. **Arbitrary Clinic Ticket Numbers / Unlinked Queue Counter Increments**:
   - *Attack*: Attacker creates `clinic_tickets/{id}` with `ticketNumber: 1` without updating queue, or bumps `clinic_queues/{id}.lastTicketNumber` while clinic is `closed` or `paused`.
   - *Defense*: Cross-document atomic `existsAfter`/`getAfter` coupling between `clinic_queues/{doctorId}` (`lastTicketId`, `lastTicketNumber`, `sessionDate`) and `clinic_tickets/{ticketId}`. Queue updates by citizens require `existing().status == 'open'`.
5. **Delivery Ride / Ready Order Double-Claim Race Condition**:
   - *Attack*: Two captains concurrently accept the same `pending` delivery ride or `ready` restaurant order, or Captain B attempts to overwrite `captainUid` on Captain A's accepted ride.
   - *Defense*: Client executes `runTransaction`; Rules enforce `!('captainUid' in existing()) && existing().status == 'pending' && incoming().captainUid == request.auth.uid` for claim, and `existing().captainUid == request.auth.uid && incoming().captainUid == existing().captainUid` for subsequent transitions.
6. **Spoofed GPS Location Sharing**:
   - *Attack*: Client submits `locationShared: true` without valid `deliveryCoords`.
   - *Defense*: `isValidRestaurantOrder()` rejects `locationShared == true` unless valid `deliveryCoords: { lat, lng }` is present.
