// ===== map.js : 地图/关卡/敌人/波次相关代码 =====
const MAP_LAYERS = [
  {
    id: 'earth',       element: '戊土', zoneName: '渊底·戊土之狱',
    waveStart: 1, waveEnd: 5,
    bg:     ['#2a1f0e', '#0f0a04'],
    tint:   'rgba(80, 55, 25, 0.28)',
    vignette: 0.55,
    accent: '#d4a85a', border: 'rgba(212, 168, 90, 0.35)', glow:  'rgba(212, 168, 90, 0.30)',
    particle: { kind: 'dust', n: 26, color: '#b8945a', speed: 18 },
    narrative: '渊底·戊土之狱 — 浊气最厚处，沉重的泥沼压碎了一切反抗。'
  },
  {
    id: 'water',       element: '癸水', zoneName: '沉水·癸水之渊',
    waveStart: 6, waveEnd: 10,
    bg:     ['#0a1a2e', '#020611'],
    tint:   'rgba(30, 70, 120, 0.28)',
    vignette: 0.58,
    accent: '#6dc2ff', border: 'rgba(109, 194, 255, 0.35)', glow:  'rgba(109, 194, 255, 0.30)',
    particle: { kind: 'mist', n: 22, color: '#88b8d4', speed: 10 },
    narrative: '沉水·癸水之渊 — 黑水死寂，寒冰刺骨。谋士忘川陨落的最后一眼。'
  },
  {
    id: 'wood',        element: '乙木', zoneName: '枯林·乙木之冢',
    waveStart: 11, waveEnd: 15,
    bg:     ['#1a0e16', '#0a040a'],
    tint:   'rgba(90, 25, 70, 0.30)',
    vignette: 0.60,
    accent: '#ff8fae', border: 'rgba(255, 143, 174, 0.35)', glow:  'rgba(255, 143, 174, 0.30)',
    particle: { kind: 'spore', n: 30, color: '#d48a9a', speed: 22 },
    narrative: '枯林·乙木之冢 — 枯木成掠夺者，瘴气林吞噬尸骨。'
  },
  {
    id: 'fire',        element: '丙火', zoneName: '熔炉·丙火之劫',
    waveStart: 16, waveEnd: 20,
    bg:     ['#2a0a0a', '#0f0303'],
    tint:   'rgba(150, 40, 20, 0.32)',
    vignette: 0.62,
    accent: '#ff7a3d', border: 'rgba(255, 122, 61, 0.38)', glow:  'rgba(255, 122, 61, 0.30)',
    particle: { kind: 'ember', n: 28, color: '#ff8a3d', speed: 42 },
    narrative: '熔炉·丙火之劫 — 神枢失控，业火焚天。少女焚天的复仇执念。'
  },
  {
    id: 'metal',       element: '庚金', zoneName: '裂空·庚金之冢',
    waveStart: 21, waveEnd: 25,
    bg:     ['#1a1a22', '#05050a'],
    tint:   'rgba(120, 125, 145, 0.22)',
    vignette: 0.65,
    accent: '#d8e0ef', border: 'rgba(216, 224, 239, 0.35)', glow:  'rgba(216, 224, 239, 0.35)',
    particle: { kind: 'shard', n: 24, color: '#d8e0ef', speed: 34 },
    narrative: '裂空·庚金之冢 — 神枢核心，杀意化作无数悬浮利刃。'
  },
];

function getMapLayer(wave) {
  for (const L of MAP_LAYERS) {
    if (wave >= L.waveStart && wave <= L.waveEnd) return L;
  }
  return MAP_LAYERS[0];
}

// --- 大地图 + 摄像机 ---
const WORLD_W = 3200, WORLD_H = 2000;
let cam = { x: 0, y: 0 };

// ========== 🦶 人物“腿部切片”走路动画参数（俯视 128 战斗立绘版） ==========
// 对应 getPlayerSprite() 的 128×128 画布: 头/光环顶 ~ y=-56, 脚底鞋尖 ~ y=+56
// 髋线（躯干与腿分界）: y≈+18 (从顶 y=-64 起算, top-down 比例 HIP≈(18+64)/128≈0.64)
// 裆部分界（左右腿）: x=0 中线 → 左 50% / 右 50%

const earthMonsterSheet = { img: null, canvas: null, ready: false };
(function _loadEMS () {
  try {
    const img = new Image();
    earthMonsterSheet.img = img;
    img.onload = function () {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const id = g.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          if (a < 35) { d[i + 3] = 0; continue; }
          const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
          const sat = mx > 0 ? (mx - mn) / mx : 0;
          if (sat < 0.10 && mx > 0.40) { d[i + 3] = 0; continue; }            // 浅灰动作标签
          if (sat < 0.15 && mx < 0.16 && a < 205) { d[i + 3] = 0; continue; }  // 柔和地面阴影
        }
        g.putImageData(id, 0, 0);
        earthMonsterSheet.canvas = c;
        earthMonsterSheet.ready = true;
        // 图鉴若正打开在怪物页，素材异步加载完成后刷新一次
        try {
          if (typeof codexGrid !== 'undefined' && codexGrid && codexGrid.offsetParent &&
              typeof codexCurrentTab !== 'undefined' && codexCurrentTab === 'enemy') renderCodex();
        } catch (_) {}
      } catch (e) { earthMonsterSheet.ready = false; /* file:// 跨域时退化为兜底绘制 */ }
    };
    img.onerror = function () { earthMonsterSheet.ready = false; };
    img.src = 'assets/images/立绘/精灵图/土地图三怪.png';
  } catch (e) { earthMonsterSheet.ready = false; }
})();

// 帧锚点为连通域实测：x/w 为角色包围盒，行底对齐脚底；tops 为该行动作安全顶（避开标题标签）
const EM_DATA = {
  rock_golem: {   // 岩甲傀儡（土黄石甲熊）
    r: 21, scale: 0.70, dur: { walk: 0.095, idle: 0.17, atk: 0.13 },
    states: {
      walk: { bottom: 130, tops: [58, 58, 58, 45, 46, 44, 45],
              frames: [[249, 0, 50], [308, 0, 47], [354, 0, 50], [404, 0, 49], [454, 0, 50], [502, 0, 51], [556, 0, 49]] },
      idle: { bottom: 232, tops: [170, 170, 153, 154, 153, 153],
              frames: [[252, 0, 53], [318, 0, 51], [378, 0, 49], [433, 0, 49], [489, 0, 49], [544, 0, 49]] },
      atk:  { bottom: 430, tops: [360, 360, 360, 360, 360], // ROAR IDLE 行（咆哮/蓄力）
              frames: [[247, 0, 58], [320, 0, 53], [385, 0, 55], [451, 0, 56], [516, 0, 56]] },
    },
  },
  toxic_slime: {  // 泥沼史莱姆（亮绿毒液素材，着色为暗绿）
    r: 13, scale: 0.56, dur: { walk: 0.095, idle: 0.17, atk: 0.095 },
    states: {
      walk: { bottom: 548, tops: [488, 488, 488, 488, 488, 488, 488],
              frames: [[245, 0, 47], [301, 0, 47], [356, 0, 47], [405, 0, 46], [455, 0, 43], [501, 0, 45], [550, 0, 49]] },
      idle: { bottom: 640, tops: [586, 578, 573, 578, 577],
              frames: [[247, 0, 53], [311, 0, 51], [373, 0, 50], [434, 0, 53], [497, 0, 55]] },
      // 无独立攻击帧：接触时沿用 walk（果冻形变已体现受击）
      atk:  { bottom: 548, tops: [488, 488, 488, 488, 488, 488, 488],
              frames: [[245, 0, 47], [301, 0, 47], [356, 0, 47], [405, 0, 46], [455, 0, 43], [501, 0, 45], [550, 0, 49]] },
    },
  },
  magma_demon: {  // 地裂巨岩怪（黑岩巨人，橙红熔岩着色为暗黄裂缝）
    r: 28, scale: 0.82, dur: { walk: 0.11, idle: 0.18, atk: 0.18 },
    states: {
      walk: { bottom: 874, tops: [798, 798, 798, 796, 779, 779, 777],
              frames: [[246, 0, 60], [306, 0, 47], [357, 0, 44], [407, 0, 44], [458, 0, 48], [508, 0, 47], [555, 0, 49]] },
      idle: { bottom: 994, tops: [905, 905, 905, 898, 901],
              frames: [[246, 0, 57], [313, 0, 54], [377, 0, 55], [445, 0, 55], [519, 0, 57]] },
      atk:  { bottom: 880, tops: [790, 790, 790], // 右列 SMASH ATTACK 前三帧（砸击蓄力→落下）
              frames: [[647, 0, 57], [718, 0, 59], [787, 0, 85]] },
    },
  },
};
// 运行时着色：tox（亮绿→暗绿泥沼） / lava（橙红熔岩→暗黄裂缝）
const EM_TINT = {
  toxic_slime: { hue: 95,  sat: 0.58, light: 0.72, minL: 0.14 },
  magma_demon: { hue: 42,  sat: 0.92, light: 0.72, minL: 0.22 },
};
(function _buildEMRects () {
  for (const type in EM_DATA) {
    for (const sk in EM_DATA[type].states) {
      const st = EM_DATA[type].states[sk];
      const fr = st.frames;
      st.rects = fr.map((f, i) => {
        const L = i === 0 ? f[0] - 10 : Math.floor((fr[i - 1][0] + fr[i - 1][2] + f[0]) / 2);
        const R = i === fr.length - 1 ? f[0] + f[2] + 10 : Math.ceil((f[0] + f[2] + fr[i + 1][0]) / 2);
        return { x: L, y: st.tops[i], w: R - L, h: st.bottom - st.tops[i] };
      });
    }
  }
})();
const _emFrameCache = {};
function getEMFrame (type, state, idx, white) {
  const data = EM_DATA[type];
  const st = data.states[state] || data.states.idle || data.states.walk;
  const n = st.rects.length;
  idx = ((idx % n) + n) % n;
  const key = type + '#' + (st === data.states[state] ? state : 'idle') + '#' + idx + '#' + (white ? 'w' : 'n');
  if (_emFrameCache[key]) return _emFrameCache[key];
  const rc = st.rects[idx];
  const c = document.createElement('canvas');
  c.width = 200; c.height = 200;
  const g = c.getContext('2d');
  const feetY = 100 + data.r * 0.92;
  const s = data.scale;
  const cx = rc.x + rc.w / 2;
  const dx = 100 - (cx - rc.x) * s, dy = feetY - rc.h * s;
  g.drawImage(earthMonsterSheet.canvas, rc.x, rc.y, rc.w, rc.h, dx, dy, rc.w * s, rc.h * s);
  const tint = EM_TINT[type];
  if (!white && tint) {
    try {
      const tinted = g.getImageData(0, 0, 200, 200);
      const dd = tinted.data;
    for (let i = 0; i < dd.length; i += 4) {
      const a = dd[i + 3];
      if (a < 8) continue;
      const r = dd[i] / 255, gg = dd[i + 1] / 255, b = dd[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      if (sat < 0.20) continue;                       // 只改高饱和像素（毒液/熔岩），不动岩石
      let L = (mx + mn) * 0.5;
      L = tint.minL + L * tint.light;
      // HSL(目标色相) → RGB
      const C = (1 - Math.abs(2 * L - 1)) * tint.sat;
      const hp = tint.hue / 60, X = C * (1 - Math.abs(hp % 2 - 1));
      let rr = 0, rgg = 0, bb = 0;
      if (hp < 1) { rr = C; rgg = X; } else if (hp < 2) { rr = X; rgg = C; }
      else if (hp < 3) { rgg = C; bb = X; } else if (hp < 4) { rgg = X; bb = C; }
      else if (hp < 5) { rr = X; bb = C; } else { rr = C; bb = X; }
      const m = L - C / 2;
      dd[i] = (rr + m) * 255; dd[i + 1] = (rgg + m) * 255; dd[i + 2] = (bb + m) * 255;
    }
    g.putImageData(tinted, 0, 0);
    } catch (e) { /* getImageData 安全限制时跳过着色 */ }
  }
  if (white) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 200, 200);
    g.globalCompositeOperation = 'source-over';
  }
  _emFrameCache[key] = c;
  return c;
}
// 泥沼黏液痕迹 & 地裂震击预警区（全局对象，主循环更新/绘制）
let mireTrails = [];
let earthQuakes = [];
function updateMireTrails (dt) {
  for (const t of mireTrails) t.t += dt;
  mireTrails = mireTrails.filter(t => t.t < t.life);
  if (mireTrails.length > 70) mireTrails.splice(0, mireTrails.length - 70);
}
function updateEarthQuakes (dt) {
  for (let i = earthQuakes.length - 1; i >= 0; i--) {
    const q = earthQuakes[i];
    q.t += dt;
    if (!q.hit && q.t >= q.warn) {
      q.hit = true; q.t = q.warn;
      if (player && !player.dead && dist2(q.x, q.y, player.x, player.y) < (q.r + player.r) * (q.r + player.r)) {
        player.damage(q.dmg);
      }
      for (let k = 0; k < 16; k++) {
        const a = Math.random() * TAU, rr = Math.random() * q.r;
        const pt = new Particle(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr,
          Math.random() < 0.4 ? '#e8b63a' : '#8a6a4a');
        pt.vx = Math.cos(a) * (40 + Math.random() * 60);
        pt.vy = -(60 + Math.random() * 90);
        pt.life = pt.max = 0.5 + Math.random() * 0.4;
        pt.r = 3 + Math.random() * 4;
        addParticle(pt);
      }
      spawnFloat(q.x, q.y - 10, '地裂', '#e8b63a');
    }
    if (q.t > q.warn + 0.55) earthQuakes.splice(i, 1);
  }
}
function drawMireTrails () {
  for (const t of mireTrails) {
    const k = t.t / t.life;
    const a = 0.30 * (1 - k);
    if (a <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#3d5a23';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, t.r * (1 + k * 0.35), t.r * 0.55 * (1 + k * 0.2), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a7d33';
    ctx.globalAlpha = a * 0.7;
    ctx.beginPath();
    ctx.ellipse(t.x - t.r * 0.2, t.y - t.r * 0.1, t.r * 0.45, t.r * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
function drawEarthQuakes () {
  for (const q of earthQuakes) {
    ctx.save();
    if (!q.hit) {
      const p = q.t / q.warn;
      const pulse = 0.55 + 0.35 * Math.sin(timeElapsed * 12 + q.x * 0.05);
      ctx.globalAlpha = (0.35 + 0.4 * p) * pulse;
      ctx.fillStyle = 'rgba(232,182,58,0.16)';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.5 + 0.5 * p), 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9 * pulse;
      ctx.strokeStyle = '#e8b63a';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // 龟裂纹理
      ctx.strokeStyle = 'rgba(110,80,40,0.8)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + q.x * 0.01;
        const r0 = q.r * 0.25 * p, r1 = q.r * (0.55 + 0.35 * ((i % 2) ? p : 1));
        ctx.beginPath();
        ctx.moveTo(q.x + Math.cos(a) * r0, q.y + Math.sin(a) * r0);
        ctx.lineTo(q.x + Math.cos(a + 0.18) * r1 * 0.6, q.y + Math.sin(a + 0.18) * r1 * 0.6);
        ctx.lineTo(q.x + Math.cos(a - 0.12) * r1, q.y + Math.sin(a - 0.12) * r1);
        ctx.stroke();
      }
    } else {
      const k = (q.t - q.warn) / 0.55;
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.fillStyle = 'rgba(232,182,58,0.35)';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + k * 0.35), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

const ENEMY_VIS = {
  slime:   { r: 12, shape: 'circle', color1: '#76d275', color2: '#338a3e' },
  runner:  { r: 9,  shape: 'circle', color1: '#ff80a8', color2: '#c23d6c' },
  tank:    { r: 22, shape: 'round',  color1: '#b39ddb', color2: '#5e35b2' },
  boss:     { r: 46, shape: 'round',  color1: '#ffab40', color2: '#e64a19', boss: true },
  boss_mini:{ r: 32, shape: 'round',  color1: '#ffd180', color2: '#ff6d00', boss: true },
  boss2:   { r: 50, shape: 'round',  color1: '#ff5252', color2: '#b71c1c', boss: true },
  boss3:   { r: 56, shape: 'round',  color1: '#7c4dff', color2: '#311b92', boss: true },
  // ——— v3 新兵种 ———
  shooter: { r: 11, shape: 'round',  color1: '#81d4fa', color2: '#0277bd' }, // 远程射手：远距离发射子弹
  healer:  { r: 13, shape: 'circle', color1: '#b9f6ca', color2: '#00c853' }, // 治疗者：定期为周围敌人回血
  bomber:  { r: 13, shape: 'circle', color1: '#ffd180', color2: '#ff6d00' }, // 自爆者：接触玩家爆炸AOE
  elite:   { r: 17, shape: 'round',  color1: '#ea80fc', color2: '#9c27b0' }, // 精英：高血量高速带护盾光环
  splitter:{ r: 18, shape: 'round',  color1: '#ff8a80', color2: '#b71c1c' }, // 分裂者：死亡分裂为两个 runner
  ox_armored:{ r: 38, shape: 'round', color1: '#d8b56b', color2: '#6b5226', boss: true }, // ☯ 重甲土牛：五行机制 Boss（高甲弱火）
  // ——— 🪨 土地图专属（精灵表） ———
  rock_golem: { r: 21, shape: 'round', color1: '#b08d57', color2: '#6b5226' }, // 岩甲傀儡：高血厚甲、缓慢滑行、阻挡
  toxic_slime:{ r: 13, shape: 'circle', color1: '#9ed36a', color2: '#3f7a2e' }, // 泥沼史莱姆：接触黏滞减速、留黏液痕
  magma_demon:{ r: 28, shape: 'round', color1: '#8a6a4a', color2: '#2e2118' },  // 地裂巨岩怪：投石远程+地裂预警AOE
};
const ENEMY_STATS = {
  slime:    d => ({ hp: (15 + 13 * d + 200 * d * d) / 3 * 2,      speed: 42 + 10 * d,  damage: 8,  reward: 1 }),
  runner:   d => ({ hp: (10 + 8 * d + 100 * d * d) / 3 * 2,       speed: 95 + 20 * d,  damage: 6,  reward: 1 }),
  tank:     d => ({ hp: (100 + 90 * d + 1500 * d * d) / 3 * 2,    speed: 28 + 6 * d,   damage: 18, reward: 5 }),
  boss:     d => ({ hp: (800 + 900 * d + 10000 * d * d) * 2.0,  speed: 42 + 9 * d, damage: 30, reward: 120 }),
  boss_mini:d => ({ hp: (300 + 400 * d + 4000 * d * d) * 1.5,  speed: 50 + 10 * d, damage: 18, reward: 60 }),
  boss2:    d => ({ hp: (3000 + 3500 * d + 40000 * d * d) * 2.5, speed: 48 + 10 * d, damage: 35, reward: 180, shootCd: 2.5, dashCd: 8 }),
  boss3:    d => ({ hp: (6000 + 7000 * d + 80000 * d * d) * 2.5, speed: 38 + 8 * d, damage: 40, reward: 260, shootCd: 1.8, barrageCd: 6, dashCd: 10 }),
  // ——— v3 新兵种数值 ———
  shooter:  d => ({ hp: (18 + 12 * d + 150 * d * d) / 3 * 2,      speed: 40 + 7 * d,   damage: 6,  reward: 2, shootCd: 1.8, shootRange: 360, bulletSpd: 200 }),
  healer:   d => ({ hp: (50 + 33 * d + 500 * d * d) / 3 * 2,      speed: 32 + 6 * d,   damage: 5,  reward: 4, healCd: 2.0, healRange: 140, healPct: 0.08 }),
  bomber:   d => ({ hp: (22 + 15 * d + 200 * d * d) / 3 * 2,      speed: 80 + 14 * d,  damage: 28, reward: 2, boomRadius: 80 }),
  elite:    d => ({ hp: (220 + 180 * d + 3000 * d * d) / 3 * 2,   speed: 62 + 13 * d,  damage: 20, reward: 10 }),
  splitter: d => ({ hp: (67 + 50 * d + 750 * d * d) / 3 * 2,      speed: 38 + 7 * d,   damage: 14, reward: 4 }),
  ox_armored: d => { const _o = GAME_CONFIG.tunables.ox; return { hp: (_o.hpBase + _o.hpPerDiff * d + _o.hpDiffSq * d * d), speed: _o.speedBase + _o.speedPerDiff * d, damage: _o.damage, reward: _o.reward, armor: _o.armor }; },
  // ——— 🪨 土地图专属数值 ———
  rock_golem:  d => ({ hp: (120 + 100 * d + 1700 * d * d) / 3 * 2,   speed: 24 + 5 * d,  damage: 16, reward: 5, armor: 0.3 }), // 高血+护甲(30%减伤比例)+慢速
  toxic_slime: d => ({ hp: (16 + 12 * d + 190 * d * d) / 3 * 2,      speed: 40 + 8 * d,  damage: 8,  reward: 1 }),             // 接触减速
  magma_demon: d => ({ hp: (170 + 150 * d + 2400 * d * d) / 3 * 2,   speed: 30 + 5 * d,  damage: 14, reward: 10, shootCd: 2.4, shootRange: 380, bulletSpd: 250, quakeCd: 6.5 }),
};
class Enemy {
  constructor(type, x, y, difficulty) {
    this.type = type;
    this.x = x; this.y = y;
    this.hitFlash = 0;
    this.dead = false;
    this.kb = 0;
    this.kbx = 0; this.kby = 0;
    // —— 新三职业辅助：eid + 中毒 + 减速 + vx/vy（拉扯/击退用）——
    this.eid = ++Enemy._idCounter;
    this.poisonStacks = [];
    this.burn = null;   // 🔥 灼烧（炽烈怒焰火焰斩击）：{ dps, remain }
    this._slow = 0; this._slowT = 0;
    this.vx = 0; this.vy = 0;
    this._poisonKillReady = false;

    const v = ENEMY_VIS[type];
    const s = ENEMY_STATS[type](difficulty);
    this.r = v.r;
    this.hp = s.hp * curDiff.hpMul;
    // 阶段移速加成：阶段3+10%，阶段4+20%，阶段5+25%
    let phaseSpdMul = 1.0;
    if (curWaveNum >= 6 && curWaveNum <= 10) phaseSpdMul = 1.10;
    else if (curWaveNum >= 11 && curWaveNum <= 13) phaseSpdMul = 1.20;
    else if (curWaveNum >= 14) phaseSpdMul = 1.25;
    this.speed = s.speed * phaseSpdMul;
    this.damage = Math.round(s.damage * curDiff.dmgMul);
    this.reward = s.reward;
    this.color1 = v.color1; this.color2 = v.color2;
    this.isBoss = !!v.boss;
    this.maxHp = this.hp;
    this.xpValue = 1; // 固定经验机制：每只怪物无论类型/波次/难度固定掉落 1 点经验
    this.armor = (s.armor || 0);
    // 新兵种专属字段
    this.shootCd = s.shootCd ? 0.8 + Math.random() : 0;
    this.healCd  = s.healCd  ? 1.0 + Math.random() : 0;
    this.quakeCd = s.quakeCd ? 1.2 + Math.random() * 2.2 : 0; // 🪨 地裂巨岩怪
    this._cfg = s;
    // 🪨 精灵表怪物动画状态
    this._emIs = !!(typeof EM_DATA !== 'undefined' && EM_DATA[type]);
    this._emAnimT = Math.random() * 0.3;
    this._emState = 'walk';
    this._emFace = 1;
    this._emAtkT = 0;
    this._emMove = 0;
    this._emPpx = x; this._emPpy = y;
    this.hasSplit = false;
    // BOSS 技能状态
    this._bossDashCd = s.dashCd || 0;
    this._bossDashTimer = 0;
    this._bossDashCharging = false;
    this._bossDashDirX = 0;
    this._bossDashDirY = 0;
    this._bossBarrageCd = s.barrageCd || 0;
    this._bossShootCd2 = s.shootCd ? 1.5 : 0;
  }
  update(dt, player) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    // —— 毒 DoT：每帧结算，独立 tick（死亡标记 poisonKillReady）——
    if (this.poisonStacks && this.poisonStacks.length) {
      let stillPoison = false;
      let totalPoisonDmg = 0;
      for (let i = this.poisonStacks.length - 1; i >= 0; i--) {
        const s = this.poisonStacks[i];
        s.remain -= dt;
        if (s.remain <= 0) { this.poisonStacks.splice(i, 1); continue; }
        totalPoisonDmg += s.dps * dt;
        stillPoison = true;
      }
      if (totalPoisonDmg > 0) {
        // 毒伤害绕过 hitFlash / 不会触发 knockback，并用 true 标记
        this.hp -= totalPoisonDmg;
        this._poisonKillReady = true;
        if (this.hp <= 0) { this.dead = true; return; }
      }
      // —— poisonExplode：毒素≥N 层时一次性引爆 ——
      if (player && player.poisonExplodeTrigger && this.poisonStacks.length >= player.poisonExplodeTrigger) {
        let total = 0;
        for (const s of this.poisonStacks) total += s.dps * s.remain;
        const burst = total * 1.5;
        this.hp -= burst;
        spawnFloat(this.x, this.y - this.r, `毒爆 -${Math.round(burst)}`, '#b986e5');
        this.poisonStacks = [];
        if (this.hp <= 0) { this.dead = true; return; }
      }
    } else {
      this._poisonKillReady = false;
    }
    // —— 🔥 灼烧 DoT（炽烈怒焰火焰斩击）：单层，绕过 hitFlash/击退 ——
    if (this.burn) {
      this.burn.remain -= dt;
      if (this.burn.remain <= 0) {
        this.burn = null;
      } else {
        this.hp -= this.burn.dps * dt;
        this._burnFxT = (this._burnFxT || 0) + dt;
        if (this._burnFxT >= 0.35) {
          this._burnFxT = 0;
          spawnFloat(this.x + rand(-6, 6), this.y - this.r * 0.5, '🔥', '#ff7043');
        }
        if (this.hp <= 0) { this.dead = true; return; }
      }
    }
    // —— 🩸 流血 DoT（风刃切割 / 刃舞）：单层，绕过 hitFlash/击退 ——
    if (this.bleed) {
      this.bleed.remain -= dt;
      if (this.bleed.remain <= 0) {
        this.bleed = null;
      } else {
        this.hp -= this.bleed.dps * dt;
        this._bleedFxT = (this._bleedFxT || 0) + dt;
        if (this._bleedFxT >= 0.4) {
          this._bleedFxT = 0;
          spawnFloat(this.x + rand(-6, 6), this.y - this.r * 0.5, '🩸', '#e53935');
        }
        if (this.hp <= 0) { this.dead = true; return; }
      }
    }
    // —— 🛡️ 裂甲斩：减甲层数计时 ——
    if (this._sunder) {
      this._sunder.t -= dt;
      if (this._sunder.t <= 0) this._sunder = null;
    }
    // —— 🤫 沉默计时（寂静之殇：禁止远程攻击）——
    if (this._silenced > 0) this._silenced -= dt;
    // —— 减速衰减 ——
    if (this._slowT > 0) { this._slowT -= dt; if (this._slowT <= 0) this._slow = 0; }
    // —— 震晕 / 冻结：冻结移动 ——
    if (this._frozen > 0) { this._frozen -= dt; }
    if (this._freezeCd > 0) { this._freezeCd -= dt; }
    if (this._stun > 0) { this._stun -= dt; return; }
    const dx = player.x - this.x, dy = player.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const ndx = dx / len, ndy = dy / len;
    // 不同兵种的行为差异
    let mvX = ndx, mvY = ndy;
    if (this.type === 'shooter' || this.type === 'magma_demon') {
      // 远程射手：保持距离在 shootRange 附近；太远则靠近，太近则后退
      const sr = (this._cfg.shootRange || 360) - 40;
      if (len < sr - 60) { mvX = -ndx; mvY = -ndy; }          // 后退
      else if (len < sr + 20) { mvX = mvY = 0; }              // 停下射击
      // 侧向微移（避免原地扎堆）；巨岩怪更笨重，侧移减半
      const strafe = this.type === 'magma_demon' ? 0.15 : 0.3;
      mvX += -ndy * strafe; mvY += ndx * strafe;
    }
    const slowMul = this._slow > 0 ? Math.max(0.15, 1 - Math.min(0.85, this._slow)) : 1;
    this.x += mvX * this.speed * slowMul * dt;
    this.y += mvY * this.speed * slowMul * dt;
    // vx/vy 拉扯/击退/水炮推进速度（线性阻尼）
    if (this.vx || this.vy) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(0.02, dt); // 指数衰减约 1/e^3.9 ≈ 0.02^1s → ~2%
      this.vy *= Math.pow(0.02, dt);
      if (Math.abs(this.vx) < 1) this.vx = 0;
      if (Math.abs(this.vy) < 1) this.vy = 0;
    }
    if (this.kb > 0) {
      this.x += this.kbx * this.kb * dt;
      this.y += this.kby * this.kb * dt;
      this.kb -= dt * 4;
    }

    // ——— 射手：远程发射子弹（🤫 被沉默时禁止开火）———
    if ((this.type === 'shooter' || this.type === 'magma_demon') && !(this._silenced > 0)) {
      this.shootCd -= dt;
      if (this.shootCd <= 0 && len < (this._cfg.shootRange || 360)) {
        this.shootCd = this._cfg.shootCd || 1.8;
        const ang = Math.atan2(ndy, ndx);
        if (this.type === 'magma_demon') {
          // 🪨 巨岩怪：投掷岩石弹 + 播放砸击动作
          enemies.push(new EnemyBullet(this.x, this.y - this.r * 0.4, ang, this._cfg.bulletSpd || 250,
            Math.round(this.damage * curDiff.dmgMul), { kind: 'rock' }));
          this._emAtkT = 0.55;
        } else {
          enemies.push(new EnemyBullet(this.x, this.y, ang, this._cfg.bulletSpd || 260, Math.round(this.damage * curDiff.dmgMul)));
        }
      }
    }
    // ——— 🪨 地裂巨岩怪：周期性在玩家脚下制造地裂预警区（强制走位）———
    if (this.type === 'magma_demon' && !(this._silenced > 0)) {
      this.quakeCd -= dt;
      if (this.quakeCd <= 0 && len < 560 && earthQuakes.length < 5) {
        this.quakeCd = (this._cfg.quakeCd || 6.5) + Math.random() * 2;
        this._emAtkT = 0.65;
        earthQuakes.push({
          x: player.x + rand(-50, 50), y: player.y + rand(-50, 50),
          r: 72, t: 0, warn: 0.9,
          dmg: Math.round(this.damage * 0.85 * curDiff.dmgMul), hit: false,
        });
      }
    }
    // ——— 治疗者：为周围敌人回血（不含自己，不含同类治疗者） ———
    if (this.type === 'healer') {
      this.healCd -= dt;
      if (this.healCd <= 0) {
        this.healCd = this._cfg.healCd || 2.0;
        const hr = this._cfg.healRange || 140;
        const hpPct = this._cfg.healPct || 0.08;
        // #region debug-point E:healer-loop (O(N) per healer => O(N^2) total)
        let __ht0 = 0;
        try { __ht0 = performance.now(); } catch(_) {}
        // #endregion
        let __healed = 0;
        for (const o of enemies) {
          if (o === this || o.dead || o.type === 'healer') continue;
          if (dist2(this, o) <= hr * hr) {
            const heal = o.maxHp * hpPct;
            o.hp = Math.min(o.maxHp, o.hp + heal);
            spawnFloat(o.x + rand(-6, 6), o.y - o.r, `+${Math.round(heal)}`, '#b9f6ca');
            __healed++;
          }
        }
        // #region debug-point E:healer-loop-end
        try {
          const __hdt = performance.now() - __ht0;
          if (__hdt > 8 || enemies.length > 400) {
            const __dbg = window.__DBG__;
            if (__dbg) __dbg.push({hyp:'E',msg:'HEALER_SLOW: ms='+__hdt.toFixed(1)+' enemies='+enemies.length+' healed='+__healed});
          }
        } catch(_) {}
        // #endregion
      }
    }
    // ——— BOSS2（第10波）：蓄力突进 + 普攻（🤫 沉默时仅普攻被禁）———
    if (this.type === 'boss2') {
      if (!(this._silenced > 0)) this.shootCd -= dt;
      if (this.shootCd <= 0 && !(this._silenced > 0)) {
        this.shootCd = this._cfg.shootCd || 2.5;
        const ang = Math.atan2(ndy, ndx);
        // 三连发
        for (let k = -1; k <= 1; k++) {
          const a = ang + k * 0.2;
          enemies.push(new EnemyBullet(this.x, this.y, a, 220, Math.round(this.damage * 0.8 * curDiff.dmgMul)));
        }
      }
      // 蓄力突进
      if (this._bossDashCd > 0) {
        this._bossDashCd -= dt;
      } else if (!this._bossDashCharging) {
        // 开始蓄力
        this._bossDashCharging = true;
        this._bossDashTimer = 1.2; // 1.2秒蓄力
        this._bossDashDirX = ndx;
        this._bossDashDirY = ndy;
      }
      if (this._bossDashCharging) {
        this._bossDashTimer -= dt;
        if (this._bossDashTimer <= 0) {
          // 释放突进
          this.vx = this._bossDashDirX * 600;
          this.vy = this._bossDashDirY * 600;
          this._bossDashCharging = false;
          this._bossDashCd = this._cfg.dashCd || 8;
        }
      }
    }
    // ——— BOSS3（第15波）：弹幕攻击 + 蓄力突进（🤫 沉默时禁止弹幕）———
    if (this.type === 'boss3') {
      if (!(this._silenced > 0)) this.shootCd -= dt;
      if (this.shootCd <= 0 && !(this._silenced > 0)) {
        this.shootCd = this._cfg.shootCd || 1.8;
        const ang = Math.atan2(ndy, ndx);
        // 5 连发散射
        for (let k = -2; k <= 2; k++) {
          const a = ang + k * 0.15;
          enemies.push(new EnemyBullet(this.x, this.y, a, 240, Math.round(this.damage * 0.7 * curDiff.dmgMul)));
        }
      }
      // 弹幕：环形子弹（🤫 沉默时暂停倒计时）
      if (this._bossBarrageCd > 0) {
        if (!(this._silenced > 0)) this._bossBarrageCd -= dt;
      } else if (!(this._silenced > 0)) {
        this._bossBarrageCd = this._cfg.barrageCd || 6;
        const bulletCount = 16;
        for (let i = 0; i < bulletCount; i++) {
          const a = (i / bulletCount) * TAU;
          enemies.push(new EnemyBullet(this.x, this.y, a, 180, Math.round(this.damage * 0.6 * curDiff.dmgMul)));
        }
      }
      // 蓄力突进
      if (this._bossDashCd > 0) {
        this._bossDashCd -= dt;
      } else if (!this._bossDashCharging) {
        this._bossDashCharging = true;
        this._bossDashTimer = 1.5;
        this._bossDashDirX = ndx;
        this._bossDashDirY = ndy;
      }
      if (this._bossDashCharging) {
        this._bossDashTimer -= dt;
        if (this._bossDashTimer <= 0) {
          this.vx = this._bossDashDirX * 550;
          this.vy = this._bossDashDirY * 550;
          this._bossDashCharging = false;
          this._bossDashCd = this._cfg.dashCd || 10;
        }
      }
    }
    // ——— 自爆者：近距离接触玩家直接爆炸 ———
    if (this.type === 'bomber') {
      if (len < this.r + player.r + 8) {
        const br = (this._cfg.boomRadius || 80);
        if (dist2(this, player) <= br * br) {
          player.damage(this.damage);
        }
        // AOE 爆炸粒子
        for (let i = 0; i < 26; i++) addParticle(new Particle(this.x, this.y, '#ffd180', true));
        spawnFloat(this.x, this.y, 'BOOM!', '#ff6d00');
        this.dead = true;
        this.hp = 0;
        return;
      }
    }

    // 近战敌人接触伤害（自爆者已经在上面处理）
    if (this.type !== 'bomber' && this.type !== 'shooter' && this.type !== 'magma_demon') {
      if (dist2(this, player) < (this.r + player.r - 2) * (this.r + player.r - 2)) {
        player.damage(this.damage);
        // 🟢 泥沼史莱姆：接触黏滞，大幅减速玩家 1.1s
        if (this.type === 'toxic_slime') player.mireSlowT = Math.max(player.mireSlowT || 0, 1.1);
      }
    } else if (this.type === 'shooter' || this.type === 'magma_demon') {
      // 远程怪接触时也会造成小碰撞伤害（避免完全无敌）
      if (dist2(this, player) < (this.r + player.r - 2) * (this.r + player.r - 2)) {
        player.damage(Math.max(3, Math.round(this.damage * 0.5)));
      }
    }

    // ——— 🪨 精灵表怪物：动画状态机 + 朝向 + 黏液痕迹 ———
    if (this._emIs) {
      this._emAnimT += dt;
      if (this._emAtkT > 0) this._emAtkT -= dt;
      // 朝向玩家（素材均朝右）
      this._emFace = player.x >= this.x ? 1 : -1;
      // 实际移动速度（EMA 平滑，击退也算位移）
      const inst = Math.hypot(this.x - this._emPpx, this.y - this._emPpy) / Math.max(dt, 1e-4);
      this._emMove += (Math.min(inst, 400) - this._emMove) * Math.min(1, dt * 6);
      this._emPpx = this.x; this._emPpy = this.y;
      const touching = len < this.r + player.r + 14;
      let st = 'walk';
      if (this._frozen > 0 || this._stun > 0) st = 'idle';
      else if (this._emAtkT > 0) st = 'atk';
      else if (this.type !== 'magma_demon' && touching) st = 'atk';
      else if (this._emMove < 12) st = 'idle';
      this._emState = st;
      // 泥沼史莱姆移动时留下黏液痕迹
      if (this.type === 'toxic_slime' && st === 'walk' && Math.random() < dt * 5) {
        mireTrails.push({ x: this.x + rand(-3, 3), y: this.y + this.r * 0.55, r: this.r * 0.85, t: 0, life: 3.5 });
      }
    }
  }
  hurt(n, kbx = 0, kby = 0, opts) {
    opts = opts || {};
    // ☯ 水克火·融化：火攻命中冻结目标 → 无视护甲的真实伤害 + 额外倍率，命中后解冻（同一冻结不可重复白嫖）
    let melted = false;
    if (opts.element === 'fire' && this._frozen > 0 && typeof player !== 'undefined' && player && player.resWaterFire) {
      melted = true;
      opts = Object.assign({}, opts, { trueDmg: true, melt: true });
    }
    // ☯ 单点伤害管线：元素倍率 / 破甲 / 敌人护甲 / 真伤集中在此结算
    let dmg = dealDamage(this, n, opts);
    if (melted) { dmg *= GAME_CONFIG.tunables.meltMultiplier; }
    // ❄️ 冻结易伤：冻结敌人受到更多伤害
    if (this._frozen > 0) {
      let vuln = 0;
      if (player && player.waveFreezeVuln) vuln = Math.max(vuln, player.waveFreezeVuln);
      if (player && player.bossFreezeDmgBonus) vuln = Math.max(vuln, player.bossFreezeDmgBonus);
      if (player && player.waterFrostVuln) vuln = Math.max(vuln, player.waterFrostVuln);
      if (vuln > 0) dmg *= (1 + vuln);
    }
    // ——— 精英：有 25% 概率完全挡伤（体现"护盾光环"） ———
    if (this.type === 'elite' && Math.random() < 0.25) {
      spawnFloat(this.x + rand(-6, 6), this.y - this.r, '格挡!', '#ea80fc');
      return;
    }
    this.hp -= dmg;
    this.hitFlash = 0.08;
    if (melted) {
      this._frozen = 0; // 融化后立即解冻，避免对同一冻结重复触发
      spawnFloat(this.x, this.y - this.r - 10, '融化!', '#9fe8ff');
    }
    if (kbx || kby) { this.kbx = kbx; this.kby = kby; this.kb = 1.2; }
    if (this.hp <= 0) { this.dead = true; if (melted) this._meltKilled = true; }
  }
  draw() {
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + 2, this.r * 0.9, 3.5, 0, 0, TAU); ctx.fill();

    // ——— 精英：护盾光环 ———
    if (this.type === 'elite') {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 7, 0, TAU);
      ctx.strokeStyle = 'rgba(234,128,252,0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // ——— 治疗者：治疗光环（柔和脉动） ———
    if (this.type === 'healer') {
      const pulse = 1 + Math.sin(performance.now() / 280) * 0.08;
      ctx.beginPath(); ctx.arc(this.x, this.y, (this._cfg.healRange || 140) * 0.15 * pulse, 0, TAU);
      ctx.fillStyle = 'rgba(185, 246, 202, 0.12)';
      ctx.fill();
    }
    if (this._emIs && earthMonsterSheet.ready) {
      // 🪨 精灵表怪物：按动作状态机绘制当前帧（朝玩家翻转 + 受击形变）
      try {
        const data = EM_DATA[this.type];
        let st = this._emState || 'walk';
        if (!data.states[st]) st = 'walk';
        const n = data.states[st].rects.length;
        let fi;
        if (st === 'atk' && this._emAtkT > 0) {
          fi = Math.max(0, Math.min(n - 1, Math.floor((0.6 - this._emAtkT) / data.dur.atk)));
        } else {
          fi = Math.floor(this._emAnimT / data.dur[st]) % n;
        }
        const frame = getEMFrame(this.type, st, fi, this.hitFlash > 0);
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.type === 'magma_demon') {
          const pulse = 0.10 + 0.06 * Math.sin(timeElapsed * 5 + this.eid);
          const grd = ctx.createRadialGradient(0, -this.r * 0.35, 2, 0, -this.r * 0.35, this.r * 1.35);
          grd.addColorStop(0, 'rgba(232,182,58,' + (0.26 + pulse) + ')');
          grd.addColorStop(1, 'rgba(232,182,58,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(0, -this.r * 0.35, this.r * 1.35, 0, TAU); ctx.fill();
        }
        ctx.scale(this._emFace, 1);
        let sx = 1, sy = 1;
        const wf = Math.max(0, this.hitFlash);
        if (this.type === 'toxic_slime') {
          const j = Math.min(0.22, wf * 2.2);
          sx = 1 + j; sy = 1 - j * 0.8;
          if (st !== 'atk') {
            const b = Math.sin(timeElapsed * 4 + this.eid) * 0.045;
            sx *= 1 + b; sy *= 1 - b * 0.7;
          }
        } else {
          sx = 1 + Math.min(0.06, wf); sy = 1 - Math.min(0.05, wf);
        }
        ctx.scale(sx, sy);
        ctx.drawImage(frame, -100, -100);
        ctx.restore();
      } catch (e) {
        // 精灵帧渲染失败（如 canvas 安全策略）→ 退化为程序化精灵
        const spr = getEnemySprite(this.type, this.hitFlash > 0);
        ctx.drawImage(spr, this.x - spr.width / 2, this.y - spr.height / 2);
      }
    } else {
      const spr = getEnemySprite(this.type, this.hitFlash > 0);
      ctx.drawImage(spr, this.x - spr.width / 2, this.y - spr.height / 2);
    }
    // HP 条（Boss / 已受伤 / 土系精英怪：地裂巨岩怪·岩甲傀儡 常显，便于远程观测血量）
    const _barAlways = (this.type === 'magma_demon' || this.type === 'rock_golem');
    if (this.isBoss || _barAlways || this.hp < this.maxHp) {
      try {
        const w = this.r * 2.4;
        const x = this.x - w / 2, y = this.y - this.r - (this.isBoss ? 16 : 8);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - 1, y - 1, w + 2, this.isBoss ? 8 : 5);
        const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
        ctx.fillStyle = this.isBoss ? '#ff5252' : '#ff8a65';
        ctx.fillRect(x, y, w * pct, this.isBoss ? 6 : 3);
      } catch (_) {}
    }
    // ——— 中毒气泡（头顶绿色气泡飘动）———
    if (this.poisonStacks && this.poisonStacks.length) {
      const n = Math.min(this.poisonStacks.length, 4);
      for (let i = 0; i < n; i++) {
        const dx = (i - (n - 1) / 2) * 6;
        const dy = -this.r - 16 + Math.sin(timeElapsed * 3 + i * 1.4) * 2;
        ctx.fillStyle = 'rgba(120,230,120,0.8)';
        ctx.beginPath(); ctx.arc(this.x + dx, this.y + dy, 2.2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(this.x + dx - 0.7, this.y + dy - 0.7, 0.7, 0, TAU); ctx.fill();
      }
    }
    // ——— 🔥 灼烧视觉（头顶跳动的火焰）———
    if (this.burn) {
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * 6 + Math.sin(timeElapsed * 8 + i * 2.1) * 2;
        const dy = -this.r - 10 - Math.abs(Math.sin(timeElapsed * 9 + i * 1.7)) * 6;
        const fl = Math.max(1.3, 2.6 + Math.sin(timeElapsed * 12 + i * 2.4) * 0.9);
        ctx.fillStyle = i === 1 ? 'rgba(255,235,59,0.95)' : 'rgba(255,112,67,0.9)';
        ctx.shadowColor = '#ff5722'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(this.x + dx, this.y + dy, fl, 0, TAU); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    // ——— 减速视觉（脚底蓝圈，半透明）———
    if (this._slowT > 0 && !(this._frozen > 0)) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.45, this._slowT);
      ctx.strokeStyle = '#4bc8ff';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r - 2, this.r * 1.1, 4, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // ——— ❄️ 冻结视觉（冰晶覆盖 + 冰环 + 寒气粒子）———
    if (this._frozen > 0) {
      ctx.save();
      // 整体冰蓝色叠加
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#a0e0ff';
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillRect(this.x - this.r - 4, this.y - this.r - 4, this.r * 2 + 8, this.r * 2 + 8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      // 冰晶外壳（多边形冰壳）
      ctx.strokeStyle = 'rgba(180,230,255,0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const iceR = this.r + 5;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + timeElapsed * 0.3;
        const r = iceR + Math.sin(timeElapsed * 4 + i) * 2;
        const px = this.x + Math.cos(a) * r;
        const py = this.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      // 内部冰光
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 0.8);
      grad.addColorStop(0, 'rgba(200,240,255,0.3)');
      grad.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.8, 0, TAU); ctx.fill();
      // 冰晶闪烁（头顶小冰锥）
      const flicker = 0.7 + 0.3 * Math.sin(timeElapsed * 12);
      ctx.fillStyle = `rgba(220,245,255,${flicker})`;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.5;
        const px = this.x + Math.cos(a) * (this.r + 2);
        const py = this.y + Math.sin(a) * (this.r + 2);
        ctx.beginPath();
        ctx.moveTo(px, py - 5);
        ctx.lineTo(px - 3, py + 2);
        ctx.lineTo(px + 3, py + 2);
        ctx.closePath();
        ctx.fill();
      }
      // 寒气粒子（缓慢上升的小冰晶）
      for (let i = 0; i < 2; i++) {
        const py = this.y - this.r - 8 - ((timeElapsed * 30 + i * 20) % 24);
        const px = this.x + Math.sin(timeElapsed * 2 + i * 2.5) * (this.r * 0.6);
        const sz = 2 + Math.sin(timeElapsed * 5 + i) * 1;
        ctx.fillStyle = 'rgba(200,235,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(px, py - sz);
        ctx.lineTo(px - sz, py + sz * 0.5);
        ctx.lineTo(px + sz, py + sz * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
Enemy._idCounter = 0;

/* =============================================================
   敌人子弹（射手发射 —— 属于 enemies[] 数组，碰撞时伤害玩家）
   ============================================================= */
class EnemyBullet {
  constructor(x, y, angle, spd, dmg, opts) {
    this.type = 'eBullet';
    this._kind = (opts && opts.kind) || null;   // 'rock' = 巨岩怪投石
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.r = 5.5;
    this.damage = dmg;
    this.life = 2.2;           // 飞行寿命(秒)，配合 maxDist 双保险
    this.maxDist = 520;        // ⚠️ 最大飞行距离 → 远距离消失
    if (this._kind === 'rock') { this.r = 7.5; this.maxDist = 620; }
    this.traveled = 0;
    this._lx = x; this._ly = y;
    this.hitFlash = 0; this.dead = false;
    this.maxHp = 1; this.hp = 1;
    this.reward = 0; this.xpValue = 0;
    this.isBoss = false; this.hasSplit = false;
    // ⚠️ 子弹放进 enemies[] 共享死亡清理逻辑，但禁止像野怪那样"死了掉经验/金币/宝箱"
    this._dropped = true;
    // 尾巴轨迹（区分经验 vs 弹幕）
    this.trail = [];
  }
  update(dt, player) {
    this._lx = this.x; this._ly = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const dx = this.x - this._lx, dy = this.y - this._ly;
    this.traveled += Math.hypot(dx, dy);
    // 轨迹采样
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.pop();
    // 飞行限制：life 过期 或 距离超限 → 直接消失 + 自毁粒子（不变经验）
    this.life -= dt;
    if (this.life <= 0 || this.traveled >= this.maxDist) {
      this.dead = true;
      if (this._kind === 'rock') {
        for (let i = 0; i < 5; i++) addParticle(new Particle(this.x, this.y, i % 2 ? '#8a6a4a' : '#4a3520'));
      } else {
        for (let i = 0; i < 5; i++) addParticle(new Particle(this.x, this.y, i % 2 ? '#ff80ab' : '#c2185b'));
      }
      return;
    }
    if (player && dist2(this, player) < (this.r + player.r) * (this.r + player.r)) {
      player.damage(this.damage);
      this.dead = true;
      if (this._kind === 'rock') {
        for (let i = 0; i < 6; i++) addParticle(new Particle(this.x, this.y, i % 3 ? '#8a6a4a' : '#e8b63a'));
      } else {
        for (let i = 0; i < 6; i++) addParticle(new Particle(this.x, this.y, '#ff80ab'));
      }
    }
  }
  hurt() {}
  draw() {
    // ① 尾巴轨迹（半透明拖影 → 一眼区分于静态蓝宝石经验）
    const _rock = this._kind === 'rock';
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const a = 1 - i / this.trail.length;
      // ⚠️ 尾迹满 10 个采样时 i=9 → 系数 1-9*0.12=-0.08，负半径会让 ctx.arc 抛
      // IndexSizeError，进而中断整帧绘制（画面卡死）；半径收敛到非正后直接跳过该采样
      const _tr = this.r * (1 - i * 0.12);
      if (_tr <= 0.5) continue;
      ctx.beginPath();
      ctx.arc(t.x, t.y, _tr, 0, TAU);
      ctx.fillStyle = _rock ? `rgba(120, 90, 50, ${a * 0.35})` : `rgba(255, 80, 130, ${a * 0.35})`;
      ctx.fill();
    }
    const ang = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(ang);
    if (_rock) {
      // 🪨 岩石弹：不规则碎石块 + 暗黄裂纹微光
      ctx.shadowColor = 'rgba(232,182,58,0.7)'; ctx.shadowBlur = 10;
      ctx.beginPath();
      const rr = this.r * 1.5;
      ctx.moveTo(rr * 1.2, -rr * 0.2);
      ctx.lineTo(rr * 0.5, -rr * 0.95);
      ctx.lineTo(-rr * 0.7, -rr * 0.7);
      ctx.lineTo(-rr * 1.15, rr * 0.1);
      ctx.lineTo(-rr * 0.4, rr * 0.9);
      ctx.lineTo(rr * 0.7, rr * 0.75);
      ctx.closePath();
      ctx.fillStyle = '#8a6a4a';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4a3520'; ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(232,182,58,0.85)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-rr * 0.5, -rr * 0.2); ctx.lineTo(rr * 0.1, rr * 0.1); ctx.lineTo(rr * 0.7, -rr * 0.25);
      ctx.stroke();
    } else {
    // ② 主炮弹：锐利菱形（旋转对齐运动方向） + 粉/紫撞色 + 白芯
    ctx.shadowColor = '#ff4081'; ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(this.r * 2.6, 0);
    ctx.lineTo(0, this.r * 1.4);
    ctx.lineTo(-this.r * 1.8, 0);
    ctx.lineTo(0, -this.r * 1.4);
    ctx.closePath();
    const g = ctx.createLinearGradient(-this.r * 1.8, 0, this.r * 2.6, 0);
    g.addColorStop(0, '#7b1fa2');
    g.addColorStop(0.5, '#e91e63');
    g.addColorStop(1, '#ff80ab');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.stroke();
    // 白色尖芯
    ctx.beginPath();
    ctx.moveTo(this.r * 1.4, 0);
    ctx.lineTo(this.r * 0.3, this.r * 0.35);
    ctx.lineTo(this.r * 0.3, -this.r * 0.35);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    }
    ctx.restore();
  }
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* =============================================================
   经验水晶 / 宝箱 / 粒子 / 特效
   ============================================================= */
class XpOrb {
  constructor(x, y, v) {
    this.x = x; this.y = y; this.value = v;
    this.r = v >= 10 ? 7 : 4;
    this.vx = rand(-30, 30); this.vy = rand(-30, 30);
    this.dead = false;
    this.pulse = rand(0, TAU);
    this.magnetized = false;
    this.trail = [];
    this._pulling = false;
    this.pickupDelay = 0.5;
    this.landAnim = 0;
    this._landed = false;
  }
  update(dt, p, pullAll = false) {
    this._massPull = pullAll;
    this.vx *= 0.82; this.vy *= 0.82;
    if (this.pickupDelay > 0) this.pickupDelay -= dt;
    // 落地弹跳动画
    if (!this._landed) {
      this.landAnim += dt;
      if (this.landAnim >= 0.3) this._landed = true;
    }
    const canPickup = this.pickupDelay <= 0;
    const dx = p.x - this.x, dy = p.y - this.y;
    let d = Math.hypot(dx, dy);
    const pullRange = p.pickupRange * 4.2;
    this._pulling = canPickup && (pullAll || d < pullRange);
    if (this._pulling) {
      const pull = (pullAll ? 36400 : 27300) * (p.magnetSpeedMul || 1);
      const t = 1 - (pullAll ? 0 : d / pullRange);
      const coeff = pullAll ? 0.9 : (0.6 + t * 1.4);
      this.vx += (dx / (d || 1)) * pull * dt * coeff;
      this.vy += (dy / (d || 1)) * pull * dt * coeff;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.pulse += dt * 5;
    const vmag = Math.hypot(this.vx, this.vy);
    if (this._pulling && vmag > 50) {
      this.trail.unshift({ x: this.x, y: this.y, life: 1.0 });
      // 吸铁石全屏吸取时拖尾段数减半，降低渲染压力
      const maxTrail = pullAll ? 8 : 18;
      if (this.trail.length > maxTrail) this.trail.pop();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt * 4;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
    if (canPickup && d < 5) {
      this.x = p.x; this.y = p.y;
      this.vx = 0; this.vy = 0;
      this.dead = true;
      if (pullAll) {
        // 全屏吸取时批量收集，避免大量 addXp/spawnFloat 调用卡顿
        this._pendingCollect = this.value;
      } else {
        p.addXp(this.value);
        spawnFloat(this.x, this.y, `+${Math.ceil(this.value * p.expMul)}`, '#7afcff');
      }
    }
  }
  draw() {
    // 落地弹跳缩放动画
    let bounceScale = 1;
    if (!this._landed) {
      const t = this.landAnim / 0.3;
      bounceScale = 0.3 + 0.7 * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * 0.3;
    }
    if (this.trail.length > 1) {
      // 流星拖尾：炽白头部 → 金黄 → 橙红 → 暗红消散，带辉光
      const isBig = this.value >= 10;
      const baseR = isBig ? 7 : 4;
      // 全屏吸取时跳过 shadowBlur（最耗性能的 Canvas 操作），使用简化拖尾
      const useGlow = !this._massPull;
      ctx.save();
      for (let i = this.trail.length - 1; i > 0; i--) {
        const t1 = this.trail[i - 1];
        const t2 = this.trail[i];
        const lifeAvg = (t1.life + t2.life) * 0.5;
        if (lifeAvg <= 0) continue;
        const w = baseR * (0.1 + lifeAvg * 0.9);
        let r, g, b;
        if (lifeAvg > 0.66) { r = 255; g = 252; b = 230; }
        else if (lifeAvg > 0.33) { r = 255; g = 190; b = 80; }
        else { r = 230; g = 80; b = 30; }
        ctx.strokeStyle = `rgba(${r},${g},${b},${(lifeAvg * 0.8).toFixed(3)})`;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        if (useGlow) {
          ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
          ctx.shadowBlur = w * 1.5;
        }
        ctx.beginPath();
        ctx.moveTo(t2.x, t2.y);
        ctx.lineTo(t1.x, t1.y);
        ctx.stroke();
      }
      // 头部炽白光晕（流星核）—— 全屏吸取时跳过以节省性能
      if (useGlow && this.trail.length > 1) {
        const t0 = this.trail[0];
        const grad = ctx.createRadialGradient(t0.x, t0.y, 0, t0.x, t0.y, baseR * 3.5);
        grad.addColorStop(0, 'rgba(255,253,245,0.75)');
        grad.addColorStop(0.3, 'rgba(255,200,100,0.5)');
        grad.addColorStop(0.6, 'rgba(255,120,40,0.25)');
        grad.addColorStop(1, 'rgba(200,50,15,0)');
        ctx.shadowColor = 'rgba(255,200,100,0.9)';
        ctx.shadowBlur = baseR * 3;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(t0.x, t0.y, baseR * 3.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    const s = (1 + Math.sin(this.pulse) * 0.15) * bounceScale;
    const spr = getOrbSprite(this.value >= 10);
    const sz = spr.width * s;
    ctx.drawImage(spr, this.x - sz / 2, this.y - sz / 2, sz, sz);
  }
}

/* =============================================================
   吸铁石道具：击杀掉落概率，可吸取一次全屏经验
   ============================================================= */
class Magnet {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 14; this.dead = false;
    this.pulse = rand(0, TAU);
    this.life = 35;
    this.bob = 0;
    this.pickupDelay = 0.5;
    this.landAnim = 0;
    this._landed = false;
  }
  update(dt, p) {
    this.pulse += dt * 4;
    this.bob += dt;
    this.life -= dt;
    if (this.pickupDelay > 0) this.pickupDelay -= dt;
    if (!this._landed) { this.landAnim += dt; if (this.landAnim >= 0.3) this._landed = true; }
    if (this.life <= 0) { this.dead = true; return; }
    const canPickup = this.pickupDelay <= 0;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    if (canPickup && d < 240) {
      const pull = 1200;
      const t = 1 - d / 240;
      this.x += (dx / (d || 1)) * pull * dt * (0.5 + t * 1.1);
      this.y += (dy / (d || 1)) * pull * dt * (0.5 + t * 1.1);
    }
    if (canPickup && d < p.r + this.r) {
      this.dead = true;
      this._activate(p);
    }
  }
  _activate(p) {
    // 所有场上 orbs 直接吸附飞向玩家
    let total = 0;
    for (const o of orbs) {
      o.magnetized = true;
      total += o.value;
    }
    spawnFloat(this.x, this.y, '🧲 全屏吸取！', '#ff4081');
    spawnFloat(this.x, this.y - 20, `~${Math.ceil(total * (p.expMul || 1))} 经验`, '#7afcff');
    for (let i = 0; i < 40; i++) addParticle(new Particle(this.x, this.y, i % 2 ? '#7afcff' : '#ff4081'));
  }
  draw() {
    // 即将消失闪烁
    const a = this.life < 5 ? (0.4 + 0.6 * Math.abs(Math.sin(this.pulse * 2))) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y + Math.sin(this.bob * 2) * 3);
    // 外圈磁力波纹
    const rings = 3;
    for (let i = 0; i < rings; i++) {
      const pr = this.r + 6 + i * 5 + Math.sin(this.pulse + i) * 3;
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, TAU);
      ctx.strokeStyle = `rgba(255, 64, 129, ${0.22 - i * 0.06})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    const spr = cacheSprite('magnet_sprite', 52, g => {
      const cx = 26, cy = 26;
      // 背景光晕
      g.beginPath(); g.arc(cx, cy, 22, 0, TAU);
      g.fillStyle = 'rgba(255, 64, 129, 0.20)'; g.fill();
      // 马蹄铁形状：上宽下窄的 U 形（红=左 白=中 蓝=右）
      const w = 28, h = 28, th = 6, r = 6;
      const lx = cx - w / 2, ty = cy - h / 2;
      // 左块（红极）+ 右块（蓝极）+ 顶部连接杆
      g.fillStyle = '#e53935';
      roundRect(g, lx, ty, th, h - 6, 2); g.fill();
      g.fillStyle = '#1e88e5';
      roundRect(g, lx + w - th, ty, th, h - 6, 2); g.fill();
      // 顶部连接条
      g.fillStyle = '#cfd8dc';
      roundRect(g, lx, ty, w, th, 2); g.fill();
      // 描边
      g.strokeStyle = '#263238'; g.lineWidth = 1.2;
      roundRect(g, lx, ty, th, h - 6, 2); g.stroke();
      roundRect(g, lx + w - th, ty, th, h - 6, 2); g.stroke();
      roundRect(g, lx, ty, w, th, 2); g.stroke();
      // 极位字母 N / S
      g.fillStyle = '#fff'; g.font = 'bold 8px Consolas'; g.textAlign = 'center';
      g.fillText('N', lx + th / 2, ty + h - 9);
      g.fillText('S', lx + w - th / 2, ty + h - 9);
    });
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
  }
}

/* =============================================================
   BOSS 宝箱（BOSS 击败后掉落，拾取触发 3 选 1 超稀有强化）
   ============================================================= */
class Chest {
  constructor(x, y, isBoss = true) {
    this.x = x; this.y = y; this.r = 22; this.dead = false;
    this.pulse = 0;
    this.isBoss = isBoss;
  }
  update(dt, p) {
    this.pulse += dt * 3;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    // 宝箱远距离磁吸
    const pullRange = 200;
    if (d < pullRange) {
      const pull = 800;
      const t = 1 - d / pullRange;
      this.x += (dx / (d || 1)) * pull * dt * (0.4 + t * 1.0);
      this.y += (dy / (d || 1)) * pull * dt * (0.4 + t * 1.0);
    }
    if (d < p.r + this.r + 4) {
      this.dead = true;
      showChestUpgrade(this.isBoss);
    }
  }
  draw() {
    const bob = Math.sin(this.pulse) * 3;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    if (this.isBoss) {
      // —— BOSS 宝箱：金色华丽，更大，红金光环 ——
      const pulseR = 36 + Math.sin(this.pulse * 1.5) * 6;
      ctx.beginPath(); ctx.arc(0, 0, pulseR, 0, TAU);
      ctx.fillStyle = 'rgba(255,107,53,0.15)';
      ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, pulseR - 5, 0, TAU);
      ctx.fillStyle = 'rgba(255,209,102,0.22)';
      ctx.fill();
      const spr = cacheSprite('chest_boss_sprite', 60, g => {
        // 外框（深红木）
        g.fillStyle = '#5d2e1f';
        roundRect(g, -24, -16, 48, 30, 5); g.fill();
        // 盖子（金红）
        g.fillStyle = '#c62828';
        roundRect(g, -26, -25, 52, 14, 5); g.fill();
        // 金边
        g.strokeStyle = '#ffd166'; g.lineWidth = 2.5;
        roundRect(g, -24, -16, 48, 30, 5); g.stroke();
        g.strokeRect(-26, -12, 52, 2);
        // 金锁（带宝石）
        g.fillStyle = '#ffd166';
        roundRect(g, -6, -7, 12, 12, 2); g.fill();
        g.fillStyle = '#ff5252';
        ctx.beginPath(); ctx.arc(0, -1, 3, 0, Math.PI*2); ctx.fill();
        // 顶部皇冠装饰
        g.fillStyle = '#ffd166';
        g.beginPath();
        g.moveTo(-10, -25); g.lineTo(-7, -30); g.lineTo(-3, -26);
        g.lineTo(0, -31); g.lineTo(3, -26); g.lineTo(7, -30);
        g.lineTo(10, -25); g.closePath(); g.fill();
      });
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    } else {
      // —— 怪物宝箱：蓝银朴素，较小 ——
      const pulseR = 26 + Math.sin(this.pulse * 1.5) * 4;
      ctx.beginPath(); ctx.arc(0, 0, pulseR, 0, TAU);
      ctx.fillStyle = 'rgba(82,233,255,0.10)';
      ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, pulseR - 3, 0, TAU);
      ctx.fillStyle = 'rgba(130,170,255,0.16)';
      ctx.fill();
      const spr = cacheSprite('chest_normal_sprite', 46, g => {
        // 外框（深蓝灰）
        g.fillStyle = '#37474f';
        roundRect(g, -17, -12, 34, 22, 4); g.fill();
        // 盖子（钢蓝）
        g.fillStyle = '#546e7a';
        roundRect(g, -19, -19, 38, 10, 4); g.fill();
        // 银边
        g.strokeStyle = '#82e9ff'; g.lineWidth = 1.5;
        roundRect(g, -17, -12, 34, 22, 4); g.stroke();
        g.strokeRect(-19, -9, 38, 1.5);
        // 银锁
        g.fillStyle = '#82e9ff';
        roundRect(g, -4, -5, 8, 8, 2); g.fill();
        g.fillStyle = '#4fc3f7';
        g.fillRect(-1, -3, 2, 4);
      });
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    }
    ctx.restore();
  }
}

class FloatText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.life = 0.8; this.max = 0.8;
    this.dead = false;
    this.vy = -40;
  }
  update(dt) {
    this.life -= dt;
    this.y += this.vy * dt;
    this.vy *= 0.96;
    if (this.life <= 0) this.dead = true;
  }
  draw() {
    const a = Math.max(0, this.life / this.max);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

function spawnFloat(x, y, text, color) {
  if (!floats || floats.length >= 160) return;
  floats.push(new FloatText(x, y, text, color));
}

class Particle {
  constructor(x, y, color, big = false) {
    this.x = x; this.y = y;
    const a = rand(0, TAU);
    const s = rand(big ? 80 : 40, big ? 260 : 150);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.life = rand(big ? 0.5 : 0.25, big ? 1.0 : 0.55);
    this.max = this.life;
    this.color = color;
    this.r = rand(big ? 2 : 1, big ? 5 : 3);
    this.dead = false;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    if (this.life <= 0) this.dead = true;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function addParticle(p) { if (particles.length < 400) particles.push(p); }

/* =============================================================
   全局状态 & 生成控制
   ============================================================= */

function resetGame(classId, diffId) {
  curDiff = DIFFS.find(d => d.id === diffId) || DIFFS[0];
  // 全征程模式：始终跑完 25 波，区域视觉随波次自动切换
  const _zoneIdx = _pendingStartZone || 1;
  const _zoneL  = MAP_LAYERS[Math.min(4, Math.max(0, _zoneIdx - 1))];
  _runStartWave = 1;
  _runWaveEnd   = TOTAL_WAVES;
  const _runLen = _runWaveEnd - _runStartWave + 1;
  player = new Player(classId || selectedClassId);
  applyAltarToPlayer(player); // ☯ 祭坛永久养成开局生效
  bullets = []; enemies = []; orbs = []; floats = []; particles = []; slashFx = []; novaFx = []; orbExplosionFx = []; chests = []; magnets = [];
  thornZones = []; plantsArr = []; waves = []; swordRains = []; swordTrails = []; bubbleSplashFx = []; frostZones = []; waterTornadoes = [];
  scorchedEarth = []; earthSpikes = []; windBlades = []; windTornadoes = []; windVortexes = []; windChainFx = []; slashJudgmentFx = []; ultimateLava = null; karmaFlash = 0;
  mireTrails = []; earthQuakes = [];   // 🪨 土地图怪物地面特效
  ultimateForest = null; ultimateSwordDomain = null; ultimateWater = null;
  timeElapsed = 0; killCount = 0; pendingLevelUps = 0; runCoins = 0;
  // bossTimer 用 zone 内的第一个 BOSS 波相对于 _runStartWave 的偏移
  const _firstBossOffset = [...BOSS_WAVES].find(b => b >= _runStartWave && b <= _runWaveEnd);
  spawnTimer = 0; bossTimer = _firstBossOffset ? 0 : WAVE_SECONDS * 5;
  oxNextAt = GAME_CONFIG.tunables.ox.firstAt;
  pendingWaveBoss = null;
  _lastProcessedWave = 0;
  _finalBossSpawned = false;
  waveHintText = `第 1 / ${_runLen} 波 来袭！`; waveHintTime = 2.0;
  waveHintText2 = ''; waveHintText2Time = 0;
  hudAcc = 0;
  curWaveNum = _runStartWave;
  cam.x = player.x - W / 2;
  cam.y = player.y - H / 2;
  // HUD 显示当前出战职业
  const cls = getClass(player.classId);
  const subEl = document.querySelector('#infoLeft .sub');
  if (subEl && cls) subEl.textContent = `${cls.icon} ${cls.name}`;
  const coinHud = document.getElementById('coinHud');
  if(typeof updateStoneHud==='function'){ _stoneHudSig=''; updateStoneHud(); }
  if(typeof checkResonances==='function'){ try{ checkResonances(player); }catch(_){} }
  if (coinHud) coinHud.textContent = '💰 0';
  const wpBar = document.getElementById('waveProgressBar');
  if (wpBar) wpBar.style.display = '';
  updateWaveProgress(true);
}

// 安全方向弧：每 3 秒重新随机一个 90° 安全区方向，怪物不在该方向刷出
let _safeAngle = Math.random() * TAU;
let _safeAngleTimer = 0;

function spawnEnemyAtEdge(type, difficulty) {
  // 在玩家周围 270° 弧形区域边缘刷怪，留出 90° 安全区供移动
  const m = 80;
  const safeHalf = Math.PI * 0.25; // 安全区半角 45°
  const rx = W * 0.55 + m;
  const ry = H * 0.55 + m;
  let ang = 0, x = 0, y = 0;
  let attempts = 0;
  while (attempts < 10) {
    ang = Math.random() * TAU;
    // 避开安全区
    let da = Math.abs(ang - _safeAngle);
    if (da > Math.PI) da = TAU - da;
    if (da <= safeHalf) { attempts++; continue; }
    x = player.x + Math.cos(ang) * rx;
    y = player.y + Math.sin(ang) * ry;
    // 检查与现有怪物的距离，避免抱团重叠
    let tooClose = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const ddx = e.x - x, ddy = e.y - y;
      if (ddx * ddx + ddy * ddy < 55 * 55) { tooClose = true; break; }
    }
    if (!tooClose) break;
    attempts++;
  }
  enemies.push(new Enemy(type, x, y, difficulty));
}

function pickEnemyType(difficulty) {
  const r = Math.random();
  // 六阶段怪物配置（对齐 25 波节奏设计，首领波 5/10/15/20/25）
  // 阶段1 破冰期(波1-2): 基础近战为主，密度极低
  // 阶段2 割草期(波3-5): 密度翻倍，引入少量远程（波5戊土首领）
  // 阶段3 拐点期(波6-10): 精英/特殊比例上升，移速增加（波10熔岩幼体）
  // 阶段4 施压期(波11-15): 怪海战术，远程弹幕+近战夹击（波15烈焰冲锋者）
  // 阶段5 高压期(波16-20): 最高压力，精英+坦克群（波20虚空毁灭者）
  // 阶段6 决战期(波21-25): 大幅减少小怪，专注终Boss战
  const w = curWaveNum;
  const pool = [];
  const p = (type, weight) => pool.push([type, weight]);

  // === 阶段1：波1-2 破冰期（🪨 渊底·戊土之狱：泥沼史莱姆 / 岩甲傀儡） ===
  if (w === 1) {
    p('toxic_slime', 100);
  }
  else if (w === 2) {
    p('toxic_slime', 72);
    p('rock_golem', 20);
  }
  // === 阶段2：波3-5 割草期（岩甲傀儡成势，波4起地裂巨岩怪投石+地裂） ===
  else if (w === 3) {
    p('toxic_slime', 56);
    p('rock_golem',  30);
  }
  else if (w === 4) {
    p('toxic_slime', 46);
    p('rock_golem',  34);
    p('magma_demon',  7);
  }
  else if (w === 5) {
    p('toxic_slime', 36);
    p('rock_golem',  40);
    p('magma_demon', 14);
  }
  // === 阶段3：波6-10 拐点期（精英/特殊比例上升） ===
  else if (w <= 10) {
    p('slime',    20);
    p('tank',     22);
    p('bomber',   18);
    p('shooter',  6);
    p('healer',   5);
    p('splitter', 15);
    p('elite',    10);
  }
  // === 阶段4：波11-15 极限施压期（怪海+弹幕夹击，波15烈焰冲锋者） ===
  else if (w <= 15) {
    p('tank',     20);
    p('bomber',   20);
    p('shooter',  12);
    p('healer',   6);
    p('splitter', 18);
    p('elite',    18);
  }
  // === 阶段5：波16-20 高压期（最高压力，精英+坦克群，波20虚空毁灭者） ===
  else if (w <= 20) {
    p('tank',     22);
    p('bomber',   22);
    p('shooter',  14);
    p('healer',   6);
    p('splitter', 18);
    p('elite',    20);
  }
  // === 阶段6：波21-25 关底决战期（小怪大幅减少，专注终Boss） ===
  else {
    p('elite',    8);
    p('shooter',  4);
    p('bomber',   6);
  }

  let total = 0;
  for (const x of pool) total += x[1];
  let roll = r * total;
  for (const x of pool) {
    roll -= x[1];
    if (roll <= 0) return x[0];
  }
  return pool[0][0];
}

function getCurrentWave() {
  const rel = Math.floor(timeElapsed / WAVE_SECONDS); // 0..runLen-1
  const w = _runStartWave + Math.min(_runWaveEnd - _runStartWave, rel);
  return w;
}
function waveTimeProgress() {
  const inWave = timeElapsed % WAVE_SECONDS;
  return clamp(inWave / WAVE_SECONDS, 0, 1);
}
function updateWaveProgress(force=false) {
  const titleEl = document.getElementById('wpTitle');
  const fillEl = document.getElementById('wpFill');
  if (!titleEl || !fillEl) return;
  const w = getCurrentWave();
  curWaveNum = w;
  const prog = waveTimeProgress();
  const inBossWave = BOSS_WAVES.has(w);
  const remain = WAVE_SECONDS - (timeElapsed % WAVE_SECONDS);
  const _runLen = _runWaveEnd - _runStartWave + 1;
  const _localW = w - _runStartWave + 1;
  const timeTag = inBossWave ? '（BOSS 波）' : `　·　下一波 ${fmtTime(Math.max(1, Math.ceil(remain)))}`;
  titleEl.textContent = `波次进度 — 第 ${_localW} / ${_runLen} 波 ${timeTag}`;
  fillEl.style.width = (prog * 100).toFixed(1) + '%';
  // BOSS 波变色
  fillEl.style.background = inBossWave
    ? 'linear-gradient(90deg, #ff5252, #ffd166)'
    : 'linear-gradient(90deg, #ff8a5b, #ffe082)';
}

// 有限波次最后一波结束 → 胜利（Phase-1: 用 _runWaveEnd 代替 TOTAL_WAVES）
function checkWaveVictory() {
  // 🏆 胜利 = 终极波 BOSS 已生成 + 场上所有敌人（含 BOSS/小怪/精英）全部清空
  // 不再以"到达波末+时间"直接判胜：必须亲手打完所有怪物才算通关
  if (_finalBossSpawned && !pendingWaveBoss) {
    const anyAlive = enemies.some(e => !e.dead && e.type !== 'eBullet');
    if (!anyAlive) triggerGameOver(true);
  }
}

let _lastProcessedWave = 0; // 用于"波次切换时提示/BOSS 生成"
let _finalBossSpawned = false; // 终极波 BOSS 已生成：阻止后续小怪刷新，胜利需清空全场
function updateSpawner(dt) {
  const _runLen3 = _runWaveEnd - _runStartWave + 1;
  const _runDur = _runLen3 * WAVE_SECONDS;
  const diff = timeElapsed / _runDur; // 0..1（Phase-1: 基于当前 run 时长）
  // 5级前减少怪物刷新，之后逐步增多
  const lvl = player ? player.level : 1;
  const lvlMul = lvl < 5 ? 0.3 + (lvl - 1) * 0.15 : 1.0; // L1:0.30 L2:0.45 L3:0.60 L4:0.75 L5+:1.0
  // BOSS 存在期间减少怪物生成（终Boss波减更多）
  const bossAlive = enemies.some(e => !e.dead && e.isBoss);
  const wv = curWaveNum;
  let bossMul = 1.0;
  if (bossAlive) {
    if (wv >= 20) bossMul = 0.15;  // 终Boss波（虚空毁灭者）：小怪极少，专注Boss战
    else if (wv >= 15) bossMul = 0.4; // 中Boss波（烈焰冲锋者）：减少一半
    else if (wv >= 10) bossMul = 0.6;  // 小Boss波（熔岩幼体）：略减
    else bossMul = 0.6;               // 其他Boss波：略减
  }
  // 六阶段基础刷怪速率（对齐 25 波节奏，首领波 5/10/15/20/25）
  // 阶段1(波1-2): 极低密度  阶段2(波3-5): 翻倍  阶段3(波6-10): 持续上升
  // 阶段4(波11-15): 怪海高压  阶段5(波16-20): 最高压力  阶段6(波21-25): 骤降决战
  let phaseRate = 2.5;
  let phaseBatch = 2;
  if (wv <= 2) { phaseRate = 2.0; phaseBatch = 1; }                     // 破冰期：极低
  else if (wv <= 5) { phaseRate = 4.0 + (wv-3)*0.8; phaseBatch = 2; }   // 割草期：翻倍起步
  else if (wv <= 10) { phaseRate = 6.5 + (wv-6)*0.9; phaseBatch = 3; }  // 拐点期：稳步上升
  else if (wv <= 15) { phaseRate = 11.0 + (wv-11)*1.2; phaseBatch = 4; }// 施压期：怪海
  else if (wv <= 20) { phaseRate = 13.0 + (wv-16)*1.3; phaseBatch = 4; }// 高压期：最高压力
  else { phaseRate = 3.0; phaseBatch = 1; }                            // 决战期：骤降
  const baseRate = phaseRate * curDiff.rateMul * lvlMul * bossMul;
  spawnTimer -= dt * baseRate;
  // #region debug-point B:spawner-while (while loop guard + logging to detect infinite loop)
  let _spLoop = 0;
  const _spMax = 50;
  while (spawnTimer <= 0) {
    spawnTimer += 1;
    _spLoop++;
    if (_spLoop > _spMax) {
      try {
        const __dbg = window.__DBG__;
        if (__dbg) __dbg.push({hyp:'B',msg:'SPAWNER_WHILE_BREAK: loop='+_spLoop+' > '+_spMax+' spawnTimer clamped. enemies='+enemies.length+' baseRate='+baseRate.toFixed(2)+' dt='+dt.toFixed(4)+' phaseRate='+phaseRate+' phaseBatch='+phaseBatch+' lvlMul='+lvlMul.toFixed(2)+' bossMul='+bossMul.toFixed(2)+' wv='+wv, data:{enemies:enemies.length,spawnTimer:spawnTimer,dt:dt,baseRate:baseRate,diff:diff}});
      } catch(_) {}
      spawnTimer = 0.1;
      break;
    }
    if (enemies.length < 800 && !_finalBossSpawned) {
      const n = Math.max(1, Math.floor(phaseBatch * lvlMul * bossMul));
      for (let i = 0; i < n; i++) {
        spawnEnemyAtEdge(pickEnemyType(diff), diff);
      }
    }
  }
  if (_spLoop > 8) {
    try {
      const __dbg = window.__DBG__;
      if (__dbg) __dbg.push({hyp:'B',msg:'SPAWNER_HIGH_LOOP: loop='+_spLoop+' enemies='+enemies.length+' baseRate='+baseRate.toFixed(2)+' dt='+dt.toFixed(4)+' wv='+wv});
    } catch(_) {}
  }
  // #endregion

  // 安全区方向每 3 秒轮换
  _safeAngleTimer += dt;
  if (_safeAngleTimer >= 3) { _safeAngleTimer = 0; _safeAngle = Math.random() * TAU; }

  // ☯ 挂起的波次 Boss：等重甲土牛（及任何 Boss）被清空后立刻补刷，保证双向互斥
  if (pendingWaveBoss && !enemies.some(e => !e.dead && e.isBoss)) {
    const pb = pendingWaveBoss; pendingWaveBoss = null;
    spawnEnemyAtEdge(pb.bossType, diff);
    waveHintText = `⚠️ ${pb.bossName} 出现！ — 第 ${pb.w} 波`;
    waveHintTime = 2.5;
    for (let i = 0; i < pb.minionCount; i++) spawnEnemyAtEdge(pb.minionType, diff);
    // 🏆 终极波 Boss 补刷成功 → 封住后续刷怪，胜利改由清空全场触发
    if (pb.w === _runWaveEnd) _finalBossSpawned = true;
  }

  // ——— 波次切换（有限波次驱动） ———
  const w = getCurrentWave();
  if (w !== _lastProcessedWave && w > 0) {
    _lastProcessedWave = w;
    // 全征程模式：固定地图，不切换区域；仅显示波次提示
    const _runLen = _runWaveEnd - _runStartWave + 1;
    const _localW = w - _runStartWave + 1;
    const _waveMain = (BOSS_WAVES.has(w) ? '⚠️ ' : '') + `第 ${_localW} / ${_runLen} 波`;
    waveHintText = _waveMain + ' 来袭！';
    waveHintTime = 2.0;
    waveHintText2Time = 0;
    // E-02 第 8 波觉醒保底：仍未触发任何觉醒（含部分觉醒）则强制发一次简化觉醒
    if (w === GAME_CONFIG.tunables.awaken.guaranteeWave) {
      try { checkAwakenTrigger(true, { guarantee: true }); } catch (_) {}
    }
    // BOSS 波：根据波次生成不同 BOSS（三阶段：小Boss / 中Boss / 终Boss）
    if (BOSS_WAVES.has(w)) {
      let bossType = 'boss';
      let bossName = 'BOSS';
      let minionType = 'slime';
      let minionCount = 6;
      if (w === 10) { bossType = 'boss_mini'; bossName = '小首领·熔岩幼体'; minionType = 'slime'; minionCount = 8; }
      else if (w === 5) { minionType = 'toxic_slime'; minionCount = 8; }  // 🪨 戊土之狱 Boss：泥沼史莱姆群伴生
      else if (w === 15) { bossType = 'boss2'; bossName = '中Boss·烈焰冲锋者'; minionType = 'bomber'; minionCount = 5; }
      else if (w === 20) { bossType = 'boss3'; bossName = '终Boss·虚空毁灭者'; minionType = 'elite'; minionCount = 3; }
      // ☯ 互斥：土牛仍存活时，波次 Boss 挂起，待其被击杀后由上方 pending 分支补刷
      if (enemies.some(e => !e.dead && e.type === 'ox_armored')) {
        pendingWaveBoss = { bossType, bossName, minionType, minionCount, w };
      } else {
        spawnEnemyAtEdge(bossType, diff);
        waveHintText = `⚠️ ${bossName} 出现！ — 第 ${w} 波`;
        waveHintTime = 2.5;
        for (let i = 0; i < minionCount; i++) spawnEnemyAtEdge(minionType, diff);
        // 🏆 终极波 Boss 已生成 → 停止后续小怪刷新，胜利改由清空全场触发
        if (w === _runWaveEnd) _finalBossSpawned = true;
      }
    }
    // 波次切换后立即更新波次进度条（UI 同步）
    updateWaveProgress(true);
  }

  // 兼容旧字段：BOSS计时器不再需要，但保留防止外部引用报错
  bossTimer = Math.max(0, WAVE_SECONDS - (timeElapsed % WAVE_SECONDS));
  // ☯ Armored Ox forced event: independent timer (first ~120s, then a
  // random 120-300s window); postponed while any boss / another ox is live.
  try {
    const _oxCfg = GAME_CONFIG.tunables.ox;
    if (typeof oxNextAt !== 'number') oxNextAt = _oxCfg.firstAt;
    const _oxOn = enemies.some(e => !e.dead && e.type === 'ox_armored');
    const _bossOn = enemies.some(e => !e.dead && e.isBoss);
    if (timeElapsed >= oxNextAt) {
      const _runDur = (_runWaveEnd - _runStartWave + 1) * WAVE_SECONDS;
      if (_finalBossSpawned || timeElapsed >= _runDur - _oxCfg.stopBeforeEnd) {
        oxNextAt = Infinity; // 终极波 Boss 已生成 / 终局前 stopBeforeEnd 秒不再安排土牛，避免卡住通关
      } else if (!_oxOn && !_bossOn) {
        spawnEnemyAtEdge('ox_armored', diff);
        waveHintText = '⚠️ 重甲土牛 降临！火可熔穿重甲';
        waveHintTime = 3.0;
        oxNextAt = timeElapsed + rand(_oxCfg.windowMin, _oxCfg.windowMax);
      } else {
        oxNextAt = timeElapsed + _oxCfg.retryDelay; // 同屏已有 Boss/土牛 → 顺延再试，避免叠加
      }
    }
  } catch (_) {}
}

/* =============================================================
   碰撞 / 伤害判定
   ============================================================= */
function processCollisions() {
  // #region debug-point C:collisions (O(N*M) perf monitoring)
  let __t0 = 0;
  try { __t0 = performance.now(); } catch(_) {}
  // #endregion
  // 子弹 vs 敌人
  for (const b of bullets) {
    if (b.dead) continue;
    // —— 冒险者弧弹：弧线飞行阶段（!arcFinished）不做碰撞判定，由 Bullet.update arcFinished
    //    触发 100% 命中兜底 + pierce 一次性扣。避免 processCollisions 提前 1-2 帧在弧线末端
    //    先扣 pierce，使兜底命中走 hitSet.has(tgt) 分支从而漏掉 _arcPierceWindow → 无法穿透
    if (b.isArc && !b.arcFinished) continue;
    // —— 抛物线投掷弹（孢子炸弹）：飞行中不与敌人碰撞，仅在落地时生成荆棘领域 ——
    if (b.isLob) continue;
    for (const e of enemies) {
      if (e.dead || e.type === 'eBullet') continue;
      if (b.hitSet.has(e)) continue;
      const rr = b.r + e.r;
      if (dist2(b, e) < rr * rr) {
        b.hitSet.add(e);
        const kbx = b.vx * 0.002, kby = b.vy * 0.002;
        // 💥 暴击判定
        let finalDmg = b.dmg;
        let isCrit = false;
        if (player.critChance > 0 && Math.random() < player.critChance) {
          finalDmg = b.dmg * (1 + player.critDmg);
          isCrit = true;
        }
        const _fhit = (b.kind === 'fireball' || b.kind === 'meteor') ? { element: 'fire', source: 'fire' } : undefined;
        e.hurt(finalDmg, kbx, kby, _fhit);
        try { applyFreeze(player, e); } catch (_) {}
        const critColor = isCrit ? '#ff6b6b' : null;
        spawnFloat(e.x + rand(-8, 8), e.y - e.r, (isCrit ? '暴击 ' : '') + `-${Math.round(finalDmg)}`, critColor || (b.kind === 'orb' ? '#c98bff' : (b.kind === 'summon' ? '#ffe97a' : (b.kind === 'arcBullet' ? '#a3d0ff' : (b.kind === 'evoArcBullet' ? '#ffd58a' : '#ffe082')))));
        const col = b.kind === 'orb' ? '#c98bff' : (b.kind === 'summon' ? '#ffe97a' : (b.kind === 'arcBullet' ? '#a3d0ff' : (b.kind === 'evoArcBullet' ? '#ffd58a' : '#ffe082')));
        for (let i = 0; i < 4; i++) addParticle(new Particle(b.x, b.y, col));
        b.onHit(e);
        // —— 穿透逻辑：pierce>0 时可穿透对应数量敌人，pierce=0 时击中第一个敌人即消失
        //    pierce 用完后子弹立即消失
        //    stillHasWindow = 弧线弹穿透窗口 / fallback（仅特殊子弹保留）
        const stillHasWindow = ((b._arcPierceWindow ?? 0) > 0) || b._fallback;
        if (b.pierce > 0) { b.pierce--; }
        else if (!stillHasWindow) {
          // 🔥 爆炸弹：命中时触发爆炸 + 焦土
          if (b.explosion && !b._exploded) {
            b._exploded = true;
            triggerExplosion(b.x, b.y, b.explosion, b);
          }
          b.dead = true; break;
        }
      }
    }
  }
  // 飞刃 vs 敌人
  for (const bd of player.blades) {
    const bx = player.x + Math.cos(bd.ang) * bd.radius;
    const by = player.y + Math.sin(bd.ang) * bd.radius;
    bd._x = bx; bd._y = by;
    for (const e of enemies) {
      if (e.dead) continue;
      if (!bd._hitCd) bd._hitCd = {};
      if (!bd._hitCd[e] || bd._hitCd[e] <= 0) {
        const dx = bx - e.x, dy = by - e.y;
        if (dx * dx + dy * dy < (7 + e.r) * (7 + e.r)) {
          const dmg = player.bladeDamage;
          const ang = Math.atan2(e.y - player.y, e.x - player.x);
          // 💥 飞刃暴击
          let bladeFinalDmg = dmg;
          let bladeCrit = false;
          if (player.critChance > 0 && Math.random() < player.critChance) {
            bladeFinalDmg = dmg * (1 + player.critDmg);
            bladeCrit = true;
          }
          e.hurt(bladeFinalDmg, Math.cos(ang) * 0.5, Math.sin(ang) * 0.5);
          bd._hitCd[e] = 0.25;
          spawnFloat(e.x + rand(-8, 8), e.y - e.r, (bladeCrit ? '暴击 ' : '') + `-${Math.round(bladeFinalDmg)}`, bladeCrit ? '#ff6b6b' : '#7afcff');
          for (let i = 0; i < 3; i++) addParticle(new Particle(bx, by, '#7afcff'));
        }
      }
    }
  }
  // 飞刃命中冷却衰减
  for (const bd of player.blades) {
    if (!bd._hitCd) continue;
    for (const k in bd._hitCd) bd._hitCd[k] -= 0.016;
  }
  // #region debug-point C:collisions-end (report collision duration)
  try {
    const __dt = performance.now() - __t0;
    if (__dt > 15 || (bullets.length * enemies.length) > 30000) {
      const __dbg = window.__DBG__;
      if (__dbg) __dbg.push({hyp:'C',msg:'COLLISIONS_SLOW: ms='+__dt.toFixed(1)+' bullets='+bullets.length+' enemies='+enemies.length+' product='+(bullets.length*enemies.length)});
    }
  } catch(_) {}
  // #endregion
}
// —— 统一处理死亡敌人掉落（⚠️ 必须在 enemies.filter(!dead) 之前调用，否则飞剑/剑雨/尾迹等后置击杀永远不掉落经验）——
function processEnemyDeaths() {
  // —— 清理死亡敌人 → 掉落经验 + 金币（⚠️ 敌人子弹/飞行弹幕不属于"击杀野怪"，永远跳过掉落分支）
  for (const e of enemies) {
    if (e.type === 'eBullet') continue;
    if (e.dead && !e._dropped) {
      e._dropped = true;
      killCount++;
      // ☯ 图鉴：讨伐土牛 → 点亮；融化击杀 → 解锁隐藏；并按配置掉落碎片
      if (e.type === 'ox_armored') {
        try {
          awardUnlock('seen', 'ox_hunt');
          const _of = GAME_CONFIG.economy.oxFragments;
          if (_of.earth > 0) metaAddFragment('earth', _of.earth);
          if (_of.randomOther > 0) {
            const _others = WUXING_ELEMENTS.filter(x => x !== 'earth');
            metaAddFragment(_others[randi(0, _others.length)], _of.randomOther);
          }
          if (e._meltKilled && awardUnlock('secret', 'ox_hunt')) { _grantCollectionReward(COLLECTION_MAP['ox_hunt']); spawnFloat(e.x, e.y - 40, '隐藏成就！', '#ffd166'); }
        } catch (_) {}
      }
      if (player && player.resWoodFire && e._lastHitElement === 'fire' && !e._resonanceKill) { try { triggerKarmaBurst(); } catch (_) {} }
      // 🌀 风刃手里剑：每击杀1敌人攻速+1%（最高100层）
      if (player && player.windBladeActive && player.equippedWeapon === 'wind_blade') {
        const maxStacks = player.windAtkMaxStacks || 100;
        player.windAtkStacks = Math.min(maxStacks, player.windAtkStacks + 1);
        // 🌀 疾风追猎：限时伤害叠加
        if (player.windKillStack) {
          player._windKillExp = player._windKillExp || [];
          player._windKillExp.push(timeElapsed + (player.windKillStackDur || 5));
          if (player._windKillExp.length > (player.windKillStackMax || 8)) player._windKillExp.shift();
        }
      }
      // ⚔️ 剑气狂暴：飞剑击杀增加狂暴层数
      if (player && player.swordBerserk && player.weapon === 'sword') {
        player.swordBerserkStacks = Math.min(player.swordBerserkMax || 30, player.swordBerserkStacks + 1);
        player.swordBerserkTimer = player.swordBerserkDur || 6;
      }
      runCoins += (e.reward || 1) * curDiff.coinMul * (player ? player.coinMul : 1);
      // S-05 局内灵石掉落：按敌人档位概率/固定掉落，结算统一入账
      try {
        const _d = GAME_CONFIG.economy.runDrop;
        if (player && _d) {
          let _n = 0;
          if (e.isBoss) _n = (_d.bossSpirit && _d.bossSpirit[e.type]) || 40;
          else if (e.type === 'ox_armored') _n = _d.oxSpirit || 30;
          else if (e.isElite) _n = _d.eliteSpirit || 2;
          else if (Math.random() < (_d.normalChance || 0.01)) _n = _d.normalN || 1;
          if (_n > 0) player._spiritOverflow = (player._spiritOverflow || 0) + _n;
        }
      } catch(_) {}
      // ——— 木·青萝：森林法则：毒素致死 → 生食人花/毒蘑菇 ———
      spawnPlantFromDeath(e);
      const base = e.xpValue;
      if (base >= 5) {
        const n = Math.min(8, 2 + Math.floor(base / 3));
        for (let i = 0; i < n; i++) {
          orbs.push(new XpOrb(e.x + rand(-12, 12), e.y + rand(-12, 12), base / n));
        }
      } else {
        orbs.push(new XpOrb(e.x, e.y, base));
      }
      for (let i = 0; i < (e.isBoss ? 50 : 8); i++) {
        addParticle(new Particle(e.x, e.y, e.color1, !!e.isBoss));
      }
      // 🪨 土地图专属死亡演出：地裂巨岩怪 → 岩体崩裂 + 熔岩火星；岩甲傀儡 → 碎岩垮塌
      if (e.type === 'magma_demon') {
        for (let i = 0; i < 18; i++) {
          const shard = new Particle(e.x + rand(-e.r * 0.5, e.r * 0.5), e.y + rand(-e.r * 0.5, e.r * 0.5),
            (i % 2 ? '#8a6a4a' : '#5c4a30'), true);
          shard.vy -= 80; shard.life = rand(0.5, 1.1); shard.max = shard.life; shard.r = rand(2, 5);
          addParticle(shard);
        }
        for (let i = 0; i < 14; i++) {
          const spark = new Particle(e.x, e.y - e.r * 0.3, (i % 2 ? '#e8b63a' : '#ff7a2a'), false);
          spark.vx *= 1.5; spark.vy = spark.vy * 1.5 - 60; spark.r = rand(1.5, 3.5);
          addParticle(spark);
        }
        try { spawnFloat(e.x, e.y - e.r - 6, '碎石崩裂！', '#e8b63a'); } catch (_) {}
      } else if (e.type === 'rock_golem') {
        for (let i = 0; i < 12; i++) {
          const shard = new Particle(e.x + rand(-e.r * 0.4, e.r * 0.4), e.y + rand(-e.r * 0.4, e.r * 0.4),
            (i % 2 ? '#b08d57' : '#6b5226'), false);
          shard.vy -= 50; shard.r = rand(1.5, 3.5);
          addParticle(shard);
        }
      }
      // ——— 分裂者：死亡分裂为 2 个 slime ———
      if (e.type === 'splitter' && !e.hasSplit) {
        e.hasSplit = true;
        const _runDur = (_runWaveEnd - _runStartWave + 1) * WAVE_SECONDS;
        const difficulty = timeElapsed / _runDur;
        for (let i = 0; i < 2; i++) {
          const ang = (i / 2) * TAU + Math.random() * 0.6;
          const nx = e.x + Math.cos(ang) * 20;
          const ny = e.y + Math.sin(ang) * 20;
          const baby = new Enemy('slime', nx, ny, difficulty);
          baby.hp = baby.maxHp * 0.7;
          enemies.push(baby);
        }
        spawnFloat(e.x, e.y, '分裂！', '#ff8a80');
      }
      if (e.isBoss) {
        spawnFloat(e.x, e.y, 'BOSS 击破！', '#ffe082');
        waveHintText = 'BOSS 击破！掉落专属宝箱'; waveHintTime = 2.0;
        // ——— BOSS 宝箱掉落 ———
        chests.push(new Chest(e.x, e.y, true));
      } else {
        // ——— 普通怪物击杀掉落宝箱（仅消耗道具） ———
        // 固定极低掉率 0.05%
        const chestChance = 0.0005;
        if (chests.length < 4 && Math.random() < chestChance) {
          chests.push(new Chest(e.x, e.y, false));
        }
      }
    }
  }
}

/* =============================================================
   升级系统（含 ⚡ 武器进化卡）
   ============================================================= */

/* ====== 无限地图背景：可平铺底纹 + 网格 + 暗角 ====== */
/* ===== Forest battle map: procedurally assembled from extracted ground + element sprites ===== */
const _FOREST_GROUND_SRC='data:image/png;base64,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';
const _FOREST_SPRITES=[
{w:131,h:167,d:'data:image/png;base64,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'},
{w:172,h:198,d:'data:image/png;base64,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'},
{w:81,h:155,d:'data:image/png;base64,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'},
{w:74,h:63,d:'data:image/png;base64,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'},
{w:86,h:82,d:'data:image/png;base64,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'},
{w:75,h:62,d:'data:image/png;base64,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'},
{w:102,h:79,d:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAABPCAYAAAAZfLCcAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAC6kSURBVHhe7b2HV1tZtu4LylkCiSiCiEIRCQGSyKCcExI5J2MM2NjGNjaOVa7gcnVXn/DuO/fevu/cO94Y77/8vbE35T5V1dXddU5X9+k67TnGN9be8haC9WmGNedcy3V1H+XvR9LVGCNTftr62unot9LZ20Fnbxcd3R1YO1uxdrbQZm3C0mxCp1cxYO9hyNmPY9jOgKef4Pw4sVKESGGeH/7sj/IzSNtAG11DXXTZu+jo66B7oJseu42u/g6sPW1Ye9ppspoZHvPiD/rwBN0iJmIhosWFj6T8pWV0bgzfhJ/hsB9P0POjE56sJIkWIiQX4yQqsR995qP8zLKQXyBaiBItxBCuf/jvH0QgJV6OfjRhf2simK+fYsIEjRIITFZiZGpJMosRstU4qUqaRDlFpBAhWpknujj9J3/WR/kZJVFNkqqmqGyU6fP00tbZQEunhWZrE82dbTTbWjG0GphNT30k5q8pqVqKTC1DfjmHqlGJ0aBEp5Wj0SpQqRWoNErkajnJbILkYpJEJfGRoJ9TUtU02aU85fUKueU82aWcaK7ihTjziTkiqXkUGhl6RT16pQS1rB69cK9VIKmrY29vm9rmEuW1imjiosXoR4L+HImVFohm5xl09SNXyJHL5SjUUuQqKQqVFKVKhlRSh06tQC6R8PR8i0dn61yerfLkYpvnj4+5vbdKd5sZc5Ng4lpw+J0Ikd8PP+uj/ASJleZIL0ZIFRdIZqMMe5w0aHXolRrMRh1GjRKdSo5BJUcnk2BUytFJpXz+bI83j9Z4c7XKJ083ePv8gC9enqOV1iGRyNDqdWiNWjK13Edi/iMylZ0iXo6ha9Cg1SgwqeWMugZxdLfiH7Ti7WvBY2vG29vCmL2TCXcvsaCHr56t8/bxEp88qvLp1QqfPt3i0+t9jMo6FFIpGrUcrU5NrpIlmo/8UXKixTmixQjRwhyR/AILf+L5vwtZENcwURosBix6DQPWRp7d3eb5xSpPjss8vlXi4UGBB/s5rm5XeHiQF197eTfP64sSry5KfPFsg5cPlzlYn6MQdxKbHKbfasHa0kg2m2BqboJ4IUKsuMBMOcpceY75yhTRyhTJaoSF3BxT8RnGJv2MTozinwj+fRKTrmXJVHOU1xepbZbZOVhhoKeNgTYjA01GPn24ztM7WZ6eFHl2UuL6tMKL80Ve3VvixdmieP/yXCCnzNM7BZ6dlbk6r7BWGGO9HKQaGSE96SU+FUCjqEeuqscXGiYmLHirEWLVBeLVORYK0xTWskg1MurlEiSyeurlUurlMuoVMrQWHSt7tf/6JEUKC0TzURQ6BUqNCrVWh0IuoZid4eXDQ758csg313t89qDCl4+KvH1Y4+3lDT67XLq5fljjzf0KDw+zXB7lONuOcW8vxflOgs1SkI3iOFupABupEPMjdkwqCeZGPWPhAMXlIumlCOlaTERxLUtlYxGJUoJEI0euVKBUK1FpVCg1cnQmDVsHq1RWC/91yVnIzZMqJ0jl4uLaw6BVYVCpaNTW8+zBDi/vrfPFw1XeX9Z4/6jMu8dFvny09H08XuarJyu8vV8hOTVAetpOftZJaqKPtewYO6UJNvNBNlNjrCVCJILDGISAQatiYnKc5bUqmfICc/EQoZkA7oAL75iHfDVPqpgiW0qTLsaJJKcZn/SjVMvo6G6ltaMZdYPmvx45ycUE2WqOUq1AMj2PVi3BpJbQqJKIUdT1xQpfPdsWNeX95SJfXVb58lGNLx+tfA/vHq+K45u7ZTJzw+REeMjNONnMhdkqhNgrTeKxmXFYG3HbOmjW62m3NNFtbaPRpEMiqUcirUehkiPXyGi2Wji5v8/J/V127y5zcG+Vw7urHF9s0dHbgkwhRaXVIDco/2jO7xcp7nEPhiYDMqUErUZCJhZipTDP+V6F11fbvHu5x+ePl/j1sxXeCYRcrvD55QbvLte+h68erYt4e69GcmaY7JyPSnyM0oKPrfwE++UpblVnMahktDYYaDaaaDGasRhMdDY3Y9Zr0CqV6NRaNGodGp2Gtq5mju9tcXC+xMZFju2LPLsXJXbOqrT1NCNRKqiXKpGqFWR/qaH3Qn72e794YnGWhXwYi7UFU0MLSoUcq0XLuxe3eP9sg/ePK3z5ZIUvHi3z/mqVd48/mK3lbzVkScRXT1b56vGKOL5/ss4n9xbJJ8YoJYKUkuNUEqPsLc2zVZ5guzyJ0dCITqeisdGApbGZjtZurG3NtDSrkBokKPRSVGopMrmEnsE2Du6tsHVWYPVeieXzAstnBVbOSqS3YsxVpvDNe3CP2gnNfj9am/ulJEznct//RVPlOYorSYxmA2q1FotJw2CHka9fHPD+aplvnpZ4/+TGb3zAd33KV1crIt6LWOWrJ2u8e7zGp/dq5ONelnLjrOSDrORG2SpNsLc4zcHSNBaLBaNJg8GgxNxgQa8xo9epSWemuPfmmIvnJzx+cZfLp6dMxvzsXdRYup1m+bzM0lmJ2mmR0q0Miyd5Efm9JMu7JSTyeiQKxS+DjO9KpDArLtIKyxmq60Wqq0UOb+/QaFbT1CCls1mBt7+Br1/sioR887T6R4n58mqVL56s8PnjFT67XOHTByu8u9rm9d0lljIu1grDrOWHqUTtHCyGOV6e4XRtnpYGHa0WFQ1GKZaGBvSaBnQ6De0dRrbuL1E9zFHcjLN3b4Xde0ssnaSp3I6LhFTvFESUbmVFcsrHWQoHKZb2ikhU9UhV0l8eMQu5KbLVFC0dzSjVCjHHpVYr+PrdY15fbfLq8Srvnm+Jky1ogeBT3n+HlB8S8+Q4y/VpmdcXy+La5vPH27y93OLd032e383w/G6OV/eLPDlOcm9rnvP1GS42I3j7muhukePst2BtNmPUmVEoFaj1EjYfLhNbnyW3E6N2kmX5PMfaRYG1+zeECBpSuZ2jcJiieJQWkd6OUt7NItHXU6eq++URE8nPUF1fFFPwGrWSRqOG0eEBXl6u88llhbePFvn8ce1bvyH4lRsT9V38zow9WSER7CI90Usq3Es6PEBkpIvYaB/psJ2llJODWpCHR0neXCxyvDzJydIUt2uT3N/NcHkrx9N7q3Q1N6BTm1Co1MjU9dx6tkNqO0p8a5bCcZzFO2kWb6eoiVqTEyFqyWGKwkGS/EGS7F6Cyq0C8kYZUo2UmdSUmML54d//Nyvxwjy1tUU0WpWYeNQr6jjeyfHFkzW+vKzw7vGN6fo3Yr5Pyk0AcGPavr5aJTMlrFNcpCbspCaGSIaGyEy6iY8PEQ87SEw4SU85yM86WAi0c1CdYH8xyJ3qOHdWxnlwlKGryYhBbUCu1CBR13Nwf4fkukDMHPlbcSonGapHWVZuFX5HjGDCBE35LjmxjTly20nK21lxcbqQn/vlEJMqxykvlejr60Etq8OsrePXn93mi8sqX90X1ig13gukiMSs8O7p7xPzAb96tk522klBWKtMe8hNe0kEh0iF3QTtVsJeF1M+N0FnD0FXB5FgD+uFMXYqIU4rw5wtD/PgIEZ3kxG9yoBMoaZeJWHvbJfMaoL0dozcYZzFWzmWDgqsHVRETREgkPJdcnIHScaLARLrc8wXwySrC2jNGvRNBszdZtqHWv52SJqsBJgsjpCsziNRCos2JXV1UtTyOp4+WOHF/SLbZQ+vH1Z4c5Hji8s8nz8o8O5RhfdPaiI5gvb86nqFd0+q35q1FT5/WBUXkv/wcpeFkJ3UlJPizBCFcC/l6SHy0148tiaGbXYc3TaGetrwDrUS9LSxVQyzUwhyVOrl/s4kD45LdLaaRLOqVGpQKXVs39tioTpDejNC/iBO/jBJ8ThL6bhA5iBO+STD0rlgztKUD7NUDstkN3K0OtsJZyYJZ6aJFGJoDErUcgl6tRyZoo5kLUJ0dZZwZZyZ2n9ieXuyEGC2NE51u0idpA6ZTCVCq6zj/kmFO5szHK8E+fRhhdd3C3z+oHyDhxW+frrE+6saX18JIfEyv36+wdsHFT57WOWTi0XePVnnm+e7VCJelmPDbCaH2Un5OSpNcm+7gLurgf7WDgba23HY2nD0mJkN9Iir//3CBMc1L3fWpzk7LGFu0KJQyFAoVWi0eqyuTgZDA2S34hQO0xRv5Sgdlygdlykc56mc5Fm5KFO+naawl2DxqMhEJkibuwVboBvP7DC+KT9agwq1Qo5KJtR+lJTWskQWZ5ldnGKm/J+4vhFUOlaaYWV7Eam0Hkm9AqlUhbyujvuHi+yVg5yuhDmujnFvY47L3QRPj9J89mCRX1+v8fWzGr+6rvHuapX/67NbLEYHWEm6qUadlOYGuVWb4dPTAq9uZXh5kOLNcYGXx2Xe3N3EZdVh72ihr82Mw9aKu6eZSVcXG4kQB+lJ9hfDLGVGqS3Oi5llIcyVaWXoGgw09rViG+nDFxshWAgxUZ5iojLDeGGS0WwYx7yDnSfrrF6U2HpQYeNikcMn66yfV8jvpvBFfEwkJ9GYtBgMRlQypbhwfvD4guXdKqXNAtmVLKlq5q9LTnk1Q3kjx+JWgeXtCvcuTpDV16OVy1EpFWjq6zhaSXJQnmAnO8ztyigHpRDb+RBbuTEudmJ8/Xyd99crfP2ixm/eHPCbT46pxFwsxt3UEl4qUS/LqRG+PM3x8iDB1XaM68MsL08EjdrG0apmoEOPf8hKNbtALRth2NZKLuwlG7ATnXZi1NXR0KzG5mqnpb8JXasOXbOeDo+dVncPPcFBesMD9E87GJh20xlyYAs56Q72sXe1yepFgY37Bfavamw/KHHweIlX//wEx/QA/nk/xjYzcoUKjVqDQiiDKxSotEq0Jg3GZgONbQ1/XWLqZXVIFfViqrxeWkeDQclQjxVXXyeegS6mvTa2smE2k342kl420h5WEsMsx0eoRb1Uow5+82qfL69W+ObVJt98cpvXlxuU48MsJkcoRLwspUNkZtw83IpxtDhFNeplNRNiORVmt7TA+EAzD4/LvH5ywKPzPTqaTWL0ZVbWMzbYwb37O2weFNg6rbIkmKmDAtOFKTTtGtrcgwxMeBmcdjM466R/1kXfjAfruJ2usSGsgW7W7i+x9ajK/tUi+1dV7rxY4/bzVR5+eUL/pA3XtAOD1YRELUOpVaFQK2lqasJgMKDWqNDolCh08r8uMWrVjSNVqw0o5Qp0inru7BZ4eKvAva0YpytzFMM95EM2shM2srN9FOftZCb7KM7ZiY11iAWwX7884P31LvsrC+Qjw2TnPVSS4yxnJ0lOuSlGx+hqVtLXaaKrzchgbzseeyf9rTqeHK/y1fMtru+vslSKiK1MQilBb1DQbWvh6P4K6ycFqidplu4VSexESGwmaRiw0BmwY58exhX14Yx4sIsYpnvKSd+kC1uwl+1Hq+w9XeH4xRpH12vcebHJnecbPPn6HPtML31BG6ZuAw1WA8oGJVKdDK1Jh0qtQqVSoDOpURj/yhkCjVyDRmnCqGtBKVHQ2qDgZCfO41tRnu3P8MmdNNf7Cd6cLvLgMMvB+jxbi2EWo06io1ZGetXcWp7leGWBSsRNOTVKPh4gMetmLjhIbMpFen5EREu7hZbOVsxtLVh7uunt7cTeZeHt5TGfXlb49dtjpsIOGsw6lEYt9Xop5q5Gdi7KbD7Is3aZo3Q3TvEsS/W8in3GjdXfj33Wy0hmDFfCizs5jCs1Qs+MYMb66Z/qZ//pJrtXy5y83OL09R533xxx8fqAh1+c4o7YCRVGmSqExCpocilGbDGOrlkIyWXI5DK6B9oZnf3xfu2/mPg9NoZsVgatzXhtbcyNdHC+u8Dx2gQX2wucr03w2b0s/+31Gv/8eoN//GSbf361x397vcs/frbPm2d7RGbHmAoHiMz7SacmSCQniMXHWYiOkilMki1NsbgapbHRiKlRh6lZTXO3kKJX0dAo5cu3D/j0+TlfvX1CT2cjDQ1yjGYVWrMaU3sDB482WD4vUjlLUzpPsXQhpFtyLN0uMrTgoCvUzUg2gC/tJ1QKM700w2h+jPFikHApjCfixr3gYiQ2TCgTZCo/yXRxioXqPOOpMcLZEBO5MJP5CWYKQaKlCdRGGUq1HKlSwu2HR9QOctw+O7gJjGRSEcX18s9LlqZBgVQhEfu93r++z4v7O7y62ODJSZnXD1ZZywU4Wp7loDbJ0eIo7y8r/M9Pt/ifn+3wP77Y57dvD/nXL474l68OeXp/lSF7J8M+J15/D9PzXvKVOVKFKcLzXiYWfDhH+0Qcnmyye3uVtaMS26cVtm8X2dzL0T9gZqi/HXtvG02NWtpaG2lo1GFubkRv0mFoV9M0YGT7cpnFswyL51lqZ3mWz0osnpVFVM8rVE5LlE4KJHfjjBdHmVmeJlwKMTRjx5/wEYiPMBL3MxYPMBLzi6QIRH2AQNBULkisNIvOrBaLbwIx+3c2qB1kOLqzI4bqUqGHQF5PeaPy5xEzl/1+pU6hqkMqrUOrquPF8Sqvzmq8uqhwdZrl4VEWn83ElLeLSsLLraVJ3l1W+e3bbf6fz3f513f7/O/PD/nXz3b5X7864uK0hMvVhzvgZdDfx/BUH7XdFMnaDINjNvoDNnoDvbQ529k8LXL2cpuTVxvceb3Jg7dHPPviLjpzPa0tZsyNJposjYz4/PT39tFoMoto72ihrcfC1vkKS+dFFs/zLJ7lqdzJsnRRYvl+WRxr94rkj5MiiidpckdpqqcVxrNjIjEjAjGxEUYifjFMDqaDBOIBxlPj4rWAiXSI2cy0GI4LLbr18jp2jlcpb8XZPlxBrVUiE15XSFjc/DMbO/pc/eImo4GhLhKJMJXCDJvLMc72S3x2e4XroxyPbyW4vlvg+fkyPpuZxLiblewYx8vTfPGgwv/4RCBmj//9/oj/8/kh/9/Xx/z217c4PkjR7+xmwO/EPeVhsjDM+t0C89UgPeNWOgKd2IL9dAcHWLuf5OhVjb0XFY4+Webs8z0ef3UXs01Hg9lCo6WZ5uZW2ts76O60YTGZaW5swtrWToetjc07q1TvFCmfZlk8z1G9W6B6VxhzVM4y1O7lyR/Hyd2KiSid5Fi6WyFcHGck6RdJCMTGGIuPMxILMJYcZywxJo7jqaCIYGqC2dwChhaT2MChNSjYPlymtBZn83BZbOiQqW+6cGrby+J+oB/O908WjVGLVF6HQlZPITHJ49NVLo/zXJ3k+fSkwmZ6BHe3CXdfI6P2JpbjQQ7KC+yUwhyUxvnqYY3//skuv/3iiN9+dcL/+/Vd/s/Xt/mXXx2zsxPH6e9nMODAHuonXHSx9bjE9uNFquc5crfSFG/nKQmm62meozdVdl6W2P+kxtGbdS6/OkPVLkVnMWFoakBvNtHa1YZt0IZKr0TXqMXS0khbXwurp0ssnhUonefEAKAiaM65MGZFYkp3Ur8jpniSpCxo1N0yk+UQ/sQII9EAI9FxRqMhRuPjIgSihDGYCjOWCDKeDDORmcHY3oDGqMZg0rB/a5PlrTJbR6tMRcNE0hFimQQt3a3omrT/cWLUWhWS+joUdXXc2V7k8rDAq/MCL09jXO7HmR/txaJV0N5gxGbWcL4a48HGPI+2ozxcn+HlrRS/ebbB//35bX77zSW/ff+A3359l3/8+oT9owwOfy+DI30MBTvxxbrZv66y+7TCztNF9p8vsfu8xtb1EnvXgrbU2H5RYfdVjf0Xy9x5vYvEUkdTdzONXY1YbBaa+i10+7qwetvpC/YyEOgVHXfpNEf+NEXhPE35rkBKUTRflbOcOCb3FkRtEkyZ8NryRYGluyVmqpMiMf6IQExIJCYQCzIaD4lEiWR9ez2aCDKaGGfA10e9qk7sTdPqVWIblNIkI1GOkqlmyVbySFQy8Yvzw/n+yWLQ62kxN9Lb1sTj25s83Mvw7GieJ3shLo6i+B0dNJlaadQ2M9TezP3NBR5tTvBkc57rnQWe7UZ4epjE063A1a9n1GEhNT3AP/3DBVcv9tg4WGTjVo2d8yKbD7IcXlfYvxaIKbL/osSegJcFcS2xfVVl/+US+29W2H2+xOHTdQpbUTK1ONmVJLnNNPG1CNGNeaK7ERZ250nuxIjvLhA7nCN1GiV3nqZyr8jiWYnq3RLl07w4+rMelu4J/qZC7V6ZlQclMU82VQnSG+qjb2yQvjEH/aNOekcHGQw5sYddOKe8uGd84uia9TC84GE6G2YmFqK5tRGpVIZKpUeilDKfnSFZTpIspFEbtegt+p9OjNCrW6+sRyqrQ62QMjbuY7EU4tF5greXVZ4dFnm8m+dObYZH+zk8/S0o5FIMRi2OgSbuH6Z4sD3D070oT/cXuDqM8fhWgRFnN92d3fQO9qNvVXH/k0OOP1ni4E2JA8E8Pa+x/TzH1nWGrWdZtp+X2HpaZvOqzNbTGhvPymw+WyR3kmFyeYqZ1TmSBynmN+eY35omsjNLdGeeha05EdGdCLHdKJHtGAtbCyQP4mRvJyieJcifRimeRyncSoqTv3S3iCvaL45VIWK7V2LlTp6N80WCqQBDYQd9ASe2YRc2n5vuUQedw310uQWNtOMIu7EFBugJ2ekJDTI04abfN4jRYkIuk6CSysQIrbSeJVmJMJUIYu1vQWtR/XRi4pUkUo1E7BpRSOs4Pd7m5CDJi/tZXt4r8sWjA758cpt/enufd9e3GewyY2nQiekY/1Abjw6TXB/FeLYX43o/xrPDOI+O8oSH+xjssYmOWG2Rcv5yh+M3NQ4/KXP4uszhixp7L0vsPM+zfZ1j53mRrWdFNq+KIkFrj7NsP6uSP04xVhjDlwownBwhuhkjtR8jIpCxNUd8O0Jsa0EcEztRcUzuRckcJsjdSlK6k6F4khJ9SuVOQcTiaRFvwkmoNErpdo6Viyrrd6vsXm6J6xPvnA/XtA/HhIARXDN+RhdC6FoNGNuMWO1Whqd9ogYNTrpxTXrxTY3Q0tmMXC4VG9ulqhtiEuUFhOputDArkhQr/sQi20IhSp2iDpVKjkYh5WyvwvVFkavTCF9crWNR19GgkmBQSrDolbSZNbRb9HSZVQQHm3lxmObFQYLrvTTPD5JcH6Z4fJAjN+/H3tNKz0ArNnczF5/ucfxmif1XJfZFjVkUidm+zrP17ANybD7NiuP6E4GYCqn9KN6kD1fUjzcxhi85znRtithWjORukvh2jPh2lMROTCQmuTdPdGuGzOFNgWuyOkFsK0H+qEjlpMbS+SrxjSTDcT8j6TG84jjKWHIMf3SE4YVhEb4FP8PzPjxzPrwzfibiE5jbGtA3aDA1GfCOe3GHvLgmfLjDw4xMBmiyWpArpKJFESqmP5zrf5fESgkxNa5Sy9EoZbw4X+f6PM2LiwQv7i/R1awTd2yphXBQLaOlQSMGBWfraS43knxxusibW0Wujypc7ee5Pirx/M4S5fgovVYd7d0aut0N3Huzzd51mb2XZQ5eVjh8IfiPCtvXBRECMRtXAnJsXxfZfloSfUxkbRZ3dBjHnA/H7AiuhQDuiBfXgpeQUFHcTpHeTZPcjpPZS5HcmSOzL1Qo02KKZXDaxcCUm96wi74JB465YfzJ0LcIMpIK4ROceGqCsfQk/vgY3oiP4agPb3QYT2SYcCos7gowN+sxNWjFQySMDTrabW10DXbT3ttOa2eLuJYROj1VGqE/QPLnERMv35gygRidWs7re1tcn2e4vhvj5aM1ulqNaDRqZColWrUKW4uBh7slHq7HuN7JclGNMdnXzFCLnkGLCkeLBl9vI1vVKNsbWVa346zfTrB3WWLnWVk0WXvPSxy8KLNzXRCJ2r4usfIwy9qjAptPFtl5tkLpOCV2roykArjnfTgEhzsrwItjZhjPQgBvZAT3gpeJYpjK7SKp7ZsCWGx9gfKtMvYpJ/bJYQYnfAxNBeifdOGJjjKamSSQnhDHDxDIEYjyJcYYjo+IGjWc8OON+QhmQsxmp2nuaMRsMWA0CIlcJXq9Vmw+uYEcg1nP4kqZkaAPU8e/w9H/mPweMfd3uTrL8ORMIGad3k4LWo1K/DaYdFrcXRaebKd5vh3n2WaGSshLj15Ds9ByqlPTrJbRqJKxu1FkaTlOPO9j+yzF3mWRnac3JOw8K7J7LfgTwfHn2XhS4ODlBv2zPWI+y7Hgpn+in/7wIO65EXFyh6YFQtw455w4pgM4Z0ZwzwfwxQIMTTuIr8fI7qVYPK4SXYnTGxzANednUEjzTwyLxAxMOfEKi8XsBP7kOCOpIIF0iNFMmEB6jEBaeG0MXyKALzF6g+Qo3riPmcI0NkcneqMatbDTTadDr9OjValRKeViE7raoKS8WiBX+xkKZT8k5tXDfR7dyXJ5GuP5w1UGupvRa4VfRkGzyUhwsJ1nOwne7qd4uVsk5h7C39NHb0c3Ax1ddDQ24ujpZGUpTW01SWV9ip3zBLsPc+w+q7D5tMD20yI7oulKsf/qJhI7eLktkuKKjGCf9TMw4WRoSphQ4dvuwz7lZmhGMEWDOKZGcUyPiuQ4Z4dFsxNIjbB0tkhAMFHxoKhdA2HPt+8XCBpmcFogZoSxbJiR1DiBTFC8DuYnGcmMEsiOM5IZx58O4k+H8KfC+ATycuNiiiZaWCBfydLc2oTBZESjVGNUa9GqFOIONkOjjsJSlujPcaBEoriAUAAT9oeoVTpePF4TV/kvbuf45O4yQ1YzGpUSjd6MUW9gytPL68Mir7djvDooMDfcTcjVTWiwg1lXL+HedgpTAQ5WcqwuJVnfz4i9wSu3k2LTdiDZw/HLGkfPyxy8yLF1lWD7SZ5br9YZmLIxNDNEf3gI55T7O/B+u4YQIiGPaM5cc8PfmjWPeC2YOxEzI7im/eKzDkHTJry/g33Kw0gixERhjvHMlAjBrwgIZ8e/TVCGCOUmGM9MiNoUzE8RKo4TWVkgXouJ20kam0wYDDpRW9RypZis1BnUKPQScqspErU/I/XyQZKliJh8E4hRKbW8eLzF5e0Cj4+yohMfGbBiUN2Q1mjQMzcyyPO9Am/2s7w4LDPpsBJ29jLl6GXW1cO8p4+dUoSV4ixry1FS5QnmC2NM5/xkNmYZSw2JRajj56scvFhk/3qRg+tlTt7s0z/RK/qF/rALx+R3IZDjEcnxzo3gmvMyNO0SSXHO3hDz4fqPESOEtoI2CcSEcjMEs9Oi0w8kwwTTwko+gD/qp9PXRbe/h86RPjpHeuge68I+MYh7wkl4IYixUYdG2HylUKBWqjA1GFBp5RiatWSWk2LXzA/n+d8tqVL0hhiFULvWcP14n/u3q1welXl2sipuTjUK7a4yKSaNlIWAnav9Cs9281ztVQgNWZkdtrPgHiAyPEhizMH+SpLlyjQbGxHCC07GFjyMRYcZjXkIxDyMJr145u2MJByMZzwEkl5GUwH6xgexCxMYEibS9S2cIuwTDsKCb4iO4IuP4Iv5RRMmOH9hdMw6cc65/zgxYScDAkJOBoU1iHjtoD/owDFhZ2C8X8xuG7uMtNrb6Pb20Om20TncQZe3k77hHhx+u7jNXatT0tLSxJDTLmqLsKDUmFWUNwqkqj/DoUX5WhK5WtiaoBa7XWamhhn39zHm7mRyuIf8fJDUzBjJ6SDZhXGW09M82Knw9HiN13f3mXTamPMMkPK5KM+MUU1OsF6NsLQ0y9LqPFOxYSaT4/jnPIwI64P5YbzzXjxzHtyzLjziZHpEcyVOZNiLPXRjum7gwD5hpz/YT3YrQ3ojQWYn/TvM1WZF/yKk6oUC14+RIiwW+8edOCY9DAQdYnpFGL+LweAA9vFBBkcHxOYN64CVTnsXtqFuuj02bG6beFyKbbBL3OsjU9TT3dvx5xPwh6S4nEGplYtVNplUhUQ86ECCRlZHh1lNLOQmEfYQD7rJz7rJz/uZ8g1gNSpoUtTjbGskGXBTHvdRmhljtRBhbTlFZTHC+laOmcQYgTkv49EAAaG2Me8XV9aeWT+eaR+e6ZvRNenDOTGMQ3DYITf2sIB/I6ZvvIfsdoLURpTMbuJ3SO/Eye2nye4lxXvPbEAkR9AcwR8JBA2G3DcETXpxTniwB52/ByEN4wo7GRodwtRmoqO3ne6+zhs4bHQP2egZ6hEPyZPI6sR+OuH8tR/O5wfpdFqxOlrpcLb9wWf+qJRWs9TJ6lCqlMhlapRqlbh61WlktDVoiIeHSQaHyE+6qSy4SEw4GHP30t6ow2rSMdTcQD7oZyc6xUpimp5WEyajmuZWM7aeTuzDvQSjPsLJ0e8QMyIS45sZxT87Lo7eaT+uCQ9Owb+ICUPBpwjkCMQMik0Q+Z0EyfV5sTH83xAht58guxcX+4yFjLBAzodAQQwWvtUgZ9jNUNCJW/wc9/cgECO87ggMoTIo0Rs1mEw6dDo1apMWlUEllhZUOiVSeb3YJdRqa/6Dk97l6qDT1f7ntdCq9Ao6u7qYnppHrdOjNxpQKaX0Wi1kpgOkg0PU5n2kg11kBLPTZ6XVbMTaYMTZamF5NsxBYpbV5AxdLQZUaqG9SShHq9A3qYmUJggKqY8PpuyDxkz68U6O4Jnw4Qp7cE+4cAkRWcj+48Tsxkmuz4lkfEB6JyoSI1wL5Jh6mzH2NGG0Wejy9aNs06NqN4hotJnpHxnAGXKJJHwX9nEH7rCbQZ8diaIOibQOuaxOLIHUyeupk95oyQ05Cgx/YsNsh8Mqaktzv/mPPvfTRaYUW0qVCgn9XRaiEy6xzysRGqA45SQ368fWaqTVpKejsQFPVxeV2TD72Rlur+TpabeI28SFWnedTEpXbxfBmXHG5oM4J4XkoB/3pA9PeBhP2I1HICQ8fGPGJpxElxaIr86S2FwgujZLbH1OvBYgbIkQkN5PiHmxhEDMbpL0ToL0ZkzslrR0NdPYYaG9v4ORqVHUZi0Kkwq5UYnMIMfYZsI56sIT9H4PgzMOPNMenL4hZNI6FPUS5HVSZHUKpHVypPUK6up/epql02mjzzf4k5//k6Iy6MVGNuFQnYDXQXJWcP6jZGfHiIXdpGbHsJr1tJn0dJn0+LraWZoPcZSb5c5Kgd5WC0ppPVKpFIlUglqvYtAzgHfCh+fbiEnwJwIxbuGbG3LjCnlxhL30j/WT286Q2YqS3IqQ2Y2T3omJ1x8gmq/dGPGtBTJ7gqbEKexlxaCgsJMTiRFIaelpo8fVh8ygEIlRNqjRtRnpctpEDRUTkN/BwKQDZ8iJ2+8USyAyST3SOimSOhn1dXLxjJo6yU9PTHYL5t7e+ZOf/9Miqxe3WjdajMgkEnQKBRatlu6mZrqsjfR2ttJi1GE16uk2qhnpamI9EuQ4N8fpSoH+Nguq+nqk9RIRQh5J2FMvaMUHZyyQ4Ap6cAWduIIunEHB4Xvo9tmoHArdk2mREIGYH5IjaFB8a57Y5rzo8Iem+mn3tOKYGGK+PId1oFMkp2Owiz7vIL3ufmyuXgaEE2vHnOJn24Nucfwu3NMeAkKax+cQiZEKJIiQiJoimGbRnP1EsTp+TlKETv7IGMlijNpKhTqhxCyVo5AoUUvVyFUSca+8rbWFdr0Wm17FeG8LW4kwh+lp7iwXsFtbUEolGHR6pBIpCrUcu3eQ4Um/qC0COQIJAjHOcQdOIYwdd4uTJRCzerpMVti/sn+zm+sDOd91+InNeeIb82KU5ot4abY3Yem10NzfQlN3i6gtrb3tIiGDviEcARf93kEGgkKUJ4TMLjEsF0yrGLGFvXTYO8QgSK2TI5NLabTc9BO0drXT0tFKY5uZxvbGPzrZP6+G/ECmYmPMxIMk81Ex8pBIpdQLKi25ac9RKmTYmluw6vXYjDrGBjpYS05yuxLl1lKO/o5mZNKbb5tUIRd/RputVSwkDQZdNxMRdOMcFzCEY9zB0JgL+7iLVkebGBYX91O/8ycfNOZ7kdjWHOnNBdGvhDNBWu0tNPe30tLXLvoXgRwBgrY4Rly4xoRoy8XgqJMh4XMF0yl8OcLD4r1wbWk3ixlimbwOU4MOp8+J3e+g02Gjx933l5vwnyqR/DRzyRChuYDYYFAvEya5jnppvbiPsbWpgZHBIWwNZqw6Hb6BbpYzsyzHxzhczdPR3ohMKRyWI6FOqIrqVfQLvWTCaj7svfnWjrtwjLkYGrWL6wb7qFM0M832Zky9Bmq3C98zY98Pj6NktgVtiZIS6v2LC1h6m2juacPc1UqD1SySYu5sotPejXPUjX8ycHPUcGgYb2hYPHrYPzlCYHqU4QmfeN1oaUBvUFMvqaO5pZFeZy9drh7anF1YHX/BheS/V6L5GQaHexid8ZOtptk62qCrtx2dSkGrzkS71oTVZKJBK2PA1sS4uwO3o422ziaWNqucPbnHdGJOPN2oodWEPeCkf8zJwLiLQYGUMRcOIQUzZmdw1EF/wEFjn5mmIQul/cy3pHwwYTc+RtiiJ9ynt+fI7cVICan+9Qytg1YsQurI2ojJ2oC5y4KpowFDmxGZXkG9WoJcdzMK/Q31qhtIhHvFt/f19Wg0Snp7u34yCR1DP/3Zv6jom7Ti0Yd6iZZWXTMGtYp+Zwdf/8unfPFPz3n7z1e8/PUFV1+ccv35XSKpIBqTAolGgnWwC8eom6FRFwMBJ4OjLvpHe+gbsYkNDt3efgwdjTT2minv5sVoK7kVI74hdOsLfkUgJC7eJ3emmV4M0jhgoWnAirpFT7fbSijm/dGJEqqKSrlSDEZkEilyqez3IPybQin70ff/IbE6/0Y0SWFQIZcpUNYp0UgUNFsM+MKDfPrNI1796i6vfnOXx18dc/HmgBfv7mMbbEOjl4l7RixtZlx+F0M+B/3DdtEpC0nBHpeNjsFOcTOQvtmEodWIN+wimB5lIhckUptjoTpLbHmB6NI8ybUYidUZwplx1C0aTNYmdM1GnGN28is/fnqscKqFVCITQ3iZTCaeuflDCA5fo1P/6Pv/5kWqVVEvkaJRaTHqdehNMhwjnbz55j6vf3PKs2+OefqrY06uNzl+tEVHX5N4fIiQiRVgNGnFhjhh9aw2qNAIexkNKvQNeoQOUHGfif7mNYVFirZVhXWoldaBJuyj/dg8naL5c4UGGJ31o23SY2qzYO5oYnTKTyw386MTK2y0UiiEVIqQfJQiU8qQ/wBCK6tC/ws8kkQQYReVXDhgQa8W/xiVUcLonIuXX9/n1T+cicQ8/voWt55tcO/5bVwBOzq9Er1OhUGvFskRGhmENLlGr8IgEKIT8nNy8fjFAXsvOoMGvVGHqkGJvlmHtb8dfZOO5u4mzIIPaTPR2G5g0NuPplEjapily8JENESs9OOVQ4EYmUKJXKvA2GzC2tuBRfjfOdqbMLdZxFC4oa2Rlp7WH33/37wIk2NsNRCOhEiU4lgHWmnpNfP084dcvT/n/ue3uPv5EftPNrj/+hT/pBed8d9IMZi0YnJQqVOga9Ci1qtF7bDaWllczXNwso1EOC5R6DYRjkKU3USDwpfgw70QIRpa9LjHXX9wEiMrUaKrMaLLUUYXxlAYlOLpGBKtVAynf/j8fznpG+5HalAQmB2ntJdn+U6F1Xs1Nu+vsn9/WzzSXaWTi+sDAYKfGQn6aWxrFLfISbVS5HoZtsEOFjezVDdzSDR1YpSkVCpRqYRt6jIRdXXCtvUbP5GqJP/o6RRztXlafe20ea10eXvQWvTohQN/2oy09P0H0/C/JDH3WjB1NWLq+sO7dEWTZNaKZddUOcbyTpXx+TFkBhkynQKNWYM7aKe4kaC4lkRtUqDUqm8Kd0K+TSJBKpOKUCiFBKtw2MOfFnWHFk3Hn9HE/fcgjdbfJ05ukmFoMqEyKhmP+ElUZyiupzCatahUGnFhKxVMmEI44VUiXgvJVZX+p0VOLQO/UH/xny7KOjES8k8OU1hPE6/OkFuJY2oxiMdYCbuw5BoFnhEP7TYruga9eC+V/5V3BP89itB2+sNISjB5QpQmpOr1LcaPJPytSIvNTFtXEy29f0ZJ9qP8/BIvL5Bf/PEV/Ef5T5Zo9j/xBKOP8lE+ykf5KB/lo3yUj/J3LP8/w42NMGFuFW8AAAAASUVORK5CYII='},
{w:90,h:88,d:'data:image/png;base64,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'},
{w:62,h:61,d:'data:image/png;base64,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'},
{w:57,h:57,d:'data:image/png;base64,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'},
{w:44,h:43,d:'data:image/png;base64,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'},
{w:43,h:44,d:'data:image/png;base64,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'},
{w:43,h:44,d:'data:image/png;base64,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'},
{w:51,h:50,d:'data:image/png;base64,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'},
{w:54,h:59,d:'data:image/png;base64,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'},
{w:66,h:73,d:'data:image/png;base64,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'}
];
const _FGTILE=220, _FCHUNK=340, _FGPAD=1;
const _forestGroundImg=new Image();
let _forestReady=false,_forestPending=1+_FOREST_SPRITES.length;
function _forestOneLoaded(){ _forestPending--; if(_forestPending<=0) _forestReady=true; }
_forestGroundImg.onload=_forestOneLoaded;
const _forestImgs=_FOREST_SPRITES.map(function(s){
  const im=new Image();
  im._w=s.w; im._h=s.h;
  im.onload=_forestOneLoaded;
  im.src=s.d;
  return im;
});
_forestGroundImg.src=_FOREST_GROUND_SRC;
/* deterministic hash + prng */
function _fHash2(ix,iy){let h=(Math.imul(ix|0,374761393)+Math.imul(iy|0,668265263))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return (h^(h>>>16))>>>0;}
function _fRng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
/* per-chunk element layout; items are owned by the chunk of their center and may visually overflow into neighbors */
const _fItemCache=new Map();
function _fChunkItems(ix,iy){
  const key=ix+'_'+iy;
  let arr=_fItemCache.get(key);
  if(arr) return arr;
  const r=_fRng(_fHash2(ix,iy));
  arr=[];
  const M=36;
  function spot(md){
    let px=0,py=0;
    for(let k=0;k<5;k++){
      px=M+r()*(_FCHUNK-2*M); py=M+r()*(_FCHUNK-2*M);
      let ok=true;
      for(let j=0;j<arr.length;j++){const it=arr[j];const dx=it.x-px,dy=it.y-py;if(dx*dx+dy*dy<md*md){ok=false;break;}}
      if(ok) break;
    }
    return [px,py];
  }
  if(r()<0.40){const p=spot(95);arr.push({s:r()<0.5?0:1,x:p[0],y:p[1],sc:0.85+r()*0.35,fl:r()<0.5?1:-1});}
  if(r()<0.34){const p=spot(80);arr.push({s:r()<0.5?0:1,x:p[0],y:p[1],sc:0.9+r()*0.3,fl:r()<0.5?1:-1});}
  const n=3+Math.floor(r()*4);
  for(let i=0;i<n;i++){
    const q=r();
    let s;
    if(q<0.18){s=[3,4,5,6][Math.floor(r()*4)];}
    else if(q<0.62){s=[7,8,9,10,11,12][Math.floor(r()*6)];}
    else if(q<0.88){s=13+Math.floor(r()*2);}
    else {s=15;}
    const p=spot(46);
    arr.push({s:s,x:p[0],y:p[1],sc:0.72+r()*0.46,fl:r()<0.5?1:-1});
  }
  if(_fItemCache.size>300)_fItemCache.clear();
  _fItemCache.set(key,arr);
  return arr;
}
/* per-chunk ground canvas: seamless ground tile + seeded light/dark patches + tiny specks */
const _fGroundCache=new Map();
function _fGroundChunk(ix,iy){
  const key=ix+'_'+iy;
  let cv=_fGroundCache.get(key);
  if(cv) return cv;
  cv=document.createElement('canvas'); cv.width=_FCHUNK+2*_FGPAD; cv.height=_FCHUNK+2*_FGPAD;
  const g=cv.getContext('2d');
  g.imageSmoothingEnabled=true;
  // 1px world-aligned padding: neighboring chunk canvases overlap with identical edge pixels, so fractional camera movement never shows seams
  const ox=(((ix*_FCHUNK-_FGPAD)%_FGTILE)+_FGTILE)%_FGTILE;
  const oy=(((iy*_FCHUNK-_FGPAD)%_FGTILE)+_FGTILE)%_FGTILE;
  for(let yy=-oy;yy<_FCHUNK+2*_FGPAD;yy+=_FGTILE)for(let xx=-ox;xx<_FCHUNK+2*_FGPAD;xx+=_FGTILE) g.drawImage(_forestGroundImg,xx,yy,_FGTILE,_FGTILE);
  g.save();g.translate(_FGPAD,_FGPAD);
  const r=_fRng(_fHash2(ix,iy)^0x5bf03635);
  /* layer 1: large biome patches — multi-hue, soft edges give the ground its color variety */
  const biomePalette=[
    'rgba(16,30,18,0.17)',   // deep moss shade
    'rgba(176,194,108,0.13)',// sun-warmed grass
    'rgba(104,182,96,0.11)', // fresh green undergrowth
    'rgba(140,104,64,0.12)', // exposed earth (warm hue contrast)
    'rgba(52,82,84,0.10)',   // cool teal shadow (cold hue contrast)
    'rgba(158,178,124,0.11)' // pale clearing
  ];
  for(let k=0;k<6;k++){
    const pr=78+r()*105;
    const px=pr+r()*(_FCHUNK-2*pr), py=pr+r()*(_FCHUNK-2*pr);
    const col=biomePalette[Math.floor(r()*biomePalette.length)];
    const gr=g.createRadialGradient(px,py,0,px,py,pr);
    gr.addColorStop(0,col);
    gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr; g.fillRect(0,0,_FCHUNK,_FCHUNK);
  }
  /* layer 2: medium detail patches — tighter light/dark modeling for depth */
  for(let k=0;k<10;k++){
    const pr=22+r()*46;
    const px=pr+r()*(_FCHUNK-2*pr), py=pr+r()*(_FCHUNK-2*pr);
    const q2=r();
    let col0;
    if(q2<0.40) col0='rgba(196,214,142,'+(0.07+r()*0.09)+')';       // warm light
    else if(q2<0.78) col0='rgba(12,24,14,'+(0.08+r()*0.10)+')';     // deep shade
    else col0='rgba(150,116,76,'+(0.07+r()*0.08)+')';               // earthy mid-tone
    const gr=g.createRadialGradient(px,py,0,px,py,pr);
    gr.addColorStop(0,col0);
    gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr; g.fillRect(0,0,_FCHUNK,_FCHUNK);
  }
  /* layer 3: micro speckles — grass tips, tiny flowers, pebbles, fallen leaves */
  const speckCols=['170,200,130','140,182,104','196,214,150','112,158,92']; // grass greens
  for(let k=0;k<42;k++){
    const q=r();
    const sx=2+r()*(_FCHUNK-4), sy=2+r()*(_FCHUNK-4);
    if(q<0.10){ // pebble
      g.fillStyle='rgba(128,118,102,'+(0.10+r()*0.10)+')';
      g.fillRect(sx,sy,r()<0.4?2:1, r()<0.4?2:1);
    } else if(q<0.17){ // fallen leaf
      g.fillStyle='rgba(172,122,70,'+(0.10+r()*0.10)+')';
      g.fillRect(sx,sy,2,1);
    } else if(q<0.23){ // tiny flower
      g.fillStyle=r()<0.5?'rgba(222,226,202,'+(0.16+r()*0.14)+')':'rgba(214,198,122,'+(0.16+r()*0.14)+')';
      g.fillRect(sx,sy,2,2);
    } else { // grass tip
      const c=speckCols[Math.floor(r()*speckCols.length)];
      g.fillStyle='rgba('+c+','+(0.05+r()*0.10)+')';
      g.fillRect(sx,sy,1,1);
    }
  }
  g.restore();
  if(_fGroundCache.size>150)_fGroundCache.clear();
  _fGroundCache.set(key,cv);
  return cv;
}
/* soft elliptical contact shadow, baked once and scaled per element per frame */
let _fShadowImg=null;
function _fShadow(){
  if(_fShadowImg) return _fShadowImg;
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d');
  const grd=g.createRadialGradient(32,32,2,32,32,31);
  grd.addColorStop(0,'rgba(6,12,8,0.34)');
  grd.addColorStop(0.6,'rgba(6,12,8,0.15)');
  grd.addColorStop(1,'rgba(6,12,8,0)');
  g.fillStyle=grd; g.fillRect(0,0,64,64);
  _fShadowImg=c; return c;
}

let _bgTile = null;
const BG_TILE = 256;
function seeded(i) { const x = Math.sin(i*9301.23) * 10000; return x - Math.floor(x); }

function ensureBgTile() {
  if (_bgTile) return;
  _bgTile = document.createElement('canvas');
  _bgTile.width = _bgTile.height = BG_TILE;
  const g = _bgTile.getContext('2d');
  // 底色
  g.fillStyle = '#222831';
  g.fillRect(0, 0, BG_TILE, BG_TILE);
  // 微妙渐变斑（模拟地形起伏）
  for (let i = 0; i < 6; i++) {
    const cx = seeded(i*7+1) * BG_TILE;
    const cy = seeded(i*7+3) * BG_TILE;
    const r = 60 + seeded(i*7+5) * 80;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const dark = seeded(i*11) > 0.5;
    grd.addColorStop(0, dark ? 'rgba(20,28,36,0.5)' : 'rgba(45,55,65,0.4)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, BG_TILE, BG_TILE);
  }
  // 细微光点（模拟碎石/星光）
  for (let i = 0; i < 20; i++) {
    const x = seeded(i*23+1) * BG_TILE;
    const y = seeded(i*23+7) * BG_TILE;
    const a = 0.03 + seeded(i*23+13) * 0.05;
    g.fillStyle = `rgba(120,160,200,${a})`;
    g.fillRect(x, y, 1.5, 1.5);
  }
}

function drawBackground() {
  if (_forestReady) {
    // forest map: chunks of seamless ground with procedurally scattered elements on an infinite deterministic grid
    ctx.save();
    const cix0=Math.floor(cam.x/_FCHUNK), cix1=Math.floor((cam.x+W)/_FCHUNK);
    const ciy0=Math.floor(cam.y/_FCHUNK), ciy1=Math.floor((cam.y+H)/_FCHUNK);
    ctx.imageSmoothingEnabled=true;
    for(let iy=ciy0;iy<=ciy1;iy++)for(let ix=cix0;ix<=cix1;ix++){
      ctx.drawImage(_fGroundChunk(ix,iy),ix*_FCHUNK-_FGPAD,iy*_FCHUNK-_FGPAD);
    }
    const list=[];
    for(let iy=ciy0-1;iy<=ciy1+1;iy++)for(let ix=cix0-1;ix<=cix1+1;ix++){
      const arr=_fChunkItems(ix,iy);
      const wx0=ix*_FCHUNK, wy0=iy*_FCHUNK;
      for(let k=0;k<arr.length;k++){const it=arr[k];list.push([wx0+it.x,wy0+it.y,it]);}
    }
    list.sort(function(a,b){return a[1]-b[1];});
    const shImg=_fShadow();
    ctx.imageSmoothingEnabled=true;
    try{ctx.imageSmoothingQuality='high';}catch(e){}
    for(let k=0;k<list.length;k++){
      const wx=list[k][0], wy=list[k][1], it=list[k][2];
      const im=_forestImgs[it.s];
      const dw=im._w*it.sc, dh=im._h*it.sc;
      // soft elliptical contact shadow anchors the sprite to the ground
      const sw=dw*0.72, sh=Math.max(6,dh*0.13);
      ctx.drawImage(shImg,wx-sw/2,wy-sh*0.5,sw,sh);
      if(it.fl<0){
        ctx.save();ctx.translate(wx+dw/2,0);ctx.scale(-1,1);
        ctx.drawImage(im,0,wy-dh,dw,dh);
        ctx.restore();
      }else{
        ctx.drawImage(im,wx-dw/2,wy-dh,dw,dh);
      }
    }
    // gentle tinted darkening keeps enemies/bullets readable over bright forest
    ctx.fillStyle='rgba(12,18,12,0.20)';
    ctx.fillRect(cam.x-8,cam.y-8,W+16,H+16);
    // screen vignette focuses the play field (forest branch previously had none)
    const vx=cam.x+W/2, vy=cam.y+H/2;
    const vg=ctx.createRadialGradient(vx,vy,Math.min(W,H)*0.35,vx,vy,Math.max(W,H)*0.78);
    vg.addColorStop(0,'rgba(0,0,0,0)');
    vg.addColorStop(1,'rgba(0,0,0,0.42)');
    ctx.fillStyle=vg;
    ctx.fillRect(cam.x,cam.y,W,H);
    ctx.restore();
  } else {
    ensureBgTile();

  // 1) 平铺底纹 —— 跟随摄像机无限滚动
  const ox = cam.x % BG_TILE;
  const oy = cam.y % BG_TILE;
  const startX = cam.x - (ox < 0 ? ox + BG_TILE : ox);
  const startY = cam.y - (oy < 0 ? oy + BG_TILE : oy);
  for (let ty = startY; ty < cam.y + H + BG_TILE; ty += BG_TILE) {
    for (let tx = startX; tx < cam.x + W + BG_TILE; tx += BG_TILE) {
      ctx.drawImage(_bgTile, tx, ty);
    }
  }

  // 2) 世界网格（轻淡、世界坐标）
  const g = 90;
  const x0 = Math.floor(cam.x / g) * g;
  const y0 = Math.floor(cam.y / g) * g;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x <= cam.x + W + g; x += g) { ctx.moveTo(x, cam.y - 40); ctx.lineTo(x, cam.y + H + 40); }
  for (let y = y0; y <= cam.y + H + g; y += g) { ctx.moveTo(cam.x - 40, y); ctx.lineTo(cam.x + W + 40, y); }
  ctx.stroke();
  }

  // 全征程模式：固定地图，不使用区域色调叠加层

  // 3) 屏幕暗角 vignette（屏幕坐标）
  ctx.save();
  const vx = cam.x + W/2, vy = cam.y + H/2;
  const vg = ctx.createRadialGradient(vx, vy, Math.min(W,H)*0.35, vx, vy, Math.max(W,H)*0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = vg;
  ctx.fillRect(cam.x, cam.y, W, H);
  ctx.restore();
}

function drawWaveHint() {
  if (waveHintTime > 0) {
    const a = Math.min(1, waveHintTime);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 42px "Segoe UI", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(waveHintText, W / 2, H / 2 - 80);
    const g = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
    g.addColorStop(0, '#ffe082'); g.addColorStop(1, '#ff8a5b');
    ctx.fillStyle = g;
    ctx.fillText(waveHintText, W / 2, H / 2 - 80);
    // Phase-1 zone subtitle (narrative or secondary hint)
    if (waveHintText2 && waveHintText2Time > 0) {
      const a2 = Math.min(1, waveHintText2Time);
      ctx.globalAlpha = Math.min(a, a2);
      ctx.font = '18px "Segoe UI", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.70)';
      ctx.strokeText(waveHintText2, W / 2, H / 2 - 42);
      const _cg = ctx.createLinearGradient(W / 2 - 260, 0, W / 2 + 260, 0);
      _cg.addColorStop(0, 'rgba(200,220,255,0.75)'); _cg.addColorStop(1, 'rgba(160,180,230,0.75)');
      ctx.fillStyle = _cg;
      ctx.fillText(waveHintText2, W / 2, H / 2 - 42);
    }
    ctx.restore();
  }
  if (typeof karmaFlash === 'number' && karmaFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.45, karmaFlash);
    ctx.fillStyle = '#ff5a2c';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/* =============================================================
   HUD 更新
   ============================================================= */

const _ZONE_ICONS = { earth: '⛰️', water: '🌊', wood: '🍂', fire: '🔥', metal: '⚔️' };
/* ====== 25 个独立关卡节点：沿蛇形总路径平铺 2400×1400 大平面 ====== */
// 5 zone × 5 stage = 25 节点，编号 1..25 与 index 一一对应
// 布局：5 行 zigzag 蛇形——Row 0 正向→、Row 1 反向←、Row 2 正向→、Row 3 反向←、Row 4 正向→
// 大平面 2400×1400，列间距 480（均匀），行间距 275（均匀）
/* ====== 正弦蛇形曲线节点 ======
   参数：
   - 25 个节点，沿 x 轴正向等距排列
   - canvas 2400 × 1400
   - 中心 y = 700
   - 摆动幅度 = 380px（蛇形上下摆动 ±380）
   - 周期 = 600px（每 600px 一个完整波浪）
   
   蛇形特征：y = centerY + amplitude * sin(2π * x / period)
   
   x ∈ [200, 2200]，等距 25 点
   节点 1 起始 zone1，节点 25 终止 zone5
*/
function buildFlatNodePositions() {
  const N = 25;
  const canvasW = 2400, canvasH = 1400;
  const xMin = 200, xMax = canvasW - 200; // 左右各留 200 边距
  const xStep = (xMax - xMin) / (N - 1);   // ≈ 83.33
  const centerY = canvasH / 2;             // 700
  const amplitude = 380;                   // 摆动幅度
  const period = 600;                      // 蛇形周期（px）
  
  const result = [];
  for (let i = 0; i < N; i++) {
    const x = xMin + i * xStep;
    const y = centerY + amplitude * Math.sin((2 * Math.PI * x) / period);
    result.push({ x, y });
  }
  return result;
}
const ALL_NODE_POSITIONS = buildFlatNodePositions();

/* ====== Catmull-Rom 转三次贝塞尔：让整条蛇形曲线平滑 ======
   用相邻 4 个点 p0,p1,p2,p3 生成 p1→p2 的三次贝塞尔段
   整条 path 一次性生成，节点天然在曲线上
*/
function buildSnakePath(positions) {
  if (positions.length < 2) return '';
  const P = positions;
  let d = `M${P[0].x.toFixed(1)} ${P[0].y.toFixed(1)}`;
  if (P.length === 2) {
    d += ` L${P[1].x.toFixed(1)} ${P[1].y.toFixed(1)}`;
    return d;
  }
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] || P[i + 1];
    // Catmull-Rom → Bezier 控制点
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/* ====== 地图拖拽交互状态 ====== */
const _MAP_PAN = {
  dx: 0, dy: 0,          // 当前 transform 偏移（都是负值或 0）
  startX: 0, startY: 0,  // mousedown 起点
  origDx: 0, origDy: 0,  // mousedown 时的偏移快照
  dragging: false,
  moved: false,           // 是否已超过 5px 阈值（区分 click vs drag）
  MIN_MOVE: 5,            // 拖动阈值（px）
  CANVAS_W: 2400, CANVAS_H: 1400,  // 大平面固定像素（节点坐标在这张图上）
  VIEW_W: 0, VIEW_H: 0,            // 视口尺寸：动态读 zone-map 的 clientWidth/clientHeight
  updateViewSize() {
    const el = document.getElementById('zoneGrid');
    if (el) {
      this.VIEW_W = el.clientWidth;
      this.VIEW_H = el.clientHeight;
    }
  }
};
function clampPan(dx, dy) {
  const { CANVAS_W, CANVAS_H, VIEW_W, VIEW_H } = _MAP_PAN;
  // 视口比 canvas 大 → clamp 范围为 0（canvas 居中或贴边）
  const maxDx = 0;
  const minDx = VIEW_W >= CANVAS_W ? 0 : -(CANVAS_W - VIEW_W);
  const maxDy = 0;
  const minDy = VIEW_H >= CANVAS_H ? 0 : -(CANVAS_H - VIEW_H);
  return {
    dx: Math.min(maxDx, Math.max(minDx, dx)),
    dy: Math.min(maxDy, Math.max(minDy, dy)),
  };
}
function applyPan() {
  const canvas = document.getElementById('zoneCanvas');
  if (!canvas) return;
  canvas.style.transition = _MAP_PAN.dragging ? 'none' : 'transform 0.18s ease-out';
  canvas.style.transform = `translate(${_MAP_PAN.dx}px, ${_MAP_PAN.dy}px)`;
}
function resetPan() {
  // 默认居中
  let dx = -((_MAP_PAN.CANVAS_W - _MAP_PAN.VIEW_W) / 2);
  let dy = -((_MAP_PAN.CANVAS_H - _MAP_PAN.VIEW_H) / 2);
  // 定位到"已解锁 zone 的中心节点"
  try {
    const meta = getMeta();
    const zoneIdx = Math.max(1, Math.min(5, (meta.flags && meta.flags.zoneUnlocked) || 1));
    // zoneIdx → 中心节点 index（0-based）：zone1→node3(idx=2), zone2→node8(idx=7), ..., zone5→node23(idx=22)
    const centerNodeIdx = (zoneIdx - 1) * 5 + 2;
    const pos = ALL_NODE_POSITIONS[centerNodeIdx] || ALL_NODE_POSITIONS[12];
    dx = _MAP_PAN.VIEW_W / 2 - pos.x;
    dy = _MAP_PAN.VIEW_H / 2 - pos.y;
  } catch(_) {}
  const c = clampPan(dx, dy);
  _MAP_PAN.dx = c.dx; _MAP_PAN.dy = c.dy;
  applyPan();
}
/* 绑定地图拖拽（只在 showZoneSelect 时生效） */
function bindMapPanEvents() {
  const viewport = document.getElementById('zoneGrid');
  if (!viewport || viewport._panBound) return;
  viewport._panBound = true;

  const onDown = (e) => {
    // 点击在节点/标签/弹窗/按钮上 → 不启动拖拽
    const target = e.target;
    if (target.closest && (
      target.closest('.zone-map-node') ||
      target.closest('.zone-map-label') ||
      target.closest('.zone-detail-overlay') ||
      target.closest('button')
    )) return;
    _MAP_PAN.dragging = true;
    _MAP_PAN.moved = false;
    _MAP_PAN.startX = e.clientX;
    _MAP_PAN.startY = e.clientY;
    _MAP_PAN.origDx = _MAP_PAN.dx;
    _MAP_PAN.origDy = _MAP_PAN.dy;
    _MAP_PAN._pointerId = e.pointerId;
    viewport.classList.add('dragging');
    viewport.setPointerCapture && viewport.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!_MAP_PAN.dragging) return;
    const dx = e.clientX - _MAP_PAN.startX;
    const dy = e.clientY - _MAP_PAN.startY;
    if (!_MAP_PAN.moved && Math.abs(dx) + Math.abs(dy) < _MAP_PAN.MIN_MOVE) return;
    _MAP_PAN.moved = true;
    const clamped = clampPan(_MAP_PAN.origDx + dx, _MAP_PAN.origDy + dy);
    _MAP_PAN.dx = clamped.dx; _MAP_PAN.dy = clamped.dy;
    applyPan();
  };
  const onUp = () => {
    if (!_MAP_PAN.dragging) return;
    _MAP_PAN.dragging = false;
    viewport.classList.remove('dragging');
    if (_MAP_PAN._pointerId != null) {
      viewport.releasePointerCapture && viewport.releasePointerCapture(_MAP_PAN._pointerId);
      _MAP_PAN._pointerId = null;
    }
  };

  viewport.addEventListener('pointerdown', onDown);
  viewport.addEventListener('pointermove', onMove);
  viewport.addEventListener('pointerup', onUp);
  viewport.addEventListener('pointercancel', onUp);
  // 滚轮缩放（简化版：直接调整 dx/dy，保持固定 zoom 但允许滚轮平移）
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const clamped = clampPan(_MAP_PAN.dx - e.deltaX * 0.6, _MAP_PAN.dy - e.deltaY * 0.6);
    _MAP_PAN.dx = clamped.dx; _MAP_PAN.dy = clamped.dy;
    applyPan();
  }, { passive: false });

  // 全屏自适应：viewport 尺寸变化（桌面 resize / 移动旋转 / 地址栏收起）
  const onResize = () => {
    _MAP_PAN.updateViewSize();
    const c = clampPan(_MAP_PAN.dx, _MAP_PAN.dy);
    _MAP_PAN.dx = c.dx; _MAP_PAN.dy = c.dy;
    applyPan();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  // ResizeObserver 兜底：更精确地捕捉 container 尺寸变化
  if (typeof ResizeObserver !== 'undefined') {
    viewport._ro = new ResizeObserver(onResize);
    viewport._ro.observe(viewport);
  }
}
/* 每个关卡对应的主题色（详情弹窗的 --zd-accent / 节点图标底色） */
const _ZONE_ACCENTS = {
  earth: '#d4a85a', water: '#6dc2ff', wood: '#ff8fae',
  fire:  '#ff7a3d', metal: '#d8e0ef',
};

/* ====== 关卡详情弹窗：接受全局节点编号 nodeIdx (1..25) ======
   自动算出 zoneIdx / stageIdx；进入战斗时 _pendingStartZone = zoneIdx */
let _selectedNodeIdx = 0;   // 当前选中的全局节点（1..25）
let _selectedZoneIdx = 0;   // 派生：zone（1..5）
let _selectedStageIdx = 0;  // 派生：zone 内阶段（1..5）
function openZoneDetail(nodeIdx) {
  _selectedNodeIdx = nodeIdx;
  const zoneIdx = Math.floor((nodeIdx - 1) / 5) + 1;
  const stageIdx = ((nodeIdx - 1) % 5) + 1;
  _selectedZoneIdx = zoneIdx;
  _selectedStageIdx = stageIdx;

  const L = MAP_LAYERS[zoneIdx - 1];
  const accent = _ZONE_ACCENTS[L.id] || '#ffe082';
  const overlay = document.getElementById('zoneDetailOverlay');
  const box = document.getElementById('zoneDetailBox');
  box.style.setProperty('--zd-accent', accent);

  const iconEl = document.getElementById('zdIcon');
  iconEl.textContent = `${zoneIdx}-${stageIdx}`;

  document.getElementById('zdName').textContent =
    `${L.zoneName} · 第 ${stageIdx} 阶段`;
  document.getElementById('zdElem').textContent = L.element;

  const waveSpan = TOTAL_WAVES;
  const hasBoss = true;

  const narrEl = document.getElementById('zdNarr');
  narrEl.textContent = `${L.zoneName} — ${_SUB_STAGE_TEXTS[stageIdx - 1]}\n  点击确认后将进入完整征途（${waveSpan}波 + BOSS）。`;

  const meta = document.getElementById('zdMeta');
  meta.innerHTML = `
    <div class="zd-chip">📍 节点 ${nodeIdx} / 25</div>
    <div class="zd-chip">💠 第 ${zoneIdx} 层</div>
    <div class="zd-chip">⚔️ ${waveSpan} 波 + BOSS</div>
    <div class="zd-chip">🎯 ${L.element}</div>
  `;

  const confirmBtn = document.getElementById('zdConfirmBtn');
  confirmBtn.textContent = '进 入 征 途';
  overlay.classList.add('show');
}
function closeZoneDetail() {
  document.getElementById('zoneDetailOverlay').classList.remove('show');
  _selectedNodeIdx = 0; _selectedZoneIdx = 0; _selectedStageIdx = 0;
  const grid = document.getElementById('zoneGrid');
  if (grid) grid.querySelectorAll('.zone-map-node.selected').forEach(el => el.classList.remove('selected'));
}
/* 5 阶段文案描述 */
const _SUB_STAGE_TEXTS = [
  '进入渊域外围，清扫游荡的先锋怪物。',
  '深入核心地带，遭遇成规模的精英小队。',
  '接近区域深处，强敌陆续涌现，小心应对。',
  'BOSS 前奏，敌人倾巢而出，压力陡增。',
  '直面区域终焉，击败 BOSS 方可通关此渊。',
];

function renderZoneSelect() {
  const grid = document.getElementById('zoneGrid');
  const canvas = document.getElementById('zoneCanvas');
  if (!grid || !canvas) return;

  // 每次渲染都重新读当前视口尺寸（全屏自适应 resize/旋转）
  _MAP_PAN.updateViewSize();
  // 绑定拖拽事件（只绑一次），并把 canvas 居中到视口
  bindMapPanEvents();
  resetPan();

  const m = getMeta();
  const unlocked = Math.max(1, Math.min(5, (m.flags && m.flags.zoneUnlocked) || 1));
  const clearedSet = (m.flags && m.flags.zonesCleared) || [];

  // 1) 清空 canvas 上的旧渲染元素（SVG 路径层在 canvas 里，也一起清）
  canvas.querySelectorAll('.zone-map-node, .zone-map-label, .zone-sub-group, .zone-node, .zone-node-label').forEach(el => el.remove());

  // 2) 重绘 SVG 总路径（一条蛇形贯穿全部 25 节点）— SVG 在 canvas 里
  const svg = canvas.querySelector('.zone-path-layer');
  if (svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // 逐段画蛇形路径（每段独立 class 着色：traversed / locked / normal）
    for (let i = 0; i < ALL_NODE_POSITIONS.length - 1; i++) {
      const zoneIdxA = Math.floor(i / 5) + 1;
      const zoneIdxB = Math.floor((i + 1) / 5) + 1;
      const seg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      // Catmull-Rom 段（从 ALL_NODE_POSITIONS[i] 到 [i+1]）
      const P = ALL_NODE_POSITIONS;
      const p0 = P[i - 1] || P[i];
      const p1 = P[i];
      const p2 = P[i + 1];
      const p3 = P[i + 2] || P[i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      seg.setAttribute('d', `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
      // 已通关节点（zoneA 已通且 zoneB 也已解锁）→ 绿色实线
      const zoneL = MAP_LAYERS[zoneIdxA - 1];
      const nextZoneIdx = Math.floor((i + 1) / 5) + 1;
      const nextZoneL = MAP_LAYERS[nextZoneIdx - 1];
      const aUnlocked = zoneIdxA <= unlocked;
      const bUnlocked = zoneIdxB <= unlocked;
      const aCleared  = clearedSet.indexOf(zoneL.id) >= 0;
      const bCleared  = clearedSet.indexOf(nextZoneL.id) >= 0;
      let cls = 'zone-path-line';
      if (aUnlocked && bUnlocked) {
        if (aCleared && bCleared) {
          cls += ' traversed';
        }
      } else {
        cls += ' locked-path';
      }
      seg.setAttribute('class', cls);
      svg.appendChild(seg);
    }

    // zone 分界标签：在每个 zone 中心节点（index 2,7,12,17,22）处下方放元素名
    for (let z = 0; z < 5; z++) {
      const centerIdx = z * 5 + 2;  // zone 中心节点索引
      const pos = ALL_NODE_POSITIONS[centerIdx];
      const L = MAP_LAYERS[z];
      if (!pos) continue;
      const tx = pos.x;
      const ty = pos.y + 65; // 节点下方 65px（与 hover 标签在上方 32px 错开）
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('class', 'zone-divider-label');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty);
      text.setAttribute('fill', L.accent);
      text.setAttribute('opacity', Math.max(0.35, z < unlocked ? 0.9 : 0.25));
      text.textContent = `第 ${z + 1} 层 · ${L.element} ${L.zoneName.split('·')[1] || ''}`;
      svg.appendChild(text);
    }
  }

  // 3) 渲染 25 个独立可点击节点
  for (let i = 0; i < ALL_NODE_POSITIONS.length; i++) {
    const pos = ALL_NODE_POSITIONS[i];
    const globalIdx = i + 1;          // 1..25
    const zoneIdx = Math.floor(i / 5) + 1;   // 1..5
    const stageIdx = (i % 5) + 1;     // 1..5
    const L = MAP_LAYERS[zoneIdx - 1];
    const isZoneUnlocked = zoneIdx <= unlocked;
    const isZoneCleared = clearedSet.indexOf(L.id) >= 0;
    const isNextZone = zoneIdx === unlocked + 1;
    const isNodeNextStage = isNextZone && stageIdx === 1; // 下一关的第 1 个节点 = 当前"下一关"

    // 节点
    const node = document.createElement('div');
    node.className = 'zone-map-node';
    if (!isZoneUnlocked) node.classList.add('locked');
    if (isZoneCleared) node.classList.add('cleared');
    if (isNodeNextStage) node.classList.add('next-stage');
    // BOSS 波节点：zone 最后一个节点（stageIdx === 5）→ BOSS
    if (stageIdx === 5 && isZoneUnlocked && !isZoneCleared) node.classList.add('boss-node');
    node.style.left = pos.x + 'px';
    node.style.top  = pos.y + 'px';
    node.textContent = `${zoneIdx}-${stageIdx}`;
    // zone 主题色覆盖（非通关/锁态才用 zone 色）
    if (isZoneUnlocked && !isZoneCleared) {
      const accent = L.accent;
      node.style.borderColor = accent;
      node.style.background = `radial-gradient(circle at 30% 30%, #fff3a0, ${accent} 60%, #2a1f10)`;
      node.style.boxShadow = `0 6px 18px rgba(0,0,0,0.7), 0 0 20px ${accent}80, inset 0 2px 4px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.3)`;
    }
    if (isZoneUnlocked) {
      node.onclick = () => {
        canvas.querySelectorAll('.zone-map-node.selected').forEach(el => el.classList.remove('selected'));
        node.classList.add('selected');
        openZoneDetail(globalIdx);
      };
    }
    canvas.appendChild(node);

    // 简洁标签（hover 时由 JS 精确控制变亮）
    const label = document.createElement('div');
    label.className = 'zone-map-label';
    label.style.left = pos.x + 'px';
    label.style.top  = (pos.y - 32) + 'px';
    const zoneTag = isZoneUnlocked ? L.element : '???';
    const bossTag = (stageIdx === 5 && isZoneUnlocked) ? '<span class="zml-boss">BOSS</span>' : '';
    label.innerHTML = `<span class="zml-tag">${zoneIdx}-${stageIdx}</span> <span class="zml-elem">${zoneTag}</span>${bossTag}`;
    if (!isZoneUnlocked) label.classList.add('locked');
    canvas.appendChild(label);

    // mouseenter/leave 精确配对 node 和它的 label（避免 CSS sibling selector 影响全部后续 label）
    node.addEventListener('mouseenter', () => label.classList.add('visible'));
    node.addEventListener('mouseleave', () => {
      if (!node.classList.contains('selected')) label.classList.remove('visible');
    });
    // 同时 label 在节点 click 选中时保持 visible
    const _origOnclick = node.onclick;
    node.addEventListener('click', () => {
      // 清除所有 label 的 visible
      canvas.querySelectorAll('.zone-map-label').forEach(l => l.classList.remove('visible'));
      // 立即给当前 label 加 visible
      label.classList.add('visible');
    });
  }

  // 4) 绑定详情弹窗按钮（只绑一次）
  if (!window._zdDetailBound) {
    const cancel = document.getElementById('zdCancelBtn');
    const confirm = document.getElementById('zdConfirmBtn');
    if (cancel) cancel.onclick = closeZoneDetail;
    if (confirm) confirm.onclick = () => {
      if (_selectedNodeIdx > 0) {
        _pendingStartZone = _selectedZoneIdx;
        closeZoneDetail();
        startGameWithSelectedClass();
      }
    };
    const overlay = document.getElementById('zoneDetailOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeZoneDetail();
      });
    }
    window._zdDetailBound = true;
  }
}


