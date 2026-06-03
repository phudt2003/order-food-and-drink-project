import React from 'react'
import Modal from '../common/Modal'

const DailyCheckinModal = ({ open, onClose, onCheckin, rewardCoins = 10, busy = false, error = '' }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Điểm danh'
      description='Điểm danh mỗi ngày để nhận xu thưởng.'
      maxWidthClassName='max-w-md'
    >
      <div className='space-y-3'>
        <div className='rounded-2xl bg-amber-50 p-4 text-stone-800'>
          <p className='text-sm'>Thưởng hôm nay</p>
          <p className='mt-1 text-2xl font-bold'>+{Math.max(0, Number(rewardCoins || 0)).toLocaleString('vi-VN')} xu</p>
        </div>

        {error ? <p className='text-sm text-red-500'>{String(error)}</p> : null}

        <div className='flex items-center justify-end gap-2'>
          <button
            type='button'
            className='rounded-full border border-[#E5E5E5] bg-transparent px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 dark:border-[#3A2E26] dark:text-gray-200 dark:hover:bg-white/5'
            onClick={() => onClose?.()}
            disabled={busy}
          >
            Đóng
          </button>
          <button
            type='button'
            className='rounded-full bg-[#C67C4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b06b3e] disabled:opacity-60'
            onClick={() => onCheckin?.()}
            disabled={busy}
          >
            {busy ? 'Đang điểm danh...' : 'Điểm danh'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DailyCheckinModal
