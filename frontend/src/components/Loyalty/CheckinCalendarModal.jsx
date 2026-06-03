import React, { useEffect, useMemo } from 'react'
import { Calendar, Check, X } from 'lucide-react'

/**
 * Modal lịch điểm danh (check-in calendar)
 *
 * YÊU CẦU RESPONSIVE:
 * - Desktop/Web (>= md): giữ kiểu “gốc” (ô tròn nhỏ +5 xu nhỏ bên dưới, TODAY badge nhỏ, check nhỏ, khoảng cách hẹp)
 * - Mobile/App (< md): ô vuông dễ tap (aspect-square), nền màu rõ ràng, gap lớn hơn, hiệu ứng tap/hover
 *
 * Ghi chú: để “chỉ sửa mobile”, component dùng `max-md:` cho tất cả style mobile.
 */

const buildDays = (count) => Array.from({ length: Math.max(0, Number(count || 0)) }, (_, i) => i + 1)

// Demo theo yêu cầu: Tháng 3/2026, 18/19/23 đã check, 24 là today.
// Chỉ dùng khi DEV và không có `data` truyền vào.
const FALLBACK_DATA = {
  year: 2026,
  month: 3,
  today: 24,
  daysInMonth: 31,
  checkedDays: [18, 19, 23],
  checkedInToday: false,
  rewardCoinsPerDay: 5,
}

const CheckinCalendarModal = ({
  open,
  onClose,
  data,
  loading,
  onCheckinToday,
  todayReward = 0,
  busy = false,
  fxDay = 0,
  fxAmount = 0,
}) => {
  const effectiveData = data || (import.meta.env?.DEV ? FALLBACK_DATA : null)

  const checkedSet = useMemo(
    () => new Set((effectiveData?.checkedDays || []).map((d) => Number(d))),
    [effectiveData?.checkedDays],
  )
  const days = useMemo(() => buildDays(effectiveData?.daysInMonth || 0), [effectiveData?.daysInMonth])

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

  const year = Number(effectiveData?.year || 0)
  const month = Number(effectiveData?.month || 0)
  const today = Number(effectiveData?.today || 0)

  const canCheckIn = Boolean(effectiveData && !effectiveData?.checkedInToday)
  const rewardPerDay = Math.max(0, Number(effectiveData?.rewardCoinsPerDay ?? todayReward ?? 0))

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[900] bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[1000] w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4 sm:px-0 max-md:px-3 max-md:max-w-[24rem]">
        <div className="rounded-3xl border border-gray-200 bg-white/90 dark:border-gray-700 dark:bg-gray-900/90 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-md:rounded-2xl max-md:max-h-[82vh] max-md:overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700 max-md:sticky max-md:top-0 max-md:z-10 max-md:bg-white/95 dark:max-md:bg-gray-900/95 max-md:p-3 max-md:pb-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-7 w-7 text-green-600 max-md:h-6 max-md:w-6" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight max-md:text-lg">
                  Lịch điểm danh
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 max-md:text-xs">
                  Tháng {month}/{year}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 active:scale-95 flex items-center justify-center group max-md:p-1.5"
              aria-label="Đóng"
            >
              <X className="h-5 w-5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200" />
            </button>
          </div>

          {/* Subtitle */}
          <div className="px-6 pb-6 max-md:px-4 max-md:pb-4">
            <p className="text-lg text-gray-700 dark:text-gray-300 font-medium max-md:text-sm">
              Nhấn ngày hôm nay để nhận {rewardPerDay.toLocaleString()} xu
            </p>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="px-6 pb-8 text-center max-md:px-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Đang tải lịch...</p>
            </div>
          ) : !effectiveData ? (
            <div className="px-6 pb-8 text-center max-md:px-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Không có dữ liệu lịch.</p>
            </div>
          ) : (
            <>
              {/* Calendar Header */}
              <div className="px-6 pb-4 grid grid-cols-7 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide max-md:px-4 max-md:pb-2 max-md:text-xs max-md:text-center">
                <div>CN</div>
                <div>T2</div>
                <div>T3</div>
                <div>T4</div>
                <div>T5</div>
                <div>T6</div>
                <div>T7</div>
              </div>

              {/* Calendar Grid */}
              <div className="px-6 pb-8 grid grid-cols-7 gap-1.5 justify-items-center max-md:px-4 max-md:gap-2.5 max-md:justify-items-stretch max-md:pb-5">
                {days.map((day) => {
                  const checked = checkedSet.has(day)
                  const isToday = day === today
                  const isFuture = day > today
                  const clickable = isToday && canCheckIn && !busy

                  /**
                   * Desktop/Web (>= md): GIỮ KIỂU “GỐC”
                   * - Ô tròn nhỏ (h-10 w-10) +5 xu nhỏ bên dưới
                   * - TODAY là badge vàng nhỏ (overlay)
                   * - Check xanh nhỏ
                   * - Không nền màu full ô, không aspect-square, không scale lớn
                   *
                   * Mobile/App (< md): CHỈ OVERRIDE BẰNG `max-md:`
                   * - Ô vuông `aspect-square`, rounded-2xl, nền màu rõ ràng
                   * - Gap lớn hơn, chữ to hơn, icon to hơn, hiệu ứng tap/hover
                   */
                  let dayClass = 'group relative flex flex-col items-center justify-center w-10 h-14 select-none cursor-default'

                  // Mobile layout
                  dayClass += ' max-md:w-full max-md:h-auto max-md:aspect-square max-md:rounded-2xl max-md:border max-md:p-1.5'
                  dayClass += ' max-md:transition-all max-md:duration-200 max-md:enabled:hover:shadow-md max-md:enabled:active:scale-105'
                  dayClass += ' disabled:max-md:opacity-70 disabled:max-md:shadow-none disabled:max-md:cursor-not-allowed'

                  // Desktop text tone (unprefixed) + Mobile state colors (max-md:)
                  if (checked) {
                    dayClass += ' text-green-600'
                    dayClass += ' max-md:bg-green-600 max-md:border-green-500 max-md:text-white'
                  } else if (isToday) {
                    dayClass += ' text-yellow-700'
                    dayClass += ' max-md:bg-yellow-400 max-md:border-yellow-300 max-md:text-black max-md:border-2'
                  } else if (isFuture) {
                    dayClass += ' text-gray-400'
                    dayClass += ' max-md:bg-gray-100 max-md:border-gray-200 max-md:text-gray-500 max-md:opacity-70 max-md:dark:bg-gray-800 max-md:dark:border-gray-700 max-md:dark:text-gray-300 max-md:dark:opacity-80'
                  } else {
                    // Ngày đã qua (chưa check): desktop mờ, mobile nền nhẹ
                    dayClass += ' text-gray-500 dark:text-gray-300'
                    dayClass += ' max-md:bg-white max-md:border-gray-200 max-md:text-gray-700 max-md:dark:bg-gray-800 max-md:dark:border-gray-700 max-md:dark:text-gray-200'
                  }

                  if (clickable) dayClass += ' cursor-pointer'

                  const circleBorderClass = checked
                    ? 'border-green-500/40'
                    : isToday
                      ? 'border-yellow-400'
                      : 'border-gray-200'

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && onCheckinToday?.()}
                      className={dayClass}
                      title={
                        checked
                          ? 'Đã điểm danh'
                          : isToday
                            ? canCheckIn
                              ? `Nhận thưởng hôm nay (+${rewardPerDay.toLocaleString()} xu)`
                              : 'Bạn đã điểm danh hôm nay'
                            : isFuture
                              ? 'Ngày tương lai'
                              : 'Ngày đã qua'
                      }
                    >
                      {/* Số ngày (desktop: nằm trong ô tròn nhỏ; mobile: chữ to ở giữa ô vuông) */}
                      <span
                        className={[
                          'flex items-center justify-center font-semibold leading-none',
                          // Desktop: ô tròn nhỏ (giữ kiểu gốc)
                          'h-10 w-10 rounded-full border bg-transparent text-sm',
                          circleBorderClass,
                          // Mobile override: bỏ ô tròn, phóng chữ
                          'max-md:h-auto max-md:w-auto max-md:border-0 max-md:rounded-none max-md:text-lg max-md:font-bold',
                        ].join(' ')}
                      >
                        {day}
                      </span>

                      {/* +xu (desktop: nhỏ; mobile: text-sm dễ đọc) */}
                      <span
                        className={[
                          'mt-0.5 text-[10px] font-medium leading-none',
                          // Desktop màu chữ
                          checked ? 'text-green-600' : '',
                          isToday ? 'text-yellow-700' : '',
                          isFuture ? 'text-gray-400' : '',
                          !checked && !isToday && !isFuture ? 'text-gray-500 dark:text-gray-300' : '',
                          // Mobile override màu chữ + size
                          'max-md:mt-0.5 max-md:text-sm max-md:whitespace-nowrap',
                          checked ? 'max-md:text-white/90' : '',
                          isToday ? 'max-md:text-yellow-900' : '',
                          isFuture ? 'max-md:text-gray-500 max-md:dark:text-gray-300' : '',
                          !checked && !isToday && !isFuture ? 'max-md:text-green-600' : '',
                        ].join(' ')}
                      >
                        +{rewardPerDay.toLocaleString()} xu
                      </span>

                      {/* Check icon (desktop nhỏ, mobile to hơn) */}
                      {checked && (
                        <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-green-600 max-md:right-1.5 max-md:top-1.5 max-md:h-6 max-md:w-6 max-md:text-white" />
                      )}

                      {/* TODAY badge (desktop overlay nhỏ; mobile badge trong ô) */}
                      {isToday && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-yellow-300 px-1.5 py-0.5 text-[9px] font-bold text-black shadow-sm max-md:top-1.5 max-md:left-1.5 max-md:-translate-x-0 max-md:text-[10px]">
                          TODAY
                        </span>
                      )}

                      {/* Hiệu ứng +xu khi vừa check-in (giữ nhẹ, không ảnh hưởng desktop) */}
                      {fxDay === day && fxAmount > 0 && (
                        <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 animate-bounce max-md:-top-2">
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-sm max-md:text-xs">
                            +{fxAmount} xu
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="px-6 pb-6 pt-2 max-md:px-4 max-md:pb-4">
                <div className="flex flex-wrap gap-6 text-xs max-md:gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-600 shadow-sm" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">Đã điểm danh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-400 shadow-sm" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">Hôm nay</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-gray-300" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">Tương lai</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default CheckinCalendarModal
