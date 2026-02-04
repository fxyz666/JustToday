
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { TimeBlock, TaskType, TaskStatus, DayTemplate } from '../types';
import { PIXELS_PER_MINUTE, formatTime, getCurrentTimeMinutes, generateId, t, formatDuration } from '../utils';
import { CheckSquare, Square, XSquare, Crosshair, Edit2, Trash2, Loader2, Cloud, Check, Smartphone, Monitor, Tablet, User, Target, AlertTriangle, Layers, FileJson, Save as SaveIcon, Trash, ChevronDown, X, TrendingUp, Coffee, Wrench } from 'lucide-react';

interface Props {
  tasks: TimeBlock[];
  selectedDate: string;
  isToday: boolean;
  onTaskUpdate: (task: TimeBlock) => void;
  onTaskCreate: (task: TimeBlock) => void;
  onTaskEdit: (task: TimeBlock) => void;
  onTaskDelete: (id: string) => void;
  onDropGoal: (e: React.DragEvent, time: number, type: TaskType) => void;
  onCustomDrop: (time: number, type: TaskType) => void;
  onSyncDevices: () => Promise<number>;
  onDragStartTask: (e: React.DragEvent | React.PointerEvent, task: TimeBlock) => void;
  draggingMode: 'goal' | 'task' | null;
  lang: string;
  theme?: 'light' | 'dark';
  globalDragItem?: any;
  dragPosition?: { x: number, y: number } | null;
  
  // Template Props
  templates: DayTemplate[];
  onSaveTemplate: (name: string) => void;
  onOpenTemplateModal: () => void;
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}

// --- LAYOUT CONSTANTS ---
const PLAN_WIDTH_PCT = 50; 
const ACTUAL_WIDTH_PCT = 50; 
const ACTUAL_LEFT_PCT = 50;

// --- STYLE HELPERS ---
const getTaskStyles = (task: TimeBlock, baseColor: string, isDark: boolean) => {
    let borderColor = baseColor; 
    let textColor = isDark ? 'text-gray-200' : 'text-gray-900';
    let iconColor = baseColor;
    let backgroundColor = isDark ? 'rgba(31, 41, 55, 0.85)' : 'rgba(255, 255, 255, 0.95)';
    let timeBadgeBg = isDark ? '#111827' : '#ffffff'; 
    let timeBadgeText = baseColor; 

    switch (task.status) {
        case TaskStatus.FAILED:
            borderColor = '#ef4444';
            textColor = isDark ? 'text-red-200' : 'text-red-900';
            iconColor = '#ef4444';
            backgroundColor = isDark ? 'rgba(127, 29, 29, 0.3)' : 'rgba(254, 242, 242, 0.95)';
            timeBadgeText = '#ef4444';
            break;
        case TaskStatus.COMPLETED:
            textColor = isDark ? 'text-gray-400' : 'text-gray-500';
            break;
    }

    return { borderColor, backgroundColor, textColor, iconColor, timeBadgeBg, timeBadgeText };
};

// --- OPTIMIZED LAYOUT ALGORITHM ---
const calculateLayout = (tasks: TimeBlock[], columnType: TaskType) => {
  const layoutMap = new Map<string, { left: string; width: string; zIndex: number }>();
  const columnTasks = tasks.filter(t => 
    columnType === TaskType.PLAN ? t.type === TaskType.PLAN : t.type !== TaskType.PLAN
  );

  if (columnTasks.length === 0) return layoutMap;

  const sorted = [...columnTasks].sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return b.duration - a.duration; 
  });

  const clusters: TimeBlock[][] = [];
  let currentCluster: TimeBlock[] = [];
  let clusterEnd = -1;

  for (const t of sorted) {
      if (currentCluster.length === 0) {
          currentCluster.push(t);
          clusterEnd = t.startTime + t.duration;
      } else {
          if (t.startTime < clusterEnd) {
              currentCluster.push(t);
              clusterEnd = Math.max(clusterEnd, t.startTime + t.duration);
          } else {
              clusters.push(currentCluster);
              currentCluster = [t];
              clusterEnd = t.startTime + t.duration;
          }
      }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  clusters.forEach(cluster => {
      const lanes: number[] = [];
      const taskLanes = new Map<string, number>();

      cluster.forEach(task => {
          let placed = false;
          for (let i = 0; i < lanes.length; i++) {
              if (task.startTime >= lanes[i]) {
                  lanes[i] = task.startTime + task.duration;
                  taskLanes.set(task.id, i);
                  placed = true;
                  break;
              }
          }
          if (!placed) {
              lanes.push(task.startTime + task.duration);
              taskLanes.set(task.id, lanes.length - 1);
          }
      });

      const numLanes = lanes.length;
      
      cluster.forEach(task => {
          const laneIndex = taskLanes.get(task.id) || 0;
          const widthPct = 100 / numLanes;
          const leftPct = laneIndex * widthPct;
          
          layoutMap.set(task.id, {
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              zIndex: 10 + laneIndex
          });
      });
  });

  return layoutMap;
};

const SchedulePanel: React.FC<Props> = ({ tasks, selectedDate, isToday, onTaskUpdate, onTaskCreate, onTaskEdit, onTaskDelete, onCustomDrop, onSyncDevices, onDragStartTask, draggingMode, lang, theme = 'light', globalDragItem, dragPosition, templates, onSaveTemplate, onOpenTemplateModal, onLoadTemplate, onDeleteTemplate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(getCurrentTimeMinutes());
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [activeOperation, setActiveOperation] = useState<{ 
      id: string; 
      action: 'move' | 'resize-start' | 'resize-end'; 
      startY: number; 
      initialStart: number; 
      initialDuration: number;
      currentStart: number;
      currentDuration: number;
  } | null>(null);

  const [creationStart, setCreationStart] = useState<{ y: number, minutes: number, type: TaskType } | null>(null);
  const [creationCurrent, setCreationCurrent] = useState<number | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'analyzing' | 'syncing' | 'success' | 'error'>('idle');
  const [newItemsCount, setNewItemsCount] = useState(0);

  const snap = (val: number, step: number) => Math.round(val / step) * step;

  const displayTasks = useMemo(() => {
      if (!activeOperation) return tasks;
      return tasks.map(t => {
          if (t.id === activeOperation.id) {
              return {
                  ...t,
                  startTime: activeOperation.currentStart,
                  duration: activeOperation.currentDuration
              };
          }
          return t;
      });
  }, [tasks, activeOperation]);

  const planLayoutMap = useMemo(() => calculateLayout(displayTasks, TaskType.PLAN), [displayTasks]);
  const actualLayoutMap = useMemo(() => calculateLayout(displayTasks, TaskType.ACTUAL), [displayTasks]);

  useEffect(() => {
      const updateWidth = () => {
          if (containerRef.current) {
              setContainerWidth(containerRef.current.clientWidth);
          }
      };
      updateWidth();
      const observer = new ResizeObserver(updateWidth);
      if (containerRef.current) observer.observe(containerRef.current);
      window.addEventListener('resize', updateWidth);
      return () => {
          window.removeEventListener('resize', updateWidth);
          observer.disconnect();
      };
  }, []);

  // Click outside to close menu
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setShowTemplateMenu(false);
          }
      };
      if (showTemplateMenu) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplateMenu]);

  const scrollToNow = () => {
    if (containerRef.current) {
      const scrollTime = Math.max(0, getCurrentTimeMinutes() - 120); 
      containerRef.current.scrollTo({ top: scrollTime * PIXELS_PER_MINUTE, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getCurrentTimeMinutes()), 60000);
    if (isToday) setTimeout(scrollToNow, 100);
    return () => clearInterval(interval);
  }, [isToday]);

  const handleUnifiedSync = async () => {
      if (syncStatus !== 'idle' && syncStatus !== 'success' && syncStatus !== 'error') return;
      try {
          setSyncStatus('analyzing');
          const minTimePromise = new Promise(resolve => setTimeout(resolve, 1000));
          const syncPromise = onSyncDevices();
          setSyncStatus('syncing');
          const [count] = await Promise.all([syncPromise, minTimePromise]);
          setNewItemsCount(count);
          setSyncStatus('success');
          setTimeout(() => {
              setSyncStatus('idle');
              setNewItemsCount(0);
          }, 3000);
      } catch (e) {
          console.error(e);
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 3000);
      }
  };

  const handleTemplateSaveClick = () => {
      onOpenTemplateModal();
      setShowTemplateMenu(false);
  };

  useEffect(() => {
    const handleMove = (clientY: number) => {
        if (activeOperation) {
            const deltaY = clientY - activeOperation.startY;
            const deltaMinutes = deltaY / PIXELS_PER_MINUTE;
            const snappedDelta = Math.round(deltaMinutes / 5) * 5; 
            
            let newStart = activeOperation.initialStart;
            let newDuration = activeOperation.initialDuration;
            
            if (activeOperation.action === 'move') {
                newStart = activeOperation.initialStart + snappedDelta;
                newStart = Math.max(0, newStart);
                newStart = Math.min(newStart, 24 * 60 - newDuration); 
            } else if (activeOperation.action === 'resize-start') {
                newStart = activeOperation.initialStart + snappedDelta;
                newDuration = activeOperation.initialDuration - snappedDelta;
                if (newDuration < 15) {
                    newDuration = 15;
                    newStart = activeOperation.initialStart + activeOperation.initialDuration - 15;
                }
                newStart = Math.max(0, newStart);
            } else if (activeOperation.action === 'resize-end') {
                newDuration = activeOperation.initialDuration + snappedDelta;
                if (newDuration < 15) newDuration = 15;
                if (newStart + newDuration > 24 * 60) newDuration = 24 * 60 - newStart;
            }
            
            if (newStart !== activeOperation.currentStart || newDuration !== activeOperation.currentDuration) {
                setActiveOperation(prev => prev ? ({ ...prev, currentStart: newStart, currentDuration: newDuration }) : null);
            }
            return;
        }

        if (creationStart && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const scrollTop = containerRef.current.scrollTop;
            
            // ADJUST FOR PADDING
            const computedStyle = window.getComputedStyle(containerRef.current);
            const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
            
            const currentY = clientY - rect.top + scrollTop - paddingTop;
            setCreationCurrent(currentY);
        }
    };

    const handleWindowUp = (e: MouseEvent | TouchEvent) => {
      if (activeOperation) {
        const originalTask = tasks.find(t => t.id === activeOperation.id);
        if (originalTask) {
            if (originalTask.startTime !== activeOperation.currentStart || originalTask.duration !== activeOperation.currentDuration) {
                onTaskUpdate({
                    ...originalTask,
                    startTime: activeOperation.currentStart,
                    duration: activeOperation.currentDuration
                });
            }
        }
        setActiveOperation(null);
      }
      if (creationStart) {
        if (creationStart && creationCurrent !== null) {
            setCreationStart(null);
            setCreationCurrent(null);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const handleMouseUp = (e: MouseEvent) => handleWindowUp(e);
    const handleTouchMove = (e: TouchEvent) => {
        if (activeOperation || creationStart) {
            e.preventDefault(); 
            handleMove(e.touches[0].clientY);
        }
    };
    const handleTouchEnd = (e: TouchEvent) => handleWindowUp(e);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeOperation, creationStart, creationCurrent, tasks, onTaskUpdate]);

  const handleContainerUp = (e: React.MouseEvent | React.TouchEvent) => {
      if (creationStart && creationCurrent !== null) {
        const startY = Math.min(creationStart.y, creationCurrent);
        const endY = Math.max(creationStart.y, creationCurrent);
        let durationPx = endY - startY;
        let durationMins = Math.floor(durationPx / PIXELS_PER_MINUTE);
        durationMins = snap(Math.max(15, durationMins), 15);
        
        const newTask: TimeBlock = {
          id: generateId(),
          title: t('newTask', lang),
          date: selectedDate,
          startTime: creationStart.minutes,
          duration: durationMins,
          type: creationStart.type,
          status: creationStart.type === TaskType.PLAN ? TaskStatus.TODO : TaskStatus.COMPLETED,
          color: creationStart.type === TaskType.PLAN ? '#6366f1' : '#3b82f6',
          origin: 'user',
          createdAt: Date.now(),
          deviceSource: creationStart.type === TaskType.ACTUAL ? undefined : undefined 
        };
        
        if (durationPx < 10) newTask.duration = 30;
        
        onTaskCreate(newTask);
        if (durationPx < 10) onTaskEdit(newTask);
        
        setCreationStart(null);
        setCreationCurrent(null);
      }
  };

  const startOperation = (e: React.MouseEvent | React.TouchEvent, id: string, action: 'move' | 'resize-start' | 'resize-end', initialStart: number, initialDuration: number) => {
    e.stopPropagation();
    if (!('touches' in e)) e.preventDefault();

    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setActiveOperation({ 
        id, 
        action, 
        startY: clientY, 
        initialStart, 
        initialDuration,
        currentStart: initialStart,
        currentDuration: initialDuration
    });
  };

  const renderUnifiedConnectors = () => {
    if (containerWidth === 0) return null;

    const planTasks = displayTasks.filter(t => t.type === TaskType.PLAN);
    const planColWidth = containerWidth * (PLAN_WIDTH_PCT / 100);
    const actualColStart = containerWidth * (ACTUAL_LEFT_PCT / 100);

    return planTasks.map(plan => {
      if (plan.status === TaskStatus.TODO) return null;

      const relatedActual = displayTasks.find(t => t.relatedPlanId === plan.id);
      if (!relatedActual) return null;

      const pTop = plan.startTime * PIXELS_PER_MINUTE;
      const pBottom = (plan.startTime + plan.duration) * PIXELS_PER_MINUTE;
      const aTop = relatedActual.startTime * PIXELS_PER_MINUTE;
      const aBottom = (relatedActual.startTime + relatedActual.duration) * PIXELS_PER_MINUTE;

      const isHovered = hoveredRelationId === plan.id || hoveredRelationId === relatedActual.id;
      
      const planLayout = planLayoutMap.get(plan.id);
      const actualLayout = actualLayoutMap.get(relatedActual.id);
      if(!planLayout || !actualLayout) return null;

      const pLeftPct = parseFloat(planLayout.left);
      const pWidthPct = parseFloat(planLayout.width);
      const pRightX = ((pLeftPct + pWidthPct) / 100) * planColWidth - 4; 

      const aLeftPct = parseFloat(actualLayout.left);
      const aLeftX = actualColStart + ((aLeftPct / 100) * planColWidth) + 4; 

      const smoothing = (aLeftX - pRightX) * 0.5;
      
      const pathD = `M ${pRightX} ${pTop} C ${pRightX + smoothing} ${pTop}, ${aLeftX - smoothing} ${aTop}, ${aLeftX} ${aTop} L ${aLeftX} ${aBottom} C ${aLeftX - smoothing} ${aBottom}, ${pRightX + smoothing} ${pBottom}, ${pRightX} ${pBottom} Z`;

      return (
        <path 
            key={`ribbon-${plan.id}`} 
            d={pathD} 
            fill={plan.color || '#6366f1'} 
            fillOpacity={isHovered ? 0.5 : 0.3} // Increased from 0.3/0.15
            stroke={plan.color || '#6366f1'} 
            strokeWidth={isHovered ? 2 : 1} // Increased from 1.5/0.5
            strokeOpacity={isHovered ? 1 : 0.6} // Increased from 0.8/0.2
            className="transition-all duration-300 ease-in-out pointer-events-none" 
        />
      );
    });
  };

  const renderDeviceIcon = (source?: string) => {
      switch(source) {
          case 'mobile': return <Smartphone size={10} />;
          case 'tablet': return <Tablet size={10} />;
          case 'desktop': return <Monitor size={10} />;
          default: return <User size={10} />;
      }
  };

  const renderSyncButton = () => {
      const isLoading = syncStatus === 'analyzing' || syncStatus === 'syncing';
      return (
        <button 
            onClick={(e) => { e.stopPropagation(); handleUnifiedSync(); }} 
            disabled={isLoading} 
            className={`flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs font-medium transition-all active:scale-95 ${
                syncStatus === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                syncStatus === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300'
            }`}
        >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : syncStatus === 'success' ? <Check size={14} /> : syncStatus === 'error' ? <AlertTriangle size={14} /> : <Cloud size={14} />}
            <span className="hidden sm:inline">{isLoading ? t('syncing', lang) : syncStatus === 'success' ? (newItemsCount > 0 ? `${newItemsCount} ${t('newItems', lang)}` : t('upToDate', lang)) : syncStatus === 'error' ? 'Failed' : t('syncData', lang)}</span>
        </button>
      );
  };
  
  const renderTemplateButton = () => {
      return (
          <div className="relative" ref={menuRef}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowTemplateMenu(!showTemplateMenu); }} 
                className={`flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs font-medium transition-all active:scale-95 ${showTemplateMenu ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                title={lang === 'zh-CN' ? '日程模板' : 'Daily Templates'}
              >
                  <FileJson size={14} />
                  <span className="hidden sm:inline">{lang === 'zh-CN' ? '模板' : 'Templates'}</span>
                  <ChevronDown size={12} className={`transform transition-transform ${showTemplateMenu ? 'rotate-180' : ''}`}/>
              </button>
              
              {showTemplateMenu && (
                  <div className="absolute top-full right-[-50px] md:right-0 mt-2 w-52 md:w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                        <div className="p-3 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleTemplateSaveClick(); }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm active:scale-95"
                            >
                                <SaveIcon size={14} /> {t('saveTemplate', lang)}
                            </button>
                        </div>
                        
                        <div className="p-2 space-y-1 max-h-[240px] overflow-y-auto custom-scrollbar">
                            <h4 className="px-2 py-1 text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider">
                                {lang === 'zh-CN' ? '我的模板' : 'My Templates'}
                            </h4>
                            
                            {templates.length === 0 ? (
                                <div className="px-4 py-6 text-center border-2 border-dashed border-gray-100 dark:border-gray-700/50 rounded-lg mx-1">
                                    <FileJson size={20} className="mx-auto text-gray-300 dark:text-gray-600 mb-2"/>
                                    <p className="text-gray-400 dark:text-gray-500 text-xs italic">{lang === 'zh-CN' ? '暂无模板' : 'No templates'}</p>
                                </div>
                            ) : (
                                templates.map(tpl => (
                                    <div key={tpl.id} className="group flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer" onClick={() => { onLoadTemplate(tpl.id); setShowTemplateMenu(false); }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-medium text-xs text-gray-700 dark:text-gray-200 truncate">{tpl.name}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <Layers size={10}/> {tpl.tasks.length} {lang === 'zh-CN' ? '个任务' : 'tasks'}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteTemplate(tpl.id); }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title={t('deleteTemplate', lang)}
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                  </div>
              )}
          </div>
      );
  };

  const handleMouseDown = (e: React.MouseEvent, type: TaskType) => {
      if (e.target !== e.currentTarget) return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollTop = containerRef.current.scrollTop;
      
      // ADJUST FOR PADDING: 
      // If we added padding to the container, coordinate 0 is inside the padding box.
      // The content (relative div) is offset by padding-top.
      const computedStyle = window.getComputedStyle(containerRef.current);
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

      const y = e.clientY - rect.top + scrollTop - paddingTop;
      const minutes = Math.floor(y / PIXELS_PER_MINUTE);
      const snappedMinutes = snap(minutes, 15);
      setCreationStart({ y: y, minutes: snappedMinutes, type });
      setCreationCurrent(y);
  };

  const renderTaskContent = (task: TimeBlock, styles: any, isShort: boolean, isPlan: boolean) => {
      const DeviceIcon = task.deviceSource === 'mobile' ? Smartphone : task.deviceSource === 'tablet' ? Tablet : task.deviceSource === 'desktop' ? Monitor : null;
      
      const isVeryShort = task.duration <= 15;
      const showDetails = task.duration >= 45;
      const timeRange = `${formatTime(task.startTime)} - ${formatTime(task.startTime + task.duration)}`;
      
      return (
        <div className="flex-1 min-w-0 flex flex-col h-full relative z-10">
            {/* Header Row */}
            <div className={`flex items-center gap-1.5 min-w-0 ${isVeryShort ? 'h-full' : 'mt-0.5'}`}>
                {/* Priority Dot */}
                {isPlan && task.priority === 'high' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-sm" title={t('high', lang)} />
                )}
                
                {/* Title: Optimized text wrapping */}
                <span className={`text-xs font-bold leading-tight flex-1 ${isVeryShort ? 'truncate' : 'whitespace-normal break-words line-clamp-2 md:line-clamp-none'}`} style={{ color: styles.textColor }}>
                    {task.title || t('newTask', lang)}
                </span>
                
                {/* Icons (Device / Goal) */}
                <div className="flex items-center gap-1 shrink-0 opacity-70">
                    {task.type !== TaskType.PLAN && DeviceIcon && (
                        <DeviceIcon size={10} className="text-gray-500 dark:text-gray-400" />
                    )}
                     {/* Goal Indicator (Small colored dot) */}
                     {task.goalId && !isShort && (
                        <div className="w-2 h-2 rounded-full ring-1 ring-white dark:ring-gray-700 shadow-sm" style={{ backgroundColor: task.color }} title="Linked to Goal"></div>
                    )}
                </div>
            </div>
            
            {/* Sub-header (Time & Duration) - Hide on very short cards */}
            {!isVeryShort && (
                <div className="flex items-center gap-2 mt-0.5 min-w-0 text-[10px] font-medium opacity-80" style={{ color: styles.textColor }}>
                    <span className="opacity-90">{formatDuration(task.duration, lang)}</span>
                    <span className="opacity-60 text-[9px] font-mono tracking-tight hidden sm:inline">{timeRange}</span>
                </div>
            )}
            
            {/* Description / Notes - Only for taller cards */}
            {!isShort && showDetails && task.description && (
                 <div className="mt-1 text-[10px] opacity-70 truncate leading-snug pr-2 border-l-2 border-current pl-1.5 py-0.5" style={{ borderColor: styles.borderColor + '40', color: styles.textColor }}>
                     {task.description}
                 </div>
            )}

            {/* Time Value Badge (Investment/Consumption) - Bottom Right for large cards */}
            {showDetails && task.timeValue && task.timeValue !== 'maintenance' && (
                <div className={`absolute bottom-0 right-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-tl-md opacity-90 ${task.timeValue === 'investment' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'}`}>
                    {task.timeValue === 'investment' ? '$' : 'C'}
                </div>
            )}
        </div>
      );
  };

  const getRelatedId = (t: TimeBlock) => {
      if (t.type === TaskType.PLAN) {
          return displayTasks.find(dt => dt.relatedPlanId === t.id)?.id;
      }
      return t.relatedPlanId;
  };

  const renderTaskBlock = (task: TimeBlock, layoutMap: Map<string, { left: string; width: string; zIndex: number }>) => {
    const isPlan = task.type === TaskType.PLAN;
    const isShort = task.duration < 30;
    const isDragging = activeOperation?.id === task.id;
    const currentTask = isDragging ? { ...task, startTime: activeOperation.currentStart, duration: activeOperation.currentDuration } : task;
    const relatedId = getRelatedId(task);
    const isHoveredRelation = hoveredRelationId === task.id || (relatedId && hoveredRelationId === relatedId);
    const styles = getTaskStyles(currentTask, currentTask.color || '#6366f1', theme === 'dark');
    const layout = layoutMap.get(task.id) || { left: '0%', width: '100%', zIndex: 10 };

    const outerStyle: React.CSSProperties = {
        top: currentTask.startTime * PIXELS_PER_MINUTE, 
        height: Math.max(currentTask.duration * PIXELS_PER_MINUTE, 24),
        left: layout.left,
        width: `calc(${layout.width} - 6px)`,
        marginLeft: '3px',
        zIndex: isDragging ? 100 : (isHoveredRelation ? 60 : layout.zIndex),
        pointerEvents: 'auto', 
    };

    const cardStyle: React.CSSProperties = {
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        borderWidth: '1px', 
        borderLeftWidth: '3px',
        borderStyle: currentTask.origin === 'user' ? 'dashed' : 'solid',
    };

    return (
      <div key={task.id} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onMouseEnter={() => setHoveredRelationId(task.id)} onMouseLeave={() => setHoveredRelationId(null)} onDoubleClick={(e) => { e.stopPropagation(); onTaskEdit(task); }} className="absolute group z-10 hover:z-50 flex flex-col transition-all duration-150 ease-out" style={outerStyle}>
        <div className="absolute -top-3 left-0 w-full h-6 z-30 cursor-ns-resize flex items-center justify-center group/handle select-none" onMouseDown={(e) => startOperation(e, task.id, 'resize-start', currentTask.startTime, currentTask.duration)} onTouchStart={(e) => startOperation(e, task.id, 'resize-start', currentTask.startTime, currentTask.duration)}>
            <div className="absolute top-3 left-0 w-full h-[2px] pointer-events-none transition-all duration-200" style={{ backgroundColor: styles.borderColor, borderStyle: currentTask.origin === 'user' ? 'dashed' : 'solid', height: isHoveredRelation ? '3px' : '2px', opacity: isHoveredRelation ? 1 : 0.8 }} />
            <div className="px-1.5 rounded text-[10px] font-mono font-bold leading-none select-none z-10 relative transition-all hover:scale-110 shadow-sm" style={{ backgroundColor: styles.timeBadgeBg, color: styles.timeBadgeText, border: `1px solid ${styles.borderColor}`, opacity: isHoveredRelation ? 1 : 0.8 }}>{formatTime(currentTask.startTime)}</div>
        </div>

        <div 
            className={`flex-1 w-full overflow-hidden transition-all duration-200 relative flex flex-row items-start pt-1.5 pb-0.5 px-2 gap-1.5 cursor-move rounded-md ${isHoveredRelation ? 'shadow-md ring-1 ring-inset ring-opacity-20' : ''} ${'shadow-sm'}`} 
            style={{ ...cardStyle, boxShadow: isHoveredRelation ? `0 0 10px -2px ${styles.borderColor}` : '0 1px 2px rgba(0,0,0,0.05)' }} 
            onMouseDown={(e) => startOperation(e, task.id, 'move', currentTask.startTime, currentTask.duration)} 
            onTouchStart={(e) => startOperation(e, task.id, 'move', currentTask.startTime, currentTask.duration)}
        >
            {isPlan && (
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); const nextStatus = task.status === TaskStatus.TODO ? TaskStatus.COMPLETED : task.status === TaskStatus.COMPLETED ? TaskStatus.FAILED : TaskStatus.TODO; onTaskUpdate({ ...task, status: nextStatus }); }} className={`hover:scale-110 transition-transform focus:outline-none pointer-events-auto z-20 shrink-0 mt-0.5`}>
                    {task.status === TaskStatus.COMPLETED ? <CheckSquare size={14} color={styles.iconColor} /> : task.status === TaskStatus.FAILED ? <XSquare size={14} color={styles.iconColor} /> : <Square size={14} color={styles.iconColor} strokeWidth={2} />}
                </button>
            )}

            {renderTaskContent(currentTask, styles, isShort, isPlan)}

            <div className="absolute top-1 right-1 hidden group-hover:flex gap-1 bg-white/90 dark:bg-gray-800/90 rounded-md shadow-sm p-0.5 border border-gray-200 dark:border-gray-600 z-40 pointer-events-auto">
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onTaskEdit(task); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400 rounded"><Edit2 size={10} /></button>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onTaskDelete(task.id); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 rounded"><Trash2 size={10} /></button>
            </div>
        </div>

        <div className="absolute -bottom-3 left-0 w-full h-6 z-30 cursor-ns-resize flex items-center justify-center group/handle select-none" onMouseDown={(e) => startOperation(e, task.id, 'resize-end', currentTask.startTime, currentTask.duration)} onTouchStart={(e) => startOperation(e, task.id, 'resize-end', currentTask.startTime, currentTask.duration)}>
             <div className="absolute top-3 left-0 w-full h-[2px] pointer-events-none transition-all duration-200" style={{ backgroundColor: styles.borderColor, borderStyle: currentTask.origin === 'user' ? 'dashed' : 'solid', height: isHoveredRelation ? '3px' : '2px', opacity: isHoveredRelation ? 1 : 0.8 }} />
             <div className="px-1.5 rounded text-[10px] font-mono font-bold leading-none select-none z-10 relative transition-all hover:scale-110 shadow-sm" style={{ backgroundColor: styles.timeBadgeBg, color: styles.timeBadgeText, border: `1px solid ${styles.borderColor}`, opacity: isHoveredRelation ? 1 : 0.8 }}>{formatTime(currentTask.startTime + currentTask.duration)}</div>
        </div>
      </div>
    );
  };

  const renderTimeColumn = () => {
    const hours = Array.from({ length: 25 }, (_, i) => i);
    return (
      <>
        {hours.map(h => (
          <div key={h} className="absolute w-full flex items-center justify-center text-[10px] text-gray-400 font-medium select-none" style={{ top: h * 60 * PIXELS_PER_MINUTE - 6, height: 12 }}>
            {h.toString().padStart(2, '0')}:00
          </div>
        ))}
      </>
    );
  };

  const renderGridLines = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return (
      <>
        {hours.map(h => (
          <div key={h} className="absolute w-full border-t border-gray-100 dark:border-gray-800" style={{ top: h * 60 * PIXELS_PER_MINUTE }}></div>
        ))}
        {hours.map(h => (
          <div key={`half-${h}`} className="absolute w-full border-t border-gray-50 dark:border-gray-800/50 border-dashed" style={{ top: (h * 60 + 30) * PIXELS_PER_MINUTE }}></div>
        ))}
      </>
    );
  };

  const renderExternalDropGhost = () => {
    if (!globalDragItem || !dragPosition || !containerRef.current) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    
    // ADJUST FOR PADDING
    const computedStyle = window.getComputedStyle(containerRef.current);
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

    const relativeY = dragPosition.y - rect.top + scrollTop - paddingTop;
    const minutes = Math.floor(relativeY / PIXELS_PER_MINUTE);
    const snappedMinutes = snap(minutes, 15);
    
    const relativeX = dragPosition.x - rect.left;
    const isActualCol = (relativeX / rect.width) > (ACTUAL_LEFT_PCT / 100); 
    
    if (relativeY < 0) return null;

    const top = snappedMinutes * PIXELS_PER_MINUTE;
    const height = 60 * PIXELS_PER_MINUTE; 
    
    const left = isActualCol ? `${ACTUAL_LEFT_PCT}%` : '0%';
    const width = isActualCol ? `${ACTUAL_WIDTH_PCT}%` : `${PLAN_WIDTH_PCT}%`;

    return (
      <div 
        className="absolute z-50 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/30 pointer-events-none flex items-center justify-center"
        style={{ 
            top, 
            height, 
            left, 
            width,
            transition: 'top 0.1s ease-out'
        }}
      >
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">
            {formatTime(snappedMinutes)} - {formatTime(snappedMinutes + 60)}
        </span>
      </div>
    );
  };

  const renderCreationGhost = () => {
    if (!creationStart || creationCurrent === null) return null;
    
    const startY = Math.min(creationStart.y, creationCurrent);
    const endY = Math.max(creationStart.y, creationCurrent);
    let height = Math.max(endY - startY, 15 * PIXELS_PER_MINUTE);
    
    const durationMins = Math.round(height / PIXELS_PER_MINUTE / 15) * 15;
    const snappedHeight = Math.max(durationMins, 15) * PIXELS_PER_MINUTE;

    return (
        <div 
            className="absolute z-50 rounded-lg bg-indigo-500/20 border border-indigo-500/50 pointer-events-none"
            style={{
                top: creationStart.minutes * PIXELS_PER_MINUTE,
                height: snappedHeight,
                left: 2,
                right: 2
            }}
        >
            <div className="absolute -right-12 top-0 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                {formatDuration(Math.max(durationMins, 15), lang)}
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden relative transition-colors duration-300">
      
      {/* HEADER: Schedule View - Optimized Layout */}
      <div className="h-12 border-b border-gray-200 dark:border-gray-700/50 flex items-center bg-white dark:bg-gray-900 z-[60] relative shadow-sm shrink-0">
        
        {/* TIME COLUMN HEADER */}
        <div className="w-12 md:w-14 h-full flex items-center justify-center border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">
            {t('time', lang)}
        </div>
        
        {/* PLAN COLUMN HEADER */}
        <div className="flex-1 h-full flex items-center justify-between px-3 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200 dark:shadow-none"></div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wide uppercase truncate">{t('plan', lang)}</span>
            </div>
            <div className="shrink-0 ml-2">
                {renderTemplateButton()}
            </div>
        </div>

        {/* ACTUAL COLUMN HEADER */}
        <div className="flex-1 h-full flex items-center justify-between px-3 bg-white dark:bg-gray-900">
             <div className="flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-200 dark:shadow-none"></div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wide uppercase truncate">{t('actual', lang)}</span>
            </div>
            <div className="shrink-0 ml-2">
                {renderSyncButton()}
            </div>
        </div>
      </div>

      <div id="schedule-scroll-container" ref={containerRef} onMouseUp={handleContainerUp} onTouchEnd={handleContainerUp} className="flex-1 overflow-y-auto relative touch-pan-y bg-white dark:bg-gray-900 custom-scrollbar pt-2 pb-32 md:pb-0">
        <div className="relative min-h-[2304px] flex"> 
            <div className="w-12 md:w-14 flex-none border-r border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 relative z-30 select-none">
                {renderTimeColumn()}
                {isToday && (<div className="absolute right-0 translate-x-1/2 z-40 pointer-events-none flex items-center justify-center" style={{ top: currentTime * PIXELS_PER_MINUTE }}><div className="w-2 h-2 rounded-full bg-red-500 shadow-sm"></div><span className="absolute right-3 bg-red-500 text-white text-[9px] px-1 rounded shadow-sm opacity-90 font-mono">{formatTime(currentTime)}</span></div>)}
            </div>
            <div className="flex-1 flex relative">
                {renderGridLines()}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5] overflow-visible" viewBox={`0 0 ${containerWidth} 2304`} preserveAspectRatio="none">{renderUnifiedConnectors()}</svg>
                {renderExternalDropGhost()}
                <div className={`absolute top-0 bottom-0 left-0 transition-colors duration-300 ${draggingMode ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`} style={{ width: `${PLAN_WIDTH_PCT}%`, backgroundImage: 'linear-gradient(45deg, rgba(99, 102, 241, 0.03) 25%, transparent 25%, transparent 50%, rgba(99, 102, 241, 0.03) 50%, rgba(99, 102, 241, 0.03) 75%, transparent 75%, transparent)', backgroundSize: '20px 20px' }} onMouseDown={(e) => handleMouseDown(e, TaskType.PLAN)}>
                     {creationStart?.type === TaskType.PLAN && renderCreationGhost()}
                     {displayTasks.filter(t => t.type === TaskType.PLAN).map(t => renderTaskBlock(t, planLayoutMap))}
                </div>
                <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${ACTUAL_LEFT_PCT}%`, width: `${ACTUAL_WIDTH_PCT}%` }}>
                     <div className="absolute inset-0 pointer-events-auto" onMouseDown={(e) => handleMouseDown(e, TaskType.ACTUAL)}>
                        {creationStart?.type === TaskType.ACTUAL && renderCreationGhost()}
                     </div>
                     {displayTasks.filter(t => t.type !== TaskType.PLAN).map(t => renderTaskBlock(t, actualLayoutMap))}
                </div>
                {isToday && <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentTime * PIXELS_PER_MINUTE }}><div className="w-full h-[1px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div></div>}
            </div>
        </div>
      </div>
      {isToday && (
        <button onClick={scrollToNow} className="absolute bottom-4 right-4 p-3 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-300 hover:bg-indigo-700 transition-all z-30 flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 active:scale-95" title={t('jumpToToday', lang)}>
          <Crosshair size={20} />
        </button>
      )}
    </div>
  );
};

export default SchedulePanel;
