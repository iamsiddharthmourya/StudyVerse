import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from 'firebase/auth';
import { firebase } from './firebase.js';

const AuthContext = createContext(null);
const GUEST_KEY = 'ssp:guest';
const GUEST = { uid: 'guest', name: 'Guest', email: '', photo: '', mode: 'guest' };

function readGuest() {
  try {
    return localStorage.getItem(GUEST_KEY) === '1' ? GUEST : null;
  } catch {
    return null;
  }
}

function clearGuestFlag() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

const fromFirebase = (u) => ({
  uid: u.uid,
  name: u.displayName || (u.email ? u.email.split('@')[0] : 'Student'),
  email: u.email || '',
  photo: u.photoURL || '',
  mode: 'google',
});

function friendlyError(err) {
  switch (err?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    case 'auth/unauthorized-domain':
      return 'This website address is not authorised for sign-in yet. In the Firebase console, add it under Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not switched on. In the Firebase console go to Authentication → Sign-in method and enable Google.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your internet connection and try again.';
    case 'auth/popup-blocked':
      return 'Sign-in pop-up was blocked by your browser. Attempting redirect sign-in...';
    default:
      return err?.message || 'Sign-in failed. Please try again.';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebase.ready) {
      setUser(readGuest());
      setLoading(false);
      return undefined;
    }

    let unsub = () => { };
    let isCancelled = false;

    // Check for redirect result first
    getRedirectResult(firebase.auth)
      .then((res) => {
        if (isCancelled) return;
        if (res?.user) {
          clearGuestFlag();
          setUser(fromFirebase(res.user));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Redirect sign-in error:', err);
        setError(friendlyError(err));
      });

    unsub = onAuthStateChanged(
      firebase.auth,
      (u) => {
        if (isCancelled) return;
        if (u) {
          clearGuestFlag();
          setUser(fromFirebase(u));
        } else {
          setUser(readGuest());
        }
        setLoading(false);
      },
      (err) => {
        if (isCancelled) return;
        console.error('Auth state error:', err);
        setUser(readGuest());
        setLoading(false);
      },
    );

    return () => {
      isCancelled = true;
      unsub();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError('');
    if (!firebase.ready) {
      setError('Google sign-in is not configured yet. Add your Firebase keys to the .env file (see README), or continue as a guest.');
      return;
    }
    setBusy(true);
    try {
      const res = await signInWithPopup(firebase.auth, firebase.provider);
      if (res?.user) {
        clearGuestFlag();
      }
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(firebase.auth, firebase.provider);
          return;
        } catch (err2) {
          setError(friendlyError(err2));
        }
      } else {
        setError(friendlyError(err));
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    try {
      localStorage.setItem(GUEST_KEY, '1');
    } catch {
      /* ignore */
    }
    setUser(GUEST);
  }, []);

  const signOut = useCallback(async () => {
    clearGuestFlag();
    try {
      if (firebase.ready) await fbSignOut(firebase.auth);
    } catch (err) {
      console.error(err);
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, busy, error, setError, signInWithGoogle, continueAsGuest, signOut, googleConfigured: firebase.ready }),
    [user, loading, busy, error, signInWithGoogle, continueAsGuest, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
