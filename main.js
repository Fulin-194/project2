// js/main.js
// 负责：画布初始化、浮世绘背景绘制、主循环、UI 事件与降级交互。

import { WaveField } from "./wave.js";
import { HandTracker } from "./handTracking.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

const COLORS = {
  skyTop: "#e8eef4",
  skyBottom: "#f4efe4",
  seaDeep: "#122a4a",
  seaMid: "#1b3b6f",
  seaLight: "#2a5b8f",
  waveLine: "#4a86b8",
  foam: "#f4efe4",
  outline: "#2b2118",
  fuji: "#1b3b6f",
  fujiSnow: "#f4efe4",
};

let W = 0;
let H = 0;
let DPR = 1;

const waveField = new WaveField(24);

// 手指/鼠标指针提示
const pointer = { x: 0, y: 0, visible: false };
let trackerActive = false; // 摄像头是否在驱动 pointer

// ---------- 尺寸与高清适配 ----------
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);

// ---------- 背景：天空 / 富士山 / 海面 ----------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.62);
}

function drawFuji() {
  const baseY = H * 0.62;
  const cx = W * 0.78;
  const peakY = H * 0.18;
  const halfW = W * 0.2;

  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.quadraticCurveTo(cx - halfW * 0.5, peakY + 30, cx - halfW * 0.12, peakY);
  ctx.lineTo(cx + halfW * 0.12, peakY);
  ctx.quadraticCurveTo(cx + halfW * 0.5, peakY + 30, cx + halfW, baseY);
  ctx.closePath();
  ctx.fillStyle = COLORS.fuji;
  ctx.fill();

  // 雪顶
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.26, peakY + (baseY - peakY) * 0.22);
  ctx.lineTo(cx - halfW * 0.12, peakY);
  ctx.lineTo(cx + halfW * 0.12, peakY);
  ctx.lineTo(cx + halfW * 0.26, peakY + (baseY - peakY) * 0.22);
  ctx.quadraticCurveTo(
    cx,
    peakY + (baseY - peakY) * 0.3,
    cx - halfW * 0.26,
    peakY + (baseY - peakY) * 0.22
  );
  ctx.closePath();
  ctx.fillStyle = COLORS.fujiSnow;
  ctx.fill();
}

function drawSeaBase() {
  const topY = H * 0.62;
  const g = ctx.createLinearGradient(0, topY, 0, H);
  g.addColorStop(0, COLORS.seaLight);
  g.addColorStop(0.5, COLORS.seaMid);
  g.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, topY, W, H - topY);
}

function drawSeaLines(time) {
  const topY = H * 0.62;
  const lineCount = 26;
  ctx.lineCap = "round";

  for (let i = 0; i < lineCount; i++) {
    const p = i / (lineCount - 1);
    const baseY = topY + p * (H - topY) + 6;
    const amp = 3 + p * 9;
    const freq = 0.006 + p * 0.004;
    const speed = 0.0006 + p * 0.0004;
    const alpha = 0.18 + p * 0.35;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(74,134,184,${alpha})`;
    ctx.lineWidth = 1.2 + p * 2.2;

    const step = 14;
    for (let x = -20; x <= W + 20; x += step) {
      const y =
        baseY +
        Math.sin(x * freq + time * speed + i * 0.9) * amp +
        Math.sin(x * freq * 2.3 + time * speed * 1.7) * amp * 0.35;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ---------- 生成浪花 ----------
function spawnAt(nx, ny) {
  // nx, ny 是 0~1 的归一化坐标
  const x = nx * W;
  const y = ny * H;
  const seaTop = H * 0.58;
  const yy = Math.max(seaTop, Math.min(H - 20, y));
  const scale = 0.7 + Math.random() * 0.5;
  waveField.add(x, yy, scale);
}

// ---------- 主循环 ----------
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

  // 指尖 / 鼠标光标
  if (pointer.visible) {
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244,239,228,0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(244,239,228,0.75)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  requestAnimationFrame(loop);
}

// ---------- 鼠标 / 触摸降级交互 ----------
canvas.addEventListener("pointermove", (e) => {
  if (trackerActive) return; // 摄像头模式下由手部驱动
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.visible = true;
});

canvas.addEventListener("pointerleave", () => {
  if (trackerActive) return;
  pointer.visible = false;
});

canvas.addEventListener("pointerdown", (e) => {
  spawnAt(e.clientX / W, e.clientY / H);
});

// ---------- 摄像头 ----------
const tracker = new HandTracker({
  onStatus: (s) => {
    statusEl.textContent = s;
  },
  onMove: ({ x, y }) => {
    trackerActive = true;
    pointer.x = x * W;
    pointer.y = y * H;
    pointer.visible = true;
  },
  onOpenPalm: ({ x, y }) => {
    trackerActive = true;
    spawnAt(x, y);
    pointer.x = x * W;
    pointer.y = y * H;
    pointer.visible = true;

    statusEl.textContent = "🌊 浪花生成！";
    clearTimeout(statusEl._t);
    statusEl._t = setTimeout(() => {
      statusEl.textContent = "已就绪，张开手掌试试";
    }, 800);
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

// ---------- 启动 ----------
resize();
requestAnimationFrame(loop);