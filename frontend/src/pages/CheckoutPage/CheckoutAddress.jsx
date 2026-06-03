import React from "react";

const CheckoutAddress = ({ deliveryAddress, onShowMap, onOpenList }) => (
  <div className="selected-address-card">
    <strong>
      {deliveryAddress?.name || "Dia chi giao hang"}
      {deliveryAddress?.phone ? ` | ${deliveryAddress.phone}` : ""}
    </strong>
    <p>{deliveryAddress?.address || "Chua co thong tin dia chi"}</p>
    <div className="selected-address-actions">
      {onOpenList ? (
        <button type="button" className="address-change-btn" onClick={onOpenList}>
          Chọn địa chỉ khác
        </button>
      ) : null}
      <button type="button" className="address-change-btn" onClick={onShowMap}>
        Sửa
      </button>
    </div>
  </div>
);

export default CheckoutAddress;
