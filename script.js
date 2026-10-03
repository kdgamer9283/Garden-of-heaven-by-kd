/* ==========================================================
   Cinematic Garden Of Heaven
   Developer: kd
   Click anywhere to plant a flower. Watch it grow, glow and
   sway under the moon while fireflies drift around it.
   ========================================================== */
(() => {
  'use strict';

  const DEVELOPER = 'kd';
  const STORE_KEY = 'kd-love-garden-v1';
  const GROW_MS = 2600;
  const MAX_FLOWERS = 260;

  const canvas = document.getElementById('garden');
  const ctx = canvas.getContext('2d');
  const hintEl = document.getElementById('hint');
  const counterEl = document.getElementById('counter');
  const nameInput = document.getElementById('nameInput');
  const dedicationEl = document.getElementById('dedication');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;

  /* ---------- helpers ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const quad = (p0, c, p1, t) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p1;

  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixHex = (a, b, t) => {
    const A = hexToRgb(a), B = hexToRgb(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  };

  /* ---------- themes (night <-> dawn) ---------- */
  const NIGHT = { sky: ['#0b0620', '#2a0f45', '#5b1d62'], hills: ['#1c0b30', '#260f3d', '#31134a'], moon: '#fff6d6' };
  const DAWN  = { sky: ['#2b1055', '#c0467f', '#ffb88c'], hills: ['#3d1848', '#4f1d52', '#632658'], moon: '#ffd9a0' };
  let themeT = 0, themeTarget = 0;

  /* ---------- state ---------- */
  const flowers = [];
  const particles = [];
  const fireflies = [];
  const shooters = [];
  let stars = [];
  let blades = [];
  const pointer = { x: -999, y: -999, lastTrail: 0 };

  const PALETTE = [
    [345, 90, 68], [328, 85, 66], [300, 70, 70], [280, 75, 74],
    [12, 92, 66], [38, 95, 62], [195, 85, 70], [355, 80, 60]
  ];
  const WORDS = ['you + me', 'forever', 'always you', 'bloom with me', 'my favorite hello',
                 'home is you', 'in every season', 'kd \u2665', 'only ever us', 'stay a while'];

  /* ---------- sizing ---------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const starCount = Math.floor((W * H) / 5500);
    stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.75,
      r: rand(0.4, 1.6), ph: rand(0, 6.28), sp: rand(0.0008, 0.003)
    }));

    const bladeCount = Math.floor(W / 5);
    blades = Array.from({ length: bladeCount }, () => ({
      x: Math.random() * W, h: rand(14, 44), ph: rand(0, 6.28), shade: Math.random()
    }));

    if (!fireflies.length) {
      const n = reduceMotion ? 10 : clamp(Math.floor(W / 28), 20, 60);
      for (let i = 0; i < n; i++) fireflies.push(makeFirefly());
    }
  }

  function makeFirefly() {
    return {
      x: Math.random() * window.innerWidth, y: rand(0.3, 0.95) * window.innerHeight,
      vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), ph: rand(0, 6.28), sp: rand(0.001, 0.003), r: rand(1.4, 2.8)
    };
  }

  /* ---------- flowers ---------- */
  function makeFlower(nx, ny, extra) {
    const [h, s, l] = pick(PALETTE);
    return Object.assign({
      nx, ny,
      by: clamp(Math.max(rand(0.92, 1.0), ny + 0.07), 0, 1.05),
      bx: nx + rand(-0.03, 0.03),
      h: h + rand(-8, 8), s, l,
      n: Math.floor(rand(5, 10)),
      sz: rand(20, 34),
      rot: rand(0, 6.28),
      spin: rand(-1, 1),
      phase: rand(0, 6.28),
      bend: rand(-0.06, 0.06),
      shape: Math.random() < 0.5 ? 'round' : 'point',
      born: performance.now()
    }, extra || {});
  }

  function plant(px, py, silent) {
    const f = makeFlower(clamp(px / W, 0.01, 0.99), clamp(py / H, 0.12, 0.93));
    flowers.push(f);
    if (flowers.length > MAX_FLOWERS) flowers.shift();
    burst(px, py, f);
    if (!silent) {
      hintEl.classList.add('gone');
      save();
    }
    updateCounter();
  }

  function sizeScale() { return clamp(Math.min(W, H) / 760, 0.7, 1.25); }

  function drawLeaf(x, y, side, len, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side > 0 ? -0.5 : Math.PI + 0.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawPetal(shape, size) {
    ctx.beginPath();
    if (shape === 'round') {
      ctx.ellipse(size * 0.55, 0, size * 0.55, size * 0.3, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(size * 0.5, -size * 0.5, size * 1.08, 0);
      ctx.quadraticCurveTo(size * 0.5, size * 0.5, 0, 0);
    }
    ctx.fill();
    ctx.stroke();
  }

  function drawFlower(f, t) {
    const g = clamp((t - f.born) / GROW_MS, 0, 1);
    if (g <= 0) return;
    const stemP = easeOutCubic(clamp(g / 0.6, 0, 1));
    const bloomP = clamp((g - 0.55) / 0.45, 0, 1);

    const hx = f.nx * W, hy = f.ny * H;
    const bx = f.bx * W, by = f.by * H;
    const sway = reduceMotion ? 0 : Math.sin(t * 0.0012 + f.phase) * (4 + (by - hy) * 0.018);
    const tipX = lerp(bx, hx, stemP) + sway * stemP;
    const tipY = lerp(by, hy, stemP);
    const cX = bx + (tipX - bx) * 0.2 + f.bend * W;
    const cY = (by + tipY) / 2;

    // stem
    ctx.strokeStyle = 'hsl(138, 45%, 30%)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(cX, cY, tipX, tipY);
    ctx.stroke();

    // leaves
    [[0.3, 1], [0.55, -1]].forEach(([p, side]) => {
      if (stemP <= p) return;
      const grow = clamp((stemP - p) / 0.3, 0, 1);
      const lx = quad(bx, cX, tipX, p), ly = quad(by, cY, tipY, p);
      drawLeaf(lx, ly, side, 26 * grow * sizeScale(), 'hsl(140, 48%, 36%)');
    });

    const size = f.sz * sizeScale();

    if (bloomP <= 0) {
      ctx.fillStyle = 'hsl(140, 50%, 40%)';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3 + 3 * stemP, 0, 6.283);
      ctx.fill();
      return;
    }

    const scale = Math.max(0, easeOutBack(bloomP));

    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, size * 2.6 * scale);
    gl.addColorStop(0, `hsla(${f.h}, ${f.s}%, ${f.l}%, ${0.38 * bloomP})`);
    gl.addColorStop(1, `hsla(${f.h}, ${f.s}%, ${f.l}%, 0)`);
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(tipX, tipY, size * 2.6 * scale, 0, 6.283);
    ctx.fill();
    ctx.restore();

    // petals: outer ring then lighter inner ring
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(f.rot + (reduceMotion ? 0 : t * 0.00012 * f.spin));
    ctx.scale(scale, scale);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = `hsla(${f.h}, ${f.s}%, ${f.l + 18}%, 0.7)`;

    ctx.fillStyle = `hsl(${f.h}, ${f.s}%, ${f.l}%)`;
    for (let i = 0; i < f.n; i++) {
      ctx.save();
      ctx.rotate((i / f.n) * 6.283);
      drawPetal(f.shape, size);
      ctx.restore();
    }
    ctx.fillStyle = `hsl(${f.h + 8}, ${f.s}%, ${f.l + 12}%)`;
    for (let i = 0; i < f.n; i++) {
      ctx.save();
      ctx.rotate(((i + 0.5) / f.n) * 6.283);
      drawPetal(f.shape, size * 0.64);
      ctx.restore();
    }

    // heart of the flower
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.26);
    cg.addColorStop(0, '#fff7b0');
    cg.addColorStop(1, '#ffb52e');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.24, 0, 6.283);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- particles ---------- */
  function heartPath(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.5, y - s * 1.1, x, y - s * 0.55);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s, y - s * 0.3, x, y + s * 0.35);
    ctx.closePath();
  }

  function burst(x, y, f) {
    const count = reduceMotion ? 4 : 8;
    for (let i = 0; i < count; i++) {
      particles.push({ type: 'heart', x, y, vx: rand(-1.2, 1.2), vy: rand(-2.4, -0.9), life: 1, decay: rand(0.006, 0.011),
        size: rand(5, 11), color: `hsl(${f.h + rand(-15, 15)}, 90%, 70%)` });
    }
    for (let i = 0; i < (reduceMotion ? 6 : 16); i++) {
      const a = rand(0, 6.283), sp = rand(0.6, 3);
      particles.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: rand(0.012, 0.025),
        size: rand(1, 2.6), color: `hsl(${f.h}, 95%, 80%)` });
    }
    for (let i = 0; i < (reduceMotion ? 3 : 10); i++) {
      particles.push({ type: 'petal', x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-0.8, 0.8), vy: rand(-0.6, 0.4),
        rot: rand(0, 6.28), vr: rand(-0.04, 0.04), life: 1, decay: rand(0.002, 0.004), size: rand(4, 8),
        color: `hsl(${f.h + rand(-12, 12)}, ${f.s}%, ${f.l + 6}%)`, ph: rand(0, 6.28) });
    }
    if (Math.random() < 0.55) {
      particles.push({ type: 'text', x, y: y - f.sz - 16, vx: 0, vy: -0.28, life: 1, decay: 0.005, text: pick(WORDS) });
    }
  }

  function spawnAmbientPetal() {
    particles.push({ type: 'petal', x: rand(0, W), y: -10, vx: rand(-0.3, 0.5), vy: rand(0.4, 1),
      rot: rand(0, 6.28), vr: rand(-0.03, 0.03), life: 1, decay: 0.0009, size: rand(3, 6),
      color: `hsla(${pick([330, 345, 300])}, 80%, 78%, 0.85)`, ph: rand(0, 6.28) });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0 || p.y > H + 20) { particles.splice(i, 1); continue; }
      if (p.type === 'petal') {
        p.vy = Math.min(p.vy + 0.004 * dt, 1.2);
        p.x += (p.vx + Math.sin(performance.now() * 0.002 + p.ph) * 0.5) * dt * 0.6;
        p.y += p.vy * dt * 0.6;
        p.rot += p.vr * dt;
      } else if (p.type === 'heart') {
        p.vy -= 0.002 * dt;
        p.x += p.vx * dt * 0.6 + Math.sin(p.life * 12) * 0.25;
        p.y += p.vy * dt * 0.6;
      } else if (p.type === 'spark') {
        p.vx *= 0.97; p.vy *= 0.97;
        p.x += p.vx * dt * 0.6; p.y += p.vy * dt * 0.6;
      } else if (p.type === 'text') {
        p.y += p.vy * dt * 0.6;
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life, 0, 1);
      if (p.type === 'heart') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        heartPath(p.x, p.y, p.size);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 6.283);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'petal') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'text') {
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = 'italic 600 22px "Cormorant Garamond", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff4fa';
        ctx.shadowColor = 'rgba(255,110,190,0.9)';
        ctx.shadowBlur = 12;
        ctx.fillText(p.text, p.x, p.y);
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- scenery ---------- */
  function drawSky(t) {
    const c0 = mixHex(NIGHT.sky[0], DAWN.sky[0], themeT);
    const c1 = mixHex(NIGHT.sky[1], DAWN.sky[1], themeT);
    const c2 = mixHex(NIGHT.sky[2], DAWN.sky[2], themeT);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const vis = lerp(1, 0.18, themeT);
    for (const s of stars) {
      const tw = 0.45 + 0.55 * Math.sin(t * s.sp + s.ph);
      ctx.globalAlpha = clamp(tw * vis, 0, 1);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // moon / sun
    const mx = W * 0.82, my = H * 0.2, mr = clamp(Math.min(W, H) * 0.055, 24, 52);
    const mc = mixHex(NIGHT.moon, DAWN.moon, themeT);
    const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4.2);
    halo.addColorStop(0, `rgba(255, 235, 200, ${lerp(0.4, 0.55, themeT)})`);
    halo.addColorStop(1, 'rgba(255, 235, 200, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 4.2, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = mc;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, 6.283);
    ctx.fill();
    if (themeT < 0.5) { // soft craters at night
      ctx.fillStyle = `rgba(210, 190, 150, ${0.35 * (1 - themeT * 2)})`;
      [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.1, 0.38, 0.12]].forEach(([dx, dy, r]) => {
        ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 6.283); ctx.fill();
      });
    }
  }

  function updateShooters(dt) {
    if (!reduceMotion && Math.random() < 0.0016 * dt && shooters.length < 2) {
      shooters.push({ x: rand(W * 0.4, W), y: rand(0, H * 0.3), vx: -rand(6, 10), vy: rand(2.5, 4.5), life: 1 });
    }
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.vx * dt * 0.06; s.y += s.vy * dt * 0.06;
      s.life -= dt * 0.0009;
      if (s.life <= 0) shooters.splice(i, 1);
    }
  }

  function drawShooters() {
    for (const s of shooters) {
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
      g.addColorStop(0, `rgba(255,255,255,${clamp(s.life, 0, 1)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9);
      ctx.stroke();
    }
  }

  function drawHills() {
    const layers = [
      { base: 0.70, amp: 0.045, f: 0.0042, off: 1.3, i: 0 },
      { base: 0.78, amp: 0.05, f: 0.0031, off: 4.1, i: 1 },
      { base: 0.86, amp: 0.04, f: 0.0052, off: 7.7, i: 2 }
    ];
    for (const L of layers) {
      ctx.fillStyle = mixHex(NIGHT.hills[L.i], DAWN.hills[L.i], themeT);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 12) {
        const y = H * L.base + Math.sin(x * L.f + L.off) * H * L.amp + Math.sin(x * L.f * 2.3 + L.off) * H * L.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGrass(t) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    for (const b of blades) {
      const sway = reduceMotion ? 0 : Math.sin(t * 0.0015 + b.ph + b.x * 0.01) * 5;
      ctx.strokeStyle = `hsl(${130 + b.shade * 20}, 42%, ${16 + b.shade * 14}%)`;
      ctx.beginPath();
      ctx.moveTo(b.x, H + 2);
      ctx.quadraticCurveTo(b.x + sway * 0.4, H - b.h * 0.6, b.x + sway, H - b.h);
      ctx.stroke();
    }
  }

  /* ---------- fireflies ---------- */
  function updateFireflies(dt) {
    for (const f of fireflies) {
      f.vx += rand(-0.02, 0.02) * dt * 0.06 * 16;
      f.vy += rand(-0.02, 0.02) * dt * 0.06 * 16;
      const dx = pointer.x - f.x, dy = pointer.y - f.y, d = Math.hypot(dx, dy);
      if (d < 220 && d > 1) { f.vx += (dx / d) * 0.012; f.vy += (dy / d) * 0.012; }
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > 0.9) { f.vx *= 0.9 / sp; f.vy *= 0.9 / sp; }
      f.x += f.vx * dt * 0.06 * 16 * 0.6; f.y += f.vy * dt * 0.06 * 16 * 0.6;
      if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      if (f.y < H * 0.2) f.vy += 0.03; if (f.y > H) f.vy -= 0.03;
    }
  }

  function drawFireflies(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fireflies) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * f.sp + f.ph));
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 7);
      g.addColorStop(0, `rgba(255, 245, 160, ${0.9 * a})`);
      g.addColorStop(0.3, `rgba(255, 220, 110, ${0.3 * a})`);
      g.addColorStop(1, 'rgba(255, 200, 80, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 7, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- music: Fairytale (Piano Version) ----------
     Plays your own file at music/fairytale.mp3 if you add one
     (full length, loops). Otherwise it opens the official Spotify
     player for the track below. */
  const SPOTIFY_URI = 'spotify:track:1D7zRKv9qu2UqRhf4KHyT2';
  const localAudio = document.getElementById('localTrack');
  const musicCard = document.getElementById('musicCard');
  const musicBtn = document.getElementById('btnMusic');
  let musicOn = false, spotifyCtl = null, spotifyWanted = false;
  localAudio.volume = 0.7;

  window.onSpotifyIframeApiReady = IFrameAPI => {
    IFrameAPI.createController(document.getElementById('spotifyEmbed'),
      { uri: SPOTIFY_URI, width: '100%', height: 80, theme: 0 },
      ctl => {
        spotifyCtl = ctl;
        if (spotifyWanted && musicOn) ctl.play();
      });
  };

  function showMusicUI(on) {
    musicBtn.textContent = on ? '🎶' : '🎵';
    musicBtn.setAttribute('aria-pressed', String(on));
  }

  async function startMusic() {
    musicOn = true;
    showMusicUI(true);
    try {
      await localAudio.play();            // your own mp3, if present
    } catch (e) {
      musicCard.classList.add('show');    // fall back to Spotify player
      if (spotifyCtl) spotifyCtl.play(); else spotifyWanted = true;
    }
  }

  function stopMusic() {
    musicOn = false;
    showMusicUI(false);
    localAudio.pause();
    if (spotifyCtl) spotifyCtl.pause();
    musicCard.classList.remove('show');
  }

  function toggleMusic() { musicOn ? stopMusic() : startMusic(); }

  const localTrack = document.getElementById("localTrack");
const volumeSlider = document.getElementById("volumeSlider");

// Default volume: 50%
localTrack.volume = 0.5;

volumeSlider.addEventListener("input", () => {
  localTrack.volume = Number(volumeSlider.value);
});

  /* ---------- storage ---------- */
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const data = flowers.map(({ born, ...rest }) => rest);
        localStorage.setItem(STORE_KEY, JSON.stringify({ flowers: data, name: nameInput.value.trim(), theme: themeTarget }));
      } catch (e) { /* storage unavailable, ignore */ }
    }, 250);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const now = performance.now();
      (d.flowers || []).slice(-MAX_FLOWERS).forEach((f, i) => flowers.push(Object.assign({}, f, { born: now + 400 + i * 70 })));
      if (d.name) { nameInput.value = d.name; setDedication(d.name); }
      if (d.theme) setTheme(d.theme, true);
      if (flowers.length) hintEl.classList.add('gone');
    } catch (e) { /* ignore corrupt data */ }
  }

  /* ---------- UI ---------- */
  function updateCounter() {
    counterEl.textContent = flowers.length ? `${flowers.length} ${flowers.length === 1 ? 'flower' : 'flowers'} planted` : '';
  }

  function setDedication(name) {
    dedicationEl.textContent = name ? `Planted for ${name}` : 'Planted for you';
  }

  function setTheme(target, instant) {
    themeTarget = target;
    if (instant) themeT = target;
    document.getElementById('btnTheme').textContent = target ? '🌅' : '🌙';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', target ? '#2b1055' : '#0b0620');
  }

  function bouquet() {
    const n = 14;
    for (let i = 0; i < n; i++) {
      setTimeout(() => plant(rand(W * 0.06, W * 0.86), rand(H * 0.3, H * 0.78), false), i * 140);
    }
  }

  function clearGarden() {
    flowers.length = 0;
    particles.length = 0;
    hintEl.classList.remove('gone');
    updateCounter();
    save();
  }

  function screenshot() {
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    const o = out.getContext('2d');
    o.drawImage(canvas, 0, 0);
    o.scale(DPR, DPR);
    o.textAlign = 'center';
    o.fillStyle = '#fff4fa';
    o.shadowColor = 'rgba(255,110,190,0.9)';
    o.shadowBlur = 14;
    o.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif';
    o.fillText('Cinematic Garden Of Heaven', W / 2, 54);
    o.font = 'italic 500 20px "Cormorant Garamond", Georgia, serif';
    o.fillText(dedicationEl.textContent, W / 2, 84);
    o.textAlign = 'left';
    o.font = '15px Quicksand, sans-serif';
    o.fillText('\u2665 by ' + DEVELOPER, 16, H - 14);
    out.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'love-garden-by-kd.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  /* ---------- events ---------- */
  canvas.addEventListener('pointerdown', e => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    plant(e.clientX, e.clientY, false);
  });

  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    const now = performance.now();
    if (!reduceMotion && now - pointer.lastTrail > 45 && e.target === canvas) {
      pointer.lastTrail = now;
      particles.push({ type: 'spark', x: e.clientX, y: e.clientY, vx: rand(-0.4, 0.4), vy: rand(-0.6, 0.2),
        life: 1, decay: 0.03, size: rand(1, 2.2), color: 'hsl(330, 95%, 82%)' });
    }
  });

  window.addEventListener('pointerleave', () => { pointer.x = pointer.y = -999; });

  document.getElementById('btnBouquet').addEventListener('click', bouquet);
  document.getElementById('btnTheme').addEventListener('click', () => { setTheme(themeTarget ? 0 : 1); save(); });
  musicBtn.addEventListener('click', toggleMusic);
  document.getElementById('btnShot').addEventListener('click', screenshot);
  document.getElementById('btnClear').addEventListener('click', clearGarden);

  nameInput.addEventListener('input', () => { setDedication(nameInput.value.trim()); save(); });

  window.addEventListener('keydown', e => {
    if (e.target === nameInput || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); bouquet(); }
    else if (k === 'm') toggleMusic();
    else if (k === 't') { setTheme(themeTarget ? 0 : 1); save(); }
    else if (k === 'p') screenshot();
    else if (k === 'c') clearGarden();
  });

  window.addEventListener('resize', resize);

  /* ---------- main loop ---------- */
  let last = performance.now(), lastPetal = 0;

  function frame(t) {
    const dt = Math.min(t - last, 50);
    last = t;

    themeT += (themeTarget - themeT) * 0.04;

    if (!reduceMotion && t - lastPetal > 900) { lastPetal = t; spawnAmbientPetal(); }

    updateParticles(dt);
    updateFireflies(dt);
    updateShooters(dt);

    drawSky(t);
    drawShooters();
    drawHills();
    drawFireflies(t);
    for (const f of flowers) drawFlower(f, t);
    drawGrass(t);
    drawParticles();

    requestAnimationFrame(frame);
  }

  /* ---------- go ---------- */
  resize();
  load();
  updateCounter();
  requestAnimationFrame(frame);

  console.log('%c\u2665 Cinematic Garden Of Heaven \u2014 built by ' + DEVELOPER, 'color:#ff6fa8;font-size:14px;font-weight:bold');
})();
