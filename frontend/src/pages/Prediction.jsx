import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import RiskScore from '../components/ui/RiskScore';
import Skeleton from '../components/ui/Skeleton';
import api from '../utils/api';
import usePolling from '../hooks/usePolling';
import { formatDuration, formatNumber, getRiskColor } from '../utils/helpers';
import {
  Brain, Zap, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Activity, Cpu, HardDrive, Clock,
  RotateCcw, Database, TrendingUp, ChevronRight,
  ShieldCheck, ShieldAlert, ShieldX, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ThinkingDots, VoiceSpeaker, MicDictation } from '../components/ui/VoiceAndLangControls';

/* ── constants ──────────────────────────────────────────────────── */
const SOURCES = ['S3','Redshift','MySQL','PostgreSQL','Kafka','DynamoDB','Oracle','Snowflake'];
const DEFAULT_FORM = {
  cpuUsage: 72, memoryUsage: 65, retryCount: 1,
  duration: 1200, recordsProcessed: 500000, source: 'S3', jobName: ''
};

const STATUS_META = {
  likely_fail: { color: '#dc2626', bg: '#ffe4e6', border: '#fecdd3', label: 'Likely Fail', statusLabel: 'Failed',  Icon: ShieldX    },
  at_risk:     { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'At Risk',     statusLabel: 'Warning', Icon: ShieldAlert },
  stable:      { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: 'Stable',      statusLabel: 'Success', Icon: ShieldCheck },
};

/* ── sub-components ─────────────────────────────────────────────── */

/** Animated confidence ring (SVG) */
function ConfidenceRing({ pct, color }) {
  const r = 42, cx = 52, cy = 52;
  const circ = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  return (
    <svg width={104} height={104}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={9} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={16} fontWeight={700}>{pct}%</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="#64748b" fontSize={9}>confidence</text>
    </svg>
  );
}

/** Horizontal feature-contribution bar */
function FeatureBar({ label, value, points, max, color }) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>{value}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{points}/{max} pts</span>
        </div>
      </div>
      <div style={{ height: 5, background: '#1e2535', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

/** At-risk job row in the scan table */
function AtRiskRow({ job, onPredict, navigate }) {
  const m = STATUS_META[job.predictedStatus] || STATUS_META.stable;
  return (
    <tr className="table-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/jobs/${job.jobId}`)}>
      <td style={{ padding: '10px 14px', fontSize: 13, color: '#6366f1', fontWeight: 500 }}>{job.jobId}</td>
      <td style={{ padding: '10px 14px', fontSize: 13, color: '#e2e8f0' }}>{job.jobName}</td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
          <m.Icon size={10} />{m.label}
        </span>
      </td>
      <td style={{ padding: '10px 14px', minWidth: 130 }}><RiskScore score={job.aiRiskScore || 0} /></td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{job.cpuUsage}% / {job.memoryUsage}%</td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{job.retryCount}</td>
      <td style={{ padding: '10px 14px' }}>
        <button
          onClick={e => { e.stopPropagation(); onPredict(job); }}
          style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:6, color:'#818cf8', fontSize:11, cursor:'pointer' }}
        >
          <Brain size={10} /> Analyze
        </button>
      </td>
    </tr>
  );
}

/* ── slider field ────────────────────────────────────────────────── */
function Field({ label, name, min, max, step = 1, form, setForm, suffix = '' }) {
  const val = form[name];
  const display = name === 'recordsProcessed'
    ? (val >= 1e6 ? `${(val/1e6).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val)
    : name === 'duration'
    ? formatDuration(val)
    : `${val}${suffix}`;
  return (
    <div>
      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
        {label}: <span style={{ color: '#6366f1', fontWeight: 600 }}>{display}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => setForm(f => ({ ...f, [name]: Number(e.target.value) }))}
        style={{ width: '100%', accentColor: '#6366f1' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a5568' }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────── */
export default function Prediction() {
  const navigate = useNavigate();

  const [form, setForm]         = useState(DEFAULT_FORM);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [thinking, setThinking] = useState(false);

  const [atRisk, setAtRisk]     = useState([]);
  const [atRiskLoading, setAtRiskLoading] = useState(true);

  const [modelInfo, setModelInfo] = useState(null);
  const [history, setHistory]   = useState([]);   // last 5 manual predictions

  /* ── fetch at-risk jobs ─────────────────────────────── */
  const fetchAtRisk = useCallback(async () => {
    try {
      const { data } = await api.get('/predict/at-risk?limit=10');
      setAtRisk(data.jobs || []);
    } catch { /* silent */ }
    finally { setAtRiskLoading(false); }
  }, []);

  /* ── fetch model info once ─────────────────────────── */
  const fetchModelInfo = useCallback(async () => {
    try {
      const { data } = await api.get('/predict/model');
      setModelInfo(data);
    } catch { /* silent */ }
  }, []);

  usePolling(fetchAtRisk, 15000);
  usePolling(fetchModelInfo, 60000);

  /* ── run manual prediction with 3 dots thinking effect ── */
  const handlePredict = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setThinking(true);
    try {
      const { data } = await api.post('/predict', form);
      // Wait 1.2s to show animated 3 dots thinking indicator (...)
      await new Promise(res => setTimeout(res, 1200));
      setResult(data);
      setHistory(h => [{ ...data, ts: new Date(), input: { ...form } }, ...h].slice(0, 5));
      toast.success('AI prediction complete');
    } catch {
      toast.error('Prediction failed — check backend');
    } finally {
      setThinking(false);
      setLoading(false);
    }
  };

  /* ── run prediction from at-risk row ───────────────── */
  const handleJobPredict = async (job) => {
    setLoading(true);
    setThinking(true);
    try {
      const { data } = await api.get(`/predict/${job.jobId}`);
      await new Promise(res => setTimeout(res, 1200));
      setResult(data);
      setHistory(h => [{ ...data, ts: new Date(), input: job }, ...h].slice(0, 5));
      toast.success(`Prediction complete: ${job.jobId}`);
    } catch {
      toast.error('Prediction failed');
    } finally {
      setThinking(false);
      setLoading(false);
    }
  };

  const statusMeta = result ? (STATUS_META[result.predictedStatus] || STATUS_META.stable) : null;

  // Build speech text for Voice read-aloud
  const speechText = result ? (
    `Prediction Result. Risk Score ${result.riskScore}. ` +
    `Status: ${result.statusLabel || statusMeta?.statusLabel}. ` +
    `Root Cause Analysis: ${result.rootCause}. ` +
    `Recommended Action: ${result.recommendedAction}`
  ) : '';

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
              AI Failure Prediction
            </h1>
            <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Predict ETL job failure risk using CPU, memory, retry count, execution time, data volume &amp; job history
            </p>
          </div>
          {modelInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
              <Brain size={13} color="#a78bfa" />
              <span style={{ fontSize: 12, color: '#a78bfa' }}>{modelInfo.modelType}</span>
              <span style={{ fontSize: 11, color: '#4a5568' }}>· {modelInfo.accuracy}% accuracy</span>
            </div>
          )}
        </div>

        {/* ── Model stat strip ───────────────────────────────── */}
        {modelInfo && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { label: 'Accuracy',          value: `${modelInfo.accuracy}%`,   color: '#34d399' },
              { label: 'Precision',         value: `${modelInfo.precision}%`,  color: '#60a5fa' },
              { label: 'Recall',            value: `${modelInfo.recall}%`,     color: '#a78bfa' },
              { label: 'F1 Score',          value: `${modelInfo.f1Score}%`,    color: '#fbbf24' },
              { label: 'Training Samples',  value: (modelInfo.trainingDataSize||0).toLocaleString(), color: '#6366f1' },
              { label: 'Avg Risk Score',    value: `${modelInfo.avgRiskScore}`, color: getRiskColor(modelInfo.avgRiskScore||0) },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Main 2-col: Input + Results ────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'flex-start' }}>

          {/* Input Form */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain size={20} color="#a78bfa" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                  Job Parameters
                </h3>
              </div>
            </div>
            <form onSubmit={handlePredict} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Job name + Mic Dictation */}
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                  Job Name <span style={{ fontSize: 11, color: '#4a5568' }}>(optional — used for history analysis)</span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input" style={{ flex: 1 }}
                    placeholder="e.g. Sales Pipeline ETL"
                    value={form.jobName}
                    onChange={e => setForm(f => ({ ...f, jobName: e.target.value }))}
                  />
                  <MicDictation
                    lang="en"
                    onTranscript={(text) => setForm(f => ({ ...f, jobName: text }))}
                  />
                </div>
              </div>

              <Field label="CPU Usage"          name="cpuUsage"         min={0}  max={100}     suffix="%" form={form} setForm={setForm} />
              <Field label="Memory Usage"       name="memoryUsage"      min={0}  max={100}     suffix="%" form={form} setForm={setForm} />
              <Field label="Retry Count"        name="retryCount"       min={0}  max={10}               form={form} setForm={setForm} />
              <Field label="Execution Time"     name="duration"         min={0}  max={7200} step={60}   form={form} setForm={setForm} />
              <Field label="Records Processed"  name="recordsProcessed" min={0}  max={5000000} step={10000} form={form} setForm={setForm} />

              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Source System</label>
                <select className="input" style={{ width: '100%' }} value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}
                style={{ padding: '12px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {thinking ? (
                  <ThinkingDots label="AI is thinking..." color="#ffffff" />
                ) : (
                  <>
                    <Zap size={16} /> Run AI Prediction
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {thinking ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 320 }}>
                <ThinkingDots label="AI is thinking..." color="#a78bfa" />
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Analyzing CPU, memory, retries &amp; telemetry parameters...</div>
              </div>
            ) : !result ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 300 }}>
                <Brain size={52} color="#2d3748" />
                <div style={{ color: '#64748b', fontSize: 14 }}>Configure parameters and run prediction</div>
                <div style={{ fontSize: 12, color: '#374151' }}>Analyzes CPU, memory, retries, time, volume &amp; job history</div>
              </div>
            ) : (
              <>
                {/* ── Risk score + status card ── */}
                <div className="card" style={{ padding: 20, borderLeft: `3px solid ${statusMeta.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                          Prediction Result
                        </h3>
                        {/* Voice Speaker button */}
                        <VoiceSpeaker text={speechText} lang="en" />
                      </div>
                      {result.jobId && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{result.jobId} · {result.jobName}</div>}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                        <span style={{ fontSize: 10, color: '#6366f1' }}>✓ Stored in MongoDB</span>
                      </div>
                    </div>
                    <ConfidenceRing pct={result.confidence} color={statusMeta.color} />
                  </div>

                  {/* Risk score bar (0–100) */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Risk Score</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: statusMeta.color }}>{result.riskScore} <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>/ 100</span></span>
                    </div>
                    <div style={{ height: 10, background: '#1e2535', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${result.riskScore}%`, height: '100%', background: `linear-gradient(90deg, ${statusMeta.color}99, ${statusMeta.color})`, borderRadius: 5, transition: 'width 0.6s' }} />
                    </div>
                  </div>

                  {/* Predicted status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: statusMeta.bg, borderRadius: 8, border: `1px solid ${statusMeta.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <statusMeta.Icon size={16} color={statusMeta.color} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: statusMeta.color }}>
                        {statusMeta.label}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: statusMeta.color, marginLeft: 6 }}>
                        ({result.statusLabel || statusMeta.statusLabel})
                      </span>
                    </div>
                  </div>

                  {/* Recommended action highlight */}
                  {result.recommendedAction && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#0f1117', borderRadius: 8, borderLeft: `3px solid ${statusMeta.color}` }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Recommended Action
                      </div>
                      <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>
                        {result.recommendedAction}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Feature contributions ── */}
                {result.features && (
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <TrendingUp size={15} color="#6366f1" />
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                        Feature Contributions
                      </h3>
                      <span style={{ fontSize: 11, color: '#4a5568', marginLeft: 'auto' }}>points towards risk score</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {Object.entries(result.features).map(([key, f]) => {
                        const col = f.points >= f.max * 0.75 ? '#f87171' : f.points >= f.max * 0.4 ? '#fbbf24' : '#34d399';
                        return <FeatureBar key={key} label={f.label} value={f.value} points={f.points} max={f.max} color={col} />;
                      })}
                    </div>
                  </div>
                )}

                {/* ── Root cause ── */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <AlertTriangle size={15} color="#fbbf24" />
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                      Root Cause Analysis
                    </h3>
                  </div>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.7 }}>
                    {result.rootCause}
                  </p>
                </div>

                {/* ── Recovery actions ── */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <CheckCircle size={15} color="#34d399" />
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                      Recovery Actions
                    </h3>
                  </div>
                  {result.recoveryActions.map((action, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < result.recoveryActions.length - 1 ? '1px solid #1e2535' : 'none' }}>
                      <span style={{ color: '#34d399', fontWeight: 700, fontSize: 13, minWidth: 16 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13, color: '#e2e8f0' }}>{action}</span>
                    </div>
                  ))}
                </div>

                {/* ── Anomalies ── */}
                {result.anomalies?.length > 0 && (
                  <div className="card" style={{ padding: 20, borderLeft: '3px solid #fbbf24' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Zap size={15} color="#fbbf24" />
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24', margin: 0 }}>
                        Anomalies Detected
                      </h3>
                    </div>
                    {result.anomalies.map((a, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#e2e8f0', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={11} color="#fbbf24" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── At-risk jobs scan table ─────────────────────────── */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} color="#fbbf24" />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                At-Risk &amp; Likely-Fail Jobs
              </h3>
            </div>
            <button
              onClick={fetchAtRisk}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#2d3748', border: '1px solid #4a5568', borderRadius: 7, color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2535' }}>
                  {['Job ID', 'Name', 'Predicted Status', 'Risk Score', 'CPU / Memory', 'Retries', 'Action'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atRiskLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} style={{ padding: '12px 14px' }}><Skeleton height={14} /></td></tr>
                  ))
                ) : atRisk.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '28px 14px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    No at-risk jobs detected ✓
                  </td></tr>
                ) : atRisk.map(job => (
                  <AtRiskRow key={job.jobId} job={job} onPredict={handleJobPredict} navigate={navigate} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Prediction history ──────────────────────────────── */}
        {history.length > 0 && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock size={16} color="#6366f1" />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                Recent Predictions
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h, i) => {
                const m = STATUS_META[h.predictedStatus] || STATUS_META.stable;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', background: '#111827', borderRadius: 8, border: '1px solid #1e2535' }}>
                    <m.Icon size={16} color={m.color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                        {h.jobId || h.input?.jobName || 'Manual prediction'}
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b' }}>
                          CPU {h.input?.cpuUsage ?? '—'}% · Mem {h.input?.memoryUsage ?? '—'}%
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{h.ts.toLocaleTimeString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{h.riskScore}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>risk</div>
                    </div>
                    <button
                      onClick={() => setResult(h)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', display: 'flex' }}
                      title="View result"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
