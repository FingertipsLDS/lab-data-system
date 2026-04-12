// @ts-nocheck
import React from 'react';
import { createPortal } from 'react-dom';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from './stores/appStore';
import { formatDate, formatFileSize, STATUS_COLORS, STATUS_BG, FILE_ICONS } from './utils/formatters';
import { FileUploadZone } from './components/FileUploadZone';
import { PDFReader } from './components/PDFReader';
import { Home, FolderOpen, FlaskConical, BarChart3, BookOpen, LayoutTemplate, Search, Plus, ArrowLeft, X, Settings, Calendar, Trash2, LogOut, Archive, FileText, ChevronRight } from 'lucide-react';
import './App.css';
import { BioBackground } from './components/BioBackground';

// ═══ Custom Dialog ═══
let _dialogResolve: ((v: string | boolean | null) => void) | null = null;
let _setDialog: ((d: any) => void) | null = null;

function showAlert(msg: string) {
  return new Promise<boolean>(resolve => {
    _dialogResolve = resolve;
    _setDialog?.({ type: 'alert', msg });
  });
}
function showConfirm(msg: string) {
  return new Promise<boolean>(resolve => {
    _dialogResolve = resolve;
    _setDialog?.({ type: 'confirm', msg });
  });
}
function showPrompt(msg: string, defaultVal = '') {
  return new Promise<string | null>(resolve => {
    _dialogResolve = resolve;
    _setDialog?.({ type: 'prompt', msg, defaultVal });
  });
}

function DialogHost() {
  const [dlg, setDlg] = useState<any>(null);
  const [inputVal, setInputVal] = useState('');
  _setDialog = (d: any) => { setDlg(d); if (d?.defaultVal) setInputVal(d.defaultVal); else setInputVal(''); };

  const close = (result: any) => { setDlg(null); _dialogResolve?.(result); _dialogResolve = null; };

  if (!dlg) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999999 }} onClick={() => { if (dlg.type !== 'prompt') close(false); }}>
      <div style={{ background:'#1a1f2e', border:'1px solid rgba(125,211,252,0.15)', borderRadius:12, padding:'24px 28px', minWidth:300, maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:14, color:'#f1f5f9', lineHeight:1.6, marginBottom:18, whiteSpace:'pre-wrap' }}>{dlg.msg}</div>
        {dlg.type === 'prompt' && (
          <input style={{ width:'100%', padding:'8px 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(125,211,252,0.15)', borderRadius:6, color:'#f1f5f9', fontSize:13, outline:'none', marginBottom:16, boxSizing:'border-box', fontFamily:'inherit' }} value={inputVal} onChange={e => setInputVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') close(inputVal); if (e.key === 'Escape') close(null); }} />
        )}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          {dlg.type !== 'alert' && (
            <div style={{ padding:'7px 20px', borderRadius:6, fontSize:13, color:'#d0d4dc', cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', transition:'all 0.2s' }} onClick={() => close(dlg.type === 'prompt' ? null : false)}>取消</div>
          )}
          <div style={{ padding:'7px 20px', borderRadius:6, fontSize:13, color:'#7dd3fc', cursor:'pointer', background:'rgba(125,211,252,0.1)', border:'1px solid rgba(125,211,252,0.2)', fontWeight:600, transition:'all 0.2s' }} onClick={() => close(dlg.type === 'prompt' ? inputVal : true)}>确定</div>
        </div>
      </div>
    <DialogHost />
    </div>
  );
}


const Badge = ({ children, status }: { children: string; status?: string }) => (
  <span className="badge" style={{ color: STATUS_COLORS[status || children] || '#576178', background: STATUS_BG[status || children] || 'rgba(113,128,150,0.08)' }}>{children}</span>
);

function NewButton({ onAction }: { onAction: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div className="new-btn-wrap" ref={ref}>
      <button className="btn primary" onClick={() => setOpen(!open)}><Plus size={14} /> 新建</button>
      {open && <div className="new-dropdown">
        {[{ k: 'project', icon: <FolderOpen size={15} />, l: '新建课题' }, { k: 'experiment', icon: <FlaskConical size={15} />, l: '新建实验' }, { k: 'template', icon: <LayoutTemplate size={15} />, l: '从模板创建' }, { k: 'reference', icon: <BookOpen size={15} />, l: '添加文献' }].map(i => (
          <div key={i.k} className="new-dropdown-item" onClick={() => { onAction(i.k); setOpen(false); }}>{i.icon}{i.l}</div>
        ))}
      </div>}
    </div>
  );
}

function SearchOverlay() {
  const { searchQuery, setSearchQuery, setSearchOpen, navigateTo, projects, experiments, results, references } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const sr = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase(); const r: any[] = [];
    projects.forEach(p => { if (p.name.toLowerCase().includes(q)) r.push({ type: '课题', id: p.id, label: p.name }); });
    experiments.forEach(e => { if (e.title.toLowerCase().includes(q)) r.push({ type: '实验', id: e.id, label: e.title, extra: e.projectId }); });
    results.forEach(res => { if (res.title.toLowerCase().includes(q)) r.push({ type: '结果', id: res.id, label: res.title }); });
    references.forEach(ref => { if (ref.title.toLowerCase().includes(q)) r.push({ type: '文献', id: ref.id, label: ref.title }); });
    return r.slice(0, 12);
  }, [searchQuery, projects, experiments, results, references]);
  return (
    <div className="overlay" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
      <div className="modal search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap"><Search size={16} color="#576178" /><input ref={inputRef} placeholder="搜索项目、实验、结果..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /><span className="kbd-hint">ESC</span></div>
        <div className="search-results">
          {searchQuery && sr.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#d0d4dc' }}>未找到</div>}
          {sr.map((r, i) => <div key={i} className="search-result-item" onClick={() => { setSearchOpen(false); setSearchQuery(''); if (r.type === '课题') navigateTo('projectDetail', { projectId: r.id }); else if (r.type === '实验') navigateTo('experimentDetail', { experimentId: r.id, projectId: r.extra }); else if (r.type === '结果') navigateTo('results'); else navigateTo('library'); }}><span className="search-result-type">{r.type}</span><span style={{ flex: 1 }}>{r.label}</span></div>)}
        </div>
      </div>
    </div>
  );
}

// ═══ Modals ═══
function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { addProject } = useStore();
  const [f, sf] = useState({ name: '', code: '', direction: '', keywords: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), endDate: '', status: '进行中', milestones: '' });
  const s = (k: string, v: string) => sf(p => ({ ...p, [k]: v }));
  return (<div className="overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
    <div className="modal-header"><h2>新建课题</h2><X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={onClose} /></div>
    <div className="modal-body">
      <div className="grid-2"><div className="form-group"><label>项目名称 *</label><input className="form-input" value={f.name} onChange={e => s('name', e.target.value)} autoFocus /></div><div className="form-group"><label>编号</label><input className="form-input" value={f.code} onChange={e => s('code', e.target.value)} /></div></div>
      <div className="grid-2"><div className="form-group"><label>方向</label><input className="form-input" value={f.direction} onChange={e => s('direction', e.target.value)} /></div><div className="form-group"><label>负责人</label><input className="form-input" value={f.leader} onChange={e => s('leader', e.target.value)} /></div></div>
      <div className="form-group"><label>关键词</label><input className="form-input" value={f.keywords} onChange={e => s('keywords', e.target.value)} placeholder="逗号分隔" /></div>
      <div className="form-group"><label>简介</label><textarea className="form-textarea" value={f.description} onChange={e => s('description', e.target.value)} /></div>
    </div>
    <div className="modal-footer"><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={() => { if (f.name) { addProject(f as any); onClose(); } else showAlert('请填写课题名称'); }}>创建</button></div>
  </div></div>);
}
function TemplateChooser({ onSelect, onClose }: { onSelect: (t: any) => void; onClose: () => void }) {
  const { templates } = useStore();
  return (<div className="overlay" onClick={onClose}><div className="modal sm" onClick={e => e.stopPropagation()}>
    <div className="modal-header"><h2>选择实验</h2><X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={onClose} /></div>
    <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {templates.map(t => <div key={t.id} className="card template-card" style={{ marginBottom: 0 }} onClick={() => onSelect(t)}><div className="template-icon">{t.icon}</div><div className="template-name">{t.name}</div></div>)}
      <div className="card template-card" style={{ marginBottom: 0, borderStyle: 'dashed' }} onClick={() => onSelect(null)}><div className="template-icon" style={{ opacity: 0.4 }}>📋</div><div className="template-name" style={{ color: '#d0d4dc' }}>空白</div></div>
    </div>
  </div></div>);
}

// ═══ Custom Dark Select ═══
function DarkSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: {value: string; label: string}[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
        background: 'rgba(255,255,255,0.03)', border: '1px solid ' + (open ? 'rgba(125,211,252,0.35)' : 'rgba(125,211,252,0.12)'),
        color: selected ? '#f1f5f9' : '#4a5568', fontSize: 13,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'all 0.25s', boxShadow: open ? '0 0 0 3px rgba(125,211,252,0.06)' : 'none',
      }}>
        <span>{selected ? selected.label : (placeholder || '请选择')}</span>
        <span style={{ color: '#7dd3fc', fontSize: 10, transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 100,
          background: '#1a1f2e', border: '1px solid rgba(125,211,252,0.15)', borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)', maxHeight: 200, overflowY: 'auto',
          padding: 4,
        }}>
          {options.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{
              padding: '8px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
              color: o.value === value ? '#7dd3fc' : '#a0aec0',
              background: o.value === value ? 'rgba(125,211,252,0.08)' : 'transparent',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
            onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ Custom Dark Date Picker ═══
function DarkDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [vY, setVY] = useState(parsed.getFullYear());
  const [vM, setVM] = useState(parsed.getMonth());

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysIn = new Date(vY, vM + 1, 0).getDate();
  const first = new Date(vY, vM, 1).getDay();
  useEffect(() => {
    const syncFromGlobal = () => {
      const gl = (window as any).__biolab_timer_left;
      const gt = (window as any).__biolab_timer_total;
      const go = (window as any).__biolab_timer_on;
      if (gt > 0) { setTotal(gt); setLeft(gl || 0); setOn(!!go); }
    };
    syncFromGlobal();
    window.addEventListener('biolab-timer-tick', syncFromGlobal);
    return () => window.removeEventListener('biolab-timer-tick', syncFromGlobal);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

  const pick = (d: number) => {
    const str = vY + '-' + pad(vM + 1) + '-' + pad(d);
    onChange(str);
    setOpen(false);
  };

  const prev = () => { if (vM === 0) { setVY(vY - 1); setVM(11); } else setVM(vM - 1); };
  const next = () => { if (vM === 11) { setVY(vY + 1); setVM(0); } else setVM(vM + 1); };

  const displayVal = value || '选择日期';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
        background: 'rgba(255,255,255,0.03)', border: '1px solid ' + (open ? 'rgba(125,211,252,0.35)' : 'rgba(125,211,252,0.12)'),
        color: value ? '#f1f5f9' : '#4a5568', fontSize: 13,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'all 0.25s', boxShadow: open ? '0 0 0 3px rgba(125,211,252,0.06)' : 'none',
      }}>
        <span>{displayVal}</span>
        <span style={{ fontSize: 14 }}>📅</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
          background: '#1a1f2e', border: '1px solid rgba(125,211,252,0.15)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)', padding: 12, width: 260,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ cursor: 'pointer', color: '#d0d4dc', fontSize: 16, padding: '0 6px' }} onClick={prev}>‹</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{vY}年{vM + 1}月</span>
            <span style={{ cursor: 'pointer', color: '#d0d4dc', fontSize: 16, padding: '0 6px' }} onClick={next}>›</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
            {['日','一','二','三','四','五','六'].map(w => <div key={w} style={{ textAlign: 'center', fontSize: 10, color: '#d0d4dc', fontWeight: 600, padding: 2 }}>{w}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {Array.from({ length: first }, (_, i) => <div key={'b' + i} />)}
            {Array.from({ length: daysIn }, (_, i) => {
              const d = i + 1;
              const str = vY + '-' + pad(vM + 1) + '-' + pad(d);
              const isSel = str === value;
              const isTd = str === todayStr;
              return (
                <div key={d} onClick={() => pick(d)} style={{
                  textAlign: 'center', padding: '5px 0', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  color: isSel ? '#fff' : isTd ? '#7dd3fc' : '#a0aec0',
                  background: isSel ? 'rgba(125,211,252,0.3)' : isTd ? 'rgba(125,211,252,0.08)' : 'transparent',
                  fontWeight: isSel || isTd ? 700 : 400, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(125,211,252,0.06)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isTd ? 'rgba(125,211,252,0.08)' : 'transparent'; }}
                >{d}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NewExperimentModal({ template, onClose, defaultProjectId }: { template: any; onClose: () => void; defaultProjectId?: string }) {
  const { addExperiment, projects, deleteExperiment } = useStore();
  const expMode = typeof window !== 'undefined' ? localStorage.getItem('biolab-exp-mode') : null;
  const modalTitle = expMode === 'future' ? '未来计划' : expMode === 'today' ? '新建实验' : '新建实验';
  const modalTitleColor = expMode === 'future' ? '#34d399' : expMode === 'today' ? '#7dd3fc' : undefined;
  React.useEffect(() => { return () => { localStorage.removeItem('biolab-exp-mode'); }; }, []);
  const editRaw = typeof window !== 'undefined' ? localStorage.getItem('biolab-edit-exp') : null;
  const editExp = React.useMemo(() => { try { return editRaw ? JSON.parse(editRaw) : null; } catch { return null; } }, [editRaw]);
  const editTl = React.useMemo(() => { try { return editExp?.parameters ? JSON.parse(editExp.parameters) : null; } catch { return null; } }, [editExp]);
  const editSteps = editTl?.milestones?.length ? editTl.milestones.map((m: any) => ({ day: m.day ?? 0, name: m.label ?? m.name ?? '', detail: m.detail ?? '' })) : null;
  React.useEffect(() => { return () => { localStorage.removeItem('biolab-edit-exp'); }; }, []);
  const [name, setName] = useState(editExp?.title || template?.name || '');
  const [projectId, setProjectId] = useState(editExp?.projectId || defaultProjectId || projects[0]?.id || '');
  const [startDate, setStartDate] = useState(editExp?.date || localStorage.getItem('biolab-new-exp-date') || new Date().toISOString().slice(0, 10));
  const [steps, setSteps] = useState<{day: number; name: string; detail: string}[]>(
    editSteps || (template?.steps?.length ? template.steps.map((s: any) => ({ day: s.day ?? 0, name: s.name ?? '', detail: s.detail ?? s.description ?? '' })) : [{ day: 0, name: '', detail: '' }])
  );
  const [aiText, setAiText] = useState('');
  const [aiOpen, setAiOpen] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [nameErr, setNameErr] = useState(false);
  const [stepErr, setStepErr] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);

  useEffect(() => {
    const syncFromGlobal = () => {
      const gl = (window as any).__biolab_timer_left;
      const gt = (window as any).__biolab_timer_total;
      const go = (window as any).__biolab_timer_on;
      if (gt > 0) { setTotal(gt); setLeft(gl || 0); setOn(!!go); }
    };
    syncFromGlobal();
    window.addEventListener('biolab-timer-tick', syncFromGlobal);
    return () => window.removeEventListener('biolab-timer-tick', syncFromGlobal);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];

  const getStepDate = (day: number) => {
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + day);
    return d;
  };

  const fmtDate = (d: Date) => (d.getMonth()+1) + '/' + d.getDate();

  const addStep = () => {
    const lastDay = steps.length > 0 ? steps[steps.length - 1].day + 1 : 0;
    setSteps(prev => [...prev, { day: lastDay, name: '', detail: '' }]);
  };

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: string, value: any) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'day' ? (parseInt(value) || 0) : value } : s));
  };

  const sortedSteps = [...steps].sort((a, b) => a.day - b.day);

  // AI parse (DeepSeek, key 由用户在设置中填写)
  const doAiParse = async () => {
    if (aiText.trim().length < 10) return;
    setAiLoading(true);
    try {
      const { invoke: inv } = await import('@tauri-apps/api/core');
      const savedKey: string | null = await inv('get_api_key', { provider: 'deepseek' });
      if (!savedKey || !savedKey.trim()) {
        setAiLoading(false);
        await showAlert('请先在右上角头像菜单 → AI 密钥中配置 DeepSeek API Key');
        return;
      }
      const resultJson: string = await inv('ai_parse_experiment', { text: aiText, startDate });
      const result = JSON.parse(resultJson);

      if (result.steps && result.steps.length > 0) {
        const parsed = result.steps.map((s: any) => ({
          day: s.day || 0,
          name: s.name || '',
          detail: s.description || '',
          duration: s.duration || '',
        }));
        if (result.experiment_name && !name) {
          setName(result.experiment_name);
        }
        // Save display_mode
        if (result.display_mode) {
          localStorage.setItem('biolab-new-exp-display-mode', result.display_mode);
        }
        if (result.experiment_type) {
          localStorage.setItem('biolab-new-exp-type', result.experiment_type);
        }
        // Merge same-day steps
        const mergedParsed: typeof parsed = [];
        for (const s of parsed) {
          const existing = mergedParsed.find(m => m.day === s.day);
          if (existing) {
            existing.name = existing.name + ' + ' + s.name;
            existing.detail = [existing.detail, s.detail].filter(Boolean).join('; ');
          } else {
            mergedParsed.push({ ...s });
          }
        }
        if (steps.length === 1 && !steps[0].name) {
          setSteps(mergedParsed);
        } else {
          setSteps(prev => [...prev, ...mergedParsed]);
        }
        setAiDone(true);
        setTimeout(() => { setAiDone(false); setAiOpen(false); }, 1800);
      } else {
        await showAlert('未识别出实验步骤，请调整文本后再试');
      }
    } catch (e: any) {
      const msg = String((e as any)?.message || e || '');
      if (msg.includes('NO_API_KEY')) {
        setAiLoading(false);
        await showAlert('请先在右上角头像菜单 → AI 密钥中配置 DeepSeek API Key');
        return;
      }
      console.error('AI parse error:', e);
      await showAlert('解析失败: ' + String(e));
    }
    setAiLoading(false);
  };

  const doSave = async () => {
    // Validate
    if (!name.trim()) { setNameErr(true); setTimeout(() => setNameErr(false), 1500); return; }
    if (steps.length === 0) { await showAlert('请至少添加一个实验步骤'); return; }
    const emptyIdx = steps.findIndex(s => !s.name.trim());
    if (emptyIdx >= 0) { setStepErr(emptyIdx); setTimeout(() => setStepErr(-1), 1500); return; }

    // Auto create project if needed
    let pid = projectId;
    if (!pid) {
      const pname = await showPrompt('还没有课题，请输入课题名称：');
      if (!pname) return;
      await useStore.getState().addProject({ name: pname, code: '', direction: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), status: '进行中', tags: '[]', budget: 0 } as any);
      await useStore.getState().loadAll();
      const np = useStore.getState().projects;
      pid = np[np.length - 1]?.id || '';
    }

    // Merge same-day steps
    const merged: typeof steps = [];
    const sorted0 = [...steps].sort((a, b) => a.day - b.day);
    for (const s of sorted0) {
      const existing = merged.find(m => m.day === s.day);
      if (existing) {
        existing.name = existing.name + ' + ' + s.name;
        existing.detail = [existing.detail, s.detail].filter(Boolean).join('; ');
      } else {
        merged.push({ ...s });
      }
    }
    const sorted = merged;
    const maxDay = sorted.length > 0 ? sorted[sorted.length - 1].day + 1 : 1;
    const milestones = sorted.map(s => ({ day: s.day, label: s.name }));
    const displayMode = localStorage.getItem('biolab-new-exp-display-mode') || 'timeline';
    const expType = localStorage.getItem('biolab-new-exp-type') || '';
    const params = JSON.stringify({ duration_days: maxDay, milestones, display_mode: displayMode });
    localStorage.removeItem('biolab-new-exp-display-mode');
    localStorage.removeItem('biolab-new-exp-type');
    const stepsText = sorted.map(s => 'D' + s.day + ': ' + s.name + (s.detail ? ' - ' + s.detail : '')).join('\n');

    setSaving(true);
    if (editExp?.id) { try { await deleteExperiment(editExp.id); } catch {} }
    await addExperiment({
      projectId: pid,
      title: name.trim(),
      type: template?.name || '',
      date: startDate,
      purpose: '',
      materials: '',
      steps: stepsText,
      parameters: params,
      results: '', conclusion: '', issues: '', nextSteps: '',
      status: '进行中',
    } as any);
    localStorage.removeItem('biolab-new-exp-date');

    // Save as template if checked
    if (saveTpl && steps.length > 0 && steps.some(s => s.name.trim())) {
      const tplName = name.trim() || '未命名模板';
      const tpl = { id: 'user-' + Date.now(), name: tplName, icon: '📋', cat: template?.fields?.type || '自定义', desc: steps.filter(s => s.name.trim()).map(s => 'D' + s.day + ' ' + s.name).join(' → '), steps: steps.filter(s => s.name.trim()).map(s => ({ day: s.day, name: s.name, detail: s.detail })) };
      const saved = JSON.parse(localStorage.getItem('biolab-user-templates') || '[]');
      saved.push(tpl);
      localStorage.setItem('biolab-user-templates', JSON.stringify(saved));
    }
    // Brief success state then close
    setTimeout(() => { setSaving(false); onClose(); }, 800);
  };

  const handleBack = async () => {
    if (name || steps.some(s => s.name)) {
      const ok = await showConfirm('放弃本次编辑？');
      if (!ok) return;
    }
    localStorage.removeItem('biolab-new-exp-date');
    onClose();
  };

  return (
    <div className="overlay" onClick={handleBack}>
      <div className="modal" style={{ maxWidth: 900, width: '95vw', maxHeight: '90vh', overflow: 'auto', borderRadius: 14, padding: 0 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
          <span style={{ cursor: 'pointer', color: '#d0d4dc', fontSize: 16 }} onClick={handleBack}>←</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f2' }}><span style={{ color: modalTitleColor }}>{modalTitle}</span></span>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Basic info - one row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 2, minWidth: 0 }}>
              <label style={{ fontSize: 16, color: '#f0f0f2', fontWeight: 600, marginBottom: 8, display: 'block' }}>实验名称</label>
              <input value={name} onChange={e => setName(e.target.value)}
                style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 10, background: '#222225', border: '1px solid ' + (nameErr ? '#fc8181' : 'rgba(255,255,255,0.06)'), color: '#f0f0f2', fontSize: 14, outline: 'none', transition: 'border 0.25s', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'rgba(125,211,252,0.3)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
              />
            </div>
            <div style={{ flex: 1.5, minWidth: 0 }}>
              <label style={{ fontSize: 16, color: '#f0f0f2', fontWeight: 600, marginBottom: 8, display: 'block' }}>所属课题</label>
            <DarkSelect value={projectId} onChange={async (v) => {
              if (v === '__new__') {
                const pn = await showPrompt('输入课题名称：');
                if (!pn || !pn.trim()) return;
                const name = pn.trim();
                await useStore.getState().addProject({ name, code: '', direction: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), status: '进行中', tags: '[]', budget: 0 } as any);
                await useStore.getState().loadAll();
                const np = useStore.getState().projects;
                const created = [...np].reverse().find((p: any) => p.name === name);
                if (created) setProjectId(created.id);
              } else setProjectId(v);
            }} options={[...projects.map(p => ({ value: p.id, label: p.name })), { value: '__new__', label: '+ 新建课题' }]} placeholder="选择课题" />
            </div>
            <div style={{ width: 150, position: 'relative' }}>
              <label style={{ fontSize: 16, color: '#f0f0f2', fontWeight: 600, marginBottom: 8, display: 'block' }}>起始日期</label>
              <DarkDatePicker value={startDate} onChange={v => setStartDate(v)} />
            </div>
          </div>

          {/* AI Parse section */}
          <div style={{ border: '1px solid rgba(183,148,244,0.25)', borderRadius: 14, marginBottom: 20, padding: '14px 18px', background: 'rgba(183,148,244,0.03)', boxShadow: '0 0 32px rgba(183,148,244,0.08), inset 0 0 40px rgba(183,148,244,0.02)', transition: 'all 0.3s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(183,148,244,0.5)'; e.currentTarget.style.boxShadow = '0 0 60px rgba(183,148,244,0.2), inset 0 0 50px rgba(183,148,244,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(183,148,244,0.25)'; e.currentTarget.style.boxShadow = '0 0 32px rgba(183,148,244,0.08), inset 0 0 40px rgba(183,148,244,0.02)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(183,148,244,0.18)', border: '1px solid rgba(183,148,244,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#d6bcfa', boxShadow: '0 0 16px rgba(183,148,244,0.3)' }}>✦</div>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#f0f0f2' }}>粘贴文本,AI解析</div>
              <div onClick={doAiParse} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: aiText.trim().length >= 10 ? 'pointer' : 'default',
                background: aiLoading ? 'rgba(72,187,120,0.12)' : aiDone ? 'rgba(72,187,120,0.12)' : 'rgba(125,211,252,0.12)',
                border: '1px solid ' + (aiDone ? 'rgba(72,187,120,0.25)' : 'rgba(125,211,252,0.25)'),
                color: aiDone ? '#48bb78' : '#7dd3fc',
                opacity: aiText.trim().length >= 10 ? 1 : 0.35,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {aiLoading ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span> : '✦'}
                {aiLoading ? '解析中' : aiDone ? '解析完成' : 'AI解析'}
              </div>
            </div>
            {aiDone && <div style={{ padding: '4px 10px', borderRadius: 10, background: 'rgba(125,211,252,0.08)', color: '#7dd3fc', fontSize: 11, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>✓ AI 已解析 · 可编辑</div>}
            <textarea value={aiText} onChange={e => setAiText(e.target.value)}
              placeholder="粘贴实验步骤描述..."
              style={{ width: '100%', minHeight: 100, padding: 12, borderRadius: 10, background: '#222225', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f0f2', fontSize: 12, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }}
            />
          </div>

          {/* Steps timeline */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 16, color: '#f0f0f2', fontWeight: 600, marginBottom: 12, display: 'block' }}>实验步骤</label>

            {sortedSteps.map((step, si) => {
              const origIdx = steps.indexOf(step);
              const d = getStepDate(step.day);
              const isLast = si === sortedSteps.length - 1;
              const hasErr = stepErr === origIdx;

              return (
                <div key={origIdx} style={{ display: 'flex', gap: 0, marginBottom: 0,  }}>
                  {/* Left: timeline node */}
                  <div style={{ width: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: 'rgba(125,211,252,0.12)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', border: '1px solid rgba(125,211,252,0.2)',
                    }}
                      onClick={async () => {
                        const val = await showPrompt('修改天数 (D' + step.day + ')', String(step.day));
                        if (val !== null) updateStep(origIdx, 'day', val);
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc', fontVariantNumeric: 'tabular-nums' }}>D{step.day}</span>
                      <span style={{ fontSize: 9, color: '#7dd3fc', opacity: 0.7 }}>{fmtDate(d)}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#d0d4dc', marginTop: 2 }}>{weekDays[d.getDay()]}</span>
                    {!isLast && <div style={{ width: 1.5, flex: 1, minHeight: 16, background: '#2a2a2e', marginTop: 4 }} />}
                  </div>

                  {/* Right: step card */}
                  <div style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, background: '#222225', marginBottom: 8, marginLeft: 8,
                    border: '1px solid ' + (hasErr ? '#fc8181' : 'rgba(255,255,255,0.04)'),
                    transition: 'border 0.25s, background 0.25s', position: 'relative',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(125,211,252,0.15)'; const del = e.currentTarget.querySelector('[data-del]') as HTMLElement; if(del) del.style.opacity='1'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = hasErr ? '#fc8181' : 'rgba(255,255,255,0.04)'; const del = e.currentTarget.querySelector('[data-del]') as HTMLElement; if(del) del.style.opacity='0'; }}
                  >
                    <input value={step.name} onChange={ev => updateStep(origIdx, 'name', ev.target.value)}
                      placeholder="步骤名称" style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#f0f0f2', fontSize: 14, fontWeight: 600, marginBottom: 6, fontFamily: 'inherit' }} />
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0 6px' }} />
                    <textarea value={step.detail} onChange={ev => updateStep(origIdx, 'detail', ev.target.value)}
                      placeholder="操作细节" rows={1} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#8890a0', fontSize: 11, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.5 }}
                      onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                      ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />

                    {/* Delete button */}
                    <div data-del="" style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'all 0.2s', color: '#d0d4dc', fontSize: 16, background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)' }}
                      onClick={() => removeStep(origIdx)}
                      onMouseEnter={e => { e.currentTarget.style.color = '#fc8181'; e.currentTarget.style.background = 'rgba(252,129,129,0.18)'; e.currentTarget.style.borderColor = '#fc8181'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#d0d4dc'; e.currentTarget.style.background = 'rgba(252,129,129,0.08)'; e.currentTarget.style.borderColor = 'rgba(252,129,129,0.2)'; }}
                    >✕</div>
                  </div>
                </div>
              );
            })}

            {/* Add step button */}
            <div style={{ display: 'flex', gap: 0, cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }}
              onClick={addStep}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; }}
            >
              <div style={{ width: 46, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px dashed #3a3a40', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d0d4dc', fontSize: 16, transition: 'all 0.2s' }}>+</div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginLeft: 8, color: '#d0d4dc', fontSize: 14, fontWeight: 600 }}>添加下一步</div>
            </div>
          </div>

          {/* Save as template checkbox - moved above */}
          <div onClick={() => setSaveTpl(!saveTpl)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 0', cursor: 'pointer', marginBottom: 8,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: saveTpl ? '1.5px solid #b794f4' : '1.5px solid rgba(183,148,244,0.3)',
              background: saveTpl ? '#b794f4' : 'transparent',
              transition: 'all 0.2s', fontSize: 10, color: '#fff', flexShrink: 0,
            }}>{saveTpl ? '✓' : ''}</div>
            <span style={{ fontSize: 12, color: saveTpl ? '#b794f4' : '#d0d4dc', transition: 'color 0.2s' }}>同时存为模板</span>
          </div>

          {/* Create button - moved to bottom */}
          <div onClick={doSave} style={{
            width: '100%', padding: '14px 0', textAlign: 'center', borderRadius: 12,
            background: saving ? 'rgba(72,187,120,0.15)' : 'rgba(125,211,252,0.12)',
            border: '1px solid ' + (saving ? 'rgba(72,187,120,0.3)' : 'rgba(125,211,252,0.25)'),
            color: saving ? '#48bb78' : '#7dd3fc',
            fontSize: 20, fontWeight: 700, cursor: 'pointer', transition: 'all 0.25s',
          }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'rgba(125,211,252,0.2)'; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = 'rgba(125,211,252,0.12)'; }}
          >
            {saving ? (saveTpl ? '✓ 已创建 + 已存模板' : '✓ 已创建！返回中...') : '创建实验'}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewReferenceModal({ onClose }: { onClose: () => void }) {
  const { addReference, projects, experiments } = useStore();
  const [file, setFile] = useState<{name: string; path: string} | null>(null);
  const [tags, setTags] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [linkType, setLinkType] = useState('');
  const [linkId, setLinkId] = useState('');
  const [title, setTitle] = useState('');
  const [firstAuthor, setFirstAuthor] = useState('');
  const [corrAuthor, setCorrAuthor] = useState('');
  const [pubYear, setPubYear] = useState('');
  const [journal, setJournal] = useState('');
  const [notes, setNotes] = useState('');

  const pickFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const sel = await open({ multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (sel) {
        const path = Array.isArray(sel) ? sel[0] : sel;
        const name = path.split('/').pop() || path.split('\\').pop() || 'document.pdf';
        setFile({ name, path });
        // Auto parse from filename
        const fn = name.replace('.pdf', '');
        if (!title) setTitle(fn);
        // Try parse "Author 等 - Year - Title" or "Author et al - Year - Title"
        const m1 = fn.match(/^(.+?)\s*(?:等|et\s*al\.?)?\s*[-–_]\s*(19|20)(\d{2})\s*[-–_]\s*(.+)$/i);
        if (m1) {
          if (!firstAuthor) setFirstAuthor(m1[1].trim());
          setPubYear(m1[2] + m1[3]);
          if (!title || title === fn) setTitle(m1[4].trim());
        } else {
          const my = fn.match(/\b(19\d{2}|20\d{2})\b/);
          if (my) setPubYear(my[1]);
        }
        // Try AI parse via Tauri backend

      }
    } catch (e) { console.error(e); }
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    const t = tags ? tags + ',' + tagInput.trim() : tagInput.trim();
    setTags(t);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.split(',').filter(t => t !== tag).join(','));
  };

  const doSave = async () => {
    if (!title) { await showAlert('请输入标题'); return; }
    let pid = linkType === 'project' ? linkId : (projects[0]?.id || '');
    if (!pid) {
      const store = useStore.getState();
      await store.addProject({ name: '默认课题', code: '', direction: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), status: '进行中', tags: '[]', budget: 0 } as any);
      await store.loadAll();
      const np = useStore.getState().projects;
      pid = np[np.length - 1]?.id || '';
    }
    try {
      await addReference({
        title,
        doi: file?.path || '',
        authors: tags,
        year: parseInt(pubYear) || 0,
        journal: linkType && linkId ? linkType + ':' + linkId : journal,
        coreConclusion: [firstAuthor, corrAuthor].filter(Boolean).join('|'),
        relation: new Date().toLocaleString('zh-CN', { timeZone: localStorage.getItem('biolab-clock-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        notes: notes,
        projectId: pid,
      } as any);
      onClose();
    } catch (e: any) {
      await showAlert('保存失败: ' + e);
    }
  };

  const tagList = tags ? tags.split(',').filter(Boolean) : [];

  return (<div className="overlay" onClick={onClose}><div className="modal lg" onClick={e => e.stopPropagation()}>
    <div className="modal-header"><h2>添加文献</h2><X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={onClose} /></div>
    <div className="modal-body">
      {/* PDF Upload */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>PDF 文件</label>
        <div onClick={pickFile} style={{
          border: '1px dashed rgba(125,211,252,0.2)', borderRadius: 8, padding: 20,
          textAlign: 'center', cursor: 'pointer', background: 'rgba(125,211,252,0.02)',
          transition: 'all 0.3s',
        }}>
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <span style={{ color: '#f1f5f9', fontSize: 13 }}>{file.name}</span>
              <span style={{ color: '#48bb78', fontSize: 11 }}>✓ 已识别</span>
            </div>
          ) : (
            <div style={{ color: '#d0d4dc', fontSize: 13 }}>点击选择 PDF 文件</div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="form-group">
        <label>标题</label>
        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="" />
      </div>

      {/* Author + Year row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>第一作者</label>
          <input className="form-input" value={firstAuthor} onChange={e => setFirstAuthor(e.target.value)} placeholder="" style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>通讯作者</label>
          <input className="form-input" value={corrAuthor} onChange={e => setCorrAuthor(e.target.value)} placeholder="" style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 0.6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>出版时间</label>
          <input className="form-input" value={pubYear} onChange={e => setPubYear(e.target.value)} placeholder="" style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>出版期刊</label>
          <input className="form-input" value={journal} onChange={e => setJournal(e.target.value)} placeholder="" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Tags + Link row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>标签</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tagList.length > 0 ? 6 : 0 }}>
            {tagList.map(t => (
              <span key={t} style={{ background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', borderRadius: 12, padding: '2px 8px', fontSize: 10, color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: 3 }}>
                {t}<span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => removeTag(t)}>✕</span>
              </span>
            ))}
          </div>
          <input className="form-input" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>课题</label>
          <DarkSelect value={linkType === 'project' ? linkId : ''} onChange={v => { setLinkType('project'); setLinkId(v); }} options={projects.map(p => ({ value: p.id, label: p.name }))} placeholder="选择课题" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', display: 'block', marginBottom: 6 }}>实验</label>
          <DarkSelect value={linkType === 'experiment' ? linkId : ''} onChange={v => { setLinkType('experiment'); setLinkId(v); }} options={experiments.map(e => ({ value: e.id, label: e.title }))} placeholder="选择实验" />
        </div>
      </div>

      {/* Notes */}
      <div className="form-group">
        <label>备注</label>
        <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="" />
      </div>
    </div>
    <div className="modal-footer">
      <button className="btn" onClick={onClose}>取消</button>
      <button className="btn primary" onClick={doSave}>保存</button>
    </div>
  </div></div>);
}


function ClockWidget() {
  const [now, setNow] = useState(new Date());
  const [style, setStyle] = useState(() => parseInt(localStorage.getItem('biolab-clock-style') || '0'));
  const [tz, setTz] = useState(() => localStorage.getItem('biolab-clock-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showTz, setShowTz] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if ((window as any).__biolab_date_key !== key) {
        (window as any).__biolab_date_key = key;
        window.dispatchEvent(new CustomEvent('biolab-date-change', { detail: key }));
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const hh = tzNow.getHours(), mi = tzNow.getMinutes(), ss = tzNow.getSeconds();
  useEffect(() => {
    const syncFromGlobal = () => {
      const gl = (window as any).__biolab_timer_left;
      const gt = (window as any).__biolab_timer_total;
      const go = (window as any).__biolab_timer_on;
      if (gt > 0) { setTotal(gt); setLeft(gl || 0); setOn(!!go); }
    };
    syncFromGlobal();
    window.addEventListener('biolab-timer-tick', syncFromGlobal);
    return () => window.removeEventListener('biolab-timer-tick', syncFromGlobal);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  const allZones = [
    { id: 'Asia/Shanghai', label: '北京', flag: '🇨🇳' },
    { id: 'Asia/Tokyo', label: '东京', flag: '🇯🇵' },
    { id: 'Asia/Seoul', label: '首尔', flag: '🇰🇷' },
    { id: 'Asia/Singapore', label: '新加坡', flag: '🇸🇬' },
    { id: 'Asia/Dubai', label: '迪拜', flag: '🇦🇪' },
    { id: 'Asia/Kolkata', label: '孟买', flag: '🇮🇳' },
    { id: 'Europe/London', label: '伦敦', flag: '🇬🇧' },
    { id: 'Europe/Paris', label: '巴黎', flag: '🇫🇷' },
    { id: 'Europe/Berlin', label: '柏林', flag: '🇩🇪' },
    { id: 'Europe/Moscow', label: '莫斯科', flag: '🇷🇺' },
    { id: 'America/New_York', label: '纽约', flag: '🇺🇸' },
    { id: 'America/Chicago', label: '芝加哥', flag: '🇺🇸' },
    { id: 'America/Los_Angeles', label: '洛杉矶', flag: '🇺🇸' },
    { id: 'America/Toronto', label: '多伦多', flag: '🇨🇦' },
    { id: 'America/Sao_Paulo', label: '圣保罗', flag: '🇧🇷' },
    { id: 'Pacific/Auckland', label: '奥克兰', flag: '🇳🇿' },
    { id: 'Australia/Sydney', label: '悉尼', flag: '🇦🇺' },
    { id: 'Africa/Cairo', label: '开罗', flag: '🇪🇬' },
    { id: 'Pacific/Honolulu', label: '夏威夷', flag: '🇺🇸' },
  ];

  const filtered = search ? allZones.filter(z => z.label.includes(search) || z.id.toLowerCase().includes(search.toLowerCase())) : allZones;
  const currentZone = allZones.find(z => z.id === tz);
  const tzLabel = currentZone ? currentZone.label : tz.split('/').pop();

  const selectTz = (id: string) => { setTz(id); localStorage.setItem('biolab-clock-tz', id); setShowTz(false); setSearch(''); };
  const switchStyle = () => { const next = (style + 1) % 2; setStyle(next); localStorage.setItem('biolab-clock-style', String(next)); };

  const Digital = () => (<div style={{display:'flex',alignItems:'baseline'}}><span className="ck-num">{pad(hh)}</span><span className="ck-sep">:</span><span className="ck-num">{pad(mi)}</span><span className="ck-sep ck-blink">:</span><span className="ck-num" style={{fontSize:18,color:'#d0d4dc'}}>{pad(ss)}</span></div>);

  const AnalogClock = () => {
    const r = 66, hA = ((hh%12)+mi/60)*30-90, mA = mi*6-90, sA = ss*6-90;
    const ln = (a: number, len: number, w: number, col: string) => { const rd = a*Math.PI/180; return <line x1={r} y1={r} x2={r+Math.cos(rd)*len} y2={r+Math.sin(rd)*len} stroke={col} strokeWidth={w} strokeLinecap="round" />; };
    return (<svg width={r*2} height={r*2}>
      <circle cx={r} cy={r} r={r-2} fill="none" stroke="rgba(125,211,252,0.15)" strokeWidth="1.5" />
      {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => { const a=(i*30-90)*Math.PI/180; const tx=r+Math.cos(a)*(r-14); const ty=r+Math.sin(a)*(r-14); return <text key={i} x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fill={i%3===0?'#7dd3fc':'rgba(125,211,252,0.4)'} fontSize={i%3===0?'12':'9'} fontWeight={i%3===0?'600':'400'} fontFamily="'DIN Alternate',system-ui">{i}</text>; })}
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => { const a=i*30*Math.PI/180; return <line key={'t'+i} x1={r+Math.sin(a)*(r-4)} y1={r-Math.cos(a)*(r-4)} x2={r+Math.sin(a)*(r-2)} y2={r-Math.cos(a)*(r-2)} stroke="rgba(125,211,252,0.15)" strokeWidth={i%3===0?1.5:0.5} />; })}
      {ln(hA,r*0.45,3,'#7dd3fc')}{ln(mA,r*0.6,2,'#a0aec0')}{ln(sA,r*0.72,0.8,'#fc8181')}
      <circle cx={r} cy={r} r="3" fill="#7dd3fc" />
    </svg>);
  };

  

  const renders = [Digital, AnalogClock];
  const View = renders[style];

  return (
    <div className="ck-box">
      <div style={{fontSize:10,color:'#d0d4dc',cursor:'pointer',marginBottom:4,transition:'color 0.2s'}} onClick={()=>{setShowTz(!showTz);setSearch('');}} onMouseEnter={e=>e.currentTarget.style.color='#7dd3fc'} onMouseLeave={e=>e.currentTarget.style.color='#718096'}>{tzLabel}</div>
      <div style={{cursor:'pointer',display:'flex',justifyContent:'center',padding:'4px 0'}} onClick={switchStyle}><View /></div>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:6}}>
        <div onClick={switchStyle} title="切换样式" style={{width:22,height:22,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#a0a0a8',transition:'all 0.2s'}} onMouseEnter={e=>{e.currentTarget.style.color='#7dd3fc';e.currentTarget.style.background='rgba(125,211,252,0.1)';}} onMouseLeave={e=>{e.currentTarget.style.color='#a0a0a8';e.currentTarget.style.background='transparent';}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
        </div>
      </div>
      {showTz && (<><div style={{position:'fixed',inset:0,zIndex:49}} onClick={()=>{setShowTz(false);setSearch('');}} /><div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:4,background:'rgba(20,24,34,0.98)',border:'1px solid rgba(125,211,252,0.15)',borderRadius:8,padding:8,zIndex:50,boxShadow:'0 12px 32px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
        <input style={{width:'100%',padding:'6px 8px',border:'1px solid rgba(125,211,252,0.1)',borderRadius:6,background:'rgba(255,255,255,0.03)',color:'#f1f5f9',fontSize:12,outline:'none',marginBottom:6,fontFamily:'inherit',boxSizing:'border-box'}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索城市..." autoFocus />
        <div style={{maxHeight:200,overflowY:'auto'}}>{filtered.map(z => (<div key={z.id} onClick={()=>selectTz(z.id)} style={{display:'flex',justifyContent:'space-between',padding:'6px 8px',borderRadius:4,cursor:'pointer',fontSize:12,color:z.id===tz?'#7dd3fc':'#a0aec0',background:z.id===tz?'rgba(125,211,252,0.08)':'transparent',transition:'all 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(125,211,252,0.06)')} onMouseLeave={e=>(e.currentTarget.style.background=z.id===tz?'rgba(125,211,252,0.08)':'transparent')}><span>{z.label}</span><span style={{fontSize:10,color:'#d0d4dc'}}>{z.id.split('/').pop()}</span></div>))}</div>
      </div></>)}
    </div>
  );
}


// ═══ Calendar Widget ═══
function CalendarWidget({ experiments, onNewExp }: { experiments: any[]; onNewExp: () => void }) {
  const [yr, setYr] = useState(new Date().getFullYear());
  const [mo, setMo] = useState(new Date().getMonth());
  const [sel, setSel] = useState<number | null>(null);
  const cwRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sel === null) return;
    const h = (e: MouseEvent) => { if (cwRef.current && !cwRef.current.contains(e.target as Node)) setSel(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [sel]);

  const now = new Date();
  const days = new Date(yr, mo + 1, 0).getDate();
  const start = new Date(yr, mo, 1).getDay();

  // Map: day number -> experiment info
  const dayMap: Record<number, string[]> = {};
  experiments.forEach((ex: any) => {
    // Show experiment on its start date
    const d = new Date(ex.date);
    if (d.getFullYear() === yr && d.getMonth() === mo) {
      const dd = d.getDate();
      if (!dayMap[dd]) dayMap[dd] = [];
      if (!dayMap[dd].includes(ex.title)) dayMap[dd].push(ex.title);
    }

  });

  const isToday = (d: number) => now.getFullYear() === yr && now.getMonth() === mo && now.getDate() === d;
  const goPrev = () => { setSel(null); mo === 0 ? (setYr(yr-1), setMo(11)) : setMo(mo-1); };
  const goNext = () => { setSel(null); mo === 11 ? (setYr(yr+1), setMo(0)) : setMo(mo+1); };

  const selItems = sel ? (dayMap[sel] || []) : [];

  return (
    <div className="cw" ref={cwRef}>
      <div className="cw-head">
        <span className="cw-nav" onClick={goPrev}>‹</span>
        <span className="cw-title">{yr}年{mo+1}月</span>
        <span className="cw-nav" onClick={goNext}>›</span>
      </div>
      <div className="cw-week">
        {['日','一','二','三','四','五','六'].map(w => <div key={w} className="cw-wd">{w}</div>)}
      </div>
      <div className="cw-body">
        {Array.from({length: start}, (_, i) => <div key={'b'+i} className="cw-day empty" />)}
        {Array.from({length: days}, (_, i) => {
          const d = i + 1;
          const has = !!dayMap[d];
          const active = sel === d;
          return (
            <div key={d}
              className={'cw-day' + (isToday(d) ? ' today' : '') + (has ? ' has' : '') + (active ? ' active' : '')}
              onClick={() => setSel(active ? null : d)}
            >
              {d}
              {has && <span className="cw-dot" />}
            </div>
          );
        })}
      </div>
      {sel && selItems.length > 0 && (
        <div className="cw-popup">
          <div className="cw-popup-title">{mo+1}月{sel}日</div>
          {selItems.map((item, i) => <div key={i} className="cw-popup-item" title={item} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default', padding: '4px 8px', borderRadius: 6, transition: 'background 0.15s' }}
              onMouseEnter={(ev: any) => { ev.currentTarget.style.whiteSpace = 'normal'; ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'; }}
              onMouseLeave={(ev: any) => { ev.currentTarget.style.whiteSpace = 'nowrap'; ev.currentTarget.style.background = 'transparent'; }}
            >{item}</div>)}
          {(() => { const selDate = new Date(yr, mo, sel); const todayMid = new Date(); todayMid.setHours(0,0,0,0); return selDate >= todayMid; })() && <div className="cw-popup-add" onClick={(e) => { e.stopPropagation(); const dateStr = yr + '-' + String(mo+1).padStart(2,'0') + '-' + String(sel).padStart(2,'0'); localStorage.setItem('biolab-new-exp-date', dateStr); setSel(null); onNewExp(); }}>+ 新建实验</div>}
        </div>
      )}
      {sel && selItems.length === 0 && (
        <div className="cw-popup">
          <div className="cw-popup-title">{mo+1}月{sel}日</div>
          <div className="cw-popup-empty">当天无实验</div>
          {(() => { const selDate = new Date(yr, mo, sel); const todayMid = new Date(); todayMid.setHours(0,0,0,0); return selDate >= todayMid; })() && <div className="cw-popup-add" onClick={(e) => { e.stopPropagation(); const dateStr = yr + '-' + String(mo+1).padStart(2,'0') + '-' + String(sel).padStart(2,'0'); localStorage.setItem('biolab-new-exp-date', dateStr); setSel(null); onNewExp(); }}>+ 新建实验</div>}
        </div>
      )}
    </div>
  );
}


// ═══ Timer ═══
function TimerWidget() {
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
  const [on, setOn] = useState(false);
  const iv = useRef<any>(null);
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  const [s, setS] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [timerDone, setTimerDone] = useState(false);
  const [editBuf, setEditBuf] = useState('');

  useEffect(() => {
    if (on && left > 0) {
      iv.current = setInterval(() => setLeft(l => {
        if (l <= 1) {
          setOn(false);
          setTimerDone(true);
          window.dispatchEvent(new CustomEvent('biolab-timer-done'));
          try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZKOgnBjWVpjcH+MlZaShXhsYl1ib3yIkJGMgHRnXltfanmFjo+LfnJmXVtdZ3WBio2JfHBkXFpbY3F+iY2Jf3RoYF5gZ3R+homHfHFmX11eZHF8homHfHJoYl9hZnJ8hYeEe3FnYV9fY298hIaEenBmYV9fY298hIaDenBnYl9gZHB8hIaDe3FoY2FiZXJ8g4SDe3FpZGJjZnN9g4ODe3JqZWRlZ3R+g4KCenJqZmVmaHV+goKBenNsZ2doant/gYGAeXNtaGhpbHyAgH9+eXRuammpa3x/f358eXVvammqa3x+fn17eHVva2prbHx+fn17eHZwbGtsbX1+fXt5d3JubW5vcX5+fXt5eHNvb3Bxcn5+fXt6eXRxcXJzdH9+fHt7enV0dHV2eH9+fHx8fHd3eHl6e39+fX1+f3t8fX5/gH9/f4CBgoOEhYaGh4iJioqLjI2Oj5CQkZKTk5SVlpaXmJmZmpucnJ2en5+goaGio6SkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29ze3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j4+fr7/P3+').play().catch(() => {}); } catch {}
          try { isPermissionGranted().then(granted => { if (granted) { sendNotification({ title: 'BioLab', body: '计时结束！' }); } else { requestPermission().then(p => { if (p === 'granted') sendNotification({ title: 'BioLab', body: '计时结束！' }); }); } }); } catch {}
          return 0;
        }
        return l - 1;
      }), 1000);
    } else clearInterval(iv.current);
    return () => clearInterval(iv.current);
  }, [on]);

  useEffect(() => {
    const syncFromGlobal = () => {
      const gl = (window as any).__biolab_timer_left;
      const gt = (window as any).__biolab_timer_total;
      const go = (window as any).__biolab_timer_on;
      if (gt > 0) { setTotal(gt); setLeft(gl || 0); setOn(!!go); }
    };
    syncFromGlobal();
    window.addEventListener('biolab-timer-tick', syncFromGlobal);
    return () => window.removeEventListener('biolab-timer-tick', syncFromGlobal);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = Math.floor(left / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;

  const go = () => {
    const t = h * 3600 + m * 60 + s;
    if (t > 0) {
      setTotal(t); setLeft(t); setOn(true);
      window.dispatchEvent(new CustomEvent('biolab-timer-start', { detail: { total: t } }));
    }
  };
  const [, forceUpdate] = useState(0);
  useEffect(() => { const id = setInterval(() => forceUpdate(n => n + 1), 500); return () => clearInterval(id); }, []);

  const startEdit = (idx: number) => {
    setEditing(idx);
    setEditBuf('');
  };

  const commitEdit = (idx: number) => {
    const val = parseInt(editBuf) || 0;
    const mx = idx === 0 ? 23 : 59;
    const clamped = Math.min(mx, Math.max(0, val));
    if (idx === 0) setH(clamped);
    else if (idx === 1) setM(clamped);
    else setS(clamped);
    setEditing(null);
    setEditBuf('');
  };

  const handleKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') { commitEdit(idx); if (idx < 2) startEdit(idx + 1); else go(); }
    else if (e.key === 'Escape') { setEditing(null); setEditBuf(''); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(idx); if (idx < 2) startEdit(idx + 1); }
  };

  if (total > 0 && left === 0 && !on && !timerDone) { setTotal(0); }

  if (timerDone) return (
    <>
    <div className="tw">
      <div className="tw-row">
        <span className="tw-d">{pad(Math.floor((h*3600+m*60+s)/3600))}</span><span className="tw-co">:</span>
        <span className="tw-d">{pad(Math.floor(((h*3600+m*60+s)%3600)/60))}</span><span className="tw-co">:</span>
        <span className="tw-d">{pad((h*3600+m*60+s)%60)}</span>
      </div>
      <div className="tw-acts">
        <span className="tw-ab" onClick={() => { setTimerDone(false); setTotal(0); setLeft(0); }}>确认</span>
      </div>
    </div>
    {createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTimerDone(false)}>
        <div className="timer-holo" onClick={e => e.stopPropagation()}>
          <div className="timer-holo-grid" />
          <div className="timer-holo-hex" style={{ top: 10, right: 20 }} />
          <div className="timer-holo-hex" style={{ bottom: 15, left: 15, width: 30, height: 30 }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div className="timer-holo-time">00:00:00</div>
            <div className="timer-holo-bar"><div className="timer-holo-bar-fill" /></div>
            <div className="timer-holo-btn" onClick={() => { setTimerDone(false); setTotal(0); setLeft(0); }}>确认</div>
          </div>
        </div>
      </div>,
    document.body)}
    </>
  );

  const timerTarget = document.getElementById('timer-sidebar-target');

  if (total > 0) {
    const content = (
    <div className="tw">
      <div className="tw-row">
        <span className="tw-d">{pad(hh)}</span><span className="tw-co">:</span>
        <span className="tw-d">{pad(mm)}</span><span className="tw-co">:</span>
        <span className="tw-d">{pad(ss)}</span>
      </div>
      <div className="tw-bar"><div className="tw-fill" style={{ width: ((total - left) / total * 100) + '%' }} /></div>
      <div className="tw-acts">
        <span className="tw-ab" onClick={() => { setOn(!on); window.dispatchEvent(new CustomEvent(on ? 'biolab-timer-pause' : 'biolab-timer-resume')); }}>{on ? '暂停' : '继续'}</span>
        <span className="tw-ab tw-ar" onClick={() => { setOn(false); setTotal(0); setLeft(0); window.dispatchEvent(new CustomEvent('biolab-timer-reset')); }}>重置</span>
      </div>
    </div>
    );
    return timerTarget ? createPortal(content, timerTarget) : null;
  }

  const vals = [h, m, s];
  const labels = ['时', '分', '秒'];

  const defaultContent = (
    <div className="tw">
      <div className="tw-row">
        {[0, 1, 2].map(i => (
          <React.Fragment key={i}>
            {i > 0 && <span className="tw-co">:</span>}
            <div className="tw-cell">
              {editing === i ? (
                <input
                  className="tw-input"
                  value={editBuf}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 2) setEditBuf(v); }}
                  onBlur={() => commitEdit(i)}
                  onKeyDown={e => handleKey(e, i)}
                  autoFocus
                />
              ) : (
                <div className="tw-digit" onClick={() => startEdit(i)}>{pad(vals[i])}</div>
              )}
              <span className="tw-lbl">{labels[i]}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="tw-start" onClick={go}>开始</div>
    </div>
  );
  return timerTarget ? createPortal(defaultContent, timerTarget) : null;
}


function HomePage({ onAction }: { onAction: (t: string) => void }) {
  const { projects, experiments, navigateTo, deleteExperiment } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<Record<string, number>>({});
  const [ctxMenu, setCtxMenu] = useState<{x: number; y: number; exp: any} | null>(null);
  const [stepEdit, setStepEdit] = useState<{exp: any; mi: number; day: string; label: string} | null>(null);
  const saveStepEdit = async () => {
    if (!stepEdit) return;
    const exp = stepEdit.exp;
    let tl: any = { duration_days: 1, milestones: [] };
    try { if (exp.parameters) tl = JSON.parse(exp.parameters); } catch {}
    const sortedMs2 = (tl.milestones || []).sort((a: any, b: any) => a.day - b.day);
    const newDay = parseInt(stepEdit.day); if (isNaN(newDay)) { setStepEdit(null); return; }
    const newMs = sortedMs2.map((m: any, i: number) => i === stepEdit.mi ? { ...m, day: newDay, label: stepEdit.label } : m);
    const params = JSON.stringify({ ...tl, milestones: newMs });
    const { invoke: inv } = await import('@tauri-apps/api/core');
    await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: params, results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
    await useStore.getState().loadAll();
    setStepEdit(null);
  };
  React.useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const t = setTimeout(() => { window.addEventListener('click', close); window.addEventListener('scroll', close, true); }, 0);
    return () => { clearTimeout(t); window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [ctxMenu]);

  // Color palette for experiments (cycling)
  const colorOf = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; };
  const palette = [
    { main: '#4a9cc4', light: 'rgba(74,156,196,0.1)', mid: '#6ab0d1', dark: '#2b6cb0', darker: '#1a4a70' },
    { main: '#389158', light: 'rgba(56,145,88,0.1)', mid: '#4fa872', dark: '#276749', darker: '#1a4731' },
    { main: '#b86a28', light: 'rgba(184,106,40,0.1)', mid: '#c98340', dark: '#c05621', darker: '#7b341e' },
    { main: '#a33170', light: 'rgba(163,49,112,0.1)', mid: '#b8497f', dark: '#97266d', darker: '#702459' },
    { main: '#8b72c4', light: 'rgba(139,114,196,0.1)', mid: '#a28ad1', dark: '#6b46c1', darker: '#44337a' },
    { main: '#c4ad3d', light: 'rgba(196,173,61,0.1)', mid: '#d1bd55', dark: '#975a16', darker: '#5f370e' },
    { main: '#c46060', light: 'rgba(196,96,96,0.1)', mid: '#d17878', dark: '#9b2c2c', darker: '#63171b' },
    { main: '#3ba399', light: 'rgba(59,163,153,0.1)', mid: '#56b3aa', dark: '#285e61', darker: '#1d4044' },
    { main: '#7b8796', light: 'rgba(123,135,150,0.1)', mid: '#939dab', dark: '#4a5568', darker: '#2d3748' },
    { main: '#c46d92', light: 'rgba(196,109,146,0.1)', mid: '#d185a5', dark: '#b83280', darker: '#702459' },
  ];

  const todayStr = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
  const todayD = new Date(todayStr + 'T00:00:00');

  // Get active experiments (within duration)
  const expIndexMap = new Map(experiments.map((ex: any, i: number) => [ex.id, i]));
  const activeExps = experiments.filter((ex: any) => {
    const startD = new Date(ex.date + 'T00:00:00');
    if (startD > todayD) return false;
    let tl: any = { duration_days: 0, milestones: [] };
    try { if (ex.parameters) tl = JSON.parse(ex.parameters); } catch {}
    const msMax = (tl.milestones && tl.milestones.length) ? Math.max(...tl.milestones.map((m: any) => m.day || 0)) : 0;
    const lastDay = Math.max(tl.duration_days || 0, msMax);
    const daysPassed = Math.floor((todayD.getTime() - startD.getTime()) / 86400000);
    return daysPassed <= lastDay;
  });

  // Format date helpers
  const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
  const fmtDate = (d: Date) => (d.getMonth()+1) + '/' + d.getDate();
  const fmtWeek = (d: Date) => weekDays[d.getDay()];
  const todayFull = (() => { const d = new Date(); return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 ' + weekDays[d.getDay()]; })();

  return (
    <div className="page-container" style={{ display: 'flex', gap: 24 }}>
      <style>{`
        .tl-col { padding-left: 80px; position: relative; }
        .tl-axis { position: absolute; left: 40px; top: 56px; bottom: 20px; width: 2px; background: #23232a; z-index: 0; border-radius: 1px; overflow: hidden; } .tl-axis::before { content: ''; position: absolute; left: 0; right: 0; top: -30%; height: 30%; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.8) 50%, transparent); animation: biolabAxisFlow 4s linear infinite; } @keyframes biolabAxisFlow { 0% { top: -30%; } 100% { top: 100%; } }
        .tl-marker { position: relative; z-index: 1; height: 60px; margin-bottom: 8px; cursor: pointer; }
        .tl-marker-planned { margin-top: 28px; }
        .tl-badge { position: absolute; left: -62px; top: 8px; width: 44px; height: 44px; border-radius: 50%; background: #0f0f12; display: flex; align-items: center; justify-content: center; z-index: 2; transition: all 0.2s; }
        .tl-marker:hover .tl-badge { transform: scale(1.06); }
        .tl-badge-today { border: 1.2px solid #4a90d9; }
        .tl-marker:hover .tl-badge-today { border-color: #7dd3fc; box-shadow: 0 0 14px rgba(125,211,252,0.3); }
        .tl-badge-planned { border: 1.2px solid #1a4731; }
        .tl-marker:hover .tl-badge-planned { border-color: #34d399; box-shadow: 0 0 14px rgba(52,211,153,0.3); }
        .tl-label { position: absolute; left: 0; top: 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
        .tl-label-today { color: #7dd3fc; }
        .tl-label-planned { color: #34d399; }
        .tl-sub { position: absolute; left: 0; top: 34px; font-size: 10px; color: #6a6a72; }
        .tl-card { position: relative; z-index: 1; }
        .tl-card::before { content: ''; position: absolute; left: -46px; top: 20px; width: 12px; height: 12px; border-radius: 50%; background: #0f0f12; border: 2px solid var(--tl-c, #7dd3fc); box-sizing: border-box; }
        .tl-card::after { content: ''; position: absolute; left: -34px; top: 25px; width: 34px; height: 2px; background: var(--tl-c, #7dd3fc); }
        .tl-card-dashed::before { border-style: dashed; }
        .tl-card-dashed::after { background: transparent; height: 0; border-top: 2px dashed var(--tl-c, #34d399); width: 34px; }
        .tl-c-0 { --tl-c: #4a9cc4; }
        .tl-c-1 { --tl-c: #389158; }
        .tl-c-2 { --tl-c: #b86a28; }
        .tl-c-3 { --tl-c: #a33170; }
        .tl-c-4 { --tl-c: #8b72c4; }
        .tl-c-5 { --tl-c: #c4ad3d; }
        .tl-c-6 { --tl-c: #c46060; }
        .tl-c-7 { --tl-c: #3ba399; }
        .tl-c-8 { --tl-c: #7b8796; }
        .tl-c-9 { --tl-c: #c46d92; }
        .tl-c-future { --tl-c: #34d399; }
        .home-exp-del, .home-step-del { display: none !important; }
      `}</style>
      <div className="tl-col" style={{ flex: 1, minWidth: 0 }}>
        <div className="tl-axis" />
        <div className="tl-marker">
          <div className="tl-badge tl-badge-today" style={{ cursor: 'pointer' }} onClick={() => { localStorage.setItem('biolab-exp-mode', 'today'); localStorage.removeItem('biolab-new-exp-date'); onAction('experiment'); }}>
            <svg width="20" height="24" viewBox="0 0 20 26" fill="none">
              <path d="M7 0 L7 8 L0 20 L0 22 Q0 24 2 24 L16 24 Q18 24 18 22 L18 20 L11 8 L11 0 Z" fill="#1a3a5c" stroke="#6bb6e8" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M1.5 18 Q5 15 9 18 Q13 21 16.5 18 L18 20 L18 22 Q18 24 16 24 L2 24 Q0 24 0 22 L0 20 Z" fill="#2563a8" opacity="0.7"/>
              <line x1="6" y1="0" x2="12" y2="0" stroke="#6bb6e8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="tl-label tl-label-today">进行中</div>
          <div className="tl-sub">{(todayD.getMonth()+1) + '月' + todayD.getDate() + '日'}</div>
        </div>
      {/* Header */}
      <div style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#d0d4dc', fontVariantNumeric: 'tabular-nums' }}>{todayFull}</span>
        </div>


      </div>

      {/* Experiment cards */}

      <div style={{ display: 'none', fontSize: 13, fontWeight: 700, color: '#7dd3fc', marginBottom: 8 }}>今日实验</div>
      {/* Flask icon */}
      <div style={{ display: 'none', textAlign: 'left', padding: '8px 0', minHeight: 120 }}>
        <div style={{ display: 'inline-block', textAlign: 'center', padding: '8px 16px', borderRadius: 12, border: '1px solid transparent', transition: 'all 0.3s', cursor: 'pointer' }}
          onMouseEnter={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.15)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'; ev.currentTarget.querySelector('.flask-icon-wrap')?.classList.add('flask-shake'); ev.currentTarget.querySelectorAll('.flask-sub').forEach((sub: any) => { sub.style.maxHeight = '24px'; sub.style.opacity = '1'; }) }}
          onMouseLeave={(ev: any) => { ev.currentTarget.style.borderColor = 'transparent'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.querySelector('.flask-icon-wrap')?.classList.remove('flask-shake'); ev.currentTarget.querySelectorAll('.flask-sub').forEach((sub: any) => { sub.style.maxHeight = '0'; sub.style.opacity = '0'; }) }}
          onClick={() => onAction('experiment')}
        >
          <div className="flask-icon-wrap" style={{ marginBottom: 4, display: 'inline-block' }}>
            <svg width="32" height="38" viewBox="0 0 50 90" fill="none">
              <path d="M20 0 L20 35 L2 75 L2 82 Q2 88 8 88 L42 88 Q48 88 48 82 L48 75 L30 35 L30 0 Z" fill="#1a3a5c" stroke="#4a90d9" strokeWidth="1.5" strokeLinejoin="round"/>
              <path className="flask-liquid" d="M5 68 Q15 62 25 70 Q35 78 45 68 L48 75 L48 82 Q48 88 42 88 L8 88 Q2 88 2 82 L2 75 Z" fill="#2563a8" opacity="0.6"/>
              <line x1="17" y1="0" x2="33" y2="0" stroke="#4a90d9" strokeWidth="2" strokeLinecap="round"/>
              <circle className="flask-bubble1" cx="18" cy="74" r="2" fill="#7dd3fc" opacity="0.5"/>
              <circle className="flask-bubble2" cx="30" cy="78" r="1.5" fill="#7dd3fc" opacity="0.4"/>
              <circle className="flask-bubble3" cx="24" cy="82" r="1" fill="#7dd3fc" opacity="0.3"/>
            </svg>
          </div>
          <div className="flask-sub" style={{ color: '#7dd3fc', fontSize: 13, fontWeight: 600, maxHeight: 0, overflow: 'hidden', opacity: 0, transition: 'all 0.25s', marginTop: 2 }}>新建实验</div>

        </div>
      </div>

      {activeExps.map((e: any, ei: number) => {
        const color = palette[(expIndexMap.get(e.id) ?? ei) % palette.length];
        const proj = projects.find((p: any) => p.id === e.projectId);
        let tl: any = { duration_days: 1, milestones: [] };
        try { if (e.parameters) tl = JSON.parse(e.parameters); } catch {}
        if (!tl.duration_days) tl.duration_days = 1;
        const startD = new Date(e.date + 'T00:00:00');
        const daysP = Math.max(0, Math.floor((todayD.getTime() - startD.getTime()) / 86400000));
        const sortedMs = (tl.milestones || []).sort((a: any, b: any) => a.day - b.day);
        const todayMs = sortedMs.find((m: any) => m.day === daysP);
        const nextMs = sortedMs.find((m: any) => m.day > daysP);
        const isExpanded = expanded === e.id;
        const selIdx = selectedStep[e.id] ?? sortedMs.findIndex((m: any) => m.day === daysP);
        const selMs = sortedMs[selIdx >= 0 ? selIdx : 0];
        const remainDays = tl.duration_days - daysP;

        return (
          <div key={e.id} className={`tl-card tl-c-${(expIndexMap.get(e.id) ?? ei) % 10}`} style={{
            background: '#18181b', borderRadius: 14, marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.04)',
            transition: 'all 0.3s, transform 0.25s, box-shadow 0.25s',
          }}
            onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e }); }}
            onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; ev.currentTarget.style.borderColor = color.main + '25'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '1'; }}
            onMouseLeave={ev => { ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '0'; }}
          >
            {/* Collapsed card */}
            <div style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : e.id)}>
              {/* Row 1: name + remaining days */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color.main }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f2' }}>{e.title}</span>
                  {proj && <span style={{ fontSize: 11, color: '#d0d4dc' }}>{proj.name}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#d0d4dc', fontVariantNumeric: 'tabular-nums' }}>{remainDays > 0 ? '剩余' + remainDays + '天' : '最后一天'}</span>
                  <div className="home-exp-del" onClick={async (ev) => { ev.stopPropagation(); if (await showConfirm('删除实验「' + e.title + '」？')) { await deleteExperiment(e.id); await useStore.getState().loadAll(); } }} style={{
                    width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', opacity: 0, transition: 'all 0.2s', color: '#d0d4dc', flexShrink: 0,
                  }}
                    onMouseEnter={ev => { ev.currentTarget.style.color = '#fc8181'; ev.currentTarget.style.background = 'rgba(252,129,129,0.1)'; }}
                    onMouseLeave={ev => { ev.currentTarget.style.color = '#4a5568'; ev.currentTarget.style.background = 'transparent'; }}
                  ><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></div>
                  <span style={{ color: '#d0d4dc', fontSize: 12, transform: isExpanded ? 'rotate(180deg)' : '', transition: 'transform 0.3s' }}>▼</span>
                </div>
              </div>

              {/* Today task one-liner (hidden when expanded) */}
              {!isExpanded && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {todayMs ? (
                  <>
                    <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: color.main, color: '#fff', fontWeight: 600 }}>今天</span>
                    <span style={{ fontSize: 13, color: color.main, fontWeight: 600 }}>{todayMs.label}</span>
                  </>
                ) : nextMs ? (
                  <>
                    <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#d0d4dc' }}>下一步</span>
                    <span style={{ fontSize: 13, color: '#d0d4dc' }}>第{nextMs.day}天 · {nextMs.label}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#d0d4dc' }}>第{daysP}天/{tl.duration_days}天</span>
                )}
              </div>}
            </div>

            {/* Expanded section - editable */}
            {isExpanded && sortedMs.length > 0 && (
              <div style={{ padding: '0 20px 16px', animation: 'fadeIn 0.3s ease' }} onClick={ev => ev.stopPropagation()}>
                {sortedMs.map((ms: any, mi: number) => {
                  const msDate = new Date(startD); msDate.setDate(msDate.getDate() + ms.day);
                  const isDone = daysP > ms.day;
                  const isT = daysP === ms.day;
                  return (
                    <div key={mi} className="home-step-row" style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
                      borderRadius: 8, marginBottom: 2, position: 'relative',
                      background: isT ? color.light : 'transparent',
                      transition: 'all 0.2s', cursor: 'pointer',
                    }}
                      onMouseEnter={(ev: any) => { if (!isT) ev.currentTarget.style.background = 'rgba(125,211,252,0.08)'; const del = ev.currentTarget.querySelector('.home-step-del'); if (del) del.style.opacity = '1'; }}
                      onMouseLeave={(ev: any) => { if (!isT) ev.currentTarget.style.background = 'transparent'; const del = ev.currentTarget.querySelector('.home-step-del'); if (del) del.style.opacity = '0'; }}
                      onClick={() => setStepEdit({ exp: e, mi, day: String(ms.day), label: ms.label })}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isT ? color.main : '#3a3a40',
                        boxShadow: isT ? '0 0 6px ' + color.main : 'none',
                      }} />
                      <span style={{ fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', flexShrink: 0, boxSizing: 'border-box' }}>D{ms.day}</span>
                      <span style={{ fontSize: 13, color: isT ? color.main : isDone ? '#a0a0a8' : '#f0f0f2', fontWeight: isT ? 600 : 500, flex: 1, marginLeft: 4, textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>{ms.label}</span>
                      <span style={{ fontSize: 11, color: isT ? color.main : '#6a6a72', fontVariantNumeric: 'tabular-nums', marginRight: 70, minWidth: 90, textAlign: 'right' }}>{(msDate.getMonth()+1) + '月' + msDate.getDate() + '日 · ' + fmtWeek(msDate)}</span>
                      {isT && <span style={{
                        position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 10, padding: '2px 8px', borderRadius: 8,
                        background: color.main, color: '#fff', fontWeight: 600,
                      }}>今天</span>}
                      <span className="home-step-del" style={{ fontSize: 12, color: '#d0d4dc', cursor: 'pointer', opacity: 0, transition: 'all 0.2s', padding: '0 4px' }}
                        onClick={async () => {
                          const newMs = sortedMs.filter((_: any, i: number) => i !== mi);
                          const params = JSON.stringify({ ...tl, milestones: newMs });
                          const { invoke: inv } = await import('@tauri-apps/api/core');
                          await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: params, results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', nextSteps: e.nextSteps||'', status: e.status||'进行中' });
                          useStore.getState().loadAll();
                        }}
                      >✕</span>
                    </div>
                  );
                })}

                {/* Add step */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                  onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                  onMouseLeave={ev => ev.currentTarget.style.opacity = '0.4'}
                  onClick={() => {
                    const nextDay = String((sortedMs.length > 0 ? sortedMs[sortedMs.length-1].day : -1) + 1);
                    setStepEdit({ exp: e, mi: -1, day: nextDay, label: '' });
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px dashed #3a3a40' }} />
                  <span style={{ fontSize: 12, color: '#d0d4dc' }}>添加步骤</span>
                </div>
              </div>
            )}
          </div>
        );
      })}



      {/* Upcoming experiments */}
      {(() => {
        const futureExps = experiments
          .filter((ex: any) => new Date(ex.date + 'T00:00:00') > todayD)
          .sort((a: any, b: any) => a.date.localeCompare(b.date));

        // always show this section

        return (
          <div style={{ marginTop: 24 }}>
            <div className="tl-marker tl-marker-planned">
              <div className="tl-badge tl-badge-planned" style={{ cursor: 'pointer' }} onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); localStorage.setItem('biolab-new-exp-date', d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')); localStorage.setItem('biolab-exp-mode', 'future'); onAction('experiment'); }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 20 Q11 13 6 9 Q2 7 3 3 Q7 4 9 8 Q11 3 15 1 Q16 5 14 9 Q18 7 20 9 Q18 13 14 13 Q12 16 11 20 Z" fill="#1a4731" stroke="#68d391" strokeWidth="1.2" strokeLinejoin="round"/>
                  <line x1="11" y1="13" x2="11" y2="20" stroke="#68d391" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="tl-label tl-label-planned">未来计划</div>
              <div className="tl-sub">4月12日 起</div>
            </div>

            {futureExps.length === 0 ? (
              <div style={{ display: 'none', textAlign: 'center', padding: '8px 16px', borderRadius: 12, border: '1px solid transparent', transition: 'all 0.3s', cursor: 'pointer' }}
                onMouseEnter={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(52,211,153,0.15)'; ev.currentTarget.style.background = 'rgba(52,211,153,0.04)'; ev.currentTarget.querySelectorAll('.seed-sub').forEach((sub: any) => { sub.style.maxHeight = '24px'; sub.style.opacity = '1'; }); }}
                onMouseLeave={(ev: any) => { ev.currentTarget.style.borderColor = 'transparent'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.querySelectorAll('.seed-sub').forEach((sub: any) => { sub.style.maxHeight = '0'; sub.style.opacity = '0'; }); }}
                onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); localStorage.setItem('biolab-new-exp-date', d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')); onAction('experiment'); }}
              >
                <div className="seedling-sway" style={{ fontSize: 28, marginBottom: 4, display: 'inline-block', transition: 'transform 0.3s' }}>🌱</div>
                <div className="seed-sub" style={{ color: '#34d399', fontSize: 13, fontWeight: 600, maxHeight: 0, overflow: 'hidden', opacity: 0, transition: 'all 0.25s', marginTop: 2 }}>新建计划</div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'none', textAlign: 'center', padding: '8px 16px', borderRadius: 12, border: '1px solid transparent', transition: 'all 0.3s', cursor: 'pointer', marginBottom: 8 }}
                  onMouseEnter={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(52,211,153,0.15)'; ev.currentTarget.style.background = 'rgba(52,211,153,0.04)'; ev.currentTarget.querySelectorAll('.seed-sub').forEach((sub: any) => { sub.style.maxHeight = '24px'; sub.style.opacity = '1'; }); }}
                  onMouseLeave={(ev: any) => { ev.currentTarget.style.borderColor = 'transparent'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.querySelectorAll('.seed-sub').forEach((sub: any) => { sub.style.maxHeight = '0'; sub.style.opacity = '0'; }); }}
                  onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); localStorage.setItem('biolab-new-exp-date', d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')); onAction('experiment'); }}
                >
                  <div className="seedling-sway" style={{ fontSize: 28, marginBottom: 4, display: 'inline-block', transition: 'transform 0.3s' }}>🌱</div>
                  <div className="seed-sub" style={{ color: '#34d399', fontSize: 13, fontWeight: 600, maxHeight: 0, overflow: 'hidden', opacity: 0, transition: 'all 0.25s', marginTop: 2 }}>新建计划</div>
                </div>
                {futureExps.map((e: any, ei: number) => {
        const color = palette[(expIndexMap.get(e.id) ?? ei) % palette.length];
        const proj = projects.find((p: any) => p.id === e.projectId);
        let tl: any = { duration_days: 1, milestones: [] };
        try { if (e.parameters) tl = JSON.parse(e.parameters); } catch {}
        if (!tl.duration_days) tl.duration_days = 1;
        const startD = new Date(e.date + 'T00:00:00');
        const daysP = -1;
        const sortedMs = (tl.milestones || []).sort((a: any, b: any) => a.day - b.day);
        const todayMs = sortedMs.find((m: any) => m.day === daysP);
        const nextMs = sortedMs.find((m: any) => m.day > daysP);
        const isExpanded = expanded === e.id;
        const selIdx = selectedStep[e.id] ?? sortedMs.findIndex((m: any) => m.day === daysP);
        const selMs = sortedMs[selIdx >= 0 ? selIdx : 0];
        const remainDays = tl.duration_days - daysP;

        return (
          <div key={e.id} className={`tl-card tl-c-${(expIndexMap.get(e.id) ?? ei) % 10}`} style={{
            background: '#18181b', borderRadius: 14, marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.04)',
            transition: 'all 0.3s, transform 0.25s, box-shadow 0.25s',
          }}
            onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e }); }}
            onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; ev.currentTarget.style.borderColor = color.main + '25'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '1'; }}
            onMouseLeave={ev => { ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '0'; }}
          >
            {/* Collapsed card */}
            <div style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : e.id)}>
              {/* Row 1: name + remaining days */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color.main }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f2' }}>{e.title}</span>
                  {proj && <span style={{ fontSize: 11, color: '#d0d4dc' }}>{proj.name}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#d0d4dc', fontVariantNumeric: 'tabular-nums' }}>{(() => { const d = Math.ceil((new Date(e.date + 'T00:00:00').getTime() - todayD.getTime()) / 86400000); return d > 0 ? d + '天后' : d === 0 ? '明天' : ''; })()}</span>
                  <div className="home-exp-del" onClick={async (ev) => { ev.stopPropagation(); if (await showConfirm('删除实验「' + e.title + '」？')) { await deleteExperiment(e.id); await useStore.getState().loadAll(); } }} style={{
                    width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', opacity: 0, transition: 'all 0.2s', color: '#d0d4dc', flexShrink: 0,
                  }}
                    onMouseEnter={ev => { ev.currentTarget.style.color = '#fc8181'; ev.currentTarget.style.background = 'rgba(252,129,129,0.1)'; }}
                    onMouseLeave={ev => { ev.currentTarget.style.color = '#4a5568'; ev.currentTarget.style.background = 'transparent'; }}
                  ><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></div>
                  <span style={{ color: '#d0d4dc', fontSize: 12, transform: isExpanded ? 'rotate(180deg)' : '', transition: 'transform 0.3s' }}>▼</span>
                </div>
              </div>

              {/* Today task one-liner (hidden when expanded) */}
              {!isExpanded && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {todayMs ? (
                  <>
                    <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: color.main, color: '#fff', fontWeight: 600 }}>今天</span>
                    <span style={{ fontSize: 13, color: color.main, fontWeight: 600 }}>{todayMs.label}</span>
                  </>
                ) : nextMs ? (
                  <>
                    <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#d0d4dc' }}>下一步</span>
                    <span style={{ fontSize: 13, color: '#d0d4dc' }}>第{nextMs.day}天 · {nextMs.label}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#d0d4dc' }}>第{daysP}天/{tl.duration_days}天</span>
                )}
              </div>}
            </div>

            {/* Expanded section - editable */}
            {isExpanded && sortedMs.length > 0 && (
              <div style={{ padding: '0 20px 16px', animation: 'fadeIn 0.3s ease' }} onClick={ev => ev.stopPropagation()}>
                {sortedMs.map((ms: any, mi: number) => {
                  const msDate = new Date(startD); msDate.setDate(msDate.getDate() + ms.day);
                  const isDone = daysP > ms.day;
                  const isT = daysP === ms.day;
                  return (
                    <div key={mi} className="home-step-row" style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
                      borderRadius: 8, marginBottom: 2, position: 'relative',
                      background: isT ? color.light : 'transparent',
                      transition: 'all 0.2s', cursor: 'pointer',
                    }}
                      onMouseEnter={(ev: any) => { if (!isT) ev.currentTarget.style.background = 'rgba(125,211,252,0.08)'; const del = ev.currentTarget.querySelector('.home-step-del'); if (del) del.style.opacity = '1'; }}
                      onMouseLeave={(ev: any) => { if (!isT) ev.currentTarget.style.background = 'transparent'; const del = ev.currentTarget.querySelector('.home-step-del'); if (del) del.style.opacity = '0'; }}
                      onClick={() => setStepEdit({ exp: e, mi, day: String(ms.day), label: ms.label })}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isT ? color.main : '#3a3a40',
                        boxShadow: isT ? '0 0 6px ' + color.main : 'none',
                      }} />
                      <span style={{ fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', flexShrink: 0, boxSizing: 'border-box' }}>D{ms.day}</span>
                      <span style={{ fontSize: 13, color: isT ? color.main : isDone ? '#a0a0a8' : '#f0f0f2', fontWeight: isT ? 600 : 500, flex: 1, marginLeft: 4, textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>{ms.label}</span>
                      <span style={{ fontSize: 11, color: isT ? color.main : '#6a6a72', fontVariantNumeric: 'tabular-nums', marginRight: 70, minWidth: 90, textAlign: 'right' }}>{(msDate.getMonth()+1) + '月' + msDate.getDate() + '日 · ' + fmtWeek(msDate)}</span>
                      {isT && <span style={{
                        position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 10, padding: '2px 8px', borderRadius: 8,
                        background: color.main, color: '#fff', fontWeight: 600,
                      }}>今天</span>}
                      <span className="home-step-del" style={{ fontSize: 12, color: '#d0d4dc', cursor: 'pointer', opacity: 0, transition: 'all 0.2s', padding: '0 4px' }}
                        onClick={async () => {
                          const newMs = sortedMs.filter((_: any, i: number) => i !== mi);
                          const params = JSON.stringify({ ...tl, milestones: newMs });
                          const { invoke: inv } = await import('@tauri-apps/api/core');
                          await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: params, results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', nextSteps: e.nextSteps||'', status: e.status||'进行中' });
                          useStore.getState().loadAll();
                        }}
                      >✕</span>
                    </div>
                  );
                })}

                {/* Add step */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                  onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                  onMouseLeave={ev => ev.currentTarget.style.opacity = '0.4'}
                  onClick={() => {
                    const nextDay = String((sortedMs.length > 0 ? sortedMs[sortedMs.length-1].day : -1) + 1);
                    setStepEdit({ exp: e, mi: -1, day: nextDay, label: '' });
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px dashed #3a3a40' }} />
                  <span style={{ fontSize: 12, color: '#d0d4dc' }}>添加步骤</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
              </div>
            )}
          </div>
        );
      })()}

      </div>
      {/* Right sidebar: clock + calendar + timer */}
      <div className="home-sidebar">
        <ClockWidget />
        <CalendarWidget experiments={experiments} onNewExp={() => onAction('experiment')} />
        <div id="timer-sidebar-target" />
      </div>
      {stepEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24, minWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={(ev) => ev.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f2', marginBottom: 18 }}>编辑步骤</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#8890a0', marginBottom: 6 }}>第几天</div>
              <input type="text" inputMode="numeric" value={stepEdit.day} onChange={(ev) => setStepEdit({ ...stepEdit, day: ev.target.value.replace(/[^0-9]/g, '') })} onKeyDown={(ev) => { if (ev.key === 'Enter') saveStepEdit(); if (ev.key === 'Escape') setStepEdit(null); }} style={{ width: '100%', padding: '8px 12px', background: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#f0f0f2', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#8890a0', marginBottom: 6 }}>步骤名称</div>
              <input type="text" value={stepEdit.label} onChange={(ev) => setStepEdit({ ...stepEdit, label: ev.target.value })} onKeyDown={(ev) => { if (ev.key === 'Enter') saveStepEdit(); if (ev.key === 'Escape') setStepEdit(null); }} autoFocus style={{ width: '100%', padding: '8px 12px', background: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#f0f0f2', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setStepEdit(null)} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#d0d4dc', fontSize: 12, cursor: 'pointer' }}>取消</button>
              <button onClick={saveStepEdit} style={{ padding: '7px 16px', background: '#7dd3fc', border: 'none', borderRadius: 6, color: '#0f0f12', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>保存</button>
            </div>
          </div>
        </div>
      )}
      {ctxMenu && (
        <div style={{ position: 'fixed', left: Math.min(ctxMenu.x, window.innerWidth - 140), top: Math.min(ctxMenu.y, window.innerHeight - 90), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const exp = ctxMenu.exp; setCtxMenu(null); navigateTo('experimentDetail', { experimentId: exp.id, projectId: exp.projectId }); }}
          >详情</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { localStorage.setItem('biolab-edit-exp', JSON.stringify(ctxMenu.exp)); onAction('experiment'); setCtxMenu(null); }}
          >编辑</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const exp = ctxMenu.exp; setCtxMenu(null); if (await showConfirm('删除实验「' + exp.title + '」？')) { await deleteExperiment(exp.id); await useStore.getState().loadAll(); } }}
          >删除</div>
        </div>
      )}
    </div>
  );
}


// ═══ Projects ═══
function ProjectsPage({ onAction }: { onAction: (t: string) => void }) {
  const { projects, experiments, results, navigateTo, deleteProject } = useStore();
  const [projCtxMenu, setProjCtxMenu] = useState<{x:number;y:number;proj:any}|null>(null);
  React.useEffect(() => { if (!projCtxMenu) return; const cl = () => setProjCtxMenu(null); const t = setTimeout(() => { window.addEventListener('click', cl); window.addEventListener('scroll', cl, true); }, 0); return () => { clearTimeout(t); window.removeEventListener('click', cl); window.removeEventListener('scroll', cl, true); }; }, [projCtxMenu]);
  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title">课题</div>
        <div style={{ padding: '6px 16px', borderRadius: 6, background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', color: '#7dd3fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={async () => { const name = await showPrompt('输入课题名称'); if (name) { await useStore.getState().addProject({ name, code: '', direction: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), status: '进行中', tags: '[]', budget: 0 } as any); await await useStore.getState().loadAll(); } }}>+ 新建课题</div>
      </div>
      {projects.length === 0 && <div className="card clickable" onClick={async () => { const name = await showPrompt('输入课题名称'); if (name && name.trim()) { await useStore.getState().addProject({ name: name.trim(), code: '', direction: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), status: '进行中', tags: '[]', budget: 0 } as any); await useStore.getState().loadAll(); } }} style={{ textAlign: 'center', padding: 30 }}>
        <FlaskConical size={28} color="#4a5568" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: '#d0d4dc', fontSize: 14, marginBottom: 4 }}>暂无课题</div>
        <div style={{ color: '#7dd3fc', fontSize: 13 }}>点击创建第一个课题</div>
      </div>}
      <div className="grid-2">
        {[...projects].sort((a, b) => a.status === '已完成' && b.status !== '已完成' ? 1 : b.status === '已完成' && a.status !== '已完成' ? -1 : 0).map(p => (
          <div key={p.id} className="card clickable" style={{ marginBottom: 0, opacity: p.status === '已完成' ? 0.65 : 1, transition: 'all 0.35s ease' }} onClick={() => navigateTo('projectDetail', { projectId: p.id })} onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setProjCtxMenu({ x: ev.clientX, y: ev.clientY, proj: p }); }} onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'; ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.4)'; ev.currentTarget.style.boxShadow = '0 0 30px rgba(125,211,252,0.12), inset 0 0 30px rgba(125,211,252,0.03)'; ev.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; }} onMouseLeave={ev => { ev.currentTarget.style.background = ''; ev.currentTarget.style.borderColor = ''; ev.currentTarget.style.boxShadow = ''; ev.currentTarget.style.transform = ''; }}>
            <div className="flex items-center gap-2 mb-2"><span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600, letterSpacing: '0.5px', background: p.status === '已完成' ? 'rgba(72,187,120,0.12)' : 'rgba(125,211,252,0.1)', color: p.status === '已完成' ? '#48bb78' : '#7dd3fc', border: '1px solid ' + (p.status === '已完成' ? 'rgba(72,187,120,0.25)' : 'rgba(125,211,252,0.2)') }}>{p.status === '已完成' ? '\u2713 已完成' : '\u25CF 进行中'}</span>{p.code && <span className="text-xs muted">{p.code}</span>}</div>
            <div className="font-bold" style={{ fontSize: 15, marginBottom: 4 }}>{p.name}</div>
            {p.description && <p className="text-sm muted" style={{ marginBottom: 6 }}>{p.description.slice(0, 80)}</p>}
            {p.keywords?.length > 0 && <div style={{ marginBottom: 6 }}>{p.keywords.map((k: string) => <span key={k} className="tag">{k}</span>)}</div>}
            <div className="meta-row"><FlaskConical size={12} /> {experiments.filter(e => e.projectId === p.id).length} 实验 {p.leader && <><span>·</span><span>{p.leader}</span></>} {p.startDate && <><Calendar size={12} /><span>{p.startDate}</span></>}</div>
          </div>
        ))}
      </div>
      {projCtxMenu && createPortal(
        <div style={{ position: 'fixed', left: Math.min(projCtxMenu.x, window.innerWidth - 140), top: Math.min(projCtxMenu.y, window.innerHeight - 130), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const proj = projCtxMenu.proj; setProjCtxMenu(null); navigateTo('projectDetail', { projectId: proj.id }); }}
          >详情</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={async () => { const proj = projCtxMenu.proj; setProjCtxMenu(null); const newName = await showPrompt('修改课题名称', proj.name); if (newName && newName.trim() && newName !== proj.name) { try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_project', { id: proj.id, name: newName.trim(), code: proj.code||'', direction: proj.direction||'', keywords: proj.keywords ? JSON.stringify(proj.keywords) : '[]', description: proj.description||'', leader: proj.leader||'', startDate: proj.startDate||'', endDate: proj.endDate||'', status: proj.status||'进行中', milestones: proj.milestones||'[]' }); await useStore.getState().loadAll(); } catch(e) { console.error(e); } } }}
          >编辑</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const proj = projCtxMenu.proj; setProjCtxMenu(null); if (await showConfirm('删除课题「' + proj.name + '」？')) { await deleteProject(proj.id); await useStore.getState().loadAll(); } }}
          >删除</div>
        </div>, document.body)}
    </div>
  );
}

// ═══ Project Detail — tab navigation ═══
function ProjectDetailPage({ onAction }: { onAction: (t: string) => void }) {
  const { selectedProjectId, projects, experiments, results, tasks, references, navigateTo, deleteProject, deleteExperiment, updateTask, deleteTask, deleteReference } = useStore();
  const [readingPdf, setReadingPdf] = useState<{path: string; title: string} | null>(null);
  const [refCtxMenu, setRefCtxMenu] = useState<{x:number;y:number;ref:any}|null>(null);
  React.useEffect(() => { if (!refCtxMenu) return; const cl = () => setRefCtxMenu(null); const t = setTimeout(() => { window.addEventListener('click', cl); window.addEventListener('scroll', cl, true); }, 0); return () => { clearTimeout(t); window.removeEventListener('click', cl); window.removeEventListener('scroll', cl, true); }; }, [refCtxMenu]);
  const [projExpCtxMenu, setProjExpCtxMenu] = useState<{x:number;y:number;exp:any}|null>(null);
  React.useEffect(() => { if (!projExpCtxMenu) return; const cl = () => setProjExpCtxMenu(null); const t = setTimeout(() => { window.addEventListener('click', cl); window.addEventListener('scroll', cl, true); }, 0); return () => { clearTimeout(t); window.removeEventListener('click', cl); window.removeEventListener('scroll', cl, true); }; }, [projExpCtxMenu]);
  const [activeTab, setActiveTab] = useState('experiments');
  const p = projects.find(x => x.id === selectedProjectId);
  const exps = experiments.filter(e => e.projectId === p.id);
  const res = results.filter(r => r.projectId === p.id);
  const tsks = tasks.filter(t => t.projectId === p.id);
  const [showProjRefPicker, setShowProjRefPicker] = useState(false);
  const [projRefSearch, setProjRefSearch] = useState('');
  if (!p) return null;
  const expLinkedRefIds: string[] = experiments.filter(e => e.projectId === p.id).flatMap(e => { try { const tl = JSON.parse(e.parameters || '{}'); return tl.linkedRefs || []; } catch { return []; } });
  const [projLinkedRefIds, setProjLinkedRefIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('biolab-proj-refs-' + selectedProjectId) || '[]'); } catch { return []; } });
  const refs = references.filter(r => projLinkedRefIds.includes(r.id));

  const tabs = [
    { key: 'experiments', label: '实验', count: exps.length, color: '#63b3ed' },
    { key: 'refs', label: '文献', count: refs.length, color: '#b794f4' },
  ];

  return (
    <div className="page-container">
      {projExpCtxMenu && createPortal(
        <div style={{ position: 'fixed', left: Math.min(projExpCtxMenu.x, window.innerWidth - 140), top: Math.min(projExpCtxMenu.y, window.innerHeight - 130), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const exp = projExpCtxMenu.exp; setProjExpCtxMenu(null); navigateTo('experimentDetail', { experimentId: exp.id, projectId: exp.projectId }); }}
          >详情</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { localStorage.setItem('biolab-edit-exp', JSON.stringify(projExpCtxMenu.exp)); onAction('experiment'); setProjExpCtxMenu(null); }}
          >编辑</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const exp = projExpCtxMenu.exp; setProjExpCtxMenu(null); if (await showConfirm('删除实验「' + exp.title + '」？')) { await deleteExperiment(exp.id); await useStore.getState().loadAll(); } }}
          >删除</div>
        </div>, document.body)}
      {refCtxMenu && createPortal(
        <div style={{ position: 'fixed', left: Math.min(refCtxMenu.x, window.innerWidth - 140), top: Math.min(refCtxMenu.y, window.innerHeight - 90), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(183,148,244,0.12)'; ev.currentTarget.style.color = '#b794f4'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const ref = refCtxMenu.ref; setRefCtxMenu(null); if (ref.doi) setReadingPdf({ path: ref.doi, title: ref.title }); }}
          >打开</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={() => { const ref = refCtxMenu.ref; setRefCtxMenu(null); const pl = projLinkedRefIds.filter((id: string) => id !== ref.id); setProjLinkedRefIds(pl); localStorage.setItem('biolab-proj-refs-' + selectedProjectId, JSON.stringify(pl)); }}
          >删除</div>
        </div>, document.body)}
      {readingPdf && createPortal(<PDFReader filePath={readingPdf.path} title={readingPdf.title} onClose={() => setReadingPdf(null)} />, document.body)}
      <div className="flex justify-between items-center mb-4">
        <div><h1 className="page-title" style={{ cursor: 'text' }} onClick={async () => {
          const newName = await showPrompt('修改课题名称', p.name);
          if (newName && newName.trim() && newName !== p.name) {
            try {
              const { invoke: inv } = await import('@tauri-apps/api/core');
              await inv('update_project', { id: p.id, name: newName.trim(), code: p.code||'', direction: p.direction||'', keywords: p.keywords ? JSON.stringify(p.keywords) : '[]', description: p.description||'', leader: p.leader||'', startDate: p.startDate||'', endDate: p.endDate||'', status: p.status||'进行中', milestones: p.milestones||'[]' });
              await useStore.getState().loadAll();
            } catch(e) { console.error(e); }
          }
        }}>{p.name}</h1><div className="flex items-center gap-2 mt-2"><div style={{ display: 'flex', borderRadius: 20, overflow: 'hidden', border: '1px solid ' + (p.status === '已完成' ? 'rgba(72,187,120,0.2)' : 'rgba(125,211,252,0.2)'), background: 'rgba(0,0,0,0.2)' }}>
                  <div onClick={async () => { if (p.status !== '进行中') { try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('update_project', { id: p.id, name: p.name, code: p.code||'', direction: p.direction||'', keywords: p.keywords?.join?.(',') || '', description: p.description||'', leader: p.leader||'', startDate: p.startDate||'', endDate: p.endDate||'', status: '进行中', milestones: p.milestones||'' }); await useStore.getState().loadAll(); } catch(e) { console.error(e); } } }} style={{ padding: '4px 14px', fontSize: 12, cursor: 'pointer', transition: 'all 0.25s', borderRadius: '20px 0 0 20px', color: p.status === '进行中' ? '#7dd3fc' : '#d0d4dc', background: p.status === '进行中' ? 'rgba(125,211,252,0.2)' : 'transparent', fontWeight: p.status === '进行中' ? 600 : 400 }}>进行中</div>
                  <div onClick={async () => { if (p.status !== '已完成') { try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('update_project', { id: p.id, name: p.name, code: p.code||'', direction: p.direction||'', keywords: p.keywords?.join?.(',') || '', description: p.description||'', leader: p.leader||'', startDate: p.startDate||'', endDate: p.endDate||'', status: '已完成', milestones: p.milestones||'' }); await useStore.getState().loadAll(); } catch(e) { console.error(e); } } }} style={{ padding: '4px 14px', fontSize: 12, cursor: 'pointer', transition: 'all 0.25s', borderRadius: '0 20px 20px 0', color: p.status === '已完成' ? '#48bb78' : '#d0d4dc', background: p.status === '已完成' ? 'rgba(72,187,120,0.2)' : 'transparent', fontWeight: p.status === '已完成' ? 600 : 400 }}>已完成</div>
                </div><span className="text-xs muted">{[p.code, p.direction, p.leader].filter(Boolean).join(' · ')}</span></div></div>

      </div>
      {p.description && <div className="card mb-3"><div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{p.description}</div></div>}

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(tab => (
          <div key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
            color: activeTab === tab.key ? tab.color : '#d0d4dc',
            borderBottom: activeTab === tab.key ? '2px solid ' + tab.color : '2px solid transparent',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {tab.label}
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: activeTab === tab.key ? tab.color + '18' : 'rgba(255,255,255,0.05)', color: activeTab === tab.key ? tab.color : '#d0d4dc' }}>{tab.count}</span>
          </div>
        ))}
      </div>

      {activeTab === 'experiments' && (<div>
        {exps.map(e => (
          <div key={e.id} className="card clickable compact" onClick={() => navigateTo('experimentDetail', { experimentId: e.id })} onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setProjExpCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e }); }} style={{ marginBottom: 6 }}>
            <div className="flex justify-between items-center"><span className="font-bold">{e.title}</span></div>
            <div className="meta-row mt-2"><Calendar size={12} /><span>{e.date}</span><span>{e.type}</span></div>
          </div>
        ))}
        {exps.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: '#d0d4dc', fontSize: 13 }}>暂无实验 · <span style={{ color: '#7dd3fc', cursor: 'pointer' }} onClick={() => onAction('experiment')}>点击创建</span></div>}
      </div>)}

      

      

      {activeTab === 'refs' && (<div>
        {refs.length > 0 ? (<><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {refs.map(r => (
            <div key={r.id} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(183,148,244,0.04)', border: '1px solid rgba(183,148,244,0.1)', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative', cursor: 'pointer' }}
              onDoubleClick={() => { if (r.doi) setReadingPdf({ path: r.doi, title: r.title }); }}
              onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setRefCtxMenu({ x: ev.clientX, y: ev.clientY, ref: r }); }}
              onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(183,148,244,0.08)'; const del = ev.currentTarget.querySelector('[data-proj-ref-del]') as HTMLElement; if (del) del.style.opacity = '1'; }}
              onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(183,148,244,0.04)'; const del = ev.currentTarget.querySelector('[data-proj-ref-del]') as HTMLElement; if (del) del.style.opacity = '0'; }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d5', marginBottom: 2 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#d0d4dc' }}>{(() => { const parts = r.coreConclusion?.split?.('|') || []; return [parts[0], r.year, r.journal && !r.journal.includes(':') ? r.journal : ''].filter(Boolean).join(' · '); })()}</div>
              </div>
              <div data-proj-ref-del="" style={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'all 0.25s', cursor: 'pointer', color: '#d0d4dc', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={ev => { ev.currentTarget.style.color = '#fc8181'; ev.currentTarget.style.background = 'rgba(252,129,129,0.1)'; }}
                onMouseLeave={ev => { ev.currentTarget.style.color = '#d0d4dc'; ev.currentTarget.style.background = 'transparent'; }}
                onClick={() => {
                  const pl = projLinkedRefIds.filter(id => id !== r.id);
                  setProjLinkedRefIds(pl);
                  localStorage.setItem('biolab-proj-refs-' + selectedProjectId, JSON.stringify(pl));
                }}
              ><Trash2 size={14} /></div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 6, background: 'rgba(183,148,244,0.06)', border: '1px solid rgba(183,148,244,0.12)', color: '#b794f4', fontSize: 11, cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => setShowProjRefPicker(true)}
            onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.12)'}
            onMouseLeave={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.06)'}
          >关联文献</div>
        </div></>) : (<div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '6px 18px', borderRadius: 8, background: 'rgba(183,148,244,0.08)', border: '1px solid rgba(183,148,244,0.15)', color: '#b794f4', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => setShowProjRefPicker(true)}
            onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.15)'}
            onMouseLeave={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.08)'}
          >关联文献</div>
        </div>)}

        {showProjRefPicker && createPortal(
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={() => { setShowProjRefPicker(false); setProjRefSearch(''); }}>
            <div style={{ background: '#1a1f2e', border: '1px solid rgba(183,148,244,0.15)', borderRadius: 14, padding: 0, width: '90vw', maxWidth: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f2' }}>选择要关联的文献</span>
                <X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={() => { setShowProjRefPicker(false); setProjRefSearch(''); }} />
              </div>
              <div style={{ padding: '8px 12px 0' }}>
                <input className="form-input" value={projRefSearch} onChange={e => setProjRefSearch(e.target.value)} placeholder="搜索文献..." style={{ width: '100%', padding: '8px 12px', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} autoFocus />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px' }}>
                {references.filter((r: any) => !refs.some((er: any) => er.id === r.id) && (!projRefSearch || r.title?.toLowerCase().includes(projRefSearch.toLowerCase()))).length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: '#d0d4dc', fontSize: 13 }}>暂无可关联的文献</div>
                ) : references.filter((r: any) => !refs.some((er: any) => er.id === r.id) && (!projRefSearch || r.title?.toLowerCase().includes(projRefSearch.toLowerCase()))).map((r: any) => (
                  <div key={r.id} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(183,148,244,0.06)'; ev.currentTarget.style.borderColor = 'rgba(183,148,244,0.15)'; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                    onClick={async () => {
                      const projLinked = [...projLinkedRefIds];
                      if (!projLinked.includes(r.id)) projLinked.push(r.id);
                      setProjLinkedRefIds(projLinked);
                      localStorage.setItem('biolab-proj-refs-' + selectedProjectId, JSON.stringify(projLinked));

                      setProjRefSearch('');
                      useStore.getState().loadAll();
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f2', marginBottom: 3 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#d0d4dc' }}>{(() => { const parts = r.coreConclusion?.split?.('|') || []; return [parts[0], r.year, r.journal && !r.journal.includes(':') ? r.journal : ''].filter(Boolean).join(' · '); })()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
        document.body)}
      </div>)}
    </div>
  );
}

// ═══ Timeline Card ═══


// ═══ Experiment Detail — Time Progress + Results with Files ═══
function TimelineCard({ timeline, daysPassed, dayPct, onSave, expType, startDate }: { timeline: any; daysPassed: number; dayPct: number; onSave: (tl: any) => void; expType?: string; startDate?: string }) {
  const milestones = (timeline.milestones || []).sort((a: any, b: any) => a.day - b.day);
  const maxDay = timeline.duration_days || 1;
  const mode = timeline.display_mode || 'timeline';

  // Mode B: Step flow (for short experiments)
  if (mode === 'steps' && milestones.length > 0) {
    return (
      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: '#90cdf4', fontWeight: 600 }}>实验步骤</span>
          <span style={{ fontSize: 11, color: '#d0d4dc' }}>{milestones.length} 步</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {milestones.map((ms: any, mi: number) => {
            const isDone = daysPassed > 0 && mi < daysPassed;
            const isCurrent = mi === Math.min(daysPassed, milestones.length - 1);
            return (
              <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {mi > 0 && <span style={{ color: '#2a2a2e', fontSize: 10 }}>→</span>}
                <div style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 12,
                  background: isDone ? 'rgba(72,187,120,0.1)' : isCurrent ? 'rgba(125,211,252,0.12)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (isDone ? 'rgba(72,187,120,0.2)' : isCurrent ? 'rgba(125,211,252,0.25)' : 'rgba(255,255,255,0.06)'),
                  color: isDone ? '#48bb78' : isCurrent ? '#7dd3fc' : '#a0a0a8',
                  fontWeight: isCurrent ? 600 : 400,
                }}>
                  <span>{ms.label}</span>
                  {ms.duration && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>{ms.duration}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mode C: Checklist (for bioinformatics)
  if (mode === 'checklist' && milestones.length > 0) {
    return (
      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: '#90cdf4', fontWeight: 600 }}>任务清单</span>
          <span style={{ fontSize: 11, color: '#d0d4dc' }}>{milestones.filter((_: any, i: number) => i < daysPassed).length} / {milestones.length}</span>
        </div>
        {milestones.map((ms: any, mi: number) => {
          const isDone = mi < daysPassed;
          return (
            <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: mi < milestones.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid ' + (isDone ? '#48bb78' : '#3a3a40'), background: isDone ? 'rgba(72,187,120,0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#48bb78', flexShrink: 0 }}>{isDone ? '✓' : ''}</div>
              <span style={{ fontSize: 12, color: isDone ? '#606068' : '#f0f0f2', textDecoration: isDone ? 'line-through' : 'none', flex: 1 }}>{ms.label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Mode A: Day timeline (default, for animal experiments)
  if (milestones.length === 0) {
    return (
      <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#90cdf4', fontWeight: 600 }}>第 {daysPassed} 天 / {maxDay} 天</span>
          <span style={{ fontSize: 11, color: '#d0d4dc' }}>{Math.round(dayPct)}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 8 }}>
          <div style={{ height: '100%', width: dayPct + '%', borderRadius: 2, background: 'linear-gradient(90deg, #3a8fd4, #7dd3fc)', transition: 'width 0.6s' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#90cdf4', fontWeight: 600 }}>第 {daysPassed} 天 / {maxDay} 天</span>
        <span style={{ fontSize: 11, color: '#d0d4dc' }}>{milestones.filter((m: any) => daysPassed >= m.day).length} / {milestones.length} 完成</span>
      </div>
      <div style={{ position: 'relative', padding: '0 8px' }}>
        <style>{`@keyframes biolabTlLaserRight { 0%, 10% { left: var(--laser-start, 0%); opacity: 0; width: 120px; } 11% { opacity: 1; } 100% { left: 100%; opacity: 0; width: 40px; } } @keyframes biolabTodayPulse { 0% { box-shadow: 0 0 16px rgba(125,211,252,0.9), 0 0 32px rgba(125,211,252,0.6), 0 0 56px rgba(125,211,252,0.35); transform: translate(-50%, -50%) scale(1); } 25% { box-shadow: 0 0 32px rgba(125,211,252,1), 0 0 64px rgba(125,211,252,0.9), 0 0 110px rgba(125,211,252,0.6); transform: translate(-50%, -50%) scale(1.2); } 100% { box-shadow: 0 0 16px rgba(125,211,252,0.9), 0 0 32px rgba(125,211,252,0.6), 0 0 56px rgba(125,211,252,0.35); transform: translate(-50%, -50%) scale(1); } }`}</style>
        <div style={{ position: 'absolute', top: 60, left: 8, right: 8, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -2, height: 6, width: 80, background: 'linear-gradient(90deg, #ffffff, #7dd3fc 30%, transparent)', borderRadius: 3, animation: 'biolabTlLaserRight 1.5s ease-out infinite', filter: 'blur(0.3px)', boxShadow: '0 0 12px rgba(125,211,252,0.9), 0 0 24px rgba(125,211,252,0.5)', pointerEvents: 'none', ['--laser-start' as any]: (() => { const n = milestones.length; if (n === 0) return '0%'; let curIdx = -1; for (let i = 0; i < n; i++) { if (daysPassed >= milestones[i].day) curIdx = i; else break; } if (curIdx < 0) return '0%'; return ((curIdx + 0.5) / n) * 100 + '%'; })() }} />
        </div>
        <div style={{ position: 'absolute', top: 60, left: 8, height: 2, borderRadius: 1, background: 'linear-gradient(90deg, rgba(125,211,252,0.25), #7dd3fc)', width: (() => { const n = milestones.length; if (n === 0) return '0px'; let curIdx = -1; for (let i = 0; i < n; i++) { if (daysPassed >= milestones[i].day) curIdx = i; else break; } if (curIdx < 0) return '0px'; const pct = (curIdx + 0.5) / n; return 'calc((100% - 16px) * ' + pct + ')'; })(), transition: 'width 0.6s', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {milestones.map((ms: any, mi: number) => {
            const isDone = daysPassed >= ms.day;
            const isToday = daysPassed === ms.day;
            const isFuture = daysPassed < ms.day;
            return (
              <div key={mi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, flex: 1, position: 'relative' }}>
{(() => { const nd = new Date((startDate || '2026-01-01') + 'T00:00:00'); nd.setDate(nd.getDate() + ms.day); const wd = ['日','一','二','三','四','五','六'][nd.getDay()]; const c = isToday ? '#7dd3fc' : isDone ? 'rgba(125,211,252,0.7)' : '#d0d4dc'; return (<>
                <span style={{ fontSize: 13, color: c, opacity: 1, fontWeight: 700, marginBottom: 2 }}>{nd.getMonth()+1}/{nd.getDate()}</span>
                <span style={{ fontSize: 13, color: c, opacity: 1, fontWeight: 700, marginBottom: 28 }}>周{wd}</span>
                </>); })()}
                <div style={{
                  position: 'absolute', top: 60, left: '50%', transform: 'translate(-50%, -50%)',
                  width: isToday ? 14 : 10, height: isToday ? 14 : 10, borderRadius: '50%', flexShrink: 0,
                  background: isDone ? '#7dd3fc' : isToday ? '#7dd3fc' : '#3a3a40',
                  boxShadow: isToday ? '0 0 12px rgba(125,211,252,0.8), 0 0 24px rgba(125,211,252,0.5), 0 0 40px rgba(125,211,252,0.3)' : 'none',
                  animation: isToday ? 'biolabTodayPulse 1.5s ease-in-out infinite' : 'none',
                  transition: 'all 0.3s', zIndex: 10,
                }} />
                <div style={{ height: 18 }} />
                                <span style={{ fontSize: 11, marginTop: 10, fontVariantNumeric: 'tabular-nums', color: isToday ? '#7dd3fc' : isDone ? 'rgba(125,211,252,0.7)' : '#a0a0a8', fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: '1px solid ' + (isToday ? '#7dd3fc' : isDone ? 'rgba(125,211,252,0.35)' : 'rgba(255,255,255,0.12)'), background: isToday ? 'rgba(125,211,252,0.12)' : isDone ? 'rgba(125,211,252,0.06)' : 'rgba(255,255,255,0.02)' }}>D{ms.day}</span>
                <span style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.3, marginTop: 6, color: isToday ? '#f0f0f2' : '#d0d4dc', fontWeight: isToday ? 600 : 500, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}
                  onMouseEnter={(ev: any) => { ev.currentTarget.style.overflow = 'visible'; ev.currentTarget.style.maxWidth = 'none'; ev.currentTarget.style.background = 'rgba(20,24,34,0.95)'; ev.currentTarget.style.borderRadius = '4px'; ev.currentTarget.style.zIndex = '10'; }}
                  onMouseLeave={(ev: any) => { ev.currentTarget.style.overflow = 'hidden'; ev.currentTarget.style.maxWidth = '64px'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.zIndex = '0'; }}>{ms.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

}function ExperimentDetailPage() {
  const { selectedExperimentId, experiments, projects, references, navigateTo, deleteExperiment } = useStore();
  const [files, setFiles] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeSection, setActiveSection] = useState('purpose');
  const [readingPdf, setReadingPdf] = useState<{path: string; title: string} | null>(null);
  const [refCtxMenu2, setRefCtxMenu2] = useState<{x:number;y:number;ref:any}|null>(null);
  const [stepEdit2, setStepEdit2] = useState<{mi: number; day: string; name: string; detail: string}|null>(null);
  React.useEffect(() => { if (!refCtxMenu2) return; const cl = () => setRefCtxMenu2(null); const t = setTimeout(() => { window.addEventListener('click', cl); window.addEventListener('scroll', cl, true); }, 0); return () => { clearTimeout(t); window.removeEventListener('click', cl); window.removeEventListener('scroll', cl, true); }; }, [refCtxMenu2]);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showRefPicker, setShowRefPicker] = useState(false);
  const [refPickerSearch, setRefPickerSearch] = useState('');
  const [refLinkedMsg, setRefLinkedMsg] = useState<string | null>(null);
  const [editingTimeline, setEditingTimeline] = useState(false);
  const exp = experiments.find(e => e.id === selectedExperimentId);
  const expRefIds: string[] = (() => { try { const tl = exp ? JSON.parse(exp.parameters || '{}') : {}; return tl.linkedRefs || []; } catch { return []; } })();
  const excludedRefIds: string[] = (() => { try { const tl = exp ? JSON.parse(exp.parameters || '{}') : {}; return tl.excludedRefs || []; } catch { return []; } })();
  const expRefs = references.filter((r: any) => exp && !excludedRefIds.includes(r.id) && expRefIds.includes(r.id));

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

  const addMilestone = async () => {
    const dayStr = await showPrompt('第几天？', String(daysPassed + 3));
    if (!dayStr) return;
    const label = await showPrompt('操作内容？', '');
    if (!label) return;
    const newTl = { ...timeline, milestones: [...timeline.milestones, { day: parseInt(dayStr), label }] };
    saveTimeline(newTl);
  };

  const removeMilestone = (idx: number) => {
    const newTl = { ...timeline, milestones: timeline.milestones.filter((_, i) => i !== idx) };
    saveTimeline(newTl);
  };

  const setDuration = async () => {
    const d = await showPrompt('实验总天数？', String(timeline.duration_days));
    if (d) { saveTimeline({ ...timeline, duration_days: parseInt(d) || 30 }); }
  };

  // Image files for inline display
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'];
  const imageFiles = files.filter(f => imageExts.includes((f.file_type || '').toLowerCase()));
  const otherFiles = files.filter(f => !imageExts.includes((f.file_type || '').toLowerCase()));

  const doSave = async (field: string, value: string) => {
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

  const sections = [
    { key: 'purpose', label: '实验目的', icon: '◎', content: exp.purpose },
    { key: 'materials', label: '样本材料', icon: '◈', content: exp.materials },
    { key: 'steps', label: '实验步骤', icon: '☰', content: exp.steps },
    { key: 'results', label: '实验结果', icon: '◆', content: exp.results },
    { key: 'conclusion', label: '结论', icon: '✦', content: exp.conclusion },
    { key: 'notes', label: '备注', icon: '≡', content: notes },
    { key: "refs", label: "参考文献", icon: "📎", content: "" },
  ];

  const EditBlock = ({ field, content }: { field: string; content?: string }) => {
    if (editing === field) {
      return <textarea className="exp-edit-textarea" defaultValue={content || ''} autoFocus
        onBlur={(ev) => { const val = ev.target.value; setEditing(null); if (val !== (content || '')) doSave(field, val); }}
        onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }} />;
    }
    return (
      <div className="exp-content-block" onClick={() => setEditing(field)}>
        {content ? <div className="exp-content-text">{content}</div> : <div className="exp-content-empty">&nbsp;</div>}
      </div>
    );
  };

  const activeSec = sections.find(s => s.key === activeSection);

  if (!exp) return null;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="exp-detail-header">
        <div className="flex-1">
          <h1 className="page-title" style={{ cursor: 'text' }} onClick={async () => { const newTitle = await showPrompt('修改实验名称', exp.title); if (newTitle && newTitle !== exp.title) { try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: exp.id, title: newTitle, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: exp.parameters||'', results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } } }}>{exp.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs muted"><Calendar size={12} /> {formatDate(exp.date)} · {exp.type}</span>
            {proj && <span className="text-xs muted">· {proj.name}</span>}
          </div>
        </div>
        

      </div>

      {/* Time progress bar */}
      <TimelineCard 
        timeline={{...timeline, _expId: exp.id}} 
        daysPassed={daysPassed} 
        dayPct={dayPct}
        onSave={saveTimeline}
        expType={exp.type || ''}
        startDate={exp.date}
      />

      {/* Section nav */}
      <div className="exp-section-nav">
        {sections.map(s => (
          <div key={s.key} className={`exp-nav-item ${activeSection === s.key ? 'active' : ''}`} onClick={() => setActiveSection(s.key)}>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="exp-detail-body" style={{ gridTemplateColumns: "1fr" }}>
        <div className="exp-sections-scroll">
          {activeSec && (
            <div className="exp-section-card active-section">
              {activeSec.key === 'steps' ? (() => {
                const parseSteps = (text: string) => {
                  if (!text) return [];
                  return text.split('\n').filter(Boolean).map(line => {
                    const m = line.match(/^D(-?\d+):\s*(.+?)(?:\s*-\s*(.+))?$/);
                    if (m) return { day: parseInt(m[1]), name: m[2].trim(), detail: m[3]?.trim() || '' };
                    return { day: 0, name: line, detail: '' };
                  });
                };
                const stepsList = parseSteps(exp.steps || '');
                const saveSteps = async (newSteps: any[]) => {
                  const stepsText = newSteps.map(s => 'D' + s.day + ': ' + s.name + (s.detail ? ' - ' + s.detail : '')).join('\n');
                  const milestones = newSteps.map(s => ({ day: s.day, label: s.name }));
                  let tl: any = {}; try { tl = JSON.parse(exp.parameters || '{}'); } catch {}
                  tl.milestones = milestones;
                  tl.duration_days = Math.max(...milestones.map((m: any) => m.day), 0) + 1;
                  const params = JSON.stringify(tl);
                  try {
                    const { invoke: inv } = await import('@tauri-apps/api/core');
                    await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: stepsText, parameters: params, results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
                    await useStore.getState().loadAll();
                  } catch(e) { console.error(e); }
                };
                return (
                  <div>
                    {stepsList.map((step, si) => (
                      <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: si < stepsList.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <span style={{ fontSize: 12, color: '#7dd3fc', minWidth: 36, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, transition: 'all 0.15s', fontWeight: 600 }}
                          onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.08)'; ev.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.textDecoration = 'none'; }}
                          onClick={async () => { const v = await showPrompt('修改天数 (D' + step.day + ')', String(step.day)); if (v === null) return; const d = parseInt(v); if (isNaN(d)) return; const ns = [...stepsList]; ns[si] = {...ns[si], day: d}; ns.sort((a,b) => a.day - b.day); saveSteps(ns); }}
                        >D{step.day}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#f0f0f2', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, transition: 'all 0.15s', fontWeight: 500 }}
                            onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.03)'; ev.currentTarget.style.textDecoration = 'underline dashed rgba(255,255,255,0.2)'; }}
                            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.textDecoration = 'none'; }}
                            onClick={async () => { const v = await showPrompt('修改步骤名称', step.name); if (v === null || v === step.name) return; const ns = [...stepsList]; ns[si] = {...ns[si], name: v}; saveSteps(ns); }}
                          >{step.name}</div>
                          {step.detail && <div style={{ fontSize: 11, color: '#d0d4dc', padding: '2px 6px', cursor: 'pointer', transition: 'all 0.15s', borderRadius: 4 }}
                            onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; }}
                            onClick={async () => { const v = await showPrompt('修改步骤详情', step.detail); if (v === null) return; const ns = [...stepsList]; ns[si] = {...ns[si], detail: v}; saveSteps(ns); }}
                          >{step.detail}</div>}
                        </div>
                        <span style={{ fontSize: 12, color: '#d0d4dc', cursor: 'pointer', padding: '2px 6px', opacity: 0.3, transition: 'all 0.2s' }}
                          onMouseEnter={ev => { ev.currentTarget.style.opacity = '1'; ev.currentTarget.style.color = '#fc8181'; }}
                          onMouseLeave={ev => { ev.currentTarget.style.opacity = '0.3'; ev.currentTarget.style.color = '#d0d4dc'; }}
                          onClick={async () => { const ns = stepsList.filter((_, i) => i !== si); saveSteps(ns); }}
                        >✕</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                      onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                      onMouseLeave={ev => ev.currentTarget.style.opacity = '0.4'}
                      onClick={() => {
                        const nextDay = String(stepsList.length > 0 ? stepsList[stepsList.length-1].day + 1 : 0);
                        setStepEdit2({ mi: -1, day: nextDay, name: '', detail: '' });
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px dashed #3a3a40' }} />
                      <span style={{ fontSize: 12, color: '#d0d4dc' }}>添加步骤</span>
                    </div>
                  </div>
                );
              })() : activeSec.key !== 'refs' && <EditBlock field={activeSec.key} content={activeSec.content} />}
              {activeSec.key === 'refs' && (() => {
                // expRefs defined at component level
                return expRefs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {expRefs.map((r: any) => (
                      <div key={r.id} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(183,148,244,0.04)', border: '1px solid rgba(183,148,244,0.1)', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}
                        onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(183,148,244,0.08)'; const del = ev.currentTarget.querySelector('[data-ref-del]') as HTMLElement; if (del) del.style.opacity = '1'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(183,148,244,0.04)'; const del = ev.currentTarget.querySelector('[data-ref-del]') as HTMLElement; if (del) del.style.opacity = '0'; }}
                        onDoubleClick={() => { if (r.doi) setReadingPdf({ path: r.doi, title: r.title }); }}
                        onContextMenu={(ev: any) => { ev.preventDefault(); ev.stopPropagation(); setRefCtxMenu2({ x: ev.clientX, y: ev.clientY, ref: r }); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b794f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d5', marginBottom: 2 }}>{r.title}</div>
                          <div style={{ fontSize: 11, color: '#d0d4dc' }}>{r.authors}{r.journal ? ' · ' + r.journal : ''}{r.year ? ' (' + r.year + ')' : ''}</div>
                        </div>
                        <div data-ref-del="" style={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'all 0.25s', cursor: 'pointer', color: '#d0d4dc', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
                          onClick={async (ev) => { ev.stopPropagation(); try { const { invoke: inv } = await import('@tauri-apps/api/core'); let tl: any = {}; try { tl = JSON.parse(exp.parameters || '{}'); } catch {} tl.linkedRefs = (tl.linkedRefs || []).filter((id: string) => id !== r.id); const ex = tl.excludedRefs || []; if (!ex.includes(r.id)) ex.push(r.id); tl.excludedRefs = ex; await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: JSON.stringify(tl), results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' }); const pKey = 'biolab-proj-refs-' + exp.projectId; const pl: string[] = JSON.parse(localStorage.getItem(pKey) || '[]'); if (!pl.includes(r.id)) { pl.push(r.id); localStorage.setItem(pKey, JSON.stringify(pl)); } await useStore.getState().loadAll(); } catch(e) { console.error(e); } }}
                          onMouseEnter={ev => { ev.currentTarget.style.color = '#fc8181'; ev.currentTarget.style.background = 'rgba(252,129,129,0.1)'; ev.currentTarget.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={ev => { ev.currentTarget.style.color = '#d0d4dc'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.transform = 'scale(1)'; }}
                        ><Trash2 size={16} /></div>
                      </div>
                    ))}
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                      <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 6, background: 'rgba(183,148,244,0.06)', border: '1px solid rgba(183,148,244,0.12)', color: '#b794f4', fontSize: 11, cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => setShowRefPicker(true)}
                        onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.12)'}
                        onMouseLeave={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.06)'}
                      >关联文献</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center' }}>
                    
                    <div style={{ display: 'inline-block', padding: '6px 18px', borderRadius: 8, background: 'rgba(183,148,244,0.08)', border: '1px solid rgba(183,148,244,0.15)', color: '#b794f4', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                      onClick={() => setShowRefPicker(true)}
                      onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.15)'}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.08)'}
                    >关联文献</div>
                  </div>
                );
              })()}
              {/* Show files under results section */}
              {activeSec.key === 'results' && (
                <div className="results-files-area">
                  <FileUploadZone experimentId={exp.id} projectId={exp.projectId} files={otherFiles} onFilesChanged={loadFiles} showConfirm={showConfirm} />
                  {/* Inline image gallery */}
                  {imageFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {imageFiles.map((f: any) => {
                        const ImgThumb = () => {
                          const [src, setSrc] = useState('');
                          useEffect(() => {
                            (async () => { try { const { invoke: inv } = await import('@tauri-apps/api/core'); const dir = await inv<string>('get_data_dir'); const dataUrl = await inv<string>('read_file_base64', { localPath: dir + '/' + f.local_path }); setSrc(dataUrl); } catch {} })();
                          }, []);
                          return (
                            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s' }}
                              onMouseEnter={ev => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.2)'; const del = ev.currentTarget.querySelector('[data-img-del]') as HTMLElement; if (del) del.style.opacity = '1'; }}
                              onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; const del = ev.currentTarget.querySelector('[data-img-del]') as HTMLElement; if (del) del.style.opacity = '0'; }}
                            >
                              {src ? <img src={src} style={{ width: 120, height: 90, objectFit: 'cover', display: 'block', cursor: 'pointer' }} onClick={() => setLightboxImg(src)} alt="" />
                                : <div style={{ width: 120, height: 90, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#4a5568' }}>加载中</div>}
                              <div style={{ padding: '4px 8px', fontSize: 10, color: '#d0d4dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{f.name || f.original_name}</div>
                              <div data-img-del="" style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#d0d4dc', transition: 'all 0.2s', opacity: 0 }}
                                onMouseEnter={ev => { ev.currentTarget.style.color = '#fc8181'; ev.currentTarget.style.background = 'rgba(252,129,129,0.3)'; }}
                                onMouseLeave={ev => { ev.currentTarget.style.color = '#d0d4dc'; ev.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
                                onClick={async (ev) => { ev.stopPropagation(); if (!await showConfirm('删除该文件？')) return; try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('delete_experiment_file', { fileId: f.id }); loadFiles(); } catch(e: any) { console.error(e); } }}
                              ><Trash2 size={13} /></div>
                            </div>
                          );
                        };
                        return <ImgThumb key={f.id} />;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Lightbox */}
      {showRefPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={() => { setShowRefPicker(false); setRefPickerSearch(''); }}>
          <div style={{ background: '#1a1f2e', border: '1px solid rgba(183,148,244,0.15)', borderRadius: 14, padding: 0, width: '90vw', maxWidth: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f2' }}>选择要关联的文献</span>
              <X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={() => { setShowRefPicker(false); setRefPickerSearch(''); }} />
            </div>
            <div style={{ padding: '8px 12px 0' }}>
              <input className="form-input" value={refPickerSearch} onChange={e => setRefPickerSearch(e.target.value)} placeholder="搜索文献..." style={{ width: '100%', padding: '8px 12px', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px' }}>
              {references.filter((r: any) => !expRefs.some((er: any) => er.id === r.id) && (!refPickerSearch || r.title?.toLowerCase().includes(refPickerSearch.toLowerCase()))).length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: '#d0d4dc', fontSize: 13 }}>暂无可关联的文献</div>
              ) : references.filter((r: any) => !expRefs.some((er: any) => er.id === r.id) && (!refPickerSearch || r.title?.toLowerCase().includes(refPickerSearch.toLowerCase()))).map((r: any) => (
                <div key={r.id} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(183,148,244,0.06)'; ev.currentTarget.style.borderColor = 'rgba(183,148,244,0.15)'; }}
                  onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                  onClick={async () => {
                    try {
                      const { invoke: inv } = await import('@tauri-apps/api/core');
                      let tl: any = {}; try { tl = JSON.parse(exp.parameters || '{}'); } catch {}
                      const ids = tl.linkedRefs || [];
                      if (!ids.includes(r.id)) ids.push(r.id);
                      tl.linkedRefs = ids;
                      tl.excludedRefs = (tl.excludedRefs || []).filter((eid: string) => eid !== r.id);
                      const pKey = 'biolab-proj-refs-' + exp.projectId;
                      const pl: string[] = JSON.parse(localStorage.getItem(pKey) || '[]');
                      if (!pl.includes(r.id)) { pl.push(r.id); localStorage.setItem(pKey, JSON.stringify(pl)); }
                      await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: JSON.stringify(tl), results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
                      await useStore.getState().loadAll();

                    } catch(e: any) { console.error(e); }
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f2', marginBottom: 3 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: '#d0d4dc' }}>{(() => { const p = r.coreConclusion?.split?.('|') || []; return [p[0], r.year, r.journal && !r.journal.includes(':') ? r.journal : ''].filter(Boolean).join(' · '); })()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {refLinkedMsg && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', padding: '10px 24px', borderRadius: 10, background: 'rgba(72,187,120,0.15)', border: '1px solid rgba(72,187,120,0.3)', color: '#48bb78', fontSize: 13, fontWeight: 600, zIndex: 999999, animation: 'fadeIn 0.3s ease', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          ✓ 已关联
        </div>
      )}
      

      {/* Edit reference modal */}

      {refCtxMenu2 && createPortal(
        <div style={{ position: 'fixed', left: Math.min(refCtxMenu2.x, window.innerWidth - 140), top: Math.min(refCtxMenu2.y, window.innerHeight - 90), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(183,148,244,0.12)'; ev.currentTarget.style.color = '#b794f4'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const ref = refCtxMenu2.ref; setRefCtxMenu2(null); if (ref.doi) setReadingPdf({ path: ref.doi, title: ref.title }); }}
          >打开</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const ref = refCtxMenu2.ref; setRefCtxMenu2(null); try { const { invoke: inv } = await import('@tauri-apps/api/core'); let tl: any = {}; try { tl = JSON.parse(exp!.parameters || '{}'); } catch {} tl.linkedRefs = (tl.linkedRefs || []).filter((id: string) => id !== ref.id); const ex = tl.excludedRefs || []; if (!ex.includes(ref.id)) ex.push(ref.id); tl.excludedRefs = ex; await inv('update_experiment', { id: exp!.id, title: exp!.title, type: exp!.type||'', date: exp!.date||'', purpose: exp!.purpose||'', materials: exp!.materials||'', steps: exp!.steps||'', parameters: JSON.stringify(tl), results: exp!.results||'', conclusion: exp!.conclusion||'', issues: exp!.issues||'', nextSteps: exp!.nextSteps||'', status: exp!.status||'进行中' }); await useStore.getState().loadAll(); } catch(e) { console.error(e); } }}
          >删除</div>
        </div>, document.body)}
      {stepEdit2 && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
          <div style={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24, minWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={(ev) => ev.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f2', marginBottom: 18 }}>{stepEdit2.mi === -1 ? '添加步骤' : '编辑步骤'}</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#8890a0', marginBottom: 6 }}>第几天</div>
              <input type="text" inputMode="numeric" value={stepEdit2.day} onChange={(ev) => setStepEdit2({ ...stepEdit2, day: ev.target.value.replace(/[^0-9]/g, '') })} onKeyDown={(ev) => { if (ev.key === 'Escape') setStepEdit2(null); }} style={{ width: '100%', padding: '8px 12px', background: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#f0f0f2', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#8890a0', marginBottom: 6 }}>步骤名称</div>
              <input type="text" value={stepEdit2.name} onChange={(ev) => setStepEdit2({ ...stepEdit2, name: ev.target.value })} onKeyDown={(ev) => { if (ev.key === 'Escape') setStepEdit2(null); }} autoFocus style={{ width: '100%', padding: '8px 12px', background: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#f0f0f2', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setStepEdit2(null)} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#d0d4dc', fontSize: 12, cursor: 'pointer' }}>取消</button>
              <button onClick={() => { const d = parseInt(stepEdit2.day); if (isNaN(d) || !stepEdit2.name.trim()) return; const newStep = { day: d, name: stepEdit2.name.trim(), detail: stepEdit2.detail || '' }; let ns; if (stepEdit2.mi === -1) { ns = [...stepsList, newStep]; } else { ns = stepsList.map((st: any, i: number) => i === stepEdit2.mi ? newStep : st); } ns.sort((a: any, b: any) => a.day - b.day); saveSteps(ns); setStepEdit2(null); }} style={{ padding: '7px 16px', background: '#7dd3fc', border: 'none', borderRadius: 6, color: '#0f0f12', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>保存</button>
            </div>
          </div>
        </div>, document.body)}
      {readingPdf && createPortal(<PDFReader filePath={readingPdf.path} title={readingPdf.title} onClose={() => setReadingPdf(null)} />, document.body)}
      {lightboxImg && createPortal(
        <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img src={lightboxImg.startsWith('data:') ? lightboxImg : 'asset://localhost/' + lightboxImg} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} alt="" />
            <div style={{ position: 'absolute', top: -36, right: 0, cursor: 'pointer', color: '#fff', fontSize: 24 }} onClick={() => setLightboxImg(null)}>✕</div>
          </div>
        </div>, document.body)}
    </div>
  );
}


// ═══ Experiments List ═══
function ExperimentsPage({ onAction }: { onAction: (t: string) => void }) {
  const { experiments, projects, references, navigateTo, deleteExperiment } = useStore();
  const [expCtxMenu, setExpCtxMenu] = useState<{x:number;y:number;exp:any}|null>(null);
  React.useEffect(() => { if (!expCtxMenu) return; const cl = () => setExpCtxMenu(null); const t = setTimeout(() => { window.addEventListener('click', cl); window.addEventListener('scroll', cl, true); }, 0); return () => { clearTimeout(t); window.removeEventListener('click', cl); window.removeEventListener('scroll', cl, true); }; }, [expCtxMenu]);
  const [sortKey, setSortKey] = useState<'title'|'date'|'project'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const types = [
    { key: '动物实验', icon: '🐭', color: '#7dd3fc', desc: '荷瘤/给药/药效评价' },
    { key: '细胞实验', icon: '🔬', color: '#48bb78', desc: '培养/转染/增殖/凋亡' },
    { key: '分子实验', icon: '🧬', color: '#ed8936', desc: 'PCR/克隆/基因编辑' },
    { key: '蛋白实验', icon: '🧪', color: '#d53f8c', desc: 'WB/Co-IP/质谱/ELISA' },
    { key: '免疫染色', icon: '🎨', color: '#b794f4', desc: 'IF/IHC/特殊染色' },
    { key: '流式检测', icon: '💧', color: '#63b3ed', desc: 'FACS/分选/细胞因子' },
    { key: '组学分析', icon: '📊', color: '#f6ad55', desc: 'RNA-seq/蛋白组/代谢组' },
    { key: '药学实验', icon: '💊', color: '#fc8181', desc: 'IC50/PK-PD/制剂' },
    { key: '病理实验', icon: '🔍', color: '#4fd1c5', desc: 'HE/TUNEL/病理评分' },
    { key: '生信分析', icon: '💻', color: '#d0d4dc', desc: 'GO/KEGG/生存分析' },
  ];

  const getExpType = (exp: any) => {
    const t = (exp.type || '').toLowerCase();
    for (const tp of types) {
      if (t.includes(tp.key.replace('实验','').replace('分析','').replace('检测','').replace('染色',''))) return tp.key;
    }
    return '其他';
  };

  const typeCounts: Record<string, number> = {};
  experiments.forEach((e: any) => {
    const t = getExpType(e);
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const filtered = experiments;

  const sorted = [...filtered].sort((a: any, b: any) => {
    const va = sortKey === 'title' ? a.title : sortKey === 'project' ? (projects.find((p: any) => p.id === a.projectId)?.name || '') : a.date;
    const vb = sortKey === 'title' ? b.title : sortKey === 'project' ? (projects.find((p: any) => p.id === b.projectId)?.name || '') : b.date;
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const toggleSort = (key: 'title'|'date'|'project') => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };
  const arrow = (key: string) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title">实验记录</div>
        <div style={{ padding: '6px 16px', borderRadius: 6, background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', color: '#7dd3fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => onAction('experiment')}>+ 新建实验</div>
      </div>



      {/* Table header */}
      {sorted.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid rgba(125,211,252,0.08)', marginBottom: 4 }}>
          <div style={{ flex: 3, fontSize: 12, fontWeight: 600, color: sortKey==='title'?'#7dd3fc':'#718096', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('title')}>实验标题{arrow('title')}</div>
          <div style={{ flex: 1.5, fontSize: 12, fontWeight: 600, color: sortKey==='date'?'#7dd3fc':'#718096', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('date')}>时间{arrow('date')}</div>
          <div style={{ flex: 2, fontSize: 12, fontWeight: 600, color: sortKey==='project'?'#7dd3fc':'#d0d4dc', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('project')}>所属课题{arrow('project')}</div>

        </div>
      )}

      {/* Experiment rows */}
      {sorted.map((e: any) => {
        const proj = projects.find((p: any) => p.id === e.projectId);
        return (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer',
            borderRadius: 6, transition: 'background 0.15s', borderBottom: '1px solid rgba(255,255,255,0.02)',
          }}
            onClick={() => navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId })}
            onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'}
            onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
            onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setExpCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e }); }}
          >
            <div style={{ flex: 3, fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
            <div style={{ flex: 1.5, fontSize: 12, color: '#d0d4dc' }}>{e.date}</div>
            <div style={{ flex: 2, fontSize: 12, color: '#90cdf4' }}>{proj?.name || '-'}</div>
          </div>
        );
      })}

      {expCtxMenu && createPortal(
        <div style={{ position: 'fixed', left: Math.min(expCtxMenu.x, window.innerWidth - 140), top: Math.min(expCtxMenu.y, window.innerHeight - 130), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const exp = expCtxMenu.exp; setExpCtxMenu(null); navigateTo('experimentDetail', { experimentId: exp.id, projectId: exp.projectId }); }}
          >详情</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { localStorage.setItem('biolab-edit-exp', JSON.stringify(expCtxMenu.exp)); onAction('experiment'); setExpCtxMenu(null); }}
          >编辑</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const exp = expCtxMenu.exp; setExpCtxMenu(null); if (await showConfirm('删除实验「' + exp.title + '」？')) { await deleteExperiment(exp.id); await useStore.getState().loadAll(); } }}
          >删除</div>
        </div>, document.body)}
      {experiments.length === 0 && (
        <div className="card" style={{ marginTop: 12, textAlign: 'center', padding: 30, cursor: 'pointer', transition: 'all 0.25s' }}
            onClick={() => onAction('experiment')}
            onMouseEnter={ev => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.4)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'; ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 8px 32px rgba(125,211,252,0.2), 0 0 60px rgba(125,211,252,0.08)'; }}
            onMouseLeave={ev => { ev.currentTarget.style.borderColor = ''; ev.currentTarget.style.background = ''; ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; }}
          >
          <FlaskConical size={28} color="#4a5568" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#d0d4dc', fontSize: 14, marginBottom: 4 }}>暂无实验</div>
          <div style={{ color: '#7dd3fc', fontSize: 13 }}>点击创建第一个实验</div>
        </div>
      )}
    </div>
  );
}


function LibraryPage({ onAction }: { onAction: (t: string) => void }) {
  const { references, projects, experiments, deleteReference, navigateTo } = useStore();


  const [search, setSearch] = useState('');
  const [readingPdf, setReadingPdf] = useState<{path: string; title: string} | null>(null);
  const [linkingRef, setLinkingRef] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('title');
  const [sortAsc, setSortAsc] = useState(true);
  const [contextMenu, setContextMenu] = useState<any>(null);
  const [editingRef, setEditingRef] = useState<any>(null);

  const filteredRaw = search ? references.filter((r: any) =>
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.authors?.toLowerCase().includes(search.toLowerCase())
  ) : references;

  const filtered = [...filteredRaw].sort((a: any, b: any) => {
    let va = '', vb = '';
    if (sortKey === 'title') { va = a.title || ''; vb = b.title || ''; }
    else if (sortKey === 'firstAuthor') { va = (a.coreConclusion?.split?.('|') || [])[0] || ''; vb = (b.coreConclusion?.split?.('|') || [])[0] || ''; }
    else if (sortKey === 'corrAuthor') { va = (a.coreConclusion?.split?.('|') || [])[1] || ''; vb = (b.coreConclusion?.split?.('|') || [])[1] || ''; }
    else if (sortKey === 'year') { va = String(a.year || 0); vb = String(b.year || 0); }
    else if (sortKey === 'journal') { const ja = a.journal || ''; const jb = b.journal || ''; va = ja.includes(':') ? '' : ja; vb = jb.includes(':') ? '' : jb; }
    else if (sortKey === 'id') { va = a.relation || a.id || ''; vb = b.relation || b.id || ''; }
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const toggleSort = (key: string) => { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(true); } };
  const arrow = (key: string) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  const getLink = (ref: any) => {
    if (!ref.journal || !ref.journal.includes(':')) return null;
    const [type, id] = ref.journal.split(':');
    if (type === 'project') { const p = projects.find((p: any) => p.id === id); return p ? { type: '课题', name: p.name, id } : null; }
    if (type === 'experiment') { const e = experiments.find((e: any) => e.id === id); return e ? { type: '实验', name: e.title, id } : null; }
    return null;
  };


  const updateRefField = async (ref: any, field: string, value: string) => {
    try {
      const { invoke: inv } = await import('@tauri-apps/api/core');
      const parts = ref.coreConclusion?.split?.('|') || ['', ''];
      let title = ref.title, cc = ref.coreConclusion || '', yr = ref.year || 0, jnl = ref.journal || '';
      if (field === 'title') title = value;
      else if (field === 'firstAuthor') { parts[0] = value; cc = parts.join('|'); }
      else if (field === 'corrAuthor') { parts[1] = value; cc = parts.join('|'); }
      else if (field === 'year') yr = parseInt(value) || 0;
      else if (field === 'journal') jnl = value;
      await inv('update_reference', { id: ref.id, title, doi: ref.doi||'', authors: ref.authors||'', year: yr, journal: jnl, coreConclusion: cc, relation: ref.relation||'', notes: ref.notes||'', projectId: ref.projectId||'' });
      await useStore.getState().loadAll();
    } catch(e) { console.error(e); }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="page-title">文献</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ width: 200, padding: '6px 12px', fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文献..." />
          <div style={{ padding: '6px 16px', borderRadius: 6, background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', color: '#7dd3fc', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => onAction('reference')}
            onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.2)'; ev.currentTarget.style.transform = 'translateY(-1px)'; ev.currentTarget.style.boxShadow = '0 2px 8px rgba(125,211,252,0.15)'; }}
            onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.1)'; ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; }}
          >添加</div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30, cursor: 'pointer', transition: 'all 0.25s' }}
            onClick={() => onAction('reference')}
            onMouseEnter={ev => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.4)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'; ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 8px 32px rgba(125,211,252,0.2), 0 0 60px rgba(125,211,252,0.08)'; }}
            onMouseLeave={ev => { ev.currentTarget.style.borderColor = ''; ev.currentTarget.style.background = ''; ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; }}
          >
          <FlaskConical size={28} color="#4a5568" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#d0d4dc', fontSize: 14, marginBottom: 4 }}>暂无文献</div>
          <div style={{ color: '#7dd3fc', fontSize: 13 }}>点击添加第一篇文献</div>
        </div>
      )}

      {/* Table header */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid rgba(125,211,252,0.08)', marginBottom: 4 }}>
          <div style={{ flex: 3, fontSize: 12, fontWeight: 600, color: sortKey === 'title' ? '#7dd3fc' : '#d0d4dc', cursor: 'pointer' }} onClick={() => toggleSort('title')}>标题{arrow('title')}</div>
          <div style={{ flex: 1.2, fontSize: 12, fontWeight: 600, color: sortKey === 'firstAuthor' ? '#7dd3fc' : '#d0d4dc', cursor: 'pointer' }} onClick={() => toggleSort('firstAuthor')}>第一作者{arrow('firstAuthor')}</div>
          <div style={{ flex: 1.2, fontSize: 12, fontWeight: 600, color: sortKey === 'corrAuthor' ? '#7dd3fc' : '#d0d4dc', cursor: 'pointer' }} onClick={() => toggleSort('corrAuthor')}>通讯作者{arrow('corrAuthor')}</div>
          <div style={{ flex: 0.8, fontSize: 12, fontWeight: 600, color: sortKey === 'year' ? '#7dd3fc' : '#d0d4dc', cursor: 'pointer' }} onClick={() => toggleSort('year')}>出版时间{arrow('year')}</div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: sortKey === 'journal' ? '#7dd3fc' : '#d0d4dc', cursor: 'pointer' }} onClick={() => toggleSort('journal')}>出版期刊{arrow('journal')}</div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: sortKey === 'id' ? '#7dd3fc' : '#d0d4dc', cursor: 'pointer' }} onClick={() => toggleSort('id')}>导入时间{arrow('id')}</div>

        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((ref: any) => {
          const tagList = ref.authors ? ref.authors.split(',').filter(Boolean) : [];
          const link = getLink(ref);
          const hasPdf = ref.doi && ref.doi.startsWith('/');
          return (
            <div key={ref.id} style={{
              display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: hasPdf ? 'pointer' : 'default',
              borderRadius: 6, transition: 'background 0.15s', borderBottom: '1px solid rgba(255,255,255,0.02)',
            }}
              onDoubleClick={() => hasPdf && setReadingPdf({ path: ref.doi, title: ref.title })}
              onContextMenu={(ev: any) => { ev.preventDefault(); ev.stopPropagation(); setContextMenu({ x: ev.clientX, y: ev.clientY, ref }); }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
            >
              <div style={{ flex: 3, fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{ref.title}</div>
              <div style={{ flex: 1.2, fontSize: 12, color: '#d0d4dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(() => { const parts = ref.coreConclusion?.split?.('|') || []; return parts[0] || '-'; })()}</div>
              <div style={{ flex: 1.2, fontSize: 12, color: '#d0d4dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(() => { const parts = ref.coreConclusion?.split?.('|') || []; return parts[1] || '-'; })()}</div>
              <div style={{ flex: 0.8, fontSize: 12, color: '#d0d4dc' }}>{ref.year || '-'}</div>
              <div style={{ flex: 1, fontSize: 12, color: '#90cdf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(() => { const j = ref.journal || ''; return j.includes(':') ? '-' : (j || '-'); })()}</div>
              <div style={{ flex: 1, fontSize: 12, color: '#d0d4dc' }}>{ref.relation || '-'}</div>
</div>

          );
        })}
      </div>


      {/* Context menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setContextMenu(null)}>
          <div style={{ position: 'absolute', left: contextMenu.x, top: contextMenu.y, background: '#1a1f2e', border: '1px solid rgba(125,211,252,0.12)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '8px 14px', fontSize: 13, color: '#d0d4dc', cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s' }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(183,148,244,0.1)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
              onClick={() => { const ref = contextMenu.ref; setContextMenu(null); if (ref.doi) setReadingPdf({ path: ref.doi, title: ref.title }); }}
            >打开</div>
            <div style={{ padding: '8px 14px', fontSize: 13, color: '#d0d4dc', cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s' }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
              onClick={() => { setEditingRef({ ...contextMenu.ref, _firstAuthor: (contextMenu.ref.coreConclusion?.split?.('|') || [])[0] || '', _corrAuthor: (contextMenu.ref.coreConclusion?.split?.('|') || [])[1] || '', _journal: contextMenu.ref.journal?.includes?.(':') ? '' : (contextMenu.ref.journal || ''), _year: String(contextMenu.ref.year || '') }); setContextMenu(null); }}
            >编辑</div>
            <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s' }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(252,129,129,0.06)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
              onClick={() => { deleteReference(contextMenu.ref.id); setContextMenu(null); }}
            >删除</div>
          </div>
        </div>
      )}

      {/* Edit reference modal */}
      {editingRef && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={() => setEditingRef(null)}>
          <div style={{ background: '#1a1f2e', border: '1px solid rgba(125,211,252,0.15)', borderRadius: 14, padding: '24px 28px', width: '90vw', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f2' }}>编辑文献</span>
              <X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={() => setEditingRef(null)} />
            </div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>标题</label><input className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={editingRef.title} onChange={e => setEditingRef({...editingRef, title: e.target.value})} /></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>第一作者</label><input className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={editingRef._firstAuthor} onChange={e => setEditingRef({...editingRef, _firstAuthor: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>通讯作者</label><input className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={editingRef._corrAuthor} onChange={e => setEditingRef({...editingRef, _corrAuthor: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 0.6 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>出版时间</label><input className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={editingRef._year} onChange={e => setEditingRef({...editingRef, _year: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>出版期刊</label><input className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={editingRef._journal} onChange={e => setEditingRef({...editingRef, _journal: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, color: '#d0d4dc', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }} onClick={() => setEditingRef(null)}>取消</div>
              <div style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, color: '#7dd3fc', cursor: 'pointer', background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', fontWeight: 600 }} onClick={async () => {
                await updateRefField(editingRef, 'title', editingRef.title);
                const cc = [editingRef._firstAuthor, editingRef._corrAuthor].filter(Boolean).join('|');
                try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_reference', { id: editingRef.id, title: editingRef.title, doi: editingRef.doi||'', authors: editingRef.authors||'', year: parseInt(editingRef._year)||0, journal: editingRef._journal || editingRef.journal || '', coreConclusion: cc, relation: editingRef.relation||'', notes: editingRef.notes||'', projectId: editingRef.projectId||'' }); await useStore.getState().loadAll(); } catch(e) { console.error(e); }
                setEditingRef(null);
              }}>保存</div>
            </div>
          </div>
        </div>,
      document.body)}

      {readingPdf && createPortal(<PDFReader filePath={readingPdf.path} title={readingPdf.title} onClose={() => setReadingPdf(null)} />, document.body)}
    </div>
  );
}

function TemplatesPage({ onSelectTemplate }: { onSelectTemplate: (t: any) => void }) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const categories = [
    { key: '动物实验', icon: '🐭', methods: ['皮下荷瘤模型', '原位荷瘤模型', '药效评价(肿瘤)', 'PK/PD药代动力学', '毒理学评价', '给药方案执行', '活体成像(IVIS)', '生存期观察', '组织取材', '体重监测'] },
    { key: '细胞实验', icon: '🔬', methods: ['细胞培养与传代', '细胞转染/转导', 'CCK-8增殖检测', 'MTT增殖检测', '细胞凋亡检测', '细胞周期分析', 'Transwell迁移', 'Transwell侵袭', '克隆形成实验', '慢病毒包装', '腺病毒包装', '细胞划痕实验'] },
    { key: '分子实验', icon: '🧬', methods: ['PCR', 'qPCR/RT-qPCR', '基因克隆', '质粒构建', 'CRISPR基因编辑', 'RNA提取', '逆转录(cDNA)', '核酸电泳', 'Southern blot', 'Northern blot', '基因测序'] },
    { key: '蛋白实验', icon: '🧪', methods: ['Western blot', '免疫共沉淀(Co-IP)', '蛋白纯化', 'SDS-PAGE电泳', 'ELISA', '质谱分析', 'Pull-down', '蛋白定量(BCA/Bradford)', '2D电泳'] },
    { key: '免疫染色', icon: '🎨', methods: ['免疫荧光(IF)', '免疫组化(IHC)', 'HE染色', 'Masson染色', 'PAS染色', '油红O染色', 'TUNEL凋亡检测', '多重免疫荧光', '原位杂交(ISH/FISH)'] },
    { key: '流式检测', icon: '💧', methods: ['表面标记检测', '胞内因子染色', '细胞分选(FACS)', '凋亡检测(Annexin V)', '细胞周期(PI)', 'CFSE增殖检测', 'ELISPOT', '多色流式Panel设计', 'CBA细胞因子检测'] },
    { key: '组学分析', icon: '📊', methods: ['转录组测序(RNA-seq)', '单细胞测序(scRNA-seq)', '蛋白组学(TMT)', '蛋白组学(Label-free)', '代谢组学', 'ATAC-seq', 'ChIP-seq', '空间转录组', '全外显子测序(WES)', '16S菌群测序'] },
    { key: '药学实验', icon: '💊', methods: ['IC50药物筛选', '药物联合指数(CI)', '药代动力学(ADME)', '制剂稳定性测试', '纳米粒制备', '脂质体制备', '药物释放曲线', '溶血实验', '药物溶解度测定'] },
    { key: '病理实验', icon: '🔍', methods: ['组织切片制备', '石蜡包埋', '冰冻切片', 'HE染色', '特殊染色', '病理评分', '组织芯片(TMA)', '透射电镜(TEM)', '扫描电镜(SEM)'] },
    { key: '生信分析', icon: '💻', methods: ['差异基因分析(DEG)', 'GO富集分析', 'KEGG通路分析', 'GSEA分析', '生存分析(K-M)', '免疫浸润分析', 'WGCNA分析', '突变分析', '分子对接', 'PPI蛋白互作网络', '单细胞分析(Seurat)'] },
  ];

  const [userTemplates, setUserTemplates] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('biolab-user-templates') || '[]'); } catch { return []; }
  });
  const [tplCtxMenu, setTplCtxMenu] = useState<{x:number;y:number;tpl:any}|null>(null);
  const [tplSearch, setTplSearch] = useState('');
  React.useEffect(() => { if (!tplCtxMenu) return; const cl = () => setTplCtxMenu(null); const t = setTimeout(() => { window.addEventListener('click', cl); window.addEventListener('scroll', cl, true); }, 0); return () => { clearTimeout(t); window.removeEventListener('click', cl); window.removeEventListener('scroll', cl, true); }; }, [tplCtxMenu]);

  const deleteTemplate = (id: string) => {
    const updated = userTemplates.filter((t: any) => t.id !== id);
    setUserTemplates(updated);
    localStorage.setItem('biolab-user-templates', JSON.stringify(updated));
  };


  // ── Sub-page: category detail ──
  if (selectedCat) {
    const cat = categories.find(c => c.key === selectedCat)!;
    return (
      <div className="page-container">
        {/* Back header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }} onClick={() => setSelectedCat(null)}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.15)', transition: 'all 0.2s',
          }}
            onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.15)'; }}
            onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.08)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f2', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{cat.icon}</span> {cat.key}
            </div>
            <div style={{ fontSize: 12, color: '#d0d4dc' }}>{cat.methods.length} 种实验方法</div>
          </div>
        </div>

        {/* Methods grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {cat.methods.map((m, mi) => (
            <div key={mi} style={{
              padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 0.2s',
            }}
              onMouseEnter={ev => {
                ev.currentTarget.style.background = 'rgba(125,211,252,0.06)';
                ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.2)';
                ev.currentTarget.style.boxShadow = '0 0 20px rgba(125,211,252,0.08)';
                ev.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={ev => {
                ev.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                ev.currentTarget.style.boxShadow = 'none';
                ev.currentTarget.style.transform = 'translateX(0)';
              }}
              onClick={() => onSelectTemplate({ id: cat.key + '-' + mi, name: m, fields: { type: cat.key } })}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: '#e0e0e5' }}>{m}</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}><path d="M6 4l4 4-4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main grid view ──
  return (
    <div className="page-container">
      <div style={{ marginBottom: 20 }}><div className="page-title">方法</div></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 28 }}>
        {categories.map((cat, ci) => (
          <div key={cat.key} onClick={() => setSelectedCat(cat.key)} style={{
            borderRadius: 14, padding: '20px 8px 16px', textAlign: 'center', cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            transition: 'all 0.35s ease', position: 'relative', overflow: 'hidden',
          }}
            onMouseEnter={ev => {
              ev.currentTarget.style.background = 'rgba(125,211,252,0.06)';
              ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.4)';
              ev.currentTarget.style.boxShadow = '0 0 30px rgba(125,211,252,0.12), inset 0 0 30px rgba(125,211,252,0.03)';
              ev.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
            }}
            onMouseLeave={ev => {
              ev.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              ev.currentTarget.style.boxShadow = 'none';
              ev.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8, filter: 'saturate(0.85)', transition: 'transform 0.3s' }}>{cat.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e5', marginBottom: 3 }}>{cat.key}</div>
            <div style={{ fontSize: 11, color: '#d0d4dc' }}>{cat.methods.length} 种方法</div>
          </div>
        ))}
      </div>

      {/* Literature templates */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7dd3fc', letterSpacing: '-0.02em' }}>模板</div>
          <div style={{ position: 'relative', flex: '0 1 280px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0d4dc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" value={tplSearch} onChange={e => setTplSearch(e.target.value)} placeholder="搜索模板"
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border 0.2s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(125,211,252,0.35)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
        </div>
        {userTemplates.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#d0d4dc', fontSize: 13 }}>
            暂无模板 · 在新建实验时点击「存为模板」即可添加
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {userTemplates.filter((lt: any) => !tplSearch || lt.name?.toLowerCase().includes(tplSearch.toLowerCase()) || lt.desc?.toLowerCase().includes(tplSearch.toLowerCase())).map((lt: any) => (
              <div key={lt.id} className="tpl-row" style={{
                borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.25s', display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
              }}
                onMouseEnter={ev => {
                  ev.currentTarget.style.background = 'rgba(125,211,252,0.05)';
                  ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.18)';
                  ev.currentTarget.style.boxShadow = '0 0 20px rgba(125,211,252,0.06)';
                  const del = ev.currentTarget.querySelector('.tpl-del') as HTMLElement;
                  if (del) del.style.opacity = '1';
                }}
                onMouseLeave={ev => {
                  ev.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  ev.currentTarget.style.boxShadow = 'none';
                  const del = ev.currentTarget.querySelector('.tpl-del') as HTMLElement;
                  if (del) del.style.opacity = '0';
                }}
                onClick={() => onSelectTemplate({ id: lt.id, name: lt.name, fields: { type: lt.cat }, steps: lt.steps })}
                onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setTplCtxMenu({ x: ev.clientX, y: ev.clientY, tpl: lt }); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#d0d0d5' }}>{lt.name}</div>
                  <div style={{ fontSize: 10, color: '#8890a0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lt.desc}</div>
                </div>
                <div style={{ fontSize: 11, color: '#7dd3fc', background: 'rgba(125,211,252,0.08)', padding: '3px 10px', borderRadius: 8, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {lt.steps?.length || 0} 步骤
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {tplCtxMenu && createPortal(
        <div style={{ position: 'fixed', left: Math.min(tplCtxMenu.x, window.innerWidth - 140), top: Math.min(tplCtxMenu.y, window.innerHeight - 130), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const lt = tplCtxMenu.tpl; setTplCtxMenu(null); onSelectTemplate({ id: lt.id, name: lt.name, fields: { type: lt.cat }, steps: lt.steps }); }}
          >编辑</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const lt = tplCtxMenu.tpl; setTplCtxMenu(null); if (await showConfirm('删除模板「' + lt.name + '」？')) deleteTemplate(lt.id); }}
          >删除</div>
        </div>, document.body)}
    </div>
  );
}




function SettingsPage({ bgEnabled, setBgEnabled }: { bgEnabled: boolean; setBgEnabled: (v: boolean) => void }) {
  const { currentUser } = useStore();
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ old: '', new1: '', new2: '' });
  const [showPwOld, setShowPwOld] = useState(false);
  const [showPwNew1, setShowPwNew1] = useState(false);
  const [showPwNew2, setShowPwNew2] = useState(false);
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
      setShowPw(false); setPwForm({ old: '', new1: '', new2: '' }); setPwMsg(''); setTimeout(() => { setShowPw(false); setPwMsg(''); }, 1200);
    } catch (e: any) { setPwMsg('修改失败: ' + e); }
    finally { setPwLoading(false); }
  };

  if (showPw) {
    return (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={() => setShowPw(false)}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(125,211,252,0.15)', borderRadius: 14, padding: '24px 28px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f2' }}>修改密码</span>
          <X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={() => setShowPw(false)} />
        </div>
        <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>当前密码</label><div style={{ position: 'relative' }}><input type={showPwOld ? 'text' : 'password'} className="form-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }} value={pwForm.old} onChange={e => setPwForm(p => ({...p, old: e.target.value}))} /><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#d0d4dc', fontSize: 14, userSelect: 'none', transition: 'color 0.2s' }} onMouseEnter={ev => ev.currentTarget.style.color = '#7dd3fc'} onMouseLeave={ev => ev.currentTarget.style.color = '#d0d4dc'} onClick={() => setShowPwOld(!showPwOld)}>{showPwOld ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></>}</span></div></div>
        <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>新密码</label><div style={{ position: 'relative' }}><input type={showPwNew1 ? 'text' : 'password'} className="form-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }} value={pwForm.new1} onChange={e => setPwForm(p => ({...p, new1: e.target.value}))} /><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#d0d4dc', fontSize: 14, userSelect: 'none', transition: 'color 0.2s' }} onMouseEnter={ev => ev.currentTarget.style.color = '#7dd3fc'} onMouseLeave={ev => ev.currentTarget.style.color = '#d0d4dc'} onClick={() => setShowPwNew1(!showPwNew1)}>{showPwNew1 ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></>}</span></div></div>
        <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>确认新密码</label><div style={{ position: 'relative' }}><input type={showPwNew2 ? 'text' : 'password'} className="form-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }} value={pwForm.new2} onChange={e => setPwForm(p => ({...p, new2: e.target.value}))} onKeyDown={e => e.key === 'Enter' && changePassword()} /><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#d0d4dc', fontSize: 14, userSelect: 'none', transition: 'color 0.2s' }} onMouseEnter={ev => ev.currentTarget.style.color = '#7dd3fc'} onMouseLeave={ev => ev.currentTarget.style.color = '#d0d4dc'} onClick={() => setShowPwNew2(!showPwNew2)}>{showPwNew2 ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></>}</span></div></div>
        {pwMsg && <div style={{ fontSize: 13, marginBottom: 12, padding: '8px 14px', borderRadius: 8, textAlign: 'center', background: pwMsg.includes('成功') ? 'rgba(72,187,120,0.1)' : 'rgba(252,129,129,0.06)', border: '1px solid ' + (pwMsg.includes('成功') ? 'rgba(72,187,120,0.2)' : 'rgba(252,129,129,0.15)'), color: pwMsg.includes('成功') ? '#48bb78' : '#fc8181', fontWeight: 500 }}>{pwMsg.includes('成功') ? '✓ ' : ''}{pwMsg}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <div style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, color: '#d0d4dc', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s' }} onClick={() => { setShowPw(false); setPwMsg(''); setPwForm({ old: '', new1: '', new2: '' }); }}>取消</div>
          <div style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, color: '#7dd3fc', cursor: 'pointer', background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', fontWeight: 600, transition: 'all 0.2s' }} onClick={changePassword}>{pwLoading ? '修改中...' : '确认修改'}</div>
        </div>
      </div>
    </div>);
  }

  return (<div className="page-container">
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <span style={{ cursor: 'pointer', color: '#90cdf4', fontSize: 18 }} onClick={() => useStore.getState().navigateTo('dashboard' as any)}>←</span>
      <div className="page-title">设置</div>
    </div>
    <div className="settings-list">
      <div className="settings-row" onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const file = inp.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const url = reader.result as string; localStorage.setItem('biolab-avatar', url); window.location.reload(); }; reader.readAsDataURL(file); }; inp.click(); }}>
        <div><div className="settings-label">更换头像</div></div>
        <span style={{ color: '#d0d4dc', fontSize: 18 }}>›</span>
      </div>
      <div className="settings-row" onClick={() => { const nv = !bgEnabled; setBgEnabled(nv); localStorage.setItem('biolab-bg', nv ? 'on' : 'off'); }}>
        <div><div className="settings-label">动态背景</div></div>
        <div style={{ width: 44, height: 24, borderRadius: 12, background: bgEnabled ? '#63b3ed' : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'background 0.3s', flexShrink: 0 }}><div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: bgEnabled ? 22 : 2, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} /></div>
      </div>
      <div className="settings-row" onClick={() => setShowPw(true)}>
        <div><div className="settings-label">修改密码</div></div>
        <span style={{ color: '#d0d4dc', fontSize: 18 }}>›</span>
      </div>
      <div className="settings-row" onClick={() => (window as any).__openApiKeySettings?.('deepseek')}>
        <div><div className="settings-label">DeepSeek API 密钥</div><div className="settings-desc">AI 解析实验步骤所需</div></div>
        <span style={{ color: '#d0d4dc', fontSize: 18 }}>›</span>
      </div>

      <div className="settings-row">
        <div><div className="settings-label">关于</div><div className="settings-desc">Lab Data System v0.5.1</div></div>
        <span style={{ color: '#d0d4dc', fontSize: 18 }}>›</span>
      </div>
      <div className="settings-row" onClick={async () => {
        if (!await showConfirm('确定要注销账号「' + currentUser + '」吗？\n\n此操作将删除该账号及其所有数据，且不可恢复！')) return;
        const pw = await showPrompt('请输入密码确认注销');
        if (!pw) return;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('login_user', { username: currentUser, password: pw });
          await invoke('delete_user', { username: currentUser });
          useStore.getState().logout();
        } catch(e: any) { await showAlert('注销失败: ' + e); }
      }}>
        <div><div className="settings-label">注销账号</div></div>
        <span style={{ color: '#d0d4dc', fontSize: 18 }}>›</span>
      </div>
    </div>
  </div>);
}


function ApiKeySettings() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState('deepseek');
  const [keyVal, setKeyVal] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    (window as any).__openApiKeySettings = (p?: string) => {
      setProvider(p || 'deepseek');
      setTestResult(null);
      setTestMsg('');
      setShow(false);
      (async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const existing: string | null = await invoke('get_api_key', { provider: p || 'deepseek' });
          if (existing && existing.trim()) {
            setHasKey(true);
            setKeyVal('sk-' + '•'.repeat(Math.max(0, existing.length - 6)) + existing.slice(-3));
          } else {
            setHasKey(false);
            setKeyVal('');
          }
        } catch { setHasKey(false); setKeyVal(''); }
        setOpen(true);
      })();
    };
    return () => { delete (window as any).__openApiKeySettings; };
  }, []);

  const save = async () => {
    if (!keyVal.trim() || keyVal.includes('•')) { await showAlert('请输入完整的 API 密钥'); return; }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('store_api_key', { provider, apiKey: keyVal.trim() });
      setHasKey(true);
      setTestResult(null);
      await showAlert('保存成功');
    } catch (e: any) { await showAlert('保存失败: ' + e); }
  };

  const testConn = async () => {
    if (!keyVal.trim() || keyVal.includes('•')) { await showAlert('请先输入密钥'); return; }
    setTesting(true); setTestResult(null); setTestMsg('');
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + keyVal.trim() },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      });
      if (r.ok) { setTestResult('ok'); setTestMsg('连接成功,密钥有效'); }
      else {
        const t = await r.text();
        setTestResult('fail');
        setTestMsg(`错误 ${r.status}: ${t.slice(0, 120)}`);
      }
    } catch (e: any) { setTestResult('fail'); setTestMsg('网络错误: ' + e.message); }
    setTesting(false);
  };

  const clearKey = async () => {
    if (!await showConfirm('确定删除已保存的密钥?')) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('store_api_key', { provider, apiKey: '' });
      setHasKey(false); setKeyVal(''); setTestResult(null);
      await showAlert('已删除');
    } catch (e: any) { await showAlert('删除失败: ' + e); }
  };

  if (!open) return null;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1f', border: '1px solid rgba(125,211,252,0.2)', borderRadius: 14, padding: 24, width: 480, maxWidth: '90vw', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#f0f0f2', marginBottom: 6 }}>AI 服务密钥</div>
        <div style={{ fontSize: 12, color: '#8890a0', marginBottom: 18, lineHeight: 1.6 }}>
          AI 解析功能由 DeepSeek 提供。请在 <span style={{ color: '#7dd3fc', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { try { (window as any).__TAURI__?.shell?.open?.('https://platform.deepseek.com/api_keys'); } catch {} }}>platform.deepseek.com</span> 申请 API Key 后填入此处。<br/>
          密钥仅保存在本机钥匙串中,不会上传到任何服务器。
        </div>

        <div style={{ fontSize: 12, color: '#a0a0a8', marginBottom: 6 }}>DeepSeek API Key {hasKey && <span style={{ color: '#48bb78', marginLeft: 8 }}>● 已保存</span>}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type={show ? 'text' : 'password'}
            value={keyVal}
            onChange={e => { setKeyVal(e.target.value); setTestResult(null); }}
            onFocus={() => { if (keyVal.includes('•')) setKeyVal(''); }}
            placeholder="sk-xxxxxxxxxxxxxxxx"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#222225', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
          />
          <button onClick={() => setShow(!show)} style={{ padding: '0 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#a0a0a8', cursor: 'pointer', fontSize: 12 }}>{show ? '隐藏' : '显示'}</button>
        </div>

        {testResult && (
          <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12, background: testResult === 'ok' ? 'rgba(72,187,120,0.1)' : 'rgba(252,129,129,0.1)', color: testResult === 'ok' ? '#48bb78' : '#fc8181', border: `1px solid ${testResult === 'ok' ? 'rgba(72,187,120,0.3)' : 'rgba(252,129,129,0.3)'}` }}>
            {testMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasKey && <button onClick={clearKey} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(252,129,129,0.3)', color: '#fc8181', cursor: 'pointer', fontSize: 12 }}>删除</button>}
            <button onClick={testConn} disabled={testing} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(125,211,252,0.3)', color: '#7dd3fc', cursor: testing ? 'default' : 'pointer', fontSize: 12, opacity: testing ? 0.5 : 1 }}>{testing ? '测试中...' : '测试连接'}</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setOpen(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#d0d4dc', cursor: 'pointer', fontSize: 12 }}>取消</button>
            <button onClick={save} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(125,211,252,0.15)', border: '1px solid rgba(125,211,252,0.4)', color: '#7dd3fc', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>保存</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


function UserMenu({ onLogout, userName, avatarUrl, bgEnabled, setBgEnabled }: { onLogout: () => void; userName: string; avatarUrl?: string; bgEnabled: boolean; setBgEnabled: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ old: '', new1: '', new2: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showPwOld, setShowPwOld] = useState(false);
  const [showPwNew1, setShowPwNew1] = useState(false);
  const [showPwNew2, setShowPwNew2] = useState(false);
  const { currentUser } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const changePassword = async () => {
    if (!pwForm.old || !pwForm.new1) { setPwMsg('请填写所有字段'); return; }
    if (pwForm.new1 !== pwForm.new2) { setPwMsg('两次密码不一致'); return; }
    if (pwForm.new1.length < 4) { setPwMsg('新密码至少4位'); return; }
    setPwLoading(true); setPwMsg('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('change_password', { username: currentUser, oldPassword: pwForm.old, newPassword: pwForm.new1 });
      setShowPwModal(false); setPwForm({ old: '', new1: '', new2: '' }); setPwMsg('');
    } catch (e: any) { setPwMsg('修改失败: ' + e); }
    finally { setPwLoading(false); }
  };

  const eyeIcon = (show: boolean) => show
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

  return (
    <>
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="topbar-user" onClick={() => setOpen(!open)}>
        {avatarUrl ? <img src={avatarUrl} className="avatar-img" alt="" /> : <div className="avatar">{userName?.[0]?.toUpperCase() || "?"}</div>}
      </div>
      {open && <div className="user-dropdown">
        <div className="user-dropdown-item" onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const file = inp.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const url = reader.result as string; localStorage.setItem('biolab-avatar', url); window.location.reload(); }; reader.readAsDataURL(file); }; inp.click(); setOpen(false); }}>更换头像</div>
        <div className="user-dropdown-item" onClick={() => { const nv = !bgEnabled; setBgEnabled(nv); localStorage.setItem('biolab-bg', nv ? 'on' : 'off'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>动态背景</span><div style={{ width: 32, height: 18, borderRadius: 9, background: bgEnabled ? '#7dd3fc' : '#3a3a40', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}><div style={{ position: 'absolute', top: 2, left: bgEnabled ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} /></div></div>
        <div className="user-dropdown-item" onClick={() => { setShowPwModal(true); setOpen(false); }}>修改密码</div>
        <div className="user-dropdown-item" onClick={() => { (window as any).__openApiKeySettings?.('deepseek'); setOpen(false); }}>AI 密钥</div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 6px' }} />
        <div className="user-dropdown-item" onClick={async () => { if (await showConfirm('退出登录？')) { onLogout(); setOpen(false); } }}>退出登录</div>
        <div className="user-dropdown-item" onClick={async () => {
          if (!await showConfirm('确定要注销账号「' + currentUser + '」吗？\n\n此操作将删除该账号，且不可恢复！')) return;
          const pw = await showPrompt('请输入密码确认注销');
          if (!pw) return;
          try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('login_user', { username: currentUser, password: pw }); await invoke('delete_user', { username: currentUser }); useStore.getState().logout(); } catch(e: any) { await showAlert('注销失败: ' + e); }
          setOpen(false);
        }}>注销账号</div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 6px' }} />
        <div style={{ padding: '6px 14px', fontSize: 11, color: '#606068' }}>v0.5.1</div>
      </div>}

    </div>
      {showPwModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={() => { setShowPwModal(false); setPwMsg(''); setPwForm({ old: '', new1: '', new2: '' }); }}>
          <div style={{ background: '#1a1f2e', border: '1px solid rgba(125,211,252,0.15)', borderRadius: 14, padding: '24px 28px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f2' }}>修改密码</span>
              <X size={16} style={{ cursor: 'pointer', color: '#d0d4dc' }} onClick={() => { setShowPwModal(false); setPwMsg(''); setPwForm({ old: '', new1: '', new2: '' }); }} />
            </div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>当前密码</label><div style={{ position: 'relative' }}><input type={showPwOld ? 'text' : 'password'} className="form-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }} value={pwForm.old} onChange={e => setPwForm(p => ({...p, old: e.target.value}))} /><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#d0d4dc', display: 'flex' }} onClick={() => setShowPwOld(!showPwOld)}>{eyeIcon(showPwOld)}</span></div></div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>新密码</label><div style={{ position: 'relative' }}><input type={showPwNew1 ? 'text' : 'password'} className="form-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }} value={pwForm.new1} onChange={e => setPwForm(p => ({...p, new1: e.target.value}))} /><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#d0d4dc', display: 'flex' }} onClick={() => setShowPwNew1(!showPwNew1)}>{eyeIcon(showPwNew1)}</span></div></div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: '#90cdf4', fontWeight: 600, display: 'block', marginBottom: 6 }}>确认新密码</label><div style={{ position: 'relative' }}><input type={showPwNew2 ? 'text' : 'password'} className="form-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }} value={pwForm.new2} onChange={e => setPwForm(p => ({...p, new2: e.target.value}))} onKeyDown={e => e.key === 'Enter' && changePassword()} /><span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#d0d4dc', display: 'flex' }} onClick={() => setShowPwNew2(!showPwNew2)}>{eyeIcon(showPwNew2)}</span></div></div>
            {pwMsg && <div style={{ fontSize: 12, marginBottom: 12, color: '#fc8181' }}>{pwMsg}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, color: '#d0d4dc', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }} onClick={() => { setShowPwModal(false); setPwMsg(''); setPwForm({ old: '', new1: '', new2: '' }); }}>取消</div>
              <div style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, color: '#7dd3fc', cursor: 'pointer', background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', fontWeight: 600 }} onClick={changePassword}>{pwLoading ? '修改中...' : '确认修改'}</div>
            </div>
          </div>
        </div>,
      document.body)}
    </>
  );
}

export default function App() {
  const { currentView, searchOpen, setSearchOpen, navigateTo, selectedProjectId, logout, currentUser, projects, experiments } = useStore();
  const [bgEnabled, setBgEnabled] = useState(() => localStorage.getItem("biolab-bg") !== "off");
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem("biolab-avatar") || "");
  const [showNewProject, setShowNewProject] = useState(false);
  const [showTemplateChooser, setShowTemplateChooser] = useState(false);
  const [showNewExperiment, setShowNewExperiment] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showNewReference, setShowNewReference] = useState(false);
  const [slideDir, setSlideDir] = useState<'left'|'right'|'none'>('none');
  const prevViewRef = useRef(currentView);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); const keys = navTabs.map(t => t.key); const ci = keys.indexOf(useStore.getState().currentView); if (ci > 0) navigateTo(keys[ci-1] as any); }
      if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); const keys = navTabs.map(t => t.key); const ci = keys.indexOf(useStore.getState().currentView); if (ci >= 0 && ci < keys.length - 1) navigateTo(keys[ci+1] as any); }
      if (e.key === 'Escape') { setSearchOpen(false); useStore.getState().setSearchQuery(''); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [setSearchOpen]);

  // Track slide direction based on nav tab index
  useEffect(() => {
    const tabKeys = navTabs.map(t => t.key);
    const prevIdx = tabKeys.indexOf(prevViewRef.current);
    const curIdx = tabKeys.indexOf(currentView);
    if (prevIdx >= 0 && curIdx >= 0 && prevIdx !== curIdx) {
      setSlideDir(curIdx > prevIdx ? 'right' : 'left');
    } else {
      setSlideDir('none');
    }
    prevViewRef.current = currentView;
  }, [currentView]);

  const handleAction = (t: string) => { if (t === 'project') (async () => { const name = await showPrompt('输入课题名称'); if (name && name.trim()) { await useStore.getState().addProject({ name: name.trim(), code: '', direction: '', description: '', leader: '', startDate: new Date().toISOString().slice(0,10), status: '进行中', tags: '[]', budget: 0 } as any); await useStore.getState().loadAll(); } })(); else if (t === 'experiment') { setSelectedTemplate(null); setShowNewExperiment(true); } else if (t === 'template') setShowTemplateChooser(true); else if (t === 'reference') setShowNewReference(true); };
  const handleSelectTemplate = (t: any) => { setSelectedTemplate(t); setShowTemplateChooser(false); setShowNewExperiment(true); };

  // Nav tabs
  const navTabs = [
    { key: 'projects', label: '课题', icon: <FolderOpen size={15} /> },
    { key: 'experiments', label: '实验记录', icon: <FlaskConical size={15} /> },
    { key: 'templates', label: '方法', icon: <LayoutTemplate size={15} /> },
    { key: 'library', label: '文献', icon: <BookOpen size={15} /> },
  ];

  const isActive = (k: string) => currentView === k || (k === 'projects' && currentView === 'projectDetail') || (k === 'experiments' && currentView === 'experimentDetail') || (k === 'library' && (currentView === 'library' || currentView === 'files' || currentView === 'references'));

  // Breadcrumb for detail pages
  const detailCrumbs: { label: string; onClick: () => void }[] = [];
  if (currentView === 'projectDetail') {
    detailCrumbs.push({ label: '__BACK__课题', onClick: () => navigateTo('projects') });
  }
  if (currentView === 'experimentDetail') {
    detailCrumbs.push({ label: '__BACK__实验记录', onClick: () => navigateTo('experiments') });
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <HomePage onAction={handleAction} />;
      case 'projects': return <ProjectsPage onAction={handleAction} />;
      case 'projectDetail': return <ProjectDetailPage onAction={handleAction} />;
      case 'experiments': return <ExperimentsPage onAction={handleAction} />;
      case 'experimentDetail': return <ExperimentDetailPage />;
      case 'results': return <ResultsPage />;
      case 'library': case 'files': case 'references': return <LibraryPage onAction={handleAction} />;
      case 'templates': return <TemplatesPage onSelectTemplate={handleSelectTemplate} />;
      // settings removed - now in UserMenu
      default: return <HomePage onAction={handleAction} />;
    }
  };

  const [globalTimerDone, setGlobalTimerDone] = useState(false);
  const [gTimerTotal, setGTimerTotal] = useState(0);
  const [gTimerLeft, setGTimerLeft] = useState(0);
  const [gTimerOn, setGTimerOn] = useState(false);
  const gTimerIv = useRef<any>(null);

  useEffect(() => {
    (window as any).__biolab_timer_left = gTimerLeft;
    (window as any).__biolab_timer_total = gTimerTotal;
    (window as any).__biolab_timer_on = gTimerOn;
  }, [gTimerLeft, gTimerTotal, gTimerOn]);

  useEffect(() => {
    if (gTimerOn && gTimerLeft > 0) {
      gTimerIv.current = setInterval(() => setGTimerLeft(l => {
        window.dispatchEvent(new Event('biolab-timer-tick'));
        if (l <= 1) {
          setGTimerOn(false);
          setGlobalTimerDone(true);
          setGTimerTotal(0);
          try { isPermissionGranted().then(granted => { if (granted) { sendNotification({ title: 'BioLab', body: '计时结束！' }); } else { requestPermission().then(p => { if (p === 'granted') sendNotification({ title: 'BioLab', body: '计时结束！' }); }); } }); } catch {}
          try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZKOgnBjWVpjcH+MlZaShXhsYl1ib3yIkJGMgHRnXltfanmFjo+LfnJmXVtdZ3WBio2JfHBkXFpbY3F+iY2Jf3RoYF5gZ3R+homHfHFmX11eZHF8homHfHJoYl9hZnJ8hYeEe3FnYV9fY298hIaEenBmYV9fY298hIaDenBnYl9gZHB8hIaDe3FoY2FiZXJ8g4SDe3FpZGJjZnN9g4ODe3JqZWRlZ3R+g4KCenJqZmVmaHV+goKBenNsZ2doant/gYGAeXNtaGhpbHyAgH9+eXRuammpa3x/f358eXVvammqa3x+fn17eHVva2prbHx+fn17eHZwbGtsbX1+fXt5d3JubW5vcX5+fXt5eHNvb3Bxcn5+fXt6eXRxcXJzdH9+fHt7enV0dHV2eH9+fHx8fHd3eHl6e39+fX1+f3t8fX5/gH9/f4CBgoOEhYaGh4iJioqLjI2Oj5CQkZKTk5SVlpaXmJmZmpucnJ2en5+goaGio6SkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29ze3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j4+fr7/P3+').play().catch(() => {}); } catch {}
          return 0;
        }
        return l - 1;
      }), 1000);
    } else { clearInterval(gTimerIv.current); }
    return () => clearInterval(gTimerIv.current);
  }, [gTimerOn, gTimerLeft]);

  // Expose timer state globally
  (window as any).__bioTimer = { total: gTimerTotal, left: gTimerLeft, on: gTimerOn, setTotal: setGTimerTotal, setLeft: setGTimerLeft, setOn: setGTimerOn };

  return (
    <div className="app" onContextMenu={e => e.preventDefault()}>
      {/* Timer always mounted for persistent countdown */}
      <div style={{ display: currentView === 'dashboard' ? 'contents' : 'none' }}>
        <TimerWidget />
      </div>

      {globalTimerDone && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setGlobalTimerDone(false)}>
          <div className="timer-holo" onClick={e => e.stopPropagation()}>
            <div className="timer-holo-grid" />
            <div className="timer-holo-hex" style={{ top: 10, right: 20 }} />
            <div className="timer-holo-hex" style={{ bottom: 15, left: 15, width: 30, height: 30 }} />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <div className="timer-holo-time">00:00:00</div>
              <div className="timer-holo-bar"><div className="timer-holo-bar-fill" /></div>
              <div className="timer-holo-btn" onClick={() => setGlobalTimerDone(false)}>确认</div>
            </div>
          </div>
        </div>,
      document.body)}<BioBackground enabled={bgEnabled} />
      {/* Top bar with nav tabs */}
      <div className="topbar">
        <div className="topbar-logo" onClick={() => navigateTo('dashboard')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" /><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /></svg>
        </div>
        <div className="topbar-divider" />

        {/* Nav tabs in topbar */}
        <div className="topbar-nav">
          {navTabs.map(t => (
            <div key={t.key} className={`topbar-tab ${isActive(t.key) ? 'active' : ''}`} onClick={() => navigateTo(t.key as any)}>
              {t.icon}<span>{t.label}</span>
            </div>
          ))}
        </div>

        <div className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={15} color="#576178" /><span>搜索</span></div>
                <ApiKeySettings />
      <UserMenu onLogout={logout} userName={currentUser} avatarUrl={avatarUrl} bgEnabled={bgEnabled} setBgEnabled={setBgEnabled} />
      </div>

      {/* Sub breadcrumb for detail pages */}
      {detailCrumbs.length > 0 && (
        <div className="sub-breadcrumb">
          {detailCrumbs.map((c, i) => {
            if (c.label.startsWith('__BACK__')) {
              const tgt = c.label.replace('__BACK__', '');
              return (
                <span key={i} className="ios-back-btn" onClick={c.onClick}
                  onMouseEnter={(ev: any) => { ev.currentTarget.style.transform = 'translateX(-2px)'; ev.currentTarget.querySelector('svg').style.strokeWidth = '2.4'; }}
                  onMouseLeave={(ev: any) => { ev.currentTarget.style.transform = 'translateX(0)'; ev.currentTarget.querySelector('svg').style.strokeWidth = '2'; }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#7dd3fc', fontSize: 15, transition: 'transform 0.18s', userSelect: 'none' }}>
                  <svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke-width 0.18s' }}>
                    <path d="M12 2 L2 11 L12 20"/>
                  </svg>
                  <span>{tgt}</span>
                </span>
              );
            }
            return (
              <span key={i}>
                {i > 0 && <span className="bc-sep">/</span>}
                {i < detailCrumbs.length - 1 ? <span className="bc-link" onClick={c.onClick}>{c.label}</span> : <span className="bc-current">{c.label}</span>}
              </span>
            );
          })}
        </div>
      )}

      <div className="content-area page-fade-in" key={currentView}>{renderView()}</div>

      {searchOpen && <SearchOverlay />}
      
      {showTemplateChooser && <TemplateChooser onSelect={handleSelectTemplate} onClose={() => setShowTemplateChooser(false)} />}
      {showNewExperiment && <NewExperimentModal template={selectedTemplate} onClose={() => { setShowNewExperiment(false); setSelectedTemplate(null); }} defaultProjectId={selectedProjectId || undefined} />}
      {showNewReference && <NewReferenceModal onClose={() => setShowNewReference(false)} />}
    <DialogHost /></div>
  );
}
