#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Replace EditableSection: remove save/cancel buttons, auto-save on blur
old_editable = '''  const EditableSection = ({ field, title, content }: { field: string; title: string; content?: string }) => {
    const isEditing = editing === field;
    if (isEditing) {
      return (
        <div className="detail-section">
          <h4>{title}</h4>
          <textarea className="form-textarea" style={{ minHeight: 80 }} value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }} />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}><button className="btn sm primary" onClick={saveEdit}>保存</button><button className="btn sm" onClick={cancelEdit}>取消</button></div>
        </div>
      );
    }
    return (
      <div className="detail-section editable-section" onClick={() => startEdit(field, content || '')}>
        <h4>{title}</h4>
        {content ? <pre>{content}</pre> : <p className="empty-field-hint">—</p>}
      </div>
    );
  };'''

new_editable = '''  const EditableSection = ({ field, title, content }: { field: string; title: string; content?: string }) => {
    const isEditing = editing === field;
    if (isEditing) {
      return (
        <div className="detail-section">
          <h4>{title}</h4>
          <textarea className="form-textarea" style={{ minHeight: 80 }} value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }} />
        </div>
      );
    }
    return (
      <div className="detail-section editable-section" onClick={() => startEdit(field, content || '')}>
        <h4>{title}</h4>
        {content ? <pre>{content}</pre> : <p className="empty-field-hint">—</p>}
      </div>
    );
  };'''

if old_editable in c:
    c = c.replace(old_editable, new_editable)
    print("  ✓ 编辑区域改为自动保存")
else:
    print("  ⚠ 未找到 EditableSection")

# 2. Replace LibraryPage: remove tabs, show both sections inline
old_lib_start = "function LibraryPage({ onAction }: { onAction: (t: string) => void }) {"
idx = c.find(old_lib_start)
if idx > 0:
    # Find the comment before
    comment_idx = c.rfind('\n// ═══', max(0, idx - 100), idx)
    if comment_idx < 0: comment_idx = idx
    else: comment_idx += 1
    
    # Find end
    next_func = c.find('\nfunction ', idx + 50)
    if next_func < 0: next_func = c.find('\n// ═══ MAIN', idx + 50)
    
    if next_func > 0:
        new_lib = '''function LibraryPage({ onAction }: { onAction: (t: string) => void }) {
  const { files, references, projects, deleteReference } = useStore();
  return (
    <div className="page-container page-fade-in">
      <h1 className="page-title mb-4">资料库</h1>

      <div className="sec-title">文件 ({files.length})</div>
      {files.length > 0 ? (
        <div className="file-grid mb-4">{files.map(f => <div key={f.id} className="card compact" style={{ marginBottom: 0 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="file-icon">{FILE_ICONS[f.fileType] || FILE_ICONS.default}</span><div style={{ flex: 1, minWidth: 0 }}><div className="file-name">{f.name}</div><div className="file-meta">{formatFileSize(f.fileSize)}</div></div></div></div>)}</div>
      ) : (
        <div className="card mb-4"><div className="empty-state"><div className="empty-icon"><FileText size={22} /></div><h3>暂无文件</h3><p>在实验详情页上传</p></div></div>
      )}

      <div className="sec-title">文献 ({references.length})</div>
      {references.length > 0 ? references.map(r => (
        <div key={r.id} className="card compact">
          <div className="hover-actions"><div className="hover-action-btn danger" onClick={() => { if (confirm('删除？')) deleteReference(r.id); }}><Trash2 size={13} /></div></div>
          <div className="font-bold text-sm">{r.title}</div>
          <div className="text-xs muted">{r.authors} · <em>{r.journal}</em> ({r.year})</div>
          {r.coreConclusion && <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{r.coreConclusion}</div>}
        </div>
      )) : (
        <div className="card"><div className="empty-state clickable-empty" onClick={() => onAction('reference')}><div className="empty-icon"><BookOpen size={22} /></div><h3>暂无文献</h3><p>点击添加</p></div></div>
      )}
    </div>
  );
}
'''
        c = c[:comment_idx] + new_lib + c[next_func:]
        print("  ✓ 资料库改为文件和文献分开显示")
    else:
        print("  ⚠ 找不到 LibraryPage 结束")
else:
    print("  ⚠ 找不到 LibraryPage")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# 3. CSS: stat numbers only glow on hover
cat >> src/App.css << 'CSSEOF'

/* ═══ FIX: stat value — no glow by default, glow on hover ═══ */
.stat-card .stat-value {
  text-shadow: none !important;
  transition: text-shadow 0.45s ease, color 0.45s ease;
}
.stat-card:hover .stat-value {
  text-shadow: 0 0 20px currentColor !important;
}
CSSEOF

echo "✅ 完成"
