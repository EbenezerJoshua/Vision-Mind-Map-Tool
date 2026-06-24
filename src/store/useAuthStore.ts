import { create } from "zustand";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<User | null>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen to Auth State changes reactively
  onAuthStateChanged(auth, (user) => {
    set({ user, loading: false });
  });

  return {
    user: null,
    loading: true,

    signIn: async () => {
      try {
        set({ loading: true });
        const result = await signInWithPopup(auth, googleProvider);
        set({ user: result.user, loading: false });
        return result.user;
      } catch (error) {
        console.error("Sign-in with Google failed:", error);
        set({ loading: false });
        return null;
      }
    },

    logout: async () => {
      try {
        set({ loading: true });
        await signOut(auth);
        set({ user: null, loading: false });
      } catch (error) {
        console.error("Sign-out failed:", error);
        set({ loading: false });
      }
    },

    setUser: (user) => set({ user, loading: false }),
  };
});
