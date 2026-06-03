import React, { useMemo, useState } from "react";
import "./StarRating.css";

const StarRating = ({
  value = 0,
  max = 5,
  readOnly = false,
  onChange,
  className = "",
  showText = true,
}) => {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || value;

  const labelText = useMemo(() => {
    const textValue = hoverValue || value;
    if (!textValue) return "Chưa chọn";
    return `Đã chọn ${textValue}/${max} sao`;
  }, [hoverValue, value, max]);

  const handleSelect = (nextValue) => {
    if (readOnly) return;
    if (onChange) onChange(nextValue);
  };

  return (
    <div
      className={`star-rating ${readOnly ? "is-readonly" : ""} ${className}`}
      onMouseLeave={() => setHoverValue(0)}
    >
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const isActive = displayValue >= starValue;
        return (
          <button
            key={starValue}
            type="button"
            className={`star-button ${isActive ? "is-active" : ""}`}
            disabled={readOnly}
            onMouseEnter={() => {
              if (!readOnly) setHoverValue(starValue);
            }}
            onFocus={() => {
              if (!readOnly) setHoverValue(starValue);
            }}
            onClick={() => handleSelect(starValue)}
            aria-label={`${starValue} sao`}
          >
            <span className="star-icon">{isActive ? "★" : "☆"}</span>
          </button>
        );
      })}

      {showText ? <span className="star-text">{labelText}</span> : null}
    </div>
  );
};

export default StarRating;
