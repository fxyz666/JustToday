
import React from 'react';
import { TimeBlock, TaskType, TaskStatus } from '../types';
import { CheckSquare, Square, XSquare, ListTodo, Plus, Edit2, Trash2, Clock, Calendar } from 'lucide-react';
import { t, formatDuration, getTodayDateString } from '../utils';

interface Props {
  tasks: TimeBlock[];
  onTaskUpdate: (task: TimeBlock) => void;
  onAddTask: () => void;
  onTaskCreate?: (task: TimeBlock) => void; // Made optional to fit type definition, but used if present
  onEdit: (task: TimeBlock) => void;
  onDelete: (id: string) => void;
  lang: string;
  isMobile?: boolean;
  hideHeader?: boolean;
}

const DailyPlanList: React.FC<Props> = ({ tasks, onTaskUpdate, onAddTask, onEdit, onDelete, lang, isMobile = false, hideHeader = false }) => {
  const plans = tasks
    .filter(t => t.type === TaskType.PLAN)
    .sort((a, b) => a.startTime - b.startTime);

  const toggleStatus = (task: TimeBlock) => {
    const nextStatus = 
      task.status === TaskStatus.TODO ? TaskStatus.COMPLETED :
      task.status === TaskStatus.COMPLETED ? TaskStatus.FAILED : TaskStatus.TODO;
    onTaskUpdate({ ...task, status: nextStatus });
  };

  const renderIcon = (status: TaskStatus) => {
    switch(status) {
      case TaskStatus.COMPLETED: return <CheckSquare size={isMobile ? 14 : 18} className="text-emerald-500 dark:text-emerald-400" />;
      case TaskStatus.FAILED: return <XSquare size={isMobile ? 14 : 18} className="text-red-500 dark:text-red-400" />;
      default: return <Square size={isMobile ? 14 : 18} className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors" />;
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-full overflow-hidden relative transition-colors duration-300 ${isMobile ? 'border-none shadow-none bg-transparent' : 'p-0'}`}>
      
      {/* HEADER: Daily Ritual Dashboard - Optimized Layout */}
      {!hideHeader && (
        <div className={`border-b border-gray-100 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shrink-0 flex items-center justify-between relative z-20 ${isMobile ? 'h-auto py-1.5 px-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg mb-1' : 'h-12 px-3'}`}>
            
            {/* Left: Title with Icon Background */}
            <div className="flex items-center gap-2 z-10 shrink-0">
                {!isMobile && (
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <ListTodo size={16} strokeWidth={2.5} />
                </div>
                )}
                {isMobile && <ListTodo size={12} className="text-gray-400" />}
                <h3 className={`font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider truncate ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
                    {t('dailyPlan', lang)}
                </h3>
            </div>

            {/* Right: Date & Add Action */}
            <div className="flex items-center gap-2 shrink-0">
                {!isMobile && (
                    <div className="hidden xs:flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 shadow-sm">
                        <Calendar size={10} className="text-gray-400 dark:text-gray-500" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 font-mono tracking-tight">
                            {getTodayDateString()}
                        </span>
                    </div>
                )}

                <button 
                    onClick={onAddTask}
                    className={`flex items-center justify-center rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-400 hover:text-indigo-600 dark:text-gray-500 dark:hover:text-indigo-400 transition-all active:scale-95 ${isMobile ? 'w-5 h-5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'w-8 h-8'}`}
                    title={t('addNewTask', lang)}
                >
                    <Plus size={isMobile ? 12 : 18} strokeWidth={2.5} />
                </button>
            </div>
        </div>
      )}
      
      {/* TASK LIST */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? 'space-y-1.5' : 'space-y-2 p-3'}`}>
        {plans.length === 0 ? (
           <div className={`flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 text-center border-2 border-dashed border-gray-100 dark:border-gray-700/50 rounded-xl bg-gray-50/30 dark:bg-gray-800/30 ${isMobile ? 'mx-0 py-4' : 'mx-1 min-h-[120px]'}`}>
             {!isMobile && <ListTodo size={24} className="mb-2 opacity-20" />}
             <p className={`font-medium ${isMobile ? 'text-[10px]' : 'text-xs'}`}>{t('noPlans', lang)}</p>
             {!isMobile && <p className="mt-1 opacity-50 text-[10px]">{t('dragGoalsHint', lang)}</p>}
           </div>
        ) : (
           plans.map(task => (
             <div 
               key={task.id} 
               className={`group flex items-start gap-2 cursor-pointer rounded-xl border transition-all relative select-none ${
                   task.status === TaskStatus.COMPLETED 
                   ? 'bg-gray-50/50 dark:bg-gray-800/30 border-transparent opacity-60' 
                   : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-sm'
               } ${isMobile ? 'p-2 text-[10px]' : 'p-3 text-sm hover:-translate-y-0.5'}`} 
               onClick={() => toggleStatus(task)}
             >
               <button className="mt-0.5 hover:scale-110 transition-transform shrink-0 focus:outline-none text-gray-400">
                 {renderIcon(task.status)}
               </button>
               <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                 <div className={`leading-tight font-medium transition-all truncate ${task.status === TaskStatus.COMPLETED ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-200'}`}>
                   {task.title}
                 </div>
                 <div className="flex items-center gap-2">
                     <span className={`flex items-center gap-1 font-mono px-1.5 py-0.5 rounded ${task.status === TaskStatus.COMPLETED ? 'bg-transparent text-gray-400' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'} ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
                        {!isMobile && <Clock size={10} />}
                        {formatDuration(task.duration, lang)}
                     </span>
                 </div>
               </div>
               
               {!isMobile && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/90 dark:bg-gray-800/90 shadow-sm border border-gray-100 dark:border-gray-600 rounded-lg p-0.5 backdrop-blur-sm">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><Edit2 size={12}/></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1.5 text-gray-500 hover:text-red-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={12}/></button>
                </div>
               )}
             </div>
           ))
        )}
      </div>
    </div>
  );
};

export default DailyPlanList;
