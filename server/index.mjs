import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = express();
app.use(cors());
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ limit: '6mb', extended: false }));

const PORT = process.env.PORT || 3101;

const SILICONFLOW_KEY = process.env.SILICONFLOW_API_KEY || '';
const ZHIPU_KEY = process.env.ZHIPU_API_KEY || '';
const SF_BASE = 'https://api.siliconflow.cn/v1';
const ZHIPU_BASE = 'https://open.bigmodel.cn/api/paas/v4';

const SF_IMAGE_MODEL = 'Tongyi-MAI/Z-Image-Turbo';  // 通义 Z-Image：提示词遵循强、3-4秒出图
const SF_IMAGE_MODEL_FALLBACK = 'Qwen/Qwen-Image';   // Qwen-Image 兜底：语义细腻
const SF_TEXT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';   // 硅基流动免费文本
const ZHIPU_IMAGE_MODEL = 'cogview-3-flash';        // 智谱免费文生图
const ZHIPU_TEXT_MODEL = 'glm-4-flash';             // 智谱免费文本

// ---------- 工具 ----------

function fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// 按文件头魔数嗅探真实图片类型（CDN 可能返回 octet-stream）
function sniffImageMime(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return 'image/png';
}

async function urlToDataUrl(url) {
  const res = await fetchWithTimeout(url, { timeout: 60000 }, 90000);
  if (!res.ok) throw new Error(`下载图片失败: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${sniffImageMime(buffer)};base64,${buffer.toString('base64')}`;
}

// 楼层图专用：下载后强制像素化，统一像素颗粒感
async function urlToPixelatedDataUrl(url, outW, outH, gridW) {
  const res = await fetchWithTimeout(url, { timeout: 60000 }, 90000);
  if (!res.ok) throw new Error(`下载图片失败: HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  const buf = await pixelateBuffer(raw, outW, outH, gridW);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

// 像素化后处理：nearest-neighbor 降采样再放大，强制 16-bit 像素颗粒感
// gridW：横向像素块数量；人物场景用更细的网格（320），保证脸和肢体可辨认
async function pixelateBuffer(buffer, outW, outH, gridW = 224) {
  const small = await sharp(buffer)
    .resize(gridW, null, { kernel: 'nearest', fit: 'inside' })
    .modulate({ saturation: 1.25, brightness: 1.03 })
    .toBuffer();
  return sharp(small)
    .resize(outW, outH, { kernel: 'nearest', fit: 'fill' })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function isRateLimitError(err) {
  const s = String(err && (err.message || err)).toLowerCase();
  return s.includes('429') || s.includes('rate') || s.includes('quota') || s.includes('exhausted') || s.includes('1302');
}

function isAuthError(err) {
  const s = String(err && (err.message || err)).toLowerCase();
  return s.includes('401') || s.includes('403') || s.includes('unauthorized') || s.includes('api key') || s.includes('token');
}

// ---------- 图片尺寸映射 ----------

const SF_SIZES = { '16:9': '1024x576', '9:16': '576x1024' };
const ZHIPU_SIZES = { '16:9': '1344x768', '9:16': '768x1344' };
const P_N_SIZE = { '16:9': [1024, 576], '9:16': [576, 1024] };

// ---------- 文生图 Provider ----------

async function genImageSiliconFlow(prompt, aspect, negative, pixelate, gridW, model = SF_IMAGE_MODEL) {
  const size = SF_SIZES[aspect] || '1024x1024';
  // 随机 seed：让同一 prompt 重新生成时画面构图/细节有显著差异
  const seed = Math.floor(Math.random() * 1000000000);
  const payload = { model, prompt, image_size: size, batch_size: 1, seed };
  if (negative) payload.negative_prompt = negative;
  const res = await fetchWithTimeout(`${SF_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SILICONFLOW_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SiliconFlow HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('SiliconFlow 未返回图片');
  return pixelate ? urlToPixelatedDataUrl(url, ...size.split('x').map(Number), gridW) : urlToDataUrl(url);
}

async function genImageZhipu(prompt, aspect, _negative, pixelate, gridW) {
  const size = ZHIPU_SIZES[aspect] || '1024x1024';
  const res = await fetchWithTimeout(`${ZHIPU_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ZHIPU_KEY}` },
    body: JSON.stringify({ model: ZHIPU_IMAGE_MODEL, prompt, size }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zhipu HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const url = data?.data?.[0]?.url;
  if (!url) throw new Error('Zhipu 未返回图片');
  return pixelate ? urlToPixelatedDataUrl(url, ...size.split('x').map(Number), gridW) : urlToDataUrl(url);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genImagePollinations(prompt, aspect, negative, pixelate, gridW) {
  const [w, h] = P_N_SIZE[aspect] || [1024, 1024];
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const seed = Math.floor(Math.random() * 1e9);
      // enhance=false：禁止 LLM 改写提示词；匿名层实际后端为 sana
      let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1800))}?width=${w}&height=${h}&seed=${seed}&nologo=true&enhance=false&private=true&model=sana`;
      if (negative) url += `&negative_prompt=${encodeURIComponent(negative)}`;

      const res = await fetchWithTimeout(url, {}, 120000);
      if (!res.ok) throw new Error(`下载图片失败: HTTP ${res.status}`);
      let buf = Buffer.from(await res.arrayBuffer());
      if (pixelate) buf = await pixelateBuffer(buf, w, h, gridW);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch (err) {
      lastErr = err;
      console.error(`[image:pollinations] 第 ${attempt + 1} 次尝试失败:`, err.message);
      if (attempt < 2) await sleep(3000);
    }
  }
  throw lastErr;
}

// ---------- 文本生成 Provider ----------

async function chatSiliconFlow(prompt) {
  const res = await fetchWithTimeout(`${SF_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SILICONFLOW_KEY}` },
    body: JSON.stringify({
      model: SF_TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.9,
    }),
  }, 60000);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SiliconFlow HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function chatZhipu(prompt) {
  const res = await fetchWithTimeout(`${ZHIPU_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ZHIPU_KEY}` },
    body: JSON.stringify({
      model: ZHIPU_TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.9,
    }),
  }, 60000);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zhipu HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ---------- Prompt 构造 ----------

// 普通楼层负向提示词（无人物时使用）
const FLOOR_NEGATIVE_PROMPT = [
  'crowd', 'extra people', 'more than necessary people',
  'duplicate character', 'multiple copies of the same character', 'repeated character', 'cloned character',
  'photo', 'realistic', '3d render', 'anime', 'ghibli',
  'landscape', 'outdoors', 'mountain',
  'empty room', 'corridor', 'hallway', 'room corner',
  'close-up', 'character close-up', 'giant character dominating the frame', 'portrait shot',
  'thick outer frame', 'picture frame', 'diorama box frame', 'wooden frame border',
  'building exterior view', 'city skyline background', 'view from outside the building',
  'three quarter view', 'tilted perspective', 'dutch angle', 'low angle',
  'cropped', 'cut off', 'cut off at the edge', 'head cut off', 'feet cut off', 'logo cut off', 'out of frame',
  'blurry', 'text', 'watermark', 'frame border',
].join(', ');

// 人物楼层负向提示词：允许动态姿势的各种朝向，只压制多余人物、方脑袋与畸形
const FLOOR_CHARACTER_NEGATIVE_PROMPT = [
  'crowd', 'group', 'extra people', 'more than one person', 'multiple characters', 'duplicate person',
  'multiple snoopy', 'two dogs', 'duplicate animal', 'copy of the character', 'duplicate character',
  'cube-shaped head', 'square box head', 'robot mascot head', 'TV-shaped head', 'cube head character',
  'portrait shot', 'face close-up', 'head-only shot',
  'hidden face', 'faceless', 'turned away',
  'person only in a wall picture', 'character as a poster', 'tiny figure in a frame',
  'photo frame with person', 'doll', 'sticker of person',
  'deformed', 'disfigured', 'mutation', 'mutated',
  'extra limbs', 'missing limbs', 'extra fingers', 'missing fingers', 'fused fingers', 'malformed hands',
  'bad anatomy', 'bad proportions',
  'cropped head', 'out of frame', 'cut off', 'cut off at the edge', 'edge cut',
  'blurry face',
  'bangs covering eyes', 'hair in face',
  'name text', 'letters on wall', 'garbled letters', 'word art',
  'photo', 'realistic', '3d render', 'anime', 'ghibli',
  'text', 'watermark', 'frame border',
].join(', ');

// 多人物场景需移除的「人数限制」负向词（避免与「画面中恰好2人」自相矛盾）
const PERSON_COUNT_NEG = new Set([
  'crowd', 'group', 'extra people', 'more than one person', 'multiple characters', 'duplicate person',
]);

// 中文人物词 -> 英文（检测 + 翻译；匹配时长词优先）
const CN_PERSON_WORDS = {
  '小男孩': 'a little boy', '小女孩': 'a little girl',
  '男孩': 'a boy', '男生': 'a boy',
  '女孩': 'a girl', '女生': 'a girl',
  '男人': 'a man', '男士': 'a man', '女人': 'a woman', '女士': 'a lady',
  '宝宝': 'a baby', '婴儿': 'a baby', '孩子们': 'kids', '孩子': 'a kid', '小孩': 'a kid', '儿童': 'a child',
  '少年': 'a teenage boy', '少女': 'a teenage girl',
  '公主': 'a princess', '王子': 'a prince', '国王': 'a king', '女王': 'a queen',
  '巫师': 'a wizard', '魔法师': 'a wizard', '女巫': 'a witch', '骑士': 'a knight',
  '宇航员': 'an astronaut', '太空人': 'an astronaut', '海盗': 'a pirate', '忍者': 'a ninja',
  '英雄': 'a hero', '老师': 'a teacher', '学生': 'a student',
  '医生': 'a doctor', '护士': 'a nurse', '厨师': 'a chef', '小丑': 'a clown',
  '精灵': 'an elf', '僵尸': 'a zombie', '吸血鬼': 'a vampire', '外星人': 'an alien',
  '人物': 'a person', '角色': 'a character',
};

// 英文人物词
const EN_PERSON_RE = /\b(boy|boys|girl|girls|kid|kids|child|children|man|men|woman|women|person|people|human|humans|guy|guys|lady|ladies|baby|babies|teen|teens|teenager|student|students|teacher|wizard|witch|knight|astronaut|pirate|ninja|princess|prince|king|queen|hero|heroes|farmer|doctor|nurse|chef|clown|fairy|elf|elves|dwarf|viking|cowboy|samurai|soldier|sailor|pilot|detective|vampire|zombie|alien)\b/i;

// 常见场景/物品词：命中这些的单个英文单词不算人名
const EN_COMMON_WORDS = new Set([
  'room','bedroom','bathroom','kitchen','hall','hallway','corridor','lab','laboratory','library','bookshop','shop','store','market','arcade',
  'space','spaceship','castle','fortress','factory','plant','plants','garden','greenhouse','ocean','sea','underwater','water',
  'forest','jungle','pizza','pizzeria','candy','tower','station','workshop','chamber','palace','mansion','house','home',
  'restaurant','cafe','cafeteria','bakery','school','classroom','office','gym','pool','beach','park','zoo','farm','mine','cave','dungeon',
  'observatory','hotel','hospital','clinic','playground','yard','garage','barn','camp','tent','island','volcano','mountain',
  'city','town','village','street','road','bridge','airport','harbor','port','subway','train','rocket','ship','boat','car','truck','bus','plane',
  'tree','trees','flower','flowers','rain','snow','sun','moon','star','stars','sky','night','day','magic','magical',
  'cyberpunk','steampunk','medieval','haunted','ghost','ghosts','robot','robots','robotic','machine','machines','ice','frozen',
  'candyland','food','cake','bread','fruit','fish','bird','cat','dog','pet','pets','animal','animals',
  'toy','toys','game','games','gaming','computer','music','art','sports','soccer','basketball','football','baseball','tennis','swimming',
  'reading','drawing','painting','cooking','baking','dancing','singing','desk','table','chair','bed','shelf','shelves','book','books',
  'door','window','wall','floor','clock','lamp','rug','picture','poster','box','chest','barrel','tank','tube','flask','beaker',
  'screen','monitor','console','cabinet','counter','oven','stove','piano','drum','guitar','ball','sword','shield','crown','hat',
  'cup','plate','bottle','potion','crystal','gem','rune','scroll','map','flag','torch','candle','gear','pipe','valve','gauge','chain','rope',
]);

const capName = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// 内置中文主题 -> 英文场景描述（Kolors 对英文提示词遵循度远好于中文）
const THEME_EN = {
  '赛博朋克': 'cyberpunk apartment, neon holograms, glowing screens and futuristic gadgets',
  '糖果乐园': 'candy land sweet shop, giant lollipops, candy canes, gummy bears and frosting',
  '蒸汽朋克': 'steampunk workshop, brass gears, copper pipes, gauges and pressure valves',
  '海底世界': 'underwater ocean observation room, round porthole windows with fish outside, coral decorations',
  '太空站': 'space station interior, blinking control panels, monitors, zero-gravity tools',
  '丛林探险': 'jungle treehouse explorer room, hanging vines, wooden crates, maps and binoculars',
  '中世纪城堡': 'medieval castle chamber, rough stone walls, wall torches, a treasure chest',
  '街机游戏厅': 'retro arcade hall, rows of glowing arcade cabinets, neon signs, pixel posters',
  '幽灵鬼屋': 'haunted house room, cobwebs, dusty candelabra, creaky furniture, eerie green glow',
  '冰雪宫殿': 'ice palace room, frozen crystal throne, icicles, sparkling frost',
  '机器人工厂': 'robot factory floor, conveyor belts, mechanical arms, friendly dormant robots, sparks',
  '魔法图书馆': 'magical wizard library, tall bookshelves, floating glowing books, runes, a desk with scrolls',
  '温室花园': 'greenhouse garden room, lush potted plants, flowers, watering cans, glass roof',
  '披萨店': 'pizzeria kitchen, brick pizza oven, stretched dough, cheese and basil on counters',
  '科学实验室': 'science laboratory with many lab tables, rows of glass beakers and flasks, bubbling glowing chemical tubes, microscopes, test tube racks, chalkboard with formulas',
};

// 在非内置主题的关键词中识别人物词与人名（如 a boy、Brunson、Brunson's room）
function detectPerson(rawKeywords) {
  const names = [];
  const descriptors = [];
  for (const raw of rawKeywords) {
    let kw = String(raw || '').trim();
    if (!kw || THEME_EN[kw]) continue; // 内置主题已知不依赖人物
    // 中文人物词（长词优先），命中后从文本中剔除，避免干扰后续检测
    for (const cn of Object.keys(CN_PERSON_WORDS).sort((a, b) => b.length - a.length)) {
      if (kw.includes(cn)) {
        descriptors.push(CN_PERSON_WORDS[cn]);
        kw = kw.split(cn).join(' ');
      }
    }
    // 英文人物词
    const m = kw.match(EN_PERSON_RE);
    if (m) descriptors.push(m[0].toLowerCase());
    // 人名：X's 结构
    const poss = kw.match(/([A-Za-z][a-z]+)'s\b/);
    if (poss) names.push(capName(poss[1]));
    const tokens = kw.match(/[A-Za-z]+/g) || [];
    // 人名：短语中非句首位置的大写词
    tokens.forEach((t, i) => {
      if (i > 0 && /^[A-Z][a-z]+$/.test(t) && !EN_COMMON_WORDS.has(t.toLowerCase())) names.push(t);
    });
    // 人名：单个陌生英文单词（如 brunson）视为角色名
    if (tokens.length === 1 && /^[A-Za-z]{3,}$/.test(tokens[0])) {
      const t = tokens[0].toLowerCase();
      if (!EN_COMMON_WORDS.has(t) && !EN_PERSON_RE.test(t)) names.push(capName(tokens[0]));
    }
  }
  return {
    hasPerson: names.length > 0 || descriptors.length > 0,
    names: Array.from(new Set(names)),
    descriptors: Array.from(new Set(descriptors)),
  };
}

function buildFloorPrompt(keywords, level) {
  const list = (Array.isArray(keywords) ? keywords.filter(Boolean) : []);
  const person = detectPerson(list);

  // 场景行：内置主题直接用英文；自定义关键词剔除人名/人物词，避免模型把名字拼成文字
  const cnKeys = Object.keys(CN_PERSON_WORDS).sort((a, b) => b.length - a.length);
  const sceneParts = list.map((k) => {
    if (THEME_EN[k]) return THEME_EN[k];
    let s = String(k);
    for (const cn of cnKeys) s = s.split(cn).join(' ');
    for (const n of person.names) s = s.split(n).join(' ');
    s = s.replace(EN_PERSON_RE, ' ');
    s = s.replace(/[^A-Za-z0-9]+/g, ' ').trim(); // 去掉残留中文与标点
    return s;
  }).filter(Boolean);
  const sceneLine = sceneParts.join(', ') || 'cozy kids room with toys';

  const styleLine = 'inside one single room interior, 16-bit retro pixel art 2D side-scrolling game background';
  const fillLine = 'Densely filled with furniture, equipment and props, rich detail, objects arranged along the back wall';
  const flatLine = 'Flat 2D side-scrolling perspective, clear horizontal floor and ceiling bands, room interior spans the entire frame';
  const colorLine = 'Vibrant saturated blocky colors, crisp chunky pixels, Terraria and Fallout Shelter art style';
  const cutawayLine = 'Cutaway side-view cross-section of a single floor, showing floor, back wall and ceiling, with a sense of depth';
  const safeLine = 'All characters, logos, signs and key objects are fully inside the frame, not cropped or cut off at the edges';

  const hasSign = list.some((k) => k.toLowerCase().includes('sign'));

  if (!person.hasPerson) {
    const prompt = `${sceneLine}, ${styleLine}. ${fillLine}. ${flatLine}. ${cutawayLine}. ${safeLine}. ${colorLine}. No people, no animals, ${hasSign ? 'no extra text except on signs' : 'no text'}, no outdoors.`;
    return { prompt, hasPerson: false, hasSign };
  }

  // 人物模式：明确要求全身、正面、脸清晰、四肢完整，负向词同步切换
  const who = person.names.length > 0
    ? person.names.map((n) => `a friendly kid named ${n}`).join(' and ')
    : (person.descriptors[0] || 'a kid');
  const charLine = `One cute 16-bit pixel-art character, ${who}, in clear 2D side-view profile facing right, ` +
    'large in the frame and standing on the floor in the left third of the room, full body visible from head to toe and not cut off, ' +
    'side-profile face with one clear eye and a friendly smile, neat hair, ' +
    'correctly proportioned body with two arms and two legs, clean blocky silhouette like a playable Terraria hero';

  // 角色描述置于最前：模型对开头词权重最高，避免角色被省略或缩成画框小图
  const prompt = `${charLine}. The character is inside ${sceneLine}, ${styleLine}. ${fillLine}. ${flatLine}. ${cutawayLine}. ${safeLine}. ${colorLine}. ` +
    `Exactly one character, no other people, ${hasSign ? 'no extra text except on signs' : 'no text, no name letters anywhere'}, no outdoors.`;
  return { prompt, hasPerson: true, hasSign };
}

// 自定义整句楼层（如「一个篮球运动员在麦当劳里跳街舞」）：
// 新模型（Z-Image/Qwen-Image）中文理解极强 → 直接用原句，再按解析结果补充画面细节
// 角色外貌（中文细节提示），重点保证「圆脑袋、正常比例、四肢完整」
const SPRITE_HINTS = {
  catwarrior: '拟人化的猫咪战士：长着圆脸猫耳的橘猫脑袋、人类身形，身披铠甲、手持短剑，身后有尾巴',
  basketball: '高个子男性篮球运动员：人类圆脑袋、短发戴红发带，穿橙色球衣球裤，身形修长',
  soccer: '足球运动员：人类圆脑袋，穿绿色球衣',
  athlete: '运动员：人类圆脑袋，穿运动服',
  robot: '金属机器人：带小天线的金属头、圆形发光眼睛，金属机械身体（头不是方块电视机）',
  robotfire: '金属机器人：带小天线的金属头、圆形发光眼睛，金属机械身体',
  firefighter: '消防员：人类圆脑袋，穿消防服',
  astronaut: '宇航员：人类圆脑袋，穿白色宇航服、戴圆形头盔',
  wizard: '魔法师：人类圆脑袋，穿紫色长袍',
  knight: '骑士：人类圆脑袋，穿银色铠甲',
  pirate: '海盗：人类圆脑袋，戴红色头巾',
  ninja: '忍者：人类圆脑袋，深色蒙面装束',
  princess: '公主：人类圆脑袋，粉色长裙小皇冠',
  prince: '王子：人类圆脑袋，蓝色王储装束',
  king: '国王：人类圆脑袋，金色王冠',
  queen: '女王：人类圆脑袋，金色王冠',
  hero: '超级英雄：人类圆脑袋，彩色披风',
  cat: '拟人化的小猫：圆脸猫耳，直立身形，身后有尾巴',
  warrior: '战士：人类圆脑袋，披甲持剑',
  boy: '小男孩：人类圆脑袋、短发，活泼可爱',
  kid: '小朋友：人类圆脑袋、短发',
};
const DEFAULT_SPRITE_HINT = '小朋友：人类圆脑袋、正常身体比例、双臂双腿完整';

// 名人/虚构主角外貌（主语名字命中时替代通用身份提示）
const NAME_HINTS = {
  'harry porter': '戴圆框眼镜、额头有闪电形小疤痕的男孩，身披巫师袍、手持魔杖，巫师袍外再套上足球队服',
  'harry potter': '戴圆框眼镜、额头有闪电形小疤痕的男孩，身披巫师袍、手持魔杖，巫师袍外再套上足球队服',
  brunson: '成年男性篮球运动员布伦森：人类圆脑袋、短发，穿纽约尼克斯队蓝橙配色球衣，正在防守',
  snoopy: '史努比：一只黑白配色、长耳朵的狗，正用两只后腿站立',
};

// 国家队队服提示
const TEAM_HINTS = {
  england: '身穿英格兰足球队队服：白色球衣、蓝色球裤',
};

// 动作姿势（中文细节提示）
const POSE_HINTS = {
  breakdance: '正在跳街舞：单手撑地的霹雳舞定格动作，另一只手弯曲，双腿有力地分开抬起，动感十足',
  explore: '正在探险：迈步行走、举起短剑，神情警觉又开心',
  firefight: '正在救火：双手紧握高压水枪，强劲水柱喷向火焰',
  soccer_shoot: '正在抬脚大力射门：一条腿用力踢向足球，身体后倾、双臂张开保持平衡',
  basketball_shoot: '正在跳起投篮：双手把篮球推向空中，双腿弯曲起跳',
  shoot: '正在用力把球投出或踢出',
  basketball: '正在运球打篮球',
  soccer: '正在踢足球',
  dance: '正在跳舞：双手举起、身体微弹',
  run: '正在跑步：身体前倾、大步迈开',
  sing: '正在唱歌：张嘴微笑',
  read: '正捧着打开的书阅读',
  draw: '正在画画',
  cook: '正在做饭',
  eat: '正在吃东西',
  sleep: '正在睡觉',
  fly: '正在飞翔：双臂张开',
};

// 环境特效
const EFFECT_HINTS = {
  fire: '场景起火：橙红色火焰、火星和浓烟四处蔓延，火光照亮整个场景，气氛紧张',
  magic: '魔法特效：魔杖或指尖迸发出金色魔法光芒，环绕彩色星光与闪烁光点，足球被魔法光环和星光包裹，充满奇幻感',
};

// 地点细节（强调室内/室外，纠正模型画成门店外观）
const THEME_HINTS = {
  mcdonald: '场景在麦当劳餐厅室内：金色拱门标志、红白配色、点餐台、菜单牌、卡座和餐桌',
  kfc: '场景在肯德基餐厅室内：红白配色、点餐台、菜单牌和卡座',
  jungle: '场景在热带丛林：参天大树、缠绕的藤蔓、蕨类植物和林间小径',
  robotfactory: '场景在机器人工厂：传送带、机械臂、操作台、机器和仪表盘',
  court: '场景在篮球场：木质地板、场地线和篮筐',
  gym: '场景在体育馆室内：高高的空间和观众席',
  restaurant: '场景在餐厅室内：餐桌椅和菜单牌',
  school: '场景在学校教室：课桌椅和黑板',
  home: '场景在家里客厅：沙发、茶几和地毯',
  bedroom: '场景在卧室：小床和衣柜',
  kitchen: '场景在厨房：灶台、橱柜和厨具',
  castle: '场景在中世纪城堡大厅：石墙、火把和宝箱',
  library: '场景在图书馆：高大的书架和书桌',
  shop: '场景在小商店里：货架和柜台',
  cyberpunk: '场景在夜晚的赛博朋克街道：霓虹招牌发出粉色和青色光芒，两侧高楼大厦，湿润路面反射霓虹灯光，全息广告牌与雾气',
  street: '场景在城市街道：两旁建筑、人行道和路灯',
  venus: '场景在金星实验室：橙黄色炽热天空、火山地表、高温雾气弥漫的科研室内，窗外可见滚烫的岩石地貌',
  underwater: '场景在海底世界：蓝色海水、珊瑚礁、水草随波摆动、沙地、气泡和游鱼',
  amusement_park: '场景在游乐园：摩天轮、过山车轨道、彩色帐篷、气球和旋转木马',
  laboratory: '场景在科学实验室：实验台、烧杯试管、显微镜、显示屏和白板',
};

// 物品（中文）
const OBJECT_HINTS = {
  burger: '一个汉堡包', fries: '一包薯条', cola: '一杯带吸管的可乐',
  cake: '一块奶油蛋糕', books: '一摞书', console: '一台掌上游戏机',
  basketball: '一个橙色篮球', soccer: '一个黑白足球',
  spaghetti: '一盘意大利面', sign: '一块招牌', balloon: '一个气球', cake_slice: '一块蛋糕',
};

function buildSentenceFloorPrompt(keywords) {
  const list = (Array.isArray(keywords) ? keywords.filter(Boolean) : []);
  const original = list.join('，');

  // 画面结构：楼层里的完整场景——室内呈现房间横切面，开阔环境呈现全景（模型按描述自行判断）
  const structureLine = '画面结构（最重要）：这是摩天大楼里某一层的完整场景。如果描述的是室内场所，呈现房间内部的正面横切面——能同时看到地板、天花板和后墙，有纵深感；如果描述的是开阔环境，则呈现开阔的场景全景——有清晰的地面或底部边界、远处的背景层次，同样有纵深感';
  // 场景优先：环境是主角，标志性元素必须出现
  const sceneLine = '场景优先（最重要）：场景环境和氛围是画面的主角，必须完整呈现描述中的地点场景及该场景的标志性元素，场景占据画面主要区域；人物和角色只是场景中的点缀，尺寸小巧，位于场景中下部，不要过大占据画面';
  // 角色完整：每个角色都出现且只出现一次，动作不混淆
  const charLine = '角色要求（重要）：描述中提到的每一个角色（包括怪兽、动物等非人类角色）都必须以独立形象出现在画面中，每个角色只出现一次，不要重复；每个角色做描述中指定给它自己的动作，不要把一个角色的动作安到另一个角色身上';
  // 构图：正面、横向拉满、无外框
  const layoutLine = '构图：正面平视视角，没有倾斜或透视变形；画面横向完全拉满填满整个画面，没有左右外框、边框或楼体外墙，画面内容就是场景本身，不是从楼外看楼的视角';
  // 防截断：头顶脚下留空隙
  const safeLine = '安全边界：所有内容完整位于画面内部——角色头顶上方和脚底下方都留有空隙不被截断，标志、招牌和关键物体完整不被画面边缘裁切';

  const styleLine = '风格：16位复古像素艺术，横版卷轴游戏场景，鲜艳饱和的色块，清晰像素颗粒，细节丰富';

  const prompt = `${original}\n${structureLine}\n${sceneLine}\n${charLine}\n${layoutLine}\n${safeLine}\n${styleLine}`;
  return { prompt, hasPerson: false, personCount: 0 };
}

const ATMOSPHERES = [
  '晴朗的白天，湛蓝天空',
  '柔和的阴天午后光线',
  '雨夜霓虹反射在湿润路面的赛博朋克氛围',
  '繁星点缀的夜晚，大楼灯光闪耀',
  '清晨薄雾与柔和粉彩色调的日出',
  '乌云密布的戏剧性午后',
  '金色时刻的温暖橙色日落',
];

function buildTowerPrompt(summary, floorCount, themes) {
  const uniqueThemes = Array.from(new Set(themes || [])).join('、');
  const atmosphere = ATMOSPHERES[Math.floor(Math.random() * ATMOSPHERES.length)];
  return [
    `一座${floorCount}层高的独特摩天大楼的超写实建筑摄影，8K画质，矗立在现代城市天际线中。`,
    `氛围与光线：${atmosphere}。`,
    `建筑风格与主题元素：${uniqueThemes || '现代主义'}。`,
    summary ? `建筑师点评参考：“${String(summary).slice(0, 200)}”。` : '',
    `细节要求：`,
    `- 大楼必须看起来像真实存在的实体建筑，而不是3D渲染或卡通；`,
    `- 使用真实的建筑材料：玻璃、钢铁、混凝土、砖块和抛光金属；`,
    `- 高细节纹理、真实阴影、环境光遮蔽和光线追踪反射；`,
    `- 周围城市轻微虚化（焦外成像），突出这座独特的大楼；`,
    `- 视角为从街道仰望或无人机航拍完整高度，竖构图。`,
  ].filter(Boolean).join('\n');
}

function buildSummaryPrompt(layers) {
  const floorDetails = layers
    .map((l) => `第${l.level}层：${(l.keywords || []).join('+') || l.description || '未知主题'}`)
    .join('\n');
  return [
    `你是一位为儿童像素建筑游戏写点评的欢乐建筑评论家。`,
    `请为用户搭建的大楼写一段庆祝性总结。`,
    ``,
    `大楼数据：`,
    `- 总楼层：${layers.length}`,
    `- 各层主题（从下到上）：`,
    floorDetails,
    ``,
    `严格输出格式：`,
    `第一行：NAME:（给大楼起一个有创意的酷炫中文名字，最多8个字，不要引号）`,
    `第二行：空行`,
    `第三行开始：庆祝性总结段落（最多80字，可以用emoji，语气欢快，面向小朋友）`,
    ``,
    `示例输出：`,
    `NAME: 星际糖果塔`,
    ``,
    `哇！这栋大楼直冲云霄！🚀 从披萨店一路建到太空站，太有想象力啦！`,
  ].join('\n');
}

// 本地兜底总结（无任何文本模型 Key 时使用）
function localSummary(layers) {
  const themes = layers.map((l) => (l.keywords || [])[0] || l.description || '神秘房间');
  const first = themes[0] || '奇妙';
  const top = themes[themes.length - 1] || '云端';
  const adjs = ['闪耀', '彩虹', '冲天', '梦幻', '闪闪发光', '无敌', '旋转', '糖果'];
  const adj = adjs[Math.floor(Math.random() * adjs.length)];
  const name = `${adj}${String(first).slice(0, 3)}塔`;
  const lines = [
    `哇！这栋${layers.length}层的大楼从${first}一路建到了${top}！`,
    `每一层都藏着小朋友的努力和想象力！继续加油，城市因你而闪耀！`,
  ];
  return `NAME: ${name}\n\n${lines.join('')}`;
}

// ---------- 路由 ----------

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    providers: { siliconflow: !!SILICONFLOW_KEY, zhipu: !!ZHIPU_KEY, pollinations: true },
    imageFallbackText: 'local',
  });
});

// 前端据此决定楼层图走 AI 还是本地程序化引擎
app.get('/api/config', (req, res) => {
  res.json({ hasImageKey: !!SILICONFLOW_KEY || !!ZHIPU_KEY });
});

app.post('/api/image', async (req, res) => {
  const { kind = 'floor', keywords = [], level = 1, summary = '', themes = [] } = req.body || {};
  const aspect = kind === 'tower' ? '9:16' : '16:9';

  // 楼层：像素房间提示词 + 负向提示词（人物/普通两套）；竣工照：写实建筑提示词
  let finalPrompt;
  let negative;
  let gridW;
  if (kind === 'tower') {
    finalPrompt = buildTowerPrompt(summary, level, themes);
    negative = undefined;
  } else {
    const floorList = (Array.isArray(keywords) ? keywords.filter(Boolean) : []);
    // 全部是内置主题 → 旧链路；含自定义整句 → 语义解析链路
    const allBuiltin = floorList.length > 0 && floorList.every((k) => THEME_EN[k]);
    const built = allBuiltin
      ? buildFloorPrompt(floorList, level)
      : buildSentenceFloorPrompt(floorList);
    finalPrompt = built.prompt;
    // 统一使用基础负向提示词（不再按人物/场景细分，避免误伤）
    negative = FLOOR_NEGATIVE_PROMPT;
    gridW = 448; // 统一高分辨率像素网格
  }

  const isFloor = kind === 'floor';
  const attempts = [];
  if (SILICONFLOW_KEY) {
    attempts.push(['siliconflow', () => genImageSiliconFlow(finalPrompt, aspect, negative, isFloor, gridW)]);
    // 楼层：主模型失败（限流/内容拒绝）时，换 Qwen-Image 重试
    if (isFloor) {
      attempts.push(['siliconflow-qwen', () => genImageSiliconFlow(finalPrompt, aspect, negative, isFloor, gridW, SF_IMAGE_MODEL_FALLBACK)]);
    }
  }
  if (ZHIPU_KEY) attempts.push(['zhipu', () => genImageZhipu(finalPrompt, aspect, negative, isFloor, gridW)]);
  // 楼层不再让免费弱模型 sana 兜底（复杂场景会产出无关垃圾图）；仅竣工照保留
  if (!isFloor) attempts.push(['pollinations', () => genImagePollinations(finalPrompt, aspect, negative, isFloor, gridW)]);

  let sawRateLimit = false;
  for (const [name, fn] of attempts) {
    try {
      const image = await fn();
      return res.json({ image, provider: name });
    } catch (err) {
      console.error(`[image:${name}]`, err.message || err);
      if (isRateLimitError(err)) sawRateLimit = true;
      // 认证错误跳到下一家；限流也跳到下一家
    }
  }

  res.status(sawRateLimit ? 429 : 502).json({ error: 'IMAGE_FAILED', rateLimited: sawRateLimit });
});

app.post('/api/summary', async (req, res) => {
  const { layers = [] } = req.body || {};
  if (!Array.isArray(layers) || layers.length === 0) {
    return res.status(400).json({ error: 'NO_LAYERS' });
  }
  const prompt = buildSummaryPrompt(layers);

  const attempts = [];
  if (SILICONFLOW_KEY) attempts.push(['siliconflow', () => chatSiliconFlow(prompt)]);
  if (ZHIPU_KEY) attempts.push(['zhipu', () => chatZhipu(prompt)]);

  for (const [name, fn] of attempts) {
    try {
      const text = await fn();
      if (text && text.trim()) return res.json({ text: text.trim(), provider: name });
    } catch (err) {
      console.error(`[summary:${name}]`, err.message || err);
    }
  }
  return res.json({ text: localSummary(layers), provider: 'local' });
});

// ---------- 生产环境：托管前端构建产物（单端口部署） ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  // 静态资源（含 vite-plugin-pwa 生成的 sw.js、manifest 等）
  app.use(express.static(distDir, {
    // service worker 禁止被浏览器缓存，保证更新及时
    setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  // SPA fallback：非 /api 的 GET 请求统一返回 index.html（不拦截静态文件）
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    const indexFile = path.join(distDir, 'index.html');
    if (req.method === 'GET' && !fs.existsSync(path.join(distDir, req.path))) {
      return res.sendFile(indexFile);
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`SkyRise 服务已启动: http://localhost:${PORT}`);
  console.log(`  前端产物: ${fs.existsSync(distDir) ? '已托管 dist（生产模式）' : '未构建（仅 API 模式）'}`);
  console.log(`  文生图 Provider: ${SILICONFLOW_KEY ? 'SiliconFlow(Kolors) -> ' : ''}${ZHIPU_KEY ? 'Zhipu(CogView-3-Flash) -> ' : ''}Pollinations(兜底)`);
  console.log(`  文本 Provider: ${SILICONFLOW_KEY ? 'SiliconFlow(Qwen2.5-7B) -> ' : ''}${ZHIPU_KEY ? 'Zhipu(GLM-4-Flash) -> ' : ''}本地模板(兜底)`);
});
