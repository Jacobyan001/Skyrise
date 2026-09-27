import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { BuildingLayer } from '../types.ts';
import { generateFloorImage, generateTowerSummary } from '../services/ai.ts';
import { PixelButton, PixelCard } from './PixelComponents.tsx';
import { FLOORS_PER_STAGE } from '../constants.ts';

interface SkyscraperProps {
  layers: BuildingLayer[];
  inventory: string[];
  apiKey: string;
  onBuildLayer: (newLayer: BuildingLayer) => void;
  onUpdateLayer: (updatedLayer: BuildingLayer) => void;
  onConsumeInventory: (keywords: string[]) => void;
  onArchiveTower: (summary: string) => void;
}

const Skyscraper: React.FC<SkyscraperProps> = ({
  layers,
  inventory,
  apiKey,
  onBuildLayer,
  onUpdateLayer,
  onConsumeInventory,
  onArchiveTower
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 最新楼层的 DOM 引用（用于自动定位）
  const latestLayerRef = useRef<HTMLDivElement>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [regeneratingLayerId, setRegeneratingLayerId] = useState<string | null>(null);
  // 按库存「索引」选择，避免相同关键词被一起选中
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [showQuotaMessage, setShowQuotaMessage] = useState(false);

  // 竣工总结弹窗
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [towerSummary, setTowerSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 移动端长按
  const [activeMobileLayerId, setActiveMobileLayerId] = useState<string | null>(null);
  const pressTimerRef = useRef<any>(null);

  // 永远默认定位到最新楼层（flex-col-reverse 布局中最新层在视觉顶部，
  // 该容器向上滚动时 scrollTop 为负值，scrollTo(top:scrollHeight) 会被钳回 0，
  // 故用 scrollIntoView 直接定位最新楼层元素，兼容该滚动模型）
  useEffect(() => {
    if (layers.length > 0) {
      // 等待 DOM 渲染完成后再滚动（楼层高度固定，无需等图片加载）
      const timer = setTimeout(() => {
        latestLayerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [layers.length]);

  // 库存变化（如消耗后索引位移）时，丢弃越界的选择
  useEffect(() => {
    setSelectedIndices(prev => prev.filter(i => i < inventory.length));
  }, [inventory.length]);

  const selectedKeywords = selectedIndices.map(i => inventory[i]).filter(Boolean);

  const handleToggleIndex = (idx: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 3) return prev;
      return [...prev, idx];
    });
  };

  const handleBuild = async () => {
    if (selectedKeywords.length === 0) {
      setBuildError('至少选择 1 个资源 Token！');
      return;
    }
    setBuildError(null);
    setIsBuilding(true);

    try {
      const currentLevel = layers.length + 1;
      const imageUrl = await generateFloorImage(selectedKeywords, currentLevel, apiKey);

      const newLayer: BuildingLayer = {
        id: Date.now().toString(),
        imageUrl,
        level: currentLevel,
        description: `主题: ${selectedKeywords.join(', ')}`,
        timestamp: Date.now(),
        keywords: selectedKeywords
      };

      onBuildLayer(newLayer);
      onConsumeInventory(selectedKeywords);
      setSelectedIndices([]);
    } catch (e: any) {
      if (e.message === 'QUOTA_EXHAUSTED') {
        setShowQuotaMessage(true);
      } else {
        setBuildError(e?.message || '建造失败了，再试一次吧！');
      }
    } finally {
      setIsBuilding(false);
    }
  };

  const handleRegenerate = async (layer: BuildingLayer) => {
    let keywordsToUse = layer.keywords;
    if (!keywordsToUse || keywordsToUse.length === 0) {
      const parts = (layer.description || '').replace('主题: ', '').split(', ');
      keywordsToUse = parts.length > 0 && parts[0] ? parts : ['神秘'];
    }

    setRegeneratingLayerId(layer.id);
    setActiveMobileLayerId(null);

    try {
      const newImageUrl = await generateFloorImage(keywordsToUse, layer.level, apiKey);
      onUpdateLayer({ ...layer, imageUrl: newImageUrl });
    } catch (e: any) {
      if (e.message === 'QUOTA_EXHAUSTED') {
        setShowQuotaMessage(true);
      } else {
        alert(e?.message || '重新生成失败，请再试一次。');
      }
    } finally {
      setRegeneratingLayerId(null);
    }
  };

  const handleFinishTower = async () => {
    if (layers.length === 0) {
      setBuildError('先盖几层楼吧！');
      return;
    }
    setIsSummarizing(true);
    setBuildError(null);

    try {
      const summary = await generateTowerSummary(layers, apiKey);
      setTowerSummary(summary);
      setShowFinishModal(true);
    } catch (e) {
      setBuildError('暂时无法分析大楼，稍后再试。');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFinalize = () => {
    onArchiveTower(towerSummary);
    setShowFinishModal(false);
  };

  // 移动端长按
  const handleTouchStart = (id: string) => {
    pressTimerRef.current = setTimeout(() => setActiveMobileLayerId(id), 800);
  };
  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  const closeMobileOverlay = () => setActiveMobileLayerId(null);

  /** 根据楼层高度切换天空背景 */
  const getSkyStyle = () => {
    const height = layers.length;
    if (height < 5) return 'bg-gradient-to-b from-blue-300 to-blue-200';
    if (height < 15) return 'bg-gradient-to-b from-blue-400 to-blue-300';
    if (height < 30) return 'bg-gradient-to-b from-blue-500 via-blue-200 to-white';
    if (height < 50) return 'bg-gradient-to-b from-indigo-600 via-purple-500 to-orange-400';
    return 'bg-gradient-to-b from-black via-purple-900 to-indigo-900';
  };

  const getEnvironmentText = () => {
    const height = layers.length;
    if (height < 15) return '';
    if (height < 30) return '云层之上...';
    if (height < 50) return '平流层 · 日落景观';
    return '外太空 · 失重区';
  };

  const getLayerDateInfo = (layer: BuildingLayer) => {
    const ts = layer.timestamp || parseInt(layer.id);
    const date = new Date(ts);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
      dayOfWeek: date.getDay(),
      fullDateString: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  };

  const getFlagColor = (dayOfWeek: number) => {
    const colors = [
      'bg-[#ef4444]', 'bg-[#f97316]', 'bg-[#fbbf24]', 'bg-[#22c55e]',
      'bg-[#06b6d4]', 'bg-[#3b82f6]', 'bg-[#a855f7]',
    ];
    return colors[dayOfWeek] || 'bg-gray-400';
  };

  const brickPatternStyle: React.CSSProperties = {
    backgroundColor: '#f59e0b',
    backgroundImage: `
      linear-gradient(335deg, rgba(0,0,0,0.05) 23px, transparent 23px),
      linear-gradient(155deg, rgba(0,0,0,0.05) 23px, transparent 23px),
      linear-gradient(335deg, rgba(0,0,0,0.05) 23px, transparent 23px),
      linear-gradient(155deg, rgba(0,0,0,0.05) 23px, transparent 23px)
    `,
    backgroundSize: '20px 20px',
    backgroundPosition: '0px 2px, 4px 35px, 29px 31px, 34px 6px'
  };

  const layersPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    layers.forEach(layer => {
      const { fullDateString } = getLayerDateInfo(layer);
      counts[fullDateString] = (counts[fullDateString] || 0) + 1;
    });
    return counts;
  }, [layers]);

  // 阶段进度：每 10 层为一个阶段
  const stageNumber = Math.floor(layers.length / FLOORS_PER_STAGE) + 1;
  const floorsInStage = layers.length % FLOORS_PER_STAGE;
  const stageJustCompleted = layers.length > 0 && floorsInStage === 0;

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-132px)] gap-3 md:gap-4 pb-10 lg:pb-0" onClick={closeMobileOverlay}>

      {/* 竣工总结弹窗 */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-4 md:p-6 max-w-2xl w-full shadow-[8px_8px_0_0_rgba(255,255,255,1)] relative flex flex-col items-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl md:text-5xl font-pixel mb-3 md:mb-4 text-purple-600 text-center uppercase">大楼竣工啦！</h2>
            <div className="text-4xl md:text-6xl mb-4 md:mb-6 animate-bounce">🎉🏢🎉</div>

            <div className="w-full font-pixel text-base md:text-xl leading-relaxed text-center mb-5 md:mb-8 border-4 border-gray-200 p-3 md:p-6 bg-gray-50 max-h-[40vh] overflow-y-auto rounded-xl">
              <p className="whitespace-pre-line">{towerSummary}</p>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full">
              <PixelButton onClick={() => setShowFinishModal(false)} variant="secondary" className="flex-1">
                继续建造
              </PixelButton>
              <PixelButton onClick={handleFinalize} className="flex-1 bg-green-500 hover:bg-green-400">
                拍照 & 竣工 📸
              </PixelButton>
            </div>
            <p className="text-xs font-pixel text-gray-500 mt-2 text-center">
              竣工会生成大楼的写实照片，放入城市档案，并开始一座新楼。
            </p>
          </div>
        </div>
      )}

      {/* 机器人休息弹窗（限流友好提示） */}
      {showQuotaMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full shadow-[8px_8px_0_0_rgba(0,0,0,1)] text-center relative">
            <div className="text-6xl mb-4">🤖💤</div>
            <h3 className="font-pixel text-3xl mb-2 text-blue-600">建造机器人在打盹！</h3>
            <p className="font-pixel text-xl mb-6 text-gray-700 leading-relaxed">
              建造机器人今天工作得太辛苦啦，需要充一会儿电。
              <br /><br />
              <span className="bg-yellow-100 px-2 py-1 border border-black inline-block">
                稍后再来试试吧！
              </span>
            </p>
            <div className="text-xs font-pixel text-gray-400 mb-6">
              （今日额度已用完 - 你的资源 Token 都保存好了！）
            </div>
            <PixelButton onClick={() => setShowQuotaMessage(false)} className="w-full">
              好的，晚安机器人！
            </PixelButton>
          </div>
        </div>
      )}

      {/* 左侧：塔楼展示 */}
      <div className={`w-full h-[52vh] md:h-[58vh] lg:h-full lg:flex-1 border-4 border-black relative overflow-hidden flex flex-col items-center transition-colors duration-[2000ms] ${getSkyStyle()}`}>

        <div className="absolute top-2 right-2 md:top-4 md:right-4 text-white font-pixel text-sm md:text-xl opacity-80 z-20 text-right drop-shadow-md">
          {getEnvironmentText()}
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto w-full flex flex-col-reverse items-center pt-24 md:pt-32 pb-0 scrollbar-hide relative z-10"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* 地基 */}
          <div className="w-full min-w-full h-16 md:h-24 bg-[#4a8522] border-t-4 border-black flex-shrink-0 flex flex-col justify-start items-center relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2.5px)', backgroundSize: '10px 10px' }}></div>
            <div className="z-10 bg-black text-white px-3 md:px-4 py-0.5 md:py-1 font-pixel text-base md:text-base border-2 border-white mt-3 md:mt-4 shadow-lg">
              地面 GROUND LEVEL
            </div>
          </div>

          {/* 楼层 */}
          {layers.map((layer, index) => {
            const dateInfo = getLayerDateInfo(layer);
            const prevLayer = index > 0 ? layers[index - 1] : null;
            const prevDateInfo = prevLayer ? getLayerDateInfo(prevLayer) : null;
            const isFirstOfDay = index === 0 || dateInfo.fullDateString !== prevDateInfo?.fullDateString;
            const isRegenerating = regeneratingLayerId === layer.id;
            const dailyCount = layersPerDay[dateInfo.fullDateString] || 0;

            return (
              <div
                key={layer.id}
                ref={index === layers.length - 1 ? latestLayerRef : undefined}
                className="relative w-full max-w-2xl flex-shrink-0 flex flex-col transition-all duration-1000 animate-in zoom-in-50 slide-in-from-bottom-10"
              >
                {/* 楼板 */}
                <div
                  className="h-6 md:h-8 w-full border-x-4 border-y-4 border-black flex items-center justify-center relative z-20"
                  style={brickPatternStyle}
                >
                  {isFirstOfDay && (
                    <div className="absolute left-0 top-0 h-full flex items-start z-40">
                      <div className={`
                        absolute top-[-8px]
                        left-1 lg:-left-12
                        flex flex-col items-center
                        origin-top animate-in swing-in-top-fwd duration-1000
                      `}>
                        <div className="hidden lg:block w-12 h-2 bg-black absolute top-2 left-6"></div>
                        <div className="hidden lg:block w-2 h-2 rounded-full bg-gray-500 absolute top-2 left-16 border border-black"></div>

                        {/* 当日楼层徽章 */}
                        <div className="absolute top-[-24px] left-[26px] lg:left-[80px] z-50 animate-bounce" style={{ animationDuration: '3s' }}>
                          <div className="bg-yellow-300 border-2 border-black px-1.5 py-0.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)] whitespace-nowrap">
                            <span className="font-pixel font-bold text-xs text-black">+{dailyCount} 层</span>
                          </div>
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-black border-r-[6px] border-r-transparent absolute -bottom-[6px] left-1/2 -translate-x-1/2"></div>
                          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-t-[4px] border-t-yellow-300 border-r-[4px] border-r-transparent absolute -bottom-[3px] left-1/2 -translate-x-1/2"></div>
                        </div>

                        <div
                          className={`
                            w-10 md:w-12 h-16 md:h-20
                            ${getFlagColor(dateInfo.dayOfWeek)}
                            border-x-2 border-t-2 border-black
                            flex flex-col items-center justify-start pt-1 md:pt-2
                            shadow-lg relative
                            text-white
                          `}
                          style={{
                            clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)',
                            filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.5))'
                          }}
                        >
                          <span className="font-pixel text-[9px] md:text-[10px] leading-none opacity-90">{dateInfo.month}</span>
                          <span className="font-pixel text-xl md:text-2xl font-bold leading-none mt-0.5 md:mt-1">{dateInfo.day}</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10 pointer-events-none"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end w-full px-3 md:px-4 gap-2">
                    <div className="w-2 h-2 bg-black opacity-30 rounded-full"></div>
                    <div className="w-2 h-2 bg-black opacity-30 rounded-full"></div>
                  </div>
                </div>

                {/* 楼层图片 */}
                <div
                  className="flex h-36 md:h-56 lg:h-64 w-full"
                  onTouchStart={() => handleTouchStart(layer.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                >
                  <div className="w-3 md:w-6 border-l-4 border-black border-r-4 border-black h-full flex-shrink-0 z-10" style={brickPatternStyle}></div>

                  <div className="flex-1 relative bg-[#2d2d2d] overflow-hidden group">
                    <div className="absolute left-1.5 top-1.5 md:left-2 md:top-2 bg-black/80 text-white px-1.5 md:px-2 py-0.5 md:py-1 font-pixel text-xs md:text-sm border border-white z-20 shadow-md">
                      第 {layer.level} 层
                    </div>

                    {isRegenerating && (
                      <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center">
                        <div className="flex flex-col items-center text-white font-pixel">
                          <div className="animate-spin text-3xl md:text-4xl mb-2">🧱</div>
                          <span className="text-base md:text-base">重新建造中...</span>
                        </div>
                      </div>
                    )}

                    {/* 手机端常驻显示（半透明小按钮，既看得见又不易误触）；桌面端悬停楼层时才出现 */}
                    <div
                      className={`
                        absolute top-1.5 right-1.5 md:top-2 md:right-2 z-40 flex gap-2 transition-opacity duration-200
                        ${activeMobileLayerId === layer.id ? 'opacity-100' : 'opacity-60 active:opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}
                        ${isRegenerating ? 'hidden' : ''}
                      `}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerate(layer);
                        }}
                        title="重新生成"
                        className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center bg-black/70 md:bg-green-500 border-2 border-white/80 md:border-black text-white text-base md:text-xl shadow-none md:shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 md:hover:shadow-none transition-all touch-manipulation"
                      >
                        ↻
                      </button>
                    </div>

                    <img
                      src={layer.imageUrl}
                      alt={`Layer ${layer.level}`}
                      className="w-full h-full object-cover scale-105"
                      style={{ imageRendering: 'pixelated' }}
                    />

                    {/* CRT 扫描线特效 */}
                    <div
                      className="absolute inset-0 pointer-events-none z-10 opacity-20"
                      style={{
                        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                        backgroundSize: '100% 4px, 6px 100%'
                      }}
                    ></div>

                    {/* 漂浮尘埃 */}
                    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                      <div className="absolute top-full left-[10%] w-1 h-1 bg-white opacity-20 animate-float" style={{ animationDelay: '1s' }}></div>
                      <div className="absolute top-full left-[30%] w-1 h-1 bg-white opacity-20 animate-float" style={{ animationDelay: '3s' }}></div>
                      <div className="absolute top-full left-[50%] w-1 h-1 bg-white opacity-20 animate-float" style={{ animationDelay: '0s' }}></div>
                    </div>

                    {/* 入场闪光 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-30 animate-shine-once w-[200%] -skew-x-12"></div>
                  </div>

                  <div className="w-3 md:w-6 border-l-4 border-black border-r-4 border-black h-full flex-shrink-0 z-10" style={brickPatternStyle}></div>
                </div>
              </div>
            );
          })}

          {/* 建造中的占位楼层 */}
          {isBuilding && (
            <div className="relative w-full max-w-2xl flex-shrink-0 flex flex-col animate-in zoom-in-50 slide-in-from-bottom-10">
              <div
                className="h-6 md:h-8 w-full border-x-4 border-y-4 border-black flex items-center justify-center relative z-20"
                style={brickPatternStyle}
              ></div>

              <div className="flex h-36 md:h-56 lg:h-64 w-full">
                <div className="w-3 md:w-6 border-l-4 border-black border-r-4 border-black h-full flex-shrink-0 z-10" style={brickPatternStyle}></div>

                <div className="flex-1 relative border-b-4 border-black overflow-hidden flex flex-col items-center justify-center">
                  <div className="absolute inset-0 hazard-stripe animate-construction-scroll opacity-80"></div>

                  <div className="relative z-10 bg-black text-yellow-400 p-3 md:p-4 border-4 border-white shadow-xl text-center transform -rotate-2">
                    <div className="text-xl md:text-3xl font-pixel animate-pulse">施工中 UNDER CONSTRUCTION</div>
                    <div className="text-xs md:text-sm font-pixel text-white mt-1">AI 建筑师正在绘制像素图...</div>
                  </div>

                  <div className="absolute bottom-1.5 right-1.5 md:bottom-2 md:right-2 text-white font-pixel text-xs bg-black px-1.5 md:px-2 py-0.5 z-10">
                    第 {layers.length + 1} 层
                  </div>
                </div>

                <div className="w-3 md:w-6 border-l-4 border-black border-r-4 border-black h-full flex-shrink-0 z-10" style={brickPatternStyle}></div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 右侧：建造控制台 */}
      <div className="w-full lg:w-80 flex flex-col gap-3 md:gap-4">
        <PixelCard title="建造台 BUILDER" className="flex-1 flex flex-col shadow-xl">
          {/* 阶段进度 */}
          <div className="mb-3 bg-purple-50 border-2 border-purple-200 p-2.5 md:p-3">
            <div className="flex justify-between items-center font-pixel text-sm md:text-base">
              <span className="text-purple-700 font-bold">阶段 STAGE {stageNumber}</span>
              <span className="text-gray-500">{stageJustCompleted ? `${layers.length} 层全部达成!` : `${floorsInStage}/${FLOORS_PER_STAGE} 层`}</span>
            </div>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: FLOORS_PER_STAGE }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-3 border border-black ${i < floorsInStage ? 'bg-purple-500' : 'bg-white'}`}
                ></div>
              ))}
            </div>
            {stageJustCompleted && (
              <div className="font-pixel text-xs md:text-sm text-purple-600 mt-2 animate-pulse">
                🎉 阶段完成！可以点下方按钮竣工这座大楼啦
              </div>
            )}
          </div>

          {/* 资源 Token */}
          <div className="mb-3 flex-1">
            <p className="font-pixel text-sm md:text-base mb-2 text-gray-600">
              选择资源 Token（最多 3 个），盖得更高！
            </p>
            <div className="bg-gray-100 p-2 border-2 border-gray-300 h-36 md:h-44 overflow-y-auto grid grid-cols-1 gap-2">
              {inventory.length === 0 ? (
                <div className="text-center text-gray-400 font-pixel mt-4 md:mt-6 p-4 text-base md:text-base">
                  去任务页完成挑战，赚取建造资源吧！
                </div>
              ) : (
                inventory.map((keyword, idx) => {
                  const active = selectedIndices.includes(idx);
                  return (
                    <button
                      key={`${keyword}-${idx}`}
                      onClick={() => handleToggleIndex(idx)}
                      className={`
                        p-2.5 md:p-3 text-sm md:text-base font-pixel border-2 text-left flex justify-between items-center transition-all
                        ${active
                          ? 'bg-blue-500 text-white border-black translate-x-1'
                          : 'bg-white text-black border-gray-400 hover:bg-yellow-100'}
                      `}
                    >
                      <span>💎 {keyword}</span>
                      {active && <span>★</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-yellow-50 p-2.5 md:p-3 border-2 border-black mb-3">
            <div className="font-pixel text-xs text-gray-500 uppercase">当前图纸</div>
            <div className="font-pixel text-base md:text-lg leading-tight mt-1 text-blue-800 break-words">
              {selectedKeywords.length > 0 ? selectedKeywords.join(' + ') : '暂无内容'}
            </div>
          </div>

          {buildError && (
            <div className="text-red-500 font-pixel text-sm md:text-base mb-3 text-center animate-pulse bg-red-100 p-1">
              {buildError}
            </div>
          )}

          <PixelButton
            onClick={handleBuild}
            disabled={isBuilding || inventory.length === 0}
            className="w-full flex justify-center items-center gap-2 py-2.5 md:py-4 text-lg md:text-xl shadow-lg"
            variant={inventory.length > 0 ? 'success' : 'secondary'}
          >
            {isBuilding ? '建造中...' : '建造楼层 BUILD'}
          </PixelButton>

          {/* 竣工按钮 */}
          <PixelButton
            onClick={handleFinishTower}
            disabled={isSummarizing || isBuilding || layers.length === 0}
            className="w-full mt-3 bg-purple-600 hover:bg-purple-500 text-white border-4 border-black shadow-lg"
            variant="primary"
          >
            {isSummarizing ? '分析中...' : '竣工大楼 FINISH 🏁'}
          </PixelButton>
        </PixelCard>
      </div>
    </div>
  );
};

export default Skyscraper;
