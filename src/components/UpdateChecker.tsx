import { useState, useEffect } from 'react';

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { checkForUpdate(); }, []);

  async function checkForUpdate() {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) { setUpdateInfo({ version: update.version, body: update.body || '新版本已发布' }); setUpdateAvailable(true); }
    } catch {}
  }

  async function doUpdate() {
    setDownloading(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        let total = 0, dl = 0;
        await update.downloadAndInstall((e) => {
          if (e.event === 'Started' && e.data.contentLength) total = e.data.contentLength;
          else if (e.event === 'Progress') { dl += e.data.chunkLength; if (total > 0) setProgress(Math.round((dl / total) * 100)); }
          else if (e.event === 'Finished') setProgress(100);
        });
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      }
    } catch (e: any) { alert('更新失败: ' + e); setDownloading(false); }
  }

  if (!updateAvailable || dismissed) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'Inter','Noto Sans SC',sans-serif" }}>
      <div style={{ background: '#181d27', borderRadius: 10, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔄</div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>发现新版本</h2>
        <div style={{ fontSize: 13, color: '#63b3ed', fontWeight: 600, marginBottom: 14 }}>v{updateInfo?.version}</div>
        <div style={{ fontSize: 12.5, color: '#8892a4', lineHeight: 1.7, textAlign: 'left', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 14px', marginBottom: 18, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', border: '1px solid rgba(255,255,255,0.04)' }}>{updateInfo?.body}</div>
        {downloading ? (
          <div><div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', background: '#63b3ed', borderRadius: 3, width: `${progress}%`, transition: 'width 0.3s', boxShadow: '0 0 10px rgba(99,179,237,0.3)' }} /></div><div style={{ fontSize: 12, color: '#5a6478', marginTop: 6 }}>下载中... {progress}%</div></div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setDismissed(true)} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#8892a4', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>暂不更新</button>
            <button onClick={doUpdate} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: '#3a8fd4', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 0 12px rgba(99,179,237,0.15)' }}>立即更新</button>
          </div>
        )}
      </div>
    </div>
  );
}
