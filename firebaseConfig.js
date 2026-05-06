import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTVPPYIih_v9L4kWPe5HMrSfBXZfS2SAE",
  authDomain: "fiestasasturias-bb640.firebaseapp.com",
  projectId: "fiestasasturias-bb640",
  storageBucket: "fiestasasturias-bb640.firebasestorage.app",
  messagingSenderId: "411132252758",
  appId: "1:411132252758:web:e019b3a9964f18e0d621f7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);