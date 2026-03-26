import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from './stores/appStore';
import { formatDate, formatFileSize, STATUS_COLORS, STATUS_BG, FILE_ICONS } from './utils/formatters';
import { Home, FolderOpen, FlaskConical, BarChart3, FileText, BookOpen, LayoutTemplate, CheckSquare, Search, Plus, ArrowLeft, ChevronRight, X, Settings, Calendar, Link2, Trash2 } from 'lucide-react';
import './App.css';

// ═══════════════════════════════════════
// Badge Component
// ═══════════════════════════════════════
const Badge = ({ children, status }: { children: string; status?: string }) => (
  <span className="badge" style={{ color: STATUS_COLORS[status || children] || '#6b7280', background: STATUS_BG[status || children] || '#f3f4f6' }}>
    {children}
  </span>
);

// ═══════════════════════════════════════
// Search Overlay
// ═══════════════════════════════════════
function SearchOverlay() {
  const { searchQuery, setSearchQuery, setSearchOpen, navigateTo, projects, experiments, results, files, references } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const r: { type: string; id: string; label: string; extra?: string }[] = [];
    projects.forEach(p => { if (p.name.toLowerCase().includes(q) || p.direction?.toLowerCase().includes(q)) r.push({ type: '项目', id: p.id, label: p.name }); });
    experiments.forEach(e => { if (e.title.toLowerCase().includes(q) || e.purpose?.toLowerCase().includes(q) || e.conclusion?.toLowerCase().includes(q)) r.push({ type: '实验', id: e.id, label: e.title, extra: e.projectId }); });
    results.forEach(res => { if (res.title.toLowerCase().includes(q) || res.summary?.toLowerCase().includes(q)) r.push({ type: '结果', id: res.id, label: res.title }); });
    files.forEach(f => { if (f.name.toLowerCase().includes(q)) r.push({ type: '文件', id: f.id, label: f.name }); });
    references.forEach(ref => { if (ref.title.toLowerCase().includes(q)) r.push({ type: '文献', id: ref.id, label: ref.title }); });
    return r.slice(0, 15);
  }, [searchQuery, projects, experiments, results, files, references]);

  return (
    <div className="overlay" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
      <div className="modal search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap">
          <Search size={18} color="#9ca3af" />
          <input ref={inputRef} placeholder="搜索项目、实验、结果、文件..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>ESC</span>
        </div>
        <div className="search-results">
          {searchQuery && searchResults.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>未找到相关内容</div>}
          {searchResults.map((r, i) => (
            <div key={i} className="search-result-item" onClick={() => {
              setSearchOpen(false); setSearchQuery('');
              if (r.type === '项目') navigateTo('projectDetail', { projectId: r.id });
              else if (r.type === '实验') navigateTo('experimentDetail', { experimentId: r.id, projectId: r.extra });
              else if (r.type === '文件') navigateTo('files');
              else if (r.type === '文献') navigateTo('references');
            }}>
              <span className="search-result-type">{r.type}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// New Project Modal
// ═══════════════════════════════════════
function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { addProject } = useStore();
  const [form, setForm] = useState({ name: '', code: '', direction: '', keywords: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), endDate: '', status: '进行中' as const, milestones: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name) return;
    addProject({ ...form, keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean) } as any);
    onClose();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>新建项目</h2><X size={18} style={{ cursor: 'pointer', color: '#9ca3af' }} onClick={onClose} /></div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group"><label>项目名称 *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="例：琥珀酸代谢与抗肿瘤免疫" /></div>
            <div className="form-group"><label>项目编号</label><input className="form-input" value={form.code} onChange={e => set('code', e.target.value)} placeholder="PRJ-2025-001" /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label>研究方向</label><input className="form-input" value={form.direction} onChange={e => set('direction', e.target.value)} /></div>
            <div className="form-group"><label>负责人</label><input className="form-input" value={form.leader} onChange={e => set('leader', e.target.value)} /></div>
          </div>
          <div className="form-group"><label>关键词（逗号分隔）</label><input className="form-input" value={form.keywords} onChange={e => set('keywords', e.target.value)} /></div>
          <div className="form-group"><label>项目简介</label><textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="grid-3">
            <div className="form-group"><label>开始日期</label><input type="date" className="form-input" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
            <div className="form-group"><label>结束日期</label><input type="date" className="form-input" value={form.endDate} onChange={e => set('endDate', e.target.value)} /></div>
            <div className="form-group"><label>状态</label><select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}><option>进行中</option><option>暂停</option><option>已完成</option></select></div>
          </div>
          <div className="form-group"><label>里程碑</label><textarea className="form-textarea" value={form.milestones} onChange={e => set('milestones', e.target.value)} placeholder="M1: ..." /></div>
        </div>
        <div className="modal-footer"><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit}>创建项目</button></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Template Chooser + New Experiment Modal
// ═══════════════════════════════════════
function TemplateChooser({ onSelect, onClose }: { onSelect: (t: any) => void; onClose: () => void }) {
  const { templates } = useStore();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>选择实验模板</h2><X size={18} style={{ cursor: 'pointer', color: '#9ca3af' }} onClick={onClose} /></div>
        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} className="card template-card" onClick={() => onSelect(t)}>
              <div className="template-icon">{t.icon}</div>
              <div className="template-name">{t.name}</div>
            </div>
          ))}
          <div className="card template-card" style={{ borderStyle: 'dashed' }} onClick={() => onSelect(null)}>
            <div className="template-icon">📋</div>
            <div className="template-name" style={{ color: '#6b7280' }}>空白记录</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewExperimentModal({ template, onClose, defaultProjectId }: { template: any; onClose: () => void; defaultProjectId?: string }) {
  const { addExperiment, projects } = useStore();
  const fields = template?.fields || {};
  const [form, setForm] = useState({ projectId: defaultProjectId || projects[0]?.id || '', title: '', type: fields.type || '', date: new Date().toISOString().slice(0,10), purpose: '', materials: fields.materials || '', steps: fields.steps || '', parameters: '', results: '', conclusion: '', issues: '', nextSteps: '', status: '待处理' as const, contentFormat: 'plaintext' as const });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = () => { if (!form.title || !form.projectId) return; addExperiment(form as any); onClose(); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>{template ? `新建${template.name}记录` : '新建实验记录'}</h2><X size={18} style={{ cursor: 'pointer', color: '#9ca3af' }} onClick={onClose} /></div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group"><label>实验标题 *</label><input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
            <div className="form-group"><label>所属项目 *</label><select className="form-select" value={form.projectId} onChange={e => set('projectId', e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <div className="grid-3">
            <div className="form-group"><label>实验类型</label><input className="form-input" value={form.type} onChange={e => set('type', e.target.value)} /></div>
            <div className="form-group"><label>日期</label><input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div className="form-group"><label>状态</label><select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}><option>待处理</option><option>进行中</option><option>成功</option><option>失败</option><option>待复验</option></select></div>
          </div>
          <div className="form-group"><label>实验目的</label><textarea className="form-textarea" value={form.purpose} onChange={e => set('purpose', e.target.value)} /></div>
          <div className="form-group"><label>样本/材料</label><textarea className="form-textarea" value={form.materials} onChange={e => set('materials', e.target.value)} /></div>
          <div className="form-group"><label>实验步骤</label><textarea className="form-textarea" style={{ minHeight: 120 }} value={form.steps} onChange={e => set('steps', e.target.value)} /></div>
          <div className="form-group"><label>关键参数</label><textarea className="form-textarea" value={form.parameters} onChange={e => set('parameters', e.target.value)} /></div>
          <div className="form-group"><label>实验结果</label><textarea className="form-textarea" value={form.results} onChange={e => set('results', e.target.value)} /></div>
          <div className="form-group"><label>初步结论</label><textarea className="form-textarea" value={form.conclusion} onChange={e => set('conclusion', e.target.value)} /></div>
          <div className="form-group"><label>问题与异常</label><textarea className="form-textarea" value={form.issues} onChange={e => set('issues', e.target.value)} /></div>
          <div className="form-group"><label>下一步计划</label><textarea className="form-textarea" value={form.nextSteps} onChange={e => set('nextSteps', e.target.value)} /></div>
        </div>
        <div className="modal-footer"><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit}>保存记录</button></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// New Task Modal
// ═══════════════════════════════════════
function NewTaskModal({ onClose, defaultProjectId }: { onClose: () => void; defaultProjectId?: string }) {
  const { addTask, projects } = useStore();
  const [form, setForm] = useState({ name: '', projectId: defaultProjectId || projects[0]?.id || '', dueDate: '', priority: '中' as const, status: '待处理' as const, assignee: '', notes: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>新建任务</h2><X size={18} style={{ cursor: 'pointer', color: '#9ca3af' }} onClick={onClose} /></div>
        <div className="modal-body">
          <div className="form-group"><label>任务名称 *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label>所属项目</label><select className="form-select" value={form.projectId} onChange={e => set('projectId', e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="grid-3">
            <div className="form-group"><label>截止日期</label><input type="date" className="form-input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></div>
            <div className="form-group"><label>优先级</label><select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}><option>高</option><option>中</option><option>低</option></select></div>
            <div className="form-group"><label>负责人</label><input className="form-input" value={form.assignee} onChange={e => set('assignee', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={() => { if (form.name) { addTask(form as any); onClose(); } }}>创建</button></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════
function Dashboard() {
  const { projects, experiments, tasks, files, results, navigateTo } = useStore();
  const activeProjects = projects.filter(p => p.status === '进行中').length;
  const pendingTasks = tasks.filter(t => t.status !== '已完成').length;

  return (
    <div>
      <div className="page-header"><h1>工作台</h1><p>欢迎回来，这是你的科研工作概览</p></div>
      <div className="grid-4 mb-4">
        <div className="stat-card"><div className="flex justify-between items-center mb-2"><FolderOpen size={18} color="#2563eb" style={{ opacity: 0.7 }} /><span className="stat-value" style={{ color: '#2563eb' }}>{activeProjects}</span></div><span className="stat-label">进行中项目</span></div>
        <div className="stat-card"><div className="flex justify-between items-center mb-2"><FlaskConical size={18} color="#059669" style={{ opacity: 0.7 }} /><span className="stat-value" style={{ color: '#059669' }}>{experiments.length}</span></div><span className="stat-label">实验记录</span></div>
        <div className="stat-card"><div className="flex justify-between items-center mb-2"><CheckSquare size={18} color="#d97706" style={{ opacity: 0.7 }} /><span className="stat-value" style={{ color: '#d97706' }}>{pendingTasks}</span></div><span className="stat-label">待办任务</span></div>
        <div className="stat-card"><div className="flex justify-between items-center mb-2"><FileText size={18} color="#8b5cf6" style={{ opacity: 0.7 }} /><span className="stat-value" style={{ color: '#8b5cf6' }}>{files.length}</span></div><span className="stat-label">文件附件</span></div>
      </div>
      <div className="section-header"><span className="section-title">最近项目</span></div>
      <div className="grid-3 mb-4">
        {projects.slice(0, 3).map(p => (
          <div key={p.id} className="card clickable" style={{ marginBottom: 0 }} onClick={() => navigateTo('projectDetail', { projectId: p.id })}>
            <div className="flex justify-between items-center mb-2"><span className="font-bold">{p.name}</span><Badge>{p.status}</Badge></div>
            <p className="text-sm muted mb-2">{p.description?.slice(0, 80)}...</p>
            <div className="meta-row"><FlaskConical size={14} /> {experiments.filter(e => e.projectId === p.id).length} 实验 <FileText size={14} /> {results.filter(r => r.projectId === p.id).length} 结果</div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div>
          <div className="section-header"><span className="section-title">最近实验</span></div>
          {experiments.slice(0, 4).map(e => (
            <div key={e.id} className="card compact clickable" onClick={() => navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId })}>
              <div className="flex justify-between items-center"><span className="font-bold text-sm">{e.title}</span><Badge>{e.status}</Badge></div>
              <div className="meta-row mt-2"><Calendar size={14} /> {e.date} · {e.type}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="section-header"><span className="section-title">待办任务</span></div>
          {tasks.filter(t => t.status !== '已完成').slice(0, 5).map(t => {
            const proj = projects.find(p => p.id === t.projectId);
            return (
              <div key={t.id} className="card compact flex items-center gap-3">
                <input type="checkbox" checked={t.status === '已完成'} onChange={() => useStore.getState().updateTask(t.id, { status: t.status === '已完成' ? '待处理' : '已完成' })} />
                <div className="flex-1"><div className="font-bold text-sm">{t.name}</div><div className="text-xs muted">{proj?.name} · {t.dueDate ? formatDate(t.dueDate) : '无截止日'}</div></div>
                <Badge status={t.priority}>{t.priority}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Projects List
// ═══════════════════════════════════════
function ProjectsList({ onNewProject }: { onNewProject: () => void }) {
  const { projects, experiments, results, navigateTo } = useStore();
  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div><h1>项目管理</h1><p>管理你的所有科研课题</p></div>
        <button className="btn primary" onClick={onNewProject}><Plus size={16} /> 新建项目</button>
      </div>
      <div className="grid-2">
        {projects.map(p => (
          <div key={p.id} className="card clickable" style={{ marginBottom: 0 }} onClick={() => navigateTo('projectDetail', { projectId: p.id })}>
            <div className="flex justify-between items-center mb-2">
              <div><div className="font-bold" style={{ fontSize: 16 }}>{p.name}</div><div className="text-xs muted">{p.code} · {p.direction}</div></div>
              <Badge>{p.status}</Badge>
            </div>
            <p className="text-sm" style={{ color: '#6b7280', margin: '10px 0', lineHeight: 1.6 }}>{p.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 10 }}>{p.keywords?.map((k: string) => <span key={k} className="tag">{k}</span>)}</div>
            <div className="meta-row" style={{ borderTop: '1px solid #f1f3f5', paddingTop: 10 }}>
              <FlaskConical size={14} /> {experiments.filter(e => e.projectId === p.id).length} 实验
              <BarChart3 size={14} /> {results.filter(r => r.projectId === p.id).length} 结果
              <span style={{ marginLeft: 'auto' }}><Calendar size={14} /> {p.startDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Project Detail
// ═══════════════════════════════════════
function ProjectDetail({ onNewExperiment }: { onNewExperiment: () => void }) {
  const { selectedProjectId, projects, experiments, results, tasks, references, navigateTo, updateTask, deleteTask } = useStore();
  const [tab, setTab] = useState('overview');
  const project = projects.find(p => p.id === selectedProjectId);
  if (!project) return null;
  const exps = experiments.filter(e => e.projectId === project.id);
  const res = results.filter(r => r.projectId === project.id);
  const tsks = tasks.filter(t => t.projectId === project.id);
  const refs = references.filter(r => r.projectId === project.id);

  const tabs = [
    { key: 'overview', label: '概览' }, { key: 'experiments', label: `实验 (${exps.length})` },
    { key: 'results', label: `结果 (${res.length})` }, { key: 'tasks', label: `任务 (${tsks.length})` },
    { key: 'references', label: `文献 (${refs.length})` }, { key: 'timeline', label: '时间线' },
  ];

  return (
    <div>
      <div className="back-nav">
        <span className="back-btn" onClick={() => navigateTo('projects')}><ArrowLeft size={18} /></span>
        <div className="flex-1">
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{project.name}</h1>
          <div className="flex items-center gap-3"><Badge>{project.status}</Badge><span className="muted text-sm">{project.code} · {project.direction} · {project.leader}</span></div>
        </div>
        <button className="btn primary" onClick={onNewExperiment}><Plus size={16} /> 新建实验</button>
      </div>
      <div className="tab-bar">{tabs.map(t => <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>)}</div>

      {tab === 'overview' && (
        <div className="grid-2">
          <div>
            <div className="card"><h3 style={{ fontWeight: 600, marginBottom: 8 }}>项目简介</h3><p className="text-sm" style={{ lineHeight: 1.7, color: '#374151' }}>{project.description}</p><div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 12 }}>{project.keywords?.map((k: string) => <span key={k} className="tag">{k}</span>)}</div></div>
            <div className="card"><h3 style={{ fontWeight: 600, marginBottom: 8 }}>里程碑</h3><pre style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{project.milestones}</pre></div>
          </div>
          <div>
            <div className="grid-2 mb-4">
              <div className="stat-card"><span className="stat-value" style={{ color: '#2563eb' }}>{exps.length}</span><span className="stat-label">实验记录</span></div>
              <div className="stat-card"><span className="stat-value" style={{ color: '#059669' }}>{res.length}</span><span className="stat-label">实验结果</span></div>
            </div>
            <div className="card"><h3 style={{ fontWeight: 600, marginBottom: 8 }}>最近实验</h3>
              {exps.slice(0, 3).map(e => (
                <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }} className="flex justify-between" onClick={() => navigateTo('experimentDetail', { experimentId: e.id })}>
                  <span className="text-sm font-bold">{e.title}</span><Badge>{e.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'experiments' && exps.map(e => (
        <div key={e.id} className="card clickable" onClick={() => navigateTo('experimentDetail', { experimentId: e.id })}>
          <div className="flex justify-between items-center mb-2"><span className="font-bold" style={{ fontSize: 15 }}>{e.title}</span><Badge>{e.status}</Badge></div>
          <div className="meta-row mb-2"><Calendar size={14} /> {e.date} · {e.type}</div>
          <p className="text-sm muted">{e.purpose}</p>
        </div>
      ))}

      {tab === 'results' && <div className="grid-2">{res.map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 0 }}>
          <div className="flex justify-between mb-2"><span className="font-bold text-sm">{r.title}</span><Badge status={r.supportsHypothesis ? '成功' : '失败'}>{r.supportsHypothesis ? '支持假设' : '不支持'}</Badge></div>
          <p className="text-sm muted">{r.summary}</p><span className="tag mt-2">{r.type}</span>
        </div>
      ))}</div>}

      {tab === 'tasks' && tsks.map(t => (
        <div key={t.id} className="card compact flex items-center gap-3">
          <input type="checkbox" checked={t.status === '已完成'} onChange={() => updateTask(t.id, { status: t.status === '已完成' ? '待处理' : '已完成' })} />
          <div className="flex-1" style={{ textDecoration: t.status === '已完成' ? 'line-through' : 'none', opacity: t.status === '已完成' ? 0.5 : 1 }}>
            <div className="font-bold text-sm">{t.name}</div><div className="text-xs muted">{t.assignee} · {t.dueDate ? formatDate(t.dueDate) : '无截止日'}</div>
          </div>
          <Badge status={t.priority}>{t.priority}</Badge>
          <Trash2 size={16} style={{ cursor: 'pointer', color: '#d1d5db' }} onClick={() => deleteTask(t.id)} />
        </div>
      ))}

      {tab === 'references' && refs.map(r => (
        <div key={r.id} className="card">
          <div className="font-bold" style={{ fontSize: 15, marginBottom: 4 }}>{r.title}</div>
          <div className="text-sm muted mb-2">{r.authors} · <em>{r.journal}</em> ({r.year})</div>
          <div className="text-sm"><strong>核心结论：</strong>{r.coreConclusion}</div>
          <div className="text-sm" style={{ color: '#2563eb' }}><strong>与课题关系：</strong>{r.relation}</div>
        </div>
      ))}

      {tab === 'timeline' && <div className="card"><div className="timeline">
        {[...exps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
          <div key={e.id} className="timeline-item" style={{ cursor: 'pointer' }} onClick={() => navigateTo('experimentDetail', { experimentId: e.id })}>
            <div className="timeline-dot" /><div className="text-xs muted">{formatDate(e.date)}</div>
            <div className="font-bold text-sm">{e.title}</div><div className="text-sm muted">{e.conclusion?.slice(0, 100)}</div>
            <Badge>{e.status}</Badge>
          </div>
        ))}
      </div></div>}
    </div>
  );
}

// ═══════════════════════════════════════
// Experiment Detail
// ═══════════════════════════════════════
function ExperimentDetail() {
  const { selectedExperimentId, experiments, projects, results, navigateTo } = useStore();
  const exp = experiments.find(e => e.id === selectedExperimentId);
  if (!exp) return null;
  const proj = projects.find(p => p.id === exp.projectId);
  const expResults = results.filter(r => r.experimentId === exp.id);

  const Section = ({ title, content }: { title: string; content?: string }) => {
    if (!content) return null;
    return <div className="detail-section"><h4>{title}</h4><pre>{content}</pre></div>;
  };

  return (
    <div>
      <div className="back-nav">
        <span className="back-btn" onClick={() => proj ? navigateTo('projectDetail', { projectId: proj.id }) : navigateTo('experiments')}><ArrowLeft size={18} /></span>
        <div className="flex-1">
          {proj && <div className="flex items-center gap-2 mb-2"><span className="breadcrumb" onClick={() => navigateTo('projectDetail', { projectId: proj.id })}>{proj.name}</span><ChevronRight size={14} color="#d1d5db" /></div>}
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{exp.title}</h1>
          <div className="flex items-center gap-3"><Badge>{exp.status}</Badge><span className="muted text-sm"><Calendar size={14} /> {formatDate(exp.date)} · {exp.type}</span></div>
        </div>
      </div>
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <Section title="实验目的" content={exp.purpose} />
          <Section title="样本/材料" content={exp.materials} />
          <Section title="实验步骤" content={exp.steps} />
          <Section title="关键参数" content={exp.parameters} />
          <Section title="实验结果" content={exp.results} />
          <Section title="初步结论" content={exp.conclusion} />
          <Section title="问题与异常" content={exp.issues} />
          <Section title="下一步计划" content={exp.nextSteps} />
        </div>
        <div>
          <div className="card"><h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>关联结果 ({expResults.length})</h3>
            {expResults.map(r => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f3f5' }}>
                <div className="flex justify-between items-center"><span className="text-sm font-bold">{r.title}</span><span style={{ fontSize: 11, color: r.supportsHypothesis ? '#059669' : '#dc2626' }}>{r.supportsHypothesis ? '✓ 支持' : '✗ 不支持'}</span></div>
                <div className="text-xs muted">{r.summary}</div>
              </div>
            ))}
            {expResults.length === 0 && <div className="text-sm muted">暂无关联结果</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Experiments List
// ═══════════════════════════════════════
function ExperimentsList({ onNewExperiment }: { onNewExperiment: () => void }) {
  const { experiments, projects, results, navigateTo } = useStore();
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? experiments : experiments.filter(e => e.status === filter);
  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div><h1>实验记录</h1><p>所有实验的结构化记录</p></div>
        <button className="btn primary" onClick={onNewExperiment}><Plus size={16} /> 新建实验</button>
      </div>
      <div className="flex gap-2 mb-4">
        {['all', '成功', '失败', '待复验', '进行中', '待处理'].map(f => (
          <button key={f} className={`btn sm ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? '全部' : f}</button>
        ))}
      </div>
      {filtered.map(e => {
        const proj = projects.find(p => p.id === e.projectId);
        return (
          <div key={e.id} className="card clickable" onClick={() => navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId })}>
            <div className="flex justify-between items-center mb-2"><div><span className="font-bold" style={{ fontSize: 15 }}>{e.title}</span>{proj && <span className="text-xs" style={{ color: '#2563eb', marginLeft: 10 }}><Link2 size={12} /> {proj.name}</span>}</div><Badge>{e.status}</Badge></div>
            <div className="meta-row mb-2"><Calendar size={14} /> {e.date} · {e.type} · {results.filter(r => r.experimentId === e.id).length} 个结果</div>
            <p className="text-sm muted">{e.purpose}</p>
            {e.conclusion && <p className="text-sm font-bold mt-2" style={{ color: '#374151' }}>结论: {e.conclusion.slice(0, 120)}...</p>}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// Files Page
// ═══════════════════════════════════════
function FilesPage() {
  const { files } = useStore();
  const [typeFilter, setTypeFilter] = useState('all');
  const types = [...new Set(files.map(f => f.fileType))];
  const filtered = typeFilter === 'all' ? files : files.filter(f => f.fileType === typeFilter);
  return (
    <div>
      <div className="page-header"><h1>文件管理</h1><p>管理所有科研附件和数据文件</p></div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <button className={`btn sm ${typeFilter === 'all' ? 'primary' : ''}`} onClick={() => setTypeFilter('all')}>全部 ({files.length})</button>
        {types.map(t => <button key={t} className={`btn sm ${typeFilter === t ? 'primary' : ''}`} onClick={() => setTypeFilter(t)}>{FILE_ICONS[t] || FILE_ICONS.default} {t}</button>)}
      </div>
      <div className="file-grid">
        {filtered.map(f => (
          <div key={f.id} className="card compact" style={{ marginBottom: 0 }}>
            <div className="file-card">
              <span className="file-icon">{FILE_ICONS[f.fileType] || FILE_ICONS.default}</span>
              <div className="file-info"><div className="file-name">{f.name}</div><div className="file-meta">{formatFileSize(f.fileSize)} · {f.createdAt}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>{f.tags?.map((t: string) => <span key={t} className="tag" style={{ fontSize: 10.5 }}>{t}</span>)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// References Page
// ═══════════════════════════════════════
function ReferencesPage() {
  const { references, projects } = useStore();
  return (
    <div>
      <div className="page-header"><h1>文献管理</h1><p>科研相关文献笔记</p></div>
      {references.map(r => {
        const proj = projects.find(p => p.id === r.projectId);
        return (
          <div key={r.id} className="card">
            <div className="font-bold" style={{ fontSize: 15, marginBottom: 4, lineHeight: 1.4 }}>{r.title}</div>
            <div className="text-sm muted mb-2">{r.authors} · <em>{r.journal}</em> ({r.year})</div>
            <div className="text-sm mb-2"><strong>核心结论：</strong>{r.coreConclusion}</div>
            <div className="text-sm" style={{ color: '#2563eb' }}><strong>与课题关系：</strong>{r.relation}</div>
            <div className="meta-row mt-2">{r.doi && <span>DOI: {r.doi}</span>}{proj && <span><FolderOpen size={14} /> {proj.name}</span>}</div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// Templates Page
// ═══════════════════════════════════════
function TemplatesPage({ onSelectTemplate }: { onSelectTemplate: (t: any) => void }) {
  const { templates } = useStore();
  return (
    <div>
      <div className="page-header"><h1>实验模板</h1><p>预设的实验记录模板，快速开始</p></div>
      <div className="grid-3">
        {templates.map(t => (
          <div key={t.id} className="card template-card" onClick={() => onSelectTemplate(t)}>
            <div className="template-icon">{t.icon}</div><div className="template-name">{t.name}</div>
            <div className="text-sm muted mt-2">点击使用此模板</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Settings Page (placeholder)
// ═══════════════════════════════════════
function SettingsPage() {
  return (
    <div>
      <div className="page-header"><h1>设置</h1><p>应用设置与数据管理</p></div>
      <div className="grid-2">
        <div className="card"><h3 style={{ fontWeight: 600, marginBottom: 12 }}>🔒 安全设置</h3><p className="text-sm muted">启动密码、密钥管理、数据加密</p><button className="btn sm mt-2">管理</button></div>
        <div className="card"><h3 style={{ fontWeight: 600, marginBottom: 12 }}>💾 备份与恢复</h3><p className="text-sm muted">创建完整备份、从备份恢复</p><button className="btn sm mt-2">备份</button></div>
        <div className="card"><h3 style={{ fontWeight: 600, marginBottom: 12 }}>🤖 AI 助手</h3><p className="text-sm muted">AI 模型配置（即将推出）</p><button className="btn sm mt-2" disabled>配置</button></div>
        <div className="card"><h3 style={{ fontWeight: 600, marginBottom: 12 }}>ℹ️ 关于</h3><p className="text-sm muted">BioLab v0.1.0<br/>本地优先 · 隐私安全 · 科研专用</p></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main App
// ═══════════════════════════════════════
export default function App() {
  const { currentView, searchOpen, setSearchOpen, navigateTo, selectedProjectId } = useStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [showTemplateChooser, setShowTemplateChooser] = useState(false);
  const [showNewExperiment, setShowNewExperiment] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showNewTask, setShowNewTask] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); useStore.getState().setSearchQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  const handleSelectTemplate = (t: any) => { setSelectedTemplate(t); setShowTemplateChooser(false); setShowNewExperiment(true); };
  const startNewExperiment = () => setShowTemplateChooser(true);

  const navItems = [
    { key: 'dashboard', label: '工作台', icon: <Home size={18} /> },
    { key: 'projects', label: '项目管理', icon: <FolderOpen size={18} /> },
    { key: 'experiments', label: '实验记录', icon: <FlaskConical size={18} /> },
    { key: 'files', label: '文件管理', icon: <FileText size={18} /> },
    { key: 'references', label: '文献管理', icon: <BookOpen size={18} /> },
    { key: 'templates', label: '实验模板', icon: <LayoutTemplate size={18} /> },
    { key: 'settings', label: '设置', icon: <Settings size={18} /> },
  ];

  const isActive = (key: string) => currentView === key || (key === 'projects' && currentView === 'projectDetail') || (key === 'experiments' && currentView === 'experimentDetail');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'projects': return <ProjectsList onNewProject={() => setShowNewProject(true)} />;
      case 'projectDetail': return <ProjectDetail onNewExperiment={startNewExperiment} />;
      case 'experiments': return <ExperimentsList onNewExperiment={startNewExperiment} />;
      case 'experimentDetail': return <ExperimentDetail />;
      case 'files': return <FilesPage />;
      case 'references': return <ReferencesPage />;
      case 'templates': return <TemplatesPage onSelectTemplate={handleSelectTemplate} />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo" onClick={() => navigateTo('dashboard')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/></svg>
          <span>Lab Data System</span>
        </div>
        <div className="nav-section">
          {navItems.map(item => (
            <div key={item.key} className={`nav-item ${isActive(item.key) ? 'active' : ''}`} onClick={() => navigateTo(item.key as any)}>
              {item.icon}<span>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">本地存储 · 隐私优先<br />Lab Data System v0.1.0</div>
      </div>
      <div className="main">
        <div className="topbar">
          <div className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={18} color="#9ca3af" /><span>搜索项目、实验、文件...</span><span className="kbd">⌘K</span>
          </div>
          <button className="btn primary" onClick={startNewExperiment}><Plus size={16} /> 新建实验</button>
        </div>
        <div className="content">{renderView()}</div>
      </div>

      {searchOpen && <SearchOverlay />}
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
      {showTemplateChooser && <TemplateChooser onSelect={handleSelectTemplate} onClose={() => setShowTemplateChooser(false)} />}
      {showNewExperiment && <NewExperimentModal template={selectedTemplate} onClose={() => { setShowNewExperiment(false); setSelectedTemplate(null); }} defaultProjectId={selectedProjectId || undefined} />}
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} defaultProjectId={selectedProjectId || undefined} />}
    </div>
  );
}
