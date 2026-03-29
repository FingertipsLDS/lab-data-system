#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修复中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Clone experiment — add feedback: alert + reload
old_clone = '''(async () => { const s = useStore.getState(); const e = s.experiments.find((x: any) => x.id === exp.id); if (e) await s.addExperiment({ projectId: e.projectId, title: e.title + " (副本)", type: e.type, date: new Date().toISOString().slice(0,10), purpose: e.purpose, materials: e.materials, steps: e.steps, parameters: "", results: "", conclusion: "", issues: "", nextSteps: "", status: "进行中" } as any); })();'''

new_clone = '''(async () => { const s = useStore.getState(); const e = s.experiments.find((x: any) => x.id === exp.id); if (e) { await s.addExperiment({ projectId: e.projectId, title: e.title + " (副本)", type: e.type, date: new Date().toISOString().slice(0,10), purpose: e.purpose, materials: e.materials, steps: e.steps, parameters: "", results: "", conclusion: "", issues: "", nextSteps: "", status: "进行中" } as any); await s.loadAll(); alert("复制成功"); } })();'''

c = c.replace(old_clone, new_clone)
print("  ✓ 复制实验添加反馈")

# 2. Make experiment title editable — add click-to-edit on title
old_title = '<h1 className="page-title">{exp.title}</h1>'
new_title = '''<h1 className="page-title" style={{ cursor: 'text' }} onClick={async () => { const newTitle = prompt('修改实验名称', exp.title); if (newTitle && newTitle !== exp.title) { try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: exp.id, title: newTitle, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: exp.parameters||'', results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } } }}>{exp.title}</h1>'''

c = c.replace(old_title, new_title)
print("  ✓ 实验标题可点击修改")

with open('src/App.tsx', 'w') as f:
    f.write(c)

# 3. Fix FileUploadZone — check actual DB file paths
import sqlite3, os, glob
db_dir = os.path.expanduser("~/Library/Application Support/com.liuyedao.biolab")
dbs = glob.glob(db_dir + "/*.db")
if dbs:
    conn = sqlite3.connect(dbs[0])
    rows = conn.execute("SELECT id, name, local_path, file_type FROM experiment_files LIMIT 3").fetchall()
    for r in rows:
        print(f"  DB file: name={r[1]} path={r[2]} type={r[3]}")
        # Check if file exists
        full = os.path.join(db_dir, r[2]) if r[2] and not r[2].startswith('/') else r[2]
        if full:
            print(f"    exists at {full}: {os.path.exists(full) if full else 'N/A'}")
            # Try absolute
            if r[2] and r[2].startswith('/'):
                print(f"    absolute exists: {os.path.exists(r[2])}")
    conn.close()
PYEOF

# 4. Rewrite FileUploadZone with robust image handling
cat > src/components/FileUploadZone.tsx << 'FEOF'
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Trash2 } from 'lucide-react';

const IMG_EXTS = ['png','jpg','jpeg','gif','bmp','webp','tiff','svg'];

interface Props {
  experimentId: string;
  projectId: string;
  files: any[];
  onFilesChanged: () => void;
}

export function FileUploadZone({ experimentId, projectId, files, onFilesChanged }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dataDir, setDataDir] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>('get_data_dir').then(d => { setDataDir(d); console.log('DataDir:', d); });
  }, []);

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

  async function deleteFile(fileId: string, fileName: string) {
    if (!confirm('删除 "' + fileName + '"？')) return;
    try { await invoke('delete_experiment_file', { fileId }); onFilesChanged(); }
    catch (e: any) { alert('删除失败: ' + e); }
  }

  function buildSrc(localPath: string): string {
    if (!localPath) return '';
    let full = localPath;
    if (!localPath.startsWith('/') && dataDir) {
      full = dataDir + '/' + localPath;
    }
    // Tauri asset protocol
    return 'asset://localhost' + full;
  }

  function isImage(f: any): boolean {
    const ext = (f.file_type || f.name?.split('.').pop() || '').toLowerCase();
    return IMG_EXTS.includes(ext);
  }

  const images = files.filter(isImage);
  const others = files.filter(f => !isImage(f));

  return (
    <div>
      <div onClick={pickFiles} style={{
        border: '1px dashed rgba(99,179,237,0.2)', borderRadius: 8,
        padding: 14, textAlign: 'center', cursor: 'pointer',
        background: 'rgba(99,179,237,0.02)', transition: 'all 0.3s', marginBottom: 10,
      }}>
        <div style={{ color: '#718096', fontSize: 13 }}>{uploading ? '导入中...' : '点击选择文件'}</div>
      </div>

      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 10 }}>
          {images.map((f: any) => {
            const src = buildSrc(f.local_path);
            return (
              <div key={f.id} style={{
                position: 'relative', borderRadius: 6, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                background: '#131820', aspectRatio: '1',
              }} onClick={() => src && setLightbox(src)}>
                {src && <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""
                  onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; }}
                />}
                <div style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                  borderRadius: '50%', background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                onMouseOut={e => (e.currentTarget.style.opacity = '0')}
                onClick={e => { e.stopPropagation(); deleteFile(f.id, f.name); }}>
                  <Trash2 size={10} color="#fc8181" />
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 6px', background: 'rgba(0,0,0,0.6)', fontSize: 10, color: '#a0aec0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name || f.original_name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {others.map((f: any) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 16 }}>📎</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#90cdf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
          </div>
          <Trash2 size={13} style={{ cursor: 'pointer', color: '#4a5568', flexShrink: 0 }} onClick={() => deleteFile(f.id, f.name)} />
        </div>
      ))}

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
FEOF

echo "  ✓ FileUploadZone 重写完成"

# 5. Ensure capabilities have asset protocol
python3 << 'PYEOF2'
import json

with open('src-tauri/capabilities/default.json', 'r') as f:
    cap = json.load(f)

perms = cap.get('permissions', [])
needs = ['fs:default', 'asset:default']
for n in needs:
    if n not in perms:
        perms.append(n)
        print(f"  ✓ 添加权限 {n}")

cap['permissions'] = perms
with open('src-tauri/capabilities/default.json', 'w') as f:
    json.dump(cap, f, indent=2, ensure_ascii=False)
PYEOF2

echo "✅ 完成"
