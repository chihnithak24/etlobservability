import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, Zap, KeyRound, CheckCircle2, XCircle, Mail, ArrowRight, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: 'admin@etl.com', password: 'Admin@123' });
  const [showPass, setShowPass] = useState(false);
  
  // OTP state
  const [step, setStep] = useState('login'); // 'login' | 'otp'
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState({ email: '', message: '', demo: '' });

  const { login, verifyOtp, resendOtp, loading } = useAuth();
  const navigate = useNavigate();

  // Password rules validation
  const pass = form.password;
  const hasMinLen = pass.length >= 8;
  const hasUpper  = /[A-Z]/.test(pass);
  const hasLower  = /[a-z]/.test(pass);
  const hasSpecial= /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass);
  const isPassValid = hasMinLen && hasUpper && hasLower && hasSpecial;

  const handleLoginSubmit = async (e, forceOtp = false) => {
    e?.preventDefault();
    if (!isPassValid) {
      toast.error('Please meet all password security requirements.');
      return;
    }

    const result = await login(form.email, form.password, forceOtp);
    if (result.success) {
      if (result.requiresOtp) {
        toast.success(result.message || 'Security OTP sent to your email.');
        setOtpInfo({ email: result.email, message: result.message, demo: result.otpDemo });
        setStep('otp');
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } else {
      toast.error(result.message);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit OTP code.');
      return;
    }

    const result = await verifyOtp(otpInfo.email || form.email, otp.trim());
    if (result.success) {
      toast.success('Security OTP verified! Signing in...');
      navigate('/');
    } else {
      toast.error(result.message);
    }
  };

  const handleResendOtp = async () => {
    const result = await resendOtp(otpInfo.email || form.email);
    if (result.success) {
      toast.success(result.message || 'Fresh OTP code generated.');
      setOtpInfo(prev => ({ ...prev, demo: result.otpDemo }));
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="login-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60,
            background: 'var(--primary)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <Shield size={28} color="white" strokeWidth={1.8} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
            ETL Observability System
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13.5 }}>
            Enterprise Pipeline Telemetry & Security Platform
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '30px 28px' }}>

          {step === 'login' ? (
            /* ── STEP 1: LOGIN FORM ── */
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email</label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@etl.com"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    style={{ width: '100%', paddingRight: 42 }}
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Password Criteria Live Checklist */}
                <div style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  fontSize: 11
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: hasMinLen ? 'var(--success)' : 'var(--text-muted)' }}>
                    {hasMinLen ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>Min 8 chars</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: hasUpper ? 'var(--success)' : 'var(--text-muted)' }}>
                    {hasUpper ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>1 Capital (A-Z)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: hasLower ? 'var(--success)' : 'var(--text-muted)' }}>
                    {hasLower ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>1 Small (a-z)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: hasSpecial ? 'var(--success)' : 'var(--text-muted)' }}>
                    {hasSpecial ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>1 Special (!@#$%)</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={loading || !isPassValid}
                  style={{ width: '100%', padding: '11px', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loading ? (
                    <>
                      <span className="spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                      Authenticating…
                    </>
                  ) : (
                    <><Zap size={14} /> Sign In</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleLoginSubmit(e, true)}
                  disabled={loading || !isPassValid}
                  style={{
                    width: '100%', padding: '9px', fontSize: 12.5, fontWeight: 600,
                    background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                    border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <KeyRound size={13} /> Sign In with OTP 2FA Verification
                </button>
              </div>
            </form>
          ) : (
            /* ── STEP 2: FIRST-TIME EMAIL OTP VERIFICATION ── */
            <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--primary-light)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px'
                }}>
                  <KeyRound size={22} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  First-Time Security Verification
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Enter the 6-digit OTP code sent to <strong>{otpInfo.email || form.email}</strong>
                </p>
              </div>

              {/* Demo Helper Banner */}
              {otpInfo.demo && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--primary-light)',
                  border: '1px solid var(--primary)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12
                }}>
                  <div style={{ color: 'var(--primary-text)', fontWeight: 600 }}>
                    📧 Demo Email OTP:
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtp(otpInfo.demo)}
                    style={{
                      background: 'var(--primary)',
                      color: 'var(--primary-text)',
                      border: 'none',
                      padding: '3px 9px',
                      borderRadius: 4,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                    title="Click to auto-fill OTP"
                  >
                    {otpInfo.demo} (Auto-Fill)
                  </button>
                </div>
              )}

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  6-Digit Security OTP Code
                </label>
                <input
                  className="input"
                  style={{
                    width: '100%', textAlign: 'center', fontSize: 20, fontWeight: 800, letterSpacing: '0.3em', fontFamily: 'monospace'
                  }}
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12, gap: 6 }}
                >
                  <RotateCcw size={13} /> Resend OTP
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn-primary"
                  style={{ flex: 1.4, justifyContent: 'center', fontSize: 13, gap: 6 }}
                >
                  {loading ? 'Verifying...' : <>Verify & Complete <ArrowRight size={13} /></>}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStep('login')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', textAlign: 'center', marginTop: 4 }}
              >
                ← Back to Login
              </button>
            </form>
          )}

          {/* Demo credentials */}
          <div style={{
            marginTop: 22,
            padding: '13px 16px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            fontSize: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Secured Credentials (8+ Chars, Capital, Small, Special)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Admin Account</span>
                <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontWeight: 700 }}>admin@etl.com · Admin@123</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Viewer Account</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>viewer@etl.com · Viewer@123</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          Strict Password Security · First-Time OTP Verification Enabled
        </p>
      </div>
    </div>
  );
}
