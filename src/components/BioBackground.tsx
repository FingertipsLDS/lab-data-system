import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  type: number; size: number; op: number; rot: number; rotSpeed: number;
}

export function BioBackground({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });

  useEffect(() => {
    if (!enabled) { return () => {}; }
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth, h = window.innerHeight;
    cv.width = w; cv.height = h;

    // Size ratios: cell(50-80) > protein(20-35) > nucleicAcid(30-50 length) > molecule(12-22)
    const ps: Particle[] = [];
    const count = Math.min(22, Math.floor((w * h) / 55000));

    for (let i = 0; i < count; i++) {
      const type = i % 4;
      const size = type === 0 ? 45 + Math.random() * 35 :  // cell: 45-80
                   type === 1 ? 18 + Math.random() * 16 :  // protein: 18-34
                   type === 2 ? 28 + Math.random() * 22 :  // nucleic acid: 28-50
                                10 + Math.random() * 12;   // molecule: 10-22
      ps.push({
        x: size + Math.random() * (w - size * 2),
        y: size + Math.random() * (h - size * 2),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        type, size, op: 0.09 + Math.random() * 0.05,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.003,
      });
    }

    // 0: Cell — large irregular ellipse with membrane, nucleus, organelles
    function drawCell(c: CanvasRenderingContext2D, p: Particle) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#90cdf4'; c.lineWidth = 1.2;
      // membrane — wobbly
      c.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.04) {
        const w = 1 + Math.sin(a * 6 + p.rot * 3) * 0.04;
        const px = Math.cos(a) * p.size * 0.48 * w;
        const py = Math.sin(a) * p.size * 0.38 * w;
        a === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
      }
      c.closePath(); c.stroke();
      // subtle fill
      c.globalAlpha = p.op * 0.1; c.fillStyle = '#90cdf4'; c.fill(); c.globalAlpha = p.op;
      // nucleus
      c.lineWidth = 1.0;
      c.beginPath(); c.ellipse(p.size*0.04, 0, p.size*0.16, p.size*0.12, 0.2, 0, Math.PI*2); c.stroke();
      c.globalAlpha = p.op * 0.15; c.fill(); c.globalAlpha = p.op;
      // nucleolus
      c.globalAlpha = p.op * 0.4;
      c.beginPath(); c.arc(p.size*0.07, 0, p.size*0.045, 0, Math.PI*2); c.fill();
      // mitochondria
      c.globalAlpha = p.op * 0.5; c.lineWidth = 0.8;
      [[-0.24,0.1,-0.3],[0.26,0.13,0.6],[-0.12,-0.18,1.0]].forEach(([mx,my,ma]) => {
        c.beginPath(); c.ellipse(p.size*mx, p.size*my, p.size*0.065, p.size*0.028, ma, 0, Math.PI*2); c.stroke();
      });
      // vesicles
      c.globalAlpha = p.op * 0.35;
      [[0.28,-0.08,0.02],[-0.3,-0.12,0.018],[0.12,0.2,0.025]].forEach(([vx,vy,vr]) => {
        c.beginPath(); c.arc(p.size*vx, p.size*vy, p.size*vr, 0, Math.PI*2); c.stroke();
      });
      c.restore();
    }

    // 1: Protein — cluster of overlapping spheres (folded structure)
    function drawProtein(c: CanvasRenderingContext2D, p: Particle) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#90cdf4'; c.lineWidth = 1.1;
      const r = p.size * 0.22;
      const blobs = [
        { x: 0, y: 0, r: r * 1.1 },
        { x: r * 1.2, y: -r * 0.4, r: r * 0.9 },
        { x: -r * 1.0, y: -r * 0.6, r: r * 0.85 },
        { x: r * 0.5, y: r * 1.0, r: r * 0.95 },
        { x: -r * 0.7, y: r * 0.8, r: r * 0.7 },
      ];
      // alpha helices hint (spiral inside)
      c.globalAlpha = p.op * 0.3; c.lineWidth = 0.8;
      c.beginPath();
      for (let t = 0; t < Math.PI * 4; t += 0.15) {
        const sx = Math.cos(t) * r * 0.6; const sy = t / (Math.PI * 4) * p.size * 0.6 - p.size * 0.3;
        t === 0 ? c.moveTo(sx, sy) : c.lineTo(sx, sy);
      }
      c.stroke();
      // blobs
      c.globalAlpha = p.op;
      blobs.forEach(b => { c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.stroke(); });
      c.restore();
    }

    // 2: Nucleic acid — double helix with base pairs
    function drawNucleicAcid(c: CanvasRenderingContext2D, p: Particle) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#90cdf4'; c.lineWidth = 1.1;
      const len = p.size;
      const amp = p.size * 0.15;
      // two backbone strands
      c.beginPath();
      for (let i = 0; i <= len; i += 1.5) {
        const x = i - len / 2;
        const y = Math.sin(i * 0.18) * amp;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      c.beginPath();
      for (let i = 0; i <= len; i += 1.5) {
        const x = i - len / 2;
        const y = Math.sin(i * 0.18 + Math.PI) * amp;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      // base pairs
      c.globalAlpha = p.op * 0.5; c.lineWidth = 0.8;
      for (let i = 2; i < len - 2; i += 4) {
        const x = i - len / 2;
        const y1 = Math.sin(i * 0.18) * amp;
        const y2 = Math.sin(i * 0.18 + Math.PI) * amp;
        c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y2); c.stroke();
      }
      // phosphate dots on backbone
      c.globalAlpha = p.op * 0.6;
      for (let i = 0; i < len; i += 6) {
        const x = i - len / 2;
        c.beginPath(); c.arc(x, Math.sin(i * 0.18) * amp, 1, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(x, Math.sin(i * 0.18 + Math.PI) * amp, 1, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }

    // 3: Molecule — small atoms connected by bonds
    function drawMolecule(c: CanvasRenderingContext2D, p: Particle) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = p.op;
      c.strokeStyle = '#90cdf4'; c.lineWidth = 0.9;
      const r = p.size * 0.4;
      // hexagonal ring (benzene-like)
      const hex: {x: number; y: number}[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        hex.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      // bonds
      c.beginPath();
      hex.forEach((h, i) => { c.moveTo(h.x, h.y); c.lineTo(hex[(i + 1) % 6].x, hex[(i + 1) % 6].y); });
      c.stroke();
      // double bonds (inner ring hint)
      c.globalAlpha = p.op * 0.35;
      c.beginPath();
      for (let i = 0; i < 6; i += 2) {
        c.moveTo(hex[i].x * 0.7, hex[i].y * 0.7);
        c.lineTo(hex[(i + 1) % 6].x * 0.7, hex[(i + 1) % 6].y * 0.7);
      }
      c.stroke();
      // atoms
      c.globalAlpha = p.op;
      hex.forEach(h => { c.beginPath(); c.arc(h.x, h.y, 1.5, 0, Math.PI * 2); c.fill(); });
      // side chains
      c.globalAlpha = p.op * 0.5; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(hex[0].x, hex[0].y); c.lineTo(hex[0].x + r * 0.5, hex[0].y - r * 0.3); c.stroke();
      c.beginPath(); c.moveTo(hex[3].x, hex[3].y); c.lineTo(hex[3].x - r * 0.4, hex[3].y + r * 0.4); c.stroke();
      c.beginPath(); c.arc(hex[0].x + r * 0.5, hex[0].y - r * 0.3, 1.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(hex[3].x - r * 0.4, hex[3].y + r * 0.4, 1.2, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    const draws = [drawCell, drawProtein, drawNucleicAcid, drawMolecule];
    let raf: number;

    function loop() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const mx = mouse.current.x, my = mouse.current.y;
      ctx.fillStyle = '#90cdf4';

      ps.forEach(p => {
        // Mouse repulsion
        const dx = p.x - mx, dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120 && d > 0) {
          const f = (120 - d) / 120 * 0.12;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }

        // Damping
        p.vx *= 0.998; p.vy *= 0.998;

        // Move
        p.x += p.vx; p.y += p.vy;
        p.rot += p.rotSpeed;

        // Bounce off edges
        const margin = p.size * 0.5;
        if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx) * 0.8 + 0.05; }
        if (p.x > w - margin) { p.x = w - margin; p.vx = -Math.abs(p.vx) * 0.8 - 0.05; }
        if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy) * 0.8 + 0.05; }
        if (p.y > h - margin) { p.y = h - margin; p.vy = -Math.abs(p.vy) * 0.8 - 0.05; }

        // Ensure minimum speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed < 0.08) {
          p.vx += (Math.random() - 0.5) * 0.1;
          p.vy += (Math.random() - 0.5) * 0.1;
        }

        // Particle collisions
        for (let j = ps.indexOf(p) + 1; j < ps.length; j++) {
          const q = ps[j];
          const cdx = p.x - q.x, cdy = p.y - q.y;
          const dist = Math.sqrt(cdx * cdx + cdy * cdy);
          const minDist = (p.size + q.size) * 0.35;
          if (dist < minDist && dist > 0) {
            const nx = cdx / dist, ny = cdy / dist;
            const overlap = (minDist - dist) * 0.5;
            p.x += nx * overlap; p.y += ny * overlap;
            q.x -= nx * overlap; q.y -= ny * overlap;
            const dvx = p.vx - q.vx, dvy = p.vy - q.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              const mP = p.size, mQ = q.size, total = mP + mQ;
              p.vx -= (2 * mQ / total) * dot * nx * 0.6;
              p.vy -= (2 * mQ / total) * dot * ny * 0.6;
              q.vx += (2 * mP / total) * dot * nx * 0.6;
              q.vy += (2 * mP / total) * dot * ny * 0.6;
            }
          }
        }

        ctx.shadowColor = 'rgba(99,179,237,0.3)';
        ctx.shadowBlur = 8;
        draws[p.type](ctx, p);
        ctx.shadowBlur = 0;
      });

      raf = requestAnimationFrame(loop);
    }
    loop();

    const onResize = () => { w = window.innerWidth; h = window.innerHeight; cv.width = w; cv.height = h; };
    const onMouse = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', onMouse); };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}
