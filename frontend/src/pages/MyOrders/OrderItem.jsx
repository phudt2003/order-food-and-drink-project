import React from "react";
import { formatVND } from "../../utils/currency";

const OrderItem = ({ item, imageSrc }) => (
  <div className="flex items-center gap-4">
    <div className="h-16 w-16 overflow-hidden rounded-lg border bg-white">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={item?.name || "product"}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
          No image
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium text-gray-800">{item?.name || "Sản phẩm"}</p>
      <p className="text-sm text-gray-500">x{Number(item?.quantity || 0)}</p>
    </div>
    <p className="font-semibold text-gray-800 sm:ml-auto">{formatVND(item?.price || 0)}</p>
  </div>
);

export default OrderItem;
