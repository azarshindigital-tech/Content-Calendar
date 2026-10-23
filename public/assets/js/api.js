/* api.js — thin client for the server-side content-suggestion endpoint. */

export async function requestSuggestions(payload, { signal } = {}) {
  let res;
  try {
    res = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK', 'ارتباط با سرور برقرار نشد. اتصال اینترنت و در دسترس بودن سرویس را بررسی کنید.');
  }

  let body = null;
  try { body = await res.json(); } catch { /* non-JSON response */ }

  if (!res.ok || !body || body.ok === false) {
    const code = (body && body.error && body.error.code) || 'HTTP_' + res.status;
    const message = (body && body.error && body.error.message) ||
      'خطای غیرمنتظره‌ای در سرویس پیشنهادها رخ داد.';
    throw new ApiError(code, message);
  }
  return body;
}

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; this.name = 'ApiError'; }
}
