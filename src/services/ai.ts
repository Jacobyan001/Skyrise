// 前端 AI 服务：通过本地代理服务（server/index.mjs）调用国内免费文生图模型
// 有 Key：硅基流动 Kolors / 智谱 CogView；无 Key：本地程序化像素房间引擎

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* ignore */ }
    if (res.status === 429) throw new Error('QUOTA_EXHAUSTED');
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// 压缩图片：限制最大宽度 1024px，JPEG 0.85，方便存入 IndexedDB
const compressImage = (base64Str: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxWidth = 1024;
        const scale = maxWidth / img.width;
        const finalWidth = img.width > maxWidth ? maxWidth : img.width;
        const finalHeight = img.width > maxWidth ? Math.round(img.height * scale) : img.height;
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Str);
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });

// 生成楼层像素图
// 用户 KEY 随请求传给服务端；AI 失败（含无 Key）直接抛错提示用户，不再用写死兜底图欺骗用户
export async function generateFloorImage(
  keywords: string[],
  level: number,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('QUOTA_EXHAUSTED');
  }

  try {
    const data = await postJson<{ image: string; provider: string }>('/api/image', {
      kind: 'floor',
      keywords,
      level,
      apiKey,
    });
    return compressImage(data.image);
  } catch (err) {
    if (err instanceof Error && err.message === 'QUOTA_EXHAUSTED') throw err;
    throw new Error('AI生图暂时不可用，请稍后重试');
  }
}

// 竣工：生成大楼写实照片
export async function generateRealisticTowerImage(
  summary: string,
  floorCount: number,
  themes: string[],
  apiKey: string
): Promise<string> {
  const data = await postJson<{ image: string; provider: string }>('/api/image', {
    kind: 'tower',
    level: floorCount,
    summary,
    themes,
    apiKey,
  });
  return data.image; // 写实照保留原尺寸质量
}

// 竣工：生成大楼命名与总结
export async function generateTowerSummary(
  layers: { level: number; keywords?: string[]; description?: string; prompt?: string }[],
  apiKey: string
): Promise<string> {
  const data = await postJson<{ text: string; provider: string }>('/api/summary', { layers, apiKey });
  return data.text;
}
