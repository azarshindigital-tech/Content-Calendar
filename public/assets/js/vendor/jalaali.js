/*
 * jalaali-js  (MIT License)
 * https://github.com/jalaali/jalaali-js  —  by Behrang Noruzi Niya and contributors.
 * Vendored as an ES module so the browser needs no bundler. The algorithm is the
 * exact, exact-breaks implementation — NOT an approximation.
 */

var breaks = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
  1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
];

function div(a, b) { return ~~(a / b); }
function mod(a, b) { return a - ~~(a / b) * b; }

// This determines if the Jalaali (Persian) year is leap (366-day long) or not.
function jalCal(jy, withoutLeap) {
  var bl = breaks.length,
    gy = jy + 621,
    leapJ = -14,
    jp = breaks[0],
    jm, jump, leap, leapG, march, n, i;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('Invalid Jalaali year ' + jy);
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;

  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
  }

  return { leap: leap, gy: gy, march: march };
}

// Converts a Gregorian date to Julian Day number.
function g2d(gy, gm, gd) {
  var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

// Converts the Julian Day number to a date in the Gregorian calendar.
function d2g(jdn) {
  var j, i, gd, gm, gy;
  j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  i = div(mod(j, 1461), 4) * 5 + 308;
  gd = div(mod(i, 153), 5) + 1;
  gm = mod(div(i, 153), 12) + 1;
  gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy: gy, gm: gm, gd: gd };
}

// Converts a Jalaali date to Julian Day number.
function j2d(jy, jm, jd) {
  var r = jalCal(jy, true);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

// Converts the Julian Day number to a date in the Jalaali calendar.
function d2j(jdn) {
  var gy = d2g(jdn).gy,
    jy = gy - 621,
    r = jalCal(jy, false),
    jdn1f = g2d(gy, 3, r.march),
    jd, jm, k;

  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy: jy, jm: jm, jd: jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy: jy, jm: jm, jd: jd };
}

export function toJalaali(gy, gm, gd) {
  if (Object.prototype.toString.call(gy) === '[object Date]') {
    gd = gy.getDate();
    gm = gy.getMonth() + 1;
    gy = gy.getFullYear();
  }
  var r = d2j(g2d(gy, gm, gd));
  return { jy: r.jy, jm: r.jm, jd: r.jd };
}

export function toGregorian(jy, jm, jd) {
  var r = d2g(j2d(jy, jm, jd));
  return { gy: r.gy, gm: r.gm, gd: r.gd };
}

export function isLeapJalaaliYear(jy) {
  return jalCal(jy, false).leap === 0;
}

export function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  if (isLeapJalaaliYear(jy)) return 30;
  return 29;
}

export function isValidJalaaliDate(jy, jm, jd) {
  return jy >= -61 && jy <= 3177 &&
    jm >= 1 && jm <= 12 &&
    jd >= 1 && jd <= jalaaliMonthLength(jy, jm);
}

// Julian Day number of a Jalaali date — exported for day-difference math.
export function jalaaliToJDN(jy, jm, jd) {
  return j2d(jy, jm, jd);
}

export function gregorianToJDN(gy, gm, gd) {
  return g2d(gy, gm, gd);
}

export function jdnToJalaali(jdn) {
  return d2j(jdn);
}

export function jdnToGregorian(jdn) {
  return d2g(jdn);
}
