import type { Task } from './types.ts';

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DAYS_OF_WEEK_CN: Record<string, string> = {
  Mon: '周一', Tue: '周二', Wed: '周三', Thu: '周四', Fri: '周五', Sat: '周六', Sun: '周日',
};

// 资源 Token 主题词（完成任务随机/指定奖励，也是楼层生成的关键词）
export const THEME_KEYWORDS = [
  '赛博朋克', '糖果乐园', '蒸汽朋克', '海底世界', '太空站',
  '丛林探险', '中世纪城堡', '街机游戏厅', '幽灵鬼屋', '冰雪宫殿',
  '机器人工厂', '魔法图书馆', '温室花园', '披萨店', '科学实验室',
];

// 初始示范任务
export const INITIAL_TASKS: Task[] = [
  { id: '1', title: '晨读 20 分钟', day: 'Mon', startTime: '08:00', endTime: '09:00', completed: false, rewardKeyword: '魔法图书馆' },
  { id: '2', title: '完成数学作业', day: 'Mon', startTime: '16:00', endTime: '17:00', completed: false, rewardKeyword: '科学实验室' },
  { id: '3', title: '整理自己的房间', day: 'Tue', startTime: '18:00', endTime: '19:00', completed: false, rewardKeyword: '太空站' },
  { id: '4', title: '练习钢琴 30 分钟', day: 'Wed', startTime: '15:00', endTime: '16:00', completed: false, rewardKeyword: '街机游戏厅' },
  { id: '5', title: '遛狗 / 照顾宠物', day: 'Thu', startTime: '07:00', endTime: '08:00', completed: false, rewardKeyword: '丛林探险' },
  { id: '6', title: '帮妈妈做家务', day: 'Fri', startTime: '14:00', endTime: '16:00', completed: false, rewardKeyword: '机器人工厂' },
  { id: '7', title: '画一幅画', day: 'Sat', startTime: '10:00', endTime: '11:00', completed: false, rewardKeyword: '糖果乐园' },
];

// 建造 1 层楼 = 消耗 1 个资源 Token（简化规则）
export const COST_PER_FLOOR = 1;

// 每完成 10 层 = 1 个阶段，可竣工
export const FLOORS_PER_STAGE = 10;
