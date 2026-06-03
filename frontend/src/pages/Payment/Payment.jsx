import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { getOrderStatus } from "../../api/orderApi";
import { formatVND } from "../../utils/currency";
import "./Payment.css";

const normalizeStatus = (value) => String(value || "pending").toLowerCase();
const hasStatusKeyword = (value, keywords) =>
  keywords.some((keyword) => String(value || "").includes(keyword));
const isPaidStatus = (value) => hasStatusKeyword(normalizeStatus(value), ["paid", "success", "completed", "done"]);
const isFailedStatus = (value) =>
  hasStatusKeyword(normalizeStatus(value), ["failed", "fail", "cancel", "cancelled", "expired", "error", "declined"]);

const resolveStatusLabel = (value) => {
  if (isPaidStatus(value)) return "Da thanh toan";
  if (isFailedStatus(value)) return "Thanh toan that bai";
  return "Cho thanh toan";
};

const PAYMENT_GUIDE = {
  bankName: "KienLongBank",
  virtualAccount: "101499100004570901",
  accountName: "DUONG TRONG PHU",
};
const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

const Payment = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { url, token, clearCart, refreshCart } = useContext(StoreContext);

  const initialState = location.state || {};
  const [paymentInfo, setPaymentInfo] = useState({
    orderId: initialState.orderId || orderId || "",
    amount: Number(initialState.amount || 0),
    transferContent: String(initialState.transferContent || (orderId ? `ORDER_${orderId}` : "")),
    qrCode: String(initialState.qrCode || ""),
  });
  const [status, setStatus] = useState(normalizeStatus(initialState.status));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [stopPolling, setStopPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);
  const hasRedirectedRef = useRef(false);
  const paymentStartRef = useRef(null);

  const getPaymentStartKey = useCallback((id) => `payment_start_${id}`, []);

  const triggerFailure = useCallback(
    (message, nextStatus = "failed") => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      setStopPolling(true);
      setStatus(nextStatus);
      setFailureMessage(message || "Thanh toan that bai.");
      setError("");
      setIsLoading(false);
      setIsAutoRedirecting(true);
      if (orderId) {
        localStorage.removeItem(getPaymentStartKey(orderId));
      }
    },
    [getPaymentStartKey, orderId]
  );

  const syncStatus = useCallback(async () => {
    if (!orderId || !token) return;

    try {
      const response = await getOrderStatus({ url, token, orderId });
      if (!response?.data?.success) {
        setError(response?.data?.message || "Khong lay duoc trang thai thanh toan");
        return;
      }

      const data = response.data.data || {};
      const nextStatus = data?.isPaid || data?.payment === true ? "paid" : normalizeStatus(data.status);
      setPaymentInfo((prev) => ({
        orderId: data.orderId || prev.orderId || orderId,
        amount: Number(data.amount ?? prev.amount ?? 0),
        transferContent: String(data.transferContent || prev.transferContent || `ORDER_${orderId}`),
        qrCode: String(data.qrCode || prev.qrCode || ""),
      }));
      setStatus(nextStatus);
      setError("");

      if (isPaidStatus(nextStatus) && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        setStopPolling(true);
        if (orderId) {
          localStorage.removeItem(getPaymentStartKey(orderId));
        }
        clearCart();
        refreshCart().catch(() => {});
        navigate("/payment/success", {
          replace: true,
          state: {
            orderId: data.orderId || orderId,
            amount: Number(data.amount ?? 0),
          },
        });
        return;
      }

      if (isFailedStatus(nextStatus) && !hasRedirectedRef.current) {
        triggerFailure("Thanh toan that bai. He thong se tro ve trang chu sau vai giay.");
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Khong lay duoc trang thai thanh toan");
      if (requestError?.response?.status === 404) {
        setStopPolling(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearCart, getPaymentStartKey, navigate, orderId, refreshCart, token, triggerFailure, url]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!orderId) {
      navigate("/checkout", { replace: true });
      return;
    }

    syncStatus();
    if (stopPolling) return;
    const pollId = window.setInterval(syncStatus, 3000);

    return () => {
      window.clearInterval(pollId);
    };
  }, [navigate, orderId, syncStatus, token, stopPolling]);

  useEffect(() => {
    if (!orderId) return;
    const key = getPaymentStartKey(orderId);
    const stored = Number(localStorage.getItem(key));
    const startAt = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    if (!(Number.isFinite(stored) && stored > 0)) {
      localStorage.setItem(key, String(startAt));
    }
    paymentStartRef.current = startAt;
  }, [getPaymentStartKey, orderId]);

  useEffect(() => {
    if (!orderId || stopPolling) return;
    if (isPaidStatus(status) || isFailedStatus(status)) return;
    const startAt = paymentStartRef.current;
    if (!Number.isFinite(startAt)) return;
    const elapsed = Date.now() - startAt;
    const remaining = PAYMENT_TIMEOUT_MS - elapsed;
    if (remaining <= 0) {
      triggerFailure("Qua 5 phut chua thanh toan. Don hang da bi huy.", "expired");
      return;
    }
    const timeoutId = window.setTimeout(() => {
      if (!isPaidStatus(status) && !isFailedStatus(status)) {
        triggerFailure("Qua 5 phut chua thanh toan. Don hang da bi huy.", "expired");
      }
    }, remaining);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [orderId, status, stopPolling, triggerFailure]);

  useEffect(() => {
    if (!isAutoRedirecting) return;
    const timer = window.setTimeout(() => {
      navigate("/", {
        replace: true,
        state: {
          paymentStatus: "failed",
          orderId,
        },
      });
    }, 3000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isAutoRedirecting, navigate, orderId]);

  useEffect(() => {
    if (stopPolling) return;

    const handleFocus = () => {
      syncStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncStatus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncStatus, stopPolling]);

  const copyTransferContent = async () => {
    if (!paymentInfo.transferContent) return;

    try {
      await navigator.clipboard.writeText(paymentInfo.transferContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="payment-page">
      <div className="payment-card">
        <h1>Thanh toan chuyen khoan (SePay)</h1>
        <p className="payment-subtitle">Quet QR ben duoi de thanh toan don hang cua ban.</p>

        <div className="payment-guide">
          <h2>HUONG DAN THANH TOAN</h2>
          <p>Vui long chuyen khoan dung thong tin sau:</p>
          <div className="payment-guide-meta">
            <div>
              <span>Ngan hang:</span>
              <b>{PAYMENT_GUIDE.bankName}</b>
            </div>
            <div>
              <span>So tai khoan (VA):</span>
              <b>{PAYMENT_GUIDE.virtualAccount}</b>
            </div>
            <div>
              <span>Chu tai khoan:</span>
              <b>{PAYMENT_GUIDE.accountName}</b>
            </div>
          </div>
          <div className="payment-guide-notes">
            <p>* Day la tai khoan ao (VA) dung de xac nhan thanh toan tu dong.</p>
            <p>* Vui long chuyen dung so tai khoan tren.</p>
            <p>* Khong thay doi noi dung chuyen khoan neu he thong cung cap ma don.</p>
          </div>
          <p className="payment-guide-final">Sau khi chuyen khoan thanh cong, he thong se tu dong xac nhan giao dich.</p>
        </div>

        <div className="payment-meta">
          <div>
            <span>Ma don:</span>
            <b>{paymentInfo.orderId || "--"}</b>
          </div>
          <div>
            <span>Trang thai:</span>
            <b
              className={`status-chip ${
                isPaidStatus(status) ? "paid" : isFailedStatus(status) ? "failed" : "pending"
              }`}
            >
              {resolveStatusLabel(status)}
            </b>
          </div>
          <div>
            <span>So tien:</span>
            <b>{formatVND(paymentInfo.amount)}</b>
          </div>
        </div>

        <div className="payment-qr-wrap">
          {paymentInfo.qrCode ? (
            <img src={paymentInfo.qrCode} alt="SePay QR" className="payment-qr" />
          ) : (
            <p className="payment-error">Chua co QR code. Vui long thu tai lai trang.</p>
          )}
        </div>

        <div className="transfer-content-box">
          <span>Noi dung chuyen khoan</span>
          <code>{paymentInfo.transferContent || "--"}</code>
          <button type="button" onClick={copyTransferContent}>
            {copied ? "Da sao chep" : "Sao chep"}
          </button>
        </div>

        {isLoading ? <p className="payment-hint">Dang kiem tra trang thai thanh toan...</p> : null}
        {!isLoading && !isPaidStatus(status) && !isFailedStatus(status) ? (
          <p className="payment-hint">He thong tu dong kiem tra moi 3 giay.</p>
        ) : null}
        {error ? <p className="payment-error">{error}</p> : null}
        {isFailedStatus(status) ? (
          <div className="payment-failed">
            <p className="payment-error">{failureMessage || "Thanh toan that bai."}</p>
            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                navigate("/", {
                  replace: true,
                  state: { paymentStatus: "failed", orderId },
                })
              }
            >
              Tro ve trang chu
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Payment;
