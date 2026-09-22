import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import StatusBadge from '../components/ui/StatusBadge';
import RiskScore from '../components/ui/RiskScore';
import Skeleton from '../components/ui/Skeleton';
import api from '../utils/api';
import { formatDuration, formatDate, formatNumber, getRiskColor } from '../utils/helpers';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Cpu, HardDrive, Clock, Database, RotateCcw, Zap, Search, FileX, Wifi, Lock, Activity, RefreshCcw, History, Brain, ShieldX, ShieldAlert, ShieldCheck, TrendingUp, GitBranch, CheckCircle2, XCircle, Loader2, SkipForward, HelpCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';

/* ── task state helpers (mirrors Monitoring page) ───────────────────── */
const TASK_COLOR = {
  success: '#16a34a', failed: '#dc2626', running: '#2563eb',
  pending: '#64748b', warning: '#d97706', retrying: '#ea580c',
  skipped: '#475569', unknown: '#64748b',
};
const TASK_ICON = {
  success: CheckCircle2, failed: XCircle, running: Loader2,
  pending: Clock, warning: AlertTriangle, retrying: RotateCcw,
  skipped: SkipForward, unknown: HelpCircle,
};

/** Compact horizontal task pipeline strip for Airflow DAG runs */
function TaskPipelineStrip({ tasks }) {
  if (!tasks || tasks.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {tasks.map((t, i) => {
        const color = TASK_COLOR[t.state] || TASK_COLOR.unknown;
        const Icon  = TASK_ICON[t.state]  || HelpCircle;
        const spin  = t.state === 'running';
        return (
          <div key={`${t.taskId}-${i}`}
            title={`Task: ${t.taskId}\nState: ${t.state}\nTry: ${t.tryNumber}\nDuration: ${t.duration != null ? t.duration + 's' : '—'}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 10px', borderRadius: 6, minWidth: 88,
              background: `${color}10`, border: `1px solid ${color}25`, cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <Icon size={10} color={color} strokeWidth={2.2}
                style={spin ? { animation: 'spin 1.2s linear infinite' } : undefined} />
              <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.03em' }}>
                {t.state?.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 9.5, color: '#475569', textAlign: 'center', wordBreak: 'break-all', maxWidth: 90 }}>
              {t.taskId}
            </div>
            {t.tryNumber > 1 && (
              <div style={{ fontSize: 9, color: '#ea580c', marginTop: 2 }}>retry #{t.tryNumber - 1}</div>
            )}
            {t.duration != null && (
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>{t.duration}s</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── RCA category icon map ──────────────────────────────────────────────── */
const CAT_ICONS = {
  database_connection: Database,
  timeout:             Clock,
  memory_issue:        HardDrive,
  missing_file:        FileX,
  schema_mismatch:     Search,
  network_error:       Wifi,
  permission_denied:   Lock,
};

/* ── prediction status metadata ─────────────────────────────────────────── */
const PRED_STATUS = {
  likely_fail: { color: '#dc2626', bg: '#ffe4e6', border: '#fecdd3', label: 'Likely Fail', statusLabel: 'Failed',  Icon: ShieldX    },
  at_risk:     { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'At Risk',     statusLabel: 'Warning', Icon: ShieldAlert },
  stable:      { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: 'Stable',      statusLabel: 'Success', Icon: ShieldCheck },
};

/* ── confidence SVG ring ────────────────────────────────────────────────── */
function ConfidenceRing({ pct, color }) {
  const r = 36, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  return (
    <svg width={88} height={88} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={cx} y={cy - 3}  textAnchor="middle" fill={color}   fontSize={14} fontWeight={700}>{pct}%</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="#64748b" fontSize={9}>confidence</text>
    </svg>
  );
}

/* ── feature contribution bar ───────────────────────────────────────────── */
function FeatureBar({ label, value, points, max, color }) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#475569' }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>{value}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{points}/{max}</span>
        </div>
      </div>
      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

/* ── job descriptions dictionary ───────────────────────────────────────── */
const JOB_DESCRIPTIONS = {
  'Customer Data Sync': 'Synchronizes customer profiles and metadata across operational databases to ensure unified user identity and up-to-date CRM records.',
  'Sales Pipeline ETL': 'Extracts daily transaction data, cleanses sales metrics, and loads into the warehouse to power real-time sales reporting and executive dashboards.',
  'Inventory Aggregation': 'Consolidates hourly stock movements and warehouse inventory counts to prevent stockouts and inform automated reordering.',
  'Log Ingestion': 'Ingests raw system logs and application telemetry into central log storage for real-time error tracking and audit compliance.',
  'User Events Pipeline': 'Streams live user interaction events to analytics storage to power behavioral analytics, journey tracking, and recommendation engines.',
  'Financial Reports ETL': 'Aggregates end-of-day ledger entries and revenue balances to ensure audit compliance and accurate financial statements.',
  'Product Catalog Sync': 'Syncs product catalog definitions, pricing, and inventory availability across storefronts to keep checkout details consistent.',
  'Order Processing': 'Extracts completed orders, calculates totals, and dispatches records to fulfillment services for prompt delivery and billing.',
  'Analytics Warehouse Load': 'Transforms raw operational records and loads facts and dimensions into the data warehouse for cross-department reporting.',
  'ML Feature Pipeline': 'Computes machine learning feature sets from pipeline telemetry to train failure prediction and anomaly detection models.',
  'Compliance Data Export': 'Generates encrypted data exports for regulatory audits to enforce data privacy policies and compliance standards.',
  'Real-time CDC': 'Captures change-data-capture logs from source databases in real time to maintain low-latency analytics replicas.',
  'Inventory Stream ETL': 'Streams live inventory adjustments and warehouse stock counts to prevent overselling and support automated replenishment.',
  'Financial Reconciliation': 'Reconciles payment gateway receipts against accounting ledgers to identify discrepancies and prevent revenue leakage.',
  'Customer 360 Sync': 'Consolidates customer activity across sales, support, and web telemetry into a unified 360-degree profile for analytics.',
  'User Behavior Logs': 'Ingests and structures user activity logs to enable product engagement analytics and behavioral segmentation.',
  'Sales Analytics ETL': 'Aggregates regional sales figures and order totals to feed real-time sales performance dashboards.',
};

function getJobDescription(job) {
  if (!job) return '';
  if (job.description) return job.description;
  if (JOB_DESCRIPTIONS[job.jobName]) return JOB_DESCRIPTIONS[job.jobName];

  const name = (job.jobName || '').toLowerCase();
  if (name.includes('sales')) return 'Extracts and aggregates sales transaction metrics to feed reporting dashboards and revenue analytics.';
  if (name.includes('inventory') || name.includes('stock')) return 'Consolidates warehouse inventory counts and stock updates to maintain accurate supply chain records.';
  if (name.includes('financial') || name.includes('reconcil')) return 'Reconciles transaction ledgers and financial records to verify billing accuracy and audit compliance.';
  if (name.includes('customer') || name.includes('user')) return 'Synchronizes user profiles and activity logs across data stores to maintain updated customer intelligence.';
  if (name.includes('log') || name.includes('event')) return 'Ingests and structures system telemetry logs for performance monitoring and error tracking.';

  return `Processes and transforms data records from ${job.source || 'source'} to ${job.destination || 'destination'} to ensure data freshness and pipeline accuracy.`;
}

/* ── Data Freshness Card Component ───────────────────────────────────── */
function DataFreshnessCard({ job }) {
  if (!job) return null;
  const lastSyncDate = job.endTime || job.lastHeartbeat || job.startTime;
  const minutesAgo = lastSyncDate ? Math.max(0, Math.floor((new Date() - new Date(lastSyncDate)) / 60000)) : null;

  let freshStatus = { label: 'Unknown', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
  if (job.status === 'running') {
    freshStatus = { label: 'Syncing Live', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' };
  } else if (job.status === 'failed') {
    freshStatus = { label: 'Out of Sync (Failed)', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
  } else if (minutesAgo !== null) {
    if (minutesAgo < 60) {
      freshStatus = { label: `Fresh (${minutesAgo === 0 ? 'just now' : minutesAgo + 'm ago'})`, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
    } else if (minutesAgo < 360) {
      const hrs = Math.floor(minutesAgo / 60);
      freshStatus = { label: `Moderate (${hrs}h ago)`, color: '#d97706', bg: 'rgba(217,119,6,0.1)' };
    } else {
      const hrs = Math.floor(minutesAgo / 60);
      freshStatus = { label: `Stale (${hrs}h ago)`, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
    }
  }

  return (
    <div className="card" style={{
      padding: 16,
      borderLeft: '4px solid #DDA0DD',
      background: 'var(--bg-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={15} color="#DDA0DD" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#DDA0DD', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Data Freshness
          </span>
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: freshStatus.color,
          background: freshStatus.bg,
          padding: '3px 9px',
          borderRadius: 12,
          border: `1px solid ${freshStatus.color}30`
        }}>
          {freshStatus.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, fontSize: 12 }}>
        <div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Last Sync Time</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{lastSyncDate ? formatDate(lastSyncDate) : '—'}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Pipeline Target</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{job.source} → {job.destination}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Records Processed</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatNumber(job.recordsProcessed)}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Execution Timeline Card Component ───────────────────────────────── */
function ExecutionTimelineCard({ job }) {
  if (!job) return null;

  const nodes = [];

  if (job.startTime) {
    nodes.push({
      label: 'Pipeline Started',
      time: formatDate(job.startTime),
      detail: job.runType ? `Run type: ${job.runType}` : 'Execution initiated',
      status: 'completed',
    });
  }

  if (job.tasks && job.tasks.length > 0) {
    job.tasks.forEach((t) => {
      nodes.push({
        label: t.taskId,
        time: t.startDate ? formatDate(t.startDate) : (t.duration != null ? `${t.duration}s` : ''),
        detail: `State: ${t.state} (try #${t.tryNumber})`,
        status: t.state === 'success' ? 'completed' : t.state === 'failed' ? 'failed' : t.state === 'running' ? 'in_progress' : 'pending',
      });
    });
  } else if (job.logs && job.logs.length > 0) {
    const keyLogs = job.logs.filter(l => l.level === 'ERROR' || l.level === 'WARN' || l.message.toLowerCase().includes('start') || l.message.toLowerCase().includes('complete') || l.message.toLowerCase().includes('finish')).slice(0, 3);
    const logsToUse = keyLogs.length > 0 ? keyLogs : job.logs.slice(0, 3);
    logsToUse.forEach((l) => {
      nodes.push({
        label: l.message,
        time: new Date(l.timestamp).toLocaleTimeString(),
        detail: `Log level: ${l.level}`,
        status: l.level === 'ERROR' ? 'failed' : l.level === 'WARN' ? 'warning' : 'completed',
      });
    });
  } else {
    nodes.push({
      label: `Extract (${job.source})`,
      time: job.startTime ? formatDate(job.startTime) : '',
      detail: 'Data extraction from source',
      status: 'completed',
    });
    nodes.push({
      label: 'Transform',
      time: job.duration ? `${Math.round(job.duration * 0.4)}s` : '',
      detail: `Processed ${formatNumber(job.recordsProcessed)} records`,
      status: job.status === 'failed' ? 'failed' : job.status === 'running' ? 'in_progress' : 'completed',
    });
    nodes.push({
      label: `Load (${job.destination})`,
      time: job.endTime ? formatDate(job.endTime) : '',
      detail: 'Data load into warehouse',
      status: job.status === 'success' ? 'completed' : job.status === 'failed' ? 'failed' : job.status === 'running' ? 'in_progress' : 'pending',
    });
  }

  if (job.endTime) {
    nodes.push({
      label: job.status === 'success' ? 'Pipeline Completed' : job.status === 'failed' ? 'Pipeline Failed' : 'Pipeline Ended',
      time: formatDate(job.endTime),
      detail: `Total Duration: ${formatDuration(job.duration)}`,
      status: job.status === 'success' ? 'completed' : job.status === 'failed' ? 'failed' : 'completed',
    });
  } else if (job.status === 'running') {
    nodes.push({
      label: 'Execution in Progress',
      time: 'Now',
      detail: 'Processing continuous stream',
      status: 'in_progress',
    });
  }

  const getNodeColor = (status) => {
    switch (status) {
      case 'completed': return '#16a34a';
      case 'failed': return '#dc2626';
      case 'warning': return '#d97706';
      case 'in_progress': return '#2563eb';
      default: return '#64748b';
    }
  };

  return (
    <div className="card" style={{
      padding: 16,
      borderLeft: '4px solid #DDA0DD',
      background: 'var(--bg-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={15} color="#DDA0DD" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#DDA0DD', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Execution Timeline
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', paddingLeft: 16 }}>
        <div style={{
          position: 'absolute',
          left: 5,
          top: 6,
          bottom: 6,
          width: 2,
          background: 'rgba(221, 160, 221, 0.25)',
          borderRadius: 1
        }} />

        {nodes.map((node, i) => {
          const color = getNodeColor(node.status);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: -16,
                top: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                border: '2px solid var(--bg-subtle)',
                boxShadow: `0 0 0 2px ${color}30`
              }} />

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                  {node.label}
                </div>
                {node.detail && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                    {node.detail}
                  </div>
                )}
              </div>

              {node.time && (
                <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {node.time}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [rca, setRca]             = useState(null);
  const [rcaLoading, setRcaLoading]     = useState(false);
  const [rcaAnalysing, setRcaAnalysing] = useState(false);
  const [recovery, setRecovery]         = useState(null);
  const [recoveryLoading, setRecoveryLoading]   = useState(false);
  const [triggeringRecovery, setTriggeringRecovery] = useState(false);

  /* ── AI Prediction state ─── */
  const [prediction, setPrediction]           = useState(null);
  const [predLoading, setPredLoading]         = useState(false);
  const [predictionHistory, setPredHistory]   = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  const fetchJob = async () => {
    try {
      const { data } = await api.get(`/jobs/${id}`);
      setJob(data);
    } catch { toast.error('Job not found'); navigate('/jobs'); }
    finally { setLoading(false); }
  };

  const fetchRca = async () => {
    setRcaLoading(true);
    try {
      const { data } = await api.get(`/rca/${id}`);
      setRca(data);
    } catch { toast.error('RCA not available'); }
    finally { setRcaLoading(false); }
  };

  const handleReanalyse = async () => {
    setRcaAnalysing(true);
    try {
      const { data } = await api.post(`/rca/${id}/analyse`);
      setRca(data);
      toast.success('Root cause re-analysed');
    } catch { toast.error('Re-analysis failed'); }
    finally { setRcaAnalysing(false); }
  };

  const fetchRecovery = async () => {
    setRecoveryLoading(true);
    try {
      const { data } = await api.get(`/recovery/${id}`);
      setRecovery(data);
    } catch { /* silent — recovery may not exist yet */ }
    finally { setRecoveryLoading(false); }
  };

  const handleTriggerRecovery = async () => {
    setTriggeringRecovery(true);
    try {
      await api.post(`/recovery/${id}/trigger`);
      toast.success('Auto-recovery triggered');
      setTimeout(fetchRecovery, 3000);
      setTimeout(fetchRecovery, 8000);
      setTimeout(fetchJob,     10000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not trigger recovery');
    } finally { setTriggeringRecovery(false); }
  };

  /* ── fetch AI prediction for this job ── */
  const fetchPrediction = async (silent = false) => {
    if (!silent) setPredLoading(true);
    try {
      const { data } = await api.get(`/predict/${id}`);
      setPrediction(data);
      if (!silent) toast.success('AI prediction updated');
    } catch { if (!silent) toast.error('Prediction failed'); }
    finally { if (!silent) setPredLoading(false); }
  };

  /* ── fetch prediction history for this job ── */
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/predict/history?jobId=${id}&limit=10`);
      setPredHistory(data.predictions || []);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { fetchJob(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch RCA + recovery when ai-analysis tab opens for failed/warning jobs
  useEffect(() => {
    if (!job) return;
    if (activeTab === 'ai-analysis') {
      if ((job.status === 'failed' || job.status === 'warning') && !rca && !rcaLoading) fetchRca();
      if (!recovery && !recoveryLoading) fetchRecovery();
    }
    if (activeTab === 'ai-prediction' && !prediction) {
      fetchPrediction(true);
      fetchHistory();
    }
  }, [activeTab, job?.jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await api.post(`/jobs/${id}/retry`);
      toast.success('Auto-retry initiated!');
      setTimeout(fetchJob, 3500);
    } catch { toast.error('Retry failed'); }
    finally { setRetrying(false); }
  };

  const logLevelColor = { INFO: '#60a5fa', WARN: '#fbbf24', ERROR: '#f87171', DEBUG: '#94a3b8' };

  const tabs = ['overview', 'logs', 'ai-analysis', 'ai-prediction'];

  if (loading) return <Layout><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={80} />)}</div></Layout>;

  /* ── derive prediction metadata ── */
  const predMeta  = prediction ? (PRED_STATUS[prediction.predictedStatus] || PRED_STATUS.stable) : null;

  return (
    <Layout onRefresh={fetchJob}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/jobs')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{job.jobName}</h1>
              <StatusBadge status={job.status} />
              {job.status === 'failed' && <button onClick={handleRetry} disabled={retrying} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <RotateCcw size={14} /> {retrying ? 'Retrying...' : 'Auto Retry'}
              </button>}
            </div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{job.jobId} • {job.source} → {job.destination}</div>
          </div>
        </div>

        {/* ── Job Description Banner ── */}
        <div className="card" style={{
          padding: '12px 16px',
          borderLeft: '4px solid #DDA0DD',
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          borderRadius: '6px'
        }}>
          <Info size={16} color="#DDA0DD" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#DDA0DD', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Job Description
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
              {getJobDescription(job)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1e2535', paddingBottom: 0 }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: activeTab === tab ? '#6366f1' : '#64748b', borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent', fontWeight: activeTab === tab ? 600 : 400 }}>
              {tab === 'ai-analysis' ? 'AI Analysis' : tab === 'ai-prediction' ? 'AI Prediction' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { icon: Clock, label: 'Start Time', value: formatDate(job.startTime), color: '#6366f1' },
                { icon: Clock, label: 'End Time', value: formatDate(job.endTime), color: '#6366f1' },
                { icon: Clock, label: 'Duration', value: formatDuration(job.duration), color: '#60a5fa' },
                { icon: Cpu, label: 'CPU Usage', value: `${job.cpuUsage}%`, color: job.cpuUsage > 80 ? '#f87171' : '#34d399' },
                { icon: HardDrive, label: 'Memory', value: `${job.memoryUsage}%`, color: job.memoryUsage > 80 ? '#f87171' : '#34d399' },
                { icon: Database, label: 'Records', value: formatNumber(job.recordsProcessed), color: '#a78bfa' },
                { icon: RotateCcw, label: 'Retries', value: job.retryCount, color: job.retryCount > 0 ? '#fbbf24' : '#64748b' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icon size={14} color={color} />
                    <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* ── Data Freshness & Execution Timeline ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <DataFreshnessCard job={job} />
              <ExecutionTimelineCard job={job} />
            </div>

            {/* ── Airflow DAG metadata + task pipeline ── */}
            {job.dagId && (
              <div className="card" style={{ padding: 16, borderLeft: '3px solid rgba(96,165,250,0.45)' }}>
                {/* DAG metadata row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <GitBranch size={14} color="#60a5fa" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>Airflow DAG Run</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 12, color: '#3d5070', marginBottom: job.tasks?.length ? 14 : 0 }}>
                  <span>DAG: <strong style={{ color: '#8eb4d8' }}>{job.dagId}</strong></span>
                  {job.dagRunId && <span style={{ fontFamily: 'monospace', fontSize: 11 }}>Run: <strong style={{ color: '#8eb4d8' }}>{job.dagRunId}</strong></span>}
                  {job.runType && <span>Type: <strong style={{ color: '#8eb4d8' }}>{job.runType}</strong></span>}
                  {job.executionDate && <span>Execution: <strong style={{ color: '#8eb4d8' }}>{formatDate(job.executionDate)}</strong></span>}
                  {job.externalTrigger && <span style={{ color: '#a78bfa', fontWeight: 700 }}>● Manual trigger</span>}
                </div>

                {/* Task pipeline strip */}
                {job.tasks?.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#2e4060', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      Task Pipeline · {job.tasks.length} task{job.tasks.length !== 1 ? 's' : ''}
                    </div>
                    <TaskPipelineStrip tasks={job.tasks} />
                  </>
                )}
              </div>
            )}

            {/* Failure Reason */}
            {job.failureReason && (
              <div className="card" style={{ padding: 16, borderLeft: '3px solid #f87171' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <AlertTriangle size={16} color="#f87171" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f87171' }}>Failure Reason</span>
                </div>
                <p style={{ color: '#e2e8f0', margin: 0, fontSize: 14 }}>{job.failureReason}</p>
              </div>
            )}

            {/* Recovery Actions */}
            {job.recoveryActions?.length > 0 && (
              <div className="card" style={{ padding: 16, borderLeft: '3px solid #34d399' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckCircle size={16} color="#34d399" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#34d399' }}>Recovery Actions</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {job.recoveryActions.map((action, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(52,211,153,0.05)', borderRadius: 6 }}>
                      <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: '#e2e8f0' }}>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2535', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>ETL Log Viewer</h3>
              <span style={{ fontSize: 12, color: '#64748b' }}>{job.logs?.length ?? 0} entries</span>
            </div>
            <div style={{ background: '#0a0d14', padding: 20, fontFamily: 'monospace', fontSize: 13, maxHeight: 500, overflowY: 'auto' }}>
              {job.logs?.length === 0 && <div style={{ color: '#64748b' }}>No logs available</div>}
              {job.logs?.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 8, lineHeight: 1.6 }}>
                  <span style={{ color: '#4a5568', whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: logLevelColor[log.level] || '#94a3b8', fontWeight: 700, minWidth: 40 }}>{log.level}</span>
                  <span style={{ color: '#e2e8f0' }}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Analysis tab (RCA + Recovery) ── */}
        {activeTab === 'ai-analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── AI Risk Assessment ── */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 16px' }}>AI Risk Assessment</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', border: `4px solid ${getRiskColor(job.aiRiskScore)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: getRiskColor(job.aiRiskScore) }}>{job.aiRiskScore}</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Risk</span>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: getRiskColor(job.aiRiskScore) }}>
                    {job.predictedStatus === 'likely_fail' ? 'High Risk' : job.predictedStatus === 'at_risk' ? 'Medium Risk' : 'Low Risk'}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Predicted: <span style={{ color: '#e2e8f0' }}>{job.predictedStatus?.replace('_', ' ')}</span></div>
                </div>
              </div>
              <RiskScore score={job.aiRiskScore} />
            </div>

            {/* ── Detected Anomalies ── */}
            {job.anomalies?.length > 0 && (
              <div className="card" style={{ padding: 20, borderLeft: '3px solid #fbbf24' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Zap size={16} color="#fbbf24" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24' }}>Detected Anomalies</span>
                </div>
                {job.anomalies.map((a, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(251,191,36,0.05)', borderRadius: 6, marginBottom: 6, fontSize: 13, color: '#e2e8f0' }}>⚠ {a}</div>
                ))}
              </div>
            )}

            {/* ── Root Cause Analysis ── */}
            {(job.status === 'failed' || job.status === 'warning') && (
              <div className="card" style={{ padding: 20, borderLeft: '3px solid #a78bfa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} color="#a78bfa" />
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#a78bfa' }}>Root Cause Analysis</span>
                  </div>
                  <button
                    onClick={handleReanalyse}
                    disabled={rcaAnalysing}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 12px' }}
                  >
                    <RefreshCcw size={13} />
                    {rcaAnalysing ? 'Analysing…' : 'Re-analyse'}
                  </button>
                </div>

                {(rcaLoading || rcaAnalysing) && !rca && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[80, 120, 60, 100, 90].map((w, i) => (
                      <div key={i} className="skeleton" style={{ height: 14, width: `${w}%`, borderRadius: 6 }} />
                    ))}
                  </div>
                )}

                {!rcaLoading && !rcaAnalysing && !rca && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: 13 }}>
                    No analysis available yet.{' '}
                    <button onClick={fetchRca} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                      Run now
                    </button>
                  </div>
                )}

                {rca && !rcaLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                      {(() => {
                        const CatIcon = CAT_ICONS[rca.categoryKey] || Activity;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 20 }}>
                            <CatIcon size={14} color="#a78bfa" />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>{rca.category}</span>
                          </div>
                        );
                      })()}
                      {rca.severityMeta && (
                        <div style={{ padding: '6px 14px', background: rca.severityMeta.bg, border: `1px solid ${rca.severityMeta.border}`, borderRadius: 20 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: rca.severityMeta.color }}>{rca.severity}</span>
                        </div>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Confidence</span>
                        <div style={{ position: 'relative', width: 100, height: 6, background: '#1e2535', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', inset: 0, width: `${rca.confidence}%`, background: rca.confidence >= 80 ? '#34d399' : rca.confidence >= 60 ? '#fbbf24' : '#f87171', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: rca.confidence >= 80 ? '#34d399' : rca.confidence >= 60 ? '#fbbf24' : '#f87171' }}>{rca.confidence}%</span>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, padding: '12px 16px', background: '#0f1117', borderRadius: 8, border: '1px solid #1e2535' }}>
                      {rca.description}
                    </p>
                    {rca.signals?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Evidence Signals</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {rca.signals.map((sig, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.12)', borderRadius: 6 }}>
                              <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginTop: 1 }}>#{i + 1}</span>
                              <span style={{ fontSize: 13, color: '#e2e8f0' }}>{sig}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {rca.solutions?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Recommended Solutions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {rca.solutions.map((sol, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.1)', borderRadius: 6 }}>
                              <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                              <span style={{ fontSize: 13, color: '#e2e8f0', paddingTop: 2 }}>{sol}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {rca.allScores && Object.keys(rca.allScores).length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Category Score Breakdown</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {Object.entries(rca.allScores)
                            .sort(([, a], [, b]) => b - a)
                            .map(([label, score]) => {
                              const isWinner = label === rca.category;
                              return (
                                <div key={label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 36px', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 12, color: isWinner ? '#a78bfa' : '#64748b', fontWeight: isWinner ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                                  <div style={{ height: 6, background: '#1e2535', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.max(score, 0)}%`, background: isWinner ? '#a78bfa' : '#4a5568', borderRadius: 3, transition: 'width 0.4s ease' }} />
                                  </div>
                                  <span style={{ fontSize: 12, color: isWinner ? '#a78bfa' : '#64748b', textAlign: 'right', fontWeight: isWinner ? 700 : 400 }}>{score}</span>
                                </div>
                              );
                            })}
                        </div>
                        {rca.analysedAt && (
                          <div style={{ marginTop: 12, fontSize: 11, color: '#475569', textAlign: 'right' }}>
                            Analysed {new Date(rca.analysedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Auto-Recovery card (shown on ai-analysis tab) ── */}
        {activeTab === 'ai-analysis' && (
          <div className="card" style={{ padding: 20, borderLeft: '3px solid #34d399' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCcw size={16} color="#34d399" />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#34d399' }}>Auto-Recovery</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={fetchRecovery} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px' }}>
                  <RefreshCw size={12} /> Refresh
                </button>
                {job.status === 'failed' && (
                  <button
                    onClick={handleTriggerRecovery}
                    disabled={triggeringRecovery || recovery?.status === 'recovering'}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 12px' }}
                  >
                    <RotateCcw size={12} />
                    {triggeringRecovery ? 'Triggering…' : recovery?.status === 'recovering' ? 'Recovering…' : 'Trigger Recovery'}
                  </button>
                )}
              </div>
            </div>

            {recoveryLoading && !recovery ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[60, 90, 70].map((w, i) => <div key={i} className="skeleton" style={{ height: 14, width: `${w}%`, borderRadius: 6 }} />)}
              </div>
            ) : !recovery || recovery.status === 'idle' ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: 13 }}>
                {job.status === 'failed'
                  ? 'No recovery active. Click "Trigger Recovery" to start auto-retry.'
                  : 'Auto-recovery is only available for failed jobs.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Status',   value: recovery.status === 'recovering' ? 'Recovering' : recovery.status === 'recovered' ? 'Recovered' : recovery.status === 'max_retries_reached' ? 'Exhausted' : recovery.status, color: recovery.status === 'recovered' ? '#34d399' : recovery.status === 'recovering' ? '#60a5fa' : '#f87171' },
                    { label: 'Attempts', value: `${recovery.totalAttempts ?? 0} / ${recovery.maxAttempts ?? 3}`, color: '#fbbf24' },
                    { label: 'Started',  value: recovery.startedAt  ? new Date(recovery.startedAt).toLocaleTimeString()  : '—', color: '#94a3b8' },
                    { label: 'Resolved', value: recovery.resolvedAt ? new Date(recovery.resolvedAt).toLocaleTimeString() : '—', color: '#94a3b8' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: '12px 14px', background: '#0f1117', borderRadius: 8, border: '1px solid #1e2535' }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                {recovery.history?.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <History size={13} color="#64748b" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attempt History</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {recovery.history.map((h, i) => {
                        const outcomeColor = h.outcome === 'success' ? '#34d399' : h.outcome === 'running' ? '#60a5fa' : '#f87171';
                        const outcomeBg   = h.outcome === 'success' ? 'rgba(52,211,153,0.06)' : h.outcome === 'running' ? 'rgba(96,165,250,0.06)' : 'rgba(248,113,113,0.06)';
                        const outcomeIcon = h.outcome === 'success' ? '✓' : h.outcome === 'running' ? '↻' : '✗';
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: outcomeBg, border: `1px solid ${outcomeColor}22`, borderRadius: 8 }}>
                            <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: `${outcomeColor}22`, color: outcomeColor, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{outcomeIcon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: outcomeColor }}>Attempt #{h.attempt}</span>
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                  {h.startedAt ? new Date(h.startedAt).toLocaleTimeString() : ''}
                                  {h.durationMs ? ` · ${(h.durationMs / 1000).toFixed(1)}s` : ''}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>{h.message}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            AI PREDICTION TAB — dedicated pre-execution risk panel
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'ai-prediction' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Header bar ── */}
            <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Brain size={18} color="#a78bfa" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>AI Failure Prediction</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Pre-execution risk scoring · CPU, memory, retry, duration, data volume, job history</div>
                </div>
              </div>
              <button
                onClick={() => fetchPrediction(false)}
                disabled={predLoading}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 14px' }}
              >
                <Brain size={14} />
                {predLoading ? 'Predicting…' : 'Re-run Prediction'}
              </button>
            </div>

            {/* ── Loading skeleton ── */}
            {predLoading && !prediction && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[100, 80, 90, 70].map((w, i) => <div key={i} className="skeleton" style={{ height: 18, width: `${w}%`, borderRadius: 6 }} />)}
              </div>
            )}

            {/* ── No prediction yet ── */}
            {!predLoading && !prediction && (
              <div className="card" style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <Brain size={44} color="#2d3748" />
                <div style={{ color: '#64748b', fontSize: 14 }}>No prediction run yet for this job</div>
                <button onClick={() => fetchPrediction(false)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <Brain size={14} /> Run Prediction
                </button>
              </div>
            )}

            {/* ── Prediction result card ── */}
            {prediction && !predLoading && (
              <>
                {/* ── Main result — risk + confidence + status ── */}
                <div className="card" style={{ padding: 20, borderLeft: `3px solid ${predMeta.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Prediction Result</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* Predicted Status badge */}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: predMeta.bg, color: predMeta.color, border: `1px solid ${predMeta.border}` }}>
                          <predMeta.Icon size={13} />
                          {predMeta.label}
                        </span>
                        {/* Human-readable status label — Success / Warning / Failed */}
                        <span style={{ fontSize: 18, fontWeight: 800, color: predMeta.color }}>{predMeta.statusLabel}</span>
                        {prediction.historyPenalty !== 0 && (
                          <span style={{ fontSize: 11, color: '#64748b', background: '#1e2535', borderRadius: 10, padding: '2px 8px' }}>
                            {prediction.historyPenalty > 0 ? `+${prediction.historyPenalty}` : prediction.historyPenalty} history adj.
                          </span>
                        )}
                      </div>
                    </div>
                    <ConfidenceRing pct={prediction.confidence} color={predMeta.color} />
                  </div>

                  {/* ── Risk Score bar (0–100) ── */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Risk Score</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: predMeta.color }}>{prediction.riskScore} <span style={{ fontSize: 13, fontWeight: 400, color: '#64748b' }}>/ 100</span></span>
                    </div>
                    <div style={{ height: 10, background: '#1e2535', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${prediction.riskScore}%`, height: '100%', background: `linear-gradient(90deg, ${predMeta.color}99, ${predMeta.color})`, borderRadius: 5, transition: 'width 0.6s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a5568', marginTop: 4 }}>
                      <span>0 — Safe</span>
                      <span>40 — At Risk</span>
                      <span>70 — Likely Fail</span>
                      <span>100</span>
                    </div>
                  </div>

                  {/* ── Recommended Action ── */}
                  {prediction.recommendedAction && (
                    <div style={{ padding: '12px 16px', background: '#0f1117', borderRadius: 8, borderLeft: `3px solid ${predMeta.color}` }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommended Action</div>
                      <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>{prediction.recommendedAction}</div>
                    </div>
                  )}
                </div>

                {/* ── Feature Contributions ── */}
                {prediction.features && (
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <TrendingUp size={15} color="#6366f1" />
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Feature Contributions</h3>
                      <span style={{ fontSize: 11, color: '#4a5568', marginLeft: 'auto' }}>contribution to risk score</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {Object.entries(prediction.features).map(([key, f]) => {
                        const col = f.points >= f.max * 0.75 ? '#f87171' : f.points >= f.max * 0.4 ? '#fbbf24' : '#34d399';
                        return <FeatureBar key={key} label={f.label} value={f.value} points={f.points} max={f.max} color={col} />;
                      })}
                    </div>
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e2535', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>Total feature score: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{Object.values(prediction.features).reduce((s, f) => s + f.points, 0)} pts</span></span>
                      <span>Max possible: 100 pts</span>
                    </div>
                  </div>
                )}

                {/* ── Root Cause ── */}
                {prediction.rootCause && (
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <AlertTriangle size={15} color="#fbbf24" />
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Root Cause Analysis</h3>
                    </div>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.7 }}>{prediction.rootCause}</p>
                  </div>
                )}

                {/* ── Recovery Actions ── */}
                {prediction.recoveryActions?.length > 0 && (
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <CheckCircle size={15} color="#34d399" />
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Recovery Actions</h3>
                    </div>
                    {prediction.recoveryActions.map((action, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < prediction.recoveryActions.length - 1 ? '1px solid #1e2535' : 'none' }}>
                        <span style={{ color: '#34d399', fontWeight: 700, fontSize: 13, minWidth: 16 }}>{i + 1}.</span>
                        <span style={{ fontSize: 13, color: '#e2e8f0' }}>{action}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Anomalies ── */}
                {prediction.anomalies?.length > 0 && (
                  <div className="card" style={{ padding: 20, borderLeft: '3px solid #fbbf24' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Zap size={15} color="#fbbf24" />
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24', margin: 0 }}>Anomalies Detected</h3>
                    </div>
                    {prediction.anomalies.map((a, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#e2e8f0', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={11} color="#fbbf24" /> {a}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Prediction meta ── */}
                <div style={{ fontSize: 11, color: '#4a5568', textAlign: 'right', paddingRight: 4 }}>
                  Model: {prediction.meta?.modelVersion ?? 'v2'} · Scored at {prediction.meta?.scoredAt ? new Date(prediction.meta.scoredAt).toLocaleString() : '—'}
                </div>
              </>
            )}

            {/* ── Prediction History ── */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <History size={15} color="#6366f1" />
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Prediction History</h3>
                  <span style={{ fontSize: 11, color: '#64748b' }}>stored in MongoDB</span>
                </div>
                <button onClick={fetchHistory} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#2d3748', border: '1px solid #4a5568', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer', fontSize: 11 }}>
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[100, 90, 80].map((w, i) => <div key={i} className="skeleton" style={{ height: 14, width: `${w}%`, borderRadius: 6 }} />)}
                </div>
              ) : predictionHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: 13 }}>
                  No stored predictions for this job yet — run a prediction to begin tracking.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {predictionHistory.map((p, i) => {
                    const m = PRED_STATUS[p.predictedStatus] || PRED_STATUS.stable;
                    return (
                      <div key={p._id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#0f1117', borderRadius: 8, border: '1px solid #1e2535' }}>
                        <m.Icon size={14} color={m.color} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.statusLabel}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>{p.source}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            CPU {p.cpuUsage}% · Mem {p.memoryUsage}% · Retries {p.retryCount}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{p.riskScore}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>risk</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>{p.confidence}%</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>conf.</div>
                        </div>
                        <div style={{ fontSize: 10, color: '#4a5568', flexShrink: 0, textAlign: 'right', minWidth: 70 }}>
                          {p.scoredAt ? new Date(p.scoredAt).toLocaleTimeString() : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
