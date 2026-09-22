import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../utils/api';
import usePolling from '../hooks/usePolling';
import { Bell, CheckCircle, AlertTriangle, Brain, Filter, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_ICON  = { failure: AlertTriangle, warning: AlertTriangle, prediction: Brain, recovery: CheckCircle };
const TYPE_COLOR = { failure: '#dc2626', warning: '#d97706', prediction: '#7c3aed', recovery: '#16a34a' };
const TYPE_BG    = { failure: '#ffe4e6', warning: '#fef3c7', prediction: '#f3e8ff', recovery: '#dcfce7' };
const SEV_COLOR  = { critical: '#7c3aed', high: '#dc2626', medium: '#d97706', low: '#16a34a' };
const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'];
const TYPE_FILTERS = ['all', 'unread', 'failure', 'warning', 'prediction', 'recovery'];

function SummaryChip({ label, count, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '10px 16px', borderRadius: 6, cursor: 'pointer',
      background: active ? `${color}15` : 'var(--bg-card)',
      border: `1px solid ${active ? color : 'var(--border-color)'}`,
      transition: 'all 0.15s',
      minWidth: 80,
    }}>
      <span style={{ fontSize: 18, fontWeight: 800, color: active ? color : 'var(--text-main)', lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: active ? color : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </button>
  );
}

export default function Alerts() {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sevFilter, setSevFilter]   = useState('all');

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await api.get('/alerts?limit=50');
      setAlerts(data);
    } finally { setLoading(false); }
  }, []);

  usePolling(fetchAlerts, 10000);

  const markRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a));
    } catch { toast.error('Failed to mark as read'); }
  };

  const markAllRead = async () => {
    try {
      await api.put('/alerts/read-all');
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const filtered = alerts.filter(a => {
    if (typeFilter === 'unread' && a.read) return false;
    if (typeFilter !== 'all' && typeFilter !== 'unread' && a.type !== typeFilter) return false;
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
    return true;
  });

  const counts = {
    unread:   alerts.filter(a => !a.read).length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    high:     alerts.filter(a => a.severity === 'high').length,
    medium:   alerts.filter(a => a.severity === 'medium').length,
    low:      alerts.filter(a => a.severity === 'low').length,
  };

  return (
    <Layout onRefresh={fetchAlerts}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bell size={20} color="var(--primary)" />
              <span>ETL Alert Center</span>
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Automated notifications for pipeline failures, memory spikes, and AI risk threshold breaches.
            </p>
          </div>
          <button onClick={markAllRead} className="btn-secondary">
            <CheckCircle size={13} /> <span>Mark All Read</span>
          </button>
        </div>

        {/* Summary Row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SummaryChip label="Unread"   count={counts.unread}   color="var(--primary)" active={typeFilter === 'unread'}   onClick={() => setTypeFilter(f => f === 'unread' ? 'all' : 'unread')} />
          <SummaryChip label="Critical" count={counts.critical} color="#7c3aed" active={sevFilter  === 'critical'} onClick={() => setSevFilter(f => f === 'critical' ? 'all' : 'critical')} />
          <SummaryChip label="High"     count={counts.high}     color="var(--error)" active={sevFilter  === 'high'}     onClick={() => setSevFilter(f => f === 'high' ? 'all' : 'high')} />
          <SummaryChip label="Medium"   count={counts.medium}   color="var(--warning)" active={sevFilter  === 'medium'}   onClick={() => setSevFilter(f => f === 'medium' ? 'all' : 'medium')} />
          <SummaryChip label="Low"      count={counts.low}      color="var(--success)" active={sevFilter  === 'low'}      onClick={() => setSevFilter(f => f === 'low' ? 'all' : 'low')} />
        </div>

        {/* Filters */}
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
            <Filter size={13} /> Filter Type:
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {TYPE_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none',
                  fontSize: 11.5, fontWeight: typeFilter === f ? 700 : 500,
                  background: typeFilter === f ? 'var(--primary-light)' : 'transparent',
                  color: typeFilter === f ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts List */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading alert log...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShieldAlert size={32} color="var(--border-color)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>No matching alerts found</div>
            </div>
          ) : (
            filtered.map(al => {
              const Icon  = TYPE_ICON[al.type]  || Bell;
              const color = TYPE_COLOR[al.type] || 'var(--text-muted)';
              const bg    = TYPE_BG[al.type]    || 'var(--bg-subtle)';
              const sevColor = SEV_COLOR[al.severity] || 'var(--text-muted)';

              return (
                <div
                  key={al._id}
                  style={{
                    display: 'flex', gap: 14, padding: 16, borderBottom: '1px solid var(--border-color)',
                    background: !al.read ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    alignItems: 'flex-start', opacity: al.read ? 0.7 : 1,
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 6, background: bg, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={color} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{al.jobName}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}30`, textTransform: 'uppercase' }}>
                        {al.severity}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{al.jobId}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>{al.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      {new Date(al.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {!al.read && (
                    <button
                      onClick={() => markRead(al._id)}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </Layout>
  );
}
