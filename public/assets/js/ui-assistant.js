/* ui-assistant.js — form metadata, 7-day window preview, and suggestion cards. */
import * as C from './calendar.js';
import { eventsInRange } from './data.js';
import { icons } from './icons.js';
import { esc } from './ui-calendar.js';

export const GOALS = [
  { id: 'awareness', label: 'آگاهی از برند' },
  { id: 'engagement', label: 'افزایش تعامل' },
  { id: 'leads', label: 'جذب سرنخ' },
  { id: 'sales', label: 'افزایش فروش' },
  { id: 'product', label: 'معرفی محصول/خدمت' },
  { id: 'education', label: 'آموزش مخاطب' },
  { id: 'loyalty', label: 'حفظ مشتری و وفاداری' }
];

export const CHANNELS = [
  { id: 'instagram', label: 'اینستاگرام' },
  { id: 'linkedin', label: 'لینکدین' },
  { id: 'telegram', label: 'تلگرام' },
  { id: 'blog', label: 'وبلاگ / وب‌سایت' },
  { id: 'email', label: 'ایمیل مارکتینگ' }
];

export const TONES = [
  { id: 'professional', label: 'حرفه‌ای' },
  { id: 'formal', label: 'رسمی' },
  { id: 'friendly', label: 'صمیمی' },
  { id: 'educational', label: 'آموزشی' },
  { id: 'creative', label: 'خلاق' },
  { id: 'humor', label: 'طنز کنترل‌شده' }
];

export function renderChips(items, name) {
  return items.map((it) => `
    <label class="chip" data-chip>
      <input type="checkbox" name="${name}" value="${it.id}" data-label="${esc(it.label)}">
      ${esc(it.label)}
    </label>`).join('');
}

export function renderToneOptions() {
  return TONES.map((t) => `<option value="${t.id}" data-label="${esc(t.label)}">${esc(t.label)}</option>`).join('');
}

// ---- 7-day window preview --------------------------------------------------
export function renderWindowPreview(refJdn, dataset, { isToday }) {
  const start = refJdn;
  const end = refJdn + 6;
  const count = eventsInRange(dataset, start, 7).length;
  const startFa = C.formatShamsi(start, { long: true });
  const endFa = C.formatShamsi(end, { long: true });
  const gregRange = `${C.formatGregorian(start, { long: false })} تا ${C.formatGregorian(end, { long: false })}`;
  return `
    <div class="window-preview">
      <div class="window-preview__row">
        <span class="window-preview__dates">${esc(startFa)} تا ${esc(endFa)}</span>
        <span class="window-preview__count">${C.toPersianDigits(count)} مناسبت در داده‌ها</span>
      </div>
      <div class="window-preview__hint">
        بازهٔ هفت‌روزه بر مبنای ${isToday ? 'امروز' : 'تاریخ انتخابی'} به وقت تهران (${esc(gregRange)}).
        دستیار فقط از همین مناسبت‌های واقعی استفاده می‌کند.
      </div>
    </div>`;
}

// ---- Suggestion cards ------------------------------------------------------
function ring(score) {
  const p = Math.max(0, Math.min(100, Math.round(score || 0)));
  return `<div class="relevance-ring" style="--p:${p}"><span>${C.toPersianDigits(p)}</span></div>`;
}

function tag(text) {
  return text ? `<span class="chip">${esc(text)}</span>` : '';
}

function detailBlock(icon, label, text) {
  if (!text) return '';
  return `<div class="detail-block">
    <div class="detail-block__label">${icon}${esc(label)}</div>
    <div class="detail-block__text">${esc(text)}</div>
  </div>`;
}

function sampleBlock(text) {
  if (!text) return '';
  return `<div class="detail-block">
    <div class="detail-block__label">${icons.message}نمونه متن آماده</div>
    <div class="sample-text">
      <button type="button" class="btn btn--sm sample-text__copy" data-copy-sample>${icons.copy}کپی</button>
      <span class="sample-text__body">${esc(text)}</span>
    </div>
  </div>`;
}

export function renderEventSuggestion(s, index) {
  const color = (s.category && s.category.color) || 'var(--brand-500)';
  const dateBadge = `${esc(C.toPersianDigits(s.shamsiDate || ''))}`;
  return `<article class="sugg" data-kind="event" data-index="${index}">
    <div class="sugg__main">
      <span class="sugg__bar" style="background:${color}"></span>
      <div class="sugg__content">
        <div class="sugg__top">
          <div class="sugg__occasion">
            <b>${icons.calendar} ${esc(s.occasionName || '')}</b>
            <div class="sugg__title">${esc(s.coreIdea || s.title || '')}</div>
          </div>
          <div class="sugg__relevance">${ring(s.relevanceScore)}<small>ارتباط</small></div>
        </div>
        <div class="sugg__tags">
          <span class="badge badge--soft">${dateBadge}</span>
          ${s.category ? `<span class="chip" style="color:${color};border-color:${color}33">${esc(s.category.label)}</span>` : ''}
          ${tag(s.format)}
          ${tag(s.channel)}
          ${tag(s.contentGoal)}
        </div>
        ${s.relevanceReason ? `<p class="sugg__reason">${esc(s.relevanceReason)}</p>` : ''}
        <div class="sugg__actions">
          <button type="button" class="btn btn--sm" data-toggle>جزئیات اجرایی ${`<span class="sugg__chevron">${icons.chevronDown}</span>`}</button>
          <button type="button" class="btn btn--sm btn--ghost" data-copy-all>${icons.copy} کپی کامل</button>
        </div>
      </div>
    </div>
    <div class="sugg__details">
      ${detailBlock(icons.megaphone, 'پیام اصلی', s.keyMessage)}
      ${detailBlock(icons.hook, 'قلاب / شروع', s.hook)}
      ${detailBlock(icons.bulb, 'ایده اجرایی', s.executionIdea)}
      ${detailBlock(icons.target, 'دعوت به اقدام (CTA)', s.cta)}
      ${detailBlock(icons.compass, 'تناسب با کانال', s.channelFit)}
      ${sampleBlock(s.sampleText)}
    </div>
  </article>`;
}

export function renderIdeaSuggestion(s, index) {
  return `<article class="sugg" data-kind="independent" data-index="${index}">
    <div class="sugg__main">
      <span class="sugg__bar" style="background:var(--warning)"></span>
      <div class="sugg__content">
        <div class="sugg__top">
          <div class="sugg__occasion">
            <b>${icons.bulb} ایده مستقل از مناسبت</b>
            <div class="sugg__title">${esc(s.title || s.coreIdea || '')}</div>
          </div>
        </div>
        <div class="sugg__tags">
          ${tag(s.format)}${tag(s.channel)}${tag(s.contentGoal)}
        </div>
        ${s.relevanceReason ? `<p class="sugg__reason">${esc(s.relevanceReason)}</p>` : ''}
        <div class="sugg__actions">
          <button type="button" class="btn btn--sm" data-toggle>جزئیات اجرایی <span class="sugg__chevron">${icons.chevronDown}</span></button>
          <button type="button" class="btn btn--sm btn--ghost" data-copy-all>${icons.copy} کپی کامل</button>
        </div>
      </div>
    </div>
    <div class="sugg__details">
      ${detailBlock(icons.megaphone, 'پیام اصلی', s.keyMessage)}
      ${detailBlock(icons.hook, 'قلاب / شروع', s.hook)}
      ${detailBlock(icons.bulb, 'ایده اجرایی', s.executionIdea)}
      ${detailBlock(icons.target, 'دعوت به اقدام (CTA)', s.cta)}
      ${sampleBlock(s.sampleText)}
    </div>
  </article>`;
}

/** Group event suggestions by shamsi date and render with day headers. */
export function renderSuggestions(result) {
  const events = result.eventSuggestions || [];
  const ideas = result.independentIdeas || [];
  let html = '';

  // Meta header
  html += `<div class="notice notice--info">${icons.shield}
    <div>این پیشنهادها فقط بر پایهٔ مناسبت‌های واقعی موجود در بازهٔ
    <b>${esc(result.window.startShamsi)}</b> تا <b>${esc(result.window.endShamsi)}</b>
    ساخته شده‌اند. نام و تاریخ هر مناسبت مستقیماً از داده‌های تأییدشده گرفته شده است، نه از مدل.</div></div>`;

  if (events.length) {
    const byDate = new Map();
    for (const s of events) {
      if (!byDate.has(s.shamsiDate)) byDate.set(s.shamsiDate, []);
      byDate.get(s.shamsiDate).push(s);
    }
    const sortedDates = Array.from(byDate.keys()).sort();
    let idx = 0;
    for (const d of sortedDates) {
      const list = byDate.get(d);
      html += `<div class="sugg-group">
        <div class="sugg-group__head">
          <span class="sugg-group__date">${icons.calendar} ${esc(C.toPersianDigits(d))}</span>
          <span class="badge badge--soft">${C.toPersianDigits(list.length)} پیشنهاد</span>
          <span class="sugg-group__line"></span>
        </div>
        ${list.map((s) => renderEventSuggestion(s, idx++)).join('')}
      </div>`;
    }
  } else {
    html += renderNoRelevant(result, ideas.length > 0);
  }

  if (ideas.length) {
    html += `<div class="sugg-group">
      <div class="indep-banner">${icons.bulb} ایده‌های مستقل از مناسبت — به مناسبت خاصی گره نخورده‌اند.</div>
      ${ideas.map((s, i) => renderIdeaSuggestion(s, i)).join('')}
    </div>`;
  }
  return html;
}

function renderNoRelevant(result, hasIdeas) {
  return `<div class="state state--empty">
    <div class="state__icon">${icons.inbox}</div>
    <h3>مناسبت مرتبطی پیدا نشد</h3>
    <p>${result.occasionsFound
      ? `در بازهٔ هفت‌روزه ${C.toPersianDigits(result.occasionsFound)} مناسبت وجود دارد، اما هیچ‌کدام ارتباط کافی و قابل‌دفاعی با کسب‌وکار شما نداشتند. به‌جای ساختن ارتباط مصنوعی، پیشنهاد رویدادمحور ارائه نشد.`
      : 'در بازهٔ هفت‌روزهٔ انتخابی، مناسبتی در داده‌های سال ۱۴۰۵ ثبت نشده است.'}
      ${hasIdeas ? ' در عوض چند ایدهٔ مستقل از مناسبت در ادامه آمده است.' : ''}</p>
  </div>`;
}

// ---- Compose plain-text for "copy all" ------------------------------------
export function composeText(s, kind) {
  const L = [];
  if (kind === 'event') {
    L.push(`مناسبت: ${s.occasionName || ''} (${s.shamsiDate || ''})`);
  } else {
    L.push('ایده مستقل از مناسبت');
  }
  if (s.coreIdea || s.title) L.push(`ایده اصلی: ${s.coreIdea || s.title}`);
  if (s.contentGoal) L.push(`هدف محتوا: ${s.contentGoal}`);
  if (s.format) L.push(`قالب: ${s.format}`);
  if (s.channel) L.push(`کانال: ${s.channel}`);
  if (s.keyMessage) L.push(`پیام اصلی: ${s.keyMessage}`);
  if (s.hook) L.push(`قلاب: ${s.hook}`);
  if (s.executionIdea) L.push(`ایده اجرایی: ${s.executionIdea}`);
  if (s.cta) L.push(`دعوت به اقدام: ${s.cta}`);
  if (s.channelFit) L.push(`تناسب با کانال: ${s.channelFit}`);
  if (s.sampleText) L.push(`\nنمونه متن:\n${s.sampleText}`);
  return L.join('\n');
}
