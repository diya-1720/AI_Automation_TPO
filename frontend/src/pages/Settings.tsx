import { useState, useEffect, type FormEvent } from 'react';
import { User, Sun, Moon, Database, Download, Save, CheckCircle, AlertCircle, Building, Users, MapPin, Award } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface SettingsProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export default function Settings({ theme, onThemeChange }: SettingsProps) {
  const [accountName, setAccountName] = useState('Training & Placement Cell');
  const [email, setEmail] = useState('spc@tpo.edu');
  
  const [defaultCollege, setDefaultCollege] = useState('SPC Institute of Technology');
  const [defaultDept, setDefaultDept] = useState('Training & Placement Cell');
  const [defaultOrganizer, setDefaultOrganizer] = useState('TPO Committee');
  const [defaultVenue, setDefaultVenue] = useState('Main Auditorium');
  
  const [exportPreference, setExportPreference] = useState<'ask' | 'pdf' | 'docx'>('ask');
  
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Load existing settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.account_name) setAccountName(data.account_name);
        if (data.email) setEmail(data.email);
        if (data.default_college_name) setDefaultCollege(data.default_college_name);
        if (data.default_department) setDefaultDept(data.default_department);
        if (data.default_organizer) setDefaultOrganizer(data.default_organizer);
        if (data.default_venue) setDefaultVenue(data.default_venue);
        if (data.export_preference) setExportPreference(data.export_preference);
        if (data.theme && (data.theme === 'light' || data.theme === 'dark')) {
          onThemeChange(data.theme);
        }
      }
    } catch (e) {
      console.error("Error fetching settings:", e);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSaveSettings = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    const payload = {
      account_name: accountName,
      email,
      theme,
      export_preference: exportPreference,
      default_college_name: defaultCollege,
      default_department: defaultDept,
      default_organizer: defaultOrganizer,
      default_venue: defaultVenue
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save settings');
      
      localStorage.setItem('spc_settings', JSON.stringify(payload));
      showToast('Settings saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    onThemeChange(nextTheme);
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
  };

  return (
    <div className={`p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 min-h-screen overflow-x-hidden transition-colors duration-200 ${
      theme === 'dark' ? 'text-slate-100 bg-slate-900' : 'text-gray-900 bg-gray-50'
    }`}>
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b pb-6 border-gray-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage your shared team account, global theme, auto-fill defaults, and export preferences.
          </p>
        </div>

        <button
          onClick={() => handleSaveSettings()}
          disabled={saving}
          className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow transition disabled:opacity-50 text-sm"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      {/* Toast Alert */}
      {toastMsg && (
        <div className={`p-4 rounded-xl flex items-center shadow-lg transition-all ${
          toastType === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50' 
            : 'bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700/50'
        }`}>
          {toastType === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-3 text-emerald-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-3 text-red-500 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* 1. Shared Profile Settings */}
        <div className={`p-6 rounded-2xl border shadow-sm ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-slate-700/60">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Shared Team Profile</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Account identity shared across 20-30 team members</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Shared Account Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Training & Placement Cell"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Associated Shared Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="spc@tpo.edu"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
        </div>

        {/* 2. Appearance & Global Theme */}
        <div className={`p-6 rounded-2xl border shadow-sm ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-slate-700/60">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl text-amber-600 dark:text-amber-400">
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-semibold">Appearance & Theme</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Toggle dark mode and light mode globally</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60">
            <div className="flex items-center space-x-3">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-indigo-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="text-sm font-medium">Theme Mode</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Currently active: <span className="font-semibold capitalize text-indigo-600 dark:text-indigo-400">{theme} Mode</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleTheme}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                  theme === 'dark' ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 3. Default Auto-Fill Data */}
        <div className={`p-6 rounded-2xl border shadow-sm md:col-span-2 ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-slate-700/60">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Default Auto-Fill Data</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Pre-populate frequently used institutional values automatically into the 'New Report' form.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center">
                <Building className="w-3.5 h-3.5 mr-1.5 text-gray-400" /> Default College / Institution Name
              </label>
              <input
                type="text"
                value={defaultCollege}
                onChange={(e) => setDefaultCollege(e.target.value)}
                placeholder="e.g. SPC Institute of Technology"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center">
                <Users className="w-3.5 h-3.5 mr-1.5 text-gray-400" /> Default Department / Committee
              </label>
              <input
                type="text"
                value={defaultDept}
                onChange={(e) => setDefaultDept(e.target.value)}
                placeholder="e.g. Training & Placement Cell"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center">
                <Award className="w-3.5 h-3.5 mr-1.5 text-gray-400" /> Default Organizer / Incharge
              </label>
              <input
                type="text"
                value={defaultOrganizer}
                onChange={(e) => setDefaultOrganizer(e.target.value)}
                placeholder="e.g. TPO Committee"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400" /> Default Venue
              </label>
              <input
                type="text"
                value={defaultVenue}
                onChange={(e) => setDefaultVenue(e.target.value)}
                placeholder="e.g. Main Auditorium"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
        </div>

        {/* 4. Export Preferences */}
        <div className={`p-6 rounded-2xl border shadow-sm md:col-span-2 ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100 dark:border-slate-700/60">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Export Preferences</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Select default file download format when exporting documents</p>
            </div>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
              Default Download Format
            </label>
            <select
              value={exportPreference}
              onChange={(e: any) => setExportPreference(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            >
              <option value="ask">Ask every time (Default)</option>
              <option value="pdf">Always download as PDF (.pdf)</option>
              <option value="docx">Always download as DOCX (.docx)</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );
}
