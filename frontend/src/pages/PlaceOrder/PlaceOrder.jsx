import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "./PlaceOrder.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { formatVND } from "../../utils/currency";

const GOOGLE_PLACES_SCRIPT_ID = "google-places-script";
const SHOP_LOCATION = { lat: 10.0989, lng: 105.9479 };
const STORE_ADDRESS =
  "To 16, Ap Thanh Phu, Xa Thanh Loi, Huyen Binh Tan, Tinh Vinh Long, Viet Nam";

const normalizeVietnamPhone = (value) => {
  const raw = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (raw.startsWith("+84")) return `0${raw.slice(3)}`;
  if (raw.startsWith("84")) return `0${raw.slice(2)}`;
  return raw;
};

const isValidVietnamPhone = (value) => /^0[35789]\d{8}$/.test(normalizeVietnamPhone(value));

const loadGoogleMapsScript = (apiKey) =>
  new Promise((resolve, reject) => {
    if (!apiKey) {
      resolve(false);
      return;
    }

    if (window.google?.maps?.places) {
      resolve(true);
      return;
    }

    const existing = document.getElementById(GOOGLE_PLACES_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => reject(new Error("Google Maps load failed")));
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_PLACES_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Google Maps load failed"));
    document.body.appendChild(script);
  });

const PlaceOrder = () => {
  const { getTotalCartAmount, token, cartLineItems, url, saveDeliveryLocation, deliveryLocation } =
    useContext(StoreContext);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [addressCoords, setAddressCoords] = useState({ lat: null, lng: null });
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationText, setDurationText] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [storeLocation, setStoreLocation] = useState(SHOP_LOCATION);
  const [isQuotingFee, setIsQuotingFee] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const mapContainerRef = useRef(null);
  const addressInputRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const storeMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);

  const navigate = useNavigate();
  const subtotal = getTotalCartAmount();
  const grandTotal = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee]);

  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!geocoderRef.current || !window.google?.maps?.GeocoderStatus) return "";

    return new Promise((resolve) => {
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && Array.isArray(results) && results[0]) {
          resolve(results[0].formatted_address || "");
          return;
        }
        resolve("");
      });
    });
  }, []);

  const quoteDelivery = useCallback(
    async ({ text, lat, lng }) => {
      if (!token) return;

      setIsQuotingFee(true);
      try {
        const payload = {};
        if (text) payload.addressText = text;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          payload.lat = lat;
          payload.lng = lng;
        }

        const response = await axios.post(`${url}/api/order/delivery-quote`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response?.data?.success) {
          alert(response?.data?.message || "Khong the tinh phi giao hang");
          return;
        }

        const quotedStoreLocation = response.data.storeLocation || SHOP_LOCATION;
        const deliveryAddress = response.data.deliveryAddress || {};
        const nextLocation = {
          text: deliveryAddress.text || text || addressInput,
          lat: Number(deliveryAddress.lat ?? lat),
          lng: Number(deliveryAddress.lng ?? lng),
        };

        setStoreLocation({
          lat: Number(quotedStoreLocation.lat || SHOP_LOCATION.lat),
          lng: Number(quotedStoreLocation.lng || SHOP_LOCATION.lng),
        });
        setAddressInput(nextLocation.text || "");
        setAddressCoords({
          lat: Number.isFinite(nextLocation.lat) ? nextLocation.lat : null,
          lng: Number.isFinite(nextLocation.lng) ? nextLocation.lng : null,
        });
        setDistanceKm(Number(response.data.distanceKm || 0));
        setDurationText(String(response.data.durationText || ""));
        const nextDurationMinutes = Number(response.data.durationMinutes);
        setDurationMinutes(Number.isFinite(nextDurationMinutes) ? nextDurationMinutes : null);
        setDeliveryFee(Number(response.data.deliveryFee || 0));
        saveDeliveryLocation(JSON.stringify(nextLocation));
      } catch (error) {
        console.error("Quote delivery error:", error);
        alert("Khong the tinh phi giao hang");
      } finally {
        setIsQuotingFee(false);
      }
    },
    [addressInput, saveDeliveryLocation, token, url]
  );

  const syncMarkerPosition = useCallback((lat, lng) => {
    if (!mapRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const point = { lat, lng };
    if (customerMarkerRef.current) {
      customerMarkerRef.current.setPosition(point);
    }
    mapRef.current.panTo(point);
  }, []);

  const handleMapSelection = useCallback(
    async (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      syncMarkerPosition(lat, lng);
      setAddressCoords({ lat, lng });

      const geocodedText = await reverseGeocode(lat, lng);
      const finalText = geocodedText || addressInput;
      if (geocodedText) {
        setAddressInput(geocodedText);
      }

      await quoteDelivery({ text: finalText, lat, lng });
    },
    [addressInput, quoteDelivery, reverseGeocode, syncMarkerPosition]
  );

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps || mapRef.current) return false;
    if (!mapContainerRef.current.offsetHeight || !mapContainerRef.current.offsetWidth) return false;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: addressCoords.lat && addressCoords.lng ? addressCoords : storeLocation,
      zoom: 15,
      streetViewControl: false,
      mapTypeControl: false,
    });

    mapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();

    storeMarkerRef.current = new window.google.maps.Marker({
      map,
      position: storeLocation,
      title: "Cua hang",
      label: "S",
    });

    const customerPosition =
      addressCoords.lat && addressCoords.lng ? addressCoords : storeLocation;
    customerMarkerRef.current = new window.google.maps.Marker({
      map,
      position: customerPosition,
      title: "Dia chi giao hang",
      draggable: true,
      label: "D",
    });

    map.addListener("click", (event) => {
      if (!event?.latLng) return;
      handleMapSelection(event.latLng.lat(), event.latLng.lng());
    });

    customerMarkerRef.current.addListener("dragend", (event) => {
      if (!event?.latLng) return;
      handleMapSelection(event.latLng.lat(), event.latLng.lng());
    });
    setMapReady(true);
    setMapError("");
    return true;
  }, [addressCoords, handleMapSelection, storeLocation]);

  useEffect(() => {
    const rawSaved = deliveryLocation || localStorage.getItem("deliveryLocation") || "";
    if (!rawSaved) return;

    try {
      const parsed = JSON.parse(rawSaved);
      if (parsed?.text) setAddressInput(parsed.text);
      if (Number.isFinite(Number(parsed?.lat)) && Number.isFinite(Number(parsed?.lng))) {
        setAddressCoords({ lat: Number(parsed.lat), lng: Number(parsed.lng) });
      }
    } catch {
      setAddressInput(rawSaved);
    }
  }, [deliveryLocation]);

  useEffect(() => {
    let isMounted = true;

    const setupMaps = async () => {
      try {
        // Called by Google Maps script when API key is invalid or blocked by referrer restrictions.
        window.gm_authFailure = () => {
          setMapError(
            "Google Maps auth failed. Check API key and HTTP referrer restrictions for localhost."
          );
        };

        const apiKey =
          import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY;
        if (!apiKey) {
          setMapError("Missing Google Maps key. Add VITE_GOOGLE_MAPS_API_KEY (or VITE_GOOGLE_MAPS_KEY) in frontend/.env");
          return;
        }

        const loaded = await loadGoogleMapsScript(apiKey);
        if (!loaded || !isMounted || !addressInputRef.current) {
          setMapError("Google Maps script did not load.");
          return;
        }
        setMapsLoaded(true);

        if (!window.google?.maps?.places) {
          setMapError("Google Maps loaded without places library.");
          return;
        }

        const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          componentRestrictions: { country: "vn" },
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const text =
            place?.formatted_address || place?.name || addressInputRef.current?.value || "";
          const lat = place?.geometry?.location?.lat?.();
          const lng = place?.geometry?.location?.lng?.();

          setAddressInput(text);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            handleMapSelection(lat, lng);
          }
        });

        let attempts = 0;
        const maxAttempts = 20;
        const tryInit = () => {
          if (!isMounted || mapRef.current) return;
          const ok = initializeMap();
          if (ok) return;
          attempts += 1;
          if (attempts < maxAttempts) {
            window.requestAnimationFrame(tryInit);
          } else {
            setMapError("Map container is not ready (check layout/height).");
          }
        };

        tryInit();
      } catch (error) {
        console.error("Google Maps setup error:", error);
        setMapError(error?.message || "Google Maps setup failed.");
      }
    };

    setupMaps();
    return () => {
      isMounted = false;
      if (window.gm_authFailure) {
        delete window.gm_authFailure;
      }
    };
  }, [handleMapSelection, initializeMap]);

  useEffect(() => {
    if (storeMarkerRef.current && Number.isFinite(storeLocation.lat) && Number.isFinite(storeLocation.lng)) {
      storeMarkerRef.current.setPosition(storeLocation);
    }
  }, [storeLocation]);

  useEffect(() => {
    if (Number.isFinite(addressCoords.lat) && Number.isFinite(addressCoords.lng)) {
      syncMarkerPosition(addressCoords.lat, addressCoords.lng);
    }
  }, [addressCoords, syncMarkerPosition]);

  useEffect(() => {
    if (!token || subtotal === 0) {
      navigate("/cart");
    }
  }, [token, subtotal, navigate]);

  const handleAddressInputChange = (event) => {
    const value = event.target.value;
    setAddressInput(value);
    setAddressCoords({ lat: null, lng: null });
    setDistanceKm(null);
    setDurationText("");
    setDurationMinutes(null);
    setDeliveryFee(0);
  };

  const handleCalculateFee = async () => {
    if (!addressInput.trim()) {
      alert("Vui long nhap dia chi giao hang");
      return;
    }

    await quoteDelivery({
      text: addressInput.trim(),
      lat: addressCoords.lat,
      lng: addressCoords.lng,
    });
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    if (isSubmittingOrder) return;
    const normalizedPhone = normalizeVietnamPhone(phone);

    if (!name.trim() || !phone.trim() || !addressInput.trim()) {
      alert("Vui long nhap ten, so dien thoai va dia chi giao hang");
      return;
    }
    if (!isValidVietnamPhone(normalizedPhone)) {
      alert("So dien thoai khong hop le. Vui long nhap dung dinh dang di dong Viet Nam.");
      return;
    }

    if (distanceKm === null) {
      alert("Vui long chon dia chi tren ban do de tinh phi giao hang");
      return;
    }

    const orderItems = cartLineItems.map((item) => ({
      _id: item.product._id,
      name: item.product.name,
      image: item.product.image,
      price: item.unitPrice,
      quantity: item.quantity,
      type: item?.product?.type || item?.productType || "",
      size: item.size,
      sugarLevel: item.sugarLevel,
      iceLevel: item.iceLevel,
      toppings: item.toppings,
    }));

    const safeDurationMinutes = Number.isFinite(durationMinutes) ? durationMinutes : null;

    const orderData = {
      address: {
        name: name.trim(),
        phone: normalizedPhone,
        deliveryText: addressInput.trim(),
      },
      deliveryAddress: {
        text: addressInput.trim(),
        lat: addressCoords.lat,
        lng: addressCoords.lng,
      },
      storeLocation,
      distanceKm,
      deliveryTime: safeDurationMinutes,
      durationMinutes: safeDurationMinutes,
      delivery_time: safeDurationMinutes,
      deliveryFee,
      items: orderItems,
      amount: grandTotal,
    };

    setIsSubmittingOrder(true);
    try {
      const response = await axios.post(url + "/api/order/create", orderData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        navigate(`/payment/${response.data.orderId}`, {
          state: {
            orderId: response.data.orderId,
            qrCode: response.data.qrCode,
            amount: response.data.amount,
            transferContent: response.data.transferContent,
            status: response.data.status,
          },
        });
      } else {
        alert(response.data.message || "Dat hang that bai");
      }
    } catch (error) {
      alert(error?.response?.data?.message || "Dat hang that bai");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <form onSubmit={placeOrder} className="place-order">
      <div className="place-order-left">
        <p className="title">Thong tin giao hang</p>

        <input
          required
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ten nguoi nhan"
        />

        <input
          required
          type="text"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="So dien thoai"
        />

        <input
          required
          ref={addressInputRef}
          type="text"
          value={addressInput}
          onChange={handleAddressInputChange}
          placeholder="Dia chi giao hang (Google Places)"
        />

        <div
          ref={mapContainerRef}
          style={{
            width: "100%",
            height: "400px",
            borderRadius: "10px",
            border: "1px solid #ddd",
            marginTop: "12px",
          }}
        />
        {mapError ? <p style={{ color: "#c0392b", marginTop: 8 }}>{mapError}</p> : null}
        {!mapError && mapsLoaded && !mapReady ? (
          <p style={{ color: "#7f8c8d", marginTop: 8 }}>Dang khoi tao ban do...</p>
        ) : null}

        <button type="button" onClick={handleCalculateFee} disabled={isQuotingFee}>
          {isQuotingFee ? "Dang tinh phi..." : "Tinh phi giao hang"}
        </button>

        <p>Dia chi cua hang: {STORE_ADDRESS}</p>
      </div>

      <div className="place-order-right">
        <div className="cart-total">
          <h2>Thong tin giao hang</h2>
          <div className="cart-total-details">
            <p>Khoang cach</p>
            <p>{distanceKm !== null ? `${distanceKm.toFixed(2)} km` : "--"}</p>
          </div>
          <hr />
          <div className="cart-total-details">
            <p>Thoi gian giao du kien</p>
            <p>{durationText || "--"}</p>
          </div>
          <hr />
          <div className="cart-total-details">
            <p>Phi giao hang</p>
            <p>{formatVND(deliveryFee)}</p>
          </div>
        </div>

        <div className="cart-total">
          <h2>Tong gio hang</h2>
          <div>
            <div className="cart-total-details">
              <p>Tam tinh</p>
              <p>{formatVND(subtotal)}</p>
            </div>
            <hr />
            <div className="cart-total-details">
              <p>Phi giao hang</p>
              <p>{formatVND(deliveryFee)}</p>
            </div>
            <hr />
            <div className="cart-total-details">
              <b>Tong cong</b>
              <b>{formatVND(grandTotal)}</b>
            </div>
          </div>
          <button type="submit" disabled={isSubmittingOrder}>
            {isSubmittingOrder ? "DANG DAT HANG..." : "DAT HANG"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default PlaceOrder;

