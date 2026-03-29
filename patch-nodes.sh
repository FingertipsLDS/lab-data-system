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
  const [hoverBar, setHoverBar] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const allMs = timeline.milestones || [];
  const ms = [...allMs].sort((a: any, b: any) => a.day - b.day);
  const maxDay = timeline.duration_days;
  const dayRange = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => { setTotalVal(String(timeline.duration_days)); }, [timeline.duration_days]);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...allMs, { day: scrollDay, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const saveTotal = () => { const v = parseInt(totalVal) || 30; onSave({ ...timeline, duration_days: Math.max(1, v) }); setEditTotal(false); };

  const handleMouseDown = (e: React.MouseEvent, origIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragIdx(origIdx);
    const startX = e.clientX;
    const startDay = allMs[origIdx]?.day || 0;

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      let newDay = Math.max(0, Math.min(maxDay, Math.round(pct * maxDay)));
      const updated = [...allMs];
      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], day: newDay };
      onSave({ ...timeline, milestones: updated });
    };

    const onUp = () => {
      const current = allMs[dragIdx!];
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

      <div className="tl-bar-area" ref={barRef} onMouseEnter={() => setHoverBar(true)} onMouseLeave={() => { if (dragIdx === null) setHoverBar(false); }}>
        {/* Delete zone at 0 — only visible on bar hover */}
        {allMs.length > 0 && (
          <div className={`tl-del-dot ${hoverBar || dragIdx !== null ? 'show' : ''}`} onClick={() => onSave({ ...timeline, milestones: [] })}>
            <Trash2 size={10} />
          </div>
        )}

        <div className="tl-bar">
          <div className="tl-fill" style={{ width: dayPct+'%' }} />
          <div className="tl-now" style={{ left: dayPct+'%' }} />
        </div>

        {ms.map((m: any, i: number) => {
          const origIdx = allMs.indexOf(m);
          const p = m.day <= 0 ? 0 : Math.min(100, (m.day / maxDay) * 100);
          const done = daysPassed >= m.day;
          const isDrag = dragIdx === origIdx;
          return (
            <div key={origIdx} className={`tl-node ${done ? 'done' : ''} ${isDrag ? 'dragging' : ''}`} style={{ left: p + '%' }} onMouseDown={(e) => handleMouseDown(e, origIdx)}>
              <div className="tl-node-tag">{m.label}</div>
              <div className="tl-node-circle" />
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
    print("  ✓ TimelineCard 重写完成")

# Remove "→ next" display in home page too
c = c.replace(
    "{nextMilestone && <span className=\"epc-next\">下一步：第{nextMilestone.day}天 {nextMilestone.label}</span>}",
    ""
)
print("  ✓ 工作台卡片去掉下一步提示")

with open('src/App.tsx', 'w') as f:
    f.write(c)
print("\n完成")
PYEOF

# Fresh CSS for new node style
cat >> src/App.css << 'CSSEOF'

/* ═══ TIMELINE NODES — solid, animated ═══ */

/* Hide old styles */
.tl-ms { display: none !important; }
.tl-delete-zone { display: none !important; }
.tl-next { display: none !important; }
.tl-item { display: none !important; }
.tl-drag-hint { display: none !important; }
.tl-ms-del { display: none !important; }

/* Bar area */
.tl-bar-area {
  position: relative !important;
  padding: 32px 14px 8px 14px !important;
  margin-bottom: 4px !important;
}

/* Delete dot at position 0 */
.tl-del-dot {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 20px; height: 20px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.22,1,0.36,1);
  z-index: 12;
  background: rgba(252,129,129,0.06);
  border: 1.5px solid rgba(252,129,129,0.15);
  color: rgba(252,129,129,0.4);
  cursor: pointer;
}
.tl-del-dot.show {
  opacity: 1;
  pointer-events: auto;
}
.tl-del-dot:hover {
  background: rgba(252,129,129,0.15);
  border-color: rgba(252,129,129,0.5);
  color: #fc8181;
  box-shadow: 0 0 20px rgba(252,129,129,0.25);
  transform: translateY(-50%) scale(1.3);
}
.tl-del-dot svg { width: 10px !important; height: 10px !important; }

/* Node */
.tl-node {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  z-index: 5;
  transition: left 0.08s linear;
  -webkit-user-select: none;
  user-select: none;
}
.tl-node.dragging {
  cursor: grabbing;
  z-index: 15;
  transition: none !important;
}

/* Tag above node */
.tl-node-tag {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  margin-bottom: 4px;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  opacity: 0.7;
  transition: all 0.35s cubic-bezier(0.22,1,0.36,1);
}
.tl-node:hover .tl-node-tag {
  color: var(--accent);
  opacity: 1;
  transform: translateY(-2px);
  text-shadow: 0 0 10px rgba(99,179,237,0.3);
}
.tl-node.done .tl-node-tag { color: #48bb78; }
.tl-node.dragging .tl-node-tag {
  opacity: 1;
  color: var(--accent);
  font-weight: 600;
  transform: translateY(-4px) scale(1.1);
}

/* Circle — solid filled */
.tl-node-circle {
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.5;
  transition: all 0.35s cubic-bezier(0.22,1,0.36,1);
  box-shadow: none;
  position: relative;
}
.tl-node.done .tl-node-circle {
  background: #48bb78;
  opacity: 0.7;
}

/* Hover — pop & glow */
.tl-node:hover .tl-node-circle {
  width: 18px; height: 18px;
  opacity: 1;
  box-shadow: 0 0 20px rgba(99,179,237,0.4), 0 0 6px rgba(99,179,237,0.6);
}
.tl-node.done:hover .tl-node-circle {
  box-shadow: 0 0 20px rgba(72,187,120,0.4), 0 0 6px rgba(72,187,120,0.6);
}

/* Dragging — pulse glow */
.tl-node.dragging .tl-node-circle {
  width: 20px; height: 20px;
  opacity: 1;
  animation: nodePulse 0.8s infinite alternate;
}
@keyframes nodePulse {
  from { box-shadow: 0 0 12px rgba(99,179,237,0.3); }
  to { box-shadow: 0 0 28px rgba(99,179,237,0.6); }
}

/* When dragged near 0 — turn red */
.tl-node[style*="left: 0%"] .tl-node-circle,
.tl-node[style*="left:0%"] .tl-node-circle {
  background: #fc8181 !important;
  animation: nodeDeletePulse 0.5s infinite alternate !important;
}
@keyframes nodeDeletePulse {
  from { box-shadow: 0 0 12px rgba(252,129,129,0.3); }
  to { box-shadow: 0 0 28px rgba(252,129,129,0.6); }
}
.tl-node[style*="left: 0%"] .tl-node-tag,
.tl-node[style*="left:0%"] .tl-node-tag {
  color: #fc8181 !important;
}

/* Bottom — add area */
.tl-bottom { margin-top: 4px; }
CSSEOF

echo "✅ 完成"
