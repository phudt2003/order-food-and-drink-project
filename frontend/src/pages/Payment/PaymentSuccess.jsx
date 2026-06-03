import React, { useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatVND } from "../../utils/currency";
import { StoreContext } from "../../context/StoreContext";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart, refreshCart } = useContext(StoreContext);
  const orderId = location.state?.orderId || "";
  const amount = Number(location.state?.amount || 0);

  useEffect(() => {
    clearCart();
    refreshCart().catch(() => {});

    const timerId = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 2500);

    return () => window.clearTimeout(timerId);
  }, [clearCart, navigate, refreshCart]);

  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", background: "#fff", padding: "24px", borderRadius: "12px" }}>
        <h2>Giao dich thanh cong</h2>
        {orderId ? <p>Ma don: {orderId}</p> : null}
        {amount > 0 ? <p>So tien: {formatVND(amount)}</p> : null}
        <p>Dang chuyen ve trang chu...</p>
        <button type="button" onClick={() => navigate("/", { replace: true })}>
          Ve trang chu ngay
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccess;
