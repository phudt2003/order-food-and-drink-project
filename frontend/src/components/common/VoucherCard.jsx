import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Gift, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import axios from "axios";
import { formatVND } from "../../utils/currency";
import { getVoucherState } from "../../utils/voucher";
import { getDailyWindowEndAt, getDailyWindowStartAt } from "../../utils/flashSaleTime";
import { StoreContext } from "../../context/StoreContext";
import { useCart } from "../../context/CartContext";

// Helpers
const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pad2 = (n) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

const formatDate = (date) => {
  if (!(date instanceof Date)) return "";
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const buildDiscountText = (voucher) => {
  const discountType = String(voucher?.discountType || "amount").toLowerCase();
  const discountValue = toNumber(voucher?.discountValue, 0);
  const voucherType = String(voucher?.voucherType || "").toUpperCase();

  const typePrefix = voucherType === "SHIPPING" ? "Giảm phí ship" : "Giảm";

  if (discountType === "percent") return `${typePrefix} ${Math.round(discountValue)}%`;
  if (discountValue <= 0) return typePrefix;
  return `${typePrefix} ${formatVND(discountValue)}`;
};

const buildConditionText = (voucher) => {
  const minOrderValue = toNumber(voucher?.minOrderValue, 0);
  const applyFor = String(voucher?.applyFor || "all").toLowerCase();
  const productCount = Array.isArray(voucher?.productIds) ? voucher.productIds.length : 0;

  const parts = [];
  if (minOrderValue > 0) parts.push(`Đơn tối thiểu ${formatVND(minOrderValue)}`);

  if (applyFor === "all") parts.push("Áp dụng: Tất cả");
  else if (applyFor === "category") parts.push("Áp dụng: Danh mục");
  else if (applyFor === "product") parts.push(productCount > 0 ? `Áp dụng: ${productCount} sản phẩm` : "Áp dụng: Sản phẩm");

  return parts.join(" • ");
};

export default function VoucherCard({
  voucher,
  currentUserId,
  mode = "default",
  className = "",
  showCountdown = false,
}) {
  const navigate = useNavigate();
  const store = useContext(StoreContext);
  const { cart } = useCart();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [isUsing, setIsUsing] = useState(false);

  const name = String(voucher?.voucherName || "Voucher").trim();

  const state = useMemo(
    () => getVoucherState(voucher, currentUserId),
    [voucher, currentUserId, showCountdown ? nowTick : null]
  );
  const discountText = useMemo(() => buildDiscountText(voucher), [voucher]);
  const conditionText = useMemo(() => buildConditionText(voucher), [voucher]);

  const remainingUses = useMemo(() => {
    if (state.perUserLimit <= 0) return null;
    return Math.max(0, state.perUserLimit - state.perUserUsed);
  }, [state.perUserLimit, state.perUserUsed]);

  useEffect(() => {
    if (!showCountdown) return undefined;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [showCountdown]);

  const countdownEndsAt = useMemo(() => {
    if (!showCountdown) return null;
    const now = new Date(nowTick);
    if (state.hasTimeWindow && state.startTime && state.endTime) {
      return state.isOutsideTimeWindow
        ? getDailyWindowStartAt(now, state.startTime, state.endTime)
        : getDailyWindowEndAt(now, state.startTime, state.endTime);
    }
    return state.endDate || null;
  }, [showCountdown, nowTick, state.hasTimeWindow, state.startTime, state.endTime, state.isOutsideTimeWindow, state.endDate]);

  const countdownText = useMemo(() => {
    if (!showCountdown || !countdownEndsAt) return "";
    const ms = countdownEndsAt.getTime() - nowTick;
    if (ms <= 0) return "";
    return formatCountdown(ms);
  }, [nowTick, showCountdown, countdownEndsAt]);

  // Auto-hide Flash Sale only when the date range has not started or has expired.
  if (showCountdown && state.isExpired) return null;
  if (showCountdown && state.isNotStarted) return null;
  if (showCountdown && state.hasTimeWindow && !countdownText) return null;

  const badge = useMemo(() => {
    if (state.isAvailable) return { text: "Còn hiệu lực", cls: "bg-amber-500 text-white" };
    if (state.isExpired) return { text: "Đã hết hạn", cls: "bg-black/10 text-[var(--text)]" };
    if (state.isNotStarted || state.isOutsideTimeWindow) return { text: "Chưa đến thời gian sử dụng", cls: "bg-sky-500 text-white" };
    if (state.isInactive) return { text: "Tạm ngưng", cls: "bg-black/10 text-[var(--text)]" };
    return { text: "Đã dùng", cls: "bg-black/10 text-[var(--text)]" };
  }, [state.isAvailable, state.isExpired, state.isInactive, state.isNotStarted, state.isOutsideTimeWindow]);

  // Gọi API voucher (ưu tiên dùng function trong StoreContext nếu có, fallback sang axios trực tiếp).
  const postVoucherApi = async (endpoint, payload) => {
    const base = String(store?.url || "").trim();
    const token = String(store?.token || "").trim();
    if (!base) throw new Error("Thiếu cấu hình API.");
    if (!token) throw new Error("Vui lòng đăng nhập để sử dụng voucher.");

    const response = await axios.post(`${base}${endpoint}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response?.data;
  };

  // =========================
  // handleUseNow: UX theo yêu cầu
  // - Luôn claim voucher trước (POST /api/vouchers/claim với { voucherId })
  // - Sau đó kiểm tra giỏ hàng để điều hướng
  // =========================
  const handleUseNow = async () => {
    if (!voucher) {
      store?.pushVoucherToast?.("error", "Voucher không tồn tại.");
      return;
    }

    const voucherId = String(voucher?._id || "").trim();
    if (!voucherId) {
      store?.pushVoucherToast?.("error", "Voucher không hợp lệ.");
      return;
    }

    if (isUsing) return;

    try {
      setIsUsing(true);

      // (1) Luôn claim trước
      const claimRes =
        (await store?.claimVoucher?.({ voucherId })) ||
        (await postVoucherApi("/api/vouchers/claim", { voucherId }));

      if (!claimRes?.success) {
        store?.pushVoucherToast?.("error", claimRes?.message || "Không thể lưu voucher này.");
        return;
      }

      const cartItems = Array.isArray(cart?.items) ? cart.items : [];
      const hasItems = cartItems.length > 0;

      // Lưu intent để hệ thống auto-apply khi user đủ điều kiện.
      // Nếu giỏ đã có món -> silentAutoApply để tránh toast trùng (vì ta đã toast ở bước điều hướng).
      const pendingVoucherId = String(claimRes?.data?.pendingVoucherId || "").trim();
      store?.saveVoucherIntent?.(voucher, "pending", {
        pendingVoucherId,
        silentAutoApply: hasItems,
      });

      // (2) Điều hướng theo trạng thái giỏ
      if (hasItems) {
        navigate("/cart");
        store?.pushVoucherToast?.("success", "Voucher đã được áp dụng! Kiểm tra lại giỏ hàng.");
        return;
      }

      // Route riêng để scroll tới section "Món nổi bật dành cho bạn"
      navigate("/food-display");
      store?.pushVoucherToast?.("success", "Voucher đã lưu sẵn! Hãy chọn món để áp dụng ngay nhé.");
    } catch (error) {
      store?.pushVoucherToast?.(
        "error",
        error?.response?.data?.message || error?.message || "Có lỗi, vui lòng thử lại."
      );
    } finally {
      setIsUsing(false);
    }
  };

  const disabled = !state.isAvailable || isUsing;

  const applyDateText = useMemo(() => {
    const start = state.startDate ? formatDate(state.startDate) : "";
    const end = state.endDate ? formatDate(state.endDate) : "";
    if (!start && !end) return "";
    if (start && end) return `Áp dụng: ${start} - ${end}`;
    return start ? `Ngày bắt đầu: ${start}` : `HSD: ${end}`;
  }, [state.startDate, state.endDate]);

  const timeWindowText = useMemo(() => {
    if (!state.hasTimeWindow || !state.startTime || !state.endTime) return "";
    return `Khung giờ: ${state.startTime} - ${state.endTime}`;
  }, [state.hasTimeWindow, state.startTime, state.endTime]);

  return (
    <article
      className={[
        "relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm",
        mode === "featured"
          ? "ring-1 ring-orange-400/40 shadow-[0_18px_55px_-30px_rgba(245,158,11,0.8)]"
          : "",
        disabled ? "opacity-80" : "",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-700 dark:text-orange-800">
              <Gift className="h-4 w-4" />
              Voucher
            </span>
            <span className={["rounded-full px-3 py-1 text-xs font-semibold", badge.cls].join(" ")}>
              {badge.text}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-extrabold text-[var(--text)] sm:text-lg">{name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <span className="text-orange-700 dark:text-orange-800">{discountText}</span>
          </div>
          {conditionText ? (
            <p className="mt-1 text-xs text-[var(--text)] opacity-75">{conditionText}</p>
          ) : null}
        </div>
        {showCountdown && countdownText && !state.isExpired ? (
          <div className="shrink-0 rounded-2xl border border-orange-200/40 bg-gradient-to-b from-orange-50 to-amber-50 px-3 py-2 text-center dark:border-white/10 dark:from-white/10 dark:to-white/5">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-orange-700 dark:text-orange-200">
              <Clock className="h-3.5 w-3.5" />
              <span>{state.isOutsideTimeWindow ? "Bắt đầu sau" : "Kết thúc sau"}</span>
            </div>
            <div className="mt-1 font-extrabold tracking-wider text-orange-700 dark:text-orange-100">
              {countdownText}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[var(--text)] opacity-75">
          {applyDateText ? <div>{applyDateText}</div> : null}
          {timeWindowText ? <div>{timeWindowText}</div> : null}
          {remainingUses != null ? <div>Còn {remainingUses} lượt</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUseNow}
            disabled={disabled}
            className={[
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold text-white",
              disabled ? "cursor-not-allowed bg-black/20" : "bg-[var(--accent)] hover:opacity-95",
            ].join(" ")}
          >
            {isUsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : disabled ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isUsing
              ? "Đang xử lý..."
              : disabled
                ? state.isExpired
                  ? "Đã hết hạn"
                  : state.isNotStarted || state.isOutsideTimeWindow
                    ? "Chưa đến thời gian sử dụng"
                    : state.isInactive
                      ? "Tạm ngưng"
                      : "Không dùng được"
                : "Sử dụng ngay"}
          </button>
        </div>
      </div>
    </article>
  );
}

