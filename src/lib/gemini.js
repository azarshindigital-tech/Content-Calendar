/*
 * gemini.js — server-side call to Google Gemini with structured JSON output.
 * The API key is read from the environment (a Cloudflare Secret in production,
 * `.dev.vars` locally) and is never logged or returned to the client.
 */

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

// Response schema — the shape Gemini must return (OpenAPI subset).
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    eventSuggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          occasionId: { type: 'STRING', description: 'شناسهٔ دقیق مناسبت از فهرست ورودی (مثل e123). فقط از همین شناسه‌ها استفاده کن.' },
          relevanceScore: { type: 'INTEGER', description: 'امتیاز ارتباط ۰ تا ۱۰۰' },
          relevanceReason: { type: 'STRING', description: 'چرا این مناسبت به این کسب‌وکار مرتبط است' },
          contentGoal: { type: 'STRING' },
          coreIdea: { type: 'STRING', description: 'ایده/زاویهٔ محتوایی متمایز و مشخص' },
          keyMessage: { type: 'STRING' },
          format: { type: 'STRING', description: 'مثل ریلز، کاروسل، پست متنی، مقاله، ایمیل' },
          channel: { type: 'STRING', description: 'یکی از کانال‌های انتخابی کاربر' },
          executionIdea: { type: 'STRING' },
          hook: { type: 'STRING' },
          cta: { type: 'STRING' },
          channelFit: { type: 'STRING' },
          sampleText: { type: 'STRING', description: 'پیش‌نویس کوتاه و قابل‌استفاده، متناسب با کانال' }
        },
        required: ['occasionId', 'relevanceScore', 'relevanceReason', 'contentGoal', 'coreIdea',
          'keyMessage', 'format', 'channel', 'executionIdea', 'hook', 'cta', 'sampleText']
      }
    },
    independentIdeas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          contentGoal: { type: 'STRING' },
          format: { type: 'STRING' },
          channel: { type: 'STRING' },
          relevanceReason: { type: 'STRING' },
          keyMessage: { type: 'STRING' },
          executionIdea: { type: 'STRING' },
          hook: { type: 'STRING' },
          cta: { type: 'STRING' },
          sampleText: { type: 'STRING' }
        },
        required: ['title', 'contentGoal', 'format', 'channel', 'keyMessage', 'executionIdea', 'hook', 'cta', 'sampleText']
      }
    }
  },
  required: ['eventSuggestions', 'independentIdeas']
};

export class GeminiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status || 502;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Calls Gemini and returns the parsed JSON object matching RESPONSE_SCHEMA.
 *  Retries the transient "high demand" (503) and network/timeout cases with
 *  exponential backoff; non-retryable errors (auth, bad request) fail fast. */
export async function callGemini({ apiKey, model, systemInstruction, userPrompt, temperature = 0.8, timeoutMs = 45000, maxRetries = 2 }) {
  if (!apiKey) throw new GeminiError('CONFIG', 'کلید سرویس هوش مصنوعی روی سرور تنظیم نشده است.', 500);

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      topP: 0.95,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 8192
    }
  });

  let lastErr = null;
  let res = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(800 * Math.pow(2, attempt - 1)); // 0.8s, 1.6s

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(ENDPOINT(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: payload
      });
    } catch (err) {
      clearTimeout(timer);
      lastErr = (err && err.name === 'AbortError')
        ? new GeminiError('TIMEOUT', 'پاسخ سرویس هوش مصنوعی در زمان مجاز دریافت نشد. دوباره تلاش کنید.', 504)
        : new GeminiError('NETWORK', 'ارتباط با سرویس هوش مصنوعی برقرار نشد.', 502);
      res = null;
      continue; // retry network / timeout
    }
    clearTimeout(timer);

    if (res.status === 503) { // high demand — retry
      try { await res.text(); } catch { /* ignore */ }
      lastErr = new GeminiError('UPSTREAM', 'سرویس هوش مصنوعی موقتاً شلوغ است. لطفاً چند لحظه بعد دوباره تلاش کنید.', 503);
      res = null;
      continue;
    }
    break; // got a non-retryable response (success or definitive error)
  }

  if (!res) throw lastErr || new GeminiError('UPSTREAM', 'سرویس هوش مصنوعی در دسترس نیست.', 502);

  if (!res.ok) {
    const status = res.status;
    let code = 'UPSTREAM', message = 'سرویس هوش مصنوعی پاسخ معتبری برنگرداند.';
    if (status === 400) { code = 'BAD_REQUEST'; message = 'درخواست به سرویس هوش مصنوعی نامعتبر بود (شاید نام مدل درست نیست).'; }
    else if (status === 401 || status === 403) { code = 'AUTH'; message = 'احراز هویت سرویس هوش مصنوعی ناموفق بود. کلید را بررسی کنید.'; }
    else if (status === 404) { code = 'MODEL'; message = 'مدل انتخاب‌شده در دسترس نیست. مقدار GEMINI_MODEL را بررسی کنید.'; }
    else if (status === 429) { code = 'RATE_LIMIT'; message = 'محدودیت تعداد درخواست یا اتمام سهمیهٔ سرویس هوش مصنوعی. کمی بعد دوباره تلاش کنید.'; }
    else if (status >= 500) { code = 'UPSTREAM'; message = 'سرویس هوش مصنوعی موقتاً در دسترس نیست.'; }
    try { await res.text(); } catch { /* ignore */ }
    throw new GeminiError(code, message, status === 429 ? 429 : 502);
  }

  let data;
  try { data = await res.json(); } catch {
    throw new GeminiError('PARSE', 'پاسخ سرویس هوش مصنوعی قابل‌خواندن نبود.', 502);
  }

  const block = data && data.promptFeedback && data.promptFeedback.blockReason;
  if (block) throw new GeminiError('BLOCKED', 'محتوای درخواست توسط سرویس هوش مصنوعی مسدود شد. ورودی‌ها را بازبینی کنید.', 502);

  const cand = data && data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts && cand.content.parts.map((p) => p.text || '').join('');
  if (!text) throw new GeminiError('EMPTY', 'سرویس هوش مصنوعی پاسخی تولید نکرد. دوباره تلاش کنید.', 502);

  let parsed;
  try { parsed = JSON.parse(text); } catch {
    throw new GeminiError('INVALID_JSON', 'خروجی هوش مصنوعی ساختار معتبری نداشت.', 502);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new GeminiError('INVALID_JSON', 'خروجی هوش مصنوعی ساختار معتبری نداشت.', 502);
  }
  parsed.eventSuggestions = Array.isArray(parsed.eventSuggestions) ? parsed.eventSuggestions : [];
  parsed.independentIdeas = Array.isArray(parsed.independentIdeas) ? parsed.independentIdeas : [];
  return parsed;
}
