#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    content = f.read()

changes = 0

# 1. Fix ALL empty states: remove separate button, make entire area clickable
# Pattern: <div className="empty-state"><div className="empty-icon"><XXX size={22} /></div><h3>暂无XXX</h3><button ...>...</button></div>
# Replace with clickable version without button

import re

# Remove all <button> inside empty-state and make empty-state clickable
# Replace empty-state pattern to be clickable
old_patterns = [
    '<div className="empty-state"><div className="empty-icon"><FolderOpen size={22} /></div><h3>暂无项目</h3><p>创建第一个项目</p><button className="btn primary" onClick={() => onAction(\'project\')}><Plus size={14} /> 新建</button></div>',
    '<div className="empty-state"><div className="empty-icon"><FlaskConical size={22} /></div><h3>暂无实验</h3><button className="btn primary" onClick={() => onAction(\'experiment\')}><Plus size={14} /> 新建实验</button></div>',
    '<div className="empty-state"><div className="empty-icon"><FlaskConical size={22} /></div><h3>暂无</h3><button className="btn primary" onClick={() => onAction(\'experiment\')}><Plus size={14} /> 新建</button></div>',
    '<div className="empty-state"><div className="empty-icon"><BookOpen size={22} /></div><h3>暂无文献</h3><button className="btn primary" onClick={() => onAction(\'reference\')}><Plus size={14} /> 添加</button></div>',
    '<div className="empty-state"><div className="empty-icon"><FileText size={22} /></div><h3>暂无文件</h3><p>在实验详情页上传</p></div>',
    '<div className="empty-state"><div className="empty-icon"><BarChart3 size={22} /></div><h3>暂无结果</h3><p>在实验详情页添加</p></div>',
]

new_patterns = [
    '<div className="empty-state clickable-empty" onClick={() => onAction(\'project\')}><div className="empty-icon"><FolderOpen size={22} /></div><h3>暂无项目</h3><p>点击创建第一个项目</p></div>',
    '<div className="empty-state clickable-empty" onClick={() => onAction(\'experiment\')}><div className="empty-icon"><FlaskConical size={22} /></div><h3>暂无实验</h3><p>点击新建实验</p></div>',
    '<div className="empty-state clickable-empty" onClick={() => onAction(\'experiment\')}><div className="empty-icon"><FlaskConical size={22} /></div><h3>暂无</h3><p>点击新建</p></div>',
    '<div className="empty-state clickable-empty" onClick={() => onAction(\'reference\')}><div className="empty-icon"><BookOpen size={22} /></div><h3>暂无文献</h3><p>点击添加文献</p></div>',
    '<div className="empty-state"><div className="empty-icon"><FileText size={22} /></div><h3>暂无文件</h3><p>在实验详情页上传</p></div>',
    '<div className="empty-state"><div className="empty-icon"><BarChart3 size={22} /></div><h3>暂无结果</h3><p>在实验详情页添加</p></div>',
]

for old, new in zip(old_patterns, new_patterns):
    if old in content:
        content = content.replace(old, new)
        changes += 1

# Also fix the filter-specific empty states
content = content.replace(
    '''<div className="empty-state"><div className="empty-icon"><FlaskConical size={22} /></div><h3>{filter === '全部' ? '暂无' : `没有"${filter}"的实验`}</h3><button className="btn primary" onClick={() => onAction('experiment')}><Plus size={14} /> 新建</button></div>''',
    '''<div className="empty-state clickable-empty" onClick={() => onAction('experiment')}><div className="empty-icon"><FlaskConical size={22} /></div><h3>{filter === '全部' ? '暂无实验' : `没有"${filter}"的实验`}</h3><p>点击新建</p></div>'''
)
changes += 1

# 2. Replace ExperimentDetailPage with editable version
old_detail_start = '// ═══ Experiment Detail ═══\nfunction ExperimentDetailPage()'
old_detail_end = '  );\n}'

# Find the ExperimentDetailPage function and replace it entirely
idx_start = content.find('function ExperimentDetailPage()')
if idx_start > 0:
    # Find the comment before it
    comment_idx = content.rfind('// ═══ Experiment Detail', 0, idx_start)
    if comment_idx > 0:
        idx_start = comment_idx
    
    # Find the end - look for the next top-level function or comment
    search_from = idx_start + 100
    # Find next "// ═══" or "function " at start of line after this function
    next_func = content.find('\n// ═══', search_from)
    if next_func < 0:
        next_func = content.find('\nfunction ', search_from)
    
    if next_func > 0:
        old_func = content[idx_start:next_func]
        
        new_func = '''// ═══ Experiment Detail — Editable ═══
function ExperimentDetailPage() {
  const { selectedExperimentId, experiments, projects, navigateTo, deleteExperiment } = useStore();
  const [files, setFiles] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const exp = experiments.find(e => e.id === selectedExperimentId);
  const loadFiles = useCallback(async () => {
    if (!exp) return;
    try { const { invoke } = await import('@tauri-apps/api/core'); setFiles(await invoke<any[]>('get_experiment_files', { experimentId: exp.id })); } catch {}
  }, [exp?.id]);
  useEffect(() => { loadFiles(); }, [loadFiles]);
  if (!exp) return null;

  const startEdit = (field: string, value: string) => { setEditing(field); setEditValue(value || ''); };
  const saveEdit = async () => {
    if (!editing || !exp) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Map frontend field names to backend
      const fieldMap: Record<string, string> = { purpose: 'purpose', materials: 'materials', steps: 'steps', parameters: 'parameters', results: 'results', conclusion: 'conclusion', issues: 'issues', nextSteps: 'next_steps' };
      const backendField = fieldMap[editing] || editing;
      await invoke('update_experiment', {
        id: exp.id, title: exp.title, type: exp.type || '', date: exp.date || '',
        purpose: editing === 'purpose' ? editValue : exp.purpose || '',
        materials: editing === 'materials' ? editValue : exp.materials || '',
        steps: editing === 'steps' ? editValue : exp.steps || '',
        parameters: editing === 'parameters' ? editValue : exp.parameters || '',
        results: editing === 'results' ? editValue : exp.results || '',
        conclusion: editing === 'conclusion' ? editValue : exp.conclusion || '',
        issues: editing === 'issues' ? editValue : exp.issues || '',
        next_steps: editing === 'nextSteps' ? editValue : exp.nextSteps || '',
        status: exp.status || '待处理',
      });
      await useStore.getState().loadAll();
    } catch (e: any) { console.error('保存失败:', e); }
    setEditing(null);
  };
  const cancelEdit = () => { setEditing(null); setEditValue(''); };

  const EditableSection = ({ field, title, content }: { field: string; title: string; content?: string }) => {
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
        <h4>{title} <span className="edit-hint">点击编辑</span></h4>
        {content ? <pre>{content}</pre> : <p className="text-xs muted" style={{ fontStyle: 'italic' }}>点击此处填写{title}</p>}
      </div>
    );
  };

  return (
    <div className="page-container page-slide-right">
      <div className="flex justify-between items-center mb-4">
        <div><h1 className="page-title">{exp.title}</h1><div className="flex items-center gap-2 mt-2"><Badge>{exp.status}</Badge><span className="text-xs muted"><Calendar size={12} /> {formatDate(exp.date)} · {exp.type}</span></div></div>
        <button className="btn danger sm" onClick={() => { if (confirm('删除？')) deleteExperiment(exp.id); }}><Trash2 size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 2fr', gap: 12 }}>
        <div className="card">
          <EditableSection field="purpose" title="目的" content={exp.purpose} />
          <EditableSection field="materials" title="材料" content={exp.materials} />
          <EditableSection field="steps" title="步骤" content={exp.steps} />
          <EditableSection field="parameters" title="参数" content={exp.parameters} />
          <EditableSection field="results" title="结果" content={exp.results} />
          <EditableSection field="conclusion" title="结论" content={exp.conclusion} />
          <EditableSection field="issues" title="问题" content={exp.issues} />
          <EditableSection field="nextSteps" title="下一步" content={exp.nextSteps} />
        </div>
        <div className="card"><div className="font-bold text-sm mb-3">附件 ({files.length})</div><FileUploadZone experimentId={exp.id} projectId={exp.projectId} files={files} onFilesChanged={loadFiles} /></div>
      </div>
    </div>
  );
}'''
        
        content = content[:idx_start] + new_func + content[next_func:]
        changes += 1
        print(f"  ✓ ExperimentDetailPage 替换为可编辑版本")
    else:
        print("  ⚠ 找不到函数结束位置")
else:
    print("  ⚠ 找不到 ExperimentDetailPage")

print(f"\n共修改 {changes} 处")

with open('src/App.tsx', 'w') as f:
    f.write(content)
PYEOF

# Add CSS for editable sections and clickable empty states
cat >> src/App.css << 'CSSEOF'

/* ═══ EDITABLE SECTIONS ═══ */
.editable-section {
  cursor: pointer;
  padding: 8px;
  margin: -8px;
  border-radius: 6px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}
.editable-section:hover {
  background: rgba(99,179,237,0.03);
  border-color: rgba(99,179,237,0.1);
}
.edit-hint {
  font-size: 9px;
  color: transparent;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  margin-left: 6px;
  transition: color 0.3s;
}
.editable-section:hover .edit-hint { color: var(--accent); }

/* ═══ CLICKABLE EMPTY STATE ═══ */
.clickable-empty {
  cursor: pointer;
  transition: all 0.35s ease;
  border-radius: 10px;
  padding: 40px 16px;
}
.clickable-empty:hover {
  background: rgba(99,179,237,0.03);
}
.clickable-empty:hover .empty-icon {
  border-color: rgba(99,179,237,0.25);
  box-shadow: 0 0 24px rgba(99,179,237,0.15);
  transform: scale(1.08);
}
.clickable-empty .empty-icon {
  transition: all 0.4s cubic-bezier(0.22,1,0.36,1);
  cursor: pointer;
}
.clickable-empty h3 { transition: color 0.3s; }
.clickable-empty:hover h3 { color: var(--accent); }
CSSEOF

echo "✅ 完成"
