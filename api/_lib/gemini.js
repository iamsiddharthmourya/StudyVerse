// Server-side Google Gemini client for QuizVerse
// Uses supported Gemini models (gemini-2.0-flash / gemini-1.5-flash) with structured JSON output
// Keeps GEMINI_API_KEY strictly on the server and validates all responses

import { validateQuiz } from '../../src/quizverse/services/quizValidation.js';
import { generateQuestionId } from '../../src/quizverse/utils/quizHelpers.js';

const REQUEST_TIMEOUT_MS = 45000; // 45 seconds timeout

/**
 * Build the system and user prompt for Gemini.
 */
function buildPrompt({
  sourceType,
  topic,
  subject,
  instructions,
  extractedText,
  difficulty,
  questionCount,
}) {
  const count = Math.max(1, Math.min(50, Number(questionCount) || 10));
  const diff = ['easy', 'medium', 'hard'].includes((difficulty || '').toLowerCase())
    ? difficulty.toLowerCase()
    : 'medium';

  let sourceContentPrompt = '';
  if (sourceType === 'document' && extractedText) {
    sourceContentPrompt = `
=== SOURCE STUDY NOTES DOCUMENT ===
${extractedText}
=== END OF STUDY NOTES ===

INSTRUCTIONS FOR DOCUMENT MODE:
- Create questions testing knowledge directly covered in the above study notes.
- Do not invent facts that contradict the provided notes.
`;
  } else {
    sourceContentPrompt = `
=== TARGET TOPIC ===
Topic: "${topic}"
${subject ? `Subject/Course: "${subject}"` : ''}
${instructions ? `Specific Focus Areas / Instructions: "${instructions}"` : ''}

INSTRUCTIONS FOR TOPIC MODE:
- Cover fundamental and essential concepts of this topic with high pedagogical clarity.
`;
  }

  return `
You are a senior academic question author and examiner for high-performing students.
Your task is to create an interactive multiple-choice practice quiz.

REQUIREMENTS:
1. Exactly ${count} questions.
2. Difficulty level: "${diff.toUpperCase()}".
3. Each question must have EXACTLY 4 distinct, plausible answer options.
4. Exactly ONE option must be correct.
5. Provide a 0-based integer 'correctIndex' (0, 1, 2, or 3) pointing to the correct option.
6. Provide a thorough, educational 'explanation' explaining why that answer is correct and why other options are incorrect.
7. Questions must be clear, unambiguous, and grammatically impeccable.

${sourceContentPrompt}

RESPOND STRICTLY WITH A VALID JSON OBJECT adhering to this schema:
{
  "title": "A concise, engaging title for this quiz",
  "description": "A 1-2 sentence overview of what this quiz covers",
  "questions": [
    {
      "question": "Question prompt text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctIndex": 0,
      "explanation": "Detailed rationale explaining why Option 1 is the correct answer..."
    }
  ]
}
`.trim();
}

/**
 * Helper to identify whether a model is suitable for text reasoning & quiz generation.
 * Excludes image generation, image preview, image editing, audio, speech, TTS, embeddings, and real-time models.
 */
export function isTextGenerationModel(modelId, displayName = '') {
  if (!modelId || typeof modelId !== 'string') return false;
  const cleanId = modelId.replace(/^models\//, '').toLowerCase();
  const cleanDisplay = (displayName || '').toLowerCase();

  // Exclude image generation, image editing, and image preview models
  const imagePatterns = [
    'image',
    'imagen',
    'preview-image',
    'image-preview',
    'visual',
    'diffusion',
  ];
  for (const pat of imagePatterns) {
    if (cleanId.includes(pat) || cleanDisplay.includes(pat)) {
      return false;
    }
  }

  // Exclude audio / speech / tts models
  const audioPatterns = ['audio', 'tts', 'speech', 'voice', 'sound'];
  for (const pat of audioPatterns) {
    if (cleanId.includes(pat) || cleanDisplay.includes(pat)) {
      return false;
    }
  }

  // Exclude embedding, moderation, and specialized non-text-completion models
  const otherNonTextPatterns = ['embedding', 'embed', 'aqa', 'realtime', 'live'];
  for (const pat of otherNonTextPatterns) {
    if (cleanId.includes(pat) || cleanDisplay.includes(pat)) {
      return false;
    }
  }

  // Must be a gemini model
  if (!cleanId.startsWith('gemini')) {
    return false;
  }

  return true;
}

/**
 * Parse Google Gemini API error details and quota metrics.
 * Safely extracts diagnostic information without exposing API keys.
 */
export function parseGoogleErrorDiagnostics(status, errorJson, errorText, modelName) {
  const errObj = errorJson?.error || {};
  const details = Array.isArray(errObj.details) ? errObj.details : [];

  // 1. Find ErrorInfo (contains metadata: service, consumer, quota_metric, quota_limit_value, reason)
  const errorInfo = details.find(
    (d) =>
      d?.['@type']?.includes('ErrorInfo') ||
      d?.reason === 'RESOURCE_EXHAUSTED' ||
      d?.reason === 'RATE_LIMIT_EXCEEDED'
  );

  // 2. Find QuotaFailure (contains violations: subject, description)
  const quotaFailure = details.find(
    (d) => d?.['@type']?.includes('QuotaFailure') || Array.isArray(d?.violations)
  );
  const violation = quotaFailure?.violations?.[0];

  const quotaMetric =
    errorInfo?.metadata?.quota_metric ||
    (violation?.description?.match(/quota metric '([^']+)'/)?.[1] ?? '');
  const quotaLimitValue =
    errorInfo?.metadata?.quota_limit_value ||
    (violation?.description?.match(/limit '([^']+)'/)?.[1] ?? '');
  const consumer =
    errorInfo?.metadata?.consumer ||
    violation?.subject ||
    (violation?.description?.match(/for consumer '([^']+)'/)?.[1] ?? '');
  const reason = errorInfo?.reason || errObj.status || (status === 429 ? 'RESOURCE_EXHAUSTED' : 'UNKNOWN');

  // Determine root cause category
  let category = 'UNKNOWN';
  let humanExplanation = '';

  if (status === 429) {
    if (quotaLimitValue === '0' || violation?.description?.includes("limit '0'")) {
      category = 'LIMIT_ZERO_UNLINKED_BILLING';
      humanExplanation = `Google AI Studio has allocated a quota limit of 0 for model "${modelName}". On Google Cloud, free tier quotas are provisioned as 0 until a valid billing account is linked to the project in Google Cloud Console.`;
    } else if (quotaMetric?.toLowerCase().includes('day') || violation?.description?.toLowerCase().includes('day')) {
      category = 'REQUESTS_PER_DAY_EXCEEDED';
      humanExplanation = `Google AI Studio free-tier daily requests limit (RPD) has been exhausted for model "${modelName}". This daily limit automatically refreshes at Midnight Pacific Time (PT).`;
    } else if (quotaMetric?.toLowerCase().includes('token') || violation?.description?.toLowerCase().includes('token')) {
      category = 'TOKENS_PER_MINUTE_EXCEEDED';
      humanExplanation = `Google AI Studio free-tier input tokens per minute (TPM) limit was exceeded for model "${modelName}".`;
    } else if (quotaMetric?.toLowerCase().includes('minute') || violation?.description?.toLowerCase().includes('minute')) {
      category = 'REQUESTS_PER_MINUTE_EXCEEDED';
      humanExplanation = `Google AI Studio free-tier requests per minute (RPM) limit was momentarily reached for model "${modelName}".`;
    } else {
      category = 'FREE_TIER_QUOTA_EXHAUSTED';
      humanExplanation = `Google Gemini API rejected the request because the project's free-tier quota is currently exhausted for model "${modelName}".`;
    }
  } else if (status === 404) {
    category = 'MODEL_NOT_FOUND_OR_UNSUPPORTED';
    humanExplanation = `Model "${modelName}" is not available or does not support generateContent under this API key.`;
  }

  return {
    status,
    model: modelName,
    reason,
    category,
    quotaMetric: quotaMetric || 'GenerateContent requests',
    quotaLimitValue: quotaLimitValue || 'N/A',
    consumer: consumer || 'N/A',
    rawMessage: errObj.message || errorText || 'Resource has been exhausted.',
    explanation: humanExplanation,
  };
}

/**
 * Discover models using Google's models.list endpoint and select those that support generateContent.
 * Caches discovery results for 5 minutes to avoid redundant network calls.
 */
let cachedModels = null;
let cachedModelsExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function discoverSupportedModels(apiKey) {
  const now = Date.now();
  if (cachedModels && now < cachedModelsExpiresAt) {
    return cachedModels;
  }

  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  const versions = ['v1beta', 'v1'];
  const discovered = [];

  for (const ver of versions) {
    try {
      const listUrl = `https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(cleanKey)}`;
      console.log(`[Gemini Diagnostic] Querying models.list via ${ver}...`);

      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'x-goog-api-key': cleanKey,
        },
        signal: AbortSignal.timeout(10000),
      });

      console.log(`[Gemini Diagnostic] models.list (${ver}) returned HTTP ${response.status}`);

      if (response.status === 429) {
        console.warn(`[Gemini Diagnostic] models.list (${ver}) returned HTTP 429 (rate limit). Google quota reached.`);
        break;
      }

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      if (!Array.isArray(data?.models) || data.models.length === 0) {
        continue;
      }

      // Filter models that explicitly support generateContent AND are text-generation models
      const capableModels = data.models
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            isTextGenerationModel(m.name, m.displayName)
        )
        .map((m) => {
          const rawName = m.name || '';
          const id = rawName.replace(/^models\//, '');
          return {
            id,
            fullName: rawName,
            version: ver,
            displayName: m.displayName || id,
            supportedMethods: m.supportedGenerationMethods,
          };
        });

      if (capableModels.length > 0) {
        console.log(
          `[Gemini Diagnostic] Discovered ${capableModels.length} text models supporting generateContent via ${ver}: ${capableModels.map((m) => m.id).join(', ')}`
        );
        discovered.push(...capableModels);
        break; // Successfully discovered with this version
      }
    } catch (err) {
      console.warn(`[Gemini Diagnostic] Could not list models on ${ver}:`, err.message);
    }
  }

  if (discovered.length > 0) {
    cachedModels = discovered;
    cachedModelsExpiresAt = now + CACHE_TTL_MS;
  }

  return discovered;
}

/**
 * Determine the optimal model execution plan based on models.list and user configuration.
 */
export async function resolveModelPlan(apiKey, userConfiguredModel) {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');

  // 1. Discover models using Google's models.list endpoint
  const discovered = await discoverSupportedModels(cleanKey);

  // 2. Check if user set GEMINI_MODEL and whether it explicitly supports generateContent and text reasoning
  if (userConfiguredModel) {
    const cleanUser = userConfiguredModel.replace(/^models\//, '').trim().replace(/^["']|["']$/g, '');
    const userMatch = discovered.find(
      (m) => m.id.toLowerCase() === cleanUser.toLowerCase() && isTextGenerationModel(m.id, m.displayName)
    );
    if (userMatch) {
      console.log(
        `[Gemini Diagnostic] Configured GEMINI_MODEL "${cleanUser}" verified in models.list with text generateContent support.`
      );
      return [
        { model: userMatch.id, version: userMatch.version, source: 'verified_config' },
        ...discovered
          .filter((m) => m.id !== userMatch.id)
          .map((m) => ({ model: m.id, version: m.version, source: 'discovered_fallback' })),
      ];
    } else if (discovered.length > 0) {
      console.warn(
        `[Gemini Diagnostic] GEMINI_MODEL "${cleanUser}" is either not a text model or was not found in models.list. Falling back to active discovered models.`
      );
    }
  }

  // 3. Select best model from discovered text-generation models supporting generateContent
  if (discovered.length > 0) {
    const preference = [
      /^gemini-1\.5-flash$/i,
      /^gemini-1\.5-flash-8b$/i,
      /^gemini-2\.0-flash$/i,
      /^gemini-2\.0-flash-lite$/i,
      /^gemini-1\.5-pro$/i,
      /^gemini-2\.5-flash$/i,
      /gemini-1\.5-flash/i,
      /gemini-2\.0-flash/i,
      /gemini-2/i,
      /flash/i,
      /pro/i,
      /gemini/i,
    ];

    const sorted = [...discovered].sort((a, b) => {
      const idxA = preference.findIndex((p) => p.test(a.id));
      const idxB = preference.findIndex((p) => p.test(b.id));
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    console.log(
      `[Gemini Diagnostic] Selected dynamic verified text model: ${sorted[0].id} (endpoint: ${sorted[0].version})`
    );

    return sorted.map((m, i) => ({
      model: m.id,
      version: m.version,
      source: i === 0 ? 'discovered_primary' : 'discovered_fallback',
    }));
  }

  // 4. Fallback candidate list if models.list was unreachable
  console.log(
    '[Gemini Diagnostic] models.list query returned 0 models. Using resilient fallback candidate list across v1 and v1beta.'
  );
  return [
    { model: 'gemini-1.5-flash', version: 'v1beta', source: 'static' },
    { model: 'gemini-1.5-flash', version: 'v1', source: 'static' },
    { model: 'gemini-1.5-flash-8b', version: 'v1beta', source: 'static' },
    { model: 'gemini-2.0-flash', version: 'v1beta', source: 'static' },
    { model: 'gemini-1.5-pro', version: 'v1', source: 'static' },
  ];
}

/**
 * Clear cached models (strictly for testing).
 */
export function _resetModelCacheForTesting() {
  cachedModels = null;
  cachedModelsExpiresAt = 0;
}

/**
 * Execute request to Gemini API with support for both v1 and v1beta endpoints.
 */
async function sendGeminiRequest(apiKey, model, prompt, apiVersion = 'v1beta') {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  const cleanModel = model.replace(/^models\//, '').trim().replace(/^["']|["']$/g, '');
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  console.log(`[Gemini Diagnostic] Calling ${apiVersion}/models/${cleanModel}:generateContent...`);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': cleanKey,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  console.log(`[Gemini Diagnostic] Response status: HTTP ${response.status} from ${cleanModel} (${apiVersion})`);

  if (!response.ok) {
    let errorDetail = '';
    let parsedErrorJson = null;
    try {
      parsedErrorJson = await response.json();
      errorDetail = parsedErrorJson.error?.message || JSON.stringify(parsedErrorJson);
    } catch {
      errorDetail = await response.text();
    }

    const diagnostics = parseGoogleErrorDiagnostics(response.status, parsedErrorJson, errorDetail, cleanModel);
    console.warn(
      `[Gemini Diagnostic] HTTP ${response.status} from ${cleanModel}: Category=${diagnostics.category}, Metric=${diagnostics.quotaMetric}, Consumer=${diagnostics.consumer}`
    );

    if (response.status === 429) {
      const err = new Error(
        diagnostics.explanation ||
          `Gemini API rate limit or quota exceeded (HTTP 429): Google free tier request limit reached for model ${cleanModel}.`
      );
      err.status = 429;
      err.code = 'GEMINI_RATE_LIMIT';
      err.diagnostics = diagnostics;
      err.detail = errorDetail;
      throw err;
    }

    const err = new Error(`Gemini API error (HTTP ${response.status}): ${errorDetail}`);
    err.status = response.status;
    err.diagnostics = diagnostics;
    err.detail = errorDetail;
    throw err;
  }

  return response.json();
}

/**
 * Generate a complete, schema-validated quiz using Google Gemini API.
 */
export async function generateQuizWithGemini(params) {
  const rawKey = process.env.GEMINI_API_KEY;
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to your environment variables.'
    );
    err.code = 'CONFIG_MISSING';
    err.status = 503;
    throw err;
  }

  const cleanKey = rawKey.trim().replace(/^["']|["']$/g, '');
  const prompt = buildPrompt(params);

  // Discover supported models and plan execution
  const modelPlan = await resolveModelPlan(cleanKey, process.env.GEMINI_MODEL);

  const triedModels = [];
  const diagnosticsList = [];
  let rawResponse = null;
  let lastError = null;
  let successfulModel = null;

  for (const item of modelPlan) {
    if (triedModels.includes(item.model)) continue;
    triedModels.push(item.model);

    // Limit fallback exploration to at most 3 distinct verified text models
    if (triedModels.length > 3) break;

    try {
      rawResponse = await sendGeminiRequest(cleanKey, item.model, prompt, item.version);
      if (rawResponse) {
        successfulModel = item;
        console.log(`[Gemini Diagnostic] Successfully generated quiz with model: ${item.model} (${item.version})`);
        break;
      }
    } catch (err) {
      lastError = err;
      diagnosticsList.push({
        model: item.model,
        version: item.version,
        status: err.status,
        code: err.code,
        diagnostics: err.diagnostics,
      });

      if (err.status === 429) {
        console.warn(
          `[Gemini Diagnostic] Model ${item.model} returned HTTP 429 (${err.diagnostics?.category || 'RATE_LIMIT'}). Checking next text model candidate...`
        );
        continue; // Fall back to next text candidate model
      }

      if (err.status === 404 || err.status === 400) {
        console.warn(
          `[Gemini Diagnostic] Model ${item.model} (${item.version}) failed with HTTP ${err.status}. Trying next candidate...`
        );
        continue;
      }

      throw err;
    }
  }

  if (!rawResponse && lastError) {
    if (lastError.status === 429) {
      const primaryDiag = diagnosticsList[0]?.diagnostics;
      const attemptedNames = triedModels.join(', ');

      let detailedMessage = '';
      if (primaryDiag?.category === 'LIMIT_ZERO_UNLINKED_BILLING') {
        detailedMessage = `Google AI Studio quota limit is 0 for project (${primaryDiag.consumer || 'unlinked'}) across attempted models (${attemptedNames}). In Google Cloud Console, a billing account must be linked to your project to activate free-tier quotas.`;
      } else if (primaryDiag?.category === 'REQUESTS_PER_DAY_EXCEEDED') {
        detailedMessage = `Google AI Studio daily request limit (RPD) exhausted for project (${primaryDiag.consumer || 'current'}) across attempted models (${attemptedNames}). Quota resets daily at Midnight Pacific Time (PT).`;
      } else {
        detailedMessage = `Google Gemini API free-tier quota is currently exhausted for project (${primaryDiag?.consumer || 'current'}) across attempted models (${attemptedNames}).`;
      }

      const aggregateErr = new Error(detailedMessage);
      aggregateErr.status = 429;
      aggregateErr.code = 'GOOGLE_AI_QUOTA_EXHAUSTED';
      aggregateErr.diagnostics = {
        attemptedModels: triedModels,
        category: primaryDiag?.category || 'FREE_TIER_QUOTA_EXHAUSTED',
        consumerProject: primaryDiag?.consumer || 'Google AI Studio Project',
        quotaMetric: primaryDiag?.quotaMetric || 'GenerateContent requests',
        quotaLimitValue: primaryDiag?.quotaLimitValue || '0',
        explanation: primaryDiag?.explanation,
        helpUrl: 'https://aistudio.google.com/app/plan_information',
        troubleshooting: [
          '1. In Google AI Studio (https://aistudio.google.com/), check your Plan & Quotas.',
          '2. If your project quota limit is 0, attach a billing account to your project in Google Cloud Console to provision standard free-tier quotas (usage within free tier remains $0).',
          '3. Alternatively, generate a fresh API key in a new Google Cloud project with active free-tier quotas.',
          '4. In the meantime, you can practice with pre-built QuizVerse Sample Quizzes (Cell Biology, Data Structures, World History) with 100% full features without consuming AI quota.'
        ]
      };
      throw aggregateErr;
    }

    if (lastError.status === 404) {
      throw new Error(
        `Gemini API returned HTTP 404: No models supporting generateContent could be accessed with your API key. Please verify that 'Generative Language API' is enabled in your Google Cloud Project or generate an API key directly from Google AI Studio (https://aistudio.google.com/).`
      );
    }
    throw lastError;
  }

  // Extract text from Gemini candidates
  const candidate = rawResponse?.candidates?.[0];
  if (!candidate || !candidate.content?.parts?.[0]?.text) {
    throw new Error('Gemini returned an empty or blocked candidate response.');
  }

  const textOutput = candidate.content.parts[0].text.trim();

  // Strip code fences if present (e.g. ```json ... ```)
  const cleanJsonText = textOutput
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleanJsonText);
  } catch (parseErr) {
    throw new Error(`Failed to parse Gemini response as JSON: ${parseErr.message}`);
  }

  // Normalize questions array
  const rawQuestions = Array.isArray(parsed.questions)
    ? parsed.questions
    : Array.isArray(parsed)
    ? parsed
    : [];

  if (rawQuestions.length === 0) {
    throw new Error('Gemini response did not contain any generated questions.');
  }

  const cleanQuestions = rawQuestions.map((q, idx) => ({
    id: generateQuestionId(idx),
    question: typeof q.question === 'string' ? q.question.trim() : `Question ${idx + 1}`,
    options: Array.isArray(q.options)
      ? q.options.map((o) => (typeof o === 'string' ? o.trim() : String(o)))
      : ['A', 'B', 'C', 'D'],
    correctIndex: Number.isInteger(Number(q.correctIndex)) ? Number(q.correctIndex) : 0,
    explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
  }));

  const candidateQuiz = {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : params.topic
        ? `${params.topic} Practice Quiz`
        : 'AI Generated Practice Quiz',
    description:
      typeof parsed.description === 'string'
        ? parsed.description.trim()
        : `AI generated practice quiz (${params.difficulty || 'medium'}).`,
    sourceType: params.sourceType === 'document' ? 'document' : 'topic',
    sourceName: params.sourceName || params.subject || '',
    difficulty: (params.difficulty || 'medium').toLowerCase(),
    questionCount: cleanQuestions.length,
    questions: cleanQuestions,
  };

  // Enforce server-side schema validation
  const validation = validateQuiz(candidateQuiz);
  if (!validation.valid) {
    throw new Error(`Generated quiz failed validation: ${validation.errors.join('; ')}`);
  }

  return validation.cleanQuiz;
}
