#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Fix text editing — the onBlur saves immediately which causes issues
# when clicking inside the textarea. Replace onBlur with a better approach:
# Save on blur but with a small delay to avoid conflicts
c = c.replace(
    'autoFocus onBlur={saveEdit} onKeyDown={e => { if (e.key === \'Escape\') { setEditing(null); setEditValue(\'\'); } }}',
    'autoFocus onBlur={() => setTimeout(saveEdit, 150)} onKeyDown={e => { if (e.key === \'Escape\') { setEditing(null); setEditValue(\'\'); } }}'
)
print("  ✓ 修复编辑保存时机")

# 2. Replace avatar direct logout with dropdown menu
old_avatar = '''<div className="topbar-user" onClick={() => { if (confirm('退出登录？')) logout(); }}>
          <div className="avatar">{currentUser?.[0]?.toUpperCase() || '?'}</div>
        </div>'''

new_avatar = '''<UserMenu onSettings={() => navigateTo('settings' as any)} onLogout={logout} userName={currentUser} />'''

if old_avatar in c:
    c = c.replace(old_avatar, new_avatar)
    print("  ✓ 头像改为下拉菜单")

# 3. Add UserMenu component before the main App export
insert_before = 'export default function App()'
user_menu_component = '''function UserMenu({ onSettings, onLogout, userName }: { onSettings: () => void; onLogout: () => void; userName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="topbar-user" onClick={() => setOpen(!open)}>
        <div className="avatar">{userName?.[0]?.toUpperCase() || '?'}</div>
      </div>
      {open && <div className="user-dropdown">
        <div className="user-dropdown-name">{userName}</div>
        <div className="user-dropdown-divider" />
        <div className="user-dropdown-item" onClick={() => { onSettings(); setOpen(false); }}><Settings size={14} /> 设置</div>
        <div className="user-dropdown-item danger" onClick={() => { if (confirm('退出登录？')) { onLogout(); setOpen(false); } }}><LogOut size={14} /> 退出登录</div>
      </div>}
    </div>
  );
}

'''

if insert_before in c:
    c = c.replace(insert_before, user_menu_component + insert_before)
    print("  ✓ 添加 UserMenu 组件")

# 4. Remove greeting text from home page
c = c.replace(
    '''<div style={{ marginBottom: 24 }}>
        <h1 className="page-title">工作台</h1>
        <p className="page-desc">从上次中断的地方继续</p>
      </div>''',
    ''
)
print("  ✓ 去掉工作台标题文字")

with open('src/App.tsx', 'w') as f:
    f.write(c)
PYEOF

# CSS
cat >> src/App.css << 'CSSEOF'

/* ═══ LOGO — bigger, glow on hover ═══ */
.topbar-logo svg {
  width: 26px !important;
  height: 26px !important;
  transition: all 0.4s cubic-bezier(0.22,1,0.36,1) !important;
}
.topbar-logo:hover svg {
  filter: drop-shadow(0 0 14px rgba(99,179,237,0.6)) drop-shadow(0 0 4px rgba(99,179,237,0.4)) !important;
  transform: scale(1.12);
}
.topbar-logo {
  padding: 8px !important;
  border-radius: 8px;
  transition: background 0.3s ease;
}
.topbar-logo:hover {
  background: rgba(99,179,237,0.06);
}

/* ═══ USER DROPDOWN ═══ */
.user-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  z-index: 60;
  padding: 6px;
  animation: dropIn 0.2s cubic-bezier(0.22,1,0.36,1);
}
.user-dropdown-name {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.user-dropdown-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 2px 0;
}
.user-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.user-dropdown-item:hover {
  background: rgba(99,179,237,0.06);
  color: var(--accent);
}
.user-dropdown-item.danger:hover {
  background: rgba(252,129,129,0.06);
  color: var(--status-danger);
}
.user-dropdown-item svg { width: 14px; height: 14px; }
CSSEOF

echo "✅ 完成"
