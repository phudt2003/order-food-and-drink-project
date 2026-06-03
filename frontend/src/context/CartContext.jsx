import { useContext, useMemo } from "react";
import { StoreContext } from "./StoreContext";

// CartContext tối giản để tương thích với code dùng `useCart()`.
// Project hiện đang quản lý giỏ hàng trong StoreContext (cartLineItems/cartItems),
// nên ở đây chỉ "map" sang shape: { cart: { items: [] } }.
export const useCart = () => {
  const store = useContext(StoreContext);

  const items = useMemo(() => {
    // Ưu tiên line items (đã normalize), fallback về rỗng.
    return Array.isArray(store?.cartLineItems) ? store.cartLineItems : [];
  }, [store?.cartLineItems]);

  return { cart: { items } };
};

