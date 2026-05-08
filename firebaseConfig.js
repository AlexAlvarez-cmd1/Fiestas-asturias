import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDTVPPYIih_v9L4kWPe5HMrSfBXZfS2SAE",
  authDomain: "fiestasasturias-bb640.firebaseapp.com",
  projectId: "fiestasasturias-bb640",
  storageBucket: "fiestasasturias-bb640.firebasestorage.app",
  messagingSenderId: "411132252758",
  appId: "1:411132252758:web:e019b3a9964f18e0d621f7"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
