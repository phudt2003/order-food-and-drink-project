import React, { useContext, useEffect, useMemo, useState } from 'react'
import { StoreContext } from '../../context/StoreContext'
import { formatVND } from '../../utils/currency'
import CheckinCalendarModal from '../../components/Loyalty/CheckinCalendarModal'

const ProgressBar = ({ value = 0 }) => (
  <div className='h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10'>
    <div
      className='h-full rounded-full bg-[var(--accent)] transition-all'
      style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
    />
  </div>
)

const getRankBadgeClass = (color) => {
  switch (String(color || '').toLowerCase()) {
    case 'amber':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    case 'cyan':
      return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
    case 'slate':
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
    default:
      return 'bg-gray-500/15 text-gray-700 dark:text-gray-300'
  }
}

const getRankIcon = (key) => {
  const k = String(key || "").toLowerCase()
  if (k === "diamond") return "💎"
  if (k === "gold") return "🥇"
  if (k === "silver") return "🥈"
  if (k === "member") return "🔰"
  return "🏅"
}

const Loyalty = () => {
  const {
    fetchLoyaltySummary,
    fetchCheckinCalendar,
    loyaltyCheckin,
    loyaltyClaimMission,
    loyaltyRedeem,
    loyaltyApplyReferral,
  } = useContext(StoreContext)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [toast, setToast] = useState('')
  const [referralInput, setReferralInput] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarData, setCalendarData] = useState(null)
  const [checkinFx, setCheckinFx] = useState({ day: 0, amount: 0 })

  const userSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('clerk_user_session') || 'null')
    } catch {
      return null
    }
  }, [])

  const refresh = async () => {
    setLoading(true)
    const res = await fetchLoyaltySummary()
    if (res?.success) setData(res.data)
    setLoading(false)
  }

  const loadCalendar = async () => {
    setCalendarLoading(true)
    const res = await fetchCheckinCalendar()
    if (res?.success) setCalendarData(res.data)
    else setToast(res?.message || 'Không tải được lịch điểm danh')
    setCalendarLoading(false)
    return res
  }

  const openCalendar = async () => {
    setCalendarOpen(true)
    await loadCalendar()
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const userId = data?.user?._id
    const rankKey = data?.rank?.current?.key
    if (!userId || !rankKey) return

    const seenKey = `loyalty_rank_seen_${userId}`
    const prev = localStorage.getItem(seenKey)
    if (prev && prev !== rankKey) {
      setToast(`Bạn đã lên hạng ${data?.rank?.current?.label} 🎉`)
    }
    localStorage.setItem(seenKey, rankKey)
  }, [data?.rank?.current?.key, data?.rank?.current?.label, data?.user?._id])

  const onCheckin = async () => {
    setBusyKey('checkin')
    const res = await loyaltyCheckin()
    if (res?.success) {
      if (res?.rewardCoins > 0) setToast(`Chúc mừng bạn nhận được +${res.rewardCoins} Xu`)
      await refresh()
    } else {
      setToast(res?.message || 'Không thể check-in')
    }
    setBusyKey('')
  }

  const onCheckinFromCalendar = async () => {
    setBusyKey('checkin')
    const res = await loyaltyCheckin()
    if (res?.success) {
      const today = Number(calendarData?.today || 0)
      const amount = Math.max(0, Number(res?.rewardCoins || data?.checkin?.todayReward || 0))
      if (today > 0 && amount > 0) {
        setCheckinFx({ day: today, amount })
        setTimeout(() => setCheckinFx({ day: 0, amount: 0 }), 1200)
      }
      if (amount > 0) setToast(`Chúc mừng bạn nhận được +${amount} Xu`)
      await Promise.all([refresh(), loadCalendar()])
      setTimeout(() => setCalendarOpen(false), 900)
    } else {
      setToast(res?.message || 'Không thể check-in')
    }
    setBusyKey('')
  }

  const onClaimMission = async (key) => {
    setBusyKey(`mission:${key}`)
    const res = await loyaltyClaimMission(key)
    if (res?.success && res?.rewardCoins > 0) {
      setToast(`Chúc mừng bạn nhận được +${res.rewardCoins} Xu`)
      await refresh()
    } else if (!res?.success) {
      setToast(res?.message || 'Không thể nhận thưởng')
    } else {
      await refresh()
    }
    setBusyKey('')
  }

  const onRedeem = async (id) => {
    setBusyKey(`redeem:${id}`)
    const res = await loyaltyRedeem(id)
    if (res?.success) {
      setToast(`Đổi voucher thành công: ${String(res?.voucher?.voucherCode || '').toUpperCase()}`)
      await refresh()
    } else {
      setToast(res?.message || 'Không thể đổi xu')
    }
    setBusyKey('')
  }

  const onApplyReferral = async () => {
    const code = referralInput.trim()
    if (!code) {
      setToast('Vui lòng nhập mã giới thiệu')
      return
    }

    setBusyKey('referral')
    const res = await loyaltyApplyReferral(code)
    if (res?.success) {
      setToast('Áp dụng mã thành công. Xu đã được cộng cho chủ sở hữu mã giới thiệu.')
      setReferralInput('')
      await refresh()
    } else {
      setToast(res?.message || 'Không thể áp dụng mã giới thiệu')
    }
    setBusyKey('')
  }

  const rankLabel = data?.rank?.current?.label || 'Member'
  const rankColor = data?.rank?.current?.color || 'gray'
  const rankKey = data?.rank?.current?.key || 'member'
  const totalSpend = Number(data?.rank?.totalSpend || 0)
  const coinBalance = Number(data?.user?.coinBalance || 0)
  const progress = Number(data?.rank?.progress || 0)
  const segment = data?.rank?.segment
  const nextRank = data?.rank?.next

  if (loading) {
    return (
      <section className='mx-auto w-full max-w-6xl px-4 py-8'>
        <p className='text-sm opacity-80'>Đang tải điểm thưởng...</p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className='mx-auto w-full max-w-6xl px-4 py-8'>
        <p className='text-sm text-red-500'>Không tải được dữ liệu điểm thưởng.</p>
      </section>
    )
  }

  return (
    <section className='mx-auto w-full max-w-6xl px-4 py-8'>
      <div className='flex flex-col gap-4 md:flex-row'>
        <div className='flex-1 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
          <div className='flex items-center gap-4'>
            <div className='h-14 w-14 overflow-hidden rounded-full border border-[var(--border-color)] bg-black/5 dark:bg-white/5'>
              {userSession?.imageUrl ? (
                <img src={userSession.imageUrl} alt='avatar' className='h-full w-full object-cover' />
              ) : (
                <div className='flex h-full w-full items-center justify-center text-lg font-semibold'>
                  {(data?.user?.name || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className='min-w-0'>
              <p className='truncate text-lg font-semibold'>{data?.user?.name}</p>
              <div className='mt-1 flex flex-wrap items-center gap-2'>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRankBadgeClass(rankColor)}`}>
                  {getRankIcon(rankKey)} {rankLabel}
                </span>
                <span className='text-xs opacity-70'>Tổng chi tiêu: {formatVND(totalSpend)}</span>
              </div>
            </div>
          </div>

          <div className='mt-4'>
            <div className='flex items-center justify-between gap-3 text-sm'>
              <p className='font-semibold'>Tiến độ lên hạng</p>
              {nextRank ? (
                <p className='opacity-80'>
                  {rankLabel} → {nextRank.label}
                </p>
              ) : (
                <p className='opacity-80'>Bạn đang ở hạng cao nhất</p>
              )}
            </div>
            <div className='mt-2'>
              <ProgressBar value={progress} />
              {nextRank && segment ? (
                <p className='mt-2 text-xs opacity-70'>
                  {formatVND(totalSpend)} / {formatVND(Number(segment.nextMin || 0))}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className='w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 md:w-[360px]'>
          <p className='text-sm font-semibold'>💰 Ví Xu</p>
          <p className='mt-2 text-3xl font-bold'>{coinBalance.toLocaleString('vi-VN')} Xu</p>
          <p className='mt-1 text-xs opacity-70'>Xu dùng để đổi voucher và nhận ưu đãi.</p>
        </div>
      </div>

      <div className='mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
          <p className='text-sm font-semibold'>Quyền lợi của bạn</p>
          <p className='mt-1 text-xs opacity-70'>{rankLabel}</p>
          <ul className='mt-4 space-y-2 text-sm'>
            {(data?.benefits?.current?.benefits || []).map((text) => (
              <li key={text} className='flex gap-2'>
                <span className='mt-[2px]'>✔</span>
                <span className='opacity-90'>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
          <div className='flex items-center justify-between gap-3'>
            <p className='text-sm font-semibold'>Check-in hằng ngày</p>
            <button
              type='button'
              onClick={openCalendar}
              className='rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5'
            >
              Xem lịch tháng
            </button>
          </div>
          <p className='mt-1 text-xs opacity-70'>Nhận thưởng dựa trên hạng thành viên.</p>

          <div className='mt-4 flex flex-wrap gap-2'>
            {(data?.checkin?.last7Days || []).map((day) => (
              <div
                key={day.ymd}
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold',
                  day.checked
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border-color)] bg-[var(--bg-body)]',
                ].join(' ')}
              >
                {String(day.ymd).slice(-2)}
              </div>
            ))}
          </div>

          <button
            type='button'
            disabled={!data?.checkin?.canCheckIn || busyKey === 'checkin'}
            onClick={onCheckin}
            className={[
              'mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white',
              !data?.checkin?.canCheckIn || busyKey === 'checkin'
                ? 'bg-black/30'
                : 'bg-[var(--accent)] hover:opacity-95',
            ].join(' ')}
          >
            {data?.checkin?.canCheckIn
              ? `Nhận thưởng hôm nay (+${Number(data?.checkin?.todayReward || 0)} Xu)`
              : 'Bạn đã check-in hôm nay'}
          </button>
        </div>
      </div>

      <div className='mt-6 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
        <p className='text-sm font-semibold'>Nhiệm vụ</p>
        <div className='mt-4 grid grid-cols-1 gap-3 md:grid-cols-2'>
          {(data?.missions || []).map((mission) => (
            <div key={mission.key} className='rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] p-4'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='font-semibold'>{mission.title}</p>
                  <p className='mt-1 text-xs opacity-70'>{mission.description}</p>
                </div>
                <span className='rounded-full bg-black/10 px-2 py-1 text-xs font-semibold'>
                  +{Number(mission.rewardCoins || 0)} Xu
                </span>
              </div>

              <div className='mt-3 flex items-center justify-between'>
                <p className='text-xs opacity-70'>
                  {mission.claimed ? 'Đã nhận thưởng' : mission.done ? 'Hoàn thành' : 'Chưa hoàn thành'}
                </p>
                <button
                  type='button'
                  disabled={!mission.claimable || busyKey === `mission:${mission.key}`}
                  onClick={() => onClaimMission(mission.key)}
                  className={[
                    'rounded-xl px-3 py-2 text-xs font-semibold',
                    mission.claimable
                      ? 'bg-[var(--accent)] text-white hover:opacity-95'
                      : 'border border-[var(--border-color)] bg-transparent opacity-60',
                  ].join(' ')}
                >
                  Nhận thưởng
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className='mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
          <p className='text-sm font-semibold'>Shop đổi xu</p>
          <p className='mt-1 text-xs opacity-70'>Đổi xu lấy voucher để dùng ở checkout.</p>
          <div className='mt-4 space-y-3'>
            {(data?.redeemShop || []).map((item) => (
              <div key={item.id} className='flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] p-4'>
                <div>
                  <p className='font-semibold'>
                    {Number(item.coinCost || 0).toLocaleString('vi-VN')} Xu → Voucher {Number(item?.voucher?.discountValue || 0).toLocaleString('vi-VN')}đ
                  </p>
                  <p className='mt-1 text-xs opacity-70'>
                    Đơn tối thiểu: {formatVND(Number(item?.voucher?.minOrderValue || 0))} • HSD: {Number(item?.voucher?.expireDays || 7)} ngày
                  </p>
                </div>
                <button
                  type='button'
                  disabled={coinBalance < Number(item.coinCost || 0) || busyKey === `redeem:${item.id}`}
                  onClick={() => onRedeem(item.id)}
                  className={[
                    'rounded-xl px-3 py-2 text-xs font-semibold',
                    coinBalance >= Number(item.coinCost || 0)
                      ? 'bg-[var(--accent)] text-white hover:opacity-95'
                      : 'border border-[var(--border-color)] opacity-60',
                  ].join(' ')}
                >
                  Đổi ngay
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
          <p className='text-sm font-semibold'>Voucher cá nhân hóa</p>
          {data?.personalizedVoucher ? (
            <div className='mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] p-4'>
              <p className='text-xs font-semibold tracking-wide text-[var(--accent)]'>
                {String(data.personalizedVoucher.voucherCode || '').toUpperCase()}
              </p>
              <p className='mt-1 font-semibold'>{data.personalizedVoucher.voucherName}</p>
              <p className='mt-1 text-xs opacity-70'>Hạn dùng đến: {new Date(data.personalizedVoucher.endDate).toLocaleDateString('vi-VN')}</p>
            </div>
          ) : (
            <p className='mt-2 text-sm opacity-80'>Chưa có voucher cá nhân hóa. Hãy đặt hàng thêm để nhận ưu đãi phù hợp.</p>
          )}

          <div className='mt-6'>
            <p className='text-sm font-semibold'>Mã giới thiệu</p>
            <p className='mt-1 text-xs opacity-70'>Mời bạn bè để nhận xu. Khi bạn bè nhập mã của bạn, tài khoản sở hữu mã sẽ được cộng +50 xu.</p>

            <div className='mt-3 flex items-center gap-2'>
              <div className='flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)] px-3 py-2 text-sm font-semibold'>
                {data?.user?.referralCode || '--'}
              </div>
              <button
                type='button'
                className='rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5'
                onClick={() => {
                  if (!data?.user?.referralCode) return
                  navigator.clipboard?.writeText(String(data.user.referralCode))
                  setToast('Đã copy mã giới thiệu')
                }}
              >
                Copy
              </button>
            </div>

            {!data?.user?.hasReferred ? (
              <div className='mt-4'>
                <p className='text-xs opacity-70'>Nhập mã của bạn bè (chỉ 1 lần):</p>
                <div className='mt-2 flex items-center gap-2'>
                  <input
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value)}
                    placeholder='VD: CBABC123'
                    className='h-10 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)] px-3 text-sm outline-none'
                  />
                  <button
                    type='button'
                    disabled={busyKey === 'referral'}
                    onClick={onApplyReferral}
                    className='h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60'
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            ) : (
              <p className='mt-3 text-xs opacity-70'>Bạn đã áp dụng mã giới thiệu rồi.</p>
            )}
          </div>
        </div>
      </div>

      <div className='mt-6 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
        <p className='text-sm font-semibold'>Bảng so sánh hạng</p>
        <div className='mt-4 overflow-x-auto'>
          <table className='min-w-[760px] w-full border-collapse text-left text-sm'>
            <thead>
              <tr className='text-xs uppercase opacity-70'>
                <th className='py-2 pr-4'>Hạng</th>
                <th className='py-2 pr-4'>Check-in</th>
                <th className='py-2 pr-4'>Voucher tháng</th>
                <th className='py-2 pr-4'>Tích xu</th>
                <th className='py-2 pr-4'>Chi tiêu tối thiểu</th>
              </tr>
            </thead>
            <tbody>
              {(data?.benefits?.compare || []).map((rank) => {
                const isCurrent = String(rank.key) === String(data?.rank?.current?.key)
                return (
                  <tr key={rank.key} className={isCurrent ? 'bg-[var(--accent)]/10' : ''}>
                    <td className='py-3 pr-4 font-semibold'>{rank.label}</td>
                    <td className='py-3 pr-4'>+{Number(rank.checkinCoins || 0)} xu</td>
                    <td className='py-3 pr-4'>
                      {rank.monthlyVoucher
                        ? `${Number(rank.monthlyVoucher.discountValue || 0).toLocaleString('vi-VN')}đ`
                        : '--'}
                    </td>
                    <td className='py-3 pr-4'>x{Number(rank.coinMultiplier || 1)}</td>
                    <td className='py-3 pr-4'>{formatVND(Number(rank.minSpend || 0))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className='mt-6 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5'>
        <p className='text-sm font-semibold'>Lịch sử Xu</p>
        <div className='mt-4 space-y-2'>
          {(data?.transactions || []).length === 0 ? (
            <p className='text-sm opacity-80'>Chưa có giao dịch xu.</p>
          ) : (
            (data?.transactions || []).map((tx) => {
              const amount = Number(tx?.amount || 0)
              const label =
                tx?.reason === 'checkin'
                  ? 'Check-in'
                  : tx?.reason === 'order'
                    ? 'Tích xu từ đơn hàng'
                    : tx?.reason === 'mission'
                      ? 'Nhiệm vụ'
                      : tx?.reason === 'redeem'
                        ? 'Đổi xu lấy voucher'
                        : tx?.reason === 'referral'
                          ? 'Giới thiệu bạn bè'
                          : 'Giao dịch'

              return (
                <div
                  key={String(tx?._id || `${tx?.reason}-${tx?.createdAt || ''}`)}
                  className='flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)] px-4 py-3 text-sm'
                >
                  <div className='min-w-0'>
                    <p className='truncate font-semibold'>{label}</p>
                    <p className='mt-1 text-xs opacity-70'>
                      {tx?.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : ''}
                    </p>
                  </div>
                  <div className={amount >= 0 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-rose-600 dark:text-rose-400'}>
                    {amount >= 0 ? `+${amount}` : `${amount}`} Xu
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <CheckinCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        data={calendarData}
        loading={calendarLoading}
        onCheckinToday={onCheckinFromCalendar}
        todayReward={Number(data?.checkin?.todayReward || 0)}
        busy={busyKey === 'checkin'}
        fxDay={Number(checkinFx.day || 0)}
        fxAmount={Number(checkinFx.amount || 0)}
      />

      {toast ? (
        <div className='fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-black px-4 py-3 text-center text-sm text-white shadow-lg'>
          {toast}
        </div>
      ) : null}
    </section>
  )
}

export default Loyalty
