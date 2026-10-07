import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, Zap, UserPlus } from 'lucide-react';
import authToast from '../utils/authToast';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const { login, register, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from?.pathname || '/';

  // Ensure fresh open and post-logout forms start completely empty
  useEffect(() => {
    setForm({ name: '', email: '', password: '' });
    setReadOnly(true);
    if (emailRef.current) emailRef.current.value = '';
    if (passwordRef.current) passwordRef.current.value = '';
    const timer = setTimeout(() => {
      setReadOnly(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [location.key]);

  // Check session expiry query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_expired' || params.get('expired') === 'true') {
      authToast.sessionExpired('Session Expired', 'Your authentication session has ended. Please sign in again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const emailVal = form.email.trim();
    const passwordVal = form.password;

    if (!emailVal) {
      authToast.validationError('Email Required', 'Please enter your email address to proceed.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      authToast.validationError('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!passwordVal) {
      authToast.validationError('Password Required', 'Please enter your password to proceed.');
      return;
    }

    if (isSignUp) {
      if (!form.name.trim()) {
        authToast.validationError('Full Name Required', 'Please enter your full name to register.');
        return;
      }
      const result = await register(form.name.trim(), emailVal, passwordVal);
      if (result.success) {
        authToast.success('Account Created', 'Welcome to ETL Observability System!');
        navigate(destination, { replace: true });
      } else {
        if (result.errorType === 'account_exists') {
          authToast.warning('Account Already Exists', 'An account with this email address already exists. Please sign in.');
        } else if (result.errorType === 'network') {
          authToast.networkError('Server Connection Error', result.message);
        } else {
          authToast.error('Registration Failed', result.message || 'Unable to register account.');
        }
      }
    } else {
      const result = await login(emailVal, passwordVal);
      if (result.success) {
        authToast.success('Authentication Successful', 'Welcome back to ETL Observability!');
        navigate(destination, { replace: true });
      } else {
        if (result.errorType === 'account_not_found') {
          authToast.accountNotFound('Account Not Found', result.message || 'No account is registered with this email. Please sign up.');
        } else if (result.errorType === 'credentials') {
          authToast.credentials('Invalid Password', result.message || 'The password you entered is incorrect. Please check your credentials.');
        } else if (result.errorType === 'network') {
          authToast.networkError('Server Connection Error', result.message);
        } else {
          authToast.credentials('Sign In Failed', result.message || 'Authentication failed. Please verify your credentials.');
        }
      }
    }
  };

  const handleToggleMode = (signUp) => {
    setIsSignUp(signUp);
    setForm({ name: '', email: '', password: '' });
    setReadOnly(true);
    setTimeout(() => setReadOnly(false), 150);
  };

  return (
    <div className="login-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56,
            background: 'var(--primary)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <Shield size={26} color="white" strokeWidth={1.8} />
          </div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
            ETL Observability System
          </h1>
        </div>

        {/* Form Card */}
        <div className="card" style={{ padding: '26px 26px' }}>
          <div style={{ marginBottom: 18, textAlign: 'center' }}>
            <h2 style={{ fontSize: 17.5, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {isSignUp ? 'Create your account' : 'Sign in to your account'}
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {isSignUp && (
              <div>
                <label htmlFor="etl_auth_name" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Full Name</label>
                <input
                  id="etl_auth_name"
                  name="etl_auth_name"
                  className="input"
                  style={{ width: '100%' }}
                  type="text"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck="false"
                  aria-autocomplete="none"
                  readOnly={readOnly}
                  onFocus={() => setReadOnly(false)}
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
                  required={isSignUp}
                />
              </div>
            )}

            <div>
              <label htmlFor="etl_auth_user" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email Address</label>
              <input
                ref={emailRef}
                id="etl_auth_user"
                name="etl_auth_user"
                className="input"
                style={{ width: '100%' }}
                type="text"
                inputMode="email"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                aria-autocomplete="none"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                readOnly={readOnly}
                onFocus={() => setReadOnly(false)}
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="name@company.com"
                required
              />
            </div>

            <div>
              <label htmlFor="etl_auth_token" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={passwordRef}
                  id="etl_auth_token"
                  name="etl_auth_token"
                  className="input"
                  style={{ width: '100%', paddingRight: 42 }}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  aria-autocomplete="none"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  readOnly={readOnly}
                  onFocus={() => setReadOnly(false)}
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '11px', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}
            >
              {loading ? (
                <>
                  <span className="spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                  {isSignUp ? 'Creating account…' : 'Authenticating…'}
                </>
              ) : isSignUp ? (
                <><UserPlus size={14} /> Create Account</>
              ) : (
                <><Zap size={14} /> Sign In</>
              )}
            </button>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-color)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {isSignUp ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleToggleMode(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Sign in
                </button>
              </span>
            ) : (
              <span>
                Don’t have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleToggleMode(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Sign up
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: 'var(--text-muted)' }}>
          Secure Authentication · ETL Observability Platform
        </p>
      </div>
    </div>
  );
}
