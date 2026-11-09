(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    start: $('startScreen'), result: $('resultScreen'), startBtn: $('startButton'), retry: $('retryButton'),
    stats: $('runStats'), souls: $('souls'), depth: $('depth'), hearts: $('hearts'), bossHud: $('bossHud'),
    bossName: $('bossName'), bossBar: $('bossBar'), toast: $('toast'), touch: $('touchControls'),
    bottom: $('bottomNote'), finalSouls: $('finalSouls'), resultTitle: $('resultTitle'),
    resultText: $('resultText'), resultEyebrow: $('resultEyebrow'), sound: $('soundButton')
  };
  let W = 0, H = 0, dpr = 1, last = 0, audio = null, soundOn = false;
  let state = 'title', time = 0, distance = 0, souls = 0, hp = 3, speed = 220;
  let player, obstacles, bolts, enemyBolts, particles, boss, bossIndex = 0, nextBoss = 720;
  let obstacleClock = 0, shotClock = 0, hitFlash = 0, shake = 0, toastClock = 0;
  const bosses = [
    { name: 'THE HOLLOW WARDEN', title: 'The ossuary gatekeeper', hp: 7, color: '#b67b50', type: 'warden' },
    { name: 'MOTHER OF CINDERS', title: 'The last ember-witch', hp: 10, color: '#df6f4f', type: 'witch' },
    { name: 'THE DROWNED KING', title: 'He who sleeps beneath', hp: 13, color: '#79a7a4', type: 'king' }
  ];
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist2 = (a, b, x, y) => (a - x) ** 2 + (b - y) ** 2;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true }); resize();

  function reset() {
    distance = 0; souls = 0; hp = 3; speed = 220; time = 0; bossIndex = 0; nextBoss = 720;
    obstacles = []; bolts = []; enemyBolts = []; particles = []; obstacleClock = .7; shotClock = 0; hitFlash = 0; shake = 0;
    player = { x: W * .245, y: H * .5, vy: 0, flap: 0, invuln: 0, tilt: 0 };
    boss = null; updateHUD();
  }
  function begin() {
    reset(); state = 'playing'; ui.start.hidden = true; ui.result.hidden = true;
    ui.stats.hidden = false; ui.hearts.hidden = false; ui.touch.hidden = false; ui.bottom.classList.add('is-hidden');
    last = performance.now(); sound('start');
  }
  function finish(won = false) {
    if (state !== 'playing') return;
    state = won ? 'won' : 'dead'; ui.touch.hidden = true; ui.result.hidden = false;
    ui.finalSouls.textContent = String(souls).padStart(3, '0');
    ui.resultTitle.textContent = won ? 'ASCENDANT' : 'FALLEN';
    ui.resultText.textContent = won ? 'The old gods remember your name.' : 'The dark takes another.';
    ui.resultEyebrow.innerHTML = won ? '<span></span> A LEGEND IS BORN <span></span>' : '<span></span> THE DEPTHS REMEMBER <span></span>';
    sound(won ? 'win' : 'die'); updateHUD();
  }
  ui.startBtn.addEventListener('click', begin);
  ui.retry.addEventListener('click', begin);
  ui.sound.addEventListener('click', () => {
    soundOn = !soundOn; ui.sound.classList.toggle('muted', !soundOn);
    if (soundOn && !audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (soundOn && audio?.state === 'suspended') audio.resume();
    if (soundOn) sound('start');
  });

  function sound(kind) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      const notes = { flap: [240, 110, .11], cast: [510, 210, .16], hit: [120, 45, .26], hurt: [190, 60, .28], boss: [330, 75, .7], start: [180, 280, .25], win: [220, 520, .9], die: [160, 42, .65] }[kind] || [220, 120, .15];
      osc.type = kind === 'cast' ? 'sine' : 'triangle'; osc.frequency.setValueAtTime(notes[0], now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(notes[1], 1), now + notes[2]);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(kind === 'boss' || kind === 'win' ? .12 : .055, now + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, now + notes[2]); osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + notes[2] + .02);
    } catch (_) { /* Audio is optional. */ }
  }

  function flap() {
    if (state !== 'playing') return;
    player.vy = -390; player.flap = 1; burst(player.x - 12, player.y + 5, '#d7b17b', 5, 65); sound('flap');
  }
  function cast() {
    if (state !== 'playing' || shotClock > 0) return;
    shotClock = .31;
    bolts.push({ x: player.x + 23, y: player.y - 1, vx: 590, life: 1.8, r: 5 });
    burst(player.x + 17, player.y, '#e6bf78', 4, 45); sound('cast');
  }
  function keydown(e) {
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') state === 'title' ? begin() : flap();
    if (e.code === 'KeyX' || e.code === 'Enter') cast();
    if (e.code === 'KeyM') ui.sound.click();
  }
  window.addEventListener('keydown', keydown);
  canvas.addEventListener('pointerdown', (e) => { if (state === 'playing') { e.preventDefault(); flap(); } });
  $('flapButton').addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });
  $('castButton').addEventListener('pointerdown', (e) => { e.preventDefault(); cast(); });

  function updateHUD() {
    ui.souls.textContent = String(souls).padStart(3, '0');
    ui.depth.innerHTML = `${Math.floor(distance / 10)} <small>m</small>`;
    ui.hearts.innerHTML = Array.from({ length: 3 }, (_, i) => `<span style="opacity:${i < hp ? 1 : .22}">${i < hp ? '♥' : '♡'}</span>`).join('');
    if (boss) {
      ui.bossHud.hidden = false; ui.bossName.textContent = boss.data.name;
      ui.bossBar.style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
    } else ui.bossHud.hidden = true;
  }
  function announce(text) {
    ui.toast.textContent = text; ui.toast.classList.add('show'); toastClock = 2.15;
  }
  function burst(x, y, color, count = 8, velocity = 120) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), v = rand(velocity * .25, velocity);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.25, .75), max: .75, size: rand(1.3, 3.5), color });
    }
  }
  function damage() {
    if (player.invuln > 0 || state !== 'playing') return;
    hp--; player.invuln = 1.45; player.vy = -180; shake = 9; hitFlash = .3;
    burst(player.x, player.y, '#f0805c', 19, 190); sound('hurt'); updateHUD();
    if (hp <= 0) finish(false);
  }

  function update(dt) {
    time += dt; hitFlash = Math.max(0, hitFlash - dt); shake = Math.max(0, shake - dt * 30); shotClock = Math.max(0, shotClock - dt);
    if (toastClock > 0 && (toastClock -= dt) <= 0) ui.toast.classList.remove('show');
    if (state !== 'playing') return;
    speed = Math.min(290, 220 + distance * .012);
    distance += speed * dt;
    player.x = W * .245; player.vy += 840 * dt; player.vy = Math.min(440, player.vy); player.y += player.vy * dt;
    player.tilt = clamp(player.vy / 550, -.62, .78); player.flap = Math.max(0, player.flap - dt * 3.8); player.invuln = Math.max(0, player.invuln - dt);
    const ceiling = H * .115, floor = H * .885;
    if (player.y < ceiling + 10 || player.y > floor - 10) damage();

    obstacleClock -= dt;
    if (obstacleClock <= 0) {
      const gap = Math.max(154, Math.min(210, H * .37 - Math.max(0, distance - 900) * .007));
      const middle = rand(H * .33, H * .68);
      obstacles.push({ x: W + 70, gapTop: middle - gap / 2, gapBottom: middle + gap / 2, width: rand(58, 84), scored: false, seed: rand(0, 1000) });
      obstacleClock = Math.max(.94, (W * .61) / speed);
    }
    for (const o of obstacles) {
      o.x -= speed * dt;
      if (!o.scored && o.x + o.width < player.x) { o.scored = true; souls += 5; updateHUD(); }
      if (player.x + 15 > o.x && player.x - 13 < o.x + o.width && (player.y - 12 < o.gapTop || player.y + 12 > o.gapBottom)) damage();
    }
    obstacles = obstacles.filter(o => o.x + o.width > -30);

    if (!boss && bossIndex < bosses.length && distance >= nextBoss) {
      const data = bosses[bossIndex]; boss = { data, x: W * .79, y: H * .5, hp: data.hp, maxHp: data.hp, clock: .8, phase: rand(0, 6), flash: 0 };
      announce(data.name); sound('boss'); updateHUD();
    }
    if (boss) {
      boss.x = W * .79 + Math.sin(time * .65 + boss.phase) * W * .025;
      boss.y = H * .5 + Math.sin(time * .93 + boss.phase) * H * .17;
      boss.clock -= dt; boss.flash = Math.max(0, boss.flash - dt);
      if (boss.clock <= 0) {
        boss.clock = Math.max(1.1, 2.15 - bossIndex * .2);
        const dx = player.x - boss.x, dy = player.y - boss.y, len = Math.hypot(dx, dy) || 1;
        enemyBolts.push({ x: boss.x - 45, y: boss.y + rand(-20, 20), vx: dx / len * 205, vy: dy / len * 205, life: 4, r: 9, color: boss.data.color });
      }
      if (dist2(player.x, player.y, boss.x, boss.y) < (76 * 76)) damage();
      for (const b of bolts) {
        if (!b.hit && dist2(b.x, b.y, boss.x, boss.y) < 70 * 70) {
          b.hit = true; boss.hp--; boss.flash = .16; burst(b.x, b.y, boss.data.color, 9, 130); sound('hit'); updateHUD();
          if (boss.hp <= 0) {
            burst(boss.x, boss.y, boss.data.color, 35, 230); souls += 50 + bossIndex * 25; bossIndex++;
            boss = null; nextBoss = distance + 620; announce('AN ANCIENT SOUL, CLAIMED'); sound('win'); updateHUD();
            if (bossIndex >= bosses.length) { finish(true); }
          }
        }
      }
    }
    for (const b of bolts) { b.x += b.vx * dt; b.life -= dt; }
    bolts = bolts.filter(b => b.life > 0 && b.x < W + 40 && !b.hit);
    for (const b of enemyBolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (dist2(player.x, player.y, b.x, b.y) < (b.r + 13) ** 2) { b.life = 0; damage(); burst(b.x, b.y, b.color, 10, 140); }
    }
    enemyBolts = enemyBolts.filter(b => b.life > 0 && b.x > -30 && b.x < W + 30 && b.y > 0 && b.y < H);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    if (Math.random() < dt * 2.5) particles.push({ x: rand(0, W), y: H * .9, vx: rand(-12, 12), vy: rand(-38, -12), life: 2, max: 2, size: rand(1, 3), color: '#c88753' });
    updateHUD();
  }

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#15110f'); bg.addColorStop(.48, '#241a17'); bg.addColorStop(1, '#0c0b0b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * .68, H * .49, 5, W * .68, H * .49, Math.max(W, H) * .68);
    glow.addColorStop(0, '#68433155'); glow.addColorStop(.48, '#30221d35'); glow.addColorStop(1, '#06060600');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // Receding arches make the cave feel deeper than the narrow flight path.
    for (let i = 4; i >= 0; i--) {
      const x = W * (.49 + i * .15) - ((distance * (.13 + i * .025)) % (W * .15));
      const y = H * .5 + Math.sin(time * .2 + i) * 5, rw = W * (.16 + i * .04), rh = H * (.29 + i * .035);
      ctx.beginPath(); ctx.ellipse(x, y, rw, rh, 0, Math.PI, 0);
      ctx.strokeStyle = `rgba(174,123,82,${.08 + i * .016})`; ctx.lineWidth = Math.max(2, 8 - i); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, rw * .94, rh * .94, 0, Math.PI, 0);
      ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.lineWidth = 3; ctx.stroke();
    }
    const upperEdge = H * .115, lowerEdge = H * .885;
    // Heavy cave ceiling.
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, upperEdge + Math.sin(distance * .002) * 9);
    for (let x = W; x >= 0; x -= 24) {
      const y = upperEdge + Math.sin(x * .012 + distance * .003) * 7 + Math.sin(x * .027 + distance * .001) * 4;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const roof = ctx.createLinearGradient(0, 0, 0, H * .28); roof.addColorStop(0, '#080808'); roof.addColorStop(.65, '#181210'); roof.addColorStop(1, '#38251d');
    ctx.fillStyle = roof; ctx.fill();
    ctx.strokeStyle = '#b3774b42'; ctx.lineWidth = 2; ctx.stroke();
    // Stalactites.
    for (let i = 0; i < Math.ceil(W / 105) + 2; i++) {
      const x = ((i * 137 - distance * .31) % (W + 130) + W + 130) % (W + 130) - 60;
      const y = upperEdge + Math.sin(x * .012 + distance * .003) * 7;
      const len = 17 + Math.abs(Math.sin(i * 42.2)) * H * .075;
      ctx.beginPath(); ctx.moveTo(x - 15, y - 4); ctx.lineTo(x + 2, y + len); ctx.lineTo(x + 14, y - 2);
      ctx.fillStyle = i % 3 === 0 ? '#241b17' : '#171412'; ctx.fill();
      ctx.strokeStyle = '#95664635'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 1, y + len - 2); ctx.lineTo(x + 4, y + len - 8); ctx.strokeStyle = '#d6a46144'; ctx.stroke();
    }
    // Lower ledge and its broken teeth.
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W, lowerEdge);
    for (let x = W; x >= 0; x -= 25) ctx.lineTo(x, lowerEdge + Math.sin(x * .011 - distance * .002) * 6 + Math.sin(x * .026) * 3);
    ctx.closePath(); const floorGrad = ctx.createLinearGradient(0, H * .68, 0, H); floorGrad.addColorStop(0, '#291c17'); floorGrad.addColorStop(1, '#080808');
    ctx.fillStyle = floorGrad; ctx.fill(); ctx.strokeStyle = '#a56e4540'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < Math.ceil(W / 130) + 1; i++) {
      const x = ((i * 163 + distance * .22) % (W + 160) + W + 160) % (W + 160) - 80;
      const y = lowerEdge + Math.sin(x * .011 - distance * .002) * 6;
      const len = 17 + Math.abs(Math.sin(i * 27.1)) * H * .065;
      ctx.beginPath(); ctx.moveTo(x - 17, y + 3); ctx.lineTo(x + 1, y - len); ctx.lineTo(x + 15, y + 1);
      ctx.fillStyle = '#191513'; ctx.fill(); ctx.strokeStyle = '#a46d4738'; ctx.lineWidth = 1; ctx.stroke();
    }
    // Fine drifting ash and distant glints.
    for (let i = 0; i < 38; i++) {
      const x = ((i * 197 + time * (8 + i % 5) * (i % 2 ? 1 : -1)) % (W + 10) + W + 10) % (W + 10);
      const y = ((i * 113 + time * (9 + i % 7)) % (H + 10) + H + 10) % (H + 10);
      const a = .12 + .2 * (.5 + .5 * Math.sin(time * 2 + i));
      ctx.fillStyle = `rgba(225,166,103,${a})`; ctx.beginPath(); ctx.arc(x, y, i % 8 === 0 ? 1.7 : .8, 0, Math.PI * 2); ctx.fill();
    }
    // A distant warm lantern gives the eye a destination.
    const lx = W * .83, ly = H * .47;
    const lantern = ctx.createRadialGradient(lx, ly, 1, lx, ly, H * .18);
    lantern.addColorStop(0, '#d9854732'); lantern.addColorStop(1, '#d9854700'); ctx.fillStyle = lantern; ctx.fillRect(lx - H * .18, ly - H * .18, H * .36, H * .36);
  }

  function drawObstacle(o) {
    const x = o.x, w = o.width;
    const rock = (top, bottom, isTop) => {
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, '#100e0d'); grad.addColorStop(.18, '#382a23'); grad.addColorStop(.47, '#241b17'); grad.addColorStop(.8, '#140f0d'); grad.addColorStop(1, '#090909');
      ctx.beginPath();
      if (isTop) {
        ctx.moveTo(x - 3, 0); ctx.lineTo(x + w + 4, 0); ctx.lineTo(x + w, bottom - 22);
        ctx.lineTo(x + w * .78, bottom - 9); ctx.lineTo(x + w * .57, bottom - 19); ctx.lineTo(x + w * .36, bottom - 3); ctx.lineTo(x + w * .18, bottom - 14); ctx.lineTo(x, bottom);
      } else {
        ctx.moveTo(x, top); ctx.lineTo(x + w * .2, top + 13); ctx.lineTo(x + w * .41, top + 2); ctx.lineTo(x + w * .62, top + 17); ctx.lineTo(x + w * .81, top + 7); ctx.lineTo(x + w, top + 23); ctx.lineTo(x + w + 4, H); ctx.lineTo(x - 3, H);
      }
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = 'rgba(181,127,81,.32)'; ctx.lineWidth = 1.4; ctx.stroke();
      // Cracked mineral seams catch just a trace of light.
      ctx.beginPath();
      if (isTop) { ctx.moveTo(x + w * .28, Math.max(10, bottom * .33)); ctx.lineTo(x + w * .46, bottom * .41); ctx.lineTo(x + w * .39, bottom * .55); }
      else { ctx.moveTo(x + w * .67, top + (H - top) * .2); ctx.lineTo(x + w * .51, top + (H - top) * .29); ctx.lineTo(x + w * .58, top + (H - top) * .37); }
      ctx.strokeStyle = '#c3936338'; ctx.lineWidth = 1; ctx.stroke();
      const edgeY = isTop ? bottom - 9 : top + 8;
      ctx.beginPath(); ctx.moveTo(x - 2, edgeY); ctx.lineTo(x + w * .3, edgeY + (isTop ? -4 : 4)); ctx.lineTo(x + w * .65, edgeY + (isTop ? 2 : -2)); ctx.lineTo(x + w + 3, edgeY);
      ctx.strokeStyle = '#d19a5a55'; ctx.lineWidth = 2; ctx.stroke();
    };
    rock(0, o.gapTop, true); rock(o.gapBottom, H, false);
  }

  function drawPlayer() {
    const p = player; if (!p) return;
    if (p.invuln > 0 && Math.floor(time * 15) % 2 === 0) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 53); glow.addColorStop(0, '#e5a86233'); glow.addColorStop(1, '#e5a86200');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 53, 0, Math.PI * 2); ctx.fill();
    // Cape and pinions.
    ctx.fillStyle = '#54372b'; ctx.beginPath(); ctx.moveTo(-12, 3); ctx.quadraticCurveTo(-31, -8 + p.flap * 13, -38, -1); ctx.quadraticCurveTo(-25, 12, -13, 9); ctx.fill();
    ctx.strokeStyle = '#b58152'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 3); ctx.quadraticCurveTo(-29, -1 + p.flap * 13, -35, 0); ctx.stroke();
    // Little soot-dark body.
    ctx.fillStyle = '#25201c'; ctx.beginPath(); ctx.ellipse(-1, 4, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9b7955'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#c7a576'; ctx.beginPath(); ctx.arc(5, -2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#74604a'; ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(3, -15); ctx.lineTo(13, -9); ctx.lineTo(14, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e0bd7e'; ctx.lineWidth = 1.1; ctx.stroke();
    // Face slit.
    ctx.fillStyle = '#e8ab57'; ctx.shadowColor = '#f2a74e'; ctx.shadowBlur = 7; ctx.fillRect(7, -4, 6, 2); ctx.shadowBlur = 0;
    // Wing motion.
    const wing = p.flap > .4 ? -1 : .65;
    ctx.fillStyle = '#c5a77d'; ctx.beginPath(); ctx.moveTo(-2, -3); ctx.quadraticCurveTo(-16, -18 * wing, -25, -13 * wing); ctx.quadraticCurveTo(-19, -4, -5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e4c38e'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  function drawBoss() {
    if (!boss) return;
    const s = clamp(Math.min(W, H) / 490, .72, 1.18), x = boss.x, y = boss.y;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const pulse = .5 + .5 * Math.sin(time * 4.2);
    const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 130);
    aura.addColorStop(0, boss.data.color + '45'); aura.addColorStop(1, boss.data.color + '00');
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.fill();
    const dark = boss.flash > 0 ? '#f5d9a8' : '#171310';
    const rim = boss.data.color;
    // Ragged wing / cloak, beating slowly in the cavern air.
    const wingLift = Math.sin(time * 2.4 + boss.phase) * 13;
    ctx.fillStyle = '#100e0d'; ctx.strokeStyle = rim + 'aa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-25, 4); ctx.quadraticCurveTo(-52, -44 + wingLift, -111, -63 + wingLift);
    ctx.lineTo(-80, -37 + wingLift); ctx.lineTo(-129, -31 + wingLift); ctx.lineTo(-91, -13);
    ctx.lineTo(-122, 8); ctx.lineTo(-76, 11); ctx.lineTo(-95, 44 - wingLift * .3);
    ctx.lineTo(-43, 26); ctx.lineTo(-21, 33); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-31, -2); ctx.lineTo(-88, -45 + wingLift); ctx.moveTo(-35, 7); ctx.lineTo(-100, 5); ctx.moveTo(-32, 13); ctx.lineTo(-73, 33);
    ctx.strokeStyle = '#a9855e66'; ctx.lineWidth = 1; ctx.stroke();
    // Mantle and torso.
    ctx.fillStyle = dark; ctx.strokeStyle = '#79563b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-42, -19); ctx.quadraticCurveTo(-13, -38, 17, -18); ctx.lineTo(30, 20); ctx.lineTo(3, 43); ctx.lineTo(-36, 27); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#453126'; ctx.beginPath(); ctx.moveTo(-30, -15); ctx.lineTo(4, -23); ctx.lineTo(18, 14); ctx.lineTo(-12, 31); ctx.lineTo(-36, 14); ctx.closePath(); ctx.fill();
    // Shoulder plates / ancient armor.
    ctx.fillStyle = '#29201a'; ctx.strokeStyle = rim + 'b0'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-36, -19); ctx.lineTo(-55, -29); ctx.lineTo(-69, -11); ctx.lineTo(-48, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -23); ctx.lineTo(26, -30); ctx.lineTo(39, -10); ctx.lineTo(18, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Ribbed breastplate with a pulsing core.
    ctx.strokeStyle = '#a9865d'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-24, -4 + i * 8); ctx.quadraticCurveTo(-2, 1 + i * 8, 11, -3 + i * 8); ctx.stroke(); }
    ctx.fillStyle = rim; ctx.shadowColor = rim; ctx.shadowBlur = 12 + pulse * 8; ctx.beginPath(); ctx.arc(-3, 2, 5 + pulse, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    // Armored skull and long, broken crown horns.
    ctx.fillStyle = dark; ctx.strokeStyle = '#b2936d'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(-20, -23); ctx.lineTo(-42, -32); ctx.lineTo(-55, -25); ctx.lineTo(-39, -15); ctx.lineTo(-25, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d4c09a'; ctx.beginPath(); ctx.moveTo(-37, -28); ctx.lineTo(-48, -49); ctx.lineTo(-31, -37); ctx.lineTo(-22, -52); ctx.lineTo(-22, -30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e6d1a5'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#ffce79'; ctx.shadowColor = '#ff9d4d'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(-44, -25, 4, 2, -.15, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    // Tattered trailing strips.
    for (let i = 0; i < 4; i++) {
      const yy = 20 + i * 8;
      ctx.beginPath(); ctx.moveTo(-31 + i * 8, yy); ctx.quadraticCurveTo(-58 + Math.sin(time * 2 + i) * 8, yy + 13, -73 + i * 8, yy + 28 + Math.sin(time * 2 + i) * 8);
      ctx.strokeStyle = i % 2 ? '#6d4938' : rim + '88'; ctx.lineWidth = 4; ctx.stroke();
    }
    // Ancient sigils around the creature.
    ctx.save(); ctx.rotate(time * .16);
    ctx.setLineDash([3, 8]); ctx.strokeStyle = rim + '55'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-4, 0, 80 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.restore(); ctx.setLineDash([]);
    ctx.restore();
  }

  function drawEffects() {
    for (const b of bolts) {
      ctx.save(); ctx.shadowColor = '#f2b95f'; ctx.shadowBlur = 15;
      const g = ctx.createLinearGradient(b.x - 24, b.y, b.x + 5, b.y); g.addColorStop(0, '#d67d3980'); g.addColorStop(1, '#fff0bd');
      ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x - 22, b.y); ctx.lineTo(b.x + 4, b.y); ctx.stroke();
      ctx.fillStyle = '#fff1c5'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .65, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (const b of enemyBolts) {
      ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 18;
      const grad = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 2.7); grad.addColorStop(0, '#ffe4a0'); grad.addColorStop(.28, b.color); grad.addColorStop(1, b.color + '00');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawBackground();
    for (const o of obstacles) drawObstacle(o);
    drawBoss(); drawEffects(); drawPlayer();
    if (hitFlash > 0) { ctx.fillStyle = `rgba(180,45,32,${hitFlash * .2})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(.035, (now - last) / 1000 || 0); last = now;
    update(dt); render(); requestAnimationFrame(frame);
  }
  reset();
  ui.touch.hidden = !window.matchMedia('(pointer: coarse)').matches;
  ui.sound.classList.add('muted');
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
