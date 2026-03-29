#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Remove "结果" from nav tabs
c = c.replace(
    "{ key: 'results', label: '结果', icon: <BarChart3 size={15} /> },\n",
    ""
)
print("  ✓ 导航栏去掉结果")

# 2. Rename 资料库 to 文献
c = c.replace(
    "{ key: 'library', label: '资料库', icon: <Archive size={15} /> },",
    "{ key: 'library', label: '文献', icon: <BookOpen size={15} /> },"
)
print("  ✓ 资料库改名为文献")

# 3. Remove the sidebar in experiment detail — remove the entire exp-sidebar block
# Remove: {activeSection !== 'results' && ( ... exp-sidebar ... )}
c = c.replace(
    """        {/* Sidebar only on non-results sections */}
        {activeSection !== 'results' && (
          <div className="exp-sidebar">
            <div className="card" style={{ position: 'sticky', top: 0 }}>
              <div className="font-bold text-sm mb-3">附件 ({files.length})</div>
              <FileUploadZone experimentId={exp.id} projectId={exp.projectId} files={files} onFilesChanged={loadFiles} />
            </div>
          </div>
        )}""",
    ""
)
print("  ✓ 去掉实验详情附件侧栏")

# 4. Change exp-detail-body grid to single column since no sidebar
c = c.replace(
    '<div className="exp-detail-body">',
    '<div className="exp-detail-body" style={{ gridTemplateColumns: "1fr" }}>'
)
print("  ✓ 内容区改为单列")

# 5. Replace LibraryPage — only references, no files, no tabs
old_lib = 'function LibraryPage({ onAction }: { onAction: (t: string) => void }) {'
idx = c.find(old_lib)
if idx > 0:
    comment_idx = c.rfind('\n', max(0, idx - 5), idx)
    next_func = c.find('\nfunction ', idx + 50)
    if next_func > 0:
        new_lib = """function LibraryPage({ onAction }: { onAction: (t: string) => void }) {
  const { references, projects, deleteReference } = useStore();
  return (
    <div className="page-container page-fade-in">
      <h1 className="page-title mb-4">文献</h1>
      {references.length > 0 ? references.map(r => {
        const proj = projects.find(p => p.id === r.projectId);
        return (
          <div key={r.id} className="card compact">
            <div className="hover-actions"><div className="hover-action-btn danger" onClick={() => { if (confirm('删除？')) deleteReference(r.id); }}><Trash2 size={13} /></div></div>
            <div className="font-bold text-sm">{r.title}</div>
            <div className="text-xs muted">{r.authors} · <em>{r.journal}</em> ({r.year})</div>
            {r.doi && <div className="text-xs muted mt-2">DOI: {r.doi}</div>}
            {r.coreConclusion && <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{r.coreConclusion}</div>}
            {proj && <div className="text-xs muted mt-2"><FolderOpen size={11} /> {proj.name}</div>}
          </div>
        );
      }) : (
        <div className="card"><div className="empty-state clickable-empty" onClick={() => onAction('reference')}><div className="empty-icon"><BookOpen size={22} /></div><h3>暂无文献</h3><p>点击添加</p></div></div>
      )}
    </div>
  );
}
"""
        c = c[:comment_idx+1] + new_lib + c[next_func:]
        print("  ✓ 资料库改为纯文献页")

# 6. Update isActive to handle library
c = c.replace(
    "(k === 'library' && (currentView === 'files' || currentView === 'references'))",
    "(k === 'library' && (currentView === 'library' || currentView === 'files' || currentView === 'references'))"
)

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

echo "✅ 完成"
