// main.js
// 负责：画布初始化、浮世绘背景绘制、主循环、UI 事件与降级交互。

import { WaveField } from "./wave.js";
import { HandTracker } from "./hand.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

const COLORS = {
  skyTop: "#a3c4dc", skyBottom: "#c4d8e6",
  seaDeep: "#1d3b5b", seaMid: "#4a7a9b", seaLight: "#7a9fb8",
  fujiBody: "#f4f1e8", fujiShadow: "#1d3b5b", forest: "#1a1a1a"
};

let W = 0, H = 0, DPR = 1;
const waveField = new WaveField(24);
const pointer = { x: 0, y: 0, visible: false };
let trackerActive = false;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);

// 背景绘制
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.7);
}

function drawFuji() {
  const baseY = H * 0.72, cx = W * 0.68, peakY = H * 0.15, halfW = W * 0.45;
  
  // 山体
  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.bezierCurveTo(cx - halfW * 0.6, baseY - (baseY - peakY) * 0.4, cx - halfW * 0.25, peakY + 20, cx - halfW * 0.1, peakY);
  ctx.lineTo(cx + halfW * 0.08, peakY);
  ctx.bezierCurveTo(cx + halfW * 0.2, peakY + 30, cx + halfW * 0.5, baseY - (baseY - peakY) * 0.2, cx + halfW, baseY + 20);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(cx, peakY, cx, baseY);
  bodyGrad.addColorStop(0, COLORS.fujiBody); bodyGrad.addColorStop(0.7, "#e2e2d8"); bodyGrad.addColorStop(1, "#b0c4d4");
  ctx.fillStyle = bodyGrad; ctx.fill();

  // 右侧阴影
  ctx.beginPath();
  ctx.moveTo(cx + halfW * 0.08, peakY);
  ctx.bezierCurveTo(cx + halfW * 0.2, peakY + 30, cx + halfW * 0.5, baseY - (baseY - peakY) * 0.2, cx + halfW, baseY + 20);
  ctx.lineTo(cx + halfW * 0.6, baseY + 10);
  ctx.bezierCurveTo(cx + halfW * 0.3, baseY - (baseY - peakY) * 0.3, cx + halfW * 0.15, peakY + 40, cx + halfW * 0.08, peakY);
  ctx.closePath(); ctx.fillStyle = COLORS.fujiShadow; ctx.fill();

  // 雪顶
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.3, peakY + (baseY - peakY) * 0.35);
  ctx.lineTo(cx - halfW * 0.1, peakY); ctx.lineTo(cx + halfW * 0.08, peakY);
  ctx.lineTo(cx + halfW * 0.25, peakY + (baseY - peakY) * 0.3);
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    ctx.lineTo(cx + halfW * (0.25 - t * 0.55), peakY + (baseY - peakY) * (0.25 + Math.random() * 0.15));
  }
  ctx.closePath(); ctx.fillStyle = "#ffffff"; ctx.fill();

  // 积雪沟壑
  ctx.strokeStyle = COLORS.fujiShadow; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (let i = 0; i < 15; i++) {
    const startX = cx - halfW * 0.1 + Math.random() * halfW * 0.18;
    const startY = peakY + Math.random() * 20;
    ctx.beginPath(); ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(startX + (Math.random() - 0.5) * 30, startY + (baseY - peakY) * 0.1, startX + (Math.random() - 0.5) * 50, startY + (baseY - peakY) * 0.2, startX + (Math.random() - 0.5) * 60, startY + (baseY - peakY) * 0.3);
    ctx.stroke();
  }

  // 左下角森林
  ctx.fillStyle = COLORS.forest;
  const forestW = halfW * 0.8, forestH = (baseY - peakY) * 0.4, startXForest = cx - halfW;
  for (let i = 0; i < 1200; i++) {
    const rx = Math.random(), ry = Math.random();
    if (ry > rx * 1.2) {
      const px = startXForest + rx * forestW, py = baseY - forestH + ry * forestH;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2, py - 4); ctx.lineTo(px + 4, py); ctx.fill();
    }
  }
}

function drawSeaBase() {
  const topY = H * 0.62;
  const g = ctx.createLinearGradient(0, topY, 0, H);
  g.addColorStop(0, COLORS.seaLight); g.addColorStop(0.4, COLORS.seaMid); g.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = g; ctx.fillRect(0, topY, W, H - topY);
}

function drawSeaLines(time) {
  const topY = H * 0.62, lineCount = 26;
  ctx.lineCap = "round";
  for (let i = 0; i < lineCount; i++) {
    const p = i / (lineCount - 1);
    const baseY = topY + p * (H - topY) + 6;
    const amp = 3 + p * 9, freq = 0.006 + p * 0.004, speed = 0.0006 + p * 0.0004, alpha = 0.18 + p * 0.35;
    ctx.beginPath(); ctx.strokeStyle = `rgba(74,134,184,${alpha})`; ctx.lineWidth = 1.2 + p * 2.2;
    for (let x = -20; x <= W + 20; x += 14) {
      const y = baseY + Math.sin(x * freq + time * speed + i * 0.9) * amp + Math.sin(x * freq * 2.3 + time * speed * 1.7) * amp * 0.35;
      if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function spawnAt(nx, ny) {
  const x = nx * W, y = ny * H;
  const yy = Math.max(H * 0.58, Math.min(H - 20, y));
  waveField.add(x, yy, 0.7 + Math.random() * 0.5);
}

let lastTime = 0;
function loop(now) {
  const dt = Math.min(50, now - lastTime || 16);
  lastTime = now;

  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawFuji();
  drawSeaBase();
  drawSeaLines(now);

  waveField.update(dt);
  waveField.draw(ctx, now);

  if (pointer.visible) {
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244,239,228,0.22)"; ctx.fill();
    ctx.strokeStyle = "rgba(244,239,228,0.75)"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  requestAnimationFrame(loop);
}

// 鼠标交互降级
canvas.addEventListener("pointermove", (e) => {
  if (trackerActive) return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.visible = true;
});
canvas.addEventListener("pointerleave", () => {
  if (trackerActive) return;
  pointer.visible = false;
});
canvas.addEventListener("pointerdown", (e) => spawnAt(e.clientX / W, e.clientY / H));

// 摄像头交互
const tracker = new HandTracker({
  onStatus: (s) => { statusEl.textContent = s; },
  onMove: ({ x, y }) => {
    trackerActive = true; pointer.x = x * W; pointer.y = y * H; pointer.visible = true;
  },
  onOpenPalm: ({ x, y }) => {
    trackerActive = true; spawnAt(x, y);
    pointer.x = x * W; pointer.y = y * H; pointer.visible = true;
    statusEl.textContent = "🌊 浪花生成！";
    clearTimeout(statusEl._t);
    statusEl._t = setTimeout(() => { statusEl.textContent = "已就绪，张开手掌试试"; }, 800);
  },
});

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  try {
    await tracker.start();
    startBtn.textContent = "摄像头运行中";
  } catch (err) {
    console.warn("[HandTracker]", err);
    statusEl.textContent = "摄像头不可用，已切换鼠标模式：点击海面生成浪花";
    startBtn.textContent = "摄像头不可用";
    trackerActive = false;
  }
});

resize();
requestAnimationFrame(loop);