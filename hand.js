// hand.js
let HandLandmarker = null;
let FilesetResolver = null;
const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

async function loadMediaPipeOnce() {
  if (HandLandmarker) return;
  const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
  HandLandmarker = vision.HandLandmarker;
  FilesetResolver = vision.FilesetResolver;
}

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];

export class HandTracker {
  constructor({ onOpenPalm, onMove, onStatus, onDebug } = {}) {
    this.onOpenPalm = onOpenPalm;
    this.onMove = onMove;
    this.onStatus = onStatus;
    this.onDebug = onDebug; // 接收调试信息
    
    this.landmarker = null;
    this.video = null;
    this.stream = null;
    this.running = false;

    this.prevOpen = false;
    this.lastTriggerTime = 0;
    this.cooldown = 400; // 稍微延长冷却时间
    this.frameCount = 0;
    this.detectEveryNFrames = 2;
  }

  async init() {
    if (this.landmarker) return;
    this.onStatus?.("正在加载模型...");
    await loadMediaPipeOnce(); 
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
    });
  }

  async start() {
    await this.init();
    this.onStatus?.("正在开启摄像头...");
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });

    this.video = document.createElement("video");
    this.video.srcObject = this.stream;
    this.video.playsInline = true;
    this.video.muted = true;
    await this.video.play();

    this.running = true;
    this.onStatus?.("识别中，请把手放进画面");
    this._loop();
  }

  _loop() {
    const tick = () => {
      if (!this.running) return;
      this.frameCount++;
      if (this.frameCount % this.detectEveryNFrames === 0) {
        this._detect();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _detect() {
    if (!this.video || this.video.readyState < 2) return;

    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, performance.now());
    } catch (e) {
      return;
    }

    const hands = result?.landmarks;
    if (!hands || hands.length === 0) {
      this.prevOpen = false;
      this.onDebug?.("未检测到手，请靠近镜头");
      return;
    }

    const lm = hands[0];
    const extended = this._countExtendedFingers(lm);
    const open = extended >= 4;

    // 实时打印你伸出了几根手指
    this.onDebug?.(`检测到手掌，伸直 ${extended} 指`);

    const cx = (lm[0].x + lm[9].x + lm[12].x) / 3;
    const cy = (lm[0].y + lm[9].y + lm[12].y) / 3;
    const mirrored = { x: 1 - cx, y: cy };
    this.onMove?.(mirrored);

    const now = performance.now();
    // 如果张开手，并且之前没张开，触发浪花
    if (open && !this.prevOpen && now - this.lastTriggerTime > this.cooldown) {
      this.lastTriggerTime = now;
      this.onOpenPalm?.(mirrored);
    }
    this.prevOpen = open;
  }

  // 重新优化判定，使用大拇指到食指根的距离判断，其他指头指尖到手腕距离判断
  _countExtendedFingers(lm) {
    let extended = 0;
    const wrist = lm[0];
    
    // 1. 食指、中指、无名指、小指
    for (let i = 1; i <= 4; i++) {
      const tip = lm[FINGER_TIPS[i]];
      const pip = lm[FINGER_PIPS[i]];
      // 放宽到 1.0（只要指尖离手腕比关节远就算伸直）
      if (this._dist(tip, wrist) > this._dist(pip, wrist) * 1.0) {
        extended++;
      }
    }

    // 2. 拇指单独判断（指尖到食指根部的距离）
    const thumbTip = lm[4];
    const thumbPip = lm[3];
    const indexMcp = lm[5];
    if (this._dist(thumbTip, indexMcp) > this._dist(thumbPip, indexMcp) * 1.0) {
      extended++;
    }
    
    return extended;
  }

  _dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}