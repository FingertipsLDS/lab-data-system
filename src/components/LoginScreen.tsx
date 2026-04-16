import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  onLoginSuccess: (username: string) => void;
}

export function LoginScreen({ onLoginSuccess }: Props) {
  const [mode, setMode] = useState<'checking' | 'login' | 'register'>('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('biolab-remember-me') === '1');
  const [userList, setUserList] = useState<string[]>([]);
  const [dataDir, setDataDir] = useState('');

  useEffect(() => { checkState(); }, []);

  async function checkState() {
    try {
      const hasUsers = await invoke<boolean>('check_has_users');
      if (hasUsers) {
        const users = await invoke<string[]>('get_user_list');
        setUserList(users);
        if (users.length > 0) setUsername(users[0]);
        // 读取保存的凭据
        if (localStorage.getItem('biolab-remember-me') === '1') {
          const savedU = localStorage.getItem('biolab-saved-username') || '';
          const savedP = localStorage.getItem('biolab-saved-password') || '';
          if (savedU && users.includes(savedU)) { setUsername(savedU); setPassword(savedP); }
        }
        setMode('login');
      } else {
        const dir = await invoke<string>('get_data_dir');
        setDataDir(dir);
        setMode('register');
      }
    } catch (e) { setMode('register'); }
  }

  async function handleLogin() {
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    setLoading(true); setError('');
    try {
      await invoke<string>('login_user', { username, password });
      if (rememberMe) {
        localStorage.setItem('biolab-remember-me', '1');
        localStorage.setItem('biolab-saved-username', username);
        localStorage.setItem('biolab-saved-password', password);
      } else {
        localStorage.removeItem('biolab-remember-me');
        localStorage.removeItem('biolab-saved-username');
        localStorage.removeItem('biolab-saved-password');
      }
      onLoginSuccess(username);
    }
    catch (e: any) { setError(e.toString()); }
    finally { setLoading(false); }
  }

  async function handleRegister() {
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    if (password.length < 4) { setError('密码至少4位'); return; }
    setLoading(true); setError('');
    try {
      await invoke('register_user', { username, password, displayName: displayName || username });
      if (dataDir) await invoke('set_custom_data_dir', { path: dataDir });
      onLoginSuccess(username);
    } catch (e: any) { setError(e.toString()); }
    finally { setLoading(false); }
  }

  async function pickDataDir() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, title: '选择数据保存位置' });
      if (selected) setDataDir(selected as string);
    } catch (e) { console.error(e); }
  }

  if (mode === 'checking') return (
    <div style={s.container}><div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>初始化中...</div></div>
  );

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.logoSection}>
          <div style={s.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="1.5" strokeLinecap="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/></svg>
          </div>
          <h1 style={s.title}>Lab Data System</h1>
          <p style={s.subtitle}>{mode === 'register' ? '首次使用，创建你的账号' : '欢迎回来'}</p>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {mode === 'register' ? (
          <>
            <div style={s.formGroup}><label style={s.label}>用户名</label><input style={s.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名" autoFocus /></div>
            <div style={s.formGroup}><label style={s.label}>显示名称</label><input style={s.input} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="可选" /></div>
            <div style={s.formGroup}><label style={s.label}>密码</label><input type="password" style={s.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="至少4位" /></div>
            <div style={s.formGroup}><label style={s.label}>确认密码</label><input type="password" style={s.input} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入" onKeyDown={e => e.key === 'Enter' && handleRegister()} /></div>
            <div style={s.formGroup}>
              <label style={s.label}>数据保存位置</label>
              <div style={{ display: 'flex', gap: 6 }}><input style={{ ...s.input, flex: 1 }} value={dataDir} readOnly /><button style={s.dirBtn} onClick={pickDataDir}>选择</button></div>
            </div>
            <button style={{ ...s.primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={handleRegister} disabled={loading}>{loading ? '创建中...' : '创建账号'}</button>
          </>
        ) : (
          <>
            <div style={s.formGroup}><label style={s.label}>用户名</label>
              {userList.length > 1 ? (
              <div style={{ position: 'relative' }}>
                <div onClick={() => { const el = document.getElementById('user-dropdown'); if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block'; }} style={{ ...s.input, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{username}</span>
                  <span style={{ color: '#7dd3fc', fontSize: 10 }}>▼</span>
                </div>
                <div id="user-dropdown" style={{ display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#1a1f2e', border: '1px solid rgba(125,211,252,0.15)', borderRadius: 8, padding: 4, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {userList.map(u => (
                    <div key={u} onClick={() => { setUsername(u); const el = document.getElementById('user-dropdown'); if (el) el.style.display = 'none'; }}
                      style={{ padding: '8px 12px', fontSize: 14, color: u === username ? '#7dd3fc' : '#d0d4dc', cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                    >{u === username && <span style={{ fontSize: 12 }}>✓</span>}{u}</div>
                  ))}
                </div>
              </div>
            ) : <input style={s.input} value={username} onChange={e => setUsername(e.target.value)} autoFocus />}
            </div>
            <div style={s.formGroup}><label style={s.label}>密码</label><input type="password" style={s.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" onKeyDown={e => e.key === 'Enter' && handleLogin()} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', userSelect: 'none' }} onClick={() => setRememberMe(!rememberMe)}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid ' + (rememberMe ? '#3a8fd4' : 'rgba(255,255,255,0.15)'), background: rememberMe ? '#3a8fd4' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                {rememberMe && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{ fontSize: 12, color: rememberMe ? '#7dd3fc' : '#8892a4', transition: 'color 0.15s' }}>记住密码</span>
            </div>
            <button style={{ ...s.primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={handleLogin} disabled={loading}>{loading ? '登录中...' : '登 录'}</button>
            <button style={s.linkBtn} onClick={() => { setMode('register'); setError(''); setPassword(''); setUsername(''); }}>创建新账号</button>
          </>
        )}
      </div>
      <div style={s.footer}>Lab Data System · 本地存储 · 数据安全</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0b0e14', fontFamily: "'Inter', 'Noto Sans SC', sans-serif" },
  card: { width: 380, background: '#141820', borderRadius: 10, padding: '28px 26px 22px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  logoSection: { textAlign: 'center' as const, marginBottom: 24 },
  logoIcon: { width: 48, height: 48, margin: '0 auto 10px', borderRadius: 10, background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 2, letterSpacing: '-0.01em' },
  subtitle: { fontSize: 12.5, color: '#5a6478' },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 10.5, fontWeight: 600, color: '#5a6478', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  input: { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#0f1219', color: '#e2e8f0', boxSizing: 'border-box' as const, transition: 'border-color 0.15s', WebkitAppearance: 'none' as const, appearance: 'none' as const },
  dirBtn: { padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#181d27', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#8892a4', whiteSpace: 'nowrap' as const },
  primaryBtn: { width: '100%', padding: '9px 0', borderRadius: 6, border: 'none', background: '#3a8fd4', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, boxShadow: '0 0 16px rgba(99,179,237,0.15)', transition: 'all 0.15s' },
  linkBtn: { width: '100%', padding: '6px 0', background: 'none', border: 'none', color: '#5a6478', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 },
  error: { background: 'rgba(252,129,129,0.08)', color: '#fc8181', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 14, textAlign: 'center' as const, border: '1px solid rgba(252,129,129,0.12)' },
  footer: { marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.15)' },
};
