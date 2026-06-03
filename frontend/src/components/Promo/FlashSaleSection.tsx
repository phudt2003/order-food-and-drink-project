import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, ShoppingBag, Timer } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";

type FlashSaleProduct = {
  _id: string;
  name: string;
  image: string;
  price: number;
  // Optional fields (nếu API có sẵn)
  salePrice?: number;
  flashSalePrice?: number;
};

type FlashSaleResponse = {
  products: FlashSaleProduct[];
  startAt?: string;
  endAt?: string;
  discountPercent?: number;
  voucher?: {
    startDate?: string;
    endDate?: string;
    discountType?: string;
    discountValue?: number;
  };
};

const safeNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
};

const formatPriceVND = (value: number) =>
  `${Math.max(0, Math.round(value)).toLocaleString("vi-VN")}đ`;

const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

const normalizeFlashSaleResponse = (raw: any): FlashSaleResponse => {
  const root = raw?.data ?? raw ?? {};
  // Hỗ trợ nhiều shape response
  const products =
    (Array.isArray(root) ? root : null) ??
    (Array.isArray(root?.products) ? root.products : null) ??
    (Array.isArray(root?.items) ? root.items : null) ??
    (Array.isArray(root?.data) ? root.data : null) ??
    [];

  const voucher = root?.voucher ?? root?.flashVoucher ?? null;

  const startAt =
    root?.startAt ??
    root?.startsAt ??
    root?.startDate ??
    voucher?.startDate ??
    undefined;
  const endAt =
    root?.endAt ??
    root?.endsAt ??
    root?.endDate ??
    voucher?.endDate ??
    undefined;

  const discountPercent =
    root?.discountPercent ??
    (String(voucher?.discountType || "").toLowerCase() === "percent" ? voucher?.discountValue : undefined);

  return {
    products: (products || []).map((p: any) => ({
      _id: String(p?._id || p?.id || ""),
      name: String(p?.name || ""),
      image: String(p?.image || ""),
      price: safeNumber(p?.price, 0),
      salePrice: p?.salePrice != null ? safeNumber(p.salePrice, 0) : undefined,
      flashSalePrice: p?.flashSalePrice != null ? safeNumber(p.flashSalePrice, 0) : undefined,
    })).filter((p: any) => Boolean(p?._id)),
    startAt,
    endAt,
    discountPercent: discountPercent != null ? safeNumber(discountPercent, 0) : undefined,
    voucher: voucher
      ? {
          startDate: voucher?.startDate,
          endDate: voucher?.endDate,
          discountType: voucher?.discountType,
          discountValue: voucher?.discountValue,
        }
      : undefined,
  };
};

export default function FlashSaleSection({
  endpoint = "/api/products/flash-sale",
  pollMs = 60_000,
}: {
  // Giữ nguyên logic hiện tại: fetch `/api/products/flash-sale`
  endpoint?: string;
  // Poll nhẹ để tự cập nhật khi flash sale bắt đầu/kết thúc
  pollMs?: number;
}) {
  const navigate = useNavigate();
  const store = useContext(StoreContext) as any;
  const url = String(store?.url || "").trim();
  const addToCart = store?.addToCart as ((payload: any) => Promise<void>) | undefined;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FlashSaleResponse>({ products: [] });
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startDate = useMemo(() => parseDate(data?.startAt || data?.voucher?.startDate), [data]);
  const endDate = useMemo(() => parseDate(data?.endAt || data?.voucher?.endDate), [data]);

  const remainingMs = useMemo(() => {
    if (!endDate) return 0;
    return Math.max(0, endDate.getTime() - now);
  }, [endDate, now]);

  const isUrgent = remainingMs > 0 && remainingMs <= 5 * 60 * 1000;

  const progress = useMemo(() => {
    if (!startDate || !endDate) return null;
    const total = Math.max(1, endDate.getTime() - startDate.getTime());
    const passed = Math.max(0, Math.min(total, now - startDate.getTime()));
    return Math.max(0, Math.min(1, passed / total));
  }, [endDate, now, startDate]);

  const discountPercent = useMemo(() => {
    const p = safeNumber(data?.discountPercent, 0);
    if (p > 0) return Math.min(95, Math.round(p));
    const voucherPercent =
      String(data?.voucher?.discountType || "").toLowerCase() === "percent"
        ? safeNumber(data?.voucher?.discountValue, 0)
        : 0;
    if (voucherPercent > 0) return Math.min(95, Math.round(voucherPercent));
    return 0;
  }, [data]);

  const fetchFlashSale = async () => {
    if (!url) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const res = await fetch(`${url}${endpoint}`, { signal: controller.signal });
      if (!res.ok) {
        setData({ products: [] });
        return;
      }
      const json = await res.json();
      setData(normalizeFlashSaleResponse(json));
    } catch {
      // Nếu API lỗi, section sẽ tự ẩn (products = [])
      setData({ products: [] });
    } finally {
      setLoading(false);
    }
  };

  // Fetch khi mount + polling nhẹ
  useEffect(() => {
    if (!url) return;
    fetchFlashSale();

    const timer = window.setInterval(fetchFlashSale, Math.max(15_000, pollMs));
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, endpoint, pollMs]);

  // Tick countdown
  useEffect(() => {
    if (!data?.products?.length) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [data?.products?.length]);

  // Fade-in UI
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  // Ẩn section khi hết giờ (backend có thể trả rỗng, nhưng mình cũng tự “soft hide”)
  const isExpired = Boolean(endDate && remainingMs <= 0);
  const products = Array.isArray(data?.products) ? data.products : [];

  // Giữ yêu cầu: ẩn section khi không có sản phẩm
  if (!loading && (products.length === 0 || isExpired)) return null;

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-600 via-orange-500 to-red-700 shadow-2xl">
        {/* Nền glow (thuần Tailwind) */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.12),transparent_50%)]" />

        <div className="relative p-5 sm:p-7 md:p-10">
          {/* Header */}
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold tracking-wide text-red-600 shadow-lg motion-reduce:animate-none animate-pulse">
                <Flame className="h-4 w-4" />
                FLASH SALE
              </div>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-6xl">
                <span className="block">CHỈ TRONG KHUNG GIỜ NÀY!</span>
                <span className="mt-2 block text-orange-100/90">
                  Mua ngay trước khi ưu đãi biến mất
                </span>
              </h2>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-orange-100/90">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
                  <Timer className="h-4 w-4" />
                  Còn lại
                </span>
                {startDate && endDate ? (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
                    Khung giờ:{" "}
                    <span className="font-semibold text-white/95">
                      {startDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} -{" "}
                      {endDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            {/* Countdown */}
            <div className="w-full md:w-auto">
              <div className="rounded-3xl border border-white/25 bg-white/15 px-5 py-4 text-center shadow-xl backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-100/90">
                  Countdown
                </div>
                <div
                  className={[
                    "mt-2 font-mono text-4xl font-extrabold tracking-widest text-white sm:text-5xl md:text-6xl",
                    isUrgent ? "text-red-200 motion-reduce:animate-none animate-pulse" : "",
                  ].join(" ")}
                >
                  {formatCountdown(remainingMs)}
                </div>

                {/* Progress bar */}
                {progress != null ? (
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-200 to-white"
                      style={{ width: `${Math.max(0, Math.min(100, (1 - progress) * 100))}%` }}
                    />
                  </div>
                ) : null}

                <div className="mt-3 text-xs text-orange-100/80">
                  Sản phẩm sẽ biến mất sau khi hết giờ.
                </div>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="mt-7">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-[320px] rounded-3xl bg-white/10 p-3 shadow-lg backdrop-blur"
                  >
                    <div className="h-44 w-full rounded-2xl bg-white/10" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-white/10" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-white/10" />
                    <div className="mt-4 h-12 w-full rounded-2xl bg-white/10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {products.map((product, index) => {
                  const original = safeNumber(product.price, 0);
                  const computedSale =
                    product.flashSalePrice ??
                    product.salePrice ??
                    (discountPercent > 0 ? Math.round(original * (1 - discountPercent / 100)) : original);
                  const sale = Math.max(0, computedSale);
                  const percent = discountPercent > 0 && original > 0
                    ? Math.max(1, Math.min(95, Math.round((1 - sale / original) * 100)))
                    : 0;

                  return (
                    <article
                      key={product._id}
                      className={[
                        "group relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-2xl backdrop-blur transition-all duration-300",
                        "active:scale-[0.99] md:hover:scale-[1.03] md:hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]",
                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                      ].join(" ")}
                      style={{
                        transitionDelay: `${Math.min(420, index * 55)}ms`,
                      }}
                    >
                      {/* Badge giảm giá */}
                      {percent > 0 ? (
                        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white shadow-lg motion-reduce:animate-none animate-pulse">
                          -{percent}%
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => navigate(`/product/${product._id}`)}
                        className="block w-full text-left"
                        aria-label={`Xem sản phẩm ${product.name}`}
                      >
                        <div className="relative aspect-square w-full overflow-hidden">
                          {/* Image */}
                          <img
                            src={product.image}
                            alt={product.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 md:group-hover:scale-110"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
                        </div>
                      </button>

                      <div className="p-3 sm:p-4">
                        {/* Tên */}
                        <div className="min-h-[44px] overflow-hidden text-base font-semibold leading-snug text-white sm:text-lg">
                          {product.name}
                        </div>

                        {/* Giá */}
                        <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
                          <div className="text-xl font-extrabold text-white sm:text-2xl">
                            {formatPriceVND(sale)}
                          </div>
                          {original > sale ? (
                            <div className="text-xs font-semibold text-white/60 line-through">
                              {formatPriceVND(original)}
                            </div>
                          ) : null}
                        </div>

                        {/* CTA */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (addToCart) {
                              await addToCart({ itemId: product._id });
                            }
                          }}
                          className={[
                            "mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl",
                            "bg-gradient-to-r from-red-600 to-orange-500 px-4 py-4 text-sm font-extrabold text-white shadow-xl",
                            "focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-0",
                            "active:scale-[0.98] md:hover:from-red-500 md:hover:to-orange-400",
                            "motion-reduce:transition-none transition-all duration-200",
                          ].join(" ")}
                        >
                          <ShoppingBag className="h-5 w-5" />
                          Thêm vào giỏ ngay
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-orange-100/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.8)]" />
              <span className="font-semibold">Tip:</span> Vào giỏ hàng để áp dụng voucher khung giờ (Flash Sale).
            </div>
            <button
              type="button"
              onClick={() => navigate("/cart")}
              className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-red-600 shadow-lg active:scale-[0.98] md:hover:bg-orange-50"
            >
              Đến giỏ hàng
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
