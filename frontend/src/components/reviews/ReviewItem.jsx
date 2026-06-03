import React, { useMemo, useState } from "react";
import StarRating from "../StarRating/StarRating";
import RewardButton from "./RewardButton";

const normalizeText = (value) => String(value || "").trim();

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

const resolveImageSrc = (value, baseUrl) => {
  if (!value) return "";
  if (/^data:/i.test(value) || isAbsoluteUrl(value)) return value;
  if (!baseUrl) return value;

  const trimmedBase = String(baseUrl).replace(/\/$/, "");
  const raw = String(value).replace(/^\/+/, "").replace(/\\/g, "/");

  if (raw.startsWith("images/")) return `${trimmedBase}/${raw}`;
  if (raw.startsWith("uploads/")) return `${trimmedBase}/images/${raw.replace(/^uploads\//, "")}`;
  if (!raw.includes("/")) return `${trimmedBase}/images/${raw}`;

  return `${trimmedBase}/${raw}`;
};

const ReviewItem = ({
  product,
  apiBase,
  rewardCoins = 10,
  onSubmitReview,
  onClaimReward,
  onUpdateReview,
}) => {
  const existing = product?.review || null;
  const reviewed = Boolean(existing?._id);
  const claimed = Boolean(existing?.isRewardClaimed);
  const [imageBroken, setImageBroken] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [rating, setRating] = useState(() => Number(existing?.rating || 0));
  const [comment, setComment] = useState(() => normalizeText(existing?.comment || ""));
  const [draftRating, setDraftRating] = useState(() => Number(existing?.rating || 0));
  const [draftComment, setDraftComment] = useState(() => normalizeText(existing?.comment || ""));
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");

  const imageSrc = useMemo(() => resolveImageSrc(product?.image, apiBase), [product?.image, apiBase]);

  const canSubmit = useMemo(() => {
    if (reviewed) return false;
    const r = Number(rating || 0);
    if (r < 1 || r > 5) return false;
    return Boolean(normalizeText(comment));
  }, [comment, rating, reviewed]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmitReview?.({
        productId: product?.productId,
        rating,
        comment,
      });
    } catch (err) {
      setError(err?.message || "Không thể gửi đánh giá. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = () => {
    setDraftRating(Number(existing?.rating || rating || 0));
    setDraftComment(normalizeText(existing?.comment || comment || ""));
    setIsEditing(true);
    setError("");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError("");
  };

  const handleSaveEdit = async () => {
    if (!existing?._id || updating) return;
    const nextRating = Number(draftRating || 0);
    const nextComment = normalizeText(draftComment);
    if (nextRating < 1 || nextRating > 5 || !nextComment) {
      setError("Vui lòng chọn sao và nhập nhận xét.");
      return;
    }

    setUpdating(true);
    setError("");
    try {
      await onUpdateReview?.({
        reviewId: existing._id,
        rating: nextRating,
        comment: nextComment,
      });
      setRating(nextRating);
      setComment(nextComment);
      setIsEditing(false);
    } catch (err) {
      setError(err?.message || "Không thể cập nhật đánh giá. Vui lòng thử lại.");
    } finally {
      setUpdating(false);
    }
  };

  const handleClaim = async () => {
    if (!existing?._id || claimed || claiming) return;
    setClaiming(true);
    setError("");
    try {
      await onClaimReward?.(existing._id);
    } catch (err) {
      setError(err?.message || "Không thể nhận thưởng. Vui lòng thử lại.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-100">
          {imageSrc && !imageBroken ? (
            <img
              src={imageSrc}
              alt={product?.name || "product"}
              className="h-full w-full object-cover"
              onError={() => setImageBroken(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
              {String(product?.name || "SP").slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {product?.name || "Sản phẩm"}
            {Number(product?.quantity || 0) > 1 ? (
              <span className="ml-2 text-xs font-medium text-slate-400">x{Number(product.quantity || 0)}</span>
            ) : null}
          </p>

          <div className="mt-2">
            <StarRating
              value={Number(isEditing ? draftRating : rating || 0)}
              readOnly={reviewed && !isEditing}
              onChange={(next) => {
                if (!reviewed) setRating(next);
                if (isEditing) setDraftRating(next);
              }}
            />
          </div>

          <textarea
            rows={2}
            value={isEditing ? draftComment : comment}
            disabled={reviewed && !isEditing}
            onChange={(event) => {
              if (!reviewed) {
                setComment(event.target.value);
              } else if (isEditing) {
                setDraftComment(event.target.value);
              }
            }}
            placeholder="Chia sẻ trải nghiệm của bạn..."
            className={`mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 ${
              reviewed && !isEditing ? "bg-slate-50" : "bg-white"
            }`}
          />

          {reviewed ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="inline-flex items-center justify-center rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Đã đánh giá
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Sửa đánh giá
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={updating}
                  className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    updating
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-orange-500 text-white hover:bg-orange-600"
                  }`}
                >
                  {updating ? "Đang lưu..." : "Lưu đánh giá"}
                </button>
              )}
              <RewardButton
                coins={rewardCoins}
                claimed={claimed}
                loading={claiming}
                disabled={!existing?._id}
                onClick={handleClaim}
              />
              {isEditing ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${
                !canSubmit || submitting
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          )}

          {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
};

export default ReviewItem;
