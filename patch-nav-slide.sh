#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修改中..."

python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. "进行中的实验" → "今日实验"
c = c.replace("进行中的实验", "今日实验")
print("  ✓ 进行中的实验 → 今日实验")

# 2. Section title "待办" stays but context is clear

# 3. "模板" → "方法" in nav and everywhere
c = c.replace("label: '模板'", "label: '方法'")
c = c.replace("'模板'", "'方法'")
c = c.replace('"模板"', '"方法"')
c = c.replace(">模板<", ">方法<")
# Fix page title
c = c.replace("page-title mb-3\">方法", "page-title mb-3\">方法")
print("  ✓ 模板 → 方法")

# 4. Reorder nav tabs: 课题, 实验, 方法, 文献
old_nav = '''const navTabs = [
    { key: 'projects', label: '课题', icon: <FolderOpen size={15} /> },
    { key: 'experiments', label: '实验', icon: <FlaskConical size={15} /> },
    { key: 'results', label: '结果', icon: <BarChart3 size={15} /> },
    { key: 'library', label: '资料库', icon: <Archive size={15} /> },
    { key: 'templates', label: '方法', icon: <LayoutTemplate size={15} /> },'''

# Try without results (it was removed earlier)
if old_nav not in c:
    old_nav = '''const navTabs = [
    { key: 'projects', label: '课题', icon: <FolderOpen size={15} /> },
    { key: 'experiments', label: '实验', icon: <FlaskConical size={15} /> },
    { key: 'library', label: '文献', icon: <BookOpen size={15} /> },
    { key: 'templates', label: '方法', icon: <LayoutTemplate size={15} /> },'''

new_nav = '''const navTabs = [
    { key: 'projects', label: '课题', icon: <FolderOpen size={15} /> },
    { key: 'experiments', label: '实验', icon: <FlaskConical size={15} /> },
    { key: 'templates', label: '方法', icon: <LayoutTemplate size={15} /> },
    { key: 'library', label: '文献', icon: <BookOpen size={15} /> },'''

if old_nav in c:
    c = c.replace(old_nav, new_nav)
    print("  ✓ 导航栏重排：课题 实验 方法 文献")
else:
    # Try to find and fix any order
    print("  ⚠ 未精确匹配导航栏，尝试手动查找...")
    # Print what we have
    idx = c.find('const navTabs')
    if idx > 0:
        print("  现有导航:", c[idx:idx+400])

# 5. Add slide direction tracking for horizontal transitions
# Add state for tracking nav direction
old_state_block = 'const [showNewReference, setShowNewReference] = useState(false);'
new_state_block = '''const [showNewReference, setShowNewReference] = useState(false);
  const [slideDir, setSlideDir] = useState<'left'|'right'|'none'>('none');
  const prevViewRef = useRef(currentView);'''

if old_state_block in c:
    c = c.replace(old_state_block, new_state_block)
    print("  ✓ 添加滑动方向状态")

# 6. Add nav index tracking for slide direction
# Insert useEffect after the keyboard handler
old_kbd_end = "window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);\n  }, [setSearchOpen]);"
new_kbd_end = """window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [setSearchOpen]);

  // Track slide direction based on nav tab index
  useEffect(() => {
    const tabKeys = navTabs.map(t => t.key);
    const prevIdx = tabKeys.indexOf(prevViewRef.current);
    const curIdx = tabKeys.indexOf(currentView);
    if (prevIdx >= 0 && curIdx >= 0 && prevIdx !== curIdx) {
      setSlideDir(curIdx > prevIdx ? 'right' : 'left');
    } else {
      setSlideDir('none');
    }
    prevViewRef.current = currentView;
  }, [currentView]);"""

if old_kbd_end in c:
    c = c.replace(old_kbd_end, new_kbd_end)
    print("  ✓ 添加滑动方向检测")

# 7. Add keyboard arrow left/right to switch tabs
old_kbd_handler = "if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }"
new_kbd_handler = """if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); const keys = navTabs.map(t => t.key); const ci = keys.indexOf(useStore.getState().currentView); if (ci > 0) navigateTo(keys[ci-1] as any); }
      if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); const keys = navTabs.map(t => t.key); const ci = keys.indexOf(useStore.getState().currentView); if (ci >= 0 && ci < keys.length - 1) navigateTo(keys[ci+1] as any); }"""

if old_kbd_handler in c:
    c = c.replace(old_kbd_handler, new_kbd_handler)
    print("  ✓ 添加 Alt+左右箭头切换")

# 8. Apply slide class to content area
old_content = '<div className="content-area" key={currentView}>{renderView()}</div>'
new_content = '<div className={`content-area ${slideDir === "left" ? "slide-from-left" : slideDir === "right" ? "slide-from-right" : "page-fade-in"}`} key={currentView}>{renderView()}</div>'

if old_content in c:
    c = c.replace(old_content, new_content)
    print("  ✓ 内容区添加滑动动画类")

# 9. Remove page-fade-in and page-slide-right from individual pages since content-area handles it
c = c.replace('page-container page-fade-in', 'page-container')
c = c.replace('page-container page-enter', 'page-container')
c = c.replace('page-container page-slide-right', 'page-container')
c = c.replace('page-container page-zoom-in', 'page-container')
print("  ✓ 去掉页面内部动画类")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n完成")
PYEOF

# CSS for horizontal slide
cat >> src/App.css << 'CSSEOF'

/* ═══ HORIZONTAL SLIDE TRANSITIONS ═══ */
.content-area {
  overflow: auto !important;
}
.content-area.slide-from-right {
  animation: slideFromRight 0.4s cubic-bezier(0.22,1,0.36,1) forwards !important;
}
.content-area.slide-from-left {
  animation: slideFromLeft 0.4s cubic-bezier(0.22,1,0.36,1) forwards !important;
}
@keyframes slideFromRight {
  from { opacity: 0; transform: translateX(60px); }
  to { opacity: 1; transform: none; }
}
@keyframes slideFromLeft {
  from { opacity: 0; transform: translateX(-60px); }
  to { opacity: 1; transform: none; }
}

/* Active tab indicator animation */
.topbar-tab {
  transition: all 0.3s cubic-bezier(0.22,1,0.36,1) !important;
}
CSSEOF

echo "✅ 完成"
