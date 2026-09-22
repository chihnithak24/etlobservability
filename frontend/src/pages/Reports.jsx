import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import StatusBadge from '../components/ui/StatusBadge';
import api from '../utils/api';
import { formatDuration, formatDate, formatNumber } from '../utils/helpers';
import { FileText, Download, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Reports() {
  const [jobs, setJobs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [j, a] = await Promise.all([api.get('/jobs?limit=100'), api.get('/analytics')]);
      setJobs(j.data.jobs);
      setAnalytics(a.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data');
      toast.error('Failed to load report data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportCSV = () => {
    const headers = ['Job ID', 'Name', 'Source', 'Destination', 'Status', 'Start Time', 'Duration', 'Records', 'CPU%', 'Memory%', 'Retries', 'AI Risk', 'Failure Reason'];
    const rows = jobs.map(j => [
      j.jobId, `"${j.jobName}"`, j.source, j.destination, j.status,
      formatDate(j.startTime), formatDuration(j.duration), j.recordsProcessed,
      j.cpuUsage, j.memoryUsage, j.retryCount, j.aiRiskScore,
      `"${j.failureReason || ''}"`
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etl-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Report exported!');
  };

  return (
    <Layout onRefresh={fetchData}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Reports</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>ETL job performance reports and exports</p>
          </div>
          <button onClick={exportCSV} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 8 }}>
            <AlertCircle size={16} color="var(--error)" />
            <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
            <button onClick={fetchData} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--error)', background: 'none', border: '1px solid var(--error-border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Summary Cards */}
        {analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Jobs', value: analytics.total, color: 'var(--primary)' },
              { label: 'Success Rate', value: `${analytics.successRate}%`, color: 'var(--success)' },
              { label: 'Total Failed', value: analytics.failed, color: 'var(--error)' },
              { label: 'Avg Risk Score', value: `${Math.round(jobs.reduce((s, j) => s + (j.aiRiskScore || 0), 0) / (jobs.length || 1))}`, color: 'var(--warning)' },
              { label: 'Total Retries', value: jobs.reduce((s, j) => s + j.retryCount, 0), color: '#fb923c' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Full Report Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>Full Job Report ({jobs.length} jobs)</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
                  {['Job ID', 'Name', 'Source', 'Destination', 'Status', 'Start Time', 'Duration', 'Records', 'CPU%', 'Mem%', 'Retries', 'Risk', 'Failure Reason'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={13} style={{ padding: '12px 14px', background: 'var(--bg-subtle)', height: 40 }} /></tr>
                )) : jobs.map(job => (
                  <tr key={job.jobId} className="table-row">
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>{job.jobId}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-main)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.jobName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{job.source}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{job.destination}</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={job.status} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(job.startTime)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{formatDuration(job.duration)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{formatNumber(job.recordsProcessed)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: job.cpuUsage > 80 ? 'var(--error)' : 'var(--text-secondary)' }}>{job.cpuUsage}%</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: job.memoryUsage > 80 ? 'var(--error)' : 'var(--text-secondary)' }}>{job.memoryUsage}%</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: job.retryCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{job.retryCount}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: job.aiRiskScore >= 70 ? 'var(--error)' : job.aiRiskScore >= 40 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>{job.aiRiskScore}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--error)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.failureReason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
