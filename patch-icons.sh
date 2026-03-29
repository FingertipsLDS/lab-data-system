#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修复中..."

# 1. Fix LoginScreen select styling
python3 << 'PYEOF'
with open('src/components/LoginScreen.tsx', 'r') as f:
    c = f.read()

# Fix the input style to also apply to select
c = c.replace(
    "input: { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#0f1219', color: '#e2e8f0', boxSizing: 'border-box' as const, transition: 'border-color 0.15s' },",
    "input: { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#0f1219', color: '#e2e8f0', boxSizing: 'border-box' as const, transition: 'border-color 0.15s', WebkitAppearance: 'none' as const, appearance: 'none' as const },"
)

with open('src/components/LoginScreen.tsx', 'w') as f:
    f.write(c)
print("  ✓ LoginScreen select 样式已修复")
PYEOF

# 2. Fix FileUploadZone hover effects
python3 << 'PYEOF'
with open('src/components/FileUploadZone.tsx', 'r') as f:
    c = f.read()

# Replace the upload zone div with better hover styling
c = c.replace(
    "border: '1px dashed rgba(99,179,237,0.2)',",
    "border: '1px dashed rgba(99,179,237,0.15)',"
)
c = c.replace(
    "background: 'rgba(99,179,237,0.03)',",
    "background: 'rgba(99,179,237,0.02)',"
)
# Replace the entire upload div render for better interaction
c = c.replace(
    '''<div style={{ fontSize: 20, marginBottom: 2, opacity: 0.6 }}>📂</div>''',
    '''<div className="upload-icon-wrap" style={{ width: 44, height: 44, margin: '0 auto 6px', borderRadius: 10, background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)' }}>📂</div>'''
)

with open('src/components/FileUploadZone.tsx', 'w') as f:
    f.write(c)
print("  ✓ FileUploadZone 图标已修复")
PYEOF

# 3. Add comprehensive CSS for all hover effects
cat >> src/App.css << 'CSSEOF'

/* ═══ LOGIN PAGE: Custom select & input styling ═══ */
select {
  -webkit-appearance: none !important;
  appearance: none !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23576178' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
  padding-right: 28px !important;
}
select option {
  background: #141820 !important;
  color: #e2e8f0 !important;
  padding: 8px !important;
}

/* ═══ FILE UPLOAD ZONE — icon glow on hover ═══ */
.card:has(.upload-icon-wrap):hover .upload-icon-wrap,
div[style*="dashed"]:hover .upload-icon-wrap {
  background: rgba(99,179,237,0.12) !important;
  border-color: rgba(99,179,237,0.3) !important;
  box-shadow: 0 0 28px rgba(99,179,237,0.2) !important;
  transform: scale(1.1) !important;
}

/* ═══ ALL EMPTY STATE ICONS — unified glow ═══ */
.empty-icon {
  transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important;
  cursor: pointer;
}
.empty-icon:hover,
.card:hover .empty-icon,
.clickable-empty:hover .empty-icon {
  background: rgba(99,179,237,0.12) !important;
  border-color: rgba(99,179,237,0.35) !important;
  box-shadow: 0 0 36px rgba(99,179,237,0.25) !important;
  transform: scale(1.12) !important;
}
.empty-icon svg {
  transition: all 0.45s ease !important;
  filter: drop-shadow(0 0 4px rgba(99,179,237,0.2));
}
.card:hover .empty-icon svg,
.clickable-empty:hover .empty-icon svg,
.empty-icon:hover svg {
  filter: drop-shadow(0 0 10px rgba(99,179,237,0.5)) !important;
}

/* ═══ TEMPLATE ICON — same glow as module panels ═══ */
.template-icon {
  transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important;
}
.template-card:hover .template-icon {
  background: rgba(99,179,237,0.12) !important;
  border-color: rgba(99,179,237,0.35) !important;
  box-shadow: 0 0 28px rgba(99,179,237,0.2) !important;
  transform: scale(1.1) !important;
}

/* ═══ QC ICON (quick card) — glow on hover ═══ */
.quick-btn span:first-child {
  display: inline-flex;
  width: 32px; height: 32px;
  align-items: center; justify-content: center;
  border-radius: 8px;
  background: rgba(99,179,237,0.04);
  border: 1px solid rgba(99,179,237,0.06);
  transition: all 0.45s cubic-bezier(0.22,1,0.36,1);
  font-size: 16px;
}
.quick-btn:hover span:first-child {
  background: rgba(99,179,237,0.1) !important;
  border-color: rgba(99,179,237,0.25) !important;
  box-shadow: 0 0 24px rgba(99,179,237,0.18) !important;
  transform: scale(1.08) !important;
}

/* ═══ MP ICON — ensure consistent glow with rest ═══ */
.mp-icon {
  transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important;
  border: 1px solid rgba(99,179,237,0.08);
}
.mp-icon svg {
  transition: all 0.45s ease !important;
}
.module-panel:hover .mp-icon svg {
  filter: drop-shadow(0 0 8px currentColor) !important;
}

/* ═══ BADGE glow — toned down slightly ═══ */
.badge {
  box-shadow: none !important;
  border: 1px solid transparent !important;
}

/* ═══ FILE UPLOAD click area — whole dashed box ═══ */
div[style*="dashed"] {
  transition: all 0.4s cubic-bezier(0.22,1,0.36,1) !important;
}
div[style*="dashed"]:hover {
  border-color: rgba(99,179,237,0.35) !important;
  background: rgba(99,179,237,0.04) !important;
  box-shadow: 0 0 30px rgba(99,179,237,0.08) !important;
}

/* ═══ AVATAR in topbar — glow on hover ═══ */
.topbar-user .avatar {
  transition: all 0.35s ease !important;
}
.topbar-user:hover .avatar {
  box-shadow: 0 0 20px rgba(99,179,237,0.2) !important;
  border-color: rgba(99,179,237,0.3) !important;
  transform: scale(1.05);
}

/* ═══ BACK BUTTON — glow on hover ═══ */
.back-btn:hover {
  box-shadow: 0 0 16px rgba(99,179,237,0.1) !important;
  border-color: rgba(99,179,237,0.2) !important;
}

/* ═══ NEW BUTTON glow ═══ */
.new-btn-wrap .btn.primary {
  transition: all 0.35s ease !important;
}
.new-btn-wrap .btn.primary:hover {
  box-shadow: 0 0 36px rgba(99,179,237,0.3) !important;
  transform: scale(1.03);
}

/* ═══ CHECKBOX — styled ═══ */
input[type="checkbox"] {
  -webkit-appearance: none !important;
  appearance: none !important;
  width: 16px !important;
  height: 16px !important;
  border: 1px solid rgba(99,179,237,0.2) !important;
  border-radius: 4px !important;
  background: rgba(99,179,237,0.04) !important;
  cursor: pointer !important;
  transition: all 0.25s ease !important;
  position: relative;
}
input[type="checkbox"]:hover {
  border-color: rgba(99,179,237,0.4) !important;
  box-shadow: 0 0 12px rgba(99,179,237,0.15) !important;
}
input[type="checkbox"]:checked {
  background: rgba(99,179,237,0.2) !important;
  border-color: rgba(99,179,237,0.5) !important;
}
input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: -1px; left: 2px;
  font-size: 12px;
  color: var(--accent);
}

/* ═══ HOVER ACTION BUTTONS — glow ═══ */
.hover-action-btn {
  transition: all 0.3s ease !important;
}
.hover-action-btn:hover {
  box-shadow: 0 0 16px rgba(252,129,129,0.15) !important;
}
CSSEOF

echo "✅ 完成"
