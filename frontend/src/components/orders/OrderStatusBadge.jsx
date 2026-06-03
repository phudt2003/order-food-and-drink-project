import React from "react";

const STATUS_LABELS = {
  pending: "Chờ xác nhận",
  paid: "Quán đang chuẩn bị",
  shipping: "Đang giao hàng",
  completed: "Đã giao thành công",
  cancelled: "Đơn đã hủy",
  pending: "Đã đặt",
  preparing: "Đang chuẩn bị",
  delivering: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-sky-100 text-sky-700",
  shipping: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
  preparing: "bg-sky-100 text-sky-700",
  delivering: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export const normalizeStatus = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) return "pending";
  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("complete") || normalized.includes("done")) return "completed";
  if (normalized.includes("deliver") || normalized.includes("ship")) return "delivering";
  if (normalized.includes("prep") || normalized.includes("paid") || normalized.includes("payment")) return "preparing";
  return "pending";
};

const OrderStatusBadge = ({ status, className = "" }) => {
  const normalized = normalizeStatus(status);
  const label = STATUS_LABELS[normalized] || STATUS_LABELS.pending;
  const styles = STATUS_STYLES[normalized] || STATUS_STYLES.pending;

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles} ${className}`}>
      {label}
    </span>
  );
};

export default OrderStatusBadge;
