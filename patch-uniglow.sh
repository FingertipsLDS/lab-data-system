#!/bin/bash
cd ~/Desktop/biolab

cat >> src/App.css << 'CSSEOF'

/* ═══ UNIFIED GLOW: all elements match module panel hover ═══ */

.stat-card {
  transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important;
  position: relative !important; overflow: hidden !important;
}
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, transparent 10%, currentColor 50%, transparent 90%);
  opacity: 0; transition: opacity 0.45s ease;
}
.stat-card::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(99,179,237,0.06) 0%, transparent 70%);
  opacity: 0; transition: opacity 0.45s ease; pointer-events: none;
}
.stat-card:hover { transform: translateY(-4px) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 48px rgba(99,179,237,0.15) !important; border-color: rgba(99,179,237,0.3) !important; }
.stat-card:hover::before { opacity: 0.6; }
.stat-card:hover::after { opacity: 1; }

.card:has(.empty-state) { transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important; overflow: hidden !important; position: relative !important; }
.card:has(.empty-state)::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent 10%, var(--accent) 50%, transparent 90%); opacity: 0; transition: opacity 0.45s ease; }
.card:has(.empty-state):hover { transform: translateY(-4px) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 48px rgba(99,179,237,0.15) !important; border-color: rgba(99,179,237,0.3) !important; }
.card:has(.empty-state):hover::before { opacity: 1; }

.template-card { overflow: hidden !important; position: relative !important; }
.template-card::before { content: '' !important; position: absolute !important; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent 10%, var(--accent) 50%, transparent 90%) !important; opacity: 0 !important; transition: opacity 0.45s ease !important; }
.template-card::after { content: '' !important; position: absolute !important; inset: 0; background: radial-gradient(circle at 50% 0%, rgba(99,179,237,0.06) 0%, transparent 70%) !important; opacity: 0 !important; transition: opacity 0.45s ease !important; pointer-events: none; }
.template-card:hover { transform: translateY(-6px) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 60px rgba(99,179,237,0.18) !important; border-color: rgba(99,179,237,0.35) !important; }
.template-card:hover::before { opacity: 1 !important; }
.template-card:hover::after { opacity: 1 !important; }

.quick-btn { position: relative !important; overflow: hidden !important; transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important; }
.quick-btn::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); opacity: 0; transition: opacity 0.45s ease; }
.quick-btn:hover { transform: translateY(-4px) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 48px rgba(99,179,237,0.15) !important; border-color: rgba(99,179,237,0.3) !important; }
.quick-btn:hover::before { opacity: 1; }

.card.clickable { overflow: hidden !important; position: relative !important; }
.card.clickable::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent 10%, var(--accent) 50%, transparent 90%); opacity: 0; transition: opacity 0.45s ease; z-index: 1; }
.card.clickable:hover::before { opacity: 1; }
.card.clickable:hover { transform: translateY(-4px) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 48px rgba(99,179,237,0.15) !important; border-color: rgba(99,179,237,0.3) !important; }

.recent-card { overflow: hidden !important; position: relative !important; transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important; }
.recent-card:hover { transform: translateY(-4px) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 48px rgba(99,179,237,0.15) !important; border-color: rgba(99,179,237,0.3) !important; }

.tab:hover { color: var(--accent) !important; text-shadow: 0 0 12px rgba(99,179,237,0.3); }
.tab.active { text-shadow: 0 0 12px rgba(99,179,237,0.4); }

.file-grid .card { transition: all 0.45s cubic-bezier(0.22,1,0.36,1) !important; }
.file-grid .card:hover { transform: translateY(-3px) !important; box-shadow: 0 6px 24px rgba(0,0,0,0.3), 0 0 36px rgba(99,179,237,0.1) !important; border-color: rgba(99,179,237,0.2) !important; }
CSSEOF

echo "✅ 所有元素发光效果已统一"
