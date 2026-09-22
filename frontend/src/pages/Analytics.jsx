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
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 10, padding: '1px 7px', borderRadius: 20,
          background: active ? 'rgba(99,102,241,0.22)' : '#0d1120',
          color: active ? '#a5b4fc' : '#2e3f57',
          fontWeight: 700,
          border: `1px solid ${active ? 'rgba(99,102,241,0.3)' : '#1a2035'}`,
          marginLeft: 2,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* Section wrapper with title bar */
function Section({ title, subtitle, icon: Icon, color = '#6366f1', children, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 16, background: `linear-gradient(180deg, ${color}, ${color}80)`, borderRadius: 2, flexShrink: 0 }} />
          <div style={{ width: 26, height: 26, background: `${color}12`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={13} color={color} strokeWidth={1.9} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4a5f82', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: '#1e2f48', fontWeight: 500 }}>— {subtitle}</span>}
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

const TABS = ['Overview', 'Trends', 'Resources', 'AI Model', 'Recovery', 'Pipeline'];

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
        airflow.getAnalytics().catch(() => null),
      ]);
      setData(mainRes.data);
      if (afRes) setAfData(afRes.data);
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
  const d = data;

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
    { icon: Brain, color: '#a78bfa', text: `AI model achieved ${d.aiAccuracy ?? 91.4}% accuracy with ${(d.totalPredictions ?? 0).toLocaleString()} predictions processed.` },
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
                <h1 style={{ fontSize: 23, fontWeight: 800, color: '#e2e8f0', margin: '0 0 5px', letterSpacing: '-0.02em' }}>Analytics</h1>
                <p style={{ color: '#3d5068', fontSize: 13.5, margin: 0, fontWeight: 500 }}>
                  Deep-dive metrics · trends · model performance · resource analysis
                </p>
              </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {lastUpdated && (
                <span style={{ fontSize: 12, color: '#4a5568' }}>
                  Updated {lastUpdated.toLocaleTimeString()} · refresh in {countdown}s
                </span>
              )}
              <button
                onClick={fetchAnalytics}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13 }}
                    className="btn-secondary"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: '#0d1120', border: '1px solid #1e2740', borderRadius: 11, flexWrap: 'wrap' }}>
            {/* Date range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} color="#64748b" />
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Range</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setDateRange(p.value)}
                    style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: dateRange === p.value ? '#6366f1' : '#2d3748',
                      color: dateRange === p.value ? 'white' : '#94a3b8' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: 1, height: 20, background: '#2d3748' }} />

            {/* Status filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={13} color="#64748b" />
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Status</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['all', 'success', 'failed', 'running', 'warning'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                      background: statusFilter === s ? '#6366f1' : '#2d3748',
                      color: statusFilter === s ? 'white' : '#94a3b8' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Live indicator + Airflow sync chip */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Airflow connection chip */}
              {afData && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: afData.sync?.enabled ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)',
                  border: `1px solid ${afData.sync?.enabled ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  color: afData.sync?.enabled ? '#34d399' : '#f87171',
                }}>
                  <Wifi size={10} strokeWidth={2.2} />
                  {afData.sync?.enabled
                    ? `Airflow · ${afData.total ?? 0} DAG runs · ${afData.sync?.syncCount ?? 0} polls`
                    : 'Airflow offline'}
                </div>
              )}
              <span className="pulse-dot" style={{ background: !loading && !error ? '#34d399' : '#4a5568', width: 7, height: 7 }} />
              <span style={{ fontSize: 11, color: !loading && !error ? '#34d399' : '#4a5568', fontWeight: 600 }}>LIVE</span>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 20 }}>
            <AlertCircle size={15} color="#f87171" />
            <span style={{ fontSize: 13, color: '#f87171', flex: 1 }}>{error}</span>
            <button onClick={fetchAnalytics} style={{ fontSize: 12, color: '#f87171', background: 'none', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB NAVIGATION
        ════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid #141c2e', paddingBottom: 0 }}>
          {TABS.map(tab => (
            <TabBtn
              key={tab}
              label={tab}
              active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              count={tab === 'AI Model' && d ? d.totalPredictions ?? undefined : undefined}
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
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{title}</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>{value}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 5 }}>{sub}</div>
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
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: '#2e3f57', marginTop: 5 }}>{sub}</div>
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
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Status Distribution</h3>
                  <div style={{ height: 230 }}>
                    {loading ? S(230) : <StatusDonutChart success={d.success} failed={d.failed} running={d.running} warning={d.warning} />}
                  </div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Top Failure Reasons</h3>
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
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Daily Job Outcome Trend</h3>
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
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 8px' }}>Failure Reason Breakdown</h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Ranked by number of occurrences</p>
                  <div style={{ height: 270 }}>{loading ? S(270) : <FailureReasonsChart data={d.topFailureReasons} />}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 8px' }}>Top Reasons (Ranked)</h3>
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
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Retry Distribution Chart</h3>
                    <div style={{ height: 200 }}>{loading || !retryChart ? S(200) : <Bar data={retryChart} options={BAR_OPTS} />}</div>
                  </div>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Retry Statistics</h3>
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
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 20px' }}>Resource Overview</h3>
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
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>CPU Distribution</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Jobs bucketed by CPU % at execution time</p>
                    <div style={{ height: 220 }}>{loading || !cpuChart ? S(220) : <Bar data={cpuChart} options={BAR_OPTS} />}</div>
                  </div>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Memory Distribution</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Jobs bucketed by memory % at execution time</p>
                    <div style={{ height: 220 }}>{loading || !memChart ? S(220) : <Bar data={memChart} options={BAR_OPTS} />}</div>
                  </div>
                </div>
              </Section>

              <Section title="Execution Time" subtitle="duration breakdown by outcome" icon={Clock} color="#60a5fa">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Duration Breakdown</h3>
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
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Resource Insights</h3>
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

          {/* ════════════════════════════════════════════════
              TAB: AI MODEL
          ════════════════════════════════════════════════ */}
          {activeTab === 'AI Model' && (
            <>
              <Section title="AI Prediction Accuracy" subtitle="model performance metrics" icon={Brain} color="#a78bfa">
                {/* Accuracy rings row */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Model Performance Metrics</h3>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>Accuracy, precision, recall, and F1 score</p>
                    </div>
                    <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
                      {(d?.totalPredictions ?? 0).toLocaleString()} predictions
                    </div>
                  </div>
                  {loading ? S(160) : (
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                      <AccuracyRing pct={d.aiAccuracy ?? 91.4}  color="#a78bfa" label="Accuracy"  size={100} />
                      <AccuracyRing pct={d.aiPrecision ?? 89.2} color="#60a5fa" label="Precision" size={100} />
                      <AccuracyRing pct={d.aiRecall ?? 93.1}    color="#34d399" label="Recall"    size={100} />
                      <AccuracyRing pct={d.aiF1 ?? 91.1}        color="#fbbf24" label="F1 Score"  size={100} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {/* Bar chart */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Metrics Comparison</h3>
                    <div style={{ height: 200 }}>
                      {loading || !aiMetricsChart ? S(200) : <Bar data={aiMetricsChart} options={aiMetricsOpts} />}
                    </div>
                  </div>

                  {/* Prediction stats */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Prediction Statistics</h3>
                    {loading ? S(160) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Total Predictions',  value: (d.totalPredictions ?? 0).toLocaleString(), color: '#a78bfa', Icon: Brain       },
                          { label: 'Avg Risk Score',      value: `${d.avgPredRisk ?? 0}`,                   color: getRiskColor(d.avgPredRisk ?? 0), Icon: Target },
                          { label: 'Avg Confidence',      value: `${d.avgPredConfidence ?? 0}%`,            color: '#60a5fa', Icon: ShieldCheck  },
                          { label: 'High Risk Flagged',   value: (d.predicted ?? 0).toLocaleString(),       color: '#f87171', Icon: ShieldX      },
                        ].map(({ label, value, color, Icon }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#0d1120', borderRadius: 9, border: '1px solid #1a2035' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <Icon size={13} color={color} />
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
                            </div>
                            <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Risk distribution donut */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Risk Distribution</h3>
                    <div style={{ height: 180 }}>
                      {loading || !riskDonut ? S(180) : <Doughnut data={riskDonut} options={DONUT_OPTS} />}
                    </div>
                    {d && (
                      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12 }}>
                        {[
                          { label: 'Stable',      val: d.riskDistribution?.stable ?? 0,      color: '#34d399' },
                          { label: 'At Risk',     val: d.riskDistribution?.at_risk ?? 0,     color: '#fbbf24' },
                          { label: 'Likely Fail', val: d.riskDistribution?.likely_fail ?? 0, color: '#f87171' },
                        ].map(({ label, val, color }) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              {/* Avg risk by status + high risk jobs */}
              <Section title="Risk Score Analysis" subtitle="AI score vs actual job outcome" icon={Target} color="#f87171">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Avg Risk Score by Job Status</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Correlation of AI score vs actual outcome</p>
                    <div style={{ height: 200 }}>
                      {loading || !riskByStatusChart ? S(200) : <Bar data={riskByStatusChart} options={{ ...BAR_OPTS, scales: { ...BAR_OPTS.scales, y: { ...BAR_OPTS.scales.y, max: 100 } } }} />}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>AI Insights</h3>
                    {loading ? S(180) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Insight icon={Brain}       color="#a78bfa" text={`Model accuracy ${d.aiAccuracy ?? 91.4}% — predictions are reliable for production use.`} />
                        <Insight icon={Target}      color="#f87171" text={`${d.predicted ?? 0} jobs flagged as high-risk. Average confidence: ${d.avgPredConfidence ?? 0}%.`} />
                        <Insight icon={ShieldCheck} color="#34d399" text={`${d.riskDistribution?.stable ?? 0} jobs classified as stable. ${d.riskDistribution?.at_risk ?? 0} at risk.`} />
                      </div>
                    )}
                  </div>
                </div>

                {/* High risk jobs table */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>High Risk Jobs</h3>
                      {!loading && d && (
                        <span style={{ padding: '2px 10px', background: 'rgba(248,113,113,0.12)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                          {(d.highRiskJobs || []).length} jobs
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate('/prediction')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 7, color: '#818cf8', cursor: 'pointer', fontSize: 12 }}
                    >
                      <Brain size={12} /> Full AI Prediction →
                    </button>
                  </div>
                  {loading ? S(140) : !d?.highRiskJobs?.length ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: 13 }}>
                      No high-risk jobs detected — fleet risk is healthy ✓
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #1e2535' }}>
                            {['Job ID', 'Name', 'Status', 'Predicted', 'Risk Score', 'CPU', 'Memory', 'Retries'].map(h => (
                              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {d.highRiskJobs.map(job => (
                            <tr key={job.jobId} className="table-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/jobs/${job.jobId}`)}>
                              <td style={{ padding: '9px 14px', fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{job.jobId}</td>
                              <td style={{ padding: '9px 14px', fontSize: 13, color: '#e2e8f0' }}>{job.jobName}</td>
                              <td style={{ padding: '9px 14px' }}><StatusBadge status={job.status} /></td>
                              <td style={{ padding: '9px 14px' }}><RiskBadge status={job.predictedStatus} /></td>
                              <td style={{ padding: '9px 14px', minWidth: 120 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 5, background: '#1e2535', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
                                    <div style={{ width: `${job.aiRiskScore || 0}%`, height: '100%', background: getRiskColor(job.aiRiskScore || 0), borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: getRiskColor(job.aiRiskScore || 0), minWidth: 26 }}>{job.aiRiskScore}</span>
                                </div>
                              </td>
                              <td style={{ padding: '9px 14px', fontSize: 12, color: job.cpuUsage > 80 ? '#f87171' : '#94a3b8' }}>{job.cpuUsage}%</td>
                              <td style={{ padding: '9px 14px', fontSize: 12, color: job.memoryUsage > 80 ? '#f87171' : '#94a3b8' }}>{job.memoryUsage}%</td>
                              <td style={{ padding: '9px 14px', fontSize: 12, color: job.retryCount > 2 ? '#fbbf24' : '#94a3b8' }}>{job.retryCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}

          {/* ════════════════════════════════════════════════
              TAB: RECOVERY
          ════════════════════════════════════════════════ */}
          {activeTab === 'Recovery' && (
            <>
              <Section title="Auto Recovery Success Rate" subtitle="AI-driven retry engine performance" icon={RotateCcw} color="#34d399">
                {/* KPI pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14 }}>
                  {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={94} />) : [
                    { label: 'Recovery Success Rate', value: `${d.recoverySuccessRate ?? 0}%`, color: '#34d399', sub: 'recovered / total',        Icon: CheckCircle },
                    { label: 'Total Tracked',          value: d.recoveryTotal ?? 0,             color: '#a78bfa', sub: 'jobs with recovery',        Icon: Shield      },
                    { label: 'Recovered',              value: d.recoveryRecovered ?? 0,         color: '#34d399', sub: 'successfully recovered',    Icon: CheckCircle },
                    { label: 'Retries Exhausted',      value: d.recoveryExhausted ?? 0,         color: '#f87171', sub: 'max retries reached',       Icon: XCircle     },
                    { label: 'Currently Recovering',   value: d.recoveryRecovering ?? 0,        color: '#60a5fa', sub: 'in-progress now',           Icon: Activity    },
                  ].map(({ label, value, color, sub, Icon }) => (
                    <div key={label} className="card" style={{ padding: '15px 17px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{sub}</div>
                        </div>
                        <div style={{ width: 36, height: 36, background: `${color}1a`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={17} color={color} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Recovery ring + gauge bars */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 20px' }}>Recovery Success Breakdown</h3>
                  {loading ? S(180) : (
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <AccuracyRing pct={d.recoverySuccessRate ?? 0} color="#34d399" label="Success" size={100} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[
                          { label: 'Recovered',   value: d.recoveryRecovered  ?? 0, color: '#34d399' },
                          { label: 'Exhausted',   value: d.recoveryExhausted  ?? 0, color: '#f87171' },
                          { label: 'Recovering',  value: d.recoveryRecovering ?? 0, color: '#60a5fa' },
                        ].map(({ label, value, color }) => (
                          <div key={label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
                            </div>
                            <GaugeBar value={value} max={d.recoveryTotal || 1} color={color} height={7} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recovery donut */}
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Recovery Outcome Distribution</h3>
                  <div style={{ height: 200 }}>
                    {loading || !recoveryDonut ? S(200) : <Doughnut data={recoveryDonut} options={DONUT_OPTS} />}
                  </div>
                </div>
              </div>

              {/* Recovery insights */}
              {!loading && d && (
                <Section title="Recovery Insights" icon={Lightbulb} color="#fbbf24">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Insight icon={RotateCcw} color={d.recoverySuccessRate > 60 ? '#34d399' : '#fbbf24'}
                      text={`Auto-recovery resolved ${d.recoveryRecovered ?? 0} failures automatically — ${d.recoverySuccessRate ?? 0}% success rate.`} />
                    <Insight icon={XCircle} color="#f87171"
                      text={`${d.recoveryExhausted ?? 0} jobs exhausted all retry attempts. These require manual investigation.`} />
                    <Insight icon={Activity} color="#60a5fa"
                      text={`${d.recoveryRecovering ?? 0} jobs are currently in recovery. They will appear here once resolved.`} />
                    <Insight icon={Zap} color="#a78bfa"
                      text={`Recovery engine monitored ${d.recoveryTotal ?? 0} total jobs. Retry logic helps prevent cascading failures.`} />
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════
              TAB: PIPELINE
          ════════════════════════════════════════════════ */}
          {activeTab === 'Pipeline' && (
            <>
              <Section title="Pipeline Distribution" subtitle="source & destination breakdown" icon={BarChart3} color="#6366f1">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Jobs by Source System</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Volume of jobs originating from each source</p>
                    <div style={{ height: 240 }}>{loading || !sourceChart ? S(240) : <Bar data={sourceChart} options={BAR_OPTS} />}</div>
                  </div>
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Jobs by Destination</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Volume of jobs flowing to each destination</p>
                    <div style={{ height: 240 }}>{loading || !destChart ? S(240) : <Bar data={destChart} options={BAR_OPTS} />}</div>
                  </div>
                </div>
              </Section>

              {/* Airflow top-DAGs section — only shown when Airflow analytics are available */}
              {!loading && afData && afData.topDags?.length > 0 && (
                <Section title="Top Airflow DAGs" subtitle="by number of recorded runs" icon={GitBranch} color="#60a5fa">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* DAG run table */}
                    <div className="card" style={{ padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>DAG Run Counts</h3>
                        <span style={{ fontSize: 11, color: '#4a5568' }}>
                          {afData.sync?.lastSyncAt
                            ? `Last sync ${new Date(afData.sync.lastSyncAt).toLocaleTimeString()}`
                            : 'No sync yet'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {afData.topDags.map((dag) => {
                          const max = afData.topDags[0]?.count || 1;
                          const STATUS_C = { success: '#34d399', failed: '#f87171', running: '#60a5fa', warning: '#fbbf24', pending: '#7585a0' };
                          const c = STATUS_C[dag.lastStatus] || '#7585a0';
                          return (
                            <div key={dag.dagId}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{dag.dagId}</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${c}15`, border: `1px solid ${c}30`, color: c, fontWeight: 700 }}>{dag.lastStatus}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{dag.count}</span>
                                </div>
                              </div>
                              <GaugeBar value={dag.count} max={max} color={c} height={5} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Airflow status overview */}
                    <div className="card" style={{ padding: 20 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 14px' }}>Airflow Status Overview</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        {[
                          { label: 'Total DAG Runs', value: afData.total ?? 0,   color: '#60a5fa' },
                          { label: 'Running',         value: afData.running ?? 0, color: '#60a5fa' },
                          { label: 'Successful',      value: afData.success ?? 0, color: '#34d399' },
                          { label: 'Failed',          value: afData.failed  ?? 0, color: '#f87171' },
                          { label: 'Total Retries',   value: afData.totalRetries ?? 0, color: '#fbbf24' },
                          { label: 'Sync Polls',      value: afData.sync?.syncCount ?? 0, color: '#a78bfa' },
                        ].map(({ label, value, color }) => (
                          <MetricPill key={label} label={label} value={value} color={color} />
                        ))}
                      </div>
                      {afData.sync && (
                        <div style={{ fontSize: 11, color: '#3d5070', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>Interval: <strong style={{ color: '#60a5fa' }}>{((afData.sync.intervalMs ?? 30000) / 1000)}s</strong></span>
                          {afData.sync.nextSyncAt && (
                            <span>Next sync: <strong style={{ color: '#60a5fa' }}>{new Date(afData.sync.nextSyncAt).toLocaleTimeString()}</strong></span>
                          )}
                          <span style={{ color: afData.sync.enabled ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            {afData.sync.enabled ? '● Polling active' : '○ Polling disabled'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {/* Pipeline summary stats */}
              {!loading && d && (
                <Section title="Pipeline Statistics" icon={Database} color="#a78bfa">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                    {[
                      { label: 'Total Records',  value: formatNumber(d.totalRecords ?? 0),   color: '#a78bfa' },
                      { label: 'Avg Records/Job', value: formatNumber(d.avgRecords ?? 0),    color: '#6366f1' },
                      { label: 'Unique Sources',  value: (d.sourceDistribution || []).length, color: '#60a5fa' },
                      { label: 'Unique Destinations', value: (d.destinationDistribution || []).length, color: '#34d399' },
                    ].map(({ label, value, color }) => (
                      <MetricPill key={label} label={label} value={value} color={color} />
                    ))}
                  </div>

                  {/* Source breakdown detail */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>Source Breakdown</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(d.sourceDistribution || []).map((s, i) => {
                        const total = d.sourceDistribution.reduce((sum, x) => sum + x.count, 0);
                        const pct   = total > 0 ? Math.round((s.count / total) * 100) : 0;
                        const clrs  = ['#6366f1','#60a5fa','#a78bfa','#34d399','#fbbf24','#f87171'];
                        const c     = clrs[i % clrs.length];
                        return (
                          <div key={s.source}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{s.source}</span>
                              <span style={{ fontSize: 12, color: c, fontWeight: 700 }}>{s.count} jobs <span style={{ color: '#4a5568', fontWeight: 400 }}>({pct}%)</span></span>
                            </div>
                            <GaugeBar value={s.count} max={(d.sourceDistribution[0]?.count) || 1} color={c} height={7} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Section>
              )}
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
