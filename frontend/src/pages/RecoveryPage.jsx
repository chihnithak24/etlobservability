import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { RefreshCw, RotateCcw } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function RecoveryPage() {
  const [recoveries, setRecoveries] = useState([]);
  const [stats, setStats] = useState({ totalRecoveries: 0, successful: 0, autoRecoveries: 0 });
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState({});

  const fetchRecoveryData = async () => {
    setLoading(true);
    try {
      const [statsRes, jobsRes] = await Promise.all([
        api.get('/recovery/stats').catch(() => ({ data: {} })),
        api.get('/jobs?limit=50').catch(() => ({ data: [] })),
      ]);

      const jobs = jobsRes.data?.jobs || jobsRes.data || [];
      const failed = jobs.filter(j => j.status === 'failed' || j.retries > 0);

      const items = failed.map((j) => ({
        id: j._id || j.jobId,
        jobName: j.jobName || j.name || j.dag_id,
        status: j.status === 'failed' ? 'RETRY_PENDING' : 'AUTO_RECOVERED',
        attempt: `${j.retries || 1}/3`,
        action: j.status === 'failed' ? 'Restart Task Node' : 'Automatic Retry',
        result: j.status === 'failed' ? 'Awaiting Action' : 'SUCCESS',
        timestamp: j.updatedAt || j.createdAt,
      }));

      setRecoveries(items);
      setStats({
        totalRecoveries: items.length,
        successful: items.filter(i => i.result === 'SUCCESS').length,
        autoRecoveries: items.filter(i => i.status === 'AUTO_RECOVERED').length,
        ...(statsRes.data || {})
      });
    } catch (err) {
      toast.error('Failed to load recovery history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecoveryData();
  }, []);

  const handleTriggerRecovery = async (jobId) => {
    setRetryingId(prev => ({ ...prev, [jobId]: true }));
    try {
      await api.post(`/jobs/${jobId}/retry`).catch(() => api.post(`/recovery/${jobId}/trigger`));
      toast.success('Recovery retry triggered successfully!');
      fetchRecoveryData();
    } catch (err) {
      toast.error('Failed to trigger recovery retry');
    } finally {
      setRetryingId(prev => ({ ...prev, [jobId]: false }));
    }
  };

  return (
    <Layout onRefresh={fetchRecoveryData}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <RefreshCw size={20} color="#2563eb" />
              <span>Pipeline Recovery Hub</span>
            </h1>
            <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Automated circuit breakers, self-healing pipeline retries, and manual recovery management.
            </p>
          </div>
          <button onClick={fetchRecoveryData} className="btn-secondary">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Heals Triggered</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{stats.totalRecoveries || recoveries.length}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Successful Heals</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{stats.successful || 0}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Self-Healing Automations</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>{stats.autoRecoveries || 0}</div>
          </div>
        </div>

        {/* Recoveries Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            Pipeline Recovery Actions & Log History
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">Job / DAG Name</th>
                <th className="table-th">Recovery Status</th>
                <th className="table-th">Attempt</th>
                <th className="table-th">Recovery Action</th>
                <th className="table-th">Result</th>
                <th className="table-th">Timestamp</th>
                <th className="table-th">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Loading recovery events...</td>
                </tr>
              ) : recoveries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>No recovery events recorded</td>
                </tr>
              ) : (
                recoveries.map(item => (
                  <tr key={item.id} className="table-row">
                    <td className="table-td" style={{ fontWeight: 700, color: '#0f172a' }}>{item.jobName}</td>
                    <td className="table-td">
                      <span className={`badge-base ${item.status === 'AUTO_RECOVERED' ? 'badge-success' : 'badge-warning'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="table-td" style={{ fontFamily: 'monospace' }}>{item.attempt}</td>
                    <td className="table-td">{item.action}</td>
                    <td className="table-td" style={{ fontWeight: 700, color: item.result === 'SUCCESS' ? '#16a34a' : '#d97706' }}>
                      {item.result}
                    </td>
                    <td className="table-td" style={{ fontSize: 11.5 }}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recent'}
                    </td>
                    <td className="table-td">
                      <button
                        onClick={() => handleTriggerRecovery(item.id)}
                        disabled={retryingId[item.id]}
                        className="btn-secondary"
                        style={{ padding: '3px 9px', fontSize: 11 }}
                      >
                        <RotateCcw size={11} className={retryingId[item.id] ? 'spin' : ''} />
                        <span>Retry</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </Layout>
  );
}
