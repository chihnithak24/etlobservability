export default function StatCard({ title, value, icon: Icon, color, subtitle, trend }) {
  return (
    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* accent top bar */}
      <div className="kpi-accent" style={{ background: color }} />
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4a6080', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#dde3ed', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
            {subtitle && (
              <div style={{ fontSize: 12, color: '#3d5270', marginTop: 6 }}>{subtitle}</div>
            )}
          </div>
          <div style={{
            width: 42, height: 42, flexShrink: 0,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={20} color={color} strokeWidth={1.8} />
          </div>
        </div>
        {trend !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, color: trend >= 0 ? '#34d399' : '#f87171',
            paddingTop: 10, borderTop: '1px solid #111a2c'
          }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{trend >= 0 ? '↑' : '↓'}</span>
            <span><strong>{Math.abs(trend)}%</strong> vs last period</span>
          </div>
        )}
      </div>
    </div>
  );
}
