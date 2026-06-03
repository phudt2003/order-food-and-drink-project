import React, { useEffect, useMemo, useState } from "react";
import ReviewItem from "./ReviewItem";
import {
  claimReviewReward,
  createProductReview,
  getReviewableProducts,
  updateProductReview,
} from "../../api/reviewApi";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveApiErrorMessage = (err, fallback) => {
  if (err?.response?.status === 409) return "Bạn đã đánh giá sản phẩm này rồi";
  return err?.response?.data?.message || err?.message || fallback;
};

const getClerkAvatar = () => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return "";
  try {
    const raw = localStorage.getItem("clerk_user_session");
    if (!raw) return "";
    const data = JSON.parse(raw);
    return String(data?.imageUrl || "").trim();
  } catch (err) {
    return "";
  }
};

const ReviewList = ({ apiBase, token, orderId, onChanged, onRewardClaimed, onReviewUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const products = Array.isArray(data?.products) ? data.products : [];
  const rewardCoins = toNumber(data?.rewardCoins, 10);

  const summary = useMemo(() => {
    const totalProducts = toNumber(data?.totalProducts, products.length);
    const reviewedCount = toNumber(data?.reviewedCount, 0);
    const pendingRewards = toNumber(data?.pendingRewards, 0);
    return { totalProducts, reviewedCount, pendingRewards };
  }, [data?.pendingRewards, data?.reviewedCount, data?.totalProducts, products.length]);

  useEffect(() => {
    if (!apiBase || !token || !orderId) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getReviewableProducts({ url: apiBase, token, orderId });
        if (cancelled) return;

        if (response?.data?.success) {
          setData(response.data.data || null);
          return;
        }

        setData(null);
        setError(response?.data?.message || "Không thể tải danh sách đánh giá.");
      } catch (err) {
        if (cancelled) return;
        setData(null);
        setError(err?.response?.data?.message || err?.message || "Không thể tải danh sách đánh giá.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [apiBase, token, orderId]);

  const handleSubmitReview = async ({ productId, rating, comment }) => {
    if (!apiBase || !token) throw new Error("Bạn cần đăng nhập để đánh giá.");
    if (!orderId) throw new Error("Thiếu mã đơn hàng.");
    if (!productId) throw new Error("Thiếu mã sản phẩm.");

    const payload = {
      orderId,
      productId,
      rating,
      comment,
      userAvatar: getClerkAvatar(),
    };    let response;
    try {
      response = await createProductReview({ url: apiBase, token, payload });
    } catch (err) {
      const apiMessage = resolveApiErrorMessage(err, "Kh?ng th? g?i ??nh gi?.");
      const alreadyReviewed = err?.response?.data?.alreadyReviewed;
      const existingReview = err?.response?.data?.review || null;

      if (err?.response?.status === 409 || alreadyReviewed) {
        if (existingReview) {
          setData((prev) => {
            if (!prev) return prev;
            const nextProducts = (Array.isArray(prev.products) ? prev.products : []).map((item) => {
              if (String(item?.productId) !== String(productId)) return item;
              return {
                ...item,
                reviewed: true,
                review: existingReview,
              };
            });
            const reviewedCount = nextProducts.filter((p) => p.reviewed).length;
            const pendingRewards = nextProducts.filter((p) => p.review && !p.review.isRewardClaimed).length;
            return { ...prev, products: nextProducts, reviewedCount, pendingRewards, totalProducts: nextProducts.length };
          });
        } else {
          try {
            const refresh = await getReviewableProducts({ url: apiBase, token, orderId });
            if (refresh?.data?.success) {
              setData(refresh.data.data || null);
            }
          } catch {
            // ignore refresh failure
          }
        }
      }

      throw new Error(apiMessage);
    }
if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Không thể gửi đánh giá.");
    }

    const created = response.data.data || null;
    const reward = response.data.reward || null;
    const coinBalance = toNumber(response.data.coinBalance ?? response.data.xuBalance, NaN);
    if (Number.isFinite(coinBalance)) {
      onRewardClaimed?.({ coinBalance });
    }

    setData((prev) => {
      if (!prev) return prev;
      const nextProducts = (Array.isArray(prev.products) ? prev.products : []).map((item) => {
        if (String(item?.productId) !== String(productId)) return item;
        const claimed = Boolean(reward?.claimed ?? created?.isRewardClaimed ?? false);
        const canClaim = Boolean(reward?.canClaim ?? (!claimed && created?._id));
        return {
          ...item,
          reviewed: true,
          reward: { coins: rewardCoins, claimed, canClaim },
          review: created
            ? {
                _id: String(created._id || ""),
                rating: toNumber(created.rating, rating),
                comment: String(created.comment || comment || ""),
                status: String(created.status || "pending"),
                createdAt: created.createdAt || null,
                isRewardClaimed: claimed,
                rewardClaimedAt:
                  created.rewardClaimedAt || (claimed ? new Date().toISOString() : null),
              }
            : item.review,
        };
      });

      const reviewedCount = nextProducts.filter((p) => p.reviewed).length;
      const pendingRewards = nextProducts.filter((p) => p.review && !p.review.isRewardClaimed).length;
      return { ...prev, products: nextProducts, reviewedCount, pendingRewards, totalProducts: nextProducts.length };
    });

    onChanged?.();
  };

  const handleClaimReward = async (reviewId) => {
    if (!apiBase || !token) throw new Error("Bạn cần đăng nhập để nhận thưởng.");
    if (!reviewId) throw new Error("Thiếu mã đánh giá.");

    let response;
    try {
      response = await claimReviewReward({ url: apiBase, token, reviewId });
    } catch (err) {
      throw new Error(resolveApiErrorMessage(err, "KhÃ´ng thá»ƒ nháº­n thÆ°á»Ÿng."));
    }
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Không thể nhận thưởng.");
    }

    const updatedReview = response.data.review || null;
    const coinBalance = toNumber(response.data.coinBalance, 0);

    setData((prev) => {
      if (!prev) return prev;

      const nextProducts = (Array.isArray(prev.products) ? prev.products : []).map((item) => {
        if (String(item?.review?._id) !== String(reviewId)) return item;
        return {
          ...item,
          reward: { coins: rewardCoins, claimed: true, canClaim: false },
          review: {
            ...item.review,
            ...(updatedReview || {}),
            isRewardClaimed: true,
            rewardClaimedAt: updatedReview?.rewardClaimedAt || new Date().toISOString(),
          },
        };
      });

      const reviewedCount = nextProducts.filter((p) => p.reviewed).length;
      const pendingRewards = nextProducts.filter((p) => p.review && !p.review.isRewardClaimed).length;
      return { ...prev, products: nextProducts, reviewedCount, pendingRewards, totalProducts: nextProducts.length };
    });

    onRewardClaimed?.({ coinBalance });
    onChanged?.();
  };

  const handleUpdateReview = async ({ reviewId, rating, comment }) => {
    if (!apiBase || !token) throw new Error("Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ Ä‘Ã¡nh giÃ¡.");
    if (!reviewId) throw new Error("Thiáº¿u mÃ£ Ä‘Ã¡nh giÃ¡.");

    let response;
    try {
      response = await updateProductReview({
        url: apiBase,
        token,
        reviewId,
        payload: { rating, comment },
      });
    } catch (err) {
      throw new Error(resolveApiErrorMessage(err, "KhÃ´ng thá»ƒ cáº­p nháº­t Ä‘Ã¡nh giÃ¡."));
    }

    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "KhÃ´ng thá»ƒ cáº­p nháº­t Ä‘Ã¡nh giÃ¡.");
    }

    const updated = response.data.data || null;
    if (!updated) return;

    setData((prev) => {
      if (!prev) return prev;
      const nextProducts = (Array.isArray(prev.products) ? prev.products : []).map((item) => {
        if (String(item?.review?._id) !== String(reviewId)) return item;
        return {
          ...item,
          review: {
            ...item.review,
            ...(updated || {}),
          },
        };
      });

      return { ...prev, products: nextProducts };
    });

    onChanged?.();
    onReviewUpdated?.();
  };

  if (!orderId) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-800">Đánh giá đơn hàng</h4>
          <p className="mt-1 text-xs text-slate-500">
            Đã đánh giá <span className="font-semibold">{summary.reviewedCount}</span>/{summary.totalProducts} sản phẩm
          </p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-orange-600 shadow-sm">
          Xu chờ nhận: {summary.pendingRewards * rewardCoins} Xu
        </div>
      </div>

      {loading ? <p className="mt-3 text-sm text-slate-500">Đang tải danh sách đánh giá...</p> : null}
      {!loading && error ? (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-4 space-y-3">
          {products.length === 0 ? (
            <p className="text-sm text-slate-500">Không có sản phẩm để đánh giá.</p>
          ) : (
            products.map((product) => (
              <ReviewItem
                key={product.productId}
                product={product}
                apiBase={apiBase}
                rewardCoins={rewardCoins}
                onSubmitReview={handleSubmitReview}
                onClaimReward={handleClaimReward}
                onUpdateReview={handleUpdateReview}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ReviewList;
