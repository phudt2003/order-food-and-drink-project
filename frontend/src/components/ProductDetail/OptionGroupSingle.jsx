import React from "react";
import { formatVND } from "../../utils/currency";

function OptionGroupSingle({ group, value, onChange }) {
  return (
    <section className="option-group">
      <div className="option-group-header">
        <h3>{group.label}</h3>
        {group.required ? <span className="required-badge">Required</span> : null}
      </div>

      <div className="option-list">
        {group.options.map((option) => (
          <label key={option.id} className="option-item">
            <input
              type="radio"
              name={group.id}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(group.id, option.id)}
            />
            <span>{option.name}</span>
            <span className="option-price">+{formatVND(option.price)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export default OptionGroupSingle;

