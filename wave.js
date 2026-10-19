// js/wave.js
// 负责：单朵浪花的生命周期、实时绘制、动画。
// 每朵浪花每一帧都是实时计算的曲线与泡沫，不使用贴图。

const COLORS = {
  deep: "#122a4a",
  mid: "#1b3b6f",
  light: "#2a5b8f",
  foam: "#f4efe4",
  outline: "#2b2118",
};

/** 单朵浪花 */
export class Wave {
  constructor(x, y, scale = 1) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.age = 0;
    this.life = 4200 + Math.random() * 1800;   // 4.2 ~ 6 秒
    this.phase = Math.random() * Math.PI * 2;  // 每朵浪花相位不同
    this.direction = Math.random() < 0.5 ? -1 : 1; // 卷曲方向
    this.dead = false;
    this.appear = 0;      // 0~1 弹出进度
    this.foam = this._makeFoam();
  }

  _makeFoam() {
    const list = [];
    const n = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      list.push({
        t: Math.random(),                             // 沿浪脊的相对位置
        off: (Math.random() - 0.5) * 30,              // 横向偏移
        r: 1 + Math.random() * 2.4,                   // 半径
        vy: 0.02 + Math.random() * 0.06,              // 下落速度
        vx: (Math.random() - 0.5) * 0.04,             // 横向漂移
        life: 0.4 + Math.random() * 0.6,
      });
    }
    return list;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.life) {
      this.dead = true;
      return;
    }
    // 弹出缓动
    this.appear = Math.min(1, this.appear + dt / 260);
    // 飞沫运动
    for (const f of this.foam) {
      f.t += f.vy * dt * 0.001;
      f.off += f.vx * dt * 0.001;
    }
  }

  draw(ctx, time) {
    const lifeRatio = this.age / this.life;
    const fade = lifeRatio < 0.65 ? 1 : 1 - (lifeRatio - 0.65) / 0.35;
    const easeOut = 1 - Math.pow(1 - this.appear, 3);
    const s = this.scale * easeOut * (1 - lifeRatio * 0.25);
    if (s <= 0.001) return;

    const bob = Math.sin(time * 0.0018 + this.phase) * 6; // 整体上下浮动
    const x = this.x;
    const y = this.y + bob;

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(x, y);
    ctx.scale(s * this.direction, s);

    const W = 130; // 浪宽（半宽）
    const H = 90;  // 浪高

    this._drawBody(ctx, W, H, time);
    this._drawCurl(ctx, W, H, time);
    this._drawFoam(ctx, W, H, fade);
    this._drawOutline(ctx, W, H, time);

    ctx.restore();
  }

  /** 浪身：分层蓝色块 + 内部水纹 */
  _drawBody(ctx, W, H, time) {
    const wob = Math.sin(time * 0.002 + this.phase) * 4;

    ctx.beginPath();
    ctx.moveTo(-W, 10);
    ctx.bezierCurveTo(
      -W * 0.6, -H * 0.4 + wob,
      -W * 0.2, -H * 0.9,
      10,       -H * 0.95 + wob
    );
    ctx.bezierCurveTo(
      W * 0.5,  -H * 0.85,
      W * 0.85, -H * 0.2,
      W,        10
    );
    ctx.lineTo(W, 40);
    ctx.bezierCurveTo(W * 0.5, 22, -W * 0.5, 22, -W, 40);
    ctx.closePath();

    const g = ctx.createLinearGradient(0, -H, 0, 40);
    g.addColorStop(0, COLORS.mid);
    g.addColorStop(0.55, COLORS.light);
    g.addColorStop(1, COLORS.deep);
    ctx.fillStyle = g;
    ctx.fill();

    // 内部浅色水纹
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(244,239,228,0.32)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const yy = -H * 0.7 + i * 18
        + Math.sin(time * 0.003 + i + this.phase) * 3;
      ctx.beginPath();
      ctx.moveTo(-W, yy);
      ctx.bezierCurveTo(-W * 0.3, yy - 8, W * 0.3, yy + 8, W, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 浪脊卷曲 + 爪状泡沫尖 */
  _drawCurl(ctx, W, H, time) {
    const curl = 0.9 + Math.sin(time * 0.0025 + this.phase) * 0.12;
    const tipX = W * 0.25 * curl;
    const tipY = -H * 0.45;

    // 卷曲主体
    ctx.beginPath();
    ctx.moveTo(-W * 0.2, -H * 0.9);
    ctx.bezierCurveTo(
      W * 0.1,  -H * 1.35,
      W * 0.75, -H * 1.15,
      tipX,     tipY
    );
    ctx.bezierCurveTo(
      W * 0.55, -H * 0.7,
      W * 0.35, -H * 0.75,
      W * 0.15, -H * 0.8
    );
    ctx.closePath();
    ctx.fillStyle = COLORS.foam;
    ctx.fill();

    // 泡沫爪：4 根小尖爪，像手指抓下来
    const claws = 4;
    for (let i = 0; i < claws; i++) {
      const p = i / (claws - 1);
      const bx = -W * 0.05 + p * W * 0.6;
      const by = -H * (1.05 + 0.12 * Math.sin(p * Math.PI));
      const sway = Math.sin(time * 0.004 + i * 1.7 + this.phase) * 5;

      ctx.beginPath();
      ctx.moveTo(bx - 9, by + 6);
      ctx.quadraticCurveTo(bx + sway, by - 26, bx + 6, by - 34);
      ctx.quadraticCurveTo(bx + 14, by - 16, bx + 9, by + 6);
      ctx.closePath();
      ctx.fillStyle = COLORS.foam;
      ctx.fill();
    }
  }

  /** 飞沫小圆点 */
  _drawFoam(ctx, W, H, fade) {
    ctx.fillStyle = COLORS.foam;
    for (const f of this.foam) {
      const px = -W * 0.2 + f.t * W * 0.9 + f.off;
      const py = -H * 0.9 + f.t * H * 0.6 + Math.sin(f.t * 10) * 4;
      ctx.globalAlpha = fade * f.life * (1 - f.t);
      ctx.beginPath();
      ctx.arc(px, py, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = fade;
  }

  /** 墨色描边，让浪脊更硬朗 */
  _drawOutline(ctx, W, H, time) {
    const wob = Math.sin(time * 0.002 + this.phase) * 4;

    ctx.beginPath();
    ctx.moveTo(-W, 10);
    ctx.bezierCurveTo(
      -W * 0.6, -H * 0.4 + wob,
      -W * 0.2, -H * 0.9,
      10,       -H * 0.95 + wob
    );
    ctx.bezierCurveTo(
      W * 0.5,  -H * 0.85,
      W * 0.85, -H * 0.2,
      W,        10
    );
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.stroke();

    // 卷曲部分描边
    ctx.beginPath();
    ctx.moveTo(-W * 0.2, -H * 0.9);
    ctx.bezierCurveTo(
      W * 0.1,  -H * 1.35,
      W * 0.75, -H * 1.15,
      W * 0.225, -H * 0.45
    );
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** 浪花场：统一管理所有浪花实例的增删、更新与绘制 */
export class WaveField {
  constructor(max = 24) {
    this.waves = [];
    this.max = max;
  }

  add(x, y, scale) {
    if (this.waves.length >= this.max) this.waves.shift();
    this.waves.push(new Wave(x, y, scale));
  }

  update(dt) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      this.waves[i].update(dt);
      if (this.waves[i].dead) this.waves.splice(i, 1);
    }
  }

  draw(ctx, time) {
    // 按 y 排序，靠下的后画，视觉上在前面
    const sorted = [...this.waves].sort((a, b) => a.y - b.y);
    for (const w of sorted) w.draw(ctx, time);
  }
}