import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Flame, Timer, ShoppingBag } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import { formatVND } from "../../utils/currency";
import { getVoucherState } from "../../utils/voucher";
import { resolveImageSrc } from "../../utils/resolveImage";

const toDate = (value) => {
  if (!value) return null;
  try {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getCategoryId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return String(value?._id || value?.id || "");
  return "";
};

const isVoucherApplicableToProduct = (voucher, product) => {
  const applyFor = String(voucher?.applyFor || "all").trim().toLowerCase();
  if (applyFor === "all") return true;

  if (applyFor === "category") {
    const categoryId = getCategoryId(voucher?.categoryId);
    if (!categoryId) return true;
    return getCategoryId(product?.categoryId) === categoryId;
  }

  if (applyFor === "product") {
    const ids = (Array.isArray(voucher?.productIds) ? voucher.productIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (ids.length === 0) return true;
    const productId = String(product?._id || product?.id || "").trim();
    return productId ? ids.includes(productId) : false;
  }

  return true;
};

const computeDiscountedPrice = ({ original, discountType, discountValue }) => {
  const price = Math.max(0, toNumber(original, 0));
  const type = String(discountType || "").trim().toLowerCase();
  const value = Math.max(0, toNumber(discountValue, 0));

  if (type === "percent" && value > 0) {
    return Math.max(0, Math.round(price * (1 - Math.min(95, value) / 100)));
  }
  if (type === "amount" && value > 0) {
    return Math.max(0, Math.round(price - value));
  }
  return price;
};

const pad2 = (n) => String(Math.max(0, Math.floor(n))).padStart(2, "0");
const formatCountdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

export default function FlashSaleProductsSection({
  category = "All",
  flashVoucher = null,
  maxItems = 6,
  minItems = 1,
  onActiveProductIdsChange,
}) {
  const store = useContext(StoreContext);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const lastIdsKeyRef = useRef("");

  const url = String(store?.url || "").trim();
  const currentUserId = String(store?.userProfile?._id || store?.userProfile?.id || "");

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const voucherState = useMemo(() => {
    if (!flashVoucher) return null;
    return getVoucherState(flashVoucher, currentUserId);
  }, [flashVoucher, currentUserId, nowTick]);

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const voucherAvailable = Boolean(voucherState?.isAvailable);
  const voucherDiscountValue = toNumber(flashVoucher?.discountValue, 0);
  const voucherDiscountType = String(flashVoucher?.discountType || "").trim().toLowerCase();
  const voucherHasDiscount = voucherDiscountValue > 0 && (voucherDiscountType === "percent" || voucherDiscountType === "amount");

  const rawFoodList = Array.isArray(store?.food_list) ? store.food_list : [];

  const items = useMemo(() => {
    const filtered = rawFoodList
      .filter((product) => {
        if (!product?.isFlashSale) return false;
        if (category !== "All" && category !== product?.category) return false;

        const start = toDate(product?.startTime);
        const end = toDate(product?.endTime);
        if (!start || !end) return false;

        return start.getTime() <= now.getTime() && now.getTime() <= end.getTime();
      })
      .map((product) => {
        const original = Math.max(0, Math.round(toNumber(product?.price, 0)));
        const start = toDate(product?.startTime);
        const end = toDate(product?.endTime);

        const productDiscountType = String(product?.flashSaleDiscountType || "").trim().toLowerCase();
        const productDiscountValue = toNumber(product?.flashSaleDiscountValue, 0);
        const productHasDiscount =
          productDiscountValue > 0 && (productDiscountType === "percent" || productDiscountType === "amount");

        const canUseVoucher =
          voucherAvailable &&
          voucherHasDiscount &&
          flashVoucher &&
          isVoucherApplicableToProduct(flashVoucher, product);

        const discountSource = productHasDiscount ? "product" : canUseVoucher ? "voucher" : "none";
        if (discountSource === "none") return null;

        const sale =
          discountSource === "product"
            ? computeDiscountedPrice({
                original,
                discountType: productDiscountType,
                discountValue: productDiscountValue,
              })
            : computeDiscountedPrice({
                original,
                discountType: flashVoucher?.discountType,
                discountValue: flashVoucher?.discountValue,
              });

        const effectiveEnd =
          discountSource === "voucher" && voucherState?.endDate instanceof Date && Number.isFinite(voucherState.endDate.getTime())
            ? new Date(Math.min(end?.getTime?.() ?? Number.MAX_SAFE_INTEGER, voucherState.endDate.getTime()))
            : end;

        return {
          _id: String(product?._id || ""),
          name: String(product?.name || ""),
          image: String(product?.image || ""),
          original,
          sale,
          start,
          end,
          effectiveEnd,
          discountSource,
          productRaw: product,
        };
      })
      .filter(Boolean);

    filtered.sort((a, b) => {
      const aEnd = a?.effectiveEnd?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
      const bEnd = b?.effectiveEnd?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
      return aEnd - bEnd;
    });

    return filtered.slice(0, Math.max(0, maxItems));
  }, [rawFoodList, category, now, flashVoucher, voucherAvailable, voucherHasDiscount, voucherState?.endDate, maxItems]);

  const isActive = items.length >= Math.max(1, minItems);

  const sectionEnd = useMemo(() => {
    if (!isActive) return null;
    const ends = items
      .map((item) => item?.effectiveEnd)
      .filter((d) => d instanceof Date && Number.isFinite(d.getTime()));
    if (!ends.length) return null;
    ends.sort((a, b) => a.getTime() - b.getTime());
    return ends[0];
  }, [isActive, items]);

  const remainingMs = useMemo(() => {
    if (!sectionEnd) return 0;
    return Math.max(0, sectionEnd.getTime() - nowTick);
  }, [sectionEnd, nowTick]);

  useEffect(() => {
    if (typeof onActiveProductIdsChange !== "function") return;
    const ids = isActive ? items.map((item) => item._id) : [];
    const key = ids.join(",");
    if (key === lastIdsKeyRef.current) return;
    lastIdsKeyRef.current = key;
    onActiveProductIdsChange(ids);
  }, [isActive, items, onActiveProductIdsChange]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-6">
      <div
        className={[
          "overflow-hidden transition-all duration-300",
          isActive ? "opacity-100 max-h-[2000px]" : "opacity-0 max-h-0",
        ].join(" ")}
        aria-hidden={!isActive}
      >
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-600/10 px-3 py-1 text-xs font-extrabold text-red-700 dark:text-red-200">
                  <Flame className="h-4 w-4" />
                  Flash Sale
                </span>
                <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-[var(--text)] dark:bg-white/10">
                  FLASH SALE
                </span>
              </div>

              <h3 className="mt-2 text-lg font-semibold">Giảm giá trong thời gian giới hạn</h3>
              <p className="mt-1 text-sm opacity-80">Nhanh tay kẻo lỡ — ưu đãi sẽ tự kết thúc khi hết giờ.</p>
            </div>

            {sectionEnd ? (
              <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] px-4 py-3 text-sm font-extrabold text-[var(--text)]">
                <Timer className="h-4 w-4" />
                <span className="opacity-80">Kết thúc sau</span>
                <span className="tabular-nums">{formatCountdown(remainingMs)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => {
              const imageSrc = resolveImageSrc(item.image, url);
              const showOriginal = item.original > item.sale;
              const percentOff =
                showOriginal && item.original > 0 ? Math.max(0, Math.min(95, Math.round((1 - item.sale / item.original) * 100))) : 0;

              return (
                <article
                  key={item._id}
                  className={[
                    "group relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] shadow-sm",
                    "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
                  ].join(" ")}
                  style={{ transitionDelay: `${Math.min(250, index * 40)}ms` }}
                >
                  <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                    <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-extrabold text-white shadow">
                      FLASH SALE
                    </span>
                    {percentOff > 0 ? (
                      <span className="rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-extrabold text-white">
                        -{percentOff}%
                      </span>
                    ) : null}
                  </div>

                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={imageSrc}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
                  </div>

                  <div className="p-4">
                    <h4 className="line-clamp-2 text-sm font-extrabold text-[var(--text)] sm:text-base">{item.name}</h4>

                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <div className="text-lg font-extrabold text-[var(--accent)]">{formatVND(item.sale)}</div>
                      {showOriginal ? (
                        <div className="text-xs font-semibold text-[var(--text)] opacity-60 line-through">
                          {formatVND(item.original)}
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await store?.addToCart?.({ itemId: item._id });
                      }}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-extrabold text-white transition-opacity hover:opacity-95 active:scale-[0.99]"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      Thêm vào giỏ
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

