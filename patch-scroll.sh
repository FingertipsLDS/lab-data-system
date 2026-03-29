#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Rename 项目 to 课题 everywhere
c = c.replace("label: '项目'", "label: '课题'")
c = c.replace("'项目'", "'课题'")
c = c.replace('"项目"', '"课题"')
c = c.replace('>项目<', '>课题<')
c = c.replace('项目管理', '课题管理')
c = c.replace('新建项目', '新建课题')
c = c.replace('暂无项目', '暂无课题')
c = c.replace('创建第一个项目', '创建第一个课题')
c = c.replace('所属项目', '所属课题')
c = c.replace('不关联', '不关联')
c = c.replace('请先创建项目', '请先创建课题')
c = c.replace('请填写项目名称', '请填写课题名称')
c = c.replace('课题名称', '课题名称')
c = c.replace('返回课题', '返回课题')
# Fix back button
c = c.replace("'返回'", "'返回'")
print("  ✓ 项目改名为课题")

# 2. Replace TimelineCard with iOS scroll picker version
old_tl_start = '// ═══ Timeline Card ═══'
old_tl_end = '\n// ═══ Experiment Detail'

idx_s = c.find(old_tl_start)
idx_e = c.find(old_tl_end)

if idx_s > 0 and idx_e > 0:
    new_tl = '''// ═══ Timeline Card ═══
function TimelineCard({ timeline, daysPassed, dayPct, onSave }: { timeline: any; daysPassed: number; dayPct: number; onSave: (tl: any) => void }) {
  const [adding, setAdding] = useState(false);
  const [editDays, setEditDays] = useState(false);
  const [scrollDay, setScrollDay] = useState(3);
  const [nl, setNl] = useState('');
  const [totalScrollVal, setTotalScrollVal] = useState(timeline.duration_days);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalScrollRef = useRef<HTMLDivElement>(null);

  const ms = [...(timeline.milestones || [])].sort((a: any, b: any) => a.day - b.day);
  const next = ms.find((m: any) => m.day > daysPassed);

  useEffect(() => { setTotalScrollVal(timeline.duration_days); }, [timeline.duration_days]);

  // Scroll to selected value
  useEffect(() => {
    if (adding && scrollRef.current) {
      const el = scrollRef.current.querySelector('.scroll-selected');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [adding, scrollDay]);

  useEffect(() => {
    if (editDays && totalScrollRef.current) {
      const el = totalScrollRef.current.querySelector('.scroll-selected');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [editDays, totalScrollVal]);

  const add = () => { if (!nl.trim()) return; onSave({ ...timeline, milestones: [...(timeline.milestones||[]), { day: scrollDay, label: nl.trim() }] }); setAdding(false); setNl(''); };
  const rm = (i: number) => onSave({ ...timeline, milestones: (timeline.milestones||[]).filter((_:any,j:number) => j!==i) });
  const saveTotalDays = (d: number) => { onSave({ ...timeline, duration_days: d }); setEditDays(false); };

  const maxDay = timeline.duration_days;
  const dayRange = Array.from({ length: maxDay }, (_, i) => i + 1);
  const totalRange = [3,5,7,10,14,21,30,45,60,90,120,150,180,240,300,365];

  return (
    <div className="tl-card">
      <div className="tl-top">
        <span className="tl-day">第 {daysPassed} 天</span>
        {editDays ? (
          <div className="ios-picker-wrap">
            <div className="ios-picker" ref={totalScrollRef}>
              {totalRange.map(d => (
                <div key={d} className={`ios-item ${totalScrollVal===d?'scroll-selected':''}`} onClick={() => saveTotalDays(d)}>{d} 天</div>
              ))}
            </div>
            <span className="ios-close" onClick={() => setEditDays(false)}>×</span>
          </div>
        ) : (
          <span className="tl-total" onClick={() => setEditDays(true)}>{timeline.duration_days} 天</span>
        )}
      </div>
      <div className="tl-bar">
        <div className="tl-fill" style={{ width: dayPct+'%' }} />
        <div className="tl-now" style={{ left: dayPct+'%' }} />
        {ms.map((m:any,i:number) => {
          const p = Math.min(100,(m.day/timeline.duration_days)*100);
          return <div key={i} className={`tl-dot ${daysPassed>=m.day?'done':''}`} style={{left:p+'%'}} title={`第${m.day}天 ${m.label}`} />;
        })}
      </div>
      {next && <div className="tl-next">→ 第{next.day}天 {next.label}（{next.day-daysPassed}天后）</div>}
      <div className="tl-list">
        {ms.map((m:any,i:number) => {
          const done = daysPassed>=m.day;
          return <div key={i} className={`tl-item ${done?'done':''}`}><span className="tl-item-day">{m.day}</span><span className="tl-item-label">{m.label}</span>{done&&<span className="tl-item-check">✓</span>}<span className="tl-item-rm" onClick={()=>rm((timeline.milestones||[]).indexOf(m))}>×</span></div>;
        })}
        {adding ? (
          <div className="tl-add-panel">
            <div className="tl-add-cols">
              <div className="ios-picker-col">
                <div className="ios-picker" ref={scrollRef}>
                  {dayRange.map(d => (
                    <div key={d} className={`ios-item ${scrollDay===d?'scroll-selected':''}`} onClick={() => setScrollDay(d)}>{d}</div>
                  ))}
                </div>
                <div className="ios-label">天</div>
              </div>
              <div className="tl-add-right">
                <input className="tl-add-txt" value={nl} onChange={e=>setNl(e.target.value)} placeholder="" autoFocus onKeyDown={e=>{if(e.key==='Enter')add();if(e.key==='Escape')setAdding(false);}} />
                <div className="tl-add-btns">
                  <span className="tl-add-ok" onClick={add}>确定</span>
                  <span className="tl-add-cancel" onClick={()=>setAdding(false)}>取消</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="tl-add-btn" onClick={()=>{setScrollDay(daysPassed+3>maxDay?maxDay:daysPassed+3);setAdding(true);}}>+</div>
        )}
      </div>
    </div>
  );
}

'''
    c = c[:idx_s] + new_tl + c[idx_e:]
    print("  ✓ 进度条改为滚轮选择器")
else:
    print(f"  ⚠ 未找到 TimelineCard ({idx_s}, {idx_e})")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS for iOS-style scroll picker
cat >> src/App.css << 'CSSEOF'

/* ═══ iOS SCROLL PICKER ═══ */
.ios-picker-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  animation: secFade 0.2s ease;
}
.ios-picker {
  height: 100px;
  overflow-y: auto;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-panel);
  width: 70px;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
}
.ios-picker::-webkit-scrollbar { width: 0; }
.ios-item {
  padding: 6px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
  scroll-snap-align: center;
  transition: all 0.15s ease;
  font-variant-numeric: tabular-nums;
}
.ios-item:hover { color: var(--text-secondary); background: rgba(255,255,255,0.02); }
.ios-item.scroll-selected {
  color: var(--accent) !important;
  font-weight: 700;
  font-size: 15px;
  background: rgba(99,179,237,0.06);
  text-shadow: 0 0 8px rgba(99,179,237,0.3);
}
.ios-label {
  text-align: center;
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 2px;
}
.ios-close {
  font-size: 16px;
  color: var(--text-dim);
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s;
}
.ios-close:hover { color: var(--status-danger); }

/* Add panel with scroll picker */
.tl-add-panel {
  display: inline-flex;
  border: 1px solid rgba(99,179,237,0.12);
  border-radius: 8px;
  background: var(--bg-panel);
  padding: 8px;
  animation: secFade 0.2s ease;
}
.tl-add-cols {
  display: flex;
  gap: 10px;
  align-items: stretch;
}
.ios-picker-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tl-add-right {
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
}
.tl-add-txt {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-default);
  background: var(--bg-deep);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font);
  outline: none;
  width: 120px;
}
.tl-add-txt:focus { border-color: var(--accent); box-shadow: 0 0 8px rgba(99,179,237,0.08); }
.tl-add-btns { display: flex; gap: 8px; }
.tl-add-ok {
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}
.tl-add-ok:hover { opacity: 0.7; }
.tl-add-cancel {
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.2s;
}
.tl-add-cancel:hover { color: var(--status-danger); }
CSSEOF

echo "✅ 完成"
