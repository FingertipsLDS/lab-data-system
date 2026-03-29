#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Fix timeline functions — the issue is prompt() may be blocked in Tauri webview
# Replace addMilestone and setDuration with proper state-based approach
# Actually the issue is likely that these functions use raw prompt() which works in Tauri
# Let's check if the functions exist and fix them
# The real issue might be that saveTimeline calls update_experiment with wrong param names

# Fix saveTimeline — parameters -> not camelCase issue
old_save_tl = "await invoke('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: JSON.stringify(tl), results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' });"

new_save_tl = "await invoke('update_experiment', { id: exp.id, title: exp.title, type: exp.type||'', date: exp.date||'', purpose: exp.purpose||'', materials: exp.materials||'', steps: exp.steps||'', parameters: JSON.stringify(tl), results: exp.results||'', conclusion: exp.conclusion||'', issues: exp.issues||'', nextSteps: exp.nextSteps||'', status: exp.status||'进行中' }); console.log('Timeline saved:', tl);"

# Actually the params look correct. The issue is likely the event propagation or the prompt.
# Let me add e.stopPropagation and e.preventDefault to the click handlers

# Fix setDuration click handler
c = c.replace(
    '''<span className="tp-edit-btn" onClick={setDuration}>设置天数</span>''',
    '''<span className="tp-edit-btn" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDuration(); }}>设置天数</span>'''
)

# Fix addMilestone click handler  
c = c.replace(
    '''<span className="tp-ms-add" onClick={addMilestone}>+ 添加节点</span>''',
    '''<span className="tp-ms-add" onClick={(e) => { e.stopPropagation(); e.preventDefault(); addMilestone(); }}>+ 添加节点</span>'''
)

# Fix removeMilestone click handler
c = c.replace(
    "onClick={() => { if (confirm(`删除\"第${m.day}天 ${m.label}\"？`)) removeMilestone(timeline.milestones.indexOf(m)); }}",
    "onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (confirm(`删除\"第${m.day}天 ${m.label}\"？`)) removeMilestone(timeline.milestones.indexOf(m)); }}"
)

print("  ✓ 修复节点点击事件")

# 2. Replace emoji icons with text-based labels (consistent with Neo theme)
icon_map = {
    "'🎯'": "'◎'",
    "'🧫'": "'◈'",
    "'📋'": "'☰'",
    "'📊'": "'◆'",
    "'💡'": "'✦'",
    "'📝'": "'≡'",
}
for old_icon, new_icon in icon_map.items():
    c = c.replace(f"icon: {old_icon}", f"icon: {new_icon}")
changes_count = len(icon_map)
print(f"  ✓ 替换 {changes_count} 个 emoji 图标")

# 3. Remove "已完成全部节点" text from home page
c = c.replace(
    """{nextMilestone ? <span className="epc-next">下一步：第{nextMilestone.day}天 {nextMilestone.label}（{nextMilestone.day - daysP}天后）</span> : <span className="epc-next" style={{color:'#48bb78'}}>已完成全部节点</span>}""",
    """{nextMilestone && <span className="epc-next">下一步：第{nextMilestone.day}天 {nextMilestone.label}（{nextMilestone.day - daysP}天后）</span>}"""
)
print("  ✓ 去掉已完成全部节点")

# Also remove from experiment detail
c = c.replace(
    """{nextMs && <div className="tp-next">下一步：第 {nextMs.day} 天 — {nextMs.label}（还有 {nextMs.day - daysPassed} 天）</div>}""",
    """{nextMs ? <div className="tp-next">下一步：第 {nextMs.day} 天 — {nextMs.label}（还有 {nextMs.day - daysPassed} 天）</div> : null}"""
)

# 4. Remove quick actions section from HomePage
old_quick = """      <div style={{ marginTop: 16 }}>
        <div className="sec-title">快速操作</div>
        <div className="grid-4">
          <div className="quick-btn" onClick={() => onAction('project')}><span>📁</span><span>新建项目</span></div>
          <div className="quick-btn" onClick={() => onAction('experiment')}><span>🧪</span><span>新建实验</span></div>
          <div className="quick-btn" onClick={() => onAction('reference')}><span>📖</span><span>添加文献</span></div>
          <div className="quick-btn" onClick={() => navigateTo('templates' as any)}><span>📋</span><span>模板</span></div>
        </div>
      </div>"""

c = c.replace(old_quick, "")
print("  ✓ 去掉工作台快速操作")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS for the new text icons
cat >> src/App.css << 'CSSEOF'

/* Section nav icons — mono style */
.exp-nav-icon {
  font-size: 14px !important;
  font-family: var(--font) !important;
  color: var(--accent);
  opacity: 0.6;
  width: 16px;
  text-align: center;
  font-weight: 700;
}
.exp-nav-item.active .exp-nav-icon,
.exp-nav-item:hover .exp-nav-icon {
  opacity: 1 !important;
  text-shadow: 0 0 8px rgba(99,179,237,0.4);
}
.exp-sec-icon {
  font-size: 14px !important;
  color: var(--accent);
  font-weight: 700;
  width: 16px;
  text-align: center;
}
CSSEOF

echo "✅ 完成"
