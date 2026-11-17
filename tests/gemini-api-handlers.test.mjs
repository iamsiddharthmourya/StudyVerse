import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import generateQuizHandler from '../api/generate-quiz.js';
import quotaHandler from '../api/quota.js';
import { _resetStoreForTesting } from '../api/_lib/quota.js';
import { createGuestToken } from '../api/_lib/auth.js';

// Helper mock HTTP request/response
function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = null }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { ...headers };
  req.body = body;

  const res = {
    statusCode: 200,
    headers: {},
    ended: false,
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    getHeader(k) {
      return this.headers[k.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
    end(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
  };

  return { req, res };
}

async function run() {
  console.log('Running API Handler Integration Tests (/api/generate-quiz & /api/quota)...\n');
  _resetStoreForTesting();

  // Test 1: GET /api/quota for guest
  {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/api/quota' });
    await quotaHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.limit, 5);
    assert.strictEqual(res.body.used, 0);
    assert.strictEqual(res.body.remaining, 5);
    assert.ok(res.body.resetsAt);
    assert.ok(res.headers['x-guest-token'], 'Must issue signed guest token');
    console.log('  ok  Test 1: GET /api/quota returns remaining quota (5/5) and sets X-Guest-Token');
  }

  // Test 2: Method Not Allowed
  {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/api/generate-quiz' });
    await generateQuizHandler(req, res);
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(res.body.error, 'METHOD_NOT_ALLOWED');
    console.log('  ok  Test 2: GET /api/generate-quiz blocked with HTTP 405 Method Not Allowed');
  }

  // Test 3: POST /api/generate-quiz (Topic-based with mocked Gemini response)
  {
    process.env.GEMINI_API_KEY = 'mock-test-key-for-unit-testing';
    const guestToken = createGuestToken('gst_user_test_a');

    // Mock global fetch for Gemini API
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        if (url.includes('/models?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              models: [
                {
                  name: 'models/gemini-2.0-flash',
                  supportedGenerationMethods: ['generateContent'],
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        title: 'Quantum Physics Intro',
                        description: 'Foundations of quantum mechanics',
                        questions: [
                          {
                            question: 'What is Planck constant used for?',
                            options: [
                              'Relating photon energy to frequency',
                              'Calculating gravitational attraction',
                              'Measuring electric charge',
                              'Determining fluid viscosity',
                            ],
                            correctIndex: 0,
                            explanation: 'E = h * nu relates photon energy to frequency.',
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      return originalFetch(url);
    };

    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/generate-quiz',
      headers: {
        'content-type': 'application/json',
        'x-guest-token': guestToken,
      },
      body: {
        sourceType: 'topic',
        topic: 'Quantum Physics',
        difficulty: 'medium',
        questionCount: 1,
      },
    });

    await generateQuizHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.quiz.title, 'Quantum Physics Intro');
    assert.strictEqual(res.body.quiz.questions.length, 1);
    assert.strictEqual(res.body.quota.remaining, 4, '1 slot consumed, 4 remaining');
    console.log('  ok  Test 3: POST /api/generate-quiz (Topic-based) generates quiz and decrements quota');

    // Test 4: Failed Gemini generation does NOT consume quota
    global.fetch = async (url) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'Gemini service overloaded' } }),
        };
      }
      return originalFetch(url);
    };

    const { req: errReq, res: errRes } = createMockReqRes({
      method: 'POST',
      url: '/api/generate-quiz',
      headers: {
        'content-type': 'application/json',
        'x-guest-token': guestToken,
      },
      body: {
        sourceType: 'topic',
        topic: 'Quantum Physics Failure Test',
      },
    });

    await generateQuizHandler(errReq, errRes);
    assert.strictEqual(errRes.statusCode, 503);
    assert.strictEqual(errRes.body.error, 'GEMINI_GENERATION_FAILED');
    assert.strictEqual(errRes.body.remaining, 4, 'Quota must NOT be consumed on failure; remains 4');
    console.log('  ok  Test 4: Failed Gemini generation rolls back slot; quota remains preserved');

    // Test 5: POST /api/generate-quiz (Notes/Document-based) generates quiz from notes
    global.fetch = async (url) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        if (url.includes('/models?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              models: [
                {
                  name: 'models/gemini-2.0-flash',
                  supportedGenerationMethods: ['generateContent'],
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        title: 'Cellular Biology Notes Quiz',
                        description: 'Generated from student class notes',
                        questions: [
                          {
                            question: 'What is the function of mitochondria according to notes?',
                            options: [
                              'ATP generation via cellular respiration',
                              'Protein synthesis in ribosomes',
                              'DNA storage in nucleus',
                              'Lipid breakdown in peroxisomes',
                            ],
                            correctIndex: 0,
                            explanation: 'Mitochondria produce ATP through cellular respiration.',
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      return originalFetch(url);
    };

    const { req: docReq, res: docRes } = createMockReqRes({
      method: 'POST',
      url: '/api/generate-quiz',
      headers: {
        'content-type': 'application/json',
        'x-guest-token': guestToken,
      },
      body: {
        sourceType: 'document',
        extractedText:
          'Mitochondria are membrane-bound cell organelles that generate most of the chemical energy needed to power the cell biochemical reactions. Chemical energy produced by the mitochondria is stored in a small molecule called adenosine triphosphate or ATP.',
        difficulty: 'medium',
        questionCount: 1,
      },
    });

    await generateQuizHandler(docReq, docRes);
    assert.strictEqual(docRes.statusCode, 200);
    assert.strictEqual(docRes.body.success, true);
    assert.strictEqual(docRes.body.quiz.title, 'Cellular Biology Notes Quiz');
    assert.strictEqual(docRes.body.quiz.sourceType, 'document');
    assert.strictEqual(docRes.body.quota.remaining, 3, 'Second successful generation leaves 3 quota');
    console.log('  ok  Test 5: POST /api/generate-quiz (Notes/Document-based) generates quiz from notes');

    // Restore fetch
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }

  console.log('\nAll API Handler Integration Tests Passed Successfully!');
}

run().catch((err) => {
  console.error('API handler test failed:', err);
  process.exit(1);
});
