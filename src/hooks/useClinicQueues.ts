import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db, logFirestoreListenerError, OperationType } from '../firebase';
import { readOfflineCatalog, writeOfflineCatalog } from '../lib/offlineCache';
import { getCairoDateString } from '../lib/workingHours';
import { SEED_CLINIC_QUEUES } from '../data/seedData';
import type { ClinicQueue } from '../types';

/**
 * Real-time `clinic_queues` subscription, scoped to the pages that actually need it
 * (public medical/clinic screens and the clinic partner console). Keeping this out of
 * the global AppContext catalog means visitors browsing Home, Search, Restaurants, or
 * Real Estate never open a live queue listener — a major Firestore read-cost saving.
 *
 * The initial state hydrates from the offline catalog cache (if present) so the queue
 * board renders instantly; the live listener then keeps it up to date.
 */
const CLINIC_QUEUE_LIMIT = 100;

export function useClinicQueues(): ClinicQueue[] {
  const [queues, setQueues] = useState<ClinicQueue[]>(
    () => readOfflineCatalog()?.clinicQueues ?? SEED_CLINIC_QUEUES
  );

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'clinic_queues'), orderBy('sessionDate', 'desc'), limit(CLINIC_QUEUE_LIMIT)),
      (snap) => {
        const list: ClinicQueue[] = snap.docs.map((d) => ({
          ...(d.data() as ClinicQueue),
          doctorId: d.id,
          sessionDate: (d.data() as Partial<ClinicQueue>).sessionDate || getCairoDateString(),
        }));
        setQueues(list);
        writeOfflineCatalog({ clinicQueues: list });
      },
      (error) => logFirestoreListenerError(error, OperationType.LIST, 'clinic_queues')
    );
    return () => unsub();
  }, []);

  return useMemo(() => queues, [queues]);
}
