import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyCBNVXxl_J0FOWvysZzJ2Lw9VnqQ9HgXFE",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "mesmerizing-victory-gcvp7.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "mesmerizing-victory-gcvp7",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "mesmerizing-victory-gcvp7.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "369881860445",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:369881860445:web:efeaff7f1f1b8955b1c0b4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Standard initialization of Firestore with custom databaseId from environment or config fallback
const databaseId = (import.meta as any).env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-ea94f593-fa4c-4189-a3dd-e25ef02aa830";
export const db = getFirestore(app, databaseId);
