// Firebase setup (Google sign-in + Firestore). Everything here is optional: if the
// VITE_FIREBASE_* values are missing, `firebase.ready` is false and the app falls back to
// "guest mode" (data stays in this browser only).
//
// The Firebase web config values are public identifiers, not secrets. Your data is protected by
// the Firestore security rules in firestore.rules (each user can only read their own document).
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

function init() {
  if (!(config.apiKey && config.authDomain && config.projectId && config.appId)) {
    return { ready: false, auth: null, db: null, provider: null };
  }
  try {
    const app = initializeApp(config);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return { ready: true, auth: getAuth(app), db: getFirestore(app), provider };
  } catch (err) {
    console.error('Firebase failed to initialise:', err);
    return { ready: false, auth: null, db: null, provider: null };
  }
}

export const firebase = init();
