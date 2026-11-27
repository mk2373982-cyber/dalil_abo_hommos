/**
 * Firestore Security Rules Emulator Test Suite
 *
 * Covers:
 * 1. Partner tenant isolation (Clinic A vs Clinic B, Restaurant A vs Restaurant B, Auditor read-only)
 * 2. Authoritative order pricing validation (tampered price/subtotal/deliveryFee/snapshot rejected)
 * 3. Clinic booking atomic integrity (closed clinic rejected, future-date rollover poisoning rejected, direct ticket without queue update rejected)
 * 4. Captain anti-double-claim on delivery_rides and restaurant_orders
 * 5. Location sharing invariant (locationShared: true requires valid deliveryCoords)
 *
 * Run locally with Java 11+ & Firebase CLI:
 *   npm i -D @firebase/rules-unit-testing
 *   firebase emulators:exec --only firestore "node tests/firestore.rules.test.mjs"
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

let rulesUnitTesting;
try {
  rulesUnitTesting = await import('@firebase/rules-unit-testing');
} catch {
  console.error(
    'Missing @firebase/rules-unit-testing. Install it locally (npm i -D @firebase/rules-unit-testing) and run via: firebase emulators:exec --only firestore "node tests/firestore.rules.test.mjs"'
  );
  process.exit(1);
}

const { initializeTestEnvironment, assertFails, assertSucceeds } = rulesUnitTesting;
const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId: 'dalil-abuhoms-rules-test',
  firestore: { rules },
});

const todayCairo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

// All citizen-facing operational document IDs satisfy isStrongToken (length >= 20, <= 64)
const ORDER_VALID_ID = 'ORD-VALID-000000000001';
const ORDER_TAMPER_PRICE_ID = 'ORD-TAMPER-PRICE-00001';
const ORDER_TAMPER_FEE_ID = 'ORD-TAMPER-FEE-0000001';
const ORDER_NO_SNAPSHOT_ID = 'ORD-NO-SNAPSHOT-000001';
const ORDER_BAD_LOC_ID = 'ORD-BAD-LOC-0000000001';
const ORDER_ANON_ID = 'ORD-ANON-REJECT-00001';
const ORDER_REST_A_ID = 'ORD-REST-A-00000000001';
const ORDER_REST_B_ID = 'ORD-REST-B-00000000001';
const ORDER_READY_CAP_ID = 'ORD-READY-CAP-00000001';
const RIDE_CAP_ID = 'DLV-CONCURRENT-0000001';
const TICKET_CLINIC_A_ID = 'TKT-CLINIC-A-000000001';
const TICKET_CLINIC_B_ID = 'TKT-CLINIC-B-000000001';
const TICKET_CLOSED_ID = 'TKT-CLOSED-00000000001';
const TICKET_FUTURE_ID = 'TKT-FUTURE-00000000001';
const TICKET_ORPHAN_ID = 'TKT-ORPHAN-00000000001';

try {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Partner accounts with verified UIDs & isolated scopes
    await db.doc('admins/clinic-a-uid').set({
      uid: 'clinic-a-uid',
      email: 'clinic.a@test.local',
      role: 'partner',
      partnerTypes: ['clinic'],
      managedPlaceIds: ['doc-a'],
      active: true,
    });
    await db.doc('admins/clinic-b-uid').set({
      uid: 'clinic-b-uid',
      email: 'clinic.b@test.local',
      role: 'partner',
      partnerTypes: ['clinic'],
      managedPlaceIds: ['doc-b'],
      active: true,
    });
    await db.doc('admins/rest-a-uid').set({
      uid: 'rest-a-uid',
      email: 'rest.a@test.local',
      role: 'partner',
      partnerTypes: ['restaurant'],
      managedPlaceIds: ['rest-a'],
      active: true,
    });
    await db.doc('admins/rest-b-uid').set({
      uid: 'rest-b-uid',
      email: 'rest.b@test.local',
      role: 'partner',
      partnerTypes: ['restaurant'],
      managedPlaceIds: ['rest-b'],
      active: true,
    });
    await db.doc('admins/auditor-uid').set({
      uid: 'auditor-uid',
      email: 'auditor@test.local',
      role: 'auditor',
      active: true,
    });
    await db.doc('admins/cap-1-uid').set({
      uid: 'cap-1-uid',
      email: 'cap1@test.local',
      role: 'partner',
      partnerTypes: ['captain'],
      active: true,
    });
    await db.doc('admins/cap-2-uid').set({
      uid: 'cap-2-uid',
      email: 'cap2@test.local',
      role: 'partner',
      partnerTypes: ['captain'],
      active: true,
    });

    // Two restaurants with authoritative menuPriceMap
    await db.doc('places/rest-a').set({
      id: 'rest-a',
      name: 'مطعم أ',
      categoryId: 'cat-rest',
      categorySlug: 'restaurants',
      area: 'شارع المحطة',
      address: 'أبوحمص',
      phone: '01012345678',
      deliveryFeeInTown: 15,
      deliveryFeeVillage: 25,
      menuPriceMap: { 'm-1': 100, 'm-2': 50 },
    });
    await db.doc('places/rest-b').set({
      id: 'rest-b',
      name: 'مطعم ب',
      categoryId: 'cat-rest',
      categorySlug: 'restaurants',
      area: 'شارع بورسعيد',
      address: 'أبوحمص',
      phone: '01087654321',
      deliveryFeeInTown: 20,
      deliveryFeeVillage: 30,
      menuPriceMap: { 'b-1': 80 },
    });

    // Clinic queues: doc-a open, doc-b closed
    await db.doc('clinic_queues/doc-a').set({
      doctorId: 'doc-a',
      doctorName: 'د. أ',
      sessionDate: todayCairo,
      currentNumber: 0,
      lastTicketNumber: 1,
      lastTicketId: TICKET_CLINIC_A_ID,
      status: 'open',
    });
    await db.doc('clinic_queues/doc-b').set({
      doctorId: 'doc-b',
      doctorName: 'د. ب',
      sessionDate: todayCairo,
      currentNumber: 0,
      lastTicketNumber: 1,
      lastTicketId: TICKET_CLINIC_B_ID,
      status: 'closed',
    });

    // Clinic tickets
    await db.doc(`clinic_tickets/${TICKET_CLINIC_A_ID}`).set({
      id: TICKET_CLINIC_A_ID,
      ticketCode: TICKET_CLINIC_A_ID,
      ticketNumber: 1,
      sessionDate: todayCairo,
      doctorId: 'doc-a',
      doctorName: 'د. أ',
      patientName: 'مريض أ',
      patientPhone: '01011111111',
      status: 'waiting',
      createdAt: new Date().toISOString(),
    });
    await db.doc(`clinic_tickets/${TICKET_CLINIC_B_ID}`).set({
      id: TICKET_CLINIC_B_ID,
      ticketCode: TICKET_CLINIC_B_ID,
      ticketNumber: 1,
      sessionDate: todayCairo,
      doctorId: 'doc-b',
      doctorName: 'د. ب',
      patientName: 'مريض ب',
      patientPhone: '01022222222',
      status: 'waiting',
      createdAt: new Date().toISOString(),
    });

    // Existing restaurant orders for tenant isolation + captain claim tests
    const baseOrder = {
      customerName: 'عميل تجريبي',
      customerPhone: '01012345678',
      deliveryArea: 'شارع المحطة',
      deliveryAddress: 'عمارة 5',
      items: [{ menuItemId: 'm-1', name: 'كباب', price: 100, quantity: 1 }],
      subtotal: 100,
      deliveryFee: 15,
      total: 115,
      pricingSnapshot: {
        currency: 'EGP',
        subtotal: 100,
        deliveryFee: 15,
        total: 115,
        validatedAt: new Date().toISOString(),
        pricingSource: 'firestore_catalog',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.doc(`restaurant_orders/${ORDER_REST_A_ID}`).set({
      ...baseOrder,
      id: ORDER_REST_A_ID,
      orderCode: ORDER_REST_A_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      status: 'new',
    });
    await db.doc(`restaurant_orders/${ORDER_REST_B_ID}`).set({
      ...baseOrder,
      id: ORDER_REST_B_ID,
      orderCode: ORDER_REST_B_ID,
      restaurantId: 'rest-b',
      restaurantName: 'مطعم ب',
      status: 'new',
    });
    await db.doc(`restaurant_orders/${ORDER_READY_CAP_ID}`).set({
      ...baseOrder,
      id: ORDER_READY_CAP_ID,
      orderCode: ORDER_READY_CAP_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      status: 'ready',
    });

    // Pending delivery ride
    await db.doc(`delivery_rides/${RIDE_CAP_ID}`).set({
      id: RIDE_CAP_ID,
      rideCode: RIDE_CAP_ID,
      pickupArea: 'شارع المحطة',
      dropoffArea: 'شارع بورسعيد',
      itemDescription: 'أدوية',
      customerName: 'محمد',
      customerPhone: '01012345678',
      estimatedFee: 20,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Public settings doc with an existing visits counter
    await db.doc('public_settings/main').set({
      uid: 'public-main',
      visitsCount: 100,
      updatedAt: new Date().toISOString(),
    });
  });

  // =========================================================================
  // 1. Partner Tenant Isolation (Clinics, Restaurants, Auditor Read-Only)
  // =========================================================================
  const clinicADb = testEnv.authenticatedContext('clinic-a-uid', { email: 'clinic.a@test.local' }).firestore();
  await assertSucceeds(
    clinicADb.doc(`clinic_tickets/${TICKET_CLINIC_A_ID}`).update({
      status: 'called',
      updatedAt: new Date().toISOString(),
    })
  );
  // Clinic A CANNOT update Clinic B's queue or tickets
  await assertFails(clinicADb.doc('clinic_queues/doc-b').update({ currentNumber: 1 }));
  await assertFails(
    clinicADb.doc(`clinic_tickets/${TICKET_CLINIC_B_ID}`).update({
      status: 'called',
      updatedAt: new Date().toISOString(),
    })
  );
  // Clinic A CANNOT query Clinic B's tickets
  await assertFails(
    clinicADb.collection('clinic_tickets').where('doctorId', '==', 'doc-b').get()
  );

  // Restaurant A can advance its own order new -> preparing, CANNOT touch Restaurant B, CANNOT claim ready -> on_the_way
  const restADb = testEnv.authenticatedContext('rest-a-uid', { email: 'rest.a@test.local' }).firestore();
  await assertSucceeds(
    restADb.doc(`restaurant_orders/${ORDER_REST_A_ID}`).update({
      status: 'preparing',
      updatedAt: new Date().toISOString(),
    })
  );
  await assertFails(
    restADb.doc(`restaurant_orders/${ORDER_REST_B_ID}`).update({
      status: 'preparing',
      updatedAt: new Date().toISOString(),
    })
  );
  await assertFails(
    restADb.collection('restaurant_orders').where('restaurantId', '==', 'rest-b').get()
  );
  await assertFails(
    restADb.doc(`restaurant_orders/${ORDER_READY_CAP_ID}`).update({
      status: 'on_the_way',
      updatedAt: new Date().toISOString(),
    })
  );

  // Auditor is strictly read-only across catalog and operational collections
  const auditorDb = testEnv.authenticatedContext('auditor-uid', { email: 'auditor@test.local' }).firestore();
  await assertSucceeds(auditorDb.collection('restaurant_orders').limit(5).get());
  await assertFails(auditorDb.doc('places/rest-a').update({ name: 'Hacked' }));
  await assertFails(
    auditorDb.doc(`restaurant_orders/${ORDER_REST_A_ID}`).update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    })
  );
  await assertFails(auditorDb.doc('clinic_queues/doc-a').update({ status: 'closed' }));

  // =========================================================================
  // 2. Trusted Order Pricing Validation & Location Sharing Invariant
  // =========================================================================
  const anonDb = testEnv.unauthenticatedContext().firestore();
  // Signed-in citizen (no admin doc) — citizen writes now require authentication.
  const citizenDb = testEnv.authenticatedContext('citizen-uid', { email: 'citizen@test.local' }).firestore();
  const validSnapshot = {
    currency: 'EGP',
    subtotal: 200,
    deliveryFee: 15,
    total: 215,
    validatedAt: new Date().toISOString(),
    pricingSource: 'firestore_catalog',
  };

  // Valid catalog-matched order -> SUCCEEDS
  await assertSucceeds(
    citizenDb.doc(`restaurant_orders/${ORDER_VALID_ID}`).set({
      id: ORDER_VALID_ID,
      orderCode: ORDER_VALID_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      customerName: 'أحمد علي',
      customerPhone: '01012345678',
      deliveryArea: 'شارع المحطة',
      deliveryAddress: 'عمارة 5',
      locationShared: true,
      deliveryCoords: { lat: 31.1, lng: 30.31, accuracy: 20 },
      items: [{ menuItemId: 'm-1', name: 'كباب', price: 100, quantity: 2 }],
      subtotal: 200,
      deliveryFee: 15,
      total: 215,
      pricingSnapshot: validSnapshot,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  );

  // Anonymous (unauthenticated) order creation -> FAILS (anti-abuse: create requires auth)
  await assertFails(
    anonDb.doc(`restaurant_orders/${ORDER_ANON_ID}`).set({
      id: ORDER_ANON_ID,
      orderCode: ORDER_ANON_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      customerName: 'أحمد علي',
      customerPhone: '01012345678',
      deliveryArea: 'شارع المحطة',
      deliveryAddress: 'عمارة 5',
      items: [{ menuItemId: 'm-1', name: 'كباب', price: 100, quantity: 2 }],
      subtotal: 200,
      deliveryFee: 15,
      total: 215,
      pricingSnapshot: validSnapshot,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  );

  // Tampered unit price (1 EGP instead of 100 EGP) -> FAILS
  await assertFails(
    citizenDb.doc(`restaurant_orders/${ORDER_TAMPER_PRICE_ID}`).set({
      id: ORDER_TAMPER_PRICE_ID,
      orderCode: ORDER_TAMPER_PRICE_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      customerName: 'مخترق',
      customerPhone: '01012345678',
      deliveryArea: 'شارع المحطة',
      deliveryAddress: 'عمارة 5',
      items: [{ menuItemId: 'm-1', name: 'كباب', price: 1, quantity: 2 }],
      subtotal: 2,
      deliveryFee: 15,
      total: 17,
      pricingSnapshot: { ...validSnapshot, subtotal: 2, total: 17 },
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  );

  // Tampered delivery fee (0 EGP instead of 15 EGP) -> FAILS
  await assertFails(
    citizenDb.doc(`restaurant_orders/${ORDER_TAMPER_FEE_ID}`).set({
      id: ORDER_TAMPER_FEE_ID,
      orderCode: ORDER_TAMPER_FEE_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      customerName: 'مخترق',
      customerPhone: '01012345678',
      deliveryArea: 'شارع المحطة',
      deliveryAddress: 'عمارة 5',
      items: [{ menuItemId: 'm-1', name: 'كباب', price: 100, quantity: 2 }],
      subtotal: 200,
      deliveryFee: 0,
      total: 200,
      pricingSnapshot: { ...validSnapshot, deliveryFee: 0, total: 200 },
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  );

  // Missing pricingSnapshot -> FAILS
  await assertFails(
    citizenDb.doc(`restaurant_orders/${ORDER_NO_SNAPSHOT_ID}`).set({
      id: ORDER_NO_SNAPSHOT_ID,
      orderCode: ORDER_NO_SNAPSHOT_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      customerName: 'عميل',
      customerPhone: '01012345678',
      deliveryArea: 'شارع المحطة',
      deliveryAddress: 'عمارة 5',
      items: [{ menuItemId: 'm-1', name: 'كباب', price: 100, quantity: 2 }],
      subtotal: 200,
      deliveryFee: 15,
      total: 215,
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  );

  // locationShared: true WITHOUT deliveryCoords -> FAILS
  await assertFails(
    citizenDb.doc(`restaurant_orders/${ORDER_BAD_LOC_ID}`).set({
      id: ORDER_BAD_LOC_ID,
      orderCode: ORDER_BAD_LOC_ID,
      restaurantId: 'rest-a',
      restaurantName: 'مطعم أ',
      customerName: 'عميل',
      customerPhone: '01012345678',
      deliveryArea: 'شارع المحطة',
      deliveryAddress: 'عمارة 5',
      locationShared: true,
      items: [{ menuItemId: 'm-1', name: 'كباب', price: 100, quantity: 2 }],
      subtotal: 200,
      deliveryFee: 15,
      total: 215,
      pricingSnapshot: validSnapshot,
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  );

  // =========================================================================
  // 3. Clinic Booking Atomic Integrity & Closed / Rollover Poisoning Protection
  // =========================================================================
  // Booking on closed clinic -> FAILS
  await assertFails(
    citizenDb.runTransaction(async (tx) => {
      tx.set(citizenDb.doc(`clinic_tickets/${TICKET_CLOSED_ID}`), {
        id: TICKET_CLOSED_ID,
        ticketCode: TICKET_CLOSED_ID,
        ticketNumber: 2,
        sessionDate: todayCairo,
        doctorId: 'doc-b',
        doctorName: 'د. ب',
        patientName: 'مريض',
        patientPhone: '01012345678',
        status: 'waiting',
      });
      tx.update(citizenDb.doc('clinic_queues/doc-b'), {
        lastTicketNumber: 2,
        lastTicketId: TICKET_CLOSED_ID,
        updatedAt: new Date().toISOString(),
      });
    })
  );

  // Future-date rollover poisoning ("2099-12-31") -> FAILS
  await assertFails(
    citizenDb.runTransaction(async (tx) => {
      tx.set(citizenDb.doc(`clinic_tickets/${TICKET_FUTURE_ID}`), {
        id: TICKET_FUTURE_ID,
        ticketCode: TICKET_FUTURE_ID,
        ticketNumber: 1,
        sessionDate: '2099-12-31',
        doctorId: 'doc-a',
        doctorName: 'د. أ',
        patientName: 'مريض',
        patientPhone: '01012345678',
        status: 'waiting',
      });
      tx.update(citizenDb.doc('clinic_queues/doc-a'), {
        sessionDate: '2099-12-31',
        currentNumber: 0,
        lastTicketNumber: 1,
        lastTicketId: TICKET_FUTURE_ID,
        updatedAt: new Date().toISOString(),
      });
    })
  );

  // Direct ticket creation without atomic queue increment -> FAILS
  await assertFails(
    citizenDb.doc(`clinic_tickets/${TICKET_ORPHAN_ID}`).set({
      id: TICKET_ORPHAN_ID,
      ticketCode: TICKET_ORPHAN_ID,
      ticketNumber: 99,
      sessionDate: todayCairo,
      doctorId: 'doc-a',
      doctorName: 'د. أ',
      patientName: 'مريض',
      patientPhone: '01012345678',
      status: 'waiting',
    })
  );

  // =========================================================================
  // 4. Captain Anti-Double-Claim on Delivery Rides & Restaurant Orders
  // =========================================================================
  const cap1Db = testEnv.authenticatedContext('cap-1-uid', { email: 'cap1@test.local' }).firestore();
  const cap2Db = testEnv.authenticatedContext('cap-2-uid', { email: 'cap2@test.local' }).firestore();

  // Captain 1 claims delivery ride -> SUCCEEDS
  await assertSucceeds(
    cap1Db.doc(`delivery_rides/${RIDE_CAP_ID}`).update({
      status: 'accepted',
      captainUid: 'cap-1-uid',
      captainName: 'كابتن 1',
      captainPhone: '01011111111',
      updatedAt: new Date().toISOString(),
    })
  );
  // Captain 2 cannot steal or update Captain 1's ride -> FAILS
  await assertFails(
    cap2Db.doc(`delivery_rides/${RIDE_CAP_ID}`).update({
      status: 'picked_up',
      captainUid: 'cap-2-uid',
      captainName: 'كابتن 2',
      captainPhone: '01022222222',
      updatedAt: new Date().toISOString(),
    })
  );
  await assertFails(
    cap2Db.doc(`delivery_rides/${RIDE_CAP_ID}`).update({
      status: 'picked_up',
      updatedAt: new Date().toISOString(),
    })
  );

  // Captain 1 claims ready restaurant order -> SUCCEEDS
  await assertSucceeds(
    cap1Db.doc(`restaurant_orders/${ORDER_READY_CAP_ID}`).update({
      status: 'on_the_way',
      captainUid: 'cap-1-uid',
      captainName: 'كابتن 1',
      captainPhone: '01011111111',
      updatedAt: new Date().toISOString(),
    })
  );
  // Captain 2 cannot steal or deliver Captain 1's restaurant order -> FAILS
  await assertFails(
    cap2Db.doc(`restaurant_orders/${ORDER_READY_CAP_ID}`).update({
      status: 'delivered',
      updatedAt: new Date().toISOString(),
    })
  );
  // Captain 1 completes delivery -> SUCCEEDS
  await assertSucceeds(
    cap1Db.doc(`restaurant_orders/${ORDER_READY_CAP_ID}`).update({
      status: 'delivered',
      updatedAt: new Date().toISOString(),
    })
  );

  // =========================================================================
  // 5. Anonymous (Unauthenticated) Write Denials & Visits Counter Inflation
  // =========================================================================
  // Anonymous analytics_events create -> FAILS (analytics spam prevention)
  await assertFails(
    anonDb.doc('analytics_events/ANON-ANALYTICS-000001').set({
      eventType: 'visit',
      createdAt: new Date().toISOString(),
    })
  );
  // Anonymous analytics_events with a fully-shaped payload -> still FAILS (auth is the gate)
  await assertFails(
    anonDb.doc('analytics_events/ANON-ANALYTICS-000002').set({
      eventType: 'search',
      query: 'مطعم',
      resultCount: 3,
      categorySlug: 'restaurants',
      createdAt: new Date().toISOString(),
    })
  );
  // Signed-in citizen CAN create a valid analytics event -> SUCCEEDS
  await assertSucceeds(
    citizenDb.doc('analytics_events/CIT-ANALYTICS-00000001').set({
      eventType: 'visit',
      createdAt: new Date().toISOString(),
    })
  );

  // Anonymous clinic_tickets create -> FAILS (ticket spam without an account)
  await assertFails(
    anonDb.doc('clinic_tickets/ANON-TICKET-0000000001').set({
      id: 'ANON-TICKET-0000000001',
      ticketCode: 'ANON-TICKET-0000000001',
      ticketNumber: 3,
      sessionDate: todayCairo,
      doctorId: 'doc-a',
      doctorName: 'د. أ',
      patientName: 'مريض مجهول',
      patientPhone: '01012345678',
      status: 'waiting',
    })
  );

  // Anonymous public_settings/main visitsCount inflation -> FAILS
  await assertFails(
    anonDb.doc('public_settings/main').update({ visitsCount: 101 })
  );
  // Anonymous attempt to rewrite visitsCount to an arbitrary value -> FAILS
  await assertFails(
    anonDb.doc('public_settings/main').update({ visitsCount: 99999 })
  );
  // Signed-in citizen +1 increment -> SUCCEEDS (the one legitimate anonymous-proxy path)
  await assertSucceeds(
    citizenDb.doc('public_settings/main').update({ visitsCount: 101 })
  );
  // Signed-in citizen skipping the counter (+5) -> FAILS (increment must be exactly +1)
  await assertFails(
    citizenDb.doc('public_settings/main').update({ visitsCount: 106 })
  );
  // Signed-in citizen cannot smuggle other fields through the visits path -> FAILS
  await assertFails(
    citizenDb.doc('public_settings/main').update({ visitsCount: 102, uid: 'hijacked' })
  );

  assert.ok(true);
  console.log('All Firestore security rules tests passed!');
} finally {
  await testEnv.cleanup();
}
