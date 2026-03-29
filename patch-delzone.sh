#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

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
  const [nearZero, setNearZero] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const ms = [...(timeline.milestones || [])].sort((a: any, b: any) => a.day - b.day);
  const next = ms.find((m: any) => m.day > daysPassed);
  const maxDay = timeline.duration_days;
  const dayRange = Array.from({ length: maxDay }, (_, i) => i + 1);
  const hasNodes = (timeline.milestones || []).length > 0;

  useEffect(() => { setTotalVal(String(timeline.duration_days)); }, [timeline.duration_days]);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...(timeline.milestones||[]), { day: scrollDay, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const saveTotal = () => { const v = parseInt(totalVal) || 30; onSave({ ...timeline, duration_days: Math.max(1, v) }); setEditTotal(false); };
  const clearAll = () => { onSave({ ...timeline, milestones: [] }); };

  const handleMouseDown = (e: React.MouseEvent, origIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragIdx(origIdx);
    setNearZero(false);
    const allMs = [...(timeline.milestones || [])];
    const otherDays = allMs.filter((_: any, i: number) => i !== origIdx).map((m: any) => m.day);

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      let newDay = Math.max(0, Math.min(maxDay, Math.round(pct * maxDay)));
      while (newDay > 0 && otherDays.includes(newDay)) { newDay = pct < 0.5 ? newDay - 1 : newDay + 1; }
      newDay = Math.max(0, Math.min(maxDay, newDay));
      setNearZero(newDay === 0);
      const updated = [...allMs];
      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], day: newDay };
      onSave({ ...timeline, milestones: updated });
    };

    const onUp = () => {
      const current = (timeline.milestones || [])[origIdx];
      if (current && current.day === 0) {
        onSave({ ...timeline, milestones: (timeline.milestones || []).filter((_: any, j: number) => j !== origIdx) });
      }
      setDragIdx(null); setNearZero(false);
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
        {/* Delete zone at position 0 */}
        <div className={`tl-delete-zone ${(dragIdx !== null || hasNodes) ? 'visible' : ''} ${nearZero ? 'active' : ''}`} onClick={clearAll}>
          <Trash2 size={14} />
        </div>

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
    print("  ✓ TimelineCard 已更新")

with open('src/App.tsx', 'w') as f:
    f.write(c)
print("\n完成")
PYEOF

cat >> src/App.css << 'CSSEOF'

/* ═══ DELETE ZONE at position 0 ═══ */
.tl-delete-zone {
  position: absolute;
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px; height: 24px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
  z-index: 10;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-dim);
  cursor: pointer;
}
.tl-delete-zone.visible {
  opacity: 0.4;
  pointer-events: auto;
}
.tl-delete-zone.visible:hover {
  opacity: 1;
  background: var(--status-danger-bg);
  border-color: rgba(252,129,129,0.3);
  color: var(--status-danger);
  box-shadow: 0 0 16px rgba(252,129,129,0.2);
  transform: translateY(-50%) scale(1.15);
}
.tl-delete-zone.active {
  opacity: 1 !important;
  background: var(--status-danger-bg) !important;
  border-color: rgba(252,129,129,0.4) !important;
  color: var(--status-danger) !important;
  box-shadow: 0 0 24px rgba(252,129,129,0.3) !important;
  transform: translateY(-50%) scale(1.2) !important;
  animation: deleteGlow 0.6s infinite alternate;
}
@keyframes deleteGlow {
  from { box-shadow: 0 0 16px rgba(252,129,129,0.2); }
  to { box-shadow: 0 0 28px rgba(252,129,129,0.4); }
}
.tl-delete-zone svg { width: 12px !important; height: 12px !important; }

/* Adjust bar area padding for delete zone */
.tl-bar-area { padding-left: 20px !important; }

/* Remove old drag hint */
.tl-drag-hint { display: none !important; }
CSSEOF

echo "✅ 完成"
