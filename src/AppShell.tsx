import { useStore } from './stores/appStore';
import { LoginScreen } from './components/LoginScreen';
import { UpdateChecker } from './components/UpdateChecker';
import App from './App';
import { useAppInit } from './utils/useAppInit';

export default function AppShell() {
  const loggedIn = useStore(s => s.loggedIn);
  const setLoggedIn = useStore(s => s.setLoggedIn);
  const { loading } = useAppInit();

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={(user) => setLoggedIn(user)} />;
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', 'Noto Sans SC', sans-serif", color: '#5a6478',
        background: '#0b0e14',
      }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 10, filter: 'drop-shadow(0 0 8px rgba(99,179,237,0.3))' }}><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/></svg>
          <div style={{ fontSize: 12 }}>正在加载...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <UpdateChecker />
      <App />
    </>
  );
}
