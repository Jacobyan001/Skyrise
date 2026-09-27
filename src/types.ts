export interface Task {
  id: string;
  title: string;
  day: string; // 'Mon', 'Tue' ...
  startTime: string; // "08:00"
  endTime: string; // "10:00"
  completed: boolean;
  rewardKeyword: string; // 完成后获得的资源 Token（也是文生图的关键词）
}

export interface BuildingLayer {
  id: string;
  imageUrl: string; // Base64 Data URL
  description: string;
  level: number;
  timestamp?: number;
  keywords?: string[]; // 资源 Token 关键词（图纸主题，由任务 reward 决定）
}

export interface CompletedTower {
  id: string;
  name: string;
  summary: string;
  realisticImageUrl: string;
  floorCount: number;
  completedAt: number;
  themes: string[];
  originalLayers: BuildingLayer[];
}

export type ViewMode = 'SCHEDULE' | 'TOWER' | 'CITY';

// 导出 / 导入存档的数据结构
export interface AppData {
  version: number;
  tasks: Task[];
  inventory: string[];
  layers: BuildingLayer[];
  completedTowers?: CompletedTower[];
  timestamp: number;
}

export const TYPES_VERSION = 3;
