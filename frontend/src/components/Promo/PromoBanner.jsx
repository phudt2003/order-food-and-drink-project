import React from 'react'

const PromoBanner = ({ badge, title, description, actionLabel, onAction }) => (
  <section className='mx-auto w-full max-w-6xl px-4 pt-4'>
    <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-sm'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          {badge ? <p className='text-sm font-semibold tracking-wide text-[var(--accent)]'>{badge}</p> : null}
          <h3 className='mt-1 text-lg font-semibold'>{title}</h3>
          {description ? <p className='mt-1 text-sm opacity-80'>{description}</p> : null}
        </div>

        {actionLabel ? (
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onAction}
              className='rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95'
            >
              {actionLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  </section>
)

export default PromoBanner

