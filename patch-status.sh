#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Add status dropdown to experiment cards in ExperimentsPage
# Replace the experiment card in ExperimentsPage to include status switcher
old_exp_card = '''<div key={e.id} className="card clickable compact" onClick={() => navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId })}>
          <div className="hover-actions"><div className="hover-action-btn danger" onClick={ev => { ev.stopPropagation(); if (confirm(`删除？`)) deleteExperiment(e.id); }}><Trash2 size={13} /></div></div>
          <div className="flex justify-between items-center"><span className="font-bold">{e.title}</span><Badge>{e.status}</Badge></div>
          <div className="meta-row mt-2">{proj && <><FolderOpen size={12} /><span>{proj.name}</span></>}<Calendar size={12} /><span>{e.date}</span>{!e.conclusion && <span className="missing-tag">缺结论</span>}</div>'''

new_exp_card = '''<div key={e.id} className="card clickable compact" onClick={() => navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId })}>
          <div className="hover-actions"><div className="hover-action-btn danger" onClick={ev => { ev.stopPropagation(); if (confirm(`删除？`)) deleteExperiment(e.id); }}><Trash2 size={13} /></div></div>
          <div className="flex justify-between items-center" style={{ paddingRight: 32 }}><span className="font-bold">{e.title}</span><select className="status-select" value={e.status} onClick={ev => ev.stopPropagation()} onChange={async ev => { ev.stopPropagation(); try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: e.parameters||'', results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', next_steps: e.nextSteps||'', status: ev.target.value }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } }}><option>待处理</option><option>进行中</option><option>成功</option><option>失败</option><option>待复验</option></select></div>
          <div className="meta-row mt-2">{proj && <><FolderOpen size={12} /><span>{proj.name}</span></>}<Calendar size={12} /><span>{e.date}</span>{!e.conclusion && <span className="missing-tag">缺结论</span>}</div>'''

c = c.replace(old_exp_card, new_exp_card)
print("  ✓ 实验列表页添加状态切换")

# 2. Also add status switcher in project detail experiment list
old_pd_exp = '''<div className="flex justify-between items-center"><span className="font-bold">{e.title}</span><Badge>{e.status}</Badge></div>
          <div className="meta-row mt-2"><Calendar size={12} /><span>{e.date}</span><span>{e.type}</span>{!e.conclusion && <span className="missing-tag">缺结论</span>}</div>'''

new_pd_exp = '''<div className="flex justify-between items-center" style={{ paddingRight: 32 }}><span className="font-bold">{e.title}</span><select className="status-select" value={e.status} onClick={ev => ev.stopPropagation()} onChange={async ev => { ev.stopPropagation(); try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: e.parameters||'', results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', next_steps: e.nextSteps||'', status: ev.target.value }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } }}><option>待处理</option><option>进行中</option><option>成功</option><option>失败</option><option>待复验</option></select></div>
          <div className="meta-row mt-2"><Calendar size={12} /><span>{e.date}</span><span>{e.type}</span>{!e.conclusion && <span className="missing-tag">缺结论</span>}</div>'''

c = c.replace(old_pd_exp, new_pd_exp)
print("  ✓ 项目详情页实验列表添加状态切换")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# 3. CSS for status select, section separation, fix overlap
cat >> src/App.css << 'CSSEOF'

/* ═══ STATUS SELECT — inline dropdown ═══ */
.status-select {
  -webkit-appearance: none !important;
  appearance: none !important;
  background: rgba(99,179,237,0.06) !important;
  border: 1px solid rgba(99,179,237,0.15) !important;
  border-radius: 4px !important;
  padding: 2px 8px !important;
  font-size: 10.5px !important;
  font-weight: 600 !important;
  color: var(--accent) !important;
  cursor: pointer !important;
  outline: none !important;
  font-family: var(--font) !important;
  transition: all 0.3s ease !important;
  min-width: 70px;
  text-align: center;
}
.status-select:hover {
  border-color: rgba(99,179,237,0.35) !important;
  box-shadow: 0 0 16px rgba(99,179,237,0.12) !important;
}
.status-select:focus {
  border-color: rgba(99,179,237,0.4) !important;
  box-shadow: 0 0 20px rgba(99,179,237,0.15) !important;
}
.status-select option {
  background: #141820 !important;
  color: #e2e8f0 !important;
  padding: 4px 8px !important;
}

/* ═══ FIX: hover-actions position — no overlap ═══ */
.card .hover-actions {
  top: 8px !important;
  right: 8px !important;
  z-index: 5;
}
.card.compact .hover-actions {
  top: 6px !important;
  right: 6px !important;
}

/* ═══ HOME SECTIONS — clear visual separation ═══ */
.sec-title {
  color: var(--accent) !important;
  font-size: 11px !important;
  padding-bottom: 6px !important;
  border-bottom: 1px solid rgba(99,179,237,0.1) !important;
  margin-bottom: 10px !important;
  margin-top: 8px !important;
}

/* Module grid — add bottom separator */
.module-grid {
  padding-bottom: 20px !important;
  border-bottom: 1px solid var(--border-subtle) !important;
  margin-bottom: 20px !important;
}

/* Section gaps in home page */
.page-container > .grid-2 {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 16px;
}

/* ═══ Project detail sections — visual separation ═══ */
.page-container > .sec-title {
  margin-top: 20px !important;
}

/* ═══ Fix: stat card number position ═══ */
.stat-card {
  text-align: left !important;
}
CSSEOF

echo "✅ 完成"
