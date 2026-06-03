import React from "react";

const STATUS_META = {
  pending: { label: "Chờ thanh toán", className: "bg-yellow-100 text-yellow-700" },
  paid: { label: "Đã thanh toán", className: "bg-emerald-100 text-emerald-700" },
  shipping: { label: "Đang giao", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Hoàn thành", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", className: "bg-red-100 text-red-700" },
  pending: { label: "Đã đặt", className: "bg-yellow-100 text-yellow-700" },
  preparing: { label: "Đang chuẩn bị", className: "bg-sky-100 text-sky-700" },
  delivering: { label: "Đang giao", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Hoàn tất", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", className: "bg-red-100 text-red-700" },
};

export const normalizeStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "pending";
  if (value === "food processing") return "delivering";
  if (value === "out for delivery") return "delivering";
  if (value === "delivered" || value === "done") return "completed";
  if (value === "canceled") return "cancelled";
  if (value === "cancelled") return "cancelled";
  if (value === "paid" || value === "success") return "preparing";
  if (value === "shipping") return "delivering";
  return value;
};

const OrderStatusBadge = ({ status }) => {
  const normalized = normalizeStatus(status);
  const meta = STATUS_META[normalized] || STATUS_META.pending;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
};

export default OrderStatusBadge;
