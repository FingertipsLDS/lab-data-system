#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 简化进度条..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Replace entire TimelineCard component
old_start = '// ═══ Timeline Card with inline editing ═══'
old_end = '\n// ═══ Experiment Detail'

idx_s = c.find(old_start)
idx_e = c.find(old_end)

if idx_s > 0 and idx_e > 0:
    new_timeline = '''// ═══ Timeline Card ═══
function TimelineCard({ timeline, daysPassed, dayPct, onSave }: { timeline: any; daysPassed: number; dayPct: number; onSave: (tl: any) => void }) {
  const [adding, setAdding] = useState(false);
  const [nd, setNd] = useState(daysPassed + 3);
  const [nl, setNl] = useState('');

  const ms = [...(timeline.milestones || [])].sort((a: any, b: any) => a.day - b.day);
  const next = ms.find((m: any) => m.day > daysPassed);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...(timeline.milestones||[]), { day: nd, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const rm = (i: number) => onSave({ ...timeline, milestones: (timeline.milestones||[]).filter((_:any,j:number) => j!==i) });
  const setDays = () => { const d = prompt('实验总天数', String(timeline.duration_days)); if (d) onSave({ ...timeline, duration_days: parseInt(d)||30 }); };

  return (
    <div className="tl-card">
      <div className="tl-top">
        <span className="tl-day">第 {daysPassed} 天</span>
        <span className="tl-total" onClick={setDays}>{timeline.duration_days} 天</span>
      </div>
      <div className="tl-bar">
        <div className="tl-fill" style={{ width: dayPct+'%' }} />
        <div className="tl-now" style={{ left: dayPct+'%' }} />
        {ms.map((m:any,i:number)=>{
          const p = Math.min(100,(m.day/timeline.duration_days)*100);
          return <div key={i} className={`tl-dot ${daysPassed>=m.day?'done':''}`} style={{left:p+'%'}} title={`第${m.day}天 ${m.label}`} />;
        })}
      </div>
      {next && <div className="tl-next">→ 第{next.day}天 {next.label}（{next.day-daysPassed}天后）</div>}
      <div className="tl-list">
        {ms.map((m:any,i:number)=>{
          const done = daysPassed>=m.day;
          return <div key={i} className={`tl-item ${done?'done':''}`}><span className="tl-item-day">{m.day}</span><span className="tl-item-label">{m.label}</span>{done&&<span className="tl-item-check">✓</span>}<span className="tl-item-rm" onClick={()=>rm((timeline.milestones||[]).indexOf(m))}>×</span></div>;
        })}
        {adding ? (
          <div className="tl-add-row">
            <input type="number" className="tl-add-input num" value={nd} onChange={e=>setNd(parseInt(e.target.value)||1)} />
            <input className="tl-add-input txt" value={nl} onChange={e=>setNl(e.target.value)} placeholder="内容" autoFocus onKeyDown={e=>{if(e.key==='Enter')add();if(e.key==='Escape')setAdding(false);}} />
            <span className="tl-add-ok" onClick={add}>✓</span>
            <span className="tl-add-cancel" onClick={()=>setAdding(false)}>×</span>
          </div>
        ) : (
          <div className="tl-add-btn" onClick={()=>setAdding(true)}>+</div>
        )}
      </div>
    </div>
  );
}

'''
    c = c[:idx_s] + new_timeline + c[idx_e:]
    print("  ✓ TimelineCard 已简化")
else:
    print(f"  ⚠ 未找到 TimelineCard (start={idx_s}, end={idx_e})")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS
cat >> src/App.css << 'CSSEOF'

/* ═══ SIMPLIFIED TIMELINE ═══ */
.tl-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 14px;
}
.tl-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
.tl-day { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.tl-total { font-size: 13px; color: var(--accent); cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
.tl-total:hover { opacity: 1; }

/* Bar */
.tl-bar { position: relative; height: 4px; background: rgba(255,255,255,0.04); border-radius: 2px; margin-bottom: 10px; }
.tl-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 2px; background: linear-gradient(90deg,#3a8fd488,#63b3ed); box-shadow: 0 0 10px rgba(99,179,237,0.2); transition: width 0.5s ease; }
.tl-now { position: absolute; top: 50%; transform: translate(-50%,-50%); width: 10px; height: 10px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px rgba(99,179,237,0.5); border: 2px solid var(--bg-card); z-index: 3; transition: left 0.5s ease; }
.tl-dot { position: absolute; top: 50%; transform: translate(-50%,-50%); width: 6px; height: 6px; border-radius: 50%; background: var(--text-dim); z-index: 2; transition: all 0.3s; }
.tl-dot.done { background: #48bb78; box-shadow: 0 0 6px rgba(72,187,120,0.4); }

/* Next hint */
.tl-next { font-size: 12px; color: var(--accent); margin-bottom: 10px; }

/* Milestone list */
.tl-list { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tl-item { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 5px; font-size: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); color: var(--text-muted); transition: all 0.25s; }
.tl-item.done { color: #48bb78; border-color: rgba(72,187,120,0.12); background: rgba(72,187,120,0.03); }
.tl-item-day { font-weight: 700; color: var(--text-secondary); min-width: 16px; }
.tl-item.done .tl-item-day { color: #48bb78; }
.tl-item-label { color: inherit; }
.tl-item-check { font-size: 10px; }
.tl-item-rm { font-size: 14px; color: var(--text-dim); cursor: pointer; margin-left: 2px; transition: color 0.2s; line-height: 1; }
.tl-item-rm:hover { color: var(--status-danger); }

/* Add row */
.tl-add-row { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px; border-radius: 5px; border: 1px solid rgba(99,179,237,0.15); background: var(--bg-panel); animation: secFade 0.15s ease; }
.tl-add-input { padding: 3px 6px; border-radius: 4px; border: 1px solid var(--border-default); background: var(--bg-deep); color: var(--text-primary); font-size: 12px; font-family: var(--font); outline: none; }
.tl-add-input:focus { border-color: var(--accent); }
.tl-add-input.num { width: 40px; text-align: center; }
.tl-add-input.txt { width: 100px; }
.tl-add-ok { cursor: pointer; color: var(--accent); font-size: 14px; padding: 0 4px; transition: opacity 0.2s; }
.tl-add-ok:hover { opacity: 0.7; }
.tl-add-cancel { cursor: pointer; color: var(--text-dim); font-size: 14px; padding: 0 4px; transition: color 0.2s; }
.tl-add-cancel:hover { color: var(--status-danger); }

/* Add button */
.tl-add-btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 5px; border: 1px dashed rgba(99,179,237,0.15); color: var(--accent); cursor: pointer; font-size: 16px; transition: all 0.3s ease; line-height: 1; }
.tl-add-btn:hover { border-color: rgba(99,179,237,0.3); background: rgba(99,179,237,0.04); box-shadow: 0 0 12px rgba(99,179,237,0.08); }
CSSEOF

echo "✅ 完成"
