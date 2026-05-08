import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const createUserProfile = async (user, username) => {
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    username: username || user.displayName || user.email.split('@')[0],
    displayName: username || user.displayName || user.email.split('@')[0],
    email: user.email,
    photoURL: user.photoURL || null,
    bio: '',
    createdAt: serverTimestamp(),
  });
};

export const authService = {
  async registerWithEmail(email, password, username) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: username });
    await createUserProfile(user, username);
    return user;
  },

  async loginWithEmail(email, password) {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user;
  },

  async loginWithGoogleCredential(idToken) {
    const credential = GoogleAuthProvider.credential(idToken);
    const { user } = await signInWithCredential(auth, credential);

    // Crear perfil si es nuevo usuario
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      await createUserProfile(user, user.displayName);
    }
    return user;
  },

  async logout() {
    await signOut(auth);
  },

  getCurrentUser() {
    return auth.currentUser;
  },
};
