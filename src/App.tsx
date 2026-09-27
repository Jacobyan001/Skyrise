import React, { useState, useEffect, useRef } from 'react';
import type { ViewMode, Task, BuildingLayer, AppData, CompletedTower } from './types.ts';
import { INITIAL_TASKS } from './constants.ts';
import TaskScheduler from './components/TaskScheduler.tsx';
import Skyscraper from './components/Skyscraper.tsx';
import CityGallery from './components/CityGallery.tsx';
import LandingPage from './components/LandingPage.tsx';
import { PixelButton } from './components/PixelComponents.tsx';
import { saveKey, loadKey } from './services/storage.ts';
import { generateRealisticTowerImage } from './services/ai.ts';

const APP_VERSION = 1;

const App: React.FC = () => {
  // 登录 / 开始状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 用户自己的硅基流动 API KEY（保存在 localStorage，每次请求带给服务端）
  const [apiKey, setApiKey] = useState('');

  // 状态
  const [viewMode, setViewMode] = useState<ViewMode>('SCHEDULE');
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [inventory, setInventory] = useState<string[]>(['基础砖块']);
  const [layers, setLayers] = useState<BuildingLayer[]>([]);
  const [completedTowers, setCompletedTowers] = useState<CompletedTower[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // 竣工中
  const [isArchiving, setIsArchiving] = useState(false);

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从 IndexedDB / localStorage 加载
  useEffect(() => {
    const initData = async () => {
      try {
        const [savedTasks, savedInventory, savedLayers, savedTowers] = await Promise.all([
          loadKey<Task[]>('skyrise_tasks'),
          loadKey<string[]>('skyrise_inventory'),
          loadKey<BuildingLayer[]>('skyrise_layers'),
          loadKey<CompletedTower[]>('skyrise_completed_towers')
        ]);

        if (savedTasks && Array.isArray(savedTasks)) setTasks(savedTasks);
        // 去重：清理此前 StrictMode bug 产生的重复 Token（相同主题词视为同一个资源）
        if (savedInventory && Array.isArray(savedInventory)) {
          setInventory(Array.from(new Set(savedInventory.filter(Boolean))));
        }
        if (savedLayers && Array.isArray(savedLayers)) setLayers(savedLayers);
        if (savedTowers && Array.isArray(savedTowers)) setCompletedTowers(savedTowers);

        // 回访用户：有已保存的 KEY 才自动跳过着陆页
        const savedApiKey = localStorage.getItem('skyrise_sf_key') || '';
        setApiKey(savedApiKey);
        if (localStorage.getItem('skyrise_started') === '1' && savedApiKey) {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setIsDataLoaded(true);
      }
    };

    initData();
  }, []);

  // 自动保存
  useEffect(() => {
    if (!isDataLoaded) return;

    const saveData = async () => {
      try {
        await Promise.all([
          saveKey('skyrise_tasks', tasks),
          saveKey('skyrise_inventory', inventory),
          saveKey('skyrise_layers', layers),
          saveKey('skyrise_completed_towers', completedTowers)
        ]);
      } catch (e) {
        console.error('Failed to save state:', e);
      }
    };

    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
  }, [tasks, inventory, layers, completedTowers, isDataLoaded]);

  // 着陆页校验通过后：保存 KEY 并进入应用
  const handleLogin = (key: string) => {
    localStorage.setItem('skyrise_sf_key', key);
    localStorage.setItem('skyrise_started', '1');
    setApiKey(key);
    setIsAuthenticated(true);
  };

  // 退出只返回着陆页（保留 KEY，方便直接重新进入或更换）
  const handleLogout = () => {
    localStorage.removeItem('skyrise_started');
    setIsAuthenticated(false);
  };

  const handleToggleTask = (taskId: string) => {
    // 先从当前 state 读取任务，副作用（发 Token）放在 updater 之外，
    // 避免 React StrictMode 双调用 updater 导致奖励发两次
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;

    if (!target.completed) {
      handleTaskCompletion(target.rewardKeyword);
    }

    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleAddTask = (newTask: Task) => {
    setTasks(prev => [...prev, newTask]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleResetWeek = () => {
    setTasks(prev => prev.map(t => ({ ...t, completed: false })));
  };

  const handleTaskCompletion = (reward: string) => {
    setInventory(prev => [...prev, reward]);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  const handleBuildLayer = (newLayer: BuildingLayer) => {
    setLayers(prev => [...prev, newLayer]);
  };

  const handleUpdateLayer = (updatedLayer: BuildingLayer) => {
    setLayers(prev => prev.map(l => l.id === updatedLayer.id ? updatedLayer : l));
  };

  const handleConsumeInventory = (keywordsUsed: string[]) => {
    setInventory(prev => {
      const newInv = [...prev];
      keywordsUsed.forEach(k => {
        const idx = newInv.indexOf(k);
        if (idx > -1) newInv.splice(idx, 1);
      });
      return newInv;
    });
  };

  // --- 竣工逻辑 ---
  const handleArchiveTower = async (summaryText: string) => {
    setIsArchiving(true);

    try {
      const allKeywords = layers.flatMap(l => l.keywords || []);

      // 生成写实照片
      const realisticImage = await generateRealisticTowerImage(summaryText, layers.length, allKeywords, apiKey);

      // 解析 NAME: 与总结正文
      let towerName = `大楼 #${completedTowers.length + 1}`;
      let finalSummary = summaryText;

      const lines = summaryText.split('\n');
      const nameLineIndex = lines.findIndex(line => line.trim().toUpperCase().startsWith('NAME:'));

      if (nameLineIndex !== -1) {
        const nameLine = lines[nameLineIndex];
        towerName = nameLine.replace(/NAME:/i, '').replace(/[《"""]/g, '').trim();

        const remainingLines = lines.slice(nameLineIndex + 1);
        finalSummary = remainingLines.filter(line => line.trim() !== '').join('\n');
      } else {
        const quoteMatch = summaryText.match(/["""]([^"""]+)[""""]/);
        if (quoteMatch) {
          towerName = quoteMatch[1];
        } else if (lines.length > 0 && lines[0].length < 50) {
          towerName = lines[0];
        }
      }

      const newCompletedTower: CompletedTower = {
        id: Date.now().toString(),
        name: towerName,
        summary: finalSummary,
        realisticImageUrl: realisticImage,
        floorCount: layers.length,
        completedAt: Date.now(),
        themes: allKeywords,
        originalLayers: [...layers]
      };

      setCompletedTowers(prev => [...prev, newCompletedTower]);
      setLayers([]);
      setViewMode('CITY');
    } catch (e) {
      console.error('Failed to archive tower', e);
      alert('保存大楼时出了点问题，请重试。');
    } finally {
      setIsArchiving(false);
    }
  };

  // --- 存档导出 / 导入 ---
  const handleExport = () => {
    const data: AppData = {
      version: APP_VERSION,
      tasks,
      inventory,
      layers,
      completedTowers,
      timestamp: Date.now()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `skyrise-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json) as AppData;

        if (data.version === undefined || !Array.isArray(data.tasks)) {
          alert('存档格式不对哦。');
          return;
        }

        setTasks(data.tasks);
        setInventory(data.inventory || []);
        setLayers(data.layers || []);
        setCompletedTowers(data.completedTowers || []);
        alert('存档加载成功！');
      } catch (err) {
        console.error(err);
        alert('读取存档失败。');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- 着陆页 ---
  if (!isAuthenticated) {
    return <LandingPage onStart={handleLogin} initialKey={apiKey} />;
  }

  return (
    <div className="min-h-screen bg-pixel-bg text-pixel-dark font-pixel flex flex-col">
      {/* 竣工全局遮罩 */}
      {isArchiving && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center text-white p-8">
          <div className="text-6xl animate-bounce mb-4">📸</div>
          <h2 className="text-3xl font-pixel mb-2">正在拍摄建筑写真...</h2>
          <p className="font-pixel text-gray-400">AI 正在渲染高清城市实拍图，请稍候。</p>
        </div>
      )}

      {/* 顶部导航 */}
      <nav className="bg-pixel-primary border-b-4 border-black sticky top-0 z-50 shadow-pixel">
        <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 md:py-4 flex flex-col gap-2">
          {/* 第一行：Logo + 存档操作 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-xl md:text-3xl animate-bounce flex-shrink-0">🏢</div>
              <h1 className="text-xl md:text-3xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] truncate">SkyRise</h1>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              <button onClick={handleImportClick} className="text-white/90 hover:text-yellow-300 underline text-xs md:text-sm">读取</button>
              <button onClick={handleExport} className="text-white/90 hover:text-yellow-300 underline text-xs md:text-sm">存档</button>
              <button onClick={handleLogout} className="text-red-100 hover:text-white underline text-xs md:text-sm">退出</button>
            </div>
          </div>

          {/* 第二行：三个 Tab，等宽分段控件；手机端只显示中文省空间，桌面端显示中英文 */}
          <div className="flex gap-1.5 md:gap-2">
            <PixelButton
              onClick={() => setViewMode('SCHEDULE')}
              variant={viewMode === 'SCHEDULE' ? 'secondary' : 'primary'}
              className="flex-1 text-base md:text-xl py-0.5 md:py-2 px-1 md:px-4 tracking-normal whitespace-nowrap"
            >
              <span>任务</span><span className="hidden md:inline"> SCHEDULE</span>
            </PixelButton>
            <PixelButton
              onClick={() => setViewMode('TOWER')}
              variant={viewMode === 'TOWER' ? 'secondary' : 'primary'}
              className="flex-1 text-base md:text-xl py-0.5 md:py-2 px-1 md:px-4 tracking-normal whitespace-nowrap"
            >
              <span>大楼</span><span className="hidden md:inline"> TOWER</span>
            </PixelButton>
            <PixelButton
              onClick={() => setViewMode('CITY')}
              variant={viewMode === 'CITY' ? 'secondary' : 'primary'}
              className="flex-1 text-base md:text-xl py-0.5 md:py-2 px-1 md:px-4 tracking-normal whitespace-nowrap"
            >
              <span>城市</span><span className="hidden md:inline"> CITY</span>
            </PixelButton>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="flex-1 p-2 md:p-4 lg:p-8 overflow-x-hidden">
        {viewMode === 'SCHEDULE' && (
          <TaskScheduler
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onResetWeek={handleResetWeek}
            inventory={inventory}
          />
        )}

        {viewMode === 'TOWER' && (
          <Skyscraper
            layers={layers}
            inventory={inventory}
            apiKey={apiKey}
            onBuildLayer={handleBuildLayer}
            onUpdateLayer={handleUpdateLayer}
            onConsumeInventory={handleConsumeInventory}
            onArchiveTower={handleArchiveTower}
          />
        )}

        {viewMode === 'CITY' && (
          <CityGallery completedTowers={completedTowers} />
        )}
      </main>

      {/* 获得资源提示 */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50 bg-black/20">
          <div className="bg-yellow-300 border-4 border-black p-6 shadow-pixel animate-bounce">
            <h2 className="text-2xl">💎 获得资源 TOKEN!</h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
