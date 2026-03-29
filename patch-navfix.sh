#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修复导航顺序和滑动..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Fix nav order — find current navTabs and replace
# Find the navTabs block
idx = c.find('const navTabs = [')
if idx > 0:
    end = c.find('];', idx) + 2
    old_block = c[idx:end]
    print(f"  现有导航: {old_block[:200]}")
    
    new_block = """const navTabs = [
    { key: 'projects', label: '课题', icon: <FolderOpen size={15} /> },
    { key: 'experiments', label: '实验', icon: <FlaskConical size={15} /> },
    { key: 'templates', label: '方法', icon: <LayoutTemplate size={15} /> },
    { key: 'library', label: '文献', icon: <BookOpen size={15} /> },
  ];"""
    
    c = c[:idx] + new_block + c[end:]
    print("  ✓ 导航栏：课题 | 实验 | 方法 | 文献")

with open('src/App.tsx', 'w') as f:
    f.write(c)
PYEOF

# 2. CSS — slower animation, 0.7s
cat >> src/App.css << 'CSSEOF'

/* ═══ OVERRIDE: Slower slide, 0.7s ═══ */
.content-area.slide-from-right {
  animation: slideFromRight 0.7s cubic-bezier(0.22,1,0.36,1) forwards !important;
}
.content-area.slide-from-left {
  animation: slideFromLeft 0.7s cubic-bezier(0.22,1,0.36,1) forwards !important;
}
@keyframes slideFromRight {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes slideFromLeft {
  from { opacity: 0; transform: translateX(-100%); }
  to { opacity: 1; transform: translateX(0); }
}
CSSEOF

echo "✅ 完成"
