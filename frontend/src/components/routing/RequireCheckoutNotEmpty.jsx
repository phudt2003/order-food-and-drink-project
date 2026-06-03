import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";

const DIRECT_CHECKOUT_ITEMS_KEY = "checkoutItems";
const BUY_NOW_ITEMS_KEY = "buy_now_item";

const safeParseList = (key) => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const hasCheckoutPayload = () => {
  const sanitize = (items) =>
    (Array.isArray(items) ? items : []).some((item) => {
      const productId = item?.productId || item?._id || item?.id || "";
      return Boolean(String(productId || "").trim());
    });

  if (sanitize(safeParseList(BUY_NOW_ITEMS_KEY))) return true;
  if (sanitize(safeParseList(DIRECT_CHECKOUT_ITEMS_KEY))) return true;
  return false;
};

export default function RequireCheckoutNotEmpty({ children }) {
  const store = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();
  const didRedirectRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  const totalItems = Number(store?.getTotalCartItems?.() || 0);
  const isCartLoading = Boolean(store?.isCartLoading);

  useEffect(() => {
    let alive = true;

    Promise.resolve(store?.refreshCart?.())
      .catch(() => {})
      .finally(() => {
        if (alive) setHydrated(true);
      });

    return () => {
      alive = false;
    };
  }, [store?.refreshCart]);

  const allowed = useMemo(() => {
    if (!hydrated || isCartLoading) return true;
    if (totalItems > 0) return true;
    return hasCheckoutPayload();
  }, [hydrated, isCartLoading, totalItems, location?.key]);

  useEffect(() => {
    if (!hydrated || isCartLoading) return;
    if (allowed) {
      didRedirectRef.current = false;
      return;
    }
    if (didRedirectRef.current) return;
    didRedirectRef.current = true;

    store?.pushVoucherToast?.("info", "Giỏ hàng đang trống, vui lòng chọn sản phẩm");
    navigate("/menu", { replace: true });
  }, [allowed, navigate, store]);

  if (!hydrated || isCartLoading) return null;
  if (!allowed) return null;
  return children;
}
