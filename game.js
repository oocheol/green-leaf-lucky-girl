const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const luckyStatusEl = document.querySelector("#luckyStatus");
const startOverlay = document.querySelector("#startOverlay");
const startButton = document.querySelector("#startButton");
const controlButtons = [...document.querySelectorAll("[data-dir]")];

const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 1400;
const PLAYER_BASE_RADIUS = 34;
const LEAF_RADIUS = 23;
const CLOVER_CHANCE = 0.2;
const LUCKY_DURATION = 7000;
const GROUND_Y = WORLD_HEIGHT - 120;
const WIND_DURATION = 5200;

let dpr = 1;
let scale = 1;
let lastTime = 0;
let running = false;
let score = 0;
let best = Number(localStorage.getItem("leafLuckyBest") || 0);
let luckyUntil = 0;
let floatTime = 0;
let spawnTimer = 0;
let windUntil = 0;
let nextWindAt = 0;
let windPower = 0;
let confetti = [];
let leaves = [];
let keyState = new Set();
let pointerTarget = null;

const player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  vx: 0,
  vy: 0,
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
  luckyUntil = 0;
  spawnTimer = 0;
  windUntil = 0;
  nextWindAt = performance.now() + 6000 + Math.random() * 6500;
  windPower = 0;
  confetti = [];
  leaves = [];
  player.x = WORLD_WIDTH / 2;
  player.y = GROUND_Y;
  player.vx = 0;
  player.vy = 0;
  for (let i = 0; i < 4; i += 1) spawnLeaf(-Math.random() * WORLD_HEIGHT * 0.55);
  updateHud(performance.now());
}

function spawnLeaf(y = -60) {
  const isClover = Math.random() < CLOVER_CHANCE;
  const fallSpeed = 175 + Math.random() * 95 + Math.min(110, score * 1.4);
  leaves.push({
    x: 70 + Math.random() * (WORLD_WIDTH - 140),
    y,
    r: isClover ? 28 : LEAF_RADIUS,
    clover: isClover,
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
  if (lucky) {
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

function update(dt, now) {
  floatTime += dt;
  const input = { x: 0, y: 0 };

  if (keyState.has("ArrowLeft") || keyState.has("KeyA") || keyState.has("left")) input.x -= 1;
  if (keyState.has("ArrowRight") || keyState.has("KeyD") || keyState.has("right")) input.x += 1;

  if (pointerTarget) {
    const dx = pointerTarget.x - player.x;
    if (Math.abs(dx) > 10) {
      input.x += Math.sign(dx);
    }
  }

  if (now >= nextWindAt) startWind(now);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnLeaf();
    const pace = Math.max(0.42, 1.06 - score * 0.006);
    spawnTimer = pace + Math.random() * 0.3;
  }

  const speed = isLucky(now) ? 610 : 440;
  player.vx += (clamp(input.x, -1, 1) * speed - player.vx) * Math.min(1, dt * 11);
  player.vy += (GROUND_Y - player.y) * Math.min(1, dt * 12);
  player.x = clamp(player.x + player.vx * dt, 48, WORLD_WIDTH - 48);
  player.y = GROUND_Y;
  if (Math.abs(player.vx) > 10) player.face = Math.sign(player.vx);

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
      score += leaf.clover ? 7 : 1;
      if (leaf.clover) luckyUntil = now + LUCKY_DURATION;
      burst(leaf.x, leaf.y, leaf.clover ? "#f6cf4f" : "#49bd72");
      return false;
    }
    return leaf.y < WORLD_HEIGHT + 90;
  });

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
  if (leaf.clover) {
    drawClover(0, 0, leaf.r);
  } else {
    drawLeaf(0, 0, leaf.r, "#35ad61", "#247e49");
  }
  ctx.restore();
}

function drawPlayer(now) {
  const lucky = isLucky(now);
  const s = getPlayerScale(now);
  const bounce = Math.sin(floatTime * 9) * (Math.abs(player.vx) + Math.abs(player.vy) > 20 ? 3 : 1);

  ctx.save();
  ctx.translate(player.x, player.y + bounce);
  ctx.scale(s * player.face, s);

  ctx.fillStyle = lucky ? "rgba(246, 207, 79, 0.34)" : "rgba(49, 151, 84, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 34, 52, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5ecb7b";
  roundedRect(-28, -22, 56, 62, 22);
  ctx.fill();
  ctx.fillStyle = "#fbe0be";
  ctx.beginPath();
  ctx.arc(0, -40, 28, 0, Math.PI * 2);
  ctx.fill();

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

  ctx.fillStyle = "#2e9e58";
  ctx.beginPath();
  ctx.ellipse(-16, -66, 17, 24, -0.5, 0, Math.PI * 2);
  ctx.ellipse(14, -66, 17, 24, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f7440";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.quadraticCurveTo(7, -83, 24, -92);
  ctx.stroke();

  drawBasket(0, -82);

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

function drawBasket(x, y) {
  ctx.save();
  ctx.translate(x, y);
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
window.addEventListener("keydown", (event) => keyState.add(event.code));
window.addEventListener("keyup", (event) => keyState.delete(event.code));

canvas.addEventListener("pointerdown", (event) => {
  pointerTarget = worldFromEvent(event);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (event.buttons) pointerTarget = worldFromEvent(event);
});
canvas.addEventListener("pointerup", () => {
  pointerTarget = null;
});
canvas.addEventListener("pointercancel", () => {
  pointerTarget = null;
});

controlButtons.forEach((button) => {
  const dir = button.dataset.dir;
  const press = (event) => {
    event.preventDefault();
    keyState.add(dir);
    button.classList.add("pressed");
  };
  const release = (event) => {
    event.preventDefault();
    keyState.delete(dir);
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

resize();
for (let i = 0; i < 9; i += 1) spawnLeaf();
requestAnimationFrame((now) => {
  lastTime = now;
  requestAnimationFrame(loop);
});
