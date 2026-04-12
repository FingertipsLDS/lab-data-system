import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
  filePath: string;
  title: string;
  onClose: () => void;
}

export function PDFReader({ filePath, title, onClose }: Props) {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

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
        setLoading(false);
      } catch (e: any) {
        setErr(String(e));
        setLoading(false);
      }
    })();
  }, [filePath]);

  // Render all pages when pdf loaded or scale changes
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      // 3x 超清渲染
      const hiResScale = scale * 3;
      for (let i = 1; i <= numPages; i++) {
        if (cancelled) return;
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: hiResScale });
          const displayViewport = page.getViewport({ scale });
          const canvas = canvasRefs.current[i - 1];
          if (!canvas) continue;
          const ctx = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // Display size is scale,  internal bitmap is 3x for sharpness
          canvas.style.width = displayViewport.width + 'px';
          canvas.style.height = displayViewport.height + 'px';
          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch (e: any) {
          if (e?.name !== 'RenderingCancelledException') console.error(e);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, numPages, scale]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setScale(s => Math.min(4, s + 0.2)); }
      else if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); setScale(s => Math.max(0.4, s - 0.2)); }
      else if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); setScale(1.2); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const zoomIn = () => setScale(s => Math.min(4, s + 0.2));
  const zoomOut = () => setScale(s => Math.max(0.4, s - 0.2));

  const btn: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
    background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.2)',
    color: '#7dd3fc', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, userSelect: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99998, display: 'flex', flexDirection: 'column', background: '#111318' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#1a1e28', borderBottom: '1px solid rgba(125,211,252,0.08)', flexShrink: 0 }}>
        <div onClick={onClose} style={{ ...btn, padding: '6px 14px' }}>← 返回</div>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8 }}>{title}</div>
        <div onClick={zoomOut} title="缩小 (Cmd -)" style={{ cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7dd3fc', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#a5e4ff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#7dd3fc'; e.currentTarget.style.transform = 'scale(1)'; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
        <div onClick={zoomIn} title="放大 (Cmd +)" style={{ cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7dd3fc', transition: 'all 0.2s' }}
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

      {/* PDF scroll container */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, gap: 16, background: '#0a0a0f' }}>
        {err ? (
          <div style={{ color: '#fc8181', fontSize: 14, padding: 40 }}>{err}</div>
        ) : loading ? (
          <div style={{ color: '#718096', fontSize: 14, padding: 40 }}>加载中...</div>
        ) : (
          Array.from({ length: numPages }).map((_, i) => (
            <canvas
              key={i}
              ref={el => { canvasRefs.current[i] = el; }}
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)', borderRadius: 4, background: '#fff' }}
            />
          ))
        )}
      </div>
    </div>
  );
}
