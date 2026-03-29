#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 大改版中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

changes = 0

# 1. Remove "工作台" from nav tabs — keep only other tabs
old_nav = """const navTabs = [
    { key: 'dashboard', label: '工作台', icon: <Home size={15} /> },
    { key: 'projects', label: '项目', icon: <FolderOpen size={15} /> },
    { key: 'experiments', label: '实验', icon: <FlaskConical size={15} /> },
    { key: 'results', label: '结果', icon: <BarChart3 size={15} /> },
    { key: 'library', label: '资料库', icon: <Archive size={15} /> },
    { key: 'templates', label: '模板', icon: <LayoutTemplate size={15} /> },
    { key: 'settings', label: '设置', icon: <Settings size={15} /> },
  ];"""

new_nav = """const navTabs = [
    { key: 'projects', label: '项目', icon: <FolderOpen size={15} /> },
    { key: 'experiments', label: '实验', icon: <FlaskConical size={15} /> },
    { key: 'results', label: '结果', icon: <BarChart3 size={15} /> },
    { key: 'library', label: '资料库', icon: <Archive size={15} /> },
    { key: 'templates', label: '模板', icon: <LayoutTemplate size={15} /> },
    { key: 'settings', label: '设置', icon: <Settings size={15} /> },
  ];"""

if old_nav in c:
    c = c.replace(old_nav, new_nav)
    changes += 1
    print("  ✓ 导航栏去掉工作台")

# 2. Remove status select from all experiment cards — replace with just Badge
# In ExperimentsPage
c = c.replace(
    '''<select className="status-select" value={e.status} onClick={ev => ev.stopPropagation()} onChange={async ev => { ev.stopPropagation(); try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: e.parameters||'', results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', nextSteps: e.nextSteps||'', status: ev.target.value }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } }}><option>待处理</option><option>进行中</option><option>成功</option><option>失败</option><option>待复验</option></select>''',
    '''<Badge>{e.status}</Badge>'''
)
changes += 1
print("  ✓ 去掉实验状态选择器")

# 3. Fix todo — the empty-sm click
# Already done in previous patch but make sure it works
if 'clickable-empty-inline' not in c:
    c = c.replace(
        '''<div className="card"><div className="empty-sm">暂无待办</div></div>''',
        '''<div className="card clickable-empty-inline" onClick={() => { const name = prompt('输入任务名称'); if (name) useStore.getState().addTask({ name, projectId: '', dueDate: '', priority: '中', status: '待处理', assignee: '', notes: '' }); }}><div className="empty-sm">点击添加待办</div></div>'''
    )
    print("  ✓ 待办点击添加")

# 4. Replace ExperimentDetailPage with new version: time progress + results with files
idx = c.find('// ═══ Experiment Detail')
if idx < 0:
    idx = c.find('function ExperimentDetailPage()')
    if idx > 0:
        idx = c.rfind('\n', 0, idx) + 1

next_func = c.find('\n// ═══ Experiments List', idx + 50)
if next_func < 0:
    next_func = c.find('\nfunction ExperimentsPage', idx + 50)

if idx > 0 and next_func > 0:
    new_detail = r'''// ═══ Experiment Detail — Time Progress + Results with Files ═══
function ExperimentDetailPage() {
  const { selectedExperimentId, experiments, projects, navigateTo, deleteExperiment } = useStore();
  const [files, setFiles] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeSection, setActiveSection] = useState('purpose');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [editingTimeline, setEditingTimeline] = useState(false);
  const exp = experiments.find(e => e.id === selectedExperimentId);

  const loadFiles = useCallback(async () => {
    if (!exp) return;
    try { const { invoke } = await import('@tauri-apps/api/core'); setFiles(await invoke<any[]>('get_experiment_files', { experimentId: exp.id })); } catch {}
  }, [exp?.id]);
  useEffect(() => { loadFiles(); }, [loadFiles]);
  if (!exp) return null;
  const proj = projects.find(p => p.id === exp.projectId);

  // Parse timeline from parameters field
  let timeline: { duration_days: number; milestones: { day: number; label: string }[] } = { duration_days: 30, milestones: [] };
  try { if (exp.parameters) timeline = JSON.parse(exp.parameters); } catch {}
  if (!timeline.milestones) timeline.milestones = [];
  if (!timeline.duration_days) timeline.duration_days = 30;

  // Calculate day progress
  const startDate = new Date(exp.date);
  const now = new Date();
  const daysPassed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 86400000));
  const dayPct = Math.min(100, Math.round((daysPassed / timeline.duration_days) * 100));

  // Find next milestone
  const sortedMs = [...timeline.milestones].sort((a, b) => a.day - b.day);
  const nextMs = sortedMs.find(m => m.day > daysPassed);

  const notes = [exp.issues, exp.nextSteps].filter(Boolean).join('\n---\n');

  const startEdit = (field: string, value: string) => { setEditing(field); setEditValue(value || ''); };
  const saveEdit = async () => {
    if (!editing || !exp) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const vals: any = { purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'' };
      if (editing === 'notes') { vals.issues = editValue; vals.nextSteps = ''; }
      else { vals[editing] = editValue; }
      await invoke('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: vals.purpose, materials: vals.materials, steps: vals.steps, parameters: exp.parameters||'', results: vals.results, conclusion: vals.conclusion, issues: vals.issues, nextSteps: vals.nextSteps, status: exp.status||'进行中' });
      await useStore.getState().loadAll();
    } catch (e: any) { console.error(e); }
    setEditing(null);
  };

  const saveTimeline = async (tl: typeof timeline) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: JSON.stringify(tl), results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
      await useStore.getState().loadAll();
    } catch (e: any) { console.error(e); }
  };

  const addMilestone = () => {
    const dayStr = prompt('第几天？', String(daysPassed + 3));
    if (!dayStr) return;
    const label = prompt('操作内容？', '');
    if (!label) return;
    const newTl = { ...timeline, milestones: [...timeline.milestones, { day: parseInt(dayStr), label }] };
    saveTimeline(newTl);
  };

  const removeMilestone = (idx: number) => {
    const newTl = { ...timeline, milestones: timeline.milestones.filter((_, i) => i !== idx) };
    saveTimeline(newTl);
  };

  const setDuration = () => {
    const d = prompt('实验总天数？', String(timeline.duration_days));
    if (d) { saveTimeline({ ...timeline, duration_days: parseInt(d) || 30 }); }
  };

  // Image files for inline display
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'];
  const imageFiles = files.filter(f => imageExts.includes((f.file_type || '').toLowerCase()));
  const otherFiles = files.filter(f => !imageExts.includes((f.file_type || '').toLowerCase()));

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

  const activeSec = sections.find(s => s.key === activeSection);

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
        </div>
        <button className="btn danger sm" onClick={() => { if (confirm('删除？')) deleteExperiment(exp.id); }}><Trash2 size={13} /></button>
      </div>

      {/* Time progress bar */}
      <div className="time-progress-card">
        <div className="tp-header">
          <span className="tp-label">第 {daysPassed} 天 / {timeline.duration_days} 天</span>
          <span className="tp-edit-btn" onClick={setDuration}>设置天数</span>
        </div>
        <div className="tp-bar-wrap">
          <div className="tp-bar">
            <div className="tp-fill" style={{ width: dayPct + '%' }} />
            {/* Milestone markers */}
            {sortedMs.map((m, i) => {
              const pos = Math.min(100, (m.day / timeline.duration_days) * 100);
              const passed = daysPassed >= m.day;
              return <div key={i} className={`tp-marker ${passed ? 'passed' : ''}`} style={{ left: pos + '%' }} title={`第${m.day}天: ${m.label}`}><div className="tp-marker-dot" /><div className="tp-marker-label">{m.label}</div></div>;
            })}
            {/* Current position indicator */}
            <div className="tp-current" style={{ left: dayPct + '%' }}><div className="tp-current-dot" /></div>
          </div>
        </div>
        {/* Milestones list */}
        <div className="tp-milestones">
          {sortedMs.map((m, i) => {
            const passed = daysPassed >= m.day;
            return <span key={i} className={`tp-ms-tag ${passed ? 'passed' : daysPassed >= m.day - 2 ? 'soon' : ''}`} onClick={() => { if (confirm(`删除"第${m.day}天 ${m.label}"？`)) removeMilestone(timeline.milestones.indexOf(m)); }}>第{m.day}天 {m.label} {passed ? '✓' : ''}</span>;
          })}
          <span className="tp-ms-add" onClick={addMilestone}>+ 添加节点</span>
        </div>
        {nextMs && <div className="tp-next">下一步：第 {nextMs.day} 天 — {nextMs.label}（还有 {nextMs.day - daysPassed} 天）</div>}
      </div>

      {/* Section nav */}
      <div className="exp-section-nav">
        {sections.map(s => (
          <div key={s.key} className={`exp-nav-item ${activeSection === s.key ? 'active' : ''} ${s.content ? 'filled' : ''}`} onClick={() => setActiveSection(s.key)}>
            <span className="exp-nav-icon">{s.icon}</span><span>{s.label}</span>{s.content ? <span className="exp-nav-check">✓</span> : null}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="exp-detail-body">
        <div className="exp-sections-scroll">
          {activeSec && (
            <div className="exp-section-card active-section">
              <div className="exp-section-label"><span className="exp-sec-icon">{activeSec.icon}</span><span>{activeSec.label}</span></div>
              <EditBlock field={activeSec.key} content={activeSec.content} />
              {/* Show files under results section */}
              {activeSec.key === 'results' && (
                <div className="results-files-area">
                  <FileUploadZone experimentId={exp.id} projectId={exp.projectId} files={otherFiles} onFilesChanged={loadFiles} />
                  {/* Inline image gallery */}
                  {imageFiles.length > 0 && (
                    <div className="img-gallery">
                      {imageFiles.map((f: any) => {
                        const imgSrc = f.local_path ? `asset://localhost/${f.local_path}` : '';
                        return (
                          <div key={f.id} className="img-thumb" onClick={async () => {
                            try { const { invoke } = await import('@tauri-apps/api/core'); const dir = await invoke<string>('get_data_dir'); setLightboxImg(dir + '/' + f.local_path); } catch {}
                          }}>
                            <div className="img-thumb-name">{f.name || f.original_name}</div>
                            <div className="img-thumb-icon">🖼️</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Sidebar only on non-results sections */}
        {activeSection !== 'results' && (
          <div className="exp-sidebar">
            <div className="card" style={{ position: 'sticky', top: 0 }}>
              <div className="font-bold text-sm mb-3">附件 ({files.length})</div>
              <FileUploadZone experimentId={exp.id} projectId={exp.projectId} files={files} onFilesChanged={loadFiles} />
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="overlay" onClick={() => setLightboxImg(null)} style={{ alignItems: 'center', paddingTop: 0 }}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img src={'asset://localhost/' + lightboxImg} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} alt="" />
            <div style={{ position: 'absolute', top: -36, right: 0, cursor: 'pointer', color: '#fff', fontSize: 24 }} onClick={() => setLightboxImg(null)}>✕</div>
          </div>
        </div>
      )}
    </div>
  );
}
'''
    c = c[:idx] + new_detail + '\n' + c[next_func:]
    changes += 1
    print("  ✓ 实验详情页完全重写")
else:
    print("  ⚠ 未找到 ExperimentDetailPage")

# 5. Update home page progress cards to use time-based progress
old_progress = "const steps = ['purpose', 'materials', 'steps', 'results', 'conclusion'];"
new_progress = "const steps = ['purpose', 'materials', 'steps', 'results', 'conclusion']; let timeline: any = { duration_days: 30, milestones: [] }; try { if (e.parameters) timeline = JSON.parse(e.parameters); } catch {} if (!timeline.duration_days) timeline.duration_days = 30; const startD = new Date(e.date); const daysP = Math.max(0, Math.floor((new Date().getTime() - startD.getTime()) / 86400000)); const sortedMilestones = (timeline.milestones || []).sort((a: any, b: any) => a.day - b.day); const nextMilestone = sortedMilestones.find((m: any) => m.day > daysP);"

if old_progress in c:
    c = c.replace(old_progress, new_progress)
    changes += 1

# Replace pct calculation and progress display in home
old_pct = "const pct = Math.round((filled / steps.length) * 100);"
new_pct = "const pct = Math.min(100, Math.round((daysP / timeline.duration_days) * 100));"
if old_pct in c:
    c = c.replace(old_pct, new_pct)

# Replace step indicators with timeline info
old_steps_display = """{steps.map(s => { const label: Record<string,string> = { purpose: '目的', materials: '材料', steps: '步骤', results: '结果', conclusion: '结论' }; const done = !!(e as any)[s]; return <span key={s} className={`epc-step ${done ? 'done' : ''}`}>{done ? '✓' : '○'} {label[s]}</span>; })}"""

new_steps_display = """{nextMilestone ? <span className="epc-next">下一步：第{nextMilestone.day}天 {nextMilestone.label}（{nextMilestone.day - daysP}天后）</span> : <span className="epc-next" style={{color:'#48bb78'}}>已完成全部节点</span>}"""

if old_steps_display in c:
    c = c.replace(old_steps_display, new_steps_display)
    print("  ✓ 工作台进度条改为时间进度")

# Replace progress bar label
c = c.replace(
    "const statusColor = e.status === '成功' ? '#48bb78' : e.status === '失败' ? '#fc8181' : e.status === '进行中' ? '#63b3ed' : e.status === '待复验' ? '#b794f4' : '#ed8936';",
    "const statusColor = pct >= 100 ? '#48bb78' : pct >= 70 ? '#ed8936' : '#63b3ed';"
)

with open('src/App.tsx', 'w') as f:
    f.write(c)

print(f"\n共 {changes} 处核心修改")
PYEOF

# CSS for time progress
cat >> src/App.css << 'CSSEOF'

/* ═══ TIME PROGRESS CARD ═══ */
.time-progress-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 14px;
}
.tp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.tp-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}
.tp-edit-btn {
  font-size: 11px;
  color: var(--accent);
  cursor: pointer;
  transition: opacity 0.2s;
}
.tp-edit-btn:hover { opacity: 0.7; }

.tp-bar-wrap { position: relative; margin-bottom: 12px; padding: 8px 0; }
.tp-bar {
  height: 4px;
  background: rgba(255,255,255,0.04);
  border-radius: 2px;
  position: relative;
}
.tp-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #3a8fd488, #63b3ed);
  box-shadow: 0 0 10px rgba(99,179,237,0.25);
  transition: width 0.6s ease;
}

/* Current position */
.tp-current {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
}
.tp-current-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px rgba(99,179,237,0.5);
  border: 2px solid var(--bg-card);
}

/* Milestone markers */
.tp-marker {
  position: absolute;
  top: -18px;
  transform: translateX(-50%);
  z-index: 2;
}
.tp-marker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-dim);
  margin: 0 auto 2px;
  transition: all 0.3s;
}
.tp-marker.passed .tp-marker-dot { background: #48bb78; box-shadow: 0 0 6px rgba(72,187,120,0.4); }
.tp-marker-label {
  font-size: 9px;
  color: var(--text-dim);
  white-space: nowrap;
  text-align: center;
}
.tp-marker.passed .tp-marker-label { color: #48bb78; }

/* Milestones tags */
.tp-milestones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.tp-ms-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.25s;
}
.tp-ms-tag:hover { border-color: var(--status-danger); color: var(--status-danger); }
.tp-ms-tag.passed { color: #48bb78; border-color: rgba(72,187,120,0.15); background: rgba(72,187,120,0.04); }
.tp-ms-tag.soon { color: var(--accent); border-color: rgba(99,179,237,0.2); background: rgba(99,179,237,0.04); animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { box-shadow: none; } 50% { box-shadow: 0 0 12px rgba(99,179,237,0.15); } }
.tp-ms-add {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px dashed rgba(99,179,237,0.15);
  color: var(--accent);
  cursor: pointer;
  transition: all 0.25s;
}
.tp-ms-add:hover { border-color: rgba(99,179,237,0.3); background: rgba(99,179,237,0.04); }

.tp-next {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

/* Results file area */
.results-files-area {
  padding: 8px 14px 14px;
  border-top: 1px solid var(--border-subtle);
  margin-top: 8px;
}

/* Image gallery */
.img-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.img-thumb {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.35s ease;
}
.img-thumb:hover {
  border-color: rgba(99,179,237,0.25);
  box-shadow: 0 0 20px rgba(99,179,237,0.1);
  transform: translateY(-2px);
}
.img-thumb-icon { font-size: 28px; margin-bottom: 4px; }
.img-thumb-name { font-size: 9px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Home card next milestone */
.epc-next {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}
.epc-steps { min-height: 18px; }

/* Results section wider when active */
.exp-detail-body:has(.results-files-area) {
  grid-template-columns: 1fr !important;
}
CSSEOF

echo "✅ 完成"
