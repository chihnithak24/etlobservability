import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Settings as SettingsIcon,
  Bell,
  Brain,
  Mail,
  Database,
  Save,
  Play,
  AlertTriangle,
  CheckCircle,
  Zap,
  Clock,
  Shield,
  RotateCcw,
  Cpu,
  Server,
  Info,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* --------------------------------------------------
   Colors
-------------------------------------------------- */

const BG = 'var(--bg-main)';
const PANEL = 'var(--bg-card)';
const FLAT = 'var(--bg-subtle)';
const BORDER = 'var(--border-color)';
const BORDER2 = 'var(--border-subtle)';

const T1 = 'var(--text-main)';
const T2 = 'var(--text-secondary)';
const T3 = 'var(--text-muted)';

const ACCENT = 'var(--primary)';

/* --------------------------------------------------
   Default Settings
-------------------------------------------------- */

const DEFAULTS = {
  ai: {
    riskThreshold: 70,
    confidenceThreshold: 80,
    autoRetry: true,
    maxRetries: 3,
    predictionEnabled: true,
    highRiskEmailEnabled: true,
  },

  alerts: {
    emailAlerts: true,
    failureAlerts: true,
    predictionAlerts: true,
    recoveryAlerts: false,
    warningAlerts: true,
    criticalOnly: false,
    muteUntil: null,
  },

  email: {
    smtpHost: 'smtp.example.com',
    smtpPort: '587',
    smtpSecure: false,
    fromEmail: 'etl-alerts@company.com',
    toEmail: 'admin@company.com',
    smtpUser: '',
    smtpPass: '',
  },

  system: {
    refreshInterval: 15,
    logRetentionDays: 30,
    timezone: 'UTC',
    theme: 'light',
    compactMode: false,
    developerMode: false,
  },
};

const TABS = [
  {
    id: 'ai',
    label: 'AI & Recovery',
    icon: Brain,
    color: '#a78bfa',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: Bell,
    color: '#fbbf24',
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    color: '#34d399',
  },
  {
    id: 'system',
    label: 'System',
    icon: Database,
    color: '#7c6bf0',
  },
];
/* --------------------------------------------------
   Reusable Components
-------------------------------------------------- */

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: `1px solid ${checked ? ACCENT : BORDER}`,
        background: checked ? ACCENT : FLAT,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .2s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left .2s ease',
        }}
      />
    </button>
  );
}

function SettingRow({ label, description, children, mono = false }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '14px 0',
        borderBottom: `1px solid ${BORDER2}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T1,
            fontFamily: mono ? 'monospace' : 'inherit',
          }}
        >
          {label}
        </div>

        {description && (
          <div
            style={{
              fontSize: 11,
              color: T3,
              marginTop: 3,
            }}
          >
            {description}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

function SettingRowLast({ label, description, children }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '14px 0',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T1,
          }}
        >
          {label}
        </div>

        {description && (
          <div
            style={{
              fontSize: 11,
              color: T3,
              marginTop: 3,
            }}
          >
            {description}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
function SliderField({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T1,
            }}
          >
            {label}
          </div>

          {description && (
            <div
              style={{
                fontSize: 11,
                color: T3,
                marginTop: 2,
              }}
            >
              {description}
            </div>
          )}
        </div>

        <span
          style={{
            color: ACCENT,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {value}
          {unit}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: ACCENT,
          cursor: 'pointer',
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: T3,
        }}
      >
        <span>
          {min}
          {unit}
        </span>

        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  color = ACCENT,
  badge,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={15} color={color} />
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: T1,
        }}
      >
        {title}
      </div>

      {badge}
    </div>
  );
}

function StatusPill({ ok, label }) {
  const color = ok ? '#22c55e' : '#ef4444';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        background: `${color}15`,
        color,
        fontWeight: 600,
        fontSize: 11,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
        }}
      />

      {label}
    </span>
  );
}
function MetricBox({ label, value, color = T2, mono = false }) {
  return (
    <div
      style={{
        flex: 1,
        background: FLAT,
        border: `1px solid ${BORDER2}`,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: T3,
          fontWeight: 700,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color,
          fontFamily: mono ? 'monospace' : 'inherit',
        }}
      >
        {value ?? '--'}
      </div>
    </div>
  );
}

function EventBadge({ type }) {
  const styles = {
    success: {
      color: '#22c55e',
      label: 'SUCCESS',
    },
    failed: {
      color: '#ef4444',
      label: 'FAILED',
    },
    warning: {
      color: '#f59e0b',
      label: 'WARNING',
    },
    running: {
      color: '#3b82f6',
      label: 'RUNNING',
    },
    prediction: {
      color: '#8b5cf6',
      label: 'PREDICTION',
    },
    recovery: {
      color: '#10b981',
      label: 'RECOVERY',
    },
  };

  const item = styles[type] || {
    color: '#6b7280',
    label: type,
  };

  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 700,
        color: item.color,
        background: `${item.color}15`,
        border: `1px solid ${item.color}35`,
      }}
    >
      {item.label}
    </span>
  );
}

function SwitchField({ label, description, checked, onChange }) {
  return (
    <SettingRow label={label} description={description}>
      <Toggle checked={checked} onChange={onChange} />
    </SettingRow>
  );
}

function TextField({ label, description, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <SettingRow label={label} description={description}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        style={{
          width: 230,
          background: FLAT,
          color: T1,
          border: `1px solid ${BORDER2}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 12,
        }}
      />
    </SettingRow>
  );
}

function NumberField({ label, description, value, onChange, min, max, step = 1 }) {
  return (
    <SettingRow label={label} description={description}>
      <input
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        type="number"
        min={min}
        max={max}
        step={step}
        style={{
          width: 120,
          background: FLAT,
          color: T1,
          border: `1px solid ${BORDER2}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 12,
        }}
      />
    </SettingRow>
  );
}

function SelectField({ label, description, value, onChange, options }) {
  return (
    <SettingRow label={label} description={description}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 180,
          background: FLAT,
          color: T1,
          border: `1px solid ${BORDER2}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 12,
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </SettingRow>
  );
}

function AITab({ cfg, set }) {
  return (
    <div>
      <PanelHeader icon={Brain} title="AI & Recovery" color="#a78bfa" />
      <div>
        <NumberField
          label="Risk threshold"
          description="Trigger high-risk alerts when AI score exceeds this value."
          value={cfg.riskThreshold}
          min={0}
          max={100}
          onChange={(value) => set('riskThreshold', value)}
        />
        <NumberField
          label="Confidence threshold"
          description="Minimum model confidence required to take action."
          value={cfg.confidenceThreshold}
          min={0}
          max={100}
          onChange={(value) => set('confidenceThreshold', value)}
        />
        <SwitchField
          label="Auto retry"
          description="Automatically retry failed jobs when Airflow clears them."
          checked={cfg.autoRetry}
          onChange={(value) => set('autoRetry', value)}
        />
        <NumberField
          label="Max retries"
          description="Maximum retry attempts for failed jobs."
          value={cfg.maxRetries}
          min={0}
          max={10}
          onChange={(value) => set('maxRetries', value)}
        />
        <SwitchField
          label="Prediction enabled"
          description="Enable AI risk prediction for new jobs."
          checked={cfg.predictionEnabled}
          onChange={(value) => set('predictionEnabled', value)}
        />
        <SwitchField
          label="High-risk email"
          description="Send email alerts for high-risk jobs."
          checked={cfg.highRiskEmailEnabled}
          onChange={(value) => set('highRiskEmailEnabled', value)}
        />
      </div>
    </div>
  );
}

function AlertsTab({ cfg, set }) {
  return (
    <div>
      <PanelHeader icon={Bell} title="Alerts" color="#fbbf24" />
      <div>
        <SwitchField
          label="Email alerts"
          description="Enable or disable email notifications for alerts."
          checked={cfg.emailAlerts}
          onChange={(value) => set('emailAlerts', value)}
        />
        <SwitchField
          label="Failure alerts"
          description="Notify when jobs fail."
          checked={cfg.failureAlerts}
          onChange={(value) => set('failureAlerts', value)}
        />
        <SwitchField
          label="Prediction alerts"
          description="Notify when AI predicts a potential issue."
          checked={cfg.predictionAlerts}
          onChange={(value) => set('predictionAlerts', value)}
        />
        <SwitchField
          label="Recovery alerts"
          description="Notify when recovery actions are taken."
          checked={cfg.recoveryAlerts}
          onChange={(value) => set('recoveryAlerts', value)}
        />
        <SwitchField
          label="Warning alerts"
          description="Notify on warning-level job conditions."
          checked={cfg.warningAlerts}
          onChange={(value) => set('warningAlerts', value)}
        />
        <SwitchField
          label="Critical only"
          description="Send alerts only for critical issues."
          checked={cfg.criticalOnly}
          onChange={(value) => set('criticalOnly', value)}
        />
      </div>
    </div>
  );
}

function EmailTab({ cfg, set }) {
  return (
    <div>
      <PanelHeader icon={Mail} title="Email" color="#34d399" />
      <div>
        <TextField
          label="SMTP host"
          description="The outgoing SMTP server hostname."
          value={cfg.smtpHost}
          onChange={(value) => set('smtpHost', value)}
          placeholder="smtp.example.com"
        />
        <NumberField
          label="SMTP port"
          description="SMTP server port, for example 587."
          value={Number(cfg.smtpPort)}
          min={1}
          max={65535}
          onChange={(value) => set('smtpPort', String(value))}
        />
        <SwitchField
          label="Secure SMTP"
          description="Use SSL/TLS for email delivery."
          checked={cfg.smtpSecure}
          onChange={(value) => set('smtpSecure', value)}
        />
        <TextField
          label="From email"
          description="Sender address used for alert emails."
          value={cfg.fromEmail}
          onChange={(value) => set('fromEmail', value)}
        />
        <TextField
          label="To email"
          description="Recipient address for alert emails."
          value={cfg.toEmail}
          onChange={(value) => set('toEmail', value)}
        />
        <TextField
          label="SMTP user"
          description="SMTP authentication username, if required."
          value={cfg.smtpUser}
          onChange={(value) => set('smtpUser', value)}
        />
        <TextField
          label="SMTP password"
          description="SMTP authentication password, if required."
          value={cfg.smtpPass}
          onChange={(value) => set('smtpPass', value)}
          type="password"
        />
      </div>
    </div>
  );
}

function SystemTab({ cfg, set, user }) {
  return (
    <div>
      <PanelHeader icon={Database} title="System" color="#7c6bf0" />
      <div>
        <NumberField
          label="Refresh interval"
          description="Page polling interval in seconds."
          value={cfg.refreshInterval}
          min={5}
          max={60}
          onChange={(value) => set('refreshInterval', value)}
        />
        <NumberField
          label="Log retention"
          description="How many days logs should be kept."
          value={cfg.logRetentionDays}
          min={1}
          max={365}
          onChange={(value) => set('logRetentionDays', value)}
        />
        <TextField
          label="Timezone"
          description="Timezone for scheduled job displays."
          value={cfg.timezone}
          onChange={(value) => set('timezone', value)}
          placeholder="UTC"
        />
        <SelectField
          label="Theme"
          description="Application theme preference."
          value={cfg.theme}
          onChange={(value) => set('theme', value)}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'soft-light', label: 'Soft Light' },
          ]}
        />
        <SwitchField
          label="Compact mode"
          description="Use a tighter interface layout."
          checked={cfg.compactMode}
          onChange={(value) => set('compactMode', value)}
        />
        <SwitchField
          label="Developer mode"
          description="Show advanced diagnostics for debugging."
          checked={cfg.developerMode}
          onChange={(value) => set('developerMode', value)}
        />
        <SettingRow label="Current user" description="Signed in user for this session.">
          <div style={{ color: T1, fontSize: 12, fontFamily: 'monospace' }}>{user?.email || 'unknown'}</div>
        </SettingRow>
      </div>
    </div>
  );
}

/* -----------------------------
   Main Settings Component
------------------------------ */

export default function Settings() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("ai");
  const [cfg, setCfg] = useState(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const setSection = (section, key, value) => {
    setCfg(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);

    await new Promise(resolve => setTimeout(resolve, 500));

    setSaving(false);
    setDirty(false);

    toast.success("Settings saved");
  };

  const reset = () => {
    setCfg(DEFAULTS);
    setDirty(false);
    toast("Settings reset", { icon: "↺" });
  };

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: T1,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              Settings
            </h1>

            <p
              style={{
                marginTop: 5,
                color: T3,
                fontSize: 13,
              }}
            >
              Configure AI, Alerts and System.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {dirty && (
              <button className="btn-ghost" onClick={reset}>
                Reset
              </button>
            )}

            <button
              className="btn-primary"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {dirty && (
          <div
            style={{
              background: "rgba(251,191,36,.08)",
              border: "1px solid rgba(251,191,36,.25)",
              color: "#fbbf24",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            Unsaved changes detected.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px 1fr",
            gap: 18,
          }}
        >
          {/* Sidebar */}
          <div className="card" style={{ padding: 8 }}>
            {TABS.map(tab => {
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px",
                    marginBottom: 5,
                    border: "none",
                    cursor: "pointer",
                    borderRadius: 8,
                    background:
                      activeTab === tab.id
                        ? `${tab.color}20`
                        : "transparent",
                    color:
                      activeTab === tab.id
                        ? tab.color
                        : T2,
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="card" style={{ padding: 22 }}>
            {activeTab === "ai" && (
              <AITab
                cfg={cfg.ai}
                set={(k, v) => setSection("ai", k, v)}
              />
            )}

            {activeTab === "alerts" && (
              <AlertsTab
                cfg={cfg.alerts}
                set={(k, v) => setSection("alerts", k, v)}
              />
            )}

            {activeTab === "email" && (
              <EmailTab
                cfg={cfg.email}
                set={(k, v) => setSection("email", k, v)}
              />
            )}

            {activeTab === "system" && (
              <SystemTab
                cfg={cfg.system}
                set={(k, v) => setSection("system", k, v)}
                user={user}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}