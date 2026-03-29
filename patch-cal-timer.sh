#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 综合修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Remove clone experiment button
old_clone = '<button className="btn sm" onClick={() => { (async () => { const s = useStore.getState(); const e = s.experiments.find((x: any) => x.id === exp.id); if (e) { await s.addExperiment({ projectId: e.projectId, title: e.title + " (副本)", type: e.type, date: new Date().toISOString().slice(0,10), purpose: e.purpose, materials: e.materials, steps: e.steps, parameters: "", results: "", conclusion: "", issues: "", nextSteps: "", status: "进行中" } as any); await s.loadAll(); alert("复制成功"); } })(); }} style={{ marginRight: 6 }}>复制实验</button>'
if old_clone in c:
    c = c.replace(old_clone, '')
    print("  ✓ 删除复制实验按钮")
else:
    # try simpler pattern
    import re
    c = re.sub(r'<button[^>]*>复制实验</button>\s*', '', c)
    print("  ✓ 删除复制实验按钮(regex)")

# 2. Fix day picker — disable full days
old_picker = """{dayRange.map(d => (<div key={d} className={`ios-item ${scrollDay===d?'scroll-selected':''}`} onClick={() => setScrollDay(d)}>{d}</div>))}"""
new_picker = """{dayRange.map(d => { const full = allMs.filter((m: any) => m.day === d).length >= 2; return <div key={d} className={`ios-item ${scrollDay===d?'scroll-selected':''} ${full?'ios-disabled':''}`} onClick={() => { if (!full) setScrollDay(d); }}>{d}</div>; })}"""
if old_picker in c:
    c = c.replace(old_picker, new_picker)
    print("  ✓ 已满天数不可选")

# 3. Add Calendar + Timer components before HomePage
insert_before = 'function HomePage'
idx = c.find(insert_before)
if idx > 0:
    components = '''
// ═══ Calendar Widget ═══
function CalendarWidget({ experiments }: { experiments: any[] }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const firstDay = new Date(month.y, month.m, 1).getDay();
  const today = new Date();
  const milestoneDays: Record<number, string[]> = {};
  experiments.forEach((e: any) => {
    let tl: any = { milestones: [] };
    try { if (e.parameters) tl = JSON.parse(e.parameters); } catch {}
    const start = new Date(e.date);
    (tl.milestones || []).forEach((m: any) => {
      const d = new Date(start); d.setDate(d.getDate() + m.day);
      if (d.getFullYear() === month.y && d.getMonth() === month.m) {
        const day = d.getDate();
        if (!milestoneDays[day]) milestoneDays[day] = [];
        milestoneDays[day].push(e.title + ': ' + m.label);
      }
    });
  });
  const prev = () => setMonth(p => p.m === 0 ? { y: p.y-1, m: 11 } : { y: p.y, m: p.m-1 });
  const next = () => setMonth(p => p.m === 11 ? { y: p.y+1, m: 0 } : { y: p.y, m: p.m+1 });
  const isToday = (d: number) => today.getFullYear()===month.y && today.getMonth()===month.m && today.getDate()===d;
  return (
    <div className="cal-widget">
      <div className="cal-head"><span className="cal-arr" onClick={prev}>‹</span><span className="cal-mo">{month.y}年{month.m+1}月</span><span className="cal-arr" onClick={next}>›</span></div>
      <div className="cal-wk">{['日','一','二','三','四','五','六'].map(d=><div key={d}>{d}</div>)}</div>
      <div className="cal-grid">
        {Array.from({length:firstDay},(_,i)=><div key={'e'+i} className="cal-c" />)}
        {Array.from({length:daysInMonth},(_,i)=>{
          const day=i+1; const ev=milestoneDays[day];
          return <div key={day} className={`cal-c ${isToday(day)?'today':''} ${ev?'has':''}`} title={ev?ev.join('\\n'):''}><span>{day}</span>{ev && <div className="cal-dots">{ev.slice(0,3).map((_,j)=><i key={j}/>)}</div>}</div>;
        })}
      </div>
    </div>
  );
}

// ═══ Timer Widget ═══
function TimerWidget() {
  const [sec, setSec] = useState(0);
  const [on, setOn] = useState(false);
  const [lbl, setLbl] = useState('');
  const ref = useRef<any>(null);
  useEffect(() => { if (on) { ref.current = setInterval(() => setSec(s=>s+1), 1000); } else { clearInterval(ref.current); } return () => clearInterval(ref.current); }, [on]);
  const fmt = (s: number) => { const m=Math.floor(s/60); const ss=s%60; const h=Math.floor(m/60); return h>0?`${h}:${String(m%60).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; };
  return (
    <div className="tmr-widget">
      <div className="tmr-time">{fmt(sec)}</div>
      {!on && sec===0 && <input className="tmr-lbl" value={lbl} onChange={e=>setLbl(e.target.value)} placeholder="计时标签" />}
      {lbl && sec>0 && <div className="tmr-lbl-show">{lbl}</div>}
      <div className="tmr-btns">
        <span className="tmr-btn" onClick={()=>setOn(!on)}>{on?'⏸ 暂停':sec>0?'▶ 继续':'▶ 开始'}</span>
        {sec>0&&!on&&<span className="tmr-btn rst" onClick={()=>{setSec(0);setLbl('');}}>↺ 重置</span>}
      </div>
    </div>
  );
}

'''
    c = c[:idx] + components + c[idx:]
    print("  ✓ 添加 Calendar + Timer 组件")

# 4. Insert into HomePage — after 待办 section
# Find the sec-title 待办 and the card after it, then insert after the grid-2 closes
todo_idx = c.find('"sec-title">待办</div>')
if todo_idx > 0:
    # Find the closing of the parent grid-2
    # Search forward for pattern: two consecutive closing divs at right indentation
    search = c[todo_idx:]
    # Find the empty-sm or the clickable-empty-inline card end
    card_end = search.find('</div>\n        </div>')
    if card_end > 0:
        abs_pos = todo_idx + card_end + len('</div>\n        </div>')
        insert_html = '''

      {/* Calendar + Timer */}
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div><div className="sec-title">实验日历</div><CalendarWidget experiments={experiments} /></div>
        <div><div className="sec-title">计时器</div><TimerWidget /></div>
      </div>'''
        c = c[:abs_pos] + insert_html + c[abs_pos:]
        print("  ✓ 工作台添加日历和计时器")
    else:
        print("  ⚠ 未找到待办卡片结束位置")
else:
    print("  ⚠ 未找到待办区域")

with open('src/App.tsx', 'w') as f:
    f.write(c)
print("\n前端完成")
PYEOF

# 5. Improve cell drawing in background
python3 << 'PYEOF2'
with open('src/components/BioBackground.tsx', 'r') as f:
    c = f.read()

old_cell_start = "function drawCell(c: CanvasRenderingContext2D, p: Particle) {"
old_cell_end = "c.restore();\n    }\n\n    // 1: Protein"

idx_s = c.find(old_cell_start)
idx_e = c.find(old_cell_end)

if idx_s > 0 and idx_e > 0:
    new_cell = """function drawCell(c: CanvasRenderingContext2D, p: Particle) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#90cdf4'; c.lineWidth = 1.2;
      // membrane — wobbly
      c.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.04) {
        const w = 1 + Math.sin(a * 6 + p.rot * 3) * 0.04;
        const px = Math.cos(a) * p.size * 0.48 * w;
        const py = Math.sin(a) * p.size * 0.38 * w;
        a === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
      }
      c.closePath(); c.stroke();
      // subtle fill
      c.globalAlpha = p.op * 0.1; c.fillStyle = '#90cdf4'; c.fill(); c.globalAlpha = p.op;
      // nucleus
      c.lineWidth = 1.0;
      c.beginPath(); c.ellipse(p.size*0.04, 0, p.size*0.16, p.size*0.12, 0.2, 0, Math.PI*2); c.stroke();
      c.globalAlpha = p.op * 0.15; c.fill(); c.globalAlpha = p.op;
      // nucleolus
      c.globalAlpha = p.op * 0.4;
      c.beginPath(); c.arc(p.size*0.07, 0, p.size*0.045, 0, Math.PI*2); c.fill();
      // mitochondria
      c.globalAlpha = p.op * 0.5; c.lineWidth = 0.8;
      [[-0.24,0.1,-0.3],[0.26,0.13,0.6],[-0.12,-0.18,1.0]].forEach(([mx,my,ma]) => {
        c.beginPath(); c.ellipse(p.size*mx, p.size*my, p.size*0.065, p.size*0.028, ma, 0, Math.PI*2); c.stroke();
      });
      // vesicles
      c.globalAlpha = p.op * 0.35;
      [[0.28,-0.08,0.02],[-0.3,-0.12,0.018],[0.12,0.2,0.025]].forEach(([vx,vy,vr]) => {
        c.beginPath(); c.arc(p.size*vx, p.size*vy, p.size*vr, 0, Math.PI*2); c.stroke();
      });
      c.restore();
    }

    // 1: Protein"""
    c = c[:idx_s] + new_cell + c[idx_e:]
    print("  ✓ 细胞样式优化")

with open('src/components/BioBackground.tsx', 'w') as f:
    f.write(c)
PYEOF2

# 6. CSS
cat >> src/App.css << 'CSSEOF'

/* ═══ CALENDAR ═══ */
.cal-widget { background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:10px; padding:14px; }
.cal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.cal-mo { font-size:14px; font-weight:700; color:#f1f5f9; }
.cal-arr { font-size:20px; color:#718096; cursor:pointer; padding:0 8px; transition:color 0.2s; user-select:none; }
.cal-arr:hover { color:#90cdf4; }
.cal-wk { display:grid; grid-template-columns:repeat(7,1fr); margin-bottom:4px; }
.cal-wk div { text-align:center; font-size:10px; color:#4a5568; font-weight:600; padding:2px 0; }
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.cal-c { text-align:center; padding:5px 2px; border-radius:6px; font-size:12px; color:#a0aec0; position:relative; min-height:30px; transition:all 0.2s; }
.cal-c.today { background:rgba(99,179,237,0.12); color:#90cdf4; font-weight:700; }
.cal-c.has { cursor:pointer; }
.cal-c.has:hover { background:rgba(99,179,237,0.08); }
.cal-dots { display:flex; gap:2px; justify-content:center; margin-top:1px; }
.cal-dots i { width:4px; height:4px; border-radius:50%; background:#63b3ed; display:block; box-shadow:0 0 4px rgba(99,179,237,0.4); }

/* ═══ TIMER ═══ */
.tmr-widget { background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:10px; padding:24px 14px; text-align:center; }
.tmr-time { font-size:40px; font-weight:200; color:#f1f5f9; font-variant-numeric:tabular-nums; letter-spacing:3px; margin-bottom:12px; font-family:'SF Mono','Menlo',monospace; }
.tmr-lbl { background:var(--bg-deep); border:1px solid var(--border-subtle); border-radius:6px; padding:6px 10px; color:#a0aec0; font-size:12px; font-family:var(--font); outline:none; text-align:center; width:140px; margin-bottom:10px; }
.tmr-lbl:focus { border-color:rgba(99,179,237,0.3); }
.tmr-lbl-show { font-size:11px; color:#718096; margin-bottom:8px; }
.tmr-btns { display:flex; gap:10px; justify-content:center; }
.tmr-btn { font-size:13px; color:#90cdf4; cursor:pointer; padding:5px 16px; border-radius:6px; border:1px solid rgba(99,179,237,0.15); transition:all 0.25s; user-select:none; }
.tmr-btn:hover { background:rgba(99,179,237,0.08); border-color:rgba(99,179,237,0.3); }
.tmr-btn.rst { color:#718096; border-color:rgba(255,255,255,0.06); }

/* ═══ iOS disabled ═══ */
.ios-item.ios-disabled { color:#2d3748!important; cursor:not-allowed!important; pointer-events:none; opacity:0.4; }

/* ═══ Node z-index fix ═══ */
.tl-n { z-index:8!important; }
.tl-n.drag { z-index:20!important; }
.tl-n-end { z-index:5!important; }
CSSEOF

echo "✅ 完成"
