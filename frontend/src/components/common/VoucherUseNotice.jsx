import React, { useContext, useMemo } from "react";
import { StoreContext } from "../../context/StoreContext";

export default function VoucherUseNotice() {
  const store = useContext(StoreContext);
  const toast = store?.voucherToast || null;

  const model = useMemo(() => {
    if (!toast?.message) return { visible: false };
    const kind = String(toast?.kind || "info").toLowerCase();
    const base =
      kind === "error"
        ? { bg: "bg-rose-600", label: "Có lỗi" }
        : kind === "success"
          ? { bg: "bg-emerald-600", label: "Thành công" }
          : { bg: "bg-black", label: "Thông báo" };
    return {
      visible: true,
      bg: base.bg,
      title: base.label,
      message: String(toast.message || ""),
    };
  }, [toast?.message, toast?.kind]);

  // Chỉ hiển thị toast nhanh (success/error/info). Không hiển thị notice "Voucher đã được lưu/đang áp dụng"
  // vì voucher mặc định đã được lưu vào hệ thống của user.
  if (!model?.visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
      <div
        role="status"
        className={[
          "flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-lg",
          model.bg || "bg-black",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{model.title}</p>
            {model.message ? <p className="mt-1 text-xs opacity-90">{model.message}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
