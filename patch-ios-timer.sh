#!/bin/bash
cd ~/Desktop/biolab

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Find and replace TimerWidget
old_start = '// ═══ Timer Widget ═══'
old_end = '\nfunction HomePage'

idx_s = c.find(old_start)
idx_e = c.find(old_end)

if idx_s > 0 and idx_e > 0:
    new_timer = r'''// ═══ Timer Widget — iOS Style ═══
function TimerWidget() {
  const [totalSec, setTotalSec] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'set'|'run'>('set');
  const [h, setH] = useState(0);
  const [m, setM] = useState(5);
  const [s, setS] = useState(0);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { setRunning(false); setMode('set'); return 0; }
          return r - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const startTimer = () => {
    const total = h * 3600 + m * 60 + s;
    if (total <= 0) return;
    setTotalSec(total);
    setRemaining(total);
    setRunning(true);
    setMode('run');
  };

  const togglePause = () => setRunning(!running);
  const resetTimer = () => { setRunning(false); setMode('set'); setRemaining(0); };

  const fmtTime = (secs: number) => {
    const hh = Math.floor(secs / 3600);
    const mm = Math.floor((secs % 3600) / 60);
    const ss = secs % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  const pct = totalSec > 0 ? ((totalSec - remaining) / totalSec) * 100 : 0;

  const ScrollCol = ({ value, setValue, max, label }: { value: number; setValue: (v: number) => void; max: number; label: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    const itemH = 36;

    useEffect(() => {
      if (ref.current) {
        ref.current.scrollTop = value * itemH;
      }
    }, []);

    const onScroll = () => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / itemH);
      setValue(Math.min(max, Math.max(0, idx)));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          ref={ref}
          onScroll={onScroll}
          style={{
            height: itemH * 3,
            width: 56,
            overflowY: 'auto',
            scrollSnapType: 'y mandatory',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            position: 'relative',
          }}
          className="ios-scroll-col"
        >
          <div style={{ height: itemH }} />
          {Array.from({ length: max + 1 }, (_, i) => (
            <div
              key={i}
              style={{
                height: itemH,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                scrollSnapAlign: 'center',
                fontSize: value === i ? 22 : 16,
                fontWeight: value === i ? 700 : 400,
                color: value === i ? '#f1f5f9' : '#4a5568',
                transition: 'all 0.15s',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(i).padStart(2, '0')}
            </div>
          ))}
          <div style={{ height: itemH }} />
        </div>
        <div style={{ fontSize: 10, color: '#718096', marginTop: 4 }}>{label}</div>
      </div>
    );
  };

  if (mode === 'run') {
    return (
      <div className="tmr-widget">
        {/* Circular progress */}
        <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 16px' }}>
          <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
            <circle cx="70" cy="70" r="62" fill="none" stroke="#63b3ed" strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 62}`}
              strokeDashoffset={`${2 * Math.PI * 62 * (1 - (remaining / totalSec))}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 200, color: '#f1f5f9',
            fontFamily: "'SF Mono','Menlo',monospace",
            fontVariantNumeric: 'tabular-nums', letterSpacing: 1,
          }}>
            {fmtTime(remaining)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <div onClick={togglePause} style={{
            padding: '8px 24px', borderRadius: 20,
            background: running ? 'rgba(237,137,54,0.15)' : 'rgba(99,179,237,0.15)',
            border: `1px solid ${running ? 'rgba(237,137,54,0.3)' : 'rgba(99,179,237,0.3)'}`,
            color: running ? '#ed8936' : '#63b3ed',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
          }}>
            {running ? '暂停' : '继续'}
          </div>
          <div onClick={resetTimer} style={{
            padding: '8px 24px', borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#718096', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', userSelect: 'none',
          }}>
            取消
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tmr-widget">
      {/* iOS scroll picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 16 }}>
        <ScrollCol value={h} setValue={setH} max={23} label="时" />
        <div style={{ fontSize: 22, color: '#4a5568', fontWeight: 700, paddingBottom: 16 }}>:</div>
        <ScrollCol value={m} setValue={setM} max={59} label="分" />
        <div style={{ fontSize: 22, color: '#4a5568', fontWeight: 700, paddingBottom: 16 }}>:</div>
        <ScrollCol value={s} setValue={setS} max={59} label="秒" />
      </div>

      {/* Highlight bar */}
      <div onClick={startTimer} style={{
        padding: '10px 0', textAlign: 'center', borderRadius: 20,
        background: (h + m + s) > 0 ? 'rgba(99,179,237,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${(h + m + s) > 0 ? 'rgba(99,179,237,0.3)' : 'rgba(255,255,255,0.06)'}`,
        color: (h + m + s) > 0 ? '#63b3ed' : '#4a5568',
        fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
      }}>
        开始
      </div>
    </div>
  );
}

'''
    c = c[:idx_s] + new_timer + c[idx_e:]
    print("  ✓ TimerWidget 重写为 iOS 滚动选择器")
else:
    print(f"  ⚠ 未找到 TimerWidget ({idx_s}, {idx_e})")

with open('src/App.tsx', 'w') as f:
    f.write(c)
PYEOF

# CSS for scroll columns
cat >> src/App.css << 'CSSEOF'

/* ═══ iOS TIMER SCROLL ═══ */
.ios-scroll-col::-webkit-scrollbar { width: 0; display: none; }
.ios-scroll-col { scrollbar-width: none; -ms-overflow-style: none; }
.tmr-widget {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-subtle) !important;
  border-radius: 10px !important;
  padding: 20px 14px !important;
  text-align: center !important;
  position: relative;
}
/* Selection indicator lines */
.tmr-widget .ios-scroll-col::before,
.tmr-widget .ios-scroll-col::after {
  content: '';
  position: sticky;
  display: block;
  height: 1px;
  background: rgba(99,179,237,0.2);
  z-index: 2;
  pointer-events: none;
}
.tmr-widget .ios-scroll-col::before { top: 36px; }
.tmr-widget .ios-scroll-col::after { top: 72px; }
CSSEOF

echo "✅ 完成"
