import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import RiskScore from '../components/ui/RiskScore';
import Skeleton from '../components/ui/Skeleton';
import usePolling from '../hooks/usePolling';
import api, { airflow, monitoring } from '../utils/api';
import { formatDuration, formatNumber } from '../utils/helpers';
import {
  Activity, RefreshCw, Play, Search,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  SkipForward, HelpCircle, Database, Cpu, HardDrive, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── colour maps ── */
const STATE_COLOR = {
  success:  '#16a34a',
  failed:   '#dc2626',
  running:  'var(--primary)',
  pending:  '#64748b',
  warning:  '#d97706',
  retrying: '#ea580c',
  skipped:  '#475569',
  unknown:  '#64748b',
};

const STATE_ICON = {
  success:  CheckCircle2,
  failed:   XCircle,
  running:  Loader2,
  pending:  Activity,
  warning:  AlertTriangle,
  retrying: RotateCcw,
  skipped:  SkipForward,
  unknown:  HelpCircle,
};

const STAGE_COLOR = {
  EXTRACT:   '#2563eb',
  TRANSFORM: 'var(--primary)',
  LOAD:      '#16a34a',
  COMPLETED: '#15803d',
  FAILED:    '#dc2626',
  QUEUED:    '#64748b',
};

/** Compact state pill */
function StatePill({ state }) {
  const color = STATE_COLOR[state] || STATE_COLOR.unknown;
  const Icon  = STATE_ICON[state]  || HelpCircle;
  const spin  = state === 'running';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 12,
      background: `${color}15`, border: `1px solid ${color}40`,
      fontSize: 11, fontWeight: 700, color, letterSpacing: '0.02em',
    }}>
      <Icon size={11} strokeWidth={2.2} className={spin ? 'spin' : ''} />
      {state?.toUpperCase()}
    </span>
  );
}

/** Stage indicator pill */
function StagePill({ stage }) {
  const color = STAGE_COLOR[stage] || '#64748b';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      background: `${color}15`, border: `1px solid ${color}40`,
      fontSize: 11, fontWeight: 800, color, letterSpacing: '0.04em',
    }}>
      {stage}
    </span>
  );
}

/** Heartbeat badge component */
function HeartbeatBadge({ status, ageSec }) {
  const isLive = status === 'LIVE';
  const isStale = status === 'STALE';
  const color = isLive ? '#16a34a' : isStale ? '#d97706' : '#dc2626';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 12,
      background: `${color}12`, border: `1px solid ${color}30`,
      fontSize: 11, fontWeight: 700, color
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status} {ageSec != null ? `(${ageSec}s)` : ''}
    </div>
  );
}

/** Live Active Running Job Card */
function LiveJobCard({ job }) {
  const cpuClr = (job.cpuUsage || 0) > 85 ? 'var(--error)' : (job.cpuUsage || 0) > 70 ? 'var(--warning)' : 'var(--success)';
  const memClr = (job.memoryUsage || 0) > 85 ? 'var(--error)' : (job.memoryUsage || 0) > 70 ? 'var(--warning)' : 'var(--primary)';
  const riskClr = (job.aiRiskScore || 0) >= 70 ? 'var(--error)' : (job.aiRiskScore || 0) >= 40 ? 'var(--warning)' : 'var(--success)';
  const stage = job.stage || job.currentStage || 'EXTRACT';
  const heartbeatAge = job.heartbeatAgeSec ?? job.hbAgeSec ?? 0;

  return (
    <div className="card" style={{
      padding: 18, borderLeft: `4px solid ${riskClr}`,
      background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 14
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{job.jobName || job.dagId || job.jobId}</h3>
            <StatePill state={job.status} />
            <StagePill stage={stage} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>
            ID: {job.jobId} · DAG: {job.dag_id || job.dagId || 'etl_pipeline'} · Task: {job.task_id || job.taskId || 'task_run'}
          </div>
        </div>
        <HeartbeatBadge status={job.heartbeatStatus || 'LIVE'} ageSec={heartbeatAge} />
      </div>

      {/* Progress Track */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
          <span>Execution Progress ({stage})</span>
          <span>{Math.round(job.progress || 0)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, job.progress || 0))}%`, background: STAGE_COLOR[stage] || 'var(--primary)' }} />
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, background: 'var(--bg-subtle)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
        
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Cpu size={12} color={cpuClr} /> CPU
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cpuClr, marginTop: 2 }}>{job.cpuUsage}%</div>
        </div>

        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <HardDrive size={12} color={memClr} /> Memory
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: memClr, marginTop: 2 }}>{job.memoryUsage}%</div>
        </div>

        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Database size={12} color="var(--primary)" /> Records
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>{formatNumber(job.recordsProcessed)}</div>
        </div>

        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>Duration</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>{formatDuration(job.duration)}</div>
        </div>

        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>AI Risk</div>
          <div style={{ marginTop: 2 }}><RiskScore score={job.aiRiskScore / 100} /></div>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main Monitoring Component
══════════════════════════════════════════════════════════════════ */
export default function Monitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [spawning, setSpawning] = useState(false);

  const fetchLive = useCallback(async () => {
    try {
      const res = await monitoring.getLive();
      setData(res.data);
    } catch (err) {
      console.error('[Monitoring] Live telemetry polling error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchLive, 3000);

  const handleSpawn = async (forceFailure = false) => {
    setSpawning(true);
    try {
      await monitoring.spawnSimulatedJob(forceFailure);
      toast.success(forceFailure ? 'Spawned simulated failure test job' : 'Spawned test job');
      fetchLive();
    } catch (err) {
      toast.error('Could not spawn test job');
    } finally {
      setSpawning(false);
    }
  };

  const activeJobs = data?.jobs || data?.activeJobs || [];
  const filteredJobs = activeJobs.filter(j => {
    const matchSearch = (j.jobName || j.dagId || '').toLowerCase().includes(search.toLowerCase()) ||
                        (j.jobId || '').toLowerCase().includes(search.toLowerCase()) ||
                        (j.dag_id || j.dagId || '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'running') return j.status === 'running';
    if (filter === 'at_risk') return (j.aiRiskScore || 0) >= 50;
    if (filter === 'warning') return j.status === 'warning' || (j.cpuUsage || 0) > 75;
    return true;
  });

  const connectionStatus = data ? 'LIVE' : 'DISCONNECTED';

  return (
    <Layout onRefresh={fetchLive}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={20} color="var(--primary)" />
              <span>Live ETL Telemetry Monitoring</span>
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Real-time pipeline progress, memory utilization, worker heatmaps, and failure risk scores.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSpawn(false)} disabled={spawning} className="btn-secondary">
              <Play size={12} /> <span>Spawn Job</span>
            </button>
            <button onClick={() => handleSpawn(true)} disabled={spawning} className="btn-danger">
              <AlertTriangle size={12} /> <span>Test Failure</span>
            </button>
          </div>
        </div>

        {/* Status Strip */}
        <div className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
              <span className="badge-base badge-success">🟢 {connectionStatus}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Active Jobs:</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>{activeJobs.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Engine Mode:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{data?.mode || 'Simulator'}</span>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Last Polled: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Just now'}
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="card" style={{ flex: 1, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Filter by DAG ID, Task ID, or Job ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 3 }}>
            {['all', 'running', 'at_risk', 'warning'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: filter === f ? 700 : 500,
                  background: filter === f ? 'var(--primary-light)' : 'transparent',
                  color: filter === f ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Live Running Job Cards */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={160} />)}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} color="var(--border-color)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>No matching active ETL jobs</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>All monitored pipelines are idle or complete. Use "Spawn Job" to trigger a live telemetry test.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredJobs.map(job => (
              <LiveJobCard key={job.jobId} job={job} />
            ))}
          </div>
        )}

      </div>
    </Layout>
  );
}

