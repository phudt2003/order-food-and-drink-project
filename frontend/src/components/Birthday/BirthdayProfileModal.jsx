import React, { useContext, useEffect, useMemo, useState } from 'react'
import { StoreContext } from '../../context/StoreContext'

const BirthdayProfileModal = ({ isOpen, onClose }) => {
  const { userProfile, updateBirthday } = useContext(StoreContext)
  const [birthdayValue, setBirthdayValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [isOpen])

  const defaultBirthday = useMemo(() => {
    if (!userProfile?.birthday) return ''
    try {
      const date = new Date(userProfile.birthday)
      if (!Number.isFinite(date.getTime())) return ''
      return date.toISOString().slice(0, 10)
    } catch {
      return ''
    }
  }, [userProfile?.birthday])

  const inputValue = birthdayValue || defaultBirthday

  const submit = async () => {
    setError('')
    const trimmed = String(inputValue || '').trim()
    if (!trimmed) {
      setError('Vui lòng chọn ngày sinh.')
      return
    }

    setSubmitting(true)
    try {
      const response = await updateBirthday(trimmed)
      if (response?.success) {
        onClose?.()
        return
      }
      setError(response?.message || 'Không cập nhật được ngày sinh.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay: Giảm độ tối, thêm blur */}
      <div
        className='fixed inset-0 z-[900] bg-black/30 backdrop-blur-[6px]'
        onClick={() => onClose?.()}
      />

      {/* Modal: Tách riêng, căn giữa, thêm animation và shadow */}
      <div
        className='fixed left-1/2 top-1/2 z-[1100] w-[400px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2)] animate-popupFade dark:bg-[#2A211B] dark:text-[#F5F5F5]'
        role='dialog'
        aria-modal='true'
        aria-label='Cập nhật ngày sinh'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h2 className='text-lg font-semibold text-stone-800 dark:text-[#F5F5F5]'>Cập nhật ngày sinh</h2>
            <p className='mt-1 text-sm text-stone-600 dark:text-gray-300'>Nhập ngày sinh để nhận quà đặc biệt từ Coffee Bingo!</p>
          </div>
          <button
            type='button'
            className='rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200'
            onClick={() => onClose?.()}
            aria-label='Đóng'
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className='mt-4'>
          <label className='block text-sm font-medium text-stone-700 dark:text-gray-200'>Ngày sinh</label>
          <input
            type='date'
            className='mt-2 w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:border-[#3A2E26] dark:bg-gray-800 dark:text-gray-200'
            value={inputValue}
            onChange={(event) => setBirthdayValue(event.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            disabled={submitting}
            placeholder="dd/mm/yyyy"
          />
          {error ? <p className='mt-2 text-sm text-red-500'>{error}</p> : null}
        </div>

        <div className='mt-5 flex items-center justify-end gap-2'>
          <button
            type='button'
            className='rounded-full border border-[#E5E5E5] bg-transparent px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 dark:border-[#3A2E26] dark:text-gray-200 dark:hover:bg-white/5'
            onClick={() => onClose?.()}
            disabled={submitting}
          >
            Để sau
          </button>
          <button
            type='button'
            className='rounded-full bg-[#C67C4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b06b3e] disabled:opacity-60'
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Đang lưu...' : 'Cập nhật'}
          </button>
        </div>
      </div>
    </>
  )
}

export default BirthdayProfileModal
