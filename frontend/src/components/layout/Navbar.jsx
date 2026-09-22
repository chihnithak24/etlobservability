import { Bell, Search, LogOut, RefreshCw, X, CheckCircle, AlertTriangle, Brain, Sun, Feather, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

const ROUTE_LABELS = {
  '/':           'Dashboard',
  '/dags':       'DAG Pipelines',
  '/jobs':       'ETL Jobs',
  '/monitoring': 'Live Monitoring',
  '/analytics':  'Analytics',
  '/alerts':     'Alerts',
  '/prediction': 'AI Predictions',
  '/rca':        'Root Cause Analysis',
  '/recovery':   'Recovery Hub',
  '/logs':       'Log Viewer',
  '/reports':    'Reports',
  '/settings':   'Settings',
  '/about':      'About',
};

const TYPE_ICON  = { failure: AlertTriangle, warning: AlertTriangle, prediction: Brain, recovery: CheckCircle };
const TYPE_COLOR = { failure: 'var(--error)', warning: 'var(--warning)', prediction: '#8b5cf6', recovery: 'var(--success)' };

function useTime() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useNotifications() {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/alerts?limit=6');
      setNotifs(Array.isArray(data) ? data.slice(0, 6) : []);
    } catch { /**/ } finally { setLoading(false); }
  };
  const markRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch { /**/ }
  };
  const markAllRead = async () => {
    try {
      await api.put('/alerts/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /**/ }
  };
  useEffect(() => { load(); }, []);
  return { notifs, loading, refresh: load, markRead, markAllRead };
}

export default function Navbar({ onRefresh }) {
  const { user, logout }   = useAuth();
  const navigate           = useNavigate();
  const location           = useLocation();
  const now                = useTime();

  const [search, setSearch]               = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const notifRef = useRef(null);

  const { notifs, loading: nLoading, refresh: refreshNotifs, markRead, markAllRead } = useNotifications();
  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/jobs?search=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh?.(); } finally { setTimeout(() => setRefreshing(false), 600); }
  };

  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageLabel = ROUTE_LABELS[location.pathname]
    || (pathParts[0] ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1) : 'Dashboard');

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header style={{
      height: 52,
      background: 'var(--bg-navbar)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexShrink: 0,
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>ETL Observability</span>
        <span style={{ fontSize: 12, color: 'var(--border-color)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{pageLabel}</span>
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border-color)', flexShrink: 0 }} />

      {/* ── Search Bar ── */}
      <div style={{
        flex: 1, maxWidth: 300,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 32,
        background: 'var(--bg-input)',
        border: `1px solid ${searchFocused ? 'var(--primary)' : 'var(--border-color)'}`,
        borderRadius: 5,
        transition: 'border-color 0.16s, background 0.16s',
        boxShadow: searchFocused ? '0 0 0 3px var(--primary-light)' : 'none',
      }}>
        <Search size={14} color={searchFocused ? 'var(--primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
        <input
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-main)', fontSize: 12.5, fontFamily: 'inherit',
          }}
          placeholder="Search DAGs, tasks, jobs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Right cluster ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>

        {/* Clock */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          paddingRight: 12, borderRight: '1px solid var(--border-color)', marginRight: 2,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dateStr}</span>
        </div>

        {/* Refresh */}
        {onRefresh && (
          <button onClick={handleRefresh} className="btn-secondary" style={{ padding: '4px 10px', gap: 6, fontSize: 12 }}>
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        )}

        {/* Live indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          background: 'var(--success-bg)', border: '1px solid var(--success-border)',
          borderRadius: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', letterSpacing: '0.04em' }}>LIVE</span>
        </div>

        {/* Bell */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(o => !o); if (!notifOpen) refreshNotifs(); }}
            style={{
              position: 'relative', width: 32, height: 32,
              background: notifOpen ? 'var(--primary-light)' : 'var(--bg-card)',
              border: `1px solid ${notifOpen ? 'var(--primary)' : 'var(--border-color)'}`,
              borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: notifOpen ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'all 0.14s',
            }}
          >
            <Bell size={14} strokeWidth={1.8} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3,
                background: 'var(--error)', color: 'white', fontSize: 9.5,
                fontWeight: 800, padding: '1px 5px', borderRadius: 10, border: '2px solid var(--bg-card)'
              }}>
                {unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="card-elevated" style={{ position: 'absolute', right: 0, top: 38, width: 340, zIndex: 100 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={14} color="var(--primary)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>Alert Notifications</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {unread > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => { setNotifOpen(false); navigate('/alerts'); }} style={{ fontSize: 11.5, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    View all →
                  </button>
                </div>
              </div>

              {/* Items */}
              {nLoading ? (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[80, 60, 70].map((w, i) => <div key={i} className="skeleton" style={{ height: 14, width: `${w}%` }} />)}
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                  <CheckCircle size={20} color="var(--success)" style={{ marginBottom: 6, opacity: 0.8 }} /><br />All caught up
                </div>
              ) : notifs.map(n => {
                const Icon  = TYPE_ICON[n.type]  || Bell;
                const color = TYPE_COLOR[n.type] || 'var(--text-muted)';
                return (
                  <div
                    key={n._id}
                    onClick={() => { markRead(n._id); setNotifOpen(false); navigate('/alerts'); }}
                    style={{
                      display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer', background: !n.read ? 'var(--primary-light)' : 'var(--bg-card)',
                      opacity: n.read ? 0.75 : 1,
                    }}
                  >
                    <div style={{ width: 28, height: 28, background: `${color}15`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: !n.read ? 700 : 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.jobName}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                    </div>
                  </div>
                );
              })}

              {/* Footer */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
                <button onClick={() => { setNotifOpen(false); navigate('/alerts'); }} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                  Open Alerts Center
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px 4px 5px',
          background: 'var(--bg-subtle)', border: '1px solid var(--border-color)',
          borderRadius: 5,
        }}>
          <div style={{
            width: 24, height: 24, background: 'var(--primary)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'white', fontWeight: 800, flexShrink: 0,
          }}>
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 9.5, color: 'var(--primary)', fontWeight: 700, textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: 'pointer',
            color: 'var(--text-secondary)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 5, transition: 'all 0.14s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--error-bg)'; e.currentTarget.style.borderColor = 'var(--error-border)'; e.currentTarget.style.color = 'var(--error)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <LogOut size={14} strokeWidth={1.9} />
        </button>
      </div>
    </header>
  );
}
