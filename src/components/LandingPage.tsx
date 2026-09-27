import React from 'react';
import { PixelButton } from './PixelComponents.tsx';

interface LandingPageProps {
  onStart: () => void;
  aiStatus: { siliconflow: boolean; zhipu: boolean } | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, aiStatus }) => {
  const hasKey = !!(aiStatus?.siliconflow || aiStatus?.zhipu);

  return (
    <div className="min-h-screen bg-[#87CEEB] relative overflow-hidden flex flex-col items-center justify-center font-pixel">
      {/* 动画背景元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 云朵 */}
        <div className="absolute top-[10%] left-[10%] opacity-80 animate-float" style={{ animationDuration: '20s' }}>
          <div className="bg-white w-24 h-8 relative shadow-pixel-sm">
            <div className="absolute -top-4 left-4 w-12 h-12 bg-white"></div>
            <div className="absolute -top-6 left-10 w-16 h-16 bg-white"></div>
          </div>
        </div>
        <div className="absolute top-[20%] right-[15%] opacity-60 animate-float" style={{ animationDuration: '35s', animationDelay: '2s' }}>
          <div className="bg-white w-32 h-10 relative shadow-pixel-sm">
            <div className="absolute -top-5 left-6 w-14 h-14 bg-white"></div>
            <div className="absolute -top-8 left-14 w-20 h-20 bg-white"></div>
          </div>
        </div>

        {/* 远处城市剪影 */}
        <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end opacity-30">
          {Array.from({ length: 20 }).map((_, i) => {
            const height = 20 + ((i * 37) % 60);
            const width = 20 + ((i * 23) % 40);
            return (
              <div
                key={i}
                className="bg-[#3b82f6] border-t-4 border-r-4 border-[#1e40af] mr-2"
                style={{ height: `${height}%`, width: `${width}px` }}
              />
            );
          })}
        </div>
      </div>

      {/* 主内容 */}
      <div className="relative z-10 flex flex-col items-center animate-in zoom-in-90 duration-500">
        {/* Logo */}
        <div className="mb-8 md:mb-12 text-center relative px-2">
          <div className="absolute -inset-4 bg-white/30 blur-xl rounded-full"></div>
          <h1 className="text-5xl md:text-8xl text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)] md:drop-shadow-[6px_6px_0_rgba(0,0,0,1)] relative z-10 tracking-widest leading-tight">
            SkyRise
          </h1>
          <div className="bg-yellow-400 text-black border-4 border-black px-3 md:px-4 py-0.5 md:py-1 text-base md:text-3xl inline-block transform -rotate-2 mt-3 md:mt-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            像素习惯养成 · PIXEL HABITS
          </div>
        </div>

        {/* 开始卡片 */}
        <div className="bg-white p-5 md:p-8 border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,0.5)] flex flex-col items-center max-w-md w-full mx-4">
          <p className="text-lg md:text-xl text-center mb-5 md:mb-6 text-gray-600 leading-relaxed">
            完成现实中的每日任务，赚取资源 Token，
            <br />
            用 AI 建造属于你的摩天大楼！
          </p>

          <div className="w-full space-y-4">
            <PixelButton
              onClick={onStart}
              className="w-full py-4 text-xl bg-white text-black hover:bg-gray-50 flex items-center justify-center gap-3 animate-pulse"
            >
              <span className="text-2xl">🏗️</span>
              开始搭建 START
            </PixelButton>

            <div className="text-center">
              <p className="text-xs text-gray-400 mt-4">
                {hasKey
                  ? 'AI 建筑师已就位：国内免费文生图模型已配置 ✅'
                  : '当前使用免费兜底绘图服务，可在 server/.env 中配置硅基流动或智谱 API Key 获得更好效果'}
              </p>
              <p className="text-[10px] text-gray-300 mt-1">
                (数据保存在本机浏览器，SAVE/LOAD 可导出存档)
              </p>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div className="absolute bottom-4 text-black/50 text-sm">
          © 2025 PIXEL HABIT BUILDERS INC.
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
