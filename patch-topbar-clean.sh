#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Remove ⌘K hint from search trigger
c = c.replace("<span className=\"kbd\">⌘K</span>", "")
print("  ✓ 搜索框去掉快捷键")

# 2. Remove username row + divider from UserMenu dropdown
c = c.replace(
    '<div className="user-dropdown-name">{userName}</div>\n        <div className="user-dropdown-divider" />',
    ''
)
print("  ✓ 头像菜单去掉用户名区域")

# 3. Remove NewButton from topbar
c = c.replace('<NewButton onAction={handleAction} />\n', '')
# Also try without newline
c = c.replace('<NewButton onAction={handleAction} />', '')
print("  ✓ 去掉新建按钮")

# 4. Remove settings from nav tabs
c = c.replace(
    "{ key: 'settings', label: '设置', icon: <Settings size={15} /> },",
    ""
)
print("  ✓ 导航栏去掉设置")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

echo "✅ 完成"
