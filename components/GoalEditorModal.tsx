
import React, { useState, useEffect } from 'react';
import { Goal, Priority, GoalCategory, GoalFrequency, Milestone, GoalLayer } from '../types';
import { X, Trash2, Save, Target, Hash, Palette, Type, Calendar, Flag, AlignLeft, Layers, Repeat, Heart, BookOpen, Briefcase, Smile, DollarSign, ListChecks, Plus, CheckCircle2, Circle, Zap, Anchor, ShieldAlert, Crown, Crosshair, ArrowRight, Link, FileText } from 'lucide-react';
import { t, generateId } from '../utils';

interface Props {
  isOpen: boolean;
  goal: Goal | null; // null for new
  existingGoals?: Goal[]; // For selecting parent
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onDelete: (id: string) => void;
  lang: string;
}

const GoalEditorModal: React.FC<Props> = ({ isOpen, goal, existingGoals = [], onClose, onSave, onDelete, lang }) => {
  const [formData, setFormData] = useState<Partial<Goal>>({
      color: '#6366f1',
      unitName: 'Session',
      priority: 'medium',
      category: 'other',
      frequency: 'once',
      milestones: [],
      layer: 'method', // Default to Key Result/Project
      isMainThread: false,
      sacrificeStatement: '',
      parentId: undefined
  });
  
  // New Milestone State
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneTarget, setNewMilestoneTarget] = useState<number | ''>('');
  const [newMilestoneUnit, setNewMilestoneUnit] = useState('');

  useEffect(() => {
    if (goal) {
      setFormData(goal);
    } else {
        setFormData({
            color: '#6366f1',
            unitName: 'Session',
            totalUnits: 10,
            completedUnits: 0,
            priority: 'medium',
            category: 'other',
            frequency: 'once',
            milestones: [],
            layer: 'method', // Default to Key Result
            isMainThread: false,
            sacrificeStatement: '',
            parentId: undefined
        });
    }
  }, [goal, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    
    // Auto-clean up units if milestones exist
    const hasMilestones = formData.milestones && formData.milestones.length > 0;
    
    onSave({
      ...formData,
      id: goal?.id || undefined, 
      completedUnits: formData.completedUnits || 0,
      totalUnits: hasMilestones ? formData.milestones!.length : (formData.totalUnits || 0),
      unitName: hasMilestones ? 'Sub-goals' : (formData.unitName || 'Session')
    } as Goal);
    onClose();
  };

  const handleAddMilestone = () => {
      if (!newMilestoneTitle.trim()) return;
      const newMilestone: Milestone = {
          id: generateId(),
          title: newMilestoneTitle.trim(),
          isCompleted: false,
          totalUnits: typeof newMilestoneTarget === 'number' ? newMilestoneTarget : undefined,
          unitName: newMilestoneUnit || undefined,
          completedUnits: 0
      };
      setFormData(prev => ({
          ...prev,
          milestones: [...(prev.milestones || []), newMilestone]
      }));
      setNewMilestoneTitle('');
      setNewMilestoneTarget('');
      setNewMilestoneUnit('');
  };

  const handleToggleMilestone = (id: string) => {
      setFormData(prev => ({
          ...prev,
          milestones: prev.milestones?.map(m => m.id === id ? { ...m, isCompleted: !m.isCompleted } : m)
      }));
  };

  const handleDeleteMilestone = (id: string) => {
      setFormData(prev => ({
          ...prev,
          milestones: prev.milestones?.filter(m => m.id !== id)
      }));
  };

  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'];
  const hasMilestones = formData.milestones && formData.milestones.length > 0;
  const isObjective = formData.layer === 'principle';

  // Filter possible parents: Must be Objective (layer=principle) and not self
  const potentialParents = existingGoals.filter(g => g.layer === 'principle' && g.id !== goal?.id);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            {goal ? t('editTask', lang).replace('Task', 'OKR') : t('newGoal', lang)}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* GOAL TYPE SELECTION (OKR STYLE) */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
              <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-2">
                  <Target size={12} /> Select Type
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                  <label className={`relative flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all ${isObjective ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'}`}>
                      <input 
                          type="radio" 
                          name="layer" 
                          value="principle" 
                          checked={formData.layer === 'principle'} 
                          onChange={() => setFormData({...formData, layer: 'principle', parentId: undefined})}
                          className="sr-only"
                      />
                      <Crown size={24} className={isObjective ? 'text-amber-500 mb-2' : 'text-gray-400 mb-2'} />
                      <span className={`text-xs font-bold ${isObjective ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>{t('objective', lang)}</span>
                      <span className="text-[9px] text-gray-400 mt-1 text-center leading-tight">{t('visionDir', lang)}</span>
                  </label>

                  <label className={`relative flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all ${!isObjective ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'}`}>
                      <input 
                          type="radio" 
                          name="layer" 
                          value="method" 
                          checked={formData.layer !== 'principle'} 
                          onChange={() => setFormData({...formData, layer: 'method'})}
                          className="sr-only"
                      />
                      <Crosshair size={24} className={!isObjective ? 'text-emerald-500 mb-2' : 'text-gray-400 mb-2'} />
                      <span className={`text-xs font-bold ${!isObjective ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>{t('keyResult', lang)}</span>
                      <span className="text-[9px] text-gray-400 mt-1 text-center leading-tight">{t('projAction', lang)}</span>
                  </label>
              </div>

              {/* PARENT SELECTOR - Only for Key Results */}
              {!isObjective && potentialParents.length > 0 && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Link size={12} /> {t('alignObjective', lang)}
                      </label>
                      <select 
                        value={formData.parentId || ''}
                        onChange={(e) => setFormData({...formData, parentId: e.target.value || undefined})}
                        className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-800 dark:text-gray-100"
                      >
                          <option value="">{t('noParent', lang)}</option>
                          {potentialParents.map(p => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                      </select>
                  </div>
              )}
          </div>

          {/* BASIC INFO */}
          <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Type size={12} /> {t('title', lang)}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-gray-800 dark:text-gray-100"
                  placeholder={isObjective ? t('placeTitleObj', lang) : t('placeTitleKR', lang)}
                />
              </div>

              {/* OBJECTIVE SPECIFIC FIELDS: SACRIFICE STATEMENT & MAIN THREAD */}
              {isObjective && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        {/* Sacrifice Statement / Vision Note */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <FileText size={12} /> {t('sacrificeStatement', lang)}
                            </label>
                            <textarea 
                                value={formData.sacrificeStatement || ''} 
                                onChange={e => setFormData({ ...formData, sacrificeStatement: e.target.value })} 
                                className="w-full p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400/70"
                                placeholder={t('sacrificePlaceholder', lang)}
                                rows={2}
                            />
                            <p className="text-[10px] text-gray-400 mt-1 opacity-80">
                                {lang === 'zh-CN' ? '定义为了达成愿景，你愿意放弃什么（或填写详细备注）。' : 'Define what you are willing to give up to achieve this (or add notes).'}
                            </p>
                        </div>

                        {/* Main Thread Toggle */}
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input 
                                    type="checkbox" 
                                    checked={formData.isMainThread || false} 
                                    onChange={(e) => setFormData({ ...formData, isMainThread: e.target.checked })} 
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-500 peer-checked:bg-red-500"></div>
                            </label>
                            <div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <Zap size={14} className={formData.isMainThread ? "text-red-500" : "text-gray-400"} />
                                    {t('isMainThread', lang)}
                                </span>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
                                    {lang === 'zh-CN' ? '标记为绝对核心，所有其他事项都应为此让路。' : 'Mark as the absolute core focus. Everything else yields.'}
                                </p>
                            </div>
                        </div>
                  </div>
              )}

              {/* Only show measurement fields for Key Results */}
              {!isObjective && !hasMilestones && (
                 <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                     <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Target size={12} /> {t('targetAmount', lang)}
                        </label>
                        <input type="number" min="1" value={formData.totalUnits || ''} onChange={e => setFormData({ ...formData, totalUnits: parseInt(e.target.value) || 0 })} className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-800 dark:text-gray-100" />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Hash size={12} /> {t('unitName', lang)}
                        </label>
                        <input type="text" value={formData.unitName || ''} onChange={e => setFormData({ ...formData, unitName: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-800 dark:text-gray-100" placeholder="e.g. Hours, Pages" />
                     </div>
                 </div>
              )}
              
              {/* Optional: Milestones for Key Results */}
              {!isObjective && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                     <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                         <ListChecks size={12} /> {t('subTasksOpt', lang)}
                     </label>
                     <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-3 border border-gray-100 dark:border-gray-700">
                         {hasMilestones && (
                             <div className="space-y-2 mb-2">
                                 {formData.milestones!.map(m => (
                                     <div key={m.id} className="flex items-center gap-2 group p-1.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                                         <button type="button" onClick={() => handleToggleMilestone(m.id)} className={`shrink-0 ${m.isCompleted ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                             {m.isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                         </button>
                                         <div className="flex-1 min-w-0">
                                             <div className={`text-sm truncate transition-all ${m.isCompleted ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{m.title}</div>
                                         </div>
                                         <button type="button" onClick={() => handleDeleteMilestone(m.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                                     </div>
                                 ))}
                             </div>
                         )}
                         <div className="flex flex-col gap-2">
                             <input type="text" value={newMilestoneTitle} onChange={(e) => setNewMilestoneTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMilestone())} placeholder={t('addSubTask', lang)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors" />
                             <button type="button" onClick={handleAddMilestone} className="self-end px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-200 text-xs font-medium"><Plus size={14} /></button>
                         </div>
                     </div>
                  </div>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Priority */}
             <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Flag size={12} /> {t('priority', lang)}
                </label>
                <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1">
                   {(['high', 'medium', 'low'] as Priority[]).map(p => (
                       <button key={p} type="button" onClick={() => setFormData({ ...formData, priority: p })} className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${formData.priority === p ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                           {t(p, lang)}
                       </button>
                   ))}
                </div>
             </div>
             {/* Deadline */}
             <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar size={12} /> {t('deadline', lang)}
                </label>
                <input type="date" value={formData.deadline || ''} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-800 dark:text-gray-100 text-sm h-[36px]" />
             </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Palette size={12} /> {t('color', lang)}
            </label>
            <div className="flex flex-wrap gap-2">
                {colors.map(c => (
                    <button key={c} type="button" onClick={() => setFormData({...formData, color: c})} className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === c ? 'border-gray-600 dark:border-gray-300 scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />
                ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 dark:border-gray-700 pb-safe">
            {goal ? (
                <button type="button" onClick={() => { if(goal.id) onDelete(goal.id); onClose(); }} className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors text-sm font-medium">
                <Trash2 size={16} /> {t('delete', lang)}
                </button>
            ) : <div></div>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium">{t('cancel', lang)}</button>
              <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-200 dark:shadow-none transition-all transform active:scale-95 text-sm font-medium"><Save size={16} /> {t('save', lang)}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoalEditorModal;
