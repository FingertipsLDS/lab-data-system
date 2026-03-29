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
  const barRef = useRef<HTMLDivElement>(null);

  const allMs: any[] = timeline.milestones || [];
  const maxDay = timeline.duration_days;
  const dayRange = Array.from({ length: maxDay }, (_, i) => i + 1);
  const latestRef = useRef(allMs);
  latestRef.current = allMs;

  useEffect(() => { setTotalVal(String(timeline.duration_days)); }, [timeline.duration_days]);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...allMs, { day: scrollDay, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const saveTotal = () => { const v = parseInt(totalVal) || 30; onSave({ ...timeline, duration_days: Math.max(1, v) }); setEditTotal(false); };

  const handleMouseDown = (e: React.MouseEvent, origIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragIdx(origIdx);
    setBumpedIdxs([]);
    const otherIdxs = allMs.map((_: any, i: number) => i).filter((i: number) => i !== origIdx);

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      let newDay = Math.max(0, Math.min(maxDay, Math.round(pct * maxDay)));
      const cur = latestRef.current;
      const otherDays = otherIdxs.map((i: number) => cur[i]?.day);

      // Bump detection
      const bumped: number[] = [];
      otherIdxs.forEach((oi: number) => { if (cur[oi]?.day === newDay && newDay > 0) bumped.push(oi); });
      setBumpedIdxs(bumped);

      // Snap away from occupied
      if (newDay > 0 && otherDays.includes(newDay)) {
        const dir = pct > ((cur[origIdx]?.day || 0) / maxDay) ? 1 : -1;
        for (let off = 1; off <= maxDay; off++) {
          const t = newDay + dir * off;
          if (t > 0 && t <= maxDay && !otherDays.includes(t)) { newDay = t; break; }
          const t2 = newDay - dir * off;
          if (t2 > 0 && t2 <= maxDay && !otherDays.includes(t2)) { newDay = t2; break; }
        }
      }

      const updated = cur.map((m: any, i: number) => i === origIdx ? { ...m, day: newDay } : m);
      onSave({ ...timeline, milestones: updated });
    };

    const onUp = () => {
      setBumpedIdxs([]);
      const cleaned = latestRef.current.filter((m: any) => m.day > 0);
      if (cleaned.length < latestRef.current.length) onSave({ ...timeline, milestones: cleaned });
      setDragIdx(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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

      <div className="tl-track" ref={barRef}>
        <div className="tl-line"><div className="tl-line-fill" style={{ width: dayPct+'%' }} /></div>
        <div className="tl-today" style={{ left: dayPct+'%' }} />

        {/* 0-day node: delete all */}
        <div className={`tl-n tl-n-zero ${allMs.length > 0 ? 'has-nodes' : ''}`} style={{ left: '0%' }} onClick={() => { if (allMs.length > 0 && confirm('删除所有节点？')) onSave({ ...timeline, milestones: [] }); }}>
          <div className="tl-n-sphere zero-sphere">{allMs.length > 0 ? <Trash2 size={10} /> : <span>0</span>}</div>
        </div>

        {/* Milestone nodes */}
        {sorted.map((m: any) => {
          const oi = m._idx;
          const p = Math.min(100, Math.max(0, (m.day / maxDay) * 100));
          const done = daysPassed >= m.day;
          const isDrag = dragIdx === oi;
          const isBumped = bumpedIdxs.includes(oi);
          return (
            <div key={oi} className={`tl-n ${done?'done':''} ${isDrag?'drag':''} ${isBumped?'bumped':''}`} style={{ left: p+'%' }} onMouseDown={e => handleMouseDown(e, oi)}>
              <div className="tl-n-label">{m.label}</div>
              <div className="tl-n-sphere"><span>{m.day}</span></div>
            </div>
          );
        })}

        {/* End node: add */}
        <div className="tl-n tl-n-end" style={{ left: '100%' }} onClick={() => { setScrollDay(Math.min(maxDay, daysPassed + 3 || 3)); setAdding(true); }}>
          <div className="tl-n-sphere end-sphere"><Plus size={10} /></div>
        </div>
      </div>

      {/* Add panel */}
      {adding && (
        <div className="tl-add-panel" style={{ marginTop: 8 }}>
          <div className="tl-add-cols">
            <div className="ios-picker-col">
              <div className="ios-picker">
                {dayRange.map(d => (<div key={d} className={`ios-item ${scrollDay===d?'scroll-selected':''}`} onClick={() => setScrollDay(d)}>{d}</div>))}
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
      )}
    </div>
  );
}

'''
    c = c[:idx_s] + new_tl + c[idx_e:]
    print("  ✓ TimelineCard 重写")
else:
    print(f"  ⚠ 未找到 ({idx_s},{idx_e})")

with open('src/App.tsx', 'w') as f:
    f.write(c)
print("\n完成")
PYEOF

# CSS — override everything
cat >> src/App.css << 'CSSEOF'

/* ═══ HIDE OLD ═══ */
.tl-ms,.tl-delete-zone,.tl-next,.tl-item,.tl-drag-hint,.tl-ms-del,
.tl-del-dot,.tl-node,.tl-bar-area,.tl-bar,.tl-fill,.tl-now,.tl-dot,
.tl-zero-del,.tl-bottom { display:none!important }

/* ═══ ADD BUTTON (old) — hide ═══ */
.tl-add-btn { display:none!important }

/* ═══ TRACK ═══ */
.tl-track { position:relative; height:56px; margin-bottom:2px; padding:0 }

.tl-line { position:absolute; top:50%; left:0; right:0; height:3px; transform:translateY(-50%); background:rgba(255,255,255,0.05); border-radius:2px }
.tl-line-fill { height:100%; border-radius:2px; background:linear-gradient(90deg,rgba(58,143,212,0.3),rgba(99,179,237,0.6)); box-shadow:0 0 8px rgba(99,179,237,0.15); transition:width 0.5s ease }

.tl-today { position:absolute; top:50%; transform:translate(-50%,-50%); width:6px; height:6px; background:var(--accent); border-radius:50%; box-shadow:0 0 8px rgba(99,179,237,0.5); z-index:3; transition:left 0.5s ease }

/* ═══ NODE BASE ═══ */
.tl-n { position:absolute; top:50%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; cursor:grab; z-index:6; transition:left 0.1s linear; user-select:none }
.tl-n.drag { cursor:grabbing; z-index:18; transition:none!important }

.tl-n-label { position:absolute; bottom:calc(100% + 3px); font-size:10px; color:var(--text-dim); white-space:nowrap; max-width:50px; overflow:hidden; text-overflow:ellipsis; text-align:center; transition:all 0.3s ease; pointer-events:none }
.tl-n:hover .tl-n-label { color:var(--accent); transform:translateY(-2px); text-shadow:0 0 6px rgba(99,179,237,0.3) }
.tl-n.done .tl-n-label { color:rgba(72,187,120,0.5) }
.tl-n.drag .tl-n-label { color:var(--accent); font-weight:600; transform:translateY(-4px) }

/* ═══ SPHERE — 3D with number ═══ */
.tl-n-sphere {
  width:18px; height:18px; border-radius:50%;
  background:radial-gradient(circle at 38% 28%, #90cdf4, #4299e1 45%, #2b6cb0 100%);
  box-shadow:0 2px 5px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.2);
  display:flex; align-items:center; justify-content:center;
  transition:all 0.35s cubic-bezier(0.22,1,0.36,1);
  position:relative;
}
.tl-n-sphere span { font-size:8px; font-weight:800; color:rgba(255,255,255,0.85); line-height:1; font-variant-numeric:tabular-nums }
.tl-n-sphere svg { color:rgba(255,255,255,0.85) }

.tl-n.done .tl-n-sphere { background:radial-gradient(circle at 38% 28%, #9ae6b4, #48bb78 45%, #276749 100%) }

/* Hover */
.tl-n:hover .tl-n-sphere { width:24px; height:24px; box-shadow:0 2px 6px rgba(0,0,0,0.35), inset 0 1px 3px rgba(255,255,255,0.25), 0 0 18px rgba(66,153,225,0.4) }
.tl-n:hover .tl-n-sphere span { font-size:9px }
.tl-n.done:hover .tl-n-sphere { box-shadow:0 2px 6px rgba(0,0,0,0.35), inset 0 1px 3px rgba(255,255,255,0.25), 0 0 18px rgba(72,187,120,0.4) }

/* Drag */
.tl-n.drag .tl-n-sphere { width:26px; height:26px; animation:sPulse 0.6s infinite alternate }
@keyframes sPulse { from{box-shadow:0 2px 5px rgba(0,0,0,0.35),0 0 12px rgba(66,153,225,0.3)} to{box-shadow:0 2px 5px rgba(0,0,0,0.35),0 0 28px rgba(66,153,225,0.6)} }

/* Drag to 0 — red */
.tl-n.drag[style*="left: 0%"] .tl-n-sphere,
.tl-n.drag[style*="left:0%"] .tl-n-sphere {
  background:radial-gradient(circle at 38% 28%, #feb2b2, #fc8181 45%, #c53030 100%)!important;
  animation:sRedPulse 0.4s infinite alternate!important;
}
@keyframes sRedPulse { from{box-shadow:0 2px 5px rgba(0,0,0,0.35),0 0 14px rgba(252,129,129,0.4)} to{box-shadow:0 2px 5px rgba(0,0,0,0.35),0 0 30px rgba(252,129,129,0.7)} }

/* ═══ BUMP — springy hop ═══ */
.tl-n.bumped { animation:bump 0.5s cubic-bezier(0.34,1.8,0.64,1) }
@keyframes bump {
  0%   { transform:translate(-50%,-50%) }
  25%  { transform:translate(-50%,calc(-50% - 22px)) scale(1.15) }
  50%  { transform:translate(-50%,calc(-50% - 10px)) scale(1.08) }
  75%  { transform:translate(-50%,calc(-50% - 3px)) scale(1.02) }
  100% { transform:translate(-50%,-50%) scale(1) }
}

/* ═══ ZERO NODE — delete icon ═══ */
.tl-n-zero { cursor:default; z-index:10 }
.tl-n-zero .tl-n-label { display:none }
.zero-sphere {
  background:radial-gradient(circle at 38% 28%, #a0aec0, #718096 45%, #4a5568 100%)!important;
  box-shadow:0 2px 5px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.1)!important;
}
.tl-n-zero.has-nodes { cursor:pointer }
.tl-n-zero.has-nodes .zero-sphere {
  background:radial-gradient(circle at 38% 28%, #ff9b9b, #e53e3e 45%, #9b2c2c 100%)!important;
  box-shadow:0 2px 5px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.15), 0 0 14px rgba(229,62,62,0.35)!important;
}
.tl-n-zero.has-nodes:hover .zero-sphere {
  width:24px!important; height:24px!important;
  box-shadow:0 2px 6px rgba(0,0,0,0.35), inset 0 1px 3px rgba(255,255,255,0.2), 0 0 28px rgba(229,62,62,0.55)!important;
}
.tl-n-zero.has-nodes .zero-sphere svg { width:12px!important; height:12px!important }

/* ═══ END NODE — add button ═══ */
.tl-n-end { cursor:pointer; z-index:7 }
.tl-n-end .tl-n-label { display:none }
.end-sphere {
  background:radial-gradient(circle at 38% 28%, #a0aec0, #718096 45%, #4a5568 100%)!important;
  border:1px dashed rgba(255,255,255,0.15);
  box-shadow:0 2px 5px rgba(0,0,0,0.25)!important;
}
.tl-n-end:hover .end-sphere {
  width:24px!important; height:24px!important;
  background:radial-gradient(circle at 38% 28%, #90cdf4, #4299e1 45%, #2b6cb0 100%)!important;
  border:none;
  box-shadow:0 2px 6px rgba(0,0,0,0.35), inset 0 1px 3px rgba(255,255,255,0.25), 0 0 20px rgba(66,153,225,0.4)!important;
}
.end-sphere svg { width:10px!important; height:10px!important; color:rgba(255,255,255,0.6) }
.tl-n-end:hover .end-sphere svg { color:rgba(255,255,255,0.9) }
CSSEOF

echo "✅ 完成"
