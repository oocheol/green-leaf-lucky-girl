const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const luckyStatusEl = document.querySelector("#luckyStatus");
const startOverlay = document.querySelector("#startOverlay");
const startButton = document.querySelector("#startButton");

const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 1400;
const PLAYER_BASE_RADIUS = 34;
const LEAF_RADIUS = 23;
const CLOVER_CHANCE = 0.2;
const TOMATO_CHANCE = 0.1;
const LUCKY_DURATION = 7000;
const GROUND_Y = WORLD_HEIGHT - 120;
const WIND_DURATION = 5200;
const SPEED_MULTIPLIER = 1.2;
const GRAVITY = 1850;
const JUMP_VELOCITY = -760;
const MAX_JUMPS = 2;
const TRIPLE_JUMP_SCORE = 33;
const FLY_SCORE = 333;
const FORTUNE_SCORE = 777;
const TOMATO_DANCE_DURATION = 4600;
const GREEN_DANCE_DURATION = 5200;
const FORTUNE_RAIN_DURATION = 7200;

let dpr = 1;
let scale = 1;
let lastTime = 0;
let running = false;
let score = 0;
let greenLeafCount = 0;
let nextGreenDanceAt = 100;
let best = Number(localStorage.getItem("leafLuckyBest") || 0);
let luckyUntil = 0;
let floatTime = 0;
let spawnTimer = 0;
let windUntil = 0;
let nextWindAt = 0;
let windPower = 0;
let tomatoDanceUntil = 0;
let greenDanceUntil = 0;
let fortuneRainUntil = 0;
let flyAnnounced = false;
let fortuneAnnounced = false;
let confetti = [];
let leaves = [];
let keyState = new Set();
let pointerTarget = null;
let pointerStart = null;
let pointerMoved = false;

const player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  vx: 0,
  vy: 0,
  grounded: true,
  jumpCount: 0,
  face: 1,
};

bestEl.textContent = best;

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  scale = Math.min(canvas.width / WORLD_WIDTH, canvas.height / WORLD_HEIGHT);
}

function worldFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * dpr - (canvas.width - WORLD_WIDTH * scale) / 2) / scale,
    y: ((event.clientY - rect.top) * dpr - (canvas.height - WORLD_HEIGHT * scale) / 2) / scale,
  };
}

function resetGame() {
  running = true;
  score = 0;
  greenLeafCount = 0;
  nextGreenDanceAt = 100;
  luckyUntil = 0;
  spawnTimer = 0;
  windUntil = 0;
  nextWindAt = performance.now() + 6000 + Math.random() * 6500;
  windPower = 0;
  tomatoDanceUntil = 0;
  greenDanceUntil = 0;
  fortuneRainUntil = 0;
  flyAnnounced = false;
  fortuneAnnounced = false;
  confetti = [];
  leaves = [];
  player.x = WORLD_WIDTH / 2;
  player.y = GROUND_Y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  player.jumpCount = 0;
  for (let i = 0; i < 4; i += 1) spawnLeaf(-Math.random() * WORLD_HEIGHT * 0.55);
  updateHud(performance.now());
}

function spawnLeaf(y = -60) {
  const roll = Math.random();
  const type = roll < TOMATO_CHANCE ? "tomato" : roll < TOMATO_CHANCE + CLOVER_CHANCE ? "clover" : "leaf";
  const fallSpeed = (175 + Math.random() * 95 + Math.min(110, score * 1.4)) * SPEED_MULTIPLIER;
  leaves.push({
    x: 70 + Math.random() * (WORLD_WIDTH - 140),
    y,
    r: type === "tomato" ? 31 : type === "clover" ? 28 : LEAF_RADIUS,
    type,
    clover: type === "clover",
    tomato: type === "tomato",
    fallSpeed,
    drift: -34 + Math.random() * 68,
    sway: 36 + Math.random() * 44,
    spin: Math.random() * Math.PI * 2,
    bob: Math.random() * Math.PI * 2,
  });
}

function burst(x, y, color) {
  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 190;
    confetti.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.55,
      color,
      size: 5 + Math.random() * 6,
    });
  }
}

function isLucky(now) {
  return now < luckyUntil;
}

function updateHud(now) {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  const lucky = isLucky(now);
  luckyStatusEl.classList.toggle("lucky", lucky);
  luckyStatusEl.classList.toggle("windy", isWindy(now));
  if (isFortuneRaining(now)) {
    luckyStatusEl.textContent = "행운 뿌리기";
  } else if (isTomatoDancing(now)) {
    luckyStatusEl.textContent = "토마토 댄스";
  } else if (isGreenDancing(now)) {
    luckyStatusEl.textContent = "초록짱짱 댄스";
  } else if (canFly()) {
    luckyStatusEl.textContent = "자유 비행";
  } else if (canTripleJump()) {
    luckyStatusEl.textContent = "3단 점프";
  } else if (lucky) {
    luckyStatusEl.textContent = `럭키걸 ${Math.ceil((luckyUntil - now) / 1000)}초`;
  } else if (isWindy(now)) {
    luckyStatusEl.textContent = "강풍 조심";
  } else {
    luckyStatusEl.textContent = "받을 준비";
  }
}

function isWindy(now) {
  return now < windUntil;
}

function startWind(now) {
  windUntil = now + WIND_DURATION;
  windPower = (Math.random() < 0.5 ? -1 : 1) * (185 + Math.random() * 115);
  nextWindAt = now + WIND_DURATION + 7500 + Math.random() * 9000;
  burst(WORLD_WIDTH / 2, 170, "#d8fbff");
}

function canFly() {
  return score >= FLY_SCORE;
}

function canTripleJump() {
  return score >= TRIPLE_JUMP_SCORE;
}

function getMaxJumps() {
  return canTripleJump() ? 3 : MAX_JUMPS;
}

function isFortuneRaining(now) {
  return now < fortuneRainUntil;
}

function isTomatoDancing(now) {
  return now < tomatoDanceUntil;
}

function isGreenDancing(now) {
  return now < greenDanceUntil;
}

function isDanceTime(now) {
  return isTomatoDancing(now) || isGreenDancing(now);
}

function update(dt, now) {
  floatTime += dt;
  if (isDanceTime(now)) {
    player.vx *= 0.84;
    player.vy = 0;
    if (!canFly()) {
      player.y = GROUND_Y;
      player.grounded = true;
      player.jumpCount = 0;
    }
    confetti.forEach((piece) => {
      piece.life -= dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.vy += 130 * dt;
    });
    confetti = confetti.filter((piece) => piece.life > 0);
    if (isTomatoDancing(now)) spawnDanceSparkles(dt, now);
    if (isGreenDancing(now)) spawnGreenDanceSparkles(dt, now);
    updateHud(now);
    return;
  }

  const input = { x: 0, y: 0 };

  if (keyState.has("ArrowLeft") || keyState.has("KeyA") || keyState.has("left")) input.x -= 1;
  if (keyState.has("ArrowRight") || keyState.has("KeyD") || keyState.has("right")) input.x += 1;
  if (keyState.has("ArrowUp") || keyState.has("KeyW") || keyState.has("up")) input.y -= 1;
  if (keyState.has("ArrowDown") || keyState.has("KeyS") || keyState.has("down")) input.y += 1;

  if (pointerTarget) {
    const dx = pointerTarget.x - player.x;
    const dy = pointerTarget.y - player.y;
    if (canFly()) {
      const dist = Math.hypot(dx, dy);
      if (dist > 12) {
        input.x += dx / dist;
        input.y += dy / dist;
      }
    } else if (Math.abs(dx) > 10) {
      input.x += Math.sign(dx);
    }
  }

  if (now >= nextWindAt) startWind(now);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnLeaf();
    const pace = Math.max(0.42, 1.06 - score * 0.006);
    spawnTimer = (pace + Math.random() * 0.3) / SPEED_MULTIPLIER;
  }

  const speed = (canFly() ? 520 : isLucky(now) ? 610 : 440) * SPEED_MULTIPLIER;
  const inputLength = Math.hypot(input.x, input.y) || 1;
  player.vx += (clamp(input.x / inputLength, -1, 1) * speed - player.vx) * Math.min(1, dt * 11);
  if (canFly()) {
    player.vy += (clamp(input.y / inputLength, -1, 1) * speed - player.vy) * Math.min(1, dt * 11);
  } else {
    player.vy += GRAVITY * dt;
  }
  player.x = clamp(player.x + player.vx * dt, 48, WORLD_WIDTH - 48);
  player.y += player.vy * dt;
  if (canFly()) {
    player.y = clamp(player.y, 190, GROUND_Y);
    player.grounded = false;
    player.jumpCount = 0;
  } else if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.grounded = true;
    player.jumpCount = 0;
  } else {
    player.grounded = false;
  }
  if (Math.abs(player.vx) > 10) player.face = Math.sign(player.vx);

  let danceStartedThisFrame = false;
  const playerRadius = isLucky(now) ? 68 : PLAYER_BASE_RADIUS;
  leaves = leaves.filter((leaf) => {
    leaf.spin += dt * (leaf.clover ? 4.6 : 3.2);
    const windPush = isWindy(now) ? windPower + Math.sin(floatTime * 12 + leaf.bob) * 165 : 0;
    leaf.x += (leaf.drift + windPush + Math.sin(floatTime * 3.4 + leaf.bob) * leaf.sway) * dt;
    leaf.y += leaf.fallSpeed * dt;
    if (leaf.x < 38 || leaf.x > WORLD_WIDTH - 38) {
      leaf.x = clamp(leaf.x, 38, WORLD_WIDTH - 38);
      leaf.drift *= -0.78;
    }

    const catchY = getBasketCatchY(now);
    const catchWidth = isLucky(now) ? 178 : 98;
    const catchHeight = isLucky(now) ? 70 : 42;
    const caught = Math.abs(player.x - leaf.x) < catchWidth && Math.abs(catchY - leaf.y) < catchHeight;
    if (caught) {
      if (leaf.tomato) {
        score += 5;
        tomatoDanceUntil = now + TOMATO_DANCE_DURATION;
        danceStartedThisFrame = true;
      } else {
        score += leaf.clover ? 7 : 1;
        if (!leaf.clover) {
          greenLeafCount += 1;
          if (greenLeafCount >= nextGreenDanceAt) {
            greenDanceUntil = now + GREEN_DANCE_DURATION;
            nextGreenDanceAt += 100;
            danceStartedThisFrame = true;
          }
        }
      }
      if (leaf.clover) luckyUntil = now + LUCKY_DURATION;
      burst(leaf.x, leaf.y, leaf.tomato ? "#ff7662" : leaf.clover ? "#f6cf4f" : "#49bd72");
      return false;
    }
    return leaf.y < WORLD_HEIGHT + 90;
  });
  if (danceStartedThisFrame) leaves = [];

  if (!flyAnnounced && score >= FLY_SCORE) {
    flyAnnounced = true;
    burst(player.x, player.y - 120, "#bde9ff");
  }
  if (!fortuneAnnounced && score >= FORTUNE_SCORE) {
    fortuneAnnounced = true;
    fortuneRainUntil = now + FORTUNE_RAIN_DURATION;
    burst(player.x, player.y - 160, "#f7d75b");
  }

  if (score > best) {
    best = score;
    localStorage.setItem("leafLuckyBest", String(best));
  }

  confetti.forEach((piece) => {
    piece.life -= dt;
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.vy += 220 * dt;
  });
  confetti = confetti.filter((piece) => piece.life > 0);
  if (isFortuneRaining(now)) spawnFortuneSparkles(dt, now);

  updateHud(now);
}

function draw(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - WORLD_WIDTH * scale) / 2, (canvas.height - WORLD_HEIGHT * scale) / 2);

  drawMeadow();
  leaves.forEach(drawCollectible);
  confetti.forEach(drawConfetti);
  drawPlayer(now);
  if (isTomatoDancing(now)) drawTomatoDance(now);
  if (isGreenDancing(now)) drawGreenDance(now);
}

function drawMeadow() {
  const grd = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  grd.addColorStop(0, "#bfeeff");
  grd.addColorStop(0.36, "#d8f8cc");
  grd.addColorStop(0.72, "#9fe1ad");
  grd.addColorStop(1, "#f4d47a");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  for (let i = 0; i < 7; i += 1) {
    const x = ((i * 170 + floatTime * 18) % (WORLD_WIDTH + 220)) - 110;
    drawCloud(x, 120 + (i % 3) * 74, 0.74 + (i % 2) * 0.22);
  }

  ctx.globalAlpha = 0.4;
  for (let y = 270; y < WORLD_HEIGHT; y += 140) {
    for (let x = 30; x < WORLD_WIDTH; x += 110) {
      drawTinyLeaf(x + Math.sin(y) * 14, y, 0.8, "#69bd78");
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  roundedRect(28, 96, WORLD_WIDTH - 56, WORLD_HEIGHT - 128, 38);
  ctx.fill();

  ctx.fillStyle = "rgba(64, 151, 84, 0.35)";
  ctx.fillRect(28, GROUND_Y + 36, WORLD_WIDTH - 56, 96);

  if (isWindy(performance.now())) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i += 1) {
      const y = 230 + i * 105;
      const offset = ((floatTime * 260 + i * 90) % (WORLD_WIDTH + 240)) - 120;
      ctx.beginPath();
      ctx.moveTo(offset, y);
      ctx.bezierCurveTo(offset + 80, y - 26, offset + 180, y + 26, offset + 270, y - 10);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCollectible(leaf) {
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.rotate(leaf.spin + Math.sin(floatTime * 8 + leaf.bob) * (isWindy(performance.now()) ? 0.45 : 0.16));
  if (leaf.tomato) {
    drawTomato(0, 0, leaf.r, floatTime + leaf.bob);
  } else if (leaf.clover) {
    drawClover(0, 0, leaf.r);
  } else {
    drawLeaf(0, 0, leaf.r, "#35ad61", "#247e49");
  }
  ctx.restore();
}

function drawPlayer(now) {
  const lucky = isLucky(now);
  const s = getPlayerScale(now);
  const dancing = isDanceTime(now);
  const danceBeat = dancing ? Math.sin(floatTime * 18) : 0;
  const bounce = dancing
    ? Math.abs(Math.sin(floatTime * 16)) * -18
    : Math.sin(floatTime * 9) * (Math.abs(player.vx) + Math.abs(player.vy) > 20 ? 3 : 1);

  ctx.save();
  const drawX = dancing ? WORLD_WIDTH / 2 : player.x;
  const drawY = dancing ? GROUND_Y - 4 : player.y;
  ctx.translate(drawX + danceBeat * 44, drawY + bounce);
  if (dancing) ctx.rotate(Math.sin(floatTime * 14) * 0.22);
  ctx.scale(s * player.face * (dancing ? 1 + Math.abs(danceBeat) * 0.1 : 1), s * (dancing ? 1 - Math.abs(danceBeat) * 0.05 : 1));

  ctx.fillStyle = lucky ? "rgba(246, 207, 79, 0.34)" : "rgba(49, 151, 84, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 34, 52, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7f8ff";
  roundedRect(-28, -22, 56, 62, 22);
  ctx.fill();
  ctx.strokeStyle = "#d8def5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.quadraticCurveTo(0, 12, 20, 0);
  ctx.stroke();

  ctx.fillStyle = "#1e2528";
  ctx.beginPath();
  ctx.ellipse(-27, -40, 15, 39, -0.12, 0, Math.PI * 2);
  ctx.ellipse(27, -40, 15, 39, 0.12, 0, Math.PI * 2);
  ctx.ellipse(0, -53, 33, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fbe0be";
  ctx.beginPath();
  ctx.arc(0, -40, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1e2528";
  ctx.beginPath();
  ctx.ellipse(0, -66, 30, 19, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  for (let i = -18; i <= 18; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, -68);
    ctx.quadraticCurveTo(i + 3, -55, i - 1, -43);
    ctx.strokeStyle = "#101719";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = "#427352";
  ctx.beginPath();
  ctx.arc(-9, -42, 3.8, 0, Math.PI * 2);
  ctx.arc(10, -42, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c76f70";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(1, -34, 9, 0.15, Math.PI - 0.15);
  ctx.stroke();

  ctx.strokeStyle = "#2a2020";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-13, -28);
  ctx.quadraticCurveTo(0, -23, 13, -28);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-7, -23);
  ctx.quadraticCurveTo(0, -18, 7, -23);
  ctx.stroke();

  drawCheekFlower(-20, -36);
  drawBasket(dancing ? Math.sin(floatTime * 22) * 18 : 0, dancing ? -86 + Math.cos(floatTime * 18) * 12 : -82, now);

  if (lucky) {
    ctx.fillStyle = "#f7d75b";
    for (let i = 0; i < 8; i += 1) {
      const a = floatTime * 1.8 + i * Math.PI / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 43, Math.sin(a) * 43 - 26, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function getPlayerScale(now) {
  return isLucky(now) ? 1.85 : 1;
}

function getBasketCatchY(now) {
  return player.y - 82 * getPlayerScale(now);
}

function jump() {
  if (!running || canFly() || player.jumpCount >= getMaxJumps()) return;
  player.vy = JUMP_VELOCITY * (isLucky(performance.now()) ? 1.08 : 1);
  player.grounded = false;
  player.jumpCount += 1;
  burst(player.x, player.y + 28, "#bff7d4");
}

function drawBasket(x, y, now = performance.now()) {
  ctx.save();
  ctx.translate(x, y);
  if (isFortuneRaining(now)) {
    ctx.rotate(floatTime * 8);
    ctx.translate(0, -8 + Math.sin(floatTime * 10) * 4);
  }
  ctx.lineCap = "round";

  ctx.strokeStyle = "#9b6a32";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 4, 40, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  ctx.fillStyle = "#d99b46";
  ctx.strokeStyle = "#83532a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-48, -2);
  ctx.lineTo(48, -2);
  ctx.lineTo(34, 28);
  ctx.quadraticCurveTo(0, 38, -34, 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 3;
  for (let i = -28; i <= 28; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i - 6, 2);
    ctx.lineTo(i + 3, 27);
    ctx.stroke();
  }

  ctx.strokeStyle = "#8f5d2e";
  ctx.lineWidth = 4;
  for (let yLine = 9; yLine <= 23; yLine += 14) {
    ctx.beginPath();
    ctx.moveTo(-40, yLine);
    ctx.quadraticCurveTo(0, yLine + 7, 40, yLine);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCheekFlower(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#f6f0d3";
  ctx.strokeStyle = "#d7c7ef";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i += 1) {
    ctx.save();
    ctx.rotate(i * Math.PI * 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -5, 3.2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#ffe175";
  ctx.beginPath();
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTomato(x, y, r, dance = 0) {
  ctx.save();
  ctx.translate(x, y + Math.sin(dance * 8) * 3);
  ctx.fillStyle = "#f25f4c";
  ctx.strokeStyle = "#361717";
  ctx.lineWidth = Math.max(3, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, 4, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff3c4";
  ctx.beginPath();
  ctx.arc(-r * 0.45, -r * 0.4, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#62bd67";
  for (let i = 0; i < 5; i += 1) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.92, r * 0.2, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#0f0f0f";
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.05, r * 0.14, 0, Math.PI * 2);
  ctx.arc(r * 0.32, -r * 0.05, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f0f0f";
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, r * 0.22);
  ctx.quadraticCurveTo(0, r * 0.42, r * 0.12, r * 0.22);
  ctx.stroke();
  ctx.strokeStyle = "#ffd96a";
  ctx.lineWidth = 4;
  for (let i = 0; i < 2; i += 1) {
    const sx = i === 0 ? -r * 1.2 : r * 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, -r * 0.9);
    ctx.quadraticCurveTo(sx + Math.sin(dance * 10 + i) * 18, -r * 1.35, sx + 8, -r * 1.7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTomatoDance(now) {
  const life = Math.max(0, (tomatoDanceUntil - now) / TOMATO_DANCE_DURATION);
  ctx.save();
  ctx.globalAlpha = Math.min(1, life * 2.2);
  drawPsychedelicLights();

  ctx.fillStyle = "rgba(255, 251, 218, 0.9)";
  roundedRect(62, 106, WORLD_WIDTH - 124, 104, 30);
  ctx.fill();
  ctx.fillStyle = "#b83b2e";
  ctx.font = "900 36px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("토마토 될거야~! 쥬스 될거야~!", WORLD_WIDTH / 2, 158);

  ctx.fillStyle = "rgba(255, 96, 76, 0.16)";
  ctx.beginPath();
  ctx.ellipse(WORLD_WIDTH / 2, GROUND_Y - 54, 330 + Math.sin(floatTime * 12) * 18, 118, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 4; i += 1) {
    const x = WORLD_WIDTH / 2 + (i - 1.5) * 105 + Math.sin(floatTime * 16 + i) * 22;
    const y = 288 + Math.sin(floatTime * 13 + i) * 36;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(floatTime * 18 + i) * 0.55);
    drawTomato(0, 0, 40 + Math.sin(floatTime * 12 + i) * 5, floatTime * 2 + i);
    ctx.restore();
  }

  ctx.save();
  const partnerX = WORLD_WIDTH / 2 + 185 + Math.sin(floatTime * 15) * 78;
  const partnerY = GROUND_Y - 145 + Math.cos(floatTime * 18) * 80;
  ctx.translate(partnerX, partnerY);
  ctx.rotate(Math.sin(floatTime * 20) * 0.5);
  drawTomato(0, 0, 58 + Math.sin(floatTime * 16) * 7, floatTime * 2.3);
  ctx.restore();

  ctx.save();
  const partnerX2 = WORLD_WIDTH / 2 - 205 + Math.cos(floatTime * 17) * 86;
  const partnerY2 = GROUND_Y - 190 + Math.sin(floatTime * 19) * 92;
  ctx.translate(partnerX2, partnerY2);
  ctx.rotate(Math.cos(floatTime * 21) * 0.6);
  drawTomato(0, 0, 48 + Math.cos(floatTime * 15) * 6, floatTime * 2.5);
  ctx.restore();

  ctx.strokeStyle = "#f7c84b";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i += 1) {
    const x = 90 + i * 96;
    const y = 395 + Math.sin(floatTime * 11 + i) * 42;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 20, y - 42, x + 44, y - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 49, y + 4, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGreenDance(now) {
  const life = Math.max(0, (greenDanceUntil - now) / GREEN_DANCE_DURATION);
  ctx.save();
  ctx.globalAlpha = Math.min(1, life * 2.2);
  drawPsychedelicLights();

  ctx.fillStyle = "rgba(226, 255, 214, 0.9)";
  roundedRect(56, 102, WORLD_WIDTH - 112, 116, 30);
  ctx.fill();
  ctx.fillStyle = "#18874d";
  ctx.font = "900 38px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("초록짱짱 럭키걸 🍀", WORLD_WIDTH / 2, 146);
  ctx.font = "900 28px 'Trebuchet MS', sans-serif";
  ctx.fillText("네잎클로버 휘날리기!", WORLD_WIDTH / 2, 184);

  ctx.fillStyle = "rgba(62, 210, 100, 0.16)";
  ctx.beginPath();
  ctx.ellipse(WORLD_WIDTH / 2, GROUND_Y - 62, 350 + Math.sin(floatTime * 14) * 24, 130, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 26; i += 1) {
    const orbit = 110 + (i % 5) * 46;
    const angle = floatTime * (2.4 + (i % 4) * 0.28) + i * 0.7;
    const x = WORLD_WIDTH / 2 + Math.cos(angle) * orbit + Math.sin(floatTime * 8 + i) * 18;
    const y = GROUND_Y - 260 + Math.sin(angle * 1.2) * 190;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.sin(floatTime * 12 + i) * 0.7);
    drawClover(0, 0, 18 + (i % 3) * 4);
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(255, 245, 110, 0.86)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  for (let i = 0; i < 10; i += 1) {
    const x = 55 + i * 88;
    const y = 390 + Math.sin(floatTime * 13 + i) * 64;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 28, y - 92, x + 74, y + 72, x + 112, y - 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPsychedelicLights() {
  ctx.save();
  const colors = [
    "rgba(255, 68, 86, 0.28)",
    "rgba(255, 223, 84, 0.26)",
    "rgba(78, 220, 255, 0.24)",
    "rgba(160, 99, 255, 0.22)",
  ];
  for (let i = 0; i < 8; i += 1) {
    const side = i % 2 === 0 ? -80 : WORLD_WIDTH + 80;
    const targetX = WORLD_WIDTH / 2 + Math.sin(floatTime * 5 + i) * 220;
    const targetY = GROUND_Y - 180 + Math.cos(floatTime * 7 + i) * 190;
    const beam = ctx.createLinearGradient(side, 70 + i * 38, targetX, targetY);
    beam.addColorStop(0, colors[i % colors.length]);
    beam.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(side, 70 + i * 38);
    ctx.lineTo(targetX - 80, targetY + 160);
    ctx.lineTo(targetX + 80, targetY + 160);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = colors[i % colors.length].replace("0.2", "0.55").replace("0.28", "0.55").replace("0.26", "0.55").replace("0.24", "0.55").replace("0.22", "0.55");
    ctx.beginPath();
    ctx.arc(
      ((i * 87 + floatTime * 240) % (WORLD_WIDTH + 140)) - 70,
      250 + Math.sin(floatTime * 9 + i) * 180,
      12 + Math.sin(floatTime * 13 + i) * 5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function spawnGreenDanceSparkles(dt, now) {
  const count = Math.ceil(34 * dt);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 220;
    confetti.push({
      x: WORLD_WIDTH / 2 + Math.cos(angle + floatTime * 4) * radius,
      y: GROUND_Y - 230 + Math.sin(angle + floatTime * 5) * (70 + Math.random() * 160),
      vx: Math.cos(angle) * (120 + Math.random() * 230),
      vy: Math.sin(angle) * (120 + Math.random() * 180) - 150,
      life: 0.65 + Math.random() * 0.8,
      color: Math.random() < 0.55 ? "#42d66f" : "#f7d75b",
      size: 6 + Math.random() * 10,
    });
  }
  if (Math.floor(now / 90) % 2 === 0) {
    confetti.push({
      x: WORLD_WIDTH / 2 + Math.sin(floatTime * 18) * 260,
      y: GROUND_Y - 280 + Math.cos(floatTime * 15) * 150,
      vx: -120 + Math.random() * 240,
      vy: -230 - Math.random() * 120,
      life: 0.72,
      color: "#5ee088",
      size: 14,
    });
  }
}

function spawnDanceSparkles(dt, now) {
  const count = Math.ceil(26 * dt);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    confetti.push({
      x: player.x + Math.cos(angle) * (80 + Math.random() * 150),
      y: player.y - 95 + Math.sin(angle) * (40 + Math.random() * 85),
      vx: Math.cos(angle) * (110 + Math.random() * 230),
      vy: Math.sin(angle) * (110 + Math.random() * 200) - 120,
      life: 0.55 + Math.random() * 0.75,
      color: Math.random() < 0.5 ? "#ff6d5e" : "#ffd95c",
      size: 6 + Math.random() * 8,
    });
  }
  if (Math.floor(now / 120) % 2 === 0) {
    confetti.push({
      x: player.x + Math.sin(floatTime * 20) * 120,
      y: player.y - 160 + Math.cos(floatTime * 18) * 40,
      vx: -80 + Math.random() * 160,
      vy: -180 - Math.random() * 80,
      life: 0.7,
      color: "#ff8a75",
      size: 12,
    });
  }
}

function spawnFortuneSparkles(dt, now) {
  const count = Math.ceil(18 * dt);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 42 + Math.random() * 56;
    confetti.push({
      x: player.x + Math.cos(angle + floatTime * 8) * radius,
      y: getBasketCatchY(now) + Math.sin(angle + floatTime * 8) * radius,
      vx: Math.cos(angle) * (80 + Math.random() * 160),
      vy: -80 - Math.random() * 170,
      life: 0.7 + Math.random() * 0.6,
      color: Math.random() < 0.5 ? "#f7d75b" : "#5ee088",
      size: 5 + Math.random() * 7,
    });
  }
}

function drawCloud(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(0, 10, 30, 0, Math.PI * 2);
  ctx.arc(34, -4, 42, 0, Math.PI * 2);
  ctx.arc(78, 10, 31, 0, Math.PI * 2);
  ctx.arc(38, 22, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLeaf(x, y, r, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2, r * 0.11);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.7, r, -0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.32, y + r * 0.52);
  ctx.quadraticCurveTo(x, y, x + r * 0.32, y - r * 0.52);
  ctx.stroke();
}

function drawTinyLeaf(x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((x + y) % 4);
  drawLeaf(0, 0, 13 * s, color, "rgba(55, 122, 68, 0.5)");
  ctx.restore();
}

function drawClover(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#2bb85e";
  ctx.strokeStyle = "#176d3c";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.rotate(i * Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.42, r * 0.45, r * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = "#176d3c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.18);
  ctx.quadraticCurveTo(r * 0.22, r * 0.58, r * 0.05, r * 0.9);
  ctx.stroke();
  ctx.restore();
}

function drawConfetti(piece) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, piece.life);
  ctx.fillStyle = piece.color;
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.life * 8);
  ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
  ctx.restore();
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (running) update(dt, now);
  draw(now);
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", () => {
  startOverlay.classList.add("hidden");
  resetGame();
});

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keyState.add(event.code);
  if ((event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") && !event.repeat) {
    event.preventDefault();
    jump();
  }
});
window.addEventListener("keyup", (event) => keyState.delete(event.code));

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const point = worldFromEvent(event);
  pointerTarget = point;
  pointerStart = point;
  pointerMoved = false;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  event.preventDefault();
  if (!event.buttons) return;
  const point = worldFromEvent(event);
  if (pointerStart && Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y) > 18) {
    pointerMoved = true;
  }
  pointerTarget = point;
});
canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  if (!pointerMoved) jump();
  pointerTarget = null;
  pointerStart = null;
});
canvas.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  pointerTarget = null;
  pointerStart = null;
});
canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

resize();
for (let i = 0; i < 9; i += 1) spawnLeaf();
requestAnimationFrame((now) => {
  lastTime = now;
  requestAnimationFrame(loop);
});
