/* ========================================================
   HELPERS.JS — Utilitários genéricos
   --------------------------------------------------------
   01B — Helpers de string/HTML
      01B.1  hardRedirect(path)
      01B.2  escapeHtml(str)
      01B.3  normalizeDigits(v)
      01B.4  clipOneLine(s, max)

   01C — Helpers de datas/horas
      01C.1  fmtTime(d)
      01C.2  fmtDatePt(d)
      01C.3  fmtDateISO(d)
      01C.4  parseISODateToLocalStart(dateISO)
      01C.5  __gcIsoLocalDayRangeCore(dateStr)
      01C.6  isoLocalDayRangeFromISODate(dateStr)
      01C.7  isoLocalDayRangeFromISO(dateStr)
      01C.8  toLocalInputValue(dateObj)
      01C.9  fromLocalInputValue(v)

   01E — Helpers DOB (idade + aniversário)
      01E.1  parseISODateOnly(isoDate)
      01E.2  calcAgeYears(dobISO, refDate)
      01E.3  isBirthdayOnDate(dobISO, refDate)
   ======================================================== */

/* ==== 01B — Helpers de string/HTML ==== */

/* ---- 01B.1 — hardRedirect ---- */
export function hardRedirect(path) {
  window.location.replace(path);
}

/* ---- 01B.2 — escapeHtml ---- */
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---- 01B.3 — normalizeDigits ---- */
export function normalizeDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

/* ---- 01B.4 — clipOneLine ---- */
export function clipOneLine(s, max = 110) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}


/* ==== 01C — Helpers de datas/horas ==== */

/* ---- 01C.1 — fmtTime ---- */
export function fmtTime(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ---- 01C.2 — fmtDatePt ---- */
export function fmtDatePt(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

/* ---- 01C.3 — fmtDateISO ---- */
export function fmtDateISO(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ---- 01C.4 — parseISODateToLocalStart ---- */
export function parseISODateToLocalStart(dateISO) {
  const [y, m, d] = (dateISO || "").split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/* ---- 01C.5 — __gcIsoLocalDayRangeCore (interno) ---- */
function __gcIsoLocalDayRangeCore(dateStr) {
  const start = parseISODateToLocalStart(dateStr);
  if (!start) return null;
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString(), start, end };
}

/* ---- 01C.6 — isoLocalDayRangeFromISODate ---- */
export function isoLocalDayRangeFromISODate(dateStr) {
  return __gcIsoLocalDayRangeCore(dateStr);
}

/* ---- 01C.7 — isoLocalDayRangeFromISO ---- */
export function isoLocalDayRangeFromISO(dateStr) {
  return __gcIsoLocalDayRangeCore(dateStr);
}

/* ---- 01C.8 — toLocalInputValue ---- */
export function toLocalInputValue(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/* ---- 01C.9 — fromLocalInputValue ---- */
export function fromLocalInputValue(v) {
  return new Date(v);
}


/* ==== 01E — Helpers DOB (idade + aniversário) ==== */

/* ---- 01E.1 — parseISODateOnly ---- */
export function parseISODateOnly(isoDate) {
  // isoDate: "YYYY-MM-DD" (dob vindo do Postgres date)
  if (!isoDate) return null;
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/* ---- 01E.2 — calcAgeYears ---- */
export function calcAgeYears(dobISO, refDate = new Date()) {
  const dob = parseISODateOnly(dobISO);
  if (!dob) return null;

  const ry = refDate.getFullYear();
  const rm = refDate.getMonth() + 1; // 1-12
  const rd = refDate.getDate();      // 1-31

  let age = ry - dob.y;
  const hadBirthdayThisYear = rm > dob.m || (rm === dob.m && rd >= dob.d);
  if (!hadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

/* ---- 01E.3 — isBirthdayOnDate ---- */
export function isBirthdayOnDate(dobISO, refDate = new Date()) {
  const dob = parseISODateOnly(dobISO);
  if (!dob) return false;

  const rm = refDate.getMonth() + 1;
  const rd = refDate.getDate();

  // Caso especial: 29/02 — considera 28/02 nos anos não bissextos
  if (dob.m === 2 && dob.d === 29) {
    const y = refDate.getFullYear();
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    if (!isLeap) return rm === 2 && rd === 28;
  }

  return rm === dob.m && rd === dob.d;
}
