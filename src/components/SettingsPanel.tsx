
import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../types';
import { Cloud, Check, Save, RefreshCw, AlertCircle, Database, Download, Upload, Server, Activity, ShieldCheck, HardDrive, Info, Globe, ShieldAlert, ExternalLink, Smartphone, Monitor, ChevronDown, ChevronUp, Link, Share2, Palette, Languages, Settings as SettingsIcon, Heart, X } from 'lucide-react';
import { t, getPlatform, Platform } from '../utils';
import { syncService } from '../services/syncService';
import { notificationService } from '../services/notificationService';

// Tauri API types
declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke: (cmd: string, args?: any) => Promise<any>;
      };
    };
  }
}

interface Props {
  config: AppState['webDavConfig'];
  onSave: (config: AppState['webDavConfig'], deviceConfig?: AppState['deviceMonitorConfig']) => void;
  lang: string;
  onImportData?: (state: AppState) => void;
  fullState?: AppState; 
  setLanguage: (lang: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  currentTheme: 'light' | 'dark';
}

const SettingsPanel: React.FC<Props> = ({ config, onSave, lang, onImportData, fullState, setLanguage, setTheme, currentTheme }) => {
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
  const [imageError, setImageError] = useState<Record<string, boolean>>({ wechat: false, alipay: false });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<Platform>('web');

  const PROVIDERS = {
      CUSTOM: { id: 'custom', name: t('custom', lang), url: '', icon: Globe, placeholder: 'https://dav.example.com/' },
      JIAN_GUO_YUN: { id: 'jianguoyun', name: t('nutstore', lang), url: 'https://dav.jianguoyun.com/dav/', icon: HardDrive, placeholder: 'https://dav.jianguoyun.com/dav/' },
      NEXTCLOUD: { id: 'nextcloud', name: 'Nextcloud', url: 'https://your-instance.com/remote.php/dav/files/USER/', icon: Server, placeholder: 'https://.../remote.php/dav/files/USER/' }
  };

  const LOGIN_MODES = {
      MANUAL: { id: 'manual', name: lang === 'zh-CN' ? '账号密码' : 'Username/Password' },
      SSO: { id: 'sso', name: lang === 'zh-CN' ? '坚果云SSO' : 'Nutstore SSO' }
  };

  const [provider, setProvider] = useState<string>('custom');
  const [loginMode, setLoginMode] = useState<'manual' | 'sso'>(localConfig.loginMode || 'manual');
  const [showSSOLink, setShowSSOLink] = useState(false);

  useEffect(() => {
     setPlatform(getPlatform());
  }, []);

  useEffect(() => {
      setLocalConfig(config);
      if (fullState?.deviceMonitorConfig) {
          setDeviceConfig(fullState.deviceMonitorConfig);
      }

      if (config.url === PROVIDERS.JIAN_GUO_YUN.url) setProvider('jianguoyun');
      else if (config.url.includes('remote.php/dav')) setProvider('nextcloud');
      else setProvider('custom');

      setLoginMode(config.loginMode || 'manual');
  }, [config, fullState]);

  const handleProviderSelect = (id: string) => {
      setProvider(id);
      if (id === 'jianguoyun') {
          setLocalConfig(prev => ({ ...prev, url: PROVIDERS.JIAN_GUO_YUN.url }));
      } else if (id === 'nextcloud') {
          if (!localConfig.url.includes('remote.php/dav')) {
              setLocalConfig(prev => ({ ...prev, url: PROVIDERS.NEXTCLOUD.url }));
          }
      } else {
          if (localConfig.url === PROVIDERS.JIAN_GUO_YUN.url) {
              setLocalConfig(prev => ({ ...prev, url: '' }));
          }
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const configToSave = { ...localConfig, loginMode };
    onSave(configToSave, deviceConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setErrorMessage('');
    const configToSave = { ...localConfig, loginMode };
    onSave(configToSave, deviceConfig);

    try {
        const result = await syncService.testConnection(localConfig, lang);
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

  const handleExport = async () => {
      if (!fullState) {
          notificationService.warning(t('noDataToExport', lang) || 'No data to export');
          return;
      }
      
      const dataStr = JSON.stringify(fullState, null, 2);
      const fileName = `lifesync_backup_${new Date().toISOString().split('T')[0]}.json`;

      // Check if running in Tauri v2
      const isTauri = typeof window !== 'undefined' && !!window.__TAURI__?.core?.invoke;

      if (isTauri) {
          try {
              const result = await window.__TAURI__!.core!.invoke('save_file_with_dialog', {
                  defaultName: fileName,
                  content: dataStr
              });
              if (result) {
                  notificationService.success(t('exportSuccess', lang) || 'Export successful! File saved.');
              } else {
                  notificationService.info(t('exportCancelled', lang) || 'Export cancelled');
              }
              return;
          } catch (e) {
              console.error('Tauri save failed:', e);
              notificationService.error(t('exportFailed', lang) || 'Export failed. Please try again.');
          }
      } else {
          // Fallback to browser download
          try {
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              notificationService.success(t('exportSuccess', lang) || 'Export successful! File downloaded.');
          } catch (e) {
              console.error('Export failed:', e);
              notificationService.error(t('exportFailed', lang) || 'Export failed. Please try again.');
          }
      }
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
                      notificationService.success(t('importSuccess', lang) || 'Import successful!');
                  }
              } else {
                  notificationService.error(t('invalidFormat', lang) || 'Invalid format.');
              }
          } catch (err) {
              notificationService.error(t('parseFailed', lang) || 'Parse failed.');
          }
          if(fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  const handleSaveQr = async () => {
      // Use relative path for compatibility with both web and Tauri
      const imgSrc = sponsorTab === 'wechat' ? './wechat.png' : './alipay.png';
      const fileName = `lifesync_donate_${sponsorTab}.png`;
      
      // Check if running in Tauri v2
      const isTauri = typeof window !== 'undefined' && !!window.__TAURI__?.core?.invoke;
      
      if (isTauri) {
          try {
              // Fetch the image as blob first
              const response = await fetch(imgSrc);
              if (!response.ok) {
                  throw new Error(`Failed to fetch image: ${response.status}`);
              }
              const blob = await response.blob();
              const base64Data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      const base64 = reader.result as string;
                      resolve(base64.split(',')[1]);
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
              });
              
              const result = await window.__TAURI__!.core!.invoke('save_binary_file_with_dialog', {
                  defaultName: fileName,
                  contentBase64: base64Data
              });
              
              if (result) {
                  notificationService.success(t('saveSuccess', lang) || 'QR Code saved successfully!');
              } else {
                  notificationService.info(t('saveCancelled', lang) || 'Save cancelled');
              }
              return;
          } catch (e) {
              console.error('Tauri QR save failed:', e);
              notificationService.error(t('saveFailed', lang) || 'Failed to save QR code. Please try again.');
          }
      } else {
          // Fallback to standard download
          try {
              const link = document.createElement('a');
              link.href = imgSrc;
              link.download = fileName;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              notificationService.success(t('saveSuccess', lang) || 'QR Code downloaded successfully!');
          } catch (e) {
              console.error('QR save failed:', e);
              notificationService.error(t('saveFailed', lang) || 'Failed to download QR code. Please try again.');
          }
      }
  };

  const inputClasses = "w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm";

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full pb-32 md:pb-8 relative">
      
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-wider flex items-center gap-2">
              <SettingsIcon size={12}/> {t('preferences', lang)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Languages size={12} /> {t('language', lang)}
                  </label>
                  <select 
                    value={lang} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className={inputClasses}
                  >
                      <option value="zh-CN">中文 (简体)</option>
                      <option value="zh-TW">中文 (繁體)</option>
                      <option value="en">English</option>
                      <option value="ja">日本語</option>
                      <option value="ko">한국어</option>
                      <option value="ru">Русский</option>
                  </select>
              </div>

              <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Palette size={12} /> {t('theme', lang)}
                  </label>
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                      <button 
                        onClick={() => setTheme('light')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all ${currentTheme === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                          {t('lightMode', lang)}
                      </button>
                      <button 
                        onClick={() => setTheme('dark')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all ${currentTheme === 'dark' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                          {t('darkMode', lang)}
                      </button>
                  </div>
              </div>
          </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Database size={12}/> {t('backupRestore', lang)}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                  {platform === 'web' ? <Download size={18} /> : <Share2 size={18} />}
                  <span className="flex flex-col items-start leading-tight">
                      <span className="font-bold text-xs uppercase text-gray-400">{t('exportBackup', lang)}</span>
                      <span>JSON</span>
                  </span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                  <Upload size={18} />
                  <span className="flex flex-col items-start leading-tight">
                      <span className="font-bold text-xs uppercase text-gray-400">{t('importBackup', lang)}</span>
                      <span>JSON</span>
                  </span>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
          </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
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

            <div className={`space-y-5 transition-all duration-300 ${!localConfig.enabled ? 'opacity-50 pointer-events-none filter grayscale' : ''} }`}>

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

                {provider === 'jianguoyun' && (
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            {lang === 'zh-CN' ? '登录方式' : 'Login Method'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(LOGIN_MODES).map(mode => (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => setLoginMode(mode.id as 'manual' | 'sso')}
                                    className={`flex items-center justify-center p-3 rounded-lg border transition-all gap-2 ${loginMode === mode.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                                >
                                    <ExternalLink size={16} className={loginMode === mode.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                                    <span className="text-xs font-medium">{mode.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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

                {loginMode === 'manual' ? (
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
                ) : (
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                            {lang === 'zh-CN' ? 'SSO Token' : 'SSO Token'}
                        </label>
                        <input
                            type="password"
                            value={localConfig.pass}
                            onChange={(e) => setLocalConfig({...localConfig, pass: e.target.value})}
                            className={inputClasses}
                            autoComplete="off"
                            placeholder={lang === 'zh-CN' ? '输入 OAuth Token' : 'Enter OAuth Token'}
                        />
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            {lang === 'zh-CN'
                                ? 'SSO Token 将作为密码使用'
                                : 'SSO Token will be used as the password'}
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowSSOLink(!showSSOLink)}
                            className="w-full mt-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-medium"
                        >
                            <ExternalLink size={14} />
                            {lang === 'zh-CN' ? '打开坚果云 SSO 授权' : 'Open Nutstore SSO Authorization'}
                        </button>
                        {showSSOLink && (
                            <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                                    {lang === 'zh-CN'
                                        ? '点击下方链接登录坚果云，授权后将自动跳转回来并填充 Token'
                                        : 'Click the link below to login to Nutstore, it will redirect back and auto-fill the Token'}
                                </p>
                                <a
                                    href="https://account.jianguoyun.com/oauth2/authorize"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                    {lang === 'zh-CN' ? 'https://account.jianguoyun.com/oauth2/authorize' : 'https://account.jianguoyun.com/oauth2/authorize'}
                                    <ExternalLink size={12} />
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {provider === 'jianguoyun' && loginMode === 'manual' && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 rounded-lg text-xs border border-amber-100 dark:border-amber-900/30">
                        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                        <p>
                            {lang === 'zh-CN'
                            ? <span><b>重要提示：</b>坚果云 WebDAV <b>必须</b>使用"应用专用密码"，不能使用登录密码。请在坚果云网页版"安全选项"中生成。</span>
                            : <span><b>Important:</b> Nutstore requires an <b>App Password</b>, not your login password. Generate one in Nutstore Security Settings.</span>}
                        </p>
                    </div>
                )}

                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                    <button 
                        type="button" 
                        onClick={() => setShowAdvanced(!showAdvanced)} 
                        className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors w-full justify-between"
                    >
                        <span>{lang === 'zh-CN' ? '高级网络设置 / 文件夹路径' : 'Advanced Settings'}</span>
                        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showAdvanced && (
                        <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
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

                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                {platform === 'web' ? (
                                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                                        <ShieldAlert size={14} />
                                        <span>WebDAV sync is only available in Desktop/Mobile apps.</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                        <ShieldCheck size={14} />
                                        <span>Native Mode Active: Direct WebDAV connection (No CORS Proxy required).</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className={`flex-1 px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all border font-medium text-sm ${
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
                        className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-indigo-200 dark:shadow-none font-medium text-sm active:scale-95"
                    >
                        {isSaved ? <Check size={16} /> : <Save size={16} />}
                        {isSaved ? t('saved', lang) : t('saveConfig', lang)}
                    </button>
                </div>
                
                {testStatus !== 'idle' && errorMessage && (
                    <div className={`flex items-start gap-2 text-xs p-3 rounded-lg border animate-in fade-in slide-in-from-top-1 ${testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30'}`}>
                        {testStatus === 'success' ? <Check size={14} className="mt-0.5" /> : <ShieldAlert size={14} className="mt-0.5" />}
                        <span className="break-all leading-relaxed">{errorMessage}</span>
                    </div>
                )}
            </div>
        </div>

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowSponsor(false)}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 transform transition-all scale-100 max-h-[90vh] sm:max-h-none" onClick={e => e.stopPropagation()}>
                
                <div className="flex-shrink-0 flex border-b border-gray-100 dark:border-gray-700">
                    <button
                        onClick={() => setSponsorTab('wechat')}
                        className={`flex-1 py-3 sm:py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${sponsorTab === 'wechat' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <span className="truncate">{t('wechatPay', lang)}</span>
                    </button>
                    <div className="w-px bg-gray-100 dark:bg-gray-700"></div>
                    <button
                        onClick={() => setSponsorTab('alipay')}
                        className={`flex-1 py-3 sm:py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${sponsorTab === 'alipay' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <span className="truncate">{t('alipay', lang)}</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center bg-white dark:bg-gray-800">
                    <div className={`w-40 h-40 sm:w-52 sm:h-52 bg-white rounded-xl flex items-center justify-center overflow-hidden border-4 shadow-sm relative ${sponsorTab === 'wechat' ? 'border-emerald-100' : 'border-blue-100'}`}>
                        {imageError[sponsorTab] ? (
                            <div className="flex flex-col items-center justify-center p-4 text-center">
                                <p className="text-xs text-gray-400">
                                    {lang === 'zh-CN' ? '未找到二维码图片' : 'Image not found'}
                                    <br/>
                                    <span className="font-mono text-[10px] mt-1 block">
                                        {sponsorTab === 'wechat' ? 'wechat.png' : 'alipay.png'}
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <img
                                src={sponsorTab === 'wechat' ? '/wechat.png' : '/alipay.png'}
                                alt={`${sponsorTab} QR Code`}
                                className="w-full h-full object-cover"
                                onError={() => setImageError(prev => ({ ...prev, [sponsorTab]: true }))}
                            />
                        )}
                    </div>
                    <p className="mt-4 sm:mt-6 text-xs font-medium text-gray-400 dark:text-gray-500 text-center px-2">
                        {sponsorTab === 'wechat' ? t('recommendWechat', lang) : t('recommendAlipay', lang)}
                    </p>
                </div>

                <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 bg-gray-50 dark:bg-gray-900/30 pb-safe">
                    <button
                        onClick={handleSaveQr}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
                    >
                        <Download size={14} /> {t('saveQr', lang)}
                    </button>
                    <button
                        onClick={() => setShowSponsor(false)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 rounded-xl text-xs font-bold transition-colors"
                    >
                        {t('close', lang)}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
