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
  const [userList, setUserList] = useState<string[]>([]);
  const [dataDir, setDataDir] = useState('');

  useEffect(() => {
    checkState();
  }, []);

  async function checkState() {
    try {
      const hasUsers = await invoke<boolean>('check_has_users');
      if (hasUsers) {
        const users = await invoke<string[]>('get_user_list');
        setUserList(users);
        if (users.length > 0) setUsername(users[0]);
        setMode('login');
      } else {
        // 首次使用，获取默认数据目录
        const dir = await invoke<string>('get_data_dir');
        setDataDir(dir);
        setMode('register');
      }
    } catch (e) {
      console.error('检查状态失败:', e);
      setMode('register');
    }
  }

  async function handleLogin() {
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    setLoading(true);
    setError('');
    try {
      await invoke<string>('login_user', { username, password });
      onLoginSuccess(username);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    if (password.length < 4) { setError('密码至少4位'); return; }
    setLoading(true);
    setError('');
    try {
      await invoke('register_user', {
        username,
        password,
        displayName: displayName || username,
      });
      // 如果用户选了自定义目录，保存
      if (dataDir) {
        await invoke('set_custom_data_dir', { path: dataDir });
      }
      onLoginSuccess(username);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  async function pickDataDir() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, title: '选择数据保存位置' });
      if (selected) setDataDir(selected as string);
    } catch (e) {
      console.error('选择目录失败:', e);
    }
  }

  if (mode === 'checking') {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>正在初始化...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoSection}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/>
            <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/>
          </svg>
          <h1 style={styles.title}>Lab Data System</h1>
          <p style={styles.subtitle}>
            {mode === 'register' ? '首次使用，请创建你的账号' : '欢迎回来，请登录'}
          </p>
        </div>

        {/* 错误提示 */}
        {error && <div style={styles.error}>{error}</div>}

        {mode === 'register' ? (
          // ═══ 注册界面 ═══
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>用户名 *</label>
              <input
                style={styles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoFocus
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>显示名称</label>
              <input
                style={styles.input}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="可选，用于界面显示"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>密码 *</label>
              <input
                type="password"
                style={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少4位"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>确认密码 *</label>
              <input
                type="password"
                style={styles.input}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>数据保存位置</label>
              <div style={styles.dirRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  value={dataDir}
                  onChange={e => setDataDir(e.target.value)}
                  
                />
                <button style={styles.dirBtn} onClick={pickDataDir}>选择</button>
              </div>
              <p style={styles.hint}>你的所有科研数据将保存在此目录</p>
            </div>
            <button
              style={{ ...styles.primaryBtn, opacity: loading ? 0.6 : 1 }}
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? '创建中...' : '创建账号并进入'}
            </button>
          </>
        ) : (
          // ═══ 登录界面 ═══
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>用户名</label>
              {userList.length > 1 ? (
                <select
                  style={styles.input}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                >
                  {userList.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : (
                <input
                  style={styles.input}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>密码</label>
              <input
                type="password"
                style={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              style={{ ...styles.primaryBtn, opacity: loading ? 0.6 : 1 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? '登录中...' : '登 录'}
            </button>
            <button
              style={styles.linkBtn}
              onClick={() => { setMode('register'); setError(''); setPassword(''); setUsername(''); }}
            >
              创建新账号
            </button>
          </>
        )}
      </div>

      <div style={styles.footer}>本地存储 · 隐私优先 · 数据安全</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)',
    fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  card: {
    width: 400,
    background: '#fff',
    borderRadius: 16,
    padding: '36px 32px 28px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  logoSection: {
    textAlign: 'center' as const,
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 13.5,
    color: '#9ca3af',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  dirRow: {
    display: 'flex',
    gap: 8,
  },
  dirBtn: {
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  primaryBtn: {
    width: '100%',
    padding: '11px 0',
    borderRadius: 10,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 8,
  },
  linkBtn: {
    width: '100%',
    padding: '8px 0',
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 8,
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
};
