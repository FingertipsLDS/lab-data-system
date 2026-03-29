import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  filePath: string;
  title: string;
  onClose: () => void;
}

export function PDFReader({ filePath, title, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const b64: string = await invoke('read_file_base64', { localPath: filePath });
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const raw = atob(base64Data);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        setUrl(URL.createObjectURL(blob));
      } catch (e: any) { setErr(String(e)); }
    })();
  }, [filePath]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99998, display: 'flex', flexDirection: 'column', background: '#111318' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#1a1e28', borderBottom: '1px solid rgba(125,211,252,0.08)', flexShrink: 0 }}>
        <div onClick={onClose} style={{
          padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
          background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.25)',
          color: '#7dd3fc', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
        }}>← 返回</div>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {err ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fc8181', fontSize: 14 }}>{err}</div>
        ) : url ? (
          <object data={url} type="application/pdf" style={{ width: '100%', height: '100%' }}>
            <embed src={url} type="application/pdf" style={{ width: '100%', height: '100%' }} />
          </object>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#718096' }}>加载中...</div>
        )}
      </div>
    </div>
  );
}
