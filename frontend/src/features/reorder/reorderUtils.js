import { normalizeToppingSelections, toppingsKeyPart } from "../../utils/toppings";

const toSafeString = (value) => String(value || "").trim();

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickFirst = (...values) => {
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const isProductInStock = (product) => {
  if (!product || typeof product !== "object") return false;

  if (product?.isActive === false) return false;
  if (product?.inStock === false) return false;
  if (product?.available === false) return false;

  const stockCandidates = [
    product?.stock,
    product?.quantity,
    product?.availableStock,
    product?.inventory?.stock,
  ];

  const finiteStocks = stockCandidates
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (finiteStocks.length === 0) return true;
  return finiteStocks.some((value) => value > 0);
};

const stableStringify = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${key}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return String(value);
};

const normalizeCustomOptions = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const cleaned = raw
      .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
      .filter(Boolean);
    return cleaned.length ? cleaned : null;
  }
  if (typeof raw === "object") {
    const entries = Object.entries(raw).filter(([, value]) => value != null && String(value).trim() !== "");
    if (!entries.length) return null;
    const next = {};
    entries.forEach(([key, value]) => {
      next[key] = value;
    });
    return next;
  }
  const text = String(raw).trim();
  return text ? text : null;
};

const resolveProductId = (item) =>
  toSafeString(
    item?.productId || item?._id || item?.id || item?.itemId || item?.foodId || item?.product?._id
  );

export const buildReorderLineKey = (item = {}) => {
  const productId = resolveProductId(item);
  const size = toSafeString(item?.size);
  const sugarLevel = toSafeString(item?.sugarLevel);
  const iceLevel = toSafeString(item?.iceLevel);
  const toppings = toppingsKeyPart(item?.toppings || []);
  const note = toSafeString(item?.note);
  const customOptions = stableStringify(item?.customOptions || null);
  return [productId, size, sugarLevel, iceLevel, toppings, note, customOptions].join("|");
};

export const normalizeOrderItemsForReorder = ({
  orderDetail,
  productById,
}) => {
  const rawItems = Array.isArray(orderDetail?.items) ? orderDetail.items : [];
  const availableItems = [];
  const unavailableItems = [];
  const hasCatalog = productById instanceof Map && productById.size > 0;

  rawItems.forEach((item, index) => {
    const productId = resolveProductId(item);
    if (!productId) return;

    const product = productById?.get(productId);
    const availabilitySource =
      product && typeof product === "object"
        ? product
        : item?.product && typeof item.product === "object"
        ? item.product
        : null;
    const explicitInactive =
      item?.isActive === false ||
      item?.productActive === false ||
      availabilitySource?.isActive === false;
    const explicitUnavailable =
      item?.inStock === false ||
      item?.available === false ||
      availabilitySource?.inStock === false ||
      availabilitySource?.available === false;
    const stockCandidates = [
      availabilitySource?.stock,
      availabilitySource?.availableStock,
      availabilitySource?.inventory?.stock,
      item?.availableStock,
      item?.stock,
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const outOfStockBySnapshot = stockCandidates.length > 0 && stockCandidates.every((value) => value <= 0);
    const unavailableBecauseMissingCatalogProduct = hasCatalog && !product;

    if (
      explicitInactive ||
      explicitUnavailable ||
      outOfStockBySnapshot ||
      unavailableBecauseMissingCatalogProduct ||
      (hasCatalog && !isProductInStock(product))
    ) {
      unavailableItems.push(
        toSafeString(item?.name || item?.productName || item?.title || productId) || `item-${index}`
      );
      return;
    }

    const quantity = Math.max(1, Math.round(toSafeNumber(item?.quantity, 1)));
    const size = toSafeString(pickFirst(item?.size, item?.variant?.size, item?.options?.size));
    const sugarLevel = toSafeString(
      pickFirst(item?.sugarLevel, item?.sugar, item?.variant?.sugarLevel, item?.variant?.sugar)
    );
    const iceLevel = toSafeString(
      pickFirst(item?.iceLevel, item?.ice, item?.variant?.iceLevel, item?.variant?.ice)
    );
    const toppings = normalizeToppingSelections(
      item?.toppings || item?.topping || item?.variant?.toppings || item?.options?.toppings || []
    );
    const customOptions = normalizeCustomOptions(
      item?.customOptions || item?.options || item?.variant?.customOptions || null
    );
    const note = toSafeString(item?.note || item?.variant?.note || "");
    const unitPrice = Math.max(
      0,
      toSafeNumber(item?.price, toSafeNumber(item?.unitPrice, toSafeNumber(product?.price, 0)))
    );
    const name = toSafeString(item?.name || item?.productName || product?.name || "Sản phẩm");
    const image = toSafeString(item?.image || item?.thumbnail || product?.image || "");
    const type = toSafeString(item?.type || product?.type || "");

    availableItems.push({
      productId,
      name,
      image,
      type,
      price: unitPrice,
      quantity,
      size,
      sugarLevel,
      iceLevel,
      toppings,
      note,
      customOptions,
    });
  });

  return {
    availableItems,
    unavailableItems: Array.from(new Set(unavailableItems)),
  };
};

export const mapCartLineItemsToCheckoutDraft = (cartLineItems = []) =>
  (Array.isArray(cartLineItems) ? cartLineItems : [])
    .map((line) => {
      const productId = resolveProductId(line);
      if (!productId) return null;

      return {
        productId,
        name: toSafeString(line?.product?.name || ""),
        image: toSafeString(line?.product?.image || ""),
        type: toSafeString(line?.product?.type || line?.productType || ""),
        price: Math.max(0, toSafeNumber(line?.unitPrice, 0)),
        quantity: Math.max(1, Math.round(toSafeNumber(line?.quantity, 1))),
        size: toSafeString(line?.size),
        sugarLevel: toSafeString(line?.sugarLevel),
        iceLevel: toSafeString(line?.iceLevel),
        toppings: normalizeToppingSelections(line?.toppings || []),
        note: toSafeString(line?.note || ""),
        customOptions: normalizeCustomOptions(line?.customOptions || null),
      };
    })
    .filter(Boolean);

export const mergeCartItems = (currentItems = [], incomingItems = []) => {
  const mergedMap = new Map();

  [...(Array.isArray(currentItems) ? currentItems : []), ...(Array.isArray(incomingItems) ? incomingItems : [])]
    .forEach((item) => {
      const key = buildReorderLineKey(item);
      if (!key) return;

      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, {
          ...item,
          quantity: Math.max(1, Math.round(toSafeNumber(item?.quantity, 1))),
        });
        return;
      }

      mergedMap.set(key, {
        ...existing,
        quantity:
          Math.max(1, Math.round(toSafeNumber(existing?.quantity, 1))) +
          Math.max(1, Math.round(toSafeNumber(item?.quantity, 1))),
      });
    });

  return Array.from(mergedMap.values()).map((item) => ({
    ...item,
    lineKey: buildReorderLineKey(item),
  }));
};

export const validateLineItemToppingQuantities = (items = []) => {
  const invalidItems = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    const productQuantity = Math.max(1, Math.round(toSafeNumber(item?.quantity, 1)));
    const toppings = normalizeToppingSelections(item?.toppings || []);
    if (!toppings.length) return;

    const invalidToppings = toppings.filter(
      (topping) => Math.max(1, Math.round(toSafeNumber(topping?.quantity, 1))) < productQuantity
    );

    if (!invalidToppings.length) return;

    invalidItems.push({
      productId: resolveProductId(item),
      name: toSafeString(item?.name || item?.productName || "Sản phẩm"),
      productQuantity,
      toppings: invalidToppings.map((topping) => ({
        toppingId: toSafeString(topping?.toppingId || topping?.id || ""),
        name: toSafeString(topping?.name || "Topping"),
        quantity: Math.max(1, Math.round(toSafeNumber(topping?.quantity, 1))),
      })),
    });
  });

  return {
    ok: invalidItems.length === 0,
    invalidItems,
  };
};

export const addItemsToCart = async (items = [], addToCart) => {
  if (typeof addToCart !== "function") {
    return { addedCount: 0, failedCount: 0 };
  }

  let addedCount = 0;
  let failedCount = 0;

  for (const item of Array.isArray(items) ? items : []) {
    try {
      const added = await addToCart({
        productId: item.productId,
        itemId: item.productId,
        name: item.name,
        image: item.image,
        size: item.size || "",
        sugarLevel: item.sugarLevel || "",
        iceLevel: item.iceLevel || "",
        toppings: Array.isArray(item.toppings) ? item.toppings : [],
        note: item.note || "",
        customOptions: item.customOptions || null,
        quantity: Math.max(1, Math.round(toSafeNumber(item.quantity, 1))),
        price: Math.max(0, toSafeNumber(item.price, 0)),
      });
      if (added === false) {
        failedCount += 1;
      } else {
        addedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  return { addedCount, failedCount };
};

export const buildReorderCheckoutMeta = (orderDetail, reorderItems = []) => {
  const orderVoucher = orderDetail?.vouchers?.order || null;
  const shippingVoucher = orderDetail?.vouchers?.shipping || null;
  const hasOrderVoucher =
    Boolean(orderVoucher?.voucherId) || Boolean(toSafeString(orderVoucher?.voucherCode));
  const hasShippingVoucher =
    Boolean(shippingVoucher?.voucherId) || Boolean(toSafeString(shippingVoucher?.voucherCode));

  const subtotal = (Array.isArray(reorderItems) ? reorderItems : []).reduce(
    (sum, item) => sum + Math.max(0, toSafeNumber(item?.price, 0)) * Math.max(1, toSafeNumber(item?.quantity, 1)),
    0
  );
  const shippingFee = Math.max(0, toSafeNumber(orderDetail?.deliveryFee, 0));
  const totalPrice = Math.max(
    0,
    toSafeNumber(orderDetail?.total, toSafeNumber(orderDetail?.amount, subtotal + shippingFee))
  );
  const discount = Math.max(0, subtotal + shippingFee - totalPrice);

  return {
    source: "reorder",
    orderId: toSafeString(orderDetail?._id || orderDetail?.orderId),
    createdAt: Date.now(),
    paymentMethod: toSafeString(orderDetail?.paymentMethod || "sepay") || "sepay",
    voucher: {
      order: hasOrderVoucher
        ? {
            voucherId: toSafeString(orderVoucher?.voucherId || ""),
            voucherCode: toSafeString(orderVoucher?.voucherCode || ""),
            discount: Math.max(0, toSafeNumber(orderVoucher?.discount, 0)),
          }
        : null,
      shipping: hasShippingVoucher
        ? {
            voucherId: toSafeString(shippingVoucher?.voucherId || ""),
            voucherCode: toSafeString(shippingVoucher?.voucherCode || ""),
            discount: Math.max(0, toSafeNumber(shippingVoucher?.discount, 0)),
          }
        : null,
      discount,
    },
    pricing: {
      subtotal,
      shippingFee,
      totalPrice,
    },
    shippingAddress: {
      name: toSafeString(orderDetail?.customerName || ""),
      phone: toSafeString(orderDetail?.phone || ""),
      address: toSafeString(orderDetail?.address || orderDetail?.deliveryAddress?.text || ""),
      lat: Number.isFinite(Number(orderDetail?.deliveryAddress?.lat))
        ? Number(orderDetail.deliveryAddress.lat)
        : null,
      lng: Number.isFinite(Number(orderDetail?.deliveryAddress?.lng))
        ? Number(orderDetail.deliveryAddress.lng)
        : null,
      distanceKm: Number.isFinite(Number(orderDetail?.distanceKm))
        ? Number(orderDetail.distanceKm)
        : null,
      deliveryTime: Number.isFinite(Number(orderDetail?.deliveryTime))
        ? Number(orderDetail.deliveryTime)
        : null,
      deliveryFee: shippingFee,
    },
    note: toSafeString(orderDetail?.note || ""),
  };
};
