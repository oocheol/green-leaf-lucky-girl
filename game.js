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

let dpr = 1;
let scale = 1;
let lastTime = 0;
let running = false;
let score = 0;
let best = Number(localStorage.getItem("leafLuckyBest") || 0);
let luckyUntil = 0;
let floatTime = 0;
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
  confetti = [];
  leaves = [];
  player.x = WORLD_WIDTH / 2;
  player.y = WORLD_HEIGHT / 2;
  player.vx = 0;
  player.vy = 0;
  for (let i = 0; i < 9; i += 1) spawnLeaf();
  updateHud(performance.now());
}

function spawnLeaf() {
  const isClover = Math.random() < CLOVER_CHANCE;
  leaves.push({
    x: 70 + Math.random() * (WORLD_WIDTH - 140),
    y: 135 + Math.random() * (WORLD_HEIGHT - 230),
    r: isClover ? 28 : LEAF_RADIUS,
    clover: isClover,
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
  luckyStatusEl.textContent = lucky ? `럭키걸 ${Math.ceil((luckyUntil - now) / 1000)}초` : "평범한 잎 사냥꾼";
}

function update(dt, now) {
  floatTime += dt;
  const input = { x: 0, y: 0 };

  if (keyState.has("ArrowLeft") || keyState.has("KeyA") || keyState.has("left")) input.x -= 1;
  if (keyState.has("ArrowRight") || keyState.has("KeyD") || keyState.has("right")) input.x += 1;
  if (keyState.has("ArrowUp") || keyState.has("KeyW") || keyState.has("up")) input.y -= 1;
  if (keyState.has("ArrowDown") || keyState.has("KeyS") || keyState.has("down")) input.y += 1;

  if (pointerTarget) {
    const dx = pointerTarget.x - player.x;
    const dy = pointerTarget.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 12) {
      input.x += dx / dist;
      input.y += dy / dist;
    }
  }

  const len = Math.hypot(input.x, input.y) || 1;
  const speed = isLucky(now) ? 405 : 285;
  player.vx += ((input.x / len) * speed - player.vx) * Math.min(1, dt * 9);
  player.vy += ((input.y / len) * speed - player.vy) * Math.min(1, dt * 9);
  player.x = clamp(player.x + player.vx * dt, 48, WORLD_WIDTH - 48);
  player.y = clamp(player.y + player.vy * dt, 118, WORLD_HEIGHT - 58);
  if (Math.abs(player.vx) > 10) player.face = Math.sign(player.vx);

  const playerRadius = isLucky(now) ? 68 : PLAYER_BASE_RADIUS;
  leaves = leaves.filter((leaf) => {
    leaf.spin += dt * (leaf.clover ? 2.1 : 1.2);
    const dist = Math.hypot(player.x - leaf.x, player.y - leaf.y);
    if (dist < playerRadius + leaf.r * 0.8) {
      score += leaf.clover ? 7 : 1;
      if (leaf.clover) luckyUntil = now + LUCKY_DURATION;
      burst(leaf.x, leaf.y, leaf.clover ? "#f6cf4f" : "#49bd72");
      spawnLeaf();
      return false;
    }
    return true;
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
  grd.addColorStop(0, "#c9f5cb");
  grd.addColorStop(0.58, "#9fe1ad");
  grd.addColorStop(1, "#f4d47a");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.globalAlpha = 0.4;
  for (let y = 150; y < WORLD_HEIGHT; y += 140) {
    for (let x = 30; x < WORLD_WIDTH; x += 110) {
      drawTinyLeaf(x + Math.sin(y) * 14, y, 0.8, "#69bd78");
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  roundedRect(28, 96, WORLD_WIDTH - 56, WORLD_HEIGHT - 128, 38);
  ctx.fill();
}

function drawCollectible(leaf) {
  ctx.save();
  ctx.translate(leaf.x, leaf.y + Math.sin(floatTime * 4 + leaf.bob) * 7);
  ctx.rotate(Math.sin(leaf.spin) * 0.18);
  if (leaf.clover) {
    drawClover(0, 0, leaf.r);
  } else {
    drawLeaf(0, 0, leaf.r, "#35ad61", "#247e49");
  }
  ctx.restore();
}

function drawPlayer(now) {
  const lucky = isLucky(now);
  const s = lucky ? 1.85 : 1;
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
