#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修复 App.tsx..."

python3 << 'PYEOF'
import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

changes = 0

# 1. Fix topbar breadcrumb — show current page name
old_bread = '<div className="topbar-breadcrumb">Lab Data System</div>'
new_bread = '''<div className="topbar-breadcrumb">Lab Data System <span className="page-name">/ {currentView === 'dashboard' ? '工作台' : currentView === 'projects' ? '项目' : currentView === 'projectDetail' ? '项目详情' : currentView === 'experiments' ? '实验' : currentView === 'experimentDetail' ? '实验详情' : currentView === 'results' ? '结果中心' : currentView === 'library' ? '资料库' : currentView === 'templates' ? '模板' : currentView === 'settings' ? '设置' : ''}</span></div>'''
if old_bread in content:
    content = content.replace(old_bread, new_bread)
    changes += 1
    print("  ✓ 面包屑已更新")

# 2. Fix stat card in ResultsCenter — number and label on separate lines
old_stat = '''{[{ label: '全部结果', count: results.length, color: '#5f6368' }, { label: '支持假设', count: results.filter(r => r.supportsHypothesis).length, color: '#188038' }, { label: '不支持', count: results.filter(r => !r.supportsHypothesis).length, color: '#d93025' }, { label: '图片/图表', count: results.filter(r => r.type === '图片' || r.type === '图表').length, color: '#7c3aed' }].map((s, i) => (
          <div key={i} className="stat-card"><span className="stat-value" style={{ color: s.color }}>{s.count}</span><span className="stat-label">{s.label}</span></div>'''
new_stat = '''{[{ label: '全部结果', count: results.length, color: '#63b3ed' }, { label: '支持假设', count: results.filter(r => r.supportsHypothesis).length, color: '#48bb78' }, { label: '不支持', count: results.filter(r => !r.supportsHypothesis).length, color: '#fc8181' }, { label: '图片/图表', count: results.filter(r => r.type === '图片' || r.type === '图表').length, color: '#b794f4' }].map((s, i) => (
          <div key={i} className="stat-card"><span className="stat-value" style={{ color: s.color }}>{s.count}</span><span className="stat-label">{s.label}</span></div>'''
if old_stat in content:
    content = content.replace(old_stat, new_stat)
    changes += 1
    print("  ✓ 结果中心统计卡片颜色已修复")

# 3. Add missing indicator to experiment cards in ExperimentsList
old_exp_purpose = '''{e.purpose && <p className="text-sm muted">{e.purpose.slice(0, 100)}</p>}'''
new_exp_purpose = '''{e.purpose && <p className="text-sm muted">{e.purpose.slice(0, 100)}</p>}
            <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>{!e.conclusion && <span className="missing-tag">缺结论</span>}{!e.results && <span className="missing-tag">缺结果</span>}</div>'''
if old_exp_purpose in content:
    content = content.replace(old_exp_purpose, new_exp_purpose, 1)
    changes += 1
    print("  ✓ 实验卡片缺失状态已添加")

# 4. Add action buttons to continue card
old_continue = '''<div className="meta-row mt-2"><span>{proj?.name}</span><span>·</span><Calendar size={13} /><span>{e.date}</span></div>'''
new_continue = '''<div className="meta-row mt-2"><span>{proj?.name}</span><span>·</span><Calendar size={13} /><span>{e.date}</span></div>
                <div className="continue-actions"><button className="btn ghost sm" onClick={(ev) => { ev.stopPropagation(); navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId }); }}>继续记录</button></div>'''
if old_continue in content:
    content = content.replace(old_continue, new_continue, 1)
    changes += 1
    print("  ✓ 继续工作卡片添加了快捷按钮")

# 5. Add description preview to project cards in ProjectsList
old_proj_keywords = '''<p className="text-sm muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>{p.description?.slice(0, 80)}</p>'''
new_proj_keywords = '''<p className="text-sm muted" style={{ marginBottom: 6, lineHeight: 1.5 }}>{p.description?.slice(0, 100)}{p.description && p.description.length > 100 ? '...' : ''}</p>
            {p.leader && <div className="text-xs muted mb-2">负责人: {p.leader}</div>}'''
if old_proj_keywords in content:
    content = content.replace(old_proj_keywords, new_proj_keywords, 1)
    changes += 1
    print("  ✓ 项目卡片增加了负责人信息")

with open('src/App.tsx', 'w') as f:
    f.write(content)

print(f"\n完成，共修改 {changes} 处")
PYEOF

echo "✅ 修复完成"
