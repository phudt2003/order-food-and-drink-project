import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgePercent, Clock, Flame, ShoppingBag, Ticket, Users } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";

// =========================
// Helpers nhỏ gọn (JS thuần)
// =========================
const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};

const pad2 = (n) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

const formatCountdownParts = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hh: pad2(hours), mm: pad2(minutes), ss: pad2(seconds) };
};

const formatVND = (value) => `${Math.max(0, Math.round(toNumber(value, 0))).toLocaleString("vi-VN")}đ`;

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const formatTimeHHmm = (d) =>
  d
    ? d.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const formatSaleWindowLabel = (startDate, endDate) => {
  if (!startDate || !endDate) return "";
  const now = new Date();
  const timeRange = `${formatTimeHHmm(startDate)} - ${formatTimeHHmm(endDate)}`;
  if (isSameDay(startDate, now)) return `${timeRange} hôm nay`;
  return `${timeRange} ${startDate.toLocaleDateString("vi-VN")}`;
};

const computeSalePrice = ({ price, discountPercent, discountAmount, salePrice }) => {
  const original = Math.max(0, toNumber(price, 0));
  const directSale = toNumber(salePrice, NaN);
  if (Number.isFinite(directSale) && directSale >= 0) {
    const computedPercent = original > 0 ? Math.round((1 - directSale / original) * 100) : 0;
    return { original, sale: directSale, percent: Math.max(0, computedPercent) };
  }

  const p = toNumber(discountPercent, 0);
  const a = toNumber(discountAmount, 0);
  if (p > 0) {
    const sale = Math.max(0, Math.round(original * (1 - p / 100)));
    return { original, sale, percent: Math.min(95, Math.max(1, Math.round(p))) };
  }
  if (a > 0) {
    const sale = Math.max(0, Math.round(original - a));
    const percent = original > 0 ? Math.round(((original - sale) / original) * 100) : 0;
    return { original, sale, percent: Math.min(95, Math.max(0, percent)) };
  }
  return { original, sale: original, percent: 0 };
};

/**
 * FlashSaleSection (React + Tailwind)
 *
 * - Nhận dữ liệu qua props `activeFlashSale` hoặc lấy từ StoreContext (store.activeFlashSale)
 * - Countdown timer thực tế (đếm theo giây)
 * - Khi hết giờ: hiển thị thông báo và ẩn/disable sản phẩm
 */
export default function FlashSaleSection({ activeFlashSale: activeFlashSaleProp, className = "" }) {
  const navigate = useNavigate();
  const store = useContext(StoreContext);

  // Có thể backend/StoreContext đặt sẵn activeFlashSale, nên ưu tiên props nếu truyền vào
  const activeFlashSale = activeFlashSaleProp || store?.activeFlashSale || null;

  const [now, setNow] = useState(() => Date.now());

  // =========================
  // Countdown timer (cập nhật mỗi giây)
  // =========================
  useEffect(() => {
    // Comment: Dùng setInterval để tạo cảm giác "khẩn cấp" đúng nghĩa Flash Sale.
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startDate = useMemo(() => toDate(activeFlashSale?.startTime), [activeFlashSale?.startTime]);
  const endDate = useMemo(() => toDate(activeFlashSale?.endTime), [activeFlashSale?.endTime]);

  const status = useMemo(() => {
    // Comment: Xác định trạng thái theo thời gian (sắp bắt đầu / đang diễn ra / đã kết thúc).
    const t = now;
    const startMs = startDate?.getTime?.() ?? null;
    const endMs = endDate?.getTime?.() ?? null;

    if (endMs != null && t >= endMs) return "ended";
    if (startMs != null && t < startMs) return "upcoming";
    // Không có startTime thì xem như đang active (nếu có endTime và chưa hết)
    return "active";
  }, [endDate, now, startDate]);

  const timeLeftMs = useMemo(() => {
    // Comment: Upcoming -> đếm tới lúc bắt đầu. Active -> đếm tới lúc kết thúc.
    if (status === "upcoming" && startDate) return Math.max(0, startDate.getTime() - now);
    if (status === "active" && endDate) return Math.max(0, endDate.getTime() - now);
    return 0;
  }, [endDate, now, startDate, status]);

  const countdown = useMemo(() => formatCountdownParts(timeLeftMs), [timeLeftMs]);

  const title = String(activeFlashSale?.title || "").trim();
  const discountPercent = toNumber(activeFlashSale?.discountPercent, 0);
  const discountAmount = toNumber(activeFlashSale?.discountAmount, 0);

  const maxUsagePerUser = toNumber(activeFlashSale?.maxUsagePerUser, 0);
  const totalLimit = toNumber(activeFlashSale?.totalLimit, 0);
  const usedCount = toNumber(activeFlashSale?.usedCount, 0);
  const hasTotalLimit = totalLimit > 0;
  const remaining = hasTotalLimit ? Math.max(0, totalLimit - usedCount) : 0;

  const products = Array.isArray(activeFlashSale?.products) ? activeFlashSale.products : [];

  const saleWindowLabel = useMemo(() => formatSaleWindowLabel(startDate, endDate), [endDate, startDate]);

  const limitText = useMemo(() => {
    // Comment: Hiển thị "Tổng suất" theo format dễ đọc cho user.
    const parts = [];

    if (totalLimit > 0 && usedCount >= 0) {
      parts.push(`Tổng suất: ${Math.min(usedCount, totalLimit)} / ${totalLimit}`);
    } else if (totalLimit > 0) {
      parts.push(`Tổng suất: ${totalLimit}`);
    }

    if (totalLimit > 0) {
      parts.push(remaining > 0 ? `Còn ${remaining} suất` : "Đã hết suất");
    }

    if (maxUsagePerUser > 0) {
      parts.push(`Mỗi khách tối đa ${maxUsagePerUser} lần`);
    }

    if (saleWindowLabel) {
      parts.push(saleWindowLabel);
    }

    return parts.filter(Boolean).join(" • ");
  }, [maxUsagePerUser, remaining, saleWindowLabel, totalLimit, usedCount]);

  const discountLabel = useMemo(() => {
    if (discountPercent > 0) return `Giảm đến ${Math.round(discountPercent)}%`;
    if (discountAmount > 0) return `Giảm ${formatVND(discountAmount)}`;
    return "Đang giảm mạnh";
  }, [discountAmount, discountPercent]);

  const countdownLabel = useMemo(() => {
    if (status === "ended") return "Flash Sale đã kết thúc";
    if (status === "upcoming") return "Bắt đầu sau:";
    return "Kết thúc sau:";
  }, [status]);

  // Comment: Nếu không có totalLimit => xem như không giới hạn suất (vẫn cho đặt khi đang active).
  const canInteractProducts = status === "active" && (!hasTotalLimit || remaining > 0);

  const progressPercent = useMemo(() => {
    if (totalLimit <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, usedCount / Math.max(1, totalLimit)));
    return Math.round(ratio * 100);
  }, [totalLimit, usedCount]);

  // Không có dữ liệu thì tự ẩn section để Home.jsx render an toàn
  if (!activeFlashSale || (!products.length && status !== "ended" && status !== "upcoming")) return null;

  return (
    <section className={["mx-auto w-full max-w-6xl px-4 pt-4", className].join(" ")}>
      <div className="relative overflow-hidden rounded-3xl border border-red-200/30 bg-gradient-to-br from-red-600/25 via-orange-500/15 to-amber-400/10 shadow-[0_20px_60px_-25px_rgba(239,68,68,0.55)]">
        {/* Glow nền tạo cảm giác sang + khẩn cấp */}
        <div className="pointer-events-none absolute -top-24 right-[-90px] h-72 w-72 rounded-full bg-orange-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-90px] h-72 w-72 rounded-full bg-red-500/25 blur-3xl" />

        <div className="relative p-4 sm:p-6">
          {/* =========================
              Header Flash Sale
              ========================= */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white shadow">
                  <Flame className="h-4 w-4" />
                  Flash Sale
                </span>
                <h2 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
                  🔥 Flash Sale - Đang giảm mạnh
                </h2>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/90">
                <Ticket className="h-4 w-4 opacity-90" />
                <span className="truncate">
                  {discountLabel}
                  {title ? ` - ${title}` : ""}
                </span>
              </div>

              {/* Thông tin giới hạn: tổng suất, mỗi user, thời gian sale */}
              {limitText ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
                  <Users className="h-4 w-4 opacity-90" />
                  <span>{limitText}</span>
                </div>
              ) : null}

              {/* Thanh tiến độ tổng suất (tạo cảm giác sắp hết) */}
              {hasTotalLimit ? (
                <div className="mt-3 max-w-xl">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/75">
                    <span>Đã dùng {Math.min(usedCount, totalLimit)} suất</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400"
                      style={{ width: `${progressPercent}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* Countdown box */}
            <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                <Clock className="h-4 w-4" />
                <span>{countdownLabel}</span>
              </div>

              {status !== "ended" ? (
                <div className="mt-2 flex items-center gap-2">
                  {/* Comment: Tách HH : MM : SS thành các hộp để nổi bật và dễ đọc */}
                  <div className="flex items-center gap-2">
                    <div className="min-w-[56px] rounded-xl bg-gradient-to-b from-red-600 to-orange-500 px-3 py-2 text-center text-xl font-extrabold text-white shadow">
                      {countdown.hh}
                    </div>
                    <div className="text-lg font-extrabold text-white/90">:</div>
                    <div className="min-w-[56px] rounded-xl bg-gradient-to-b from-red-600 to-orange-500 px-3 py-2 text-center text-xl font-extrabold text-white shadow">
                      {countdown.mm}
                    </div>
                    <div className="text-lg font-extrabold text-white/90">:</div>
                    <div className="min-w-[56px] rounded-xl bg-gradient-to-b from-red-600 to-orange-500 px-3 py-2 text-center text-xl font-extrabold text-white shadow">
                      {countdown.ss}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm font-extrabold text-white">Flash Sale đã kết thúc</div>
              )}

              {saleWindowLabel ? (
                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-white/75">
                  <BadgePercent className="h-4 w-4 opacity-90" />
                  <span>Khung giờ: {saleWindowLabel}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* =========================
              Nội dung sản phẩm
              ========================= */}
          {status === "ended" ? (
            <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4 text-white/90 backdrop-blur">
              <div className="text-base font-extrabold">Flash Sale đã kết thúc</div>
              <div className="mt-1 text-sm text-white/80">Hẹn bạn ở khung giờ tiếp theo. Xem menu để chọn món ngon nhé!</div>
              <button
                type="button"
                onClick={() => navigate("/menu")}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-red-600 shadow active:scale-[0.98] md:hover:bg-orange-50"
              >
                <ShoppingBag className="h-5 w-5" />
                Xem menu
              </button>
            </div>
          ) : (
            <div className="mt-6">
              {status === "upcoming" ? (
                <div className="mb-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white/85 backdrop-blur">
                  Flash Sale sắp bắt đầu. Bạn có thể xem trước sản phẩm, nhưng sẽ chỉ đặt được khi đến giờ.
                </div>
              ) : null}

              {/* Grid responsive: 2 cột mobile, 3-4 cột desktop */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => {
                  const product = p || {};
                  const id = String(product?._id || product?.id || "");
                  const name = String(product?.name || "");
                  const image = String(product?.image || "");
                  const price = toNumber(product?.price, 0);
                  const explicitSalePrice =
                    product?.flashSalePrice != null
                      ? toNumber(product.flashSalePrice, NaN)
                      : product?.salePrice != null
                        ? toNumber(product.salePrice, NaN)
                        : NaN;

                  const { original, sale, percent } = computeSalePrice({
                    price,
                    salePrice: explicitSalePrice,
                    discountPercent,
                    discountAmount,
                  });

                  const disabled = !canInteractProducts || !id;

                  return (
                    <article
                      key={id || name}
                      className={[
                        "group relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-sm backdrop-blur",
                        "transition duration-200 md:hover:-translate-y-0.5 md:hover:bg-white/15",
                        disabled ? "opacity-70" : "",
                      ].join(" ")}
                    >
                      {/* Badge giảm % góc trên bên phải */}
                      {percent > 0 ? (
                        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white shadow">
                          -{percent}%
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => (id ? navigate(`/product/${id}`) : null)}
                        disabled={!id}
                        className="block w-full text-left"
                        aria-label={name ? `Xem sản phẩm ${name}` : "Xem sản phẩm"}
                      >
                        <div className="relative aspect-square w-full overflow-hidden">
                          <img
                            src={image}
                            alt={name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 md:group-hover:scale-110"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
                        </div>
                      </button>

                      <div className="p-3 sm:p-4">
                        <div className="min-h-[44px] text-sm font-extrabold leading-snug text-white sm:text-base">
                          {name}
                        </div>

                        {/* Comment: Dòng nhỏ "Còn X suất" để tạo cảm giác khan hiếm (nếu có totalLimit). */}
                        {hasTotalLimit ? (
                          <div className="mt-1 text-xs font-semibold text-white/75">
                            {remaining > 0 ? `Còn ${remaining} suất` : "Đã hết suất"}
                          </div>
                        ) : null}

                        {/* Giá: sale (đỏ đậm) + giá gốc (gạch ngang) */}
                        <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
                          <div className="text-base font-extrabold text-red-100 sm:text-lg">{formatVND(sale)}</div>
                          {original > sale ? (
                            <div className="text-xs font-semibold text-white/60 line-through">{formatVND(original)}</div>
                          ) : null}
                        </div>

                        {/* CTA: Add to cart (disable khi chưa tới giờ / hết giờ / hết suất) */}
                        <button
                          type="button"
                          disabled={disabled || !store?.addToCart}
                          onClick={async () => {
                            if (disabled) return;
                            // Comment: Dùng StoreContext.addToCart để tích hợp nhanh với giỏ hàng hiện tại.
                            if (store?.addToCart) {
                              await store.addToCart({ itemId: id });
                            }
                          }}
                          className={[
                            "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white shadow",
                            disabled
                              ? "cursor-not-allowed bg-white/10"
                              : "bg-gradient-to-r from-red-600 to-orange-500 md:hover:from-red-500 md:hover:to-orange-400",
                            "active:scale-[0.98] transition",
                          ].join(" ")}
                        >
                          <ShoppingBag className="h-5 w-5" />
                          {status === "upcoming"
                            ? "Chờ tới giờ"
                            : hasTotalLimit && remaining === 0
                              ? "Hết suất"
                              : "Thêm vào giỏ"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
