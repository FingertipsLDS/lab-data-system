#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Fix "下一步" text — remove parentheses content on home page
c = c.replace(
    "{nextMilestone && <span className=\"epc-next\">下一步：第{nextMilestone.day}天 {nextMilestone.label}（{nextMilestone.day - daysP}天后）</span>}",
    "{nextMilestone && <span className=\"epc-next\">下一步：第{nextMilestone.day}天 {nextMilestone.label}</span>}"
)

# 2. Replace TimelineCard
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
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragHint, setDragHint] = useState('');
  const barRef = useRef<HTMLDivElement>(null);

  const ms = [...(timeline.milestones || [])].sort((a: any, b: any) => a.day - b.day);
  const next = ms.find((m: any) => m.day > daysPassed);
  const maxDay = timeline.duration_days;
  const dayRange = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => { setTotalVal(String(timeline.duration_days)); }, [timeline.duration_days]);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...(timeline.milestones||[]), { day: scrollDay, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const saveTotal = () => { const v = parseInt(totalVal) || 30; onSave({ ...timeline, duration_days: Math.max(1, v) }); setEditTotal(false); };

  const handleMouseDown = (e: React.MouseEvent, origIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragIdx(origIdx);
    setDragHint('← 拖到最左删除');
    const allMs = [...(timeline.milestones || [])];
    const otherDays = allMs.filter((_: any, i: number) => i !== origIdx).map((m: any) => m.day);

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      let newDay = Math.max(0, Math.min(maxDay, Math.round(pct * maxDay)));
      // Skip over occupied days
      while (otherDays.includes(newDay) && newDay > 0) { newDay = pct < 0.5 ? newDay - 1 : newDay + 1; }
      newDay = Math.max(0, Math.min(maxDay, newDay));
      if (newDay === 0) {
        setDragHint('松开删除');
      } else {
        setDragHint('');
      }
      const updated = [...allMs];
      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], day: newDay };
      onSave({ ...timeline, milestones: updated });
    };

    const onUp = () => {
      setDragIdx(null);
      setDragHint('');
      // Check if dragged to 0 — delete
      const current = (timeline.milestones || [])[origIdx];
      if (current && current.day === 0) {
        onSave({ ...timeline, milestones: (timeline.milestones || []).filter((_: any, j: number) => j !== origIdx) });
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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
        {ms.map((m: any, i: number) => {
          const origIdx = (timeline.milestones||[]).indexOf(m);
          const p = m.day <= 0 ? 0 : Math.min(100, (m.day / maxDay) * 100);
          const done = daysPassed >= m.day;
          const isDragging = dragIdx === origIdx;
          return (
            <div key={i} className={`tl-ms ${done ? 'done' : ''} ${isDragging ? 'dragging' : ''}`} style={{ left: p + '%' }} onMouseDown={(e) => handleMouseDown(e, origIdx)}>
              <div className="tl-ms-label">{m.label}</div>
              <div className="tl-ms-dot"><span className="tl-ms-num">{m.day}</span></div>
            </div>
          );
        })}
        {dragHint && <div className="tl-drag-hint">{dragHint}</div>}
      </div>

      {next && <div className="tl-next">→ {next.label}</div>}

      <div className="tl-list">
        {adding ? (
          <div className="tl-add-panel">
            <div className="tl-add-cols">
              <div className="ios-picker-col">
                <div className="ios-picker">
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
          <div className="tl-add-btn" onClick={()=>{setScrollDay(Math.min(maxDay,daysPassed+3));setAdding(true);}}>+</div>
        )}
      </div>
    </div>
  );
}

'''
    c = c[:idx_s] + new_tl + c[idx_e:]
    print("  ✓ TimelineCard 已重写")

with open('src/App.tsx', 'w') as f:
    f.write(c)
print("\n完成")
PYEOF

# CSS updates
cat >> src/App.css << 'CSSEOF'

/* ═══ DRAG HINT ═══ */
.tl-drag-hint {
  position: absolute;
  bottom: -18px;
  left: 0;
  font-size: 10px;
  color: var(--status-danger);
  animation: hintPulse 1s infinite;
  white-space: nowrap;
}
@keyframes hintPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

/* Remove old delete button */
.tl-ms-del { display: none !important; }

/* Dragging state — red tint when near 0 */
.tl-ms.dragging .tl-ms-dot {
  border-color: var(--accent) !important;
  box-shadow: 0 0 24px rgba(99,179,237,0.4) !important;
}
.tl-ms[style*="left: 0%"].dragging .tl-ms-dot,
.tl-ms[style*="left:0%"].dragging .tl-ms-dot {
  border-color: var(--status-danger) !important;
  box-shadow: 0 0 24px rgba(252,129,129,0.4) !important;
  background: rgba(252,129,129,0.15) !important;
}
CSSEOF

echo "✅ 完成"
