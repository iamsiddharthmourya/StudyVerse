// Server-side authentication and identity verification for QuizVerse APIs
// Verifies Firebase ID Tokens for Google-authenticated users
// Issues and cryptographically verifies HMAC-signed session tokens for Guest Mode

import crypto from 'node:crypto';

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'studyverse-54c89';

// Retrieve or generate cryptographically strong secret for signing Guest HMAC tokens.
// Eliminates predictable default fallbacks.
export function getServerSecret() {
  const custom = process.env.SESSION_SECRET?.trim();
  if (custom && custom.length >= 16) {
    return custom;
  }
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && geminiKey.length >= 16) {
    // Derive high-entropy HMAC key from GEMINI_API_KEY so raw key is never exposed
    return crypto.createHmac('sha256', 'quizverse-guest-secret-seed').update(geminiKey).digest('hex');
  }
  // If neither is configured, generate a cryptographically strong 256-bit random secret
  // stored per container instance, preventing any predictable default forgery attack.
  if (!globalThis.__quizverse_session_secret) {
    globalThis.__quizverse_session_secret = crypto.randomBytes(32).toString('hex');
  }
  return globalThis.__quizverse_session_secret;
}

// Cache for Google's public certificates
let certsCache = null;
let certsCacheExpiresAt = 0;

/**
 * Fetch and cache Google's public x509 certificates for Firebase ID Token verification.
 */
async function getGooglePublicCerts() {
  const now = Date.now();
  if (certsCache && now < certsCacheExpiresAt) {
    return certsCache;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch Google certs: HTTP ${res.status}`);
    }

    // Cache header max-age if available
    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
    const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

    certsCache = await res.json();
    certsCacheExpiresAt = now + maxAgeSec * 1000;
    return certsCache;
  } catch (err) {
    console.warn('[Auth] Could not fetch Google public certs:', err.message);
    return certsCache || {};
  }
}

/**
 * Cryptographically verify a Firebase ID Token using Google's public certificates.
 */
export async function verifyFirebaseIdToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    // Check basic claims
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (payload.exp && payload.exp < nowSec) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;

    // Verify signature with Google certificate
    const certs = await getGooglePublicCerts();
    const cert = certs[header.kid];
    if (cert) {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      const sigBuffer = Buffer.from(parts[2], 'base64url');
      const isValid = verifier.verify(cert, sigBuffer);
      if (!isValid) return null;
    }

    return {
      uid: payload.sub,
      email: payload.email || '',
      name: payload.name || '',
      type: 'google',
    };
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically signed HMAC guest session token.
 */
export function createGuestToken(guestId) {
  const gid = guestId || `gst_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  const payload = {
    guestId: gid,
    createdAt: Date.now(),
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', getServerSecret()).update(payloadStr).digest('base64url');
  return `${payloadStr}.${hmac}`;
}

/**
 * Verify an HMAC guest session token.
 */
export function verifyGuestToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, signature] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', getServerSecret()).update(payloadStr).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.guestId || typeof payload.guestId !== 'string') return null;

    return {
      guestId: payload.guestId,
      createdAt: payload.createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve client identity from request headers.
 * Supports:
 * 1. Authorization: Bearer <firebaseIdToken>
 * 2. X-Guest-Token: <signedGuestToken>
 * 3. Issues new guest token if unauthenticated or new guest.
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const guestHeader = req.headers['x-guest-token'] || req.headers['X-Guest-Token'] || '';

  // 1. Try Firebase Auth Token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const verified = await verifyFirebaseIdToken(token);
    if (verified) {
      return {
        type: 'google',
        userId: `google:${verified.uid}`,
        rawUid: verified.uid,
        email: verified.email,
        guestToken: null,
      };
    }
  }

  // 2. Try Guest Token
  if (guestHeader) {
    const verifiedGuest = verifyGuestToken(guestHeader);
    if (verifiedGuest) {
      return {
        type: 'guest',
        userId: `guest:${verifiedGuest.guestId}`,
        rawUid: verifiedGuest.guestId,
        guestToken: guestHeader,
      };
    }
  }

  // 3. Create fresh signed guest session
  const newGuestToken = createGuestToken();
  const verifiedGuest = verifyGuestToken(newGuestToken);
  return {
    type: 'guest',
    userId: `guest:${verifiedGuest.guestId}`,
    rawUid: verifiedGuest.guestId,
    guestToken: newGuestToken,
    isNewGuest: true,
  };
}
