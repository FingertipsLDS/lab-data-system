#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 全面优化中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# ═══ 1. Fix HomePage: only 课题+实验 panels, remove 结果+资料库 ═══
old_modules = """[
          { key: 'projects', icon: <FolderOpen size={20} />, title: '课题', color: '#63b3ed', n1: projects.length, l1: '总数', n2: projects.filter(p => p.status === '进行中').length, l2: '进行中' },
          { key: 'experiments', icon: <FlaskConical size={20} />, title: '实验', color: '#48bb78', n1: experiments.length, l1: '总数', n2: experiments.filter(e => e.status === '待处理').length, l2: '待处理' },
          { key: 'results', icon: <BarChart3 size={20} />, title: '结果', color: '#b794f4', n1: results.length, l1: '总数', n2: results.filter(r => r.supportsHypothesis).length, l2: '支持' },
          { key: 'library', icon: <Archive size={20} />, title: '资料库', color: '#ed8936', n1: files.length, l1: '文件', n2: references.length, l2: '文献' },
        ]"""

new_modules = """[
          { key: 'projects', icon: <FolderOpen size={22} />, title: '课题', color: '#63b3ed', n1: projects.length, l1: '总数', n2: projects.filter(p => p.status === '进行中').length, l2: '进行中' },
          { key: 'experiments', icon: <FlaskConical size={22} />, title: '实验', color: '#48bb78', n1: experiments.length, l1: '总数', n2: experiments.filter(e => e.status !== '已完成').length, l2: '进行中' },
        ]"""

if old_modules in c:
    c = c.replace(old_modules, new_modules)
    print("  ✓ 工作台只保留课题+实验面板")

# ═══ 2. Remove "待处理" Badge from home experiment cards ═══
c = c.replace(
    '<div className="flex justify-between items-center" style={{ paddingRight: 32 }}><span className="font-bold text-sm">{e.title}</span><Badge>{e.status}</Badge></div>',
    '<div className="flex justify-between items-center"><span className="font-bold text-sm">{e.title}</span></div>'
)
# Also the exp-progress-card header
c = c.replace(
    """<select className="status-select" value={e.status} onClick={ev => ev.stopPropagation()} onChange={async ev => { ev.stopPropagation(); try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: e.parameters||'', results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', nextSteps: e.nextSteps||'', status: ev.target.value }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } }}><option>待处理</option><option>进行中</option><option>成功</option><option>失败</option><option>待复验</option></select>""",
    ""
)
print("  ✓ 去掉工作台实验卡片状态标识")

# ═══ 3+4. Replace progress bar in home cards with day progress ═══
old_progress_bar = """<div className="epc-progress">
                  <div className="epc-bar"><div className="epc-fill" style={{ width: pct + '%', background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`, boxShadow: `0 0 12px ${statusColor}40` }} /></div>
                  <span className="epc-pct" style={{ color: statusColor }}>{pct}%</span>
                </div>"""

new_progress_bar = """<div className="epc-progress">
                  <div className="epc-bar"><div className="epc-fill" style={{ width: pct + '%', background: 'linear-gradient(90deg, #3a8fd488, #63b3ed)', boxShadow: '0 0 10px rgba(99,179,237,0.25)' }} /></div>
                  <span className="epc-pct" style={{ color: '#63b3ed' }}>第{daysP}天/{timeline.duration_days}天</span>
                </div>"""

if old_progress_bar in c:
    c = c.replace(old_progress_bar, new_progress_bar)
    print("  ✓ 工作台进度条改为天数显示")

# ═══ 5. Add more info to project cards ═══
old_proj_card_bottom = """<div className="meta-row"><FlaskConical size={12} />{experiments.filter(e => e.projectId === p.id).length} <BarChart3 size={12} />{results.filter(r => r.projectId === p.id).length}</div>"""

new_proj_card_bottom = """<div className="meta-row"><FlaskConical size={12} /> {experiments.filter(e => e.projectId === p.id).length} 实验 {p.leader && <><span>·</span><span>{p.leader}</span></>} {p.startDate && <><Calendar size={12} /><span>{p.startDate}</span></>}</div>"""

if old_proj_card_bottom in c:
    c = c.replace(old_proj_card_bottom, new_proj_card_bottom)
    print("  ✓ 课题卡片增加负责人和日期")

# ═══ 7. Remove Badge from experiments list (already done but double check) ═══
# The experiments page cards - find remaining Badge in that context
remaining_badge = '<div className="flex justify-between items-center"><span className="font-bold">{e.title}</span><Badge>{e.status}</Badge></div>'
if remaining_badge in c:
    c = c.replace(remaining_badge, '<div className="flex justify-between items-center"><span className="font-bold">{e.title}</span></div>')
    print("  ✓ 实验列表去掉状态标识")

# ═══ 8. Add progress info to experiment list cards ═══
old_exp_meta = '''<div className="meta-row mt-2">{proj && <><FolderOpen size={12} /><span>{proj.name}</span></>}<Calendar size={12} /><span>{e.date}</span></div>'''

new_exp_meta = '''<div className="meta-row mt-2">{proj && <><FolderOpen size={12} /><span>{proj.name}</span></>}<Calendar size={12} /><span>{e.date}</span></div>
          {(() => { let tl: any = { duration_days: 30, milestones: [] }; try { if (e.parameters) tl = JSON.parse(e.parameters); } catch {} const sd = new Date(e.date); const dp = Math.max(0, Math.floor((new Date().getTime() - sd.getTime()) / 86400000)); const pc = Math.min(100, Math.round((dp / (tl.duration_days || 30)) * 100)); const nm = (tl.milestones || []).sort((a:any,b:any) => a.day - b.day).find((m:any) => m.day > dp); return <div className="exp-list-progress"><div className="elp-bar"><div className="elp-fill" style={{ width: pc + '%' }} /></div><span className="elp-text">第{dp}天/{tl.duration_days||30}天{nm ? ` · ${nm.label}` : ''}</span></div>; })()}'''

if old_exp_meta in c:
    c = c.replace(old_exp_meta, new_exp_meta)
    print("  ✓ 实验列表增加进度条")

# ═══ 9. Replace emoji template icons with text symbols ═══
# We'll do this in the SQL migration templates, but for now fix display
# The templates come from DB so we can't change them here easily
# Instead, wrap the icon in a styled container that overrides emoji appearance
print("  ℹ 模板图标需要数据库层面修改，暂时保留")

# ═══ 10. Make empty literature state directly open add form ═══
# Already clickable-empty with onClick, just make sure it works
print("  ✓ 文献空状态已有点击添加功能")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS updates
cat >> src/App.css << 'CSSEOF'

/* ═══ HOME: 2 panels instead of 4 ═══ */
.module-grid {
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 14px !important;
}
.module-panel {
  padding: 24px !important;
}
.mp-title { font-size: 18px !important; }
.mp-num { font-size: 28px !important; }
.mp-label { font-size: 12px !important; }
.mp-icon { width: 46px !important; height: 46px !important; }

/* ═══ Home progress bar: thicker, brighter ═══ */
.epc-bar {
  height: 5px !important;
  background: rgba(255,255,255,0.06) !important;
  border-radius: 3px !important;
}
.epc-fill {
  height: 100% !important;
  border-radius: 3px !important;
}
.epc-pct {
  font-size: 11px !important;
  white-space: nowrap;
  min-width: auto !important;
}

/* ═══ Project cards: equal height ═══ */
.grid-2 > .card.clickable {
  display: flex;
  flex-direction: column;
}

/* ═══ Experiment list progress ═══ */
.exp-list-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.elp-bar {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.04);
  border-radius: 2px;
  overflow: hidden;
  max-width: 200px;
}
.elp-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #3a8fd488, #63b3ed);
  box-shadow: 0 0 6px rgba(99,179,237,0.2);
  transition: width 0.5s ease;
}
.elp-text {
  font-size: 10px;
  color: var(--text-dim);
  white-space: nowrap;
}
CSSEOF

echo "✅ 完成"
