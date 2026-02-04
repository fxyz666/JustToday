
import React from 'react';
import { Goal } from '../types';
import { Target, GripVertical, Edit2 } from 'lucide-react';
import { t } from '../utils';

interface Props {
  goals: Goal[];
  onDragStart: (e: React.DragEvent, goal: Goal) => void;
  onAddGoal: () => void;
  onEditGoal: (goal: Goal) => void;
  lang: string;
}

const GoalPanel: React.FC<Props> = ({ goals, onDragStart, onAddGoal, onEditGoal, lang }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col overflow-hidden transition-colors duration-300">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{t('goalLibrary', lang)}</h2>
        </div>
        <button 
          onClick={onAddGoal}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-1 rounded-md transition-colors"
        >
          {t('newGoal', lang)}
        </button>
      </div>

      <div className="p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
        {goals.map(goal => (
          <div
            key={goal.id}
            draggable
            onDragStart={(e) => onDragStart(e, goal)}
            className="group relative p-3 rounded-xl border border-gray-200 dark:border-gray-600/50 bg-white dark:bg-gray-700/30 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                style={{ backgroundColor: goal.color }}
              >
                {Math.round((goal.completedUnits / goal.totalUnits) * 100)}%
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate pr-6">{goal.title}</h3>
                </div>
                <div className="flex items-center justify-between mt-1">
                     <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        {goal.completedUnits} / {goal.totalUnits} {goal.unitName}
                     </p>
                </div>
                
                <div className="w-full bg-gray-100 dark:bg-gray-600 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(goal.completedUnits / goal.totalUnits) * 100}%`, backgroundColor: goal.color }}
                  ></div>
                </div>
              </div>
              
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-end absolute right-2 top-2">
                 <button 
                   onClick={() => onEditGoal(goal)}
                   className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                 >
                    <Edit2 size={12} />
                 </button>
              </div>
            </div>
            
            {/* Drag Handle Indicator */}
            <div className="absolute top-1/2 right-2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-500 pointer-events-none">
                 <GripVertical size={16} />
            </div>

            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-white/50 dark:via-gray-600/50 to-transparent pointer-events-none"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalPanel;
