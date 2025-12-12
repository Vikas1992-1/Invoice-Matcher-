import { initializeApp, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  Auth,
  UserCredential
} from "firebase/auth";

// Helper to safely access environment variables in Vite
const getEnvVar = (key: string) => {
  const tryGet = (k: string) => {
    // Check import.meta.env (Vite standard)
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[k]) {
      return import.meta.env[k];
    }
    // Check process.env (Polyfill/Node)
    if (typeof process !== 'undefined' && process.env && process.env[k]) {
      return process.env[k];
    }
    return "";
  };

  // 1. Try exact match (e.g. VITE_FIREBASE_API_KEY)
  const exact = tryGet(key);
  if (exact) return exact;

  // 2. Try without VITE_ prefix (e.g. FIREBASE_API_KEY) - helpful fallback
  const rawKey = key.replace(/^VITE_/, '');
  const raw = tryGet(rawKey);
  if (raw) return raw;

  return "";
};

const firebaseConfig = {
  apiKey: getEnvVar("VITE_FIREBASE_API_KEY"),
  authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnvVar("VITE_FIREBASE_APP_ID")
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

// Initialize only if config is present
if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("Firebase configuration missing. Keys not found in environment.");
}

export { auth };

export const loginUser = async (email: string, password: string): Promise<UserCredential> => {
  if (!auth) {
    throw new Error("Authentication is not configured. Check your .env file.");
  }
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerUser = async (email: string, password: string): Promise<UserCredential> => {
  if (!auth) {
    throw new Error("Authentication is not configured. Check your .env file.");
  }
  return createUserWithEmailAndPassword(auth, email, password);
};

export const logout = async () => {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};