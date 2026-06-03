import React from "react";

const OrderFilterTabs = ({ value, onChange }) => {
  const tabs = [
    { value: "all", label: "Tất cả" },
    { value: "pending", label: "Chờ thanh toán" },
    { value: "paid", label: "Đã thanh toán" },
    { value: "shipping", label: "Đang giao" },
    { value: "completed", label: "Hoàn thành" },
    { value: "cancelled", label: "Đã hủy" },
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
    <div className="mt-6 flex flex-wrap gap-3">
      {tabsV2.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive ? "bg-orange-500 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default OrderFilterTabs;
