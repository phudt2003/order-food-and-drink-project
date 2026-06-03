/* eslint-disable no-unused-vars */
import React, { useContext, useEffect, useRef, useState } from "react";
import "./Cart.css";
import { StoreContext, UIContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import { formatVND } from "../../utils/currency";
import { normalizeToppingSelections, toppingsKeyPart } from "../../utils/toppings";
import { resolveImageSrc } from "../../utils/resolveImage";

const BUY_NOW_ITEMS_KEY = "buy_now_item";

const Cart = () => {
  const {
    cartLineItems,
    addToCart,
    removeFromCart,
    getTotalCartAmount,
    getTotalCartItems,
    token,
    url,
    refreshCart,
  } = useContext(StoreContext);
  const { setShowLogin } = useContext(UIContext);

  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const noticeTimeoutRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const [swipeOpenKey, setSwipeOpenKey] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});

  const totalItems = getTotalCartItems();
  const isCartEmpty = totalItems === 0;

  const getCartItemKey = (item, index) =>
    item.lineKey ||
    `${item.productId}-${item.size || ""}-${item.sugarLevel || ""}-${item.iceLevel || ""}-${toppingsKeyPart(
      item.toppings
    )}-${index}`;

  const formatSugarLevel = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d+(\.\d+)?%$/.test(raw)) return raw;
    if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}%`;
    return raw;
  };
  const hasValue = (value) => String(value ?? "").trim() !== "";

  const selectedLineItems = cartLineItems.filter((item, index) =>
    Boolean(selectedItems[getCartItemKey(item, index)])
  );
  const hasSelection = selectedLineItems.length > 0;
  const subtotal = hasSelection
    ? selectedLineItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
    : 0;
  const grandTotal = subtotal;

  const showNotice = (message) => {
    setNotice(message);

    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }

    noticeTimeoutRef.current = setTimeout(() => {
      setNotice("");
    }, 2500);
  };

  const handleCheckout = () => {
    if (!token) {
      showNotice("Vui lòng đăng nhập để tiếp tục thanh toán.");
      setShowLogin(true);
      return;
    }

    if (isCartEmpty) {
      showNotice("Giỏ hàng của bạn đang trống.");
      return;
    }

    if (!hasSelection) {
      showNotice("Vui lòng chọn sản phẩm để thanh toán.");
      return;
    }

    const selectedKeys = selectedLineItems.map((item, index) =>
      getCartItemKey(item, index)
    );
    localStorage.setItem("selectedCartLineKeys", JSON.stringify(selectedKeys));

    localStorage.removeItem(BUY_NOW_ITEMS_KEY);
    navigate("/checkout", { state: { checkoutSource: "cart-main" } });
  };

  const handleAddMoreItems = () => {
    navigate("/menu");
  };

  const handleIncreaseQuantity = async (item) => {
    await addToCart({
      productId: item.productId,
      itemId: item.productId,
      name: item.product.name,
      size: item.size || "",
      sugarLevel: item.sugarLevel || "",
      iceLevel: item.iceLevel || "",
      toppings: Array.isArray(item.toppings) ? item.toppings : [],
      quantity: 1,
      price: item.unitPrice,
    });
  };

  const handleDecreaseQuantity = async (item) => {
    await removeFromCart(buildRemovePayload(item));
  };

  const buildRemovePayload = (item, options = {}) => ({
    productId: item.productId,
    itemId: item.productId,
    size: item.size || "",
    sugarLevel: item.sugarLevel || "",
    iceLevel: item.iceLevel || "",
    toppings: Array.isArray(item.toppings) ? item.toppings : [],
    removeAll: Boolean(options.removeAll),
    removeQuantity: Number(options.removeQuantity || 1),
  });

  const handleToggleItem = (key) => {
    setSelectedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTouchStart = (key) => (event) => {
    swipeStartXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (key) => (event) => {
    const startX = swipeStartXRef.current;
    if (startX === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? startX;
    const delta = startX - endX;

    if (delta > 50) {
      setSwipeOpenKey(key);
    } else if (delta < -30 && swipeOpenKey === key) {
      setSwipeOpenKey(null);
    }

    swipeStartXRef.current = null;
  };

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const validKeys = new Set(
      cartLineItems.map((item, index) => getCartItemKey(item, index))
    );
    setSelectedItems((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        if (validKeys.has(key) && prev[key]) next[key] = true;
      });
      return next;
    });
  }, [cartLineItems]);

  return (
    <div className="cart">
      <div className="cart-items">
        <div className="cart-items-title">
          <p>Chọn</p>
          <p>Món</p>
          <p>Tên món</p>
          <p>Giá</p>
          <p>Số lượng</p>
          <p>Xóa</p>
        </div>

        <br />
        <hr />

        {cartLineItems.map((item, index) => {
          const imageSrc = resolveImageSrc(item?.product?.image, url);
          const cartItemKey = getCartItemKey(item, index);
          const optionParts = [
            hasValue(item?.size) ? `Size: ${item.size}` : "",
            hasValue(item?.sugarLevel) ? `Đường: ${formatSugarLevel(item.sugarLevel)}` : "",
            hasValue(item?.iceLevel) ? `Đá: ${item.iceLevel}` : "",
          ].filter(Boolean);
          const optionsInline = optionParts.join(" | ");

          const toppingSelections = normalizeToppingSelections(item?.toppings);
          const toppingsInline =
            toppingSelections.length > 0
              ? toppingSelections
                  .map((topping) =>
                    Number(topping?.quantity || 0) > 1
                      ? `${topping.name} x${topping.quantity}`
                      : topping.name
                  )
                  .join(", ")
              : "";

          return (
            <div key={cartItemKey}>
              <div
                className={`cart-item-swipe ${swipeOpenKey === cartItemKey ? "is-open" : ""}`}
                onTouchStart={handleTouchStart(cartItemKey)}
                onTouchEnd={handleTouchEnd(cartItemKey)}
              >
                <div className="cart-item-content cart-items-title cart-items-item">
                  <label className="cart-item-check">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedItems[cartItemKey])}
                      onChange={() => handleToggleItem(cartItemKey)}
                    />
                  </label>
                  <img src={imageSrc} alt={item.product.name} />
                  <div className="min-w-0 flex flex-col gap-1">
                    <h3 className="font-medium leading-tight">{item.product.name}</h3>
                    {optionsInline ? (
                      <p className="text-sm leading-tight text-gray-500 dark:text-gray-300">
                        {optionsInline}
                      </p>
                    ) : null}
                    {toppingsInline ? (
                      <p className="text-sm leading-tight text-gray-500 dark:text-gray-300">{`Topping: ${toppingsInline}`}</p>
                    ) : null}
                  </div>
                  <p>{formatVND(item.unitPrice)}</p>
                  <div className="quantity-control">
                  <button
                      type="button"
                      className="qty-btn minus"
                      onClick={() => handleDecreaseQuantity(item)}
                      aria-label="Giảm số lượng"
                    >
                      -
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      type="button"
                      className="qty-btn plus"
                      onClick={() => handleIncreaseQuantity(item)}
                      aria-label="Tăng số lượng"
                    >
                      +
                  </button>
                </div>
                <p
                  onClick={() =>
                      removeFromCart(
                        buildRemovePayload(item, {
                          removeAll: true,
                          removeQuantity: item.quantity,
                        })
                      )
                    }
                    className="cross"
                  >
                    x
                  </p>
                </div>
                <button
                  type="button"
                  className="cart-item-delete"
                  onClick={() => {
                    removeFromCart(
                      buildRemovePayload(item, {
                        removeAll: true,
                        removeQuantity: item.quantity,
                      })
                    );
                    setSwipeOpenKey(null);
                  }}
                >
                  Xóa
                </button>
              </div>
              <hr />
            </div>
          );
        })}
      </div>

      <div className="cart-bottom">
        <div className="cart-total">
          {notice ? <p className="cart-notice">{notice}</p> : null}

          <div>
            <div className="cart-total-details">
              <p>Tạm tính</p>
              <p>{formatVND(subtotal)}</p>
            </div>

            <hr />

            <div className="cart-total-details">
              <b>Tổng cộng</b>
              <b>{formatVND(grandTotal)}</b>
            </div>
          </div>

          <div className="cart-total-actions">
            <button type="button" className="cart-add-more-btn" onClick={handleAddMoreItems}>
              THÊM MÓN
            </button>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isCartEmpty}
              title={isCartEmpty ? "Thêm sản phẩm vào giỏ để thanh toán" : ""}
              className={`cart-checkout-btn ${isCartEmpty ? "disabled-checkout" : ""}`}
            >
              TIẾN HÀNH THANH TOÁN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;

