import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Activity, BarChart3, FileText,
  Settings, Bell, Brain, Shield, ChevronLeft, ChevronRight, ScrollText, Info,
  GitBranch, RefreshCw, Search
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/',           icon: LayoutDashboard, label: 'Dashboard'       },
      { to: '/monitoring', icon: Activity,        label: 'Live Monitor', live: true },
    ],
  },
  {
    label: 'Pipelines & Jobs',
    items: [
      { to: '/dags',       icon: GitBranch,       label: 'DAG Workflows'   },
      { to: '/jobs',       icon: Briefcase,       label: 'ETL Jobs'        },
      { to: '/logs',       icon: ScrollText,      label: 'Log Viewer'      },
    ],
  },
  {
    label: 'AI & Observability',
    items: [
      { to: '/prediction', icon: Brain,           label: 'AI Predictions'  },
      { to: '/alerts',     icon: Bell,            label: 'Alerts & RCA'    },
      { to: '/analytics',  icon: BarChart3,       label: 'Analytics'       },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings',   icon: Settings,        label: 'Settings'        },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const W = collapsed ? 56 : 220;

  return (
    <aside
      style={{
        width: W,
        minHeight: '100vh',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        zIndex: 50,
      }}
    >
      {/* ── Logo rail ── */}
      <div style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '0 12px' : '0 16px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        justifyContent: collapsed ? 'center' : 'flex-start',
        overflow: 'hidden',
      }}>
        <div style={{
          width: 30, height: 30, flexShrink: 0,
          background: 'var(--primary)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <Shield size={16} color="white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div style={{ flex: 1, overflow: 'hidden', lineHeight: 1.25 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              ETL Observability
            </div>
            <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.04em', marginTop: 1 }}>
              ENTERPRISE PLATFORM
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav style={{
        flex: 1,
        padding: collapsed ? '10px 6px' : '10px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {NAV.map((group, gi) => (
          <div key={group.label}>
            {/* Group label */}
            {!collapsed ? (
              <div className="sidebar-section">{group.label}</div>
            ) : gi > 0 ? (
              <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 4px' }} />
            ) : <div style={{ height: 6 }} />}

            {group.items.map(({ to, icon: Icon, label, live }) => {
              const isActive = to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(to);

              return (
                <div key={to} style={{ display: 'block', marginBottom: 2 }}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={`sidebar-item${isActive ? ' active' : ''}`}
                    style={collapsed ? { justifyContent: 'center', padding: '8px 0' } : {}}
                    title={collapsed ? label : undefined}
                  >
                    <Icon
                      size={16}
                      strokeWidth={isActive ? 2.3 : 1.8}
                      color={isActive ? 'var(--primary)' : 'var(--text-secondary)'}
                      style={{ flexShrink: 0 }}
                    />
                    {!collapsed && (
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>
                        {label}
                      </span>
                    )}
                    {!collapsed && live && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', marginLeft: 'auto' }} />
                    )}
                  </NavLink>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Status chip ── */}
      {!collapsed && (
        <div style={{
          margin: '0 10px 10px',
          padding: '8px 12px',
          background: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--success)' }}>Systems Operational</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>v2.4.1 · Monitoring Active</div>
          </div>
        </div>
      )}

      {/* ── Collapse toggle ── */}
      <div style={{ padding: collapsed ? '8px 6px' : '8px 10px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: 7,
            padding: collapsed ? '7px 0' : '7px 11px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 5,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 11.5,
            fontWeight: 600,
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-main)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <><span>Collapse</span><ChevronLeft size={14} /></>
          }
        </button>
      </div>
    </aside>
  );
}
