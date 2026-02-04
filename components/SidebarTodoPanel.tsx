
import React, { useState } from 'react';
import { Goal, TimeBlock, Milestone } from '../types';
import { Target, GripVertical, Plus, Inbox, Circle, LayoutList, Copy, Sparkles, Clock, ChevronDown, ChevronRight, CheckCircle2, Crosshair, ChevronUp } from 'lucide-react';
import { t, calculateGoalProgress, formatDuration } from '../utils';

interface Props {
  goals: Goal[];
  tasks?: TimeBlock[];
  unscheduledTasks: TimeBlock[];
  onDragStartGoal: (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, goal: Goal, milestone?: Milestone) => void;
  onDragStartTask: (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, task: TimeBlock) => void;
  onAddUnscheduledTask: () => void;
  lang: string;
  isMobile?: boolean;
  hideGoals?: boolean;
  hideHeader?: boolean;
}

const SidebarTodoPanel: React.FC<Props> = ({ goals, tasks = [], unscheduledTasks, onDragStartGoal, onDragStartTask, onAddUnscheduledTask, lang, isMobile = false, hideGoals = false, hideHeader = false }) => {
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});

  // FILTER LOGIC:
  // 1. Exclude Objectives (Principle layer)
  // 2. Exclude COMPLETED goals (100%) to keep the list "Active"
  const actionableGoals = goals.filter(g => {
      if (g.layer === 'principle') return false;
      const { percentage } = calculateGoalProgress(g, tasks);
      return percentage < 100;
  });

  const toggleExpand = (id: string) => {
      setExpandedGoals(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={`h-full flex flex-col overflow-hidden transition-colors duration-300 ${isMobile ? 'text-xs bg-transparent' : 'bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm'}`}>
      
      {/* Global Header - Hidden on Mobile if we want a cleaner split view */}
      {!isMobile && (
        <div className="px-4 py-3.5 flex items-center justify-between shrink-0 border-b border-gray-100 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80">
            <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <LayoutList size={18} />
                </div>
                <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm tracking-tight">{t('todoList', lang)}</h2>
            </div>
            {/* Desktop Add Button position */}
            <button 
                onClick={onAddUnscheduledTask}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                title={t('addToInbox', lang)}
            >
                <Plus size={18} />
            </button>
        </div>
      )}

      <div className={`overflow-y-auto flex-1 custom-scrollbar ${isMobile ? 'p-2 space-y-4 pb-20' : 'p-2 space-y-4'}`}>
          
          {/* SECTION 1: KEY RESULTS (Projects) */}
          {!hideGoals && (
            <div className="space-y-2">
                <h3 className={`px-1 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center justify-between ${isMobile ? 'text-[10px]' : 'text-[10px]'}`}>
                    <span className="flex items-center gap-1.5"><Crosshair size={isMobile ? 12 : 12} /> {t('goalsPlan', lang)}</span>
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded text-[9px] min-w-[18px] text-center">{actionableGoals.length}</span>
                </h3>

                <div className="flex flex-col gap-2">
                {actionableGoals.map(goal => {
                const { current, target, percentage, labelKey } = calculateGoalProgress(goal, tasks);
                const hasMilestones = goal.milestones && goal.milestones.length > 0;
                const isExpanded = expandedGoals[goal.id];
                const isDone = percentage >= 100;

                return (
                    <div key={goal.id} className={`bg-white dark:bg-gray-800 rounded-xl border transition-all overflow-hidden ${isMobile ? 'shadow-sm border-gray-100 dark:border-gray-700' : 'bg-white/60 dark:bg-gray-800/60 border-transparent hover:border-indigo-100 dark:hover:border-indigo-800'}`}>
                        {/* Goal Header */}
                        <div
                            onClick={() => hasMilestones && toggleExpand(goal.id)}
                            className={`group relative p-3 flex flex-col gap-2 select-none ${hasMilestones ? 'cursor-pointer' : ''} ${isMobile ? 'active:bg-gray-50 dark:active:bg-gray-700/50' : 'hover:bg-white dark:hover:bg-gray-800 hover:shadow-md'}`}
                        >
                            <div className="flex items-center gap-3">
                                {/* Color Indicator */}
                                <div
                                    className={`w-1.5 h-8 rounded-full shrink-0 shadow-sm opacity-90 ${isDone ? 'bg-emerald-500' : ''}`}
                                    style={{ backgroundColor: isDone ? undefined : goal.color }}
                                ></div>
                                
                                <div className="flex-1 min-w-0 pointer-events-none">
                                    <h3 className={`font-semibold truncate leading-tight ${isMobile ? 'text-xs mb-1' : 'text-xs mb-0.5'} ${isDone ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}`}>{goal.title}</h3>
                                    
                                    {/* Progress Bar & Stats */}
                                    <div className="flex items-center gap-2 w-full">
                                        <div className="h-1.5 flex-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full opacity-80 transition-all duration-500" 
                                                style={{ width: `${percentage}%`, backgroundColor: isDone ? '#10b981' : goal.color }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono tabular-nums leading-none whitespace-nowrap">
                                            {percentage}%
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Controls */}
                                <div className="flex items-center gap-1">
                                    {/* Drag Handle for Goals (Only if no milestones) */}
                                    {!hasMilestones && !isDone && (
                                        <div 
                                            onMouseDown={(e) => onDragStartGoal(e, goal)} 
                                            onTouchStart={(e) => onDragStartGoal(e, goal)}
                                            style={{ touchAction: 'none' }} // PREVENTS SCROLLING ON MOBILE
                                            className="p-2 text-gray-300 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                            title="Drag to plan"
                                        >
                                            <GripVertical size={isMobile ? 18 : 16} />
                                        </div>
                                    )}

                                    {hasMilestones && (
                                        <div className={`p-1 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sub-Goals (Milestones) List */}
                        {hasMilestones && isExpanded && (
                            <div className="bg-gray-50/50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-700/50">
                                <div className="px-3 py-2 space-y-1">
                                    {goal.milestones!.map(m => (
                                        <div 
                                            key={m.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all group/sub"
                                        >
                                            <div className={`shrink-0 ${m.isCompleted ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                                {m.isCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                                            </div>
                                            <div className={`flex-1 min-w-0 text-gray-600 dark:text-gray-300 truncate leading-snug ${isMobile ? 'text-[11px]' : 'text-xs'} ${m.isCompleted ? 'line-through opacity-60' : ''}`}>
                                                {m.title}
                                            </div>
                                            
                                            {/* Sub-item Drag Handle */}
                                            {!m.isCompleted && (
                                                <div 
                                                    onMouseDown={(e) => onDragStartGoal(e, goal, m)}
                                                    onTouchStart={(e) => onDragStartGoal(e, goal, m)}
                                                    style={{ touchAction: 'none' }} // PREVENTS SCROLLING ON MOBILE
                                                    className="text-gray-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                >
                                                    <GripVertical size={14} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
                })}
                </div>

                {actionableGoals.length === 0 && (
                    <div className="px-4 py-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700/50 rounded-xl bg-white/30 dark:bg-gray-800/30">
                        <p className="text-gray-400 dark:text-gray-500 text-[10px] italic">{t('noData', lang)}</p>
                    </div>
                )}
            </div>
          )}

          {/* SECTION 2: INBOX (TASKS) */}
          <div className="space-y-2 h-full flex flex-col">
             {!hideHeader && (
                <div className={`flex items-center justify-between px-1 ${isMobile ? 'mt-2' : ''}`}>
                    <h3 className={`font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5 ${isMobile ? 'text-[10px]' : 'text-[10px]'}`}>
                        <Inbox size={isMobile ? 12 : 12} /> {t('inbox', lang)}
                    </h3>
                    
                    <div className="flex items-center gap-2">
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded text-[9px] min-w-[18px] text-center">{unscheduledTasks.length}</span>
                        {/* Mobile Inbox Add Button inside header (Only if header is shown and isMobile is true) */}
                        {isMobile && (
                            <button 
                                onClick={onAddUnscheduledTask}
                                className="w-5 h-5 flex items-center justify-center rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 active:scale-95 transition-all shadow-sm"
                            >
                                <Plus size={12} />
                            </button>
                        )}
                    </div>
                </div>
             )}
             
             <div className="flex flex-col gap-2 flex-1 min-h-0">
             {unscheduledTasks.map(task => (
                 <div
                    key={task.id}
                    className={`group relative rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 shadow-sm hover:shadow-md transition-all flex items-center gap-3 select-none overflow-hidden ${isMobile ? 'p-3' : 'px-3 py-2.5 hover:-translate-y-0.5'}`}
                 >
                    <div className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors shrink-0">
                        <Circle size={isMobile ? 14 : 14} strokeWidth={2} />
                    </div>
                    
                    <div className="flex-1 min-w-0 pointer-events-none">
                        <div className="flex flex-col gap-0.5">
                            <h3 className={`font-medium text-gray-800 dark:text-gray-200 truncate leading-snug ${isMobile ? 'text-xs' : 'text-xs'}`}>{task.title || t('newTask', lang)}</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1 shrink-0 bg-gray-50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                                    <Clock size={9} /> {formatDuration(task.duration, lang)}
                                </span>
                                {task.description && <span className="text-[10px] text-gray-300 dark:text-gray-600 truncate max-w-[100px]">{task.description}</span>}
                            </div>
                        </div>
                    </div>
                    
                    {/* Dedicated Drag Handle for Inbox Tasks */}
                    <div 
                        onMouseDown={(e) => onDragStartTask(e, task)}
                        onTouchStart={(e) => onDragStartTask(e, task)}
                        style={{ touchAction: 'none' }} // PREVENTS SCROLLING ON MOBILE
                        className={`text-gray-300 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700`}
                        title="Drag to schedule"
                    >
                         <GripVertical size={isMobile ? 18 : 16} />
                    </div>
                 </div>
             ))}
             </div>

             {unscheduledTasks.length === 0 && (
                 <div className="mx-0 py-8 text-center text-gray-400 dark:text-gray-500 text-xs flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 dark:border-gray-700/50 rounded-xl bg-white/30 dark:bg-gray-800/30">
                     <Sparkles size={16} className="opacity-50 text-indigo-300"/>
                     <span>{t('noUnscheduled', lang)}</span>
                 </div>
             )}
          </div>
          
      </div>
    </div>
  );
};

export default SidebarTodoPanel;
