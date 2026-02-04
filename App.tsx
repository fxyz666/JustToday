
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LayoutDashboard, Calendar, Settings, Smartphone, Laptop, Tablet, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, BarChart2, Sun, Moon, Languages, Target, Inbox, ListTodo, FileJson, Save as SaveIcon, X, Plus, LayoutList } from 'lucide-react';
import SchedulePanel from './components/SchedulePanel';
import SidebarTodoPanel from './components/SidebarTodoPanel';
import SettingsPanel from './components/SettingsPanel';
import StatsChart from './components/StatsChart';
import DailyPlanList from './components/DailyPlanList';
import TaskEditorModal from './components/TaskEditorModal';
import GoalEditorModal from './components/GoalEditorModal';
import GoalManager from './components/GoalManager';
import { AppState, Goal, TimeBlock, TaskType, TaskStatus, Milestone, ChartType, DayTemplate } from './types';
import { deviceMonitor } from './services/deviceMonitor';
import { syncService } from './services/syncService';
import { generateId, getTodayDateString, addDays, getDisplayDate, getCurrentTimeMinutes, t, getRangeBounds, isDateInRange, recalculateGoals, calculateUniqueDuration, PIXELS_PER_MINUTE, parseDurationFromUnit } from './utils';

// --- ONBOARDING DATA (Commercial Ready) ---
const WELCOME_GOALS: Goal[] = [
  { 
    id: 'g_vision', 
    title: 'Master My Time & Life', 
    totalUnits: 100, 
    completedUnits: 0, 
    unitName: 'Points', 
    color: '#10b981', // Emerald
    milestones: [], 
    layer: 'principle', 
    isMainThread: true, 
    sacrificeStatement: 'Less distraction, more focus' 
  },
  { 
    id: 'g_proj1', 
    title: 'Complete First Project', 
    totalUnits: 5, 
    completedUnits: 0, 
    unitName: 'Tasks', 
    color: '#3b82f6', // Blue
    milestones: [
        { id: 'm1', title: 'Plan the scope', isCompleted: false, totalUnits: 1, completedUnits: 0 },
        { id: 'm2', title: 'Execute phase 1', isCompleted: false, totalUnits: 1, completedUnits: 0 }
    ], 
    layer: 'method', 
    parentId: 'g_vision' 
  },
  { 
    id: 'g_habit1', 
    title: 'Daily Deep Work', 
    totalUnits: 30, 
    completedUnits: 0, 
    unitName: 'Session', 
    color: '#8b5cf6', // Violet
    milestones: [], 
    layer: 'method', 
    parentId: 'g_vision' 
  },
];

const WELCOME_TASKS: TimeBlock[] = [
  { 
    id: 't_onboard_1', 
    title: 'Welcome to LifeSync', 
    startTime: 540, // 9:00 AM
    duration: 30, 
    date: getTodayDateString(),
    type: TaskType.PLAN, 
    status: TaskStatus.TODO,
    color: '#10b981',
    origin: 'user',
    description: 'Explore the interface and set up your settings.',
    updatedAt: Date.now()
  },
  { 
    id: 't_onboard_2', 
    title: 'Drag me to adjust time', 
    startTime: 600, // 10:00 AM
    duration: 60, 
    date: getTodayDateString(),
    type: TaskType.PLAN, 
    status: TaskStatus.TODO,
    color: '#3b82f6',
    origin: 'goal',
    goalId: 'g_proj1',
    description: 'Try resizing this block!',
    updatedAt: Date.now()
  }
];

const App: React.FC = () => {
  const [view, setView] = useState<'schedule' | 'stats' | 'settings' | 'goals'>('schedule');
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [statsRange, setStatsRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [statsChartType, setStatsChartType] = useState<ChartType>('capital');
  
  const [globalDragItem, setGlobalDragItem] = useState<{ type: 'goal' | 'task' | 'goal-milestone', data: any, extra?: any } | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number, y: number } | null>(null);
  
  const [editingTask, setEditingTask] = useState<TimeBlock | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [failedTaskToResolve, setFailedTaskToResolve] = useState<TimeBlock | null>(null);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const [isLoaded, setIsLoaded] = useState(false);
  // Default to true for mobile sidebar (expanded) or handle logic below
  const [showMobileSidebar, setShowMobileSidebar] = useState(false); 
  const [mobileTab, setMobileTab] = useState<'plan' | 'inbox'>('plan');
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined') {
        return (localStorage.getItem('lifesync_theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  
  const [language, setLanguage] = useState('zh-CN');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMobileLangMenu, setShowMobileLangMenu] = useState(false);
  
  const [state, setState] = useState<AppState>({
    tasks: [],
    goals: [],
    templates: [],
    webDavConfig: { 
        url: '', 
        user: '', 
        pass: '', 
        enabled: false, 
        targetFolder: '/LifeSync',
        corsProxy: '' 
    },
    deviceMonitorConfig: {
        serverUrl: 'http://localhost:3001',
        enabled: false
    }
  });

  const languages = [
    { code: 'zh-CN', label: '中文简体' },
    { code: 'zh-TW', label: '中文繁体' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'ru', label: 'Русский' }
  ];

  // 1. Load State
  useEffect(() => {
    const saved = localStorage.getItem('lifesync_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure dates are valid
        if(parsed.tasks) {
          parsed.tasks = parsed.tasks.map((t: any) => ({
             ...t,
             date: t.date || getTodayDateString()
          }));
        }
        // Normalize goals
        if(parsed.goals) {
            parsed.goals = parsed.goals.map((g: any) => ({
                ...g,
                unitName: g.unitName || 'Session',
                layer: g.layer || 'application', 
                isMainThread: g.isMainThread || false,
                parentId: g.parentId || undefined
            }));
        }
        if(!parsed.webDavConfig) parsed.webDavConfig = state.webDavConfig;
        if(!parsed.deviceMonitorConfig) parsed.deviceMonitorConfig = state.deviceMonitorConfig;
        if(!parsed.templates) parsed.templates = [];
        
        // Recalculate goals progress on load
        if(parsed.goals && parsed.tasks) {
            parsed.goals = recalculateGoals(parsed.goals, parsed.tasks);
        }
        setState(prev => ({ ...prev, ...parsed }));
        
        // Apply Monitor Config
        if (parsed.deviceMonitorConfig?.serverUrl) {
            deviceMonitor.setLocalServerUrl(parsed.deviceMonitorConfig.serverUrl);
        }
      } catch (e) {
        console.error("Failed to load state", e);
        // Fallback to initial if corrupt
        setState(prev => ({ ...prev, tasks: WELCOME_TASKS, goals: WELCOME_GOALS }));
      }
    } else {
        // First Time User Experience (FTUE)
        setState(prev => ({ ...prev, tasks: WELCOME_TASKS, goals: WELCOME_GOALS }));
    }
    const savedLang = localStorage.getItem('lifesync_lang');
    if (savedLang) setLanguage(savedLang);
    setIsLoaded(true);
  }, []);

  // 2. Persist State
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('lifesync_state', JSON.stringify(state));
      // Ensure simulation is disabled for commercial build
      deviceMonitor.setSimulationEnabled(false);
    }
  }, [state, isLoaded]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('lifesync_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lifesync_lang', language);
  }, [language]);

  // Polling
  useEffect(() => {
    const pollLocalDeviceData = () => {
       const deviceLogs = deviceMonitor.getAllDeviceLogs();
       if (deviceLogs.length === 0) return;

       setState(prev => {
          const currentTasks = [...prev.tasks];
          let hasNew = false;
          deviceLogs.forEach(log => {
              const existingIndex = currentTasks.findIndex(t => t.id === log.id);
              if (existingIndex === -1) {
                  currentTasks.push({ ...log, updatedAt: Date.now() });
                  hasNew = true;
              } else {
                  const existing = currentTasks[existingIndex];
                  // Only update if changed (prevents flicker)
                  if (existing.duration !== log.duration || existing.title !== log.title) {
                      currentTasks[existingIndex] = { ...existing, ...log, updatedAt: Date.now() };
                      hasNew = true;
                  }
              }
          });
          if (!hasNew) return prev;
          return { ...prev, tasks: currentTasks };
       });
    };
    const interval = setInterval(pollLocalDeviceData, 2000); 
    return () => clearInterval(interval);
  }, []);

  // --- GLOBAL POINTER TRACKING FOR DRAG ---
  useEffect(() => {
      const handleGlobalMove = (e: PointerEvent | MouseEvent | TouchEvent) => {
          if (globalDragItem) {
              if (e.cancelable) e.preventDefault(); 
              
              const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
              const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
              setDragPosition({ x, y });
          }
      };
      
      const handleGlobalUp = (e: PointerEvent | MouseEvent | TouchEvent) => {
          if (globalDragItem && dragPosition) {
              const x = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
              const y = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;
              
              const scheduleContainer = document.getElementById('schedule-scroll-container');
              const scheduleRect = scheduleContainer?.getBoundingClientRect();

              if (scheduleContainer && scheduleRect && 
                  x >= scheduleRect.left && x <= scheduleRect.right && 
                  y >= scheduleRect.top && y <= scheduleRect.bottom) {
                  
                  // COMPENSATE FOR PADDING (App-specific fix for drag drop coords)
                  // The container might have padding top/bottom now
                  const computedStyle = window.getComputedStyle(scheduleContainer);
                  const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
                  
                  const relativeY = y - scheduleRect.top + scheduleContainer.scrollTop - paddingTop;
                  const minutes = Math.floor(relativeY / PIXELS_PER_MINUTE);
                  const snappedMinutes = Math.round(minutes / 15) * 15;
                  
                  const relativeX = x - scheduleRect.left;
                  const isActualCol = (relativeX / scheduleRect.width) > 0.5;
                  
                  handleCustomDrop(snappedMinutes, isActualCol ? TaskType.ACTUAL : TaskType.PLAN);
              }

              setGlobalDragItem(null);
              setDragPosition(null);
          }
      };

      if (globalDragItem) {
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('touchend', handleGlobalUp);
      }

      return () => {
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchmove', handleGlobalMove);
        window.removeEventListener('touchend', handleGlobalUp);
      };
  }, [globalDragItem, dragPosition, selectedDate]); 

  // Sync Logic
  const handleSyncCloud = async (): Promise<number> => {
    try {
        // syncService now returns { state, changes }
        const { state: syncedState, changes } = await syncService.syncToCloud(state);
        setState(syncedState);
        return changes;
    } catch (e: any) {
        console.error("Sync failed", e);
        if (e.code === 'CONFIG_MISSING' || e.message.includes('not configured')) {
            const shouldGo = window.confirm(t('webdavTitle', language) + ' is not configured. Go to Settings?');
            if (shouldGo) setView('settings');
            throw e; 
        }
        throw e;
    }
  };

  const handleTaskUpdate = (updatedTask: TimeBlock) => {
    const now = Date.now();
    setState(prev => {
      let newTasks = prev.tasks.map(t => {
          if (t.id === updatedTask.id) return { ...updatedTask, updatedAt: now };
          // Sync changes to related plans if needed
          if (updatedTask.type === TaskType.PLAN && t.relatedPlanId === updatedTask.id) {
               return {
                   ...t,
                   title: updatedTask.title,
                   color: updatedTask.color,
                   goalId: updatedTask.goalId,
                   milestoneId: updatedTask.milestoneId,
                   updatedAt: now
               };
          }
          return t;
      });

      if (updatedTask.type === TaskType.PLAN) {
          if (updatedTask.status === TaskStatus.COMPLETED) {
              const existingActual = newTasks.find(t => t.relatedPlanId === updatedTask.id);
              if (!existingActual) {
                  const newActual: TimeBlock = {
                      id: `res_${generateId()}`,
                      title: updatedTask.title,
                      date: updatedTask.date,
                      startTime: updatedTask.startTime,
                      duration: updatedTask.duration,
                      type: TaskType.ACTUAL,
                      status: TaskStatus.COMPLETED,
                      description: `Result of: ${updatedTask.title}`,
                      color: updatedTask.color,
                      createdAt: now,
                      updatedAt: now,
                      origin: 'user',
                      deviceSource: undefined,
                      relatedPlanId: updatedTask.id,
                      goalId: updatedTask.goalId,
                      milestoneId: updatedTask.milestoneId
                  };
                  newTasks.push(newActual);
              }
          } else if (updatedTask.status === TaskStatus.FAILED) {
              // Remove ANY existing linked actual tasks if failed
              newTasks = newTasks.filter(t => t.relatedPlanId !== updatedTask.id);
              
              // Create Unplanned/Reflection block with distinct styling
              const newActual: TimeBlock = {
                  id: `fail_${generateId()}`,
                  title: `[${t('unplanned', language)}]`,
                  date: updatedTask.date,
                  startTime: updatedTask.startTime,
                  duration: updatedTask.duration,
                  type: TaskType.ACTUAL,
                  status: TaskStatus.COMPLETED,
                  description: 'What happened instead?',
                  color: '#ef4444', // Red color for failed reflection
                  createdAt: now,
                  updatedAt: now,
                  origin: 'user',
                  relatedPlanId: updatedTask.id
              };
              newTasks.push(newActual);
          } else if (updatedTask.status === TaskStatus.TODO) {
              // If back to TODO, remove related actuals to keep clean state
              newTasks = newTasks.filter(t => t.relatedPlanId !== updatedTask.id);
          }
      }
      
      const newGoals = recalculateGoals(prev.goals, newTasks);
      return { ...prev, tasks: newTasks, goals: newGoals };
    });
  };

  const handleTaskCreate = (newTask: TimeBlock) => {
    setState(prev => {
        const taskWithTimestamp = { ...newTask, updatedAt: Date.now() };
        const newTasks = [...prev.tasks, taskWithTimestamp];
        const newGoals = recalculateGoals(prev.goals, newTasks);
        return { ...prev, tasks: newTasks, goals: newGoals };
    });
  };

  const handleTaskDelete = (id: string) => {
    setState(prev => {
      const newTasks = prev.tasks.filter(t => t.id !== id && t.relatedPlanId !== id);
      const newGoals = recalculateGoals(prev.goals, newTasks);
      return { ...prev, tasks: newTasks, goals: newGoals };
    });
  };

  // --- TEMPLATE HANDLERS ---
  const handleOpenTemplateModal = () => {
      const hasPlan = state.tasks.some(t => t.date === selectedDate && t.type === TaskType.PLAN);
      if (!hasPlan) {
          alert(t('noPlansToSave', language));
          return;
      }
      setTemplateName('');
      setIsTemplateModalOpen(true);
  };

  const handleConfirmSaveTemplate = () => {
      if (!templateName.trim()) return;
      handleSaveTemplate(templateName);
      setIsTemplateModalOpen(false);
  };

  const handleSaveTemplate = (name: string) => {
      if(!name || !name.trim()) return;
      const todaysTasks = state.tasks.filter(t => t.date === selectedDate && t.type === TaskType.PLAN);
      
      if (todaysTasks.length === 0) return;
      
      const cleanTasks = todaysTasks.map(t => {
          const { id, date, createdAt, updatedAt, ...rest } = t;
          return rest;
      });

      const newTemplate: DayTemplate = {
          id: generateId(),
          name: name.trim(),
          tasks: cleanTasks
      };

      setState(prev => ({
          ...prev,
          templates: [...(prev.templates || []), newTemplate]
      }));
  };

  const handleLoadTemplate = (templateId: string) => {
      const template = state.templates.find(t => t.id === templateId);
      if (!template) return;

      const dayHasTasks = state.tasks.some(t => t.date === selectedDate && t.type === TaskType.PLAN);
      let shouldReplace = false;

      if (dayHasTasks) {
          const choice = window.confirm(
              language === 'zh-CN' 
              ? '当天已有任务。需要清空现有任务并覆盖吗？\n(取消 = 追加)' 
              : 'Tasks exist today. Replace them?\n(Cancel = Append)'
          );
          shouldReplace = choice;
      }

      const newTasks: TimeBlock[] = template.tasks.map(t => ({
          ...t,
          id: generateId(),
          date: selectedDate,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: TaskStatus.TODO 
      }));

      setState(prev => {
          let updatedTasks = [...prev.tasks];
          if (shouldReplace) {
              updatedTasks = updatedTasks.filter(t => t.date !== selectedDate || t.type !== TaskType.PLAN);
          }
          updatedTasks = [...updatedTasks, ...newTasks];
          return { ...prev, tasks: updatedTasks };
      });
  };

  const handleDeleteTemplate = (templateId: string) => {
      if(!window.confirm(language === 'zh-CN' ? "确定删除此模板？" : "Delete this template?")) return;
      setState(prev => ({
          ...prev,
          templates: prev.templates.filter(t => t.id !== templateId)
      }));
  };
  
  const handleImportData = (importedState: AppState) => {
      setState(importedState);
  };

  const handleGoalSave = (goal: Goal) => {
      const timestamp = Date.now();
      if (goal.id && !goal.id.startsWith('temp_')) {
          setState(prev => ({
              ...prev,
              goals: prev.goals.map(g => g.id === goal.id ? { ...goal, updatedAt: timestamp } : g)
          }));
      } else {
          const newGoalId = goal.id && goal.id.startsWith('temp_') ? generateId() : (goal.id || generateId());
          const newGoal = { ...goal, id: newGoalId, updatedAt: timestamp };
          setState(prev => ({
              ...prev,
              goals: [...prev.goals, newGoal]
          }));
      }
      setIsGoalModalOpen(false);
      setEditingGoal(null);
  };

  const handleGoalDelete = (id: string) => {
      setState(prev => ({
          ...prev,
          goals: prev.goals.filter(g => g.id !== id)
      }));
  };

  const handleCustomDragStart = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, item: any, type: 'goal' | 'task', extra?: any) => {
      const x = 'touches' in e ? e.touches[0].clientX : (e as any).clientX;
      const y = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
      
      let dragType: 'goal' | 'task' | 'goal-milestone' = type as any;
      if (type === 'goal' && extra) {
          dragType = 'goal-milestone';
      }

      setGlobalDragItem({ type: dragType, data: item, extra });
      setDragPosition({ x, y });
      
      if (window.innerWidth < 768) {
          setShowMobileSidebar(false);
      }
  };

  const handleCustomDrop = (timeMinutes: number, targetType: TaskType = TaskType.PLAN) => {
    if (!globalDragItem) return;

    if (globalDragItem.type === 'task') {
        const task = state.tasks.find(t => t.id === globalDragItem.data.id);
        if (task) {
            handleTaskUpdate({
                ...task,
                startTime: timeMinutes,
                duration: task.duration > 0 ? task.duration : 60,
                type: targetType
            });
        }
    } else if (globalDragItem.type === 'goal') {
        const goal = globalDragItem.data as Goal;
        const taskTitle = goal.title;
        // INFERENCE: Try to guess duration from title (e.g. "Read 30 mins")
        const inferredDuration = parseDurationFromUnit(goal.title) || parseDurationFromUnit(goal.unitName) || 60;
        const taskDesc = `Target: 1 ${goal.unitName}`;

        const newTask: TimeBlock = {
          id: generateId(),
          title: taskTitle,
          startTime: timeMinutes,
          duration: inferredDuration,
          date: selectedDate,
          type: targetType,
          status: targetType === TaskType.PLAN ? TaskStatus.TODO : TaskStatus.COMPLETED,
          color: goal.color,
          description: taskDesc,
          origin: 'goal',
          goalId: goal.id,
          createdAt: Date.now()
        };
        handleTaskCreate(newTask);
    } else if (globalDragItem.type === 'goal-milestone') {
        const goal = globalDragItem.data as Goal;
        const milestone = globalDragItem.extra as Milestone;
        const taskTitle = `${goal.title}: ${milestone.title}`;
        
        // INFERENCE: Try to guess duration from milestone title (e.g. "Chapter 1 (45m)")
        const inferredDuration = parseDurationFromUnit(milestone.title) || parseDurationFromUnit(milestone.unitName || '') || 60;
        
        const taskDesc = milestone.totalUnits 
            ? `Target: ${milestone.totalUnits} ${milestone.unitName || ''}` 
            : `Sub-goal: ${milestone.title}`;

        const newTask: TimeBlock = {
            id: generateId(),
            title: taskTitle,
            startTime: timeMinutes,
            duration: inferredDuration,
            date: selectedDate,
            type: targetType,
            status: targetType === TaskType.PLAN ? TaskStatus.TODO : TaskStatus.COMPLETED,
            color: goal.color,
            description: taskDesc,
            origin: 'goal',
            goalId: goal.id,
            milestoneId: milestone.id,
            createdAt: Date.now()
        };
        handleTaskCreate(newTask);
    }
  };

  const handleAddNewTask = () => {
    setEditingTask({
      id: `temp_${generateId()}`,
      title: '',
      date: selectedDate,
      startTime: getCurrentTimeMinutes(),
      duration: 30,
      type: TaskType.PLAN,
      status: TaskStatus.TODO,
      color: '#6366f1',
      origin: 'user',
      createdAt: Date.now()
    });
  };

  const handleAddUnscheduledTask = () => {
      const newTask: TimeBlock = {
          id: generateId(),
          title: '',
          date: selectedDate,
          startTime: -1,
          duration: 60,
          type: TaskType.PLAN,
          status: TaskStatus.TODO,
          color: '#6366f1',
          origin: 'user',
          createdAt: Date.now()
      };
      setEditingTask(newTask);
  };

  const handleMobileTabClick = (tab: 'plan' | 'inbox') => {
      if (mobileTab === tab) {
          // If clicking active tab, toggle sidebar visibility
          setShowMobileSidebar(!showMobileSidebar);
      } else {
          // If clicking inactive tab, switch to it and ensure sidebar is open
          setMobileTab(tab);
          setShowMobileSidebar(true);
      }
  };

  const scheduledTasks = state.tasks.filter(t => t.date === selectedDate && t.startTime >= 0);
  const unscheduledTasks = state.tasks.filter(t => t.date === selectedDate && t.startTime === -1);
  const isToday = selectedDate === getTodayDateString();

  const getChartTitleKey = (type: ChartType) => {
      switch(type) {
          case 'capital': return 'chartCapital';
          case 'execution': return 'chartExecution';
          case 'apps': return 'chartApps';
          case 'trend': return 'chartTrend';
          case 'hours': return 'chartHours';
          default: return 'deviceUsage';
      }
  };

  if (!isLoaded) return null;

  return (
    <div className={`flex flex-col md:flex-row w-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 overflow-hidden font-inter transition-colors duration-300 h-[100dvh]`}>
      {globalDragItem && dragPosition && (
          <div className="fixed z-[9999] pointer-events-none opacity-90" style={{ left: dragPosition.x, top: dragPosition.y, transform: 'translate(-50%, -50%)' }}>
              <div className="bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-xl font-bold text-xs whitespace-nowrap flex flex-col items-center">
                  <span>{globalDragItem.extra ? globalDragItem.extra.title : globalDragItem.data.title}</span>
                  {globalDragItem.extra && <span className="text-[10px] opacity-80">{globalDragItem.data.title}</span>}
              </div>
          </div>
      )}

      {/* STATUS BAR FILLER */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[200] bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/50 transition-colors" style={{ height: 'max(env(safe-area-inset-top), 24px)', minHeight: '24px' }}></div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col items-center py-6 gap-6 z-20 shadow-sm shrink-0 transition-colors duration-300">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200 dark:shadow-none">L</div>
        <nav className="flex flex-col gap-4 w-full px-2 mt-4">
          <NavButton id="schedule" icon={Calendar} label={t('plan', language)} isActive={view==='schedule'} onClick={setView}/>
          <NavButton id="goals" icon={Target} label={t('goals', language)} isActive={view==='goals'} onClick={setView}/>
          <NavButton id="stats" icon={BarChart2} label={t('stats', language)} isActive={view==='stats'} onClick={setView}/>
          <NavButton id="settings" icon={Settings} label={t('sync', language)} isActive={view==='settings'} onClick={setView}/>
        </nav>
        <div className="mt-auto flex flex-col gap-4 items-center w-full">
           <div className="relative">
             <button onClick={() => setShowLangMenu(!showLangMenu)} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all"><Languages size={20} /></button>
             {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)}></div>
                  <div className="absolute bottom-0 left-full ml-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                    {languages.map(lang => (
                        <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-gray-700 ${language === lang.code ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-300'}`}>{lang.label}</button>
                    ))}
                  </div>
                </>
             )}
           </div>
           <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all">
             {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden relative pt-[calc(max(env(safe-area-inset-top),24px)+2px)] md:pt-0">
        
        {/* HEADER */}
        {(view === 'schedule' || view === 'stats') && (
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-1 md:px-6 md:py-3 flex items-center justify-between shrink-0 z-[100] transition-colors duration-300 relative select-none min-h-[44px] md:min-h-[56px] gap-2">
              
              {/* LEFT: Today Button or Current Date Display */}
              <div className="flex-none md:flex-1 flex items-center justify-start z-20 pointer-events-none">
                 {!isToday ? (
                    <button 
                        onClick={() => setSelectedDate(getTodayDateString())} 
                        className="group flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full transition-all active:scale-95 shadow-sm border border-indigo-100 dark:border-indigo-800 pointer-events-auto"
                    >
                       <span className="text-xs font-bold hidden sm:inline">{t('jumpToToday', language)}</span>
                       <span className="text-xs font-bold sm:hidden">{t('today', language)}</span>
                    </button>
                 ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full text-gray-500 dark:text-gray-400 animate-in fade-in duration-300 select-none border border-transparent pointer-events-auto">
                        <span className="text-xs font-bold tracking-tight">{getDisplayDate(selectedDate, language)}</span>
                    </div>
                 )}
              </div>

              {/* CENTER: Date Navigation - Optimized for Mobile (Flex) vs Desktop (Absolute) */}
              <div className="flex-1 md:flex-none flex md:absolute md:left-1/2 md:top-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 items-center justify-center gap-1 sm:gap-2 md:gap-4 z-30 min-w-0">
                 <button
                    onClick={() => setSelectedDate(prev => addDays(prev, -1))}
                    className="p-1 md:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-200 transition-colors active:scale-90 shrink-0"
                 >
                    <ChevronLeft size={18} strokeWidth={2.5}/>
                 </button>
                 
                 <div className="relative group flex flex-col items-center justify-center cursor-pointer min-w-0 flex-1 max-w-[140px] sm:max-w-[180px] md:max-w-none">
                    <div className="px-1 sm:px-2 md:px-3 py-1 rounded-xl group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 transition-colors text-center w-full">
                        <h2 className="text-xs sm:text-sm md:text-lg font-extrabold text-gray-800 dark:text-gray-100 leading-tight tracking-tight line-clamp-2 sm:line-clamp-1">
                            {isToday ? t('today', language) : getDisplayDate(selectedDate, language)}
                        </h2>
                    </div>
                    {/* Date Picker Overlay */}
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="opacity-0 absolute inset-0 cursor-pointer w-full h-full z-20"
                    />
                 </div>

                 <button
                    onClick={() => setSelectedDate(prev => addDays(prev, 1))}
                    className="p-1 md:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-200 transition-colors active:scale-90 shrink-0"
                 >
                    <ChevronRight size={18} strokeWidth={2.5}/>
                 </button>
              </div>

              {/* RIGHT: Mobile Toggles */}
              <div className="flex-none md:flex-1 flex items-center justify-end gap-2 z-20 pointer-events-none">
                 <div className="flex items-center gap-1 md:hidden pointer-events-auto">
                    <div className="relative">
                      <button onClick={() => setShowMobileLangMenu(!showMobileLangMenu)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all">
                         <Languages size={18} />
                      </button>
                      {showMobileLangMenu && (
                         <>
                           <div className="fixed inset-0 z-40" onClick={() => setShowMobileLangMenu(false)}></div>
                           <div className="absolute top-full right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                             {languages.map(lang => (
                                 <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowMobileLangMenu(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-gray-700 ${language === lang.code ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-gray-300'}`}>{lang.label}</button>
                             ))}
                           </div>
                         </>
                      )}
                    </div>
                    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all">
                      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                 </div>
              </div>
            </header>
        )}

        <div className="flex flex-col md:flex-row w-full p-0 md:p-4 gap-2 md:gap-4 flex-1 min-h-0 relative">
          
          {/* LEFT PANEL: Sidebar/Tasks */}
          {(view === 'schedule' || view === 'stats') && (
            <div className={`
                flex-col gap-2 md:gap-4 transition-all duration-300 ease-in-out bg-transparent px-2 md:px-0
                w-full md:w-72 lg:w-80 shrink-0
                ${view === 'stats' ? 'hidden md:flex' : 'flex'}
                ${showMobileSidebar ? 'h-[32vh] border-b border-gray-200 dark:border-gray-700 pb-2' : 'h-auto'} 
                md:h-full md:border-none md:pb-0
            `}>
                
                {/* Mobile View Controller - Tab Bar is Main Control */}
                <div className="md:hidden flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    {/* Tab Bar with Integrated Add Buttons and Expand Toggle Logic */}
                    <div className="flex border-b border-gray-100 dark:border-gray-700">
                            <div 
                            className={`flex-1 flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${mobileTab === 'plan' ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/30 text-gray-500'}`}
                            onClick={() => handleMobileTabClick('plan')}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-bold flex items-center gap-1.5 ${mobileTab === 'plan' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}>
                                    <ListTodo size={14}/> {t('dailyPlan', language)}
                                    </span>
                                    {/* Chevron to indicate expanded/collapsed state */}
                                    {mobileTab === 'plan' && (
                                        <div className={`transition-transform duration-300 ${showMobileSidebar ? 'rotate-180' : 'rotate-0'}`}>
                                            <ChevronDown size={12} className="text-gray-400"/>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddNewTask(); setShowMobileSidebar(true); setMobileTab('plan'); }}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 active:scale-95 transition-all"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="w-px bg-gray-200 dark:bg-gray-700 h-full"></div>
                            <div 
                            className={`flex-1 flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${mobileTab === 'inbox' ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/30 text-gray-500'}`}
                            onClick={() => handleMobileTabClick('inbox')}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-bold flex items-center gap-1.5 ${mobileTab === 'inbox' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}>
                                    <LayoutList size={14}/> {t('todoList', language)}
                                    </span>
                                    {/* Chevron to indicate expanded/collapsed state */}
                                    {mobileTab === 'inbox' && (
                                        <div className={`transition-transform duration-300 ${showMobileSidebar ? 'rotate-180' : 'rotate-0'}`}>
                                            <ChevronDown size={12} className="text-gray-400"/>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddUnscheduledTask(); setShowMobileSidebar(true); setMobileTab('inbox'); }}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 active:scale-95 transition-all"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                    </div>

                    {/* Content Area with Height Transition */}
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showMobileSidebar ? 'flex-1' : 'h-0 min-h-0'}`}>
                            <div className="h-full relative">
                                {mobileTab === 'plan' && (
                                    <div className="absolute inset-0">
                                        <DailyPlanList 
                                        tasks={scheduledTasks} 
                                        onTaskUpdate={handleTaskUpdate} 
                                        onTaskCreate={handleTaskCreate} 
                                        onAddTask={handleAddNewTask} 
                                        onEdit={setEditingTask} 
                                        onDelete={handleTaskDelete} 
                                        lang={language}
                                        isMobile={true}
                                        hideHeader={true} 
                                        />
                                    </div>
                                )}
                                {mobileTab === 'inbox' && (
                                    <div className="absolute inset-0">
                                        <SidebarTodoPanel 
                                        goals={state.goals} 
                                        tasks={state.tasks} 
                                        unscheduledTasks={unscheduledTasks} 
                                        onDragStartGoal={(e, g, m) => handleCustomDragStart(e, g, 'goal', m)} 
                                        onDragStartTask={(e, t) => handleCustomDragStart(e, t, 'task')} 
                                        onAddUnscheduledTask={handleAddUnscheduledTask} 
                                        lang={language}
                                        isMobile={true}
                                        hideGoals={false}
                                        hideHeader={true} 
                                        />
                                    </div>
                                )}
                            </div>
                    </div>
                </div>

                {/* Desktop View (Unchanged) */}
                <div className="hidden md:flex flex-col gap-4 h-full">
                    <div className="flex-1 min-h-0">
                        <SidebarTodoPanel goals={state.goals} tasks={state.tasks} unscheduledTasks={unscheduledTasks} onDragStartGoal={(e, g, m) => handleCustomDragStart(e, g, 'goal', m)} onDragStartTask={(e, t) => handleCustomDragStart(e, t, 'task')} onAddUnscheduledTask={handleAddUnscheduledTask} lang={language}/>
                    </div>
                    <div className="h-1/2">
                        <DailyPlanList tasks={scheduledTasks} onTaskUpdate={handleTaskUpdate} onTaskCreate={handleTaskCreate} onAddTask={handleAddNewTask} onEdit={setEditingTask} onDelete={handleTaskDelete} lang={language}/>
                    </div>
                </div>
            </div>
          )}

          {/* MAIN CENTER PANEL */}
          <div className={`flex-1 h-full min-w-0 md:bg-transparent overflow-hidden relative px-0 md:px-0 pb-0 md:pb-0 ${view !== 'schedule' ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'}`}>
             {view === 'schedule' && (
                <SchedulePanel 
                  tasks={scheduledTasks}
                  selectedDate={selectedDate}
                  isToday={isToday}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskCreate={handleTaskCreate}
                  onTaskEdit={setEditingTask}
                  onTaskDelete={handleTaskDelete}
                  onDropGoal={(e, time, type) => {}}
                  onCustomDrop={handleCustomDrop} 
                  onSyncCloud={handleSyncCloud}
                  onDragStartTask={(e, t) => handleCustomDragStart(e, t, 'task')}
                  draggingMode={globalDragItem ? 'task' : null}
                  lang={language}
                  theme={theme}
                  globalDragItem={globalDragItem}
                  dragPosition={dragPosition}
                  templates={state.templates}
                  onOpenTemplateModal={handleOpenTemplateModal}
                  onLoadTemplate={handleLoadTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onSaveTemplate={() => {}} // Legacy, not used directly by panel anymore for saving
                />
             )}
             
             {view === 'goals' && (
                <GoalManager goals={state.goals} allTasks={state.tasks} onAddGoal={(parentId) => { setEditingGoal({ parentId } as any); setIsGoalModalOpen(true); }} onEditGoal={(g) => { setEditingGoal(g); setIsGoalModalOpen(true); }} onUpdateGoal={handleGoalSave} onDeleteGoal={handleGoalDelete} onBack={() => setView('schedule')} lang={language} />
             )}

             {view === 'stats' && (
                <div className="flex flex-col h-full overflow-hidden p-2 md:p-6">
                    <div className="max-w-6xl mx-auto w-full h-full flex flex-col min-h-0">
                        {/* Compact Stats Header - No Margin Bottom on Mobile */}
                        <div className="flex flex-col gap-2 mb-2 md:mb-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base md:text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                        <BarChart2 size={16}/>
                                    </div>
                                    {t(getChartTitleKey(statsChartType), language)}
                                </h2>
                                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 shadow-inner">
                                     {(['day', 'week', 'month', 'year'] as const).map(range => (
                                         <button key={range} onClick={() => setStatsRange(range)} className={`px-2 py-1 rounded transition-all ${statsRange === range ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{t(range, language)}</button>
                                     ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* Stats Content - Full flex expansion */}
                        <div className="flex-1 w-full flex flex-col min-h-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-2 md:p-4 overflow-hidden">
                            <StatsChart 
                                tasks={state.tasks.filter(t => isDateInRange(t.date, getRangeBounds(selectedDate, statsRange).start, getRangeBounds(selectedDate, statsRange).end))} 
                                range={statsRange} 
                                selectedDate={selectedDate} 
                                lang={language} 
                                theme={theme}
                                chartType={statsChartType}
                                onChartChange={setStatsChartType}
                            />
                        </div>
                    </div>
                </div>
             )}

             {view === 'settings' && (
                <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 bg-gray-50 dark:bg-gray-900 transition-colors duration-300 pb-24 md:pb-8">
                   <SettingsPanel config={state.webDavConfig} onSave={(cfg, devCfg) => { 
                       setState(prev => ({ ...prev, webDavConfig: cfg, deviceMonitorConfig: devCfg }));
                       if(devCfg?.serverUrl) deviceMonitor.setLocalServerUrl(devCfg.serverUrl);
                   }} lang={language} onImportData={handleImportData} fullState={state} />
                </div>
             )}
          </div>
        </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around pb-safe pt-2 px-2 h-[calc(60px+env(safe-area-inset-bottom,20px))] shrink-0 z-[200] transition-colors duration-300 fixed bottom-0 left-0 right-0">
         <NavButton id="schedule" icon={Calendar} label={t('plan', language)} isActive={view==='schedule'} onClick={setView}/>
         <NavButton id="goals" icon={Target} label={t('goals', language)} isActive={view==='goals'} onClick={setView}/>
         <NavButton id="stats" icon={BarChart2} label={t('stats', language)} isActive={view==='stats'} onClick={setView}/>
         <NavButton id="settings" icon={Settings} label={t('sync', language)} isActive={view==='settings'} onClick={setView}/>
      </nav>

      {/* MODALS */}
      <TaskEditorModal isOpen={!!editingTask} task={editingTask} onClose={() => setEditingTask(null)} onSave={(updated) => { const exists = state.tasks.find(t => t.id === updated.id); if (exists) handleTaskUpdate(updated); else handleTaskCreate(updated); setEditingTask(null); }} onDelete={handleTaskDelete} lang={language} mode={editingTask?.id?.startsWith('temp') ? 'create' : 'edit'} />
      <TaskEditorModal isOpen={!!failedTaskToResolve} task={failedTaskToResolve ? { id: `fail_res_${generateId()}`, title: '', date: failedTaskToResolve.date, startTime: failedTaskToResolve.startTime, duration: failedTaskToResolve.duration, type: TaskType.ACTUAL, status: TaskStatus.COMPLETED, color: failedTaskToResolve.color, description: `Activity instead of: ${failedTaskToResolve.title}`, relatedPlanId: failedTaskToResolve.id, origin: 'user', createdAt: Date.now(), updatedAt: Date.now() } : null} onClose={() => setFailedTaskToResolve(null)} onSave={(newActual) => { handleTaskCreate(newActual); setFailedTaskToResolve(null); }} onDelete={() => setFailedTaskToResolve(null)} lang={language} mode="resolve_failure" />
      <GoalEditorModal isOpen={isGoalModalOpen} goal={editingGoal} existingGoals={state.goals} onClose={() => setIsGoalModalOpen(false)} onSave={handleGoalSave} onDelete={handleGoalDelete} lang={language} />
      
      {/* SAVE TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsTemplateModalOpen(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 w-80 md:w-96 shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all scale-100 opacity-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileJson size={18} className="text-indigo-600 dark:text-indigo-400"/>
                        {t('saveTemplate', language)}
                    </h3>
                    <button onClick={() => setIsTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {language === 'zh-CN' ? '将当前“计划”任务保存为模板，方便日后使用。' : 'Save the current "Plan" tasks as a template for future use.'}
                </p>

                <input 
                    autoFocus
                    type="text" 
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder={t('enterTemplateName', language)}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg mb-5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-medium"
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmSaveTemplate();
                        if (e.key === 'Escape') setIsTemplateModalOpen(false);
                    }}
                />
                
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">{t('cancel', language)}</button>
                    <button 
                        onClick={handleConfirmSaveTemplate} 
                        disabled={!templateName.trim()}
                        className={`px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2 ${!templateName.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <SaveIcon size={14} /> {t('save', language)}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ id, icon: Icon, label, isActive, onClick }: { id: any, icon: any, label: string, isActive: boolean, onClick: (id: any) => void }) => (
    <button onClick={() => onClick(id)} className={`flex-1 flex flex-col items-center justify-start pt-1 h-full gap-1 rounded-lg transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
        <Icon size={24} />
        <span className="text-[10px] font-medium">{label}</span>
    </button>
);

export default App;
