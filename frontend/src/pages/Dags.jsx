import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { GitBranch, Play, RefreshCw, CheckCircle2, Clock, Activity, Search } from 'lucide-react';
import api, { airflow } from '../utils/api';
import toast from 'react-hot-toast';

export default function Dags() {
  const [dags, setDags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [triggering, setTriggering] = useState({});
  const [selectedDag, setSelectedDag] = useState(null);

  const fetchDags = async () => {
    setLoading(true);
    try {
      const [airflowRes, jobsRes] = await Promise.all([
        airflow.getDags().catch(() => ({ data: [] })),
        api.get('/jobs?limit=100').catch(() => ({ data: [] })),
      ]);

      const airflowDags = Array.isArray(airflowRes.data) ? airflowRes.data : (airflowRes.data?.dags || []);
      const jobs = jobsRes.data?.jobs || jobsRes.data || [];

      if (airflowDags.length > 0) {
        setDags(airflowDags);
        if (!selectedDag && airflowDags.length > 0) setSelectedDag(airflowDags[0]);
      } else {
        const grouped = {};
        jobs.forEach(j => {
          const name = j.dag_id || j.jobName || 'etl_pipeline';
          if (!grouped[name]) {
            grouped[name] = {
              dag_id: name,
              description: `Automated ETL pipeline processing ${name}`,
              is_paused: false,
              schedule_interval: '0 * * * *',
              last_run: j.createdAt,
              total_runs: 0,
              success_rate: 95,
              status: j.status || 'success',
            };
          }
          grouped[name].total_runs += 1;
        });
        const list = Object.values(grouped);
        setDags(list);
        if (!selectedDag && list.length > 0) setSelectedDag(list[0]);
      }
    } catch (err) {
      toast.error('Failed to load DAG pipelines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDags();
  }, []);

  const handleTrigger = async (dagId) => {
    setTriggering(prev => ({ ...prev, [dagId]: true }));
    try {
      await airflow.triggerRun(dagId);
      toast.success(`Triggered DAG: ${dagId}`);
      fetchDags();
    } catch (err) {
      toast.error(`Trigger failed for ${dagId}`);
    } finally {
      setTriggering(prev => ({ ...prev, [dagId]: false }));
    }
  };

  const filteredDags = dags.filter(d =>
    (d.dag_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout onRefresh={fetchDags}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <GitBranch size={20} color="var(--primary)" />
              <span>ETL DAG Pipelines</span>
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Monitor, schedule, and trigger Apache Airflow DAG workflows and task graph flows.
            </p>
          </div>
          <button onClick={fetchDags} className="btn-secondary">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh Pipelines</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search DAG by ID or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: 13 }}
          />
        </div>

        {/* Visual Graph View */}
        {selectedDag && (
          <div className="card" style={{ padding: 20, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Pipeline Task Graph</span>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{selectedDag.dag_id}</h3>
              </div>
              <button
                onClick={() => handleTrigger(selectedDag.dag_id)}
                disabled={triggering[selectedDag.dag_id]}
                className="btn-primary"
              >
                <Play size={13} />
                <span>Trigger DAG Run</span>
              </button>
            </div>

            {/* Visual Task Nodes */}
            <div style={{
              padding: '24px 16px',
              background: 'var(--bg-subtle)',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              position: 'relative'
            }}>
              {[
                { stage: 'EXTRACT', label: 'Ingest Source Data', icon: Activity, color: '#2563eb' },
                { stage: 'VALIDATE', label: 'Schema & Quality Check', icon: CheckCircle2, color: '#16a34a' },
                { stage: 'TRANSFORM', label: 'Business Logic & Aggregation', icon: GitBranch, color: 'var(--primary)' },
                { stage: 'LOAD', label: 'Warehouse Target Load', icon: Clock, color: '#d97706' }
              ].map((node, i, arr) => {
                const Icon = node.icon;
                return (
                  <React.Fragment key={node.stage}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 2 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: 'var(--bg-card)',
                        border: `2px solid ${node.color}`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: node.color
                      }}>
                        <Icon size={20} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: node.color }}>{node.stage}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{node.label}</div>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{
                        height: 2, flex: 1, background: 'var(--border-color)', margin: '0 8px'
                      }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* DAG Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
            All Airflow DAGs ({filteredDags.length})
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="table-th">DAG ID</th>
                <th className="table-th">Schedule</th>
                <th className="table-th">Status</th>
                <th className="table-th">Last Run</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading DAG pipelines...</td>
                </tr>
              ) : filteredDags.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No DAG pipelines found</td>
                </tr>
              ) : (
                filteredDags.map(dag => (
                  <tr
                    key={dag.dag_id}
                    className="table-row"
                    onClick={() => setSelectedDag(dag)}
                    style={{ cursor: 'pointer', background: selectedDag?.dag_id === dag.dag_id ? 'var(--primary-light)' : undefined }}
                  >
                    <td className="table-td" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GitBranch size={14} color="var(--primary)" />
                        <span>{dag.dag_id}</span>
                      </div>
                    </td>
                    <td className="table-td" style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                      {dag.schedule_interval || '0 * * * *'}
                    </td>
                    <td className="table-td">
                      <span className="badge-base badge-success">ACTIVE</span>
                    </td>
                    <td className="table-td" style={{ fontSize: 11.5 }}>
                      {dag.last_run ? new Date(dag.last_run).toLocaleString() : 'Recent'}
                    </td>
                    <td className="table-td" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleTrigger(dag.dag_id)}
                        disabled={triggering[dag.dag_id]}
                        className="btn-secondary"
                        style={{ padding: '3px 9px', fontSize: 11 }}
                      >
                        <Play size={11} />
                        <span>Trigger</span>
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
