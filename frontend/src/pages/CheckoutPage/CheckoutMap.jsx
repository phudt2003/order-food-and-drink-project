import React from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from "react-leaflet";

const MapClickHandler = ({ onPickLocation }) => {
  useMapEvents({
    click(event) {
      onPickLocation({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
};

const CheckoutMap = ({
  storeLocation,
  selectedLocation,
  distanceKm,
  maxDistanceKm = 20,
  isOutOfRange = false,
  storeIcon,
  customerIcon,
  route,
  routeLoading,
  onPickLocation,
  onConfirmLocation,
}) => (
  <div className="checkout-map-panel">
    <p className="checkout-map-title">Chon vi tri tren ban do</p>
    <p className="map-hint">Bam vao ban do de chon diem giao hang.</p>

    <div className="checkout-map-wrap map-select">
      <MapContainer
        center={[storeLocation.lat, storeLocation.lng]}
        zoom={14}
        scrollWheelZoom
        className="checkout-leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[storeLocation.lat, storeLocation.lng]} icon={storeIcon} />

        {selectedLocation ? (
          <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={customerIcon} />
        ) : null}

        {route?.length ? <Polyline positions={route} color="orange" weight={4} /> : null}

        <MapClickHandler onPickLocation={onPickLocation} />
      </MapContainer>
    </div>

    {routeLoading ? <div className="map-route-loading">Dang tai duong di...</div> : null}

    {Number.isFinite(distanceKm) ? (
      <div className="mt-3 flex flex-col gap-1 text-sm text-gray-600">
        <p>
          Khoảng cách tới cửa hàng: <span className="font-medium">{distanceKm.toFixed(2)} km</span>
        </p>
        {isOutOfRange ? (
          <div className="bg-red-50 border border-red-300 text-red-600 p-3 rounded-lg">
            Địa chỉ nằm ngoài phạm vi giao hàng {maxDistanceKm}km. Vui lòng chọn vị trí gần hơn.
          </div>
        ) : null}
      </div>
    ) : null}

    <button
      type="button"
      className="pick-location-btn confirm-location-btn"
      onClick={onConfirmLocation}
      disabled={!selectedLocation || isOutOfRange}
    >
      Xac nhan vi tri
    </button>
  </div>
);

export default CheckoutMap;
