import React from "react";

const SUGAR_LABELS = {
  0: "Không đường",
  30: "Ít đường",
  50: "Bình thường",
  70: "Hơi ngọt",
  100: "Rất ngọt",
};

const LEVELS = [0, 30, 50, 70, 100];

const SugarLevelPicker = ({ value, onChange, disabled = false, className = "" }) => {
  const numericValue = Number(value);
  const label = SUGAR_LABELS[numericValue] || "Tùy chỉnh";
  const summary = `Độ ngọt: ${label}`;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {LEVELS.map((level) => {
          const active = numericValue === level;
          return (
            <button
              key={`sugar-${level}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(level)}
              className={[
                "rounded-xl px-3 py-2 text-xs font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                active
                  ? "border border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50",
              ].join(" ")}
            >
              {level}% - {SUGAR_LABELS[level]}
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-xs font-medium text-slate-600">
        {summary}
      </div>
    </div>
  );
};

export default SugarLevelPicker;

