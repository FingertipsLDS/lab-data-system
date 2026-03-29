#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Make "暂无待办" clickable to add task
c = c.replace(
    '''<div className="card"><div className="empty-sm">暂无待办</div></div>''',
    '''<div className="card clickable-empty-inline" onClick={() => { const name = prompt('输入任务名称'); if (name) useStore.getState().addTask({ name, projectId: '', dueDate: '', priority: '中', status: '待处理', assignee: '', notes: '' }); }}><div className="empty-sm">点击添加待办</div></div>'''
)
print("  ✓ 待办空状态改为可点击添加")

# 2. Make file empty state clickable — navigate to experiments
c = c.replace(
    '''<div className="card mb-4"><div className="empty-state"><div className="empty-icon"><FileText size={22} /></div><h3>暂无文件</h3><p>在实验详情页上传</p></div></div>''',
    '''<div className="card mb-4 clickable" onClick={() => navigateTo('experiments' as any)}><div className="empty-state clickable-empty"><div className="empty-icon"><FileText size={22} /></div><h3>暂无文件</h3><p>前往实验上传文件</p></div></div>'''
)
print("  ✓ 文件空状态改为可点击跳转")

# 3. Replace "继续工作" section in HomePage with prominent experiment cards + progress
old_continue = '''<div className="sec-title">继续工作</div>
          {recentExps.length > 0 ? recentExps.map(e => {
            const proj = projects.find(p => p.id === e.projectId);
            return (
              <div key={e.id} className="card clickable compact" onClick={() => navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId })}>
                <div className="flex justify-between items-center"><span className="font-bold text-sm">{e.title}</span><Badge>{e.status}</Badge></div>
                <div className="meta-row mt-2"><span>{proj?.name}</span><Calendar size={12} /><span>{e.date}</span>{!e.conclusion && <span className="missing-tag">缺结论</span>}</div>
              </div>
            );
          }) : <div className="card"><div className="empty-sm">还没有实验，<span className="link" onClick={() => onAction('experiment')}>创建一个</span></div></div>}'''

new_continue = '''<div className="sec-title">进行中的实验</div>
          {recentExps.length > 0 ? recentExps.map(e => {
            const proj = projects.find(p => p.id === e.projectId);
            const steps = ['purpose', 'materials', 'steps', 'results', 'conclusion'];
            const filled = steps.filter(s => !!(e as any)[s]).length;
            const pct = Math.round((filled / steps.length) * 100);
            const statusColor = e.status === '成功' ? '#48bb78' : e.status === '失败' ? '#fc8181' : e.status === '进行中' ? '#63b3ed' : e.status === '待复验' ? '#b794f4' : '#ed8936';
            return (
              <div key={e.id} className="exp-progress-card" onClick={() => navigateTo('experimentDetail', { experimentId: e.id, projectId: e.projectId })}>
                <div className="epc-header">
                  <div className="epc-left">
                    <div className="epc-title">{e.title}</div>
                    <div className="epc-meta">{proj?.name} · {e.date} · {e.type}</div>
                  </div>
                  <select className="status-select" value={e.status} onClick={ev => ev.stopPropagation()} onChange={async ev => { ev.stopPropagation(); try { const { invoke: inv } = await import('@tauri-apps/api/core'); await inv('update_experiment', { id: e.id, title: e.title, type: e.type||'', date: e.date||'', purpose: e.purpose||'', materials: e.materials||'', steps: e.steps||'', parameters: e.parameters||'', results: e.results||'', conclusion: e.conclusion||'', issues: e.issues||'', nextSteps: e.nextSteps||'', status: ev.target.value }); await useStore.getState().loadAll(); } catch(err) { console.error(err); } }}><option>待处理</option><option>进行中</option><option>成功</option><option>失败</option><option>待复验</option></select>
                </div>
                <div className="epc-progress">
                  <div className="epc-bar"><div className="epc-fill" style={{ width: pct + '%', background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`, boxShadow: `0 0 12px ${statusColor}40` }} /></div>
                  <span className="epc-pct" style={{ color: statusColor }}>{pct}%</span>
                </div>
                <div className="epc-steps">
                  {steps.map(s => { const label: Record<string,string> = { purpose: '目的', materials: '材料', steps: '步骤', results: '结果', conclusion: '结论' }; const done = !!(e as any)[s]; return <span key={s} className={`epc-step ${done ? 'done' : ''}`}>{done ? '✓' : '○'} {label[s]}</span>; })}
                </div>
              </div>
            );
          }) : <div className="card"><div className="empty-sm">还没有实验，<span className="link" onClick={() => onAction('experiment')}>创建一个</span></div></div>}'''

if old_continue in c:
    c = c.replace(old_continue, new_continue)
    print("  ✓ 工作台实验卡片改为进度条版本")
else:
    print("  ⚠ 未找到继续工作区域")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS for progress cards
cat >> src/App.css << 'CSSEOF'

/* ═══ EXPERIMENT PROGRESS CARD ═══ */
.exp-progress-card {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 16px 18px;
  border: 1px solid var(--border-subtle);
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.45s cubic-bezier(0.22,1,0.36,1);
  position: relative;
  overflow: hidden;
}
.exp-progress-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent 5%, var(--accent) 50%, transparent 95%);
  opacity: 0; transition: opacity 0.45s ease;
}
.exp-progress-card:hover {
  border-color: rgba(99,179,237,0.25);
  background: var(--bg-card-hover);
  transform: translateY(-3px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 40px rgba(99,179,237,0.1);
}
.exp-progress-card:hover::before { opacity: 1; }

.epc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.epc-left { flex: 1; min-width: 0; }
.epc-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
  letter-spacing: -0.01em;
}
.epc-meta {
  font-size: 11px;
  color: var(--text-muted);
}

/* Progress bar */
.epc-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.epc-bar {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.04);
  border-radius: 2px;
  overflow: hidden;
}
.epc-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.22,1,0.36,1);
  position: relative;
}
.epc-fill::after {
  content: '';
  position: absolute;
  right: 0; top: -2px; bottom: -2px;
  width: 8px;
  background: inherit;
  border-radius: 50%;
  filter: blur(3px);
}
.epc-pct {
  font-size: 12px;
  font-weight: 700;
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  transition: text-shadow 0.3s;
}
.exp-progress-card:hover .epc-pct {
  text-shadow: 0 0 12px currentColor;
}

/* Step indicators */
.epc-steps {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.epc-step {
  font-size: 10px;
  color: var(--text-dim);
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  transition: all 0.3s ease;
}
.epc-step.done {
  color: #48bb78;
  background: rgba(72,187,120,0.06);
  border-color: rgba(72,187,120,0.1);
}
.exp-progress-card:hover .epc-step.done {
  box-shadow: 0 0 8px rgba(72,187,120,0.15);
}

/* Clickable inline empty */
.clickable-empty-inline {
  cursor: pointer !important;
  transition: all 0.35s ease !important;
}
.clickable-empty-inline:hover {
  border-color: rgba(99,179,237,0.2) !important;
  box-shadow: 0 0 24px rgba(99,179,237,0.08) !important;
}
.clickable-empty-inline .empty-sm {
  color: var(--text-dim) !important;
  transition: color 0.3s;
}
.clickable-empty-inline:hover .empty-sm {
  color: var(--accent) !important;
}
CSSEOF

echo "✅ 完成"
