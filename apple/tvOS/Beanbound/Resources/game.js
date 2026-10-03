
(() => {
  'use strict';

  // ---------- setup ----------
  const cv = document.getElementById('c');
  let ctx = cv.getContext('2d');       // (swapped briefly to draw the evolution previews)
  const $ = id => document.getElementById(id);
  const splashEl = $('developerSplash');
  const hudEl = $('hud'), scoreEl = $('score'), hudBest = $('hudBest'), muteBtn = $('mute'), hintEl = $('hint');
  const waterEl = $('water'), waterFill = $('waterFill'), layerPill = $('layerPill'), abilityPill = $('abilityPill');
  const startEl = $('start'), overEl = $('over'), howEl = $('how'), evosEl = $('evos'), pauseEl = $('pause'), countEl = $('count'), settingsEl = $('settings'), endlessInfoEl = $('endlessInfo'), aboutEl = $('about');
  const victoryRoomEl = $('victoryRoom'), moonSceneEl = $('moonScene');
  const whatsNewEl = $('whatsNew');
  const updatesInfoEl = $('updatesInfo');
  const hapticToggle = $('hapticToggle'), soundToggle = $('soundToggle'), tvToggle = $('tvToggle');

  // ---------- version / what's new ----------
  // Change these two values when releasing an update. Keep the changelog text here
  // so it is quick to edit without touching the update-board logic.
  const CURRENT_VERSION = '1.0.7';
  const CHANGELOG = [
    'The game is out!',
    'The goal is to reach space, how far can you grow?',
    'Auto updates, you only need to manually update for events!'
  ];
  const SAVED_VERSION_KEY = 'beanbound2-version';
  const SAVED_CHANGELOG_KEY = 'beanbound2-changelog';

  function getSavedVersion() {
    try { return localStorage.getItem(SAVED_VERSION_KEY); } catch (e) { return null; }
  }

  function getSavedChangelog() {
    try { return localStorage.getItem(SAVED_CHANGELOG_KEY); } catch (e) { return null; }
  }

  function getChangelogSignature() {
    return JSON.stringify(CHANGELOG);
  }

  function saveCurrentVersion() {
    try {
      localStorage.setItem(SAVED_VERSION_KEY, CURRENT_VERSION);
      localStorage.setItem(SAVED_CHANGELOG_KEY, getChangelogSignature());
    } catch (e) {}
  }

  function showWhatsNewIfNeeded() {
    const savedVersion = getSavedVersion();
    const savedChangelog = getSavedChangelog();
    const currentChangelog = getChangelogSignature();

    // Brand-new launch: silently save the current version/changelog and go straight to the menu.
    if (!savedVersion) {
      saveCurrentVersion();
      return false;
    }

    // Existing players from the older version system may not have a saved changelog yet.
    // Treat that as an update so changing CHANGELOG actually triggers the board.
    if (savedChangelog === null || savedVersion !== CURRENT_VERSION || savedChangelog !== currentChangelog) {
      openWhatsNew();
      return true;
    }

    return false;
  }

  let whatsNewReturn = 'menu';

  function openWhatsNew(returnTo = 'menu') {
    whatsNewReturn = returnTo;
    $('whatsNewDismiss').textContent = returnTo === 'settings' ? 'Back to Settings' : 'Continue';
    $('whatsNewVersion').textContent = 'Version ' + CURRENT_VERSION;
    const list = $('whatsNewList');
    list.innerHTML = '';

    if (CHANGELOG.length) {
      CHANGELOG.forEach(text => {
        const item = document.createElement('div');
        item.className = 'whats-new-item';
        item.textContent = text;
        list.appendChild(item);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'whats-new-empty';
      empty.textContent = 'Thanks for playing!';
      list.appendChild(empty);
    }

    hide(startEl);
    show(whatsNewEl);
  }

  function dismissWhatsNew() {
    saveCurrentVersion();
    hide(whatsNewEl);
    if (whatsNewReturn === 'settings') {
      show(settingsEl);
      updateSettingsUI();
      return;
    }
    show(startEl);
    initAudio();
    startMusic();
  }

  let W = 360;                   // world width: 360 in portrait, wider on a phone held sideways
  let H = 640;                   // world height (depends on screen)
  let scale = 1, offX = 0, dpr = 1, vw = 360, vh = 640;
  let viewL = -40, viewR = 400;      // left/right edges of what's visible, in world units
  let TIPF = 0.62, SPDM = 1;         // where the tip sits on screen; speed factor (slower when the screen is short)

  const INK = '#12302C';
  const RAD = 16;                // bean visual radius
  const HIT = 12;                // bean hit radius (a little forgiving)

  // The world, bottom to top: dirt (rocks) -> ground (birds) -> sky (clouds and stuff) -> space (the end)
  const UNIT = 1.5;                                  // world px per meter
  const M = m => m * UNIT;
  const DIRT_M = 3000, GROUND_M = 15000, END_M = 100000;
  const DIRT_PX = M(DIRT_M), GROUND_PX = M(GROUND_M), END_PX = M(END_M);
  const GY = -DIRT_PX;                               // world y of the grass line, the surface
  const LAYERS = [{ name: 'Dirt', m: 0 }, { name: 'Ground', m: DIRT_M }, { name: 'Sky', m: GROUND_M }, { name: 'Space', m: END_M }];
  const fmt = n => Math.round(n).toLocaleString('en-US');
  function hash(a, b) { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }
  function skyT(d) {                                 // how far through the sky colors we are
    if (d <= DIRT_PX) return 0;
    if (d <= GROUND_PX) return 0.3 * (d - DIRT_PX) / (GROUND_PX - DIRT_PX);
    return 0.3 + 0.7 * Math.min(1, (d - GROUND_PX) / (END_PX - GROUND_PX));
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const smooth = (t, a, b) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')';

  // The climb: forest floor -> golden dawn -> morning sky -> dusk -> moonlit night
  const SKY = [
    { t: 0,    top: hex('#3C8C7C'), bot: hex('#143D3A') },
    { t: 0.3,  top: hex('#F7C77E'), bot: hex('#E98F6F') },
    { t: 0.55, top: hex('#8CCBF2'), bot: hex('#FBE3C4') },
    { t: 0.8,  top: hex('#2C2A6E'), bot: hex('#6E5DB8') },
    { t: 1,    top: hex('#0B0A26'), bot: hex('#2A2160') }
  ];
  function skyAt(t) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (t <= b.t) { const k = (t - a.t) / (b.t - a.t); return [mix(a.top, b.top, k), mix(a.bot, b.bot, k)]; }
    }
    const l = SKY[SKY.length - 1];
    return [mix(l.top, l.top, 0), mix(l.bot, l.bot, 0)];
  }
  const STARFIELD = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.6, 1.9), p: rand(0, 6) }));
  const CLOUDS = Array.from({ length: 8 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.7, 1.6) }));
  const FLIES = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.5, 1.4), p: rand(0, 6) }));
  const TRUNKS = [{ x: 0.06, w: 46 }, { x: 0.3, w: 62 }, { x: 0.63, w: 40 }, { x: 0.9, w: 68 }];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    updateTvScale();
    cv.width = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
    const oldW = W;
    const land = vw > vh * 1.15;      // always use landscape layout whenever the viewport is wider than it is tall
    if (land) {
      scale = vh / 460;
      W = Math.round(vw / scale);
      TIPF = 0.72; SPDM = 0.75;                    // less look-ahead, so ease the pace to match
    } else {
      scale = Math.min(vw / 360, vh / 560);
      W = 360;
      TIPF = 0.62; SPDM = 1;
    }
    offX = (vw - W * scale) / 2;
    H = vh / scale;
    viewL = -offX / scale - 40;
    viewR = (vw - offX) / scale + 40;
    if (state === 'menu') { reset(); menuInit(); }
    else if (state === 'intro') { if (W !== oldW) { reset(); introT = 0; } }
    else { if (W !== oldW) relayout(oldW); cam = P.y - H * TIPF; }
  }

  // Keep checking the viewport so PC window resizing and device rotation are detected reliably.
  let lastVW = window.innerWidth, lastVH = window.innerHeight;
  function checkViewport() {
    const curVW = window.innerWidth, curVH = window.innerHeight;
    if (curVW !== lastVW || curVH !== lastVH) {
      lastVW = curVW; lastVH = curVH;
      resize();
    }
  }
  window.addEventListener('resize', checkViewport);
  window.addEventListener('orientationchange', () => setTimeout(checkViewport, 50));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', checkViewport);
  setInterval(checkViewport, 100);

  // Rotating the phone mid-run: recentre the plant and keep everything reachable
  function relayout(oldW) {
    const dx = (W - oldW) / 2;
    P.x = clamp(P.x + dx, 16, W - 16); tx = clamp(tx + dx, 16, W - 16);
    if (ptr) ptr.spx += dx;
    for (const q of trail) q.x += dx;
    for (const l of leaves) l.x += dx;
    for (const q of parts) q.x += dx;
    for (const f of floaters) f.x += dx;
    for (const d of drops) d.x = clamp(d.x + dx, 22, W - 22);
    for (const o of obst) {
      if (o.t === 'wall') o.gx = clamp(o.gx + dx, o.gw / 2 + 16, W - o.gw / 2 - 16);
      else {
        if (o.x !== undefined) o.x = clamp(o.x + dx, 40, W - 40);
        if (o.x0 !== undefined) o.x0 = clamp(o.x0 + dx, 40, W - 40);
      }
    }
    lastGapX = clamp(lastGapX + dx, 60, W - 60);
  }

  // ---------- audio ----------
  let AC = null, muted = false;
  function initAudio() {
    try {
      if (!AC) {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        // On a wrapped WebView (game apps typically allow autoplay) this
        // flips to 'running' on its own; on a strict browser it only does
        // so once the tap-to-start fallback below runs. Either way, hide
        // the hint the moment it actually happens.
        AC.addEventListener('statechange', () => {
          if (AC.state === 'running') { const h = $('musicHint'); if (h) h.hidden = true; }
        });
      }
      if (AC.state === 'suspended') AC.resume();
    } catch (e) {}
  }
  function tone(f1, f2, dur, type, vol) {
    if (!AC || muted) return;
    try {
      const t = AC.currentTime;
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(f2, 30), t + dur);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(AC.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  const sfx = {
    drop:   c => { const f = 620 * (1 + 0.07 * Math.min(c, 8)); tone(f, f * 1.6, 0.11, 'sine', 0.08); },
    sun:    () => { tone(660, 990, 0.16, 'triangle', 0.09); setTimeout(() => tone(990, 1480, 0.2, 'triangle', 0.08), 90); },
    shield: () => tone(520, 180, 0.22, 'square', 0.06),
    zap:    () => tone(180, 40, 0.28, 'sawtooth', 0.09),
    warn:   () => tone(540, 540, 0.05, 'square', 0.02),
    mile:   () => { tone(523, 523, 0.1, 'triangle', 0.08); setTimeout(() => tone(659, 659, 0.1, 'triangle', 0.08), 90); setTimeout(() => tone(784, 784, 0.2, 'triangle', 0.08), 180); },
    rain:   () => { tone(900, 1500, 0.16, 'sine', 0.04); },
    die:    () => tone(420, 70, 0.55, 'sine', 0.11),
    whoosh: () => tone(1200, 240, 1.05, 'sine', 0.025),
    thud:   () => { tone(150, 45, 0.25, 'sine', 0.16); tone(90, 40, 0.3, 'triangle', 0.1); },
    dig:    () => tone(220 + Math.random() * 60, 90, 0.07, 'sawtooth', 0.03),
    pop:    () => tone(380, 900, 0.18, 'triangle', 0.09),
    dive:   () => tone(420, 80, 1.1, 'sawtooth', 0.03),
    evolve: () => { [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f * 1.02, 0.22, 'triangle', 0.09), i * 90)); },
    win:    () => { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, f, 0.32, 'triangle', 0.09), i * 130)); },
    stage:  () => { tone(440, 660, 0.14, 'triangle', 0.08); setTimeout(() => tone(660, 990, 0.2, 'triangle', 0.08), 110); }
  };
  let haptics = true;
  let gameplayHintsSetting = true;
  let autoPauseSetting = true;
  try { haptics = localStorage.getItem('beanbound2-haptics') === 'on'; } catch (e) {}
  try { muted = localStorage.getItem('beanbound2-muted') === 'on'; } catch (e) {}
  try { gameplayHintsSetting = localStorage.getItem('beanbound2-hints') !== 'off'; } catch (e) {}
  try { autoPauseSetting = localStorage.getItem('beanbound2-autopause') !== 'off'; } catch (e) {}
  function saveSetting(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function buzz(ms) { try { if (haptics && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // TV mode: on by itself in a tvOS browser, or with ?tv=1 / ?tv=0, or from Settings (remembered).
  const TV_KEY = 'beanbound2-tv';
  let tvMode = true;             // this is the Apple TV build: TV mode is always on
  let navUsed = false;           // true once the keyboard/remote/controller has been used to move around the menus
  let padX = 0;                  // analog / d-pad steering from a game controller or the Siri Remote surface (-1..1)
  const hintSteer = () => tvMode ? 'Use the remote to steer. Catch raindrops!' : 'Drag to steer. Catch raindrops!';
  const hintSkip = () => tvMode ? 'Press Select to skip' : 'Tap to skip';

  // ---------- state ----------
  let state = 'menu';            // menu | play | over | victory | moon
  let P, tx = W / 2, ptr = null, hinted = false;
  let trail, leaves, obst, drops, parts, floaters, showers;
  let cam = 0, dist = 0, water = 100, shield = false, shieldTime = 0, invuln = 0, bonus = 0, time = 0, tmNow = 0;
  let ability = null, abilityTime = 0;
  const ABILITY_DURATION = 12;
  const ABILITY_POOL = [['dehydration', 55], ['big', 12], ['small', 12], ['slow', 10], ['fast', 11]];
  let spawnDist = 0, nextShower = 0, nextMile = 0, lastGapX = W / 2, leafSide = 1, lastLeafDist = 0;
  let comboN = 0, comboT = -9, wasShower = false;
  let introT = 0, landed = false, popped = false, mound = 0, shake = 0, seed = null, digT = 0;
  let dived = false, landed2 = false, coat = false, won = false, layer = 0, curEvo = 0, cdT = 0, runStartM = 0;
  let mnT = 0, mnAcc = { leaf: 0, curl: 0, flower: 0, pod: 0 }, menuFade = 1;
  let stage = 0, lastCurlDist = 0, lastFlowerDist = 0, lastPodDist = 0;
  let victoryX = 0, victoryDone = false;
  const VICTORY_SPEED = 210;

  // How grown the plant looks: features unlock with height (in meters)
  const STAGES = [{ m: 0, name: 'Seedling' }, { m: 1200, name: 'Vining!' }, { m: 9000, name: 'Flowering!' }, { m: 30000, name: 'Bean pods!' }];
  const FLOWER_COLS = ['#FFFFFF', '#FF9EC4', '#C6A8FF'];

  // The evolutions, first to last. Reaching a height unlocks that form for good.
  const E = o => Object.assign({ leaf: '#5FD38D', vein: '#2FA35F', bud: ['#E4FFB8', '#A6EE8F'], ls: 1, shape: 'oval', crown: 'none', glow: null, fx: null }, o);
  const EVOS = [
    E({ name: 'Sprout', m: 0, layer: 'Dirt', ls: 0.9, desc: 'A tiny two-leaf bud, still folded up in the soil.' }),
    E({ name: 'Seedling', m: 1500, layer: 'Dirt', ls: 1.05, leaf: '#4FCB86', crown: 'curl', desc: 'Bigger seed leaves and a curl of new growth on top.' }),
    E({ name: 'Twiner', m: 4000, layer: 'Ground', ls: 1.1, leaf: '#43C47A', vein: '#23864F', shape: 'point', crown: 'tendrils', desc: 'Pointed leaves and springy tendrils that grab at anything to climb.' }),
    E({ name: 'Blossom', m: 8000, layer: 'Ground', ls: 1.15, shape: 'point', crown: 'flower', desc: 'A pink bean flower blooms right on top of the bud.' }),
    E({ name: 'Podling', m: 18000, layer: 'Sky', ls: 1.2, shape: 'point', crown: 'pods', desc: 'A white flower and plump little bean pods hang from the shoot.' }),
    E({ name: 'Cloud Climber', m: 28000, layer: 'Sky', ls: 1.25, shape: 'point', leaf: '#BFE8FF', vein: '#6FA9D6', bud: ['#FFFFFF', '#DDEBFF'], crown: 'puff', fx: 'puff', desc: 'Sky-blue leaves and a fluffy cloud hat. It leaves soft puffs behind.' }),
    E({ name: 'Sun Vine', m: 42000, layer: 'Sky', ls: 1.3, shape: 'point', leaf: '#FFD86B', vein: '#E0A93B', bud: ['#FFF3B8', '#FFD86B'], crown: 'sun', glow: '255,216,107', fx: 'sun', desc: 'Golden leaves and a sunflower crown that glows warm.' }),
    E({ name: 'Stormbloom', m: 58000, layer: 'Sky', ls: 1.3, shape: 'point', leaf: '#9C7CFF', vein: '#5B3FD0', bud: ['#E4D8FF', '#B79BFF'], crown: 'bolt', glow: '143,216,255', fx: 'spark', desc: 'Violet leaves crackling with electric sparks and a lightning-bolt crest.' }),
    E({ name: 'Moonbean', m: 78000, layer: 'Sky', ls: 1.35, shape: 'point', leaf: '#E8EEFF', vein: '#8F9FD6', bud: ['#FFFFFF', '#DCE4FF'], crown: 'moon', glow: '220,228,255', fx: 'moon', desc: 'Silver leaves and a crescent-moon crown, dusted with starlight.' }),
    E({ name: 'Star Bean', m: 100000, layer: 'Space', ls: 1.4, shape: 'point', leaf: 'rainbow', vein: '#FFFFFF', bud: ['#FFFDE0', '#FFE9A0'], crown: 'star', glow: '255,240,160', fx: 'star', desc: 'The final form: rainbow leaves, a golden star crown and a trail of stardust.' })
  ];
  let score = 0, lastScore = -1, lastWater = -1, lastShownBest = -1, lastHmShown = -99, lastLayerShown = -1;
  const keys = { l: false, r: false };
  let best = 0, maxM = 0;      // best score, and the furthest height ever reached (unlocks evolutions)
  try { best = parseInt(localStorage.getItem('beanbound2-best') || '0', 10) || 0; } catch (e) {}
  try { maxM = parseInt(localStorage.getItem('beanbound2-maxm') || '0', 10) || 0; } catch (e) {}

  // Progress is kept in this browser right away, and also in the viewer's private record in the
  // artifact's database when that's available, so it survives across sessions.
  let bestRef = null, saveChain = Promise.resolve();
  function setLocalProgress() {
    try { localStorage.setItem('beanbound2-best', String(best)); localStorage.setItem('beanbound2-maxm', String(maxM)); } catch (e) {}
  }
  function saveProgress() {
    setLocalProgress();
    if (!bestRef) return;
    saveChain = saveChain.then(() => bestRef.set({ best, maxM })).catch(() => {});      // one write at a time
  }
  async function initSavedBest() {
    try {
      if (!(window.claude && typeof window.claude.use === 'function')) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      const ref = db.doc('data/users/' + uid + '/beanbound');
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : null;
      const savedBest = data && typeof data.best === 'number' ? data.best : 0;
      const savedM = data && typeof data.maxM === 'number' ? data.maxM : 0;
      bestRef = ref;
      const newBest = Math.max(best, savedBest), newM = Math.max(maxM, savedM);
      const changedHere = newBest !== best || newM !== maxM;
      best = newBest; maxM = newM;
      if (changedHere) { setLocalProgress(); updateBestStart(); updateHud(true); if (!evosEl.classList.contains('hidden')) buildEvos(); }
      if (best > savedBest || maxM > savedM) saveProgress();      // carry older on-device progress into the saved record
    } catch (e) {}
  }

  const diff = () => Math.min(dist / M(60000), 1);
  const maturity = () => Math.min(dist / M(50000), 1);   // 0 at the start, 1 high in the sky

  function reset() {
    P = { x: W / 2, y: 30, vx: 0, ang: 0, sq: 0, open: 0 };   // the shoot starts deep in the dirt, inside its seed
    tx = W / 2; dist = 0; water = 100; shield = false; shieldTime = 0; invuln = 0; bonus = 0; time = 0;
    ability = null; abilityTime = 0;
    score = 0; lastScore = -1; lastWater = -1; lastShownBest = -1; lastHmShown = -99; lastLayerShown = -1;
    comboN = 0; comboT = -9; wasShower = false; won = false; layer = 0; curEvo = 0; runStartM = maxM;
    trail = [{ x: W / 2, y: 36, d: 0 }];
    leaves = []; obst = []; drops = []; parts = []; floaters = []; showers = [];
    stage = 0; lastCurlDist = 0; lastFlowerDist = 0; lastPodDist = 0;
    spawnDist = 560; nextShower = 5000; nextMile = M(5000); lastGapX = W / 2; leafSide = 1; lastLeafDist = 0;
    cam = GY - H * 0.62;
    seed = { x: W / 2, y: cam - 90, y0: cam - 90, rot: 0, sq: 0, mood: 'fall', vis: true, clip: true };
    introT = 0; landed = false; popped = false; dived = false; landed2 = false; coat = false; mound = 0; shake = 0; digT = 0;
    spawnAhead();
    updateHud(true);
  }

  // ---------- level generation ----------
  function pick(pool) {
    let s = 0; for (const p of pool) s += p[1];
    let r = Math.random() * s;
    for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
    return pool[0][0];
  }
  function dropArc(cx, y, n, dir) {
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0.5;
      drops.push({ x: clamp(cx + Math.sin(k * Math.PI) * 26 * dir, 22, W - 22), y: y - i * 32, kind: 'water', ph: rand(0, 6) });
    }
  }
  function mkCrow(y, dir, d) {
    return { t: 'crow', x: rand(50, W - 50), y, dir, sp: (70 + d * 70 + rand(0, 25)) * (W / 360), ph: rand(0, 6) };
  }
  function spawnRow() {
    const sp = spawnDist;
    if (sp > END_PX + 400) { spawnDist += 600; return; }          // nothing past the edge of space
    if (sp >= nextShower && sp < END_PX - 3000) {
      showers.push({ y0: -(sp + 320), y1: -sp, under: sp < DIRT_PX });
      nextShower += 5000; spawnDist += 420;
      return;
    }
    const d = Math.min(sp / M(60000), 1);
    const L = sp < DIRT_PX ? 0 : sp < GROUND_PX ? 1 : 2;
    const lp = L === 0 ? sp / DIRT_PX : L === 1 ? (sp - DIRT_PX) / (GROUND_PX - DIRT_PX) : Math.min((sp - GROUND_PX) / M(30000), 1);
    const y = -sp;
    const dir = Math.random() < 0.5 ? -1 : 1;
    let pool;
    if (L === 0) pool = [['rockwall', 3], ['boulders', 3], ['rest', 1]];                                   // dirt: rocks
    else if (L === 1) pool = [['crow', 3], ['crows2', 2 + (lp > 0.3 ? 1 : 0)], ['rest', 1]];               // ground: birds
    else pool = [['cloudwall', 3], ['storm', 2], ['balloon', 3], ['rest', 1]];               // sky: clouds and stuff
    const kind = pick(pool);
    if (kind === 'rockwall' || kind === 'cloudwall') {
      const gw = (kind === 'rockwall' ? 165 : 175) - lp * 55;
      const gx = clamp(lastGapX + rand(-130, 130), gw / 2 + 16, W - gw / 2 - 16);
      lastGapX = gx;
      obst.push({ t: 'wall', skin: kind === 'rockwall' ? 'rock' : 'cloud', y, gx, gw, seed: rand(0, 1000) });
      if (Math.random() < 0.7) dropArc(gx, y - 50, 3, dir);
      else drops.push({ x: gx, y, kind: 'water', ph: rand(0, 6) });
    } else if (kind === 'boulders') {
      const count = Math.max(2, Math.round((2 + (lp > 0.45 ? 1 : 0)) * W / 360));
      const placed = [];
      for (let n = 0, tries = 0; n < count && tries < 40; tries++) {
        const r = rand(22, 34), x = rand(r + 6, W - r - 6);
        if (placed.every(b => Math.abs(x - b.x) >= r + b.r + 100)) { placed.push({ x, y: y + rand(-26, 26), r }); n++; }
      }
      for (const b of placed) obst.push({ t: 'boulder', x: b.x, y: b.y, r: b.r, seed: rand(0, 1000) });
      let dx = W / 2;
      for (let i = 0; i < 12; i++) { const cx = rand(30, W - 30); if (placed.every(b => Math.abs(cx - b.x) > b.r + 44)) { dx = cx; break; } }
      if (Math.random() < 0.75) dropArc(dx, y - 60, 3, dir);
    } else if (kind === 'crow') {
      obst.push(mkCrow(y, dir, d));
      if (Math.random() < 0.7) dropArc(rand(40, W - 40), y - 70, 3, dir);
    } else if (kind === 'crows2') {
      obst.push(mkCrow(y - 46, 1, d), mkCrow(y + 46, -1, d));
      if (Math.random() < 0.6) dropArc(rand(60, W - 60), y - 110, 3, dir);
    } else if (kind === 'storm') {
      const x = rand(70, W - 70);
      obst.push({ t: 'storm', x, y, ph: rand(0, 2.8), prev: 'idle' });
      if (Math.random() < 0.75) dropArc(clamp(x + dir * 62, 24, W - 24), y + 190, 3, -dir);
    } else if (kind === 'balloon') {
      const x0 = rand(80, W - 80);
      obst.push({ t: 'balloon', x0, x: x0, y, amp: Math.min(120, W * 0.32), sp: rand(0.5, 0.9), ph: rand(0, 6) });
      if (Math.random() < 0.7) dropArc(clamp(x0 + dir * 110, 30, W - 30), y - 40, 3, -dir);
    } else {
      dropArc(rand(50, W - 50), y, 4, dir);
    }
    if (!shield && sp > 300 && Math.random() < 0.1) drops.push({ x: rand(40, W - 40), y: y - 120, kind: 'sun', ph: rand(0, 6) });
    // Seed Packs are intentionally extremely rare: roughly one chance per several hundred rows.
    if (sp > 2500 && Math.random() < 0.0015) {
      drops.push({ x: rand(40, W - 40), y: y - 145, kind: 'seedpack', ph: rand(0, 6) });
    }
    spawnDist += rand(190, 250) - d * 45;
  }
  function spawnAhead() {
    let guard = 0;
    while (spawnDist < dist + H + 320 && guard++ < 60) spawnRow();
  }
  function stormPhase(o) {
    const p = (time + o.ph) % 2.8;
    return p < 1.6 ? 'idle' : p < 2.4 ? 'warn' : p < 2.65 ? 'strike' : 'fade';
  }
  // A rock or cloud wall is a row of overlapping blobs on each side of a gap. Walking outward from the gap
  // keeps the opening exactly as wide as intended, and the wall reaches whatever width the screen has.
  function wallBlobs(o, from, to, cb) {
    const rock = o.skin === 'rock';
    const r0 = rock ? 22 : 30, rv = rock ? 11 : 12, vy = rock ? 5 : 8;
    const gl = o.gx - o.gw / 2, gr = o.gx + o.gw / 2;
    let edge = gl;
    for (let i = 0; i < 80; i++) {
      const r = r0 + hash(o.seed, i) * rv, cx = edge - r;
      if (cx + r < from) break;
      cb(cx, o.y + (hash(o.seed, i + 50) - 0.5) * 2 * vy, r, i);
      edge -= r * 1.3;
    }
    edge = gr;
    for (let i = 0; i < 80; i++) {
      const r = r0 + hash(o.seed, i + 200) * rv, cx = edge + r;
      if (cx - r > to) break;
      cb(cx, o.y + (hash(o.seed, i + 250) - 0.5) * 2 * vy, r, i + 200);
      edge += r * 1.3;
    }
  }

  // ---------- effects ----------
  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.4, 1) * spd;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 1, r: rand(2, 4), c: color });
    }
  }
  function stepFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt; q.life -= 1.8 * dt;
      if (q.life <= 0) parts.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y -= 38 * dt; f.life -= 1.1 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

  // ---------- abilities ----------
  function abilityLabel(a) {
    return a === 'dehydration' ? 'Dehydration' :
      a === 'big' ? 'Big' :
      a === 'small' ? 'Small' :
      a === 'slow' ? 'Slow' :
      a === 'fast' ? 'Fast' : '';
  }
  function abilityScale() {
    if (ability === 'big') return 1.45;
    if (ability === 'small') return 0.65;
    return 1;
  }
  function abilitySpeed() {
    if (ability === 'slow') return 0.65;
    if (ability === 'fast') return 1.45;
    return 1;
  }
  function abilityWaterDrain() {
    return ability === 'dehydration' ? 2 : 1;
  }
  function updateAbilityUI() {
    if (!ability || abilityTime <= 0) {
      abilityPill.classList.add('hidden');
      return;
    }
    abilityPill.classList.remove('hidden');
    abilityPill.textContent = abilityLabel(ability) + ' · ' + Math.ceil(abilityTime) + 's';
  }
  function giveRandomAbility(x, y) {
    ability = pick(ABILITY_POOL);
    abilityTime = ABILITY_DURATION;
    floaters.push({ x, y: y - 28, life: 1.4, text: abilityLabel(ability) + '!' });
    burst(x, y, ability === 'dehydration' ? '#5FC9FF' : '#8BE36A', 14, 220);
    sfx.sun(); buzz(25);
    updateAbilityUI();
  }

  // ---------- gameplay ----------
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
  }
  function findHit() {
    const hitRadius = HIT * abilityScale();
    for (const o of obst) {
      const oy = o.y;
      if (oy > P.y + 400 || oy < P.y - 400) continue;
      if (o.t === 'wall') {
        let hit = false;
        wallBlobs(o, P.x - 80, P.x + 80, (cx, cy, r) => { if (!hit && Math.hypot(P.x - cx, P.y - cy) < r + hitRadius - 3) hit = true; });
        if (hit) return o.skin === 'rock' ? 'rock' : 'cloud';
      } else if (o.t === 'boulder') {
        if (Math.hypot(P.x - o.x, P.y - o.y) < o.r * 0.95 + hitRadius - 4) return 'rock';
      } else if (o.t === 'crow') {
        if (Math.hypot(P.x - o.x, P.y - (o.y + Math.sin(tmNow * 4 + o.ph) * 3)) < hitRadius + 12) return 'crow';
      } else if (o.t === 'balloon') {
        if (Math.hypot(P.x - o.x, P.y - o.y) < hitRadius + 24 || Math.hypot(P.x - o.x, P.y - (o.y + 42)) < hitRadius + 8) return 'balloon';
      } else if (o.t === 'storm') {
        if (stormPhase(o) === 'strike' && circleRect(P.x, P.y, hitRadius, o.x - 15, o.y + 20, 30, 230)) return 'storm';
      }
    }
    return null;
  }
  function hurt(kind) {
    if (invuln > 0) return;
    if (shield) {
      shield = false; invuln = 1.1;
      burst(P.x, P.y, '#FFD86B', 18, 230);
      floaters.push({ x: P.x, y: P.y - 30, life: 1, text: 'Blocked!' });
      sfx.shield(); buzz(30);
      return;
    }
    die(kind);
  }

  function stepPlay(dt) {
    time += dt;
    invuln = Math.max(0, invuln - dt);
    if (shield) {
      shieldTime = Math.max(0, shieldTime - dt);
      if (shieldTime <= 0) shield = false;
    }
    if (ability) {
      abilityTime = Math.max(0, abilityTime - dt);
      if (abilityTime <= 0) ability = null;
      updateAbilityUI();
    }
    P.sq = Math.max(0, P.sq - 5 * dt);
    const ramp = Math.min(1, 0.35 + (time / 1.2) * 0.65);
    const spd = (190 + diff() * 110) * ramp * SPDM * abilitySpeed();

    // steering
    const steer = clamp((keys.r ? 1 : 0) - (keys.l ? 1 : 0) + padX, -1, 1);
    if (steer) tx = clamp(tx + steer * 420 * dt, 16, W - 16);
    const ox = P.x;
    const want = (tx - P.x) * Math.min(1, dt * 9);
    const maxDx = 480 * dt;
    P.x = clamp(P.x + clamp(want, -maxDx, maxDx), 16, W - 16);
    const vx = (P.x - ox) / Math.max(dt, 0.001);
    P.vx += (vx - P.vx) * Math.min(1, dt * 12);
    P.ang += (clamp(P.vx / 420, -0.55, 0.55) - P.ang) * Math.min(1, dt * 12);
    P.y -= spd * dt;
    dist = -P.y;
    cam = P.y - H * TIPF;

    // the stalk grows
    const last = trail[trail.length - 1];
    if (Math.hypot(P.x - last.x, P.y - last.y) >= 7) trail.push({ x: P.x, y: P.y, d: dist });
    while (trail.length > 3 && trail[1].y > cam + H + 140) trail.shift();
    const mat = maturity(), meters = dist / UNIT;
    if (P.y < GY - 8) {          // leaves and blooms only grow above the soil
      if (dist - lastLeafDist >= 70 - 24 * mat) {
        lastLeafDist = dist; leafSide = -leafSide;
        leaves.push({ kind: 'leaf', evo: curEvo, x: P.x, y: P.y, side: leafSide, age: 0, size: (0.75 + 0.75 * mat) * rand(0.9, 1.1), tri: meters >= STAGES[1].m && Math.random() < 0.35 + 0.6 * mat });
      }
      if (meters >= STAGES[1].m && dist - lastCurlDist >= 140) {
        lastCurlDist = dist;
        leaves.push({ kind: 'curl', x: P.x, y: P.y, side: -leafSide, age: 0, size: rand(0.8, 1.2) });
      }
      if (meters >= STAGES[2].m && dist - lastFlowerDist >= 95) {
        lastFlowerDist = dist;
        leaves.push({ kind: 'flower', x: P.x, y: P.y, side: Math.random() < 0.5 ? -1 : 1, age: 0, size: rand(0.9, 1.2), col: FLOWER_COLS[Math.floor(Math.random() * FLOWER_COLS.length)] });
      }
      if (meters >= STAGES[3].m && dist - lastPodDist >= 150) {
        lastPodDist = dist;
        leaves.push({ kind: 'pod', x: P.x, y: P.y, side: Math.random() < 0.5 ? -1 : 1, age: 0, size: rand(0.9, 1.15) });
      }
    }
    for (const l of leaves) l.age += dt;

    // each evolution leaves its own kind of trail
    const ev = EVOS[curEvo];
    if (ev.fx && Math.random() < dt * 26) {
      const q = { x: P.x + rand(-14, 14), y: P.y + rand(0, 26), vx: rand(-20, 20), vy: rand(-30, 30), life: 0.9, r: rand(2, 3.4), c: '#FFFFFF' };
      if (ev.fx === 'puff') { q.vy = rand(10, 40); q.life = 1.1; q.r = rand(3, 6); }
      else if (ev.fx === 'sun') { q.c = '#FFD86B'; q.vy = rand(-40, -5); }
      else if (ev.fx === 'spark') { q.x = P.x + rand(-24, 24); q.y = P.y + rand(-26, 12); q.vx = rand(-90, 90); q.vy = rand(-90, 30); q.life = 0.35; q.r = rand(1.5, 2.6); q.c = Math.random() < 0.5 ? '#8FD8FF' : '#FFE45C'; }
      else if (ev.fx === 'moon') { q.c = '#E8EEFF'; q.vy = rand(20, 60); q.life = 1.2; }
      else if (ev.fx === 'star') { q.c = 'hsl(' + Math.floor(rand(0, 360)) + ',90%,70%)'; q.life = 1.1; q.vy = rand(-20, 50); }
      parts.push(q);
    }

    // water
    water -= (7 + diff() * 6) * dt * SPDM * abilityWaterDrain();
    const sh = showers.find(q => P.y >= q.y0 && P.y <= q.y1);
    const inShower = !!sh;
    if (inShower) {
      water = Math.min(100, water + 46 * SPDM * dt);
      if (Math.random() < dt * 22) parts.push({ x: P.x + rand(-26, 26), y: P.y + rand(-30, 10), vx: rand(-20, 20), vy: rand(-80, -20), life: 0.7, r: rand(1.5, 3), c: '#8FD8FF' });
      if (!wasShower) { sfx.rain(); floaters.push({ x: W / 2, y: P.y - 70, life: 1.1, text: sh.under ? 'Water!' : 'Rain!' }); }
    }
    wasShower = inShower;

    // world
    spawnAhead();
    for (const o of obst) {
      if (o.t === 'crow') {
        const pad = 28;
        o.x += o.dir * o.sp * dt;
        if (o.x < pad) { o.x = pad; o.dir = 1; }
        if (o.x > W - pad) { o.x = W - pad; o.dir = -1; }
      } else if (o.t === 'balloon') {
        o.x = clamp(o.x0 + Math.sin(time * o.sp + o.ph) * o.amp, 40, W - 40);
      } else if (o.t === 'storm') {
        const ph = stormPhase(o);
        if (ph !== o.prev) {
          if (ph === 'warn' && o.y > cam && o.y < cam + H) sfx.warn();
          if (ph === 'strike' && o.y > cam - 100 && o.y < cam + H) { sfx.zap(); buzz(12); }
          o.prev = ph;
        }
      }
    }
    obst = obst.filter(o => o.y < cam + H + 320);
    drops = drops.filter(q => q.y < cam + H + 80);
    leaves = leaves.filter(l => l.y < cam + H + 100);
    showers = showers.filter(q => q.y0 < cam + H + 60);

    // pickups
    for (let i = drops.length - 1; i >= 0; i--) {
      const q = drops[i];
      if (Math.hypot(P.x - q.x, P.y - q.y) < 24) {
        drops.splice(i, 1);
        if (q.kind === 'sun') {
          shield = true; shieldTime = 60; bonus += 100;
          floaters.push({ x: q.x, y: q.y, life: 1, text: '+100' });
          burst(q.x, q.y, '#FFD86B', 12, 200);
          sfx.sun(); buzz(20);
        } else if (q.kind === 'seedpack') {
          giveRandomAbility(q.x, q.y);
        } else {
          water = Math.min(100, water + 18); bonus += 10;
          comboN = (time - comboT < 0.9) ? comboN + 1 : 1; comboT = time;
          P.sq = 1;
          burst(q.x, q.y, '#5FC9FF', 7, 170);
          if (comboN >= 3) floaters.push({ x: q.x, y: q.y - 8, life: 0.8, text: 'x' + comboN });
          sfx.drop(comboN);
        }
      }
    }

    // a marker every 5,000 m
    while (dist >= nextMile && nextMile < END_PX) {
      const m = Math.round(nextMile / UNIT); nextMile += M(5000); bonus += 250;
      floaters.push({ x: W / 2, y: P.y - 100, life: 1.5, text: fmt(m) + ' m' });
      sfx.mile(); buzz(15);
    }

    // new layer of the world
    while (layer < 2 && meters >= LAYERS[layer + 1].m) {
      layer++;
      floaters.push({ x: W / 2, y: P.y - 150, life: 2, text: LAYERS[layer].name + ' layer!' });
      sfx.stage();
    }

    // evolutions
    while (curEvo < EVOS.length - 1 && meters >= EVOS[curEvo + 1].m) { curEvo++; evolveFx(); }

    // hazards
    const h = findHit();
    if (h) hurt(h);
    if (water <= 0 && state === 'play') die('wilt');

    score = Math.floor(meters) + bonus;
    if (dist >= END_PX && state === 'play') {
      // Stop exactly at the milestone so the victory score is 100,000 m, not an overshoot.
      dist = END_PX;
      P.y = -END_PX;
      score = END_M;
      die('win');
      return;
    }
    updateHud(false);
  }

  function updateHud(force) {
    if (score !== lastScore || force) { scoreEl.textContent = fmt(score); lastScore = score; }
    const shownBest = Math.max(best, score);      // the "best" label follows you once you pass it
    if (shownBest !== lastShownBest || force) {
      lastShownBest = shownBest;
      hudBest.hidden = shownBest <= 0;
      hudBest.textContent = 'Best ' + fmt(shownBest);
    }
    const hm = Math.floor(dist / UNIT);
    if (force || hm - lastHmShown >= 7 || layer !== lastLayerShown) {
      lastHmShown = hm; lastLayerShown = layer;
      layerPill.textContent = LAYERS[layer].name + ' · ' + fmt(hm) + ' m';
    }
    const w = Math.round(clamp(water, 0, 100));
    if (w !== lastWater || force) {
      waterFill.style.width = w + '%';
      waterEl.classList.toggle('low', w < 25);
      lastWater = w;
    }
    updateAbilityUI();
  }

  // ---------- flow ----------
  const INTRO_END = 4.6;
  const SURF_REST = GY - 13, DEEP_REST = 14;
  const easeIO = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  function impact() {
    landed = true;
    seed.sq = 1; shake = 1;
    seed.rot = ((seed.rot % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    burst(W / 2 - 10, GY, '#8A5A3C', 12, 210);
    burst(W / 2 + 10, GY, '#5FD38D', 6, 170);
    sfx.thud(); buzz(25);
  }

  // Cutscene: a seed drops from the sky, digs itself in, tunnels down to the very bottom, and sprouts.
  function stepIntro(dt) {
    introT += dt;
    const t = introT;
    seed.sq = Math.max(0, seed.sq - 4 * dt);
    const camS = GY - H * 0.62, camE = -H * TIPF;
    if (t < 1.15) {
      const k = t / 1.15;
      seed.y = seed.y0 + (SURF_REST - seed.y0) * k * k;
      seed.rot += 3.4 * dt; seed.mood = 'fall'; cam = camS;
    } else if (t < 1.6) {
      if (!landed) impact();
      const k = (t - 1.15) / 0.45;
      seed.y = SURF_REST - Math.sin(k * Math.PI) * 14;
      seed.rot *= 1 - Math.min(1, dt * 10);
      seed.mood = 'happy'; cam = camS;
    } else if (t < 2.4) {
      const k = (t - 1.6) / 0.8, e = k * k * (3 - 2 * k);
      seed.y = SURF_REST + e * 40;
      seed.rot = Math.sin(t * 24) * 0.22 * (1 - k);
      seed.mood = 'squint'; mound = e * 9; cam = camS;
      if (Math.random() < dt * 24) parts.push({ x: W / 2 + rand(-14, 14), y: GY, vx: rand(-60, 60), vy: rand(-140, -60), life: 0.8, r: rand(2, 3.5), c: '#8A5A3C' });
      digT -= dt; if (digT <= 0) { digT = 0.11; sfx.dig(); }
    } else if (t < 3.5) {
      if (!dived) { dived = true; mound = 0; seed.clip = false; sfx.dive(); }
      const k = (t - 2.4) / 1.1, e = easeIO(k), y0 = SURF_REST + 40;
      seed.y = y0 + (DEEP_REST - y0) * e;
      seed.rot = Math.sin(t * 30) * 0.18; seed.mood = 'fall';
      cam = camS + (camE - camS) * e;
      if (Math.random() < dt * 45) parts.push({ x: seed.x + rand(-20, 20), y: seed.y + rand(-10, 24), vx: rand(-60, 60), vy: rand(-40, 20), life: 0.7, r: rand(2, 3.5), c: Math.random() < 0.5 ? '#8A5A3C' : '#B58860' });
    } else if (t < 3.7) {
      seed.y = DEEP_REST; cam = camE; seed.mood = 'happy';
      seed.rot *= 1 - Math.min(1, dt * 12);
      if (!landed2) { landed2 = true; seed.sq = 1; shake = 1; burst(W / 2, DEEP_REST + 16, '#8A5A3C', 14, 220); sfx.thud(); buzz(25); }
    } else if (t < INTRO_END) {
      cam = camE;
      if (t < 4.0) {
        seed.rot = Math.sin(t * 34) * 0.2; seed.mood = 'squint';
      } else {
        if (!popped) { popped = true; seed.vis = false; coat = true; burst(W / 2, 8, '#C24632', 14, 230); burst(W / 2, 8, '#8A5A3C', 8, 180); sfx.pop(); }
        const k = (t - 4.0) / (INTRO_END - 4.0);
        P.y = 30 - 30 * (1 - Math.pow(1 - k, 3));
        P.open = smooth(k, 0.35, 1);
        const last = trail[trail.length - 1];
        if (Math.hypot(P.x - last.x, P.y - last.y) >= 7) trail.push({ x: P.x, y: P.y, d: 0 });
      }
    } else {
      P.y = 0; P.open = 1; cam = camE; seed.vis = false; coat = true;
      if (state === 'intro') beginPlay();
      else if (t > 7) reset();      // menu: loop the cutscene as an attract screen
    }
  }

  // ---------- main menu: a time-lapse of the whole climb, dirt to space ----------
  const MENU_LEN = 44;            // seconds for the full trip, a little over 4 seconds per evolution
  const menuTipF = () => (TIPF > 0.7 ? 0.58 : 0.5);          // the growing tip sits between the title and the buttons
  function menuMeters(t) {
    t = Math.max(0, t);
    const seg = MENU_LEN / (EVOS.length - 1);
    const k = Math.min(EVOS.length - 2, Math.floor(t / seg));
    const f = clamp((t - k * seg) / seg, 0, 1);
    return EVOS[k].m + (EVOS[k + 1].m - EVOS[k].m) * f;
  }
  function menuInit() {
    mnT = 0; mnAcc = { leaf: 0, curl: 0, flower: 0, pod: 0 };
    P.x = W / 2; P.y = GY + 1000; P.open = 1; P.ang = 0; P.vx = 0; P.sq = 0;      // start in the dirt, just under the surface
    trail = [{ x: W / 2, y: P.y + 60, d: 0 }];
    leaves = []; parts = []; floaters = []; obst = []; drops = []; showers = [];
    seed.vis = false; coat = false; mound = 0; curEvo = 0; dist = 0; layer = 0; leafSide = 1;
    cam = P.y - H * menuTipF();
    menuFade = 1;
  }
  function stepMenu(dt) {
    mnT += dt;
    const t = mnT, sp = 240;
    const meters = menuMeters(Math.min(t, MENU_LEN));
    dist = M(meters);
    const holding = t >= MENU_LEN;                       // hold still for a beat in space
    const py = holding ? 0 : sp * dt;
    P.y -= py;
    const tt = Math.min(t, MENU_LEN);
    P.x = W / 2 + Math.sin(tt * 0.9) * 62 + Math.sin(tt * 0.37 + 1) * 34;         // wander from side to side
    const vx = Math.cos(tt * 0.9) * 62 * 0.9 + Math.cos(tt * 0.37 + 1) * 34 * 0.37;
    P.vx += (vx - P.vx) * Math.min(1, dt * 6);
    P.ang += (clamp(P.vx / 420, -0.4, 0.4) - P.ang) * Math.min(1, dt * 6);
    cam = P.y - H * menuTipF();
    if (!holding) {
      const last = trail[trail.length - 1];
      if (Math.hypot(P.x - last.x, P.y - last.y) >= 7) trail.push({ x: P.x, y: P.y, d: dist });
      while (trail.length > 3 && trail[1].y > cam + H + 140) trail.shift();
      for (const k in mnAcc) mnAcc[k] += py;
      const mat = clamp(meters / 50000, 0, 1);
      if (P.y < GY - 8) {                                // leaves and blooms only above the soil, like the real thing
        if (mnAcc.leaf >= 62 - 20 * mat) {
          mnAcc.leaf = 0; leafSide = -leafSide;
          leaves.push({ kind: 'leaf', evo: curEvo, x: P.x, y: P.y, side: leafSide, age: 0, size: (0.75 + 0.75 * mat) * rand(0.9, 1.1), tri: meters >= STAGES[1].m && Math.random() < 0.35 + 0.6 * mat });
        }
        if (meters >= STAGES[1].m && mnAcc.curl >= 140) { mnAcc.curl = 0; leaves.push({ kind: 'curl', x: P.x, y: P.y, side: -leafSide, age: 0, size: rand(0.8, 1.2) }); }
        if (meters >= STAGES[2].m && mnAcc.flower >= 95) { mnAcc.flower = 0; leaves.push({ kind: 'flower', x: P.x, y: P.y, side: Math.random() < 0.5 ? -1 : 1, age: 0, size: rand(0.9, 1.2), col: FLOWER_COLS[Math.floor(Math.random() * FLOWER_COLS.length)] }); }
        if (meters >= STAGES[3].m && mnAcc.pod >= 150) { mnAcc.pod = 0; leaves.push({ kind: 'pod', x: P.x, y: P.y, side: Math.random() < 0.5 ? -1 : 1, age: 0, size: rand(0.9, 1.15) }); }
      }
    }
    for (const l of leaves) l.age += dt;
    leaves = leaves.filter(l => l.y < cam + H + 100);
    while (curEvo < EVOS.length - 1 && meters >= EVOS[curEvo + 1].m) {           // each new form gets a little sparkle
      curEvo++;
      const ev = EVOS[curEvo];
      burst(P.x, P.y, '#FFFFFF', 12, 260);
      burst(P.x, P.y, ev.leaf === 'rainbow' ? '#FFD86B' : ev.leaf, 12, 220);
    }
    const ev = EVOS[curEvo];
    if (ev.fx && Math.random() < dt * 26) {
      const q = { x: P.x + rand(-14, 14), y: P.y + rand(0, 26), vx: rand(-20, 20), vy: rand(-30, 30), life: 0.9, r: rand(2, 3.4), c: '#FFFFFF' };
      if (ev.fx === 'puff') { q.vy = rand(10, 40); q.life = 1.1; q.r = rand(3, 6); }
      else if (ev.fx === 'sun') { q.c = '#FFD86B'; q.vy = rand(-40, -5); }
      else if (ev.fx === 'spark') { q.x = P.x + rand(-24, 24); q.y = P.y + rand(-26, 12); q.vx = rand(-90, 90); q.vy = rand(-90, 30); q.life = 0.35; q.r = rand(1.5, 2.6); q.c = Math.random() < 0.5 ? '#8FD8FF' : '#FFE45C'; }
      else if (ev.fx === 'moon') { q.c = '#E8EEFF'; q.vy = rand(20, 60); q.life = 1.2; }
      else if (ev.fx === 'star') { q.c = 'hsl(' + Math.floor(rand(0, 360)) + ',90%,70%)'; q.life = 1.1; q.vy = rand(-20, 50); }
      parts.push(q);
    }
    // fade in at the start, fade out at the end, then start the trip again
    menuFade = t < 1.2 ? 1 - t / 1.2 : t > MENU_LEN + 1.0 ? clamp((t - (MENU_LEN + 1.0)) / 1.2, 0, 1) : 0;
    if (t > MENU_LEN + 2.4) { reset(); menuInit(); }
  }

  // ---------- menu music: a gentle looping tune, synthesized so it needs no files ----------
  let music = null, noiseBuffer = null;
  const MUSIC_MASTER = 1.25;      // menu volume
  const MUSIC_GAME = MUSIC_MASTER * 0.32;      // quieter under gameplay so sound effects read clearly
  let musicLevel = MUSIC_MASTER;
  const SIXTEENTH = 60 / 88 / 4;                          // 88 beats per minute
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  const CHORDS = [                                        // C  Am  F  G  |  C  Em  F  G
    { r: 48, p: [60, 64, 67] }, { r: 45, p: [57, 60, 64] }, { r: 41, p: [57, 60, 65] }, { r: 43, p: [55, 59, 62] },
    { r: 48, p: [60, 64, 67] }, { r: 40, p: [59, 64, 67] }, { r: 41, p: [57, 60, 65] }, { r: 43, p: [55, 59, 62] }
  ];
  const MELODY = [                                        // [step in the bar, note, length in steps]
    [[0, 79, 4], [4, 76, 2], [6, 79, 2], [8, 84, 6]],
    [[0, 81, 4], [4, 79, 2], [6, 76, 2], [8, 79, 8]],
    [[0, 81, 4], [4, 77, 4], [8, 79, 4], [12, 81, 4]],
    [[0, 79, 8], [8, 74, 4], [12, 76, 4]],
    [[0, 79, 4], [4, 84, 2], [6, 86, 2], [8, 88, 6]],
    [[0, 86, 4], [4, 84, 2], [6, 79, 2], [8, 83, 8]],
    [[0, 81, 4], [4, 84, 4], [8, 81, 4], [12, 77, 4]],
    [[0, 79, 8], [8, 74, 4], [12, 71, 4]]
  ];
  function tn(freq, t, dur, type, vol, atk, dest, pan, hold) {
    try {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + atk);
      if (hold) g.gain.setValueAtTime(vol, t + atk + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      if (pan !== undefined && AC.createStereoPanner) { const pn = AC.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(dest); }
      else g.connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function shaker(t) {
    try {
      if (!noiseBuffer) {
        const n = Math.floor(AC.sampleRate * 0.1);
        noiseBuffer = AC.createBuffer(1, n, AC.sampleRate);
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = AC.createBufferSource(); src.buffer = noiseBuffer;
      const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      const g = AC.createGain(); g.gain.setValueAtTime(0.018, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(f); f.connect(g); g.connect(music.bus);
      src.start(t); src.stop(t + 0.08);
    } catch (e) {}
  }
  function scheduleStep(s, t) {
    const bar = Math.floor(s / 16), st = s % 16, ch = CHORDS[bar], bus = music.bus;
    if (st === 0) {
      ch.p.forEach(n => tn(mtof(n), t, SIXTEENTH * 16 + 0.3, 'triangle', 0.028, 0.6, bus, undefined, 1.6));      // soft pad
      tn(mtof(ch.r), t, SIXTEENTH * 6, 'sine', 0.13, 0.02, bus);                                                 // bass
    }
    if (st === 8) tn(mtof(ch.r), t, SIXTEENTH * 4, 'sine', 0.1, 0.02, bus);
    if (st % 2 === 0) {                                                                                          // music-box arpeggio
      const a = ch.p, k = (st / 2) % 8;
      const seq = [a[0] + 12, a[1] + 12, a[2] + 12, a[0] + 24, a[2] + 12, a[1] + 12, a[2] + 12, a[1] + 12];
      tn(mtof(seq[k]), t, 0.5, 'triangle', 0.05, 0.005, bus, Math.sin(s * 0.7) * 0.5);
    }
    for (const m of MELODY[bar]) {
      if (m[0] === st) tn(mtof(m[1]), t, m[2] * SIXTEENTH + 0.3, 'sine', 0.07, 0.03, bus, 0.15, m[2] * SIXTEENTH * 0.5);
    }
    if (st % 4 === 2) shaker(t);
  }
  function musicTick() {
    if (!music || !AC) return;
    while (music.next < AC.currentTime + 0.4) {
      scheduleStep(music.step, music.next);
      music.next += SIXTEENTH;
      music.step = (music.step + 1) % 128;
    }
  }
  function applyMusicVolume(tc) {
    if (!music || !AC) return;
    try { music.master.gain.setTargetAtTime(muted ? 0.0001 : musicLevel, AC.currentTime, tc || 0.25); } catch (e) {}
  }
  function startMusic() {
    if (music || !AC) return;
    try {
      const master = AC.createGain(); master.gain.value = 0.0001; master.connect(AC.destination);
      const bus = AC.createGain(); bus.connect(master);
      const dl = AC.createDelay(1.0); dl.delayTime.value = SIXTEENTH * 3;        // a soft dotted-eighth echo
      const fb = AC.createGain(); fb.gain.value = 0.35;
      const wet = AC.createGain(); wet.gain.value = 0.32;
      bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
      music = { master, bus, step: 0, next: AC.currentTime + 0.15, timer: setInterval(musicTick, 90) };
      applyMusicVolume(1.6);                                                     // fade in
    } catch (e) { music = null; }
  }
  function stopMusic() {
    if (!music) return;
    const m = music; music = null;
    clearInterval(m.timer);
    try { m.master.gain.setTargetAtTime(0.0001, AC.currentTime, 0.15); } catch (e) {}
    setTimeout(() => { try { m.master.disconnect(); } catch (e) {} }, 900);
  }

  function beginPlay() {
    state = 'play';
    P.y = 0; P.open = 1;
    time = 0;
    hudEl.classList.remove('hidden');
    const hs = hintEl.firstElementChild; if (hs) hs.textContent = hintSteer();
    if (gameplayHintsSetting) hintEl.classList.remove('hidden'); else hintEl.classList.add('hidden');
    hinted = false;
    updateHud(true);
  }

  function skipIntro() {
    seed.vis = false; landed = landed2 = dived = popped = true; coat = true; mound = 0;
    P.y = 0; P.open = 1;
    trail = [{ x: W / 2, y: 36, d: 0 }, { x: W / 2, y: 4, d: 0 }];
    beginPlay();
  }

  const show = el => el.classList.remove('hidden'), hide = el => el.classList.add('hidden');

  function updateSettingsUI() {
    const items = [
      [hapticToggle, haptics],
      [soundToggle, !muted],
      [hintsToggle, gameplayHintsSetting],
      [autoPauseToggle, autoPauseSetting],
      [tvToggle, tvMode]
    ];
    for (const [el, on] of items) {
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', String(on));
    }
    muteBtn.classList.toggle('muted', muted);
    muteBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    const soundLabel = 'Sound: ' + (muted ? 'off' : 'on');
    $('menuSound').textContent = soundLabel; $('pauseSound').textContent = soundLabel;
  }

  function openSettings() {
    hide(startEl); hide(howEl); hide(evosEl); hide(aboutEl); hide(updatesInfoEl);
    show(settingsEl);
    updateSettingsUI();
  }

  function closeSettings() {
    hide(settingsEl);
    hide(aboutEl);
    hide(updatesInfoEl);
    show(startEl);
  }

  function toggleHaptics() {
    haptics = !haptics;
    saveSetting('beanbound2-haptics', haptics ? 'on' : 'off');
    updateSettingsUI();
    if (haptics) buzz(18);
  }

  function toggleGameplayHints() {
    gameplayHintsSetting = !gameplayHintsSetting;
    saveSetting('beanbound2-hints', gameplayHintsSetting ? 'on' : 'off');
    if (!gameplayHintsSetting) hintEl.classList.add('hidden');
    updateSettingsUI();
  }

  function toggleAutoPause() {
    autoPauseSetting = !autoPauseSetting;
    saveSetting('beanbound2-autopause', autoPauseSetting ? 'on' : 'off');
    updateSettingsUI();
  }

  let resetConfirmStep = 0;

  function showResetConfirm(step) {
    resetConfirmStep = step;
    const titles = ['Are you sure?', 'Are you REALLY sure?', 'FINAL CONFIRMATION'];
    const messages = [
      'Are you sure you want to reset your Beanbound progress?',
      'This will erase your best score and progress.',
      'This will permanently reset all Beanbound progress. This cannot be undone.'
    ];
    $('resetConfirmTitle').textContent = titles[step];
    $('resetConfirmText').textContent = messages[step];
    $('resetConfirmYes').textContent = step === 2 ? 'Reset Progress' : 'Yes, continue';
    hide(settingsEl);
    show($('resetConfirm'));
    if (tvMode || navUsed) $('resetConfirmNo').focus();      // never land on the destructive button
  }

  function cancelResetConfirm() {
    resetConfirmStep = 0;
    hide($('resetConfirm'));
    show(settingsEl);
    updateSettingsUI();
  }

  function confirmResetProgress() {
    if (resetConfirmStep < 2) {
      showResetConfirm(resetConfirmStep + 1);
      return;
    }
    best = 0; maxM = 0;
    saveProgress();
    updateBestStart();
    buildEvos();
    updateSettingsUI();
    hide($('resetConfirm'));
    show(settingsEl);
    resetConfirmStep = 0;
  }

  function resetSettings() {
    if (!tvMode && !confirm('Reset all Beanbound settings to their defaults?')) return;
    try {
      localStorage.removeItem('beanbound2-haptics');
      localStorage.removeItem('beanbound2-hints');
      localStorage.removeItem('beanbound2-autopause');
      localStorage.removeItem('beanbound2-muted');
    } catch (e) {}
    haptics = false;
    gameplayHintsSetting = true;
    autoPauseSetting = true;
    muted = false;
    updateSettingsUI();
    applyMusicVolume(0.05);
  }

  function startGame(quick) {
    initAudio();
    musicLevel = MUSIC_GAME;
    applyMusicVolume(0.8);
    reset();
    hide(startEl); hide(overEl); hide(pauseEl); hide(howEl); hide(evosEl); hide(settingsEl); hide(endlessInfoEl); hide(aboutEl); hide(updatesInfoEl); hide(victoryRoomEl); hide(moonSceneEl); hide(countEl);
    hudEl.classList.add('hidden');
    state = 'intro';
    requestWakeLock();
    if (quick === true) { skipIntro(); return; }       // restart: straight into the dirt, no cutscene
    const hs = hintEl.firstElementChild; if (hs) hs.textContent = hintSkip();
    hintEl.classList.remove('hidden');
    sfx.whoosh();
  }

  function toMenu() {
    hide(pauseEl); hide(overEl); hide(howEl); hide(evosEl); hide(settingsEl); hide(endlessInfoEl); hide(aboutEl); hide(victoryRoomEl); hide(moonSceneEl); hide(countEl);
    hudEl.classList.add('hidden'); hintEl.classList.add('hidden');
    ptr = null;
    victoryDone = false;
    reset();
    state = 'menu';
    releaseWakeLock();
    menuInit();
    updateBestStart();
    show(startEl);
    musicLevel = MUSIC_MASTER;
    stopMusic();
    initAudio();
    startMusic();          // back on the menu: the tune stops and restarts at normal volume
  }

  function pauseGame() {
    if (state !== 'play') return;
    state = 'paused';
    ptr = null; keys.l = keys.r = false;
    hintEl.classList.add('hidden');
    $('pauseInfo').textContent = EVOS[curEvo].name + ' \u00b7 ' + fmt(Math.floor(dist / UNIT)) + ' m \u00b7 Score ' + fmt(score);
    show(pauseEl);
    releaseWakeLock();
  }
  function resumeGame() {
    if (state !== 'paused') return;
    hide(pauseEl);
    state = 'countdown'; cdT = 3;
    countEl.textContent = '3'; show(countEl);
    requestWakeLock();
  }
  function toggleSound() {
    muted = !muted;
    saveSetting('beanbound2-muted', muted ? 'on' : 'off');
    applyMusicVolume(0.1);
    updateSettingsUI();
  }

  // A new form: burst, banner, fanfare, and remember it forever
  function evolveFx() {
    const ev = EVOS[curEvo];
    maxM = Math.max(maxM, Math.floor(dist / UNIT));
    shake = 0.7;
    burst(P.x, P.y, '#FFFFFF', 14, 300);
    burst(P.x, P.y, ev.leaf === 'rainbow' ? '#FFD86B' : ev.leaf, 14, 260);
    floaters.push({ x: W / 2, y: P.y - 236, life: 2.4, text: 'Evolved!' });
    floaters.push({ x: W / 2, y: P.y - 200, life: 2.4, text: ev.name });
    sfx.evolve(); buzz(40);
    saveProgress();
  }

  // The Evolutions screen: every form, first to last; forms you haven't reached yet show as silhouettes
  let evoCanvases = [], evoSil = EVOS.map(e => Object.assign({}, e, { glow: null }));
  function buildEvos() {
    const list = $('evoList');
    list.innerHTML = '';
    let n = 0;
    EVOS.forEach((ev, i) => {
      const open = maxM >= ev.m;
      if (open) n++;
      const row = document.createElement('div');
      row.className = 'evo' + (open ? '' : ' locked');
      const label = open ? ev.name + ' evolution' : 'Locked evolution';
      const c = document.createElement('canvas'); c.width = 320; c.height = 320;
      renderEvoPhoto(c, i);
      let pic;
      try { pic = document.createElement('img'); pic.src = c.toDataURL('image/png'); pic.alt = label; }
      catch (e) { pic = c; c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); }
      const t = document.createElement('div'); t.className = 'evot';
      const b = document.createElement('b'); b.textContent = (i + 1) + '. ' + (open ? ev.name : '???');
      const sp = document.createElement('span'); sp.textContent = (i === 0 ? 'Where it starts' : fmt(ev.m) + ' m') + ' \u00b7 ' + ev.layer;
      const pp = document.createElement('p'); pp.textContent = open ? ev.desc : 'Reach ' + fmt(ev.m) + ' m to discover this form.';
      t.appendChild(b); t.appendChild(sp); t.appendChild(pp);
      row.appendChild(pic); row.appendChild(t);
      list.appendChild(row);
    });
    $('evosCount').textContent = n + ' of ' + EVOS.length + ' unlocked';
  }
  // Each evolution gets a big picture of itself in its own part of the world (drawn from the game's own art)
  function drawEvoScene(w, h, ev, i) {
    if (ev.m < DIRT_M) {                                   // underground: soil
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#7A4B32'); g.addColorStop(1, '#3B251B');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 110; k++) {
        const x = hash(k, 3 + i) * w, y = hash(k + 40, 9 + i) * h, r = 2 + hash(k, 5) * 6;
        ctx.fillStyle = hash(k, 8) < 0.5 ? 'rgba(0,0,0,.2)' : 'rgba(255,220,180,.14)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.fillStyle = '#A5A7B8';
      for (let k = 0; k < 3; k++) {
        const x = (0.12 + hash(k, 21 + i) * 0.76) * w, y = (0.6 + hash(k, 33) * 0.32) * h, r = 16 + hash(k, 44) * 16;
        if (Math.abs(x - w / 2) < 90) continue;
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      return;
    }
    const t = skyT(M(ev.m)), c = skyAt(t);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (t < 0.34) {                                         // forest
      ctx.fillStyle = 'rgba(8,38,34,.33)';
      for (const tr of TRUNKS) ctx.fillRect(tr.x * w - tr.w * 1.6, 0, tr.w * 3.2, h);
      ctx.fillStyle = '#FFF3A0';
      for (let k = 0; k < 16; k++) {
        const x = hash(k, 61) * w, y = hash(k, 62) * h;
        ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const cloudA = 0.85 * smooth(t, 0.3, 0.5) * (1 - smooth(t, 0.72, 0.9));
    if (cloudA > 0.02) {
      ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = cloudA;
      for (let k = 0; k < 6; k++) {
        const x = hash(k, 71) * w, y = (0.08 + hash(k, 72) * 0.7) * h, s2 = 22 + hash(k, 73) * 26;
        ctx.beginPath(); ctx.arc(x, y, s2, 0, Math.PI * 2); ctx.arc(x + s2 * 1.1, y - s2 * 0.5, s2 * 1.1, 0, Math.PI * 2); ctx.arc(x + s2 * 2.2, y, s2 * 0.9, 0, Math.PI * 2); ctx.rect(x, y, s2 * 2.2, s2 * 0.9); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const starA = smooth(t, 0.65, 0.92);
    if (starA > 0.01) {
      ctx.fillStyle = '#FFF6DD';
      for (let k = 0; k < 70; k++) {
        ctx.globalAlpha = starA * (0.55 + 0.45 * hash(k, 81));
        ctx.beginPath(); ctx.arc(hash(k, 82) * w, hash(k, 83) * h, 1 + hash(k, 84) * 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const moonA = smooth(t, 0.72, 0.95);
    if (moonA > 0.01) {
      const mx = w * 0.8, my = h * 0.24, r = h * 0.14;
      ctx.globalAlpha = moonA;
      const mg = ctx.createRadialGradient(mx, my, r * 0.4, mx, my, r * 3);
      mg.addColorStop(0, 'rgba(255,247,214,.45)'); mg.addColorStop(1, 'rgba(255,247,214,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - r * 3, my - r * 3, r * 6, r * 6);
      ctx.fillStyle = '#FFF7D6'; ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#EADFB4';
      ctx.beginPath(); ctx.arc(mx - r * 0.3, my - r * 0.15, r * 0.19, 0, Math.PI * 2); ctx.arc(mx + r * 0.33, my + r * 0.25, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawEvoPlant(w, h, i, tm, evoObj) {
    const s = h / 150;
    ctx.setTransform(s, 0, 0, s, w / 2, h * 0.6);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 150);
    ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 9.5; ctx.strokeStyle = '#4CC27F'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(-2, 150);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(190,255,215,.55)'; ctx.stroke();
    // leaves and blooms along the stem, like the real plant at that stage
    const put = (kind, y, side, extra) => drawDeco(Object.assign({ kind, evo: i, x: 0, y, side, age: 9, size: 1.15 }, extra || {}), tm, true);
    put('leaf', 46, -1, { tri: i >= 2 }); put('leaf', 78, 1, { tri: i >= 2 });
    if (i >= 2) put('curl', 30, 1);
    if (i >= 4) put('flower', 60, 1, { col: FLOWER_COLS[i % 3] });
    if (i >= 6) put('pod', 100, -1);
    drawShoot(0, 0, 0, 0.3, 0.04, tm, i === 0 ? 0.4 : 1, false, 1, evoObj);
  }

  function renderEvoPhoto(c, i) {
    const open = maxM >= EVOS[i].m, w = c.width, h = c.height;
    const main = c.getContext('2d');
    const saved = ctx;
    ctx = main;
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.clearRect(0, 0, w, h);
    drawEvoScene(w, h, EVOS[i], i);
    main.setTransform(1, 0, 0, 1, 0, 0);
    if (open) {
      drawEvoPlant(w, h, i, 1.3, EVOS[i]);
    } else {
      main.fillStyle = 'rgba(6,22,20,.45)'; main.fillRect(0, 0, w, h);
      const tc = document.createElement('canvas'); tc.width = w; tc.height = h;
      const t2 = tc.getContext('2d');
      ctx = t2;
      drawEvoPlant(w, h, i, 1.3, evoSil[i]);
      t2.setTransform(1, 0, 0, 1, 0, 0);
      t2.globalCompositeOperation = 'source-atop'; t2.fillStyle = '#0B211E'; t2.fillRect(0, 0, w, h);
      ctx = main;
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.drawImage(tc, 0, 0);
      // padlock
      main.lineCap = 'round';
      main.beginPath(); main.arc(w - 52, h - 66, 13, Math.PI, 0);
      main.lineWidth = 8; main.strokeStyle = INK; main.stroke(); main.lineWidth = 4; main.strokeStyle = '#FFD86B'; main.stroke();
      rr(w - 74, h - 66, 44, 34, 7); main.fillStyle = '#FFD86B'; main.lineWidth = 4; main.strokeStyle = INK; main.fill(); main.stroke();
    }
    main.setTransform(1, 0, 0, 1, 0, 0);
    ctx = saved;
  }

  const TITLES = { rock: 'Hit a rock', crow: 'Pecked by a crow', balloon: 'Bumped a balloon', cloud: 'Bonked a cloud', storm: 'Zapped by lightning', wilt: 'You wilted', win: 'You reached space!' };
  function die(kind) {
    if (state !== 'play') return;
    won = kind === 'win';
    state = won ? 'victory' : 'over';
    releaseWakeLock();
    if (won) {
      // The big milestone is a celebration, not a normal game-over screen.
      sfx.win(); buzz(120);
      curEvo = 0;
      P.x = W / 2; P.y = 0; P.vx = 0; P.ang = 0; P.sq = 0; P.open = 1;
      dist = END_PX;
      score = END_M;
      maxM = Math.max(maxM, END_M);
      for (const c of ['#FFD86B', '#FF9EC4', '#8FD8FF', '#B6F2A0', '#FFFFFF']) burst(W / 2, -END_PX, c, 22, 420);
    } else {
      sfx.die(); buzz(70);
      burst(P.x, P.y, '#5FD38D', 16, 250);
      burst(P.x, P.y, '#B6F2A0', 10, 200);
    }
    hudEl.classList.add('hidden');
    hintEl.classList.add('hidden');
    ptr = null;
    if (!won) score = Math.floor(dist / UNIT) + bonus;
    const isBest = score > best;
    if (isBest) best = score;
    maxM = Math.max(maxM, Math.floor(dist / UNIT));
    saveProgress();
    const fresh = EVOS.filter(e => e.m > runStartM && e.m <= maxM);
    if (won) {
      hide(overEl);
      hide(victoryRoomEl);
      hide(moonSceneEl);
      victoryX = vw / 2;
      victoryDone = false;
      P.x = W / 2;
      P.vx = 0;
      tx = P.x;
      keys.l = keys.r = false;
      return;
    }
    $('overTitle').textContent = TITLES[kind] || 'You fell';
    $('finalScore').textContent = fmt(score);
    $('statLine').textContent = 'Grew ' + fmt(Math.floor(dist / UNIT)) + ' m as a ' + EVOS[curEvo].name;
    $('evoLine').innerHTML = fresh.length ? '<span class="badge">' + (fresh.length > 1 ? fresh.length + ' new evolutions, latest: ' : 'New evolution: ') + fresh[fresh.length - 1].name + '</span>' : '';
    $('bestLine').innerHTML = isBest ? '<span class="badge">New best!</span>' : 'Best ' + fmt(best);
    setTimeout(() => { if (state === 'over') overEl.classList.remove('hidden'); }, 500);
  }

  function updateBestStart() {
    $('bestStart').textContent = best > 0 ? 'Best ' + fmt(best) : '';
  }

  // ---------- input ----------
  cv.addEventListener('pointerdown', e => {
    if (state === 'intro') { e.preventDefault(); if (introT > 0.5) skipIntro(); return; }
    if (state === 'victory') {
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      ptr = { id: e.pointerId, sx: e.clientX, spx: victoryX };
      return;
    }
    if (state !== 'play') return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    ptr = { id: e.pointerId, sx: e.clientX, spx: tx };
    if (!hinted) { hinted = true; hintEl.classList.add('hidden'); }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (state === 'victory') {
      const raw = ptr.spx + ((e.clientX - ptr.sx) / Math.max(1, scale)) * 1.4;
      victoryX = clamp(raw, 40, vw - 40);
      ptr.spx = victoryX; ptr.sx = e.clientX;
      return;
    }
    const raw = ptr.spx + ((e.clientX - ptr.sx) / scale) * 1.4;
    const c = clamp(raw, 16, W - 16);
    if (c !== raw) ptr.sx += ((raw - c) / 1.4) * scale;   // no dead zone at the walls
    tx = c;
  });
  const endPtr = e => { if (ptr && e.pointerId === ptr.id) ptr = null; };
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.l = true; hinted = true; hintEl.classList.add('hidden'); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.r = true; hinted = true; hintEl.classList.add('hidden'); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.l = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.r = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (autoPauseSetting && document.hidden && state === 'play') pauseGame();
  });

  $('endless').addEventListener('click', () => {
    initAudio();
    sfx.pop();
    hide(startEl); hide(settingsEl); hide(aboutEl);
    show(endlessInfoEl);
  });
  $('endlessInfoBack').addEventListener('click', () => {
    hide(endlessInfoEl);
    show(startEl);
  });
  $('settingsBtn').addEventListener('click', openSettings);
  $('menuHow').addEventListener('click', () => { hide(startEl); $('seedInfoPanel').classList.add('hidden'); $('seedPackInfoBtn').setAttribute('aria-expanded', 'false'); show(howEl); });
  $('settingsBack').addEventListener('click', closeSettings);
  $('resetSettings').addEventListener('click', resetSettings);
  tvToggle.addEventListener('click', () => setTvMode(!tvMode));
  $('aboutBtn').addEventListener('click', () => { hide(settingsEl); show(aboutEl); });
  $('aboutBack').addEventListener('click', () => { hide(aboutEl); show(settingsEl); updateSettingsUI(); });
  hapticToggle.addEventListener('click', toggleHaptics);
  soundToggle.addEventListener('click', toggleSound);
  hintsToggle.addEventListener('click', toggleGameplayHints);
  autoPauseToggle.addEventListener('click', toggleAutoPause);
  $('resetProgress').addEventListener('click', () => showResetConfirm(0));
  $('resetConfirmYes').addEventListener('click', confirmResetProgress);
  $('resetConfirmNo').addEventListener('click', cancelResetConfirm);

  $('whatsNewDismiss').addEventListener('click', dismissWhatsNew);
  $('updateLogsBtn').addEventListener('click', () => {
    initAudio();
    sfx.pop();
    hide(settingsEl);
    openWhatsNew('settings');
  });
  $('updatesInfoBtn').addEventListener('click', () => {
    initAudio();
    sfx.pop();
    hide(settingsEl);
    show(updatesInfoEl);
  });
  $('updatesInfoBack').addEventListener('click', () => {
    hide(updatesInfoEl);
    show(settingsEl);
    updateSettingsUI();
  });
  $('play').addEventListener('click', () => startGame());
  $('shareScore').addEventListener('click', async () => {
    const shareText = `I just reached ${fmt(score)}m in Beanbound!`;
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        const btn = $('shareScore');
        const oldText = btn.textContent;
        btn.textContent = 'Score copied!';
        setTimeout(() => { btn.textContent = oldText; }, 1400);
      }
    } catch (err) {
      // Sharing was cancelled or unavailable; keep the game running normally.
    }
  });
  $('again').addEventListener('click', () => startGame());
  // The victory room is controlled by steering into the two choices on the canvas.
  $('moonPlayAgain').addEventListener('click', () => { toMenu(); });
  $('openEvos').addEventListener('click', () => { buildEvos(); hide(settingsEl); show(evosEl); });
  $('evosBack').addEventListener('click', () => { hide(evosEl); show(settingsEl); updateSettingsUI(); });
  $('howBack').addEventListener('click', () => { hide(howEl); show(settingsEl); updateSettingsUI(); });
  $('seedPackInfoBtn').addEventListener('click', () => {
    const panel = $('seedInfoPanel');
    const open = panel.classList.toggle('hidden') === false;
    $('seedPackInfoBtn').setAttribute('aria-expanded', String(open));
  });
  $('pauseBtn').addEventListener('click', pauseGame);
  $('resume').addEventListener('click', resumeGame);
  $('restart').addEventListener('click', () => startGame(true));
  $('toMenu').addEventListener('click', toMenu);
  $('overMenu').addEventListener('click', toMenu);
  muteBtn.addEventListener('click', toggleSound);
  $('menuSound').addEventListener('click', toggleSound);
  $('pauseSound').addEventListener('click', toggleSound);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
    try { if (AC) { if (document.hidden) AC.suspend(); else AC.resume(); } } catch (e) {}
  });
  // Browsers only allow sound after a tap, so the menu tune starts on the first tap anywhere
  function menuMusicGesture() {
    if (state !== 'menu') return;
    initAudio();
    if (AC) startMusic();
    const h = $('musicHint'); if (h) h.hidden = true;
  }
  document.addEventListener('click', menuMusicGesture);
  document.addEventListener('touchend', menuMusicGesture);
  document.addEventListener('keydown', menuMusicGesture);
  window.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') {
      if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame();
    } else if (e.key === 'Escape') {
      remoteBack();
    }
  });

  // ---------- drawing helpers ----------
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function teardrop(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - 14 * s);
    ctx.bezierCurveTo(x + 4 * s, y - 7 * s, x + 10 * s, y - 2 * s, x + 10 * s, y + 4 * s);
    ctx.arc(x, y + 4 * s, 10 * s, 0, Math.PI, false);
    ctx.bezierCurveTo(x - 10 * s, y - 2 * s, x - 4 * s, y - 7 * s, x, y - 14 * s);
    ctx.closePath();
  }
  // outline only on the outside of a union of shapes (draw the path, stroke thick in ink, then fill)
  function puffy(fill) {
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = fill; ctx.fill();
  }

  // ---------- sky (screen space) ----------
  function drawSky(tm) {
    const t = skyT(dist);
    const pd = state === 'menu' ? -P.y : dist;       // parallax follows how far we've really scrolled
    const c = skyAt(t);
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // tree trunks of the forest floor
    const trunkA = 1 - smooth(t, 0.18, 0.4);
    if (trunkA > 0.01) {
      ctx.fillStyle = 'rgba(8,38,34,' + (0.33 * trunkA).toFixed(3) + ')';
      for (const tr of TRUNKS) ctx.fillRect(tr.x * vw - tr.w / 2, 0, tr.w, vh);
    }

    // fireflies near the ground
    const flyA = 1 - smooth(t, 0.12, 0.38);
    if (flyA > 0.01) {
      ctx.fillStyle = '#FFF3A0';
      for (const f of FLIES) {
        const y = (f.y * vh + pd * 0.15 * f.s) % vh;
        const x = f.x * vw + Math.sin(tm * 0.8 + f.p) * 14;
        const a = flyA * (0.35 + 0.65 * Math.max(0, Math.sin(tm * 2 + f.p)));
        ctx.globalAlpha = a * 0.25;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // clouds in the daytime band
    const cloudA = 0.75 * smooth(t, 0.3, 0.5) * (1 - smooth(t, 0.72, 0.9));
    if (cloudA > 0.01) {
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = cloudA;
      for (const c2 of CLOUDS) {
        const y = ((c2.y * (vh + 200) + pd * 0.12 * c2.s) % (vh + 200)) - 100;
        const x = ((c2.x * (vw + 240) + tm * 6 * c2.s) % (vw + 240)) - 120;
        const s = 26 * c2.s;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.arc(x + s * 1.1, y - s * 0.5, s * 1.1, 0, Math.PI * 2);
        ctx.arc(x + s * 2.2, y, s * 0.9, 0, Math.PI * 2);
        ctx.rect(x, y, s * 2.2, s * 0.9);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // stars and the moon
    const starA = smooth(t, 0.65, 0.92);
    if (starA > 0.01) {
      const off = (pd * 0.06) % vh;
      ctx.fillStyle = '#FFF6DD';
      for (const s of STARFIELD) {
        const y = (s.y * vh + off) % vh;
        ctx.globalAlpha = starA * (0.55 + 0.45 * Math.sin(tm * 2 + s.p));
        ctx.beginPath(); ctx.arc(s.x * vw, y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const moonA = smooth(t, 0.72, 0.95);
    if (moonA > 0.01) {
      const mx = vw * 0.74, my = vh * 0.2 + (1 - moonA) * 70;
      ctx.globalAlpha = moonA;
      const mg = ctx.createRadialGradient(mx, my, 20, mx, my, 150);
      mg.addColorStop(0, 'rgba(255,247,214,.45)'); mg.addColorStop(1, 'rgba(255,247,214,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 160, my - 160, 320, 320);
      ctx.fillStyle = '#FFF7D6';
      ctx.beginPath(); ctx.arc(mx, my, 48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#EADFB4';
      ctx.beginPath(); ctx.arc(mx - 14, my - 8, 9, 0, Math.PI * 2); ctx.arc(mx + 16, my + 12, 6, 0, Math.PI * 2); ctx.arc(mx + 6, my - 20, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ---------- world drawing ----------
  // The soil under the grass line, with the grass, the planting mound and the seed coat
  function drawTerrain(tm) {
    const top = Math.max(GY, cam - 60), bot = cam + H + 80;
    if (bot < GY - 40) return;                    // the surface isn't in view yet
    const g = ctx.createLinearGradient(0, GY, 0, 0);
    g.addColorStop(0, '#8E5C3D'); g.addColorStop(1, '#3B251B');
    ctx.fillStyle = g;
    ctx.fillRect(viewL, top, viewR - viewL, bot - top);
    // specks and thin roots, so you can feel the climb
    const cs = 64;
    const r0 = Math.floor(top / cs), r1 = Math.floor(bot / cs), c0 = Math.floor(viewL / cs), c1 = Math.floor(viewR / cs);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const h1 = hash(c, r), h2 = hash(c + 91, r + 17), h3 = hash(c + 5, r + 71);
        const x = c * cs + h1 * cs, y = r * cs + h2 * cs;
        if (y < top) continue;
        if (h3 < 0.5) {
          ctx.fillStyle = h3 < 0.25 ? 'rgba(0,0,0,.18)' : 'rgba(255,220,180,.13)';
          ctx.beginPath(); ctx.arc(x, y, 2.5 + h1 * 4, 0, Math.PI * 2); ctx.fill();
        } else if (h3 < 0.58) {
          ctx.strokeStyle = 'rgba(230,200,150,.22)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y + 10, x + 4 + h2 * 8, y + 22); ctx.stroke();
        }
      }
    }
    // the grass line
    if (GY > cam - 40) {
      ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.fillStyle = '#5FD38D';
      for (let x = Math.floor(viewL / 26) * 26; x < viewR; x += 26) {
        const h = 6 + hash(x * 0.1, 3) * 8;
        ctx.beginPath(); ctx.moveTo(x, GY + 1); ctx.lineTo(x + 6, GY - h); ctx.lineTo(x + 13, GY + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.rect(viewL, GY, viewR - viewL, 14); ctx.fill(); ctx.stroke();
      if (mound > 0.3) {
        ctx.beginPath(); ctx.ellipse(W / 2, GY + 3, 26, mound + 3, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = '#8A5A3C'; ctx.fill(); ctx.stroke();
      }
    }
    // the split seed coat left behind at the bottom, where it all started
    if (coat) {
      ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.fillStyle = '#C24632';
      ctx.beginPath(); ctx.ellipse(W / 2 - 30, 26, 13, 9, -0.3, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(W / 2 + 30, 26, 13, 9, 0.3, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function drawMilestones() {
    const step = M(5000);
    const lines = [];
    const kmin = Math.max(1, Math.ceil(-(cam + H) / step)), kmax = Math.floor(-cam / step);
    for (let k = kmin; k <= kmax; k++) {
      const m = k * 5000;
      if (m > END_M) break;
      if (m === GROUND_M || m === END_M) continue;
      lines.push({ y: -k * step, label: fmt(m) + ' m', big: false });
    }
    lines.push({ y: -GROUND_PX, label: 'SKY LAYER', big: true });
    lines.push({ y: -END_PX, label: 'SPACE', big: true });
    lines.push({ y: GY - 26, label: 'GROUND LAYER', big: true, noLine: true });
    ctx.font = "22px 'Bagel Fat One', 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'left';
    for (const ln of lines) {
      if (ln.y < cam - 30 || ln.y > cam + H + 30) continue;
      if (!ln.noLine) {
        ctx.setLineDash(ln.big ? [16, 8] : [10, 8]);
        ctx.lineWidth = ln.big ? 4 : 3;
        ctx.strokeStyle = ln.big ? 'rgba(255,216,107,.9)' : 'rgba(255,255,255,.6)';
        ctx.beginPath(); ctx.moveTo(viewL, ln.y); ctx.lineTo(viewR, ln.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(ln.label, 12, ln.y - 8);
      ctx.fillStyle = ln.big ? '#FFD86B' : '#FFFFFF'; ctx.fillText(ln.label, 12, ln.y - 8);
    }
  }

  function drawShowers(tm) {
    for (const s of showers) {
      if (s.y1 < cam - 40 || s.y0 > cam + H + 40) continue;
      const h = s.y1 - s.y0, span = viewR - viewL;
      if (s.under) {
        // an underground spring: a pocket of water with bubbles drifting up
        ctx.fillStyle = 'rgba(70,170,255,.22)';
        ctx.fillRect(viewL, s.y0, span, h);
        ctx.strokeStyle = 'rgba(170,225,255,.9)'; ctx.lineWidth = 2;
        const nb = Math.round(34 * span / W);
        for (let i = 0; i < nb; i++) {
          const x = viewL + (i * 47.3) % span, y = s.y1 - ((i * 61.7 + tm * 70) % h), r = 3 + (i % 3) * 1.6;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        }
        continue;
      }
      ctx.fillStyle = 'rgba(110,200,255,.17)';
      ctx.fillRect(viewL, s.y0, span, h);
      ctx.strokeStyle = 'rgba(150,220,255,.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      const nRain = Math.round(46 * span / W);
      for (let i = 0; i < nRain; i++) {
        const x = viewL + (i * 47.3) % span;
        const y = s.y0 + ((i * 61.7 + tm * 330) % h);
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14);
      }
      ctx.stroke();
      // rain cloud at the top of the shower
      const cy = s.y0 + 6;
      ctx.beginPath();
      for (let x = 60, i = 0; x <= W - 60; x += 46, i++) {
        const r = 26 + (i % 2) * 6, yy = cy - (i % 2) * 8;
        ctx.moveTo(x + r, yy); ctx.arc(x, yy, r, 0, Math.PI * 2);
      }
      ctx.rect(60, cy, W - 120, 24);
      puffy('#DDEBFF');
    }
  }

  function bramble(x0, x1, y, h) {
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    ctx.fillStyle = '#F4E3B0';
    for (let x = x0 + 10; x < x1 - 8; x += 22) {
      ctx.beginPath(); ctx.moveTo(x - 6, y + 3); ctx.lineTo(x + 1, y - 9); ctx.lineTo(x + 8, y + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, y + h - 3); ctx.lineTo(x + 4, y + h + 9); ctx.lineTo(x + 11, y + h - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    rr(x0, y, x1 - x0, h, h / 2); ctx.fillStyle = '#8B5A3C'; ctx.fill(); ctx.stroke();
    rr(x0 + 8, y + 5, Math.max(0, x1 - x0 - 16), 4, 2); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
  }

  function drawCrow(o, tm) {
    ctx.save();
    ctx.translate(o.x, o.y + Math.sin(tm * 4 + o.ph) * 3);
    ctx.scale(o.dir, 1);
    const flap = Math.sin(tm * 14 + o.ph);
    const shapes = [
      { f: '#3B2F63', p: () => { ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-25, -5); ctx.lineTo(-25, 6); ctx.closePath(); } },
      { f: '#3B2F63', p: () => { ctx.beginPath(); ctx.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2); } },
      { f: '#3B2F63', p: () => { ctx.beginPath(); ctx.arc(12, -6, 7.5, 0, Math.PI * 2); } },
      { f: '#FFC24B', p: () => { ctx.beginPath(); ctx.moveTo(18, -8); ctx.lineTo(28, -4); ctx.lineTo(18, -2); ctx.closePath(); } },
      { f: '#5B4C93', p: () => { ctx.beginPath(); ctx.ellipse(-2, -6 - flap * 4, 11, 5, -0.5 + flap * 0.5, 0, Math.PI * 2); } }
    ];
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7; ctx.strokeStyle = '#F3FFF0';
    for (const s of shapes) { s.p(); ctx.stroke(); }
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    for (const s of shapes) { s.p(); ctx.fillStyle = s.f; ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(14, -7, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(14.8, -7, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawStorm(o, tm) {
    const ph = stormPhase(o);
    const bx = o.x - 15, by = o.y + 20;
    if (ph === 'warn') {
      const a = 0.12 + 0.1 * Math.sin(tm * 26);
      ctx.fillStyle = 'rgba(255,228,92,' + a.toFixed(3) + ')';
      ctx.fillRect(bx, by, 30, 230);
      ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,228,92,.85)';
      ctx.strokeRect(bx, by, 30, 230); ctx.setLineDash([]);
    } else if (ph === 'strike') {
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillRect(bx, by, 30, 230);
      const pts = [[0, 0], [-9, 40], [6, 80], [-10, 125], [5, 170], [-4, 210], [0, 232]];
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((p, i) => { if (i) ctx.lineTo(o.x + p[0], by + p[1]); else ctx.moveTo(o.x + p[0], by + p[1]); });
      ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = '#FFE45C'; ctx.stroke();
    }
    // cloud body
    ctx.beginPath();
    ctx.arc(o.x - 24, o.y + 2, 17, 0, Math.PI * 2);
    ctx.arc(o.x - 8, o.y - 12, 21, 0, Math.PI * 2);
    ctx.arc(o.x + 14, o.y - 8, 20, 0, Math.PI * 2);
    ctx.arc(o.x + 28, o.y + 4, 15, 0, Math.PI * 2);
    ctx.rect(o.x - 24, o.y, 52, 19);
    puffy(ph === 'warn' || ph === 'strike' ? '#9C92F0' : '#C9C2FF');
    // face
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    if (ph === 'warn' || ph === 'strike') {
      ctx.beginPath(); ctx.moveTo(o.x - 14, o.y - 4); ctx.lineTo(o.x - 5, o.y); ctx.moveTo(o.x + 14, o.y - 4); ctx.lineTo(o.x + 5, o.y); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(o.x, o.y + 12, 4, ph === 'strike' ? 5 : 3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(o.x - 9, o.y + 1, 2.4, 3.2, 0, 0, Math.PI * 2); ctx.ellipse(o.x + 9, o.y + 1, 2.4, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x, o.y + 8, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  function drawWall(o) {
    if (!ctx.nativeSprite) return drawWallContent(o);
    const x = viewL - 100, y = o.y - 60, w = viewR - viewL + 200;
    ctx.nativeSprite('wall-'+o.seed+'-'+W, x, y, w, 120, () => drawWallContent(o));
  }
  function drawWallContent(o) {
    const rock = o.skin === 'rock';
    const blobs = [];
    wallBlobs(o, viewL - 60, viewR + 60, (cx, cy, r, i) => blobs.push([cx, cy, r, i]));
    ctx.beginPath();
    for (const b of blobs) { ctx.moveTo(b[0] + b[2], b[1]); ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2); }
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = rock ? '#A5A7B8' : '#F3F6FF'; ctx.fill();
    for (const b of blobs) {
      const cx = b[0], cy = b[1], r = b[2], i = b[3];
      if (rock) {
        ctx.fillStyle = 'rgba(255,255,255,.26)';
        ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.38, r * 0.4, r * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(40,40,70,.18)';
        ctx.beginPath(); ctx.ellipse(cx + r * 0.2, cy + r * 0.45, r * 0.5, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        if (hash(o.seed, i + 7) < 0.35) {
          ctx.strokeStyle = 'rgba(18,48,44,.5)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(cx - r * 0.1, cy - r * 0.2); ctx.lineTo(cx + r * 0.1, cy + r * 0.05); ctx.lineTo(cx - r * 0.05, cy + r * 0.3); ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(150,160,215,.3)';
        ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.5, r * 0.68, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawBoulder(o) {
    if (!ctx.nativeSprite) return drawBoulderContent(o);
    const r = o.r + 12;
    ctx.nativeSprite('boulder-'+o.seed+'-'+W, o.x-r, o.y-r, r*2, r*2, () => drawBoulderContent(o));
  }
  function drawBoulderContent(o) {
    const n = 9, pts = [];
    const off = hash(o.seed, 20) * 0.6;
    for (let k = 0; k < n; k++) {
      const a = k * Math.PI * 2 / n + off, rr = o.r * (0.86 + 0.28 * hash(o.seed, k));
      pts.push([o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr]);
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.beginPath();
    const m0 = mid(pts[n - 1], pts[0]); ctx.moveTo(m0[0], m0[1]);
    for (let k = 0; k < n; k++) { const p = pts[k], m = mid(p, pts[(k + 1) % n]); ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    ctx.closePath();
    ctx.fillStyle = '#A5A7B8'; ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    ctx.beginPath(); ctx.ellipse(o.x - o.r * 0.3, o.y - o.r * 0.38, o.r * 0.38, o.r * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(40,40,70,.18)';
    ctx.beginPath(); ctx.ellipse(o.x + o.r * 0.2, o.y + o.r * 0.5, o.r * 0.5, o.r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(18,48,44,.5)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(o.x - o.r * 0.15, o.y - o.r * 0.1); ctx.lineTo(o.x + o.r * 0.08, o.y + o.r * 0.15); ctx.lineTo(o.x - o.r * 0.06, o.y + o.r * 0.4); ctx.stroke();
  }

  function drawBalloon(o, tm) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(Math.sin(tm * 1.4 + o.ph) * 0.05);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, 22); ctx.lineTo(-7, 38); ctx.moveTo(14, 22); ctx.lineTo(7, 38); ctx.stroke();
    rr(-9, 36, 18, 12, 3); ctx.fillStyle = '#C98A4B'; ctx.lineWidth = 2.5; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.bezierCurveTo(-8, 24, -26, 10, -26, -4);
    ctx.bezierCurveTo(-26, -20, -14, -28, 0, -28);
    ctx.bezierCurveTo(14, -28, 26, -20, 26, -4);
    ctx.bezierCurveTo(26, 10, 8, 24, 0, 28);
    ctx.closePath();
    ctx.fillStyle = '#FF6B57'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#FFD86B'; ctx.fillRect(-9, -30, 18, 62); ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(-14, -12, 4, 8, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawObstacles(tm) {
    for (const o of obst) {
      if (o.y < cam - 260 || o.y > cam + H + 80) continue;
      if (o.t === 'wall') drawWall(o);
      else if (o.t === 'boulder') drawBoulder(o);
      else if (o.t === 'crow') drawCrow(o, tm);
      else if (o.t === 'balloon') drawBalloon(o, tm);
      else if (o.t === 'storm') drawStorm(o, tm);
    }
  }

  function drawDrops(tm) {
    for (const s of drops) {
      if (s.y < cam - 40 || s.y > cam + H + 40) continue;
      const bob = Math.sin(tm * 3 + s.ph) * 3;
      if (s.kind === 'seedpack') {
        // Seed Packs use the same simple teardrop silhouette as water,
        // but with a warm seed-brown fill and a small highlight.
        ctx.save();
        ctx.translate(s.x, s.y + bob);
        ctx.rotate(-0.18 + Math.sin(tm * 2 + s.ph) * 0.04);
        teardrop(0, 0, 0.82);
        ctx.fillStyle = '#B9783E';
        ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#E5B56D';
        ctx.beginPath();
        ctx.ellipse(-2, -3, 3, 6, -0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (s.kind === 'sun') {
        ctx.save();
        ctx.translate(s.x, s.y + bob);
        const pulse = 1 + Math.sin(tm * 5 + s.ph) * 0.06;
        ctx.scale(pulse, pulse);
        ctx.rotate(tm * 0.8);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.fillStyle = '#FFD86B';
        for (let i = 0; i < 8; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 4);
          ctx.beginPath(); ctx.moveTo(-3.5, -12); ctx.lineTo(0, -19); ctx.lineTo(3.5, -12); ctx.closePath();
          ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath(); ctx.ellipse(-4, -4, 3, 2, -0.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        teardrop(s.x, s.y + bob, 1);
        ctx.fillStyle = '#5FC9FF'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath(); ctx.ellipse(s.x - 4, s.y + bob + 3, 2, 3.6, 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function stalkPath() {
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length - 1; i++) {
      const a = trail[i], b = trail[i + 1];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    ctx.lineTo(P.x, P.y + 9);
  }

  function drawDeco(l, tm, force) {
    if (!force && (l.y < cam - 60 || l.y > cam + H + 90)) return;
    const g = 1 - Math.pow(1 - clamp(l.age / (l.kind === 'flower' ? 0.8 : 0.5), 0, 1), 3);
    if (g <= 0) return;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const sway = Math.sin(tm * 1.6 + l.y * 0.02) * 0.07;
    const stem = (x1, y1, cx1, cy1) => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(cx1, cy1, x1, y1);
      ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#4CC27F'; ctx.stroke();
    };
    if (l.kind === 'leaf') {
      // young plants have single leaves, older ones bean-style leaves in threes
      ctx.rotate(l.side * (1.15 + sway));
      ctx.scale(g * l.size, g * l.size);
      const lw = 2.5 / (g * l.size);
      ctx.fillStyle = evoLeaf(EVOS[l.evo || 0], tm + l.y * 0.01, 1); ctx.strokeStyle = INK; ctx.lineWidth = lw;
      const leaflet = (rot, rx, ry, cy) => {
        ctx.save(); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke(); ctx.restore();
      };
      if (l.tri) { leaflet(-0.85, 7, 13, -13); leaflet(0.85, 7, 13, -13); }
      leaflet(0, 8.5, 17, -16);
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -28);
      ctx.strokeStyle = '#2FA35F'; ctx.lineWidth = 1.8; ctx.stroke();
    } else if (l.kind === 'curl') {
      // a twining tendril
      ctx.scale(l.side * g * l.size, g * l.size);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -7);
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, a = Math.PI * 0.9 + t * Math.PI * 3.4, r = 8 * (1 - t) + 1.2;
        ctx.lineTo(14 + Math.cos(a) * r, -14 + Math.sin(a) * r);
      }
      ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#4CC27F'; ctx.stroke();
    } else if (l.kind === 'flower') {
      ctx.scale(g * l.size, g * l.size);
      stem(l.side * 15, -10, l.side * 8, -2);
      ctx.translate(l.side * 15, -10);
      ctx.rotate(sway * 2);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - Math.PI / 2, px = Math.cos(a) * 5.5, py = Math.sin(a) * 5.5;
        ctx.moveTo(px + 4.6, py); ctx.arc(px, py, 4.6, 0, Math.PI * 2);
      }
      ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = l.col; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD86B'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
    } else if (l.kind === 'pod') {
      ctx.scale(g * l.size, g * l.size);
      stem(l.side * 10, 8, l.side * 6, 2);
      ctx.translate(l.side * 10, 8);
      ctx.rotate(l.side * 0.15 + Math.sin(tm * 2 + l.y * 0.03) * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(7, 4, 8, 20, 3, 34);
      ctx.quadraticCurveTo(1, 38, -1, 36);
      ctx.bezierCurveTo(-7, 22, -7, 6, 0, 0);
      ctx.closePath();
      ctx.fillStyle = '#8BE36A'; ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(50,140,50,.4)';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(0.5, 9 + k * 8, 3, 3.6, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // The stem is thin at the growing tip and thickens with age, and thicker overall as the plant matures
  function drawStalk(tm) {
    for (const l of leaves) drawDeco(l, tm);
    const pts = trail.slice();
    pts.push({ x: P.x, y: P.y + 9, d: dist });
    const n = pts.length, m = maturity();
    const widthAt = pt => 6 + clamp((dist - (pt.d || 0)) / 500, 0, 1) * (3.5 + 4.5 * m);
    const segs = [];
    let sx = pts[0].x, sy = pts[0].y;
    for (let i = 1; i < n - 1; i++) {
      const ex = (pts[i].x + pts[i + 1].x) / 2, ey = (pts[i].y + pts[i + 1].y) / 2;
      segs.push({ sx, sy, cx: pts[i].x, cy: pts[i].y, ex, ey, w: widthAt(pts[i]) });
      sx = ex; sy = ey;
    }
    segs.push({ sx, sy, cx: pts[n - 1].x, cy: pts[n - 1].y, ex: pts[n - 1].x, ey: pts[n - 1].y, w: widthAt(pts[n - 1]) });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      ctx.strokeStyle = pass === 0 ? INK : pass === 1 ? '#4CC27F' : 'rgba(190,255,215,.55)';
      let width = -1, active = false;
      for (const q of segs) {
        const w = Math.round(q.w / 0.75) * 0.75;
        const offset = pass === 2 ? -w * 0.2 : 0;
        if (w !== width) {
          if (active) ctx.stroke();
          ctx.beginPath(); ctx.moveTo(q.sx + offset, q.sy);
          ctx.lineWidth = pass === 0 ? w + 4.5 : pass === 1 ? w : Math.max(1.2, w * 0.2);
          width = w; active = true;
        }
        ctx.quadraticCurveTo(q.cx + offset, q.cy, q.ex + offset, q.ey);
      }
      if (active) ctx.stroke();
    }
  }

  // The bean seed, used in the planting cutscene
  function drawSeed(tm) {
    const s = seed;
    ctx.save();
    ctx.translate(s.x, s.y + RAD);
    ctx.scale(1 + 0.25 * s.sq, 1 - 0.25 * s.sq);
    ctx.translate(0, -RAD);
    ctx.rotate(s.rot + 0.08);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const g = ctx.createRadialGradient(5, -8, 2, 0, 0, 22);
    g.addColorStop(0, '#F27A63'); g.addColorStop(1, '#BE4330');
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.bezierCurveTo(9, -16, 16, -9, 16, 1);
    ctx.bezierCurveTo(16, 10, 9, 16, 0, 16);
    ctx.bezierCurveTo(-8, 16, -15, 12, -14, 4);
    ctx.bezierCurveTo(-13, -1, -6, 0, -7, -7);
    ctx.bezierCurveTo(-8, -13, -5, -16, 0, -16);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#F8DCC0';
    ctx.beginPath(); ctx.ellipse(-6, -1.5, 1.6, 4, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.ellipse(8, -9, 4.2, 2.2, -0.6, 0, Math.PI * 2); ctx.fill();
    // face
    const lx = 2;
    ctx.fillStyle = 'rgba(255,190,170,.75)';
    ctx.beginPath(); ctx.ellipse(-7.5 + lx * 0.6, 5, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(11.5 + lx * 0.6, 5, 3.2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2.2;
    if (s.mood === 'squint') {
      ctx.beginPath(); ctx.arc(-3 + lx, 0, 2.8, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(7 + lx, 0, 2.8, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(-3 + lx, -1, 2.6, 3.6, 0, 0, Math.PI * 2);
      ctx.ellipse(7 + lx, -1, 2.6, 3.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(-2.2 + lx, -2.2, 0.95, 0, Math.PI * 2); ctx.arc(7.8 + lx, -2.2, 0.95, 0, Math.PI * 2); ctx.fill();
    }
    if (s.mood === 'fall') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(2 + lx, 6, 2.4, 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(2 + lx, 4, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    ctx.restore();
  }

  // ---- evolutions: how each form of the shoot tip looks ----
  function evoLeaf(ev, tm, k) {
    return ev.leaf === 'rainbow' ? 'hsl(' + Math.floor((tm * 70 + k * 50 + 720) % 360) + ',85%,68%)' : ev.leaf;
  }
  function starPath(cx, cy, r1, r2, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / n;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function twinkle(x, y, s, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = clamp(a, 0, 1);
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(1, -1); ctx.lineTo(4, 0); ctx.lineTo(1, 1); ctx.lineTo(0, 4); ctx.lineTo(-1, 1); ctx.lineTo(-4, 0); ctx.lineTo(-1, -1);
    ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
  }
  function drawFlower(x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 - Math.PI / 2, px = Math.cos(a) * 5.5, py = Math.sin(a) * 5.5;
      ctx.moveTo(px + 4.6, py); ctx.arc(px, py, 4.6, 0, Math.PI * 2);
    }
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD86B'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }
  function miniPod(x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(0.62, 0.62);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.bezierCurveTo(7, 4, 8, 20, 3, 34); ctx.quadraticCurveTo(1, 38, -1, 36); ctx.bezierCurveTo(-7, 22, -7, 6, 0, 0);
    ctx.closePath();
    ctx.fillStyle = '#8BE36A'; ctx.lineWidth = 3.6; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function spiral(sx, sy, dir, s) {
    const cx = sx + dir * 8 * s, cy = sy - 9 * s;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    for (let i = 0; i <= 26; i++) {
      const t = i / 26, a = Math.PI * 0.95 + t * Math.PI * 3.3, r = (7 * (1 - t) + 1.3) * s;
      ctx.lineTo(cx + dir * Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#4CC27F'; ctx.stroke();
  }
  function drawCrown(kind, tm) {
    if (kind === 'none') return;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (kind === 'curl') spiral(1, -10, 1, 1);
    else if (kind === 'tendrils') { spiral(-4, -10, -1, 1.1); spiral(4, -10, 1, 1.1); }
    else if (kind === 'flower') drawFlower(0, -19, 1.05, '#FF9EC4');
    else if (kind === 'pods') { miniPod(-11, 2, 0.5); miniPod(11, 2, -0.5); drawFlower(0, -19, 1.05, '#FFFFFF'); }
    else if (kind === 'puff') {
      ctx.beginPath();
      ctx.moveTo(-2, -12); ctx.arc(-8, -12, 6, 0, Math.PI * 2);
      ctx.moveTo(8, -17); ctx.arc(0, -17, 8, 0, Math.PI * 2);
      ctx.moveTo(14, -12); ctx.arc(8, -12, 6, 0, Math.PI * 2);
      ctx.rect(-8, -12, 16, 6);
      puffy('#FFFFFF');
    } else if (kind === 'sun') {
      ctx.save(); ctx.translate(0, -21); ctx.rotate(tm * 0.8);
      ctx.fillStyle = '#FFB84D'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(0, -13); ctx.lineTo(3, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fillStyle = '#FFD86B'; ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke();
      ctx.restore();
    } else if (kind === 'bolt') {
      ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(tm * 22);
      ctx.beginPath();
      ctx.moveTo(3, -34); ctx.lineTo(-5, -21); ctx.lineTo(0, -21); ctx.lineTo(-4, -10); ctx.lineTo(7, -25); ctx.lineTo(1, -25); ctx.closePath();
      ctx.fillStyle = '#FFE45C'; ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (kind === 'moon') {
      ctx.save(); ctx.translate(0, -22);
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0.818, 4.973, false);
      ctx.arc(4, -1, 7, 4.43, 1.36, true);
      ctx.closePath();
      ctx.fillStyle = '#F3F6FF'; ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
      ctx.restore();
      twinkle(11, -27, 1, 0.6 + 0.4 * Math.sin(tm * 4));
      twinkle(-11, -14, 0.7, 0.6 + 0.4 * Math.sin(tm * 5 + 2));
    } else if (kind === 'star') {
      starPath(0, -23, 11, 5, 5);
      ctx.fillStyle = '#FFD86B'; ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = tm * 2 + i * Math.PI * 2 / 3;
        twinkle(Math.cos(a) * 22, -8 + Math.sin(a) * 13, 0.8, 0.85);
      }
    }
  }

  // The player: the growing tip of the shoot, a bud between two leaves, with a crown that depends on its evolution
  function drawShoot(px, py, sq, look, rot, tm, open, thirsty, grow, evo) {
    const ev = evo || EVOS[0];
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    const sc = 1 + 0.15 * sq;
    ctx.scale(sc * grow, grow / sc);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    if (ev.glow) {          // higher forms glow
      const gl = ctx.createRadialGradient(0, -8, 4, 0, -8, 48);
      const a = 0.5 + 0.12 * Math.sin(tm * 3);
      gl.addColorStop(0, 'rgba(' + ev.glow + ',' + a.toFixed(2) + ')'); gl.addColorStop(1, 'rgba(' + ev.glow + ',0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -8, 48, 0, Math.PI * 2); ctx.fill();
    }

    // two leaves: folded when it first emerges, splayed while growing, drooping when thirsty
    const spread = 0.05 + ((thirsty ? 1.5 : 0.75) - 0.05) * open + Math.sin(tm * 11) * 0.06 * open + sq * 0.15;
    const ls = ev.ls;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * spread);
      ctx.beginPath();
      if (ev.shape === 'point') {
        ctx.moveTo(0, -1);
        ctx.bezierCurveTo(12 * ls, -9 * ls, 10.5 * ls, -27 * ls, 0, -37 * ls);
        ctx.bezierCurveTo(-10.5 * ls, -27 * ls, -12 * ls, -9 * ls, 0, -1);
        ctx.closePath();
      } else {
        ctx.ellipse(0, -18 * ls, 9.5 * ls, 18 * ls, 0, 0, Math.PI * 2);
      }
      ctx.fillStyle = evoLeaf(ev, tm, side); ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -32 * ls);
      ctx.strokeStyle = ev.vein; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.restore();
    }

    // the bud between them
    const g = ctx.createRadialGradient(-3, -5, 2, 0, 0, 15);
    g.addColorStop(0, ev.bud[0]); g.addColorStop(1, ev.bud[1]);
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();

    drawCrown(ev.crown, tm);

    // face
    const lx = look * 2.5;
    ctx.fillStyle = 'rgba(255,150,150,.6)';
    ctx.beginPath(); ctx.ellipse(-7 + lx * 0.5, 4, 2.6, 1.8, 0, 0, Math.PI * 2);
    ctx.ellipse(7 + lx * 0.5, 4, 2.6, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(-3.6 + lx, -1.5, 1.9, 2.7, 0, 0, Math.PI * 2);
    ctx.ellipse(3.6 + lx, -1.5, 1.9, 2.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(-3 + lx, -2.4, 0.7, 0, Math.PI * 2); ctx.arc(4.2 + lx, -2.4, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = INK;
    ctx.beginPath();
    if (thirsty) ctx.arc(lx, 7, 2.8, 1.2 * Math.PI, 1.8 * Math.PI);
    else ctx.arc(lx, 3, 2.9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    if (thirsty) {
      teardrop(13, -6, 0.55);
      ctx.fillStyle = '#5FC9FF'; ctx.lineWidth = 1.6; ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(tm) {
    const thirsty = water < 25 && state === 'play';
    if (invuln > 0 && Math.floor(tm * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    const gr = (1 + 0.35 * maturity()) * abilityScale();     // the shoot tip gets bigger/smaller with an active ability
    const up = clamp((GY + 30 - P.y) / 60, 0, 1);      // leaves unfurl as the tip breaks through the surface
    drawShoot(P.x, P.y, P.sq, clamp(P.vx / 300, -1, 1), P.ang, tm, P.open * (0.3 + 0.7 * up), thirsty, gr, EVOS[curEvo]);
    ctx.globalAlpha = 1;
    if (shield) {
      ctx.save();
      ctx.translate(P.x, P.y);
      ctx.setLineDash([9, 7]); ctx.lineDashOffset = -tm * 24;
      ctx.beginPath(); ctx.arc(0, -6 * gr, 28 * gr, 0, Math.PI * 2);
      ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#FFD86B'; ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawVictoryScene(tm, moon = false) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!moon) {
      const wall = ctx.createLinearGradient(0, 0, 0, vh);
      wall.addColorStop(0, '#5C8B74'); wall.addColorStop(1, '#355B4B');
      ctx.fillStyle = wall; ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = '#876447'; ctx.fillRect(0, vh * .74, vw, vh * .26);
      ctx.strokeStyle = '#12302C'; ctx.lineWidth = 5; ctx.strokeRect(18, 18, vw - 36, vh - 36);

      ctx.textAlign = 'center';
      ctx.font = "42px 'Bagel Fat One', 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.strokeText('Congratulations, you made it!', vw / 2, vh * .16);
      ctx.fillStyle = '#FFD86B'; ctx.fillText('Congratulations, you made it!', vw / 2, vh * .16);
      ctx.font = "24px 'Bagel Fat One', 'Trebuchet MS', sans-serif";
      ctx.fillStyle = '#FFFFFF'; ctx.lineWidth = 5; ctx.strokeStyle = INK;
      ctx.strokeText('Steer into a choice', vw / 2, vh * .23);
      ctx.fillText('Steer into a choice', vw / 2, vh * .23);

      const targetW = Math.min(150, vw * 0.34), targetH = Math.min(210, vh * 0.34), y = vh * .43;
      const leftX = vw * .22, rightX = vw * .78;
      function sign(cx, fill, title, sub) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = INK; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.roundRect(cx - targetW/2, y - targetH/2, targetW, targetH, 22); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.font = "28px 'Bagel Fat One', 'Trebuchet MS', sans-serif";
        ctx.fillStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.strokeStyle = INK;
        ctx.strokeText(title, cx, y - 8); ctx.fillText(title, cx, y - 8);
        ctx.font = "18px 'Trebuchet MS', sans-serif";
        ctx.strokeText(sub, cx, y + 26); ctx.fillText(sub, cx, y + 26);
      }
      sign(leftX, '#566B9C', 'GO TO THE', 'MOON');
      sign(rightX, '#FFD86B', 'GO BACK', 'MAIN MENU');

      ctx.fillStyle = 'rgba(18,48,44,.22)'; ctx.beginPath(); ctx.ellipse(victoryX, vh * .72, 42, 10, 0, 0, Math.PI * 2); ctx.fill();
      drawShoot(victoryX, vh * .67, 0, 0, 0, tm, 1, false, 1.15, EVOS[0]);

      ctx.font = "16px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.fillText(tvMode ? 'Use the remote to steer left or right' : 'Drag left or right', vw / 2, vh * .91);
    }
    ctx.globalAlpha = 1;
  }

  function render(tm) {
    if (state === 'victory') {
      drawVictoryScene(tm, false);
      return;
    }
    if (state === 'moon') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#17352D';
      ctx.fillRect(0, 0, vw, vh);
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(tm);
    const camDraw = cam;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, -dpr * scale * camDraw);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    drawTerrain(tm);
    drawMilestones();
    drawShowers(tm);
    drawObstacles(tm);
    drawDrops(tm);
    const grown = state === 'play' || state === 'over' || state === 'menu' || introT >= 4.0;
    if (grown) drawStalk(tm);
    if (grown && (state !== 'over' || won)) drawPlayer(tm);
    if (seed && seed.vis && (state === 'intro' || state === 'menu')) {
      if (seed.clip) {          // still sinking into the grass: hide whatever is below the surface
        ctx.save();
        ctx.beginPath(); ctx.rect(viewL, cam - 800, viewR - viewL, (GY + 6) - (cam - 800)); ctx.clip();
        drawSeed(tm);
        ctx.restore();
      } else drawSeed(tm);
    }

    for (const q of parts) {
      ctx.globalAlpha = clamp(q.life, 0, 1);
      ctx.fillStyle = q.c;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = "26px 'Bagel Fat One', 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = '#FFD86B'; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (state === 'menu' && menuFade > 0.01) {          // fade in and out of the menu time-lapse
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(10,28,26,' + menuFade.toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  // ---------- victory room ----------
  // Move the seedling left/right with the same controls as the main game.
  // Touch/drag on mobile updates victoryX; the keyboard works on PC.
  function stepVictory(dt) {
    const dir = clamp((keys.l ? -1 : 0) + (keys.r ? 1 : 0) + padX, -1, 1);
    if (dir) victoryX += dir * VICTORY_SPEED * dt;
    victoryX = clamp(victoryX, 40, vw - 40);

    const targetW = Math.min(150, vw * 0.34);
    const leftX = vw * 0.22;
    const rightX = vw * 0.78;
    const hitRange = targetW * 0.5 + 34;

    if (Math.abs(victoryX - leftX) <= hitRange) {
      showMoonComingSoon();
      return;
    }
    if (Math.abs(victoryX - rightX) <= hitRange) {
      toMenu();
      return;
    }
  }

  function showMoonComingSoon() {
    state = 'moon';
    ptr = null;
    keys.l = keys.r = false;
    hudEl.classList.add('hidden');
    hintEl.classList.add('hidden');
    hide(victoryRoomEl);
    show(moonSceneEl);
    buzz(40);
  }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));      // never negative, even on the very first frame
    last = now;
    const tm = now / 1000;
    tmNow = tm;
    pollPad(now);

    if (state === 'play') {
      stepPlay(dt);
      stepFx(dt);
    } else if (state === 'victory') {
      stepVictory(dt);
    } else if (state === 'over') {
      stepFx(dt);
    } else if (state === 'moon') {
      // Coming-soon overlay is static.
    } else if (state === 'paused') {
      // frozen
    } else if (state === 'countdown') {
      cdT -= dt;
      const n = Math.ceil(cdT);
      if (n <= 0) { state = 'play'; hide(countEl); invuln = Math.max(invuln, 0.6); }
      else if (countEl.textContent !== String(n)) countEl.textContent = String(n);
    } else if (state === 'menu') {
      stepMenu(dt);       // the menu shows a time-lapse of the whole climb, dirt to space
      stepFx(dt);
    } else {
      stepIntro(dt);      // plays the planting cutscene
      stepFx(dt);
    }
    shake = Math.max(0, shake - dt * 3.2);
    render(tm);
    requestAnimationFrame(frame);
  }

  // ---------- screen wake lock ----------
  // Keeps the display from dimming/sleeping during a run (the finger stays
  // on the glass most of the time, but not always). No-ops safely on any
  // WebView/browser that doesn't support the API.
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if (wakeLock || !('wakeLock' in navigator)) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }
  document.addEventListener('visibilitychange', () => {
    // The OS revokes the lock whenever the tab/app is hidden; re-request it
    // once we're back and still mid-run.
    if (document.visibilityState === 'visible' && (state === 'play' || state === 'countdown' || state === 'intro')) requestWakeLock();
  });

  // ---------- Android hardware/gesture back button ----------
  // A wrapped WebView (Capacitor, Cordova, a Trusted Web Activity, or a
  // plain WebView whose host calls goBack()) turns the back button/edge
  // gesture into browser history navigation. With no history at all, that
  // exits the app instantly, even mid-run. Keep one "guard" entry pushed at
  // all times so back always has somewhere to go, and route it through the
  // menu/pause logic that already exists instead of letting the page
  // navigate or the app close unexpectedly.
  function pushBackGuard() { try { history.pushState({ bbGuard: true }, ''); } catch (e) {} }
  function closeTopOverlay() {
    if (!whatsNewEl.classList.contains('hidden')) return true;
    if (!updatesInfoEl.classList.contains('hidden')) { hide(updatesInfoEl); show(settingsEl); updateSettingsUI(); return true; }
    if (!settingsEl.classList.contains('hidden')) {
      if (!aboutEl.classList.contains('hidden')) { hide(aboutEl); show(settingsEl); updateSettingsUI(); }
      else closeSettings();
      return true;
    }
    if (!evosEl.classList.contains('hidden')) { hide(evosEl); show(settingsEl); updateSettingsUI(); return true; }
    if (!howEl.classList.contains('hidden')) { hide(howEl); show(settingsEl); updateSettingsUI(); return true; }
    if (!endlessInfoEl.classList.contains('hidden')) { hide(endlessInfoEl); show(startEl); return true; }
    if (!moonSceneEl.classList.contains('hidden')) { toMenu(); return true; }
    if (!victoryRoomEl.classList.contains('hidden')) { toMenu(); return true; }
    return false;
  }
  window.addEventListener('popstate', () => {
    if (closeTopOverlay()) { pushBackGuard(); return; }
    if (state === 'play') { pauseGame(); pushBackGuard(); return; }
    if (state !== 'menu') { toMenu(); pushBackGuard(); return; }
    // Already at the bare main menu: let this one go through so the
    // wrapper's own back behaviour (minimize/exit the app) can happen.
  });
  pushBackGuard();


  // ---------- Apple TV remote, keyboard and game controller ----------
  // A web page sees the Siri Remote as some mix of: arrow keys + Enter (swipe / click), a back key or
  // history-back (Menu), media keys (Play/Pause) or a Gamepad. Everything funnels into four helpers:
  // navMove (d-pad around a menu), navSelect (press the highlighted button), remoteBack, togglePauseKey.
  const NAV_OVERLAYS = ['whatsNew', 'resetConfirm', 'updatesInfo', 'about', 'settings', 'evos', 'how', 'endlessInfo', 'moonScene', 'pause', 'over', 'start'];
  const NAV_DEFAULT = { whatsNew: 'whatsNewDismiss', resetConfirm: 'resetConfirmNo', pause: 'resume', over: 'again', start: 'play', moonScene: 'moonPlayAgain', endlessInfo: 'endlessInfoBack' };
  const KEEP_FOCUS = { start: true, settings: true };       // come back to the button you left from
  const lastFocus = {};
  const isHidden = el => el.classList.contains('hidden');
  const HOW_LEAD = $('howLead').textContent, MUSIC_HINT = $('musicHint').textContent, SEED_SMALL = $('seedHelpSmall').textContent;

  function updateTvScale() {
    document.documentElement.style.setProperty('--tvz', tvMode ? Math.max(0.6, window.innerHeight / 540).toFixed(3) : '1');
  }
  function applyTvMode() {
    document.body.classList.toggle('tv', tvMode);
    document.body.classList.toggle('navfocus', tvMode || navUsed);
    updateTvScale();
    $('howLead').textContent = tvMode
      ? 'Use the remote to steer your shoot left and right, and press Play/Pause to pause. Catch raindrops before you run dry, avoid hazards, and climb to 100,000 m to reach space.'
      : HOW_LEAD;
    $('musicHint').textContent = tvMode ? 'Press Select to start the music' : MUSIC_HINT;
    $('seedHelpSmall').textContent = tvMode ? 'Press Select to see its possible abilities' : SEED_SMALL;
  }
  function setTvMode(on) {
    tvMode = on;
    saveSetting(TV_KEY, on ? 'on' : 'off');
    applyTvMode();
    updateSettingsUI();
  }
  function markNav() {
    if (navUsed) return;
    navUsed = true;
    document.body.classList.add('navfocus');
  }

  function topOverlay() {
    if (!isHidden(splashEl)) return null;
    for (const id of NAV_OVERLAYS) { const el = $(id); if (el && !isHidden(el)) return el; }
    return null;
  }
  function focusables(ov) {
    return Array.from(ov.querySelectorAll('button')).filter(b => !b.disabled && b.getClientRects().length > 0);
  }
  function defaultFocus(ov) {
    const items = focusables(ov);
    const mem = KEEP_FOCUS[ov.id] && lastFocus[ov.id];
    if (mem && items.includes(mem)) return mem;
    const d = NAV_DEFAULT[ov.id] && $(NAV_DEFAULT[ov.id]);
    if (d && items.includes(d)) return d;
    return items[0] || null;
  }
  function focusEl(el, keepScroll) {
    if (!el) return;
    try { el.focus({ preventScroll: !!keepScroll }); } catch (e) { el.focus(); }
  }
  document.addEventListener('focusin', e => {
    const ov = e.target.closest && e.target.closest('.overlay');
    if (ov) lastFocus[ov.id] = e.target;
  });

  // Keep a button highlighted whenever a menu is up (so Select always has something to press).
  let focusOv = null;
  setInterval(() => {
    if (!(tvMode || navUsed)) return;
    const ov = topOverlay();
    if (ov !== focusOv) { focusOv = ov; if (ov) ov.scrollTop = 0; }
    const a = document.activeElement;
    if (!ov) { if (a && a !== document.body && a.closest && a.closest('.overlay')) a.blur(); return; }
    if (a && ov.contains(a) && a.getClientRects().length > 0) return;
    focusEl(defaultFocus(ov), true);       // start at the top of a long page instead of jumping to its bottom button
  }, 100);

  // Move the highlight to the nearest button in a direction; long pages scroll to reveal what's next.
  function navMove(dir) {
    const ov = topOverlay();
    if (!ov) return;
    const items = focusables(ov);
    const cur = document.activeElement;
    if (!items.includes(cur)) { focusEl(defaultFocus(ov), true); return; }
    const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      let along, across;
      if (dir === 'up') { along = -dy; across = Math.abs(dx); }
      else if (dir === 'down') { along = dy; across = Math.abs(dx); }
      else if (dir === 'left') { along = -dx; across = Math.abs(dy); }
      else { along = dx; across = Math.abs(dy); }
      if (along < 4) continue;
      const score = along + across * 3;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (dir === 'up' || dir === 'down') {
      const sgn = dir === 'down' ? 1 : -1;
      const canScroll = sgn > 0 ? ov.scrollTop + ov.clientHeight < ov.scrollHeight - 2 : ov.scrollTop > 2;
      if (canScroll) {
        const r = best && best.getBoundingClientRect();
        const onScreen = r && r.top >= 0 && r.bottom <= ov.clientHeight;
        if (!onScreen) { ov.scrollTop += sgn * ov.clientHeight * 0.5; return; }
      }
    }
    if (best) focusEl(best);
  }
  function navSelect() {
    const ov = topOverlay();
    if (!ov) return false;
    const a = document.activeElement;
    if (a && ov.contains(a) && a.getClientRects().length > 0) a.click();
    else focusEl(defaultFocus(ov), true);
    return true;
  }
  // Menu / Back / B: out of a dialog, or pause, or back to the main menu
  function remoteBack() {
    if (!isHidden($('resetConfirm'))) { cancelResetConfirm(); return; }
    if (closeTopOverlay()) return;
    if (state === 'play') pauseGame();
    else if (state === 'paused') resumeGame();
    else if (state === 'over' || state === 'intro' || state === 'countdown') toMenu();
  }
  function togglePauseKey() {
    if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame();
  }

  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (!isHidden(splashEl)) { if (!splashEl.classList.contains('fade-out')) skipDeveloperSplash(); return; }
    const dir = k === 'ArrowUp' ? 'up' : k === 'ArrowDown' ? 'down' : k === 'ArrowLeft' ? 'left' : k === 'ArrowRight' ? 'right' : null;
    if (dir && topOverlay()) { e.preventDefault(); markNav(); navMove(dir); return; }
    if ((k === 'Enter' || k === ' ') && state === 'intro') { e.preventDefault(); if (!e.repeat && introT > 0.5) skipIntro(); return; }
    if (k === 'MediaPlayPause' || k === 'MediaPlay' || k === 'MediaPause' || e.code === 'MediaPlayPause') { e.preventDefault(); togglePauseKey(); return; }
    if (k === 'Backspace' || k === 'BrowserBack' || k === 'GoBack') { e.preventDefault(); remoteBack(); }
  });

  // A click on the edge of the remote is only a few milliseconds long, so in TV mode every
  // left/right press keeps steering for a moment instead of being a barely visible nudge.
  const heldKey = { l: false, r: false }, latchUntil = { l: 0, r: 0 };
  const sideOf = k => (k === 'ArrowLeft' || k === 'a' || k === 'A') ? 'l' : (k === 'ArrowRight' || k === 'd' || k === 'D') ? 'r' : null;
  window.addEventListener('keydown', e => {
    const s = sideOf(e.key);
    if (s) { heldKey[s] = true; latchUntil[s] = performance.now() + 200; }
  });
  window.addEventListener('keyup', e => {
    const s = sideOf(e.key);
    if (!s) return;
    heldKey[s] = false;
    const rest = latchUntil[s] - performance.now();
    if (tvMode && rest > 0) {
      keys[s] = true;
      setTimeout(() => { if (!heldKey[s]) keys[s] = false; }, rest);
    }
  });

  // Game controllers and the Siri Remote when it is exposed as a Gamepad (standard mapping:
  // d-pad 12-15 or axes 0/1, A = 0 select, B = 1 back, X = 2 / Start = 9 pause).
  const padHeld = {}, padNext = {};
  function padEdge(name, on, now, repeat) {
    if (!on) { padHeld[name] = false; return false; }
    if (!padHeld[name]) { padHeld[name] = true; padNext[name] = now + 380; return true; }
    if (repeat && now >= padNext[name]) { padNext[name] = now + 130; return true; }
    return false;
  }
  function pollPad(now) {
    padX = 0;
    let gp = null;
    try {
      const list = navigator.getGamepads ? navigator.getGamepads() : null;
      if (list) for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected) { gp = list[i]; break; }
    } catch (e) {}
    if (!gp) return;
    const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes.length > 0 ? gp.axes[0] : 0, ay = gp.axes.length > 1 ? gp.axes[1] : 0;
    const left = btn(14) || ax < -0.5, right = btn(15) || ax > 0.5, up = btn(12) || ay < -0.5, down = btn(13) || ay > 0.5;
    const select = btn(0), back = btn(1), pause = btn(2) || btn(9);
    if (!isHidden(splashEl)) {
      if (padEdge('any', left || right || up || down || select || back || pause, now, false) && !splashEl.classList.contains('fade-out')) skipDeveloperSplash();
      return;
    }
    if (state === 'play' || state === 'victory') {
      let v = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
      if (!v && Math.abs(ax) > 0.2) v = ax;
      padX = clamp(v, -1, 1);
      if (padX && state === 'play' && !hinted) { hinted = true; hintEl.classList.add('hidden'); }
    }
    const eL = padEdge('left', left, now, true), eR = padEdge('right', right, now, true);
    const eU = padEdge('up', up, now, true), eD = padEdge('down', down, now, true);
    const eSel = padEdge('select', select, now, false), eBack = padEdge('back', back, now, false), ePause = padEdge('pause', pause, now, false);
    if (topOverlay()) {
      if (eL) { markNav(); navMove('left'); }
      if (eR) { markNav(); navMove('right'); }
      if (eU) { markNav(); navMove('up'); }
      if (eD) { markNav(); navMove('down'); }
      if (eSel) { markNav(); navSelect(); }
    } else if (state === 'intro' && eSel && introT > 0.5) {
      skipIntro();
    }
    if (eBack) remoteBack();
    if (ePause) togglePauseKey();
  }

  applyTvMode();

  window.addEventListener('resize', resize);
  resize();
  reset();
  menuInit();
  updateBestStart();
  updateSettingsUI();
  initSavedBest();

  // Show the developer logo briefly before the main menu.
  let splashTimer = setTimeout(showMainMenuAfterSplash, 2200);
  function showMainMenuAfterSplash() {
    if (!splashEl || splashEl.classList.contains('hidden')) return;
    splashEl.classList.add('fade-out');
    setTimeout(() => {
      splashEl.classList.add('hidden');
      if (showWhatsNewIfNeeded()) return;
      show(startEl);
      initAudio();
      startMusic();                 // tries to play right away; if the platform
      if (AC && AC.state === 'running') { const h = $('musicHint'); if (h) h.hidden = true; }
      // blocks autoplay, the tap-anywhere fallback below (menuMusicGesture) unlocks it.
    }, 550);
  }
  function skipDeveloperSplash() {
    clearTimeout(splashTimer);
    showMainMenuAfterSplash();
  }
  splashEl.addEventListener('pointerdown', skipDeveloperSplash, { once: true });

  globalThis.beanbound = {
    snapshot: () => ({state, score, water, best, maxM, playerX: P.x, layer: LAYERS[layer].name,
      ability: ability ? abilityLabel(ability) : '', muted,
      overlay: topOverlay() ? topOverlay().id : '',
      splash: !isHidden(splashEl), countdown: countEl.textContent,
      evolutions: EVOS.map(e => ({name: e.name, m: e.m, desc: e.desc, unlocked: maxM >= e.m}))}),
    back: remoteBack, pause: togglePauseKey,
    select: () => { if (!isHidden(splashEl)) skipDeveloperSplash(); else if (state === 'intro') skipIntro(); },
    background: () => { keys.l = keys.r = false; padX = 0; pauseGame(); },
    steering: x => { globalThis.nativeAxis = x; }
  };
  requestAnimationFrame(frame);
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
