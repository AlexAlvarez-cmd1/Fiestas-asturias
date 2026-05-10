import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

export const fotosService = {
  async uploadFoto(fiestaId, uri, uid, username) {
    const response = await fetch(uri);
    const blob = await response.blob();

    const storagePath = `fotos/${fiestaId}/${uid}_${Date.now()}.jpg`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);

    const imageUrl = await getDownloadURL(storageRef);

    await addDoc(collection(db, 'fiestas', fiestaId, 'fotos'), {
      uid,
      username,
      imageUrl,
      storagePath,
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

  async deleteFoto(fiestaId, fotoId, storagePath) {
    await deleteDoc(doc(db, 'fiestas', fiestaId, 'fotos', fotoId));
    if (storagePath) {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch (e) {
        console.warn('No se pudo borrar el archivo de Storage:', e);
      }
    }
  },
};
