import React, { useState } from 'react';
import { PixelButton } from './PixelComponents.tsx';

interface LandingPageProps {
  onStart: (apiKey: string) => void;
  initialKey?: string;
}

// 硅基流动注册邀请链接（新用户注册送免费额度）
const SIGNUP_URL = 'https://cloud.siliconflow.cn/i/Yoil9rLN';

const LandingPage: React.FC<LandingPageProps> = ({ onStart, initialKey = '' }) => {
  const [apiKey, setApiKey] = useState(initialKey);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 校验 API KEY 是否有效：服务端拿 KEY 调用硅基流动账户接口
  const verifyKey = async (key: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.valid === true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) {
      setErrorMsg('请先填入你的 API KEY');
      return;
    }
    if (!key.startsWith('sk-')) {
      setErrorMsg('API KEY 格式不对，应该以 sk- 开头哦');
      return;
    }

    setErrorMsg('');
    setIsChecking(true);
    const valid = await verifyKey(key);
    setIsChecking(false);

    if (valid) {
      onStart(key);
    } else {
      setErrorMsg('API KEY 无效或网络异常，请检查后重试');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#60a5fa] via-[#87CEEB] to-[#bfdbfe] relative overflow-hidden flex flex-col font-pixel">
      {/* 像素太阳 */}
      <div className="absolute top-6 right-8 md:top-10 md:right-16 z-0">
        <div className="relative">
          <div className="w-14 h-14 md:w-20 md:h-20 bg-yellow-400 border-4 border-yellow-500"></div>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400"></div>
          <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-3 bg-yellow-400"></div>
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-3 bg-yellow-400"></div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400"></div>
        </div>
      </div>

      {/* 云朵 */}
      <div className="absolute top-[12%] left-[8%] opacity-80 z-0">
        <div className="bg-white w-20 h-6 md:w-24 md:h-8 relative shadow-pixel-sm">
          <div className="absolute -top-3 left-3 w-10 h-10 md:w-12 md:h-12 bg-white"></div>
          <div className="absolute -top-5 left-9 w-12 h-12 md:w-16 md:h-16 bg-white"></div>
        </div>
      </div>
      <div className="absolute top-[22%] right-[20%] opacity-60 z-0 hidden sm:block">
        <div className="bg-white w-24 h-8 md:w-32 md:h-10 relative shadow-pixel-sm">
          <div className="absolute -top-4 left-5 w-12 h-12 md:w-14 md:h-14 bg-white"></div>
          <div className="absolute -top-7 left-12 w-16 h-16 md:w-20 md:h-20 bg-white"></div>
        </div>
      </div>

      {/* 像素塔楼（与 APP icon 视觉统一），位于底部中央，卡片叠在塔楼前面 */}
      <img
        src="/pixel-tower.svg"
        alt="像素塔楼"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[min(94%,430px)] z-[1] pointer-events-none"
      />

      {/* 主内容 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Logo */}
        <div className="mb-5 md:mb-7 text-center">
          <h1 className="text-5xl md:text-8xl text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)] md:drop-shadow-[6px_6px_0_rgba(0,0,0,1)] tracking-widest leading-tight">
            SkyRise
          </h1>
          <div className="bg-yellow-400 text-black border-4 border-black px-3 md:px-4 py-0.5 md:py-1 text-base md:text-3xl inline-block transform -rotate-2 mt-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            像素习惯养成 · PIXEL HABITS
          </div>
        </div>

        {/* 登录 / 开始卡片 */}
        <div className="bg-white p-5 md:p-7 border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,0.5)] flex flex-col max-w-md w-full">
          <p className="text-base md:text-lg text-center mb-4 text-gray-700 leading-snug">
            完成现实中的每日任务，赚取资源 Token，
            <br />
            用 AI 建造属于你的摩天大楼！
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="sf-key" className="block text-sm md:text-base text-gray-600 mb-1">
                请输入你的硅基流动 API KEY
              </label>
              <input
                id="sf-key"
                type="text"
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setErrorMsg(''); }}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full border-4 border-black p-2 text-base md:text-lg focus:outline-none focus:bg-yellow-50"
              />
            </div>

            {errorMsg && (
              <div className="text-red-600 text-sm md:text-base bg-red-100 border-2 border-red-400 px-2 py-1 animate-pulse">
                {errorMsg}
              </div>
            )}

            <PixelButton
              type="submit"
              variant="accent"
              disabled={isChecking}
              className="w-full py-2.5 md:py-3 text-lg md:text-xl flex items-center justify-center gap-2"
            >
              <span>🏗️</span>
              {isChecking ? '校验 KEY 中...' : '开始搭建 START'}
            </PixelButton>

            {/* 没有 KEY 的用户：引导注册 */}
            <a
              href={SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-blue-700 text-sm md:text-base underline hover:text-blue-500 pt-1"
            >
              没有 API KEY？点这里免费注册领取 →
            </a>
          </form>

          <p className="text-center text-xs md:text-sm text-gray-400 mt-4">
            KEY 只保存在你的浏览器里，数据保存在本机，可随时导出存档
          </p>
        </div>
      </div>

      {/* 页脚 */}
      <div className="relative z-10 text-center text-black/50 text-sm pb-3">
        © 2025 PIXEL HABIT BUILDERS INC.
      </div>
    </div>
  );
};

export default LandingPage;
