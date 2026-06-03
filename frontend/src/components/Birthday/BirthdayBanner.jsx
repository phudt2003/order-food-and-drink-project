import React from 'react'
import { formatVND } from '../../utils/currency'

const BirthdayBanner = ({ voucher, onClaim }) => {
  if (!voucher) return null

  const discount = Number(voucher?.discountValue || 0)
  const minOrder = Number(voucher?.minOrderValue || 0)

  return (
    <section className='mx-auto w-full max-w-6xl px-4 pt-4'>
      <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-sm font-semibold tracking-wide text-[var(--accent)]'>🎂 Happy Birthday!</p>
            <h3 className='mt-1 text-lg font-semibold'>
              Coffee Bingo tặng bạn voucher giảm {formatVND(discount)}
            </h3>
            <p className='mt-1 text-sm opacity-80'>
              Đơn tối thiểu: {formatVND(minOrder)} • HSD: 3 ngày
            </p>
          </div>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onClaim}
              className='rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95'
            >
              Nhận voucher
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BirthdayBanner

