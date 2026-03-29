#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Remove Badge from experiment list cards (ExperimentsPage)
# The pattern in ExperimentsPage experiment cards
c = c.replace(
    '<div className="flex justify-between items-center"><span className="font-bold">{e.title}</span><Badge>{e.status}</Badge></div>',
    '<div className="flex justify-between items-center"><span className="font-bold">{e.title}</span></div>'
)
print("  ✓ 实验列表去掉待处理标识")

# 2. Replace TimelineCard with new version
old_tl_start = '// ═══ Timeline Card ═══'
old_tl_end = '\n// ═══ Experiment Detail'

idx_s = c.find(old_tl_start)
idx_e = c.find(old_tl_end)

if idx_s > 0 and idx_e > 0:
    new_tl = r'''// ═══ Timeline Card ═══
function TimelineCard({ timeline, daysPassed, dayPct, onSave }: { timeline: any; daysPassed: number; dayPct: number; onSave: (tl: any) => void }) {
  const [adding, setAdding] = useState(false);
  const [scrollDay, setScrollDay] = useState(3);
  const [nl, setNl] = useState('');
  const [editTotal, setEditTotal] = useState(false);
  const [totalVal, setTotalVal] = useState(String(timeline.duration_days));
  const [dragging, setDragging] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const ms = [...(timeline.milestones || [])].sort((a: any, b: any) => a.day - b.day);
  const next = ms.find((m: any) => m.day > daysPassed);

  useEffect(() => { setTotalVal(String(timeline.duration_days)); }, [timeline.duration_days]);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...(timeline.milestones||[]), { day: scrollDay, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const rm = (idx: number) => onSave({ ...timeline, milestones: (timeline.milestones||[]).filter((_:any,j:number) => j!==idx) });
  const saveTotal = () => { const v = parseInt(totalVal) || 30; onSave({ ...timeline, duration_days: Math.max(1, v) }); setEditTotal(false); };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent, msIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(msIdx);
    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const newDay = Math.max(1, Math.min(timeline.duration_days, Math.round(pct * timeline.duration_days)));
      const newMs = [...(timeline.milestones||[])];
      if (newMs[msIdx]) newMs[msIdx] = { ...newMs[msIdx], day: newDay };
      onSave({ ...timeline, milestones: newMs });
    };
    const onUp = () => { setDragging(null); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const maxDay = timeline.duration_days;
  const dayRange = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <div className="tl-card">
      <div className="tl-top">
        <span className="tl-day">第 {daysPassed} 天</span>
        {editTotal ? (
          <div className="tl-total-edit">
            <input className="tl-total-input" value={totalVal} onChange={e => setTotalVal(e.target.value)} autoFocus onBlur={saveTotal} onKeyDown={e => { if (e.key === 'Enter') saveTotal(); if (e.key === 'Escape') setEditTotal(false); }} />
            <span className="tl-total-unit">天</span>
          </div>
        ) : (
          <span className="tl-total" onClick={() => setEditTotal(true)}>{timeline.duration_days} 天</span>
        )}
      </div>

      <div className="tl-bar-area" ref={barRef}>
        <div className="tl-bar">
          <div className="tl-fill" style={{ width: dayPct+'%' }} />
          <div className="tl-now" style={{ left: dayPct+'%' }} />
        </div>
        {/* Milestone dots on bar */}
        {ms.map((m: any, i: number) => {
          const origIdx = (timeline.milestones||[]).indexOf(m);
          const p = Math.min(100, (m.day / timeline.duration_days) * 100);
          const done = daysPassed >= m.day;
          return (
            <div key={i} className={`tl-ms ${done ? 'done' : ''} ${dragging === origIdx ? 'dragging' : ''}`} style={{ left: p + '%' }} onMouseDown={(e) => handleMouseDown(e, origIdx)}>
              <div className="tl-ms-label">{m.label}</div>
              <div className="tl-ms-dot"><span className="tl-ms-num">{m.day}</span></div>
              <div className="tl-ms-del" onClick={(e) => { e.stopPropagation(); rm(origIdx); }}>×</div>
            </div>
          );
        })}
      </div>

      {next && <div className="tl-next">→ {next.label}（{next.day - daysPassed}天后）</div>}

      <div className="tl-list">
        {adding ? (
          <div className="tl-add-panel">
            <div className="tl-add-cols">
              <div className="ios-picker-col">
                <div className="ios-picker" ref={undefined}>
                  {dayRange.map(d => (
                    <div key={d} className={`ios-item ${scrollDay===d?'scroll-selected':''}`} onClick={() => setScrollDay(d)}>{d}</div>
                  ))}
                </div>
                <div className="ios-label">天</div>
              </div>
              <div className="tl-add-right">
                <input className="tl-add-txt" value={nl} onChange={e=>setNl(e.target.value)} autoFocus onKeyDown={e=>{if(e.key==='Enter')add();if(e.key==='Escape')setAdding(false);}} />
                <div className="tl-add-btns">
                  <span className="tl-add-ok" onClick={add}>确定</span>
                  <span className="tl-add-cancel" onClick={()=>setAdding(false)}>取消</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="tl-add-btn" onClick={()=>{setScrollDay(Math.min(maxDay, daysPassed+3));setAdding(true);}}>+</div>
        )}
      </div>
    </div>
  );
}

'''
    c = c[:idx_s] + new_tl + c[idx_e:]
    print("  ✓ TimelineCard 已重写")
else:
    print(f"  ⚠ 未找到 ({idx_s}, {idx_e})")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS
cat >> src/App.css << 'CSSEOF'

/* ═══ TOTAL DAYS INLINE EDIT ═══ */
.tl-total-edit { display: flex; align-items: center; gap: 2px; }
.tl-total-input {
  width: 50px; padding: 3px 6px; border-radius: 5px;
  border: 1px solid rgba(99,179,237,0.3); background: var(--bg-deep);
  color: var(--accent); font-size: 14px; font-weight: 700;
  font-family: var(--font); outline: none; text-align: center;
}
.tl-total-input:focus { box-shadow: 0 0 10px rgba(99,179,237,0.15); }
.tl-total-unit { font-size: 13px; color: var(--text-muted); }

/* ═══ BAR AREA — relative container for dots ═══ */
.tl-bar-area {
  position: relative;
  padding: 28px 0 10px;
  margin-bottom: 6px;
  cursor: default;
}
.tl-bar { position: relative; height: 4px; background: rgba(255,255,255,0.04); border-radius: 2px; }

/* ═══ MILESTONE ON BAR — dot + label above + hover delete ═══ */
.tl-ms {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  z-index: 4;
  transition: left 0.15s ease;
}
.tl-ms.dragging { cursor: grabbing; z-index: 10; transition: none !important; }

.tl-ms-label {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  margin-bottom: 3px;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  transition: color 0.2s;
}
.tl-ms.done .tl-ms-label { color: #48bb78; }
.tl-ms:hover .tl-ms-label { color: var(--accent); }

.tl-ms-dot {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 2px solid var(--text-dim);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
  position: relative;
}
.tl-ms-num {
  font-size: 8px; font-weight: 700;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  transition: color 0.2s;
}
.tl-ms.done .tl-ms-dot { border-color: #48bb78; background: rgba(72,187,120,0.15); }
.tl-ms.done .tl-ms-num { color: #48bb78; }

.tl-ms:hover .tl-ms-dot {
  width: 22px; height: 22px;
  border-color: var(--accent);
  background: rgba(99,179,237,0.12);
  box-shadow: 0 0 16px rgba(99,179,237,0.3);
}
.tl-ms:hover .tl-ms-num { font-size: 9px; color: var(--accent); }
.tl-ms.dragging .tl-ms-dot {
  width: 24px; height: 24px;
  border-color: var(--accent);
  box-shadow: 0 0 24px rgba(99,179,237,0.4);
}

/* Delete button — hidden, appears on hover */
.tl-ms-del {
  position: absolute;
  top: -2px;
  right: -14px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--status-danger);
  color: #fff;
  font-size: 11px;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;
  box-shadow: 0 0 8px rgba(252,129,129,0.3);
  z-index: 5;
}
.tl-ms:hover .tl-ms-del { display: flex; }

/* ═══ Remove old tl-dot styles (replaced by tl-ms) ═══ */
.tl-dot { display: none !important; }

/* ═══ Simplify tl-next ═══ */
.tl-next { font-size: 12px !important; color: var(--accent); margin-bottom: 8px; }

/* ═══ Remove tl-item milestone tags below (only show on bar) ═══ */
.tl-item { display: none !important; }
CSSEOF

echo "✅ 完成"
