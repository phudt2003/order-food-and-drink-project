import React from 'react'

function QuantitySelector({ quantity, onDecrease, onIncrease }) {
  return (
    <section className='quantity-selector'>
      <h3>Số Lượng</h3>
      <div className='quantity-controls'>
        <button type='button' className='qty-btn qty-decrease' onClick={onDecrease}>
          -
        </button>
        <span>{quantity}</span>
        <button type='button' className='qty-btn qty-increase' onClick={onIncrease}>
          +
        </button>
      </div>
    </section>
  )
}

export default QuantitySelector
