// Per-user data storage.
//  - Google users: Firestore document  users/{uid}  (plus a local copy for offline use).
//  - Guests: localStorage only, under their own key.
// Data from different accounts never mixes because every key / document includes the user id.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebase } from './firebase.js';
import { DEFAULT_SETTINGS } from '../utils/sampleData.js';

const dataKey = (uid) => `ssp:data:${uid}`;

export function readLocal(uid) {
  try {
    const raw = localStorage.getItem(dataKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocal(uid, data) {
  try {
    localStorage.setItem(dataKey(uid), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(uid) {
  try {
    localStorage.removeItem(dataKey(uid));
  } catch {
    /* ignore */
  }
}

/** Make sure whatever came from storage has the expected shape. Returns null if unusable. */
export function normalize(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) return null;
  return {
    tasks: data.tasks.filter((t) => t && typeof t === 'object' && t.id && t.dueDate),
    goals: Array.isArray(data.goals) ? data.goals : [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    updatedAt: data.updatedAt || '',
  };
}

const clean = (obj) => JSON.parse(JSON.stringify(obj)); // Firestore rejects `undefined`

/**
 * Load a user's data. Returns { data, source, notice }.
 * source: 'cloud' | 'local' | 'new'.  The newer of the cloud and local copies wins.
 */
export async function loadData(user) {
  const local = normalize(readLocal(user.uid));
  if (user.mode !== 'google' || !firebase.ready) {
    return { data: local, source: local ? 'local' : 'new', notice: '' };
  }
  try {
    const snap = await getDoc(doc(firebase.db, 'users', user.uid));
    const cloud = snap.exists() ? normalize(snap.data()) : null;
    if (cloud && (!local || cloud.updatedAt >= local.updatedAt)) {
      writeLocal(user.uid, cloud);
      return { data: cloud, source: 'cloud', notice: '' };
    }
    if (local) {
      // Local copy is newer (for example edits made while offline): push it to the cloud.
      saveData(user, local).catch(() => {});
      return { data: local, source: 'local', notice: '' };
    }
    return { data: null, source: 'new', notice: '' };
  } catch (err) {
    console.error('Could not load cloud data:', err);
    return {
      data: local,
      source: local ? 'local' : 'new',
      notice: 'Could not reach the cloud right now. Showing the copy saved in this browser.',
    };
  }
}

/** Save to the browser immediately and, for Google users, to Firestore. */
export async function saveData(user, data) {
  const stamped = clean({ tasks: data.tasks, goals: data.goals, settings: data.settings, updatedAt: new Date().toISOString() });
  writeLocal(user.uid, stamped);
  if (user.mode === 'google' && firebase.ready) {
    await setDoc(doc(firebase.db, 'users', user.uid), stamped);
  }
  return stamped.updatedAt;
}
