import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import OrderTabs from "./OrderTabs";
import OrderList from "../../components/orders/OrderList";
import { normalizeStatus } from "../../components/orders/OrderStatusBadge";

const OrderSkeleton = ({ index }) => (
  <div
    key={`skeleton-${index}`}
    className="mb-5 rounded-xl border bg-white p-5 shadow-sm animate-pulse"
  >
    <div className="mb-3 flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-200" />
      </div>
      <div className="h-6 w-24 rounded-full bg-gray-200" />
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between border-t pt-4">
      <div className="space-y-2">
        <div className="h-3 w-20 rounded bg-gray-200" />
        <div className="h-5 w-28 rounded bg-gray-200" />
      </div>
      <div className="h-9 w-32 rounded-lg bg-gray-200" />
    </div>
  </div>
);

const MyOrdersPage = () => {
  const { url, token } = useContext(StoreContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("all");
  const [error, setError] = useState("");
  const pollingRef = useRef(false);

  const fetchOrders = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (pollingRef.current) return;
    pollingRef.current = true;

    if (!silent) {
      setLoading(true);
    }
    setError("");
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const response = await axios.get(`${url}/api/orders`, { headers });
      if (response?.data?.success) {
        setOrders(Array.isArray(response.data.data) ? response.data.data : []);
        return;
      }
    } catch (err) {
      // fallback below
    }

    try {
      const response = await axios.get(`${url}/api/orders/my`, { headers });
      if (response?.data?.success) {
        setOrders(Array.isArray(response.data.data) ? response.data.data : []);
        return;
      }
    } catch (err) {
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
    } catch (err) {
      setOrders([]);
      setError("Không thể tải đơn hàng.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
      pollingRef.current = false;
    }
  }, [token, url]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!token) return;
    const intervalId = setInterval(() => fetchOrders({ silent: true }), 5000);
    return () => clearInterval(intervalId);
  }, [token, fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (activeStatus === "all") return orders;
    return orders.filter(
      (order) => normalizeStatus(order?.status) === activeStatus
    );
  }, [orders, activeStatus]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Đơn hàng của tôi</h1>
        <p className="mb-6 mt-1 text-gray-500">Theo dõi tất cả đơn hàng của bạn</p>
      </div>

      <OrderTabs value={activeStatus} onChange={setActiveStatus} />

      {loading && Array.from({ length: 3 }).map((_, idx) => <OrderSkeleton key={idx} index={idx} />)}

      {!loading && error && (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-white p-10 text-center">
          <div className="rounded-full bg-orange-50 p-4 text-orange-500">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <p className="text-sm text-gray-600">Bạn chưa có đơn hàng nào</p>
          <button
            type="button"
            onClick={() => navigate("/menu")}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            Khám phá menu
          </button>
        </div>
      )}

      {!loading && !error && <OrderList orders={filteredOrders} />}
    </div>
  );
};

export default MyOrdersPage;
