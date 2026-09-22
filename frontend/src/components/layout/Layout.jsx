import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ETLAssistant from '../ui/ETLAssistant';

export default function Layout({ children, onRefresh }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Navbar onRefresh={onRefresh} />
        <main style={{
          flex: 1,
          padding: '22px 24px 32px',
          overflowY: 'auto',
          background: 'var(--bg-main)',
        }}>
          {children}
        </main>
      </div>
      <ETLAssistant />
    </div>
  );
}
