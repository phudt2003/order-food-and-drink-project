// Flash Sale time helpers
// Requirement: Flash Sale window crosses midnight (e.g. 18:00 -> 08:00 next day).
//
// Note: This implementation uses native Date (local timezone).
// If you prefer dayjs, you can replace the internals with dayjs() calculations
// without changing the exported APIs.

const isValidHHmm = (value) => /^\d{1,2}:\d{2}$/.test(String(value || "").trim());

export const parseHHmmToMinutes = (value) => {
  const text = String(value || "").trim();
  if (!isValidHHmm(text)) return null;
  const [hRaw, mRaw] = text.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const dateAtMinutes = (base, minutes) => {
  const d = new Date(base);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

export const isWithinDailyWindow = (now, startTime, endTime) => {
  const startMinutes = parseHHmmToMinutes(startTime);
  const endMinutes = parseHHmmToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  // Cross-midnight window: e.g. 18:00 -> 08:00
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
};

/**
 * Returns the real end datetime of the *current active* daily window.
 *
 * Example (18:00 -> 08:00):
 * - now = 20:00 (today) => endAt = 08:00 (tomorrow)
 * - now = 07:00 (today) => endAt = 08:00 (today)
 * - now = 08:05 => null (outside window)
 */
export const getDailyWindowEndAt = (now, startTime, endTime) => {
  const startMinutes = parseHHmmToMinutes(startTime);
  const endMinutes = parseHHmmToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const crossesMidnight = startMinutes > endMinutes;

  const within = crossesMidnight
    ? nowMinutes >= startMinutes || nowMinutes <= endMinutes
    : nowMinutes >= startMinutes && nowMinutes <= endMinutes;

  if (!within) return null;

  if (!crossesMidnight) {
    return dateAtMinutes(now, endMinutes);
  }

  // Cross-midnight:
  // - Evening segment (>= start): end is next day at endMinutes
  // - Morning segment (<= end): end is today at endMinutes
  if (nowMinutes >= startMinutes) {
    const endAt = dateAtMinutes(now, endMinutes);
    endAt.setDate(endAt.getDate() + 1);
    return endAt;
  }

  return dateAtMinutes(now, endMinutes);
};

/**
 * Returns the next start datetime for a daily window.
 *
 * Example (22:00 -> 00:00):
 * - now = 18:00 => startAt = 22:00 today
 * - now = 00:30 => startAt = 22:00 today
 * - now = 23:00 => null because the window is already active
 */
export const getDailyWindowStartAt = (now, startTime, endTime) => {
  const startMinutes = parseHHmmToMinutes(startTime);
  const endMinutes = parseHHmmToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return null;

  if (isWithinDailyWindow(now, startTime, endTime)) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startAt = dateAtMinutes(now, startMinutes);
  if (nowMinutes > startMinutes && startMinutes <= endMinutes) {
    startAt.setDate(startAt.getDate() + 1);
  }
  return startAt;
};

// Convenience for fixed Flash Sale window 18:00 -> 08:00
export const getFlashSaleEndAt = (now) => getDailyWindowEndAt(now, "18:00", "08:00");

