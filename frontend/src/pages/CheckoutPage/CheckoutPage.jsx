import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useRef } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { StoreContext } from "../../context/StoreContext";
import { createSepayOrder, previewOrderEta } from "../../api/orderApi";
import { formatVND } from "../../utils/currency";
import { formatToppingsInline, toppingsKeyPart } from "../../utils/toppings";
import {
  BUY_NOW_ITEMS_KEY,
  DELIVERY_METRICS_KEY,
  DIRECT_CHECKOUT_ITEMS_KEY,
  REORDER_CHECKOUT_META_KEY,
  SELECTED_CART_LINE_KEYS_KEY,
} from "../../features/reorder/constants";
import { validateLineItemToppingQuantities } from "../../features/reorder/reorderUtils";
import "../PlaceOrder/PlaceOrder.css";
import "./CheckoutPage.css";
import CheckoutAddress from "./CheckoutAddress";
import CheckoutMap from "./CheckoutMap";

const STORE_LOCATION = { lat: 10.0705, lng: 105.81236 };
const PROVINCES_API_URL = "https://provinces.open-api.vn/api";
const STORE_ADDRESS = "Phường Bình Minh, Tỉnh Vĩnh Long, Việt Nam";
const MAX_DELIVERY_DISTANCE_KM = 20;
const PREP_MINUTES_DRINK = 3;
const PREP_MINUTES_FOOD = 2;
const TRAVEL_MINUTES_PER_KM = 2.5;
const ADDON_ACTIVE_ORDER_KEY = "addon_active_order";
const OSRM_BASE_URL = "https://router.project-osrm.org";

const shopIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const customerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const toRad = (value) => (value * Math.PI) / 180;

const calcDistanceByHaversine = (origin, destination) => {
  if (
    !Number.isFinite(origin?.lat) ||
    !Number.isFinite(origin?.lng) ||
    !Number.isFinite(destination?.lat) ||
    !Number.isFinite(destination?.lng)
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(destination.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
};

const roundToThousand = (value) => Math.round(Number(value || 0) / 1000) * 1000;

const calcDeliveryFee = (distanceKm) => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const baseFee = 10000;
  const freeDistanceKm = 1;
  const feePerKm = 5000;

  if (distanceKm <= freeDistanceKm) return baseFee;

  const extraDistanceKm = distanceKm - freeDistanceKm;
  const extraFee = extraDistanceKm * feePerKm;
  return roundToThousand(baseFee + extraFee);
};

const calcDeliveryTime = (distanceKm, prepMinutes) => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  const prepTime = Math.max(0, Number(prepMinutes || 0));
  const travelTime = distanceKm * TRAVEL_MINUTES_PER_KM;
  return Math.max(1, Math.round(prepTime + travelTime));
};

const buildAddressText = ({ detailAddress, ward, district, province }) =>
  [detailAddress, ward, district, province].filter(Boolean).join(", ");

const getAddressId = (address) => String(address?._id || address?.id || "");

const stripPostalCodes = (text) => {
  if (!text) return "";
  const cleaned = String(text)
    .replace(/(\s*,?\s*)\b\d{5,6}\b(?=\s*,|\s*$)/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .trim();
  return cleaned;
};

const normalizeVietnamPhone = (value) => {
  const raw = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (raw.startsWith("+84")) return `0${raw.slice(3)}`;
  if (raw.startsWith("84")) return `0${raw.slice(2)}`;
  return raw;
};

const isValidVietnamPhone = (value) => /^0[35789]\d{8}$/.test(normalizeVietnamPhone(value));

const resolveAddressLabel = (address) => {
  const rawLabel = String(address?.label || address?.address_label || address?.type || "Other").toLowerCase();
  if (rawLabel.includes("home") || rawLabel.includes("nhà")) return "Nhà riêng";
  if (rawLabel.includes("work") || rawLabel.includes("công ty")) return "Công ty";
  return "Khác";
};

const normalizeAddressText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s,/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseReorderCheckoutMeta = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(REORDER_CHECKOUT_META_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (String(parsed?.source || "").trim() !== "reorder") return null;
    return parsed;
  } catch {
    return null;
  }
};

const findBestAddressMatchFromReorder = (addresses, shippingAddress) => {
  const list = Array.isArray(addresses) ? addresses : [];
  if (!list.length || !shippingAddress) return null;

  const targetLat = Number(shippingAddress?.lat);
  const targetLng = Number(shippingAddress?.lng);

  if (Number.isFinite(targetLat) && Number.isFinite(targetLng)) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    list.forEach((address) => {
      const lat = Number(address?.lat);
      const lng = Number(address?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const distance = calcDistanceByHaversine(
        { lat: targetLat, lng: targetLng },
        { lat, lng }
      );
      if (!Number.isFinite(distance)) return;
      if (distance < bestDistance) {
        best = address;
        bestDistance = distance;
      }
    });

    if (best && bestDistance <= 1) return best;
  }

  const targetText = normalizeAddressText(shippingAddress?.address || "");
  if (!targetText) return null;

  return (
    list.find((address) => {
      const candidateText = normalizeAddressText(address?.address || "");
      if (!candidateText) return false;
      return candidateText === targetText || candidateText.includes(targetText) || targetText.includes(candidateText);
    }) || null
  );
};

const pickLatestAddress = (addresses) => {
  const list = Array.isArray(addresses) ? addresses : [];
  if (!list.length) return null;

  const toTimestamp = (value) => {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getLatestTime = (address) =>
    Math.max(
      toTimestamp(address?.updatedAt || address?.updated_at),
      toTimestamp(address?.createdAt || address?.created_at)
    );

  return [...list].sort((a, b) => getLatestTime(b) - getLatestTime(a))[0] || list[0] || null;
};

const formatCustomOptionsInline = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return String(raw).trim();
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : item?.name || item?.label || ""))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof raw === "object") {
    return Object.entries(raw)
      .filter(([, value]) => value != null && String(value).trim() !== "")
      .map(([key, value]) => `${key}: ${String(value).trim()}`)
      .join(", ");
  }
  return "";
};

const normalizeLocationName = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(tinh|thanh pho|tp)\s+/i, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const matchLocationByName = (items, name) => {
  if (!Array.isArray(items) || !name) return null;
  const target = normalizeLocationName(name);
  if (!target) return null;
  return (
    items.find((item) => normalizeLocationName(item?.name) === target) ||
    items.find((item) => normalizeLocationName(item?.name).includes(target)) ||
    items.find((item) => target.includes(normalizeLocationName(item?.name))) ||
    null
  );
};

const buildRoadTextFromNominatim = (addressData) => {
  if (!addressData) return "";
  const roadLike =
    addressData.road ||
    addressData.residential ||
    addressData.pedestrian ||
    addressData.footway ||
    addressData.path ||
    "";
  const house = addressData.house_number || "";
  return [house, roadLike].filter(Boolean).join(" ").trim();
};

const customOptionsKeyPart = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return String(raw).trim();
  if (Array.isArray(raw)) {
    return raw
      .map((entry) =>
        typeof entry === "string"
          ? entry.trim()
          : `${String(entry?.name || entry?.label || "").trim()}:${String(entry?.value || "").trim()}`
      )
      .filter(Boolean)
      .sort()
      .join(",");
  }
  if (typeof raw === "object") {
    return Object.keys(raw)
      .sort()
      .map((key) => `${key}:${String(raw[key] ?? "").trim()}`)
      .join(",");
  }
  return "";
};

const buildLineKey = ({ productId, size, sugarLevel, iceLevel, toppings, note, customOptions }) =>
  [
    productId,
    size || "",
    sugarLevel || "",
    iceLevel || "",
    toppingsKeyPart(toppings),
    String(note || "").trim(),
    customOptionsKeyPart(customOptions),
  ].join("|");

const buildOrderErrorMessage = (errorData, fallback = "Đặt hàng thất bại.") => {
  const message = String(errorData?.message || fallback).trim();
  const shortages = Array.isArray(errorData?.details?.shortages) ? errorData.details.shortages : [];
  const isToppingShortage = message.toLowerCase().includes("topping");

  if (isToppingShortage && shortages.length > 0) {
    const names = shortages
      .map((item) => String(item?.name || "").trim())
      .filter(Boolean);
    const label = names.length ? names.join(", ") : "Topping";
    return `${label} đã hết hoặc không đủ số lượng. Vui lòng chọn topping khác.`;
  }

  return message || fallback;
};

const resolveImageSrc = (value, baseUrl) => {
  if (!value) return "";
  if (/^data:/i.test(value) || /^https?:\/\//i.test(value)) return value;
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

const TooltipInfo = ({ ariaLabel, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={`info-tooltip-wrap ${isOpen ? "active" : ""}`} onMouseLeave={() => setIsOpen(false)}>
      <button
        type="button"
        className="info-icon"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        onBlur={() => setIsOpen(false)}
      >
        !
      </button>
      <span className={`info-tooltip ${isOpen ? "visible" : ""}`}>{children}</span>
    </span>
  );
};

const CheckoutPage = () => {
  const {
    token,
    cartLineItems,
    isCartLoading,
    url,
    addToCart,
    removeFromCart,
    voucherIntent,
    saveVoucherIntent,
    clearVoucherIntent,
    pushVoucherToast,
  } = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();
  const forceMainCartCheckout = String(location?.state?.checkoutSource || "").trim() === "cart-main";
  const [reorderPreload] = useState(() =>
    forceMainCartCheckout ? null : parseReorderCheckoutMeta()
  );
  const [addonOrderId] = useState(() => localStorage.getItem(ADDON_ACTIVE_ORDER_KEY) || "");

  useEffect(() => {
    if (!forceMainCartCheckout) return;
    localStorage.removeItem(REORDER_CHECKOUT_META_KEY);
  }, [forceMainCartCheckout]);

  const [directCheckout, setDirectCheckout] = useState(() => {
    if (forceMainCartCheckout) {
      return { storageKey: "", items: [] };
    }

    const parseList = (key) => {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(stored) ? stored : [];
      } catch {
        return [];
      }
    };

    const sanitize = (items, key) => {
      const safeItems = Array.isArray(items) ? items : [];
      const sanitized = safeItems.filter((item) => {
        const productId = item?.productId || item?._id || item?.id || "";
        return Boolean(String(productId || "").trim());
      });

      if (safeItems.length > 0 && sanitized.length === 0) {
        localStorage.removeItem(key);
      }

      return sanitized;
    };

    const buyNowItems = sanitize(parseList(BUY_NOW_ITEMS_KEY), BUY_NOW_ITEMS_KEY);
    if (buyNowItems.length > 0) {
      return { storageKey: BUY_NOW_ITEMS_KEY, items: buyNowItems };
    }

    const checkoutItems = sanitize(parseList(DIRECT_CHECKOUT_ITEMS_KEY), DIRECT_CHECKOUT_ITEMS_KEY);
    if (checkoutItems.length > 0) {
      return { storageKey: DIRECT_CHECKOUT_ITEMS_KEY, items: checkoutItems };
    }

    return { storageKey: "", items: [] };
  });

  const directCheckoutItems = useMemo(
    () => (Array.isArray(directCheckout?.items) ? directCheckout.items : []),
    [directCheckout?.items]
  );
  const isDirectCheckout = Boolean(directCheckout?.storageKey);

  const persistDirectCheckoutItems = useCallback((items) => {
    const storageKey = directCheckout?.storageKey || "";
    if (!storageKey) return;

    if (!Array.isArray(items) || items.length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [directCheckout?.storageKey]);

  const updateDirectCheckoutItems = useCallback((updater) => {
    setDirectCheckout((prev) => {
      const safePrev = Array.isArray(prev?.items) ? prev.items : [];
      const next = typeof updater === "function" ? updater(safePrev) : safePrev;
      persistDirectCheckoutItems(next);
      return { ...prev, items: next };
    });
  }, [persistDirectCheckoutItems]);

  const getDirectLineKey = useCallback((rawItem) => {
    const productId = rawItem?.productId || rawItem?._id || rawItem?.id || "";
    return buildLineKey({
      productId,
      size: rawItem?.size || "",
      sugarLevel: rawItem?.sugarLevel || "",
      iceLevel: rawItem?.iceLevel || "",
      toppings: rawItem?.toppings || [],
      note: rawItem?.note || "",
      customOptions: rawItem?.customOptions || null,
    });
  }, []);

  const directCheckoutLineItems = useMemo(() => {
    if (!isDirectCheckout) return [];

    return (directCheckoutItems || [])
      .map((rawItem) => {
        const productId = rawItem?.productId || rawItem?._id || rawItem?.id || "";
        if (!productId) return null;

        const unitPrice = Number(rawItem?.price || 0) || 0;
        const quantity = Math.max(1, Math.round(Number(rawItem?.quantity || 1)));
        const size = String(rawItem?.size || "").trim();
        const sugarLevel = String(rawItem?.sugarLevel || "").trim();
        const iceLevel = String(rawItem?.iceLevel || "").trim();
        const toppings = rawItem?.toppings || [];
        const note = String(rawItem?.note || "").trim();
        const customOptions = rawItem?.customOptions || null;
        const lineKey = getDirectLineKey({
          ...rawItem,
          productId,
          size,
          sugarLevel,
          iceLevel,
          toppings,
          note,
          customOptions,
        });

        return {
          productId,
          product: {
            _id: productId,
            name: String(rawItem?.name || "").trim(),
            image: rawItem?.image || "",
            type: rawItem?.type || "",
          },
          unitPrice,
          quantity,
          lineTotal: unitPrice * quantity,
          size,
          sugarLevel,
          iceLevel,
          toppings,
          note,
          customOptions,
          lineKey,
          productType: rawItem?.type || "",
        };
      })
      .filter(Boolean);
  }, [directCheckoutItems, getDirectLineKey, isDirectCheckout]);

  const [canRedirectCart, setCanRedirectCart] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [isAddressListOpen, setIsAddressListOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const [deliveryAddress, setDeliveryAddress] = useState({
    name: "",
    phone: "",
    address: "",
    lat: null,
    lng: null,
  });
  const [isVoucherLoading, setIsVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [voucherHint, setVoucherHint] = useState(null);
  const [selectedOrderVoucherId, setSelectedOrderVoucherId] = useState("");
  const [selectedShippingVoucherId, setSelectedShippingVoucherId] = useState("");
  const autoVoucherPickedRef = useRef(false);
  const preselectVoucherRef = useRef({ code: "", codesKey: "" });
  const userPickedVoucherRef = useRef(false);
  const [distance, setDistance] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryTime, setDeliveryTime] = useState(null);
  const [etaPreview, setEtaPreview] = useState(null);
  const [etaPreviewLoading, setEtaPreviewLoading] = useState(false);
  const [etaPreviewError, setEtaPreviewError] = useState("");
  const [route, setRoute] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");
  const [selectedWardCode, setSelectedWardCode] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [pendingEditAddress, setPendingEditAddress] = useState(null);
  const [orderNote, setOrderNote] = useState(() =>
    String(reorderPreload?.note || "").trim()
  );
  const [paymentMethod] = useState(() =>
    String(reorderPreload?.paymentMethod || "sepay").trim().toLowerCase() || "sepay"
  );
  const [addressError, setAddressError] = useState("");
  const [deleteAddressTarget, setDeleteAddressTarget] = useState(null);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);
  const addressSectionRef = useRef(null);
  const reorderPrefillAppliedRef = useRef(false);

  const pickedDistanceKm = useMemo(() => {
    if (showMap && selectedLocation) {
      return calcDistanceByHaversine(STORE_LOCATION, selectedLocation);
    }

    if (Number.isFinite(deliveryAddress.lat) && Number.isFinite(deliveryAddress.lng)) {
      return calcDistanceByHaversine(STORE_LOCATION, {
        lat: deliveryAddress.lat,
        lng: deliveryAddress.lng,
      });
    }

    return null;
  }, [showMap, selectedLocation, deliveryAddress.lat, deliveryAddress.lng]);

  useEffect(() => {
    if (reorderPrefillAppliedRef.current) return;
    const shipping = reorderPreload?.shippingAddress || null;
    if (!shipping) return;

    reorderPrefillAppliedRef.current = true;

    const lat = Number(shipping?.lat);
    const lng = Number(shipping?.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const shippingAddressText = String(shipping?.address || "").trim();
    const shippingName = String(shipping?.name || "").trim();
    const shippingPhone = String(shipping?.phone || "").trim();

    setDeliveryAddress((prev) => ({
      ...prev,
      name: prev?.name || shippingName,
      phone: prev?.phone || shippingPhone,
      address: prev?.address || shippingAddressText,
      lat: hasCoords ? lat : prev?.lat,
      lng: hasCoords ? lng : prev?.lng,
    }));

    if (!hasCoords) return;

    const distanceFromMeta = Number(shipping?.distanceKm);
    const nextDistance = Number.isFinite(distanceFromMeta)
      ? distanceFromMeta
      : calcDistanceByHaversine(STORE_LOCATION, { lat, lng });

    const feeFromMeta = Number(shipping?.deliveryFee);
    const timeFromMeta = Number(shipping?.deliveryTime);

    if (Number.isFinite(nextDistance)) {
      setDistance(nextDistance);
      setDeliveryFee(
        Number.isFinite(feeFromMeta) ? roundToThousand(feeFromMeta) : calcDeliveryFee(nextDistance)
      );
      if (Number.isFinite(timeFromMeta)) {
        setDeliveryTime(timeFromMeta);
      }
    }
  }, [reorderPreload]);

  const isOutOfDeliveryRange =
    Number.isFinite(pickedDistanceKm) && pickedDistanceKm > MAX_DELIVERY_DISTANCE_KM;

  const handleIncreaseItem = useCallback(
    async (item) => {
      if (isDirectCheckout) {
        const targetKey =
          item?.lineKey ||
          buildLineKey({
            productId: item?.product?._id || item?.productId,
            size: item?.size || "",
            sugarLevel: item?.sugarLevel || "",
            iceLevel: item?.iceLevel || "",
            toppings: item?.toppings || [],
            note: item?.note || "",
            customOptions: item?.customOptions || null,
          });

        updateDirectCheckoutItems((prev) => {
          const index = prev.findIndex((raw) => getDirectLineKey(raw) === targetKey);
          if (index < 0) return prev;
          const next = [...prev];
          const current = next[index];
          const currentQty = Math.max(1, Math.round(Number(current?.quantity || 1)));
          next[index] = { ...current, quantity: currentQty + 1 };
          return next;
        });
        return;
      }

      const productId = item?.product?._id || item?.productId;
      if (!productId) return;

      await addToCart({
        productId,
        itemId: productId,
        size: item?.size || "",
        sugarLevel: item?.sugarLevel || "",
        iceLevel: item?.iceLevel || "",
        toppings: item?.toppings || [],
        quantity: 1,
        price: item?.unitPrice || 0,
      });
    },
    [addToCart, getDirectLineKey, isDirectCheckout, updateDirectCheckoutItems]
  );

  const handleDecreaseItem = useCallback(
    async (item) => {
      if (isDirectCheckout) {
        const targetKey =
          item?.lineKey ||
          buildLineKey({
            productId: item?.product?._id || item?.productId,
            size: item?.size || "",
            sugarLevel: item?.sugarLevel || "",
            iceLevel: item?.iceLevel || "",
            toppings: item?.toppings || [],
            note: item?.note || "",
            customOptions: item?.customOptions || null,
          });

        updateDirectCheckoutItems((prev) => {
          const index = prev.findIndex((raw) => getDirectLineKey(raw) === targetKey);
          if (index < 0) return prev;
          const next = [...prev];
          const current = next[index];
          const currentQty = Math.max(1, Math.round(Number(current?.quantity || 1)));
          if (currentQty <= 1) {
            next.splice(index, 1);
            return next;
          }
          next[index] = { ...current, quantity: currentQty - 1 };
          return next;
        });
        return;
      }

      const productId = item?.product?._id || item?.productId;
      if (!productId) return;

      await removeFromCart({
        productId,
        itemId: productId,
        size: item?.size || "",
        sugarLevel: item?.sugarLevel || "",
        iceLevel: item?.iceLevel || "",
        toppings: item?.toppings || [],
      });
    },
    [getDirectLineKey, isDirectCheckout, removeFromCart, updateDirectCheckoutItems]
  );

  const selectedLineKeys = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SELECTED_CART_LINE_KEYS_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }, []);

  const effectiveCartLineItems = useMemo(() => {
    if (isDirectCheckout) return directCheckoutLineItems;
    if (!selectedLineKeys.length) return cartLineItems;
    const filtered = cartLineItems.filter((item) =>
      selectedLineKeys.includes(
        item?.lineKey ||
          buildLineKey({
            productId: item?.product?._id || item?.productId,
            size: item?.size || "",
            sugarLevel: item?.sugarLevel || "",
            iceLevel: item?.iceLevel || "",
            toppings: item?.toppings || [],
            note: item?.note || "",
            customOptions: item?.customOptions || null,
          })
      )
    );
    return filtered.length > 0 ? filtered : cartLineItems;
  }, [cartLineItems, directCheckoutLineItems, isDirectCheckout, selectedLineKeys]);

  const subtotal = useMemo(
    () => effectiveCartLineItems.reduce((sum, item) => sum + Number(item?.lineTotal || 0), 0),
    [effectiveCartLineItems]
  );

  const cartSnapshot = useMemo(
    () =>
      effectiveCartLineItems.map((item) => ({
        productId: item?.product?._id || item?.productId,
        lineTotal: Number(item?.lineTotal || 0),
        quantity: Number(item?.quantity || 0),
        productType: String(item?.product?.type || ""),
        categoryId: String(item?.product?.categoryId || ""),
        categoryName: String(item?.product?.category || ""),
      })),
    [effectiveCartLineItems]
  );

  const etaItemsPayload = useMemo(
    () =>
      cartSnapshot.map((item) => ({
        quantity: Number(item?.quantity || 0),
        productType: String(item?.productType || ""),
      })),
    [cartSnapshot]
  );

  const etaRequestKey = useMemo(
    () =>
      etaItemsPayload
        .map((item) => `${item.productType}:${item.quantity}`)
        .join("|"),
    [etaItemsPayload]
  );
  const orderVouchers = useMemo(
    () => availableVouchers.filter((voucher) => String(voucher?.voucherType || "").toUpperCase() !== "SHIPPING"),
    [availableVouchers]
  );
  const shippingVouchers = useMemo(
    () => availableVouchers.filter((voucher) => String(voucher?.voucherType || "").toUpperCase() === "SHIPPING"),
    [availableVouchers]
  );

  useEffect(() => {
    const existingCode = String(voucherIntent?.code || "").trim();
    if (existingCode) return;

    const orderVoucher = reorderPreload?.voucher?.order || null;
    const shippingVoucher = reorderPreload?.voucher?.shipping || null;
    const preferred = orderVoucher?.voucherCode ? orderVoucher : shippingVoucher;
    if (!preferred?.voucherCode) return;

    saveVoucherIntent?.(
      {
        _id: preferred?.voucherId || "",
        voucherCode: preferred.voucherCode,
      },
      "pending",
      {
        pendingVoucherId: preferred?.voucherId || "",
        silentAutoApply: true,
      }
    );
  }, [reorderPreload, saveVoucherIntent, voucherIntent?.code]);

  // =========================
  // Preselect voucher từ nơi khác (Home/MyVouchers)
  // Dùng query param: /checkout?voucher=CODE
  // =========================
  useEffect(() => {
    const params = new URLSearchParams(String(location?.search || ""));
    const queryCode = String(params.get("voucher") || "").trim().toUpperCase();
    const intentCode = String(voucherIntent?.code || "").trim().toUpperCase();
    const code = queryCode || intentCode;

    if (!code) {
      preselectVoucherRef.current = { code: "", codesKey: "" };
      return;
    }

    if (userPickedVoucherRef.current) return;
    if (selectedOrderVoucherId || selectedShippingVoucherId) return;
    if (!Array.isArray(availableVouchers) || availableVouchers.length === 0) return;

    const codesKey = availableVouchers
      .map((v) => String(v?.voucherCode || "").trim().toUpperCase())
      .filter(Boolean)
      .sort()
      .join("|");

    if (preselectVoucherRef.current.code === code && preselectVoucherRef.current.codesKey === codesKey) {
      return;
    }

    const matched = availableVouchers.find(
      (voucher) => String(voucher?.voucherCode || "").trim().toUpperCase() === code
    );

    if (matched) {
      const voucherType = String(matched?.voucherType || "").toUpperCase();
      if (voucherType === "SHIPPING") {
        setSelectedShippingVoucherId(String(matched?._id || ""));
      } else {
        setSelectedOrderVoucherId(String(matched?._id || ""));
      }

      saveVoucherIntent?.(matched, "applied");
      setVoucherError("");
    } else {
      setVoucherError("Voucher không phù hợp với giỏ hàng.");
    }

    autoVoucherPickedRef.current = true;
    preselectVoucherRef.current = { code, codesKey };
  }, [
    availableVouchers,
    location?.search,
    voucherIntent?.code,
    selectedOrderVoucherId,
    selectedShippingVoucherId,
    saveVoucherIntent,
  ]);
  const bestVoucher = useMemo(() => {
    let best = null;
    let bestDiscount = 0;

    availableVouchers.forEach((voucher) => {
      const voucherType = String(voucher?.voucherType || "").toUpperCase();
      const rawDiscount = Number(voucher?.estimatedDiscount || 0);
      const discount = voucherType === "SHIPPING" ? Math.min(rawDiscount, deliveryFee) : rawDiscount;

      if (discount > bestDiscount) {
        bestDiscount = discount;
        best = voucher;
      }
    });

    if (!best || bestDiscount <= 0) return null;
    return { ...best, _bestDiscount: bestDiscount };
  }, [availableVouchers, deliveryFee]);
  const selectedOrderVoucher = useMemo(
    () => orderVouchers.find((voucher) => String(voucher._id) === String(selectedOrderVoucherId)) || null,
    [orderVouchers, selectedOrderVoucherId]
  );
  const selectedShippingVoucher = useMemo(
    () => shippingVouchers.find((voucher) => String(voucher._id) === String(selectedShippingVoucherId)) || null,
    [shippingVouchers, selectedShippingVoucherId]
  );
  const orderVoucherDiscount = Number(selectedOrderVoucher?.estimatedDiscount || 0);
  const shippingVoucherDiscount = Math.min(Number(selectedShippingVoucher?.estimatedDiscount || 0), deliveryFee);
  const voucherDiscount = orderVoucherDiscount + shippingVoucherDiscount;
  const totalBeforeDiscount = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee]);
  const total = useMemo(
    () => Math.max(0, totalBeforeDiscount - voucherDiscount),
    [totalBeforeDiscount, voucherDiscount]
  );
  const paymentMethodLabel = useMemo(() => {
    const method = String(paymentMethod || "").trim().toLowerCase();
    if (method === "cod" || method === "cash") return "Thanh toán khi nhận hàng";
    if (method === "momo") return "Ví MoMo";
    if (method === "zalopay") return "ZaloPay";
    if (method === "bank_transfer") return "Chuyển khoản ngân hàng";
    if (method === "sepay") return "SePay";
    return method || "SePay";
  }, [paymentMethod]);
  const shippingDisplay = distance !== null ? formatVND(deliveryFee) : "--";
  const prepCounts = useMemo(() => {
    let drinkCount = 0;
    let foodCount = 0;
    cartSnapshot.forEach((item) => {
      const qty = Number(item?.quantity || 0);
      const type = String(item?.productType || "").toLowerCase();
      const name = String(item?.name || "").toLowerCase();
      const isDrink =
        type.includes("drink") ||
        type.includes("beverage") ||
        type.includes("coffee") ||
        type.includes("nuoc") ||
        item?.sugarLevel ||
        item?.iceLevel;
      if (isDrink) {
        drinkCount += qty;
      } else if (
        type.includes("food") ||
        name.includes("bánh") ||
        name.includes("banh") ||
        name.includes("cake") ||
        name.includes("dessert")
      ) {
        foodCount += qty;
      } else {
        foodCount += qty;
      }
    });
    return { drinkCount, foodCount };
  }, [cartSnapshot]);
  const prepMinutes = useMemo(
    () => prepCounts.drinkCount * PREP_MINUTES_DRINK + prepCounts.foodCount * PREP_MINUTES_FOOD,
    [prepCounts]
  );

  const selectedProvince = useMemo(
    () => provinces.find((item) => String(item.code) === selectedProvinceCode) || null,
    [provinces, selectedProvinceCode]
  );
  const selectedDistrict = useMemo(
    () => districts.find((item) => String(item.code) === selectedDistrictCode) || null,
    [districts, selectedDistrictCode]
  );
  const selectedWard = useMemo(
    () => wards.find((item) => String(item.code) === selectedWardCode) || null,
    [wards, selectedWardCode]
  );

  const clearDeliveryMetrics = useCallback(() => {
    setDistance(null);
    setDeliveryFee(0);
    setDeliveryTime(null);
    setDeliveryAddress((prev) => ({ ...prev, lat: null, lng: null }));
    setIsManualLocation(false);
    localStorage.removeItem(DELIVERY_METRICS_KEY);
  }, []);

  const applyAddress = useCallback(
    (address) => {
      if (isManualLocation) return;
      if (!address) return;

      const provinceName = String(address.province || "");
      const districtName = String(address.district || "");
      const wardName = String(address.ward || "");
      const detail = String(address.detail_address || address.detailAddress || "");

      setDetailAddress(detail);
      const fullAddressText = stripPostalCodes(
        String(address.address || "").trim() ||
          buildAddressText({
            detailAddress: detail,
            ward: wardName,
            district: districtName,
            province: provinceName,
          })
      );

      const lat = Number(address.lat);
      const lng = Number(address.lng);
      setDeliveryAddress({
        name: String(address.name || ""),
        phone: String(address.phone || ""),
        address: stripPostalCodes(fullAddressText),
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      });
      setIsManualLocation(false);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const distanceKm = calcDistanceByHaversine(STORE_LOCATION, { lat, lng });
        setDistance(distanceKm);
        setDeliveryFee(calcDeliveryFee(distanceKm));
        setDeliveryTime(calcDeliveryTime(distanceKm, prepMinutes));
      } else {
        clearDeliveryMetrics();
      }
    },
    [clearDeliveryMetrics, prepMinutes, isManualLocation]
  );

  const fetchAddresses = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${url}/api/user/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = Array.isArray(response?.data?.addresses)
        ? response.data.addresses
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : [];

      setAddresses(list);

      if (list.length === 0) {
        setIsAddingNewAddress(false);
        setIsAddressListOpen(false);
        return;
      }

      const matchedAddress = findBestAddressMatchFromReorder(
        list,
        reorderPreload?.shippingAddress || null
      );
      const hasReorderShippingAddress = Boolean(reorderPreload?.shippingAddress);
      const latestAddress = pickLatestAddress(list);
      const defaultAddress = matchedAddress
        || (hasReorderShippingAddress ? latestAddress : null)
        || list.find((item) => Boolean(item?.is_default))
        || latestAddress
        || list[0];
      setSelectedAddressId(getAddressId(defaultAddress));
      setIsAddingNewAddress(false);
      setIsAddressListOpen(false);
    } catch (error) {
      console.error("Lỗi tải danh sách địa chỉ:", error);
      setAddresses([]);
      setIsAddingNewAddress(false);
    }
  }, [reorderPreload?.shippingAddress, token, url]);

  const handlePickLocation = useCallback(
    async ({ lat, lng }) => {
      const distanceKm = calcDistanceByHaversine(STORE_LOCATION, { lat, lng });
      const fee = calcDeliveryFee(distanceKm);
      const time = calcDeliveryTime(distanceKm, prepMinutes);
      let resolvedAddress = "";
      let resolvedRoad = "";
      try {
        const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
          params: { format: "json", lat, lon: lng },
        });
        resolvedAddress = String(response?.data?.display_name || "");
        resolvedRoad = buildRoadTextFromNominatim(response?.data?.address || null);
      } catch (error) {
        console.error("Lỗi lấy địa chỉ từ bản đồ:", error);
      }

      const fallbackAddress = String(deliveryAddress.address || "").trim();
      const hasSelectedLocation = Boolean(selectedProvince || selectedDistrict || selectedWard);
      const detailText = resolvedRoad || detailAddress.trim();
      const composedAddress = hasSelectedLocation
        ? buildAddressText({
            detailAddress: detailText,
            ward: selectedWard?.name,
            district: selectedDistrict?.name,
            province: selectedProvince?.name,
          })
        : "";
      const cleanedAddress = stripPostalCodes(composedAddress || resolvedAddress || fallbackAddress);
      setDeliveryAddress((prev) => ({
        ...prev,
        lat,
        lng,
        address: cleanedAddress,
      }));
      setDistance(distanceKm);
      setDeliveryFee(roundToThousand(fee));
      setDeliveryTime(time);
    },
    [prepMinutes, deliveryAddress.address, detailAddress, selectedProvince, selectedDistrict, selectedWard]
  );

  const fetchRoute = useCallback(async (target) => {
    const storeLat = Number(STORE_LOCATION.lat);
    const storeLng = Number(STORE_LOCATION.lng);
    const customerLat = Number(target?.lat);
    const customerLng = Number(target?.lng);

    if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng) || !Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
      setRoute([]);
      return;
    }

    setRouteLoading(true);
    try {
      const url = `${OSRM_BASE_URL}/route/v1/driving/${storeLng},${storeLat};${customerLng},${customerLat}?overview=full&geometries=geojson`;
      const response = await axios.get(url);
      const coords = response?.data?.routes?.[0]?.geometry?.coordinates || [];
      const converted = coords.map(([lng, lat]) => [lat, lng]);
      setRoute(converted);
    } catch (error) {
      console.error("Loi lay route OSRM:", error);
      setRoute([]);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const routeTarget = useMemo(() => {
    if (showMap && selectedLocation) return selectedLocation;
    if (Number.isFinite(deliveryAddress.lat) && Number.isFinite(deliveryAddress.lng)) {
      return { lat: deliveryAddress.lat, lng: deliveryAddress.lng };
    }
    return null;
  }, [showMap, selectedLocation, deliveryAddress.lat, deliveryAddress.lng]);

  useEffect(() => {
    if (routeTarget) {
      fetchRoute(routeTarget);
    } else {
      setRoute([]);
    }
  }, [fetchRoute, routeTarget]);

  const fetchAvailableVouchers = useCallback(async () => {
    setIsVoucherLoading(true);
    setVoucherError("");
    try {
      const response = await axios.post(
        `${url}/api/vouchers/available`,
        {
          orderAmount: subtotal,
          shippingFee: deliveryFee,
          cartItems: cartSnapshot,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const nextVouchers = Array.isArray(response?.data?.data) ? response.data.data : [];
      setAvailableVouchers(nextVouchers);
      setVoucherHint(response?.data?.hint || null);
      if (nextVouchers.length === 0) {
        setSelectedOrderVoucherId("");
        setSelectedShippingVoucherId("");
      }
    } catch (error) {
      setAvailableVouchers([]);
      setVoucherHint(null);
      setSelectedOrderVoucherId("");
      setSelectedShippingVoucherId("");
      setVoucherError(error?.response?.data?.message || "Không tải được danh sách voucher");
    } finally {
      setIsVoucherLoading(false);
    }
  }, [url, subtotal, deliveryFee, cartSnapshot, token]);

  useEffect(() => {
    if (isCartLoading) {
      setCanRedirectCart(false);
      return;
    }
    setCanRedirectCart(true);
  }, [isCartLoading]);

  useEffect(() => {
    if (isSubmittingOrder) return;
    if (!token) {
      navigate("/cart");
      return;
    }
    if (!canRedirectCart) return;
    if (!Array.isArray(effectiveCartLineItems) || effectiveCartLineItems.length === 0) {
      navigate("/cart");
    }
  }, [token, canRedirectCart, effectiveCartLineItems, navigate, isSubmittingOrder]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    if (!selectedAddressId || !addresses.length) return;
    const selected = addresses.find((item) => getAddressId(item) === String(selectedAddressId));
    if (selected) {
      applyAddress(selected);
    }
  }, [selectedAddressId, addresses, applyAddress]);

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const response = await axios.get(`${PROVINCES_API_URL}/p/`);
        if (Array.isArray(response?.data)) {
          setProvinces(response.data);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách tỉnh/thành:", error);
      }
    };

    fetchProvinces();
  }, []);

  useEffect(() => {
    if (distance === null || !Number.isFinite(deliveryAddress.lat) || !Number.isFinite(deliveryAddress.lng)) return;

    localStorage.setItem(
      DELIVERY_METRICS_KEY,
      JSON.stringify({
        name: deliveryAddress.name,
        phone: deliveryAddress.phone,
        lat: deliveryAddress.lat,
        lng: deliveryAddress.lng,
        distance,
        deliveryFee,
        deliveryTime,
        address: deliveryAddress.address,
        isManual: isManualLocation,
      })
    );
  }, [
    deliveryAddress.name,
    deliveryAddress.phone,
    deliveryAddress.lat,
    deliveryAddress.lng,
    distance,
    deliveryFee,
    deliveryTime,
    deliveryAddress.address,
    isManualLocation,
  ]);

  useEffect(() => {
    const rawMetrics = localStorage.getItem(DELIVERY_METRICS_KEY);
    if (!rawMetrics) return;

    try {
      const parsed = JSON.parse(rawMetrics);
      const lat = Number(parsed?.lat);
      const lng = Number(parsed?.lng);
      const restoredDistance = Number(parsed?.distance);
      const restoredFee = Number(parsed?.deliveryFee);
      const restoredTime = Number(parsed?.deliveryTime);
      const restoredAddress = String(parsed?.address || "");
      const restoredName = String(parsed?.name || "");
      const restoredPhone = String(parsed?.phone || "");
      const restoredIsManual = Boolean(parsed?.isManual);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setDeliveryAddress((prev) => ({
          ...prev,
          name: restoredName || prev.name,
          phone: restoredPhone || prev.phone,
          lat,
          lng,
          address: restoredAddress || prev.address,
        }));
      }
      if (Number.isFinite(restoredDistance)) {
        setDistance(restoredDistance);
      }
        if (Number.isFinite(restoredFee)) {
          setDeliveryFee(roundToThousand(restoredFee));
        }
      if (Number.isFinite(restoredTime)) {
        setDeliveryTime(restoredTime);
      }
      setIsManualLocation(restoredIsManual);
    } catch (error) {
      console.error("Không đọc được dữ liệu giao hàng đã lưu:", error);
    }
  }, []);

  useEffect(() => {
    if (distance === null) return;
    setDeliveryTime(calcDeliveryTime(distance, prepMinutes));
  }, [distance, prepMinutes]);

  // Queue-based ETA preview from backend (includes queueDelay).
  useEffect(() => {
    if (!token) return;
    if (!Number.isFinite(distance) || distance <= 0) {
      setEtaPreview(null);
      setEtaPreviewError("");
      return;
    }
    if (!Array.isArray(etaItemsPayload) || etaItemsPayload.length === 0) {
      setEtaPreview(null);
      setEtaPreviewError("");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setEtaPreviewLoading(true);
      setEtaPreviewError("");
      try {
        const payload = { distanceKm: distance, items: etaItemsPayload };
        const response = await previewOrderEta({ url, token, payload });
        if (cancelled) return;

        if (response?.data?.success) {
          setEtaPreview(response.data.data || null);
          return;
        }

        setEtaPreview(null);
        setEtaPreviewError(response?.data?.message || "Không thể tính ETA");
      } catch (error) {
        if (cancelled) return;
        setEtaPreview(null);
        setEtaPreviewError(error?.response?.data?.message || error?.message || "Không thể tính ETA");
      } finally {
        if (!cancelled) setEtaPreviewLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [distance, etaItemsPayload, etaRequestKey, token, url]);

  useEffect(() => {
    fetchAvailableVouchers();
  }, [fetchAvailableVouchers]);

  useEffect(() => {
    if (selectedOrderVoucherId && !orderVouchers.some((item) => String(item._id) === String(selectedOrderVoucherId))) {
      setSelectedOrderVoucherId("");
    }
    if (selectedShippingVoucherId && !shippingVouchers.some((item) => String(item._id) === String(selectedShippingVoucherId))) {
      setSelectedShippingVoucherId("");
    }
  }, [selectedOrderVoucherId, selectedShippingVoucherId, orderVouchers, shippingVouchers]);

  useEffect(() => {
    if (autoVoucherPickedRef.current) return;

    const params = new URLSearchParams(String(location?.search || ""));
    const queryCode = String(params.get("voucher") || "").trim().toUpperCase();
    const intentCode = String(voucherIntent?.code || "").trim().toUpperCase();
    if (queryCode || intentCode) {
      autoVoucherPickedRef.current = true;
      return;
    }

    if (selectedOrderVoucherId || selectedShippingVoucherId) {
      autoVoucherPickedRef.current = true;
      return;
    }
    if (!bestVoucher?._id) return;

    const voucherType = String(bestVoucher?.voucherType || "").toUpperCase();
    if (voucherType === "SHIPPING") {
      setSelectedShippingVoucherId(String(bestVoucher._id));
      setSelectedOrderVoucherId("");
    } else {
      setSelectedOrderVoucherId(String(bestVoucher._id));
      setSelectedShippingVoucherId("");
    }

    autoVoucherPickedRef.current = true;
  }, [bestVoucher, selectedOrderVoucherId, selectedShippingVoucherId, location?.search, voucherIntent?.code]);


  useEffect(() => {
    if (!isAddingNewAddress || isManualLocation) return;
    if (!selectedProvince || !selectedDistrict || !selectedWard || !detailAddress.trim()) return;

    setDeliveryAddress((prev) => ({
      ...prev,
      address: buildAddressText({
        detailAddress: detailAddress.trim(),
        ward: selectedWard.name,
        district: selectedDistrict.name,
        province: selectedProvince.name,
      }),
    }));
  }, [isAddingNewAddress, isManualLocation, detailAddress, selectedProvince, selectedDistrict, selectedWard]);

  const handleProvinceChange = async (event) => {
    const provinceCode = event.target.value;
    setSelectedProvinceCode(provinceCode);
    setSelectedDistrictCode("");
    setSelectedWardCode("");
    setAddressError("");
    setDistricts([]);
    setWards([]);
    clearDeliveryMetrics();

    if (!provinceCode) return;
    try {
      const response = await axios.get(`${PROVINCES_API_URL}/p/${provinceCode}?depth=2`);
      setDistricts(Array.isArray(response?.data?.districts) ? response.data.districts : []);
    } catch (error) {
      console.error("Lỗi tải quận/huyện:", error);
    }
  };

  const handleDistrictChange = async (event) => {
    const districtCode = event.target.value;
    setSelectedDistrictCode(districtCode);
    setSelectedWardCode("");
    setAddressError("");
    setWards([]);
    clearDeliveryMetrics();

    if (!districtCode) return;
    try {
      const response = await axios.get(`${PROVINCES_API_URL}/d/${districtCode}?depth=2`);
      setWards(Array.isArray(response?.data?.wards) ? response.data.wards : []);
    } catch (error) {
      console.error("Lỗi tải phường/xã:", error);
    }
  };

  const handleSelectAddress = (input) => {
    const id = typeof input === "string" ? input : input?.target?.value;
    if (!id) return;
    setSelectedAddressId(String(id));
    setIsManualLocation(false);
    setIsAddressListOpen(false);
  };

  const handleOpenAddressList = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!addresses.length) return;
    setEditingAddressId("");
    setIsAddingNewAddress(false);
    setIsAddressListOpen(true);
  };

  const handleShowMap = () => {
    const current =
      addresses.find((item) => getAddressId(item) === String(selectedAddressId)) || addresses[0] || null;

    if (current) {
      handleStartEditAddress(current);
      return;
    }

    handleStartAddAddress();
  };

  const handleConfirmLocation = () => {
    if (!selectedLocation) return;
    const distanceKm = calcDistanceByHaversine(STORE_LOCATION, selectedLocation);
    if (Number.isFinite(distanceKm) && distanceKm > MAX_DELIVERY_DISTANCE_KM) {
      alert(
        `Địa chỉ này nằm ngoài phạm vi giao hàng.\nCửa hàng chỉ hỗ trợ giao trong bán kính ${MAX_DELIVERY_DISTANCE_KM}km.`
      );
      return;
    }
    handlePickLocation(selectedLocation);
    setIsManualLocation(true);
    setShowMap(false);
  };

  const handleCloseAddressList = () => {
    setIsAddressListOpen(false);
  };

  const handleStartAddAddress = () => {
    setIsAddingNewAddress(true);
    setIsAddressListOpen(false);
    setEditingAddressId("");
    setSelectedAddressId("");
    setPendingEditAddress(null);
    setDeliveryAddress({ name: "", phone: "", address: "", lat: null, lng: null });
    setSelectedProvinceCode("");
    setSelectedDistrictCode("");
    setSelectedWardCode("");
    setDistricts([]);
    setWards([]);
    setDetailAddress("");
    setSelectedLocation(null);
    setShowMap(true);
    clearDeliveryMetrics();
  };

  const handleStartEditAddress = (address) => {
    if (!address) return;
    setIsAddingNewAddress(true);
    setIsAddressListOpen(false);
    setEditingAddressId(getAddressId(address));
    setSelectedAddressId(getAddressId(address));
    setPendingEditAddress(address);

    setDeliveryAddress((prev) => ({
      ...prev,
      name: String(address.name || ""),
      phone: String(address.phone || ""),
    }));
    setDetailAddress(String(address.detail_address || address.detailAddress || ""));
    setDeliveryAddress((prev) => ({
      ...prev,
      address: buildAddressText({
        detailAddress: String(address.detail_address || address.detailAddress || ""),
        ward: String(address.ward || ""),
        district: String(address.district || ""),
        province: String(address.province || ""),
      }),
    }));

    const lat = Number(address.lat);
    const lng = Number(address.lng);
    setShowMap(true);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setSelectedLocation({ lat, lng });
      handlePickLocation({ lat, lng });
    } else {
      setSelectedLocation(null);
      clearDeliveryMetrics();
    }
  };

  const loadLocationForEdit = useCallback(
    async (address) => {
      if (!address || !Array.isArray(provinces) || provinces.length === 0) return;

      const province = matchLocationByName(provinces, address.province);
      if (!province) return;

      setSelectedProvinceCode(String(province.code));
      setSelectedDistrictCode("");
      setSelectedWardCode("");
      setDistricts([]);
      setWards([]);

      try {
        const districtResponse = await axios.get(`${PROVINCES_API_URL}/p/${province.code}?depth=2`);
        const nextDistricts = Array.isArray(districtResponse?.data?.districts)
          ? districtResponse.data.districts
          : [];
        setDistricts(nextDistricts);

        const district = matchLocationByName(nextDistricts, address.district);
        if (!district) return;

        setSelectedDistrictCode(String(district.code));
        setSelectedWardCode("");
        setWards([]);

        const wardResponse = await axios.get(`${PROVINCES_API_URL}/d/${district.code}?depth=2`);
        const nextWards = Array.isArray(wardResponse?.data?.wards) ? wardResponse.data.wards : [];
        setWards(nextWards);

        const ward = matchLocationByName(nextWards, address.ward);
        if (ward) {
          setSelectedWardCode(String(ward.code));
        }
      } catch (error) {
        console.error("Lỗi tải địa giới khi sửa địa chỉ:", error);
      }
    },
    [provinces]
  );

  useEffect(() => {
    if (!pendingEditAddress) return;
    if (!Array.isArray(provinces) || provinces.length === 0) return;
    loadLocationForEdit(pendingEditAddress);
    setPendingEditAddress(null);
  }, [pendingEditAddress, provinces, loadLocationForEdit]);

  const handleCancelAddAddress = () => {
    if (addresses.length === 0) {
      setIsAddingNewAddress(false);
      setIsAddressListOpen(false);
      setShowMap(false);
      return;
    }
    setIsAddingNewAddress(false);
    setEditingAddressId("");
    setShowMap(false);
    const fallback = addresses.find((item) => getAddressId(item) === String(selectedAddressId)) || addresses[0];
    setSelectedAddressId(getAddressId(fallback));
    applyAddress(fallback);
  };

  const handleDeleteAddress = (addressId) => {
    if (!addressId) return;
    const targetAddress = addresses.find((item) => getAddressId(item) === String(addressId));
    const addressName = String(targetAddress?.name || "địa chỉ này").trim() || "địa chỉ này";
    setDeleteAddressTarget({ id: String(addressId), name: addressName });
  };

  const handleConfirmDeleteAddress = async () => {
    if (!deleteAddressTarget?.id || isDeletingAddress) return;

    setIsDeletingAddress(true);
    try {
      await axios.delete(`${url}/api/user/addresses/${deleteAddressTarget.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nextAddresses = addresses.filter((item) => getAddressId(item) !== String(deleteAddressTarget.id));
      setAddresses(nextAddresses);
      setDeleteAddressTarget(null);

      if (nextAddresses.length === 0) {
        handleStartAddAddress();
        return;
      }

      const fallback = nextAddresses[0];
      setSelectedAddressId(getAddressId(fallback));
      setIsAddressListOpen(false);
      applyAddress(fallback);
    } catch (error) {
      console.error("Loi xoa dia chi:", error);
      alert(error?.response?.data?.message || "Khong the xoa dia chi.");
    } finally {
      setIsDeletingAddress(false);
    }
  };

  const handleSaveAddress = async () => {
    const requiresLocationFields = !isManualLocation;
    const normalizedPhone = normalizeVietnamPhone(deliveryAddress.phone);

    if (
      !deliveryAddress.name.trim() ||
      !deliveryAddress.phone.trim() ||
      !detailAddress.trim() ||
      (requiresLocationFields && (!selectedProvince || !selectedDistrict || !selectedWard))
    ) {
      setAddressError("Vui lòng nhập đầy đủ thông tin địa chỉ.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!isValidVietnamPhone(normalizedPhone)) {
      setAddressError("Số điện thoại không hợp lệ. Vui lòng nhập đúng định dạng di động Việt Nam.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!Number.isFinite(deliveryAddress.lat) || !Number.isFinite(deliveryAddress.lng)) {
      setAddressError("Vui lòng chọn vị trí giao hàng trên bản đồ trước khi lưu địa chỉ.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const distanceKm = calcDistanceByHaversine(STORE_LOCATION, {
      lat: deliveryAddress.lat,
      lng: deliveryAddress.lng,
    });
    if (Number.isFinite(distanceKm) && distanceKm > MAX_DELIVERY_DISTANCE_KM) {
      alert(
        `Địa chỉ này nằm ngoài phạm vi giao hàng.\nCửa hàng chỉ hỗ trợ giao trong bán kính ${MAX_DELIVERY_DISTANCE_KM}km.`
      );
      return;
    }

    setIsSavingAddress(true);
    try {
      const payload = {
        name: deliveryAddress.name.trim(),
        phone: normalizedPhone,
        province: selectedProvince?.name || "",
        district: selectedDistrict?.name || "",
        ward: selectedWard?.name || "",
        detailAddress: detailAddress.trim(),
        address:
          deliveryAddress.address.trim() ||
          buildAddressText({
            detailAddress: detailAddress.trim(),
            ward: selectedWard.name,
            district: selectedDistrict.name,
            province: selectedProvince.name,
          }),
        lat: deliveryAddress.lat,
        lng: deliveryAddress.lng,
      };

      const response = editingAddressId
        ? await axios.put(`${url}/api/user/addresses/${editingAddressId}`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : await axios.post(`${url}/api/user/addresses`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });

      if (!response?.data?.success) {
        setAddressError(response?.data?.message || "Lưu địa chỉ thất bại.");
        addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const savedAddress = response?.data?.address || response?.data?.data || null;
      if (savedAddress) {
        const nextAddresses = editingAddressId
          ? addresses.map((item) =>
              getAddressId(item) === String(editingAddressId) ? { ...item, ...savedAddress } : item
            )
          : [...addresses, savedAddress];
        setAddresses(nextAddresses);
        setSelectedAddressId(getAddressId(savedAddress) || String(editingAddressId || ""));
        setIsAddingNewAddress(false);
        setIsAddressListOpen(false);
        setEditingAddressId("");
        setAddressError("");
        applyAddress(savedAddress);
      } else {
        await fetchAddresses();
      }
    } catch (error) {
      console.error("Lỗi lưu địa chỉ:", error);
      setAddressError(error?.response?.data?.message || "Lưu địa chỉ thất bại.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    if (isSubmittingOrder) return;
    setAddressError("");

    const toppingValidation = validateLineItemToppingQuantities(effectiveCartLineItems);
    if (!toppingValidation.ok) {
      const message = "Không thể đặt hàng: số lượng topping nhỏ hơn số lượng món thành phẩm. Vui lòng kiểm tra lại topping.";
      if (pushVoucherToast) pushVoucherToast("error", message);
      else alert(message);
      return;
    }

    const selected = addresses.find((item) => getAddressId(item) === String(selectedAddressId)) || null;
    const receiverName = String(deliveryAddress.name || selected?.name || "").trim();
    const receiverPhoneRaw = String(deliveryAddress.phone || selected?.phone || "").trim();
    const receiverPhone = normalizeVietnamPhone(receiverPhoneRaw);
    const receiverAddress = String(deliveryAddress.address || "").trim();

    if ((!deliveryAddress.name.trim() && receiverName) || (!deliveryAddress.phone.trim() && receiverPhone)) {
      setDeliveryAddress((prev) => ({
        ...prev,
        name: receiverName || prev.name,
        phone: receiverPhone || prev.phone,
      }));
    }

    if (!receiverName || !receiverPhone || !receiverAddress) {
      setAddressError("Vui lòng nhập tên, số điện thoại và địa chỉ giao hàng.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!isValidVietnamPhone(receiverPhone)) {
      setAddressError("Số điện thoại không hợp lệ. Vui lòng nhập đúng định dạng di động Việt Nam.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!Number.isFinite(deliveryAddress.lat) || !Number.isFinite(deliveryAddress.lng)) {
      setAddressError("Vui lòng chọn vị trí giao hàng trên bản đồ.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (distance === null) {
      setAddressError("Chưa có phí giao hàng. Vui lòng chọn lại vị trí trên bản đồ.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (Number.isFinite(distance) && distance > MAX_DELIVERY_DISTANCE_KM) {
      alert(
        `Địa chỉ này nằm ngoài phạm vi giao hàng.\nCửa hàng chỉ hỗ trợ giao trong bán kính ${MAX_DELIVERY_DISTANCE_KM}km.`
      );
      return;
    }

    const orderItems = effectiveCartLineItems.map((item) => ({
      _id: item.product._id,
      productId: item.product._id,
      name: item.product.name,
      image: item.product.image,
      price: item.unitPrice,
      quantity: item.quantity,
      type: item?.product?.type || item?.productType || "",
      size: item.size,
      sugarLevel: item.sugarLevel,
      iceLevel: item.iceLevel,
      toppings: item.toppings,
      note: item?.note || "",
      customOptions: item?.customOptions || null,
    }));

    const safeDeliveryTime = Number.isFinite(deliveryTime) ? deliveryTime : null;

    const orderData = {
      receiver_name: receiverName,
      phone: receiverPhone,
      address: receiverAddress,
      lat: deliveryAddress.lat,
      lng: deliveryAddress.lng,
      distance_km: distance,
      delivery_time: safeDeliveryTime,
      delivery_fee: deliveryFee,
      total_price: total,
      addressInfo: {
        name: receiverName,
        phone: receiverPhone,
        deliveryText: receiverAddress,
      },
      deliveryAddress: {
        text: receiverAddress,
        lat: deliveryAddress.lat,
        lng: deliveryAddress.lng,
      },
      storeLocation: STORE_LOCATION,
      distanceKm: distance,
      deliveryTime: safeDeliveryTime,
      durationMinutes: safeDeliveryTime,
      deliveryFee,
      vouchers: {
        order: selectedOrderVoucher
          ? {
              voucherId: selectedOrderVoucher._id || null,
              voucherCode: selectedOrderVoucher.voucherCode,
              voucherType: selectedOrderVoucher.voucherType,
              discount: orderVoucherDiscount,
            }
          : null,
        shipping: selectedShippingVoucher
          ? {
              voucherId: selectedShippingVoucher._id || null,
              voucherCode: selectedShippingVoucher.voucherCode,
              voucherType: selectedShippingVoucher.voucherType,
              discount: shippingVoucherDiscount,
            }
          : null,
      },
      items: orderItems,
      note: orderNote.trim(),
      paymentMethod,
      amount: total,
    };

    setIsSubmittingOrder(true);

    try {
      if (addonOrderId) {
        const addOnPayload = {
          items: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            toppings: item.toppings?.map((t) => ({
              toppingId: t.toppingId || t._id || t.id,
              quantity: t.quantity || 1,
            })) || [],
            size: item.size,
            sugarLevel: item.sugarLevel,
            iceLevel: item.iceLevel,
            note: item.note,
            customOptions: item.customOptions || null,
          })),
        };

        const response = await axios.post(`${url}/api/orders/${addonOrderId}/add-on`, addOnPayload, {
          headers: { token },
        });

        if (response?.data?.success) {
          localStorage.removeItem(SELECTED_CART_LINE_KEYS_KEY);
          localStorage.removeItem(DIRECT_CHECKOUT_ITEMS_KEY);
          localStorage.removeItem(BUY_NOW_ITEMS_KEY);
          localStorage.removeItem(ADDON_ACTIVE_ORDER_KEY);
          localStorage.removeItem(REORDER_CHECKOUT_META_KEY);
          clearVoucherIntent?.();
          navigate("/orders");
          return;
        }

        const message = buildOrderErrorMessage(response?.data, "Đặt thêm thất bại.");
        if (pushVoucherToast) pushVoucherToast("error", message);
        else alert(message);
        return;
      }

      const response = await createSepayOrder({
        url,
        token,
        payload: orderData,
      });

      if (response?.data?.success) {
        localStorage.removeItem(SELECTED_CART_LINE_KEYS_KEY);
        localStorage.removeItem(DIRECT_CHECKOUT_ITEMS_KEY);
        localStorage.removeItem(BUY_NOW_ITEMS_KEY);
        localStorage.removeItem(ADDON_ACTIVE_ORDER_KEY);
        localStorage.removeItem(REORDER_CHECKOUT_META_KEY);
        clearVoucherIntent?.();
        navigate(`/payment/${response.data.orderId}`, {
          state: {
            orderId: response.data.orderId,
            qrCode: response.data.qrCode,
            amount: response.data.amount,
            transferContent: response.data.transferContent,
            status: response.data.status,
          },
        });
        return;
      }
      const message = buildOrderErrorMessage(response?.data, "Đặt hàng thất bại.");
      if (pushVoucherToast) pushVoucherToast("error", message);
      else alert(message);
    } catch (error) {
      const message = buildOrderErrorMessage(error?.response?.data, "Đặt hàng thất bại.");
      if (pushVoucherToast) pushVoucherToast("error", message);
      else alert(message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const hasAddresses = addresses.length > 0;
  const showAddressForm = isAddingNewAddress;
  const selectedAddress = useMemo(
    () => addresses.find((item) => getAddressId(item) === String(selectedAddressId)) || addresses[0] || null,
    [addresses, selectedAddressId]
  );
  const showAddressSummary = hasAddresses && !showAddressForm && !isAddressListOpen && Boolean(selectedAddress);
  const showAddressList = hasAddresses && !showAddressForm && (!selectedAddress || isAddressListOpen);

  return (
    <>
      <form onSubmit={placeOrder} className="checkout-page">
      <div className="checkout-container">
        <h1 className="checkout-title">THÔNG TIN ĐẶT HÀNG</h1>

        <section className="checkout-section" ref={addressSectionRef}>
          <div className="address-section-header">
            <h2 className="section-title">Địa chỉ giao hàng</h2>
            <button type="button" className="address-link-btn" onClick={handleStartAddAddress}>
              + Thêm địa chỉ mới
            </button>
          </div>
          {addressError ? (
            <div className="address-alert" role="alert">
              {addressError}
            </div>
          ) : null}

          {showAddressSummary ? (
            <CheckoutAddress
              deliveryAddress={deliveryAddress}
              onShowMap={handleShowMap}
              onOpenList={handleOpenAddressList}
            />
          ) : null}

          {showAddressList ? (
            <div className="address-picker">
              <div className="address-picker-top">
                <p className="address-picker-label">Chọn địa chỉ giao hàng</p>
                <button type="button" className="address-link-btn" onClick={handleCloseAddressList}>
                  Thu gọn
                </button>
              </div>
              <div className="address-list">
                {addresses.map((item) => {
                  const itemId = getAddressId(item);
                  const isSelected = selectedAddressId === itemId;
                  const fullAddress =
                    String(item.address || "").trim() ||
                    buildAddressText({
                    detailAddress: item.detail_address || item.detailAddress,
                    ward: item.ward,
                    district: item.district,
                    province: item.province,
                    });

                  return (
                    <article
                      key={itemId}
                      className={`address-card ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectAddress(itemId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectAddress(itemId);
                        }
                      }}
                    >
                      <input
                        className="address-radio"
                        type="radio"
                        name="selectedAddress"
                        checked={isSelected}
                        onChange={() => handleSelectAddress(itemId)}
                      />
                      <div className="address-content">
                        <strong>{item.name || "Địa chỉ giao hàng"} {item.phone ? `| ${item.phone}` : ""}</strong>
                        <p>{fullAddress || "Chưa có thông tin địa chỉ"}</p>
                        <span className="address-tag">{resolveAddressLabel(item)}</span>
                      </div>
                      <div className="address-card-actions">
                        <button
                          type="button"
                          className="secondary-btn small"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleStartEditAddress(item);
                          }}
                        >
                          Sửa
                        </button>
                        {addresses.length > 1 ? (
                          <button
                            type="button"
                            className="secondary-btn small danger"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteAddress(itemId);
                            }}
                          >
                            Xóa
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!hasAddresses && !showAddressForm ? (
            <div className="address-empty">
              <p>Bạn chưa có địa chỉ giao hàng</p>
              <button type="button" className="secondary-btn add-first-btn" onClick={handleStartAddAddress}>
                + Thêm địa chỉ mới
              </button>
            </div>
          ) : null}

          {showAddressForm ? (
            <div className="address-form-area">
              <input
                required
                type="text"
                value={deliveryAddress.name}
                onChange={(event) => {
                  setAddressError("");
                  setDeliveryAddress((prev) => ({ ...prev, name: event.target.value }));
                }}
                placeholder="Tên người nhận"
              />
              <input
                required
                type="text"
                value={deliveryAddress.phone}
                onChange={(event) => {
                  setAddressError("");
                  setDeliveryAddress((prev) => ({ ...prev, phone: event.target.value }));
                }}
                placeholder="Số điện thoại"
              />

              <div className="address-row-3">
                <select
                  className="address-select"
                  value={selectedProvinceCode}
                  onChange={handleProvinceChange}
                  required={!isManualLocation}
                >
                  <option value="">Tỉnh / Thành phố</option>
                  {provinces.map((province) => (
                    <option key={province.code} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </select>

                <select
                  className="address-select"
                  value={selectedDistrictCode}
                  onChange={handleDistrictChange}
                  disabled={!selectedProvinceCode}
                  required={!isManualLocation}
                >
                  <option value="">Quận / Huyện</option>
                  {districts.map((district) => (
                    <option key={district.code} value={district.code}>
                      {district.name}
                    </option>
                  ))}
                </select>

                <select
                  className="address-select"
                  value={selectedWardCode}
                  onChange={(event) => {
                    setSelectedWardCode(event.target.value);
                    setAddressError("");
                    clearDeliveryMetrics();
                  }}
                  disabled={!selectedDistrictCode}
                  required={!isManualLocation}
                >
                  <option value="">Phường / Xã</option>
                  {wards.map((ward) => (
                    <option key={ward.code} value={ward.code}>
                      {ward.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                required
                type="text"
                className="address-detail"
                value={detailAddress}
                onChange={(event) => {
                  setAddressError("");
                  setDetailAddress(event.target.value);
                  clearDeliveryMetrics();
                }}
                placeholder="Địa chỉ chi tiết"
              />
            </div>
          ) : null}

          {showMap ? (
            <CheckoutMap
              storeLocation={STORE_LOCATION}
              selectedLocation={selectedLocation}
              distanceKm={pickedDistanceKm}
              maxDistanceKm={MAX_DELIVERY_DISTANCE_KM}
              isOutOfRange={isOutOfDeliveryRange}
              storeIcon={shopIcon}
              customerIcon={customerIcon}
              route={route}
              routeLoading={routeLoading}
              onPickLocation={setSelectedLocation}
              onConfirmLocation={handleConfirmLocation}
            />
          ) : null}

          <p>
            Địa chỉ giao hàng: {deliveryAddress.address || "--"}
          </p>
          <p>Địa chỉ cửa hàng: {STORE_ADDRESS}</p>

          <div className="address-actions">
            {showAddressForm ? (
              <>
                <button
                  type="button"
                  className={`secondary-btn ${
                    isOutOfDeliveryRange ? "!bg-gray-400 hover:!bg-gray-400 cursor-not-allowed opacity-80" : ""
                  }`}
                  onClick={handleSaveAddress}
                  disabled={isSavingAddress || isOutOfDeliveryRange}
                >
                  {isSavingAddress ? "Đang lưu..." : editingAddressId ? "Cập nhật địa chỉ" : "Lưu địa chỉ"}
                </button>
                {addresses.length > 0 ? (
                  <button type="button" className="secondary-btn" onClick={handleCancelAddAddress}>
                    Hủy
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </section>

        <section className="checkout-section">
          <h2 className="section-title">THÔNG TIN GIAO HÀNG TÍNH TOÁN</h2>
          <div className="summary-row">
            <span>Khoảng cách</span>
            <span>{distance !== null ? `${distance.toFixed(2)} km` : "--"}</span>
          </div>
          <div className="info-row">
            <div className="label">
              Thời gian chuẩn bị dự kiến
              <TooltipInfo ariaLabel="Thông tin thời gian chuẩn bị">
                <span className="tooltip-title">Chi tiết</span>
                <span>Chuẩn bị: {etaPreview?.prepTime ?? prepMinutes} phút</span>
              </TooltipInfo>
            </div>
            <div className="value">
              {etaPreviewLoading
                ? "Đang tính..."
                : `Chuẩn bị: ${etaPreview?.prepTime ?? prepMinutes ?? "--"} phút`}
            </div>
          </div>
          {etaPreviewError ? <p className="text-xs text-rose-600 mt-2">{etaPreviewError}</p> : null}
          <div className="info-row">
            <div className="label">
              Phí giao hàng
              <TooltipInfo ariaLabel="Thông tin phí giao hàng">
                <span className="tooltip-title">Cách tính phí giao hàng</span>
                <span>Phí cơ bản: 10.000 VNĐ</span>
                <span>1 km đầu tiên: miễn phí</span>
                <span className="tooltip-gap">Từ km thứ 2:</span>
                <span>+ 5.000 VNĐ / km</span>
                <span className="tooltip-gap">Ví dụ:</span>
                <span>1.7 km → 13.500 VNĐ</span>
              </TooltipInfo>
            </div>
            <div className="value">{shippingDisplay}</div>
          </div>
        </section>

        <section className="checkout-section">
          <h2 className="section-title">SẢN PHẨM TRONG ĐƠN</h2>
          <div className="order-items">
            {effectiveCartLineItems.map((item) => {
              const sizeText = item?.size ? `Size: ${item.size}` : "";
              const sugarText = item?.sugarLevel ? `Đường: ${item.sugarLevel}` : "";
              const iceText = item?.iceLevel ? `Đá: ${item.iceLevel}` : "";
              const toppingLabel = formatToppingsInline(item?.toppings);
              const toppingText = toppingLabel ? `Topping: ${toppingLabel}` : "";
              const customOptionsLabel = formatCustomOptionsInline(item?.customOptions);
              const customOptionsText = customOptionsLabel ? `Tùy chọn: ${customOptionsLabel}` : "";
              const noteText = item?.note ? `Ghi chú: ${item.note}` : "";
              const options = [sizeText, sugarText, iceText, toppingText, customOptionsText, noteText].filter(Boolean);

              return (
                <div key={item.lineKey || item.productId} className="order-item">
                  <img
                    className="order-item-image"
                    src={resolveImageSrc(item?.product?.image, url)}
                    alt={item?.product?.name || "product"}
                  />
                  <div className="order-item-info">
                    <p className="order-item-name">{item?.product?.name || "Sản phẩm"}</p>
                    {options.length > 0 ? (
                      <p className="order-item-options">{options.join(" • ")}</p>
                    ) : null}
                    <div className="order-item-qty">
                      <span>Số lượng</span>
                      <div className="order-item-qty-controls">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => handleDecreaseItem(item)}
                        >
                          -
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => handleIncreaseItem(item)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="order-item-price">{formatVND(item.lineTotal)}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="checkout-section">
          <h2 className="section-title">TỔNG GIỎ HÀNG</h2>
          <div className="summary-row">
            <span>Tạm tính</span>
            <span>{formatVND(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Phí giao hàng</span>
            <span>{shippingDisplay}</span>
          </div>
          <div className="summary-row">
            <span>Phương thức thanh toán</span>
            <span>{paymentMethodLabel}</span>
          </div>
          <div className="voucher-block">
            <p className="voucher-title">Áp dụng voucher</p>
            <p className="voucher-note">Chỉ áp dụng 1 voucher cho mỗi đơn hàng.</p>
            {bestVoucher ? (
              <div className="voucher-best">
                <div className="voucher-best-text">
                  <strong>Gợi ý tốt nhất:</strong> tiết kiệm {formatVND(bestVoucher._bestDiscount)}
                </div>
                <button
                  type="button"
                  className="voucher-best-btn"
                  onClick={() => {
                    userPickedVoucherRef.current = true;
                    const voucherType = String(bestVoucher?.voucherType || "").toUpperCase();
                    if (voucherType === "SHIPPING") {
                      setSelectedShippingVoucherId(String(bestVoucher._id));
                      setSelectedOrderVoucherId("");
                      saveVoucherIntent?.(bestVoucher, "applied");
                      setVoucherError("");
                      return;
                    }
                    setSelectedOrderVoucherId(String(bestVoucher._id));
                    setSelectedShippingVoucherId("");
                    saveVoucherIntent?.(bestVoucher, "applied");
                    setVoucherError("");
                  }}
                >
                  Áp dụng
                </button>
              </div>
            ) : null}
            {voucherHint?.amountToAdd > 0 ? (
              <p className="voucher-hint">
                Bạn chỉ cần thêm {formatVND(voucherHint.amountToAdd)} để đủ điều kiện áp dụng voucher phù hợp.
              </p>
            ) : null}
            <div className="voucher-picker show">
              <p className="voucher-picker-title">Voucher giảm giá món</p>
              {isVoucherLoading ? (
                <p className="voucher-empty">Đang tải voucher...</p>
              ) : orderVouchers.length === 0 ? (
                <p className="voucher-empty">Không có voucher phù hợp với giỏ hàng.</p>
              ) : (
                <div className="voucher-list">
                  {orderVouchers.map((voucher) => (
                    <label key={voucher._id} className="voucher-item voucher-radio-item">
                      <input
                        type="radio"
                        name="checkout-order-voucher"
                        checked={String(selectedOrderVoucherId) === String(voucher._id)}
                        onChange={() => {
                          userPickedVoucherRef.current = true;
                          setSelectedOrderVoucherId(String(voucher._id));
                          setSelectedShippingVoucherId("");
                          saveVoucherIntent?.(voucher, "applied");
                          setVoucherError("");
                        }}
                      />
                        <div>
                          <strong>{voucher.voucherName}</strong>
                          {voucher.categoryName ? <span>Danh mục: {voucher.categoryName}</span> : null}
                          <span>Điều kiện: Đơn tối thiểu {formatVND(voucher.minOrderValue || 0)}</span>
                        </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="voucher-picker show">
              <p className="voucher-picker-title">Voucher giảm phí giao hàng</p>
              {isVoucherLoading ? (
                <p className="voucher-empty">Đang tải voucher...</p>
              ) : shippingVouchers.length === 0 ? (
                <p className="voucher-empty">Không có voucher phí ship phù hợp.</p>
              ) : (
                <div className="voucher-list">
                  {shippingVouchers.map((voucher) => (
                    <label key={voucher._id} className="voucher-item voucher-radio-item">
                      <input
                        type="radio"
                        name="checkout-shipping-voucher"
                        checked={String(selectedShippingVoucherId) === String(voucher._id)}
                        onChange={() => {
                          userPickedVoucherRef.current = true;
                          setSelectedShippingVoucherId(String(voucher._id));
                          setSelectedOrderVoucherId("");
                          saveVoucherIntent?.(voucher, "applied");
                          setVoucherError("");
                        }}
                      />
                        <div>
                          <strong>{voucher.voucherName}</strong>
                          <span>Điều kiện: Đơn tối thiểu {formatVND(voucher.minOrderValue || 0)}</span>
                        </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {voucherError ? <p className="voucher-error">{voucherError}</p> : null}
          </div>

          {selectedOrderVoucher ? (
            <div className="summary-row discount-row">
              <span>
                Voucher giảm giá
                <button
                  type="button"
                  className="voucher-remove-btn"
                  onClick={() => {
                    userPickedVoucherRef.current = true;
                    setSelectedOrderVoucherId("");
                    clearVoucherIntent?.();
                    setVoucherError("");
                  }}
                >
                  X
                </button>
              </span>
              <span>-{formatVND(orderVoucherDiscount)}</span>
            </div>
          ) : null}
          {selectedShippingVoucher ? (
            <div className="summary-row discount-row">
              <span>
                Voucher phí ship
                <button
                  type="button"
                  className="voucher-remove-btn"
                  onClick={() => {
                    userPickedVoucherRef.current = true;
                    setSelectedShippingVoucherId("");
                    clearVoucherIntent?.();
                    setVoucherError("");
                  }}
                >
                  X
                </button>
              </span>
              <span>-{formatVND(shippingVoucherDiscount)}</span>
            </div>
          ) : null}
          <div className="summary-row total-row">
            <b>Tổng cộng</b>
            <b>{formatVND(total)}</b>
          </div>
        </section>

        <section className="checkout-section">
          <h2 className="section-title">GHI CHÚ ĐƠN HÀNG</h2>
          <textarea
            className="order-note-input"
            placeholder="Ví dụ: giao trước 6h, gọi trước khi đến..."
            value={orderNote}
            onChange={(event) => setOrderNote(event.target.value)}
          />
        </section>

        <section className="checkout-section checkout-action">
          <button
            type="submit"
            className="checkout-submit-btn"
            disabled={isSubmittingOrder}
          >
            {isSubmittingOrder ? "ĐANG XỬ LÝ..." : "ĐẶT HÀNG"}
          </button>
        </section>
      </div>
      </form>
      {deleteAddressTarget ? (
        <div
          className="address-delete-modal-backdrop"
          onClick={() => {
            if (!isDeletingAddress) setDeleteAddressTarget(null);
          }}
        >
          <div className="address-delete-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Xóa địa chỉ</h3>
            <p>
              Bạn có chắc chắn không? Xóa <b>{deleteAddressTarget.name}</b>?
            </p>
            <div className="address-delete-modal-actions">
              <button
                type="button"
                className="address-delete-btn address-delete-btn-cancel"
                onClick={() => setDeleteAddressTarget(null)}
                disabled={isDeletingAddress}
              >
                Hủy
              </button>
              <button
                type="button"
                className="address-delete-btn address-delete-btn-danger"
                onClick={handleConfirmDeleteAddress}
                disabled={isDeletingAddress}
              >
                {isDeletingAddress ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CheckoutPage;


