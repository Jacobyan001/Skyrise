// 程序化像素房间引擎：无 API Key 时本地生成 16-bit 像素风房间
// 逻辑画布 240x135，最近邻放大到 800x450，保证颗粒感

import { parseScene } from './sceneParser.mjs';
import type { ParsedScene } from './sceneParser.mjs';

type G = CanvasRenderingContext2D;

// ---------- 随机数（由关键词+楼层播种，同主题有变化但可复现） ----------
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const ri = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

// ---------- 绘图基元 ----------
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
// 描边矩形
const BOX = (g: G, x: number, y: number, w: number, h: number, fill: string, edge: string, t = 2) => {
  R(g, x, y, w, h, fill);
  R(g, x, y, w, t, edge);
  R(g, x, y + h - t, w, t, edge);
  R(g, x, y, t, h, edge);
  R(g, x + w - t, y, t, h, edge);
};
const circle = (g: G, cx: number, cy: number, r: number, c: string) => {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
};

// ---------- 房间常量 ----------
const W = 240;
const CEIL = 9;       // 天花板高
const FLOOR_Y = 94;   // 地面线
const H = 135;

interface Palette {
  ceil: string; ceilD: string;
  wall: string; wallD: string;
  wain: string; wainD: string;
  floor: string; floorD: string;
  trim: string;
}
interface ThemeDef {
  pal: Palette;
  // 完整布置（主题为第 1 关键词时调用）
  draw: (g: G, rng: Rng) => void;
  // 小型标志物件（额外关键词作为“纪念摆件”出现）
  icon: (g: G, x: number, y: number) => void;
}

// ---------- 通用家具 ----------
// 窗户（窗外景色由 sky 决定）
function window_(g: G, x: number, y: number, w: number, h: number, sky: string, frame = '#e8e0c8') {
  BOX(g, x, y, w, h, sky, frame, 2);
  R(g, x + w / 2 - 1, y + 2, 2, h - 4, frame);
  R(g, x + 2, y + h / 2 - 1, w - 4, 2, frame);
}
// 地毯
function rug(g: G, x: number, w: number, c: string, edge: string) {
  R(g, x, FLOOR_Y + 18, w, 10, c);
  R(g, x, FLOOR_Y + 18, w, 2, edge);
  R(g, x, FLOOR_Y + 26, w, 2, edge);
}
// 挂画
function picture(g: G, x: number, y: number, w: number, h: number, inside: string) {
  BOX(g, x, y, w, h, inside, '#b8a888', 2);
}
// 盆栽
function plant(g: G, x: number, pot = '#c86a3c', leaf = '#4caf50') {
  R(g, x, FLOOR_Y - 10, 12, 10, pot);
  R(g, x - 2, FLOOR_Y - 12, 16, 3, pot);
  circle(g, x + 6, FLOOR_Y - 18, 7, leaf);
  circle(g, x + 2, FLOOR_Y - 22, 4, leaf);
  circle(g, x + 10, FLOOR_Y - 22, 4, '#66bb6a');
}
// 落地高脚桌/台
function table(g: G, x: number, w: number, top = '#a87844', leg = '#7a5630') {
  R(g, x, FLOOR_Y - 14, w, 4, top);
  R(g, x + 2, FLOOR_Y - 10, 3, 10, leg);
  R(g, x + w - 5, FLOOR_Y - 10, 3, 10, leg);
}
// 烧杯（内有颜色液体）
function beaker(g: G, x: number, baseY: number, liquid: string) {
  R(g, x, baseY - 8, 1, 8, '#cfe8ff');
  R(g, x + 6, baseY - 8, 1, 8, '#cfe8ff');
  R(g, x, baseY - 1, 7, 1, '#cfe8ff');
  R(g, x + 1, baseY - 5, 5, 4, liquid);
  R(g, x + 2, baseY - 11, 3, 3, '#cfe8ff'); // 颈
  R(g, x + 2, baseY - 10, 1, 2, liquid);
}
// 圆底烧瓶
function flask(g: G, x: number, baseY: number, liquid: string) {
  R(g, x + 2, baseY - 12, 2, 5, '#cfe8ff');
  circle(g, x + 3, baseY - 5, 4, '#cfe8ff');
  circle(g, x + 3, baseY - 4, 2, liquid);
}
// 试管
function tube(g: G, x: number, baseY: number, liquid: string) {
  R(g, x, baseY - 10, 2, 10, '#cfe8ff');
  R(g, x, baseY - 5, 2, 5, liquid);
}

// ===================================================================
// 主题定义
// ===================================================================
const THEMES: Record<string, ThemeDef> = {
  // ---------- 科学实验室 ----------
  '科学实验室': {
    pal: { ceil: '#d9e6ee', ceilD: '#b9ccd8', wall: '#eef3f6', wallD: '#d3dde3', wain: '#cdd8de', wainD: '#aebdc6', floor: '#c98a5e', floorD: '#a86c45', trim: '#8fa3ad' },
    draw(g, rng) {
      // 黑板
      BOX(g, 148, 16, 74, 42, '#3d5a48', '#8a6a42', 3);
      R(g, 156, 24, 20, 2, '#dcedc8');
      R(g, 156, 30, 40, 2, '#dcedc8');
      R(g, 156, 36, 30, 2, '#dcedc8');
      R(g, 156, 50, 36, 2, '#dcedc8');
      // 墙面管线
      R(g, 6, 14, 130, 3, '#b0bec5');
      R(g, 10, 14, 4, 6, '#90a4ae');
      R(g, 90, 14, 4, 6, '#90a4ae');
      // 实验台 1
      table(g, 10, 58);
      flask(g, 18, FLOOR_Y - 14, '#7ee787');
      beaker(g, 30, FLOOR_Y - 14, '#64b5f6');
      R(g, 48, FLOOR_Y - 24, 14, 2, '#cfe8ff');
      tube(g, 50, FLOOR_Y - 14, '#ba68c8');
      tube(g, 55, FLOOR_Y - 14, '#ffb74d');
      for (let i = 0; i < 5; i++) {
        circle(g, ri(rng, 16, 62), ri(rng, FLOOR_Y - 34, FLOOR_Y - 26), 1, '#ffffff');
      }
      // 实验台 2
      table(g, 82, 52);
      beaker(g, 90, FLOOR_Y - 14, '#ef5350');
      flask(g, 104, FLOOR_Y - 14, '#4dd0e1');
      R(g, 118, FLOOR_Y - 24, 8, 10, '#cfd8dc');
      R(g, 119, FLOOR_Y - 22, 6, 4, '#37474f'); // 显微镜筒
      // 气泡罐
      R(g, 200, FLOOR_Y - 30, 16, 16, 'rgba(120,200,255,0.5)');
      BOX(g, 200, FLOOR_Y - 30, 16, 16, 'rgba(160,220,255,0.25)', '#90caf9', 1);
      for (let i = 0; i < 6; i++) circle(g, ri(rng, 203, 213), ri(rng, FLOOR_Y - 27, FLOOR_Y - 17), 1, '#e3f2fd');
    },
    icon(g, x, y) { flask(g, x, y, '#7ee787'); },
  },

  // ---------- 魔法图书馆 ----------
  '魔法图书馆': {
    pal: { ceil: '#d7c9b8', ceilD: '#bda98e', wall: '#e7ddca', wallD: '#cfc0a5', wain: '#8d6e52', wainD: '#73563c', floor: '#8a6242', floorD: '#6e4c30', trim: '#5e422b' },
    draw(g, rng) {
      const bookCols = ['#c84b4b', '#4b7ac8', '#4ba86a', '#c8a24b', '#945ac8', '#c86a4b'];
      // 两个书架
      for (const sx of [10, 78]) {
        BOX(g, sx, 18, 60, 66, '#6e4c30', '#523720', 3);
        for (let row = 0; row < 4; row++) {
          const yy = 24 + row * 15;
          let bx = sx + 4;
          while (bx < sx + 54) {
            const bw = ri(rng, 3, 6);
            R(g, bx, yy, bw, 11, bookCols[ri(rng, 0, bookCols.length - 1)]);
            bx += bw + 1;
          }
          R(g, sx + 3, yy + 11, 54, 2, '#523720');
        }
      }
      // 书桌
      table(g, 150, 72, '#7a5230');
      R(g, 160, FLOOR_Y - 22, 14, 8, '#e8d8b0'); // 卷轴
      R(g, 160, FLOOR_Y - 22, 14, 2, '#c8b488');
      // 悬浮发光书
      R(g, 100, 14, 12, 9, '#8b5a9e');
      R(g, 105, 14, 2, 9, '#ffd54f');
      circle(g, 106, 20, 9, 'rgba(255,213,79,0.25)');
      picture(g, 160, 20, 50, 30, '#4a3a52');
      R(g, 166, 28, 38, 2, '#ffd54f');
      R(g, 166, 34, 26, 2, '#b39ddb');
    },
    icon(g, x, y) { R(g, x, y - 8, 9, 7, '#8b5a9e'); R(g, x + 4, y - 8, 1, 7, '#ffd54f'); },
  },

  // ---------- 太空站 ----------
  '太空站': {
    pal: { ceil: '#9fb3c8', ceilD: '#7e96ad', wall: '#c2cedb', wallD: '#9fb0c2', wain: '#8898aa', wainD: '#6c7d90', floor: '#5c6b7d', floorD: '#475563', trim: '#3a4654' },
    draw(g, rng) {
      // 舷窗
      circle(g, 50, 40, 24, '#d7dee6');
      circle(g, 50, 40, 20, '#0b1a3a');
      for (let i = 0; i < 14; i++) circle(g, ri(rng, 34, 66), ri(rng, 24, 56), 1, '#ffffff');
      R(g, 44, 32, 2, 2, '#90caf9');
      // 墙板铆钉
      for (let x = 8; x < 232; x += 24) {
        R(g, x, 70, 2, 2, '#6c7d90');
        R(g, x + 12, 70, 2, 2, '#6c7d90');
      }
      // 控制台
      R(g, 96, FLOOR_Y - 26, 128, 26, '#7a8a9c');
      R(g, 96, FLOOR_Y - 26, 128, 3, '#9fb0c2');
      for (const mx of [104, 140, 176]) {
        BOX(g, mx, FLOOR_Y - 44, 28, 20, '#123', '#5c6b7d', 2);
        R(g, mx + 3, FLOOR_Y - 41, 22, 8, rng() > 0.5 ? '#29b6f6' : '#26c6da');
        R(g, mx + 3, FLOOR_Y - 31, 10, 4, '#4dd0e1');
      }
      for (let i = 0; i < 8; i++) R(g, 104 + i * 14, FLOOR_Y - 8, 5, 3, rng() > 0.5 ? '#ffca28' : '#ef5350');
    },
    icon(g, x, y) { circle(g, x + 5, y - 12, 7, '#d7dee6'); circle(g, x + 5, y - 12, 5, '#0b1a3a'); R(g, x + 3, y - 14, 2, 2, '#90caf9'); },
  },

  // ---------- 街机游戏厅 ----------
  '街机游戏厅': {
    pal: { ceil: '#3a2e52', ceilD: '#2a2040', wall: '#6a4a8a', wallD: '#52366e', wain: '#3d2b58', wainD: '#2c1e42', floor: '#2e2440', floorD: '#1e1730', trim: '#ff4fc3' },
    draw(g, rng) {
      // 霓虹横条
      R(g, 0, 12, W, 3, '#ff4fc3');
      R(g, 0, 17, W, 1, '#4fe3ff');
      const cabColors = ['#ff5252', '#4fc3f7', '#ffca28', '#81c784', '#ba68c8'];
      const cx = [14, 58, 102, 146, 190];
      cx.forEach((x, i) => {
        const c = cabColors[i % cabColors.length];
        BOX(g, x, 34, 32, 60, '#262033', c, 2);
        R(g, x + 3, 38, 26, 6, c); // 招牌
        R(g, x + 5, 48, 22, 16, '#11243a'); // 屏幕
        R(g, x + 7, 50, rng() > 0.5 ? 18 : 12, 3, '#4fe3ff');
        R(g, x + 7, 55, 14, 2, '#7cffb2');
        R(g, x + 7, 59, 10, 2, '#ffe14f');
        R(g, x + 8, 70, 16, 3, '#14101e'); // 按键板
        R(g, x + 10, 70, 3, 3, '#ff4fc3');
        R(g, x + 20, 70, 3, 3, '#4fe3ff');
        R(g, x + 4, 94, 24, 4, '#14101e');
      });
      // 棋盘地砖
      for (let x = 0; x < W; x += 12) {
        if ((x / 12) % 2 === 0) R(g, x, FLOOR_Y + 6, 12, 6, '#3a2f55');
        if ((x / 12) % 2 === 0) R(g, x, FLOOR_Y + 22, 12, 6, '#3a2f55');
      }
    },
    icon(g, x, y) { BOX(g, x, y - 20, 14, 20, '#262033', '#ff5252', 1); R(g, x + 2, y - 17, 10, 7, '#11243a'); R(g, x + 3, y - 15, 6, 2, '#4fe3ff'); },
  },

  // ---------- 丛林探险 ----------
  '丛林探险': {
    pal: { ceil: '#7a8c4a', ceilD: '#5e7038', wall: '#b89464', wallD: '#9c7a4c', wain: '#8a6a40', wainD: '#6e5230', floor: '#7c5a36', floorD: '#5e4226', trim: '#3e5e2a' },
    draw(g, rng) {
      // 木板墙缝
      for (let x = 0; x < W; x += 30) R(g, x, 12, 2, FLOOR_Y - 12, 'rgba(90,60,30,0.35)');
      // 垂挂藤蔓
      for (let i = 0; i < 7; i++) {
        const x = ri(rng, 10, 230);
        const len = ri(rng, 20, 50);
        R(g, x, 10, 2, len, '#4e7a32');
        for (let y = 14; y < 10 + len; y += 6) R(g, x - 2, y, 2, 2, '#6a9a44');
      }
      // 顶部叶丛
      for (let i = 0; i < 24; i++) circle(g, ri(rng, 0, W), ri(rng, 4, 14), 5, rng() > 0.5 ? '#3e6e28' : '#4e8232');
      // 木箱
      BOX(g, 20, FLOOR_Y - 22, 24, 22, '#a87a44', '#6e4c28', 2);
      R(g, 20, FLOOR_Y - 11, 24, 2, '#6e4c28');
      R(g, 31, FLOOR_Y - 22, 2, 22, '#6e4c28');
      BOX(g, 52, FLOOR_Y - 16, 18, 16, '#b88a50', '#6e4c28', 2);
      // 地图
      picture(g, 150, 22, 44, 34, '#e8d8a8');
      R(g, 158, 30, 4, 4, '#d04848');
      R(g, 158, 30, 24, 2, '#8a6a40');
      R(g, 170, 30, 2, 14, '#8a6a40');
      R(g, 184, 26, 3, 3, '#d04848');
      // 望远镜
      R(g, 110, FLOOR_Y - 18, 16, 4, '#54616c');
      R(g, 110, FLOOR_Y - 20, 6, 3, '#37474f');
    },
    icon(g, x, y) { BOX(g, x, y - 12, 12, 12, '#a87a44', '#6e4c28', 2); R(g, x + 5, y - 12, 2, 12, '#6e4c28'); },
  },

  // ---------- 机器人工厂 ----------
  '机器人工厂': {
    pal: { ceil: '#8a95a5', ceilD: '#6c7888', wall: '#a8b4c2', wallD: '#8c98a6', wain: '#6a7684', wainD: '#525d69', floor: '#4a5560', floorD: '#37414b', trim: '#ffb300' },
    draw(g, rng) {
      // 传送带
      R(g, 8, FLOOR_Y - 8, 224, 12, '#37474f');
      R(g, 8, FLOOR_Y - 8, 224, 3, '#546e7a');
      for (let x = 12; x < 228; x += 14) R(g, x, FLOOR_Y - 3, 8, 3, '#263238');
      R(g, 18, FLOOR_Y - 16, 14, 8, '#b0bec5'); // 箱子
      R(g, 120, FLOOR_Y - 14, 10, 6, '#90a4ae');
      // 机械臂
      R(g, 70, FLOOR_Y - 34, 6, 26, '#ffb300');
      R(g, 60, FLOOR_Y - 34, 20, 6, '#ffca28');
      R(g, 60, FLOOR_Y - 38, 4, 6, '#78909c');
      R(g, 76, FLOOR_Y - 38, 4, 6, '#78909c');
      // 休眠机器人
      BOX(g, 160, FLOOR_Y - 40, 30, 24, '#90a4ae', '#607d8b', 2); // 身体
      R(g, 164, FLOOR_Y - 34, 7, 5, '#263238'); // 眼（暗=休眠）
      R(g, 180, FLOOR_Y - 34, 7, 5, '#263238');
      BOX(g, 164, FLOOR_Y - 54, 22, 16, '#b0bec5', '#78909c', 2); // 头
      R(g, 169, FLOOR_Y - 48, 5, 4, '#37474f');
      R(g, 177, FLOOR_Y - 48, 5, 4, '#37474f');
      R(g, 174, FLOOR_Y - 42, 2, 4, '#546e7a');
      // 火花
      for (let i = 0; i < 8; i++) {
        const x = ri(rng, 56, 88);
        R(g, x, ri(rng, FLOOR_Y - 46, FLOOR_Y - 40), 1, 1, rng() > 0.5 ? '#ffca28' : '#ff7043');
      }
      // 管道
      R(g, 0, 16, W, 4, '#78909c');
      R(g, 40, 16, 6, 14, '#78909c');
    },
    icon(g, x, y) { BOX(g, x, y - 14, 14, 10, '#b0bec5', '#78909c', 1); R(g, x + 3, y - 11, 3, 2, '#37474f'); R(g, x + 9, y - 11, 3, 2, '#37474f'); },
  },

  // ---------- 糖果乐园 ----------
  '糖果乐园': {
    pal: { ceil: '#f8d4e8', ceilD: '#ecb0d2', wall: '#fce4f1', wallD: '#f2c4dd', wain: '#e89cc4', wainD: '#d078a8', floor: '#e8a8c8', floorD: '#cc84aa', trim: '#ff4f9e' },
    draw(g, rng) {
      // 糖霜墙边线
      R(g, 0, 10, W, 4, '#fff0f8');
      for (let x = 4; x < W; x += 12) circle(g, x, 12, 3, '#fff');
      // 棒棒糖
      const lolli = (x: number, c1: string, c2: string) => {
        R(g, x + 5, FLOOR_Y - 26, 2, 26, '#f8e8d0');
        circle(g, x + 6, FLOOR_Y - 30, 9, c1);
        circle(g, x + 6, FLOOR_Y - 30, 5, c2);
        circle(g, x + 6, FLOOR_Y - 30, 2, c1);
      };
      lolli(20, '#ff5252', '#fff');
      lolli(60, '#4fc3f7', '#fff');
      lolli(180, '#ffca28', '#fff');
      // 拐杖糖
      R(g, 110, FLOOR_Y - 26, 4, 26, '#fff');
      R(g, 106, FLOOR_Y - 30, 8, 5, '#fff');
      R(g, 110, FLOOR_Y - 22, 4, 3, '#e91e63');
      R(g, 110, FLOOR_Y - 14, 4, 3, '#e91e63');
      R(g, 106, FLOOR_Y - 29, 3, 2, '#e91e63');
      // 小熊软糖
      for (const x of [140, 152, 200]) {
        const c = ['#66bb6a', '#ffa726', '#ab47bc'][ri(rng, 0, 2)];
        R(g, x, FLOOR_Y - 9, 8, 9, c);
        circle(g, x + 2, FLOOR_Y - 11, 2, c);
        circle(g, x + 6, FLOOR_Y - 11, 2, c);
      }
      rug(g, 30, 130, '#fff0f8', '#ff4f9e');
    },
    icon(g, x, y) { R(g, x + 3, y - 14, 2, 14, '#f8e8d0'); circle(g, x + 4, y - 16, 5, '#ff5252'); circle(g, x + 4, y - 16, 2, '#fff'); },
  },

  // ---------- 赛博朋克 ----------
  '赛博朋克': {
    pal: { ceil: '#2a1a3e', ceilD: '#1c1030', wall: '#3e2a5e', wallD: '#2e1e48', wain: '#241838', wainD: '#180e28', floor: '#201830', floorD: '#140e22', trim: '#00e5ff' },
    draw(g, rng) {
      // 大窗 + 城市剪影
      BOX(g, 14, 14, 96, 52, '#0a0a2e', '#00e5ff', 2);
      for (let x = 18; x < 106;) {
        const bw = ri(rng, 6, 12), bh = ri(rng, 14, 40);
        R(g, x, 62 - bh, bw, bh, '#151537');
        for (let wy = 64 - bh; wy < 58; wy += 5) for (let wx = x + 1; wx < x + bw - 2; wx += 3)
          if (rng() > 0.5) R(g, wx, wy, 1, 2, rng() > 0.5 ? '#ffd54f' : '#4fc3f7');
        x += bw + 2;
      }
      // 屏幕墙
      BOX(g, 126, 18, 40, 26, '#0d2c3a', '#00e5ff', 1);
      R(g, 130, 22, 32, 3, '#00e5ff');
      R(g, 130, 28, 22, 3, '#ff4fc3');
      R(g, 130, 34, 28, 3, '#7cffb2');
      BOX(g, 176, 18, 46, 26, '#2a1030', '#ff4fc3', 1);
      R(g, 182, 24, 8, 14, '#ff4fc3');
      R(g, 196, 24, 18, 3, '#00e5ff');
      R(g, 196, 30, 14, 3, '#00e5ff');
      // 全息台
      table(g, 130, 80, '#3a2a52');
      circle(g, 170, FLOOR_Y - 28, 10, 'rgba(0,229,255,0.25)');
      R(g, 166, FLOOR_Y - 38, 8, 12, 'rgba(0,229,255,0.4)');
      // 霓虹竖条
      R(g, 0, 70, 3, 24, '#ff4fc3');
      R(g, 237, 60, 3, 34, '#00e5ff');
    },
    icon(g, x, y) { R(g, x, y - 12, 10, 12, 'rgba(0,229,255,0.35)'); circle(g, x + 5, y - 14, 4, 'rgba(0,229,255,0.5)'); },
  },

  // ---------- 蒸汽朋克 ----------
  '蒸汽朋克': {
    pal: { ceil: '#9c7a4e', ceilD: '#7e5e38', wall: '#c0a070', wallD: '#a08254', wain: '#6e4e2e', wainD: '#543a22', floor: '#7a5636', floorD: '#5c3e26', trim: '#d4a24e' },
    draw(g, rng) {
      // 大齿轮
      const gear = (cx: number, cy: number, r: number, c: string) => {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          R(g, cx + Math.cos(ang) * r - 2, cy + Math.sin(ang) * r - 2, 4, 4, c);
        }
        circle(g, cx, cy, r, c);
        circle(g, cx, cy, r - 4, '#8a6a3c');
        circle(g, cx, cy, 3, '#d4a24e');
      };
      gear(50, 42, 22, '#b08a4e');
      gear(92, 56, 14, '#c8a05e');
      // 铜管
      R(g, 120, 20, 4, 60, '#b87333');
      R(g, 120, 20, 80, 4, '#b87333');
      R(g, 196, 20, 4, 20, '#b87333');
      R(g, 194, 14, 8, 8, '#cd7f32');
      // 压力表
      circle(g, 160, 46, 12, '#e8d8b8');
      circle(g, 160, 46, 10, '#f8f0e0');
      R(g, 160, 46, 7, 2, '#c0392b');
      circle(g, 160, 46, 2, '#333');
      // 工作台
      table(g, 20, 70, '#8a6a44');
      R(g, 30, FLOOR_Y - 22, 16, 8, '#7a5230');
      for (let i = 0; i < 5; i++) circle(g, ri(rng, 24, 84), ri(rng, FLOOR_Y - 24, FLOOR_Y - 16), 1, '#d4a24e');
      // 铆钉墙
      for (let x = 10; x < W; x += 20) R(g, x, 74, 2, 2, '#8a6a3c');
    },
    icon(g, x, y) { circle(g, x + 5, y - 10, 7, '#b08a4e'); circle(g, x + 5, y - 10, 2, '#d4a24e'); },
  },

  // ---------- 海底世界 ----------
  '海底世界': {
    pal: { ceil: '#2a6a8a', ceilD: '#1e5070', wall: '#3f8aaa', wallD: '#2e6e8a', wain: '#24586e', wainD: '#184254', floor: '#c8a868', floorD: '#a88848', trim: '#7ee0e8' },
    draw(g, rng) {
      // 大圆窗
      circle(g, 120, 46, 34, '#c8d8e0');
      circle(g, 120, 46, 29, '#0d3a5c');
      R(g, 120, 16, 3, 60, '#8fa3ad');
      // 鱼
      const fish = (x: number, y: number, c: string) => {
        circle(g, x, y, 5, c);
        R(g, x - 6, y - 2, 4, 5, c);
        circle(g, x + 3, y - 1, 1, '#fff');
      };
      fish(ri(rng, 100, 136), ri(rng, 28, 60), '#ffca28');
      fish(ri(rng, 100, 136), ri(rng, 28, 64), '#ff7043');
      fish(ri(rng, 100, 136), ri(rng, 28, 64), '#ab47bc');
      for (let i = 0; i < 10; i++) circle(g, ri(rng, 96, 144), ri(rng, 22, 70), 1, '#b3e5fc');
      // 珊瑚
      const coral = (x: number, c: string) => {
        R(g, x, FLOOR_Y - 14, 3, 14, c);
        R(g, x - 4, FLOOR_Y - 18, 3, 6, c);
        R(g, x + 4, FLOOR_Y - 16, 3, 5, c);
      };
      coral(24, '#ff7043');
      coral(52, '#ec407a');
      coral(196, '#ab47bc');
      // 海草
      for (const x of [70, 180, 214]) for (let y = FLOOR_Y; y > FLOOR_Y - 18; y -= 4) R(g, x + ((y / 4) % 2 === 0 ? 0 : 2), y - 4, 2, 4, '#2e8b57');
    },
    icon(g, x, y) { circle(g, x + 4, y - 8, 4, '#ffca28'); R(g, x - 1, y - 10, 3, 4, '#ffca28'); },
  },

  // ---------- 中世纪城堡 ----------
  '中世纪城堡': {
    pal: { ceil: '#8a8a92', ceilD: '#6c6c74', wall: '#a8a8b0', wallD: '#8a8a92', wain: '#787880', wainD: '#5c5c64', floor: '#6a5a48', floorD: '#504232', trim: '#c8a24e' },
    draw(g, rng) {
      // 石块缝
      for (let y = 12; y < FLOOR_Y; y += 12) for (let x = (y / 12) % 2 ? 0 : 12; x < W; x += 24) {
        R(g, x, y, 2, 12, 'rgba(60,60,70,0.4)');
        R(g, 0, y, W, 1, 'rgba(60,60,70,0.35)');
      }
      // 旗帜
      BOX(g, 100, 12, 2, 40, '#5a3a28', '#5a3a28', 1);
      R(g, 102, 14, 22, 12, '#c0392b');
      R(g, 102, 26, 10, 4, '#c0392b');
      // 火把 x2
      const torch = (x: number) => {
        R(g, x, 30, 3, 20, '#5a3a28');
        R(g, x - 2, 24, 7, 6, '#8a6a44');
        circle(g, x + 1, 21, 4, '#ff9800');
        circle(g, x + 1, 22, 2, '#ffeb3b');
      };
      torch(30); torch(206);
      // 宝箱
      BOX(g, 150, FLOOR_Y - 22, 40, 22, '#7a4e28', '#4e2e16', 2);
      R(g, 150, FLOOR_Y - 28, 40, 8, '#8a5a30');
      R(g, 150, FLOOR_Y - 26, 40, 2, '#ffca28');
      R(g, 167, FLOOR_Y - 26, 6, 8, '#ffca28');
      for (let i = 0; i < 6; i++) circle(g, ri(rng, 154, 186), FLOOR_Y - 31, 1, '#ffd54f');
      // 石凳
      R(g, 40, FLOOR_Y - 10, 22, 10, '#787880');
      R(g, 44, FLOOR_Y - 14, 14, 4, '#8a8a92');
    },
    icon(g, x, y) { BOX(g, x, y - 10, 12, 10, '#7a4e28', '#4e2e16', 1); R(g, x, y - 12, 12, 3, '#ffca28'); },
  },

  // ---------- 幽灵鬼屋 ----------
  '幽灵鬼屋': {
    pal: { ceil: '#4a4a5a', ceilD: '#343444', wall: '#6a6a7c', wallD: '#525262', wain: '#424250', wainD: '#2e2e3a', floor: '#3a3444', floorD: '#282430', trim: '#8aff9e' },
    draw(g, rng) {
      // 角落蛛网
      const web = (cx: number, cy: number, dx: number) => {
        for (let i = 1; i <= 4; i++) {
          R(g, cx, cy + i * 8, dx * i * 3, 1, 'rgba(230,230,255,0.7)');
          R(g, cx + (dx > 0 ? i * 6 : -i * 6), cy, 1, i * 8, 'rgba(230,230,255,0.7)');
        }
      };
      web(0, 10, 1); web(240, 10, -1);
      // 旧画框
      BOX(g, 96, 22, 48, 34, '#3a3a48', '#8a7a5a', 3);
      R(g, 106, 32, 4, 14, '#2a2a34');
      R(g, 116, 28, 18, 3, '#2a2a34');
      // 烛台
      R(g, 44, FLOOR_Y - 30, 4, 30, '#8a8a98');
      R(g, 30, FLOOR_Y - 30, 32, 3, '#8a8a98');
      for (const x of [32, 46, 60]) {
        R(g, x, FLOOR_Y - 40, 3, 10, '#e8e0d0');
        circle(g, x + 1, FLOOR_Y - 43, 2, rng() > 0.5 ? '#ffca28' : '#8aff9e');
      }
      // 诡异绿光
      circle(g, 180, 60, 16, 'rgba(138,255,158,0.15)');
      R(g, 176, FLOOR_Y - 18, 8, 18, '#4a4a56');
      circle(g, 180, FLOOR_Y - 22, 5, 'rgba(138,255,158,0.4)');
      // 旧桌
      table(g, 150, 60, '#5a4a40');
    },
    icon(g, x, y) { R(g, x, y - 12, 3, 12, '#e8e0d0'); circle(g, x + 1, y - 14, 2, '#ffca28'); },
  },

  // ---------- 冰雪宫殿 ----------
  '冰雪宫殿': {
    pal: { ceil: '#a8d8f0', ceilD: '#86bfe0', wall: '#d4ecfa', wallD: '#b0d8ee', wain: '#9ccce8', wainD: '#7ab4d8', floor: '#c8e4f4', floorD: '#a4c8e0', trim: '#5ab8e8' },
    draw(g, rng) {
      // 冰柱
      for (let x = 10; x < W; x += ri(rng, 16, 30)) {
        const h = ri(rng, 8, 26);
        R(g, x, 10, 4, h, '#dff4ff');
        R(g, x + 1, 10, 1, h, '#fff');
      }
      // 水晶王座
      R(g, 150, FLOOR_Y - 34, 34, 34, '#7fd4f4');
      R(g, 156, FLOOR_Y - 46, 22, 14, '#9ce4ff');
      R(g, 150, FLOOR_Y - 34, 34, 4, '#bff0ff');
      R(g, 156, FLOOR_Y - 30, 22, 20, 'rgba(255,255,255,0.35)');
      // 雪晶
      const flake = (x: number, y: number) => {
        R(g, x - 2, y, 5, 1, '#fff');
        R(g, x, y - 2, 1, 5, '#fff');
        R(g, x - 1, y - 1, 3, 1, '#e3f4ff');
      };
      for (let i = 0; i < 14; i++) flake(ri(rng, 14, 230), ri(rng, 18, 80));
      // 闪光
      for (let i = 0; i < 8; i++) R(g, ri(rng, 20, 220), ri(rng, FLOOR_Y - 20, FLOOR_Y - 2), 2, 2, '#fff');
      // 冰堆
      circle(g, 50, FLOOR_Y - 5, 14, '#e8f6ff');
      circle(g, 80, FLOOR_Y - 3, 8, '#d4ecfa');
    },
    icon(g, x, y) { R(g, x + 1, y - 12, 4, 12, '#dff4ff'); R(g, x + 2, y - 12, 1, 12, '#fff'); },
  },

  // ---------- 温室花园 ----------
  '温室花园': {
    pal: { ceil: '#b8e8d0', ceilD: '#90d0b2', wall: '#dff4e6', wallD: '#bcdcc8', wain: '#a8d0b4', wainD: '#84b896', floor: '#c8a878', floorD: '#a88858', trim: '#4caf50' },
    draw(g, rng) {
      // 玻璃顶框架
      R(g, 0, 10, W, 2, '#7aa6b8');
      for (let x = 0; x < W; x += 24) { R(g, x, 10, 2, 18, '#7aa6b8'); R(g, x + 6, 12, 2, 16, 'rgba(255,255,255,0.5)'); }
      // 盆栽
      const potted = (x: number, flower: string) => {
        R(g, x, FLOOR_Y - 12, 14, 12, '#c86a3c');
        R(g, x - 2, FLOOR_Y - 14, 18, 3, '#b85a30');
        circle(g, x + 7, FLOOR_Y - 20, 8, '#4caf50');
        circle(g, x + 7, FLOOR_Y - 27, 3, flower);
      };
      potted(16, '#e91e63');
      potted(50, '#ffeb3b');
      potted(180, '#9c27b0');
      potted(208, '#ff5722');
      // 花田箱
      R(g, 90, FLOOR_Y - 14, 70, 14, '#8a6a42');
      for (let x = 94; x < 156; x += 8) {
        R(g, x, FLOOR_Y - 22, 2, 8, '#388e3c');
        circle(g, x + 1, FLOOR_Y - 24, 3, ['#e91e63', '#ffeb3b', '#fff', '#ff9800'][ri(rng, 0, 3)]);
      }
      // 洒水壶
      R(g, 168, FLOOR_Y - 14, 12, 10, '#66bb6a');
      R(g, 180, FLOOR_Y - 12, 6, 2, '#66bb6a');
      R(g, 166, FLOOR_Y - 16, 4, 4, '#66bb6a');
      // 高株
      for (const x of [80, 170]) {
        R(g, x, FLOOR_Y - 30, 2, 30, '#2e7d32');
        circle(g, x + 1, FLOOR_Y - 34, 5, '#66bb6a');
      }
    },
    icon(g, x, y) { R(g, x, y - 8, 10, 8, '#c86a3c'); circle(g, x + 5, y - 13, 5, '#4caf50'); circle(g, x + 5, y - 17, 2, '#e91e63'); },
  },

  // ---------- 披萨店 ----------
  '披萨店': {
    pal: { ceil: '#e8c8a0', ceilD: '#d0a878', wall: '#f4e0c4', wallD: '#dcc4a2', wain: '#c89868', wainD: '#a87a4e', floor: '#b8825a', floorD: '#96623e', "trim": '#e53935' },
    draw(g, rng) {
      // 砖纹
      for (let y = 12; y < FLOOR_Y; y += 10) for (let x = (y / 10) % 2 ? 0 : 16; x < W; x += 32)
        R(g, x, y, 1, 10, 'rgba(160,90,50,0.25)');
      // 砖窑
      R(g, 18, 30, 56, 64, '#8a4a32');
      R(g, 24, 38, 44, 48, '#5a2e20'); // 拱形洞
      R(g, 24, 38, 44, 10, '#3a1e14');
      for (let i = 0; i < 10; i++) R(g, ri(rng, 26, 64), ri(rng, 44, 78), 2, 2, rng() > 0.5 ? '#ff9800' : '#ffca28');
      R(g, 18, 26, 56, 4, '#a05a3c');
      // 操作台
      R(g, 90, FLOOR_Y - 22, 130, 22, '#d4b894');
      R(g, 90, FLOOR_Y - 24, 130, 3, '#e8d0ac');
      // 披萨
      circle(g, 112, FLOOR_Y - 30, 9, '#f4d098');
      circle(g, 108, FLOOR_Y - 34, 1, '#c0392b');
      circle(g, 115, FLOOR_Y - 32, 1, '#c0392b');
      circle(g, 110, FLOOR_Y - 27, 1, '#c0392b');
      circle(g, 150, FLOOR_Y - 30, 9, '#f8e0b0');
      for (let i = 0; i < 5; i++) circle(g, ri(rng, 144, 156), ri(rng, FLOOR_Y - 36, FLOOR_Y - 26), 1, '#e53935');
      circle(g, 150, FLOOR_Y - 30, 5, '#f4c864');
      // 挂盘
      for (const x of [180, 202]) { circle(g, x, 24, 7, '#cfd8dc'); R(g, x - 1, 14, 2, 4, '#7a5630'); }
      // 配料盒
      R(g, 180, FLOOR_Y - 38, 34, 10, '#8a6a44');
      R(g, 184, FLOOR_Y - 36, 6, 6, '#e53935');
      R(g, 194, FLOOR_Y - 36, 6, 6, '#f8f0d8');
      R(g, 204, FLOOR_Y - 36, 6, 6, '#4caf50');
    },
    icon(g, x, y) { circle(g, x + 5, y - 8, 6, '#f4d098'); circle(g, x + 3, y - 10, 1, '#c0392b'); circle(g, x + 7, y - 7, 1, '#c0392b'); },
  },
};

// ---------- 通用房间（未知/自定义关键词） ----------
function defaultRoom(g: G, rng: Rng) {
  const pal: Palette = { ceil: '#d8e0e8', ceilD: '#b8c4d0', wall: '#eee6da', wallD: '#d6ccbc', wain: '#c4a884', wainD: '#a88c66', floor: '#b88a5a', floorD: '#966c42', trim: '#7a5630' };
  drawShell(g, pal);
  // 床
  R(g, 16, FLOOR_Y - 18, 56, 18, '#8a5a8a');
  R(g, 16, FLOOR_Y - 24, 20, 8, '#fff');
  R(g, 16, FLOOR_Y - 18, 56, 4, '#a87aa8');
  // 柜子
  BOX(g, 90, FLOOR_Y - 34, 30, 34, '#a87a4c', '#7a5630', 2);
  R(g, 104, FLOOR_Y - 30, 2, 26, '#7a5630');
  // 挂画
  picture(g, 140, 22, 40, 28, '#a8d0e8');
  circle(g, 152, 34, 5, '#ffca28');
  R(g, 160, 40, 14, 4, '#6a9a5a');
  // 地毯与植物
  rug(g, 130, 90, '#c85a5a', '#8a3a3a');
  plant(g, 200);
  for (let i = 0; i < 4; i++) R(g, ri(rng, 20, 220), ri(rng, 30, 70), 4, 4, 'rgba(255,255,255,0.5)');
}

// ============================================================
// 故事场景：解析整句后绘制「身份 + 动作 + 地点」
// ============================================================

// 故事房间配色（mcdonald/kfc/court 专用，其余用通用）
const STORY_PAL: Record<string, Palette> = {
  mcdonald: { ceil: '#ece7da', ceilD: '#c9c2b2', wall: '#f6f2e8', wallD: '#ddd5c4', wain: '#d53a2c', wainD: '#a82b20', floor: '#e9d3a1', floorD: '#cbb180', trim: '#a82b20' },
  kfc: { ceil: '#ece7da', ceilD: '#c9c2b2', wall: '#f6f2e8', wallD: '#ddd5c4', wain: '#d53a2c', wainD: '#a82b20', floor: '#e9d3a1', floorD: '#cbb180', trim: '#a82b20' },
  court: { ceil: '#d8dee2', ceilD: '#b4bcc2', wall: '#cfd8de', wallD: '#b0bac2', wain: '#9aa6ae', wainD: '#78848c', floor: '#d8a86a', floorD: '#b8884a', trim: '#8a6a3a' },
  jungle: { ceil: '#243e22', ceilD: '#182c18', wall: '#356b35', wallD: '#28502a', wain: '#244024', wainD: '#1a2e1a', floor: '#6a5230', floorD: '#4e3c22', trim: '#3a2c16' },
  robotfactory: { ceil: '#8a94a0', ceilD: '#68727e', wall: '#7a8694', wallD: '#5e6a78', wain: '#545e6c', wainD: '#3e4856', floor: '#6a7280', floorD: '#4e5662', trim: '#e8a020' },
};
const STORY_PAL_DEFAULT: Palette = { ceil: '#d9e2ea', ceilD: '#b6c2ce', wall: '#ece4d6', wallD: '#d6ccba', wain: '#c8ac86', wainD: '#a88c66', floor: '#bfa074', floorD: '#9a7c50', trim: '#7a5630' };

// 未知地点的空敞房间（中央留给角色）
function drawOpenRoom(g: G) {
  picture(g, 26, 22, 34, 22, '#a8d0e8');
  circle(g, 38, 30, 4, '#ffca28');
  picture(g, 180, 22, 34, 22, '#b8e0c0');
  R(g, 188, 32, 16, 4, '#6a9a5a');
  plant(g, 8);
  plant(g, 228);
  rug(g, 120, 90, '#5a8ac8', '#3a6aa8');
}

// 快餐店（麦当劳/肯德基），中央地面留给角色
function drawFastFood(g: G, brand: 'mcdonald' | 'kfc') {
  const red = '#c12e24';
  const yellow = '#ffc72c';
  // 中央品牌墙
  R(g, 98, 22, 44, 22, red);
  if (brand === 'mcdonald') {
    circle(g, 111, 40, 7, yellow);
    circle(g, 129, 40, 7, yellow);
    R(g, 103, 41, 34, 4, red); // 遮住圆的下半 → 金色拱门
  } else {
    // 全家桶
    R(g, 112, 32, 16, 12, '#f6f2e8');
    R(g, 110, 30, 20, 3, '#f6f2e8');
    R(g, 112, 36, 16, 2, red);
    R(g, 112, 40, 16, 2, red);
  }
  // 左右菜单牌（无文字，只用色块）
  for (const bx of [14, 192]) {
    R(g, bx, 22, 34, 16, '#2e6b46');
    R(g, bx, 22, 34, 3, red);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        R(g, bx + 4 + c * 10, 30 + r * 5, 5, 3, c === 0 ? '#e8b05a' : c === 1 ? '#d53a2c' : '#e8d24a');
      }
    }
  }
  // 右侧点餐台
  R(g, 152, 62, 72, 32, '#efe8da');
  R(g, 152, 62, 72, 3, red);
  R(g, 156, 70, 1, 22, '#c9bfae');
  R(g, 170, 70, 1, 22, '#c9bfae');
  BOX(g, 158, 50, 12, 12, '#9aa6b2', '#5f6b76', 1); // 收银机
  // 左侧卡座
  R(g, 12, 80, 22, 14, '#8e2018');
  R(g, 12, 72, 22, 8, red);
  R(g, 12, 72, 22, 2, '#e05a4a');
  R(g, 41, 78, 2, 16, '#8a8272');
  circle(g, 42, 78, 9, '#efe8da');
  circle(g, 42, 78, 7, '#e2dacd');
  // 方格地砖
  for (let y = FLOOR_Y + 10; y < H; y += 10) R(g, 0, y, W, 1, '#cbb180');
  for (let x = 10; x < W; x += 20) R(g, x, FLOOR_Y, 1, H - FLOOR_Y, '#cbb180');
}

// 篮球场/体育馆
function drawCourt(g: G) {
  // 左侧观众席
  const benchColors = ['#6a8fc8', '#c86a6a', '#e8c05a', '#6ac88a'];
  for (let i = 0; i < 4; i++) R(g, 10, 60 + i * 8, 30, 6, benchColors[i]);
  // 右侧篮筐
  R(g, 210, 42, 3, 52, '#8a8f98');
  R(g, 192, 28, 22, 15, '#f4eede');
  R(g, 192, 28, 22, 1, '#9a6a3a');
  R(g, 192, 42, 22, 1, '#9a6a3a');
  R(g, 192, 28, 1, 15, '#9a6a3a');
  R(g, 213, 28, 1, 15, '#9a6a3a');
  R(g, 201, 33, 6, 1, '#d53a2c');
  R(g, 201, 38, 6, 1, '#d53a2c');
  R(g, 201, 33, 1, 6, '#d53a2c');
  R(g, 206, 33, 1, 6, '#d53a2c');
  circle(g, 202, 45, 3, '#e8602c');
  R(g, 199, 48, 7, 1, '#fff');
  R(g, 200, 50, 5, 1, '#fff');
  // 场地线
  R(g, 0, 112, W, 2, 'rgba(255,255,255,0.7)');
  R(g, 150, 94, 2, 18, 'rgba(255,255,255,0.6)');
}

// 热带丛林：两侧大树、垂挂藤蔓、地面蕨类（中央留给角色）
function drawJungle(g: G) {
  // 两侧大树干与树冠
  for (const tx of [6, 224]) {
    R(g, tx, 12, 10, FLOOR_Y - 12, '#6a4a2a');
    R(g, tx, 12, 2, FLOOR_Y - 12, '#523820');
    circle(g, tx + 5, 15, 11, '#2e6b30');
    circle(g, tx + 2, 22, 7, '#3a7a3a');
  }
  // 垂挂藤蔓
  for (const vx of [44, 84, 156, 196]) {
    const len = 16 + (vx % 5) * 3;
    R(g, vx, 9, 1, len, '#2e5a2a');
    for (let y = 12; y < 9 + len; y += 6) R(g, vx - 1, y, 2, 1, '#4a8a3e');
  }
  // 地面蕨类
  for (const fx of [30, 58, 180, 208]) {
    for (let i = 0; i < 3; i++) R(g, fx - i, FLOOR_Y - 2 - i * 2, 1 + i * 2, 2, '#3a7a34');
  }
  // 林间阳光
  R(g, 96, 10, 2, 42, 'rgba(255,240,160,0.16)');
  R(g, 140, 12, 2, 36, 'rgba(255,240,160,0.12)');
}

// 机器人工厂：传送带、机械臂、仪表盘（中央留给角色）
function drawRobotFactory(g: G) {
  // 左右传送带
  for (const bx of [16, 150]) {
    R(g, bx, FLOOR_Y - 8, 74, 7, '#3a424e');
    R(g, bx, FLOOR_Y - 8, 74, 2, '#56606e');
    for (let x = bx + 3; x < bx + 72; x += 8) circle(g, x, FLOOR_Y - 4, 2, '#8a96a6');
  }
  // 天花板机械臂
  for (const ax of [40, 200]) {
    R(g, ax - 1, 9, 3, 24, '#aeb8c4');
    R(g, ax - 4, 31, 10, 3, '#aeb8c4');
    R(g, ax - 5, 34, 3, 4, '#56606e');
    R(g, ax + 2, 34, 3, 4, '#56606e');
  }
  // 墙面仪表盘
  for (const px of [86, 100, 114, 130, 144]) {
    R(g, px, 24, 8, 7, '#2e3844');
    circle(g, px + 4, 27, 2, px % 2 ? '#66e0a0' : '#e8c84a');
  }
  // 地面警示条
  for (let x = 0; x < W; x += 8) R(g, x, FLOOR_Y + 2, 4, 2, '#e8a020');
}

// ---------- 街道场景（户外，不用室内外壳） ----------
function drawStreetScene(g: G, cyber: boolean) {
  if (cyber) {
    // 深夜天空
    R(g, 0, 0, W, FLOOR_Y, '#0c1230');
    const stars: Array<[number, number]> = [[26, 12], [64, 8], [120, 14], [190, 9], [214, 18], [150, 6], [96, 20]];
    for (const [sx, sy] of stars) R(g, sx, sy, 1, 1, '#cfe0ff');
    // 远景高楼
    const bxs = [0, 26, 52, 80, 108, 136, 164, 192, 216];
    const signs: Array<[number, number, number, string]> = [];
    for (let i = 0; i < bxs.length; i++) {
      const bw = i === bxs.length - 1 ? 24 : 24;
      const bh = 40 + ((i * 37) % 34);
      const top = FLOOR_Y - bh;
      R(g, bxs[i], top, bw, bh, '#171f46');
      // 亮灯窗户
      for (let wy = top + 4; wy < FLOOR_Y - 8; wy += 7) {
        for (let wx = bxs[i] + 3; wx < bxs[i] + bw - 3; wx += 7) {
          if (((wx * 13 + wy * 7) % 3) === 0) R(g, wx, wy, 2, 3, (wx + wy) % 2 ? '#ff5ab0' : '#55e0ee');
        }
      }
      // 每栋楼一块霓虹招牌（发光色块，不写字）
      const c = i % 2 ? '#ff5ab0' : '#55e0ee';
      const sy2 = FLOOR_Y - 8;
      const sx2 = bxs[i] + 4, sw = bw - 8;
      signs.push([sx2, sy2, sw, c]);
    }
    for (const [sx, sy, sw, c] of signs) {
      R(g, sx, sy, sw, 3, c);
      R(g, sx + 1, sy + 1, sw - 2, 1, '#ffffff');
      // 湿路面上的断续倒影
      for (let ry = FLOOR_Y + 2; ry < H - 2; ry += 3) R(g, sx + 3, ry, sw - 6, 1, c);
    }
    // 湿润马路
    R(g, 0, FLOOR_Y, W, H - FLOOR_Y, '#111738');
    R(g, 0, FLOOR_Y, W, 1, '#2a3468');
    for (let x = 6; x < W; x += 28) R(g, x, FLOOR_Y + 18, 12, 1, '#8a94b8');
  } else {
    // 普通城市街道：黄昏
    R(g, 0, 0, W, FLOOR_Y, '#3a4a6e');
    const bxs = [0, 30, 62, 96, 130, 164, 198];
    for (let i = 0; i < bxs.length; i++) {
      const bh = 44 + ((i * 29) % 30);
      const top = FLOOR_Y - bh;
      R(g, bxs[i], top, 30, bh, '#2c3854');
      for (let wy = top + 5; wy < FLOOR_Y - 6; wy += 8) {
        for (let wx = bxs[i] + 4; wx < bxs[i] + 26; wx += 8) {
          if (((wx + wy) % 3) === 0) R(g, wx, wy, 3, 3, '#e8c86a');
        }
      }
    }
    // 灰色马路与人行道
    R(g, 0, FLOOR_Y - 4, W, 4, '#6a6e76');
    R(g, 0, FLOOR_Y, W, H - FLOOR_Y, '#4a4e56');
    for (let x = 8; x < W; x += 30) R(g, x, FLOOR_Y + 18, 13, 1, '#c8cca8');
  }
}

// 火灾特效：浓烟 + 沿墙火焰 + 火星（在角色之前绘制，角色站在火前）
function drawFireEffect(g: G) {
  // 浓烟
  const smokes: Array<[number, number]> = [[30, 18], [92, 24], [162, 20], [202, 16]];
  for (const [sx, sw] of smokes) {
    R(g, sx, 10, sw, 5, 'rgba(58,58,64,0.78)');
    R(g, sx + 3, 6, sw - 6, 4, 'rgba(84,84,90,0.6)');
  }
  // 沿墙火焰
  for (let x = 14; x < W - 8; x += 12) {
    const h = 12 + ((x * 7) % 9);
    R(g, x, FLOOR_Y - h, 6, h, '#e85a1c');
    R(g, x + 1, FLOOR_Y - h, 2, h - 3, '#f8b020');
    R(g, x + 2, FLOOR_Y - 4, 2, 4, '#ffe066');
  }
  // 火星
  const sparks: Array<[number, number]> = [[50, 30], [110, 22], [170, 28], [205, 34], [80, 40], [150, 18]];
  for (const [sx, sy] of sparks) R(g, sx, sy, 1, 2, '#ffd24a');
}

// ---------- 角色系统 ----------
interface CharStyle { skin: string; shirt: string; shirtD: string; pants: string; shoe: string; hair: string }
const SKIN_TONES = ['#f2c49b', '#e8b083', '#c68863', '#8d5a3b'];
const HAIR_COLORS = ['#3a2a1c', '#5a3a22', '#24201c', '#8a5a2a'];

function pickStyle(rng: Rng, sprite: string): CharStyle {
  const sets = [
    { shirt: '#3f7fd6', shirtD: '#2c5ea8', pants: '#3a3f55' },
    { shirt: '#d65a5a', shirtD: '#a83a3a', pants: '#44506b' },
    { shirt: '#4caf6e', shirtD: '#2e8a4e', pants: '#3a3f55' },
    { shirt: '#b06ad6', shirtD: '#8a4ab0', pants: '#4a3f55' },
  ];
  let s = sets[ri(rng, 0, 3)];
  if (sprite === 'basketball') s = { shirt: '#e8742c', shirtD: '#c2561a', pants: '#444a5e' };
  if (sprite === 'soccer') s = { shirt: '#3aa856', shirtD: '#26803e', pants: '#2f3b52' };
  if (sprite === 'athlete') s = { shirt: '#3a7fd0', shirtD: '#265ea8', pants: '#3a3f55' };
  if (sprite === 'astronaut') s = { shirt: '#eef2f6', shirtD: '#c5ced8', pants: '#c5ced8' };
  if (sprite === 'warrior' || sprite === 'catwarrior') s = { shirt: '#9aa6b2', shirtD: '#6e7886', pants: '#54505e' };
  if (sprite === 'robot' || sprite === 'robotfire') s = { shirt: '#aeb8c4', shirtD: '#7e8896', pants: '#5f6a78' };
  if (sprite === 'firefighter') s = { shirt: '#c23a2c', shirtD: '#942820', pants: '#3e4858' };
  return { skin: SKIN_TONES[ri(rng, 0, 3)], hair: HAIR_COLORS[ri(rng, 0, 3)], shoe: '#ece4d4', ...s };
}

// 正面脸（hx,hy 为 8x8 头部左上角）；sprite 决定人类/猫咪/机器人头
function drawHead(g: G, hx: number, hy: number, s: CharStyle, sprite = 'kid') {
  if (sprite === 'catwarrior' || sprite === 'cat') {
    // 猫耳
    R(g, hx, hy - 2, 2, 2, '#e8983a');
    R(g, hx + 6, hy - 2, 2, 2, '#e8983a');
    R(g, hx, hy - 1, 1, 1, '#f2b06a');
    R(g, hx + 7, hy - 1, 1, 1, '#f2b06a');
    // 橘猫脸
    R(g, hx, hy, 8, 8, '#e8983a');
    R(g, hx, hy + 6, 8, 2, '#fff2dc');
    R(g, hx + 2, hy + 3, 1, 2, '#2e6b3a');
    R(g, hx + 5, hy + 3, 1, 2, '#2e6b3a');
    R(g, hx + 3, hy + 5, 2, 1, '#d56a8a');
    return;
  }
  if (sprite === 'robot' || sprite === 'robotfire') {
    // 天线
    R(g, hx + 3, hy - 2, 2, 2, '#9aa6b2');
    R(g, hx + 3, hy - 3, 2, 1, '#e23a2c');
    // 金属头（略带圆角感的高光）
    R(g, hx, hy, 8, 8, '#9aa6b2');
    R(g, hx, hy, 8, 2, '#b6c0cc');
    R(g, hx, hy + 7, 8, 1, '#6a7480');
    R(g, hx + 1, hy + 3, 2, 2, '#66e0f0');
    R(g, hx + 5, hy + 3, 2, 2, '#66e0f0');
    R(g, hx + 2, hy + 6, 4, 1, '#3e4856');
    return;
  }
  R(g, hx, hy, 8, 8, s.skin);
  R(g, hx, hy, 8, 2, s.hair);
  R(g, hx + 2, hy + 4, 1, 2, '#2e2620');
  R(g, hx + 5, hy + 4, 1, 2, '#2e2620');
  R(g, hx + 2, hy + 6, 4, 1, '#b06a52');
}

// 宇航头盔
function drawHelmet(g: G, hx: number, hy: number) {
  R(g, hx - 1, hy - 1, 10, 10, '#cfe4ee');
  R(g, hx - 1, hy - 1, 10, 1, '#9fb8c8');
  R(g, hx - 1, hy + 8, 10, 1, '#9fb8c8');
  R(g, hx - 1, hy - 1, 1, 10, '#9fb8c8');
  R(g, hx + 8, hy - 1, 1, 10, '#9fb8c8');
  R(g, hx + 1, hy + 3, 6, 4, '#33507a');
  R(g, hx + 2, hy + 4, 1, 1, '#8fd0e8');
}

// 头饰/身份配件（hx,hy 为头部左上角）
function drawHeadgear(g: G, sprite: string, hx: number, hy: number) {
  switch (sprite) {
    case 'basketball':
      R(g, hx, hy + 2, 8, 1, '#e23a2c'); break; // 红发带
    case 'princess':
      R(g, hx + 1, hy - 2, 6, 2, '#ffd24a');
      R(g, hx + 2, hy - 3, 1, 1, '#ffd24a');
      R(g, hx + 5, hy - 3, 1, 1, '#ffd24a');
      break;
    case 'king':
    case 'queen':
      R(g, hx, hy - 2, 8, 2, '#ffd24a');
      R(g, hx + 1, hy - 3, 1, 1, '#ffd24a');
      R(g, hx + 6, hy - 3, 1, 1, '#ffd24a');
      break;
    case 'pirate':
      R(g, hx, hy, 8, 2, '#d53a2c');
      R(g, hx - 2, hy + 1, 2, 2, '#d53a2c');
      break;
    case 'wizard':
      R(g, hx, hy - 2, 8, 2, '#5b3aa0');
      R(g, hx + 1, hy - 4, 6, 2, '#5b3aa0');
      R(g, hx + 2, hy - 6, 4, 2, '#5b3aa0');
      break;
    case 'witch':
      R(g, hx - 2, hy, 12, 1, '#2a2430');
      R(g, hx, hy - 2, 8, 2, '#2a2430');
      R(g, hx + 2, hy - 4, 4, 2, '#2a2430');
      break;
    case 'knight':
      R(g, hx - 1, hy - 1, 10, 3, '#aeb8c2');
      R(g, hx - 1, hy - 1, 1, 3, '#8a949e');
      break;
    case 'clown':
      R(g, hx - 2, hy + 1, 2, 3, '#e23a2c');
      R(g, hx + 8, hy + 1, 2, 3, '#3a7ad6');
      R(g, hx + 3, hy + 5, 2, 2, '#e23a2c');
      break;
    case 'chef':
      R(g, hx, hy - 3, 8, 3, '#f2f2ee');
      R(g, hx + 1, hy - 5, 6, 2, '#f2f2ee');
      break;
    default:
      break;
  }
}

// 球
function drawBall(g: G, cx: number, cy: number, kind: 'basketball' | 'soccer') {
  const c = kind === 'basketball' ? '#e8742c' : '#f2f2ee';
  const line = kind === 'basketball' ? '#7a3a14' : '#3a3a3a';
  circle(g, cx, cy, 4, c);
  R(g, cx - 3, cy, 7, 1, line);
  R(g, cx, cy - 3, 1, 7, line);
}

// 音符
function drawMusicNote(g: G, x: number, y: number, c = '#ffd24a') {
  R(g, x, y, 1, 5, c);
  R(g, x, y, 3, 2, c);
}

// 四角星
function drawStar(g: G, x: number, y: number) {
  R(g, x, y - 2, 1, 5, '#ffe066');
  R(g, x - 2, y, 5, 1, '#ffe066');
}

// 魔法星光：围绕指定中心散布彩色小星
function drawMagicSparkles(g: G, cx: number, cy: number) {
  const pts: Array<[number, number, string]> = [
    [cx - 10, cy - 8, '#ffe066'], [cx + 10, cy - 6, '#55e0ee'], [cx - 8, cy + 8, '#ff7ad0'],
    [cx + 9, cy + 7, '#ffe066'], [cx, cy - 12, '#c8a0ff'], [cx - 13, cy + 1, '#ffffff'],
    [cx + 13, cy, '#55e0ee'], [cx - 2, cy + 11, '#ffd24a'],
  ];
  for (const [px, py, c] of pts) {
    R(g, px, py - 1, 1, 3, c);
    R(g, px - 1, py, 3, 1, c);
  }
}

// 站立姿势；sideBall: 脚边放球
function poseStand(g: G, x: number, fy: number, s: CharStyle, sprite: string, sideBall: 'basketball' | 'soccer' | null = null) {
  R(g, x - 6, fy - 2, 5, 2, s.shoe);
  R(g, x + 1, fy - 2, 5, 2, s.shoe);
  R(g, x - 5, fy - 9, 4, 7, s.pants);
  R(g, x + 1, fy - 9, 4, 7, s.pants);
  R(g, x - 5, fy - 19, 10, 10, s.shirt);
  R(g, x - 5, fy - 19, 10, 2, s.shirtD);
  R(g, x - 7, fy - 18, 2, 8, s.shirt);
  R(g, x - 7, fy - 11, 2, 2, s.skin);
  R(g, x + 5, fy - 18, 2, 8, s.shirt);
  R(g, x + 5, fy - 11, 2, 2, s.skin);
  if (sprite === 'astronaut') drawHelmet(g, x - 4, fy - 29);
  else {
    drawHead(g, x - 4, fy - 29, s, sprite);
    drawHeadgear(g, sprite, x - 4, fy - 29);
  }
  if (sprite === 'catwarrior' || sprite === 'cat') {
    R(g, x + 6, fy - 15, 2, 6, '#e8983a');
    R(g, x + 7, fy - 18, 2, 3, '#e8983a');
  }
  if (sideBall) drawBall(g, x + 12, sideBall === 'basketball' ? fy - 4 : fy - 3, sideBall);
  else if (sprite === 'basketball') drawBall(g, x + 12, fy - 4, 'basketball');
  else if (sprite === 'soccer') drawBall(g, x + 11, fy - 3, 'soccer');
}

// 街舞：头撑地倒立定格（倒置身体一眼可辨），双腿弯曲分开，周围动感线
function poseBreakdance(g: G, x: number, fy: number, s: CharStyle, sprite: string) {
  // 倒立的头（头顶着地）：从地面向上依次是头发、发带、嘴、眼睛
  R(g, x - 4, fy - 8, 8, 8, s.skin);
  R(g, x - 4, fy - 2, 8, 2, s.hair);
  R(g, x - 4, fy - 3, 8, 1, '#e23a2c'); // 红发带
  R(g, x - 2, fy - 4, 4, 1, '#b06a52');  // 嘴
  R(g, x - 3, fy - 6, 1, 2, '#2e2620');  // 左眼
  R(g, x + 2, fy - 6, 1, 2, '#2e2620');  // 右眼
  // 脖子与倒置躯干（腰带在最上方即髋部一侧）
  R(g, x - 1, fy - 10, 2, 2, s.skin);
  R(g, x - 5, fy - 22, 10, 12, s.shirt);
  R(g, x - 5, fy - 22, 10, 2, s.shirtD);
  // 双手撑地辅助
  R(g, x - 8, fy - 13, 2, 11, '#33415e');
  R(g, x - 9, fy - 2, 4, 2, s.skin);
  R(g, x + 6, fy - 13, 2, 11, '#33415e');
  R(g, x + 5, fy - 2, 4, 2, s.skin);
  // 向上的两条大腿 + 向外弯曲分开的小腿
  R(g, x - 4, fy - 30, 3, 8, s.pants);
  R(g, x + 1, fy - 30, 3, 8, s.pants);
  R(g, x - 10, fy - 30, 6, 3, s.pants);
  R(g, x - 11, fy - 31, 5, 2, s.shoe);
  R(g, x + 4, fy - 30, 6, 3, s.pants);
  R(g, x + 6, fy - 31, 5, 2, s.shoe);
  // 头部两侧动感弧线
  R(g, x - 16, fy - 10, 5, 1, '#ffe066');
  R(g, x - 18, fy - 6, 4, 1, '#ffe066');
  R(g, x - 16, fy - 3, 5, 1, '#ffe066');
  R(g, x + 11, fy - 10, 5, 1, '#ffe066');
  R(g, x + 14, fy - 6, 4, 1, '#ffe066');
  R(g, x + 11, fy - 3, 5, 1, '#ffe066');
  drawStar(g, x - 18, fy - 26);
  drawStar(g, x + 18, fy - 26);
  // 篮球放在身侧
  if (sprite === 'basketball') drawBall(g, x - 22, fy - 4, 'basketball');
}

// 跳舞：手举起、身体微弹
function poseDance(g: G, x: number, fy: number, s: CharStyle, sprite: string) {
  const y = fy - 3;
  R(g, x - 6, y - 2, 5, 2, s.shoe);
  R(g, x + 1, y - 2, 5, 2, s.shoe);
  R(g, x - 5, y - 9, 4, 7, s.pants);
  R(g, x + 1, y - 9, 4, 7, s.pants);
  R(g, x - 5, y - 19, 10, 10, s.shirt);
  R(g, x - 5, y - 19, 10, 2, s.shirtD);
  R(g, x - 7, y - 25, 2, 7, s.shirt);
  R(g, x - 7, y - 26, 2, 2, s.skin);
  R(g, x + 5, y - 25, 2, 7, s.shirt);
  R(g, x + 5, y - 26, 2, 2, s.skin);
  if (sprite === 'astronaut') drawHelmet(g, x - 4, y - 29);
  else {
    drawHead(g, x - 4, y - 29, s, sprite);
    drawHeadgear(g, sprite, x - 4, y - 29);
  }
  drawMusicNote(g, x + 13, fy - 30);
  drawMusicNote(g, x - 16, fy - 34, '#66d8e8');
}

// 跑步：前倾、大步、速度线
function poseRun(g: G, x: number, fy: number, s: CharStyle, sprite: string) {
  R(g, x - 5, fy - 19, 10, 10, s.shirt);
  R(g, x - 5, fy - 19, 10, 2, s.shirtD);
  // 前腿（弯曲迈出）
  R(g, x - 2, fy - 9, 7, 3, s.pants);
  R(g, x + 4, fy - 9, 3, 7, s.pants);
  R(g, x + 3, fy - 2, 5, 2, s.shoe);
  // 后腿（蹬地）
  R(g, x - 9, fy - 9, 7, 3, s.pants);
  R(g, x - 9, fy - 15, 3, 6, s.pants);
  R(g, x - 10, fy - 16, 5, 2, s.shoe);
  // 摆臂
  R(g, x + 4, fy - 17, 2, 6, s.shirt);
  R(g, x + 4, fy - 12, 4, 2, s.skin);
  R(g, x - 6, fy - 18, 2, 6, s.shirt);
  R(g, x - 9, fy - 13, 4, 2, s.skin);
  drawHead(g, x - 4, fy - 28, s, sprite);
  drawHeadgear(g, sprite, x - 4, fy - 28);
  R(g, x - 20, fy - 20, 8, 1, '#fff');
  R(g, x - 17, fy - 14, 6, 1, '#fff');
  R(g, x - 21, fy - 8, 9, 1, '#fff');
}

// 足球射门：左腿支撑站立，右腿前摆抬起，双臂张开，足球在前方空中
function poseSoccerShoot(g: G, x: number, fy: number, s: CharStyle, sprite: string) {
  // 支撑腿
  R(g, x - 5, fy - 9, 4, 7, s.pants);
  R(g, x - 6, fy - 2, 5, 2, s.shoe);
  // 踢球腿前摆（大腿水平前伸）
  R(g, x - 1, fy - 11, 12, 3, s.pants);
  R(g, x + 10, fy - 12, 4, 2, s.shoe);
  // 躯干
  R(g, x - 5, fy - 19, 10, 10, s.shirt);
  R(g, x - 5, fy - 19, 10, 2, s.shirtD);
  // 左臂张开
  R(g, x - 10, fy - 17, 5, 2, s.shirt);
  R(g, x - 12, fy - 16, 2, 2, s.skin);
  // 右臂上摆保持平衡
  R(g, x + 5, fy - 24, 2, 7, s.shirt);
  R(g, x + 4, fy - 25, 3, 2, s.skin);
  drawHead(g, x - 4, fy - 29, s, sprite);
  drawHeadgear(g, sprite, x - 4, fy - 29);
  // 足球在踢点前方空中
  drawBall(g, x + 16, fy - 11, 'soccer');
}

// 篮球跳投：双脚离地屈膝，双臂把球推向头顶上方
function poseBasketballShoot(g: G, x: number, fy: number, s: CharStyle, sprite: string) {
  // 离地屈膝双腿
  R(g, x - 5, fy - 13, 4, 4, s.pants);
  R(g, x - 6, fy - 10, 5, 2, s.shoe);
  R(g, x + 1, fy - 13, 4, 4, s.pants);
  R(g, x + 1, fy - 10, 5, 2, s.shoe);
  // 躯干
  R(g, x - 5, fy - 23, 10, 10, s.shirt);
  R(g, x - 5, fy - 23, 10, 2, s.shirtD);
  // 双臂上举推球
  R(g, x - 7, fy - 30, 2, 8, s.shirt);
  R(g, x + 5, fy - 30, 2, 8, s.shirt);
  R(g, x - 8, fy - 31, 3, 2, s.skin);
  R(g, x + 5, fy - 31, 3, 2, s.skin);
  drawHead(g, x - 4, fy - 32, s, sprite);
  drawHeadgear(g, sprite, x - 4, fy - 32);
  // 篮球在最高点
  drawBall(g, x, fy - 37, 'basketball');
}

// 探险：迈步前行、一手前探、一手高举短剑
function poseExplore(g: G, x: number, fy: number, s: CharStyle, sprite: string) {
  // 双腿迈步
  R(g, x - 6, fy - 2, 5, 2, s.shoe);
  R(g, x + 2, fy - 2, 5, 2, s.shoe);
  R(g, x - 5, fy - 9, 4, 7, s.pants);
  R(g, x + 1, fy - 9, 4, 7, s.pants);
  // 躯干（铠甲）
  R(g, x - 5, fy - 19, 10, 10, s.shirt);
  R(g, x - 5, fy - 19, 10, 2, s.shirtD);
  // 左手前探
  R(g, x + 5, fy - 17, 2, 6, s.shirt);
  R(g, x + 5, fy - 12, 3, 2, sprite === 'catwarrior' ? '#e8983a' : s.skin);
  // 右手高举短剑
  R(g, x - 7, fy - 25, 2, 7, s.shirt);
  R(g, x - 7, fy - 26, 2, 2, sprite === 'catwarrior' ? '#e8983a' : s.skin);
  R(g, x - 7, fy - 34, 1, 8, '#c8d2dc');
  R(g, x - 9, fy - 26, 5, 1, '#8a6a3a');
  drawHead(g, x - 4, fy - 29, s, sprite);
  drawHeadgear(g, sprite, x - 4, fy - 29);
  // 猫尾
  if (sprite === 'catwarrior') {
    R(g, x + 6, fy - 15, 2, 6, '#e8983a');
    R(g, x + 7, fy - 18, 2, 3, '#e8983a');
  }
}

// 救火：弓步站稳、双臂前伸握高压水枪，水柱喷向右侧火焰
function poseFirefight(g: G, x: number, fy: number, s: CharStyle, sprite: string) {
  // 弓步双腿
  R(g, x - 9, fy - 2, 5, 2, s.shoe);
  R(g, x + 3, fy - 2, 6, 2, s.shoe);
  R(g, x - 8, fy - 9, 4, 7, s.pants);
  R(g, x + 2, fy - 9, 4, 7, s.pants);
  // 前倾躯干
  R(g, x - 5, fy - 19, 10, 10, s.shirt);
  R(g, x - 5, fy - 19, 10, 2, s.shirtD);
  // 双臂前伸握住水枪
  R(g, x + 4, fy - 18, 8, 2, s.shirt);
  R(g, x + 4, fy - 14, 8, 2, s.shirt);
  R(g, x + 11, fy - 18, 2, 2, sprite.startsWith('robot') ? '#66e0f0' : s.skin);
  R(g, x + 11, fy - 14, 2, 2, sprite.startsWith('robot') ? '#66e0f0' : s.skin);
  // 水枪喷头
  R(g, x + 12, fy - 17, 5, 4, '#3e4856');
  R(g, x + 16, fy - 16, 2, 2, '#8a96a6');
  // 地面水龙带
  R(g, x - 16, fy - 3, 17, 2, '#2e5a8a');
  R(g, x - 18, fy - 7, 3, 6, '#2e5a8a');
  // 喷射水柱（向右）
  for (let i = 0; i < 10; i++) R(g, x + 18 + i * 4, fy - 16 + (i % 2), 3, 1, '#8fd0f0');
  drawHead(g, x - 4, fy - 29, s, sprite);
  drawHeadgear(g, sprite, x - 4, fy - 29);
}

// 名人/国家队额外身份
interface CharOpts { name?: string; team?: string; noBall?: boolean }

// 哈利波特：圆框眼镜 + 额前闪电疤痕（hx,hy 为 8x8 头部左上角）
function drawWizardGlasses(g: G, hx: number, hy: number) {
  const c = '#33303c';
  // 左镜框（围绕左眼）
  R(g, hx + 1, hy + 3, 3, 1, c);
  R(g, hx + 1, hy + 5, 3, 1, c);
  R(g, hx + 1, hy + 4, 1, 1, c);
  R(g, hx + 3, hy + 4, 1, 1, c);
  // 右镜框（围绕右眼）
  R(g, hx + 4, hy + 3, 3, 1, c);
  R(g, hx + 4, hy + 5, 3, 1, c);
  R(g, hx + 6, hy + 4, 1, 1, c);
  // 额前闪电疤痕
  R(g, hx + 3, hy + 1, 1, 1, '#c23a2c');
}

// 巫师袍：姿势画完后披在身体外侧
function drawRobe(g: G, x: number, fy: number) {
  R(g, x - 9, fy - 20, 18, 2, '#1a1826'); // 肩部
  R(g, x - 10, fy - 18, 3, 18, '#1a1826'); // 左袍摆
  R(g, x + 7, fy - 18, 3, 18, '#1a1826'); // 右袍摆
  R(g, x - 10, fy - 2, 3, 1, '#35304a'); // 袍摆高光
  R(g, x + 7, fy - 2, 3, 1, '#35304a');
}

// 角色总入口
function drawCharacter(g: G, cx: number, fy: number, rng: Rng, sprite: string, pose: string, opts: CharOpts = {}) {
  const s = pickStyle(rng, sprite);
  // 名人 / 国家队配色覆盖（统一入口，避免各姿势内硬编码）
  const name = opts.name?.toLowerCase() || '';
  if (name.includes('harry')) { s.shirt = '#f4f6f8'; s.shirtD = '#c2ccd8'; s.pants = '#2650a8'; }
  if (name.includes('brunson')) { s.shirt = '#2a5ec8'; s.shirtD = '#1c449a'; s.pants = '#2f4a8a'; s.skin = '#8d5a3b'; }
  if (opts.team?.toLowerCase().includes('england')) { s.shirt = '#f4f6f8'; s.shirtD = '#c2ccd8'; s.pants = '#2650a8'; }
  // 同伴不自动带球：球类 sprite 降级为普通男孩（配色仍保留上方覆盖结果）
  const dSprite = opts.noBall && (sprite === 'basketball' || sprite === 'soccer') ? 'boy' : sprite;
  switch (pose) {
    case 'breakdance':
      poseBreakdance(g, cx, fy, s, dSprite); break;
    case 'explore':
      poseExplore(g, cx, fy, s, dSprite); break;
    case 'firefight':
      poseFirefight(g, cx, fy, s, dSprite); break;
    case 'dance':
      poseDance(g, cx, fy, s, dSprite); break;
    case 'run':
      poseRun(g, cx, fy, s, dSprite); break;
    case 'soccer_shoot':
      poseSoccerShoot(g, cx, fy, s, dSprite); break;
    case 'basketball_shoot':
      poseBasketballShoot(g, cx, fy, s, dSprite); break;
    case 'basketball':
      poseStand(g, cx, fy, s, dSprite, 'basketball'); break;
    case 'soccer':
      poseStand(g, cx, fy, s, dSprite, 'soccer'); break;
    case 'sing':
      poseStand(g, cx, fy, s, dSprite);
      drawMusicNote(g, cx + 13, fy - 28);
      break;
    case 'read':
      poseStand(g, cx, fy, s, dSprite);
      R(g, cx + 6, fy - 15, 7, 5, '#c84a4a');
      R(g, cx + 9, fy - 15, 1, 5, '#f2e0d0');
      break;
    default:
      poseStand(g, cx, fy, s, dSprite);
  }
  // 哈利波特身份配件（倒立街舞姿势除外）
  if (name.includes('harry') && pose !== 'breakdance') {
    const hy = pose === 'basketball_shoot' ? fy - 32 : pose === 'run' ? fy - 28 : fy - 29;
    drawWizardGlasses(g, cx - 4, hy);
    drawRobe(g, cx, fy);
  }
}

// ---------- 食物/小道具 ----------
function drawBurger(g: G, x: number, y: number) {
  R(g, x, y, 8, 2, '#e8b05a');
  R(g, x, y + 2, 8, 1, '#6ac84a');
  R(g, x, y + 3, 8, 2, '#7a4226');
  R(g, x, y + 5, 8, 1, '#d8a04a');
}
function drawFries(g: G, x: number, y: number) {
  R(g, x - 1, y, 8, 2, '#ffd24a');
  R(g, x, y + 2, 6, 6, '#d53a2c');
  R(g, x + 2, y + 1, 1, 7, '#e8c860');
}
function drawCola(g: G, x: number, y: number) {
  R(g, x, y + 2, 6, 7, '#7a3a22');
  R(g, x - 1, y, 8, 2, '#e8e0d0');
  R(g, x + 3, y - 3, 1, 4, '#e8e0d0');
}

// 故事场景总绘制
function drawStoryScene(g: G, rng: Rng, scene: ParsedScene) {
  const theme = scene.locations[0]?.theme;
  // 户外街道走独立背景，其余画室内外壳
  if (theme === 'cyberpunk') drawStreetScene(g, true);
  else if (theme === 'street') drawStreetScene(g, false);
  else {
    const pal = (theme && STORY_PAL[theme]) || STORY_PAL_DEFAULT;
    drawShell(g, pal);
    if (theme === 'mcdonald') drawFastFood(g, 'mcdonald');
    else if (theme === 'kfc') drawFastFood(g, 'kfc');
    else if (theme === 'court') drawCourt(g);
    else if (theme === 'jungle') drawJungle(g);
    else if (theme === 'robotfactory') drawRobotFactory(g);
    else drawOpenRoom(g);
  }

  // 火灾特效：画在角色之前，让角色站在火前救火
  if (scene.effects.some((f) => f.effect === 'fire')) drawFireEffect(g);

  const sprite = scene.identity?.sprite || 'kid';
  const pose = scene.actions[0]?.pose || 'standing';
  // 有同伴时主角左移，给同伴让出位置
  const cx = scene.companions.length > 0 ? 100 : 120;
  if (scene.hasPerson) {
    drawCharacter(g, cx, FLOOR_Y, rng, sprite, pose, { name: scene.subjectName, team: scene.teams[0] });
    // 同伴角色：排在主角右侧
    scene.companions.forEach((c, i) => {
      drawCharacter(g, 172 + i * 24, FLOOR_Y, rng, c.sprite || 'boy', 'standing', { name: c.name, noBall: true });
    });
  }

  // 魔法星光：围绕主角触球点
  if (scene.effects.some((f) => f.effect === 'magic')) {
    let mx = cx + 12, my = FLOOR_Y - 10;
    if (pose === 'soccer_shoot') { mx = cx + 16; my = FLOOR_Y - 11; }
    else if (pose === 'basketball_shoot') { mx = cx; my = FLOOR_Y - 37; }
    drawMagicSparkles(g, mx, my);
  }

  // 物品道具（与身份/动作重复的球跳过；最多摆 2 件）
  const poseSet = new Set(scene.actions.map((a) => a.pose));
  const holdsBasketball = sprite === 'basketball' || poseSet.has('basketball') || poseSet.has('basketball_shoot');
  const holdsSoccer = sprite === 'soccer' || poseSet.has('soccer') || poseSet.has('soccer_shoot');
  const isFastFood = theme === 'mcdonald' || theme === 'kfc';
  // 有同伴时道具摆到主角左侧，避免与同伴重叠
  const propBaseX = scene.companions.length > 0 ? 44 : 168;
  let foodSlot = 0;
  let floorSlot = 0;
  for (const o of scene.objects) {
    const key = o.object;
    if ((key === 'basketball' && holdsBasketball) ||
      (key === 'soccer' && holdsSoccer)) continue;
    if (isFastFood && (key === 'burger' || key === 'fries' || key === 'cola')) {
      if (foodSlot >= 3) continue;
      const fx = 162 + foodSlot * 18;
      if (key === 'burger') drawBurger(g, fx, 56);
      if (key === 'fries') drawFries(g, fx + 1, 54);
      if (key === 'cola') drawCola(g, fx + 1, 53);
      foodSlot += 1;
    } else if (key === 'basketball' || key === 'soccer') {
      if (floorSlot >= 1) continue;
      drawBall(g, isFastFood ? 58 : propBaseX + 2, FLOOR_Y - 4, key);
      floorSlot += 1;
    } else {
      if (floorSlot >= 2) continue;
      const px = isFastFood ? 58 : propBaseX;
      if (key === 'books') {
        R(g, px, FLOOR_Y - 4, 8, 2, '#c84a4a');
        R(g, px + 1, FLOOR_Y - 6, 6, 2, '#4a7ac8');
      } else if (key === 'robot') {
        R(g, px, FLOOR_Y - 8, 8, 8, '#9aa6b2');
        R(g, px + 2, FLOOR_Y - 6, 1, 2, '#3a4252');
        R(g, px + 5, FLOOR_Y - 6, 1, 2, '#3a4252');
        R(g, px + 3, FLOOR_Y - 10, 1, 2, '#9aa6b2');
      } else if (key === 'console') {
        R(g, px, FLOOR_Y - 4, 10, 4, '#5f6b76');
        R(g, px + 2, FLOOR_Y - 3, 4, 2, '#8fd0e8');
      } else if (key === 'cake') {
        R(g, px, FLOOR_Y - 4, 8, 4, '#f2e0d0');
        R(g, px, FLOOR_Y - 4, 8, 1, '#e88ac8');
        R(g, px + 3, FLOOR_Y - 6, 1, 2, '#ffd24a');
      }
      floorSlot += 1;
    }
  }
}

// ---------- 房间外壳 ----------
function drawShell(g: G, p: Palette) {
  R(g, 0, 0, W, H, p.wall);
  R(g, 0, 0, W, CEIL, p.ceil);
  R(g, 0, CEIL - 2, W, 2, p.ceilD);
  R(g, 0, FLOOR_Y - 20, W, 20, p.wain); // 护墙板
  R(g, 0, FLOOR_Y - 20, W, 2, p.wainD);
  R(g, 0, FLOOR_Y - 3, W, 3, p.trim);   // 踢脚线
  R(g, 0, FLOOR_Y, W, H - FLOOR_Y, p.floor);
  for (let x = 0; x < W; x += 30) R(g, x, FLOOR_Y + 8, 1, H - FLOOR_Y - 8, p.floorD);
  R(g, 0, FLOOR_Y + 20, W, 1, p.floorD);
}

// ---------- 主入口 ----------
export function generateProceduralRoom(keywords: string[], level: number): string {
  const list = (Array.isArray(keywords) ? keywords.filter(Boolean) : []) as string[];
  const seed = hashString(`${list.join('|')}#${level}`);
  const rng = mulberry32(seed);

  // 逻辑低分辨率画布
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas unavailable');
  g.imageSmoothingEnabled = false;

  // 先做整句语义解析：含人物/已知地点 → 故事场景；否则走主题/默认房间
  const parsed = parseScene(list.join(' '));
  const storyTheme = parsed.locations[0]?.theme;
  if (parsed.hasPerson || storyTheme) {
    drawStoryScene(g, rng, parsed);
  } else {
    const first = list[0];
    const def = first ? THEMES[first] : undefined;

    if (def) {
      drawShell(g, def.pal);
      def.draw(g, rng);
      // 额外关键词：作为纪念摆件摆到搁板上
      const extras = list.slice(1, 3);
      if (extras.length > 0) {
        // 墙面搁板
        R(g, 14, 84, 20 + extras.length * 30, 2, '#7a5630');
        extras.forEach((k, i) => {
          const ed = THEMES[k];
          if (ed) ed.icon(g, 20 + i * 30, 84);
        });
      }
    } else {
      defaultRoom(g, rng);
    }
  }

  // 最近邻放大到 800x450
  const out = document.createElement('canvas');
  out.width = 800;
  out.height = 450;
  const og = out.getContext('2d');
  if (!og) throw new Error('canvas unavailable');
  og.imageSmoothingEnabled = false;
  og.drawImage(canvas, 0, 0, 800, 450);
  return out.toDataURL('image/jpeg', 0.9);
}
