#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 修复删除..."

python3 << 'PYEOF'
with open("src/App.tsx", "r") as f:
    c = f.read()

# Replace the entire handleMouseDown + onUp to use a ref for latest state
old_handler = '''const handleMouseDown = (e: React.MouseEvent, origIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragIdx(origIdx);
    setBumpedIdxs([]);
    const otherIdxs = allMs.map((_: any, i: number) => i).filter((i: number) => i !== origIdx);
    const otherDays = otherIdxs.map((i: number) => allMs[i].day);

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      let newDay = Math.max(0, Math.min(maxDay, Math.round(pct * maxDay)));

      // Find which other nodes are at this day — bump them
      const bumped: number[] = [];
      otherIdxs.forEach((oi: number) => {
        if (allMs[oi].day === newDay && newDay > 0) bumped.push(oi);
      });
      setBumpedIdxs(bumped);

      // Don't allow landing on occupied non-zero positions
      if (newDay > 0 && otherDays.includes(newDay)) {
        // Snap to nearest free spot
        for (let offset = 1; offset <= maxDay; offset++) {
          const dir = pct > (allMs[origIdx]?.day || 0) / maxDay ? 1 : -1;
          const try1 = newDay + dir * offset;
          const try2 = newDay - dir * offset;
          if (try1 > 0 && try1 <= maxDay && !otherDays.includes(try1)) { newDay = try1; break; }
          if (try2 > 0 && try2 <= maxDay && !otherDays.includes(try2)) { newDay = try2; break; }
          if (try1 <= 0 || try1 > maxDay) { if (try2 > 0 && try2 <= maxDay && !otherDays.includes(try2)) { newDay = try2; break; } }
        }
      }

      const updated = [...allMs];
      if (updated[origIdx]) updated[origIdx] = { ...updated[origIdx], day: newDay };
      onSave({ ...timeline, milestones: updated });
    };

    const onUp = () => {
      setBumpedIdxs([]);
      const current = (timeline.milestones || [])[origIdx];
      if (current && current.day <= 0) {
        onSave({ ...timeline, milestones: allMs.filter((_: any, j: number) => j !== origIdx) });
      }
      setDragIdx(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };'''

new_handler = '''const latestMsRef = useRef(allMs);
  latestMsRef.current = allMs;

  const handleMouseDown = (e: React.MouseEvent, origIdx: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragIdx(origIdx);
    setBumpedIdxs([]);
    const otherIdxs = allMs.map((_: any, i: number) => i).filter((i: number) => i !== origIdx);
    const otherDays = otherIdxs.map((i: number) => allMs[i].day);
    let lastDay = allMs[origIdx]?.day || 0;

    const onMove = (ev: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      let newDay = Math.max(0, Math.min(maxDay, Math.round(pct * maxDay)));

      const bumped: number[] = [];
      otherIdxs.forEach((oi: number) => {
        if (allMs[oi].day === newDay && newDay > 0) bumped.push(oi);
      });
      setBumpedIdxs(bumped);

      if (newDay > 0 && otherDays.includes(newDay)) {
        for (let offset = 1; offset <= maxDay; offset++) {
          const dir = pct > lastDay / maxDay ? 1 : -1;
          const t1 = newDay + dir * offset;
          const t2 = newDay - dir * offset;
          if (t1 > 0 && t1 <= maxDay && !otherDays.includes(t1)) { newDay = t1; break; }
          if (t2 > 0 && t2 <= maxDay && !otherDays.includes(t2)) { newDay = t2; break; }
        }
      }

      lastDay = newDay;
      const updated = latestMsRef.current.map((m: any, i: number) => i === origIdx ? { ...m, day: newDay } : m);
      onSave({ ...timeline, milestones: updated });
    };

    const onUp = () => {
      setBumpedIdxs([]);
      // Remove any nodes with day <= 0
      const cleaned = latestMsRef.current.filter((m: any) => m.day > 0);
      if (cleaned.length < latestMsRef.current.length) {
        onSave({ ...timeline, milestones: cleaned });
      }
      setDragIdx(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };'''

if old_handler in c:
    c = c.replace(old_handler, new_handler)
    print("  ✓ 修复拖拽删除 (使用ref)")
else:
    print("  ⚠ 未找到精确匹配，尝试模糊修复...")
    # Fallback: just replace onUp
    c = c.replace(
        "const current = (timeline.milestones || [])[origIdx];\n      if (current && current.day <= 0) {\n        onSave({ ...timeline, milestones: allMs.filter((_: any, j: number) => j !== origIdx) });\n      }",
        "const cleaned = (timeline.milestones || []).filter((m: any) => m.day > 0);\n      if (cleaned.length < (timeline.milestones || []).length) onSave({ ...timeline, milestones: cleaned });"
    )
    print("  ✓ 模糊修复完成")

with open("src/App.tsx", "w") as f:
    f.write(c)
PYEOF

echo "✅ 完成"
