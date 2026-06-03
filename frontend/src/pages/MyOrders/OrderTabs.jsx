import React from "react";

const OrderTabs = ({ value, onChange }) => {
  const tabs = [
    { value: "all", label: "Tất cả" },
    { value: "pending", label: "Chờ xác nhận" },
    { value: "paid", label: "Quán đang chuẩn bị" },
    { value: "shipping", label: "Đang giao hàng" },
    { value: "completed", label: "Đã giao thành công" },
    { value: "cancelled", label: "Đơn đã hủy" },
  ];

  const tabsV2 = [
    { value: "all", label: "Tất cả" },
    { value: "pending", label: "Đã đặt" },
    { value: "preparing", label: "Đang chuẩn bị" },
    { value: "delivering", label: "Đang giao" },
    { value: "completed", label: "Hoàn tất" },
    { value: "cancelled", label: "Đã hủy" },
  ];
  void tabs;

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {tabsV2.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              isActive
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default OrderTabs;
