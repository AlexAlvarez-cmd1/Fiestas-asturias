import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const log = async (event, params = {}) => {
  try {
    await addDoc(collection(db, 'analytics'), {
      event,
      ...params,
      ts: serverTimestamp(),
    });
  } catch {
    // Analytics never breaks the app
  }
};

export const analyticsService = {
  fiestaView:    (fiestaId, nombre) => log('fiesta_view',    { fiestaId, nombre }),
  fiestaShare:   (fiestaId)         => log('fiesta_share',   { fiestaId }),
  fiestaAttend:  (fiestaId)         => log('fiesta_attend',  { fiestaId }),
  fiestaRate:    (fiestaId, valor)  => log('fiesta_rate',    { fiestaId, valor }),
  fiestaPhoto:   (fiestaId)         => log('fiesta_photo',   { fiestaId }),
};
