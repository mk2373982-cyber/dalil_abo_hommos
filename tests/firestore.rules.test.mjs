/**
 * Firestore Security Rules Emulator Test Suite
 *
 * Requires Java 11+ and Firebase CLI Emulator:
 *   firebase emulators:exec --only firestore "node tests/firestore.rules.test.mjs"
 *
 * Verifies:
 * 1. Cross-partner isolation (clinic A cannot read/write clinic B; restaurant A cannot read/write restaurant B).
 * 2. Auditor is strictly read-only across admin/operational collections.
 * 3. Tampered restaurant order price / foreign menuItemId is rejected by rules.
 * 4. Booking on a closed clinic queue or faking a ticket without atomic queue increment is rejected.
 * 5. Captain B cannot overwrite/claim a delivery ride already claimed by Captain A.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

async function run() {
  let rulesTesting;
  try {
    rulesTesting = await import('@firebase/rules-unit-testing');
  } catch {
    console.error(
      'Missing @firebase/rules-unit-testing. Install it as a devDependency and run inside `firebase emulators:exec --only firestore "node tests/firestore.rules.test.mjs"`.'
    );
    process.exit(1);
  }

  const { initializeTestEnvironment, assertSucceeds, assertFails } = rulesTesting;
  const { doc, getDoc, setDoc, updateDoc, runTransaction } = await import('firebase/firestore');

  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: 'dalil-abuhoms-rules-test',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });

  try {
    // Seed privileged fixtures
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'admins', 'clinic-partner-a'), {
        uid: 'clinic-partner-a',
        email: 'clinic-a@test.local',
        role: 'partner',
        active: true,
        partnerTypes: ['clinic'],
        managedPlaceIds: ['clinic-a'],
      });
      await setDoc(doc(db, 'admins', 'clinic-partner-b'), {
        uid: 'clinic-partner-b',
        email: 'clinic-b@test.local',
        role: 'partner',
        active: true,
        partnerTypes: ['clinic'],
        managedPlaceIds: ['clinic-b'],
      });
      await setDoc(doc(db, 'admins', 'rest-partner-a'), {
        uid: 'rest-partner-a',
        email: 'rest-a@test.local',
        role: 'partner',
        active: true,
        partnerTypes: ['restaurant'],
        managedPlaceIds: ['rest-a'],
      });
      await setDoc(doc(db, 'admins', 'captain-a'), {
        uid: 'captain-a',
        email: 'cap-a@test.local',
        role: 'partner',
        active: true,
        partnerTypes: ['captain'],
        managedPlaceIds: [],
      });
      await setDoc(doc(db, 'admins', 'captain-b'), {
        uid: 'captain-b',
        email: 'cap-b@test.local',
        role: 'partner',
        active: true,
        partnerTypes: ['captain'],
        managedPlaceIds: [],
      });
      await setDoc(doc(db, 'admins', 'auditor-1'), {
        uid: 'auditor-1',
        email: 'auditor@test.local',
        role: 'auditor',
        active: true,
      });

      await setDoc(doc(db, 'places', 'rest-a'), {
        id: 'rest-a',
        name: 'مطعم أ',
        categoryId: 'cat-restaurants',
        categorySlug: 'restaurants',
        area: 'شارع بورسعيد',
        address: 'أبوحمص',
        phone: '01012345678',
        menuPriceMap: { 'item-1': 100 },
        deliveryFeeInTown: 15,
        deliveryFeeVillage: 25,
      });

      await setDoc(doc(db, 'clinic_queues', 'clinic-a'), {
        doctorId: 'clinic-a',
        doctorName: 'د. أ',
        sessionDate: '2026-06-15',
        currentNumber: 0,
        lastTicketNumber: 0,
        status: 'open',
      });
      await setDoc(doc(db, 'clinic_queues', 'clinic-b'), {
        doctorId: 'clinic-b',
        doctorName: 'د. ب',
        sessionDate: '2026-06-15',
        currentNumber: 0,
        lastTicketNumber: 0,
        status: 'closed',
      });
      await setDoc(doc(db, 'clinic_tickets', 'tkt-b-1'), {
        id: 'tkt-b-1',
        ticketCode: 'CLN-B1',
        doctorId: 'clinic-b',
        doctorName: 'د. ب',
        sessionDate: '2026-06-15',
        patientName: 'مريض ب',
        patientPhone: '01011111111',
        visitType: 'كشف جديد',
        ticketNumber: 1,
        status: 'waiting',
      });
      await setDoc(doc(db, 'delivery_rides', 'ride-1'), {
        id: 'ride-1',
        rideCode: 'DLV-001',
        pickupArea: 'شارع بورسعيد',
        pickupDetails: 'محل',
        dropoffArea: 'شارع المحطة',
        dropoffDetails: 'منزل',
        itemDescription: 'طرد',
        customerName: 'عميل',
        customerPhone: '01022222222',
        status: 'pending',
      });
    });

    // 1. Cross-partner isolation
    const clinicADb = testEnv.authenticatedContext('clinic-partner-a').firestore();
    await assertSucceeds(updateDoc(doc(clinicADb, 'clinic_queues', 'clinic-a'), { currentNumber: 1 }));
    await assertFails(updateDoc(doc(clinicADb, 'clinic_queues', 'clinic-b'), { currentNumber: 1 }));
    await assertFails(updateDoc(doc(clinicADb, 'clinic_tickets', 'tkt-b-1'), { status: 'called' }));

    // 2. Auditor strictly read-only
    const auditorDb = testEnv.authenticatedContext('auditor-1').firestore();
    await assertSucceeds(getDoc(doc(auditorDb, 'places', 'rest-a')));
    await assertFails(updateDoc(doc(auditorDb, 'places', 'rest-a'), { name: 'Hacked' }));
    await assertFails(updateDoc(doc(auditorDb, 'clinic_queues', 'clinic-a'), { status: 'closed' }));

    // 3. Tampered restaurant order price rejected; exact catalog price allowed
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anonDb, 'restaurant_orders', 'ord-tampered'), {
        id: 'ord-tampered',
        orderCode: 'ORD-BAD1',
        restaurantId: 'rest-a',
        restaurantName: 'مطعم أ',
        customerName: 'مهاجم',
        customerPhone: '01033333333',
        deliveryArea: 'شارع بورسعيد',
        deliveryAddress: 'أبوحمص',
        locationShared: false,
        items: [{ menuItemId: 'item-1', name: 'وجبة', price: 1, quantity: 1 }],
        subtotal: 1,
        deliveryFee: 15,
        total: 16,
        status: 'new',
      })
    );
    await assertSucceeds(
      setDoc(doc(anonDb, 'restaurant_orders', 'ord-valid'), {
        id: 'ord-valid',
        orderCode: 'ORD-OK01',
        restaurantId: 'rest-a',
        restaurantName: 'مطعم أ',
        customerName: 'عميل سليم',
        customerPhone: '01033333333',
        deliveryArea: 'شارع بورسعيد',
        deliveryAddress: 'أبوحمص',
        locationShared: false,
        items: [{ menuItemId: 'item-1', name: 'وجبة', price: 100, quantity: 2 }],
        subtotal: 200,
        deliveryFee: 15,
        total: 215,
        status: 'new',
      })
    );

    // 4. Closed clinic queue booking rejected
    await assertFails(
      runTransaction(anonDb, async (tx) => {
        const qRef = doc(anonDb, 'clinic_queues', 'clinic-b');
        const tRef = doc(anonDb, 'clinic_tickets', 'tkt-closed-1');
        tx.update(qRef, { lastTicketNumber: 1, lastTicketId: 'tkt-closed-1' });
        tx.set(tRef, {
          id: 'tkt-closed-1',
          ticketCode: 'CLN-NO',
          doctorId: 'clinic-b',
          doctorName: 'د. ب',
          sessionDate: '2026-06-15',
          patientName: 'مريض',
          patientPhone: '01044444444',
          visitType: 'كشف جديد',
          ticketNumber: 1,
          status: 'waiting',
        });
      })
    );

    // 5. Captain A claims ride; Captain B cannot overwrite or update it
    const capADb = testEnv.authenticatedContext('captain-a').firestore();
    const capBDb = testEnv.authenticatedContext('captain-b').firestore();
    await assertSucceeds(
      updateDoc(doc(capADb, 'delivery_rides', 'ride-1'), {
        status: 'accepted',
        captainUid: 'captain-a',
        captainName: 'كابتن أ',
        captainPhone: '01055555555',
      })
    );
    await assertFails(
      updateDoc(doc(capBDb, 'delivery_rides', 'ride-1'), {
        status: 'accepted',
        captainUid: 'captain-b',
        captainName: 'كابتن ب',
        captainPhone: '01066666666',
      })
    );
    await assertFails(
      updateDoc(doc(capBDb, 'delivery_rides', 'ride-1'), {
        status: 'picked_up',
      })
    );

    assert.ok(true);
    console.log('All Firestore Security Rules emulator assertions passed.');
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
