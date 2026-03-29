#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Remove "点击此处填写XXX" placeholder, just show empty area
c = c.replace(
    ''': <p className="text-xs muted" style={{ fontStyle: 'italic' }}>点击此处填写{title}</p>}''',
    ''': <p className="empty-field-hint">—</p>}'''
)

# 2. Remove "点击编辑" hint text
c = c.replace(' <span className="edit-hint">点击编辑</span>', '')

print("  ✓ 去掉文字提示")

with open('src/App.tsx', 'w') as f:
    f.write(c)
PYEOF

# 3. CSS overhaul for bigger titles, stronger glow, larger areas
cat >> src/App.css << 'CSSEOF'

/* ═══ OVERRIDE: Section titles bigger & brighter ═══ */
.detail-section h4 {
  font-size: 13px !important;
  font-weight: 700 !important;
  color: var(--accent) !important;
  letter-spacing: 0.02em !important;
  text-transform: none !important;
  margin-bottom: 8px !important;
  text-shadow: 0 0 12px rgba(99,179,237,0.3);
}

/* Editable section — bigger, cleaner */
.editable-section {
  padding: 14px !important;
  margin: 0 -14px 6px !important;
  border-radius: 8px !important;
  min-height: 50px;
}
.editable-section:hover {
  background: rgba(99,179,237,0.05) !important;
  border-color: rgba(99,179,237,0.2) !important;
  box-shadow: 0 0 30px rgba(99,179,237,0.08), inset 0 0 20px rgba(99,179,237,0.02) !important;
}
.editable-section pre {
  font-size: 13.5px !important;
  color: var(--text-secondary) !important;
}
.empty-field-hint {
  color: var(--text-dim) !important;
  font-size: 13px;
  margin: 0;
}
.edit-hint { display: none !important; }

/* ═══ OVERRIDE: Module panels — much stronger glow ═══ */
.module-panel:hover {
  transform: translateY(-6px) !important;
  box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 60px rgba(99,179,237,0.18) !important;
  border-color: rgba(99,179,237,0.35) !important;
}
.module-panel::before {
  height: 3px !important;
  box-shadow: 0 0 16px rgba(99,179,237,0.5);
}
.module-panel:hover .mp-icon {
  box-shadow: 0 0 28px currentColor !important;
  transform: scale(1.1) !important;
}
.module-panel:hover .mp-num {
  color: var(--accent) !important;
  text-shadow: 0 0 16px rgba(99,179,237,0.4);
}

/* ═══ OVERRIDE: Cards — stronger hover ═══ */
.card.clickable:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3), 0 0 32px rgba(99,179,237,0.1) !important;
  border-color: rgba(99,179,237,0.2) !important;
}

/* ═══ OVERRIDE: Stat cards — glow on hover ═══ */
.stat-card:hover {
  box-shadow: 0 0 32px rgba(99,179,237,0.12) !important;
  border-color: rgba(99,179,237,0.2) !important;
  transform: translateY(-2px) !important;
}
.stat-card .stat-value {
  text-shadow: 0 0 12px currentColor;
  font-size: 30px !important;
}

/* ═══ OVERRIDE: Nav tabs — stronger active glow ═══ */
.topbar-tab.active {
  box-shadow: 0 0 24px rgba(99,179,237,0.15), inset 0 0 16px rgba(99,179,237,0.06) !important;
}
.topbar-tab.active::after {
  height: 3px !important;
  box-shadow: 0 0 14px rgba(99,179,237,0.7) !important;
  left: 10% !important;
  right: 10% !important;
}
.topbar-tab:hover {
  background: rgba(99,179,237,0.06) !important;
  color: var(--text-primary) !important;
}

/* ═══ OVERRIDE: Quick buttons — stronger hover ═══ */
.quick-btn:hover {
  box-shadow: 0 0 28px rgba(99,179,237,0.12) !important;
  transform: translateY(-2px) !important;
  border-color: rgba(99,179,237,0.25) !important;
}

/* ═══ OVERRIDE: Empty state — clickable, bigger icon ═══ */
.clickable-empty .empty-icon {
  width: 56px !important;
  height: 56px !important;
}
.clickable-empty .empty-icon svg { width: 26px !important; height: 26px !important; }
.clickable-empty:hover .empty-icon {
  box-shadow: 0 0 36px rgba(99,179,237,0.25) !important;
  transform: scale(1.12) !important;
  border-color: rgba(99,179,237,0.35) !important;
}
.clickable-empty:hover {
  background: rgba(99,179,237,0.04) !important;
}

/* ═══ OVERRIDE: Template cards — stronger hover ═══ */
.template-card:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 40px rgba(99,179,237,0.12) !important;
  border-color: rgba(99,179,237,0.3) !important;
}
.template-card:hover .template-icon {
  box-shadow: 0 0 24px rgba(99,179,237,0.2);
  transform: scale(1.08);
}
.template-icon { transition: all 0.4s cubic-bezier(0.22,1,0.36,1) !important; }

/* ═══ OVERRIDE: Badges — slightly glow ═══ */
.badge {
  box-shadow: 0 0 8px currentColor;
  border: 1px solid currentColor !important;
  opacity: 0.9;
}

/* ═══ OVERRIDE: Tags — glow ═══ */
.tag {
  box-shadow: 0 0 8px rgba(99,179,237,0.1);
}

/* ═══ OVERRIDE: Buttons primary — stronger glow ═══ */
.btn.primary {
  box-shadow: 0 0 20px rgba(99,179,237,0.2) !important;
}
.btn.primary:hover {
  box-shadow: 0 0 32px rgba(99,179,237,0.35) !important;
}

/* ═══ OVERRIDE: Page title — brighter ═══ */
.page-title {
  font-size: 22px !important;
  text-shadow: 0 0 20px rgba(255,255,255,0.06);
}

/* ═══ OVERRIDE: Search trigger hover ═══ */
.search-trigger:hover {
  box-shadow: 0 0 24px rgba(99,179,237,0.1) !important;
  border-color: rgba(99,179,237,0.2) !important;
}

/* ═══ OVERRIDE: Sec title — brighter ═══ */
.sec-title {
  color: var(--text-muted) !important;
  font-size: 11px !important;
}

/* ═══ OVERRIDE: Modal animations — slower ═══ */
.overlay { animation: overlayIn 0.3s ease !important; }
.modal { animation: modalIn 0.4s cubic-bezier(0.22,1,0.36,1) !important; }

/* ═══ OVERRIDE: Form focus — stronger glow ═══ */
.form-input:focus, .form-select:focus, .form-textarea:focus {
  box-shadow: 0 0 0 3px rgba(99,179,237,0.12), 0 0 20px rgba(99,179,237,0.08) !important;
}

/* ═══ OVERRIDE: Scrollbar — subtle glow ═══ */
::-webkit-scrollbar-thumb {
  background: rgba(99,179,237,0.15) !important;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(99,179,237,0.25) !important;
}

/* ═══ OVERRIDE: Continue card border glow ═══ */
.recent-card, .continue-card {
  border-left-width: 3px !important;
}
.recent-card:hover, .continue-card:hover {
  border-left-color: var(--accent) !important;
  box-shadow: -4px 0 20px rgba(99,179,237,0.12), 0 4px 16px rgba(0,0,0,0.2) !important;
}
CSSEOF

echo "✅ 完成"
