// Client-side API service for calling QuizVerse backend endpoints
// Handles Firebase ID tokens for Google users and HMAC session tokens for Guest users

import { firebase } from '../../services/firebase.js';

const GUEST_TOKEN_KEY = 'qv:guest_token';

function getStoredGuestToken() {
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function storeGuestToken(token) {
  if (!token) return;
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

/**
 * Get authentication headers based on user mode.
 */
async function getAuthHeaders(user) {
  const headers = {};

  if (user?.mode === 'google') {
    try {
      const currentUser = firebase.auth?.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
          return headers;
        }
      }
    } catch (err) {
      console.warn('[QuizAPI] Failed to get Firebase ID token:', err);
    }
  }

  // Guest Mode
  const guestToken = getStoredGuestToken();
  if (guestToken) {
    headers['X-Guest-Token'] = guestToken;
  }

  return headers;
}

/**
 * Retrieve remaining daily generation quota for the current user.
 */
export async function fetchDailyQuota(user) {
  try {
    const authHeaders = await getAuthHeaders(user);
    const res = await fetch('/api/quota', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...authHeaders,
      },
    });

    // Save updated guest token if returned
    const newGuestToken = res.headers.get('x-guest-token');
    if (newGuestToken) storeGuestToken(newGuestToken);

    if (!res.ok) {
      return {
        limit: 5,
        remaining: 5,
        used: 0,
        resetsAt: new Date(Date.now() + 86400000).toISOString(),
      };
    }

    const data = await res.json();
    if (data.guestToken) storeGuestToken(data.guestToken);

    return data;
  } catch (err) {
    console.warn('[QuizAPI] Could not fetch quota status:', err);
    return {
      limit: 5,
      remaining: 5,
      used: 0,
      resetsAt: new Date(Date.now() + 86400000).toISOString(),
    };
  }
}

/**
 * Generate a quiz with Gemini via the serverless backend.
 */
export async function generateQuizWithBackend(user, params, file) {
  const authHeaders = await getAuthHeaders(user);

  let fetchOptions = {};

  if (params.sourceType === 'document' && file) {
    // Multipart / Form-Data upload
    const formData = new FormData();
    formData.append('sourceType', 'document');
    formData.append('file', file);
    formData.append('difficulty', params.difficulty || 'medium');
    formData.append('questionCount', String(params.questionCount || 10));
    if (params.subject) formData.append('subject', params.subject);
    if (params.instructions) formData.append('instructions', params.instructions);

    fetchOptions = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...authHeaders,
      },
      body: formData,
    };
  } else {
    // Topic-based JSON request
    fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        sourceType: 'topic',
        topic: params.topic,
        subject: params.subject || '',
        instructions: params.instructions || '',
        difficulty: params.difficulty || 'medium',
        questionCount: params.questionCount || 10,
      }),
    };
  }

  const res = await fetch('/api/generate-quiz', fetchOptions);

  const newGuestToken = res.headers.get('x-guest-token');
  if (newGuestToken) storeGuestToken(newGuestToken);

  let data = null;
  try {
    data = await res.json();
  } catch {
    const text = await res.text();
    throw new Error(`Server returned unexpected response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  if (data?.guestToken) storeGuestToken(data.guestToken);

  if (!res.ok) {
    const error = new Error(data?.message || `Quiz generation failed (HTTP ${res.status})`);
    error.status = res.status;
    error.code = data?.error || 'GENERATION_ERROR';
    error.quota = data?.quota || { remaining: data?.remaining };
    error.resetsAt = data?.resetsAt;
    throw error;
  }

  return data;
}
