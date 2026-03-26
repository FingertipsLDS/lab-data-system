import { useState, useEffect } from 'react';

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateInfo({ version: update.version, body: update.body || '新版本已发布，建议更新。' });
        setUpdateAvailable(true);
      }
    } catch (e) {
      console.log('[Update] 检查更新失败或无更新:', e);
    }
  }

  async function doUpdate() {
    setDownloading(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        let totalSize = 0;
        let downloaded = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started' && event.data.contentLength) {
            totalSize = event.data.contentLength;
          } else if (event.event === 'Progress') {
            downloaded += event.data.chunkLength;
            if (totalSize > 0) setProgress(Math.round((downloaded / totalSize) * 100));
          } else if (event.event === 'Finished') {
            setProgress(100);
          }
        });
        // 安装完成后重启
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      }
    } catch (e: any) {
      alert('更新失败: ' + e.toString());
      setDownloading(false);
    }
  }

  if (!updateAvailable || dismissed) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.iconRow}>
          <span style={{ fontSize: 36 }}>🔄</span>
        </div>
        <h2 style={styles.title}>发现新版本</h2>
        <div style={styles.version}>v{updateInfo?.version}</div>
        <div style={styles.body}>{updateInfo?.body}</div>

        {downloading ? (
          <div style={styles.progressSection}>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
            <div style={styles.progressText}>下载中... {progress}%</div>
          </div>
        ) : (
          <div style={styles.buttons}>
            <button style={styles.laterBtn} onClick={() => setDismissed(true)}>
              暂不更新
            </button>
            <button style={styles.updateBtn} onClick={doUpdate}>
              立即更新
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000,
    fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '32px',
    width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    textAlign: 'center' as const,
  },
  iconRow: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 },
  version: { fontSize: 14, color: '#2563eb', fontWeight: 600, marginBottom: 16 },
  body: {
    fontSize: 14, color: '#6b7280', lineHeight: 1.7,
    textAlign: 'left' as const, background: '#f9fafb',
    borderRadius: 8, padding: '12px 16px', marginBottom: 20,
    maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap' as const,
  },
  buttons: { display: 'flex', gap: 10 },
  laterBtn: {
    flex: 1, padding: '10px 0', borderRadius: 8,
    border: '1px solid #d1d5db', background: '#fff',
    color: '#374151', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  updateBtn: {
    flex: 1, padding: '10px 0', borderRadius: 8,
    border: 'none', background: '#2563eb', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  progressSection: { marginTop: 8 },
  progressBar: {
    height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%', background: '#2563eb', borderRadius: 4,
    transition: 'width 0.3s',
  },
  progressText: { fontSize: 13, color: '#6b7280', marginTop: 8 },
};
