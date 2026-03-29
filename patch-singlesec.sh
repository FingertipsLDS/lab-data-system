#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Replace the sections scroll area: show only active section
old_scroll = '''<div className="exp-sections-scroll">
          {sections.map(s => (
            <div key={s.key} id={'exp-sec-' + s.key} className="exp-section-card">
              <div className="exp-section-label">
                <span className="exp-sec-icon">{s.icon}</span>
                <span>{s.label}</span>
              </div>
              <EditBlock field={s.key} content={s.content} />
            </div>
          ))}
        </div>'''

new_scroll = '''<div className="exp-sections-scroll">
          {sections.filter(s => s.key === activeSection).map(s => (
            <div key={s.key} className="exp-section-card active-section">
              <div className="exp-section-label">
                <span className="exp-sec-icon">{s.icon}</span>
                <span>{s.label}</span>
              </div>
              <EditBlock field={s.key} content={s.content} />
            </div>
          ))}
        </div>'''

if old_scroll in c:
    c = c.replace(old_scroll, new_scroll)
    print("  ✓ 改为只显示当前选中区块")

# Also remove scrollIntoView since we no longer need it
c = c.replace(
    "document.getElementById('exp-sec-' + s.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });",
    ""
)

with open('src/App.tsx', 'w') as f:
    f.write(c)
PYEOF

# CSS: make the single section expand to fill
cat >> src/App.css << 'CSSEOF'

/* Active section fills space */
.active-section {
  animation: secFade 0.3s cubic-bezier(0.22,1,0.36,1) forwards;
}
@keyframes secFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.active-section .exp-content-block { min-height: 120px; }
.active-section .exp-edit-textarea { min-height: 160px !important; }
CSSEOF

echo "✅ 完成"
