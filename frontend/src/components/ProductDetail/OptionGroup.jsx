import React from 'react'
import { formatVND } from '../../utils/currency'

function OptionGroup({ group, groupKey, value, onChange }) {
  const isSingle = group.type === 'single'
  const selectedCount = isSingle ? (value ? 1 : 0) : value.length

  return (
    <section className='option-group'>
      <div className='option-group-header'>
        <h3>{group.name}</h3>
        <span className='option-limit'>{group.type === 'multiple' ? `Da chon: ${selectedCount}` : 'Chon mot'}</span>
      </div>

      <div className='option-list'>
        {group.items.map((item) => {
          const checked = isSingle ? value === item.id : Array.isArray(value) && value.includes(item.id)

          return (
            <label key={item.id} className='option-item'>
              <input
                type={isSingle ? 'radio' : 'checkbox'}
                name={isSingle ? groupKey : undefined}
                checked={checked}
                onChange={() => onChange(groupKey, item.id, group.type)}
              />
              <span>{item.name}</span>
              <span className='option-price'>+{formatVND(item.price)}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

export default OptionGroup
