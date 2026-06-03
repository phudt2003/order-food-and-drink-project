import React from 'react'
import { formatVND } from '../../utils/currency'

const BirthdayRewardModal = ({ isOpen, voucher, onClose, onViewVoucher }) => {
  if (!isOpen) return null

  const discount = Number(voucher?.discountValue || 0)

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'
      role='presentation'
      onClick={() => onClose?.()}
    >
      <div
        className='w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-xl'
        role='dialog'
        aria-modal='true'
        aria-label='Happy Birthday'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h2 className='text-lg font-semibold'>🎂 Happy Birthday!</h2>
            <p className='mt-1 text-sm opacity-80'>
              Coffee Bingo tặng bạn voucher {formatVND(discount)}.
            </p>
          </div>
          <button
            type='button'
            className='rounded-full px-2 py-1 text-sm opacity-70 hover:opacity-100'
            onClick={() => onClose?.()}
            aria-label='Đóng'
          >
            ✕
          </button>
        </div>

        <div className='mt-5 flex items-center justify-end gap-2'>
          <button
            type='button'
            className='rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5'
            onClick={() => onClose?.()}
          >
            Đóng
          </button>
          <button
            type='button'
            className='rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95'
            onClick={() => onViewVoucher?.()}
          >
            Nhận voucher
          </button>
        </div>
      </div>
    </div>
  )
}

export default BirthdayRewardModal
