import React from "react";
import { formatVND } from "../../utils/currency";
import OrderItem from "./OrderItem";

const STATUS_META = {
  pending: { label: "Chờ thanh toán", className: "bg-yellow-100 text-yellow-700" },
  paid: { label: "Đã thanh toán", className: "bg-blue-100 text-blue-700" },
  shipping: { label: "Đang giao", className: "bg-purple-100 text-purple-700" },
  completed: { label: "Hoàn thành", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", className: "bg-red-100 text-red-700" },
  pending: { label: "Đã đặt", className: "bg-yellow-100 text-yellow-700" },
  preparing: { label: "Đang chuẩn bị", className: "bg-sky-100 text-sky-700" },
  delivering: { label: "Đang giao", className: "bg-purple-100 text-purple-700" },
  completed: { label: "Hoàn tất", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", className: "bg-red-100 text-red-700" },
};

export const normalizeStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "pending";
  if (value === "food processing") return "delivering";
  if (value === "out for delivery") return "delivering";
  if (value === "delivered" || value === "done") return "completed";
  if (value === "canceled" || value === "cancelled") return "cancelled";
  if (value === "success" || value === "paid") return "preparing";
  if (value === "shipping") return "delivering";
  return value;
};

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

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

const formatOrderId = (value) => {
  if (!value) return "ORDER_----";
  const text = String(value);
  if (text.toUpperCase().startsWith("ORDER_")) return text;
  return `ORDER_${text.slice(-8).toUpperCase()}`;
};

const OrderCard = ({ order, baseUrl, onTrack }) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const primaryItem = items[0] || null;
  const extraCount = Math.max(0, items.length - 1);
  const normalized = normalizeStatus(order?.status);
  const statusMeta = STATUS_META[normalized] || STATUS_META.pending;

  return (
    <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">
            {formatOrderId(order?._id || order?.orderId)}
          </p>
          <p className="text-xs text-gray-400">{formatDate(order?.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
          {statusMeta.label}
        </span>
      </div>

      <div className="space-y-3">
        {!primaryItem ? (
          <p className="text-sm text-gray-500">Không có sản phẩm</p>
        ) : (
          <>
            <OrderItem
              item={primaryItem}
              imageSrc={resolveImageSrc(primaryItem?.image, baseUrl)}
            />
            {extraCount > 0 ? (
              <p className="text-xs text-gray-400">+{extraCount} sản phẩm khác</p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-gray-500">Tổng tiền</p>
          <p className="text-lg font-bold text-gray-900">
            {formatVND(order?.amount ?? order?.totalPrice ?? 0)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onTrack?.(order)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700"
        >
          Theo dõi đơn hàng
        </button>
      </div>
    </div>
  );
};

export default OrderCard;
