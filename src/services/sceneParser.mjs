// 本地中文场景解析器：把孩子写的「一个X在Y里Z」整句拆成 身份/动作/地点/物品
// 服务端（组英文 AI 提示词）与前端程序化引擎共用本文件，纯函数、无 DOM 依赖

// kind: identity(身份人物) / action(动作) / location(地点) / object(物品)
// pose: 程序化引擎使用的姿势标识；sprite: 程序化角色身份标识；theme: 程序化房间主题
const TERMS = [
  // ---------- 身份（长词优先，顺序不影响匹配） ----------
  { cn: '篮球运动员', en: 'a basketball player in an orange jersey', kind: 'identity', sprite: 'basketball' },
  { cn: '足球运动员', en: 'a soccer player in a green jersey', kind: 'identity', sprite: 'soccer' },
  { cn: '篮球小子', en: 'a boy who loves basketball', kind: 'identity', sprite: 'basketball' },
  { cn: '猫咪战士', en: 'an anthropomorphic cat warrior in armor with a sword', kind: 'identity', sprite: 'catwarrior' },
  { cn: '猫战士', en: 'an anthropomorphic cat warrior in armor with a sword', kind: 'identity', sprite: 'catwarrior' },
  { cn: '消防员', en: 'a brave firefighter', kind: 'identity', sprite: 'firefighter' },
  { cn: '机器人消防员', en: 'a brave robot firefighter', kind: 'identity', sprite: 'robotfire' },
  { cn: '机器人', en: 'a friendly metal robot', kind: 'identity', sprite: 'robot' },
  { cn: '小男孩', en: 'a little boy', kind: 'identity', sprite: 'boy' },
  { cn: '小女孩', en: 'a little girl', kind: 'identity', sprite: 'girl' },
  { cn: '宇航员', en: 'an astronaut in a white spacesuit', kind: 'identity', sprite: 'astronaut' },
  { cn: '太空人', en: 'an astronaut in a white spacesuit', kind: 'identity', sprite: 'astronaut' },
  { cn: '魔法师', en: 'a wizard in a purple robe', kind: 'identity', sprite: 'wizard' },
  { cn: '吸血鬼', en: 'a vampire with a black cape', kind: 'identity', sprite: 'vampire' },
  { cn: '外星人', en: 'a friendly green alien', kind: 'identity', sprite: 'alien' },
  { cn: '运动员', en: 'an athlete in sportswear', kind: 'identity', sprite: 'athlete' },
  { cn: '猫咪', en: 'an upright little cat', kind: 'identity', sprite: 'cat' },
  { cn: '小猫', en: 'an upright little cat', kind: 'identity', sprite: 'cat' },
  { cn: '猫', en: 'an upright little cat', kind: 'identity', sprite: 'cat' },
  { cn: '战士', en: 'a warrior with a sword', kind: 'identity', sprite: 'warrior' },
  { cn: '男孩', en: 'a boy', kind: 'identity', sprite: 'boy' },
  { cn: '男生', en: 'a boy', kind: 'identity', sprite: 'boy' },
  { cn: '女孩', en: 'a girl', kind: 'identity', sprite: 'girl' },
  { cn: '女生', en: 'a girl', kind: 'identity', sprite: 'girl' },
  { cn: '男人', en: 'a man', kind: 'identity', sprite: 'man' },
  { cn: '女士', en: 'a lady', kind: 'identity', sprite: 'lady' },
  { cn: '女人', en: 'a woman', kind: 'identity', sprite: 'woman' },
  { cn: '宝宝', en: 'a baby', kind: 'identity', sprite: 'baby' },
  { cn: '婴儿', en: 'a baby', kind: 'identity', sprite: 'baby' },
  { cn: '孩子们', en: 'kids', kind: 'identity', sprite: 'kid' },
  { cn: '小孩', en: 'a kid', kind: 'identity', sprite: 'kid' },
  { cn: '孩子', en: 'a kid', kind: 'identity', sprite: 'kid' },
  { cn: '儿童', en: 'a child', kind: 'identity', sprite: 'kid' },
  { cn: '少年', en: 'a teenage boy', kind: 'identity', sprite: 'boy' },
  { cn: '少女', en: 'a teenage girl', kind: 'identity', sprite: 'girl' },
  { cn: '公主', en: 'a princess in a pink gown with a small crown', kind: 'identity', sprite: 'princess' },
  { cn: '王子', en: 'a prince in a blue royal outfit', kind: 'identity', sprite: 'prince' },
  { cn: '国王', en: 'a king with a golden crown', kind: 'identity', sprite: 'king' },
  { cn: '女王', en: 'a queen with a golden crown', kind: 'identity', sprite: 'queen' },
  { cn: '巫师', en: 'a wizard in a starry robe', kind: 'identity', sprite: 'wizard' },
  { cn: '女巫', en: 'a witch in a black dress and pointed hat', kind: 'identity', sprite: 'witch' },
  { cn: '骑士', en: 'a knight in silver armor', kind: 'identity', sprite: 'knight' },
  { cn: '海盗', en: 'a pirate with a striped shirt and red bandana', kind: 'identity', sprite: 'pirate' },
  { cn: '忍者', en: 'a ninja in a dark hooded outfit', kind: 'identity', sprite: 'ninja' },
  { cn: '英雄', en: 'a superhero in a colorful cape', kind: 'identity', sprite: 'hero' },
  { cn: '老师', en: 'a teacher', kind: 'identity', sprite: 'teacher' },
  { cn: '学生', en: 'a student in a school uniform', kind: 'identity', sprite: 'student' },
  { cn: '医生', en: 'a doctor in a white coat', kind: 'identity', sprite: 'doctor' },
  { cn: '护士', en: 'a nurse', kind: 'identity', sprite: 'nurse' },
  { cn: '厨师', en: 'a chef in a white hat', kind: 'identity', sprite: 'chef' },
  { cn: '小丑', en: 'a clown with a red nose and rainbow wig', kind: 'identity', sprite: 'clown' },
  { cn: '僵尸', en: 'a cartoon zombie in ragged clothes', kind: 'identity', sprite: 'zombie' },
  { cn: '精灵', en: 'a pointy-eared elf', kind: 'identity', sprite: 'elf' },
  { cn: '虫子', en: 'a cute cartoon worm', kind: 'identity', sprite: 'worm' },
  { cn: '妈妈', en: 'a mother with gentle features', kind: 'identity', sprite: 'mom' },
  { cn: '史努比', en: 'Snoopy, a black and white beagle standing on two legs', kind: 'identity', sprite: 'snoopy' },
  { cn: '人物', en: 'a person', kind: 'identity', sprite: 'kid' },
  { cn: '角色', en: 'a character', kind: 'identity', sprite: 'kid' },

  // ---------- 动作 ----------
  { cn: '跳街舞', en: 'breakdancing in an energetic one-hand freeze pose', kind: 'action', pose: 'breakdance' },
  { cn: '街舞', en: 'breakdancing in a cool street-dance pose', kind: 'action', pose: 'breakdance' },
  { cn: '打篮球', en: 'playing basketball and dribbling the ball', kind: 'action', pose: 'basketball' },
  { cn: '踢足球', en: 'playing soccer and kicking the ball', kind: 'action', pose: 'soccer' },
  { cn: '探险', en: 'exploring an adventure with a sword', kind: 'action', pose: 'explore' },
  { cn: '冒险', en: 'exploring an adventure', kind: 'action', pose: 'explore' },
  { cn: '救火', en: 'putting out the fire with a high-pressure water hose', kind: 'action', pose: 'firefight' },
  { cn: '灭火', en: 'spraying water to put out the fire', kind: 'action', pose: 'firefight' },
  { cn: '跳舞', en: 'dancing energetically', kind: 'action', pose: 'dance' },
  { cn: '舞蹈', en: 'dancing', kind: 'action', pose: 'dance' },
  { cn: '跑步', en: 'running at full speed', kind: 'action', pose: 'run' },
  { cn: '奔跑', en: 'running fast', kind: 'action', pose: 'run' },
  { cn: '唱歌', en: 'singing a song with an open smile', kind: 'action', pose: 'sing' },
  { cn: '看书', en: 'reading an open book', kind: 'action', pose: 'read' },
  { cn: '读书', en: 'reading a book', kind: 'action', pose: 'read' },
  { cn: '画画', en: 'drawing a picture', kind: 'action', pose: 'draw' },
  { cn: '做饭', en: 'cooking food', kind: 'action', pose: 'cook' },
  { cn: '烧饭', en: 'cooking food', kind: 'action', pose: 'cook' },
  { cn: '睡觉', en: 'sleeping peacefully', kind: 'action', pose: 'sleep' },
  { cn: '吃汉堡', en: 'eating a burger', kind: 'action', pose: 'eat' },
  { cn: '吃东西', en: 'eating food', kind: 'action', pose: 'eat' },
  { cn: '飞翔', en: 'flying through the air', kind: 'action', pose: 'fly' },
  { cn: '飞行', en: 'flying with arms open', kind: 'action', pose: 'fly' },

  // ---------- 地点 ----------
  { cn: '机器人工厂', en: 'inside a robot factory with conveyor belts and mechanical arms', kind: 'location', theme: 'robotfactory' },
  { cn: '热带丛林', en: 'in a tropical jungle with giant trees and vines', kind: 'location', theme: 'jungle' },
  { cn: '丛林', en: 'in a green jungle with trees and vines', kind: 'location', theme: 'jungle' },
  { cn: '麦当劳', en: "inside a McDonald's fast food restaurant with yellow golden arches, red and white decor", kind: 'location', theme: 'mcdonald' },
  { cn: '肯德基', en: 'inside a KFC fried chicken fast food restaurant, red and white decor', kind: 'location', theme: 'kfc' },
  { cn: '篮球场', en: 'on an outdoor basketball court with wooden floor markings', kind: 'location', theme: 'court' },
  { cn: '体育馆', en: 'inside a big indoor sports gymnasium', kind: 'location', theme: 'gym' },
  { cn: '游乐园', en: 'inside a colorful amusement park funhouse', kind: 'location', theme: 'funpark' },
  { cn: '餐厅', en: 'inside a cozy restaurant with tables', kind: 'location', theme: 'restaurant' },
  { cn: '饭店', en: 'inside a busy restaurant', kind: 'location', theme: 'restaurant' },
  { cn: '学校', en: 'inside a bright school classroom', kind: 'location', theme: 'school' },
  { cn: '公园', en: 'in a green city park with trees', kind: 'location', theme: 'park' },
  { cn: '图书馆', en: 'inside a quiet library with bookshelves', kind: 'location', theme: 'library' },
  { cn: '客厅', en: 'inside a cozy home living room with a sofa', kind: 'location', theme: 'home' },
  { cn: '卧室', en: 'inside a warm bedroom with a bed', kind: 'location', theme: 'bedroom' },
  { cn: '家里', en: 'inside a warm family home', kind: 'location', theme: 'home' },
  { cn: '家中', en: 'inside a warm family home', kind: 'location', theme: 'home' },
  { cn: '厨房', en: 'inside a clean home kitchen', kind: 'location', theme: 'kitchen' },
  { cn: '太空', en: 'floating in deep space among stars', kind: 'location', theme: 'space' },
  { cn: '城堡', en: 'inside a medieval stone castle hall', kind: 'location', theme: 'castle' },
  { cn: '商店', en: 'inside a little neighborhood shop', kind: 'location', theme: 'shop' },
  { cn: '金星', en: 'inside a Venus laboratory with orange hot sky visible through windows, volcanic surface outside', kind: 'location', theme: 'venus' },
  { cn: '海底世界', en: 'inside an underwater world with blue water, coral reefs, seaweed and bubbles', kind: 'location', theme: 'underwater' },
  { cn: '海底', en: 'inside an underwater world with blue water, coral reefs, seaweed and bubbles', kind: 'location', theme: 'underwater' },
  { cn: '实验室', en: 'inside a science laboratory with experiment tables, test tubes, microscopes and monitors', kind: 'location', theme: 'laboratory' },
  { cn: '游乐园', en: 'inside a colorful amusement park with ferris wheel, roller coaster, balloons and carousel', kind: 'location', theme: 'amusement_park' },
  { cn: '主题公园', en: 'inside a colorful amusement theme park with rides, balloons and carousel', kind: 'location', theme: 'amusement_park' },

  // ---------- 物品 ----------
  { cn: '篮球', en: 'an orange basketball', kind: 'object', object: 'basketball' },
  { cn: '足球', en: 'a black and white soccer ball', kind: 'object', object: 'soccer' },
  { cn: '汉堡', en: 'a cheeseburger', kind: 'object', object: 'burger' },
  { cn: '汉堡包', en: 'a cheeseburger', kind: 'object', object: 'burger' },
  { cn: '薯条', en: 'red carton of french fries', kind: 'object', object: 'fries' },
  { cn: '可乐', en: 'a cup of cola with a straw', kind: 'object', object: 'cola' },
  { cn: '蛋糕', en: 'a slice of cream cake', kind: 'object', object: 'cake' },
  { cn: '书本', en: 'a stack of books', kind: 'object', object: 'books' },
  { cn: '游戏机', en: 'a handheld game console', kind: 'object', object: 'console' },
  { cn: '意大利面', en: 'a plate of spaghetti', kind: 'object', object: 'spaghetti' },
  { cn: '招牌', en: 'a sign', kind: 'object', object: 'sign' },
  { cn: '气球', en: 'a balloon', kind: 'object', object: 'balloon' },

  // ---------- 环境特效（火灾等） ----------
  { cn: '着火了', en: 'the building is on fire with orange flames, sparks and thick smoke', kind: 'effect', effect: 'fire' },
  { cn: '起火了', en: 'the building is on fire with orange flames and thick smoke', kind: 'effect', effect: 'fire' },
  { cn: '失火了', en: 'the building caught fire with flames and smoke', kind: 'effect', effect: 'fire' },
  { cn: '着火', en: 'on fire with orange flames, sparks and thick smoke', kind: 'effect', effect: 'fire' },
  { cn: '起火', en: 'caught fire with orange flames', kind: 'effect', effect: 'fire' },
];

// 不参与语义的填充字/标点已在 parseScene 中直接跳过

// 英文常见词：不当作人名（紧凑表，覆盖孩子常用词）
const EN_COMMON_STOP = new Set([
  'room','house','home','bedroom','bathroom','kitchen','hall','school','classroom','library','shop','store','market',
  'space','castle','factory','garden','ocean','sea','forest','jungle','park','farm','city','town','street','road',
  'car','truck','bus','train','rocket','ship','boat','plane','tree','flower','rain','snow','sun','moon','star','sky',
  'cat','dog','pet','bird','fish','animal','water','food','cake','bread','fruit','milk','tea','juice',
  'toy','game','ball','book','music','art','sports','red','blue','green','yellow','white','black','pink','orange',
  'big','small','little','happy','cool','nice','good','fun','cube','box','table','chair','door','window','wall',
  'floor','lamp','robot','computer','phone','piano','guitar','drum','sword','hat','cup','map','flag','star','stars',
]);
// 英文人物词 -> 程序化 sprite
const EN_PERSON_MAP = {
  boy:'boy', boys:'boy', girl:'girl', girls:'girl', kid:'kid', kids:'kid', child:'kid', children:'kid',
  man:'man', men:'man', woman:'woman', women:'woman', person:'kid', people:'kid', human:'kid',
  guy:'boy', lady:'lady', baby:'baby', babies:'baby', teen:'boy', teens:'boy', teenager:'boy',
  astronaut:'astronaut', wizard:'wizard', witch:'witch', knight:'knight', pirate:'pirate', ninja:'ninja',
  princess:'princess', prince:'prince', king:'king', queen:'queen', hero:'hero', doctor:'doctor',
  nurse:'nurse', chef:'chef', clown:'clown', vampire:'vampire', zombie:'zombie', alien:'alien',
  mom:'mom', mother:'mom', worm:'worm', worms:'worm', snoopy:'snoopy',
};
// 英文代词：不参与任何分类
const EN_PRONOUNS = new Set([
  'i','me','my','mine','we','us','our','ours','you','your','yours','he','him','his','she','her','hers',
  'it','its','they','them','their','theirs','this','that','these','those',
]);
// 国家/地区名：不是人名；后跟 team 时作为国家队
const EN_COUNTRIES = new Set([
  'england','china','america','france','germany','spain','italy','japan','korea','brazil','argentina',
  'portugal','netherlands','belgium','mexico','russia','canada','australia','india','sweden','norway',
  'denmark','poland','turkey','greece','switzerland','croatia','wales','scotland','ireland',
]);
// 孩子常用名人名字 -> 程序化 sprite（with 同伴时使用）
const EN_NAME_SPRITE = {
  brunson: 'basketball', jordan: 'basketball', lebron: 'basketball', curry: 'basketball', kobe: 'basketball',
  messi: 'soccer', ronaldo: 'soccer', mbappe: 'soccer', haaland: 'soccer', neymar: 'soccer',
};
// 英文动名词 -> pose 标识
const EN_GERUND_POSE = {
  running:'run', dancing:'dance', singing:'sing', reading:'read', drawing:'draw',
  cooking:'cook', eating:'eat', flying:'fly', sleeping:'sleep', jumping:'jump', playing:'play',
  shooting:'shoot', kicking:'shoot', dribbling:'dribble', dunking:'dunk', casting:'magic',
  crying:'cry', comforting:'comfort', swimming:'swim',
};
// pose 标识 -> 英文动作短语
const EN_POSE_EN = {
  run:'running fast', dance:'dancing energetically', sing:'singing a song', read:'reading a book',
  draw:'drawing a picture', cook:'cooking food', eat:'eating food', fly:'flying through the air',
  sleep:'sleeping peacefully', jump:'jumping high', basketball:'playing basketball', soccer:'playing soccer',
  shoot:'shooting the ball', dribble:'dribbling the ball', dunk:'dunking the ball',
  cry:'crying loudly', comfort:'comforting gently', swim:'swimming gracefully',
};

function longestMatch(text, start) {
  let hit = null;
  for (const t of TERMS) {
    if (t.cn.length > (hit ? hit.cn.length : 0) && text.startsWith(t.cn, start)) hit = t;
  }
  return hit;
}

// 解析整句，返回结构化场景
export function parseScene(input) {
  const text = String(input || '')
    .replace(/[，。！？、,.!?;；:："'“”‘’（）()]/g, '')
    .replace(/\s+/g, ' ').trim();

  const found = [];
  let i = 0;
  while (i < text.length) {
    const hit = longestMatch(text, i);
    if (hit) {
      found.push({ ...hit, at: i });
      i += hit.cn.length;
    } else {
      i += 1;
    }
  }

  const identities = found.filter((f) => f.kind === 'identity');
  const actions = found.filter((f) => f.kind === 'action');
  const locations = found.filter((f) => f.kind === 'location');
  const objects = found.filter((f) => f.kind === 'object');
  const effects = found.filter((f) => f.kind === 'effect');

  // 英文词收集（中文词条跨度之外；过滤冠词与代词）
  const spans = found.map((f) => [f.at, f.at + f.cn.length]);
  const inSpan = (p) => spans.some(([a, b]) => p >= a && p < b);
  const latin = [];
  const enRe = /[A-Za-z][A-Za-z']*/g;
  let m;
  while ((m = enRe.exec(text))) {
    const bare = m[0].replace(/'s$/, '').toLowerCase();
    if (!inSpan(m.index) && bare !== 'a' && bare !== 'an' && bare !== 'the' && !EN_PRONOUNS.has(bare)) {
      latin.push({ word: m[0], lower: bare, at: m.index });
    }
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const teams = [];
  const people = []; // {name, at, companion, sprite}

  // 1) 所有格：Brunson's
  for (const t of latin) {
    const poss = /^([A-Za-z]+)'s$/.exec(t.word);
    if (poss && !EN_COUNTRIES.has(poss[1].toLowerCase())) {
      people.push({ name: cap(poss[1]), at: t.at, companion: false, sprite: EN_NAME_SPRITE[poss[1].toLowerCase()] || '' });
    }
  }

  // 2) 大写词序列：相邻大写词合并为人名（Harry Porter）；国家名单独识别
  for (let k = 0; k < latin.length; k++) {
    const t = latin[k];
    if (!/^[A-Z][a-z]+$/.test(t.word) || people.some((p) => p.at === t.at)) continue;
    const start = k;
    let j = k;
    const words = [t.word];
    while (j + 1 < latin.length
      && latin[j + 1].at === latin[j].at + latin[j].word.length + 1
      && /^[A-Z][a-z]+$/.test(latin[j + 1].word)) {
      j += 1;
      words.push(latin[j].word);
    }
    k = j;
    const phrase = words.join(' ');
    const bare = phrase.toLowerCase();
    if (EN_COUNTRIES.has(bare)) {
      const nxt = latin[j + 1]?.lower;
      if (nxt === 'team' || nxt === 'national') teams.push(phrase);
      continue;
    }
    // 序列紧邻前词为 with/and/against 等 → 同伴随同人物
    const prevWord = latin[start - 1]?.lower;
    const companion = ['with', 'and', 'against', 'vs', 'versus'].includes(prevWord);
    people.push({ name: phrase, at: t.at, companion, sprite: EN_NAME_SPRITE[bare] || '' });
  }

  // 3) 单个陌生拉丁词 → 人名（常见词/人物词/国家已排除）
  if (people.length === 0 && identities.length === 0 && latin.length === 1) {
    const lower = latin[0].lower;
    if (!EN_COMMON_STOP.has(lower) && !EN_PERSON_MAP[lower] && !EN_COUNTRIES.has(lower)) {
      people.push({ name: cap(latin[0].word), at: latin[0].at, companion: false, sprite: '' });
    }
  }

  const subjectName = people.find((p) => !p.companion)?.name || '';
  const companions = people.filter((p) => p.companion)
    .map((p) => ({ name: p.name, sprite: p.sprite }));
  const names = people.map((p) => p.name);

  // 身份：英文人物词（boy/…）优先；其次「<球类> player」；最后主语名人的已知角色
  if (identities.length === 0) {
    const pt = latin.find((t) => EN_PERSON_MAP[t.lower]);
    if (pt) {
      identities.push({ cn: pt.word, en: `a ${pt.lower}`, kind: 'identity', at: pt.at, sprite: EN_PERSON_MAP[pt.lower] });
    }
  }
  if (identities.length === 0) {
    for (let k = 0; k + 1 < latin.length; k++) {
      if (latin[k + 1].lower === 'player') {
        const sp = latin[k].lower === 'basketball' ? 'basketball'
          : (latin[k].lower === 'football' || latin[k].lower === 'soccer') ? 'soccer' : '';
        if (sp) {
          identities.push({ cn: `${latin[k].word} player`, en: `a ${latin[k].lower} player`, kind: 'identity', at: latin[k].at, sprite: sp });
          break;
        }
      }
    }
  }
  if (identities.length === 0) {
    const sub = people.find((p) => !p.companion && p.sprite);
    if (sub) identities.push({ cn: sub.name, en: sub.name, kind: 'identity', at: sub.at, sprite: sub.sprite });
  }
  // 主语名字贴到身份（供提示词外貌与程序化绘制）
  if (subjectName && identities[0]) identities[0].nameLabel = subjectName;

  // 运动项目判定：身份优先，其次句中球类词
  const sportOf = () => {
    const sp = identities[0]?.sprite;
    if (sp === 'basketball' || sp === 'soccer') return sp;
    if (latin.some((t) => t.lower === 'basketball')) return 'basketball';
    if (latin.some((t) => t.lower === 'soccer' || t.lower === 'football')) return 'soccer';
    return '';
  };

  // 动作：动名词；playing/shooting/dribbling 等结合球类上下文
  for (let k = 0; k < latin.length; k++) {
    const t = latin[k];
    let pose = EN_GERUND_POSE[t.lower];
    if (t.lower === 'playing') {
      const nxt = latin[k + 1]?.lower;
      pose = (nxt === 'soccer' || nxt === 'football') ? 'soccer'
        : nxt === 'basketball' ? 'basketball' : '';
    }
    if (t.lower === 'shooting' || t.lower === 'kicking') {
      pose = sportOf() === 'basketball' ? 'basketball_shoot'
        : sportOf() === 'soccer' ? 'soccer_shoot' : 'shoot';
    }
    if (t.lower === 'dribbling') pose = sportOf() === 'soccer' ? 'soccer' : 'basketball';
    if (t.lower === 'dunking') pose = 'basketball_shoot';
    if (t.lower === 'casting') pose = ''; // casting 归入魔法特效
    if (pose) actions.push({ cn: t.word, en: EN_POSE_EN[pose] || pose, kind: 'action', at: t.at, pose });
  }

  // 魔法特效：magic/wand/spell/casting 等
  const MAGIC_WORDS = new Set(['magic', 'magically', 'wand', 'spell', 'spells', 'casting']);
  if (latin.some((t) => MAGIC_WORDS.has(t.lower))) {
    effects.push({ cn: 'magic', en: 'glowing magic sparkles and magical light', kind: 'effect', at: 0, effect: 'magic' });
  }

  // 地点：cyberpunk 或 cyber + punk；其次普通 street；再识别金星/海底/游乐园/实验室等
  const lowerWords = latin.map((t) => t.lower);
  let isCyberpunk = lowerWords.includes('cyberpunk');
  if (!isCyberpunk) {
    for (let k = 0; k + 1 < latin.length; k++) {
      if (latin[k].lower === 'cyber' && latin[k + 1].lower === 'punk') { isCyberpunk = true; break; }
    }
  }
  if (isCyberpunk) {
    locations.push({ cn: 'cyberpunk street', en: 'on a cyberpunk street with neon signs and a wet reflective road', kind: 'location', at: 0, theme: 'cyberpunk' });
  } else if (lowerWords.includes('street') && locations.length === 0) {
    locations.push({ cn: 'street', en: 'on a city street', kind: 'location', at: 0, theme: 'street' });
  }
  // 英文地点词 → theme（中文词条已覆盖的跳过）
  const EN_LOC_MAP = {
    venus: 'venus', laboratory: 'laboratory', lab: 'laboratory',
    underwater: 'underwater', ocean: 'underwater', sea: 'underwater', aquarium: 'underwater',
    amusement: 'amusement_park', theme_park: 'amusement_park', park: 'amusement_park',
  };
  for (const t of latin) {
    const th = EN_LOC_MAP[t.lower];
    if (th && !locations.some((l) => l.theme === th)) {
      const enMap = {
        venus: 'in a Venus laboratory with orange hot sky and volcanic surface outside',
        laboratory: 'in a science laboratory with test tubes and microscopes',
        underwater: 'in an underwater world with coral reefs, seaweed and bubbles',
        amusement_park: 'in a colorful amusement park with ferris wheel and balloons',
      };
      locations.push({ cn: t.lower, en: enMap[th] || `in a ${t.lower}`, kind: 'location', at: t.at, theme: th });
    }
  }

  // 英文物体词
  const EN_OBJ_MAP = {
    spaghetti: 'a plate of spaghetti', pasta: 'a plate of spaghetti', noodles: 'a plate of noodles',
    sign: 'a sign', balloon: 'a balloon', balloons: 'a balloon',
  };
  for (const t of latin) {
    if (EN_OBJ_MAP[t.lower] && !objects.some((o) => o.object === t.lower)) {
      objects.push({ cn: t.lower, en: EN_OBJ_MAP[t.lower], kind: 'object', at: t.at, object: t.lower });
    }
  }

  // 无身份但有动作 → 默认一个人
  const hasPerson = identities.length > 0 || people.length > 0 || actions.length > 0;

  // 组装英文场景句
  const subject = identities.length > 0
    ? identities[0].en
    : (names.length > 0 ? `a friendly kid named ${names[0]}` : (hasPerson ? 'a person' : ''));
  const actionEn = actions.map((a) => a.en).join(' and ');

  const parts = [];
  if (subject) parts.push(actionEn ? `${subject} ${actionEn}` : subject);
  if (teams.length > 0) parts.push(`playing for the ${teams[0]} team`);
  if (companions.length > 0) parts.push(`together with ${companions.map((c) => c.name).join(' and ')}`);
  const locEn = locations.map((l) => l.en).join(', ');
  if (locEn) parts.push(locEn);
  const fxEn = effects.map((f) => f.en).join('; ');
  if (fxEn) parts.push(fxEn);
  const objEn = objects.map((o) => o.en).join(', ');
  if (objEn) parts.push(`with ${objEn}`);

  return {
    hasPerson,
    identity: identities[0] || null,
    identities,
    actions,
    locations,
    effects,
    objects,
    names,
    teams,
    companions,
    subjectName,
    sceneEn: parts.join(', '),
  };
}
