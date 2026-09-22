import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import StatusBadge from '../components/ui/StatusBadge';
import RiskScore from '../components/ui/RiskScore';
import Pagination from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import api, { airflow } from '../utils/api';
import usePolling from '../hooks/usePolling';
import { formatDuration, formatDate, formatNumber } from '../utils/helpers';
import { Search, Plus, ChevronUp, ChevronDown, AlertCircle, X, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['all', 'running', 'success', 'failed', 'warning', 'pending'];

export default function Jobs() {
  const [searchParams] = useSearchParams();
  const [jobs, setJobs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError]     = useState(null);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [search, setSearch]   = useState(() => searchParams.get('search') || '');
  const [status, setStatus]   = useState(() => searchParams.get('status') || 'all');
  const [sortBy, setSortBy]   = useState('startTime');
  const [order, setOrder]     = useState('desc');
  const [syncStatus, setSyncStatus] = useState(null);
  const debounceRef           = useRef(null);
  const navigate              = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newJob, setNewJob] = useState({ jobName: '', source: '', destination: '', cpuUsage: 50, memoryUsage: 50, duration: 600, recordsProcessed: 100000 });

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page, limit: 10, sortBy, order });
      if (search) params.set('search', search);
      if (status !== 'all') params.set('status', status);

      const [jobsRes, statusRes] = await Promise.all([
        api.get(`/jobs?${params}`),
        airflow.getSyncStatus().catch(() => null),
      ]);

      setJobs(jobsRes.data.jobs);
      setTotal(jobsRes.data.total);
      setPages(jobsRes.data.pages);
      if (statusRes) setSyncStatus(statusRes.data);
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Cannot reach backend server';
      setError(msg);
      toast.error('Failed to load jobs');
    } finally {
      setInitialLoad(false);
    }
  }, [page, search, status, sortBy, order]);

  usePolling(fetchJobs, 10000);

  useEffect(() => { setInitialLoad(true); }, [page, search, status, sortBy, order]);

  const handleSort = (col) => {
    if (sortBy === col) setOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setOrder('desc'); }
    setPage(1);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newJob.jobName.trim()) return toast.error('Job name is required');
    setCreating(true);
    try {
      await api.post('/jobs', newJob);
      toast.success('Job created successfully');
      setShowCreate(false);
      setNewJob({ jobName: '', source: '', destination: '', cpuUsage: 50, memoryUsage: 50, duration: 600, recordsProcessed: 100000 });
      fetchJobs();
    } catch (err) {
      toast.error('Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  const headers = [
    { key: 'jobName',          label: 'Job Name' },
    { key: 'source',           label: 'Source' },
    { key: 'status',           label: 'Status' },
    { key: 'startTime',        label: 'Start Time' },
    { key: 'duration',         label: 'Duration' },
    { key: 'recordsProcessed', label: 'Records' },
    { key: 'aiRiskScore',      label: 'AI Risk' },
    { key: 'retryCount',       label: 'Retries' },
  ];

  return (
    <Layout onRefresh={fetchJobs}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              ETL Job Executions
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Total Records: {total} executions tracked across Airflow and local simulators.
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={14} /> <span>Create New Job</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="card" style={{ flex: 1, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by job name, ID, or source..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: 13 }}
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 3 }}>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: status === s ? 700 : 500,
                  background: status === s ? 'var(--primary-light)' : 'transparent',
                  color: status === s ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Main Jobs Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {headers.map(h => (
                  <th
                    key={h.key}
                    className="table-th"
                    onClick={() => handleSort(h.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{h.label}</span>
                      {sortBy === h.key && (order === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialLoad ? (
                <TableSkeleton rows={8} cols={8} />
              ) : error ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--error)' }}>
                    <AlertCircle size={24} style={{ marginBottom: 8 }} /><br />
                    {error}
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No jobs match the current filter
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr
                    key={job.jobId || job._id}
                    className="table-row"
                    onClick={() => navigate(`/jobs/${job.jobId || job._id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="table-td" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {job.jobName}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{job.jobId}</div>
                    </td>
                    <td className="table-td">{job.source || 'Database'}</td>
                    <td className="table-td"><StatusBadge status={job.status} /></td>
                    <td className="table-td" style={{ fontSize: 11.5 }}>{formatDate(job.startTime)}</td>
                    <td className="table-td">{formatDuration(job.duration)}</td>
                    <td className="table-td">{formatNumber(job.recordsProcessed)}</td>
                    <td className="table-td"><RiskScore score={job.aiRiskScore != null ? job.aiRiskScore / 100 : 0.1} /></td>
                    <td className="table-td">{job.retryCount || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Footer */}
          {!initialLoad && pages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
              <Pagination page={page} pages={pages} onPageChange={setPage} />
            </div>
          )}
        </div>

        {/* Modal for Job Creation */}
        {showCreate && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}>
            <div className="card-elevated" style={{ width: 440, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>Create ETL Job</h3>
                <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Job Name</label>
                  <input
                    type="text"
                    required
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Sales_Data_Transform"
                    value={newJob.jobName}
                    onChange={e => setNewJob(j => ({ ...j, jobName: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Source System</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="PostgreSQL"
                      value={newJob.source}
                      onChange={e => setNewJob(j => ({ ...j, source: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Destination Target</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="Snowflake DW"
                      value={newJob.destination}
                      onChange={e => setNewJob(j => ({ ...j, destination: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={creating} className="btn-primary">
                    {creating ? 'Creating...' : 'Create Execution'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
