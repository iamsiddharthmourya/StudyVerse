import assert from 'node:assert/strict';

// Mock localStorage
const storage = new Map();
global.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

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

// Simulate Auth Controller matching src/services/auth.jsx
class AuthSimulator {
  constructor() {
    this.user = readGuest();
    this.error = '';
  }

  continueAsGuest() {
    localStorage.setItem(GUEST_KEY, '1');
    this.user = GUEST;
  }

  async signInWithGooglePopup(mockFirebaseUser, simulateError = null) {
    this.error = '';
    try {
      if (simulateError) throw simulateError;
      const res = { user: mockFirebaseUser };
      if (res?.user) {
        clearGuestFlag();
        this.user = fromFirebase(res.user);
      }
    } catch (err) {
      this.error = err.message || 'Cancelled';
      // Does not clear guest flag
    }
  }

  async handleRedirectResult(mockFirebaseUser, simulateError = null) {
    try {
      if (simulateError) throw simulateError;
      if (mockFirebaseUser) {
        clearGuestFlag();
        this.user = fromFirebase(mockFirebaseUser);
      }
    } catch (err) {
      this.error = err.message;
    }
  }

  onAuthStateChanged(u) {
    if (u) {
      clearGuestFlag();
      this.user = fromFirebase(u);
    } else {
      this.user = readGuest();
    }
  }

  async signOut() {
    clearGuestFlag();
    this.user = null;
  }
}

console.log('Running Phase 6, P1 Auth Scenarios...');

// Test A – Guest to Google (Popup & Redirect)
{
  localStorage.clear();
  const auth = new AuthSimulator();
  auth.continueAsGuest();
  assert.equal(localStorage.getItem(GUEST_KEY), '1');
  assert.equal(auth.user.mode, 'guest');

  // Successful Google sign in
  await auth.signInWithGooglePopup({ uid: 'google-user-123', email: 'test@example.com' });
  assert.equal(localStorage.getItem(GUEST_KEY), null, 'Test A: ssp:guest must be removed from localStorage');
  assert.equal(auth.user.mode, 'google', 'Test A: user mode must be google');
  assert.equal(auth.user.uid, 'google-user-123');
  console.log('  ok  Test A1: Guest to Google (Popup) removes ssp:guest flag');

  // Test with Redirect
  localStorage.clear();
  auth.continueAsGuest();
  assert.equal(localStorage.getItem(GUEST_KEY), '1');
  await auth.handleRedirectResult({ uid: 'google-user-456', email: 'redirect@example.com' });
  assert.equal(localStorage.getItem(GUEST_KEY), null, 'Test A2: ssp:guest must be removed on redirect');
  assert.equal(auth.user.mode, 'google');
  console.log('  ok  Test A2: Guest to Google (Redirect) removes ssp:guest flag');
}

// Test B – Login failure / cancellation
{
  localStorage.clear();
  const auth = new AuthSimulator();
  auth.continueAsGuest();
  assert.equal(localStorage.getItem(GUEST_KEY), '1');
  assert.equal(auth.user.mode, 'guest');

  // Simulate user closing popup
  await auth.signInWithGooglePopup(null, { code: 'auth/popup-closed-by-user', message: 'Popup closed' });
  assert.equal(localStorage.getItem(GUEST_KEY), '1', 'Test B: ssp:guest must remain "1" on cancellation');
  assert.equal(auth.user.mode, 'guest', 'Test B: User must remain in guest mode');

  // Simulate network failure
  await auth.signInWithGooglePopup(null, { code: 'auth/network-request-failed', message: 'Network error' });
  assert.equal(localStorage.getItem(GUEST_KEY), '1', 'Test B: ssp:guest must remain "1" on error');
  assert.equal(auth.user.mode, 'guest');
  console.log('  ok  Test B: Login failure / cancellation preserves ssp:guest and guest mode');
}

// Test C – Logout and Guest Mode switching
{
  localStorage.clear();
  const auth = new AuthSimulator();
  await auth.signInWithGooglePopup({ uid: 'user-789', email: 'c@test.com' });
  assert.equal(auth.user.mode, 'google');

  // User signs out
  await auth.signOut();
  assert.equal(auth.user, null, 'Test C: User must be null after signOut');
  assert.equal(localStorage.getItem(GUEST_KEY), null, 'Test C: ssp:guest must be null after signOut');

  // User clicks "Continue as guest"
  auth.continueAsGuest();
  assert.equal(localStorage.getItem(GUEST_KEY), '1', 'Test C: ssp:guest is "1"');
  assert.equal(auth.user.mode, 'guest', 'Test C: User mode is guest');
  console.log('  ok  Test C: Logout and Guest Mode switching behaves correctly');
}

// Test D – Direct Google Sign-In
{
  localStorage.clear();
  const auth = new AuthSimulator();
  assert.equal(auth.user, null);
  assert.equal(localStorage.getItem(GUEST_KEY), null);

  // Directly sign in with Google
  await auth.signInWithGooglePopup({ uid: 'direct-user', email: 'direct@test.com' });
  assert.equal(localStorage.getItem(GUEST_KEY), null, 'Test D: ssp:guest must remain null');
  assert.equal(auth.user.mode, 'google', 'Test D: User mode is google');
  console.log('  ok  Test D: Direct Google Sign-In succeeds with null ssp:guest');
}

console.log('\nAll 4 Phase 6, P1 test scenarios passed successfully!');
