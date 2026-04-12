// @ts-nocheck
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Trash2 } from 'lucide-react';

const IMG_EXTS = ['png','jpg','jpeg','gif','bmp','webp','svg'];

interface Props {
  experimentId: string;
  projectId: string;
  files: any[];
  onFilesChanged: () => void;
  showConfirm?: (msg: string) => Promise<boolean>;
}

export function FileUploadZone({ experimentId, projectId, files, onFilesChanged, showConfirm }: Props) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [imgCache, setImgCache] = useState<Record<string, string>>({});
  const [dataDir, setDataDir] = useState('');

  // Get data directory on mount
  useEffect(() => {
    invoke<string>('get_data_dir').then(d => setDataDir(d)).catch(() => {});
  }, []);

  function isImage(f: any): boolean {
    const ext = (f.file_type || f.fileType || f.name?.split('.').pop() || '').toLowerCase();
    return IMG_EXTS.includes(ext);
  }

  // Load images when files or dataDir change
  useEffect(() => {
    if (!dataDir) return;
    files.filter(isImage).forEach(async (f: any) => {
      if (imgCache[f.id]) return;
      const lp = f.local_path || f.localPath || '';
      if (!lp) return;
      // Build full absolute path
      const fullPath = lp.startsWith('/') ? lp : dataDir + '/' + lp;
      try {
        const dataUrl = await invoke<string>('read_file_base64', { localPath: fullPath });
        setImgCache(prev => ({ ...prev, [f.id]: dataUrl }));
      } catch (e) {
        console.error('Failed to load image:', f.name, fullPath, e);
      }
    });
  }, [files, dataDir]);

  async function pickFiles() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ multiple: true, title: '选择文件' });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (!paths.length) return;
      setUploading(true);
      try {
        await invoke('import_files_to_experiment', { experimentId, projectId, filePaths: paths });
        onFilesChanged();
      } catch (e: any) { alert('导入失败: ' + e); }
      finally { setUploading(false); }
    } catch (e) { console.error(e); }
  }

  async function deleteFile(fileId: string, _fileName?: string) {
    try {
      await invoke('delete_experiment_file', { fileId });
      // Remove from cache
      setImgCache(prev => { const n = {...prev}; delete n[fileId]; return n; });
      onFilesChanged();
    } catch (e: any) { alert('删除失败: ' + e); }
  }

  const images = files.filter(isImage);
  const others = files.filter(f => !isImage(f));

  return (
    <div>
      {/* Upload area */}
      <div onClick={pickFiles} style={{
        border: '1px dashed rgba(99,179,237,0.2)', borderRadius: 8,
        padding: 14, textAlign: 'center', cursor: 'pointer',
        background: 'rgba(99,179,237,0.02)', transition: 'all 0.3s', marginBottom: 10,
      }}>
        <div style={{ color: '#718096', fontSize: 13 }}>{uploading ? '导入中...' : '点击选择文件'}</div>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {images.map((f: any) => {
            const src = imgCache[f.id];
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {src ? (
                  <img src={src} onClick={() => setLightbox(src)} style={{ width: 50, height: 50, borderRadius: 4, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} alt="" />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: 4, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#4a5568' }}>加载中</div>
                )}
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#a0aec0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || f.original_name || f.originalName}</div>
                <div onClick={async () => { if (showConfirm ? await showConfirm('删除该文件？') : confirm('删除该文件？')) deleteFile(f.id, f.name); }} style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(252,80,80,0.15)', border: '1px solid rgba(252,80,80,0.25)', color: '#fc8181', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>删除</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Other files */}
      {others.map((f: any) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 16 }}>📎</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
          </div>
          <Trash2 size={13} style={{ cursor: 'pointer', color: '#718096', flexShrink: 0 }} onClick={async () => { if (showConfirm ? await showConfirm('删除该文件？') : confirm('删除该文件？')) deleteFile(f.id, f.name); }} />
        </div>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, cursor: 'zoom-out',
        }}>
          <img src={lightbox} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} alt="" />
        </div>
      )}
    </div>
  );
}
