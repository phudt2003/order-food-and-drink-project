import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { StoreContext } from '../../context/StoreContext'
import { useUser } from '@clerk/react'
import DailyCheckinModal from './DailyCheckinModal'
import { DEFAULT_TIMEZONE, isCheckedInToday } from '../../utils/date'

const DEFAULT_ALLOWED_PATHS = undefined
const CHECKIN_OPEN_DELAY_MS = 600

const CheckinPopupGate = ({ allowedPaths = DEFAULT_ALLOWED_PATHS, enabled = true }) => {
  const location = useLocation()
  const { token, userProfile, dailyCheckin, fetchCheckinStatus } = useContext(StoreContext)
  const { isLoaded, isSignedIn } = useUser()

  const isAllowed = useMemo(
    () => {
      if (!Array.isArray(allowedPaths) || allowedPaths.length === 0) return true
      return allowedPaths.some((p) => String(location.pathname || '') === String(p))
    },
    [allowedPaths, location.pathname]
  )

  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rewardCoins, setRewardCoins] = useState(10)
  const reqRef = useRef(0)

  const timeZone = String(import.meta?.env?.VITE_LOYALTY_TZ || DEFAULT_TIMEZONE)
  const debug = (...args) => {
    if (import.meta?.env?.DEV) console.log(...args)
  }

  const ready = Boolean(isLoaded && isSignedIn && token && enabled && isAllowed && userProfile?.birthday)

  useEffect(() => {
    return () => {
      reqRef.current += 1
    }
  }, [])

  useEffect(() => {
    debug('[CheckinPopupGate] effect', {
      path: String(location.pathname || ''),
      ready,
      enabled,
      isAllowed,
      dismissed,
      birthday: userProfile?.birthday || null,
      lastCheckInDate: userProfile?.lastCheckInDate || null,
      profileCheckedToday: isCheckedInToday(userProfile?.lastCheckInDate, timeZone),
      timeZone,
    })

    if (!ready) {
      reqRef.current += 1
      setOpen(false)
      setBusy(false)
      setError('')
      return
    }

    if (dismissed) return

    const reqId = (reqRef.current += 1)
    const t = setTimeout(async () => {
      const fallbackShouldOpen = !isCheckedInToday(userProfile?.lastCheckInDate, timeZone)
      if (!fetchCheckinStatus) {
        debug('[CheckinPopupGate] no fetchCheckinStatus(), fallback open =', fallbackShouldOpen)
        setOpen(fallbackShouldOpen)
        return
      }

      const res = await fetchCheckinStatus()
      if (reqId !== reqRef.current) return

      debug('[CheckinPopupGate] fetchCheckinStatus ->', res)

      if (!res?.success) {
        debug('[CheckinPopupGate] status failed, fallback open =', fallbackShouldOpen)
        setOpen(fallbackShouldOpen)
        return
      }

      const checkedToday = Boolean(res?.data?.checkedToday)
      const reward = Math.max(0, Number(res?.data?.rewardCoins || 0))
      if (reward > 0) setRewardCoins(reward)

      debug('[CheckinPopupGate] decide', { checkedToday, open: !checkedToday, reward })
      setOpen(!checkedToday)
    }, CHECKIN_OPEN_DELAY_MS)

    return () => clearTimeout(t)
  }, [dismissed, enabled, fetchCheckinStatus, isAllowed, location.pathname, ready, timeZone, userProfile?.birthday, userProfile?.lastCheckInDate])

  const close = () => {
    setOpen(false)
    setDismissed(true)
    setError('')
  }

  const onCheckin = async () => {
    setError('')
    setBusy(true)
    try {
      debug('[CheckinPopupGate] checkin click')
      const res = await dailyCheckin?.()
      debug('[CheckinPopupGate] dailyCheckin ->', res)
      if (res?.success) {
        setRewardCoins(Math.max(0, Number(res?.rewardCoins || rewardCoins || 0)))
        setOpen(false)
        setDismissed(true)
        return
      }
      const message = String(res?.message || 'Không thể check-in')
      setError(message)
      if (message.toLowerCase().includes('already')) {
        setOpen(false)
        setDismissed(true)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null

  return (
    <DailyCheckinModal
      open={open}
      onClose={close}
      onCheckin={onCheckin}
      rewardCoins={rewardCoins}
      busy={busy}
      error={error}
    />
  )
}

export default CheckinPopupGate
