import React, { useState } from 'react';
import type { CompletedTower } from '../types.ts';

interface CityGalleryProps {
  completedTowers: CompletedTower[];
}

const CityGallery: React.FC<CityGalleryProps> = ({ completedTowers }) => {
  const [selectedTower, setSelectedTower] = useState<CompletedTower | null>(null);

  if (completedTowers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center min-h-[50vh]">
        <div className="text-5xl md:text-6xl mb-3 md:mb-4">🏙️</div>
        <h2 className="text-2xl md:text-3xl font-pixel text-gray-400 mb-2">城市还是空的</h2>
        <p className="font-pixel text-base md:text-lg text-gray-500">
          建造并竣工你的第一座大楼，它就会以写实照片的形式出现在这里！
        </p>
      </div>
    );
  }

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

  return (
    <div className="max-w-6xl mx-auto p-2 md:p-4 pb-10 md:pb-20">
      <div className="bg-yellow-300 border-4 border-black p-3 md:p-4 mb-5 md:mb-8 shadow-pixel flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
        <div className="text-3xl md:text-4xl">📸</div>
        <div>
          <h2 className="text-xl md:text-3xl font-pixel uppercase leading-tight">SkyRise 城市档案</h2>
          <p className="font-pixel text-sm">每座竣工大楼的写实快照，都是你习惯养成之路的勋章。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
        {completedTowers.map((tower) => (
          <div
            key={tower.id}
            className="relative group animate-in zoom-in-50 duration-500 cursor-pointer"
            onClick={() => setSelectedTower(tower)}
          >
            {/* 拍立得卡片 */}
            <div className="bg-white p-4 pb-16 shadow-[6px_6px_0_0_rgba(0,0,0,0.5)] transform transition-transform hover:-rotate-1 hover:scale-105 duration-300 relative z-10 hover:z-20 border border-gray-200">
              <div className="aspect-[9/16] w-full bg-gray-200 overflow-hidden mb-4 border-2 border-gray-100 relative">
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white px-3 py-1 font-pixel rounded text-lg">查看详情</span>
                </div>
                <img
                  src={tower.realisticImageUrl}
                  alt={tower.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="font-pixel text-2xl leading-none mb-1 truncate text-black">{tower.name || '无名大楼'}</h3>
                <div className="flex justify-between items-end">
                  <span className="font-pixel text-gray-500 text-sm">{new Date(tower.completedAt).toLocaleDateString()}</span>
                  <span className="font-pixel bg-black text-white px-2 py-0.5 text-xs rounded-full">
                    {tower.floorCount} 层
                  </span>
                </div>
              </div>
            </div>

            {/* 胶带效果 */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-yellow-200/80 transform rotate-2 z-20 backdrop-blur-sm shadow-sm border-l border-r border-white/50 pointer-events-none"></div>
          </div>
        ))}
      </div>

      {/* 详情弹窗 */}
      {selectedTower && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedTower(null)}>
          <div
            className="bg-white w-full max-w-5xl h-[92vh] md:h-[85vh] border-4 border-black shadow-[10px_10px_0_0_rgba(255,255,255,0.8)] flex flex-col md:flex-row overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedTower(null)}
              className="absolute top-2 right-2 z-50 bg-red-500 text-white w-10 h-10 md:w-8 md:h-8 flex items-center justify-center border-2 border-black hover:bg-red-600 font-bold text-lg"
            >
              ✕
            </button>

            {/* 左：写实照片 */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full bg-gray-100 border-b-4 md:border-b-0 md:border-r-4 border-black relative">
              <img
                src={selectedTower.realisticImageUrl}
                className="w-full h-full object-cover"
                alt="写实照片"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 md:p-6 text-white">
                <h2 className="text-2xl md:text-4xl font-pixel mb-2">{selectedTower.name}</h2>
                <div className="font-pixel text-sm opacity-90 max-h-32 overflow-y-auto">
                  {selectedTower.summary.replace(/"/g, '')}
                </div>
              </div>
            </div>

            {/* 右：原始像素蓝图 */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full bg-blue-200 flex flex-col relative">
              <div className="bg-black text-white p-2 text-center font-pixel border-b-4 border-black z-10 shadow-md">
                原始像素蓝图 BLUEPRINT
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col-reverse items-center bg-gradient-to-b from-blue-300 to-blue-100">
                <div className="w-full max-w-md h-12 bg-[#4a8522] border-t-4 border-black flex-shrink-0 flex items-center justify-center mb-0 mt-0">
                  <span className="font-pixel text-white text-xs">地基 FOUNDATION</span>
                </div>

                {selectedTower.originalLayers && selectedTower.originalLayers.length > 0 ? (
                  selectedTower.originalLayers.map((layer) => (
                    <div key={layer.id} className="w-full max-w-md flex flex-col">
                      <div
                        className="h-4 w-full border-x-4 border-y-4 border-black"
                        style={brickPatternStyle}
                      ></div>
                      <div className="flex h-32 w-full">
                        <div className="w-4 border-l-4 border-black border-r-4 border-black h-full bg-gray-700" style={brickPatternStyle}></div>
                        <div className="flex-1 bg-[#2d2d2d] relative overflow-hidden">
                          <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 font-pixel z-10">
                            第 {layer.level} 层
                          </div>
                          <img
                            src={layer.imageUrl}
                            className="w-full h-full object-cover scale-105"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <div className="w-4 border-l-4 border-black border-r-4 border-black h-full bg-gray-700" style={brickPatternStyle}></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 text-center font-pixel text-gray-500">
                    原始蓝图已消失在时光中...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityGallery;
