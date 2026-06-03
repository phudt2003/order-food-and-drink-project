import React, { useEffect, useMemo, useState } from 'react'
import Confetti from 'react-confetti'

const useWindowSize = () => {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return size
}

const buildLocalYmd = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

const isBirthdayToday = (birthday) => {
  if (!birthday) return false
  const today = new Date()
  const b = new Date(birthday)
  if (!Number.isFinite(b.getTime())) return false

  return today.getDate() === b.getDate() && today.getMonth() === b.getMonth()
}

const BirthdayConfetti = ({ user, durationMs = 5000, storageKeyPrefix = 'birthday_confetti_seen' }) => {
  const { width, height } = useWindowSize()
  const [active, setActive] = useState(false)

  const storageKey = useMemo(() => {
    const userId = String(user?._id || user?.id || '')
    if (!userId) return ''
    const ymd = buildLocalYmd(new Date())
    return `${storageKeyPrefix}_${userId}_${ymd}`
  }, [user?._id, user?.id, storageKeyPrefix])

  useEffect(() => {
    if (!user?.birthday) return
    if (!storageKey) return
    if (!isBirthdayToday(user.birthday)) return

    if (localStorage.getItem(storageKey)) return
    localStorage.setItem(storageKey, '1')
    setActive(true)

    const timer = setTimeout(() => {
      setActive(false)
    }, Math.max(500, Number(durationMs || 0)))

    return () => clearTimeout(timer)
  }, [user?.birthday, storageKey, durationMs])

  if (!active) return null

  return (
    <div className='pointer-events-none fixed inset-0 z-40'>
      <Confetti
        width={width}
        height={height}
        numberOfPieces={250}
        gravity={0.25}
        recycle={false}
      />
    </div>
  )
}

export default BirthdayConfetti
