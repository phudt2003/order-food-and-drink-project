import React from "react";

const ProductItemCard = ({
  imageSrc,
  title,
  optionLines = [],
  quantity = 0,
  totalLabel = "",
  showReviewButton = false,
  onReview,
}) => {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <img
            src={imageSrc || "https://via.placeholder.com/150"}
            alt={title || "item"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {title || "Sản phẩm"}
              </p>
              {optionLines.length > 0 ? (
                <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                  {optionLines.map((line, index) => (
                    <p key={`opt-${index}`}>{line}</p>
                  ))}
                </div>
              ) : null}
            </div>

            {totalLabel ? (
              <p className="shrink-0 text-sm font-semibold text-slate-800">
                {totalLabel}
              </p>
            ) : null}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Số lượng: {quantity}</p>
            {showReviewButton ? (
              <button
                type="button"
                onClick={onReview}
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                Đánh giá
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductItemCard;

