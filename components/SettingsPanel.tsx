
import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../types';
import { Cloud, Check, Save, RefreshCw, AlertCircle, Database, Download, Upload, Server, Activity, ShieldCheck, HardDrive, Info, Globe, ShieldAlert, ExternalLink, Smartphone, Monitor, ChevronDown, ChevronUp, Link, Heart, X } from 'lucide-react';
import { t, getPlatform, Platform } from '../utils';
import { syncService } from '../services/syncService';

interface Props {
  config: AppState['webDavConfig'];
  onSave: (config: AppState['webDavConfig'], deviceConfig?: AppState['deviceMonitorConfig']) => void;
  lang: string;
  onImportData?: (state: AppState) => void;
  fullState?: AppState; 
}

const SettingsPanel: React.FC<Props> = ({ config, onSave, lang, onImportData, fullState }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [deviceConfig, setDeviceConfig] = useState<AppState['deviceMonitorConfig']>(
      fullState?.deviceMonitorConfig || { serverUrl: 'http://localhost:3001', enabled: false }
  );
  
  const [isSaved, setIsSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Sponsorship Modal State
  const [showSponsor, setShowSponsor] = useState(false);
  const [sponsorTab, setSponsorTab] = useState<'wechat' | 'alipay'>('wechat');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<Platform>('web');

  // Toast state for download feedback
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'info'>('success');

  const PROVIDERS = {
      CUSTOM: { id: 'custom', name: t('custom', lang), url: '', icon: Globe, placeholder: 'https://dav.example.com/' },
      JIAN_GUO_YUN: { id: 'jianguoyun', name: t('nutstore', lang), url: 'https://dav.jianguoyun.com/dav/', icon: HardDrive, placeholder: 'https://dav.jianguoyun.com/dav/' },
      NEXTCLOUD: { id: 'nextcloud', name: 'Nextcloud', url: 'https://your-instance.com/remote.php/dav/files/USER/', icon: Server, placeholder: 'https://.../remote.php/dav/files/USER/' }
  };

  const [provider, setProvider] = useState<string>('custom');

  useEffect(() => {
     setPlatform(getPlatform());
  }, []);

  useEffect(() => {
      setLocalConfig(config);
      if (fullState?.deviceMonitorConfig) {
          setDeviceConfig(fullState.deviceMonitorConfig);
      }
      
      // Auto-detect provider
      if (config.url === PROVIDERS.JIAN_GUO_YUN.url) setProvider('jianguoyun');
      else if (config.url.includes('remote.php/dav')) setProvider('nextcloud');
      else setProvider('custom');
      
  }, [config, fullState]);

  const handleProviderSelect = (id: string) => {
      setProvider(id);
      if (id === 'jianguoyun') {
          setLocalConfig(prev => ({ ...prev, url: PROVIDERS.JIAN_GUO_YUN.url }));
      } else if (id === 'nextcloud') {
          // Don't overwrite if it looks like a valid nextcloud url already
          if (!localConfig.url.includes('remote.php/dav')) {
              setLocalConfig(prev => ({ ...prev, url: PROVIDERS.NEXTCLOUD.url }));
          }
      } else {
          // Custom: Keep existing or clear if it was a preset
          if (localConfig.url === PROVIDERS.JIAN_GUO_YUN.url) {
              setLocalConfig(prev => ({ ...prev, url: '' }));
          }
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localConfig, deviceConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Show toast notification
  const showToastNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setErrorMessage('');
    
    // Attempt to test with current local state
    try {
        const result = await syncService.testConnection(localConfig);
        if (result.success) {
            setTestStatus('success');
            if (result.message) setErrorMessage(result.message); 
            setTimeout(() => { setTestStatus('idle'); setErrorMessage(''); }, 4000);
        } else {
            setTestStatus('error');
            setErrorMessage(result.message || 'Unknown error');
        }
    } catch (e: any) {
        setTestStatus('error');
        setErrorMessage(e.message || 'Connection failed');
    }
  };

  const handleExport = () => {
      if (!fullState) return;
      const dataStr = JSON.stringify(fullState, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifesync_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToastNotification(lang === 'zh-CN' ? '备份导出成功！' : 'Backup exported successfully!', 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              if (json && json.tasks) {
                  if (window.confirm("Importing will overwrite current data. Continue?")) {
                      onImportData?.(json);
                      alert("Import successful!");
                  }
              } else {
                  alert("Invalid format.");
              }
          } catch (err) {
              alert("Parse failed.");
          }
          if(fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  const handleSaveQr = () => {
      const imgSrc = sponsorTab === 'wechat' ? '/wechat.png' : '/alipay.png';
      const link = document.createElement('a');
      link.href = imgSrc;
      link.download = `lifesync_donate_${sponsorTab}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToastNotification(lang === 'zh-CN' ? '二维码已保存' : 'QR code saved', 'success');
  };

  const inputClasses = "w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm";

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-32 md:pb-8 relative">
      
      {/* 1. BACKUP & RESTORE */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Database size={12}/> {lang === 'zh-CN' ? '本地数据' : 'Local Data'}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                  <Download size={16} />
                  {lang === 'zh-CN' ? '导出备份 (JSON)' : 'Export Backup'}
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                  <Upload size={16} />
                  {lang === 'zh-CN' ? '导入备份' : 'Import Backup'}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
          </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* 2. WEBDAV CONFIGURATION */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden transition-colors duration-300">
            {localConfig.enabled && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>}
            
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${localConfig.enabled ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                        <Cloud size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('webdavTitle', lang)}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('webdavDesc', lang)}</p>
                    </div>
                </div>
                
                {/* Master Switch */}
                <label className="flex items-center cursor-pointer relative z-10">
                    <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={localConfig.enabled}
                        onChange={(e) => setLocalConfig({...localConfig, enabled: e.target.checked})} 
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${localConfig.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out mt-1 ml-1 ${localConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                </label>
            </div>

            <div className={`space-y-5 transition-all duration-300 ${!localConfig.enabled ? 'opacity-50 pointer-events-none filter grayscale' : ''}`}>
                
                {/* QUICK PROVIDER SELECTION */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('provider', lang)}</label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(PROVIDERS).map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleProviderSelect(p.id)}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all gap-1.5 ${provider === p.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                            >
                                <p.icon size={20} className={provider === p.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                                <span className="text-[10px] font-bold text-center leading-tight">{p.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Server URL */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('serverUrl', lang)}</label>
                    <div className="relative">
                        <input
                            type="url"
                            value={localConfig.url}
                            onChange={(e) => setLocalConfig({ ...localConfig, url: e.target.value })}
                            placeholder={PROVIDERS[provider as keyof typeof PROVIDERS]?.placeholder || 'https://'}
                            className={`${inputClasses} ${provider === 'jianguoyun' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500' : ''}`}
                            readOnly={provider === 'jianguoyun'}
                        />
                        {provider === 'jianguoyun' && <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
                    </div>
                </div>

                {/* Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('username', lang)}</label>
                        <input
                            type="text"
                            value={localConfig.user}
                            onChange={(e) => setLocalConfig({...localConfig, user: e.target.value})}
                            className={inputClasses}
                            autoComplete="off"
                            placeholder="email@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('password', lang)}</label>
                        <input
                            type="password"
                            value={localConfig.pass}
                            onChange={(e) => setLocalConfig({...localConfig, pass: e.target.value})}
                            className={inputClasses}
                            autoComplete="new-password"
                            placeholder="App Password"
                        />
                    </div>
                </div>

                {/* Nutstore Hint */}
                {provider === 'jianguoyun' && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 rounded-lg text-xs border border-amber-100 dark:border-amber-900/30">
                        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                        <p>
                            {lang === 'zh-CN' 
                            ? <span><b>重要提示：</b>坚果云 WebDAV <b>必须</b>使用“应用专用密码”，不能使用登录密码。请在坚果云网页版“安全选项”中生成。</span> 
                            : <span><b>Important:</b> Nutstore requires an <b>App Password</b>, not your login password. Generate one in Nutstore Security Settings.</span>}
                        </p>
                    </div>
                )}

                {/* Target Folder */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('targetFolder', lang)}</label>
                    <input
                        type="text"
                        value={localConfig.targetFolder || ''}
                        onChange={(e) => setLocalConfig({...localConfig, targetFolder: e.target.value})}
                        placeholder="/LifeSync"
                        className={inputClasses}
                    />
                </div>

                {/* Advanced / Network Settings Toggle */}
                <div>
                    <button 
                        type="button" 
                        onClick={() => setShowAdvanced(!showAdvanced)} 
                        className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
                    >
                        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {lang === 'zh-CN' ? '高级网络设置 (CORS / 代理)' : 'Advanced Network Settings'}
                    </button>

                    {showAdvanced && (
                        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2">
                            {platform === 'web' ? (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <Globe size={12}/> CORS Proxy
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mb-3">
                                        {lang === 'zh-CN' ? 'Web版受浏览器限制，连接第三方WebDAV通常需要代理。建议使用 corsproxy.io' : 'Web browsers block direct WebDAV access. Use a proxy like corsproxy.io'}
                                    </p>
                                    
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {[
                                            { name: 'None', val: '' },
                                            { name: 'CorsProxy.io', val: 'https://corsproxy.io/?' },
                                            { name: 'ThingProxy', val: 'https://thingproxy.freeboard.io/fetch/' }
                                        ].map(opt => (
                                            <button 
                                                key={opt.name}
                                                type="button"
                                                onClick={() => setLocalConfig({...localConfig, corsProxy: opt.val})}
                                                className={`text-[10px] py-1 px-2.5 rounded-full border transition-all ${localConfig.corsProxy === opt.val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                                            >
                                                {opt.name}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={localConfig.corsProxy || ''}
                                            onChange={(e) => setLocalConfig({...localConfig, corsProxy: e.target.value})}
                                            placeholder="https://corsproxy.io/?"
                                            className={inputClasses}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                    <ShieldCheck size={14} />
                                    <span>Native Mode Active: No CORS Proxy required.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all border font-medium text-sm ${
                        testStatus === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50' :
                        testStatus === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50' :
                        'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                    >
                        {testStatus === 'testing' ? <RefreshCw size={16} className="animate-spin"/> :
                        testStatus === 'success' ? <Check size={16}/> :
                        testStatus === 'error' ? <AlertCircle size={16}/> :
                        <RefreshCw size={16}/>}
                        
                        {testStatus === 'testing' ? t('testing', lang) :
                        testStatus === 'success' ? t('connSuccess', lang) :
                        testStatus === 'error' ? t('connFailed', lang) :
                        t('testConnection', lang)}
                    </button>

                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm font-medium text-sm active:scale-95"
                    >
                        {isSaved ? <Check size={16} /> : <Save size={16} />}
                        {isSaved ? t('saved', lang) : t('saveConfig', lang)}
                    </button>
                </div>
                
                {/* Error Message Display */}
                {testStatus !== 'idle' && errorMessage && (
                    <div className={`flex items-start gap-2 text-xs p-3 rounded-lg border animate-in fade-in slide-in-from-top-1 ${testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30'}`}>
                        {testStatus === 'success' ? <Check size={14} className="mt-0.5" /> : <ShieldAlert size={14} className="mt-0.5" />}
                        <span className="break-all leading-relaxed">{errorMessage}</span>
                    </div>
                )}
            </div>
        </div>

        {/* 3. DEVICE MONITOR */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm opacity-90">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                        <Activity size={24} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('deviceMonitorTitle', lang)}</h2>
                </div>
            </div>
            <div className="space-y-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {lang === 'zh-CN' 
                    ? '如果你使用 Python 本地代理 (Lifesync Agent) 来追踪窗口活动，请在此配置代理地址。' 
                    : 'If you use a local Python agent (Lifesync Agent) to track window activity, configure the address here.'}
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('deviceServerUrl', lang)}</label>
                    <input
                        type="url"
                        value={deviceConfig?.serverUrl || ''}
                        onChange={(e) => setDeviceConfig(prev => ({ ...prev, serverUrl: e.target.value, enabled: true }))}
                        placeholder="http://localhost:3001"
                        className={inputClasses}
                    />
                </div>
            </div>
        </div>

        {/* 4. SPONSORSHIP SECTION */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-50 dark:bg-pink-900/30 text-pink-500 dark:text-pink-400 rounded-lg">
                        <Heart size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('sponsor', lang)}</h2>
                    </div>
                </div>
                <button 
                    type="button"
                    onClick={() => setShowSponsor(true)} 
                    className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900/50 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                    {t('sponsorDesc', lang)}
                </button>
            </div>
        </div>

      </form>

      {/* SPONSOR MODAL */}
      {showSponsor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowSponsor(false)}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                
                {/* Header with Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-700">
                    <button 
                        onClick={() => setSponsorTab('wechat')} 
                        className={`flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${sponsorTab === 'wechat' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        {t('wechatPay', lang)}
                    </button>
                    <div className="w-px bg-gray-100 dark:bg-gray-700"></div>
                    <button 
                        onClick={() => setSponsorTab('alipay')} 
                        className={`flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${sponsorTab === 'alipay' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        {t('alipay', lang)}
                    </button>
                </div>

                {/* QR Code Area */}
                <div className="p-8 flex flex-col items-center justify-center bg-white dark:bg-gray-800">
                    <div className={`w-52 h-52 bg-white rounded-xl flex items-center justify-center overflow-hidden border-4 shadow-sm relative ${sponsorTab === 'wechat' ? 'border-emerald-100' : 'border-blue-100'}`}>
                        <img 
                            src={sponsorTab === 'wechat' ? '/wechat.png' : '/alipay.png'} 
                            alt={`${sponsorTab} QR Code`} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                e.currentTarget.parentElement?.classList.add('flex-col', 'p-4');
                                e.currentTarget.parentElement!.innerHTML = `<p class="text-xs text-center text-gray-400">Image not found.<br/>Place <b>${sponsorTab === 'wechat' ? 'wechat.png' : 'alipay.png'}</b><br/>in public folder.</p>`;
                            }}
                        />
                    </div>
                    <p className="mt-6 text-xs font-medium text-gray-400 dark:text-gray-500 text-center">
                        {sponsorTab === 'wechat' ? t('recommendWechat', lang) : t('recommendAlipay', lang)}
                    </p>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 bg-gray-50 dark:bg-gray-900/30">
                    <button 
                        onClick={handleSaveQr} 
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
                    >
                        <Download size={14} /> {t('saveQr', lang)}
                    </button>
                    <button 
                        onClick={() => setShowSponsor(false)} 
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 rounded-xl text-xs font-bold transition-colors"
                    >
                        {t('close', lang)}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-24 md:bottom-12 left-1/2 transform -translate-x-1/2 z-[2000] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border ${toastType === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-700 text-white'}`}>
            <Check size={16} />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
