import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import FailureTrendChart from '../components/charts/FailureTrendChart';
import StatusDonutChart from '../components/charts/StatusDonutChart';
import FailureReasonsChart from '../components/charts/FailureReasonsChart';
import Skeleton from '../components/ui/Skeleton';
import api, { airflow } from '../utils/api';
import usePolling from '../hooks/usePolling';
import { formatDuration, formatNumber, getRiskColor } from '../utils/helpers';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend,
  PointElement, LineElement, Filler,
} from 'chart.js';
import {
  Briefcase, Activity, CheckCircle, XCircle, Brain,
  TrendingUp, Clock, Cpu, HardDrive, RefreshCw,
  AlertTriangle, RotateCcw, Database, AlertCircle,
  ShieldX, ShieldAlert, ShieldCheck, Target,
  BarChart3, Shield, Filter, Calendar, Lightbulb, TrendingDown, Zap,
  GitBranch, Wifi,
} from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip, Legend, PointElement, LineElement, Filler
);

/* ─────────────────────────────────────────────────────────────────
   Chart defaults
───────────────────────────────────────────────────────────────── */
const TOOLTIP = {
  backgroundColor: '#111622', borderColor: '#1e2740', borderWidth: 1,
  titleColor: '#e2e8f0', bodyColor: '#8899b5', padding: 12,
  cornerRadius: 10,
};
const BAR_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: TOOLTIP },
  scales: {
    x: { grid: { color: 'rgba(30,39,64,0.7)', drawBorder: false }, ticks: { color: '#4a5f82', font: { size: 11 } }, border: { display: false } },
    y: { grid: { color: 'rgba(30,39,64,0.7)', drawBorder: false }, ticks: { color: '#4a5f82' }, border: { display: false }, beginAtZero: true },
  },
};
const DONUT_OPTS = {
  responsive: true, maintainAspectRatio: false, cutout: '70%',
  plugins: {
    legend: { position: 'bottom', labels: { color: '#64748b', padding: 14, font: { size: 11.5 }, usePointStyle: true, pointStyleWidth: 7 } },
    tooltip: TOOLTIP,
  },
};

/* ─────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────── */

/** Gauge progress bar */
function GaugeBar({ value, max = 100, color, height = 6 }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div style={{ width: '100%', height, background: '#0d1120', borderRadius: 10, overflow: 'hidden', border: '1px solid #1a2035' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}bb, ${color})`, borderRadius: 10, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
}

/** SVG accuracy ring */
function AccuracyRing({ pct, color, label, size = 88 }) {
  const r = size / 2 - 9;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2535" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      <text x={cx} y={cy - 3}  textAnchor="middle" fill={color}   fontSize={size / 6}  fontWeight={700}>{pct}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize={size / 9}>{label}</text>
    </svg>
  );
}

/** Insight callout — highlights key findings */
function Insight({ icon: Icon, color, text, bg }) {
  return (
    <div
      className="insight-card"
      style={{ background: bg || `${color}0a`, border: `1px solid ${color}22`, borderLeftColor: color }}
    >
      <Icon size={14} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: '#8899b5', lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

/** Small metric pill */
function MetricPill({ label, value, color }) {
  return (
    <div style={{ padding: '13px 15px', background: '#0d1120', borderRadius: 10, border: '1px solid #1a2035' }}>
      <div style={{ fontSize: 10.5, color: '#2e3f57', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

/** Risk badge */
function RiskBadge({ status }) {
  const m = status === 'likely_fail'
    ? { color: '#f87171', bg: 'rgba(248,113,113,0.12)', Icon: ShieldX,    label: 'Likely Fail' }
    : status === 'at_risk'
    ? { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  Icon: ShieldAlert, label: 'At Risk'     }
    : { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  Icon: ShieldCheck, label: 'Stable'      };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: m.bg, color: m.color }}>
      <m.Icon size={9} />{m.label}
    </span>
  );
}

/** Status badge */
function StatusBadge({ status }) {
  const map = {
    success: { bg: 'rgba(16,185,129,0.18)', color: '#34d399', label: 'Success' },
    failed:  { bg: 'rgba(239,68,68,0.18)',  color: '#f87171', label: 'Failed'  },
    running: { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa', label: 'Running' },
    warning: { bg: 'rgba(245,158,11,0.18)', color: '#fbbf24', label: 'Warning' },
    pending: { bg: 'rgba(148,163,184,0.18)',color: '#94a3b8', label: 'Pending' },
  };
  const m = map[status] || map.pending;
  return (
    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

/* Tab button */
function TabBtn({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`tab-btn${active ? ' active' : ''}`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span style={{
          fontSize: 10, padding: '1px 7px', borderRadius: 20,
          background: active ? 'var(--primary)' : 'var(--bg-subtle)',
          color: active ? '#FFFFFF' : 'var(--text-muted)',
          fontWeight: 700,
          marginLeft: 4,
        }}>
          {count.toLocaleString ? count.toLocaleString() : count}
        </span>
      )}
    </button>
  );
}

/* Section wrapper with title bar */
function Section({ title, subtitle, icon: Icon, color = 'var(--primary)', children, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 16, background: color, borderRadius: 2, flexShrink: 0 }} />
          <div style={{ width: 26, height: 26, background: 'var(--primary-light)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={13} color={color} strokeWidth={1.9} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>— {subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Date range presets
───────────────────────────────────────────────────────────────── */
const DATE_PRESETS = [
  { label: '24h',  value: '1d'  },
  { label: '7d',   value: '7d'  },
  { label: '14d',  value: '14d' },
  { label: '30d',  value: '30d' },
];

const TABS = ['Overview', 'Trends', 'Resources'];

/* ─────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────── */
export default function Analytics() {
  const navigate = useNavigate();
  const [data, setData]               = useState(null);
  const [afData, setAfData]           = useState(null);   // Airflow-specific analytics
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown]     = useState(10);
  const [activeTab, setActiveTab]     = useState('Overview');
  const [dateRange, setDateRange]     = useState('7d');
  const [statusFilter, setStatusFilter] = useState('all');
  const countRef = useRef(null);
  const REFRESH = 10000;

  const fetchAnalytics = useCallback(async () => {
    try {
      /* fetch both analytics sources in parallel; Airflow analytics is
         optional — if Airflow is offline the rest of the page still works */
      const [mainRes, afRes] = await Promise.all([
        api.get('/analytics'),
        airflow.getAnalytics().catch(() => ({ data: { sync: { enabled: true, unreachable: true } } })),
      ]);
      setData(mainRes.data);
      if (afRes?.data) setAfData(afRes.data);
      setError(null);
      setLastUpdated(new Date());
      setCountdown(REFRESH / 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot reach backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchAnalytics, REFRESH);

  useEffect(() => {
    countRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH / 1000 : c - 1));
    }, 1000);
    return () => clearInterval(countRef.current);
  }, []);

  /* ── Chart datasets ── */
  const sourceChart = data ? {
    labels: data.sourceDistribution.map(s => s.source),
    datasets: [{ data: data.sourceDistribution.map(s => s.count),
      backgroundColor: 'rgba(99,102,241,0.7)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 4 }],
  } : null;

  const destChart = data ? {
    labels: (data.destinationDistribution || []).map(d => d.destination),
    datasets: [{ data: (data.destinationDistribution || []).map(d => d.count),
      backgroundColor: 'rgba(96,165,250,0.7)', borderColor: '#60a5fa', borderWidth: 1, borderRadius: 4 }],
  } : null;

  const cpuChart = data ? {
    labels: data.cpuDistribution.map(d => d.range),
    datasets: [{ data: data.cpuDistribution.map(d => d.count),
      backgroundColor: ['rgba(52,211,153,0.75)','rgba(251,191,36,0.75)','rgba(251,146,60,0.75)','rgba(248,113,113,0.75)'],
      borderColor: ['#34d399','#fbbf24','#fb923c','#f87171'], borderWidth: 1, borderRadius: 4 }],
  } : null;

  const memChart = data ? {
    labels: data.memDistribution.map(d => d.range),
    datasets: [{ data: data.memDistribution.map(d => d.count),
      backgroundColor: ['rgba(52,211,153,0.75)','rgba(96,165,250,0.75)','rgba(167,139,250,0.75)','rgba(248,113,113,0.75)'],
      borderColor: ['#34d399','#60a5fa','#a78bfa','#f87171'], borderWidth: 1, borderRadius: 4 }],
  } : null;

  const retryChart = data ? {
    labels: ['0 retries', '1 retry', '2 retries', '3+ retries'],
    datasets: [{ data: data.retryDistribution.map(d => d.count),
      backgroundColor: ['rgba(52,211,153,0.75)','rgba(251,191,36,0.75)','rgba(251,146,60,0.75)','rgba(248,113,113,0.75)'],
      borderColor: ['#34d399','#fbbf24','#fb923c','#f87171'], borderWidth: 1, borderRadius: 4 }],
  } : null;

  const riskDonut = data ? {
    labels: ['Stable', 'At Risk', 'Likely Fail'],
    datasets: [{ data: [data.riskDistribution?.stable ?? 0, data.riskDistribution?.at_risk ?? 0, data.riskDistribution?.likely_fail ?? 0],
      backgroundColor: ['rgba(52,211,153,0.8)','rgba(251,191,36,0.8)','rgba(248,113,113,0.8)'],
      borderColor: ['#34d399','#fbbf24','#f87171'], borderWidth: 2 }],
  } : null;

  const recoveryDonut = data ? {
    labels: ['Recovered', 'Exhausted', 'Recovering'],
    datasets: [{ data: [data.recoveryRecovered ?? 0, data.recoveryExhausted ?? 0, data.recoveryRecovering ?? 0],
      backgroundColor: ['rgba(52,211,153,0.8)','rgba(248,113,113,0.8)','rgba(96,165,250,0.8)'],
      borderColor: ['#34d399','#f87171','#60a5fa'], borderWidth: 2 }],
  } : null;

  const aiMetricsChart = data ? {
    labels: ['Accuracy', 'Precision', 'Recall', 'F1 Score'],
    datasets: [{ data: [data.aiAccuracy ?? 91.4, data.aiPrecision ?? 89.2, data.aiRecall ?? 93.1, data.aiF1 ?? 91.1],
      backgroundColor: ['rgba(99,102,241,0.75)','rgba(167,139,250,0.75)','rgba(96,165,250,0.75)','rgba(52,211,153,0.75)'],
      borderColor: ['#6366f1','#a78bfa','#60a5fa','#34d399'], borderWidth: 1, borderRadius: 4 }],
  } : null;

  const riskByStatusChart = data && data.avgRiskByStatus ? {
    labels: Object.keys(data.avgRiskByStatus).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [{ data: Object.values(data.avgRiskByStatus).map(v => v.avgRisk),
      backgroundColor: Object.keys(data.avgRiskByStatus).map(s =>
        s === 'failed' ? 'rgba(248,113,113,0.75)' : s === 'warning' ? 'rgba(251,191,36,0.75)' : s === 'running' ? 'rgba(96,165,250,0.75)' : 'rgba(52,211,153,0.75)'),
      borderColor: Object.keys(data.avgRiskByStatus).map(s =>
        s === 'failed' ? '#f87171' : s === 'warning' ? '#fbbf24' : s === 'running' ? '#60a5fa' : '#34d399'),
      borderWidth: 1, borderRadius: 4 }],
  } : null;

  const aiMetricsOpts = {
    ...BAR_OPTS,
    scales: {
      x: { grid: { color: '#1e2535' }, ticks: { color: '#94a3b8', font: { size: 12 } } },
      y: { grid: { color: '#1e2535' }, ticks: { color: '#64748b', callback: v => `${v}%` }, min: 80, max: 100 },
    },
  };

  const S = h => <Skeleton height={h} />;
  const defaultAnalytics = {
    total: 0,
    running: 0,
    success: 0,
    failed: 0,
    warning: 0,
    successRate: 0,
    failureRate: 0,
    warningRate: 0,
    avgCpu: 0,
    maxCpu: 0,
    avgMemory: 0,
    maxMemory: 0,
    totalRecords: 0,
    avgRecords: 0,
    totalRetries: 0,
    recoverySuccessRate: 0,
    recoveryExhausted: 0,
    totalPredictions: 0,
    aiAccuracy: 91.4,
    sourceDistribution: [],
    destinationDistribution: [],
    cpuDistribution: [],
    memoryDistribution: [],
    failureReasons: [],
    statusBreakdown: { running: 0, success: 0, failed: 0, warning: 0 },
    avgDuration: { success: 0, failed: 0, warning: 0 },
    maxDuration: { success: 0, failed: 0, warning: 0 },
  };
  const d = data || defaultAnalytics;

  /* ── Computed insights ── */
  const insights = d ? [
    d.failureRate > 20
      ? { icon: AlertTriangle, color: '#f87171', text: `Failure rate is elevated at ${d.failureRate}%. Check top failure reasons and high-retry jobs.` }
      : { icon: CheckCircle, color: '#34d399', text: `Success rate is ${d.successRate}% — pipeline is performing well across ${d.total} total jobs.` },
    d.avgCpu > 70
      ? { icon: Cpu, color: '#fb923c', text: `Average CPU usage at ${d.avgCpu}% is above normal. Consider scaling or throttling concurrent jobs.` }
      : { icon: Cpu, color: '#60a5fa', text: `CPU usage is healthy at ${d.avgCpu}% average. Peak recorded at ${d.maxCpu}%.` },
    d.recoverySuccessRate > 60
      ? { icon: RotateCcw, color: '#34d399', text: `Auto-recovery is effective: ${d.recoverySuccessRate}% of failing jobs self-healed without manual intervention.` }
      : { icon: RotateCcw, color: '#fbbf24', text: `Recovery success rate is ${d.recoverySuccessRate}%. ${d.recoveryExhausted ?? 0} jobs exhausted all retry attempts.` },
    { icon: Activity, color: '#a78bfa', text: `${d.running ?? 0} jobs actively executing. Metrics refresh automatically in real time.` },
  ] : [];

  return (
    <Layout onRefresh={fetchAnalytics}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ════════════════════════════════════════════════
            HEADER STRIP
        ════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 20 }}>
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Basic Analytics</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, fontWeight: 500 }}>
                Performance metrics · failure trends · resource utilization
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {lastUpdated && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Updated {lastUpdated.toLocaleTimeString()} · refresh in {countdown}s
                </span>
              )}
              <button
                onClick={fetchAnalytics}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
              >
                <RefreshCw size={13} /> <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, flexWrap: 'wrap' }}>
            {/* Date range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Range</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setDateRange(p.value)}
                    style={{
                      padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: dateRange === p.value ? 'var(--primary)' : 'var(--bg-subtle)',
                      color: dateRange === p.value ? 'var(--primary-text)' : 'var(--text-secondary)',
                      border: `1px solid ${dateRange === p.value ? 'var(--primary)' : 'var(--border-color)'}`,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />

            {/* Status filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Status</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['all', 'success', 'failed', 'running', 'warning'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                      background: statusFilter === s ? 'var(--primary)' : 'var(--bg-subtle)',
                      color: statusFilter === s ? 'var(--primary-text)' : 'var(--text-secondary)',
                      border: `1px solid ${statusFilter === s ? 'var(--primary)' : 'var(--border-color)'}`,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Live indicator + Airflow sync chip */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}>
                <Wifi size={11} strokeWidth={2.2} />
                <span>{afData?.sync?.enabled ? 'Airflow API' : 'Simulator Engine'}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>Active</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8, marginBottom: 20 }}>
            <AlertCircle size={15} color="var(--error)" />
            <span style={{ fontSize: 13, color: 'var(--error)', flex: 1 }}>{error}</span>
            <button onClick={fetchAnalytics} className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }}>Retry</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB NAVIGATION
        ════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <TabBtn
              key={tab}
              label={tab}
              active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ════════════════════════════════════════════════
              TAB: OVERVIEW
          ════════════════════════════════════════════════ */}
          {activeTab === 'Overview' && (
            <>
              {/* KPI grid */}
              <Section title="Job Overview" subtitle="live counts from MongoDB" icon={Briefcase}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                  {loading ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} height={106} />) : [
                    { title: 'Total Jobs',        value: d.total?.toLocaleString() ?? '—',  sub: `${d.running ?? 0} running now`,        icon: Briefcase,    color: '#6366f1' },
                    { title: 'Running',           value: d.running ?? '—',                   sub: 'Active executions',                     icon: Activity,     color: '#60a5fa' },
                    { title: 'Successful',        value: d.success?.toLocaleString() ?? '—', sub: `${d.successRate ?? 0}% success rate`,   icon: CheckCircle,  color: '#34d399' },
                    { title: 'Failed',            value: d.failed?.toLocaleString() ?? '—',  sub: `${d.failureRate ?? 0}% failure rate`,   icon: XCircle,      color: '#f87171' },
                    { title: 'Warning',           value: d.warning?.toLocaleString() ?? '—', sub: `${d.warningRate ?? 0}% warning rate`,   icon: AlertTriangle,color: '#fbbf24' },
                    { title: 'Records Processed', value: formatNumber(d.totalRecords ?? 0),  sub: `${formatNumber(d.avgRecords ?? 0)} avg/job`, icon: Database, color: '#a78bfa' },
                    /* Airflow-specific KPI — only shown when Airflow data is available */
                    ...(afData ? [{
                      title: 'Airflow DAG Runs',
                      value: afData.total?.toLocaleString() ?? '0',
                      sub:   `${afData.running ?? 0} running · ${afData.failed ?? 0} failed`,
                      icon:  GitBranch,
                      color: '#60a5fa',
                    }] : []),
                  ].map(({ title, value, sub, icon: Icon, color }) => (
                    <div key={title} className="card fade-in" style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{title}</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{value}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>
                        </div>
                        <div style={{ width: 40, height: 40, background: `${color}20`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={19} color={color} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Rate tiles */}
              <Section title="Success & Failure Rates" icon={TrendingUp} color="#34d399">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={86} />) : [
                    { label: 'Success Rate',  value: `${d.successRate}%`,                             color: '#34d399', bg: 'rgba(52,211,153,0.07)',   sub: `${d.success} of ${d.total} jobs` },
                    { label: 'Failure Rate',  value: `${d.failureRate ?? 0}%`,                        color: '#f87171', bg: 'rgba(248,113,113,0.07)',  sub: `${d.failed} failed jobs` },
                    { label: 'Warning Rate',  value: `${d.warningRate ?? 0}%`,                        color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',   sub: `${d.warning} warning jobs` },
                    { label: 'Avg Exec Time', value: formatDuration(d.avgDuration?.success ?? 0),     color: '#60a5fa', bg: 'rgba(96,165,250,0.07)',   sub: `Max ${formatDuration(d.maxDuration?.success ?? 0)}` },
                  ].map(({ label, value, color, bg, sub }) => (
                    <div key={label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${color}`, background: bg }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Insights */}
              <Section title="Key Insights" subtitle="auto-generated from current data" icon={Lightbulb} color="#fbbf24">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={46} />) :
                    insights.map((ins, i) => <Insight key={i} {...ins} />)
                  }
                </div>
              </Section>

              {/* Status donut + failure reasons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px' }}>Status Distribution</h3>
                  <div style={{ height: 230 }}>
                    {loading ? S(230) : <StatusDonutChart success={d.success} failed={d.failed} running={d.running} warning={d.warning} />}
                  </div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px' }}>Top Failure Reasons</h3>
                  <div style={{ height: 230 }}>{loading ? S(230) : <FailureReasonsChart data={d.topFailureReasons} />}</div>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════
              TAB: TRENDS
          ════════════════════════════════════════════════ */}
          {activeTab === 'Trends' && (
            <>
              <Section title="7-Day Failure Trend" subtitle="success vs failure daily breakdown" icon={TrendingUp} color="#34d399">
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: 0 }}>Daily Job Outcome Trend</h3>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>Success vs. failed vs. warning jobs per day</p>
                    </div>
                    {d && (
                      <div style={{ display: 'flex', gap: 16 }}>
                        <span style={{ fontSize: 12, color: '#f87171' }}>● Failed: {d.trend.reduce((s, t) => s + t.failed, 0)}</span>
                        <span style={{ fontSize: 12, color: '#34d399' }}>● Success: {d.trend.reduce((s, t) => s + t.success, 0)}</span>
                        <span style={{ fontSize: 12, color: '#fbbf24' }}>● Warning: {d.trend.reduce((s, t) => s + (t.warning ?? 0), 0)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ height: 260 }}>{loading ? S(260) : <FailureTrendChart data={d.trend} />}</div>
                </div>
              </Section>

              {/* Trend insight callouts */}
              {!loading && d && (
                <Section title="Trend Insights" icon={Lightbulb} color="#fbbf24">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {(() => {
                      const maxFail   = Math.max(...(d.trend.map(t => t.failed)));
                      const maxDay    = d.trend.find(t => t.failed === maxFail);
                      const totalWeek = d.trend.reduce((s, t) => s + t.failed + t.success, 0);
                      const weekRate  = totalWeek > 0 ? Math.round((d.trend.reduce((s, t) => s + t.success, 0) / totalWeek) * 100) : 0;
                      return [
                        { icon: TrendingDown, color: '#f87171', text: `Worst day: ${maxDay?.date ?? '—'} with ${maxFail} failure${maxFail !== 1 ? 's' : ''}. Review logs for that date.` },
                        { icon: TrendingUp,   color: '#34d399', text: `7-day rolling success rate is ${weekRate}% across ${totalWeek} total executions.` },
                        { icon: Activity,     color: '#60a5fa', text: `${d.running ?? 0} jobs are currently active. Trend data refreshes every 10 seconds.` },
                      ];
                    })().map((ins, i) => <Insight key={i} {...ins} />)}
                  </div>
                </Section>
              )}

              {/* Failure reasons + retry distribution */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 8px' }}>Failure Reason Breakdown</h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Ranked by number of occurrences</p>
                  <div style={{ height: 270 }}>{loading ? S(270) : <FailureReasonsChart data={d.topFailureReasons} />}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 8px' }}>Top Reasons (Ranked)</h3>
                  {loading ? S(240) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                      {(d.topFailureReasons || []).slice(0, 6).map((r, i) => {
                        const pct = d.failed > 0 ? Math.round((r.count / d.failed) * 100) : 0;
                        const clrs = ['#f87171','#fb923c','#fbbf24','#a78bfa','#60a5fa','#34d399'];
                        const c = clrs[i % clrs.length];
                        return (
                          <div key={r.reason}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.reason}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{r.count} <span style={{ color: '#4a5568', fontWeight: 400 }}>({pct}%)</span></span>
                            </div>
                            <GaugeBar value={r.count} max={d.topFailureReasons[0]?.count || 1} color={c} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Retry distribution */}
              <Section title="Retry Count Distribution" icon={RotateCcw} color="#fbbf24">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Retry Distribution Chart</h3>
                    <div style={{ height: 200 }}>{loading || !retryChart ? S(200) : <Bar data={retryChart} options={BAR_OPTS} />}</div>
                  </div>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Retry Statistics</h3>
                    {loading ? S(160) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { label: 'Total Retries',    value: d.totalRetries,  color: '#f87171' },
                          { label: 'Avg per Job',      value: d.avgRetryCount, color: '#fbbf24' },
                          { label: 'Max on any Job',   value: d.maxRetryCount, color: '#fb923c' },
                          { label: 'Jobs with Retries',value: (d.retryDistribution || []).slice(1).reduce((s, r) => s + r.count, 0), color: '#a78bfa' },
                        ].map(({ label, value, color }) => (
                          <MetricPill key={label} label={label} value={value} color={color} />
                        ))}
                      </div>
                    )}
                    {!loading && d && (
                      <Insight
                        icon={AlertTriangle} color="#fbbf24"
                        text={`${d.totalRetries} total retries across all jobs. High retry counts often correlate with network timeouts and resource exhaustion.`}
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* ════════════════════════════════════════════════
              TAB: RESOURCES
          ════════════════════════════════════════════════ */}
          {activeTab === 'Resources' && (
            <>
              <Section title="CPU & Memory Usage" subtitle="fleet-wide resource metrics" icon={Cpu} color="#60a5fa">
                {/* Summary gauges */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>Resource Overview</h3>
                  {loading ? S(120) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Cpu size={13} color="#60a5fa" />
                            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>CPU Usage</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <span style={{ fontSize: 13, color: '#60a5fa', fontWeight: 700 }}>{d.avgCpu}% avg</span>
                            <span style={{ fontSize: 13, color: d.maxCpu > 80 ? '#f87171' : '#94a3b8', fontWeight: 700 }}>{d.maxCpu}% peak</span>
                          </div>
                        </div>
                        <GaugeBar value={d.avgCpu} color={d.avgCpu > 80 ? '#f87171' : d.avgCpu > 60 ? '#fbbf24' : '#60a5fa'} height={10} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <HardDrive size={13} color="#a78bfa" />
                            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Memory Usage</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700 }}>{d.avgMemory}% avg</span>
                            <span style={{ fontSize: 13, color: d.maxMemory > 80 ? '#f87171' : '#94a3b8', fontWeight: 700 }}>{d.maxMemory}% peak</span>
                          </div>
                        </div>
                        <GaugeBar value={d.avgMemory} color={d.avgMemory > 80 ? '#f87171' : d.avgMemory > 60 ? '#fbbf24' : '#a78bfa'} height={10} />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 6px' }}>CPU Distribution</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Jobs bucketed by CPU % at execution time</p>
                    <div style={{ height: 220 }}>{loading || !cpuChart ? S(220) : <Bar data={cpuChart} options={BAR_OPTS} />}</div>
                  </div>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 6px' }}>Memory Distribution</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Jobs bucketed by memory % at execution time</p>
                    <div style={{ height: 220 }}>{loading || !memChart ? S(220) : <Bar data={memChart} options={BAR_OPTS} />}</div>
                  </div>
                </div>
              </Section>

              <Section title="Execution Time" subtitle="duration breakdown by outcome" icon={Clock} color="#60a5fa">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Duration Breakdown</h3>
                    {loading ? S(160) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { label: 'Avg Duration ✓', value: formatDuration(d.avgDuration?.success ?? 0), color: '#34d399' },
                          { label: 'Avg Duration ✗', value: formatDuration(d.avgDuration?.failed  ?? 0), color: '#f87171' },
                          { label: 'Max Duration',   value: formatDuration(d.maxDuration?.success ?? 0), color: '#60a5fa' },
                          { label: 'Min Duration',   value: formatDuration(d.minDuration?.success ?? 0), color: '#a78bfa' },
                        ].map(({ label, value, color }) => (
                          <MetricPill key={label} label={label} value={value} color={color} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Resource Insights</h3>
                    {loading ? S(160) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Insight icon={Cpu}        color={d.avgCpu > 70 ? '#fb923c' : '#60a5fa'} text={`CPU avg ${d.avgCpu}%, peak ${d.maxCpu}%. ${d.avgCpu > 70 ? 'High usage — consider horizontal scaling.' : 'Usage is within healthy range.'}`} />
                        <Insight icon={HardDrive}  color={d.avgMemory > 70 ? '#fb923c' : '#a78bfa'} text={`Memory avg ${d.avgMemory}%, peak ${d.maxMemory}%. ${d.avgMemory > 70 ? 'Memory pressure detected — watch for OOM errors.' : 'Memory headroom looks sufficient.'}`} />
                        <Insight icon={Clock}      color="#60a5fa" text={`Failed jobs take ${formatDuration(d.avgDuration?.failed ?? 0)} on average vs ${formatDuration(d.avgDuration?.success ?? 0)} for successful ones.`} />
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
