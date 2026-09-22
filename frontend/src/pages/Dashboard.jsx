import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Skeleton from '../components/ui/Skeleton';
import StatusBadge from '../components/ui/StatusBadge';
import api, { airflow, monitoring } from '../utils/api';
import usePolling from '../hooks/usePolling';
import { formatDuration, formatNumber } from '../utils/helpers';
import {
  Briefcase, Activity, CheckCircle, XCircle,
  Bell, Clock, ArrowRight, Zap, TrendingUp,
  ChevronRight, Database, Cpu, GitBranch, ArrowDown,
  Play, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── colour maps ── */
const STATUS_COLOR = {
  success: '#16a34a', failed: '#dc2626', running: 'var(--primary)',
  warning: '#d97706', pending: '#64748b',
};
const ALERT_TYPE_COLOR = {
  failure: '#dc2626', warning: '#d97706', prediction: '#7c3aed', recovery: '#16a34a',
};
const SEV_COLOR = {
  critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a',
};

/** Interactive ETL Pipeline Simulator Controller */
function QuickEtlController({ onTriggered }) {
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();

  const handleRun = async (forceFailure = false) => {
    setRunning(true);
    try {
      await monitoring.spawnSimulatedJob(forceFailure);
      toast.success(forceFailure ? 'Spawned test failure job' : 'ETL Job spawned & running!');
      onTriggered?.();
    } catch {
      toast.error('Could not start ETL job');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card" style={{
      padding: '16px 20px',
      background: 'var(--primary-light)',
      border: '1px solid var(--primary)',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 8,
          background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--primary-text)', fontWeight: 800, flexShrink: 0
        }}>
          <Play size={20} fill="currentColor" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Interactive ETL Pipeline Simulator</span>
            <span style={{ fontSize: 10, background: 'var(--primary)', color: 'var(--primary-text)', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>LIVE</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Simulate a real-world 3-stage pipeline: <strong>EXTRACT</strong> (Source) ➔ <strong>TRANSFORM</strong> (Logic) ➔ <strong>LOAD</strong> (Warehouse)
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => handleRun(false)}
          disabled={running}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: 13, gap: 8 }}
        >
          <Play size={14} fill="currentColor" />
          <span>{running ? 'Starting...' : 'Run ETL Pipeline'}</span>
        </button>
        <button
          onClick={() => handleRun(true)}
          disabled={running}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: 12.5, gap: 6, borderColor: 'var(--error-border)', color: 'var(--error)' }}
        >
          <AlertTriangle size={13} color="var(--error)" />
          <span>Test Failure</span>
        </button>
        <button
          onClick={() => navigate('/monitoring')}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: 12.5, gap: 6 }}
        >
          <Activity size={13} color="var(--primary)" />
          <span>Live Monitor →</span>
        </button>
      </div>
    </div>
  );
}

/** Enterprise KPI panel */
function KpiPanel({ title, value, sub, icon: Icon, color, loading }) {
  if (loading) return <Skeleton height={90} />;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 3, background: color, flexShrink: 0 }} />
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{sub}</div>
          )}
        </div>
        <div style={{
          width: 36, height: 36, flexShrink: 0,
          background: `${color}15`,
          border: `1px solid ${color}30`,
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

/** Panel wrapper */
function Panel({ title, icon: Icon, iconColor = 'var(--primary)', action, children, style }) {
  return (
    <div className="card" style={{ overflow: 'hidden', ...style }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
          <Icon size={15} color={iconColor} strokeWidth={2} />
          <span>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  );
}

/** Health metric row */
function HealthMetric({ label, value, color }) {
  const pct = Math.min(100, value ?? 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Job table row */
function JobRow({ job, onClick }) {
  return (
    <tr className="table-row" style={{ cursor: 'pointer' }} onClick={onClick}>
      <td className="table-td" style={{ paddingLeft: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{job.jobName}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>{job.jobId}</div>
      </td>
      <td className="table-td"><StatusBadge status={job.status} /></td>
      <td className="table-td" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatDuration(job.duration)}</td>
      <td className="table-td" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatNumber(job.recordsProcessed)}</td>
    </tr>
  );
}

/** Alert feed item */
function AlertItem({ al }) {
  const typeClr = ALERT_TYPE_COLOR[al.type] || 'var(--text-muted)';
  const sevClr  = SEV_COLOR[al.severity]    || 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 0',
      borderBottom: '1px solid var(--border-subtle)',
      opacity: al.read ? 0.6 : 1,
    }}>
      <div style={{ width: 3, flexShrink: 0, borderRadius: 2, background: typeClr, alignSelf: 'stretch' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {al.jobName}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: `${sevClr}15`, color: sevClr, border: `1px solid ${sevClr}30`, flexShrink: 0, textTransform: 'uppercase' }}>
            {al.severity}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {al.message}
        </div>
      </div>
    </div>
  );
}

/** Status breakdown chips */
function StatusChip({ label, value, color }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', border: `1px solid var(--border-color)`, borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}

/** Quick navigation button */
function QuickNav({ label, sub, to, color, navigate }) {
  return (
    <button
      onClick={() => navigate(to)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 5, cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.15s', fontFamily: 'inherit',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
    >
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-main)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
      <ChevronRight size={14} color={color} />
    </button>
  );
}

/* ── Airflow event feed item ── */
function AirflowEvent({ ev }) {
  const typeColor = {
    success: 'var(--success)', failed: 'var(--error)', running: 'var(--primary)',
    warning: 'var(--warning)', prediction: '#7c3aed', pending: 'var(--text-muted)',
  }[ev.type] || 'var(--text-muted)';

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '9px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ width: 3, flexShrink: 0, borderRadius: 2, background: typeColor, alignSelf: 'stretch' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.msg}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
          {ev.time ? new Date(ev.time).toLocaleTimeString() : ''}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main Dashboard
══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [pendingEvents, setPendingEvents] = useState(null);
  const [afSync,        setAfSync]        = useState(null);
  const navigate = useNavigate();
  const eventsRef = useRef([]);

  const applyPendingEvents = useCallback((incoming) => {
    setData(prev => {
      if (!prev) return prev;
      eventsRef.current = incoming;
      return { ...prev, events: incoming };
    });
    setPendingEvents(null);
  }, []);

  const fetch = useCallback(async () => {
    try {
      const [analyticsRes, alertsRes, jobsRes, eventsRes, syncRes] = await Promise.all([
        api.get('/analytics'),
        api.get('/alerts?limit=6'),
        api.get('/jobs?limit=8&sortBy=startTime&order=desc'),
        airflow.getEvents().catch(() => ({ data: [] })),
        airflow.getSyncStatus().catch(() => null),
      ]);
      const incoming = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      if (syncRes) setAfSync(syncRes.data);

      const prevIds  = new Set(eventsRef.current.map(e => e.id));
      const newCount = incoming.filter(e => !prevIds.has(e.id)).length;

      setData(prev => {
        const next = {
          analytics: analyticsRes.data,
          alerts:    Array.isArray(alertsRes.data) ? alertsRes.data : [],
          jobs:      jobsRes.data.jobs || [],
          events:    (prev && newCount > 0) ? prev.events : incoming,
        };
        if (!prev) eventsRef.current = incoming;
        return next;
      });

      if (eventsRef.current.length > 0 && newCount > 0) {
        setPendingEvents({ count: newCount, events: incoming });
      } else if (eventsRef.current.length === 0) {
        eventsRef.current = incoming;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetch, 15000);

  const A       = data?.analytics;
  const jobs    = data?.jobs    || [];
  const alerts  = data?.alerts  || [];
  const events  = data?.events  || [];
  const unread  = alerts.filter(a => !a.read).length;

  const kpis = A ? [
    { title: 'Total Jobs',     value: A.total,                          sub: 'All time',             icon: Briefcase,   color: 'var(--primary)' },
    { title: 'Success Rate',   value: `${A.successRate}%`,              sub: `${A.succeeded} succeeded`, icon: CheckCircle, color: '#16a34a' },
    { title: 'Failure Rate',   value: `${A.failureRate}%`,              sub: `${A.failed} failed`,    icon: XCircle,     color: '#dc2626' },
    { title: 'Running Now',    value: A.running,                        sub: 'Active pipelines',     icon: Activity,    color: 'var(--primary)' },
    { title: 'Avg Duration',   value: formatDuration(A.avgDuration),    sub: 'Per job',              icon: Clock,       color: '#d97706' },
    { title: 'Records / Job',  value: formatNumber(A.avgRecordsProcessed), sub: 'Avg processed',    icon: Database,    color: '#7c3aed' },
  ] : [];

  return (
    <Layout onRefresh={fetch}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.015em' }}>
              ETL Observability Overview
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Real-time pipeline performance metrics and active monitoring indicators.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/monitoring')} className="btn-secondary">
              <Activity size={13} color="var(--primary)" /> <span>Live Monitor</span>
            </button>
            <button onClick={() => navigate('/jobs')} className="btn-primary">
              <Briefcase size={13} /> <span>View All Jobs</span>
            </button>
          </div>
        </div>

        {/* ── Quick ETL Controller Widget ── */}
        <QuickEtlController onTriggered={fetch} />

        {/* ── KPI row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={90} />)
            : kpis.map((k) => <KpiPanel key={k.title} {...k} />)
          }
        </div>

        {/* ── Middle row: jobs table + alert feed ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

          {/* Recent jobs */}
          <Panel title="Recent ETL Executions" icon={Briefcase} iconColor="var(--primary)" action={
            <button onClick={() => navigate('/jobs')} className="btn-ghost" style={{ fontSize: 12, gap: 4 }}>
              View all <ArrowRight size={12} />
            </button>
          }>
            <table style={{ width: 'calc(100% + 32px)', borderCollapse: 'collapse', margin: '-14px -16px' }}>
              <thead>
                <tr>
                  <th className="table-th" style={{ paddingLeft: 16 }}>Job Name</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Duration</th>
                  <th className="table-th">Records</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="table-row">
                      {[1,2,3,4].map(j => <td key={j} className="table-td"><Skeleton height={14} width={j === 1 ? '70%' : '50%'} /></td>)}
                    </tr>
                  ))
                  : jobs.length === 0
                    ? <tr><td colSpan={4} style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>No jobs found</td></tr>
                    : jobs.map((job) => <JobRow key={job.jobId} job={job} onClick={() => navigate(`/jobs/${job.jobId}`)} />)
                }
              </tbody>
            </table>
          </Panel>

          {/* Alert feed */}
          <Panel title="Active Alerts" icon={Bell} iconColor="var(--error)" action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {unread > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)' }}>
                  {unread} new
                </span>
              )}
              <button onClick={() => navigate('/alerts')} className="btn-ghost" style={{ fontSize: 12, gap: 4 }}>
                All <ArrowRight size={12} />
              </button>
            </div>
          }>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={42} style={{ marginBottom: 8 }} />)
              : alerts.length === 0
                ? <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>No active alerts</div>
                : alerts.slice(0, 6).map((al) => <AlertItem key={al._id} al={al} />)
            }
          </Panel>
        </div>

        {/* ── Airflow activity feed ── */}
        <Panel title="Airflow Pipeline Activity Feed" icon={GitBranch} iconColor="var(--primary)" action={
          <button onClick={() => navigate('/monitoring')} className="btn-ghost" style={{ fontSize: 12, gap: 4 }}>
            Live Monitor <ArrowRight size={12} />
          </button>
        }>
          {afSync && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12,
              padding: '8px 12px', borderRadius: 5,
              background: 'var(--bg-subtle)', border: '1px solid var(--border-color)',
              fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <span style={{ color: afSync.enabled ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                {afSync.enabled ? '● Polling Airflow API' : '○ Paused'}
              </span>
              <span>Sync Count: <strong style={{ color: 'var(--text-main)' }}>{afSync.syncCount}</strong></span>
              {afSync.lastSyncAt && (
                <span>Last Sync: <strong style={{ color: 'var(--text-main)' }}>{new Date(afSync.lastSyncAt).toLocaleTimeString()}</strong></span>
              )}
              <span>Interval: <strong style={{ color: 'var(--text-main)' }}>{(afSync.intervalMs / 1000)}s</strong></span>
            </div>
          )}

          {pendingEvents && (
            <button
              onClick={() => applyPendingEvents(pendingEvents.events)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', marginBottom: 12,
                padding: '8px 12px', borderRadius: 5,
                border: '1px solid var(--border-color)',
                background: 'var(--primary-light)', color: 'var(--primary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <ArrowDown size={14} />
              {pendingEvents.count} new Airflow event{pendingEvents.count !== 1 ? 's' : ''} — click to update feed
            </button>
          )}
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={34} style={{ marginBottom: 6 }} />)
            : events.length === 0
              ? <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  No Airflow events recorded yet.
                </div>
              : events.slice(0, 10).map((ev, i) => <AirflowEvent key={ev.id || i} ev={ev} />)
          }
        </Panel>

        {/* ── Bottom row: status breakdown + health + quick nav ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

          {/* Status breakdown */}
          <Panel title="Job Status Breakdown" icon={Activity} iconColor="#2563eb">
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={60} />)}
              </div>
            ) : A ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                <StatusChip label="Success"  value={A.succeeded} color={STATUS_COLOR.success}  />
                <StatusChip label="Failed"   value={A.failed}    color={STATUS_COLOR.failed}   />
                <StatusChip label="Running"  value={A.running}   color={STATUS_COLOR.running}  />
                <StatusChip label="Warning"  value={A.warning}   color={STATUS_COLOR.warning}  />
                <StatusChip label="Pending"  value={A.pending}   color={STATUS_COLOR.pending}  />
              </div>
            ) : null}
          </Panel>

          {/* System health */}
          <Panel title="Infrastructure Health" icon={Cpu} iconColor="#16a34a">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={24} />)}
              </div>
            ) : A ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <HealthMetric label="Avg CPU Usage"    value={A.avgCpu}    color={A.avgCpu > 75    ? '#dc2626' : '#16a34a'} />
                <HealthMetric label="Avg Memory Usage" value={A.avgMemory} color={A.avgMemory > 75 ? '#d97706' : '#2563eb'} />
                <HealthMetric label="Success Rate"     value={A.successRate}   color="#16a34a" />
                <HealthMetric label="Recovery Rate"    value={A.recoverySuccessRate || 0} color="#7c3aed" />
              </div>
            ) : null}
          </Panel>

          {/* Quick nav */}
          <Panel title="Quick Links" icon={Zap} iconColor="#d97706">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <QuickNav label="Live Monitoring"  sub="Real-time job telemetry" to="/monitoring" color="#2563eb" navigate={navigate} />
              <QuickNav label="AI Predictions"    sub="Risk forecast model"     to="/prediction" color="#7c3aed" navigate={navigate} />
              <QuickNav label="Log Viewer"       sub="Search pipeline logs"    to="/logs"       color="#d97706" navigate={navigate} />
              <QuickNav label="Reports"          sub="Export ETL metrics"      to="/reports"    color="#16a34a" navigate={navigate} />
            </div>
          </Panel>
        </div>

      </div>
    </Layout>
  );
}
