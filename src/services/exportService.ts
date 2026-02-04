import { AppState } from '../types';

export type ExportFormat = 'json' | 'csv' | 'xlsx';

export class ExportService {

    /**
     * Export all data to JSON
     */
    exportToJSON(state: AppState): void {
        const data = {
            exportDate: new Date().toISOString(),
            tasks: state.tasks,
            goals: state.goals,
            templates: state.templates,
            version: state.systemVersion || '1.0.0',
            language: state.language || 'zh-CN'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifesync_backup_${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export tasks to CSV
     */
    exportTasksToCSV(state: AppState): void {
        if (!state.tasks || state.tasks.length === 0) {
            alert('No tasks to export');
            return;
        }

        // CSV Header
        const headers = [
            'ID',
            'Title',
            'Date',
            'Start Time',
            'Duration (min)',
            'Type',
            'Status',
            'Color',
            'Goal ID',
            'Description'
        ];

        // Convert tasks to CSV
        const csvContent = [
            headers.join(','),
            ...state.tasks.map(task => [
                task.id,
                `"${task.title.replace(/"/g, '""')}"`,
                task.date,
                task.startTime,
                task.duration,
                task.type,
                task.status,
                task.color || '#6366f1',
                task.goalId || '',
                `"${(task.description || '').replace(/"/g, '""')}"`
            ])
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifesync_tasks_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export goals to CSV
     */
    exportGoalsToCSV(state: AppState): void {
        if (!state.goals || state.goals.length === 0) {
            alert('No goals to export');
            return;
        }

        const headers = [
            'ID',
            'Title',
            'Category',
            'Total Units',
            'Completed Units',
            'Percentage',
            'Unit Name',
            'Color',
            'Status',
            'Frequency',
            'Deadline',
            'Description',
            'Created At',
            'Updated At'
        ];

        const csvContent = [
            headers.join(','),
            ...state.goals.map(goal => [
                goal.id,
                `"${goal.title.replace(/"/g, '""')}]"`,
                goal.category || '',
                goal.totalUnits || 0,
                goal.completedUnits || 0,
                goal.totalUnits > 0 ? `${Math.round((goal.completedUnits / goal.totalUnits) * 100)}%` : '0',
                goal.unitName || 'Session',
                goal.color || '',
                goal.status || 'active',
                goal.frequency || 'once',
                goal.deadline || '',
                `"${(goal.description || '').replace(/"/g, '""')}]"`,
                new Date(goal.createdAt || Date.now()).toISOString(),
                new Date(goal.updatedAt || Date.now()).toISOString()
            ])
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifesync_goals_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export all data to CSV (combined)
     */
    exportAllToCSV(state: AppState): void {
        if ((!state.tasks || state.tasks.length === 0) && (!state.goals || state.goals.length === 0)) {
            alert('No data to export');
            return;
        }

        // Generate combined CSV with both tasks and goals
        const headers = [
            'ID',
            'Type',
            'Title',
            'Date',
            'Start Time',
            'Duration',
            'Status',
            'Color',
            'Goal ID',
            'Description',
            'Created At',
            'Updated At'
        ];

        const rows: string[] = [];

        // Add tasks
        state.tasks.forEach(task => {
            rows.push([
                task.id,
                `Task`,
                `"${task.title.replace(/"/g, '""')}]"`,
                task.date,
                task.startTime,
                task.duration,
                task.status,
                task.color || '#6366f1',
                task.goalId || '',
                `"${(task.description || '').replace(/"/g, '""')}]"`,
                new Date(task.createdAt || Date.now()).toISOString(),
                new Date(task.updatedAt || Date.now()).toISOString()
            ]);
        });

        // Add goals
        state.goals.forEach(goal => {
            rows.push([
                goal.id,
                `Goal`,
                `"${goal.title.replace(/"/g, '""')}]"`,
                '',
                goal.totalUnits || 0,
                goal.completedUnits || 0,
                goal.totalUnits > 0 ? `${Math.round((goal.completedUnits / goal.totalUnits) * 100)}%` : '0',
                goal.unitName || 'Session',
                goal.color || '',
                goal.status || 'active',
                goal.frequency || 'once',
                goal.deadline || '',
                `"${(goal.description || '').replace(/"/g, '""')}]"`,
                new Date(goal.createdAt || Date.now()).toISOString(),
                new Date(goal.updatedAt || Date.now()).toISOString()
            ]);
        });

        const csvContent = [
            headers.join(','),
            ...rows.join('\n')
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifesync_all_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export to Excel-like format (TSV)
     */
    exportToTSV(state: AppState): void {
        if (!state.tasks || state.tasks.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = [
            'ID',
            'Title',
            'Date',
            'Start',
            'Duration',
            'Type',
            'Status',
            'Goal',
            'Color',
            'Created',
            'Updated'
        ];

        const rows: string[] = [];

        // Tasks
        state.tasks.forEach(task => {
            rows.push([
                task.id,
                task.title,
                task.date,
                task.startTime,
                task.duration,
                task.type,
                task.status,
                task.color || '#6366f1',
                task.goalId || '',
                `"${(task.description || '').replace(/"/g, '""')}]"`,
                new Date(task.createdAt || Date.now()).toISOString(),
                new Date(task.updatedAt || Date.now()).toISOString()
            ]);
        });

        // Goals
        state.goals.forEach(goal => {
            rows.push([
                goal.id,
                goal.title,
                '',
                goal.totalUnits || 0,
                goal.completedUnits || 0,
                goal.unitName || 'Session',
                goal.color || '',
                goal.status || 'active',
                goal.frequency || 'once',
                goal.deadline || '',
                `"${(goal.description || '').replace(/"/g, '""')}]"`,
                new Date(goal.createdAt || Date.now()).toISOString(),
                new Date(goal.updatedAt || Date.now()).toISOString()
            ]);
        });

        const tsvContent = [
            headers.join('\t'),
            ...rows.map(row => row.join('\t'))
        ].join('\n');

        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifesync_all_${new Date().getTime()}.tsv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export data to string (for sharing or clipboard)
     */
    exportToString(state: AppState): string {
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            tasks: state.tasks || [],
            goals: state.goals || [],
            templates: state.templates || [],
            version: state.systemVersion || '1.0.0',
            language: state.language || 'zh-CN'
        }, null, 2);
    }

    /**
     * Copy to clipboard
     */
    copyToClipboard(state: AppState): void {
        const dataStr = this.exportToString(state);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(dataStr).then(() => {
                alert('Data copied to clipboard');
            }).catch(err => {
                alert('Failed to copy: ' + err);
            });
        } else {
            alert('Clipboard API not available');
        }
    }
}

export const exportService = new ExportService();
