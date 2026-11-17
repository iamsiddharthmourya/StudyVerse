// GET /api/quota
// Checks remaining daily AI quiz generation quota for the current user
// Does NOT consume or reserve quota

import { authenticateRequest } from './_lib/auth.js';
import { checkQuotaAsync } from './_lib/quota.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-Guest-Token, Content-Type, Accept');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: `HTTP ${req.method} is not supported. Use GET /api/quota.`,
    });
  }

  try {
    const auth = await authenticateRequest(req);

    if (auth.guestToken) {
      res.setHeader('X-Guest-Token', auth.guestToken);
    }

    const quotaInfo = await checkQuotaAsync(auth.userId);

    return res.status(200).json({
      limit: quotaInfo.limit,
      used: quotaInfo.used,
      remaining: quotaInfo.remaining,
      resetsAt: quotaInfo.resetsAt,
      resetsInSeconds: quotaInfo.resetsInSeconds,
      authenticatedType: auth.type,
      guestToken: auth.guestToken || undefined,
    });
  } catch (err) {
    console.error('[API /quota] Failed to check quota:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Could not retrieve quota status.',
    });
  }
}
