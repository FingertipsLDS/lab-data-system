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
        fontFamily: "'Noto Sans SC', sans-serif", color: '#6b7280',
        background: '#f8f9fb',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧬</div>
          <div>正在加载数据...</div>
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
