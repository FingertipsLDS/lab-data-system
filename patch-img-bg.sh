#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修复图片预览和背景动画..."

# 1. Fix BioBackground - make sure it renders with proper pointer-events
python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Make sure BioBackground is right after the app div opens
# and the app div has position relative
if '<div className="app"><BioBackground />' in c:
    # It's there, good. Let's make sure content has z-index
    pass

# Check if background component exists
import os
if not os.path.exists('src/components/BioBackground.tsx'):
    print("  ⚠ BioBackground.tsx 不存在，需要重新创建")
else:
    print("  ✓ BioBackground.tsx 存在")

with open('src/App.tsx', 'w') as f:
    f.write(c)
PYEOF

# 2. Rewrite BioBackground with guaranteed rendering
cat > src/components/BioBackground.tsx << 'BGEOF'
import { useEffect, useRef } from 'react';

export function BioBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    interface P { x: number; y: number; vx: number; vy: number; type: number; size: number; op: number; rot: number; }
    const ps: P[] = [];
    const count = Math.min(20, Math.floor((w * h) / 50000));

    for (let i = 0; i < count; i++) {
      ps.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        type: i % 5, size: 18 + Math.random() * 28,
        op: 0.03 + Math.random() * 0.04, rot: Math.random() * Math.PI * 2,
      });
    }

    function drawCell(c: CanvasRenderingContext2D, p: P) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#63b3ed'; c.lineWidth = 0.8;
      c.beginPath(); c.ellipse(0, 0, p.size * 0.5, p.size * 0.35, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(2, -2, p.size * 0.12, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    function drawDNA(c: CanvasRenderingContext2D, p: P) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#63b3ed'; c.lineWidth = 0.7;
      for (let i = 0; i < p.size; i += 2) {
        const x = i - p.size / 2;
        const y1 = Math.sin(i * 0.25 + p.rot) * 5;
        const y2 = Math.sin(i * 0.25 + p.rot + Math.PI) * 5;
        c.beginPath(); c.arc(x, y1, 0.7, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(x, y2, 0.7, 0, Math.PI * 2); c.stroke();
        if (i % 5 === 0) { c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y2); c.stroke(); }
      }
      c.restore();
    }
    function drawMol(c: CanvasRenderingContext2D, p: P) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#63b3ed'; c.lineWidth = 0.7;
      const pts = [{x:0,y:0},{x:p.size*0.3,y:-p.size*0.2},{x:-p.size*0.2,y:-p.size*0.15},{x:p.size*0.1,y:p.size*0.25}];
      for (let i = 1; i < pts.length; i++) { c.beginPath(); c.moveTo(pts[0].x, pts[0].y); c.lineTo(pts[i].x, pts[i].y); c.stroke(); }
      pts.forEach(a => { c.beginPath(); c.arc(a.x, a.y, 1.8, 0, Math.PI * 2); c.stroke(); });
      c.restore();
    }
    function drawProt(c: CanvasRenderingContext2D, p: P) {
      c.save(); c.translate(p.x, p.y); c.globalAlpha = p.op;
      c.strokeStyle = '#63b3ed'; c.lineWidth = 0.7;
      const r = p.size * 0.18;
      [{x:0,y:0},{x:r,y:-r*0.5},{x:-r*0.7,y:-r*0.3},{x:r*0.3,y:r*0.6}].forEach(o => {
        c.beginPath(); c.arc(o.x, o.y, r, 0, Math.PI * 2); c.stroke();
      });
      c.restore();
    }
    function drawAb(c: CanvasRenderingContext2D, p: P) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#63b3ed'; c.lineWidth = 0.8;
      const h = p.size * 0.4;
      c.beginPath(); c.moveTo(0, h); c.lineTo(0, 0); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-h * 0.5, -h * 0.5); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(h * 0.5, -h * 0.5); c.stroke();
      c.beginPath(); c.arc(-h * 0.5, -h * 0.5, 1.5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(h * 0.5, -h * 0.5, 1.5, 0, Math.PI * 2); c.stroke();
      c.restore();
    }

    const draws = [drawCell, drawDNA, drawMol, drawProt, drawAb];
    let raf: number;

    function loop() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const mx = mouseRef.current.x, my = mouseRef.current.y;

      ps.forEach(p => {
        const dx = p.x - mx, dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 100 && d > 0) { p.vx += (dx / d) * 0.08; p.vy += (dy / d) * 0.08; }
        p.vx *= 0.995; p.vy *= 0.995;
        p.x += p.vx; p.y += p.vy; p.rot += 0.001;
        if (p.x < -50) p.x = w + 50;
        if (p.x > w + 50) p.x = -50;
        if (p.y < -50) p.y = h + 50;
        if (p.y > h + 50) p.y = -50;
        draws[p.type](ctx, p);
      });
      raf = requestAnimationFrame(loop);
    }
    loop();

    const onResize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w; canvas.height = h; };
    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', onMouse); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 1 }} />;
}
BGEOF

echo "  ✓ BioBackground 组件重写"

# 3. Fix FileUploadZone to show image previews using convertFileSrc
cat > src/components/FileUploadZone.tsx << 'FEOF'
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Trash2 } from 'lucide-react';

const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'];

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

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
    invoke<string>('get_data_dir').then(setDataDir).catch(() => {});
  }, []);

  async function pickFiles() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true, title: '选择文件',
        filters: [
          { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'tiff', 'svg', 'bmp', 'webp'] },
          { name: '文档', extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md'] },
          { name: '数据', extensions: ['csv', 'tsv', 'fcs'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length === 0) return;
      setUploading(true);
      try {
        await invoke('import_files_to_experiment', { experimentId, projectId, filePaths: paths });
        onFilesChanged();
      } catch (e: any) { alert('导入失败: ' + e); }
      finally { setUploading(false); }
    } catch (e) { console.error(e); }
  }

  async function deleteFile(fileId: string, fileName: string) {
    if (!confirm(`删除 "${fileName}"？`)) return;
    try { await invoke('delete_experiment_file', { fileId }); onFilesChanged(); }
    catch (e: any) { alert('删除失败: ' + e); }
  }

  async function openFile(localPath: string) {
    try { await invoke('open_file', { localPath }); }
    catch (e: any) { alert('无法打开: ' + e); }
  }

  function getImgSrc(localPath: string): string {
    if (!dataDir || !localPath) return '';
    // Use Tauri asset protocol
    const fullPath = dataDir + '/' + localPath;
    return 'asset://localhost/' + encodeURI(fullPath);
  }

  function isImage(f: any): boolean {
    const ext = (f.file_type || f.name?.split('.').pop() || '').toLowerCase();
    return IMG_EXTS.includes(ext);
  }

  const imageFiles = files.filter(isImage);
  const otherFiles = files.filter(f => !isImage(f));

  return (
    <div>
      {/* Upload area */}
      <div onClick={pickFiles} style={{
        border: '1px dashed rgba(99,179,237,0.15)', borderRadius: 8,
        padding: uploading ? '12px' : '16px', textAlign: 'center',
        cursor: uploading ? 'wait' : 'pointer',
        background: 'rgba(99,179,237,0.02)', transition: 'all 0.3s',
        marginBottom: 12,
      }}>
        {uploading ? (
          <div style={{ color: '#718096', fontSize: 13 }}>导入中...</div>
        ) : (
          <div style={{ color: '#718096', fontSize: 13 }}>点击选择文件</div>
        )}
      </div>

      {/* Image gallery with previews */}
      {imageFiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 10 }}>
          {imageFiles.map((f: any) => {
            const src = getImgSrc(f.local_path);
            return (
              <div key={f.id} style={{
                position: 'relative', borderRadius: 6, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                transition: 'all 0.3s', background: '#131820',
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onClick={() => setLightbox(src)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,179,237,0.3)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(99,179,237,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                {src ? (
                  <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex'; }} />
                ) : null}
                <div style={{ display: src ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 28 }}>🖼️</div>
                {/* Delete button */}
                <div style={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20,
                  borderRadius: '50%', background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                onClick={e => { e.stopPropagation(); deleteFile(f.id, f.name); }}
                >
                  <Trash2 size={10} color="#fc8181" />
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2px 4px', background: 'rgba(0,0,0,0.5)', fontSize: 9, color: '#a0aec0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name || f.original_name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Non-image files */}
      {otherFiles.map((f: any) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 18 }}>📎</span>
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => f.local_path && openFile(f.local_path)}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#63b3ed' }}>{f.name}</div>
            <div style={{ fontSize: 10, color: '#4a5568' }}>{f.file_size ? formatSize(f.file_size) : ''}</div>
          </div>
          <Trash2 size={13} style={{ cursor: 'pointer', color: '#4a5568', flexShrink: 0 }} onClick={() => deleteFile(f.id, f.name)} />
        </div>
      ))}

      {files.length === 0 && <div style={{ fontSize: 12, color: '#4a5568', textAlign: 'center', padding: '6px 0' }}>点击上方添加文件</div>}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out',
          animation: 'overlayIn 0.2s ease',
        }}>
          <img src={lightbox} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} alt="" />
        </div>
      )}
    </div>
  );
}
FEOF

echo "  ✓ FileUploadZone 重写（图片预览+放大）"

# 4. Add asset protocol to Tauri config
python3 << 'PYEOF'
import json

with open('src-tauri/tauri.conf.json', 'r') as f:
    conf = json.load(f)

# Add asset protocol scope
if 'security' not in conf.get('app', {}):
    conf.setdefault('app', {})['security'] = {}

security = conf['app']['security']
if 'assetProtocol' not in security:
    security['assetProtocol'] = { 'scope': ["**"] }
    print("  ✓ 添加 asset protocol scope")
else:
    security['assetProtocol']['scope'] = ["**"]
    print("  ✓ 更新 asset protocol scope")

with open('src-tauri/tauri.conf.json', 'w') as f:
    json.dump(conf, f, indent=2, ensure_ascii=False)
PYEOF

# 5. Add asset scope to capabilities
python3 << 'PYEOF'
import json

with open('src-tauri/capabilities/default.json', 'r') as f:
    cap = json.load(f)

perms = cap.get('permissions', [])

# Add fs read scope for asset protocol
need_add = True
for p in perms:
    if isinstance(p, dict) and p.get('identifier') == 'fs:allow-read-file':
        need_add = False
        break
    if p == 'fs:default':
        need_add = False
        break

if need_add:
    perms.append({
        "identifier": "fs:allow-read-file",
        "allow": [{ "path": "**" }]
    })
    print("  ✓ 添加 fs read 权限")

cap['permissions'] = perms
with open('src-tauri/capabilities/default.json', 'w') as f:
    json.dump(cap, f, indent=2, ensure_ascii=False)
PYEOF

# 6. CSS to ensure app structure works with background
cat >> src/App.css << 'CSSEOF'

/* ═══ APP STRUCTURE for background ═══ */
.app { position: relative !important; z-index: 1 !important; }
.topbar { background: rgba(15,18,25,0.95) !important; backdrop-filter: blur(12px) !important; }
.content-area { background: transparent !important; }
.tl-card, .card, .module-panel, .exp-section-card, .stat-card, .exp-progress-card {
  background: rgba(23,28,38,0.9) !important;
  backdrop-filter: blur(4px) !important;
}
CSSEOF

echo "  ✓ CSS 背景透明度调整"
echo ""
echo "✅ 完成，运行 pnpm tauri dev"
