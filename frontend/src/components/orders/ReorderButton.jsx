import React from "react";

const ReorderButton = ({ onClick, loading = false, disabled = false }) => {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={[
        "inline-flex min-w-[90px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition",
        isDisabled
          ? "cursor-not-allowed bg-emerald-300 text-white"
          : "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]",
      ].join(" ")}
      aria-busy={loading}
    >
      {loading ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      <span>{loading ? "Đang xử lý..." : "Đặt lại"}</span>
    </button>
  );
};

export default React.memo(ReorderButton);
