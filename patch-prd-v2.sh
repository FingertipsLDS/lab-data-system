#!/bin/bash
cd ~/Desktop/biolab

echo "🔧 实施 PRD V2 第一批优化..."

# ═══ 1. 文字可读性 — CSS 变量提亮 ═══
cat >> src/App.css << 'CSSEOF'

/* ═══ PRD V2: TEXT READABILITY BOOST ═══ */
:root {
  --text-primary: #f1f5f9 !important;
  --text-secondary: #a0aec0 !important;
  --text-muted: #718096 !important;
  --text-dim: #4a5568 !important;
}

.page-title { color: #f1f5f9 !important; }
.page-desc { color: #718096 !important; }
.sec-title { color: #63b3ed !important; }
.meta-row { color: #718096 !important; }
.empty-sm { color: #718096 !important; }
.form-group label { color: #8b95a8 !important; }
.tl-total { opacity: 1 !important; color: #63b3ed !important; }
.tl-day { color: #f1f5f9 !important; }
.tl-n-label { color: #718096 !important; }
.tl-n:hover .tl-n-label { color: #63b3ed !important; }
.mp-title { color: #f1f5f9 !important; }
.mp-label { color: #718096 !important; }
.card .font-bold { color: #f1f5f9 !important; }
.text-sm.muted, .text-xs.muted, .muted { color: #718096 !important; }
.exp-content-text { color: #a0aec0 !important; }
.exp-content-empty { color: #4a5568 !important; }
.exp-section-label span { color: #63b3ed !important; }
.topbar-tab { color: #718096 !important; }
.topbar-tab:hover { color: #a0aec0 !important; }
.topbar-tab.active { color: #63b3ed !important; }
.btn { color: #a0aec0 !important; }
.btn:hover { color: #f1f5f9 !important; }
.search-trigger span { color: #4a5568 !important; }
.modal-header h2 { color: #f1f5f9 !important; }
.template-name { color: #f1f5f9 !important; }
.epc-meta { color: #718096 !important; }
.epc-title { color: #f1f5f9 !important; }
.badge { opacity: 1 !important; }
CSSEOF

echo "  ✓ 文字可读性优化完成"

# ═══ 2. 动态科研背景 — BioBackground 组件 ═══
cat > src/components/BioBackground.tsx << 'BGEOF'
import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  type: number; size: number; opacity: number; rotation: number;
}

export function BioBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0, h = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };

    const initParticles = () => {
      const count = Math.floor((w * h) / 60000);
      const ps: Particle[] = [];
      for (let i = 0; i < Math.min(count, 25); i++) {
        ps.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
          type: Math.floor(Math.random() * 5),
          size: 15 + Math.random() * 30,
          opacity: 0.02 + Math.random() * 0.03,
          rotation: Math.random() * Math.PI * 2,
        });
      }
      particlesRef.current = ps;
    };

    const drawCell = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      // nucleus
      ctx.beginPath();
      ctx.arc(p.size * 0.05, -p.size * 0.05, p.size * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      // organelles
      ctx.beginPath();
      ctx.arc(-p.size * 0.15, p.size * 0.1, p.size * 0.06, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawDNA = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 0.8;
      const len = p.size;
      for (let i = 0; i < len; i += 2) {
        const y1 = Math.sin(i * 0.3) * 6;
        const y2 = Math.sin(i * 0.3 + Math.PI) * 6;
        const x = i - len / 2;
        ctx.beginPath(); ctx.arc(x, y1, 0.8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y2, 0.8, 0, Math.PI * 2); ctx.stroke();
        if (i % 6 === 0) { ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke(); }
      }
      ctx.restore();
    };

    const drawMolecule = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 0.8;
      const atoms = [{ x: 0, y: 0 }, { x: p.size * 0.3, y: -p.size * 0.2 }, { x: -p.size * 0.25, y: -p.size * 0.15 }, { x: p.size * 0.15, y: p.size * 0.25 }, { x: -p.size * 0.3, y: p.size * 0.1 }];
      // bonds
      for (let i = 1; i < atoms.length; i++) {
        ctx.beginPath(); ctx.moveTo(atoms[0].x, atoms[0].y); ctx.lineTo(atoms[i].x, atoms[i].y); ctx.stroke();
      }
      // atoms
      atoms.forEach(a => { ctx.beginPath(); ctx.arc(a.x, a.y, 2, 0, Math.PI * 2); ctx.stroke(); });
      ctx.restore();
    };

    const drawProtein = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = p.opacity;
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 0.8;
      const r = p.size * 0.2;
      [{ x: 0, y: 0 }, { x: r, y: -r * 0.5 }, { x: -r * 0.8, y: -r * 0.3 }, { x: r * 0.3, y: r * 0.7 }].forEach(c => {
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.restore();
    };

    const drawAntibody = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 1;
      const h = p.size * 0.5;
      // stem
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, 0); ctx.stroke();
      // arms
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-h * 0.5, -h * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(h * 0.5, -h * 0.5); ctx.stroke();
      // tips
      ctx.beginPath(); ctx.arc(-h * 0.5, -h * 0.5, 2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(h * 0.5, -h * 0.5, 2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, h, 2.5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    const drawFns = [drawCell, drawDNA, drawMolecule, drawProtein, drawAntibody];

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      const mx = mouseRef.current.x, my = mouseRef.current.y;

      particlesRef.current.forEach(p => {
        // Mouse repulsion
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120 * 0.15;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Move
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += 0.002;

        // Bounds
        if (p.x < -p.size) p.x = w + p.size;
        if (p.x > w + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = h + p.size;
        if (p.y > h + p.size) p.y = -p.size;

        // Draw
        drawFns[p.type](ctx, p);
      });

      animId = requestAnimationFrame(animate);
    };

    resize();
    initParticles();
    animate();

    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('resize', () => { resize(); initParticles(); });
    window.addEventListener('mousemove', onMouse);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />;
}
BGEOF

echo "  ✓ BioBackground 组件创建完成"

# ═══ 3. 在 App.tsx 中集成 BioBackground ═══
python3 << 'PYEOF'
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Add import
if 'BioBackground' not in c:
    c = c.replace(
        "import './App.css';",
        "import './App.css';\nimport { BioBackground } from './components/BioBackground';"
    )
    print("  ✓ BioBackground import 添加")

# Add component to render
if '<BioBackground' not in c:
    c = c.replace(
        '<div className="app">',
        '<div className="app"><BioBackground />'
    )
    print("  ✓ BioBackground 组件渲染")

# ═══ 4. 实验复制功能 ═══
# Add cloneExperiment to appStore
with open('src/stores/appStore.ts', 'r') as f:
    store = f.read()

if 'cloneExperiment' not in store:
    # Add to interface
    store = store.replace(
        'deleteExperiment: (id: string) => Promise<void>;',
        'deleteExperiment: (id: string) => Promise<void>;\n  cloneExperiment: (id: string) => Promise<void>;'
    )
    # Add implementation before getProjectExperiments
    store = store.replace(
        'getProjectExperiments:',
        '''cloneExperiment: async (id) => {
    const exp = get().experiments.find((e: any) => e.id === id);
    if (!exp) return;
    await get().addExperiment({
      projectId: exp.projectId,
      title: exp.title + ' (副本)',
      type: exp.type,
      date: new Date().toISOString().slice(0, 10),
      purpose: exp.purpose,
      materials: exp.materials,
      steps: exp.steps,
      parameters: '', // reset timeline
      results: '',
      conclusion: '',
      issues: '',
      nextSteps: '',
      status: '进行中',
    });
  },

  getProjectExperiments:'''
    )
    with open('src/stores/appStore.ts', 'w') as f:
        f.write(store)
    print("  ✓ appStore 添加 cloneExperiment")

# Add clone button to ExperimentDetailPage
# Find delete button and add clone before it
c = c.replace(
    '''<button className="btn danger sm" onClick={() => { if (confirm('删除？')) deleteExperiment(exp.id); }}><Trash2 size={13} /></button>''',
    '''<button className="btn sm" onClick={() => { useStore.getState().cloneExperiment(exp.id); }} style={{ marginRight: 6 }}>复制实验</button>
        <button className="btn danger sm" onClick={() => { if (confirm('删除？')) deleteExperiment(exp.id); }}><Trash2 size={13} /></button>'''
)
print("  ✓ 实验详情添加复制按钮")

with open('src/App.tsx', 'w') as f:
    f.write(c)

print("\n全部完成")
PYEOF

# ═══ 5. Ensure content area is above background ═══
cat >> src/App.css << 'CSSEOF'

/* ═══ Z-INDEX: content above background ═══ */
.topbar { position: relative; z-index: 20 !important; }
.content-area { position: relative; z-index: 1 !important; }
.sub-breadcrumb { position: relative; z-index: 15 !important; }
.overlay { z-index: 100 !important; }
CSSEOF

echo ""
echo "✅ PRD V2 第一批优化完成："
echo "  1. 文字可读性全面提亮"
echo "  2. 动态科研背景（细胞/DNA/分子/蛋白质/抗体）"
echo "  3. 实验复制功能"
echo ""
echo "运行 pnpm tauri dev 测试"
