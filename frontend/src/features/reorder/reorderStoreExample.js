/**
 * Reorder store example (Zustand-style shape).
 *
 * This project currently uses StoreContext.
 * Keep this file as a reference if you later migrate reorder state to Zustand/Redux.
 */

export const createReorderStoreState = () => ({
  loadingByOrderId: {},
  lastErrorByOrderId: {},
});

export const reorderStoreActions = {
  setLoading(state, orderId, value) {
    const key = String(orderId || "").trim();
    if (!key) return state;
    const next = { ...state, loadingByOrderId: { ...state.loadingByOrderId } };
    if (value) next.loadingByOrderId[key] = true;
    else delete next.loadingByOrderId[key];
    return next;
  },
  setError(state, orderId, message) {
    const key = String(orderId || "").trim();
    if (!key) return state;
    const next = { ...state, lastErrorByOrderId: { ...state.lastErrorByOrderId } };
    const text = String(message || "").trim();
    if (text) next.lastErrorByOrderId[key] = text;
    else delete next.lastErrorByOrderId[key];
    return next;
  },
};
