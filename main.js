// js/main.js
// 负责：画布初始化、浮世绘背景绘制、主循环、UI 事件与降级交互。

import { WaveField } from "./wave.js";
import { HandTracker } from "./hand.js"; 

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

// 颜色配置：调整为《凯风快晴》的色调
const COLORS = {
  skyTop: "#a3c4dc",
  skyBottom: "#c4d8e6",
  seaDeep: "#1d3b5b",
  seaMid: "#4a7a9b",
  seaLight: "#7a9fb8",
  fujiBody: "#f4f1e8",
  fujiShadow: "#1d3b5b",
  forest: "#1a1a1a"
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
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.7);
}

function drawFuji() {
  const baseY = H * 0.72;      // 山脚没入海平线
  const cx = W * 0.68;         // 山体中心偏右
  const peakY = H * 0.15;      // 山顶高度
  const halfW = W * 0.45;      // 山体非常宽广

  // 1. 绘制山体底色
  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.bezierCurveTo(
    cx - halfW * 0.6, baseY - (baseY - peakY) * 0.4,
    cx - halfW * 0.25, peakY + 20,
    cx - halfW * 0.1, peakY
  );
  ctx.lineTo(cx + halfW * 0.08, peakY);
  ctx.bezierCurveTo(
    cx + halfW * 0.2, peakY + 30,
    cx + halfW * 0.5, baseY - (baseY - peakY) * 0.2,
    cx + halfW, baseY + 20
  );
  ctx.closePath();
  
  const bodyGrad = ctx.createLinearGradient(cx, peakY, cx, baseY);
  bodyGrad.addColorStop(0, COLORS.fujiBody);
  bodyGrad.addColorStop(0.7, "#e2e2d8");
  bodyGrad.addColorStop(1, "#b0c4d4"); 
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // 2. 绘制右侧深蓝色山脊阴影
  ctx.beginPath();
  ctx.moveTo(cx + halfW * 0.08, peakY);
  ctx.bezierCurveTo(
    cx + halfW * 0.2, peakY + 30,
    cx + halfW * 0.5, baseY - (baseY - peakY) * 0.2,
    cx + halfW, baseY + 20
  );
  ctx.lineTo(cx + halfW * 0.6, baseY + 10); 
  ctx.bezierCurveTo(
    cx + halfW * 0.3, baseY - (baseY - peakY) * 0.3,
    cx + halfW * 0.15, peakY + 40,
    cx + halfW * 0.08, peakY
  );
  ctx.closePath();
  ctx.fillStyle = COLORS.fujiShadow;
  ctx.fill();

  // 3. 绘制山顶积雪与放射状沟壑
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.3, peakY + (baseY - peakY) * 0.35);
  ctx.lineTo(cx - halfW * 0.1, peakY);
  ctx.lineTo(cx + halfW * 0.08, peakY);
  ctx.lineTo(cx + halfW * 0.25, peakY + (baseY - peakY) * 0.3);
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const px = cx + halfW * (0.25 - t * 0.55);
    const py = peakY + (baseY - peakY) * (0.25 + Math.random() * 0.15);
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // 积雪沟壑
  ctx.strokeStyle = COLORS.fujiShadow;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 15; i++) {
    const startX = cx - halfW * 0.1 + Math.random() * halfW * 0.18;
    const startY = peakY + Math.random() * 20;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(
      startX + (Math.random() - 0.5) * 30, startY + (baseY - peakY) * 0.1,
      startX + (Math.random() - 0.5) * 50, startY + (baseY - peakY) * 0.2,
      startX + (Math.random() - 0.5) * 60, startY + (baseY - peakY) * (0.25 + Math.random() * 0.1)
    );
    ctx.stroke();
  }

  // 4. 左下角的山麓森林（密集小点）
  ctx.fillStyle = COLORS.forest;
  const forestW = halfW * 0.8;
  const forestH = (baseY - peakY) * 0.4;
  const startX = cx - halfW;
  
  for (let i = 0; i < 1200; i++) {
    const rx = Math.random();
    const ry = Math.random();
    if (ry > rx * 1.2) {
      const px = startX + rx * forestW;
      const py = baseY - forestH + ry * forestH;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 2, py - 4);
      ctx.lineTo(px + 4, py);
      ctx.fill();
    }
  }
}

function drawSeaBase() {
  const topY = H * 0.62; // 海平线
  const g = ctx.createLinearGradient(0, topY, 0, H);
  g.addColorStop(0, COLORS.seaLight); 
  g.addColorStop(0.4, COLORS.seaMid);
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