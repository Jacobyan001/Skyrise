// sceneParser.mjs 的类型声明（服务端与前端共用的中文场景解析器）

export interface SceneTerm {
  cn: string;
  en: string;
  kind: 'identity' | 'action' | 'location' | 'object' | 'effect';
  at: number;
  pose?: string;
  sprite?: string;
  theme?: string;
  object?: string;
  effect?: string;
  nameLabel?: string;
}

export interface Companion {
  name: string;
  sprite: string;
}

export interface ParsedScene {
  hasPerson: boolean;
  identity: SceneTerm | null;
  identities: SceneTerm[];
  actions: SceneTerm[];
  locations: SceneTerm[];
  effects: SceneTerm[];
  objects: SceneTerm[];
  names: string[];
  teams: string[];
  companions: Companion[];
  subjectName: string;
  sceneEn: string;
}

export function parseScene(input: string): ParsedScene;
