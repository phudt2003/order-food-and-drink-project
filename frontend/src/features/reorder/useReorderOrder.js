import { useCallback, useRef, useState } from "react";
import { getOrderById } from "../../api/orderApi";
import { trackEvent } from "../../utils/analytics";
import {
  BUY_NOW_ITEMS_KEY,
  DELIVERY_METRICS_KEY,
  DIRECT_CHECKOUT_ITEMS_KEY,
  POST_LOGIN_REDIRECT_KEY,
  REORDER_CHECKOUT_META_KEY,
  SELECTED_CART_LINE_KEYS_KEY,
} from "./constants";
import {
  addItemsToCart,
  buildReorderCheckoutMeta,
  mapCartLineItemsToCheckoutDraft,
  mergeCartItems,
  normalizeOrderItemsForReorder,
  validateLineItemToppingQuantities,
} from "./reorderUtils";

const DEBOUNCE_MS = 650;

const getOrderId = (orderInput) =>
  String(orderInput?._id || orderInput?.orderId || orderInput?.id || orderInput || "").trim();

const isUnauthorizedError = (error) => {
  const status = Number(error?.response?.status || 0);
  return status === 401 || status === 403;
};

export const useReorderOrder = ({
  token,
  url,
  navigate,
  cartLineItems,
  addToCart,
  foodList,
  saveVoucherIntent,
  onToast,
}) => {
  const [loadingByOrderId, setLoadingByOrderId] = useState({});
  const clickRef = useRef(new Map());
  const inFlightRef = useRef(new Set());

  const setLoading = useCallback((orderId, loading) => {
    const key = String(orderId || "").trim();
    if (!key) return;
    setLoadingByOrderId((prev) => {
      if (loading) return { ...prev, [key]: true };
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const isReordering = useCallback(
    (orderInput) => {
      const orderId = getOrderId(orderInput);
      return Boolean(loadingByOrderId[orderId]);
    },
    [loadingByOrderId]
  );

  const reorderOrder = useCallback(
    async (orderInput) => {
      const orderId = getOrderId(orderInput);
      if (!orderId) return false;

      const now = Date.now();
      const lastClick = Number(clickRef.current.get(orderId) || 0);
      if (now - lastClick < DEBOUNCE_MS) return false;
      if (inFlightRef.current.has(orderId)) return false;

      clickRef.current.set(orderId, now);
      inFlightRef.current.add(orderId);
      setLoading(orderId, true);

      trackEvent("reorder_clicked", { orderId });

      try {
        if (!token) {
          const resumePath = `/myorders?resumeReorder=${encodeURIComponent(orderId)}`;
          localStorage.setItem(POST_LOGIN_REDIRECT_KEY, resumePath);
          navigate(`/login?redirect=${encodeURIComponent(resumePath)}`);
          throw new Error("UNAUTHORIZED");
        }

        const response = await getOrderById({ url, token, orderId });
        if (!response?.data?.success || !response?.data?.data) {
          throw new Error(response?.data?.message || "Không thể đặt lại đơn hàng.");
        }

        const orderDetail = response.data.data;
        const productById = new Map(
          (Array.isArray(foodList) ? foodList : []).map((item) => [String(item?._id || ""), item])
        );

        const { availableItems, unavailableItems } = normalizeOrderItemsForReorder({
          orderDetail,
          productById,
        });

        if (availableItems.length === 0) {
          onToast?.("error", "Không thể đặt lại: tất cả sản phẩm trong đơn cũ hiện đã hết hàng hoặc ngừng bán.");
          trackEvent("reorder_failed", { orderId, reason: "all_items_unavailable" });
          return false;
        }

        if (unavailableItems.length > 0) {
          onToast?.("warning", "Một số sản phẩm trong đơn cũ đã ngừng kinh doanh hoặc hết hàng.");
        }

        const currentCheckoutItems = mapCartLineItemsToCheckoutDraft(cartLineItems);
        const mergedCheckoutItems = mergeCartItems(currentCheckoutItems, availableItems);
        const toppingValidation = validateLineItemToppingQuantities(mergedCheckoutItems);

        if (!toppingValidation.ok) {
          onToast?.(
            "error",
            "Không thể đặt lại: số lượng topping nhỏ hơn số lượng món thành phẩm. Vui lòng kiểm tra lại topping."
          );
          trackEvent("reorder_failed", { orderId, reason: "invalid_topping_quantity" });
          return false;
        }

        const { failedCount } = await addItemsToCart(availableItems, addToCart);
        if (failedCount > 0) {
          onToast?.("error", "Không thể đặt lại: một số topping đã hết hoặc không đủ số lượng.");
          trackEvent("reorder_failed", { orderId, reason: "cart_add_failed" });
          return false;
        }

        localStorage.removeItem(BUY_NOW_ITEMS_KEY);
        localStorage.removeItem(SELECTED_CART_LINE_KEYS_KEY);
        localStorage.removeItem("addon_active_order");
        localStorage.setItem(DIRECT_CHECKOUT_ITEMS_KEY, JSON.stringify(mergedCheckoutItems));

        const preloadMeta = buildReorderCheckoutMeta(orderDetail, mergedCheckoutItems);
        localStorage.setItem(REORDER_CHECKOUT_META_KEY, JSON.stringify(preloadMeta));

        const delivery = preloadMeta?.shippingAddress || null;
        if (
          delivery &&
          Number.isFinite(Number(delivery?.lat)) &&
          Number.isFinite(Number(delivery?.lng))
        ) {
          localStorage.setItem(
            DELIVERY_METRICS_KEY,
            JSON.stringify({
              name: delivery.name || "",
              phone: delivery.phone || "",
              lat: Number(delivery.lat),
              lng: Number(delivery.lng),
              distance: Number.isFinite(Number(delivery.distanceKm)) ? Number(delivery.distanceKm) : null,
              deliveryFee: Number.isFinite(Number(delivery.deliveryFee)) ? Number(delivery.deliveryFee) : 0,
              deliveryTime: Number.isFinite(Number(delivery.deliveryTime)) ? Number(delivery.deliveryTime) : null,
              address: delivery.address || "",
              isManual: false,
            })
          );
        }

        const orderVoucher = preloadMeta?.voucher?.order || null;
        const shippingVoucher = preloadMeta?.voucher?.shipping || null;
        const preferredVoucher = orderVoucher?.voucherCode ? orderVoucher : shippingVoucher;
        if (preferredVoucher?.voucherCode && typeof saveVoucherIntent === "function") {
          saveVoucherIntent(
            {
              _id: preferredVoucher?.voucherId || "",
              voucherCode: preferredVoucher.voucherCode,
            },
            "pending",
            {
              pendingVoucherId: preferredVoucher?.voucherId || "",
              silentAutoApply: true,
            }
          );
        }

        const laterFailedCount = 0;
        if (laterFailedCount > 0) {
          onToast?.("warning", "Một số món chưa đồng bộ vào giỏ hàng chính. Vui lòng kiểm tra lại.");
        }

        onToast?.("success", "Đã thêm lại sản phẩm từ đơn hàng trước.");
        trackEvent("reorder_success", {
          orderId,
          totalItems: availableItems.length,
          unavailableItems: unavailableItems.length,
        });
        navigate("/checkout");
        return true;
      } catch (error) {
        if (isUnauthorizedError(error) || error?.message === "UNAUTHORIZED") {
          trackEvent("reorder_failed", { orderId, reason: "unauthorized" });
          if (error?.message !== "UNAUTHORIZED") {
            const resumePath = `/myorders?resumeReorder=${encodeURIComponent(orderId)}`;
            localStorage.setItem(POST_LOGIN_REDIRECT_KEY, resumePath);
            navigate(`/login?redirect=${encodeURIComponent(resumePath)}`);
          }
          return false;
        }

        onToast?.("error", "Không thể đặt lại đơn hàng. Vui lòng thử lại.");
        trackEvent("reorder_failed", {
          orderId,
          reason: error?.response?.data?.message || error?.message || "unknown",
        });
        return false;
      } finally {
        setLoading(orderId, false);
        inFlightRef.current.delete(orderId);
      }
    },
    [addToCart, cartLineItems, foodList, navigate, onToast, saveVoucherIntent, setLoading, token, url]
  );

  return {
    reorderOrder,
    isReordering,
    loadingByOrderId,
  };
};
