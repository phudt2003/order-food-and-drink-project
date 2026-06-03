import React, { useContext, useEffect, useMemo, useState } from 'react'
import { StoreContext } from '../../context/StoreContext'
import VoucherCard from '../../components/common/VoucherCard'
import { classifyVoucher, isFlashSaleVoucher } from '../../utils/voucher'

const MyVouchers = () => {
  const { token, userProfile, myVouchers, voucherActiveCount, refreshMyVouchers } = useContext(StoreContext)
  const [activeTab, setActiveTab] = useState('available')
  const [loading, setLoading] = useState(false)

  // Comment: Refresh voucher khi vào trang (đồng bộ với Home)
  useEffect(() => {
    let alive = true
    if (!token) return () => { alive = false }

    setLoading(true)
    Promise.resolve(refreshMyVouchers())
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => { alive = false }
  }, [token, refreshMyVouchers])

  const currentUserId = String(userProfile?._id || '')

  const viewModels = useMemo(() => {
    const list = Array.isArray(myVouchers) ? myVouchers : []
    return list.map((voucher) => {
      const { bucket, state } = classifyVoucher(voucher, currentUserId)
      return { voucher, bucket, state }
    })
  }, [myVouchers, currentUserId])

  const tabCounts = useMemo(() => {
    const base = { available: 0, used: 0, expired: 0, all: viewModels.length }
    viewModels.forEach((item) => {
      if (item.bucket === 'expired') base.expired += 1
      else if (item.bucket === 'used' || item.bucket === 'inactive') base.used += 1
      else base.available += 1 // available + upcoming
    })
    return base
  }, [viewModels])

  const filtered = useMemo(() => {
    if (activeTab === 'all') return viewModels
    if (activeTab === 'expired') return viewModels.filter((v) => v.bucket === 'expired')
    if (activeTab === 'used') return viewModels.filter((v) => v.bucket === 'used' || v.bucket === 'inactive')
    return viewModels.filter((v) => v.bucket === 'available' || v.bucket === 'upcoming')
  }, [viewModels, activeTab])

  return (
    <section className='mx-auto w-full max-w-6xl px-4 py-8'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Voucher của tôi</h1>
          <p className='mt-1 text-sm opacity-80'>
            {token ? `Bạn đang có ${voucherActiveCount} voucher có thể dùng ngay.` : 'Đăng nhập để xem voucher của bạn.'}
          </p>
        </div>
      </div>

      <div className='mt-6'>
        <div className='flex flex-wrap items-center gap-2'>
          {[
            { key: 'available', label: `Còn hiệu lực (${tabCounts.available})` },
            { key: 'used', label: `Đã dùng (${tabCounts.used})` },
            { key: 'expired', label: `Hết hạn (${tabCounts.expired})` },
            { key: 'all', label: `Tất cả (${tabCounts.all})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type='button'
              onClick={() => setActiveTab(tab.key)}
              className={[
                'rounded-full border px-3 py-1 text-sm',
                activeTab === tab.key
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!token ? (
          <div className='mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
            <p className='text-sm opacity-80'>Bạn cần đăng nhập để xem voucher của mình.</p>
          </div>
        ) : null}

        {token && loading ? (
          <p className='mt-4 text-sm opacity-80'>Đang tải voucher...</p>
        ) : null}

        {token && !loading && viewModels.length === 0 ? (
          <div className='mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
            <p className='text-sm opacity-80'>Chưa có voucher nào trong tài khoản.</p>
          </div>
        ) : null}

        {token && !loading && viewModels.length > 0 && filtered.length === 0 ? (
          <div className='mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
            <p className='text-sm opacity-80'>Không có voucher nào trong tab này.</p>
          </div>
        ) : null}

        <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
          {token
            ? filtered.map((item) => (
                <VoucherCard
                  key={String(item?.voucher?._id || `${item?.voucher?.voucherCode || 'voucher'}-${item?.voucher?.createdAt || ''}`)}
                  voucher={item.voucher}
                  currentUserId={currentUserId}
                  // Comment: Happy hour/Flash sale -> hiện countdown khi voucher đang dùng được.
                  showCountdown={isFlashSaleVoucher(item.voucher) && item.bucket === 'available'}
                />
              ))
            : null}
        </div>
      </div>
    </section>
  )
}

export default MyVouchers
