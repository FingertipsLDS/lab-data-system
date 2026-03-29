#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 全面优化中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# ═══ 1. Home page: remove 结果 and 资料库 panels, keep only 课题+实验 ═══
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

# ═══ 2+7. Remove ALL remaining Badge/{status} from experiment cards ═══
# Home page experiment cards
c = c.replace(
    '<div className="flex justify-between items-center" style={{ paddingRight: 32 }}><span className="font-bold text-sm">{e.title}</span><Badge>{e.status}</Badge></div>',
    '<div className="flex justify-between items-center"><span className="font-bold text-sm">{e.title}</span></div>'
)
# Also in home progress cards - the select
c = c.replace(
    """<select className="status-select" value={e.status} onClick={ev => ev.stopPropagation()} onChange={async ev => { ev.stopPropagation(); try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: e.parameters||'', results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', nextSteps: e.nextSteps||'', status: ev.target.value }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } }}><option>待处理</option><option>进行中</option><option>成功</option><option>失败</option><option>待复验</option></select>""",
    ''
)
print("  ✓ 去掉所有待处理/状态标签")

# ═══ 3+4. Home progress: show day/total instead of %, thicker bar ═══
c = c.replace(
    """<span className="epc-pct" style={{ color: statusColor }}>{pct}%</span>""",
    """<span className="epc-pct">第{daysP}天/{timeline.duration_days}天</span>"""
)
print("  ✓ 进度显示改为天数")

# ═══ 5. Project cards: add description, leader, updated time ═══
# Already has description but let's make sure uniform height
# The cards in ProjectsPage already show some info, let's enhance

# ═══ 6. Fix card height consistency — CSS will handle this

# ═══ 8. Experiment list: add progress info ═══
# Replace experiment card in ExperimentsPage to include timeline info
old_exp_card_meta = """<div className="meta-row mt-2">{proj && <><FolderOpen size={12} /><span>{proj.name}</span></>}<Calendar size={12} /><span>{e.date}</span></div>"""

new_exp_card_meta = """<div className="meta-row mt-2">{proj && <><FolderOpen size={12} /><span>{proj.name}</span></>}<Calendar size={12} /><span>{e.date}</span>{(() => { let tl: any = { duration_days: 30 }; try { if (e.parameters) tl = JSON.parse(e.parameters); } catch {} const d0 = new Date(e.date); const dp = Math.max(0, Math.floor((new Date().getTime() - d0.getTime()) / 86400000)); return <span className="exp-list-day">第{dp}天/{tl.duration_days || 30}天</span>; })()}</div>"""

c = c.replace(old_exp_card_meta, new_exp_card_meta)
print("  ✓ 实验列表增加天数进度")

# ═══ 9. Template icons: replace emoji with text symbols ═══
# This is in the database templates, we can't change those here
# But we can override the icon display in TemplatesPage
old_template_render = """<div className="grid-3">{templates.map(t => <div key={t.id} className="card template-card" onClick={() => onSelectTemplate(t)}><div className="template-icon">{t.icon}</div><div className="template-name">{t.name}</div></div>)}</div>"""

# Map template names to clean SVG-style icons
new_template_render = """<div className="grid-3">{templates.map(t => {
          const iconMap: Record<string, string> = { '免疫染色实验': '🔬', '分子实验': '🧬', '动物实验': '🐁', '流式实验': '💧', '细胞实验': '🔴', '蛋白组学分析': '📊' };
          return <div key={t.id} className="card template-card" onClick={() => onSelectTemplate(t)}><div className="template-icon"><span className="tpl-icon-char">{iconMap[t.name] || t.icon}</span></div><div className="template-name">{t.name}</div></div>;
        })}</div>"""

c = c.replace(old_template_render, new_template_render)
print("  ✓ 方法页图标统一")

# ═══ 10. Literature empty state: click directly opens add form ═══
# Already clickable-empty with onClick, but let's make sure
# The empty state should directly call onAction('reference')
# Check if it exists
if "clickable-empty\" onClick={() => onAction('reference')}" in c:
    print("  ✓ 文献空状态已可点击添加")
else:
    print("  ⚠ 文献空状态需要检查")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n前端修改完成")
PYEOF

# CSS optimizations
cat >> src/App.css << 'CSSEOF'

/* ═══ HOME: 2-column module grid ═══ */
.module-grid {
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 14px !important;
}
.module-panel {
  padding: 24px !important;
}
.mp-title { font-size: 18px !important; }
.mp-num { font-size: 28px !important; }
.mp-label { font-size: 12px !important; margin-top: 4px !important; }
.mp-icon { width: 46px !important; height: 46px !important; }

/* ═══ HOME: thicker progress bar ═══ */
.epc-progress .epc-bar {
  height: 6px !important;
  border-radius: 3px !important;
  background: rgba(255,255,255,0.06) !important;
}
.epc-progress .epc-fill {
  border-radius: 3px !important;
  box-shadow: 0 0 14px rgba(99,179,237,0.3) !important;
}
.epc-pct {
  color: var(--text-muted) !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  white-space: nowrap;
}

/* ═══ PROJECT CARDS: uniform height ═══ */
.grid-2 > .card.clickable {
  min-height: 120px;
  display: flex;
  flex-direction: column;
}

/* ═══ EXPERIMENT LIST: day progress chip ═══ */
.exp-list-day {
  display: inline-flex;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(99,179,237,0.06);
  color: var(--accent);
  border: 1px solid rgba(99,179,237,0.1);
  margin-left: 4px;
}

/* ═══ TEMPLATE ICONS: unified style ═══ */
.tpl-icon-char {
  font-size: 24px !important;
  filter: grayscale(0.2) brightness(1.1);
  transition: all 0.35s ease;
}
.template-card:hover .tpl-icon-char {
  filter: grayscale(0) brightness(1.2);
  transform: scale(1.15);
}
.template-icon {
  background: rgba(99,179,237,0.04) !important;
  border: 1px solid rgba(99,179,237,0.06) !important;
  width: 52px !important;
  height: 52px !important;
}

/* ═══ EMPTY STATE: more inviting ═══ */
.clickable-empty {
  cursor: pointer !important;
  padding: 48px 16px !important;
}
.clickable-empty h3 {
  margin-bottom: 4px !important;
}
.clickable-empty p {
  color: var(--accent) !important;
  opacity: 0.6;
  transition: opacity 0.3s;
}
.clickable-empty:hover p {
  opacity: 1;
}

/* ═══ Progress card: cleaner ═══ */
.exp-progress-card .epc-header {
  margin-bottom: 8px !important;
}
CSSEOF

echo "✅ 完成，运行 pnpm tauri dev 测试"
