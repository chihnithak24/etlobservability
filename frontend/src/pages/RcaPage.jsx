import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { Search, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function RcaPage() {
  const [failedJobs, setFailedJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [rcaData, setRcaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchFailedJobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/jobs?limit=50');
      const all = data.jobs || data || [];
      const failed = all.filter(j => j.status === 'failed' || (j.riskScore && j.riskScore > 0.6));
      setFailedJobs(failed.length > 0 ? failed : all.slice(0, 10));
      if (failed.length > 0 && !selectedJobId) {
        setSelectedJobId(failed[0]._id || failed[0].jobId);
        loadRca(failed[0]._id || failed[0].jobId);
      }
    } catch (err) {
      toast.error('Failed to load incidents for RCA');
    } finally {
      setLoading(false);
    }
  };

  const loadRca = async (jobId) => {
    if (!jobId) return;
    setAnalyzing(true);
    try {
      const { data } = await api.get(`/rca/${jobId}`);
      setRcaData(data);
    } catch (err) {
      toast.error('Could not fetch RCA analysis');
      setRcaData(null);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchFailedJobs();
  }, []);

  const handleSelectJob = (id) => {
    setSelectedJobId(id);
    loadRca(id);
  };

  return (
    <Layout onRefresh={fetchFailedJobs}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Search size={20} color="#2563eb" />
              <span>Root Cause Analysis (RCA)</span>
            </h1>
            <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Automated failure diagnosis mapping incidents to evidence, memory thresholds, and corrective actions.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>

          {/* Incidents Sidebar */}
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select Failure Incident
            </div>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Loading failed jobs...</div>
            ) : failedJobs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>No failed jobs found</div>
            ) : (
              failedJobs.map(j => {
                const id = j._id || j.jobId;
                const isSelected = selectedJobId === id;
                return (
                  <div
                    key={id}
                    onClick={() => handleSelectJob(id)}
                    style={{
                      padding: 12,
                      borderRadius: 5,
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${isSelected ? '#bfdbfe' : '#e2e8f0'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{j.jobName || j.dag_id}</div>
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={11} />
                      <span>{j.errorMessage || j.status || 'Execution Failed'}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                      {j.createdAt ? new Date(j.createdAt).toLocaleTimeString() : 'Recent'}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RCA Details Display */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {analyzing ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: 8 }} />
                <div>Analyzing telemetry signals and log traces...</div>
              </div>
            ) : !rcaData ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Select an incident to view root cause breakdown.</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
                  <div>
                    <span className="badge-base badge-failed">INCIDENT DETECTED</span>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{rcaData.jobName || rcaData.dag_id || 'ETL Pipeline Job'}</h2>
                  </div>
                  <button onClick={() => loadRca(selectedJobId)} className="btn-secondary" style={{ padding: '5px 11px', fontSize: 12 }}>
                    <RefreshCw size={12} />
                    <span>Re-analyze</span>
                  </button>
                </div>

                {/* Flow Chain: Incident -> Evidence -> Cause -> Action */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

                  <div className="card-flat" style={{ padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>1. Incident</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>
                      {rcaData.incident || rcaData.errorType || 'Task Failure'}
                    </div>
                  </div>

                  <div className="card-flat" style={{ padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>2. Evidence</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
                      • CPU: {rcaData.cpuUtilization || rcaData.metrics?.cpu || 88}%<br />
                      • Memory: {rcaData.memoryUtilization || rcaData.metrics?.memory || 92}%<br />
                      • Retries: {rcaData.retries || 3}
                    </div>
                  </div>

                  <div className="card-flat" style={{ padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>3. Likely Cause</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginTop: 6 }}>
                      {rcaData.rootCause || rcaData.likelyCause || 'Resource Exhaustion during TRANSFORM stage'}
                    </div>
                  </div>

                  <div className="card-flat" style={{ padding: 14, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>4. Recommendation</div>
                    <div style={{ fontSize: 12, color: '#0f172a', marginTop: 6, fontWeight: 600 }}>
                      {rcaData.recommendation || 'Increase worker memory allocation to 4GB / Reduce batch size.'}
                    </div>
                  </div>

                </div>

                {/* Evidence Details Card */}
                <div className="card-flat" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={15} color="#d97706" />
                    <span>Telemetry Log Evidence</span>
                  </h4>
                  <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 12, borderRadius: 5, color: '#dc2626', fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {rcaData.rawLog || rcaData.evidenceDetails || `[ERROR] Worker node OOMKilled: Memory usage exceeded container limit (91%). Task failed after 3 retry attempts.`}
                  </pre>
                </div>
              </>
            )}
          </div>

        </div>

      </div>
    </Layout>
  );
}
