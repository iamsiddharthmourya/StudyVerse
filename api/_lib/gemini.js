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

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      if (!Array.isArray(data?.models) || data.models.length === 0) {
        continue;
      }

      // Filter models that explicitly support generateContent
      const capableModels = data.models
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent')
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
          `[Gemini Diagnostic] Discovered ${capableModels.length} models supporting generateContent via ${ver}: ${capableModels.map((m) => m.id).join(', ')}`
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

  // 2. Check if user set GEMINI_MODEL and whether it explicitly supports generateContent
  if (userConfiguredModel) {
    const cleanUser = userConfiguredModel.replace(/^models\//, '').trim().replace(/^["']|["']$/g, '');
    const userMatch = discovered.find((m) => m.id.toLowerCase() === cleanUser.toLowerCase());
    if (userMatch) {
      console.log(
        `[Gemini Diagnostic] Configured GEMINI_MODEL "${cleanUser}" verified in models.list with generateContent support.`
      );
      return [
        { model: userMatch.id, version: userMatch.version, source: 'verified_config' },
        ...discovered
          .filter((m) => m.id !== userMatch.id)
          .map((m) => ({ model: m.id, version: m.version, source: 'discovered_fallback' })),
      ];
    } else if (discovered.length > 0) {
      console.warn(
        `[Gemini Diagnostic] GEMINI_MODEL "${cleanUser}" does not support generateContent or was not found in models.list. Falling back to active discovered models.`
      );
    }
  }

  // 3. Select best model from discovered models supporting generateContent
  if (discovered.length > 0) {
    const preference = [
      /gemini-2\.5-flash/i,
      /gemini-2\.0-flash/i,
      /gemini-1\.5-flash/i,
      /gemini-1\.5-pro/i,
      /gemini-2/i,
      /flash/i,
      /gemini/i,
    ];

    const sorted = [...discovered].sort((a, b) => {
      const idxA = preference.findIndex((p) => p.test(a.id));
      const idxB = preference.findIndex((p) => p.test(b.id));
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    console.log(
      `[Gemini Diagnostic] Selected dynamic verified model: ${sorted[0].id} (endpoint: ${sorted[0].version})`
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
    { model: 'gemini-2.0-flash', version: 'v1beta', source: 'static' },
    { model: 'gemini-1.5-flash', version: 'v1', source: 'static' },
    { model: 'gemini-1.5-flash', version: 'v1beta', source: 'static' },
    { model: 'gemini-2.5-flash', version: 'v1beta', source: 'static' },
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
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    const err = new Error(`Gemini API error (HTTP ${response.status}): ${errorDetail}`);
    err.status = response.status;
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

  let rawResponse = null;
  let lastError = null;
  let successfulModel = null;

  for (const item of modelPlan) {
    try {
      rawResponse = await sendGeminiRequest(cleanKey, item.model, prompt, item.version);
      if (rawResponse) {
        successfulModel = item;
        console.log(`[Gemini Diagnostic] Successfully generated quiz with model: ${item.model} (${item.version})`);
        break;
      }
    } catch (err) {
      lastError = err;
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
