
import React, { useEffect, useRef, useMemo } from 'react';
import { TimeBlock, TaskType, ChartType } from '../types';
import { t, getRangeBounds, formatDuration } from '../utils';
import { PieChart, BarChart3, Clock, Scale, TrendingUp, Zap, Target, Hourglass } from 'lucide-react';

interface Props {
  tasks: TimeBlock[];
  lang: string;
  range: 'day' | 'week' | 'month' | 'year';
  selectedDate: string;
  theme?: 'light' | 'dark';
  chartType: ChartType;
  onChartChange: (type: ChartType) => void;
}

const StatsChart: React.FC<Props> = ({ tasks, lang, range, selectedDate, theme = 'light', chartType, onChartChange }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  // --- DATA PREPARATION HELPERS ---
  const getActuals = () => tasks.filter(t => t.type !== TaskType.PLAN);
  
  const summaryMetrics = useMemo(() => {
      const actuals = getActuals();
      const totalMinutes = actuals.reduce((sum, t) => sum + t.duration, 0);
      
      if (chartType === 'capital') {
          let investment = 0;
          actuals.forEach(t => { if (t.timeValue === 'investment') investment += t.duration; });
          const roi = totalMinutes > 0 ? Math.round((investment / totalMinutes) * 100) : 0;
          return [
              { label: t('roi', lang), value: `${roi}%`, icon: TrendingUp, color: roi >= 50 ? 'text-emerald-500' : 'text-orange-500' },
              { label: t('investment', lang), value: formatDuration(investment, lang), icon: Zap, color: 'text-indigo-500' }
          ];
      }
      
      if (chartType === 'execution') {
          const { start, end } = getRangeBounds(selectedDate, range);
          const planMins = tasks.filter(t => t.type === TaskType.PLAN && t.date >= start && t.date <= end).reduce((sum, t) => sum + t.duration, 0);
          const rate = planMins > 0 ? Math.round((totalMinutes / planMins) * 100) : 0;
          return [
              { label: t('execution', lang), value: `${rate}%`, icon: Scale, color: rate >= 80 ? 'text-emerald-500' : 'text-blue-500' },
              { label: t('planned', lang), value: formatDuration(planMins, lang), icon: Target, color: 'text-gray-500' }
          ];
      }

      if (chartType === 'apps') {
          const appMap = new Map<string, number>();
          actuals.forEach(t => appMap.set(t.title, (appMap.get(t.title) || 0) + t.duration));
          let topApp = '-';
          let topDur = 0;
          appMap.forEach((dur, name) => {
              if (dur > topDur) { topDur = dur; topApp = name; }
          });
          topApp = topApp.split(' - ')[0].substring(0, 12);
          
          return [
              { label: t('topApp', lang), value: topApp, icon: Zap, color: 'text-amber-500' },
              { label: t('total', lang), value: formatDuration(totalMinutes, lang), icon: Clock, color: 'text-indigo-500' }
          ];
      }

      if (chartType === 'hours') {
          return [
              { label: t('totalScreenTime', lang), value: formatDuration(totalMinutes, lang), icon: Clock, color: 'text-indigo-600' },
              { label: t('peakHour', lang), value: 'Coming Soon', icon: Hourglass, color: 'text-pink-500' }
          ];
      }

      return [
          { label: t('totalScreenTime', lang), value: formatDuration(totalMinutes, lang), icon: Clock, color: 'text-indigo-600' },
          { label: t('avgDay', lang), value: formatDuration(range === 'day' ? totalMinutes : Math.round(totalMinutes / 7), lang), icon: TrendingUp, color: 'text-blue-500' }
      ];
  }, [tasks, chartType, range, lang, selectedDate]);


  const getAppsData = () => {
    const actuals = getActuals();
    if (actuals.length === 0) return [];
    const dataMap = new Map<string, number>();
    actuals.forEach(t => {
      let key = t.title.split(' - ')[0]; 
      if(key.length > 15) key = key.substring(0, 15) + '...';
      dataMap.set(key, (dataMap.get(key) || 0) + t.duration);
    });
    
    const finalData: {name:string, value:number}[] = [];
    let otherSum = 0;
    const sorted = Array.from(dataMap.entries()).sort((a,b) => b[1] - a[1]);
    
    sorted.forEach((item, index) => {
        if(index < 6) finalData.push({name: item[0], value: item[1]});
        else otherSum += item[1];
    });
    if(otherSum > 0) finalData.push({name: t('other', lang), value: otherSum});
    return finalData; 
  };

  const getExecutionData = () => {
      const { start, end } = getRangeBounds(selectedDate, range);

      // Day mode: aggregate by hour (0-23)
      if (range === 'day') {
          const xAxis: string[] = [];
          const planData: number[] = [];
          const actualData: number[] = [];

          // Get tasks for the selected date
          const dayTasks = tasks.filter(t => t.date === selectedDate);

          for (let hour = 0; hour < 24; hour++) {
              xAxis.push(`${hour}${t('unitH', lang)}`);

              // Filter tasks by hour
              const hourStart = hour * 60;
              const hourEnd = (hour + 1) * 60;

              const hourPlans = dayTasks
                  .filter(t => t.type === TaskType.PLAN && t.startTime >= hourStart && t.startTime < hourEnd)
                  .reduce((sum, t) => sum + t.duration, 0);

              const hourActuals = dayTasks
                  .filter(t => t.type !== TaskType.PLAN && t.startTime >= hourStart && t.startTime < hourEnd)
                  .reduce((sum, t) => sum + t.duration, 0);

              planData.push(Math.round(hourPlans / 60 * 10) / 10);
              actualData.push(Math.round(hourActuals / 60 * 10) / 10);
          }

          return { xAxis, planData, actualData };
      }

      // Other modes: aggregate by date
      const startD = new Date(start + 'T00:00:00');
      const endD = new Date(end + 'T00:00:00');
      const xAxis: string[] = [];
      const planData: number[] = [];
      const actualData: number[] = [];

      const curr = new Date(startD);
      while(curr <= endD) {
          // Use local date instead of toISOString to avoid timezone issues
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          xAxis.push(dateStr.slice(5));

          const dayPlans = tasks.filter(t => t.type === TaskType.PLAN && t.date === dateStr).reduce((sum, t) => sum + t.duration, 0);
          const dayActuals = tasks.filter(t => t.type !== TaskType.PLAN && t.date === dateStr).reduce((sum, t) => sum + t.duration, 0);

          planData.push(Math.round(dayPlans / 60 * 10) / 10);
          actualData.push(Math.round(dayActuals / 60 * 10) / 10);
          curr.setDate(curr.getDate() + 1);
      }
      return { xAxis, planData, actualData };
  };

  const getCapitalData = () => {
      const actuals = getActuals();
      let investment = 0, consumption = 0, maintenance = 0;
      actuals.forEach(t => {
          if (t.timeValue === 'investment') investment += t.duration;
          else if (t.timeValue === 'consumption') consumption += t.duration;
          else maintenance += t.duration;
      });
      return [
          { value: investment, name: t('investment', lang), itemStyle: { color: '#10b981' } },
          { value: maintenance, name: t('maintenance', lang), itemStyle: { color: '#6366f1' } },
          { value: consumption, name: t('consumption', lang), itemStyle: { color: '#f59e0b' } },
      ].filter(d => d.value > 0);
  };

  const getTrendData = () => {
      // Day mode: show hourly distribution for the selected day
      if (range === 'day') {
          const dayTasks = getActuals().filter(t => t.date === selectedDate);
          const buckets = new Array(24).fill(0);

          dayTasks.forEach(t => {
              const hour = Math.floor(t.startTime / 60);
              if (hour >= 0 && hour < 24) {
                  buckets[hour] += t.duration;
              }
          });

          const xAxis = Array.from({ length: 24 }, (_, i) => `${i}${t('unitH', lang)}`);
          const data = buckets.map(mins => Math.round(mins / 60 * 10) / 10);

          return { xAxis, data };
      }

      // Other modes: aggregate by date
      const { start, end } = getRangeBounds(selectedDate, range);
      const dataMap = new Map<string, number>();
      getActuals().forEach(t => dataMap.set(t.date, (dataMap.get(t.date) || 0) + t.duration));

      const xAxis: string[] = [];
      const data: number[] = [];
      const curr = new Date(start + 'T00:00:00');
      const endD = new Date(end + 'T00:00:00');

      while (curr <= endD) {
          // Use local date instead of toISOString to avoid timezone issues
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          xAxis.push(dateStr.slice(5));
          data.push(Math.round((dataMap.get(dateStr) || 0) / 60 * 10) / 10);
          curr.setDate(curr.getDate() + 1);
      }

      return { xAxis, data };
  };

  const getHourlyDistributionData = () => {
      const buckets = new Array(24).fill(0);
      getActuals().forEach(t => {
          // Simplification: just add duration to the start hour bucket
          // A more complex version would distribute duration across crossing hours
          const hour = Math.floor(t.startTime / 60);
          if(hour >= 0 && hour < 24) {
              buckets[hour] += t.duration;
          }
      });
      const data = buckets.map(mins => Math.round(mins / 60 * 10) / 10); // Convert to hours
      const xAxis = Array.from({length: 24}, (_, i) => `${i}${t('unitH', lang)}`);
      return { xAxis, data };
  };

  // --- CHART RENDERING ---
  const renderChart = () => {
    if (!chartRef.current || !(window as any).echarts) return;
    if (chartInstance.current) chartInstance.current.dispose();
    
    const chart = (window as any).echarts.init(chartRef.current, theme === 'dark' ? 'dark' : undefined);
    chartInstance.current = chart;
    const isMobile = window.innerWidth < 768;
    const textColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
    
    // Optimized Grid for Mobile
    // bottom: '10%' ensures enough space for labels even with containLabel
    // top: '15%' ensures title/legend space
    const commonGrid = {
        left: '2%',
        right: '4%',
        bottom: '10%', 
        top: '15%',
        containLabel: true 
    };

    const tooltipStyle = {
        backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        textStyle: { color: textColor, fontSize: 12 },
        backdropFilter: 'blur(4px)',
        padding: 8,
        borderRadius: 8,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        confine: true
    };

    let option: any = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', ...tooltipStyle },
        grid: commonGrid,
        animationDuration: 500,
    };

    if (chartType === 'apps' || chartType === 'capital') {
        const isCapital = chartType === 'capital';
        const data = isCapital ? getCapitalData() : getAppsData();
        
        option.legend = {
            bottom: 0, 
            left: 'center', 
            icon: 'circle',
            type: 'scroll',
            textStyle: { color: textColor, fontSize: 10 },
            itemWidth: 8,
            itemHeight: 8,
            pageIconColor: textColor,
            pageTextStyle: { color: textColor }
        };
        option.series = [{
            name: isCapital ? t('timeValue', lang) : t('usage', lang),
            type: 'pie',
            radius: isMobile ? ['30%', '55%'] : ['40%', '70%'],
            center: ['50%', '40%'],
            itemStyle: { 
                borderRadius: 5, 
                borderColor: theme === 'dark' ? '#111827' : '#fff', 
                borderWidth: 2 
            },
            label: { show: !isMobile, color: textColor },
            data: data.length ? data : [{name: t('noData', lang), value: 0, itemStyle: { color: '#e5e7eb' }}]
        }];
    } else if (chartType === 'execution') {
        const { xAxis, planData, actualData } = getExecutionData();
        const isShortRange = xAxis.length <= 7;
        
        option.tooltip.trigger = 'axis';
        option.legend = { 
            top: 0, 
            right: 0, 
            textStyle: { color: textColor, fontSize: 10 }, 
            itemWidth: 8, 
            itemHeight: 8,
            itemGap: 8 
        };
        option.xAxis = { 
            type: 'category', 
            data: xAxis, 
            axisLabel: { 
                color: textColor,
                fontSize: isMobile ? 8 : 9,
                interval: isShortRange ? 0 : 'auto', 
                rotate: isMobile ? 45 : 0, 
                hideOverlap: false, // Ensure we try to show as much as possible, let interval handle it
                margin: 8
            },
            axisTick: { show: false },
            axisLine: { show: false }
        };
        option.yAxis = { 
            type: 'value', 
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.2 } }, 
            axisLabel: { fontSize: 9, color: textColor } 
        };
        option.series = [
            {
                name: t('planned', lang), type: 'bar', data: planData,
                itemStyle: { color: '#e5e7eb', borderRadius: [2, 2, 0, 0] },
                barGap: '-100%', barCategoryGap: isMobile ? '50%' : '40%'
            },
            {
                name: t('actual', lang), type: 'bar', data: actualData,
                itemStyle: { 
                    color: new (window as any).echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#818cf8' }, { offset: 1, color: '#6366f1' }
                    ]),
                    borderRadius: [2, 2, 0, 0] 
                }
            }
        ];
    } else if (chartType === 'hours') {
        // HOURLY DISTRIBUTION
        const { xAxis, data } = getHourlyDistributionData();
        
        option.tooltip.trigger = 'axis';
        option.xAxis = {
            type: 'category',
            data: xAxis,
            axisLabel: { 
                color: textColor, 
                fontSize: isMobile ? 8 : 9, 
                interval: isMobile ? 3 : 2, // Explicit interval to avoid overcrowding but show enough
                rotate: isMobile ? 45 : 0,
                hideOverlap: false
            }, 
            axisTick: { show: false },
            axisLine: { show: false }
        };
        option.yAxis = {
            type: 'value',
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.2 } },
            axisLabel: { fontSize: 9, color: textColor }
        };
        option.series = [{
            name: t('hoursWorked', lang), type: 'bar', data: data,
            itemStyle: { 
                color: new (window as any).echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#f472b6' }, { offset: 1, color: '#db2777' }
                ]),
                borderRadius: [2, 2, 0, 0]
            }
        }];
    } else {
        // Trend (Simple Line)
        const { xAxis, data } = getTrendData();
        const isShortRange = xAxis.length <= 7;

        option.tooltip.trigger = 'axis';
        option.xAxis = { 
            type: 'category', 
            data: xAxis, 
            axisLabel: { 
                color: textColor, 
                fontSize: isMobile ? 8 : 9,
                interval: isShortRange ? 0 : 'auto',
                rotate: isMobile ? 45 : 0,
                hideOverlap: false
            }, 
            boundaryGap: false,
            axisTick: { show: false },
            axisLine: { show: false }
        };
        option.yAxis = { 
            type: 'value', 
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.2 } }, 
            axisLabel: { fontSize: 9, color: textColor } 
        };
        option.series = [{
            name: t('chartHours', lang), type: 'line', data: data, smooth: true,
            symbol: 'circle',
            symbolSize: 4,
            showSymbol: false,
            lineStyle: { width: 2, color: '#6366f1' },
            itemStyle: { color: '#6366f1', borderWidth: 1, borderColor: '#fff' },
            areaStyle: {
                color: new (window as any).echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(99, 102, 241, 0.4)' },
                    { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }
                ])
            }
        }];
    }

    chart.setOption(option);
  };

  useEffect(() => {
    const timer = setTimeout(renderChart, 50);
    const handleResize = () => { chartInstance.current?.resize(); renderChart(); };
    window.addEventListener('resize', handleResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize); chartInstance.current?.dispose(); };
  }, [tasks, lang, chartType, range, theme, summaryMetrics]);

  const TabButton = ({ type, icon: Icon, label }: { type: ChartType, icon: any, label: string }) => (
    <button
        onClick={() => onChartChange(type)}
        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg transition-all duration-200 ${
            chartType === type 
            ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm font-bold scale-100 ring-1 ring-black/5 dark:ring-white/5' 
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50 font-medium scale-95 hover:scale-100'
        }`}
        title={label}
    >
        <Icon size={16} strokeWidth={chartType === type ? 2.5 : 2} className="sm:w-3.5 sm:h-3.5" />
        <span className="text-[9px] sm:text-[10px] uppercase tracking-tight leading-none truncate max-w-full">{label}</span>
    </button>
  );

  return (
      <div className="flex flex-col h-full w-full gap-4">
          {/* 1. TABS - Optimized Segmented Control */}
          <div className="bg-gray-100 dark:bg-gray-700/40 p-1 rounded-xl flex gap-1 shrink-0">
              <TabButton type="capital" icon={TrendingUp} label={t('chartCapital', lang)} />
              <TabButton type="execution" icon={Scale} label={t('chartExecution', lang)} />
              <TabButton type="hours" icon={Clock} label={t('chartHours', lang)} />
              <TabButton type="apps" icon={PieChart} label={t('chartApps', lang)} />
              <TabButton type="trend" icon={BarChart3} label={t('chartTrend', lang)} />
          </div>

          {/* 2. SUMMARY CARDS */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
              {summaryMetrics.map((metric, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between min-h-[50px]">
                      <div className="min-w-0 overflow-hidden">
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider truncate">{metric.label}</p>
                          <p className={`text-sm md:text-base font-bold ${metric.color} truncate leading-tight`}>{metric.value}</p>
                      </div>
                      <div className={`p-1.5 rounded-lg shrink-0 ${metric.color.replace('text-', 'bg-').replace('500', '50').replace('600', '50')} dark:bg-gray-700/50`}>
                          <metric.icon size={14} className={metric.color} />
                      </div>
                  </div>
              ))}
          </div>

          {/* 3. CHART CONTAINER - Maximized */}
          <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative p-2 overflow-hidden">
              <div ref={chartRef} className="w-full h-full" />
          </div>
      </div>
  );
};

export default StatsChart;
