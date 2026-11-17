// Daily Quota Manager for QuizVerse AI Generations
// Enforces a limit of 5 successful generations per user per day.
// Resets automatically at Midnight IST (UTC+05:30).
//
// Dual Engine Architecture:
// 1. Distributed Atomic Store (Upstash Redis / Vercel KV REST API):
//    Uses atomic Lua scripts to guarantee production-safe concurrency across separate Vercel serverless instances.
// 2. Container-Local Memory/File Fallback:
//    Used for local development and single-container automated test runners.
//    IMPORTANT: Without Upstash Redis / Vercel KV credentials configured, distributed atomic quota
//    enforcement across multiple concurrent Vercel serverless instances is NOT active. Do not claim
//    multi-instance concurrency protection without Redis.

import fs from 'node:fs';
import path from 'node:path';

export const DAILY_LIMIT = 5;
const RESERVATION_TTL_MS = 60 * 1000; // 60 seconds

// In-memory state store (container-local mode)
// key: `${dateKey}:${userId}` -> { used: number, reservations: Map<id, expiry> }
const memoryStore = new Map();
let warnedAboutUnconfiguredRedis = false;

// Helper to check if shared Redis / Vercel KV is configured
export function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/$/, ''), token };
  }
  if (!warnedAboutUnconfiguredRedis && process.env.VERCEL) {
    console.warn(
      '[Quota Warning] KV_REST_API_URL / KV_REST_API_TOKEN not configured. Distributed multi-instance quota enforcement is NOT active. Falling back to container-local store.'
    );
    warnedAboutUnconfiguredRedis = true;
  }
  return null;
}

/**
 * Execute an atomic command on Vercel KV / Upstash Redis via REST.
 */
async function callKvRest(endpoint, body) {
  const kv = getKvConfig();
  if (!kv) return null;

  try {
    const res = await fetch(`${kv.url}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000), // 4s timeout
    });

    if (!res.ok) {
      console.warn(`[Quota KV] HTTP ${res.status} from ${endpoint}`);
      return null;
    }
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.warn(`[Quota KV] Request failed to ${endpoint}:`, err.message);
    return null;
  }
}

// Helper to determine persistent storage file path (for local container mode)
function getStorageFilePath() {
  const dir = process.env.VERCEL
    ? '/tmp'
    : path.resolve(process.cwd(), '.cache');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
  return path.join(dir, 'quizverse-quota.json');
}

function readPersisted() {
  try {
    const file = getStorageFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Quota] Could not read quota file:', err.message);
  }
  return {};
}

function writePersisted(data) {
  try {
    const file = getStorageFilePath();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Quota] Could not write quota file:', err.message);
  }
}

/**
 * Get current date key in Indian Standard Time (YYYY-MM-DD).
 */
export function getIstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/**
 * Calculate the next Midnight IST timestamp (ISO string) and seconds remaining.
 */
export function getNextMidnightIst(now = new Date()) {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const istNowTime = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istNowTime);

  const nextIstMidnight = new Date(Date.UTC(
    istDate.getUTCFullYear(),
    istDate.getUTCMonth(),
    istDate.getUTCDate() + 1,
    0, 0, 0, 0
  ));

  const nextMidnightUtcMs = nextIstMidnight.getTime() - IST_OFFSET_MS;
  const remainingSeconds = Math.max(0, Math.floor((nextMidnightUtcMs - now.getTime()) / 1000));

  return {
    iso: new Date(nextMidnightUtcMs).toISOString(),
    remainingSeconds,
    formattedIst: 'Midnight IST (00:00 IST)',
  };
}

// Local container store helper
function getLocalEntry(userId, dateKey = getIstDateKey()) {
  const key = `${dateKey}:${userId}`;
  if (!memoryStore.has(key)) {
    const persisted = readPersisted();
    const existing = persisted[key] || { used: 0 };
    memoryStore.set(key, {
      used: Number(existing.used) || 0,
      reservations: new Map(),
    });
  }

  const entry = memoryStore.get(key);
  const now = Date.now();
  for (const [resId, expiry] of entry.reservations.entries()) {
    if (expiry <= now) {
      entry.reservations.delete(resId);
    }
  }

  return entry;
}

/**
 * Check a user's current quota without reserving.
 */
export async function checkQuotaAsync(userId, dateKey = getIstDateKey()) {
  if (!userId) {
    return {
      allowed: false,
      limit: DAILY_LIMIT,
      used: 0,
      remaining: 0,
      resetsAt: getNextMidnightIst().iso,
    };
  }

  const nextMidnight = getNextMidnightIst();
  const kvKey = `qv:quota:${dateKey}:${userId}`;

  // 1. Try Shared Vercel KV / Redis if configured
  if (getKvConfig()) {
    try {
      const val = await callKvRest(`get/${encodeURIComponent(kvKey)}`, []);
      const used = Number(val) || 0;
      const remaining = Math.max(0, DAILY_LIMIT - used);
      return {
        allowed: used < DAILY_LIMIT,
        limit: DAILY_LIMIT,
        used,
        remaining,
        resetsAt: nextMidnight.iso,
        resetsInSeconds: nextMidnight.remainingSeconds,
        sharedStore: true,
      };
    } catch {
      // Fallback to local
    }
  }

  // 2. Container-local fallback
  const entry = getLocalEntry(userId, dateKey);
  const totalOccupied = entry.used + entry.reservations.size;
  const remaining = Math.max(0, DAILY_LIMIT - totalOccupied);

  return {
    allowed: totalOccupied < DAILY_LIMIT,
    limit: DAILY_LIMIT,
    used: entry.used,
    activeReservations: entry.reservations.size,
    remaining,
    resetsAt: nextMidnight.iso,
    resetsInSeconds: nextMidnight.remainingSeconds,
    sharedStore: false,
  };
}

// Synchronous wrapper for existing tests and synchronous callers
export function checkQuota(userId, dateKey = getIstDateKey()) {
  if (!userId) {
    return {
      allowed: false,
      limit: DAILY_LIMIT,
      used: 0,
      remaining: 0,
      resetsAt: getNextMidnightIst().iso,
    };
  }

  const entry = getLocalEntry(userId, dateKey);
  const totalOccupied = entry.used + entry.reservations.size;
  const remaining = Math.max(0, DAILY_LIMIT - totalOccupied);
  const nextMidnight = getNextMidnightIst();

  return {
    allowed: totalOccupied < DAILY_LIMIT,
    limit: DAILY_LIMIT,
    used: entry.used,
    activeReservations: entry.reservations.size,
    remaining,
    resetsAt: nextMidnight.iso,
    resetsInSeconds: nextMidnight.remainingSeconds,
    sharedStore: false,
  };
}

/**
 * Atomically reserve a generation slot before calling Gemini.
 * Uses atomic Lua script on Vercel KV / Redis if configured; container mutex otherwise.
 */
export async function reserveQuotaAsync(userId, dateKey = getIstDateKey()) {
  if (!userId) {
    throw new Error('UserId is required to reserve quota');
  }

  const nextMidnight = getNextMidnightIst();
  const kvKey = `qv:quota:${dateKey}:${userId}`;

  // 1. Shared Vercel KV / Redis with atomic Lua script
  if (getKvConfig()) {
    try {
      // Atomic Lua script: Checks if current < limit, increments, and sets expiry until midnight IST + 1 hour grace
      const ttlSeconds = Math.max(3600, nextMidnight.remainingSeconds + 3600);
      const luaScript = `
        local current = redis.call('GET', KEYS[1])
        if current and tonumber(current) >= tonumber(ARGV[1]) then
          return -1
        end
        local new_val = redis.call('INCR', KEYS[1])
        if new_val == 1 then
          redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
        end
        return new_val
      `;

      const result = await callKvRest('eval', {
        script: luaScript,
        keys: [kvKey],
        args: [DAILY_LIMIT, ttlSeconds],
      });

      if (result === -1) {
        return {
          allowed: false,
          error: 'DAILY_QUOTA_EXCEEDED',
          message: `You have reached your daily limit of ${DAILY_LIMIT} AI quizzes. Quota resets at midnight IST.`,
          limit: DAILY_LIMIT,
          used: DAILY_LIMIT,
          remaining: 0,
          resetsAt: nextMidnight.iso,
          resetsInSeconds: nextMidnight.remainingSeconds,
          sharedStore: true,
        };
      }

      if (Number.isInteger(result) && result > 0) {
        const used = Number(result);
        const reservationId = `kv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        return {
          allowed: true,
          reservationId,
          limit: DAILY_LIMIT,
          used,
          remaining: Math.max(0, DAILY_LIMIT - used),
          resetsAt: nextMidnight.iso,
          sharedStore: true,
        };
      }
    } catch (err) {
      console.warn('[Quota] Vercel KV atomic reservation failed, falling back to local store:', err.message);
    }
  }

  // 2. Container-Local Memory / File Store
  return reserveQuota(userId, dateKey);
}

// Synchronous reserveQuota for tests and container-local fallback
export function reserveQuota(userId, dateKey = getIstDateKey()) {
  if (!userId) {
    throw new Error('UserId is required to reserve quota');
  }

  const entry = getLocalEntry(userId, dateKey);
  const activeReservations = entry.reservations.size;

  if (entry.used + activeReservations >= DAILY_LIMIT) {
    const nextMidnight = getNextMidnightIst();
    return {
      allowed: false,
      error: 'DAILY_QUOTA_EXCEEDED',
      message: `You have reached your daily limit of ${DAILY_LIMIT} AI quizzes. Quota resets at midnight IST.`,
      limit: DAILY_LIMIT,
      used: entry.used,
      remaining: 0,
      resetsAt: nextMidnight.iso,
      resetsInSeconds: nextMidnight.remainingSeconds,
      sharedStore: false,
    };
  }

  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  entry.reservations.set(reservationId, Date.now() + RESERVATION_TTL_MS);

  const nextMidnight = getNextMidnightIst();
  return {
    allowed: true,
    reservationId,
    limit: DAILY_LIMIT,
    used: entry.used,
    remaining: Math.max(0, DAILY_LIMIT - (entry.used + entry.reservations.size)),
    resetsAt: nextMidnight.iso,
    sharedStore: false,
  };
}

/**
 * Commit a successful quiz generation.
 */
export async function commitQuotaAsync(userId, dateKey = getIstDateKey(), reservationId) {
  if (getKvConfig() && reservationId?.startsWith('kv_')) {
    // In KV, the slot was already atomically incremented during reservation
    const nextMidnight = getNextMidnightIst();
    const kvKey = `qv:quota:${dateKey}:${userId}`;
    const val = (await callKvRest(`get/${encodeURIComponent(kvKey)}`, [])) || DAILY_LIMIT;
    const used = Number(val) || DAILY_LIMIT;
    return {
      success: true,
      limit: DAILY_LIMIT,
      used,
      remaining: Math.max(0, DAILY_LIMIT - used),
      resetsAt: nextMidnight.iso,
      sharedStore: true,
    };
  }

  return commitQuota(userId, dateKey, reservationId);
}

export function commitQuota(userId, dateKey = getIstDateKey(), reservationId) {
  const key = `${dateKey}:${userId}`;
  const entry = getLocalEntry(userId, dateKey);

  if (reservationId) {
    entry.reservations.delete(reservationId);
  }

  entry.used += 1;

  const persisted = readPersisted();
  persisted[key] = { used: entry.used, updatedAt: new Date().toISOString() };
  writePersisted(persisted);

  const nextMidnight = getNextMidnightIst();
  return {
    success: true,
    limit: DAILY_LIMIT,
    used: entry.used,
    remaining: Math.max(0, DAILY_LIMIT - entry.used),
    resetsAt: nextMidnight.iso,
    sharedStore: false,
  };
}

/**
 * Rollback a failed generation (slot is released, usage is NOT permanently incremented).
 */
export async function rollbackQuotaAsync(userId, dateKey = getIstDateKey(), reservationId) {
  if (getKvConfig() && reservationId?.startsWith('kv_')) {
    const nextMidnight = getNextMidnightIst();
    const kvKey = `qv:quota:${dateKey}:${userId}`;
    try {
      // Atomically decrement slot in Redis
      const val = await callKvRest(`decr/${encodeURIComponent(kvKey)}`, []);
      const used = Math.max(0, Number(val) || 0);
      return {
        success: true,
        rolledBack: true,
        limit: DAILY_LIMIT,
        used,
        remaining: Math.max(0, DAILY_LIMIT - used),
        resetsAt: nextMidnight.iso,
        sharedStore: true,
      };
    } catch {
      /* ignore */
    }
  }

  return rollbackQuota(userId, dateKey, reservationId);
}

export function rollbackQuota(userId, dateKey = getIstDateKey(), reservationId) {
  const entry = getLocalEntry(userId, dateKey);

  if (reservationId) {
    entry.reservations.delete(reservationId);
  }

  const nextMidnight = getNextMidnightIst();
  return {
    success: true,
    rolledBack: true,
    limit: DAILY_LIMIT,
    used: entry.used,
    remaining: Math.max(0, DAILY_LIMIT - entry.used),
    resetsAt: nextMidnight.iso,
    sharedStore: false,
  };
}

/**
 * Reset all in-memory and persistent quota (used strictly for testing).
 */
export function _resetStoreForTesting() {
  memoryStore.clear();
  try {
    const file = getStorageFilePath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}
