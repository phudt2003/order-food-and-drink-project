import React from "react";
import OrderStatusBadge from "./OrderStatusBadge";
import OrderTimeline from "./OrderTimeline";
import { formatVND } from "../../utils/currency";

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getItemSummary = (items = []) => {
  const totalItems = items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  return `${totalItems} món`;
};

const OrderList = ({ orders = [] }) => {
  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const orderId = order?._id || order?.orderId;
        const items = Array.isArray(order?.items) ? order.items : [];
        const total = order?.total ?? order?.amount ?? 0;

        return (
          <div
            key={orderId}
            className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {order?.orderCode || orderId}
                </p>
                <p className="text-xs text-slate-500">{formatDateTime(order?.createdAt)}</p>
              </div>
              <OrderStatusBadge status={order?.status} />
            </div>

            <div className="mt-3">
              <OrderTimeline status={order?.status} />
            </div>

            <div className="mt-4 space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có sản phẩm</p>
              ) : (
                items.slice(0, 3).map((item, index) => (
                  <div key={`${orderId}-${index}`} className="flex items-center justify-between text-sm text-slate-700">
                    <span className="line-clamp-1">
                      {item?.name || "Sản phẩm"} x{item?.quantity || 1}
                    </span>
                    <span className="font-semibold">{formatVND(item?.price || 0)}</span>
                  </div>
                ))
              )}
              {items.length > 3 && (
                <p className="text-xs text-slate-500">+{items.length - 3} sản phẩm khác</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-amber-100 pt-3 text-sm">
              <span className="text-slate-500">{getItemSummary(items)}</span>
              <span className="text-base font-semibold text-orange-500">{formatVND(total)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderList;
