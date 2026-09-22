import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Activity, Brain, Bell, Briefcase,
  BarChart3, Server, CheckCircle, XCircle, Zap, Clock,
  GitBranch, Package, Globe, Lock, RefreshCw, ExternalLink,
  ChevronRight, Info, Star, Code, Cpu, HardDrive, ScrollText
} from 'lucide-react';

/* ─── design tokens ────────────────────────────────────────── */
const BG     = '#0b0e17';
const FLAT   = '#0e1220';
const BORDER = '#1a2038';
const T1     = '#e6ecf5';
const T2     = '#7585a0';
const T3     = '#3d5070';
const ACCENT = '#7c6bf0';

const VERSION     = '2.4.1';
const BUILD_DATE  = 'June 2025';
const DESCRIPTION = 'AI-powered ETL pipeline monitoring platform with real-time failure prediction, auto-recovery, and structured observability.';

/* ─── tech stack ────────────────────────────────────────────── */
const STACK = [
  {
    category: 'Frontend',
    color: '#60a5fa',
    items: [
      { name: 'React 18',         desc: 'UI framework with hooks'            },
      { name: 'Vite 6',           desc: 'Build tool & dev server'            },
      { name: 'React Router v6',  desc: 'Client-side routing'                },
      { name: 'Chart.js 4',       desc: 'Data visualisation charts'          },
      { name: 'Lucide React',     desc: 'Icon library'                       },
      { name: 'React Hot Toast',  desc: 'Notification toasts'                },
      { name: 'Axios',            desc: 'HTTP client with interceptors'       },
    ],
  },
  {
    category: 'Backend',
    color: '#34d399',
    items: [
      { name: 'Node.js / Express', desc: 'REST API server'                   },
      { name: 'MongoDB / Mongoose',desc: 'Primary data store'                },
      { name: 'JWT',               desc: 'Stateless authentication'          },
      { name: 'Nodemailer',        desc: 'SMTP email notifications'          },
      { name: 'express-rate-limit',desc: 'API rate limiting'                 },
    ],
  },
  {
    category: 'AI / ML',
    color: '#a78bfa',
    items: [
      { name: 'Custom Risk Engine', desc: 'Heuristic failure prediction'     },
      { name: 'Anomaly Detection',  desc: 'CPU/memory spike detection'       },
      { name: 'Auto-Recovery',      desc: 'Retry engine with backoff'        },
      { name: 'RCA Engine',         desc: 'Root-cause analysis suggestions'  },
    ],
  },
];

/* ─── platform features ─────────────────────────────────────── */
const FEATURES = [
  { icon: Activity,   color: '#60a5fa', title: 'Live Monitoring',      desc: 'Real-time ETL job telemetry with 5 s refresh, CPU/memory bars, and live status badges.' },
  { icon: Brain,      color: '#a78bfa', title: 'AI Failure Prediction', desc: 'Runs pre-execution risk scoring on every job. Flags "Likely Fail", "At Risk", and "Stable" states.' },
  { icon: Bell,       color: '#fbbf24', title: 'Smart Alerts',          desc: 'Typed alert feed with severity levels, email notifications, and "mark read" workflow.' },
  { icon: BarChart3,  color: '#7c6bf0', title: 'Deep Analytics',        desc: '6-tab analytics suite covering trends, resources, AI model accuracy, recovery, and pipeline distribution.' },
  { icon: RefreshCw,  color: '#34d399', title: 'Auto-Recovery',         desc: 'Automatic retry engine resolves ~70 % of failures without manual intervention.' },
  { icon: ScrollText, color: '#fb923c', title: 'Structured Logs',       desc: 'Per-job log timeline with level filtering (INFO / WARN / ERROR) and full-text search.' },
];

/* ─── API endpoints table ───────────────────────────────────── */
const ENDPOINTS = [
  { method: 'GET',  path: '/api/jobs',              desc: 'Paginated job list with filters & sort'  },
  { method: 'GET',  path: '/api/jobs/:id',           desc: 'Full job record with logs'               },
  { method: 'GET',  path: '/api/analytics',          desc: 'Aggregate pipeline statistics'           },
  { method: 'GET',  path: '/api/alerts',             desc: 'Alert feed (filtered, paginated)'        },
  { method: 'POST', path: '/api/alerts/email',       desc: 'Simulate an email alert'                 },
  { method: 'POST', path: '/api/predict',            desc: 'Run AI risk prediction'                  },
  { method: 'GET',  path: '/api/recovery/stats',     desc: 'Auto-recovery aggregate stats'           },
  { method: 'GET',  path: '/api/logs',               desc: 'Structured log search with filters'      },
  { method: 'GET',  path: '/api/health',             desc: 'Backend health check'                    },
  { method: 'POST', path: '/api/auth/login',         desc: 'Authenticate and receive JWT'            },
];

const METHOD_COLOR = { GET: '#34d399', POST: '#60a5fa', PUT: '#fbbf24', DELETE: '#f87171' };

/* ─── sub-components ────────────────────────────────────────── */

function SectionTitle({ title, icon: Icon, color = ACCENT }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
      <Icon size={14} color={color} strokeWidth={2} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.09em' }}>{title}</span>
    </div>
  );
}

function FeatureCard({ icon: Icon, color, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px', background: FLAT, border: `1px solid ${BORDER}`, borderRadius: 7 }}>
      <div style={{ width: 32, height: 32, background: `${color}14`, border: `1px solid ${color}25`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={color} strokeWidth={1.9} />
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T1, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.55 }}>{desc}</div>
      </div>
    </div>
  );
}

function StackItem({ name, desc }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: T2 }}>{name}</span>
      <span style={{ fontSize: 11.5, color: T3 }}>{desc}</span>
    </div>
  );
}

function StatusPill({ ok, label }) {
  const color = ok === null ? '#fbbf24' : ok ? '#34d399' : '#f87171';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 4, background: `${color}12`, border: `1px solid ${color}25`, color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

/* ─── main page ─────────────────────────────────────────────── */
export default function About() {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const [health, setHealth]     = useState(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await api.get('/health');
      setHealth({ ok: data.status === 'ok', ts: data.timestamp });
    } catch {
      setHealth({ ok: false, ts: new Date().toISOString() });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Hero ── */}
        <div className="card" style={{ padding: '28px 28px 24px', overflow: 'hidden', position: 'relative' }}>
          {/* Decorative gradient blob */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,107,240,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            {/* Logo */}
            <div style={{ width: 56, height: 56, flexShrink: 0, background: 'linear-gradient(135deg, #5a4ce0 0%, #8b5cf6 100%)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 1px rgba(124,107,240,0.3), 0 8px 24px rgba(124,107,240,0.3)' }}>
              <Shield size={26} color="white" strokeWidth={1.8} />
            </div>

            {/* Title block */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>ETL Predict AI</h1>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(124,107,240,0.14)', color: '#b8a8ff', border: '1px solid rgba(124,107,240,0.25)' }}>
                  v{VERSION}
                </span>
                {health && <StatusPill ok={health.ok} label={health.ok ? 'API Online' : 'API Offline'} />}
              </div>
              <p style={{ fontSize: 13.5, color: T3, marginTop: 8, lineHeight: 1.6, maxWidth: 620 }}>{DESCRIPTION}</p>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
                {[
                  { icon: GitBranch, label: `Version ${VERSION}` },
                  { icon: Clock,     label: `Released ${BUILD_DATE}` },
                  { icon: Lock,      label: 'JWT Auth + RBAC' },
                  { icon: Globe,     label: 'REST API' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T3 }}>
                    <Icon size={12} color={T3} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => navigate('/settings')} className="btn-secondary" style={{ fontSize: 12, gap: 5 }}>
                Settings <ChevronRight size={11} />
              </button>
              <button onClick={() => navigate('/')} className="btn-primary" style={{ fontSize: 12, gap: 5 }}>
                <Activity size={12} /> Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* ── 3-col stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { icon: Server,    color: '#60a5fa', label: 'API Status',        value: health === null ? 'Checking…' : health.ok ? 'Healthy' : 'Unreachable', valueColor: health?.ok === false ? '#f87171' : health?.ok ? '#34d399' : T2 },
            { icon: Shield,    color: '#a78bfa', label: 'Auth Method',        value: 'JWT / RBAC',                                                            valueColor: T2 },
            { icon: Code,      color: T2,        label: 'Build',              value: 'Vite + React',                                                          valueColor: T2 },
          ].map(({ icon: Icon, color, label, value, valueColor }) => (
            <div key={label} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <div style={{ width: 26, height: 26, background: `${color}14`, border: `1px solid ${color}22`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={13} color={color} strokeWidth={1.9} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: valueColor ?? T1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Two-column: Features + API Endpoints ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Features */}
          <div className="card" style={{ padding: '18px 18px 14px', overflow: 'hidden' }}>
            <SectionTitle title="Platform Features" icon={Star} color={ACCENT} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
            </div>
          </div>

          {/* API reference */}
          <div className="card" style={{ padding: '18px 18px 14px', overflow: 'hidden' }}>
            <SectionTitle title="API Reference" icon={Globe} color="#34d399" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', background: FLAT, borderBottom: `1px solid ${BORDER}` }}>Method</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', background: FLAT, borderBottom: `1px solid ${BORDER}` }}>Endpoint</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', background: FLAT, borderBottom: `1px solid ${BORDER}` }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map(({ method, path, desc }) => (
                    <tr key={path} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: `${METHOD_COLOR[method]}14`, color: METHOD_COLOR[method], border: `1px solid ${METHOD_COLOR[method]}25`, letterSpacing: '0.04em', fontFamily: 'monospace' }}>
                          {method}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, color: T2, whiteSpace: 'nowrap' }}>{path}</td>
                      <td style={{ padding: '7px 10px', fontSize: 11, color: T3 }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Health check CTA */}
            <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={checkHealth}
                disabled={checking}
                className="btn-secondary"
                style={{ fontSize: 11, gap: 5 }}
              >
                {checking
                  ? <><span className="spin-fast" style={{ width: 11, height: 11, border: '2px solid #364060', borderTopColor: T2, borderRadius: '50%', display: 'inline-block' }} /> Checking…</>
                  : <><Server size={11} /> Health Check</>
                }
              </button>
              {health && (
                <span style={{ fontSize: 11, color: T3 }}>
                  {health.ok ? '✓ API is reachable' : '✗ API unreachable'} · {new Date(health.ts).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tech Stack ── */}
        <div className="card" style={{ padding: '18px 18px 14px' }}>
          <SectionTitle title="Technology Stack" icon={Package} color="#60a5fa" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {STACK.map(({ category, color, items }) => (
              <div key={category}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 3, height: 12, background: color, borderRadius: 2, display: 'inline-block' }} />
                  {category}
                </div>
                <div>
                  {items.map(({ name, desc }) => <StackItem key={name} name={name} desc={desc} />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Current session ── */}
        {user && (
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#5a4ce0,#7c3aed)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Logged in as <strong style={{ color: ACCENT }}>{user.name}</strong></div>
                <div style={{ fontSize: 11.5, color: T3, marginTop: 2 }}>{user.email} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate('/settings')} className="btn-ghost" style={{ fontSize: 12, gap: 4 }}>
                <Shield size={12} /> Settings
              </button>
              <button onClick={() => navigate('/analytics')} className="btn-secondary" style={{ fontSize: 12, gap: 4 }}>
                <BarChart3 size={12} /> Analytics
              </button>
            </div>
          </div>
        )}

        {/* ── Footer note ── */}
        <div style={{ textAlign: 'center', paddingTop: 6, paddingBottom: 4 }}>
          <p style={{ fontSize: 11, color: '#1c2a3a' }}>
            ETL Predict AI v{VERSION} · Built with React + Node.js · {BUILD_DATE}
          </p>
        </div>

      </div>
    </Layout>
  );
}
