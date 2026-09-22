import { getRiskColor } from '../../utils/helpers';

const RISK_LABEL = (s) => s >= 70 ? 'High' : s >= 40 ? 'Med' : 'Low';

export default function RiskScore({ score }) {
  const color = getRiskColor(score);
  const pct = Math.min(100, Math.max(0, score));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Segmented track */}
      <div className="risk-bar-track" style={{ flex: 1, minWidth: 60, position: 'relative', height: 6, background: '#111a2c', borderRadius: 3, overflow: 'hidden' }}>
        {/* low zone */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: '40%', height: '100%', background: 'rgba(52,211,153,0.18)' }} />
        {/* med zone */}
        <div style={{ position: 'absolute', left: '40%', top: 0, width: '30%', height: '100%', background: 'rgba(251,191,36,0.15)' }} />
        {/* high zone */}
        <div style={{ position: 'absolute', left: '70%', top: 0, width: '30%', height: '100%', background: 'rgba(248,113,113,0.15)' }} />
        {/* fill */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 26, textAlign: 'right' }}>{score}</span>
      <span style={{ fontSize: 10, color: `${color}99`, fontWeight: 600, minWidth: 22 }}>{RISK_LABEL(score)}</span>
    </div>
  );
}
