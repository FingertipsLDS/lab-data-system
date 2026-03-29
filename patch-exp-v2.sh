#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改实验详情..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Remove Badge from experiment detail header
c = c.replace(
    '''<Badge>{exp.status}</Badge>
            <span className="text-xs muted"><Calendar size={12} /> {formatDate(exp.date)} · {exp.type}</span>''',
    '''<span className="text-xs muted"><Calendar size={12} /> {formatDate(exp.date)} · {exp.type}</span>'''
)
print("  ✓ 去掉待处理标识")

# 2. Remove icons and checkmarks from section nav
old_nav_item = '''<div key={s.key} className={`exp-nav-item ${activeSection === s.key ? 'active' : ''} ${s.content ? 'filled' : ''}`} onClick={() => setActiveSection(s.key)}>
            <span className="exp-nav-icon">{s.icon}</span><span>{s.label}</span>{s.content ? <span className="exp-nav-check">✓</span> : null}
          </div>'''

new_nav_item = '''<div key={s.key} className={`exp-nav-item ${activeSection === s.key ? 'active' : ''}`} onClick={() => setActiveSection(s.key)}>
            <span>{s.label}</span>
          </div>'''

c = c.replace(old_nav_item, new_nav_item)
print("  ✓ 去掉图标和对勾")

# Also remove icon from section card label
old_sec_label = '''<div className="exp-section-label"><span className="exp-sec-icon">{activeSec.icon}</span><span>{activeSec.label}</span></div>'''
new_sec_label = '''<div className="exp-section-label"><span>{activeSec.label}</span></div>'''
c = c.replace(old_sec_label, new_sec_label)
print("  ✓ 内容区去掉图标")

# 3. Replace the entire time-progress-card section with inline-editable version
# Find the time progress card and replace it
old_time_card_start = "      {/* Time progress bar */}"
old_time_card_end = "      {/* Section nav */}"

idx_start = c.find(old_time_card_start)
idx_end = c.find(old_time_card_end)

if idx_start > 0 and idx_end > 0:
    new_time_card = '''      {/* Time progress bar */}
      <TimelineCard 
        timeline={timeline} 
        daysPassed={daysPassed} 
        dayPct={dayPct}
        onSave={saveTimeline}
      />

'''
    c = c[:idx_start] + new_time_card + c[idx_end:]
    print("  ✓ 进度条替换为 TimelineCard 组件")

# 4. Add TimelineCard component before ExperimentDetailPage
# Find a good insertion point
insert_before = '// ═══ Experiment Detail'
if insert_before not in c:
    insert_before = 'function ExperimentDetailPage'

idx_insert = c.find(insert_before)
if idx_insert > 0:
    timeline_component = '''
// ═══ Timeline Card with inline editing ═══
function TimelineCard({ timeline, daysPassed, dayPct, onSave }: { timeline: any; daysPassed: number; dayPct: number; onSave: (tl: any) => void }) {
  const [editingDays, setEditingDays] = useState(false);
  const [daysValue, setDaysValue] = useState(timeline.duration_days);
  const [addingNode, setAddingNode] = useState(false);
  const [nodeDay, setNodeDay] = useState(daysPassed + 3);
  const [nodeLabel, setNodeLabel] = useState('');
  const daysScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDaysValue(timeline.duration_days); }, [timeline.duration_days]);

  const confirmDays = (val: number) => {
    const clamped = Math.max(1, Math.min(365, val));
    onSave({ ...timeline, duration_days: clamped });
    setEditingDays(false);
  };

  const addNode = () => {
    if (!nodeLabel.trim()) return;
    const newTl = { ...timeline, milestones: [...(timeline.milestones || []), { day: nodeDay, label: nodeLabel.trim() }] };
    onSave(newTl);
    setAddingNode(false);
    setNodeLabel('');
    setNodeDay(daysPassed + 3);
  };

  const removeNode = (idx: number) => {
    const newTl = { ...timeline, milestones: (timeline.milestones || []).filter((_: any, i: number) => i !== idx) };
    onSave(newTl);
  };

  const sortedMs = [...(timeline.milestones || [])].sort((a: any, b: any) => a.day - b.day);
  const nextMs = sortedMs.find((m: any) => m.day > daysPassed);

  // Generate day options for scroll picker
  const dayOptions = Array.from({ length: 60 }, (_, i) => (i + 1) * (i < 30 ? 1 : 5)).filter((v, i, a) => a.indexOf(v) === i && v <= 365);

  return (
    <div className="time-progress-card">
      <div className="tp-header">
        <span className="tp-label">第 {daysPassed} 天</span>
        <div className="tp-days-area">
          {editingDays ? (
            <div className="days-picker">
              <div className="days-scroll" ref={daysScrollRef}>
                {[7, 14, 21, 30, 45, 60, 90, 120, 180, 365].map(d => (
                  <div key={d} className={`days-option ${daysValue === d ? 'selected' : ''}`} onClick={() => { setDaysValue(d); confirmDays(d); }}>
                    {d} 天
                  </div>
                ))}
              </div>
              <div className="days-custom">
                <input type="number" className="days-input" value={daysValue} onChange={e => setDaysValue(parseInt(e.target.value) || 1)} onKeyDown={e => e.key === 'Enter' && confirmDays(daysValue)} autoFocus />
                <button className="btn sm primary" onClick={() => confirmDays(daysValue)}>确定</button>
                <button className="btn sm" onClick={() => setEditingDays(false)}>取消</button>
              </div>
            </div>
          ) : (
            <span className="tp-days-display" onClick={() => setEditingDays(true)}>
              共 {timeline.duration_days} 天
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="tp-bar-wrap">
        <div className="tp-bar">
          <div className="tp-fill" style={{ width: dayPct + '%' }} />
          {sortedMs.map((m: any, i: number) => {
            const pos = Math.min(100, (m.day / timeline.duration_days) * 100);
            const passed = daysPassed >= m.day;
            return <div key={i} className={`tp-marker ${passed ? 'passed' : ''}`} style={{ left: pos + '%' }}>
              <div className="tp-marker-dot" />
              <div className="tp-marker-label">{m.label}<br/><span style={{ opacity: 0.6 }}>第{m.day}天</span></div>
            </div>;
          })}
          <div className="tp-current" style={{ left: dayPct + '%' }}><div className="tp-current-dot" /></div>
        </div>
      </div>

      {/* Milestone tags */}
      <div className="tp-milestones">
        {sortedMs.map((m: any, i: number) => {
          const passed = daysPassed >= m.day;
          const originalIdx = (timeline.milestones || []).indexOf(m);
          return <span key={i} className={`tp-ms-tag ${passed ? 'passed' : daysPassed >= m.day - 2 ? 'soon' : ''}`} onClick={() => removeNode(originalIdx)}>
            第{m.day}天 {m.label} {passed ? '✓' : ''}
          </span>;
        })}

        {addingNode ? (
          <div className="tp-node-editor">
            <div className="tp-node-row">
              <span className="tp-node-label">第</span>
              <input type="number" className="tp-node-input" value={nodeDay} onChange={e => setNodeDay(parseInt(e.target.value) || 1)} min={1} max={timeline.duration_days} />
              <span className="tp-node-label">天</span>
              <input type="text" className="tp-node-input wide" value={nodeLabel} onChange={e => setNodeLabel(e.target.value)} placeholder="操作内容" autoFocus onKeyDown={e => { if (e.key === 'Enter') addNode(); if (e.key === 'Escape') setAddingNode(false); }} />
              <button className="btn sm primary" onClick={addNode}>添加</button>
              <button className="btn sm" onClick={() => setAddingNode(false)}>取消</button>
            </div>
          </div>
        ) : (
          <span className="tp-ms-add" onClick={() => setAddingNode(true)}>+ 添加节点</span>
        )}
      </div>

      {nextMs && <div className="tp-next">下一步：第 {nextMs.day} 天 — {nextMs.label}（还有 {nextMs.day - daysPassed} 天）</div>}
    </div>
  );
}

'''
    c = c[:idx_insert] + timeline_component + c[idx_insert:]
    print("  ✓ 添加 TimelineCard 组件")

# 5. Remove old addMilestone, removeMilestone, setDuration functions from ExperimentDetailPage
# They are no longer needed since TimelineCard handles everything
# But keep saveTimeline as it's passed to TimelineCard

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS for inline editors
cat >> src/App.css << 'CSSEOF'

/* ═══ DAYS PICKER ═══ */
.tp-days-area { display: flex; align-items: center; }
.tp-days-display {
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
}
.tp-days-display:hover {
  border-color: rgba(99,179,237,0.2);
  background: rgba(99,179,237,0.04);
}

.days-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: secFade 0.2s ease;
}
.days-scroll {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 2px 0;
}
.days-option {
  padding: 4px 12px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.25s ease;
}
.days-option:hover {
  border-color: rgba(99,179,237,0.25);
  color: var(--accent);
}
.days-option.selected {
  background: rgba(99,179,237,0.1);
  border-color: rgba(99,179,237,0.3);
  color: var(--accent);
  box-shadow: 0 0 12px rgba(99,179,237,0.1);
}
.days-custom {
  display: flex;
  align-items: center;
  gap: 4px;
}
.days-input {
  width: 60px;
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid var(--border-default);
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font);
  outline: none;
  text-align: center;
}
.days-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(99,179,237,0.1);
}

/* ═══ NODE EDITOR — inline ═══ */
.tp-node-editor {
  display: inline-flex;
  animation: secFade 0.2s ease;
}
.tp-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-panel);
  border: 1px solid rgba(99,179,237,0.15);
  border-radius: 6px;
  padding: 3px 6px;
}
.tp-node-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.tp-node-input {
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-default);
  background: var(--bg-deep);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font);
  outline: none;
  width: 44px;
  text-align: center;
}
.tp-node-input.wide {
  width: 120px;
  text-align: left;
}
.tp-node-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(99,179,237,0.1);
}

/* ═══ Section nav — no icons, cleaner ═══ */
.exp-nav-item {
  font-size: 13.5px !important;
  gap: 0 !important;
  padding: 7px 16px !important;
}
.exp-section-label {
  gap: 0 !important;
}
.exp-section-label span {
  font-size: 14px !important;
}

/* ═══ Timeline marker labels — bigger ═══ */
.tp-marker-label {
  font-size: 10px !important;
  line-height: 1.3;
  text-align: center;
}
CSSEOF

echo "✅ 完成"
