import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCBNVXxl_J0FOWvysZzJ2Lw9VnqQ9HgXFE",
  authDomain: "mesmerizing-victory-gcvp7.firebaseapp.com",
  projectId: "mesmerizing-victory-gcvp7",
  storageBucket: "mesmerizing-victory-gcvp7.firebasestorage.app",
  messagingSenderId: "369881860445",
  appId: "1:369881860445:web:efeaff7f1f1b8955b1c0b4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Standard initialization of Firestore with custom databaseId from config
export const db = getFirestore(app, "ai-studio-ea94f593-fa4c-4189-a3dd-e25ef02aa830");
