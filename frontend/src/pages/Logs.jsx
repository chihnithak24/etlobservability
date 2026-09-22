import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Pagination from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import api from '../utils/api';
import usePolling from '../hooks/usePolling';
import { formatDate } from '../utils/helpers';
import {
  Search, AlertCircle, X, FileText, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, Clock,
  Info, AlertTriangle, XCircle, Bug
} from 'lucide-react';

/* ─────────────────────────────────────────────── constants ── */
const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'];

const LEVEL_COLOR = { INFO: 'var(--primary)', WARN: 'var(--warning)', ERROR: 'var(--error)', DEBUG: 'var(--text-muted)' };
const LEVEL_BG    = { INFO: 'var(--primary-light)', WARN: 'var(--warning-bg)', ERROR: 'var(--error-bg)', DEBUG: 'var(--bg-subtle)' };
const LEVEL_ICON  = { INFO: Info, WARN: AlertTriangle, ERROR: XCircle, DEBUG: Bug };

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'level',  label: 'By Level' },
];

/* ─────────────────────────────────────────────── sub-components ── */
const LevelBadge = ({ level }) => {
  const Icon = LEVEL_ICON[level] || Info;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      color: LEVEL_COLOR[level] || 'var(--text-muted)',
      background: LEVEL_BG[level] || 'var(--bg-subtle)',
      fontFamily: 'monospace',
      border: `1px solid ${LEVEL_COLOR[level] || 'var(--border-color)'}40`
    }}>
      <Icon size={10} />
      {level}
    </span>
  );
};

const StatPill = ({ label, value, color, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 18px', borderRadius: 8,
      border: `1px solid ${active ? color : 'var(--border-color)'}`,
      background: active ? `${color}15` : 'var(--bg-card)',
      cursor: 'pointer', gap: 2, transition: 'all 0.15s'
    }}
  >
    <span style={{ fontSize: 20, fontWeight: 800, color: active ? color : 'var(--text-main)', fontFamily: 'monospace' }}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
    <span style={{ fontSize: 11, color: active ? color : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </span>
  </button>
);

function DetailRow({ label, children }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{label}</span>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────── main page ── */
export default function Logs() {
  const navigate = useNavigate();

  // Data
  const [logs, setLogs]     = useState([]);
  const [stats, setStats]   = useState({ total: 0, INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 });
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // Filters
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('ALL');
  const [jobId, setJobId]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [sortBy, setSortBy]   = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Detail panel
  const [selected, setSelected] = useState(null);

  /* ── fetch stats bar ─────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/logs/stats');
      setStats(data);
    } catch { /* non-critical */ }
  }, []);

  /* ── fetch logs ──────────────────────────────────────────── */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search)          params.set('search',   search);
      if (level !== 'ALL') params.set('level',    level);
      if (jobId.trim())    params.set('jobId',    jobId.trim().toUpperCase());
      if (dateFrom)        params.set('dateFrom', dateFrom);
      if (dateTo)          params.set('dateTo',   dateTo);

      const { data } = await api.get(`/logs?${params}`);

      // client-side sort
      let rows = [...(data.logs || [])];
      if (sortBy === 'oldest') rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      else if (sortBy === 'level') {
        const order = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
        rows.sort((a, b) => (order[a.level] ?? 4) - (order[b.level] ?? 4));
      }

      setLogs(rows);
      setTotal(data.total);
      setPages(data.pages);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot reach backend. Is the server running on port 5000?');
    } finally {
      setLoading(false);
    }
  }, [page, search, level, jobId, dateFrom, dateTo, sortBy]);

  usePolling(fetchLogs,  10000);
  usePolling(fetchStats, 15000);

  /* ── handlers ────────────────────────────────────────────── */
  const handleLevelClick = (l) => {
    setLevel(l);
    setPage(1);
  };
  const handleStatPillClick = (l) => {
    setLevel(l === level ? 'ALL' : l);
    setPage(1);
  };
  const handleSearch    = (e) => { setSearch(e.target.value);  setPage(1); };
  const handleJobId     = (e) => { setJobId(e.target.value);   setPage(1); };
  const handleClearAll  = () => {
    setSearch(''); setLevel('ALL'); setJobId('');
    setDateFrom(''); setDateTo(''); setPage(1);
  };
  const hasActiveFilters = search || level !== 'ALL' || jobId || dateFrom || dateTo;

  return (
    <Layout onRefresh={fetchLogs}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>ETL Log Viewer</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
              Real-time structured pipeline logs with Soft Light telemetry insights
            </p>
          </div>
          <button onClick={fetchLogs} className="btn-secondary" style={{ gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8 }}>
            <AlertCircle size={16} color="var(--error)" />
            <span style={{ fontSize: 13, color: 'var(--error)', fontWeight: 600 }}>{error}</span>
            <button onClick={fetchLogs} className="btn-secondary" style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 10px' }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Stats Bar ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatPill
            label="Total Logs"
            value={stats.total}
            color="var(--primary)"
            active={level === 'ALL'}
            onClick={() => handleLevelClick('ALL')}
          />
          {['INFO', 'WARN', 'ERROR', 'DEBUG'].map(l => (
            <StatPill
              key={l}
              label={l}
              value={stats[l] ?? 0}
              color={LEVEL_COLOR[l]}
              active={level === l}
              onClick={() => handleStatPillClick(l)}
            />
          ))}
        </div>

        {/* ── Filters Card ── */}
        <div className="card" style={{ padding: 16 }}>
          {/* Primary filter row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Message search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, background: 'var(--bg-input)', borderRadius: 6, padding: '6px 12px', border: '1px solid var(--border-color)' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: 13 }}
                placeholder="Search log messages..."
                value={search}
                onChange={handleSearch}
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Job ID filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', borderRadius: 6, padding: '6px 12px', border: '1px solid var(--border-color)', minWidth: 170 }}>
              <FileText size={14} color="var(--text-muted)" />
              <input
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: 13, width: 130 }}
                placeholder="Job ID (e.g. JOB-0001)"
                value={jobId}
                onChange={handleJobId}
              />
              {jobId && (
                <button onClick={() => { setJobId(''); setPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Level pill buttons */}
            <div style={{ display: 'flex', gap: 5 }}>
              {LEVELS.map(l => {
                const isSelected = level === l;
                return (
                  <button
                    key={l}
                    onClick={() => handleLevelClick(l)}
                    style={{
                      padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                      background: isSelected ? 'var(--primary-light)' : 'var(--bg-subtle)',
                      color:      isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      border:     `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>

            {/* Advanced / Sort toggles */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', outline: 'none' }}
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-secondary"
                style={{ gap: 5, padding: '5px 11px', fontSize: 12, borderColor: showFilters ? 'var(--primary)' : 'var(--border-color)', color: showFilters ? 'var(--primary)' : 'var(--text-secondary)' }}
              >
                Filters {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={handleClearAll}
                  style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid var(--error-border)', background: 'var(--error-bg)', color: 'var(--error)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Advanced filters (date range) */}
          {showFilters && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Date range:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>From</label>
                <input
                  type="datetime-local"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>To</label>
                <input
                  type="datetime-local"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none' }}
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
                  style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Clear dates
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Main content + detail panel ── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* Log table */}
          <div className="card" style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ background: 'var(--bg-card)', fontSize: 13 }}>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '170px 95px 120px 1fr', gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
                {['Timestamp', 'Level', 'Job ID', 'Message'].map(h => (
                  <span key={h} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: 20 }}><TableSkeleton rows={10} cols={4} /></div>
              ) : logs.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={32} style={{ opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>No log entries match your filters</div>
                  {hasActiveFilters && (
                    <button onClick={handleClearAll} style={{ marginTop: 10, fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                logs.map((log, i) => {
                  const isSelected = selected?._id === log._id && selected?.timestamp === log.timestamp && selected?.message === log.message;
                  return (
                    <div
                      key={log._id || i}
                      onClick={() => setSelected(isSelected ? null : log)}
                      style={{
                        display: 'grid', gridTemplateColumns: '170px 95px 120px 1fr',
                        gap: 0, padding: '9px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: isSelected
                          ? 'var(--primary-light)'
                          : i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-subtle)',
                        borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-subtle)'; }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                        <Clock size={10} color="var(--text-muted)" />
                        {formatDate(log.timestamp)}
                      </span>
                      <span><LevelBadge level={log.level} /></span>
                      <span style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                        {log.jobId}
                      </span>
                      <span style={{ color: log.level === 'ERROR' ? 'var(--error)' : log.level === 'WARN' ? 'var(--warning)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: log.level === 'ERROR' || log.level === 'WARN' ? 600 : 400 }}>
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: count + pagination */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {loading ? '...' : `${total.toLocaleString()} entries`}
                {hasActiveFilters && <span style={{ color: 'var(--primary)', marginLeft: 6, fontWeight: 700 }}>· filtered</span>}
              </span>
              <Pagination page={page} pages={pages} onPage={setPage} />
            </div>
          </div>

          {/* ── Detail panel ── */}
          {selected && (
            <div className="card" style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>
              {/* Panel header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LevelBadge level={selected.level} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>Log Detail</span>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
                  <X size={15} />
                </button>
              </div>

              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Timestamp */}
                <DetailRow label="Timestamp">
                  <span style={{ color: 'var(--text-main)', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>
                    {new Date(selected.timestamp).toLocaleString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                </DetailRow>

                {/* Job info */}
                <DetailRow label="Job ID">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--primary)', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{selected.jobId}</span>
                    <button
                      onClick={() => navigate(`/jobs/${selected.jobId}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 0 }}
                      title="Open Job Details"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </DetailRow>

                {selected.jobName && (
                  <DetailRow label="Job Name">
                    <span style={{ color: 'var(--text-main)', fontSize: 13, fontWeight: 600 }}>{selected.jobName}</span>
                  </DetailRow>
                )}

                {(selected.source || selected.destination) && (
                  <DetailRow label="Pipeline">
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'monospace' }}>
                      {selected.source} → {selected.destination}
                    </span>
                  </DetailRow>
                )}

                {selected.status && (
                  <DetailRow label="Job Status">
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      textTransform: 'capitalize',
                      background: selected.status === 'success' ? 'var(--success-bg)' : selected.status === 'failed' ? 'var(--error-bg)' : 'var(--warning-bg)',
                      color: selected.status === 'success' ? 'var(--success)' : selected.status === 'failed' ? 'var(--error)' : 'var(--warning)'
                    }}>
                      {selected.status}
                    </span>
                  </DetailRow>
                )}

                {/* Message box */}
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Message</span>
                  <div style={{
                    marginTop: 6, padding: '10px 12px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6, fontSize: 12.5,
                    color: selected.level === 'ERROR' ? 'var(--error)' : selected.level === 'WARN' ? 'var(--warning)' : 'var(--text-main)',
                    fontFamily: 'monospace', lineHeight: 1.6, wordBreak: 'break-word'
                  }}>
                    {selected.message}
                  </div>
                </div>

                {/* Meta (if present) */}
                {selected.meta && Object.keys(selected.meta).length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Metadata</span>
                    <div style={{ marginTop: 6, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                      {Object.entries(selected.meta).map(([k, v]) => (
                        <div key={k}>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{k}</span>
                          <span style={{ color: 'var(--text-muted)' }}>: </span>
                          <span>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick link to job */}
                <button
                  onClick={() => navigate(`/jobs/${selected.jobId}`)}
                  className="btn-secondary"
                  style={{
                    marginTop: 4, width: '100%', justifyContent: 'center', gap: 6, fontSize: 12.5
                  }}
                >
                  <ExternalLink size={13} /> Open Job Details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
