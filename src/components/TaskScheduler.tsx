import React, { useState } from 'react';
import type { Task } from '../types.ts';
import { PixelCard, PixelButton } from './PixelComponents.tsx';
import { DAYS_OF_WEEK, DAYS_OF_WEEK_CN } from '../constants.ts';

interface TaskSchedulerProps {
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onResetWeek: () => void;
  inventory: string[];
}

const TaskScheduler: React.FC<TaskSchedulerProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onResetWeek,
  inventory
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  // 表单状态
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [rewardKeyword, setRewardKeyword] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon']);
  const [editCompletedStatus, setEditCompletedStatus] = useState(false);

  const resetForm = () => {
    setTitle('');
    setStartTime('09:00');
    setEndTime('10:00');
    setRewardKeyword('');
    setSelectedDays(['Mon']);
    setEditCompletedStatus(false);
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setTitle(task.title);
    setStartTime(task.startTime);
    setEndTime(task.endTime);
    setRewardKeyword(task.rewardKeyword);
    setSelectedDays([task.day]);
    setEditCompletedStatus(task.completed);
    setEditingId(task.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    onDeleteTask(taskId);
  };

  const handleResetWeekClick = () => {
    if (isResetConfirming) {
      onResetWeek();
      setIsResetConfirming(false);
    } else {
      setIsResetConfirming(true);
      setTimeout(() => setIsResetConfirming(false), 3000);
    }
  };

  const toggleDaySelection = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(prev => prev.filter(d => d !== day));
      }
    } else {
      setSelectedDays(prev => {
        const newDays = [...prev, day];
        return newDays.sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b));
      });
    }
  };

  const generateId = () => Date.now().toString() + Math.random().toString(36).slice(2, 11);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !rewardKeyword || selectedDays.length === 0) return;

    if (editingId) {
      const firstDay = selectedDays[0];
      onUpdateTask({
        id: editingId,
        title,
        day: firstDay,
        startTime,
        endTime,
        completed: editCompletedStatus,
        rewardKeyword
      });
      for (let i = 1; i < selectedDays.length; i++) {
        onAddTask({
          id: generateId(),
          title,
          day: selectedDays[i],
          startTime,
          endTime,
          completed: false,
          rewardKeyword
        });
      }
    } else {
      selectedDays.forEach(day => {
        onAddTask({
          id: generateId(),
          title,
          day,
          startTime,
          endTime,
          completed: false,
          rewardKeyword
        });
      });
    }
    resetForm();
  };

  const tasksByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = tasks.filter(t => t.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 md:space-y-8 pb-10 md:pb-20">
      {/* 头部与控制区 */}
      <PixelCard className="bg-blue-50">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-3xl font-pixel text-pixel-dark leading-tight">任务指挥中心 MISSION CONTROL</h2>
            <p className="font-pixel text-sm md:text-base text-gray-600">完成任务，赢取资源 Token 去盖楼！</p>
          </div>
          {/* 手机端三个元素也强制一行不换行：Token 固定宽度，两个按钮平分剩余空间 */}
          <div className="flex gap-1.5 md:gap-2 items-center flex-nowrap justify-start md:justify-end w-full md:w-auto">
            <div className="bg-yellow-200 border-2 border-black px-1.5 md:px-2 py-1 font-pixel text-xs md:text-sm whitespace-nowrap flex-shrink-0">
              💎 TOKEN: {inventory.length}
            </div>

            <PixelButton
              onClick={handleResetWeekClick}
              variant={isResetConfirming ? 'danger' : 'secondary'}
              className={`flex-1 md:flex-none py-1 px-1.5 md:py-2 md:px-4 text-xs md:text-sm min-w-0 whitespace-nowrap tracking-normal transition-all ${isResetConfirming ? 'animate-pulse' : ''}`}
              title="取消所有勾选，开始新的一周"
            >
              {isResetConfirming ? '确认重置？' : '↺ 新的一周'}
            </PixelButton>

            <PixelButton onClick={() => {
              if (isFormOpen && !editingId) {
                setIsFormOpen(false);
              } else {
                resetForm();
                setIsFormOpen(true);
              }
            }} className="flex-1 md:flex-none py-1 px-1.5 md:py-2 md:px-4 text-xs md:text-sm min-w-0 whitespace-nowrap tracking-normal">
              {isFormOpen && !editingId ? '关闭' : '+ 新任务'}
            </PixelButton>
          </div>
        </div>

        {/* 任务表单 */}
        {isFormOpen && (
          <form onSubmit={handleSubmit} className="mt-6 border-t-4 border-black pt-4 bg-white p-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-pixel text-xl text-blue-600">
                {editingId ? '编辑任务' : '设计新任务'}
              </h3>
              <button type="button" onClick={resetForm} className="text-red-500 font-pixel hover:underline">取消</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-2">
                <label className="block font-pixel text-xs text-gray-500 mb-1">任务名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="例如：刷牙、练字"
                  className="w-full border-2 border-black p-2 font-pixel"
                  required
                />
              </div>

              {/* 重复日期多选 */}
              <div className="lg:col-span-6">
                <label className="block font-pixel text-xs text-gray-500 mb-1">
                  {editingId ? '日期（多选可复制任务）' : '每周重复日'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDaySelection(day)}
                      className={`
                        px-3 py-1 border-2 font-pixel text-sm transition-all
                        ${selectedDays.includes(day)
                          ? 'bg-blue-600 text-white border-black shadow-none translate-y-1'
                          : 'bg-white text-gray-700 border-gray-400 hover:bg-gray-100 shadow-[2px_2px_0_rgba(0,0,0,0.2)]'}
                      `}
                    >
                      {DAYS_OF_WEEK_CN[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="block font-pixel text-xs text-gray-500 mb-1">开始时间</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full border-2 border-black p-2 font-pixel"
                  required
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block font-pixel text-xs text-gray-500 mb-1">结束时间</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full border-2 border-black p-2 font-pixel"
                  required
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block font-pixel text-xs text-gray-500 mb-1">奖励 Token 主题词</label>
                <input
                  type="text"
                  value={rewardKeyword}
                  onChange={e => setRewardKeyword(e.target.value)}
                  placeholder="例如：糖果乐园"
                  className="w-full border-2 border-black p-2 font-pixel"
                  required
                />
              </div>

              <div className="lg:col-span-6 flex justify-end mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                <PixelButton type="submit" variant={editingId ? 'primary' : 'success'} className="w-full md:w-auto py-2 px-8 text-sm">
                  {editingId ? '保存修改' : '创建任务'}
                </PixelButton>
              </div>
            </div>
          </form>
        )}
      </PixelCard>

      {/* 一周网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="flex flex-col h-full">
            <div className="bg-black text-white font-pixel text-center py-1 md:py-2 text-lg md:text-xl border-x-4 border-t-4 border-black">
              {DAYS_OF_WEEK_CN[day]}
            </div>
            <div className="flex-1 bg-white border-4 border-black p-1.5 md:p-2 space-y-1.5 md:space-y-2 shadow-pixel-sm h-full min-h-[120px] md:min-h-[150px]">
              {tasksByDay[day].length === 0 ? (
                <div className="text-center text-gray-400 font-pixel py-4 text-sm">暂无任务</div>
              ) : (
                tasksByDay[day].map(task => (
                  <div
                    key={task.id}
                    className={`
                      relative p-2 border-2 border-black transition-all group
                      ${task.completed ? 'bg-green-100 opacity-70' : 'bg-white hover:bg-yellow-50'}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <div className={`font-bold font-pixel text-base md:text-lg leading-tight mb-1 ${task.completed ? 'line-through' : ''}`}>{task.title}</div>
                        <div className="flex items-center gap-1 text-xs font-pixel text-gray-600 bg-gray-100 w-fit px-1 border border-gray-300">
                          <span>⏰ {task.startTime}-{task.endTime}</span>
                        </div>
                        <div className="text-xs font-pixel text-blue-600 mt-1">🎁 {task.rewardKeyword}</div>
                      </div>

                      <div className="flex flex-col gap-1 items-end relative z-10">
                        <button
                          type="button"
                          onClick={() => onToggleTask(task.id)}
                          className={`
                            w-8 h-8 flex items-center justify-center border-2 border-black shadow-sm mb-1
                            ${task.completed ? 'bg-green-500' : 'bg-white hover:bg-green-100'}
                          `}
                          title="完成任务"
                        >
                          {task.completed && <span className="text-white font-bold">✓</span>}
                        </button>

                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleEditClick(e, task)}
                            className="w-6 h-6 bg-blue-100 border border-black flex items-center justify-center hover:bg-blue-200"
                            title="编辑"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, task.id)}
                            className="w-6 h-6 bg-red-100 border border-black flex items-center justify-center hover:bg-red-200 text-red-600"
                            title="删除"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskScheduler;
