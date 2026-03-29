#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Remove filter buttons and filter logic in ExperimentsPage
c = c.replace(
    """const [filter, setFilter] = useState('待处理');
  const filtered = filter === '全部' ? experiments : experiments.filter(e => e.status === filter);""",
    """const filtered = experiments;"""
)
c = c.replace(
    """<div className="flex gap-2 mb-3">{['待处理', '进行中', '待复验', '成功', '失败', '全部'].map(f => <button key={f} className={`btn sm ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}</div>""",
    ""
)
# Fix empty state text that references filter
c = c.replace(
    """{filter === '全部' ? '暂无实验' : `没有"${filter}"的实验`}""",
    """'暂无实验'"""
)
print("  ✓ 去掉实验分类筛选")

# 2. Remove all missing-tag instances
c = c.replace("{!e.conclusion && <span className=\"missing-tag\">缺结论</span>}", "")
c = c.replace("{!e.results && <span className=\"missing-tag\">缺结果</span>}", "")
c = c.replace("{!e.conclusion && <span className=\"missing-tag\">缺结论</span>}{!e.results && <span className=\"missing-tag\">缺结果</span>}", "")
print("  ✓ 去掉缺结论/缺结果提示")

with open('src/App.tsx', 'w') as f:
    f.write(c)
PYEOF

# 3. CSS: enlarge everything, full card clickable
cat >> src/App.css << 'CSSEOF'

/* ═══ GLOBAL SIZE BOOST ═══ */
body { font-size: 14px !important; }
.page-title { font-size: 24px !important; }
.page-desc { font-size: 13.5px !important; }
.sec-title { font-size: 12px !important; }

/* Cards — bigger padding, full clickable */
.card { padding: 16px 20px !important; }
.card.compact { padding: 14px 18px !important; }
.card.clickable { display: block !important; }

/* Module panels — bigger */
.module-panel { padding: 22px !important; }
.mp-title { font-size: 16px !important; }
.mp-num { font-size: 24px !important; }
.mp-label { font-size: 11px !important; }
.mp-icon { width: 42px !important; height: 42px !important; }
.mp-icon svg { width: 22px !important; height: 22px !important; }
.mp-arrow { width: 20px; height: 20px; }

/* Nav tabs — bigger */
.topbar-tab { padding: 8px 16px !important; font-size: 13.5px !important; gap: 6px !important; }
.topbar-tab svg { width: 17px !important; height: 17px !important; }
.topbar { height: 54px !important; }
.topbar-logo svg { width: 22px !important; height: 22px !important; }

/* Stat cards — bigger */
.stat-card { padding: 18px !important; }
.stat-card .stat-value { font-size: 32px !important; }
.stat-card .stat-label { font-size: 12px !important; }

/* Experiment cards — bigger text */
.card .font-bold { font-size: 15px !important; }
.meta-row { font-size: 12px !important; gap: 10px !important; }
.meta-row svg { width: 14px !important; height: 14px !important; }
.badge { font-size: 11.5px !important; padding: 3px 9px !important; }

/* Section nav — bigger */
.exp-nav-item { padding: 7px 14px !important; font-size: 13px !important; }
.exp-nav-icon { font-size: 16px !important; width: 18px !important; }
.exp-nav-check { font-size: 11px !important; }

/* Section content — bigger */
.exp-section-label { font-size: 14px !important; padding: 12px 16px 0 !important; }
.exp-sec-icon { font-size: 16px !important; }
.exp-content-block { padding: 10px 16px 14px !important; min-height: 60px !important; }
.exp-content-text { font-size: 14px !important; }
.exp-content-empty { font-size: 13px !important; }
.exp-edit-textarea { font-size: 14px !important; padding: 10px 16px 14px !important; min-height: 100px !important; }

/* Timeline — bigger */
.tp-label { font-size: 14px !important; }
.tp-bar { height: 5px !important; }
.tp-current-dot { width: 12px !important; height: 12px !important; }
.tp-ms-tag { font-size: 11px !important; padding: 3px 10px !important; }
.tp-ms-add { font-size: 11px !important; padding: 3px 10px !important; }
.tp-next { font-size: 12px !important; }
.tp-edit-btn { font-size: 12px !important; }

/* Buttons — bigger */
.btn { padding: 7px 16px !important; font-size: 13px !important; }
.btn.sm { padding: 5px 12px !important; font-size: 12px !important; }
.btn svg { width: 16px !important; height: 16px !important; }

/* Search trigger — bigger */
.search-trigger { padding: 7px 16px !important; }
.search-trigger span { font-size: 13px !important; }

/* Empty state — bigger */
.empty-state h3 { font-size: 16px !important; }
.empty-state p { font-size: 13px !important; }
.empty-icon { width: 56px !important; height: 56px !important; }
.empty-icon svg { width: 26px !important; height: 26px !important; }
.empty-sm { font-size: 13px !important; padding: 18px !important; }

/* Template cards — bigger */
.template-icon { width: 48px !important; height: 48px !important; font-size: 20px !important; }
.template-name { font-size: 14px !important; }

/* Progress card on home — bigger */
.epc-title { font-size: 16px !important; }
.epc-meta { font-size: 12px !important; }
.epc-pct { font-size: 13px !important; }
.epc-next { font-size: 12px !important; }
.exp-progress-card { padding: 18px 20px !important; }

/* Tags — bigger */
.tag { font-size: 11px !important; padding: 2px 8px !important; }

/* Quick btn */
.quick-btn { font-size: 13.5px !important; padding: 12px 16px !important; }

/* New dropdown — bigger */
.new-dropdown-item { font-size: 13.5px !important; padding: 10px 14px !important; }
.new-dropdown-item svg { width: 17px !important; height: 17px !important; }

/* Modal — bigger */
.modal-header h2 { font-size: 17px !important; }
.form-group label { font-size: 12px !important; }
.form-input, .form-select, .form-textarea { font-size: 14px !important; padding: 9px 12px !important; }

/* Breadcrumb — bigger */
.topbar-breadcrumb { font-size: 13px !important; }
.bc-link, .bc-current { font-size: 13px !important; }

/* Hover action buttons — bigger */
.hover-action-btn { width: 30px !important; height: 30px !important; }
.hover-action-btn svg { width: 15px !important; height: 15px !important; }

/* Scrollbar — slightly wider */
::-webkit-scrollbar { width: 6px !important; }
CSSEOF

echo "✅ 完成"
