
import React, { useState, useEffect } from 'react';
import { TimeBlock, TaskType, TaskStatus, TimeValue } from '../types';
import { formatTime, parseTime, t } from '../utils';
import { X, Trash2, Save, Clock, AlignLeft, Type, Calendar, Smartphone, Monitor, Tablet, User, Inbox, AlertCircle, TrendingUp, Coffee, Wrench } from 'lucide-react';

interface Props {
  isOpen: boolean;
  task: TimeBlock | null; 
  onClose: () => void;
  onSave: (task: TimeBlock) => void;
  onDelete: (id: string) => void;
  lang: string;
  mode?: 'edit' | 'create' | 'resolve_failure';
}

const TaskEditorModal: React.FC<Props> = ({ isOpen, task, onClose, onSave, onDelete, lang, mode = 'edit' }) => {
  const [formData, setFormData] = useState<Partial<TimeBlock>>({
      timeValue: 'maintenance'
  });
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
          ...task,
          timeValue: task.timeValue || 'maintenance'
      });
      if (task.startTime >= 0) {
          setStartTimeStr(formatTime(task.startTime));
          setEndTimeStr(formatTime(task.startTime + task.duration));
      } else {
          setStartTimeStr('');
          setEndTimeStr('');
      }
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const start = startTimeStr ? parseTime(startTimeStr) : -1;
    let duration = 60;
    
    if (start >= 0) {
        const end = parseTime(endTimeStr);
        duration = end - start;
        if (duration < 0) duration += 24 * 60; 
        if (duration === 0) duration = 15;
    }

    onSave({
      ...task,
      ...formData,
      startTime: start,
      duration: duration
    } as TimeBlock);
    onClose();
  };

  const isActual = task.type === TaskType.ACTUAL || task.type === TaskType.DEVICE_LOG;

  // Dynamic Title Logic
  let modalTitle = t('editTask', lang);
  if (mode === 'create') modalTitle = t('newTask', lang);
  if (mode === 'resolve_failure') modalTitle = t('placeTaskResolve', lang);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">
        <div className={`flex items-center justify-between p-4 border-b shrink-0 ${mode === 'resolve_failure' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30' : 'bg-gray-50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-700'}`}>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${mode === 'resolve_failure' ? 'text-orange-800 dark:text-orange-200' : 'text-gray-800 dark:text-gray-100'}`}>
            {mode === 'resolve_failure' && <AlertCircle size={20}/>}
            {modalTitle}
            {isActual && mode !== 'resolve_failure' && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">{t('actualDevice', lang)}</span>}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* Title */}
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
              placeholder={mode === 'resolve_failure' ? t('placeTaskResolveEx', lang) : t('whatDoing', lang)}
            />
          </div>

          {/* Time Value Classification (The "Capital vs Expense" Philosophy) */}
          <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  {t('timeValue', lang)}
              </label>
              <div className="grid grid-cols-3 gap-2">
                  <button
                      type="button"
                      onClick={() => setFormData({ ...formData, timeValue: 'investment' })}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${formData.timeValue === 'investment' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-70'}`}
                  >
                      <TrendingUp size={16} className="mb-1" />
                      <span className="text-[10px] font-bold">{t('investment', lang)}</span>
                  </button>
                  <button
                      type="button"
                      onClick={() => setFormData({ ...formData, timeValue: 'maintenance' })}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${formData.timeValue === 'maintenance' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-70'}`}
                  >
                      <Wrench size={16} className="mb-1" />
                      <span className="text-[10px] font-bold">{t('maintenance', lang)}</span>
                  </button>
                  <button
                      type="button"
                      onClick={() => setFormData({ ...formData, timeValue: 'consumption' })}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${formData.timeValue === 'consumption' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-500 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-70'}`}
                  >
                      <Coffee size={16} className="mb-1" />
                      <span className="text-[10px] font-bold">{t('consumption', lang)}</span>
                  </button>
              </div>
          </div>

          {/* Date & Time (Condensed) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar size={12} /> {t('date', lang)}
                </label>
                <input
                type="date"
                value={formData.date || ''}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className={`w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs ${mode === 'resolve_failure' ? 'opacity-70 pointer-events-none' : ''}`}
                readOnly={mode === 'resolve_failure'}
                />
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('start', lang)}</label>
                    <input type="time" value={startTimeStr} onChange={e => setStartTimeStr(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs" />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('end', lang)}</label>
                    <input type="time" value={endTimeStr} onChange={e => setEndTimeStr(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs" />
                </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 mt-2 pb-safe">
            <div className="flex gap-2">
                {mode !== 'create' && mode !== 'resolve_failure' && (
                    <button type="button" onClick={() => { onDelete(task.id); onClose(); }} className="flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors text-sm font-medium">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium">{t('cancel', lang)}</button>
              <button type="submit" className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg shadow-md transition-all transform active:scale-95 text-sm font-medium ${mode === 'resolve_failure' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'}`}>
                <Save size={16} /> {t('save', lang)}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskEditorModal;
