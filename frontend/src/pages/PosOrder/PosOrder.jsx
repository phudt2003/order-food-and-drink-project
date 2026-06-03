import axios from "axios";
import { useContext, useEffect, useMemo, useState } from "react";
import { StoreContext } from "../../context/StoreContext";
import SugarLevelPicker from "../../components/SugarLevelPicker/SugarLevelPicker";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PosOrder = () => {
  const { url, token, food_list } = useContext(StoreContext);

  const [toppings, setToppings] = useState([]);
  const [loadingToppings, setLoadingToppings] = useState(false);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sugarLevel, setSugarLevel] = useState(100);

  const [toppingQtyById, setToppingQtyById] = useState({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [success, setSuccess] = useState("");

  const product = useMemo(
    () => (Array.isArray(food_list) ? food_list.find((f) => String(f?._id) === String(productId)) : null),
    [food_list, productId]
  );

  const allowSugar = Boolean(product?.allowSugar);

  useEffect(() => {
    if (!url) return;
    if (!token) return;

    let cancelled = false;
    setLoadingToppings(true);

    axios
      .get(`${url}/api/toppings`, { headers: { token } })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setToppings(list);
      })
      .catch(() => {
        if (cancelled) return;
        setToppings([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingToppings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, url]);

  useEffect(() => {
    // Reset preview when selections change.
    setPreview(null);
    setError("");
    setSuccess("");
  }, [productId, quantity, sugarLevel, toppingQtyById]);

  const selectedToppings = useMemo(() => {
    const entries = Object.entries(toppingQtyById)
      .map(([toppingId, qty]) => ({ toppingId, quantity: Math.max(1, Math.round(toNumber(qty, 1))) }))
      .filter((t) => t.toppingId && t.quantity > 0);
    return entries;
  }, [toppingQtyById]);

  const payload = useMemo(
    () => ({
      productId,
      quantity: Math.max(1, Math.round(toNumber(quantity, 1))),
      sugarLevel: allowSugar ? sugarLevel : 0,
      toppings: selectedToppings,
    }),
    [allowSugar, productId, quantity, selectedToppings, sugarLevel]
  );

  const toggleTopping = (toppingId) => {
    setToppingQtyById((prev) => {
      const next = { ...prev };
      if (next[toppingId]) {
        delete next[toppingId];
        return next;
      }
      next[toppingId] = 1;
      return next;
    });
  };

  const setToppingQty = (toppingId, qty) => {
    setToppingQtyById((prev) => ({ ...prev, [toppingId]: Math.max(1, Math.round(toNumber(qty, 1))) }));
  };

  const callPreview = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await axios.post(`${url}/api/orders/preview`, payload, { headers: { token } });
      const data = res?.data?.data || null;
      setPreview(data);
      if (data && data.ok === false) {
        setError("Thiếu nguyên liệu. Vui lòng xem danh sách thiếu bên dưới.");
      }
    } catch (e) {
      const msg = String(e?.response?.data?.message || "Không thể preview nguyên liệu.");
      setError(msg);
      setPreview(e?.response?.data?.details ? { ...e.response.data.details, ok: false } : null);
    } finally {
      setBusy(false);
    }
  };

  const submitOrder = async () => {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const res = await axios.post(`${url}/api/orders`, payload, { headers: { token } });
      const data = res?.data?.data || null;
      setSuccess(`Tạo order thành công: ${data?.orderId || ""}`.trim());
      setPreview(null);
      setToppingQtyById({});
      setQuantity(1);
      setSugarLevel(100);
    } catch (e) {
      const msg = String(e?.response?.data?.message || "Không thể tạo order.");
      setError(msg);
      const shortages = e?.response?.data?.details?.shortages || null;
      if (Array.isArray(shortages)) {
        setPreview({ ok: false, shortages });
      }
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = Boolean(token && url && productId && !busy);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Tạo Order (POS)</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Chọn sản phẩm, topping, mức đường và số lượng. Hệ thống sẽ check kho và trừ nguyên liệu.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Sản phẩm</label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">-- Chọn sản phẩm --</option>
              {(Array.isArray(food_list) ? food_list : []).map((f) => (
                <option key={String(f?._id)} value={String(f?._id)}>
                  {String(f?.name || "")} ({String(f?.type || "")})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Số lượng</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.round(toNumber(e.target.value, 1))))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Mức đường {allowSugar ? "" : "(Không áp dụng)"}
              </label>
              <SugarLevelPicker
                value={allowSugar ? sugarLevel : 0}
                onChange={(level) => setSugarLevel(level)}
                disabled={!allowSugar}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="mb-1 block text-sm font-medium">Topping</label>
              {loadingToppings && <span className="text-xs text-slate-500">Đang tải…</span>}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(Array.isArray(toppings) ? toppings : []).map((t) => {
                const id = String(t?._id || "");
                const checked = Boolean(toppingQtyById[id]);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTopping(id)}
                      />
                      <span className="font-medium">{String(t?.name || "")}</span>
                      <span className="text-xs text-slate-500">
                        {Math.max(0, toNumber(t?.price, 0)).toLocaleString()}đ
                      </span>
                    </label>

                    {checked && (
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950"
                        value={toppingQtyById[id]}
                        onChange={(e) => setToppingQty(id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={callPreview}
              disabled={!canSubmit}
            >
              Preview nguyên liệu
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              onClick={submitOrder}
              disabled={!canSubmit}
            >
              Tạo order + trừ kho
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {success}
            </div>
          )}

          {preview && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Preview trừ kho</h2>
                <span className={`text-xs ${preview.ok ? "text-emerald-600" : "text-rose-600"}`}>
                  {preview.ok ? "Đủ nguyên liệu" : "Thiếu nguyên liệu"}
                </span>
              </div>

              {Array.isArray(preview.requirements) && preview.requirements.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Nguyên liệu</th>
                        <th className="py-2 pr-3">Cần dùng</th>
                        <th className="py-2 pr-3">Tồn kho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.requirements.map((r) => (
                        <tr key={String(r.ingredientId)} className="border-t border-slate-100 dark:border-slate-900">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{String(r.name || r.ingredientId)}</div>
                            <div className="text-xs text-slate-500">{String(r.unit || "")}</div>
                          </td>
                          <td className="py-2 pr-3">{Math.max(0, toNumber(r.quantity, 0))}</td>
                          <td className="py-2 pr-3">{r.stock != null ? Math.max(0, toNumber(r.stock, 0)) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {Array.isArray(preview.shortages) && preview.shortages.length > 0 && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                  <div className="font-medium">Thiếu:</div>
                  <ul className="mt-1 list-disc pl-5">
                    {preview.shortages.map((s) => (
                      <li key={String(s.ingredientId)}>
                        {String(s.name || s.ingredientId)}: cần {Math.max(0, toNumber(s.need, 0))}{" "}
                        {String(s.unit || "")} (còn {Math.max(0, toNumber(s.stock, 0))})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PosOrder;
