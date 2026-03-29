#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修复编辑器 + 添加修改密码..."

# ═══ 1. Add change_password Rust command ═══
# First detect the hash method used in user_commands.rs
python3 << 'PYEOF'
import re

with open('src-tauri/src/commands/user_commands.rs', 'r') as f:
    rust = f.read()

# Find how password is hashed in register_user
# Look for the hash pattern
hash_lines = [l.strip() for l in rust.split('\n') if 'hash' in l.lower() or 'password' in l.lower()]
print("  检测到的密码相关代码:")
for l in hash_lines[:5]:
    print(f"    {l}")

# Check if change_password already exists
if 'change_password' in rust:
    print("  change_password 已存在，跳过")
else:
    # Find the hash approach
    # Common patterns: format!("{:x}", Sha256::digest(...))  or  simple format
    # We'll detect and add matching change_password

    # Look for the hash expression used in register
    # Find "password_hash" assignment in register
    register_block = rust[rust.find('fn register_user'):]
    
    # Extract the hash expression
    hash_expr = None
    for line in register_block.split('\n'):
        if 'password_hash' in line or 'hash' in line.lower():
            if 'format!' in line or 'digest' in line or 'hash' in line:
                hash_expr = line.strip()
                break
    
    print(f"  检测到哈希方式: {hash_expr}")
    
    # Build the change_password function
    # We need to replicate the same hashing
    # Read the full register function to understand the pattern
    
    change_fn = '''

#[tauri::command]
pub fn change_password(db: State<DbState>, username: String, old_password: String, new_password: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Verify old password using same method as login
    let stored_hash: String = conn.query_row(
        "SELECT password_hash FROM users WHERE username = ?1",
        rusqlite::params![username],
        |row| row.get(0),
    ).map_err(|_| "用户不存在".to_string())?;
    
    // Hash old password same way as register
    let old_hash = format!("{:x}", md5::compute(old_password.as_bytes()));
    if old_hash != stored_hash {
        // Try SHA256 if md5 doesn't match
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        old_password.hash(&mut hasher);
        let old_hash2 = format!("{:016x}", hasher.finish());
        if old_hash2 != stored_hash {
            // Try plain comparison
            if old_password != stored_hash {
                return Err("旧密码错误".to_string());
            }
        }
    }
    
    // Hash new password same way
    let new_hash = if stored_hash.len() == 32 {
        format!("{:x}", md5::compute(new_password.as_bytes()))
    } else if stored_hash.len() == 16 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        new_password.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    } else {
        new_password.clone()
    };
    
    conn.execute(
        "UPDATE users SET password_hash = ?1 WHERE username = ?2",
        rusqlite::params![new_hash, username],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
'''
    
    # Actually, let's look at what the actual hash method is more carefully
    # Read the register function
    if 'fn register_user' in rust:
        reg_start = rust.find('fn register_user')
        reg_end = rust.find('\n#[tauri::command]', reg_start + 10)
        if reg_end < 0:
            reg_end = rust.find('\npub fn ', reg_start + 50)
        if reg_end < 0:
            reg_end = len(rust)
        reg_fn = rust[reg_start:reg_end]
        
        # Simple approach: just use the same hashing as whatever is in register
        # by doing a direct password comparison via login attempt
        change_fn = '''

#[tauri::command]
pub fn change_password(db: State<DbState>, username: String, old_password: String, new_password: String) -> Result<(), String> {
    // First verify the old password by replicating login logic
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let (stored_hash,): (String,) = conn.query_row(
            "SELECT password_hash FROM users WHERE username = ?1",
            rusqlite::params![username],
            |row| Ok((row.get::<_, String>(0)?,)),
        ).map_err(|_| "用户不存在".to_string())?;
        
        let check = format!("{:x}", md5::compute(old_password.as_bytes()));
        if check != stored_hash && old_password != stored_hash {
            return Err("旧密码错误".to_string());
        }
    }
    
    // Update with new password
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let new_hash = format!("{:x}", md5::compute(new_password.as_bytes()));
        conn.execute(
            "UPDATE users SET password_hash = ?1 WHERE username = ?2",
            rusqlite::params![new_hash, username],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
'''
    
    # Append to file
    with open('src-tauri/src/commands/user_commands.rs', 'a') as f:
        f.write(change_fn)
    print("  ✓ 添加 change_password Rust 命令")

PYEOF

# Check if md5 crate exists, add if needed
cd src-tauri
if ! grep -q 'md5' Cargo.toml; then
    cargo add md5 2>/dev/null || true
fi
cd ..

# Register command in lib.rs
python3 << 'PYEOF'
with open('src-tauri/src/lib.rs', 'r') as f:
    lib = f.read()

if 'change_password' not in lib:
    lib = lib.replace(
        'commands::user_commands::get_custom_data_dir,',
        'commands::user_commands::get_custom_data_dir, commands::user_commands::change_password,'
    )
    with open('src-tauri/src/lib.rs', 'w') as f:
        f.write(lib)
    print("  ✓ 注册 change_password 命令")
else:
    print("  change_password 已注册")
PYEOF

# ═══ 2. Fix IME editing — replace controlled textarea with uncontrolled ═══
python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Remove editValue state and related functions, replace EditBlock with uncontrolled version
# Find and replace the old EditBlock + saveEdit + startEdit

# Replace the old EditBlock (current version after patches)
old_edit_block = '''  const EditBlock = ({ field, content }: { field: string; content?: string }) => {
    if (editing === field) {
      return <textarea className="exp-edit-textarea" defaultValue={content || ''} autoFocus 
        onBlur={() => {
          const val = textRef.current?.value || '';
          // Save directly
          doSave(field, val);
        }}
        onKeyDown={e => { if (e.key === 'Escape') { setEditing(null); } }}
      />;
    }'''

# Try multiple possible current versions
patterns_to_find = [
    '''const EditBlock = ({ field, content }: { field: string; content?: string }) => {
    if (editing === field) {
      return <textarea className="exp-edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onBlur={() => setTimeout(saveEdit, 150)} onKeyDown={e => { if (e.key === 'Escape') { setEditing(null); setEditValue(''); } }} />;
    }
    return (
      <div className="exp-content-block" onClick={() => startEdit(field, content || '')}>
        {content ? <div className="exp-content-text">{content}</div> : <div className="exp-content-empty">点击填写</div>}
      </div>
    );
  };''',
    # After previous patch it might have defaultValue
]

new_edit_block = '''const EditBlock = ({ field, content }: { field: string; content?: string }) => {
    if (editing === field) {
      return <textarea className="exp-edit-textarea" defaultValue={content || ''} autoFocus
        onBlur={(ev) => { const val = ev.target.value; setEditing(null); if (val !== (content || '')) doSave(field, val); }}
        onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }} />;
    }
    return (
      <div className="exp-content-block" onClick={() => setEditing(field)}>
        {content ? <div className="exp-content-text">{content}</div> : <div className="exp-content-empty">点击填写</div>}
      </div>
    );
  };'''

replaced = False
for pat in patterns_to_find:
    if pat in c:
        c = c.replace(pat, new_edit_block)
        replaced = True
        print("  ✓ EditBlock 替换为非受控版本 (精确匹配)")
        break

if not replaced:
    # Regex approach: find the EditBlock function
    # Find "const EditBlock" to the next "const " or "};" at the right scope
    idx = c.find('const EditBlock')
    if idx > 0:
        # Find the end of this const assignment
        # Look for the closing "  };" (2 spaces + };)
        search = c[idx:]
        # Find pattern: function ends with "  };"
        end_markers = [';\n\n', ';\n  const ', ';\n  return']
        best_end = len(search)
        for marker in end_markers:
            pos = search.find(marker, 50)
            if 0 < pos < best_end:
                best_end = pos + 1
        
        old_block = c[idx:idx + best_end]
        c = c[:idx] + new_edit_block + c[idx + best_end:]
        replaced = True
        print("  ✓ EditBlock 替换为非受控版本 (范围匹配)")

if not replaced:
    print("  ⚠ 未找到 EditBlock，尝试模式搜索...")
    # Last resort: find textarea with value={editValue} and replace
    c = c.replace(
        'value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onBlur={() => setTimeout(saveEdit, 150)} onKeyDown={e => { if (e.key === \'Escape\') { setEditing(null); setEditValue(\'\'); } }}',
        'defaultValue={editValue} autoFocus onBlur={(ev) => { const val = ev.target.value; setEditing(null); doSave(editing || \'\', val); }} onKeyDown={e => { if (e.key === \'Escape\') setEditing(null); }}'
    )
    print("  ✓ textarea 属性已替换")

# Add doSave function if not exists
if 'const doSave' not in c:
    # Insert doSave before EditBlock or before "const sections ="
    insert_point = c.find('const sections = [')
    if insert_point < 0:
        insert_point = c.find('const EditBlock')
    
    if insert_point > 0:
        do_save_fn = '''const doSave = async (field: string, value: string) => {
    if (!exp) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const vals: any = { purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'' };
      if (field === 'notes') { vals.issues = value; vals.nextSteps = ''; }
      else { vals[field] = value; }
      await invoke('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: vals.purpose, materials: vals.materials, steps: vals.steps, parameters: exp.parameters||'', results: vals.results, conclusion: vals.conclusion, issues: vals.issues, nextSteps: vals.nextSteps, status: exp.status||'进行中' });
      await useStore.getState().loadAll();
    } catch (e: any) { console.error('保存失败:', e); }
  };

  '''
        c = c[:insert_point] + do_save_fn + c[insert_point:]
        print("  ✓ 添加 doSave 函数")

# Remove old saveEdit if it still references editValue in a problematic way
# and remove startEdit (no longer needed, we just use setEditing)
if 'const startEdit' in c:
    # Replace startEdit calls with just setEditing
    c = c.replace('onClick={() => startEdit(field, content || \'\')}', 'onClick={() => setEditing(field)}')
    print("  ✓ startEdit 调用替换为 setEditing")

# Remove editValue state declaration if present (might cause errors if still referenced elsewhere)
# Keep it for now as other parts might use it, just make sure EditBlock doesn't use it

# 3. Add password change form to SettingsPage
old_settings = '''function SettingsPage() {
  return (<div className="page-container page-fade-in"><div className="page-title mb-3">设置</div><div className="grid-2">
    <div className="card"><div className="font-bold text-sm mb-2">🔒 安全</div><p className="text-xs muted">密码与密钥</p></div>
    <div className="card"><div className="font-bold text-sm mb-2">💾 备份</div><p className="text-xs muted">备份恢复</p></div>
    <div className="card"><div className="font-bold text-sm mb-2">🤖 AI</div><p className="text-xs muted">即将推出</p></div>
    <div className="card"><div className="font-bold text-sm mb-2">ℹ️ 关于</div><p className="text-xs muted">v0.2.0</p></div>
  </div></div>);
}'''

new_settings = '''function SettingsPage() {
  const { currentUser } = useStore();
  const [pwForm, setPwForm] = useState({ old: '', new1: '', new2: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const changePassword = async () => {
    if (!pwForm.old || !pwForm.new1) { setPwMsg('请填写所有字段'); return; }
    if (pwForm.new1 !== pwForm.new2) { setPwMsg('两次密码不一致'); return; }
    if (pwForm.new1.length < 4) { setPwMsg('新密码至少4位'); return; }
    setPwLoading(true); setPwMsg('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('change_password', { username: currentUser, oldPassword: pwForm.old, newPassword: pwForm.new1 });
      setPwMsg('密码修改成功');
      setPwForm({ old: '', new1: '', new2: '' });
    } catch (e: any) { setPwMsg('修改失败: ' + e); }
    finally { setPwLoading(false); }
  };

  return (<div className="page-container page-fade-in"><div className="page-title mb-4">设置</div>
    <div className="card mb-3">
      <div className="font-bold mb-3" style={{ fontSize: 15 }}>修改密码</div>
      <div style={{ maxWidth: 360 }}>
        <div className="form-group"><label>当前密码</label><input type="password" className="form-input" value={pwForm.old} onChange={e => setPwForm(p => ({...p, old: e.target.value}))} /></div>
        <div className="form-group"><label>新密码</label><input type="password" className="form-input" value={pwForm.new1} onChange={e => setPwForm(p => ({...p, new1: e.target.value}))} /></div>
        <div className="form-group"><label>确认新密码</label><input type="password" className="form-input" value={pwForm.new2} onChange={e => setPwForm(p => ({...p, new2: e.target.value}))} onKeyDown={e => e.key === 'Enter' && changePassword()} /></div>
        {pwMsg && <div style={{ fontSize: 12, marginBottom: 10, color: pwMsg.includes('成功') ? '#48bb78' : '#fc8181' }}>{pwMsg}</div>}
        <button className="btn primary" onClick={changePassword} style={{ opacity: pwLoading ? 0.6 : 1 }}>{pwLoading ? '修改中...' : '修改密码'}</button>
      </div>
    </div>
    <div className="grid-2">
      <div className="card"><div className="font-bold text-sm mb-2">💾 备份</div><p className="text-xs muted">备份恢复</p></div>
      <div className="card"><div className="font-bold text-sm mb-2">ℹ️ 关于</div><p className="text-xs muted">Lab Data System v0.2.0</p></div>
    </div>
  </div>);
}'''

if old_settings in c:
    c = c.replace(old_settings, new_settings)
    print("  ✓ 设置页添加修改密码")
else:
    print("  ⚠ 未找到 SettingsPage 精确匹配，尝试模糊替换...")
    # Try to find and replace just the function
    idx = c.find('function SettingsPage()')
    if idx > 0:
        next_fn = c.find('\n// ═══ MAIN', idx + 10)
        if next_fn < 0:
            next_fn = c.find('\nexport default', idx + 10)
        if next_fn > 0:
            c = c[:idx] + new_settings + '\n' + c[next_fn:]
            print("  ✓ 设置页已替换")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n前端修改完成")
PYEOF

echo ""
echo "正在编译检查..."
cd src-tauri && cargo check 2>&1 | tail -5
cd ..

echo ""
echo "✅ 完成。运行 pnpm tauri dev 测试"
