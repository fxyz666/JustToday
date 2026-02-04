
import { TimeBlock, TaskType, Goal, TaskStatus, Milestone } from './types';

export const MINUTES_IN_DAY = 24 * 60;
export const PIXELS_PER_MINUTE = 1.6;

// --- AUTHENTICATION HELPERS ---
/**
 * Build Basic Auth header for WebDAV requests
 */
export const buildAuthHeader = (user: string, pass: string): string => {
    try {
        // Validate credentials before encoding
        if (!user || !pass) {
            throw new Error('Username or password is missing');
        }
        const authString = `${user}:${pass}`;
        return 'Basic ' + btoa(authString);
    } catch (e) {
        throw new Error(`Authentication failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
};

// --- PLATFORM DETECTION ---
export type Platform = 'electron' | 'tauri' | 'web';

export const getPlatform = (): Platform => {
  if (typeof window !== 'undefined') {
    if ((window as any).electronAPI) return 'electron';
    if ((window as any).__TAURI__) return 'tauri';
  }
  return 'web';
};

export const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Updated to support localization
export const formatDuration = (minutes: number, lang: string = 'en'): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  
  const unitH = t('unitH', lang);
  const unitM = t('unitM', lang);

  if (minutes < 60) return `${minutes}${unitM}`;
  return m > 0 ? `${h}${unitH} ${m}${unitM}` : `${h}${unitH}`;
};

export const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Tries to extract a duration in minutes from a string like "30 mins", "1.5 hours", "45分"
 */
export const parseDurationFromUnit = (unitName: string): number | null => {
    const lower = unitName.toLowerCase();
    const numMatch = lower.match(/(\d+(\.\d+)?)/);
    if (!numMatch) return null;
    
    const val = parseFloat(numMatch[0]);
    
    if (lower.includes('hour') || lower.includes('hr') || lower.includes('h') || lower.includes('小时') || lower.includes('时')) {
        return Math.round(val * 60);
    }
    if (lower.includes('min') || lower.includes('m') || lower.includes('分')) {
        return Math.round(val);
    }
    return null;
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const getCurrentTimeMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const getStatusIcon = (status: string) => {
  switch(status) {
    case 'COMPLETED': return '[ √ ]';
    case 'FAILED': return '[ × ]';
    default: return '[ ]';
  }
};

export const getStatusColor = (status: string) => {
  switch(status) {
    case 'COMPLETED': return 'bg-emerald-100 border-emerald-500 text-emerald-900';
    case 'FAILED': return 'bg-red-100 border-red-500 text-red-900';
    default: return 'bg-white border-gray-400 text-gray-700';
  }
};

// Date Helpers
export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (dateStr: string, days: number) => {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDisplayDate = (dateStr: string, lang: string = 'en') => {
  const date = new Date(dateStr + 'T00:00:00');
  
  // Map app internal language codes to standard Intl locales
  let locale = 'en-US';
  switch (lang) {
      case 'zh-CN': locale = 'zh-CN'; break;
      case 'zh-TW': locale = 'zh-TW'; break;
      case 'ja': locale = 'ja-JP'; break;
      case 'ko': locale = 'ko-KR'; break;
      case 'ru': locale = 'ru-RU'; break;
      default: locale = 'en-US';
  }

  return date.toLocaleDateString(locale, { weekday: 'short', month: 'long', day: 'numeric' });
};

// Range Helpers
export const getRangeBounds = (dateStr: string, range: 'day' | 'week' | 'month' | 'year') => {
  const date = new Date(dateStr + 'T00:00:00');
  const start = new Date(date);
  const end = new Date(date);

  if (range === 'week') {
    const day = date.getDay(); // 0 is Sunday
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    start.setDate(diff);
    end.setDate(diff + 6);
  } else if (range === 'month') {
    start.setDate(1);
    end.setMonth(date.getMonth() + 1);
    end.setDate(0);
  } else if (range === 'year') {
    start.setMonth(0);
    start.setDate(1);
    end.setMonth(11);
    end.setDate(31);
  }

  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return { start: fmt(start), end: fmt(end) };
};

export const isDateInRange = (targetDate: string, start: string, end: string) => {
  return targetDate >= start && targetDate <= end;
};

export const mergeTimeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length <= 1) return blocks;
  
  const sorted = [...blocks].sort((a, b) => a.startTime - b.startTime);
  const result: TimeBlock[] = [];
  
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEnd = current.startTime + current.duration;
    const isOverlappingOrClose = next.startTime <= currentEnd + 5;
    
    if (
        (current.type === TaskType.DEVICE_LOG || current.type === TaskType.ACTUAL) &&
        current.title === next.title && 
        current.type === next.type && 
        isOverlappingOrClose
    ) {
        const newEnd = Math.max(currentEnd, next.startTime + next.duration);
        current = {
            ...current,
            duration: newEnd - current.startTime,
            description: current.description === next.description ? current.description : `${current.description || ''}`,
        };
    } else {
        result.push(current);
        current = next;
    }
  }
  result.push(current);
  return result;
};

export const calculateUniqueDuration = (blocks: TimeBlock[]): number => {
    if (blocks.length === 0) return 0;

    const intervals: {start: number, end: number}[] = blocks.map(b => {
        const datePart = new Date(b.date).getTime();
        const start = datePart + b.startTime * 60 * 1000;
        const end = start + b.duration * 60 * 1000;
        return { start, end };
    });

    intervals.sort((a, b) => a.start - b.start);

    let totalDurationMs = 0;
    let currentStart = intervals[0].start;
    let currentEnd = intervals[0].end;

    for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];
        if (next.start < currentEnd) {
            currentEnd = Math.max(currentEnd, next.end);
        } else {
            totalDurationMs += (currentEnd - currentStart);
            currentStart = next.start;
            currentEnd = next.end;
        }
    }
    totalDurationMs += (currentEnd - currentStart);

    return totalDurationMs / 1000 / 60;
};

export const recalculateGoals = (goals: Goal[], tasks: TimeBlock[]): Goal[] => {
    if (!goals || !Array.isArray(goals)) return [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];

    return goals.map(goal => {
        if (goal.milestones && goal.milestones.length > 0) {
            const updatedMilestones = goal.milestones.map(milestone => {
                const milestoneTasks = safeTasks.filter(t => 
                    t.goalId === goal.id && 
                    t.milestoneId === milestone.id &&
                    t.status === TaskStatus.COMPLETED &&
                    (t.type === TaskType.ACTUAL || t.type === TaskType.DEVICE_LOG)
                );
                
                let current = 0;
                if (milestone.totalUnits && milestone.totalUnits > 0) {
                    const u = (milestone.unitName || '').toLowerCase();
                    const isTimeBased = u.includes('hour') || u.includes('min') || u.includes('hr') || u.includes('m') || u.includes('h') || u.includes('时') || u.includes('分');
                    
                    if (isTimeBased) {
                         const totalMinutes = milestoneTasks.reduce((sum, t) => sum + t.duration, 0);
                         current = (u.includes('min') || u.includes('分') || u.includes('m')) ? totalMinutes : Math.round((totalMinutes / 60) * 10) / 10;
                    } else {
                         current = milestoneTasks.length;
                    }
                }
                
                const targetReached = (milestone.totalUnits && current >= milestone.totalUnits);
                const isCompleted = targetReached ? true : milestone.isCompleted;
                
                return { ...milestone, completedUnits: current, isCompleted };
            });

            const completedCount = updatedMilestones.filter(m => m.isCompleted).length;
            
            return {
                ...goal,
                milestones: updatedMilestones,
                totalUnits: updatedMilestones.length,
                completedUnits: completedCount,
                unitName: 'Sub-goals' 
            };
        } else {
            const linkedTasks = safeTasks.filter(t => {
                if (t.goalId !== goal.id || t.status !== TaskStatus.COMPLETED) return false;
                if (t.milestoneId) return false; 
                return t.type === TaskType.ACTUAL || t.type === TaskType.DEVICE_LOG;
            });
            
            if (linkedTasks.length > 0) {
                const u = (goal.unitName || 'session').toLowerCase();
                const isTimeBased = u.includes('hour') || u.includes('min') || u.includes('hr') || u.includes('m') || u.includes('h') || u.includes('时') || u.includes('分');
                
                let calculated = 0;
                if (isTimeBased) {
                    const totalMinutes = linkedTasks.reduce((sum, t) => sum + t.duration, 0);
                    if (u.includes('min') || u.includes('分') || u.includes('m')) {
                        calculated = totalMinutes;
                    } else {
                        calculated = Math.round((totalMinutes / 60) * 10) / 10;
                    }
                } else {
                    calculated = linkedTasks.length;
                }
                return { ...goal, completedUnits: calculated };
            } 
            
            return goal; 
        }
    });
};

export const calculateGoalProgress = (goal: Goal, allTasks: TimeBlock[]) => {
    if (goal.milestones && goal.milestones.length > 0) {
        return {
            current: goal.completedUnits,
            target: goal.totalUnits,
            percentage: goal.totalUnits > 0 ? Math.round((goal.completedUnits / goal.totalUnits) * 100) : 0,
            label: 'Sub-goals',
            labelKey: 'milestones'
        };
    }

    const isRecurring = goal.frequency && goal.frequency !== 'once';
    const u = (goal.unitName || 'session').toLowerCase();
    const isTimeBased = u.includes('hour') || u.includes('min') || u.includes('hr') || u.includes('m') || u.includes('h') || u.includes('时') || u.includes('分');

    let periodTasks = allTasks.filter(t => 
        t.goalId === goal.id && 
        t.status === TaskStatus.COMPLETED &&
        !t.milestoneId &&
        (t.type === TaskType.ACTUAL || t.type === TaskType.DEVICE_LOG)
    );

    let label = 'Total';
    let labelKey = 'total'; 
    
    if (isRecurring) {
        let { start, end } = { start: '', end: '' };
        const today = getTodayDateString();
        
        if (goal.frequency === 'daily') {
            start = today; end = today;
            label = 'Today';
            labelKey = 'today';
        } else if (goal.frequency === 'weekly') {
            const bounds = getRangeBounds(today, 'week');
            start = bounds.start; end = bounds.end;
            label = 'Week';
            labelKey = 'week';
        } else if (goal.frequency === 'monthly') {
            const bounds = getRangeBounds(today, 'month');
            start = bounds.start; end = bounds.end;
            label = 'Month';
            labelKey = 'month';
        }
        
        periodTasks = periodTasks.filter(t => isDateInRange(t.date, start, end));
    }
    
    let current = 0;
    
    if (periodTasks.length > 0) {
        if (isTimeBased) {
            const totalMinutes = periodTasks.reduce((sum, t) => sum + t.duration, 0);
            current = (u.includes('min') || u.includes('分') || u.includes('m')) ? totalMinutes : Math.round((totalMinutes / 60) * 10) / 10;
        } else {
            current = periodTasks.length;
        }
    } else {
        current = goal.completedUnits || 0;
    }
    
    const percentage = goal.totalUnits > 0 ? Math.min(100, Math.round((current / goal.totalUnits) * 100)) : 0;

    return { current, target: goal.totalUnits, percentage, label, labelKey };
};

export const isTaskMainThread = (task: TimeBlock, goals: Goal[]): boolean => {
    if (!task.goalId) return false;
    const goal = goals.find(g => g.id === task.goalId);
    return goal?.isMainThread || false;
};

export const translations = {
  en: {
    preferences: 'Preferences', language: 'Language', theme: 'Theme', lightMode: 'Light', darkMode: 'Dark', system: 'System', exportBackup: 'Export Backup', importBackup: 'Import Backup', backupRestore: 'Backup & Restore', general: 'General',
    sponsor: 'Sponsor Support', sponsorDesc: 'Buy the developer a coffee', wechatPay: 'WeChat Pay', alipay: 'Alipay', saveQr: 'Save QR Code', close: 'Close', recommendWechat: 'Recommended: WeChat Pay', recommendAlipay: 'Recommended: Alipay',
    webdavTitle: 'Cloud Sync', plan: 'Plan', stats: 'Stats', sync: 'Settings', goals: 'OKR', 
    today: 'Today', jumpToToday: 'Today', goalsPlan: 'Key Results', goalLibrary: 'OKR Dashboard', newGoal: 'New Item', dragToPlan: 'Plan It', dailyPlan: 'Daily Focus', noPlans: 'Empty Schedule', dragGoalsHint: 'Drag Key Results from left', addManually: 'add manually', addNewTask: 'Add New Task', fromGoal: 'Linked', created: 'Created', manualTask: 'Ad-hoc', time: 'Time', actualDevice: 'Actual / Device', totalScreenTime: 'Time Tracked', productiveTime: 'Deep Work', topApp: 'Top Activity', cloudSyncTitle: 'Cloud Sync (Multi-platform)', webdavDesc: 'Sync across devices.', serverUrl: 'Server URL', username: 'Username', password: 'Password', saveConfig: 'Save', saved: 'Saved!', newTask: 'New Task', editTask: 'Edit Task', title: 'Title', whatDoing: 'What are you doing?', date: 'Date', start: 'Start', end: 'End', description: 'Notes', addDetails: 'Details...', delete: 'Delete', cancel: 'Cancel', save: 'Save', usage: 'Usage', noData: 'No Data',
    testConnection: 'Test', testing: 'Testing...', connSuccess: 'Success', connFailed: 'Failed', syncing: 'Syncing...', synced: 'Synced', manual: 'Manual', desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', device: 'Device', source: 'Source', targetFolder: 'Target Folder',
    fetchUsage: 'Fetch Usage', fetching: 'Syncing...', analysisComplete: 'Done',
    day: 'Day', week: 'Week', month: 'Month', year: 'Year',
    chartApps: 'Activities', chartTrend: 'Trend', chartHours: 'Hours', chartActivity: 'Hours', chartExecution: 'Execution', chartCapital: 'ROI',
    planned: 'Planned', actual: 'Actual',
    syncData: 'Sync Cloud', syncingCloud: 'Syncing...', upToDate: 'Updated', newItems: 'new items',
    inbox: 'Inbox', addToInbox: 'Add to Inbox', noUnscheduled: 'Inbox Empty', goalManager: 'OKR System', goalProgress: 'Progress', moveToInbox: 'Move to Inbox',
    priority: 'Priority', deadline: 'Deadline', motivation: 'Why this matters', high: 'High', medium: 'Medium', low: 'Low', targetAmount: 'Target', unitName: 'Unit', color: 'Color',
    todoList: 'Active KRs', templates: 'Templates', unplanned: 'Unplanned',
    total: 'Total',
    category: 'Category', frequency: 'Frequency',
    health: 'Health', learning: 'Learning', career: 'Career', life: 'Life', financial: 'Financial', other: 'Other',
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', once: 'Once',
    milestones: 'Milestones', addMilestone: 'Add milestone...',
    layer: 'Type',
    principle: 'Objective (Vision)',
    method: 'Key Result (Project)',
    application: 'Task (Action)',
    isMainThread: 'Is this a Top Priority?',
    mainThread: 'Focus',
    sacrificeStatement: 'Focus Commitment',
    sacrificePlaceholder: 'I will sacrifice X to achieve this...',
    timeValue: 'Time Value',
    investment: 'Investment',
    consumption: 'Consumption',
    maintenance: 'Maintenance',
    osVersion: 'System v1',
    goalManagerTitle: 'OKR Dashboard',
    roi: 'Time ROI',
    saveTemplate: 'Save Today as Template',
    enterTemplateName: 'Template Name',
    templateSaved: 'Template Saved!',
    noPlansToSave: 'No plans found to save for today',
    deleteTemplate: 'Delete Template',
    deviceMonitorTitle: 'Device Agent',
    deviceServerUrl: 'Agent URL (e.g. localhost:3001)',
    unitH: 'h', unitM: 'm',
    subGoals: 'Sub-goals',
    introTitle: 'How to use OKR?',
    introDesc: "OKR (Objectives & Key Results) connects your daily tasks to your biggest dreams. Don't let busywork drown out your vision.",
    introStep1: '1. Set Objectives',
    introStep2: '2. Define Key Results',
    introStep3: '3. Execute Daily',
    objective: 'Objective',
    keyResult: 'Key Result',
    visionDir: 'Vision & Direction',
    projAction: 'Project & Action',
    objDesc: 'Qualitative Vision (Where?)',
    krDesc: 'Quantitative Milestone (How?)',
    objEx: 'Ex: Become an Expert',
    krEx: 'Ex: Ship 3 Apps',
    alignObjective: 'Align with Objective',
    noParent: '-- No Parent (Independent Project) --',
    independentKR: 'Independent Key Results (No Objective)',
    subTasksOpt: 'Sub-tasks (Optional)',
    addKR: 'Add Key Result',
    addSubTask: 'Add sub-task...',
    placeTitleObj: 'e.g. Become a Senior Developer',
    placeTitleKR: 'e.g. Build 5 React Apps',
    placeTaskResolve: 'What did you do instead?',
    placeTaskResolveEx: 'e.g. Browsing, Emergency call...',
    execution: 'Execution',
    peakHour: 'Peak Hour',
    hoursWorked: 'Hours Worked',
    avgDay: 'Avg/Day',
    provider: 'Provider',
    nutstore: 'Nutstore (Jianguoyun)',
    custom: 'Custom WebDAV',
    syncFailed: 'Sync Failed',
    exportSuccess: 'Export successful!',
    saveSuccess: 'QR Code saved!',
    // Sync errors
    authUsernameOrPasswordMissing: 'Username or password is missing',
    authFailedInvalidCredentials: 'Authentication failed: Invalid username or password',
    syncNotEnabled: 'WebDAV sync is not enabled in settings',
    urlNotConfigured: 'WebDAV URL is not configured',
    usernameNotConfigured: 'WebDAV username is not configured',
    passwordNotConfigured: 'WebDAV password is not configured',
    uploadFailed: 'Upload failed (HTTP {status}): {statusText}',
    permissionDenied: 'Permission denied: Check folder permissions',
    remoteFolderNotFound: 'Remote folder not found: Check target folder path',
    urlRequired: 'WebDAV URL is required',
    stateRequiredForSync: 'Current state is required for sync',
    usernameAndPasswordRequired: 'Username and password are required',
    tauriHttpApiNotAvailable: 'Tauri HTTP API is not available. Please ensure @tauri-apps/plugin-http is installed and configured.'
  },
  'zh-CN': {
    preferences: '偏好设置', language: '语言', theme: '主题', lightMode: '亮色', darkMode: '暗色', system: '系统', exportBackup: '导出备份', importBackup: '导入备份', backupRestore: '备份与恢复', general: '常规',
    sponsor: '赞助支持', sponsorDesc: '请开发者喝杯咖啡', wechatPay: '微信支付', alipay: '支付宝', saveQr: '保存二维码', close: '关闭', recommendWechat: '推荐使用微信支付', recommendAlipay: '推荐使用支付宝',
    webdavTitle: '云端同步', plan: '日程', stats: '统计', sync: '设置', goals: '目标', 
    today: '今天', jumpToToday: '今天', goalsPlan: '关键结果', goalLibrary: 'OKR看板', newGoal: '新建', dragToPlan: '拖入日程', dailyPlan: '今日专注', noPlans: '暂无计划', dragGoalsHint: '从左侧拖入关键结果', addManually: '手动添加', addNewTask: '添加新任务', fromGoal: '关联', created: '创建于', manualTask: '临时', time: '时间', actualDevice: '实际 / 设备', deviceUsage: '设备分析', totalScreenTime: '记录时间', productiveTime: '专注时间', topApp: '主要活动', cloudSyncTitle: '多平台云同步', webdavDesc: '多设备同步', serverUrl: '服务器地址', username: '用户名', password: '密码', saveConfig: '保存', saved: '已保存', newTask: '新任务', editTask: '编辑', title: '标题', whatDoing: '在做什么？', date: '日期', start: '开始', end: '结束', description: '备注', addDetails: '详情...', delete: '删除', cancel: '取消', save: '保存', usage: '用时', noData: '无数据',
    testConnection: '测试连接', testing: '连接中...', connSuccess: '连接成功', connFailed: '连接失败', syncing: '同步中...', synced: '已同步', manual: '手动', desktop: '电脑', mobile: '手机', tablet: '平板', device: '设备', source: '来源', targetFolder: '目标文件夹',
    fetchUsage: '同步云端', fetching: '同步中...', analysisComplete: '完成',
    day: '日', week: '周', month: '月', year: '年',
    chartApps: '活动分布', chartTrend: '趋势', chartHours: '时段', chartActivity: '时段', chartExecution: '执行力', chartCapital: '投资回报',
    planned: '计划', actual: '实际',
    syncData: '云同步', syncingCloud: '同步中...', upToDate: '已是最新', newItems: '条更新',
    inbox: '收集箱', addToInbox: '记一笔', noUnscheduled: '收集箱空空如也', goalManager: 'OKR 目标管理', goalProgress: '进度', moveToInbox: '放回收集箱',
    priority: '优先级', deadline: '截止', motivation: '目标动机', high: '高', medium: '中', low: '低', targetAmount: '目标量', unitName: '单位', color: '颜色',
    todoList: '进行中KR', templates: '模板', unplanned: '计划外',
    total: '总计',
    category: '分类', frequency: '频率',
    health: '健康', learning: '成长', career: '事业', life: '生活', financial: '财富', other: '其他',
    daily: '每天', weekly: '每周', monthly: '每月', once: '一次性',
    milestones: '里程碑 / 检查点', addMilestone: '添加里程碑...',
    layer: '类型',
    principle: '愿景目标 (Objective)',
    method: '关键结果 (Key Result)',
    application: '具体任务 (Task)',
    isMainThread: '是否为最高优先级？',
    mainThread: '核心聚焦',
    sacrificeStatement: '聚焦承诺',
    sacrificePlaceholder: '为了达成这个OKR，我承诺减少...',
    timeValue: '时间属性',
    investment: '投资 (高价值)',
    consumption: '消费 (纯娱乐)',
    maintenance: '维持 (不得不做)',
    osVersion: '系统版本',
    goalManagerTitle: 'OKR 战略看板',
    roi: '时间回报率',
    saveTemplate: '保存今天为模板',
    enterTemplateName: '模板名称',
    templateSaved: '模板已保存！',
    noPlansToSave: '今日无计划任务，无法保存。',
    deleteTemplate: '删除模板',
    deviceMonitorTitle: '设备监控代理',
    deviceServerUrl: '代理地址 (如 localhost:3001)',
    unitH: '小时', unitM: '分',
    subGoals: '子目标',
    introTitle: '如何使用 OKR 目标管理？',
    introDesc: 'OKR (Objectives & Key Results) 是一套帮你聚焦核心目标的工具。别让日常琐事淹没了你的方向。',
    introStep1: '1. 设定定性愿景 (Objective)',
    introStep2: '2. 设定关键结果 (Key Result)',
    introStep3: '3. 每日执行推进',
    objective: '愿景目标',
    keyResult: '关键结果',
    visionDir: '方向与愿景',
    projAction: '项目与行动',
    objDesc: '定性的愿景 (我要去哪里?)',
    krDesc: '定量的里程碑 (如何证明?)',
    objEx: '例：成为行业顶尖专家',
    krEx: '例：发布3个开源库',
    alignObjective: '对齐到愿景 (Objective)',
    noParent: '-- 无父级 (独立项目) --',
    independentKR: '独立关键结果 (无愿景)',
    subTasksOpt: '子任务 (可选)',
    addKR: '添加关键结果',
    addSubTask: '添加子任务...',
    placeTitleObj: '例如：成为高级开发工程师',
    placeTitleKR: '例如：完成5个React项目',
    placeTaskResolve: '实际上做了什么？',
    placeTaskResolveEx: '例如：玩游戏、发呆、处理紧急邮件...',
    execution: '执行力',
    peakHour: '高效时段',
    hoursWorked: '工作时长',
    avgDay: '日均',
    provider: '服务商',
    nutstore: '坚果云 (国内推荐)',
    custom: '自定义 WebDAV',
    syncFailed: '同步失败',
    exportSuccess: '导出成功！',
    saveSuccess: '二维码已保存！',
    // Sync errors
    authUsernameOrPasswordMissing: '用户名或密码缺失',
    authFailedInvalidCredentials: '认证失败：用户名或密码无效',
    syncNotEnabled: 'WebDAV 云同步未在设置中启用',
    urlNotConfigured: 'WebDAV URL 未配置',
    usernameNotConfigured: 'WebDAV 用户名未配置',
    passwordNotConfigured: 'WebDAV 密码未配置',
    uploadFailed: '上传失败 (HTTP {status}): {statusText}',
    permissionDenied: '权限被拒绝：请检查文件夹权限',
    remoteFolderNotFound: '远程文件夹未找到：请检查目标文件夹路径',
    urlRequired: '需要 WebDAV URL',
    stateRequiredForSync: '需要当前状态才能同步',
    usernameAndPasswordRequired: '需要用户名和密码',
    tauriHttpApiNotAvailable: 'Tauri HTTP API 不可用。请确保已安装并配置 @tauri-apps/plugin-http。'
  }
};

export const t = (key: string, lang: string = 'en') => {
  const dict = translations[lang as keyof typeof translations] || translations['en'];
  return dict[key as keyof typeof dict] || translations['en'][key as keyof typeof translations['en']] || key;
};
