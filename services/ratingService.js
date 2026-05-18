import { doc, getDoc, increment, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const ratingService = {
  async getUserRating(fiestaId, userId) {
    try {
      const snap = await getDoc(doc(db, 'fiestas', fiestaId, 'valoraciones', userId));
      return snap.exists() ? snap.data().valor : null;
    } catch {
      return null;
    }
  },

  async setRating(fiestaId, userId, valor, prevValor) {
    await setDoc(doc(db, 'fiestas', fiestaId, 'valoraciones', userId), {
      valor,
      timestamp: Date.now(),
    });

    const fiestaRef = doc(db, 'fiestas', fiestaId);
    if (prevValor === null) {
      await updateDoc(fiestaRef, {
        valoracionTotal: increment(valor),
        numValoraciones: increment(1),
      });
    } else {
      await updateDoc(fiestaRef, {
        valoracionTotal: increment(valor - prevValor),
      });
    }
  },
};
