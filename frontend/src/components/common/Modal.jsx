import React, { useEffect } from 'react'

const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClassName = 'max-w-md',
  closeable = true,
}) => {
  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div
        className='fixed inset-0 z-[900] bg-black/40 backdrop-blur-sm'
        onClick={() => (closeable ? onClose?.() : null)}
      />

      <div
        className={[
          'fixed left-1/2 top-1/2 z-[1100] w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg',
          'dark:bg-[#2A211B] dark:text-[#F5F5F5]',
          String(maxWidthClassName || 'max-w-md'),
        ].join(' ')}
        role='dialog'
        aria-modal='true'
        aria-label={title ? String(title) : 'Modal'}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || closeable) && (
          <div className='flex items-start justify-between gap-4'>
            <div>
              {title ? (
                <h2 className='text-lg font-semibold text-stone-800 dark:text-[#F5F5F5]'>{title}</h2>
              ) : null}
              {description ? (
                <p className='mt-1 text-sm text-stone-600 dark:text-gray-300'>{description}</p>
              ) : null}
            </div>

            {closeable ? (
              <button
                type='button'
                className='rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200'
                onClick={() => onClose?.()}
                aria-label='Close'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <line x1='18' y1='6' x2='6' y2='18' />
                  <line x1='6' y1='6' x2='18' y2='18' />
                </svg>
              </button>
            ) : null}
          </div>
        )}

        <div className={title || closeable ? 'mt-4' : ''}>{children}</div>

        {footer ? <div className='mt-6 flex items-center justify-end gap-2'>{footer}</div> : null}
      </div>
    </>
  )
}

export default Modal

