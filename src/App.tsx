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

// ═══ 倒计时铃声 A1 深空回响(同步呼吸灯 1s 周期,持续 60s)═══
let _alarmCtx: AudioContext | null = null;
let _alarmTimeout: any = null;
function stopAlarm() {
  if (_alarmCtx) { try { _alarmCtx.close(); } catch {} _alarmCtx = null; }
  if (_alarmTimeout) { clearTimeout(_alarmTimeout); _alarmTimeout = null; }
}
function playAlarm() {
  stopAlarm();
  const ctx = new AudioContext();
  ctx.resume();
  _alarmCtx = ctx;
  let t = ctx.currentTime + 0.05;
  const end = t + 60;
  while (t < end) {
    // 三重微失谐正弦波(科幻共振感)
    for (const f of [659.25, 662, 661]) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.start(t); o.stop(t + 0.8);
    }
    // 低频底音(165Hz)
    const sub = ctx.createOscillator(); const gs = ctx.createGain();
    sub.connect(gs); gs.connect(ctx.destination);
    sub.type = 'sine'; sub.frequency.value = 165;
    gs.gain.setValueAtTime(0, t);
    gs.gain.linearRampToValueAtTime(0.07, t + 0.04);
    gs.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    sub.start(t); sub.stop(t + 0.7);
    // 高频泛音(1318Hz,清脆点缀)
    const hi = ctx.createOscillator(); const gh = ctx.createGain();
    hi.connect(gh); gh.connect(ctx.destination);
    hi.type = 'sine'; hi.frequency.value = 1318.5;
    gh.gain.setValueAtTime(0, t);
    gh.gain.linearRampToValueAtTime(0.02, t + 0.005);
    gh.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    hi.start(t); hi.stop(t + 0.4);
    t += 1.0;
  }
  _alarmTimeout = setTimeout(stopAlarm, 60000);
}
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


async function exportTemplateToWord(lt: any) {
  if (!lt) return;
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
  const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
  const { invoke: inv } = await import('@tauri-apps/api/core');

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

  const children: any[] = [
    new Paragraph({ children: [new TextRun({ text: lt.name || '未命名模板', bold: true, size: 36, font: 'PingFang SC' })], spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: dateStr, size: 20, color: '888888', font: 'PingFang SC' })], spacing: { after: 300 } }),
  ];

  const steps = Array.isArray(lt.steps) ? [...lt.steps] : [];
  const sorted = steps
    .filter((s: any) => s && (s.name || s.label))
    .sort((a: any, b: any) => (a.day ?? 0) - (b.day ?? 0));

  if (sorted.length > 0) {
    children.push(new Paragraph({ text: '实验步骤', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    for (const s of sorted) {
      const stepTitle = 'D' + (s.day ?? 0) + ' · ' + (s.name || s.label || '');
      children.push(new Paragraph({ children: [new TextRun({ text: stepTitle, bold: true, size: 24, font: 'PingFang SC' })], spacing: { before: 120, after: 60 } }));
      const detail = (s.detail || s.description || '').trim();
      if (detail) {
        for (const line of detail.split('\n')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'PingFang SC' })], spacing: { after: 60, line: 360 }, indent: { left: 360 } }));
        }
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);

  const defaultName = (lt.name || '模板') + '_' + dateStr + '.docx';
  const savePath = await saveDialog({ defaultPath: defaultName, filters: [{ name: 'Word', extensions: ['docx'] }] });
  if (!savePath) return;

  const arrayBuf = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  await inv('write_export_file', { path: savePath, data: base64 });
}

async function exportExperimentToWord(exp: any) {
  if (!exp) return;
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
  const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
  const { invoke: inv } = await import('@tauri-apps/api/core');

  const children: any[] = [
    new Paragraph({ children: [new TextRun({ text: exp.title || '未命名实验', bold: true, size: 36, font: 'PingFang SC' })], spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: (exp.date || '') + ' · ' + (exp.type || ''), size: 20, color: '888888', font: 'PingFang SC' })], spacing: { after: 300 } }),
  ];

  const pushHeading = (title: string) => {
    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
  };
  const pushTextBlock = (text: string) => {
    for (const line of text.split('\n')) {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'PingFang SC' })], spacing: { after: 60, line: 360 } }));
    }
  };
  const pushSection = (title: string, text: string) => {
    if (!text || !text.trim()) return;
    pushHeading(title);
    pushTextBlock(text);
  };

  pushSection('实验目的', exp.purpose || '');
  pushSection('样本材料', exp.materials || '');

  let milestones: any[] = [];
  try {
    const tl = JSON.parse(exp.parameters || '{}');
    milestones = Array.isArray(tl.milestones) ? tl.milestones : [];
  } catch {}
  const sortedMs = [...milestones].sort((a: any, b: any) => (a.day ?? 0) - (b.day ?? 0));
  if (sortedMs.length > 0) {
    pushHeading('实验步骤');
    for (const m of sortedMs) {
      const stepTitle = 'D' + (m.day ?? 0) + ' · ' + (m.label || '');
      children.push(new Paragraph({ children: [new TextRun({ text: stepTitle, bold: true, size: 24, font: 'PingFang SC' })], spacing: { before: 120, after: 60 } }));
      const detail = (m.detail || '').trim();
      if (detail) {
        for (const line of detail.split('\n')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'PingFang SC' })], spacing: { after: 60, line: 360 }, indent: { left: 360 } }));
        }
      }
    }
  } else if (exp.steps && exp.steps.trim()) {
    pushSection('实验步骤', exp.steps);
  }

  pushSection('实验结果', exp.results || '');
  pushSection('结论', exp.conclusion || '');
  pushSection('问题记录', exp.issues || '');
  pushSection('下一步计划', exp.nextSteps || '');

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);

  const savePath = await saveDialog({ defaultPath: (exp.title || '实验') + '.docx', filters: [{ name: 'Word', extensions: ['docx'] }] });
  if (!savePath) return;

  const arrayBuf = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  await inv('write_export_file', { path: savePath, data: base64 });
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
  const [editExp] = useState(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('biolab-edit-exp');
    localStorage.removeItem('biolab-edit-exp');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [editTpl] = useState(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('biolab-edit-tpl');
    localStorage.removeItem('biolab-edit-tpl');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const editTl = React.useMemo(() => { try { return editExp?.parameters ? JSON.parse(editExp.parameters) : null; } catch { return null; } }, [editExp]);
  const editSteps = React.useMemo(() => {
    if (!editTl?.milestones?.length) return null;
    // 检查是否任何一步已有 detail(新格式)
    const hasNewFormat = editTl.milestones.some((m: any) => m && m.detail);
    // 老数据回退:从 editExp.steps 文本里按 " - " 切
    let textDetails: string[] = [];
    if (!hasNewFormat && editExp?.steps) {
      textDetails = editExp.steps.split('\n').filter((l: string) => l.trim()).map((line: string) => {
        const m = line.match(/^D\d+:\s*(.+)$/);
        if (!m) return '';
        const rest = m[1].trim();
        const dashIdx = rest.indexOf(' - ');
        return dashIdx >= 0 ? rest.slice(dashIdx + 3).trim() : '';
      });
    }
    return editTl.milestones.map((m: any, i: number) => ({
      day: m.day ?? 0,
      name: m.label ?? m.name ?? '',
      detail: m.detail || textDetails[i] || '',
    }));
  }, [editTl, editExp]);
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
    const lastDay = steps.length > 0 ? Math.max(...steps.map(s => s.day ?? 0)) + 1 : 0;
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
        // 不再合并同 day 步骤,保留为多条独立步骤
        if (steps.length === 1 && !steps[0].name) {
          setSteps(parsed);
        } else {
          setSteps(prev => [...prev, ...parsed]);
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
    const sorted = [...steps].filter(s => s.name && s.name.trim()).sort((a, b) => a.day - b.day);
    const maxDay = sorted.length > 0 ? sorted[sorted.length - 1].day + 1 : 1;
    const milestones = sorted.map(s => ({ day: s.day, label: s.name, detail: s.detail || '' }));
    const displayMode = localStorage.getItem('biolab-new-exp-display-mode') || 'timeline';
    const expType = localStorage.getItem('biolab-new-exp-type') || '';
    const params = JSON.stringify({ duration_days: maxDay, milestones, display_mode: displayMode });
    localStorage.removeItem('biolab-new-exp-display-mode');
    localStorage.removeItem('biolab-new-exp-type');
    const stepsText = sorted.map(s => 'D' + s.day + ': ' + s.name).join('\n');

    if (saving) { console.log('[doSave] 已在保存中,跳过重复调用'); return; }
    setSaving(true);
    console.log('[doSave] editExp =', editExp, 'editTpl =', editTpl);
    if (editTpl?.id) {
      // 编辑模板模式: 只更新 localStorage 里的模板,不触碰实验数据库
      const tplName = name.trim() || editTpl.name || '未命名模板';
      const updatedTpl = {
        ...editTpl,
        name: tplName,
        cat: template?.fields?.type || editTpl.cat || '自定义',
        desc: steps.filter(s => s.name.trim()).sort((a, b) => a.day - b.day).map(s => 'D' + s.day + ' ' + s.name).join(' → '),
        steps: steps.filter(s => s.name.trim()).map(s => ({ day: s.day, name: s.name, detail: s.detail })),
      };
      const saved = JSON.parse(localStorage.getItem('biolab-user-templates') || '[]');
      const idx = saved.findIndex((t: any) => t.id === editTpl.id);
      if (idx >= 0) saved[idx] = updatedTpl; else saved.push(updatedTpl);
      localStorage.setItem('biolab-user-templates', JSON.stringify(saved));
      localStorage.removeItem('biolab-new-exp-date');
      window.dispatchEvent(new Event('biolab-tpl-updated'));
      setTimeout(() => { setSaving(false); onClose(); }, 600);
      return;
    }
    if (editExp?.id) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_experiment', {
        id: editExp.id,
        title: name.trim(),
        type: template?.name || editExp.type || '',
        date: startDate,
        purpose: editExp.purpose || '',
        materials: editExp.materials || '',
        steps: stepsText,
        parameters: params,
        results: editExp.results || '',
        conclusion: editExp.conclusion || '',
        issues: editExp.issues || '',
        nextSteps: editExp.nextSteps || '',
        status: editExp.status || '进行中',
      });
      await useStore.getState().loadAll();
    } else {
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
    }
    localStorage.removeItem('biolab-new-exp-date');

    // Save as template if checked (works in both new and edit mode)
    if (saveTpl && steps.length > 0 && steps.some(s => s.name.trim())) {
      const tplName = name.trim() || '未命名模板';
      const cleanSteps = steps.filter(s => s.name.trim()).map(s => ({ day: s.day, name: s.name, detail: s.detail }));
      const desc = [...cleanSteps].sort((a, b) => a.day - b.day).map(s => 'D' + s.day + ' ' + s.name).join(' → ');
      const saved = JSON.parse(localStorage.getItem('biolab-user-templates') || '[]');
      const isExistingUserTpl = template?.id && String(template.id).startsWith('user-');
      if (isExistingUserTpl) {
        // 覆盖原模板
        const idx = saved.findIndex((t: any) => t.id === template.id);
        const updated = { id: template.id, name: tplName, icon: '📋', cat: template?.fields?.type || '自定义', desc, steps: cleanSteps };
        if (idx >= 0) saved[idx] = updated; else saved.push(updated);
      } else {
        // 新增模板
        saved.push({ id: 'user-' + Date.now(), name: tplName, icon: '📋', cat: template?.fields?.type || '自定义', desc, steps: cleanSteps });
      }
      localStorage.setItem('biolab-user-templates', JSON.stringify(saved));
      window.dispatchEvent(new Event('biolab-tpl-updated'));
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

              const sameDayAsPrev = si > 0 && sortedSteps[si-1].day === step.day;
              return (
                <div key={origIdx} style={{ display: 'flex', gap: 0, marginBottom: 0,  }}>
                  {/* Left: timeline node */}
                  <div style={{ width: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, visibility: sameDayAsPrev ? 'hidden' : 'visible' }}>
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
          {!editTpl && <div onClick={() => setSaveTpl(!saveTpl)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 0', cursor: 'pointer', marginBottom: 8,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: saveTpl ? '1.5px solid #b794f4' : '1.5px solid rgba(183,148,244,0.3)',
              background: saveTpl ? '#b794f4' : 'transparent',
              transition: 'all 0.2s', fontSize: 10, color: '#fff', flexShrink: 0,
            }}>{saveTpl ? '✓' : ''}</div>
            <span style={{ fontSize: 12, color: saveTpl ? '#b794f4' : '#d0d4dc', transition: 'color 0.2s' }}>{template?.id && String(template.id).startsWith('user-') ? '同时更新此模板' : '同时存为模板'}</span>
          </div>}

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
            {saving ? ((editExp || editTpl) ? '✓ 已保存!返回中...' : (saveTpl ? '✓ 已创建 + 已存模板' : '✓ 已创建！返回中...')) : ((editExp || editTpl) ? '保存修改' : '创建实验')}
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
          
        </div>
      )}
      {sel && selItems.length === 0 && (
        <div className="cw-popup">
          <div className="cw-popup-title">{mo+1}月{sel}日</div>
          <div className="cw-popup-empty">当天无实验</div>
          
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
          try { playAlarm(); } catch {}
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
        <span className="tw-ab" onClick={() => { stopAlarm(); setTimerDone(false); setTotal(0); setLeft(0); }}>确认</span>
      </div>
    </div>
    {createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { stopAlarm(); setTimerDone(false); }}>
        <div className="timer-holo" onClick={e => e.stopPropagation()}>
          <div className="timer-holo-grid" />
          <div className="timer-holo-hex" style={{ top: 10, right: 20 }} />
          <div className="timer-holo-hex" style={{ bottom: 15, left: 15, width: 30, height: 30 }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div className="timer-holo-time">00:00:00</div>
            <div className="timer-holo-bar"><div className="timer-holo-bar-fill" /></div>
            <div className="timer-holo-btn" onClick={() => { stopAlarm(); setTimerDone(false); setTotal(0); setLeft(0); }}>确认</div>
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
  // 0 点自动重新分类: 监听 ClockWidget 广播的日期切换事件, 强制重渲染
  const [, setDateTick] = React.useState(0);
  React.useEffect(() => {
    const onDateChange = () => setDateTick(t => t + 1);
    window.addEventListener('biolab-date-change', onDateChange);
    return () => window.removeEventListener('biolab-date-change', onDateChange);
  }, []);
  const [stepEdit, setStepEdit] = useState<{exp: any; mi: number; day: string; label: string} | null>(null);
  const [addingHomeStep, setAddingHomeStep] = useState<{expId: string; exp: any; day: string; name: string; detail: string} | null>(null);
  const [addingHomeStepClosing, setAddingHomeStepClosing] = React.useState(false);
  const [addingHomeStepHover, setAddingHomeStepHover] = React.useState(false);
  const addingHomeStepRef = React.useRef(addingHomeStep);
  React.useEffect(() => { addingHomeStepRef.current = addingHomeStep; }, [addingHomeStep]);
  const saveAddingHomeStep = async () => {
    const cur = addingHomeStepRef.current;
    if (!cur) return;
    if (!cur.name.trim()) return;
    const d = parseInt(cur.day);
    if (isNaN(d)) return;
    try {
      const exp = cur.exp;
      let tl: any = {};
      try { tl = JSON.parse(exp.parameters || '{}'); } catch {}
      const ms = tl.milestones || [];
      ms.push({ day: d, label: cur.name.trim(), detail: cur.detail.trim() });
      ms.sort((a: any, b: any) => a.day - b.day);
      tl.milestones = ms;
      tl.duration_days = Math.max(...ms.map((m: any) => m.day), 0) + 1;
      const params = JSON.stringify(tl);
      const stepsText = ms.map((m: any) => 'D' + m.day + ': ' + m.label).join('\n');
      const { invoke: inv } = await import('@tauri-apps/api/core');
      await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: stepsText, parameters: params, results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
      await useStore.getState().loadAll();
    } catch(err) { console.error(err); }
  };
  React.useEffect(() => {
    if (!addingHomeStep) return;
    const closeForm = () => { saveAddingHomeStep().then(() => { setAddingHomeStepClosing(true); setTimeout(() => { setAddingHomeStep(null); setAddingHomeStepClosing(false); }, 360); }); };
    const onDown = (ev: MouseEvent) => {
      const tg = ev.target as HTMLElement | null;
      if (!tg || !tg.closest) { closeForm(); return; }
      if (tg.closest('[data-add-step-header]')) { closeForm(); return; }
      if (tg.closest('[data-add-step-form]')) return;
      closeForm();
    };
    const t = setTimeout(() => { document.addEventListener('mousedown', onDown, true); }, 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown, true); };
  }, [addingHomeStep?.expId]);

  const [expandedStepKey, setExpandedStepKey] = useState<string | null>(null);

  const [editingStepKey, setEditingStepKey] = useState<string | null>(null);
  const [hoveredStepKey, setHoveredStepKey] = useState<string | null>(null);
  const [editingStepData, setEditingStepData] = useState<{day: string; label: string; detail: string; exp?: any; mi?: number}>({ day: '', label: '', detail: '' });
  const editingStepDataRef = React.useRef(editingStepData);
  React.useEffect(() => { editingStepDataRef.current = editingStepData; }, [editingStepData]);
  // 方案 C: 每个展开步骤永远是编辑态,输入时写入 localStepEdits,防抖 500ms 写库
  // localStepEdits: Map of stepKey -> { label, detail }
  const [localStepEdits, setLocalStepEdits] = React.useState<Record<string, { label: string; detail: string }>>({});
  const [editingDayKey, setEditingDayKey] = React.useState<string | null>(null);
  const [editingDayValue, setEditingDayValue] = React.useState<string>('');
  const stepSaveTimersRef = React.useRef<Record<string, any>>({});
  const pendingStepWritesRef = React.useRef<Record<string, { exp: any; mi: number; day: number; label: string; detail: string }>>({});

  const scheduleStepSave = (stepKey: string, exp: any, mi: number, day: number, label: string, detail: string) => {
    pendingStepWritesRef.current[stepKey] = { exp, mi, day, label, detail };
    if (stepSaveTimersRef.current[stepKey]) clearTimeout(stepSaveTimersRef.current[stepKey]);
    stepSaveTimersRef.current[stepKey] = setTimeout(() => {
      flushStepSave(stepKey);
    }, 500);
  };

  const flushStepSave = async (stepKey: string) => {
    const pending = pendingStepWritesRef.current[stepKey];
    if (!pending) return;
    delete pendingStepWritesRef.current[stepKey];
    if (stepSaveTimersRef.current[stepKey]) {
      clearTimeout(stepSaveTimersRef.current[stepKey]);
      delete stepSaveTimersRef.current[stepKey];
    }
    try {
      const { exp, mi, day, label, detail } = pending;
      let tl: any = {};
      try { tl = JSON.parse(exp.parameters || '{}'); } catch {}
      const msArr = tl.milestones || [];
      if (msArr[mi]) {
        msArr[mi] = { ...msArr[mi], day, label: label.trim(), detail: detail.trim() };
      }
      msArr.sort((a: any, b: any) => a.day - b.day);
      tl.milestones = msArr;
      tl.duration_days = Math.max(...msArr.map((m: any) => m.day), 0) + 1;
      const params = JSON.stringify(tl);
      const stepsText = msArr.map((m: any) => 'D' + m.day + ': ' + m.label).join('\n');
      const { invoke: inv } = await import('@tauri-apps/api/core');
      await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: stepsText, parameters: params, results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
      await useStore.getState().loadAll();
    } catch(err) { console.error('flushStepSave failed:', err); }
  };

  const flushAllStepSaves = async () => {
    const keys = Object.keys(pendingStepWritesRef.current);
    for (const k of keys) await flushStepSave(k);
  };

  const saveEditingStep = async () => {
    const ed = editingStepDataRef.current;
    if (!ed.exp || ed.mi === undefined) return;
    const d = parseInt(ed.day);
    if (isNaN(d) || !ed.label.trim()) return;
    try {
      let tl: any = {};
      try { tl = JSON.parse(ed.exp.parameters || '{}'); } catch {}
      const msArr = tl.milestones || [];
      if (msArr[ed.mi]) {
        msArr[ed.mi] = { ...msArr[ed.mi], day: d, label: ed.label.trim(), detail: ed.detail.trim() };
      }
      msArr.sort((a: any, b: any) => a.day - b.day);
      tl.milestones = msArr;
      tl.duration_days = Math.max(...msArr.map((m: any) => m.day), 0) + 1;
      const params = JSON.stringify(tl);
      const stepsText = msArr.map((m: any) => 'D' + m.day + ': ' + m.label).join('\n');
      const { invoke: inv } = await import('@tauri-apps/api/core');
      await inv('update_experiment', { id: ed.exp.id, title: ed.exp.title, type: ed.exp.type||'', date: ed.exp.date||'', purpose: ed.exp.purpose||'', materials: ed.exp.materials||'', steps: stepsText, parameters: params, results: ed.exp.results||'', conclusion: ed.exp.conclusion||'', issues: ed.exp.issues||'', nextSteps: ed.exp.nextSteps||'', status: ed.exp.status||'进行中' });
      await useStore.getState().loadAll();
    } catch(err) { console.error(err); }
  };
  // 编辑步骤时,不再通过"外部点击"触发保存/折叠。
  // 只有点击 header 区域或 ∧ 图标才保存折叠(见 header onClick 逻辑)。
  React.useEffect(() => {
    if (!editingStepKey) return;
    // 空占位,保留 effect 结构以便将来加逻辑
    return () => {};
  }, [editingStepKey]);

  const [stepCtxMenu, setStepCtxMenu] = useState<{x: number; y: number; exp: any; mi: number; day: string; label: string} | null>(null);
  React.useEffect(() => { if (!stepCtxMenu) return; const cl = (ev: any) => { const tg = ev?.target as HTMLElement | null; if (tg && tg.closest && tg.closest('[data-step-ctx-menu]')) return; setStepCtxMenu(null); }; const t = setTimeout(() => { document.addEventListener('mousedown', cl, true); document.addEventListener('contextmenu', cl, true); window.addEventListener('scroll', () => setStepCtxMenu(null), true); }, 0); return () => { clearTimeout(t); document.removeEventListener('mousedown', cl, true); document.removeEventListener('contextmenu', cl, true); }; }, [stepCtxMenu]);
  const saveStepEdit = async () => {
    if (!stepEdit) return;
    const exp = stepEdit.exp;
    let tl: any = { duration_days: 1, milestones: [] };
    try { if (exp.parameters) tl = JSON.parse(exp.parameters); } catch {}
    const sortedMs2 = (tl.milestones || []).sort((a: any, b: any) => a.day - b.day);
    const newDay = parseInt(stepEdit.day); if (isNaN(newDay)) { setStepEdit(null); return; }
    if (!stepEdit.label.trim()) { setStepEdit(null); return; }
    let newMs;
    if (stepEdit.mi === -1) {
      newMs = [...sortedMs2, { day: newDay, label: stepEdit.label.trim() }];
    } else {
      newMs = sortedMs2.map((m: any, i: number) => i === stepEdit.mi ? { ...m, day: newDay, label: stepEdit.label.trim() } : m);
    }
    newMs.sort((a: any, b: any) => a.day - b.day);
    const newDuration = Math.max(...newMs.map((m: any) => m.day), 0) + 1;
    const params = JSON.stringify({ ...tl, milestones: newMs, duration_days: newDuration });
    const { invoke: inv } = await import('@tauri-apps/api/core');
    await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: params, results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
    await useStore.getState().loadAll();
    setStepEdit(null);
  };
  React.useEffect(() => {
    if (!ctxMenu) return;
    const cl = (ev: any) => {
      const tg = ev?.target as HTMLElement | null;
      if (tg && tg.closest && tg.closest('[data-exp-ctx-menu]')) return;
      setCtxMenu(null);
    };
    const onScroll = () => setCtxMenu(null);
    const t = setTimeout(() => {
      document.addEventListener('mousedown', cl, true);
      document.addEventListener('contextmenu', cl, true);
      window.addEventListener('scroll', onScroll, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', cl, true);
      document.removeEventListener('contextmenu', cl, true);
      window.removeEventListener('scroll', onScroll, true);
    };
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
    <div className="page-container" style={{ display: 'flex', gap: 24, paddingRight: 300 }}>
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
            borderTop: '3px solid rgba(255,255,255,0.12)',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.3s ease, border-top-color 0.3s ease',
          }}
            onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; ev.currentTarget.style.borderColor = color.main + '25'; ev.currentTarget.style.borderTop = '3px solid ' + color.main + '55'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '1'; }}
            onMouseLeave={ev => { ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; ev.currentTarget.style.borderTop = '3px solid rgba(255,255,255,0.12)'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '0'; }}
          >
            {/* Collapsed card */}
            <div style={{ padding: '16px 20px', cursor: 'pointer', background: 'transparent', transition: 'background 0.25s ease', borderTopLeftRadius: 14, borderTopRightRadius: 14 }} onClick={() => setExpanded(isExpanded ? null : e.id)} onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e }); }} onMouseEnter={(ev: any) => { ev.currentTarget.style.background = 'linear-gradient(to bottom, ' + color.main + '30 0%, ' + color.main + '10 60%, transparent 100%)'; }} onMouseLeave={(ev: any) => { ev.currentTarget.style.background = 'transparent'; }}>
              {/* Row 1: name + remaining days */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: color.main }} />
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
                  return (() => {
                      const stepKey = e.id + '-' + mi;
                      const isStepExpanded = expandedStepKey === stepKey;
                      let stepDetail = '';
                      try {
                        const tlp = JSON.parse(e.parameters || '{}');
                        const milestones = tlp.milestones || [];
                        if (milestones[mi] && milestones[mi].detail) {
                          stepDetail = milestones[mi].detail;
                        }
                      } catch {}

                      const sameDayAsPrev = mi > 0 && sortedMs[mi-1].day === ms.day;
                      const isEditing = editingStepKey === stepKey;
                      const isFirstOfDay = mi === 0 || sortedMs[mi-1].day !== ms.day;
                      return (
                        <div key={mi}>
                          {isFirstOfDay && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 1 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: isT ? color.main : '#3a3a40', boxShadow: isT ? '0 0 6px ' + color.main : 'none' }} />
                              <span style={{ fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', flexShrink: 0, boxSizing: 'border-box' }}>D{ms.day}</span>
                              <span style={{ fontSize: 10, flex: 1, color: isT ? color.main : '#606878' }}>{(msDate.getMonth()+1) + '月' + msDate.getDate() + '日 · ' + fmtWeek(msDate)}</span>
                              {isT && <span style={{ fontSize: 9, background: 'rgba(125,211,252,0.15)', color: '#7dd3fc', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(125,211,252,0.25)' }}>今天</span>}
                            </div>
                          )}
                          {/* 收起行 */}
                          <div className={'step-morph-row' + (isStepExpanded ? ' hide' : '')} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 56px',
                            borderRadius: 6, background: 'transparent', cursor: 'pointer',
                          }}
                            onMouseEnter={(ev: any) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'; }}
                            onMouseLeave={(ev: any) => { ev.currentTarget.style.background = 'transparent'; }}
                            onClick={() => setExpandedStepKey(stepKey)}
                            onContextMenu={(ev: any) => { ev.preventDefault(); ev.stopPropagation(); setStepCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e, mi, day: String(ms.day), label: ms.label }); }}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isT ? color.main : '#3a3a40', boxShadow: isT ? '0 0 6px ' + color.main : 'none' }} />
                            <span style={{ fontSize: 13, color: isT ? color.main : isDone ? '#a0a0a8' : '#f0f0f2', fontWeight: isT ? 600 : 500, flex: 1, textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>{ms.label}</span>
                          </div>
                          {/* 展开卡片 */}
                          <div className={'step-morph-card' + (isStepExpanded ? ' show' : '')}><div>
                            <div style={{ position: 'relative', padding: '0 0 8px 0', borderRadius: 8, background: '#1e2028', border: '1px solid ' + (hoveredStepKey === stepKey ? color.main + '55' : (isEditing ? color.main + '40' : color.main + '20')), borderTop: '3px solid ' + (hoveredStepKey === stepKey ? color.main + '80' : (isEditing ? color.main + '60' : color.main + '40')), boxShadow: hoveredStepKey === stepKey ? '0 0 24px ' + color.main + '33, 0 4px 12px rgba(0,0,0,0.4)' : 'none', transform: hoveredStepKey === stepKey ? 'translateY(-2px)' : 'translateY(0)', transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease', margin: '2px 0 4px' }}
                              onContextMenu={(ev: any) => { ev.preventDefault(); ev.stopPropagation(); setStepCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e, mi, day: String(ms.day), label: ms.label }); }}>
                              <div data-step-edit-form onMouseEnter={() => setHoveredStepKey(stepKey)} onMouseLeave={() => setHoveredStepKey(null)} onClick={() => { flushStepSave(stepKey).then(() => setExpandedStepKey(null)); }} style={{ position: 'relative', cursor: 'pointer', padding: '22px 12px 0 56px', background: hoveredStepKey === stepKey ? 'linear-gradient(to bottom, ' + color.main + '30 0%, ' + color.main + '10 70%, transparent 100%)' : 'transparent', transition: 'background 0.2s ease', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                                <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>步骤标题</div>
                              </div>
                              {editingDayKey === stepKey ? (
                                <span onClick={(ev) => ev.stopPropagation()} style={{ position: 'absolute', top: 45, left: 8, zIndex: 3, fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  D<input autoFocus type="text" value={editingDayValue}
                                    onChange={(ev) => {
                                      const v = ev.target.value.replace(/[^0-9]/g, '');
                                      setEditingDayValue(v);
                                    }}
                                    onClick={(ev) => ev.stopPropagation()}
                                    onKeyDown={(ev: any) => {
                                      if (ev.key === 'Enter') {
                                        ev.preventDefault();
                                        const raw = (ev.currentTarget?.value ?? '').replace(/[^0-9]/g, '');
                                        const newDay = parseInt(raw);
                                        if (!isNaN(newDay) && newDay !== ms.day) {
                                          const curLabel = (localStepEdits[stepKey]?.label) ?? ms.label ?? '';
                                          const curDetail = (localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '');
                                          scheduleStepSave(stepKey, e, mi, newDay, curLabel, curDetail);
                                          flushStepSave(stepKey);
                                        }
                                        setEditingDayKey(null);
                                      } else if (ev.key === 'Escape') {
                                        setEditingDayKey(null);
                                      }
                                    }}
                                    onBlur={(ev: any) => {
                                      const raw = (ev.currentTarget?.value ?? '').replace(/[^0-9]/g, '');
                                      const newDay = parseInt(raw);
                                      if (!isNaN(newDay) && newDay !== ms.day) {
                                        const curLabel = (localStepEdits[stepKey]?.label) ?? ms.label ?? '';
                                        const curDetail = (localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '');
                                        scheduleStepSave(stepKey, e, mi, newDay, curLabel, curDetail);
                                        flushStepSave(stepKey);
                                      }
                                      setEditingDayKey(null);
                                    }}
                                    style={{ width: 20, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center', padding: 0 }} />
                                </span>
                              ) : (
                                <span title="修改天数" onClick={(ev) => { ev.stopPropagation(); setEditingDayValue(String(ms.day)); setEditingDayKey(stepKey); }}
                                  style={{ position: 'absolute', top: 45, left: 8, zIndex: 3, fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', boxSizing: 'border-box', cursor: 'pointer', transition: 'all 0.15s' }}
                                  onMouseEnter={(ev: any) => { ev.currentTarget.style.background = isT ? color.main + '28' : 'rgba(255,255,255,0.06)'; ev.currentTarget.style.borderColor = isT ? color.main : 'rgba(255,255,255,0.25)'; }}
                                  onMouseLeave={(ev: any) => { ev.currentTarget.style.background = isT ? color.light : 'rgba(255,255,255,0.02)'; ev.currentTarget.style.borderColor = isT ? color.main : 'rgba(255,255,255,0.1)'; }}>
                                  D{ms.day}
                                </span>
                              )}
                              <button title="折叠" onClick={(ev) => { ev.stopPropagation(); flushStepSave(stepKey).then(() => setExpandedStepKey(null)); }} onMouseEnter={ev => { ev.currentTarget.style.color = '#7dd3fc'; ev.currentTarget.style.background = 'rgba(125,211,252,0.15)'; ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.3)'; }} onMouseLeave={ev => { ev.currentTarget.style.color = '#606878'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderColor = 'transparent'; }} style={{ position: 'absolute', top: 4, left: 8, background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', padding: 4, color: '#606878', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', zIndex: 2 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                              <div style={{ position: 'relative', padding: '0 12px 2px 56px' }}>
                                <input data-step-edit-form value={(localStepEdits[stepKey]?.label) ?? ms.label ?? ''}
                                  onChange={ev => {
                                    const newLabel = ev.target.value;
                                    const curDetail = (localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '');
                                    setLocalStepEdits(s => ({ ...s, [stepKey]: { label: newLabel, detail: curDetail } }));
                                    scheduleStepSave(stepKey, e, mi, ms.day, newLabel, curDetail);
                                  }}
                                  onBlur={() => flushStepSave(stepKey)}
                                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#f0f0f2', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                                  onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                                  onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                  onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                  onBlurCapture={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                />
                              </div>
                              <div style={{ padding: '0 12px 0 56px' }}>
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 0 6px' }} />
                                <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>具体操作</div>
                                <textarea data-step-edit-form value={(localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '')}
                                  placeholder="暂无具体操作"
                                  onChange={ev => {
                                    const newDetail = ev.target.value;
                                    const curLabel = (localStepEdits[stepKey]?.label) ?? ms.label ?? '';
                                    setLocalStepEdits(s => ({ ...s, [stepKey]: { label: curLabel, detail: newDetail } }));
                                    scheduleStepSave(stepKey, e, mi, ms.day, curLabel, newDetail);
                                  }}
                                  onBlur={() => flushStepSave(stepKey)}
                                  rows={2}
                                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#8890a0', fontSize: 12, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.6, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                                  onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                                  onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                  onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                  onBlurCapture={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                  onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                                  ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                />
                              </div>
                            </div>
                          </div></div>
                        </div>
                      );
                  })();
                })}

                {addingHomeStep && addingHomeStep.expId === e.id ? (() => {
                  const addDay = parseInt(addingHomeStep.day);
                  const addDate = new Date(startD); if (!isNaN(addDay)) addDate.setDate(addDate.getDate() + addDay);
                  const isAddToday = !isNaN(addDay) && daysP === addDay;
                  return (
                  <div className={'step-morph-card' + (addingHomeStepClosing ? '' : ' show')}><div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 1 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, border: '1.5px dashed ' + (isAddToday ? color.main : '#3a3a40'), background: 'transparent', boxSizing: 'border-box', boxShadow: isAddToday ? '0 0 6px ' + color.main + '55' : 'none' }} />
                      <span data-add-step-form style={{ fontSize: 11, color: isAddToday ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isAddToday ? color.main : 'rgba(255,255,255,0.1)'), background: isAddToday ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', flexShrink: 0, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        D<input data-add-step-form type="text" inputMode="numeric" value={addingHomeStep.day}
                          onChange={ev => setAddingHomeStep({ ...addingHomeStep, day: ev.target.value.replace(/[^0-9]/g, '') })}
                          style={{ width: 20, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center', padding: 0 }} />
                      </span>
                      <span style={{ fontSize: 10, flex: 1, color: isAddToday ? color.main : '#606878' }}>{isNaN(addDay) ? '' : ((addDate.getMonth()+1) + '月' + addDate.getDate() + '日 · ' + fmtWeek(addDate))}</span>
                      {isAddToday && <span style={{ fontSize: 9, background: 'rgba(125,211,252,0.15)', color: '#7dd3fc', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(125,211,252,0.25)' }}>今天</span>}
                    </div>
                    <div data-add-step-form style={{ position: 'relative', padding: '0 0 8px 0', borderRadius: 8, background: '#1e2028', border: '1px solid ' + (addingHomeStepHover ? color.main + '55' : color.main + '40'), borderTop: '3px solid ' + (addingHomeStepHover ? color.main + '80' : color.main + '55'), boxShadow: addingHomeStepHover ? '0 0 24px ' + color.main + '33, 0 4px 12px rgba(0,0,0,0.4)' : 'none', transform: addingHomeStepHover ? 'translateY(-2px)' : 'translateY(0)', transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease', margin: '2px 0 4px' }}>
                      <div data-add-step-header onMouseEnter={() => setAddingHomeStepHover(true)} onMouseLeave={() => setAddingHomeStepHover(false)} style={{ position: 'relative', cursor: 'pointer', padding: '22px 12px 0 56px', background: addingHomeStepHover ? 'linear-gradient(to bottom, ' + color.main + '30 0%, ' + color.main + '10 70%, transparent 100%)' : 'transparent', transition: 'background 0.2s ease', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                        <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>步骤标题</div>
                      </div>
                      <button data-add-step-header title="折叠" onMouseEnter={ev => { ev.currentTarget.style.color = '#7dd3fc'; ev.currentTarget.style.background = 'rgba(125,211,252,0.15)'; ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.3)'; }} onMouseLeave={ev => { ev.currentTarget.style.color = '#606878'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderColor = 'transparent'; }} style={{ position: 'absolute', top: 4, left: 8, background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', padding: 4, color: '#606878', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', zIndex: 2 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                      <div style={{ position: 'relative', padding: '0 12px 2px 56px' }}>
                        <input data-add-step-form autoFocus value={addingHomeStep.name} onChange={ev => setAddingHomeStep({ ...addingHomeStep, name: ev.target.value })}
                          onKeyDown={ev => { if (ev.key === 'Escape') setAddingHomeStep(null); }}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#f0f0f2', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                          onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                          onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                          onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        />
                      </div>
                      <div style={{ padding: '0 12px 0 56px' }}>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 0 6px' }} />
                        <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>具体操作</div>
                        <textarea data-add-step-form value={addingHomeStep.detail} onChange={ev => setAddingHomeStep({ ...addingHomeStep, detail: ev.target.value })}
                          rows={2}
                          placeholder="暂无具体操作"
                          style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#8890a0', fontSize: 12, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.6, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                          onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                          onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                          onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                          onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                          ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        />
                        <div style={{ fontSize: 10, color: '#606878', marginTop: 6, textAlign: 'right' }}>{isNaN(addDay) ? '' : ((addDate.getMonth()+1) + '月' + addDate.getDate() + '日 · ' + fmtWeek(addDate))}{isAddToday ? ' · 今天' : ''}</div>
                      </div>
                    </div>
                  </div></div>
                  );
                })() : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                  onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                  onMouseLeave={ev => ev.currentTarget.style.opacity = '0.4'}
                  onClick={() => {
                    const nextDay = String((sortedMs.length > 0 ? sortedMs[sortedMs.length-1].day : -1) + 1);
                    (async () => { if (expandedStepKey) { await flushStepSave(expandedStepKey); setExpandedStepKey(null); } setAddingHomeStep({ expId: e.id, exp: e, day: nextDay, name: '', detail: '' }); })();
                  }}
                >
                  <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d0d4dc', fontSize: 16, lineHeight: 1, fontWeight: 300, flexShrink: 0 }}>+</div>
                  <span style={{ fontSize: 12, color: '#d0d4dc' }}>添加步骤</span>
                </div>
                )}
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
            borderTop: '3px solid rgba(255,255,255,0.12)',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.3s ease, border-top-color 0.3s ease',
          }}
            onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; ev.currentTarget.style.borderColor = color.main + '25'; ev.currentTarget.style.borderTop = '3px solid ' + color.main + '55'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '1'; }}
            onMouseLeave={ev => { ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; ev.currentTarget.style.borderTop = '3px solid rgba(255,255,255,0.12)'; const del = ev.currentTarget.querySelector('.home-exp-del') as HTMLElement; if (del) del.style.opacity = '0'; }}
          >
            {/* Collapsed card */}
            <div style={{ padding: '16px 20px', cursor: 'pointer', background: 'transparent', transition: 'background 0.25s ease', borderTopLeftRadius: 14, borderTopRightRadius: 14 }} onClick={() => setExpanded(isExpanded ? null : e.id)} onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e }); }} onMouseEnter={(ev: any) => { ev.currentTarget.style.background = 'linear-gradient(to bottom, ' + color.main + '30 0%, ' + color.main + '10 60%, transparent 100%)'; }} onMouseLeave={(ev: any) => { ev.currentTarget.style.background = 'transparent'; }}>
              {/* Row 1: name + remaining days */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: color.main }} />
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
                  return (() => {
                      const stepKey = e.id + '-' + mi;
                      const isStepExpanded = expandedStepKey === stepKey;
                      let stepDetail = '';
                      try {
                        const tlp = JSON.parse(e.parameters || '{}');
                        const milestones = tlp.milestones || [];
                        if (milestones[mi] && milestones[mi].detail) {
                          stepDetail = milestones[mi].detail;
                        }
                      } catch {}

                      const sameDayAsPrev = mi > 0 && sortedMs[mi-1].day === ms.day;
                      const isEditing = editingStepKey === stepKey;
                      const isFirstOfDay = mi === 0 || sortedMs[mi-1].day !== ms.day;
                      return (
                        <div key={mi}>
                          {isFirstOfDay && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 1 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: isT ? color.main : '#3a3a40', boxShadow: isT ? '0 0 6px ' + color.main : 'none' }} />
                              <span style={{ fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', flexShrink: 0, boxSizing: 'border-box' }}>D{ms.day}</span>
                              <span style={{ fontSize: 10, flex: 1, color: isT ? color.main : '#606878' }}>{(msDate.getMonth()+1) + '月' + msDate.getDate() + '日 · ' + fmtWeek(msDate)}</span>
                              {isT && <span style={{ fontSize: 9, background: 'rgba(125,211,252,0.15)', color: '#7dd3fc', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(125,211,252,0.25)' }}>今天</span>}
                            </div>
                          )}
                          {/* 收起行 */}
                          <div className={'step-morph-row' + (isStepExpanded ? ' hide' : '')} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 56px',
                            borderRadius: 6, background: 'transparent', cursor: 'pointer',
                          }}
                            onMouseEnter={(ev: any) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.06)'; }}
                            onMouseLeave={(ev: any) => { ev.currentTarget.style.background = 'transparent'; }}
                            onClick={() => setExpandedStepKey(stepKey)}
                            onContextMenu={(ev: any) => { ev.preventDefault(); ev.stopPropagation(); setStepCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e, mi, day: String(ms.day), label: ms.label }); }}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isT ? color.main : '#3a3a40', boxShadow: isT ? '0 0 6px ' + color.main : 'none' }} />
                            <span style={{ fontSize: 13, color: isT ? color.main : isDone ? '#a0a0a8' : '#f0f0f2', fontWeight: isT ? 600 : 500, flex: 1, textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>{ms.label}</span>
                          </div>
                          {/* 展开卡片 */}
                          <div className={'step-morph-card' + (isStepExpanded ? ' show' : '')}><div>
                            <div style={{ position: 'relative', padding: '0 0 8px 0', borderRadius: 8, background: '#1e2028', border: '1px solid ' + (hoveredStepKey === stepKey ? color.main + '55' : (isEditing ? color.main + '40' : color.main + '20')), borderTop: '3px solid ' + (hoveredStepKey === stepKey ? color.main + '80' : (isEditing ? color.main + '60' : color.main + '40')), boxShadow: hoveredStepKey === stepKey ? '0 0 24px ' + color.main + '33, 0 4px 12px rgba(0,0,0,0.4)' : 'none', transform: hoveredStepKey === stepKey ? 'translateY(-2px)' : 'translateY(0)', transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease', margin: '2px 0 4px' }}
                              onContextMenu={(ev: any) => { ev.preventDefault(); ev.stopPropagation(); setStepCtxMenu({ x: ev.clientX, y: ev.clientY, exp: e, mi, day: String(ms.day), label: ms.label }); }}>
                              <div data-step-edit-form onMouseEnter={() => setHoveredStepKey(stepKey)} onMouseLeave={() => setHoveredStepKey(null)} onClick={() => { flushStepSave(stepKey).then(() => setExpandedStepKey(null)); }} style={{ position: 'relative', cursor: 'pointer', padding: '22px 12px 0 56px', background: hoveredStepKey === stepKey ? 'linear-gradient(to bottom, ' + color.main + '30 0%, ' + color.main + '10 70%, transparent 100%)' : 'transparent', transition: 'background 0.2s ease', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                                <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>步骤标题</div>
                              </div>
                              {editingDayKey === stepKey ? (
                                <span onClick={(ev) => ev.stopPropagation()} style={{ position: 'absolute', top: 45, left: 8, zIndex: 3, fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  D<input autoFocus type="text" value={editingDayValue}
                                    onChange={(ev) => {
                                      const v = ev.target.value.replace(/[^0-9]/g, '');
                                      setEditingDayValue(v);
                                    }}
                                    onClick={(ev) => ev.stopPropagation()}
                                    onKeyDown={(ev: any) => {
                                      if (ev.key === 'Enter') {
                                        ev.preventDefault();
                                        const raw = (ev.currentTarget?.value ?? '').replace(/[^0-9]/g, '');
                                        const newDay = parseInt(raw);
                                        if (!isNaN(newDay) && newDay !== ms.day) {
                                          const curLabel = (localStepEdits[stepKey]?.label) ?? ms.label ?? '';
                                          const curDetail = (localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '');
                                          scheduleStepSave(stepKey, e, mi, newDay, curLabel, curDetail);
                                          flushStepSave(stepKey);
                                        }
                                        setEditingDayKey(null);
                                      } else if (ev.key === 'Escape') {
                                        setEditingDayKey(null);
                                      }
                                    }}
                                    onBlur={(ev: any) => {
                                      const raw = (ev.currentTarget?.value ?? '').replace(/[^0-9]/g, '');
                                      const newDay = parseInt(raw);
                                      if (!isNaN(newDay) && newDay !== ms.day) {
                                        const curLabel = (localStepEdits[stepKey]?.label) ?? ms.label ?? '';
                                        const curDetail = (localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '');
                                        scheduleStepSave(stepKey, e, mi, newDay, curLabel, curDetail);
                                        flushStepSave(stepKey);
                                      }
                                      setEditingDayKey(null);
                                    }}
                                    style={{ width: 20, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center', padding: 0 }} />
                                </span>
                              ) : (
                                <span title="修改天数" onClick={(ev) => { ev.stopPropagation(); setEditingDayValue(String(ms.day)); setEditingDayKey(stepKey); }}
                                  style={{ position: 'absolute', top: 45, left: 8, zIndex: 3, fontSize: 11, color: isT ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isT ? color.main : 'rgba(255,255,255,0.1)'), background: isT ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', boxSizing: 'border-box', cursor: 'pointer', transition: 'all 0.15s' }}
                                  onMouseEnter={(ev: any) => { ev.currentTarget.style.background = isT ? color.main + '28' : 'rgba(255,255,255,0.06)'; ev.currentTarget.style.borderColor = isT ? color.main : 'rgba(255,255,255,0.25)'; }}
                                  onMouseLeave={(ev: any) => { ev.currentTarget.style.background = isT ? color.light : 'rgba(255,255,255,0.02)'; ev.currentTarget.style.borderColor = isT ? color.main : 'rgba(255,255,255,0.1)'; }}>
                                  D{ms.day}
                                </span>
                              )}
                              <button title="折叠" onClick={(ev) => { ev.stopPropagation(); flushStepSave(stepKey).then(() => setExpandedStepKey(null)); }} onMouseEnter={ev => { ev.currentTarget.style.color = '#7dd3fc'; ev.currentTarget.style.background = 'rgba(125,211,252,0.15)'; ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.3)'; }} onMouseLeave={ev => { ev.currentTarget.style.color = '#606878'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderColor = 'transparent'; }} style={{ position: 'absolute', top: 4, left: 8, background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', padding: 4, color: '#606878', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', zIndex: 2 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                              <div style={{ position: 'relative', padding: '0 12px 2px 56px' }}>
                                <input data-step-edit-form value={(localStepEdits[stepKey]?.label) ?? ms.label ?? ''}
                                  onChange={ev => {
                                    const newLabel = ev.target.value;
                                    const curDetail = (localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '');
                                    setLocalStepEdits(s => ({ ...s, [stepKey]: { label: newLabel, detail: curDetail } }));
                                    scheduleStepSave(stepKey, e, mi, ms.day, newLabel, curDetail);
                                  }}
                                  onBlur={() => flushStepSave(stepKey)}
                                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#f0f0f2', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                                  onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                                  onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                  onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                  onBlurCapture={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                />
                              </div>
                              <div style={{ padding: '0 12px 0 56px' }}>
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 0 6px' }} />
                                <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>具体操作</div>
                                <textarea data-step-edit-form value={(localStepEdits[stepKey]?.detail) ?? (stepDetail ?? '')}
                                  placeholder="暂无具体操作"
                                  onChange={ev => {
                                    const newDetail = ev.target.value;
                                    const curLabel = (localStepEdits[stepKey]?.label) ?? ms.label ?? '';
                                    setLocalStepEdits(s => ({ ...s, [stepKey]: { label: curLabel, detail: newDetail } }));
                                    scheduleStepSave(stepKey, e, mi, ms.day, curLabel, newDetail);
                                  }}
                                  onBlur={() => flushStepSave(stepKey)}
                                  rows={2}
                                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#8890a0', fontSize: 12, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.6, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                                  onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                                  onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                  onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                  onBlurCapture={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                  onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                                  ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                />
                              </div>
                            </div>
                          </div></div>
                        </div>
                      );
                  })();
                })}

                {addingHomeStep && addingHomeStep.expId === e.id ? (() => {
                  const addDay = parseInt(addingHomeStep.day);
                  const addDate = new Date(startD); if (!isNaN(addDay)) addDate.setDate(addDate.getDate() + addDay);
                  const isAddToday = !isNaN(addDay) && daysP === addDay;
                  return (
                  <div className={'step-morph-card' + (addingHomeStepClosing ? '' : ' show')}><div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 1 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, border: '1.5px dashed ' + (isAddToday ? color.main : '#3a3a40'), background: 'transparent', boxSizing: 'border-box', boxShadow: isAddToday ? '0 0 6px ' + color.main + '55' : 'none' }} />
                      <span data-add-step-form style={{ fontSize: 11, color: isAddToday ? color.main : '#a0a0a8', fontVariantNumeric: 'tabular-nums', fontWeight: 700, padding: '3px 0', borderRadius: 6, border: '1px solid ' + (isAddToday ? color.main : 'rgba(255,255,255,0.1)'), background: isAddToday ? color.light : 'rgba(255,255,255,0.02)', width: 44, textAlign: 'center', flexShrink: 0, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        D<input data-add-step-form type="text" inputMode="numeric" value={addingHomeStep.day}
                          onChange={ev => setAddingHomeStep({ ...addingHomeStep, day: ev.target.value.replace(/[^0-9]/g, '') })}
                          style={{ width: 20, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center', padding: 0 }} />
                      </span>
                      <span style={{ fontSize: 10, flex: 1, color: isAddToday ? color.main : '#606878' }}>{isNaN(addDay) ? '' : ((addDate.getMonth()+1) + '月' + addDate.getDate() + '日 · ' + fmtWeek(addDate))}</span>
                      {isAddToday && <span style={{ fontSize: 9, background: 'rgba(125,211,252,0.15)', color: '#7dd3fc', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(125,211,252,0.25)' }}>今天</span>}
                    </div>
                    <div data-add-step-form style={{ position: 'relative', padding: '0 0 8px 0', borderRadius: 8, background: '#1e2028', border: '1px solid ' + (addingHomeStepHover ? color.main + '55' : color.main + '40'), borderTop: '3px solid ' + (addingHomeStepHover ? color.main + '80' : color.main + '55'), boxShadow: addingHomeStepHover ? '0 0 24px ' + color.main + '33, 0 4px 12px rgba(0,0,0,0.4)' : 'none', transform: addingHomeStepHover ? 'translateY(-2px)' : 'translateY(0)', transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease', margin: '2px 0 4px' }}>
                      <div data-add-step-header onMouseEnter={() => setAddingHomeStepHover(true)} onMouseLeave={() => setAddingHomeStepHover(false)} style={{ position: 'relative', cursor: 'pointer', padding: '22px 12px 0 56px', background: addingHomeStepHover ? 'linear-gradient(to bottom, ' + color.main + '30 0%, ' + color.main + '10 70%, transparent 100%)' : 'transparent', transition: 'background 0.2s ease', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                        <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>步骤标题</div>
                      </div>
                      <button data-add-step-header title="折叠" onMouseEnter={ev => { ev.currentTarget.style.color = '#7dd3fc'; ev.currentTarget.style.background = 'rgba(125,211,252,0.15)'; ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.3)'; }} onMouseLeave={ev => { ev.currentTarget.style.color = '#606878'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderColor = 'transparent'; }} style={{ position: 'absolute', top: 4, left: 8, background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', padding: 4, color: '#606878', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', zIndex: 2 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                      <div style={{ position: 'relative', padding: '0 12px 2px 56px' }}>
                        <input data-add-step-form autoFocus value={addingHomeStep.name} onChange={ev => setAddingHomeStep({ ...addingHomeStep, name: ev.target.value })}
                          onKeyDown={ev => { if (ev.key === 'Escape') setAddingHomeStep(null); }}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#f0f0f2', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                          onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                          onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                          onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        />
                      </div>
                      <div style={{ padding: '0 12px 0 56px' }}>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 0 6px' }} />
                        <div style={{ fontSize: 10, color: '#606878', marginBottom: 2 }}>具体操作</div>
                        <textarea data-add-step-form value={addingHomeStep.detail} onChange={ev => setAddingHomeStep({ ...addingHomeStep, detail: ev.target.value })}
                          rows={2}
                          placeholder="暂无具体操作"
                          style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#8890a0', fontSize: 12, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.6, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                          onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                          onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                          onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                          onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                          ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        />
                        <div style={{ fontSize: 10, color: '#606878', marginTop: 6, textAlign: 'right' }}>{isNaN(addDay) ? '' : ((addDate.getMonth()+1) + '月' + addDate.getDate() + '日 · ' + fmtWeek(addDate))}{isAddToday ? ' · 今天' : ''}</div>
                      </div>
                    </div>
                  </div></div>
                  );
                })() : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                  onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                  onMouseLeave={ev => ev.currentTarget.style.opacity = '0.4'}
                  onClick={() => {
                    const nextDay = String((sortedMs.length > 0 ? sortedMs[sortedMs.length-1].day : -1) + 1);
                    (async () => { if (expandedStepKey) { await flushStepSave(expandedStepKey); setExpandedStepKey(null); } setAddingHomeStep({ expId: e.id, exp: e, day: nextDay, name: '', detail: '' }); })();
                  }}
                >
                  <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d0d4dc', fontSize: 16, lineHeight: 1, fontWeight: 300, flexShrink: 0 }}>+</div>
                  <span style={{ fontSize: 12, color: '#d0d4dc' }}>添加步骤</span>
                </div>
                )}
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
      {stepCtxMenu && createPortal(
        <div data-step-ctx-menu style={{ position: 'fixed', left: Math.min(stepCtxMenu.x, window.innerWidth - 140), top: Math.min(stepCtxMenu.y, window.innerHeight - 90), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const s = stepCtxMenu; setStepCtxMenu(null); try { let tl: any = {}; try { tl = JSON.parse(s.exp.parameters || '{}'); } catch {} const ms = (tl.milestones || []).filter((_: any, i: number) => i !== s.mi); tl.milestones = ms; tl.duration_days = ms.length > 0 ? Math.max(...ms.map((m: any) => m.day), 0) + 1 : 1; const params = JSON.stringify(tl); const stepsText = ms.map((m: any) => 'D' + m.day + ': ' + m.label).join('\n'); const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: s.exp.id, title: s.exp.title, type: s.exp.type||'', date: s.exp.date||'', purpose: s.exp.purpose||'', materials: s.exp.materials||'', steps: stepsText, parameters: params, results: s.exp.results||'', conclusion: s.exp.conclusion||'', issues: s.exp.issues||'', nextSteps: s.exp.nextSteps||'', status: s.exp.status||'进行中' }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } }}
          >删除</div>
        </div>, document.body)}
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
        <div data-exp-ctx-menu style={{ position: 'fixed', left: Math.min(ctxMenu.x, window.innerWidth - 140), top: Math.min(ctxMenu.y, window.innerHeight - 90), zIndex: 99999, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { const exp = ctxMenu.exp; setCtxMenu(null); navigateTo('experimentDetail', { experimentId: exp.id, projectId: exp.projectId }); }}
          >实验记录</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { localStorage.setItem('biolab-edit-exp', JSON.stringify(ctxMenu.exp)); onAction('experiment'); setCtxMenu(null); }}
          >修改步骤</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={async () => { const exp = ctxMenu.exp; setCtxMenu(null); try { await exportExperimentToWord(exp); } catch(e:any) { console.error('导出失败:', e); } }}
          >导出文档</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const exp = ctxMenu.exp; setCtxMenu(null); if (await showConfirm('删除实验「' + exp.title + '」？')) { await deleteExperiment(exp.id); await useStore.getState().loadAll(); } }}
          >删除实验</div>
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

  // 方案 1: 同一天的步骤聚合到一个时间节点(共用一个圆点和 D 标签,步骤名纵向堆叠)
  const groupedDays: { day: number; items: any[] }[] = [];
  for (const ms of milestones) {
    const g = groupedDays.find(x => x.day === ms.day);
    if (g) g.items.push(ms); else groupedDays.push({ day: ms.day, items: [ms] });
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
          <div style={{ position: 'absolute', top: -2, height: 6, width: 80, background: 'linear-gradient(90deg, #ffffff, #7dd3fc 30%, transparent)', borderRadius: 3, animation: 'biolabTlLaserRight 1.5s ease-out infinite', filter: 'blur(0.3px)', boxShadow: '0 0 12px rgba(125,211,252,0.9), 0 0 24px rgba(125,211,252,0.5)', pointerEvents: 'none', ['--laser-start' as any]: (() => { const n = groupedDays.length; if (n === 0) return '0%'; let curIdx = -1; for (let i = 0; i < n; i++) { if (daysPassed >= groupedDays[i].day) curIdx = i; else break; } if (curIdx < 0) return '0%'; return ((curIdx + 0.5) / n) * 100 + '%'; })() }} />
        </div>
        <div style={{ position: 'absolute', top: 60, left: 8, height: 2, borderRadius: 1, background: 'linear-gradient(90deg, rgba(125,211,252,0.25), #7dd3fc)', width: (() => { const n = groupedDays.length; if (n === 0) return '0px'; let curIdx = -1; for (let i = 0; i < n; i++) { if (daysPassed >= groupedDays[i].day) curIdx = i; else break; } if (curIdx < 0) return '0px'; const pct = (curIdx + 0.5) / n; return 'calc((100% - 16px) * ' + pct + ')'; })(), transition: 'width 0.6s', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {groupedDays.map((g: any, gi: number) => {
            const isDone = daysPassed >= g.day;
            const isToday = daysPassed === g.day;
            return (
              <div key={gi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, flex: 1, position: 'relative' }}>
{(() => { const nd = new Date((startDate || '2026-01-01') + 'T00:00:00'); nd.setDate(nd.getDate() + g.day); const wd = ['日','一','二','三','四','五','六'][nd.getDay()]; const c = isToday ? '#7dd3fc' : isDone ? 'rgba(125,211,252,0.7)' : '#d0d4dc'; return (<>
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
                <span style={{ fontSize: 11, marginTop: 10, fontVariantNumeric: 'tabular-nums', color: isToday ? '#7dd3fc' : isDone ? 'rgba(125,211,252,0.7)' : '#a0a0a8', fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: '1px solid ' + (isToday ? '#7dd3fc' : isDone ? 'rgba(125,211,252,0.35)' : 'rgba(255,255,255,0.12)'), background: isToday ? 'rgba(125,211,252,0.12)' : isDone ? 'rgba(125,211,252,0.06)' : 'rgba(255,255,255,0.02)' }}>D{g.day}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 6, width: '100%' }}>
                  {g.items.map((ms: any, idx: number) => (
                    <span key={idx} style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.3, color: isToday ? '#f0f0f2' : '#d0d4dc', fontWeight: isToday ? 600 : 500, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}
                      onMouseEnter={(ev: any) => { ev.currentTarget.style.overflow = 'visible'; ev.currentTarget.style.maxWidth = 'none'; ev.currentTarget.style.background = 'rgba(20,24,34,0.95)'; ev.currentTarget.style.borderRadius = '4px'; ev.currentTarget.style.zIndex = '10'; ev.currentTarget.style.padding = '0 4px'; }}
                      onMouseLeave={(ev: any) => { ev.currentTarget.style.overflow = 'hidden'; ev.currentTarget.style.maxWidth = '70px'; ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.zIndex = '0'; ev.currentTarget.style.padding = '0'; }}>{ms.label}</span>
                  ))}
                </div>
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
  const parseSteps = (text: string) => {
    if (!text) return [] as {day:number;name:string;detail:string}[];
    // detail 优先从 parameters.milestones[].detail 读取(新数据);老数据回退到从"-"切分
    let detailMap: Record<number, string> = {};
    let hasNewFormat = false;
    try {
      const tl = JSON.parse(exp?.parameters || '{}');
      (tl.milestones || []).forEach((m: any, i: number) => {
        if (m && m.detail) { detailMap[i] = m.detail; hasNewFormat = true; }
      });
    } catch {}
    return text.split('\n').filter(l => l.trim()).map((line, i) => {
      const m = line.match(/^D(-?\d+):\s*(.+)$/);
      if (m) {
        const rest = m[2].trim();
        if (hasNewFormat || !rest.includes(' - ')) {
          return { day: parseInt(m[1]), name: rest, detail: detailMap[i] || '' };
        }
        // 老数据回退: 第一个 " - " 之前是 name,之后是 detail
        const dashIdx = rest.indexOf(' - ');
        return { day: parseInt(m[1]), name: rest.slice(0, dashIdx).trim(), detail: rest.slice(dashIdx + 3).trim() };
      }
      return { day: 0, name: line, detail: detailMap[i] || '' };
    });
  };
  const stepsList = React.useMemo(() => parseSteps(exp?.steps || ''), [exp?.steps]);

  // Local editable copy of stepsList: 输入时只更新本地,防抖 500ms 后才真正写库
  // 避免每次 keystroke 调 backend + loadAll,导致 input 闪烁/光标丢失/输入被回滚
  const [localSteps, setLocalSteps] = React.useState(stepsList);
  const isLocalEditingRef = React.useRef(false);
  React.useEffect(() => {
    if (isLocalEditingRef.current) return;  // 用户正在编辑时不覆盖
    setLocalSteps(stepsList);
  }, [stepsList]);
  const saveTimerRef = React.useRef<any>(null);
  const scheduleSave = (ns: any[]) => {
    isLocalEditingRef.current = true;
    setLocalSteps(ns);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      isLocalEditingRef.current = false;
      saveSteps(ns);
    }, 500);
  };
  const flushSaveNow = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      isLocalEditingRef.current = false;
      saveSteps(localSteps);
    }
  };
  const [editingStep, setEditingStep] = useState<{si:number; field:'day'|'name'|'detail'; val:string}|null>(null);
  const [addingStep, setAddingStep] = useState<{day:string; name:string; detail:string}|null>(null);
  const commitEditingStep = () => {
    if (!editingStep) return;
    const { si, field, val } = editingStep;
    const ns = [...stepsList];
    if (!ns[si]) { setEditingStep(null); return; }
    if (field === 'day') {
      const d = parseInt(val);
      if (isNaN(d)) { setEditingStep(null); return; }
      ns[si] = { ...ns[si], day: d };
      ns.sort((a, b) => a.day - b.day);
    } else if (field === 'name') {
      if (!val.trim()) { setEditingStep(null); return; }
      ns[si] = { ...ns[si], name: val.trim() };
    } else {
      ns[si] = { ...ns[si], detail: val };
    }
    saveSteps(ns);
    setEditingStep(null);
  };
  const saveSteps = async (newSteps: any[]) => {
    if (!exp) return;
    const stepsText = newSteps.map(s => 'D' + s.day + ': ' + s.name).join('\n');
    const milestones = newSteps.map(s => ({ day: s.day, label: s.name, detail: s.detail || '' }));
    let tl: any = {}; try { tl = JSON.parse(exp.parameters || '{}'); } catch {}
    tl.milestones = milestones;
    tl.duration_days = Math.max(...milestones.map((m: any) => m.day), 0) + 1;
    const params = JSON.stringify(tl);
    try {
      const { invoke: inv } = await import('@tauri-apps/api/core');
      await inv('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: stepsText, parameters: params, results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });
      await useStore.getState().loadAll();
    } catch(e) { console.error('saveSteps failed:', e); }
  };

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



  async function exportWord() {
    if (!exp) return;
    try {
      await exportExperimentToWord(exp);
      return;
    } catch (_e) { /* fallthrough to old path intentionally disabled */ }
    try {
      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
      const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
      const { invoke: inv } = await import('@tauri-apps/api/core');

      const children: any[] = [
        new Paragraph({ children: [new TextRun({ text: exp.title, bold: true, size: 36, font: 'PingFang SC' })], spacing: { after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: (exp.date || '') + ' · ' + (exp.type || ''), size: 20, color: '888888', font: 'PingFang SC' })], spacing: { after: 300 } }),
      ];

      const pushHeading = (title: string) => {
        children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
      };
      const pushTextBlock = (text: string) => {
        for (const line of text.split('\n')) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'PingFang SC' })], spacing: { after: 60, line: 360 } }));
        }
      };
      const pushSection = (title: string, text: string) => {
        if (!text || !text.trim()) return;
        pushHeading(title);
        pushTextBlock(text);
      };

      pushSection('实验目的', exp.purpose || '');
      pushSection('样本材料', exp.materials || '');

      // 实验步骤:从 parameters.milestones 取 day+label+detail,按天数排序
      let milestones: any[] = [];
      try {
        const tl = JSON.parse(exp.parameters || '{}');
        milestones = Array.isArray(tl.milestones) ? tl.milestones : [];
      } catch {}
      const sortedMs = [...milestones].sort((a: any, b: any) => (a.day ?? 0) - (b.day ?? 0));
      if (sortedMs.length > 0) {
        pushHeading('实验步骤');
        for (const m of sortedMs) {
          const stepTitle = 'D' + (m.day ?? 0) + ' · ' + (m.label || '');
          children.push(new Paragraph({ children: [new TextRun({ text: stepTitle, bold: true, size: 24, font: 'PingFang SC' })], spacing: { before: 120, after: 60 } }));
          const detail = (m.detail || '').trim();
          if (detail) {
            for (const line of detail.split('\n')) {
              children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'PingFang SC' })], spacing: { after: 60, line: 360 }, indent: { left: 360 } }));
            }
          }
        }
      } else if (exp.steps && exp.steps.trim()) {
        pushSection('实验步骤', exp.steps);
      }

      pushSection('实验结果', exp.results || '');
      pushSection('结论', exp.conclusion || '');
      pushSection('问题记录', exp.issues || '');
      pushSection('下一步计划', exp.nextSteps || '');

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);

      const savePath = await saveDialog({ defaultPath: exp.title + '.docx', filters: [{ name: 'Word', extensions: ['docx'] }] });
      if (!savePath) return;

      const arrayBuf = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      await inv('write_export_file', { path: savePath, data: base64 });
    } catch (e: any) {
      console.error('导出Word失败:', e);
    }
  }

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
    return (
      <textarea
        className="exp-edit-textarea exp-edit-inline"
        key={`${field}-${content || ''}`}
        defaultValue={content || ''}
        placeholder="点击输入"
        ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
        onInput={(ev) => { const el = ev.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
        onBlur={(ev) => { const val = ev.target.value; if (val !== (content || '')) doSave(field, val); }}
      />
    );
  };

  const activeSec = sections.find(s => s.key === activeSection);

  if (!exp) return null;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="exp-detail-header">
        <div className="flex-1">
          <h1 className="page-title">{exp.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs muted"><Calendar size={12} /> {formatDate(exp.date)} · {exp.type}</span>
            {proj && <span className="text-xs muted">· {proj.name}</span>}
          </div>
        </div>
        <button className="btn" onClick={() => exportWord()}>导出</button>

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
                return (
                  <div>
                    {localSteps.map((step: any, si: number) => {
                      const sameDayAsPrev = si > 0 && localSteps[si-1].day === step.day;
                      const isLast = si === localSteps.length - 1;
                      return (
                      <div key={si} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 8 }}>
                        <div style={{ width: 42, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, visibility: sameDayAsPrev ? 'hidden' : 'visible' }}>
                          {editingStep && editingStep.si === si && editingStep.field === 'day' ? (
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(125,211,252,0.2)', border: '1px solid #7dd3fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <input autoFocus type="text" inputMode="numeric" value={editingStep.val}
                                onChange={ev => setEditingStep({ ...editingStep, val: ev.target.value.replace(/[^0-9]/g, '') })}
                                onBlur={commitEditingStep}
                                onKeyDown={ev => { if (ev.key === 'Enter') commitEditingStep(); if (ev.key === 'Escape') setEditingStep(null); }}
                                style={{ width: 24, background: 'transparent', border: 'none', color: '#7dd3fc', fontSize: 13, outline: 'none', fontWeight: 700, fontFamily: 'inherit', textAlign: 'center', padding: 0 }} />
                            </div>
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(125,211,252,0.12)', border: '1px solid rgba(125,211,252,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                              onClick={() => setEditingStep({ si, field: 'day', val: String(step.day) })}
                              onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.2)'; ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.5)'; }}
                              onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.25)'; }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc' }}>D{step.day}</span>
                            </div>
                          )}
                          {!isLast && <div style={{ width: 1.5, flex: 1, minHeight: 12, background: 'rgba(125,211,252,0.12)', marginTop: 4 }} />}
                        </div>
                        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#222225', marginLeft: 8, border: '1px solid rgba(255,255,255,0.04)', position: 'relative', transition: 'border 0.2s' }}
                          onMouseEnter={ev => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.15)'; const del = ev.currentTarget.querySelector('[data-step-del]') as HTMLElement; if (del) del.style.opacity = '1'; }}
                          onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; const del = ev.currentTarget.querySelector('[data-step-del]') as HTMLElement; if (del) del.style.opacity = '0'; }}>
                          <div style={{ fontSize: 11, color: '#606878', marginBottom: 3 }}>步骤标题</div>
                          <input value={step.name} onChange={ev => { const ns = [...localSteps]; ns[si] = { ...ns[si], name: ev.target.value }; scheduleSave(ns); }} onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; flushSaveNow(); }}
                            onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                            onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#f0f0f2', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }} />
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                          <div style={{ fontSize: 11, color: '#606878', marginBottom: 3 }}>具体操作</div>
                          <textarea value={step.detail || ''} onChange={ev => { const ns = [...localSteps]; ns[si] = { ...ns[si], detail: ev.target.value }; scheduleSave(ns); }} onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; flushSaveNow(); }}
                            onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                            onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            placeholder="暂无具体操作"
                            rows={1} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#8890a0', fontSize: 12, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.6, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                            onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                            ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />
                          <div data-step-del="" title="删除步骤" style={{ position: 'absolute', top: 2, right: 6, width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'all 0.2s', color: '#d0d4dc', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', zIndex: 2 }}
                            onClick={() => { const ns = localSteps.filter((_: any, i: number) => i !== si); flushSaveNow(); saveSteps(ns); setLocalSteps(ns); }}
                            onMouseEnter={ev => { ev.currentTarget.style.color = '#fc8181'; ev.currentTarget.style.background = 'rgba(252,129,129,0.18)'; ev.currentTarget.style.borderColor = '#fc8181'; }}
                            onMouseLeave={ev => { ev.currentTarget.style.color = '#d0d4dc'; ev.currentTarget.style.background = 'rgba(252,129,129,0.08)'; ev.currentTarget.style.borderColor = 'rgba(252,129,129,0.2)'; }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
                        </div>
                      </div>
                      );
                    })}
                    {addingStep && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 8 }}>
                        <div style={{ width: 42, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px dashed rgba(125,211,252,0.4)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input type="text" inputMode="numeric" value={addingStep.day}
                              onChange={ev => setAddingStep({ ...addingStep, day: ev.target.value.replace(/[^0-9]/g, '') })}
                              style={{ width: 24, background: 'transparent', border: 'none', outline: 'none', color: '#7dd3fc', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center', padding: 0 }} />
                          </div>
                        </div>
                        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#222225', marginLeft: 8, border: '1px dashed rgba(125,211,252,0.3)' }}>
                          <div style={{ fontSize: 11, color: '#606878', marginBottom: 3 }}>步骤标题</div>
                          <input autoFocus value={addingStep.name} onChange={ev => setAddingStep({ ...addingStep, name: ev.target.value })}
                            onKeyDown={ev => { if (ev.key === 'Escape') setAddingStep(null); }}
                            onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                            onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                            onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#f0f0f2', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }} />
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                          <div style={{ fontSize: 11, color: '#606878', marginBottom: 3 }}>具体操作</div>
                          <textarea value={addingStep.detail} onChange={ev => setAddingStep({ ...addingStep, detail: ev.target.value })}
                            onFocus={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(125,211,252,0.35)'; ev.currentTarget.style.background = 'rgba(125,211,252,0.04)'; }}
                            onBlur={(ev: any) => { ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                            onMouseEnter={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={(ev: any) => { if (document.activeElement !== ev.currentTarget) ev.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            placeholder="暂无具体操作"
                            rows={1} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', color: '#8890a0', fontSize: 12, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.6, boxSizing: 'border-box', padding: '6px 8px', borderRadius: 4, transition: 'border-color 0.15s, background 0.15s' }}
                            onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                            ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                            <button onClick={() => setAddingStep(null)} style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#d0d4dc', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>取消</button>
                            <button onClick={() => { const d = parseInt(addingStep.day); if (isNaN(d) || !addingStep.name.trim()) return; const ns = [...stepsList, { day: d, name: addingStep.name.trim(), detail: addingStep.detail.trim() }]; ns.sort((a: any, b: any) => a.day - b.day); saveSteps(ns); setAddingStep(null); }} style={{ padding: '5px 14px', background: '#7dd3fc', border: 'none', borderRadius: 4, color: '#0f0f12', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>保存</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {!addingStep && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '4px 0', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                      onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                      onMouseLeave={ev => ev.currentTarget.style.opacity = '0.4'}
                      onClick={() => {
                        const nextDay = String(stepsList.length > 0 ? stepsList[stepsList.length-1].day + 1 : 0);
                        setAddingStep({ day: nextDay, name: '', detail: '' });
                      }}>
                      <div style={{ width: 42, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px dashed #3a3a40', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d0d4dc', fontSize: 14, transition: 'all 0.2s' }}>+</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#d0d4dc', marginLeft: 8 }}>添加步骤</span>
                    </div>
                    )}
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
  const [expSearch, setExpSearch] = useState('');
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

  const filtered = experiments.filter((e: any) => {
    const q = expSearch.trim().toLowerCase();
    if (!q) return true;
    if ((e.title || '').toLowerCase().includes(q)) return true;
    const projName = (projects.find((p: any) => p.id === e.projectId)?.name || '').toLowerCase();
    if (projName.includes(q)) return true;
    return false;
  });

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 220 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0d4dc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" value={expSearch} onChange={e => setExpSearch(e.target.value)} placeholder="搜索实验"
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border 0.2s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(125,211,252,0.35)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
          <div style={{ padding: '6px 16px', borderRadius: 6, background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', color: '#7dd3fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => onAction('experiment')}>+ 新建实验</div>
        </div>
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
          >实验记录</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={() => { localStorage.setItem('biolab-edit-exp', JSON.stringify(expCtxMenu.exp)); onAction('experiment'); setExpCtxMenu(null); }}
          >修改步骤</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={async () => { const exp = expCtxMenu.exp; setExpCtxMenu(null); try { await exportExperimentToWord(exp); } catch(e:any) { console.error('导出失败:', e); } }}
          >导出文档</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const exp = expCtxMenu.exp; setExpCtxMenu(null); if (await showConfirm('删除实验「' + exp.title + '」？')) { await deleteExperiment(exp.id); await useStore.getState().loadAll(); } }}
          >删除实验</div>
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
          <div style={{ position: 'relative', width: 220 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0d4dc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文献"
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border 0.2s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(125,211,252,0.35)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
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
              onClick={async () => { const ref = contextMenu.ref; setContextMenu(null); if (await showConfirm('确定删除文献？')) deleteReference(ref.id); }}
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

  const [userTemplates, setUserTemplates] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('biolab-user-templates') || '[]'); } catch { return []; }
  });
  React.useEffect(() => {
    const reload = () => {
      try { setUserTemplates(JSON.parse(localStorage.getItem('biolab-user-templates') || '[]')); } catch {}
    };
    window.addEventListener('biolab-tpl-updated', reload);
    return () => window.removeEventListener('biolab-tpl-updated', reload);
  }, []);
  const [tplCtxMenu, setTplCtxMenu] = useState<{x:number;y:number;tpl:any}|null>(null);
  const [tplSearch, setTplSearch] = useState('');
  React.useEffect(() => { if (!tplCtxMenu) return; const cl = () => setTplCtxMenu(null); const t = setTimeout(() => { window.addEventListener('click', cl); window.addEventListener('scroll', cl, true); }, 0); return () => { clearTimeout(t); window.removeEventListener('click', cl); window.removeEventListener('scroll', cl, true); }; }, [tplCtxMenu]);

  const deleteTemplate = (id: string) => {
    const updated = userTemplates.filter((t: any) => t.id !== id);
    setUserTemplates(updated);
    localStorage.setItem('biolab-user-templates', JSON.stringify(updated));
  };


  // ── Main view ──
  return (
    <div className="page-container">
            <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <div className="page-title">模板</div>
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
                  <div style={{ fontSize: 10, color: '#8890a0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(lt.steps && lt.steps.length) ? [...lt.steps].filter((s: any) => s && s.name && s.name.trim()).sort((a: any, b: any) => (a.day ?? 0) - (b.day ?? 0)).map((s: any) => 'D' + (s.day ?? 0) + ' ' + s.name).join(' → ') : (lt.desc || '')}</div>
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
            onClick={() => { const lt = tplCtxMenu.tpl; setTplCtxMenu(null); localStorage.setItem('biolab-edit-tpl', JSON.stringify(lt)); onSelectTemplate({ id: lt.id, name: lt.name, fields: { type: lt.cat }, steps: lt.steps }); }}
          >修改模板</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#e8eaed', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(125,211,252,0.12)'; ev.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#e8eaed'; }}
            onClick={async () => { const lt = tplCtxMenu.tpl; setTplCtxMenu(null); try { await exportTemplateToWord(lt); } catch(e:any) { console.error('导出模板失败:', e); } }}
          >导出模板</div>
          <div style={{ padding: '8px 14px', fontSize: 13, color: '#fc8181', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(252,129,129,0.12)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            onClick={async () => { const lt = tplCtxMenu.tpl; setTplCtxMenu(null); if (await showConfirm('删除模板「' + lt.name + '」？')) deleteTemplate(lt.id); }}
          >删除模板</div>
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
        <div><div className="settings-label">关于</div><div className="settings-desc">Lab Data System v{__APP_VERSION__}</div></div>
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


function TopbarTime() {
  const [now, setNow] = useState(new Date());
  const [tz, setTz] = useState(() => localStorage.getItem('biolab-clock-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone);
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const onStorage = () => setTz(localStorage.getItem('biolab-clock-tz') || Intl.DateTimeFormat().resolvedOptions().timeZone);
    window.addEventListener('storage', onStorage);
    const pollTz = setInterval(onStorage, 1000);
    return () => { clearInterval(tick); clearInterval(pollTz); window.removeEventListener('storage', onStorage); };
  }, []);
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const month = tzNow.getMonth() + 1;
  const date = tzNow.getDate();
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][tzNow.getDay()];
  const hh = String(tzNow.getHours()).padStart(2, '0');
  const mm = String(tzNow.getMinutes()).padStart(2, '0');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 14, fontSize: 15, color: '#ffffff', fontFamily: 'Arial, sans-serif', fontVariantNumeric: 'tabular-nums', userSelect: 'none', fontWeight: 700, letterSpacing: '0.02em', textShadow: '0 0 8px rgba(255,255,255,0.25)' }}>
      <span style={{ color: 'inherit', opacity: 1, fontWeight: 'inherit' }}>{month}月{date}日</span>
      <span style={{ color: 'inherit', opacity: 1, fontWeight: 'inherit' }}>{weekday}</span>
      <span style={{ color: 'inherit', opacity: 1, fontWeight: 'inherit' }}>{hh}:{mm}</span>
    </div>
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
    <TopbarTime />
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
        <div style={{ padding: '6px 14px', fontSize: 11, color: '#606068' }}>v{__APP_VERSION__}</div>
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
    { key: 'templates', label: '模板', icon: <LayoutTemplate size={15} /> },
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
          try { playAlarm(); } catch {}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { stopAlarm(); setGlobalTimerDone(false); }}>
          <div className="timer-holo" onClick={e => e.stopPropagation()}>
            <div className="timer-holo-grid" />
            <div className="timer-holo-hex" style={{ top: 10, right: 20 }} />
            <div className="timer-holo-hex" style={{ bottom: 15, left: 15, width: 30, height: 30 }} />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <div className="timer-holo-time">00:00:00</div>
              <div className="timer-holo-bar"><div className="timer-holo-bar-fill" /></div>
              <div className="timer-holo-btn" onClick={() => { stopAlarm(); setGlobalTimerDone(false); }}>确认</div>
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

      
      {showTemplateChooser && <TemplateChooser onSelect={handleSelectTemplate} onClose={() => setShowTemplateChooser(false)} />}
      {showNewExperiment && <NewExperimentModal template={selectedTemplate} onClose={() => { setShowNewExperiment(false); setSelectedTemplate(null); }} defaultProjectId={selectedProjectId || undefined} />}
      {showNewReference && <NewReferenceModal onClose={() => setShowNewReference(false)} />}
    <DialogHost /></div>
  );
}
