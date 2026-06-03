import React from 'react'
import { formatVND } from '../../utils/currency'
import { resolveImageSrc } from '../../utils/resolveImage'

function ProductInfo({ product, url }) {
  const imageSrc = resolveImageSrc(product?.image, url)
  const basePrice = Number(product.basePrice ?? product.price ?? 0)

  return (
    <section className='product-info-card'>
      <img className='product-detail-image' src={imageSrc} alt={product.name} />

      <div className='product-detail-meta'>
        <h1>{product.name}</h1>
        <p className='product-detail-base-price'>Gia co ban: {formatVND(basePrice)}</p>
        <p className='product-detail-description'>{product.description}</p>
      </div>
    </section>
  )
}

export default ProductInfo