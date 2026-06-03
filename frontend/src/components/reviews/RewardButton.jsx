import React from "react";

const RewardButton = ({ coins = 10, claimed, loading, disabled, onClick }) => {
  if (claimed) {
    return (
      <button
        type="button"
        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700"
        disabled
      >
        Đã nhận thưởng
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${
        disabled || loading
          ? "cursor-not-allowed bg-slate-100 text-slate-400"
          : "bg-orange-500 text-white hover:bg-orange-600"
      }`}
    >
      {loading ? "Đang nhận..." : `Nhận +${Number(coins || 0)} Xu`}
    </button>
  );
};

export default RewardButton;

