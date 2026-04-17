import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const CMD_KEY_LABEL = IS_MAC ? '⌘' : 'Ctrl';

interface Props {
  filePath: string;
  title: string;
  onClose: () => void;
}

type Hit = { pageIdx: number; spanIdx: number };

// Note = sticky note on a PDF page
// x, y are normalized (0-1) relative to the page
type Note = {
  id: string;
  pageIdx: number;
  x: number;
  y: number;
  text: string;
};

function hashString(s: string): string {
  // djb2 hash + base36,纯 ASCII,稳定,跨平台一致
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const notesKey = (fp: string) => `pdf-notes:${hashString(fp)}`;

function loadNotes(fp: string): Note[] {
  try {
    const raw = localStorage.getItem(notesKey(fp));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotes(fp: string, notes: Note[]) {
  try { localStorage.setItem(notesKey(fp), JSON.stringify(notes)); } catch {}
}

export function PDFReader({ filePath, title, onClose }: Props) {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [currentHitIdx, setCurrentHitIdx] = useState(0);

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteMode, setNoteMode] = useState(false);  // 点击 PDF 会创建便利贴
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const textLayerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pageWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renderTaskTokenRef = useRef(0);

  // Load notes from localStorage on mount / when filePath changes
  useEffect(() => {
    notesInitializedRef.current = false;
    setNotes(loadNotes(filePath));
  }, [filePath]);

  // Persist notes whenever they change (skip initial mount to avoid overwriting with [])
  const notesInitializedRef = useRef(false);
  useEffect(() => {
    if (!notesInitializedRef.current) {
      notesInitializedRef.current = true;
      return;
    }
    saveNotes(filePath, notes);
  }, [filePath, notes]);

  // Load PDF
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const b64: string = await invoke('read_file_base64', { localPath: filePath });
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const raw = atob(base64Data);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const doc = await loadingTask.promise;
        setPdf(doc);
        setNumPages(doc.numPages);
        canvasRefs.current = new Array(doc.numPages).fill(null);
        textLayerRefs.current = new Array(doc.numPages).fill(null);
        pageWrapperRefs.current = new Array(doc.numPages).fill(null);
        setLoading(false);
      } catch (e: any) {
        setErr(String(e));
        setLoading(false);
      }
    })();
  }, [filePath]);

  // Render all pages (canvas + textLayer)
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    const myToken = ++renderTaskTokenRef.current;
    (async () => {
      const hiResScale = scale * 3;
      for (let i = 1; i <= numPages; i++) {
        if (cancelled || myToken !== renderTaskTokenRef.current) return;
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: hiResScale });
          const displayViewport = page.getViewport({ scale });
          const canvas = canvasRefs.current[i - 1];
          if (!canvas) continue;
          const ctx = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = displayViewport.width + 'px';
          canvas.style.height = displayViewport.height + 'px';
          await page.render({ canvasContext: ctx, viewport }).promise;

          const textLayerDiv = textLayerRefs.current[i - 1];
          if (textLayerDiv) {
            textLayerDiv.innerHTML = '';
            textLayerDiv.style.width = displayViewport.width + 'px';
            textLayerDiv.style.height = displayViewport.height + 'px';
            textLayerDiv.style.setProperty('--scale-factor', String(scale));
            const textContent = await page.getTextContent();
            try {
              const task = (pdfjsLib as any).renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: displayViewport,
                textDivs: [],
              });
              await (task.promise || task);
            } catch (_err) {
              const items = textContent.items as any[];
              for (const item of items) {
                const span = document.createElement('span');
                span.textContent = item.str;
                span.style.position = 'absolute';
                const tx = pdfjsLib.Util.transform(displayViewport.transform, item.transform);
                const fontHeight = Math.hypot(tx[2], tx[3]);
                span.style.left = tx[4] + 'px';
                span.style.top = (tx[5] - fontHeight) + 'px';
                span.style.fontSize = fontHeight + 'px';
                span.style.whiteSpace = 'pre';
                textLayerDiv.appendChild(span);
              }
            }
          }
        } catch (e: any) {
          if (e?.name !== 'RenderingCancelledException') console.error(e);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, numPages, scale]);

  // --- Search ---
  const runSearch = useCallback((query: string) => {
    const q = query.trim().toLowerCase();
    for (const layer of textLayerRefs.current) {
      if (!layer) continue;
      layer.querySelectorAll('mark.pdf-mark').forEach(el => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      });
    }
    if (!q) { setHits([]); setCurrentHitIdx(0); return; }

    const newHits: Hit[] = [];
    for (let p = 0; p < textLayerRefs.current.length; p++) {
      const layer = textLayerRefs.current[p];
      if (!layer) continue;
      const spans = layer.querySelectorAll('span');
      spans.forEach((span, si) => {
        const text = span.textContent || '';
        const lower = text.toLowerCase();
        if (!lower.includes(q)) return;
        const parts: Node[] = [];
        let cursor = 0;
        let found = lower.indexOf(q, cursor);
        while (found !== -1) {
          if (found > cursor) parts.push(document.createTextNode(text.slice(cursor, found)));
          const mark = document.createElement('mark');
          mark.className = 'pdf-mark pdf-search-hit';
          mark.textContent = text.slice(found, found + q.length);
          parts.push(mark);
          cursor = found + q.length;
          found = lower.indexOf(q, cursor);
          newHits.push({ pageIdx: p, spanIdx: si });
        }
        if (cursor < text.length) parts.push(document.createTextNode(text.slice(cursor)));
        span.innerHTML = '';
        parts.forEach(n => span.appendChild(n));
      });
    }
    setHits(newHits);
    setCurrentHitIdx(newHits.length > 0 ? 0 : -1);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    runSearch(searchQuery);
  }, [searchQuery, searchOpen, runSearch, numPages, scale]);

  useEffect(() => {
    if (searchOpen) return;
    for (const layer of textLayerRefs.current) {
      if (!layer) continue;
      layer.querySelectorAll('mark.pdf-mark').forEach(el => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      });
    }
    setHits([]);
    setCurrentHitIdx(0);
  }, [searchOpen]);

  useEffect(() => {
    document.querySelectorAll('.pdf-search-hit-current').forEach(el => el.classList.remove('pdf-search-hit-current'));
    if (currentHitIdx < 0 || currentHitIdx >= hits.length) return;
    let counter = 0;
    for (let p = 0; p < textLayerRefs.current.length; p++) {
      const layer = textLayerRefs.current[p];
      if (!layer) continue;
      const marks = layer.querySelectorAll('mark.pdf-mark');
      for (const mark of Array.from(marks)) {
        if (counter === currentHitIdx) {
          mark.classList.add('pdf-search-hit-current');
          (mark as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        counter++;
      }
    }
  }, [currentHitIdx, hits]);

  const gotoNext = () => {
    if (hits.length === 0) return;
    setCurrentHitIdx(i => (i + 1) % hits.length);
  };
  const gotoPrev = () => {
    if (hits.length === 0) return;
    setCurrentHitIdx(i => (i - 1 + hits.length) % hits.length);
  };

  // --- Notes ---
  const addNoteAtClick = (pageIdx: number, clientX: number, clientY: number) => {
    const wrapper = pageWrapperRefs.current[pageIdx];
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    const id = 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const newNote: Note = { id, pageIdx, x, y, text: '' };
    setNotes(ns => [...ns, newNote]);
    setNoteMode(false);
    setEditingNoteId(id);
  };

  const updateNoteText = (id: string, text: string) => {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, text } : n));
  };

  const deleteNote = (id: string) => {
    setNotes(ns => ns.filter(n => n.id !== id));
    if (editingNoteId === id) setEditingNoteId(null);
  };

  // Drag a note to a new location
  const dragStateRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; wrapperRect: DOMRect } | null>(null);

  const onNoteDragStart = (e: React.MouseEvent, note: Note, onClickFallback?: () => void) => {
    e.stopPropagation();
    const wrapper = pageWrapperRefs.current[note.pageIdx];
    if (!wrapper) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    dragStateRef.current = {
      id: note.id,
      startX,
      startY,
      origX: note.x,
      origY: note.y,
      wrapperRect: wrapper.getBoundingClientRect(),
    };
    const onMove = (ev: MouseEvent) => {
      const st = dragStateRef.current;
      if (!st) return;
      const pxDx = ev.clientX - startX;
      const pxDy = ev.clientY - startY;
      if (!moved && Math.hypot(pxDx, pxDy) > 4) moved = true;
      if (!moved) return;
      const dx = pxDx / st.wrapperRect.width;
      const dy = pxDy / st.wrapperRect.height;
      const nx = Math.max(0, Math.min(1, st.origX + dx));
      const ny = Math.max(0, Math.min(1, st.origY + dy));
      setNotes(ns => ns.map(n => n.id === st.id ? { ...n, x: nx, y: ny } : n));
    };
    const onUp = () => {
      dragStateRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!moved && onClickFallback) onClickFallback();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;

      if (cmd && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }

      if (e.key === 'Escape') {
        if (editingNoteId) { setEditingNoteId(null); return; }
        if (noteMode) { setNoteMode(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        onClose();
        return;
      }

      if (searchOpen && document.activeElement === searchInputRef.current) {
        if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? gotoPrev() : gotoNext(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); gotoNext(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); gotoPrev(); return; }
      }

      if (cmd && (e.key === '=' || e.key === '+')) { e.preventDefault(); setScale(s => Math.min(4, s + 0.2)); }
      else if (cmd && e.key === '-') { e.preventDefault(); setScale(s => Math.max(0.4, s - 0.2)); }
      else if (cmd && e.key === '0') { e.preventDefault(); setScale(1.2); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [searchOpen, hits.length, noteMode, editingNoteId, onClose]);

  const zoomIn = () => setScale(s => Math.min(4, s + 0.2));
  const zoomOut = () => setScale(s => Math.max(0.4, s - 0.2));

  const btn: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
    background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.2)',
    color: '#7dd3fc', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, userSelect: 'none',
  };

  const iconBtn = (active: boolean): React.CSSProperties => ({
    cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: active ? '#a5e4ff' : '#7dd3fc', transition: 'all 0.2s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99998, display: 'flex', flexDirection: 'column', background: '#111318', cursor: noteMode ? 'crosshair' : 'default' }}>
      <style>{`
        .pdf-page-wrapper { position: relative; }
        .pdf-text-layer {
          position: absolute; inset: 0; overflow: hidden; line-height: 1;
          color: transparent; user-select: text;
          -webkit-user-select: text; opacity: 1;
        }
        .pdf-text-layer > span, .pdf-text-layer > br {
          color: transparent; position: absolute; white-space: pre;
          cursor: text; transform-origin: 0% 0%;
        }
        .pdf-text-layer ::selection { background: rgba(125,211,252,0.35); }
        mark.pdf-mark {
          background: rgba(253, 224, 71, 0.55); color: transparent;
          border-radius: 2px; padding: 0; margin: 0;
          box-shadow: 0 0 0 1px rgba(253, 224, 71, 0.3);
        }
        mark.pdf-search-hit-current {
          background: rgba(251, 146, 60, 0.75) !important;
          box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.85), 0 0 12px rgba(251, 146, 60, 0.5) !important;
        }
        .pdf-note-pin {
          position: absolute; z-index: 3;
          display: flex; align-items: center; gap: 6px;
          background: rgba(253, 224, 71, 0.92); color: #1a1e28;
          padding: 4px 8px; border-radius: 6px;
          font-size: 11px; font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px rgba(161, 98, 7, 0.3);
          cursor: grab; user-select: none;
          max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .pdf-note-pin:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4), 0 0 0 2px rgba(253, 224, 71, 0.5);
        }
        .pdf-note-pin:active { cursor: grabbing; }
        .pdf-note-editor {
          position: absolute; z-index: 4; width: 240px;
          background: #fef3c7; color: #1a1e28;
          border-radius: 8px; padding: 0 10px 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(161, 98, 7, 0.3);
        }
        .pdf-note-editor textarea {
          width: 100%; min-height: 60px; resize: none; overflow: hidden;
          border: none; outline: none; background: transparent;
          color: #1a1e28; font-family: inherit; font-size: 13px; line-height: 1.5;
          padding: 0; box-sizing: border-box;
        }
        .pdf-note-editor-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 4px; padding: 6px 0 4px;
          border-bottom: 1px solid rgba(161, 98, 7, 0.18); margin-bottom: 8px;
          cursor: grab; user-select: none;
        }
        .pdf-note-editor-toolbar:active { cursor: grabbing; }
        .pdf-note-editor-handle {
          flex: 1; display: flex; align-items: center; gap: 4px;
          color: #92400e; font-size: 11px; font-weight: 600;
        }
        .pdf-note-editor-handle .pdf-note-dots {
          display: flex; gap: 2px; opacity: 0.5;
        }
        .pdf-note-editor-handle .pdf-note-dots span {
          width: 3px; height: 3px; border-radius: 50%; background: #92400e;
        }
        .pdf-note-editor-actions { display: flex; gap: 2px; }
        .pdf-note-btn {
          background: transparent; border: none; cursor: pointer;
          padding: 2px; display: flex; align-items: center;
          color: #78350f; opacity: 0.7; transition: opacity 0.15s;
        }
        .pdf-note-btn:hover { opacity: 1; }
        .pdf-note-btn.danger:hover { color: #b91c1c; }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#1a1e28', borderBottom: '1px solid rgba(125,211,252,0.08)', flexShrink: 0 }}>
        <div onClick={onClose} style={{ ...btn, padding: '6px 14px' }}>← 返回</div>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8 }}>{title}</div>

        {/* Note toggle */}
        <div onClick={() => setNoteMode(v => !v)} title={noteMode ? '点击 PDF 放置便利贴 (Esc 取消)' : '添加便利贴'}
          style={iconBtn(noteMode)}
          onMouseEnter={e => { e.currentTarget.style.color = '#a5e4ff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = noteMode ? '#a5e4ff' : '#7dd3fc'; e.currentTarget.style.transform = 'scale(1)'; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/>
            <polyline points="16 3 16 8 21 8"/>
            <line x1="8" y1="13" x2="14" y2="13"/>
            <line x1="8" y1="17" x2="12" y2="17"/>
          </svg>
        </div>

        {/* Search toggle */}
        <div onClick={() => { setSearchOpen(v => !v); setTimeout(() => searchInputRef.current?.focus(), 0); }} title={`搜索 (${CMD_KEY_LABEL}F)`}
          style={iconBtn(searchOpen)}
          onMouseEnter={e => { e.currentTarget.style.color = '#a5e4ff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = searchOpen ? '#a5e4ff' : '#7dd3fc'; e.currentTarget.style.transform = 'scale(1)'; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>

        <div onClick={zoomOut} title={`缩小 (${CMD_KEY_LABEL} -)`} style={iconBtn(false)}
          onMouseEnter={e => { e.currentTarget.style.color = '#a5e4ff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#7dd3fc'; e.currentTarget.style.transform = 'scale(1)'; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
        <div onClick={zoomIn} title={`放大 (${CMD_KEY_LABEL} +)`} style={iconBtn(false)}
          onMouseEnter={e => { e.currentTarget.style.color = '#a5e4ff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#7dd3fc'; e.currentTarget.style.transform = 'scale(1)'; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#14181f', borderBottom: '1px solid rgba(125,211,252,0.06)', flexShrink: 0 }}>
          <input ref={searchInputRef} autoFocus value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`在 PDF 内搜索 (${CMD_KEY_LABEL}F)`}
            style={{ flex: '0 1 320px', padding: '6px 10px', fontSize: 13, background: '#0b0e14', border: '1px solid rgba(125,211,252,0.2)', borderRadius: 6, color: '#f1f5f9', outline: 'none' }}
          />
          <div style={{ fontSize: 12, color: '#8892a0', minWidth: 60, textAlign: 'center' }}>
            {hits.length === 0 ? (searchQuery ? '无结果' : '') : `${currentHitIdx + 1} / ${hits.length}`}
          </div>
          <div onClick={gotoPrev} title="上一个 (Shift+Enter / ↑)"
            style={{ cursor: hits.length ? 'pointer' : 'not-allowed', padding: 4, color: hits.length ? '#7dd3fc' : '#4a5060', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </div>
          <div onClick={gotoNext} title="下一个 (Enter / ↓)"
            style={{ cursor: hits.length ? 'pointer' : 'not-allowed', padding: 4, color: hits.length ? '#7dd3fc' : '#4a5060', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div onClick={() => setSearchOpen(false)} title="关闭 (Esc)"
            style={{ cursor: 'pointer', padding: 4, color: '#8892a0', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
      )}

      {/* Note mode hint bar */}
      {noteMode && (
        <div style={{ padding: '6px 16px', background: 'rgba(253, 224, 71, 0.08)', borderBottom: '1px solid rgba(253, 224, 71, 0.2)', fontSize: 12, color: '#fde68a', textAlign: 'center' }}>
          点击 PDF 任意位置放置便利贴 · 按 Esc 取消
        </div>
      )}

      {/* PDF scroll container */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, gap: 16, background: '#0a0a0f' }}>
        {err ? (
          <div style={{ color: '#fc8181', fontSize: 14, padding: 40 }}>{err}</div>
        ) : loading ? (
          <div style={{ color: '#718096', fontSize: 14, padding: 40 }}>加载中...</div>
        ) : (
          Array.from({ length: numPages }).map((_, i) => (
            <div key={i} className="pdf-page-wrapper"
              ref={el => { pageWrapperRefs.current[i] = el; }}
              onClick={(e) => {
                if (!noteMode) return;
                if ((e.target as HTMLElement).closest('.pdf-note-pin, .pdf-note-editor')) return;
                addNoteAtClick(i, e.clientX, e.clientY);
              }}
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)', borderRadius: 4, background: '#fff' }}>
              <canvas ref={el => { canvasRefs.current[i] = el; }} style={{ display: 'block', borderRadius: 4 }} />
              <div className="pdf-text-layer" ref={el => { textLayerRefs.current[i] = el; }} />

              {/* Notes on this page */}
              {notes.filter(n => n.pageIdx === i).map(note => {
                const isEditing = editingNoteId === note.id;
                const preview = note.text.trim();
                const displayText = preview ? (preview.slice(0, 8) + (preview.length > 8 ? '…' : '')) : '空便签';
                return isEditing ? (
                  <div key={note.id} className="pdf-note-editor"
                    style={{ left: `calc(${note.x * 100}% )`, top: `calc(${note.y * 100}% )`, transform: 'translate(-8px, -8px)' }}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}>
                    <div className="pdf-note-editor-toolbar" onMouseDown={e => { e.preventDefault(); onNoteDragStart(e, note); }}>
                      <div className="pdf-note-editor-handle">
                        <span>便签</span>
                      </div>
                      <div className="pdf-note-editor-actions" onMouseDown={e => e.stopPropagation()}>
                        <button className="pdf-note-btn danger" title="删除"
                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); deleteNote(note.id); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                        <button className="pdf-note-btn" title="完成"
                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setEditingNoteId(null); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                      </div>
                    </div>
                    <textarea autoFocus value={note.text}
                      onChange={e => updateNoteText(note.id, e.target.value)}
                      onBlur={() => setEditingNoteId(null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          setEditingNoteId(null);
                        }
                      }}
                      onInput={(ev: any) => { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }}
                      ref={(el: any) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                      rows={3}
                      placeholder="输入便签内容…(Enter 保存 · Shift+Enter 换行)"
                    />
                  </div>
                ) : (
                  <div key={note.id} className="pdf-note-pin"
                    style={{ left: `calc(${note.x * 100}% )`, top: `calc(${note.y * 100}% )`, transform: 'translate(-8px, -8px)' }}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => { e.preventDefault(); onNoteDragStart(e, note, () => setEditingNoteId(note.id)); }}
                    title={preview || '空便签'}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/>
                      <polyline points="16 3 16 8 21 8"/>
                    </svg>
                    <span>{displayText}</span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
