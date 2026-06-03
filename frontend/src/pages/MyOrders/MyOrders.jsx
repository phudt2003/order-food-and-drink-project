import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { CheckCircle, ChefHat, Clock, Truck, XCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { confirmOrderDelivered, getOrderStatus } from "../../api/orderApi";
import ProductItemCard from "./ProductItemCard";
import ReviewList from "../../components/reviews/ReviewList";
import { normalizeToppingSelections } from "../../utils/toppings";
import ReorderButton from "../../components/orders/ReorderButton";
import { useReorderOrder } from "../../features/reorder/useReorderOrder";
import {
  addItemsToCart,
  normalizeOrderItemsForReorder,
  validateLineItemToppingQuantities,
} from "../../features/reorder/reorderUtils";
import "./MyOrders.css";

const STATUS_LABELS = {
  pending: "Đã đặt",
  preparing: "Đang chuẩn bị",
  delivering: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  unknown: "Đang xử lý",
};

const TRACKING_STEPS = [
  { key: "pending", label: "Đã đặt", Icon: Clock },
  { key: "preparing", label: "Đang chuẩn bị", Icon: ChefHat },
  { key: "delivering", label: "Đang giao", Icon: Truck },
  { key: "completed", label: "Hoàn tất", Icon: CheckCircle },
];

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getStatusKey = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "pending";

  // New (automated lifecycle) statuses from backend
  if (["pending", "preparing", "delivering", "completed", "cancelled"].includes(value)) {
    return value;
  }

  // Legacy (payment/status) mapping for backward compatibility
  if (value === "paid" || value === "success") return "preparing";
  if (value === "shipping" || value === "food processing" || value === "out for delivery") return "delivering";
  if (value === "completed" || value === "delivered" || value === "done") return "completed";
  if (value === "canceled" || value === "cancelled") return "cancelled";
  if (value === "pending") return "pending";

  const normalized = normalizeText(value);
  if (normalized.includes("da huy") || normalized.includes("huy")) return "cancelled";
  if (normalized.includes("da giao") || normalized.includes("hoan thanh")) return "completed";
  if (normalized.includes("dang giao")) return "delivering";
  if (normalized.includes("da thanh toan") || normalized.includes("thanh toan")) return "preparing";
  if (
    normalized.includes("dang xu ly") ||
    normalized.includes("cho thanh toan") ||
    normalized.includes("cho xac nhan")
  )
    return "pending";

  if (normalized.includes("failed") || normalized.includes("that bai")) return "cancelled";

  return "unknown";
};

const getOrderStatusValue = (order, fallback = "pending") => {
  const raw = resolveDisplayStatus(order) || order?.status || fallback;
  const text = String(raw || "").trim();
  const map = {
    COMPLETED: "completed",
    "Hoàn tất": "completed",
  };
  if (map[text]) return map[text];
  return text;
};

const getStatusIndex = (statusKey) => {
  if (statusKey === "pending") return 0;
  if (statusKey === "preparing") return 1;
  if (statusKey === "delivering") return 2;
  if (statusKey === "completed") return 3;
  return -1;
};

const resolveDisplayStatus = (order) => {
  if (!order) return "pending";
  const statusKey = getStatusKey(order?.status);
  if (statusKey !== "unknown") return statusKey;
  return getStatusKey(order?.fulfillmentStatus);
};

const resolveStatusLabel = (statusKey, rawStatus) => {
  if (statusKey === "unknown") {
    return rawStatus || "Đang xử lý";
  }
  return STATUS_LABELS[statusKey] || rawStatus || "Đang xử lý";
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

const resolveImageSrc = (value, baseUrl) => {
  if (!value) return "";
  if (/^data:/i.test(value) || isAbsoluteUrl(value)) return value;
  if (!baseUrl) return value;

  const trimmedBase = String(baseUrl).replace(/\/$/, "");
  const raw = String(value).replace(/^\/+/, "").replace(/\\/g, "/");

  if (raw.startsWith("images/")) return `${trimmedBase}/${raw}`;
  if (raw.startsWith("uploads/")) {
    return `${trimmedBase}/images/${raw.replace(/^uploads\//, "")}`;
  }
  if (!raw.includes("/")) return `${trimmedBase}/images/${raw}`;

  return `${trimmedBase}/${raw}`;
};

const getItems = (order) => {
  if (Array.isArray(order?.items)) return order.items;
  if (Array.isArray(order?.orderItems)) return order.orderItems;
  return [];
};

const getOrderCode = (order) => {
  if (order?.orderCode) return order.orderCode;
  const raw = order?._id || order?.orderId || "";
  if (!raw) return "#DH";
  return `#${String(raw).slice(-6).toUpperCase()}`;
};

const getCreatedAt = (order) => order?.createdAt || order?.date || order?.created;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getShippingFee = (order) =>
  Number(order?.deliveryFee ?? order?.shippingFee ?? order?.shipping_fee ?? 0);

const getItemsTotal = (order) =>
  getItems(order).reduce((sum, item) => {
    const price = Number(item?.price ?? item?.unitPrice ?? 0);
    const quantity = Number(item?.quantity ?? 0);
    return sum + price * quantity;
  }, 0);

const getVoucherDiscount = (order) => {
  const hasModernVoucher = Boolean(
    order?.vouchers?.order?.voucherId ||
      order?.vouchers?.order?.voucherCode ||
      order?.vouchers?.shipping?.voucherId ||
      order?.vouchers?.shipping?.voucherCode
  );

  const legacyDiscount = hasModernVoucher ? 0 : Number(order?.voucher?.discount || 0);
  const explicitDiscount =
    legacyDiscount +
    Number(order?.vouchers?.order?.discount || 0) +
    Number(order?.vouchers?.shipping?.discount || 0);

  if (Number.isFinite(explicitDiscount) && explicitDiscount > 0) {
    return explicitDiscount;
  }

  const amount = Number(order?.amount ?? order?.total ?? 0);
  if (Number.isFinite(amount) && amount > 0) {
    const implied =
      getItemsTotal(order) + getShippingFee(order) - Math.max(0, amount);
    if (Number.isFinite(implied) && implied > 0) return implied;
  }

  return 0;
};

const getVoucherEntries = (order) => {
  const entries = [];

  const orderEntry = order?.vouchers?.order;
  const shippingEntry = order?.vouchers?.shipping;

  if (orderEntry && (Number(orderEntry?.discount || 0) > 0 || orderEntry?.voucherCode)) {
    entries.push({
      key: "order",
      voucherCode: String(orderEntry?.voucherCode || "").trim(),
      discount: Math.max(0, Number(orderEntry?.discount || 0)),
    });
  }

  if (
    shippingEntry &&
    (Number(shippingEntry?.discount || 0) > 0 || shippingEntry?.voucherCode)
  ) {
    entries.push({
      key: "shipping",
      voucherCode: String(shippingEntry?.voucherCode || "").trim(),
      discount: Math.max(0, Number(shippingEntry?.discount || 0)),
    });
  }

  if (entries.length === 0 && order?.voucher) {
    const legacy = order.voucher;
    const discount = Math.max(0, Number(legacy?.discount || 0));
    const voucherCode = String(legacy?.voucherCode || legacy?.code || "").trim();

    if (discount > 0 || voucherCode) {
      entries.push({ key: "legacy", voucherCode, discount });
    }
  }

  return entries;
};

const getOrderTotal = (order) => {
  const amount = Number(order?.amount ?? order?.total ?? 0);
  if (Number.isFinite(amount) && amount > 0) return amount;

  const itemsTotal = getItemsTotal(order);
  const shippingFee = getShippingFee(order);
  const discount = getVoucherDiscount(order);
  return Math.max(0, itemsTotal + shippingFee - discount);
};

const formatPrice = (price) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price || 0);

const getOrderAddress = (order) => {
  const rawAddress = order?.address || {};
  const address = typeof rawAddress === "object" && rawAddress !== null ? rawAddress : {};
  const name =
    [address?.firstName, address?.lastName].filter(Boolean).join(" ") ||
    address?.name ||
    order?.customerName ||
    order?.customer?.name ||
    order?.receiver_name ||
    order?.receiverName ||
    "";
  const phone = address?.phone || order?.phone || "";
  const addressText =
    (typeof rawAddress === "string" ? rawAddress : "") ||
    address?.deliveryText ||
    address?.detail_address ||
    order?.addressText ||
    order?.deliveryAddress?.text ||
    "";
  const structured = [
    address?.street,
    address?.ward,
    address?.district,
    address?.city,
    address?.state,
    address?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    address: String(addressText || structured || "").trim(),
  };
};

const ModalShell = ({ title, subtitle, onClose, children, footer }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-overlayFade"
    onClick={onClose}
  >
    <div
      className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-lg animate-modalPop dark:bg-gray-800 md:max-w-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {subtitle ? <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-300">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
          aria-label="Đóng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div className="mt-5 flex-1 overflow-y-auto pr-1">{children}</div>
      {footer ? <div className="mt-6 border-t border-slate-100 pt-4 dark:border-white/10">{footer}</div> : null}
    </div>
  </div>
);

const MyOrders = () => {
  const {
    url,
    token,
    notifyReviewsChanged,
    refreshUserProfile,
    food_list,
    cartLineItems,
    addToCart,
    saveVoucherIntent,
  } = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailScrollTarget, setDetailScrollTarget] = useState("");
  const reviewSectionRef = useRef(null);
  const resumeReorderRef = useRef("");
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [toastState, setToastState] = useState({ message: "", kind: "success" });
  const [confirmingId, setConfirmingId] = useState("");
  const [addingCartByOrderId, setAddingCartByOrderId] = useState({});

  useEffect(() => {
    if (!detailOrder || detailScrollTarget !== "reviews") return undefined;

    let raf1 = 0;
    let raf2 = 0;

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        reviewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setDetailScrollTarget("");
      });
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [detailOrder, detailScrollTarget]);

  useEffect(() => {
    if (!toastState?.message) return undefined;
    const timer = setTimeout(() => setToastState({ message: "", kind: "success" }), 2800);
    return () => clearTimeout(timer);
  }, [toastState?.message]);

  const showToast = (kind, message) => {
    const text = String(message || "").trim();
    if (!text) return;
    setToastState({ kind: String(kind || "success").toLowerCase(), message: text });
  };

  const { reorderOrder, isReordering } = useReorderOrder({
    token,
    url,
    navigate,
    cartLineItems,
    addToCart,
    foodList: food_list,
    saveVoucherIntent,
    onToast: showToast,
  });

  const productById = useMemo(
    () => new Map((Array.isArray(food_list) ? food_list : []).map((item) => [String(item?._id || ""), item])),
    [food_list]
  );

  const isAddingOrderToCart = (orderInput) => {
    const key = String(orderInput?._id || orderInput?.orderId || orderInput?.id || orderInput || "").trim();
    if (!key) return false;
    return Boolean(addingCartByOrderId[key]);
  };

  const handleAddOrderToCart = async (order) => {
    const orderId = String(order?._id || order?.orderId || "").trim();
    if (!orderId) return;
    if (isAddingOrderToCart(orderId)) return;

    setAddingCartByOrderId((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { availableItems, unavailableItems } = normalizeOrderItemsForReorder({
        orderDetail: order,
        productById,
      });

      if (availableItems.length === 0) {
        showToast("error", "Không thể thêm vào giỏ: tất cả sản phẩm trong đơn này hiện không khả dụng.");
        return;
      }

      const toppingValidation = validateLineItemToppingQuantities(availableItems);
      if (!toppingValidation.ok) {
        showToast(
          "error",
          "Không thể thêm vào giỏ: số lượng topping nhỏ hơn số lượng món thành phẩm."
        );
        return;
      }

      const { addedCount, failedCount } = await addItemsToCart(availableItems, addToCart);
      if (failedCount > 0) {
        showToast("warning", "Một số món chưa thêm được vào giỏ. Vui lòng thử lại.");
      }
      if (unavailableItems.length > 0) {
        showToast("warning", "Một số sản phẩm trong đơn cũ hiện không còn khả dụng.");
      }
      if (addedCount > 0 && failedCount === 0) {
        showToast("success", "Đã thêm sản phẩm vào giỏ hàng.");
      }
      if (addedCount > 0) {
        navigate("/cart");
      }
    } catch (error) {
      showToast("error", error?.message || "Không thể thêm sản phẩm vào giỏ hàng.");
    } finally {
      setAddingCartByOrderId((prev) => {
        if (!prev[orderId]) return prev;
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(String(location?.search || ""));
    const resumeOrderId = String(params.get("resumeReorder") || "").trim();
    if (!resumeOrderId || !token) return;
    if (!Array.isArray(orders) || orders.length === 0) return;
    if (resumeReorderRef.current === resumeOrderId) return;

    const targetOrder = orders.find(
      (order) => String(order?._id || order?.orderId || "").trim() === resumeOrderId
    );
    if (!targetOrder) return;

    resumeReorderRef.current = resumeOrderId;
    reorderOrder(targetOrder).then((success) => {
      if (success) return;
      const nextParams = new URLSearchParams(String(location?.search || ""));
      nextParams.delete("resumeReorder");
      const nextSearch = nextParams.toString();
      navigate(nextSearch ? `/myorders?${nextSearch}` : "/myorders", { replace: true });
    });
  }, [location?.search, navigate, orders, reorderOrder, token]);

  const handleConfirmDelivered = async (order) => {
    const orderId = order?._id || order?.orderId;
    if (!orderId || !token) return;

    const confirmed = window.confirm("Bạn xác nhận đã nhận hàng?");
    if (!confirmed) return;

    try {
      setConfirmingId(String(orderId));
      const response = await confirmOrderDelivered({ url, token, orderId });
      if (!response?.data?.success) {
        showToast("error", response?.data?.message || "Không thể xác nhận đơn hàng.");
        return;
      }

      showToast("success", "Đã xác nhận nhận hàng.");
      await fetchOrders();

      if (trackingOrder && String(trackingOrder?._id || trackingOrder?.orderId) === String(orderId)) {
        fetchTrackingStatus(trackingOrder, { showLoading: true });
      }
    } catch (error) {
      showToast(
        "error",
        error?.response?.data?.message ||
          error?.message ||
          "Không thể xác nhận đơn hàng."
      );
    } finally {
      setConfirmingId("");
    }
  };

  const fetchOrders = React.useCallback(async () => {
    if (!token) {
      setOrders([]);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const response = await axios.get(`${url}/api/orders`, { headers });
      if (response?.data?.success) {
        setOrders(Array.isArray(response.data.data) ? response.data.data : []);
        return;
      }
    } catch {
      // fallback below
    }

    try {
      const response = await axios.get(`${url}/api/orders/my`, { headers });
      if (response?.data?.success) {
        setOrders(Array.isArray(response.data.data) ? response.data.data : []);
        return;
      }
    } catch {
      // fallback below
    }

    try {
      const response = await axios.post(
        `${url}/api/order/userorders`,
        {},
        { headers }
      );
      if (response?.data?.success) {
        setOrders(Array.isArray(response.data.data) ? response.data.data : []);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }
  }, [token, url]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!token) return;
    const intervalId = setInterval(fetchOrders, 5000);
    return () => clearInterval(intervalId);
  }, [token, fetchOrders]);

  const handleOpenDetail = (order, options = {}) => {
    setDetailOrder(order);
    setDetailScrollTarget(String(options?.scrollTo || ""));
  };

  const fetchTrackingStatus = React.useCallback(
    async (order, { showLoading = false } = {}) => {
      const orderId = order?._id || order?.orderId;
      if (!orderId || !token) {
        if (showLoading) setTrackingLoading(false);
        setTrackingError("Không thể lấy trạng thái đơn hàng.");
        return;
      }

      if (showLoading) setTrackingLoading(true);
      setTrackingError("");

      try {
        const response = await getOrderStatus({ url, token, orderId });
        if (!response?.data?.success) {
          setTrackingError(
            response?.data?.message || "Không thể lấy trạng thái đơn hàng."
          );
          return;
        }

        const data = response.data.data || {};
        const mergedOrder = { ...(order || {}), ...(data || {}) };
        const statusKey = resolveDisplayStatus(mergedOrder);
        const statusRaw = data?.status || order?.status || data?.fulfillmentStatus || order?.fulfillmentStatus;
        setTrackingInfo({
          statusKey,
          statusLabel: resolveStatusLabel(statusKey === "unknown" ? "pending" : statusKey, statusRaw),
          updatedAt: data?.updatedAt || data?.createdAt || order?.updatedAt || order?.createdAt || null,
          timing: data?.timing || order?.timing || null,
        });
        setTrackingOrder((prev) => (prev ? { ...prev, ...data } : data));
      } catch (error) {
        setTrackingError(
          error?.response?.data?.message ||
            error?.message ||
            "Không thể lấy trạng thái đơn hàng."
        );
      } finally {
        if (showLoading) setTrackingLoading(false);
      }
    },
    [token, url]
  );

  const handleOpenTracking = (order) => {
    setTrackingOrder(order);
    setTrackingInfo(null);
    fetchTrackingStatus(order, { showLoading: true });
  };

  useEffect(() => {
    if (!trackingOrder || !token) return undefined;
    const intervalId = window.setInterval(() => {
      fetchTrackingStatus(trackingOrder);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [fetchTrackingStatus, token, trackingOrder]);

  const reviewUxSummary = useMemo(() => {
    let pendingRewardReviews = 0;
    let ordersNeedReview = 0;

    (Array.isArray(orders) ? orders : []).forEach((order) => {
      const statusKey = getStatusKey(getOrderStatusValue(order));
      if (statusKey !== "completed") return;

      const reviewableCount = Number(order?.reviewSummary?.reviewableCount || 0);
      const reviewedCount = Number(order?.reviewSummary?.reviewedCount || 0);
      const pendingRewards = Number(order?.reviewSummary?.pendingRewards || 0);

      if (pendingRewards > 0) pendingRewardReviews += pendingRewards;
      if (reviewableCount > 0 && reviewedCount < reviewableCount) ordersNeedReview += 1;
    });

    return { pendingRewardReviews, ordersNeedReview };
  }, [orders]);

  const handleJumpToReview = () => {
    const target = (Array.isArray(orders) ? orders : []).find((order) => {
      const statusKey = getStatusKey(getOrderStatusValue(order));
      if (statusKey !== "completed") return false;

      const reviewableCount = Number(order?.reviewSummary?.reviewableCount || 0);
      const reviewedCount = Number(order?.reviewSummary?.reviewedCount || 0);
      const pendingRewards = Number(order?.reviewSummary?.pendingRewards || 0);
      return pendingRewards > 0 || (reviewableCount > 0 && reviewedCount < reviewableCount);
    });

    if (target) handleOpenDetail(target, { scrollTo: "reviews" });
  };

  const renderActionButtons = ({
    statusKey,
    reviewSummary,
    onDetail,
    onTrack,
    onReview,
    onAddToCart,
    addToCartLoading,
    onReorder,
    reorderOrderId,
    reorderLoading,
    onConfirmDelivered,
    confirmDisabled,
  }) => {
    const base =
      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition";
    const primary = `${base} bg-orange-500 text-white hover:bg-orange-600`;
    const secondary = `${base} border border-slate-200 text-slate-600 hover:bg-slate-50`;

    const reviewableCount = Math.max(0, Number(reviewSummary?.reviewableCount || 0));
    const reviewedCount = Math.max(0, Number(reviewSummary?.reviewedCount || 0));
    const isFullyReviewed = reviewableCount > 0 && reviewedCount >= reviewableCount;

    const reviewLabel =
      reviewableCount > 0 ? (isFullyReviewed ? "Đã đánh giá" : "Đánh giá ngay") : "Đánh giá";
    const reviewClass = !isFullyReviewed && reviewableCount > 0 ? primary : secondary;

    const actions = [
      <button key="detail" type="button" onClick={onDetail} className={secondary}>
        Xem chi tiết
      </button>,
    ];

    if (statusKey === "completed") {
      actions.unshift(
        <button key="review" type="button" onClick={onReview} className={reviewClass}>
          {reviewLabel}
        </button>
      );
      if (onReorder) {
        actions.push(
          <ReorderButton
            key="reorder"
            onClick={onReorder}
            loading={Boolean(reorderLoading)}
            disabled={Boolean(reorderOrderId && isReordering(reorderOrderId))}
          />
        );
      }
      if (onAddToCart) {
        actions.push(
          <button
            key="add-to-cart"
            type="button"
            onClick={onAddToCart}
            disabled={Boolean(addToCartLoading)}
            className={secondary}
          >
            {addToCartLoading ? "Đang thêm..." : "Thêm vào giỏ"}
          </button>
        );
      }
    } else if (statusKey !== "cancelled") {
      actions.unshift(
        <button key="track" type="button" onClick={onTrack} className={primary}>
          Theo dõi
        </button>
      );
      if (statusKey === "delivering") {
        actions.unshift(
          <button
            key="confirm"
            type="button"
            onClick={onConfirmDelivered}
            className={primary}
            disabled={confirmDisabled}
          >
            {confirmDisabled ? "Đang xác nhận..." : "Đã nhận hàng"}
          </button>
        );
      }
    }

    return <div className="flex flex-wrap gap-2 justify-end">{actions}</div>;
  };

  return (
    <div className="myorders-page min-h-screen bg-[#FDFBF7] py-10 px-4 md:px-20 font-sans">
      <h2 className="text-2xl font-bold text-[#5c4033] mb-8 text-center md:text-left">
        Đơn hàng của tôi
      </h2>

      {reviewUxSummary.pendingRewardReviews > 0 || reviewUxSummary.ordersNeedReview > 0 ? (
        <div className="mx-auto mb-4 max-w-4xl rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Xu chờ nhận</p>
              <p className="mt-1 text-xs text-slate-600">
                {reviewUxSummary.pendingRewardReviews > 0
                  ? `Bạn có ${reviewUxSummary.pendingRewardReviews} đánh giá chưa nhận thưởng. `
                  : ""}
                {reviewUxSummary.ordersNeedReview > 0
                  ? `Có ${reviewUxSummary.ordersNeedReview} đơn chưa đánh giá.`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleJumpToReview}
              className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              Đến đánh giá
            </button>
          </div>
        </div>
      ) : null}

      <div className="max-w-4xl mx-auto space-y-4">
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
            Bạn chưa có đơn hàng nào.
          </div>
        ) : (
          orders.map((order) => {
            const statusRaw = getOrderStatusValue(order);
            const statusKey = getStatusKey(statusRaw);
            const items = getItems(order);
            const actionStatusKey = statusKey === "unknown" ? "pending" : statusKey;
            const statusLabel = resolveStatusLabel(actionStatusKey, statusRaw);
            const totalAmount = getOrderTotal(order);
            const createdAtValue = getCreatedAt(order);
            const createdAt = formatDate(createdAtValue);
            const updatedAtLabel = formatDateTime(order?.updatedAt || createdAtValue);
            const statusClass =
              actionStatusKey === "cancelled"
                ? "bg-rose-100 text-rose-700"
                : actionStatusKey === "completed"
                ? "bg-emerald-100 text-emerald-700"
                : actionStatusKey === "delivering"
                ? "bg-indigo-100 text-indigo-700"
                : actionStatusKey === "preparing"
                ? "bg-sky-100 text-sky-700"
                : "bg-amber-100 text-amber-700";

            let displayKey = order?._id || order?.orderId;
            let displayPrimaryItem = items[0];
            let extraCount = items.length > 1 ? items.length - 1 : 0;

            const imageSrc =
              resolveImageSrc(displayPrimaryItem?.image, url) ||
              "https://via.placeholder.com/150";
            const primaryName = displayPrimaryItem?.name || "Sản phẩm";

            return (
              <div
                key={displayKey}
                className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <img
                        src={imageSrc}
                        alt={primaryName}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {primaryName}
                        {extraCount > 0 && ` và ${extraCount} món khác`}
                      </p>
                      <p className="text-xs text-slate-500">
                        Mã đơn:{" "}
                        <span className="font-semibold text-slate-700">
                          {getOrderCode(order)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Ngày đặt: {createdAt || "--"}
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <p className="text-sm font-semibold text-orange-500">
                      {formatPrice(totalAmount)}
                    </p>
                    <p className="text-xs text-slate-500">Cập nhật: {updatedAtLabel || "--"}</p>
                    <div className="w-full sm:w-auto">
                      {renderActionButtons({
                        statusKey: actionStatusKey,
                        onDetail: () => handleOpenDetail(order),
                        onTrack: () => handleOpenTracking(order),
                        onConfirmDelivered: () => handleConfirmDelivered(order),
                        confirmDisabled: confirmingId === String(order?._id || order?.orderId),
                        reviewSummary: order?.reviewSummary,
                        onReview: () => handleOpenDetail(order, { scrollTo: "reviews" }),
                        onAddToCart: () => handleAddOrderToCart(order),
                        addToCartLoading: isAddingOrderToCart(order),
                        onReorder: () => reorderOrder(order),
                        reorderOrderId: String(order?._id || order?.orderId || ""),
                        reorderLoading: isReordering(order),
                      })}
                    </div>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {detailOrder ? (
        <ModalShell
          title="Chi tiết đơn hàng"
          subtitle={null}
          onClose={() => {
            setDetailOrder(null);
            setDetailScrollTarget("");
          }}
        >
          {(() => {
            const items = getItems(detailOrder);
            const statusRaw = getOrderStatusValue(detailOrder);
            const statusKey = getStatusKey(statusRaw);
            const statusLabel = resolveStatusLabel(statusKey === "unknown" ? "pending" : statusKey, statusRaw);
           const addressInfo = getOrderAddress(detailOrder);
            const deliveryFee = getShippingFee(detailOrder);
            const itemsTotal = getItemsTotal(detailOrder);
            const voucherEntries = getVoucherEntries(detailOrder);
            const voucherDiscount = getVoucherDiscount(detailOrder);
            const displayVoucherEntries = voucherEntries.filter(
              (entry) => Number(entry?.discount || 0) > 0
            );
            const voucherCodeSummary = voucherEntries
              .map((entry) => String(entry?.voucherCode || "").trim())
              .filter(Boolean)
              .join(", ");
            const totalAmount = getOrderTotal(detailOrder);
            const createdAt = formatDate(getCreatedAt(detailOrder));
            const statusClass =
              statusKey === "cancelled"
                ? "bg-rose-100 text-rose-700"
                : statusKey === "completed"
                ? "bg-emerald-100 text-emerald-700"
                : statusKey === "delivering"
                ? "bg-indigo-100 text-indigo-700"
                : statusKey === "preparing"
                ? "bg-sky-100 text-sky-700"
                : "bg-amber-100 text-amber-700";

            return (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Mã đơn hàng
                      </p>
                      <p className="text-base font-semibold text-slate-800">
                        {getOrderCode(detailOrder)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Ngày đặt
                      </p>
                      <p className="text-sm font-semibold text-slate-700">
                        {createdAt || "--"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-800">Thông tin giao hàng</h4>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-start justify-between gap-4">
                      <span>Tên khách hàng</span>
                      <span className="font-medium text-slate-800">
                        {addressInfo.name || "--"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span>Số điện thoại</span>
                      <span className="font-medium text-slate-800">
                        {addressInfo.phone || "--"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span>Địa chỉ</span>
                      <span className="font-medium text-slate-800 text-right">
                        {addressInfo.address || "--"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-800">Danh sách sản phẩm</h4>
                  <div className="space-y-3">
                    {items.length === 0 ? (
                      <p className="text-sm text-slate-500">Không có sản phẩm.</p>
                      ) : (
                      items.map((item, index) => {
                        const itemKey = item?._id || item?.productId || `item-${index}`;
                        const itemTotal = Number(item?.price || 0) * Number(item?.quantity || 0);
                        const size = item?.size || item?.variant?.size || "";
                        const sugar =
                          item?.sugarLevel ||
                          item?.sugar ||
                          item?.variant?.sugarLevel ||
                          item?.variant?.sugar ||
                          "";
                        const ice =
                          item?.iceLevel ||
                          item?.ice ||
                          item?.variant?.iceLevel ||
                          item?.variant?.ice ||
                          "";
                        const note = item?.note || item?.variant?.note || "";
                        const toppingsRaw = item?.toppings || item?.topping || item?.variant?.toppings || [];
                        const toppingSelections = normalizeToppingSelections(toppingsRaw);

                        const optionLines = [
                          size ? `Size: ${size}` : "",
                          sugar ? `Đường: ${sugar}` : "",
                          ice ? `Đá: ${ice}` : "",
                        ].filter(Boolean);
                        if (toppingSelections.length > 0) {
                          optionLines.push("Topping:");
                          toppingSelections.forEach((topping) => {
                            optionLines.push(`• ${topping.name} x${topping.quantity}`);
                          });
                        }
                        if (note) optionLines.push(`Ghi chú: ${note}`);
                        return (
                          <ProductItemCard
                            key={itemKey}
                            imageSrc={resolveImageSrc(item?.image, url) || "https://via.placeholder.com/150"}
                            title={item?.name || "Sản phẩm"}
                            optionLines={optionLines}
                            quantity={Number(item?.quantity || 0)}
                            totalLabel={formatPrice(itemTotal)}
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {statusKey === "completed" ? (
                  <div ref={reviewSectionRef}>
                    <ReviewList
                      apiBase={url}
                      token={token}
                      orderId={String(detailOrder?._id || detailOrder?.orderId || "")}
                      onChanged={() => {
                        fetchOrders();
                        notifyReviewsChanged?.();
                      }}
                      onReviewUpdated={() => {
                        showToast("success", "Đã cập nhật đánh giá thành công.");
                      }}
                      onRewardClaimed={({ coinBalance }) => {
                        refreshUserProfile?.(token);
                        const parsed = Number(coinBalance);
                        if (Number.isFinite(parsed) && parsed > 0) {
                          showToast("success", `Đã nhận thưởng. Ví Xu: ${parsed.toLocaleString("vi-VN")} Xu`);
                        } else {
                          showToast("success", "Đã nhận thưởng Xu.");
                        }
                      }}
                    />
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Tiền sản phẩm</span>
                    <span className="font-semibold text-slate-900">
                      {formatPrice(itemsTotal)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-slate-600">
                    <span>Phí ship</span>
                    <span>{formatPrice(deliveryFee)}</span>
                  </div>
                  {voucherDiscount > 0 ? (
                    displayVoucherEntries.length > 0 ? (
                      displayVoucherEntries.map((entry) => {
                          const codeLabel = entry.voucherCode
                            ? ` (${entry.voucherCode})`
                            : "";
                          const label =
                            entry.key === "shipping"
                              ? `Voucher ship${codeLabel}`
                              : `Voucher${codeLabel}`;

                          return (
                            <div
                              key={`voucher-${entry.key}-${entry.voucherCode || "na"}`}
                              className="mt-2 flex items-center justify-between text-emerald-700"
                            >
                              <span>{label}</span>
                              <span className="font-semibold">
                                -{formatPrice(entry.discount)}
                              </span>
                            </div>
                          );
                        })
                    ) : (
                      <div className="mt-2 flex items-center justify-between text-emerald-700">
                        <span>
                          {voucherCodeSummary ? `Voucher (${voucherCodeSummary})` : "Voucher"}
                        </span>
                        <span className="font-semibold">
                          -{formatPrice(voucherDiscount)}
                        </span>
                      </div>
                    )
                  ) : null}
                  <div className="mt-3 flex items-center justify-between text-base font-semibold text-orange-500">
                    <span>Tổng tiền</span>
                    <span>{formatPrice(totalAmount)}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailOrder(null)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            );
          })()}
        </ModalShell>
      ) : null}

      {trackingOrder ? (
        <ModalShell
          title="Theo dõi đơn hàng"
          subtitle={getOrderCode(trackingOrder)}
          onClose={() => {
            setTrackingOrder(null);
            setTrackingInfo(null);
            setTrackingError("");
          }}
        >
          {trackingLoading ? (
            <p className="text-sm text-slate-500">Đang cập nhật trạng thái...</p>
          ) : trackingError ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
              {trackingError}
            </div>
          ) : (
            (() => {
              const fallbackRaw = getOrderStatusValue(trackingOrder);
              const statusKey =
                trackingInfo?.statusKey ||
                getStatusKey(fallbackRaw);
              const statusLabel =
                trackingInfo?.statusLabel ||
                resolveStatusLabel(statusKey, fallbackRaw);
              const currentIndex = getStatusIndex(statusKey);
              const updatedAt = trackingInfo?.updatedAt
                ? formatDateTime(trackingInfo.updatedAt)
                : formatDateTime(getCreatedAt(trackingOrder));
              const timing = trackingInfo?.timing || trackingOrder?.timing || {};

              if (statusKey === "cancelled") {
                return (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <XCircle className="h-5 w-5" />
                      Đơn hàng đã bị hủy
                    </div>
                    {updatedAt ? (
                      <p className="mt-2 text-xs text-rose-600">
                        Cập nhật: {updatedAt}
                      </p>
                    ) : null}
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                    Trạng thái hiện tại: <span className="font-semibold">{statusLabel}</span>
                    {updatedAt ? (
                      <span className="ml-2 text-xs text-amber-600">({updatedAt})</span>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {TRACKING_STEPS.map((step, index) => {
                      const isDone = currentIndex > index;
                      const isActive = currentIndex === index;
                      const Icon = step.Icon || Clock;
                      const stepTime =
                        step.key === "pending"
                          ? getCreatedAt(trackingOrder)
                          : step.key === "preparing"
                          ? timing?.startPrepAt
                          : step.key === "delivering"
                          ? timing?.startDeliveryAt
                          : step.key === "completed"
                          ? timing?.finishAt
                          : null;
                      const timeLabel = formatDateTime(stepTime);
                      const cardStyle = isDone
                        ? "border-emerald-200 bg-emerald-50"
                        : isActive
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-100 bg-slate-50";
                      const iconStyle = isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 text-slate-500";

                      return (
                        <div key={step.key} className={`flex items-start gap-3 rounded-xl border p-3 ${cardStyle}`}>
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconStyle}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                            <p className="text-xs text-slate-500">
                              {isDone ? "Hoàn thành" : isActive ? "Đang xử lý" : "Chưa đến"}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">{timeLabel || "--"}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setTrackingOrder(null);
                setTrackingInfo(null);
                setTrackingError("");
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
};

export default MyOrders;



