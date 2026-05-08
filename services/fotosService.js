import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

export const fotosService = {
  async uploadFoto(fiestaId, uri, uid, username) {
    const response = await fetch(uri);
    const blob = await response.blob();

    const fileName = `fotos/${fiestaId}/${uid}_${Date.now()}.jpg`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, blob);

    const imageUrl = await getDownloadURL(storageRef);

    await addDoc(collection(db, 'fiestas', fiestaId, 'fotos'), {
      uid,
      username,
      imageUrl,
      createdAt: serverTimestamp(),
    });

    return imageUrl;
  },

  async getFotos(fiestaId) {
    const q = query(
      collection(db, 'fiestas', fiestaId, 'fotos'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
};
