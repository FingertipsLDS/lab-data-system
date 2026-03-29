#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 重新设计实验详情..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Find ExperimentDetailPage and replace entirely
idx = c.find('// ═══ Experiment Detail')
if idx < 0:
    idx = c.find('function ExperimentDetailPage()')
    if idx > 0:
        idx = c.rfind('\n', 0, idx) + 1

next_func = c.find('\n// ═══ Experiments List', idx + 50)
if next_func < 0:
    next_func = c.find('\nfunction ExperimentsPage', idx + 50)

if idx > 0 and next_func > 0:
    new_detail = '''// ═══ Experiment Detail — Redesigned ═══
function ExperimentDetailPage() {
  const { selectedExperimentId, experiments, projects, navigateTo, deleteExperiment } = useStore();
  const [files, setFiles] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeSection, setActiveSection] = useState('purpose');
  const exp = experiments.find(e => e.id === selectedExperimentId);

  const loadFiles = useCallback(async () => {
    if (!exp) return;
    try { const { invoke } = await import('@tauri-apps/api/core'); setFiles(await invoke<any[]>('get_experiment_files', { experimentId: exp.id })); } catch {}
  }, [exp?.id]);
  useEffect(() => { loadFiles(); }, [loadFiles]);
  if (!exp) return null;
  const proj = projects.find(p => p.id === exp.projectId);

  // Combine issues + nextSteps as notes
  const notes = [exp.issues, exp.nextSteps].filter(Boolean).join('\\n---\\n');

  const startEdit = (field: string, value: string) => { setEditing(field); setEditValue(value || ''); };
  const saveEdit = async () => {
    if (!editing || !exp) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // For "notes" field, save to issues (combined field)
      const vals: any = {
        purpose: exp.purpose || '', materials: exp.materials || '', steps: exp.steps || '',
        results: exp.results || '', conclusion: exp.conclusion || '', issues: exp.issues || '',
        nextSteps: exp.nextSteps || '',
      };
      if (editing === 'notes') {
        vals.issues = editValue;
        vals.nextSteps = '';
      } else {
        vals[editing] = editValue;
      }
      await invoke('update_experiment', {
        id: exp.id, title: exp.title, type: exp.type || '', date: exp.date || '',
        purpose: vals.purpose, materials: vals.materials, steps: vals.steps,
        parameters: '', results: vals.results, conclusion: vals.conclusion,
        issues: vals.issues, nextSteps: vals.nextSteps, status: exp.status || '待处理',
      });
      await useStore.getState().loadAll();
    } catch (e: any) { console.error('保存失败:', e); }
    setEditing(null);
  };

  const sections = [
    { key: 'purpose', label: '实验目的', icon: '🎯', content: exp.purpose },
    { key: 'materials', label: '样本材料', icon: '🧫', content: exp.materials },
    { key: 'steps', label: '实验步骤', icon: '📋', content: exp.steps },
    { key: 'results', label: '实验结果', icon: '📊', content: exp.results },
    { key: 'conclusion', label: '结论', icon: '💡', content: exp.conclusion },
    { key: 'notes', label: '备注', icon: '📝', content: notes },
  ];

  const EditBlock = ({ field, content }: { field: string; content?: string }) => {
    if (editing === field) {
      return <textarea className="exp-edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Escape') { setEditing(null); setEditValue(''); } }} />;
    }
    return (
      <div className="exp-content-block" onClick={() => startEdit(field, content || '')}>
        {content ? <div className="exp-content-text">{content}</div> : <div className="exp-content-empty">点击填写</div>}
      </div>
    );
  };

  const filled = sections.filter(s => s.content).length;
  const pct = Math.round((filled / sections.length) * 100);

  return (
    <div className="page-container page-slide-right">
      {/* Header */}
      <div className="exp-detail-header">
        <div className="flex-1">
          <h1 className="page-title">{exp.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge>{exp.status}</Badge>
            <span className="text-xs muted"><Calendar size={12} /> {formatDate(exp.date)} · {exp.type}</span>
            {proj && <span className="text-xs muted">· {proj.name}</span>}
          </div>
          {/* Mini progress */}
          <div className="exp-mini-progress">
            <div className="emp-bar"><div className="emp-fill" style={{ width: pct + '%' }} /></div>
            <span className="emp-pct">{pct}%</span>
          </div>
        </div>
        <button className="btn danger sm" onClick={() => { if (confirm('删除？')) deleteExperiment(exp.id); }}><Trash2 size={13} /></button>
      </div>

      {/* Section nav */}
      <div className="exp-section-nav">
        {sections.map(s => (
          <div key={s.key}
            className={`exp-nav-item ${activeSection === s.key ? 'active' : ''} ${s.content ? 'filled' : ''}`}
            onClick={() => { setActiveSection(s.key); document.getElementById('exp-sec-' + s.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
          >
            <span className="exp-nav-icon">{s.icon}</span>
            <span>{s.label}</span>
            {s.content ? <span className="exp-nav-check">✓</span> : null}
          </div>
        ))}
      </div>

      {/* Content + Files side by side */}
      <div className="exp-detail-body">
        <div className="exp-sections-scroll">
          {sections.map(s => (
            <div key={s.key} id={'exp-sec-' + s.key} className="exp-section-card">
              <div className="exp-section-label">
                <span className="exp-sec-icon">{s.icon}</span>
                <span>{s.label}</span>
              </div>
              <EditBlock field={s.key} content={s.content} />
            </div>
          ))}
        </div>
        <div className="exp-sidebar">
          <div className="card" style={{ position: 'sticky', top: 0 }}>
            <div className="font-bold text-sm mb-3">附件 ({files.length})</div>
            <FileUploadZone experimentId={exp.id} projectId={exp.projectId} files={files} onFilesChanged={loadFiles} />
          </div>
        </div>
      </div>
    </div>
  );
}
'''
    c = c[:idx] + new_detail + '\n' + c[next_func:]
    print("  ✓ 实验详情页已重新设计")
else:
    print("  ⚠ 未找到 ExperimentDetailPage")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS for new experiment detail
cat >> src/App.css << 'CSSEOF'

/* ═══ EXPERIMENT DETAIL — REDESIGNED ═══ */

.exp-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

/* Mini progress in header */
.exp-mini-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.emp-bar {
  width: 120px;
  height: 3px;
  background: rgba(255,255,255,0.04);
  border-radius: 2px;
  overflow: hidden;
}
.emp-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #3a8fd488, #63b3ed);
  box-shadow: 0 0 8px rgba(99,179,237,0.3);
  transition: width 0.6s cubic-bezier(0.22,1,0.36,1);
}
.emp-pct {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

/* Section nav — horizontal pills */
.exp-section-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;
}
.exp-nav-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  border: 1px solid transparent;
  position: relative;
}
.exp-nav-item:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,0.03);
}
.exp-nav-item.active {
  color: var(--accent);
  background: rgba(99,179,237,0.06);
  border-color: rgba(99,179,237,0.12);
}
.exp-nav-item.filled .exp-nav-icon {
  opacity: 1;
}
.exp-nav-icon {
  font-size: 13px;
  opacity: 0.5;
  transition: opacity 0.3s;
}
.exp-nav-item:hover .exp-nav-icon,
.exp-nav-item.active .exp-nav-icon { opacity: 1; }
.exp-nav-check {
  font-size: 10px;
  color: #48bb78;
  font-weight: 700;
}

/* Body layout */
.exp-detail-body {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 14px;
  align-items: start;
}
.exp-sections-scroll {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exp-sidebar {
  position: relative;
}

/* Section card */
.exp-section-card {
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  transition: all 0.35s ease;
  scroll-margin-top: 12px;
}
.exp-section-card:hover {
  border-color: var(--border-hover);
}

.exp-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.01em;
}
.exp-sec-icon {
  font-size: 14px;
}

/* Content block — clickable to edit */
.exp-content-block {
  padding: 8px 14px 12px;
  cursor: pointer;
  transition: background 0.25s ease;
  min-height: 40px;
  border-radius: 0 0 8px 8px;
}
.exp-content-block:hover {
  background: rgba(99,179,237,0.03);
}
.exp-content-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}
.exp-content-empty {
  font-size: 12px;
  color: var(--text-dim);
  font-style: italic;
  padding: 4px 0;
}

/* Edit textarea */
.exp-edit-textarea {
  width: 100%;
  min-height: 80px;
  padding: 8px 14px 12px;
  border: none;
  outline: none;
  background: rgba(99,179,237,0.03);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font);
  line-height: 1.75;
  resize: vertical;
  border-radius: 0 0 8px 8px;
  border-top: 1px solid rgba(99,179,237,0.08);
}
.exp-edit-textarea:focus {
  background: rgba(99,179,237,0.05);
  box-shadow: inset 0 1px 0 rgba(99,179,237,0.12);
}
CSSEOF

echo "✅ 完成"
