
import React, { useState } from 'react';
import { Goal, TimeBlock } from '../types';
import { Plus, Edit2, ArrowLeft, Zap, Crown, HelpCircle, X, Crosshair, TrendingUp, ChevronRight, LayoutDashboard, Link, Target, CornerDownRight } from 'lucide-react';
import { t, calculateGoalProgress } from '../utils';

interface Props {
  goals: Goal[];
  allTasks?: TimeBlock[]; 
  onAddGoal: (parentId?: string) => void; // Updated signature
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
  onUpdateGoal: (goal: Goal) => void;
  onBack: () => void;
  lang: string;
}

// Beginner Guide for OKR - Hidden by default, toggled via button
const IntroCard = ({ onClose, lang }: { onClose: () => void, lang: string }) => (
    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-4 md:p-6 mb-4 md:mb-8 text-white shadow-xl relative overflow-hidden shrink-0 animate-in slide-in-from-top-4 fade-in duration-300">
        <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-10 -translate-y-10 pointer-events-none">
            <LayoutDashboard size={180} />
        </div>
        {/* Added z-20 to ensure button is clickable above the z-10 content content container if they overlap */}
        <button onClick={onClose} className="absolute top-2 right-2 md:top-4 md:right-4 text-white/50 hover:text-white transition-colors bg-black/10 hover:bg-black/20 rounded-full p-1 z-20 cursor-pointer">
            <X size={20} />
        </button>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-4 md:gap-8">
            <div className="flex-1">
                <h3 className="text-base md:text-xl font-bold mb-2 flex items-center gap-2">
                    <HelpCircle size={18} className="text-amber-300 md:w-6 md:h-6"/> 
                    {t('introTitle', lang)}
                </h3>
                <p className="text-xs md:text-base text-indigo-100 mb-3 md:mb-4 leading-relaxed opacity-90">
                    {t('introDesc', lang)}
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] md:text-sm font-medium">
                   <div className="px-2 py-1 bg-white/10 rounded-lg border border-white/10">{t('introStep1', lang)}</div>
                   <div className="px-2 py-1 bg-white/10 rounded-lg border border-white/10">{t('introStep2', lang)}</div>
                   <div className="px-2 py-1 bg-white/10 rounded-lg border border-white/10">{t('introStep3', lang)}</div>
                </div>
            </div>
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-1 text-amber-300 font-bold text-[10px] md:text-xs uppercase tracking-wider">
                        <Crown size={12} className="md:w-3.5 md:h-3.5" /> {t('objective', lang)}
                    </div>
                    <p className="text-xs text-indigo-50 font-medium mb-0.5">
                        {t('objDesc', lang)}
                    </p>
                    <p className="text-[10px] text-indigo-200 opacity-70 leading-tight">
                        {t('objEx', lang)}
                    </p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-1 text-emerald-300 font-bold text-[10px] md:text-xs uppercase tracking-wider">
                        <Crosshair size={12} className="md:w-3.5 md:h-3.5" /> {t('keyResult', lang)}
                    </div>
                    <p className="text-xs text-indigo-50 font-medium mb-0.5">
                        {t('krDesc', lang)}
                    </p>
                    <p className="text-[10px] text-indigo-200 opacity-70 leading-tight">
                        {t('krEx', lang)}
                    </p>
                </div>
            </div>
        </div>
    </div>
);

interface KRItemProps {
    goal: Goal;
    allTasks: TimeBlock[];
    onEditGoal: (g: Goal) => void;
    lang: string;
}

const KRItem: React.FC<KRItemProps> = ({ goal, allTasks, onEditGoal, lang }) => {
    const { current, target, percentage, labelKey } = calculateGoalProgress(goal, allTasks);
    const isDone = percentage >= 100;
    
    // Check if the labelKey is 'milestones' which means Sub-goals
    const displayUnit = labelKey === 'milestones' ? t('subGoals', lang) : goal.unitName;

    return (
        <div 
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData("application/lifesync-goal", goal.id);
                e.dataTransfer.effectAllowed = "move";
            }}
            onClick={(e) => { e.stopPropagation(); onEditGoal(goal); }}
            className={`group relative flex items-center gap-3 p-2 md:p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing bg-white dark:bg-gray-800 ${isDone ? 'border-transparent opacity-60' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm'}`}
        >
            <div className={`w-1 h-8 md:h-10 rounded-full shrink-0 ${isDone ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-600 group-hover:bg-indigo-400 transition-colors'}`}></div>
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h4 className={`text-sm font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                        {goal.title}
                    </h4>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                        {current}/{target} {displayUnit}
                    </span>
                </div>
                
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%`, backgroundColor: isDone ? '#10b981' : goal.color }}
                    />
                </div>
            </div>

            <button className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                <Edit2 size={14} />
            </button>
        </div>
    );
};

const GoalManager: React.FC<Props> = ({ goals, allTasks = [], onAddGoal, onEditGoal, onDeleteGoal, onUpdateGoal, onBack, lang }) => {
    // Default to false (hidden)
    const [showIntro, setShowIntro] = useState(false);

    // Toggle logic for the help button
    const toggleIntro = () => {
        setShowIntro(prev => !prev);
    };

    // Filter Objectives (Layer = Principle)
    const objectives = goals.filter(g => g.layer === 'principle');
    // Key Results are 'method' or 'application' (though usually 'method' in this model)
    const keyResults = goals.filter(g => g.layer !== 'principle');

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <Target size={20} className="text-indigo-600 md:w-6 md:h-6" /> 
                            {t('goalManagerTitle', lang)}
                        </h2>
                        <p className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-medium">
                            {lang === 'zh-CN' ? '愿景 · 策略 · 执行' : 'Vision · Strategy · Execution'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                   {/* Help Button - Always visible to allow toggling */}
                   <button 
                        onClick={toggleIntro} 
                        className={`p-2 rounded-full transition-colors ${showIntro ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`} 
                        title="Help"
                   >
                       <HelpCircle size={20} />
                   </button>
                   
                   <button 
                        onClick={() => onAddGoal()}
                        className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-200 dark:shadow-none transition-all active:scale-95 text-xs md:text-sm font-bold"
                   >
                        <Plus size={16} /> <span className="hidden xs:inline">{t('newGoal', lang)}</span>
                   </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                    {showIntro && <IntroCard onClose={() => setShowIntro(false)} lang={lang} />}

                    {objectives.length === 0 && keyResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <LayoutDashboard size={40} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-600 dark:text-gray-300">Start Your OKR Journey</h3>
                            <p className="text-sm text-gray-400 max-w-xs mt-2">Create an Objective to define your vision, then add Key Results to track progress.</p>
                            <button onClick={() => onAddGoal()} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">Create Objective</button>
                        </div>
                    ) : (
                        <div className="space-y-6 md:space-y-8">
                            {/* 1. OBJECTIVES LIST */}
                            {objectives.map(obj => {
                                // Find children
                                const children = keyResults.filter(kr => kr.parentId === obj.id);
                                const progress = calculateGoalProgress(obj, allTasks);
                                
                                return (
                                    <div key={obj.id} className="group relative">
                                        {/* Visual Connection Line */}
                                        <div className="absolute left-6 top-16 bottom-0 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
                                        
                                        {/* Objective Card */}
                                        <div className="relative z-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow mb-3 md:mb-4">
                                             <div className="flex items-start justify-between gap-4">
                                                 <div className="flex items-start gap-3 md:gap-4">
                                                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                                                         <Crown size={20} className="md:w-6 md:h-6" />
                                                     </div>
                                                     <div>
                                                         <div className="flex items-center gap-2 mb-1">
                                                             <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{t('objective', lang)}</span>
                                                             {obj.isMainThread && (
                                                                 <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                     <Zap size={10} fill="currentColor" /> Focus
                                                                 </span>
                                                             )}
                                                         </div>
                                                         <h3 className="text-base md:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => onEditGoal(obj)}>
                                                             {obj.title}
                                                         </h3>
                                                         {obj.sacrificeStatement && (
                                                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic flex items-center gap-1">
                                                                 <Zap size={10} className="text-orange-400" />
                                                                 "{obj.sacrificeStatement}"
                                                             </p>
                                                         )}
                                                     </div>
                                                 </div>

                                                 <div className="flex flex-col items-end gap-2">
                                                     <button onClick={() => onEditGoal(obj)} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                                         <Edit2 size={16} />
                                                     </button>
                                                     <div className="text-right hidden sm:block">
                                                         <div className="text-xs text-gray-400">{t('goalProgress', lang)}</div>
                                                         <div className="text-sm font-bold font-mono text-gray-700 dark:text-gray-200">{progress.percentage}%</div>
                                                     </div>
                                                 </div>
                                             </div>
                                        </div>

                                        {/* Key Results Grid */}
                                        <div className="pl-2 md:pl-12 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 relative">
                                            {children.map(kr => (
                                                <div key={kr.id} className="relative">
                                                     {/* Connector for each KR */}
                                                     <div className="absolute -left-4 top-1/2 w-4 h-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
                                                     <KRItem goal={kr} allTasks={allTasks} onEditGoal={onEditGoal} lang={lang} />
                                                </div>
                                            ))}
                                            
                                            {/* Add KR Button */}
                                            <button 
                                                onClick={() => {
                                                    // Pass the parent ID to automatically link the new Key Result to this Objective
                                                    onAddGoal(obj.id);
                                                }}
                                                className="relative flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-xs font-medium h-[64px]"
                                            >
                                                <div className="absolute -left-4 top-1/2 w-4 h-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
                                                <Plus size={16} /> {t('addKR', lang)}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* ORPHAN KEY RESULTS (No Parent) */}
                            {keyResults.filter(kr => !kr.parentId).length > 0 && (
                                <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Link size={16} /> {t('independentKR', lang)}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {keyResults.filter(kr => !kr.parentId).map(kr => (
                                            <KRItem key={kr.id} goal={kr} allTasks={allTasks} onEditGoal={onEditGoal} lang={lang} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GoalManager;
