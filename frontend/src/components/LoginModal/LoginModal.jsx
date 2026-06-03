import React, { useEffect, useMemo } from 'react'
import { SignIn, SignUp, useUser } from '@clerk/react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { POST_LOGIN_REDIRECT_KEY } from '../../features/reorder/constants'
import { StoreContext } from '../../context/StoreContext'
import './LoginModal.css'

const authSignInAppearance = {
  elements: {
    rootBox: 'clerk-root-box',
    cardBox: 'clerk-card-box',
    card: 'clerk-signin-card',
    headerTitle: 'clerk-signin-title',
    headerSubtitle: 'clerk-signin-subtitle',
    socialButtonsBlockButton: 'clerk-social-btn',
    formButtonPrimary: 'clerk-primary-btn',
  },
}

const authSignUpAppearance = {
  elements: {
    rootBox: 'clerk-root-box clerk-root-box--signup',
    cardBox: 'clerk-card-box clerk-card-box--signup',
    card: 'clerk-signin-card clerk-signup-card',
    headerTitle: 'clerk-signin-title',
    headerSubtitle: 'clerk-signin-subtitle',
    socialButtonsBlockButton: 'clerk-social-btn',
    formButtonPrimary: 'clerk-primary-btn',
  },
}

const sanitizeRedirectPath = (value) => {
  const text = String(value || '').trim()
  if (!text || !text.startsWith('/')) return ''
  if (text.startsWith('//')) return ''
  return text
}

const LoginModal = ({ isOpen, onClose, mode = 'modal' }) => {
  const { isSignedIn } = useUser()
  const { token } = React.useContext(StoreContext)
  const location = useLocation()
  const navigate = useNavigate()

  const redirectUrl = useMemo(() => {
    const fromQuery = sanitizeRedirectPath(
      new URLSearchParams(String(location?.search || '')).get('redirect')
    )
    const fromStorage =
      typeof window !== 'undefined'
        ? sanitizeRedirectPath(localStorage.getItem(POST_LOGIN_REDIRECT_KEY))
        : ''

    return fromQuery || fromStorage || '/'
  }, [location?.search])

  useEffect(() => {
    if (isOpen && mode === 'modal') {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [isOpen, mode])

  useEffect(() => {
    if (!isSignedIn) return

    if (isOpen && mode === 'modal' && typeof onClose === 'function') {
      onClose()
    }

    if (mode === 'page' || mode === 'sign-up-page') {
      if (!token) return
      localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
      navigate(redirectUrl, { replace: true })
      return
    }

    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
  }, [isOpen, isSignedIn, mode, navigate, onClose, redirectUrl, token])

  if (mode === 'page') {
    return (
      <section className='login-page'>
        <div className='login-page-inner'>
          <h1>Đăng nhập</h1>
          <p className='login-page-note'>Hỗ trợ Email + Password, Google và Facebook.</p>
          <SignIn
            routing='path'
            path='/login'
            signUpUrl='/sign-up'
            forceRedirectUrl={redirectUrl}
            appearance={authSignInAppearance}
          />
          <Link className='login-back-link' to='/'>
            Quay lại trang chủ
          </Link>
        </div>
      </section>
    )
  }

  if (mode === 'sign-up-page') {
    return (
      <section className='login-page login-page--signup'>
        <div className='login-page-inner login-page-inner--signup'>
          <h1>Đăng ký</h1>
          <p className='login-page-note'>Tạo tài khoản bằng Email + Password, Google hoặc Facebook.</p>
          <SignUp
            routing='path'
            path='/sign-up'
            signInUrl='/login'
            forceRedirectUrl={redirectUrl}
            appearance={authSignUpAppearance}
          />
          <Link className='login-back-link' to='/'>
            Quay lại trang chủ
          </Link>
        </div>
      </section>
    )
  }

  if (!isOpen) return null

  return (
    <>
      <div className='login-modal-overlay' onClick={onClose} role='presentation' />
      <div
        className='login-modal-content'
        onClick={(event) => event.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-label='Đăng nhập'
      >
        <button type='button' className='login-modal-close' onClick={onClose}>
          x
        </button>

        <h2>Đăng nhập</h2>
        <p className='login-page-note'>Email + Password, Login with Google, Login with Facebook.</p>

        <SignIn
          routing='virtual'
          signUpUrl='/sign-up'
          forceRedirectUrl={redirectUrl}
          appearance={authSignInAppearance}
        />
      </div>
    </>
  )
}

export default LoginModal
