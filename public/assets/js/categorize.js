/*
 * categorize.js — a lightweight, keyword-based *display* categorizer.
 *
 * IMPORTANT: this only assigns a color/label to help users scan the calendar.
 * It never changes an occasion's name or date. Categories are inferred from the
 * title text and are intentionally conservative; anything unmatched is "عمومی".
 */

export const CATEGORIES = {
  religious:     { id: 'religious',     label: 'مذهبی',           color: '#10b981' },
  national:      { id: 'national',      label: 'ملی و ایران',      color: '#ef4444' },
  international:  { id: 'international',  label: 'جهانی',            color: '#3b82f6' },
  culture:       { id: 'culture',       label: 'فرهنگ و مشاهیر',   color: '#8b5cf6' },
  lifestyle:     { id: 'lifestyle',     label: 'سبک زندگی و سرگرمی', color: '#ec4899' },
  general:       { id: 'general',       label: 'عمومی و مناسبتی',   color: '#64748b' }
};

// Checked top-to-bottom; first match wins.
const RULES = [
  ['religious', ['امام', 'حضرت', 'پیامبر', 'معصومه', 'عید سعید', 'عید فطر', 'عید قربان',
    'غدیر', 'عاشورا', 'تاسوعا', 'مبعث', 'مباهله', 'شهادت', 'ولادت', 'رحلت', 'وفات',
    'میلاد', 'هجری قمری', 'دهه کرامت', 'دهه امامت', 'آشو زرتشت', 'زرتشت', 'نیمه شعبان']],
  ['international', ['جهانی', 'بین‌المللی', 'بین المللی']],
  ['national', ['روز ملی', 'ملی ', 'انقلاب', 'جمهوری اسلامی', 'ارتش', 'نیروی زمینی',
    'خرمشهر', 'دفاع مقدس', 'شهدا', 'قیام', 'فتح ', 'قوه قضاییه', 'مجلس شورای',
    'مقاومت', 'ایثار', 'نفت', 'خلیج فارس', 'فناوری هسته‌ای', 'هلال احمر']],
  ['culture', ['زادروز', 'بزرگداشت', 'درگذشت', 'سالروز', 'پاسداشت', 'فردوسی', 'سعدی',
    'حافظ', 'خیام', 'مولوی', 'عطار', 'فارسی', 'شعر', 'نثر', 'موسیقی', 'تئاتر', 'هنر',
    'سینما', 'جشن نوروز', 'جشن', 'نوروز', 'یلدا', 'مهرگان', 'سده', 'میراث', 'موزه',
    'کتاب', 'کتابخانه', 'فرش', 'زبان']],
  ['lifestyle', ['شکلات', 'قهوه', 'پیتزا', 'دونات', 'کیک', 'بستنی', 'وافل', 'پاستیل',
    'ساندویچ', 'چای', 'فلافل', 'سوشی', 'همبرگر', 'پنیر', 'کروسان', 'ماکارون', 'نوقا',
    'اسفناج', 'هویج', 'کارامل', 'پاپ کورن', 'گوجه', 'سیب‌زمینی', 'سیب زمینی', 'تخم مرغ',
    'مرغ', 'آناناس', 'کشمش', 'گردو', 'حمص', 'کوکتل', 'اسموتی', 'شیک', 'موز', 'میگو',
    'لابستر', 'آب پرتقال', 'اسب تک', 'پری دریایی', 'ابرقهرمان', 'سوپرمن', 'هری پاتر',
    'جنگ ستارگان', 'دراکولا', 'شرلوک', 'موش خرما', 'بالشت', 'پیژامه', 'سرگرمی', 'مهمانی',
    'لبخند', 'خنده', 'تیله', 'عروسک', 'جوراب', 'دمپایی', 'پیک‌نیک', 'پیک نیک']]
];

/** Returns a CATEGORIES entry for a given occasion name. */
export function categoryOf(name) {
  const text = String(name || '');
  for (const [catId, words] of RULES) {
    for (const w of words) {
      if (text.includes(w)) return CATEGORIES[catId];
    }
  }
  return CATEGORIES.general;
}
