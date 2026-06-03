import React from "react";
import { normalizeStatus } from "./OrderStatusBadge";

const STEPS = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "paid", label: "Quán đang chuẩn bị" },
  { key: "shipping", label: "Đang giao hàng" },
  { key: "completed", label: "Hoàn tất" },
];

const STEPS_V2 = [
  { key: "pending", label: "Đã đặt" },
  { key: "preparing", label: "Đang chuẩn bị" },
  { key: "delivering", label: "Đang giao" },
  { key: "completed", label: "Hoàn tất" },
];
void STEPS;

const OrderTimeline = ({ status }) => {
  const normalized = normalizeStatus(status);

  if (normalized === "cancelled") {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
        Đơn đã hủy
      </div>
    );
  }

  const currentIndex = STEPS_V2.findIndex((step) => step.key === normalized);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {STEPS_V2.map((step, index) => {
        const isDone = currentIndex > index;
        const isActive = currentIndex === index;
        const dotClass = isDone
          ? "bg-emerald-500"
          : isActive
            ? "bg-amber-500"
            : "bg-slate-300";
        const textClass = isDone
          ? "text-emerald-700"
          : isActive
            ? "text-amber-700"
            : "text-slate-500";

        return (
          <div key={step.key} className="flex flex-1 items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
            <span className={`text-xs font-medium ${textClass}`}>{step.label}</span>
            {index < STEPS.length - 1 && (
              <span className="hidden h-0.5 flex-1 bg-slate-200 sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OrderTimeline;
