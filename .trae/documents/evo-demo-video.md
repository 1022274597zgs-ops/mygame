# 终极进化视频介绍 实施方案

## 摘要
为强化图鉴「⚡终极进化」分类下的 5 张职业进化卡片加入「🎬 视频介绍」按钮，点击后弹出模态弹窗，以 6 秒循环动画演示该职业终极技的实战视觉（蓄力→觉醒→终极→淡出 4 阶段）。架构完全复用共鸣演示 `openResDemo` 的「模态弹窗 + 双画布(scene 720×405 / fx) + rAF 帧循环 + particles 复用」模式，但使用独立的 modal/scene/frame 变量，避免与共鸣演示状态冲突。5 职业各自差异化终极技视觉（金=剑雨、木=毒雾、水=龙卷、火=岩浆、土=震地）。

## 当前状态分析（Phase 1 探查结论）

### 强化图鉴卡片渲染
- `renderEnhEvolution()` (main.js **19306-19332**): 遍历 `CLASSES`,为每个 `cls.evo` 创建 `div.codex-card.awake`,innerHTML = header(codex-sprite icon + codex-info[name+enh-rarity"进化"tag+codex-type-tag"终极进化"]) + codex-desc + codex-stats(觉醒条件 rt.main + 进化加成 cls.evo.bonus),`cards.push(card)` → `enhCodexGrid.appendChild(_enhSection(...))`。**当前无任何交互按钮**。

### 共鸣卡片按钮绑定模式（直接复用）
- main.js **19259-19261**:
  - innerHTML 内嵌 `'<div class="res-demo-btn">▶ 特效演示</div>'`（条件：`RES_DEMO_VFX[r.name]` 存在）
  - `const _db = card.querySelector('.res-demo-btn');`
  - `if (_db) _db.addEventListener('click', (e) => { e.stopPropagation(); openResDemo(r.name); });`

### 共鸣演示架构（复用模板）
- `openResDemo(name)` (main.js **12509-12541**): `closeResDemo()` 先关 → 创建/复用 `#resDemoModal`(innerHTML: `.res-demo-panel` > `.res-demo-head`(title+close) + `.res-demo-stage`(双 canvas 720×405 scene+fx) + `.res-demo-hint`) → 点击空白/✕ 关闭 → 初始化 `_demoScene`(elem/sub/mobs[3]/swords/px=150/groundY=300/fireCd=0.4 等) → `_demoRaf = requestAnimationFrame(frame)`
- `closeResDemo()` (main.js **12942-12948**): `cancelAnimationFrame(_demoRaf)` + 恢复 `particles = _demoSavedParticles` + `_demoScene = null` + `classList.remove('show')`
- `const frame = (ts)` (main.js **12561-12940**): `_demoClock += dt`、`nowLoop = _demoClock % RES_DEMO_LOOP`、`nowLoop < prevLoop` 时清空所有状态(projs/spikes/zones/booms/scorches/fireCd/charge/burst/fissureT/evQ/mobs状态/swords) → `drawResDemoScene(dctx, cv)` 场景层 + fx 层(destination-out 渐隐 rgba(0,0,0,0.22) + 1.8× 缩放锚定主怪 + 粒子 update/draw) → `_evoRaf = requestAnimationFrame(evoFrame)`
- `drawResDemoScene(dctx, cv)` (main.js **12329+**): 背景 `_bgTile` 平铺 + 网格 + `PLAYER_SHEETS[classId]` 主角精灵帧(walking 判断 castT<0.36, bob) + 火系蓄力红光 + 施法闪光 + mobs + zones/spikes/booms

### CLASSES evo 数据 (main.js **1575-1640**)
| 职业 | elem | evo.name | icon | apply 关键字段 | 终极技 |
|------|------|----------|------|---------------|--------|
| 白庚 | metal | 万剑归宗 | 🌌 | swordRain/swordUltimateOn/swordUltimateTimer=6 | 剑雨+剑阵 |
| 青萝 | wood | 森罗万象 | 🌲 | forestUltimateOn/forestUltimateTimer=8 | 毒雾+荆棘 |
| 沧澜 | water | 深海高压 | 🌀 | waterUltimateOn/waterUltimateTimer=10 | 水龙卷+水盾 |
| 赤炎 | fire | 红莲业火 | 🌋 | fireUltimateOn/ultimateLava={remain:10} | 岩浆 |
| 磐石 | earth | 不动明王 | 🛕 | earthUltimateOn/maxHp×1.4/sizeMul=1.5/earthStompInterval=3 | 震地+巨体 |

### 强化图鉴 HTML (index.html **237-252**)
`#enhCodexView` > h1 + tagline + codex-sub + `#enhCodexTabs`(5 buttons, evolution tab=`data-etab="evolution"`) + `.codex-grid#enhCodexGrid` + back button

## 提议改动

### 改动 1: renderEnhEvolution() 卡片加「🎬 视频介绍」按钮
**文件**: e:\mygame\js\main.js (19306-19332)
**what**: 在 `card.innerHTML` 末尾(codex-stats 闭合 `</div>` 之后)追加 `'<div class="res-demo-btn">🎬 视频介绍</div>'`;在 `cards.push(card)` 之前插入:
```js
const _edb = card.querySelector('.res-demo-btn');
if (_edb) _edb.addEventListener('click', (e) => { e.stopPropagation(); openEvoDemo(cls.id); });
```
**why**: 与共鸣卡片按钮模式(19259-19261)完全一致,复用 `res-demo-btn` CSS 类零样式改动,只是文字「🎬 视频介绍」+ 调用 `openEvoDemo(cls.id)`。
**how**: 补丁定位 `card.innerHTML =` 赋值串的末尾 `'      '</div>' +` (stats 闭合) → 在其后追加按钮串;定位 `cards.push(card);` 前插入事件绑定两行。

### 改动 2: 新增 openEvoDemo / closeEvoDemo / evoFrame / drawEvoDemoScene
**文件**: e:\mygame\js\main.js,插入在 `closeResDemo()` 之后(**12948 行之后**, `/* ====` 注释 12949 之前)
**what**: 新增 4 个函数 + 2 个模块级变量 + 1 个常量:
```js
const EVO_DEMO_LOOP = 6;          // 6 秒循环(与 RES_DEMO_LOOP 一致)
let _evoDemoScene = null, _evoRaf = 0, _evoClock = 0, _evoLastTs = -1;
let _evoParts = [], _evoSavedParticles = null;

function openEvoDemo(classId){
  const cls = CLASSES.find(c => c.id === classId);
  if (!cls || !cls.evo) return;
  closeEvoDemo();
  let modal = document.getElementById('evoDemoModal');
  if (!modal){
    modal = document.createElement('div');
    modal.id = 'evoDemoModal';
    modal.innerHTML = '<div class="res-demo-panel">' +
      '<div class="res-demo-head"><span class="res-demo-title"></span><span class="res-demo-close">✕</span></div>' +
      '<div class="res-demo-stage"><canvas class="scene" width="720" height="405"></canvas><canvas class="fx" width="720" height="405"></canvas></div>' +
      '<div class="res-demo-hint">🌌 终极进化 · 循环播放 · 点击空白处关闭</div>' +
    '</div>';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeEvoDemo(); });
    modal.querySelector('.res-demo-close').addEventListener('click', closeEvoDemo);
    (document.getElementById('stage') || document.body).appendChild(modal);
  }
  modal.querySelector('.res-demo-title').textContent = cls.evo.icon + ' ' + cls.name + ' ⟶ ' + cls.evo.name;
  modal.classList.add('show');
  const cv = modal.querySelector('canvas.scene');
  const fxCv = modal.querySelector('canvas.fx');
  const dctx = cv.getContext('2d');
  const fctx = fxCv.getContext('2d');
  dctx.fillStyle = '#222831'; dctx.fillRect(0, 0, cv.width, cv.height);
  _evoParts = [];
  _evoSavedParticles = (typeof particles !== 'undefined') ? particles : undefined;
  particles = _evoParts;
  // 场景初始化:群怪从右侧走入(复用共鸣演示的 mob 模型)
  const mt0 = RES_DEMO_MOBS[0], mt1 = RES_DEMO_MOBS[1], mt2 = RES_DEMO_MOBS[2];
  _evoDemoScene = {
    classId: classId, evo: cls.evo, elem: cls.elem,
    mobs: [
      { type: mt0, x0: 760, speed: 62, yOff: 0,   main: true,  kb: 0, hitT: 0, burnT: 0, poisonT: 0, slowT: 0, burnTick: 0, poisonTick: 0, hitFlash: 0 },
      { type: mt1, x0: 800, speed: 58, yOff: -38, main: false, kb: 0, hitT: 0, burnT: 0, poisonT: 0, slowT: 0, burnTick: 0, poisonTick: 0, hitFlash: 0 },
      { type: mt2, x0: 830, speed: 70, yOff: 38,  main: false, kb: 0, hitT: 0, burnT: 0, poisonT: 0, slowT: 0, burnTick: 0, poisonTick: 0, hitFlash: 0 }
    ],
    floats: [], px: 150, groundY: 300, phase: 'charge', phaseT: 0,
    shake: 0, swords: [], waves: [], rains: [], lavas: [], stomps: [], thorns: []
  };
  _evoClock = 0; _evoLastTs = -1;
  _evoRaf = requestAnimationFrame(evoFrame);
  // 以下 evoFrame / closeEvoDemo / drawEvoDemoScene 见下
}
```

`function closeEvoDemo()`: cancelAnimationFrame(_evoRaf) + 恢复 particles + _evoDemoScene=null + modal.classList.remove('show')

`const evoFrame = (ts) =>`: `_evoClock += dt`; `nowLoop = _evoClock % EVO_DEMO_LOOP`; 循环重置(nowLoop < prevLoop: phase='charge',phaseT=0,清空 floats/swords/waves/rains/lavas/stomps/thorns + mobs 状态重置 px=x0); 4 阶段推进(用 phaseT 累积 dt 切换 phase); `drawEvoDemoScene(dctx, cv)` + fx 层(destination-out 渐隐 + 粒子 update/draw,不缩放或 1.5× 锚定主角); `_evoRaf = requestAnimationFrame(evoFrame)`

`function drawEvoDemoScene(dctx, cv)`: 复用背景 `_bgTile` 平铺 + 网格 + `PLAYER_SHEETS[classId]` 主角精灵帧(土系 sizeMul=1.5 → dstH/dstW ×1.5); 按 phase 绘制:
- charge(0-1.0s): 主角身周聚集职业色光效(createRadialGradient,职业色见 RES_DEMO_COLOR[elem])
- awaken(1.0-1.5s): 全屏职业色叠加(fillRect 全屏 rgba(职业色, 0.3×(1-t)))
- ultimate(1.5-5.0s): 按 classId 分支(见改动 3)
- fade(5.0-6.0s): 所有特效 alpha ×= (1-(phaseT)/1.0) 渐隐
- mobs 绘制(复用共鸣 mob 精灵绘制: getEMFrame + drawImage)

**why**: 独立 modal/scene/frame 变量避免与共鸣演示 `_demoScene`/`_demoRaf`/`_demoClock` 冲突;particles 复用同一全局数组机制(两弹窗不会同时打开)。复用 `#evoDemoModal` 的 `.res-demo-panel` CSS 类,零样式改动。
**how**: 补丁在 12948 行 `}` 之后、12949 行注释之前插入整块函数定义。变量声明(`let _evoDemoScene...`)插入在 `let _demoScene` 声明附近(需 Grep 定位)。

### 改动 3: 5 职业终极技视觉(ultimate 阶段 1.5-5.0s)
**位置**: drawEvoDemoScene 的 ultimate 分支
**视觉设计**(基于 evo.apply 实战效果):
- **金·万剑归宗**(metal):
  - 飞剑环绕: 5 柄飞剑绕主角轨道运动(ang += dt×3, r=70, 绘制剑形=细长三角形 #fff0a0 + 拖尾)
  - 天降剑雨: 从屏幕顶部(y=-20)向各 mob 位置发射垂直白金光线(lineWidth 3, strokeStyle #fff0a0, 带 lighter 辉光),每 0.3s 一波(5 道光线打向 5 个随机 x)
  - mobs 受击飘字(金色伤害 #ffd060)
- **木·森罗万象**(wood):
  - 全屏毒雾: 半透绿色覆盖层(rgba(60,180,80,0.28) fillRect 全屏 + 流动噪点:多个小椭圆 rgba(80,200,100,0.15) 随时间漂移)
  - 荆棘生长: 地面生长绿色藤蔓(从 groundY 向上的多段折线 #4a8a3a,每 0.5s 新增一丛,丛高随时间增长)
  - 毒素飘字(绿色持续伤害 #6fc060)
- **水·深海高压**(water):
  - 水龙卷: 主角身周旋转的蓝色螺旋(3-4 层旋转椭圆,strokeStyle #4a9eff,ang 随时间旋转,ry 随高度递减形成漏斗)
  - 水盾环: 同心圆波纹(从主角向外扩散的蓝色圆环 stroke,每 2.5s 一波,r 从 0 扩到 200,对应 evo.bonus 水盾间隔)
  - 水花粒子(蓝色上升水滴,lighter 混合)
- **火·红莲业火**(fire):
  - 岩浆扩散: 从主角向外扩散的橙红圆(createRadialGradient #ff6020→透明,r 随时间扩到 280 后重置,循环)
  - 余烬粒子: 上升的橙色火星(lighter 混合,向上飘散的橙黄粒子 #ffa040,生成率每帧 2 颗)
  - 焦土: 地面橙红灼烧带(rgba(180,80,30,0.4) 横条 fillRect 覆盖 groundY 附近)
- **土·不动明王**(earth):
  - 大体型角色: drawEvoDemoScene 绘制主角时 dstH/dstW ×1.5(对应 sizeMul=1.5),体现「不动明王」巨体
  - 震地冲击波: 从主角脚下向外扩散的土黄环(strokeStyle #c9a227,lineWidth 4,r 从 0 扩到 300,每 3s 一波对应 earthStompInterval)
  - 屏幕震动: phase='ultimate' 时画面整体偏移(dctx.save + translate(shakeX,0), shakeX=(Math.random()-0.5)×8,每帧随机,完成后 restore)

### 改动 4: CSS(零改动)
**决策**: `renderEnhEvolution` 按钮直接用 `class="res-demo-btn"`(复用共鸣按钮 CSS),文字「🎬 视频介绍」。`#evoDemoModal` 复用 `.res-demo-panel/.res-demo-head/.res-demo-stage/.res-demo-hint` 全套样式。**无需修改 style.css**。

## 假设与决策
1. **独立 modal**: 新建 `#evoDemoModal` 而非复用 `#resDemoModal`,避免画布/状态冲突。两弹窗不会同时打开(openEvoDemo 先 closeEvoDemo,openResDemo 先 closeResDemo)。
2. **独立 scene/frame 变量**: `_evoDemoScene`/`_evoRaf`/`_evoClock`/`_evoParts` 独立于 `_demoScene`/`_demoRaf`/`_demoClock`/`_demoParts`。
3. **particles 复用机制**: 终极演示也借用全局 `particles` 数组(保存原值→替换→恢复),与共鸣演示同机制。因两弹窗不同时打开,无冲突。
4. **6s 循环 + 4 阶段**: `EVO_DEMO_LOOP=6`(与 RES_DEMO_LOOP 一致),阶段 charge 1.0s + awaken 0.5s + ultimate 3.5s + fade 1.0s = 6.0s。
5. **视觉差异化**: 5 职业各自独立 ultimate 分支,体现 evo.apply 实战效果差异。
6. **按钮样式复用**: 用 `class="res-demo-btn"`,零 CSS 改动。
7. **土系大体型**: drawEvoDemoScene 绘制主角时,`if (classId==='earth') { dstH *= 1.5; dstW *= 1.5; }`(对应 sizeMul=1.5)。
8. **fx 层不缩放或 1.5× 锚定主角**: 共鸣演示 fx 层 1.8× 锚定主怪;终极演示 fx 层锚定主角(S.px, GY-34),1.5× 缩放(适配终极技以主角为中心的视觉)。

## 验证步骤
1. **备份**: 实施前复制 main.js → `%TEMP%\main_before_evo_demo.js`
2. **打补丁**: 用补丁脚本应用改动 1(renderEnhEvolution 按钮)+改动 2(openEvoDemo/closeEvoDemo/evoFrame/drawEvoDemoScene 插入)+改动 3(5 职业 ultimate 分支)。补丁串禁止 `\n`→`\r\n` 转换,写入用 `newline=''`。
3. **无头验证**: Edge headless 打开 index.html → 切到强化图鉴 → evolution tab → 点击每张卡片「🎬 视频介绍」→ 队列式 rAF 劫持泵帧 → 截图 5 个职业 ultimate 阶段(约 phaseT=1.75s 即 _evoClock≈3.25s,帧号≈195)
4. **回归**: 15 条共鸣演示回归(openResDemo 5 条×3 仍正常)+ 强化图鉴 5 tab 切换正常 + 终极进化 5 卡片按钮均可点击弹出
5. **目检**: 5 张截图确认 5 职业终极技视觉差异(金=白金剑雨线、木=绿色毒雾覆盖、水=蓝色螺旋龙卷、火=橙红岩浆扩散、土=土黄震地环+大体型角色)
6. **清理**: 删除临时测试文件,更新 project_memory.md 追加「终极进化视频介绍」条目
