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
  const [bumpedIdxs, setBumpedIdxs] = useState<number[]>([]);
  const [hoverBar, setHoverBar] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const allMs: any[] = timeline.milestones || [];
  const maxDay = timeline.duration_days;
  const dayRange = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => { setTotalVal(String(timeline.duration_days)); }, [timeline.duration_days]);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...allMs, { day: scrollDay, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const saveTotal = () => { const v = parseInt(totalVal) || 30; onSave({ ...timeline, duration_days: Math.max(1, v) }); setEditTotal(false); };

  const handleMouseDown = (e: React.MouseEvent, origIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragIdx(origIdx);
    setBumpedIdxs([]);
    const otherIdxs = allMs.map((_: any, i: number) => i).filter((i: number) => i !== origIdx);
    const otherDays = otherIdxs.map((i: number) => allMs[i].day);

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      let newDay = Math.max(0, Math.min(maxDay, Math.round(pct * maxDay)));

      // Find which other nodes are at this day — bump them
      const bumped: number[] = [];
      otherIdxs.forEach((oi: number) => {
        if (allMs[oi].day === newDay && newDay > 0) bumped.push(oi);
      });
      setBumpedIdxs(bumped);

      // Don't allow landing on occupied non-zero positions
      if (newDay > 0 && otherDays.includes(newDay)) {
        // Snap to nearest free spot
        for (let offset = 1; offset <= maxDay; offset++) {
          const dir = pct > (allMs[origIdx]?.day || 0) / maxDay ? 1 : -1;
          const try1 = newDay + dir * offset;
          const try2 = newDay - dir * offset;
          if (try1 > 0 && try1 <= maxDay && !otherDays.includes(try1)) { newDay = try1; break; }
          if (try2 > 0 && try2 <= maxDay && !otherDays.includes(try2)) { newDay = try2; break; }
          if (try1 <= 0 || try1 > maxDay) { if (try2 > 0 && try2 <= maxDay && !otherDays.includes(try2)) { newDay = try2; break; } }
        }
      }

      const updated = [...allMs];
      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], day: newDay };
      onSave({ ...timeline, milestones: updated });
    };

    const onUp = () => {
      setBumpedIdxs([]);
      const current = (timeline.milestones || [])[origIdx];
      if (current && current.day <= 0) {
        onSave({ ...timeline, milestones: allMs.filter((_: any, j: number) => j !== origIdx) });
      }
      setDragIdx(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Sort for rendering
  const sorted = allMs.map((m: any, i: number) => ({ ...m, _idx: i })).sort((a: any, b: any) => a.day - b.day);

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
          <span className="tl-total" onClick={() => setEditTotal(true)}>{maxDay} 天</span>
        )}
      </div>

      <div className="tl-track" ref={barRef} onMouseEnter={() => setHoverBar(true)} onMouseLeave={() => { if (dragIdx === null) setHoverBar(false); }}>
        {/* The line */}
        <div className="tl-line">
          <div className="tl-line-fill" style={{ width: dayPct + '%' }} />
        </div>

        {/* Current day indicator */}
        <div className="tl-today" style={{ left: dayPct + '%' }} />

        {/* Delete icon — centered at 0 position, only on hover/drag */}
        {allMs.length > 0 && (
          <div className={`tl-zero-del ${hoverBar || dragIdx !== null ? 'vis' : ''}`} onClick={() => onSave({ ...timeline, milestones: [] })}>
            <Trash2 size={9} />
          </div>
        )}

        {/* Nodes */}
        {sorted.map((m: any) => {
          const oi = m._idx;
          const p = m.day <= 0 ? 0 : Math.min(100, (m.day / maxDay) * 100);
          const done = daysPassed >= m.day;
          const isDrag = dragIdx === oi;
          const isBumped = bumpedIdxs.includes(oi);
          return (
            <div key={oi} className={`tl-n ${done ? 'done' : ''} ${isDrag ? 'drag' : ''} ${isBumped ? 'bumped' : ''}`} style={{ left: p + '%' }} onMouseDown={(e) => handleMouseDown(e, oi)}>
              <div className="tl-n-label">{m.label}</div>
              <div className="tl-n-sphere" />
            </div>
          );
        })}
      </div>

      <div className="tl-bottom">
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
          <div className="tl-add-btn" onClick={()=>{setScrollDay(Math.min(maxDay,daysPassed+3||3));setAdding(true);}}>+</div>
        )}
      </div>
    </div>
  );
}

'''
    c = c[:idx_s] + new_tl + c[idx_e:]
    print("  ✓ TimelineCard 完全重写")

with open('src/App.tsx', 'w') as f:
    f.write(c)
print("\n完成")
PYEOF

# CSS — completely fresh node styles
cat >> src/App.css << 'CSSEOF'

/* ═══ Hide all old timeline styles ═══ */
.tl-ms, .tl-delete-zone, .tl-next, .tl-item, .tl-drag-hint, .tl-ms-del,
.tl-del-dot, .tl-node, .tl-bar-area, .tl-bar, .tl-fill, .tl-now, .tl-dot { display: none !important; }

/* ═══ TRACK ═══ */
.tl-track {
  position: relative;
  height: 60px;
  margin-bottom: 6px;
  padding: 0 8px;
}

/* Line — centered vertically */
.tl-line {
  position: absolute;
  top: 50%; left: 8px; right: 8px;
  height: 3px;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
}
.tl-line-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(58,143,212,0.3), rgba(99,179,237,0.6));
  box-shadow: 0 0 8px rgba(99,179,237,0.15);
  transition: width 0.5s ease;
}

/* Today marker — small diamond on line */
.tl-today {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px; height: 8px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(99,179,237,0.5);
  z-index: 6;
  transition: left 0.5s ease;
}

/* ═══ DELETE at 0 — overlaid on 0 center ═══ */
.tl-zero-del {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px; height: 14px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(252,129,129,0.08);
  border: 1px solid rgba(252,129,129,0.12);
  color: rgba(252,129,129,0.3);
  cursor: pointer;
  z-index: 20;
  opacity: 0;
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.22,1,0.36,1);
}
.tl-zero-del.vis {
  opacity: 1;
  pointer-events: auto;
}
.tl-zero-del:hover {
  width: 22px; height: 22px;
  background: rgba(252,129,129,0.15);
  border-color: rgba(252,129,129,0.5);
  color: #fc8181;
  box-shadow: 0 0 24px rgba(252,129,129,0.3);
}
.tl-zero-del svg { width: 9px !important; height: 9px !important; }

/* ═══ NODE — sphere on line ═══ */
.tl-n {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  z-index: 8;
  transition: left 0.1s linear;
  -webkit-user-select: none; user-select: none;
}
.tl-n.drag { cursor: grabbing; z-index: 18; transition: none !important; }

/* Label above */
.tl-n-label {
  position: absolute;
  bottom: calc(100% + 2px);
  font-size: 10px;
  color: var(--text-dim);
  white-space: nowrap;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  transition: all 0.35s cubic-bezier(0.22,1,0.36,1);
  pointer-events: none;
}
.tl-n:hover .tl-n-label { color: var(--accent); transform: translateY(-3px); text-shadow: 0 0 8px rgba(99,179,237,0.3); }
.tl-n.done .tl-n-label { color: rgba(72,187,120,0.6); }
.tl-n.drag .tl-n-label { color: var(--accent); font-weight: 600; transform: translateY(-5px); }

/* Sphere — 3D gradient */
.tl-n-sphere {
  width: 14px; height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #8fcbf5, #3a8fd4 50%, #1a5a8f 100%);
  box-shadow: 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.15);
  transition: all 0.35s cubic-bezier(0.22,1,0.36,1);
}
.tl-n.done .tl-n-sphere {
  background: radial-gradient(circle at 35% 30%, #7ddbaa, #38a169 50%, #1e6f42 100%);
}

/* Hover — grow + glow */
.tl-n:hover .tl-n-sphere {
  width: 20px; height: 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 3px rgba(255,255,255,0.2), 0 0 20px rgba(99,179,237,0.35);
}
.tl-n.done:hover .tl-n-sphere {
  box-shadow: 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 3px rgba(255,255,255,0.2), 0 0 20px rgba(72,187,120,0.35);
}

/* Dragging — pulse */
.tl-n.drag .tl-n-sphere {
  width: 22px; height: 22px;
  animation: spherePulse 0.7s infinite alternate;
}
@keyframes spherePulse {
  from { box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 14px rgba(99,179,237,0.3); }
  to { box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 30px rgba(99,179,237,0.55); }
}

/* Dragged to 0 — red */
.tl-n[style*="left: 0%"] .tl-n-sphere,
.tl-n[style*="left:0%"] .tl-n-sphere {
  background: radial-gradient(circle at 35% 30%, #ffa0a0, #e05050 50%, #8b2020 100%) !important;
  animation: sphereRedPulse 0.5s infinite alternate !important;
}
@keyframes sphereRedPulse {
  from { box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 14px rgba(252,129,129,0.3); }
  to { box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 30px rgba(252,129,129,0.55); }
}

/* BUMPED — hop up and come back */
.tl-n.bumped {
  animation: nodeBump 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes nodeBump {
  0% { transform: translate(-50%, -50%); }
  40% { transform: translate(-50%, calc(-50% - 18px)) scale(1.15); }
  70% { transform: translate(-50%, calc(-50% - 8px)) scale(1.05); }
  100% { transform: translate(-50%, -50%) scale(1); }
}
CSSEOF

echo "✅ 完成"
