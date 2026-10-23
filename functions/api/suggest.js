/*
 * POST /api/suggest — the content-suggestion endpoint (Cloudflare Pages Function).
 *
 * Flow: validate input -> compute the 7-day window server-side (Asia/Tehran) ->
 * extract the REAL occasions from the bundled dataset -> ask Gemini only about
 * those -> validate the model's output against the authoritative data (names and
 * dates come from the data, never from the model) -> return structured JSON.
 */
import eventsRaw from '../../public/data/events.json';
import * as C from '../../public/assets/js/calendar.js';
import { buildDataset, eventsInRange } from '../../public/assets/js/data.js';
import { callGemini, GeminiError } from '../lib/gemini.js';
import { SYSTEM_INSTRUCTION, buildUserPrompt } from '../lib/prompt.js';

// Built once per isolate.
const dataset = buildDataset(eventsRaw);

const WINDOW_DAYS = 7;
const MAX_EVENT_SUGGESTIONS = 8;
const MAX_INDEPENDENT = 2;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function fail(code, message, status = 400) {
  return json({ ok: false, error: { code, message } }, status);
}

function str(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}
function strArray(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string').slice(0, maxItems).map((x) => x.trim().slice(0, maxLen)).filter(Boolean);
}

function resolveReferenceJdn(referenceDate, tz) {
  if (referenceDate && Number.isInteger(referenceDate.jy) &&
      Number.isInteger(referenceDate.jm) && Number.isInteger(referenceDate.jd) &&
      C.isValidJalaaliDate(referenceDate.jy, referenceDate.jm, referenceDate.jd)) {
    return { jdn: C.jalaaliToJdn(referenceDate.jy, referenceDate.jm, referenceDate.jd), basedOn: 'custom' };
  }
  return { jdn: C.todayJdn(tz), basedOn: 'today' };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const tz = env.APP_TIMEZONE || 'Asia/Tehran';
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';

  // --- Parse & cap input ----------------------------------------------------
  let body;
  try {
    const text = await request.text();
    if (text.length > 20000) return fail('TOO_LARGE', 'حجم درخواست بیش از حد مجاز است.', 413);
    body = JSON.parse(text);
  } catch {
    return fail('BAD_JSON', 'درخواست نامعتبر است.', 400);
  }

  const b = (body && body.business) || {};
  const business = {
    field: str(b.field, 800),
    product: str(b.product, 300),
    audience: str(b.audience, 300),
    goals: strArray(b.goals, 12, 60),
    channels: strArray(b.channels, 12, 60),
    tone: str(b.tone, 40),
    constraints: str(b.constraints, 800)
  };

  // --- Server-side validation (mirrors the client) --------------------------
  const problems = [];
  if (business.field.length < 6) problems.push('حوزهٔ فعالیت');
  if (business.product.length < 3) problems.push('محصول/خدمت');
  if (business.audience.length < 3) problems.push('مخاطب هدف');
  if (!business.goals.length) problems.push('هدف محتوا');
  if (!business.channels.length) problems.push('کانال انتشار');
  if (problems.length) {
    return fail('VALIDATION', 'اطلاعات ضروری ناقص است: ' + problems.join('، ') + '.', 422);
  }

  // --- Compute window + extract REAL occasions ------------------------------
  const { jdn: refJdn, basedOn } = resolveReferenceJdn(body.referenceDate, tz);
  const startJdn = refJdn;
  const endJdn = refJdn + (WINDOW_DAYS - 1);

  const winEvents = eventsInRange(dataset, startJdn, WINDOW_DAYS);
  const byId = new Map(winEvents.map((e) => [e.id, e]));

  const window = {
    startShamsi: C.shamsiKey(startJdn),
    endShamsi: C.shamsiKey(endJdn),
    startGreg: C.gregorianKey(startJdn),
    endGreg: C.gregorianKey(endJdn),
    startShamsiLong: C.formatShamsi(startJdn, { long: true }),
    endShamsiLong: C.formatShamsi(endJdn, { long: true }),
    timezone: tz,
    basedOn,
    days: WINDOW_DAYS
  };

  const promptEvents = winEvents.map((e) => ({
    id: e.id, name: e.name, shamsiDate: e.shamsiDate,
    weekday: C.weekdayName(e.jdn), category: e.category
  }));

  // --- Call the model -------------------------------------------------------
  const temperature = body && body.nonce ? 0.95 : 0.75;
  let raw;
  try {
    raw = await callGemini({
      apiKey: env.GEMINI_API_KEY,
      model,
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt: buildUserPrompt({ business, window, events: promptEvents }),
      temperature
    });
  } catch (err) {
    if (err instanceof GeminiError) return fail(err.code, err.message, err.status);
    return fail('UNKNOWN', 'خطای غیرمنتظره‌ای در تولید پیشنهاد رخ داد.', 500);
  }

  // --- Validate output against authoritative data ---------------------------
  const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const cut = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');

  let dropped = 0;
  const eventSuggestions = [];
  for (const s of raw.eventSuggestions) {
    const ev = byId.get(s && s.occasionId);
    if (!ev) { dropped++; continue; } // reject anything not tied to a real occasion
    eventSuggestions.push({
      occasionId: ev.id,
      occasionName: ev.name,              // authoritative — from data, not the model
      shamsiDate: ev.shamsiDate,          // authoritative
      gregorianDate: ev.gregorianDate,    // authoritative
      category: { label: ev.category.label, color: ev.category.color },
      relevanceScore: clampScore(s.relevanceScore),
      relevanceReason: cut(s.relevanceReason, 600),
      contentGoal: cut(s.contentGoal, 120),
      coreIdea: cut(s.coreIdea, 240),
      keyMessage: cut(s.keyMessage, 600),
      format: cut(s.format, 60),
      channel: cut(s.channel, 60),
      executionIdea: cut(s.executionIdea, 900),
      hook: cut(s.hook, 400),
      cta: cut(s.cta, 240),
      channelFit: cut(s.channelFit, 500),
      sampleText: cut(s.sampleText, 2000)
    });
  }
  eventSuggestions.sort((a, b2) => b2.relevanceScore - a.relevanceScore);
  const trimmedEvents = eventSuggestions.slice(0, MAX_EVENT_SUGGESTIONS);

  const independentIdeas = raw.independentIdeas.slice(0, MAX_INDEPENDENT).map((s) => ({
    title: cut(s.title, 240),
    contentGoal: cut(s.contentGoal, 120),
    format: cut(s.format, 60),
    channel: cut(s.channel, 60),
    relevanceReason: cut(s.relevanceReason, 400),
    keyMessage: cut(s.keyMessage, 600),
    executionIdea: cut(s.executionIdea, 900),
    hook: cut(s.hook, 400),
    cta: cut(s.cta, 240),
    sampleText: cut(s.sampleText, 2000)
  })).filter((s) => s.title);

  return json({
    ok: true,
    model,
    window,
    occasionsFound: winEvents.length,
    droppedHallucinations: dropped,
    noRelevant: trimmedEvents.length === 0,
    eventSuggestions: trimmedEvents,
    independentIdeas,
    generatedAtShamsi: C.formatShamsi(C.todayJdn(tz), { long: true })
  });
}
