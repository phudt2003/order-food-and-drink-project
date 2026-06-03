import React from 'react'
import { formatVND } from '../../utils/currency'

function OptionGroupMulti({ group, selectedValues, onToggle, canSelectMore }) {
  const currentCount = selectedValues.length

  return (
    <section className='option-group'>
      <div className='option-group-header'>
        <h3>{group.label}</h3>
        <span className='option-limit'>
          Min {group.min} - Max {group.max}
        </span>
      </div>

      <div className='option-list'>
        {group.options.map((option) => {
          const isChecked = selectedValues.includes(option.id)
          const isDisabled = !isChecked && !canSelectMore

          return (
            <label key={option.id} className={`option-item ${isDisabled ? 'option-item-disabled' : ''}`}>
              <input type='checkbox' checked={isChecked} disabled={isDisabled} onChange={() => onToggle(group.id, option.id)} />
              <span>{option.name}</span>
              <span className='option-price'>+{formatVND(option.price)}</span>
            </label>
          )
        })}
      </div>

      <p className='option-hint'>Da chon: {currentCount}/{group.max}</p>
    </section>
  )
}

export default OptionGroupMulti
