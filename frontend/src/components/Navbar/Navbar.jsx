﻿import React, { useContext, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { StoreContext, UIContext } from '../../context/StoreContext'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import { Crown, Home, Package, TicketPercent } from 'lucide-react'
import { FiShoppingCart } from 'react-icons/fi'
import { UserButton, useUser } from '@clerk/react'

const Navbar = () => {
  const { getTotalCartItems, token, url, voucherActiveCount } = useContext(StoreContext)
  const { setShowLogin } = useContext(UIContext)
  const { isSignedIn, isLoaded, user } = useUser()
  const totalItems = getTotalCartItems()
  const [hasShippingOrder, setHasShippingOrder] = React.useState(false)

  useEffect(() => {
    if (isSignedIn && user) {
      localStorage.setItem(
        'clerk_user_session',
        JSON.stringify({
          id: user.id,
          fullName: user.fullName,
          imageUrl: user.imageUrl,
          primaryEmail: user.primaryEmailAddress?.emailAddress || '',
        })
      )
      return
    }

    localStorage.removeItem('clerk_user_session')
  }, [isSignedIn, user])

  useEffect(() => {
    let alive = true
    const controller = new AbortController()

    const fetchOrderDot = async () => {
      if (!token || !url) {
        if (alive) setHasShippingOrder(false)
        return
      }

      try {
        const res = await fetch(`${url}/api/orders/my`, {
          method: 'GET',
          headers: { token },
          signal: controller.signal,
        })
        const json = await res.json()
        const orders = Array.isArray(json?.data) ? json.data : []
        const hasShipping = orders.some((o) => String(o?.status || '').toLowerCase() === 'delivering')
        if (alive) setHasShippingOrder(Boolean(hasShipping))
      } catch {
        if (alive) setHasShippingOrder(false)
      }
    }

    fetchOrderDot()
    const t = setInterval(fetchOrderDot, 60_000)
    return () => {
      alive = false
      controller.abort()
      clearInterval(t)
    }
  }, [token, url])

  const navLinks = React.useMemo(
    () => [
      { to: '/', label: 'Trang chủ' },
      { to: '/menu', label: 'Thực đơn' },
      { to: '/mobile-app', label: 'Ứng dụng' },
      { to: '/contact', label: 'Liên hệ' },
    ],
    []
  )

  const iconLinks = React.useMemo(
    () => [
      { to: '/myvouchers', label: 'Voucher', icon: TicketPercent, key: 'voucher' },
      { to: '/loyalty', label: 'Điểm thưởng', icon: Crown, key: 'loyalty' },
      { to: '/myorders', label: 'Đơn hàng', icon: Package, key: 'orders' },
      { to: '/cart', label: 'Giỏ hàng', icon: FiShoppingCart, key: 'cart' },
    ],
    []
  )

  const bottomNavLinks = React.useMemo(
    () => [
      { to: '/', label: 'Trang chủ', icon: Home, key: 'home' },
      { to: '/myvouchers', label: 'Voucher', icon: TicketPercent, key: 'voucher' },
      { to: '/loyalty', label: 'Điểm thưởng', icon: Crown, key: 'loyalty' },
      { to: '/myorders', label: 'Đơn hàng', icon: Package, key: 'orders' },
      { to: '/cart', label: 'Giỏ hàng', icon: FiShoppingCart, key: 'cart' },
    ],
    []
  )

  const bottomLinkClass = ({ isActive }) =>
    [
      'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
      isActive ? 'text-[#C67C4E] dark:text-[#E8B089]' : 'text-gray-600 dark:text-gray-300',
    ].join(' ')

  return (
    <>
      <header className='sticky top-0 z-50 w-full bg-[var(--bg-body)] px-4 py-3 shadow-none transition-colors duration-300 md:px-10 md:py-4'>
        <div className='mx-auto w-full max-w-7xl'>
          <div className='flex items-center justify-between md:grid md:grid-cols-[auto_1fr_auto] md:items-start'>
            {/* Left */}
            <div className='flex items-center md:justify-start'>
              <Link to='/' className='inline-flex items-center' aria-label='Coffee Bingo'>
                <img
                  src='/logo.png'
                  alt='Coffee Bingo'
                  className='mr-2 h-7 w-auto md:mr-0 md:h-8 dark:brightness-0 dark:invert'
                />
              </Link>
            </div>

            {/* Center: menu + icons */}
            <div className='hidden flex-col items-center md:flex'>
              <nav className='flex flex-nowrap justify-center gap-12 text-sm font-medium text-[#3A3A3A] dark:text-[#F5F5F5]'>
                {navLinks.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      [
                        'whitespace-nowrap transition-colors hover:text-[#C67C4E] active:text-[#C67C4E] dark:active:text-black',
                        isActive ? 'text-[#C67C4E] dark:text-black' : 'text-[#3A3A3A] dark:text-[#F5F5F5]',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className='mt-2 flex justify-center gap-16 text-xl text-gray-500 dark:text-[#E5E5E5]'>
                {iconLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      className={({ isActive }) =>
                        [
                          'relative inline-flex items-center justify-center rounded-full transition-colors hover:text-[#C67C4E]',
                          isActive ? 'text-[#C67C4E]' : 'text-gray-500 dark:text-[#E5E5E5]',
                        ].join(' ')
                      }
                      aria-label={item.label}
                      title={item.label}
                    >
                      <span className='relative'>
                        <Icon className='h-6 w-6' aria-hidden='true' />
                        {item.key === 'cart' && totalItems > 0 ? (
                          <span className='absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white'>
                            {totalItems}
                          </span>
                        ) : null}
                        {item.key === 'voucher' && voucherActiveCount > 0 ? (
                          <span className='absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white'>
                            {voucherActiveCount}
                          </span>
                        ) : null}
                        {item.key === 'orders' && hasShippingOrder ? (
                          <span className='absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500' />
                        ) : null}
                      </span>
                    </NavLink>
                  )
                })}
              </div>
            </div>

            {/* Right */}
            <div className='hidden items-center justify-end gap-4 md:flex'>
              <ThemeToggle />

              {isLoaded && !isSignedIn ? (
                <button
                  type='button'
                  className='rounded-full bg-[#C67C4E] px-5 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#B66B3E]'
                  onClick={() => setShowLogin(true)}
                >
                  Đăng nhập
                </button>
              ) : null}

              {isSignedIn ? (
                <UserButton afterSignOutUrl='/' appearance={{ elements: { avatarBox: 'clerk-avatar-box' } }} />
              ) : null}
            </div>

            {/* Mobile right */}
            <div className='flex items-center gap-3 md:hidden'>
              <ThemeToggle size='sm' />

              {isLoaded && !isSignedIn ? (
                <button
                  type='button'
                  className='flex h-7 items-center justify-center rounded-full bg-[#C67C4E] px-3 text-sm font-medium leading-none text-white transition-colors duration-200 hover:bg-[#B66B3E]'
                  onClick={() => setShowLogin(true)}
                >
                  Đăng nhập
                </button>
              ) : null}

              {isSignedIn ? (
                <UserButton afterSignOutUrl='/' appearance={{ elements: { avatarBox: 'clerk-avatar-box' } }} />
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className='fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white py-2 md:hidden dark:border-white/10 dark:bg-[var(--bg-body)]'>
        <div className='flex items-stretch justify-around'>
          {bottomNavLinks.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.to === '/'}
                className={bottomLinkClass}
                aria-label={item.label}
              >
                <span className='relative text-xl'>
                  <Icon className='h-6 w-6' aria-hidden='true' />
                  {item.key === 'cart' && totalItems > 0 ? (
                    <span className='absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white'>
                      {totalItems}
                    </span>
                  ) : null}
                  {item.key === 'voucher' && voucherActiveCount > 0 ? (
                    <span className='absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white'>
                      {voucherActiveCount}
                    </span>
                  ) : null}
                  {item.key === 'orders' && hasShippingOrder ? (
                    <span className='absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500' />
                  ) : null}
                </span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default Navbar
