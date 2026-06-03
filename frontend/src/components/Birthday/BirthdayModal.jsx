import React, { useMemo, useState } from 'react'
import Modal from '../common/Modal'

const getLocalYmd = (date) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
}

const BirthdayModal = ({ open, onClose, onUpdated, birthday, onUpdateBirthday }) => {
  const [birthdayValue, setBirthdayValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const defaultBirthday = useMemo(() => {
    if (!birthday) return ''
    try {
      const date = new Date(birthday)
      if (!Number.isFinite(date.getTime())) return ''
      return date.toISOString().slice(0, 10)
    } catch {
      return ''
    }
  }, [birthday])

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
      const response = await onUpdateBirthday?.(trimmed)
      if (response?.success) {
        onUpdated?.()
        if (!onUpdated) onClose?.()
        return
      }
      setError(response?.message || 'Không cập nhật được ngày sinh.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onClose?.()}
      title='Nhập ngày sinh'
      description='Nhập ngày sinh để nhận ưu đãi đặc biệt.'
      maxWidthClassName='max-w-md'
      footer={(
        <>
          <button
            type='button'
            className='rounded-full border border-[#E5E5E5] bg-transparent px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 dark:border-[#3A2E26] dark:text-gray-200 dark:hover:bg-white/5'
            onClick={() => onClose?.()}
            disabled={submitting}
          >
            Bỏ qua
          </button>
          <button
            type='button'
            className='rounded-full bg-[#C67C4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b06b3e] disabled:opacity-60'
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Đang lưu...' : 'Cập nhật'}
          </button>
        </>
      )}
    >
      <div>
        <label className='block text-sm font-medium text-stone-700 dark:text-gray-200'>Ngày sinh</label>
        <input
          type='date'
          className='mt-2 w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:opacity-60 dark:border-[#3A2E26] dark:bg-gray-800 dark:text-gray-200'
          value={inputValue}
          onChange={(event) => setBirthdayValue(event.target.value)}
          max={getLocalYmd(new Date())}
          disabled={submitting}
        />
        {error ? <p className='mt-2 text-sm text-red-500'>{error}</p> : null}
      </div>
    </Modal>
  )
}

export default BirthdayModal
