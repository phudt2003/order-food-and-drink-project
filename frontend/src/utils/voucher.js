const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};

const parseTimeToMinutes = (value) => {
  const text = String(value || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(text)) return null;
  const [hRaw, mRaw] = text.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const formatHHmmFromMinutes = (minutes) => {
  if (!Number.isFinite(minutes)) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const normalizeVoucherWindow = (voucher) => {
  // Backend validate voucher theo ngày (00:00-23:59) với đa số campaign,
  // riêng "happy_hour" giữ đúng giờ start/end.
  const campaignType = String(voucher?.campaignType || "").trim().toLowerCase();
  const startDate = toDate(voucher?.startDate);
  const endDate = toDate(voucher?.endDate);
  if (!startDate || !endDate) return { startDate, endDate };

  const explicitStart = parseTimeToMinutes(voucher?.startTime);
  const explicitEnd = parseTimeToMinutes(voucher?.endTime);
  const hasExplicitTimeWindow = explicitStart != null && explicitEnd != null;

  if (campaignType !== "happy_hour" || hasExplicitTimeWindow) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return { startDate: s, endDate: e };
  }

  return { startDate, endDate };
};

export const getUserUsedCount = (voucher, currentUserId) => {
  const usedByUsers = Array.isArray(voucher?.usedByUsers) ? voucher.usedByUsers : [];
  if (currentUserId) {
    const hit = usedByUsers.find((row) => String(row?.userId) === String(currentUserId));
    if (hit) return toNumber(hit?.count, 0);
  }
  // Fallback: nếu không có userId hoặc backend không trả usedByUsers.
  return toNumber(voucher?.usedCount, 0);
};

export const getVoucherState = (voucher, currentUserId) => {
  const now = new Date();
  const status = String(voucher?.status || "active").toLowerCase();
  const { startDate, endDate } = normalizeVoucherWindow(voucher);

  const isNotStarted = startDate ? now.getTime() < startDate.getTime() : false;
  const isExpired = endDate ? now.getTime() > endDate.getTime() : false;

  const explicitStart = parseTimeToMinutes(voucher?.startTime);
  const explicitEnd = parseTimeToMinutes(voucher?.endTime);
  const hasExplicitTimeWindow = explicitStart != null && explicitEnd != null;

  const campaignType = String(voucher?.campaignType || "").trim().toLowerCase();
  const hasLegacyTimeWindow =
    !hasExplicitTimeWindow &&
    campaignType === "happy_hour" &&
    startDate &&
    endDate &&
    Number.isFinite(startDate.getTime()) &&
    Number.isFinite(endDate.getTime()) &&
    (startDate.getHours() !== 0 ||
      startDate.getMinutes() !== 0 ||
      endDate.getHours() !== 23 ||
      endDate.getMinutes() !== 59);

  const startMinutes = hasExplicitTimeWindow
    ? explicitStart
    : hasLegacyTimeWindow
      ? startDate.getHours() * 60 + startDate.getMinutes()
      : null;
  const endMinutes = hasExplicitTimeWindow
    ? explicitEnd
    : hasLegacyTimeWindow
      ? endDate.getHours() * 60 + endDate.getMinutes()
      : null;

  const hasTimeWindow = startMinutes != null && endMinutes != null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const isWithinTimeWindow = !hasTimeWindow
    ? true
    : startMinutes <= endMinutes
      ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
      : nowMinutes >= startMinutes || nowMinutes <= endMinutes;

  const isOutsideTimeWindow = hasTimeWindow ? !isWithinTimeWindow : false;

  const maxUsage = toNumber(voucher?.maxUsage, 0); // tổng lượt (toàn hệ thống)
  const usedCount = toNumber(voucher?.usedCount, 0);
  const isUsedUp = maxUsage > 0 ? usedCount >= maxUsage : false;

  const perUserLimit = toNumber(voucher?.usagePerUser, 1);
  const perUserUsed = getUserUsedCount(voucher, currentUserId);
  const isPerUserUsedUp = perUserLimit > 0 ? perUserUsed >= perUserLimit : false;

  const isInactive = status !== "active";
  const isAvailable =
    !isInactive && !isNotStarted && !isExpired && !isOutsideTimeWindow && !isUsedUp && !isPerUserUsedUp;

  return {
    now,
    startDate,
    endDate,
    isNotStarted,
    isExpired,
    hasTimeWindow,
    startTime: hasTimeWindow ? formatHHmmFromMinutes(startMinutes) : "",
    endTime: hasTimeWindow ? formatHHmmFromMinutes(endMinutes) : "",
    isOutsideTimeWindow,
    isUsedUp,
    isPerUserUsedUp,
    isInactive,
    isAvailable,
    perUserLimit,
    perUserUsed,
  };
};

export const classifyVoucher = (voucher, currentUserId) => {
  const state = getVoucherState(voucher, currentUserId);
  if (state.isExpired) return { bucket: "expired", state };
  if (state.isNotStarted) return { bucket: "upcoming", state };
  if (state.isOutsideTimeWindow) return { bucket: "upcoming", state };
  if (state.isInactive) return { bucket: "inactive", state };
  if (!state.isAvailable) return { bucket: "used", state };
  return { bucket: "available", state };
};

export const isFlashSaleVoucher = (voucher) => {
  const campaignType = String(voucher?.campaignType || "").trim().toLowerCase();
  const issueType = String(voucher?.issueType || "").trim().toLowerCase();
  return campaignType === "happy_hour" || issueType === "flash_sale";
};
