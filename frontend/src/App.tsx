import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { FilePlus, Folder, FileText, Settings as SettingsIcon, LogOut, Users, Shield, Menu, X } from 'lucide-react';
import Templates from './pages/Templates';
import NewReport from './pages/NewReport';
import PreviousReports from './pages/PreviousReports';
import Settings from './pages/Settings';
import Auth from './pages/Auth';

function SidebarNav({
  user,
  onLogout,
  onNavClick
}: {
  user: any;
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="w-64 bg-slate-900 text-slate-100 min-h-full flex flex-col justify-between border-r border-slate-800 flex-shrink-0">
      <div>
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">SPC Assistant</h1>
              <p className="text-xs text-indigo-300">AI Documentation</p>
            </div>
          </div>
          {onNavClick && (
            <button
              onClick={onNavClick}
              className="md:hidden p-1 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <nav className="px-3 space-y-1.5 mt-6">
          <Link
            to="/new-report"
            onClick={onNavClick}
            className={`flex items-center px-4 py-3 rounded-xl transition font-medium text-sm ${
              isActive('/new-report')
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FilePlus className="w-5 h-5 mr-3 text-blue-400" /> New Report
          </Link>

          <Link
            to="/reports"
            onClick={onNavClick}
            className={`flex items-center px-4 py-3 rounded-xl transition font-medium text-sm ${
              isActive('/reports')
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Folder className="w-5 h-5 mr-3 text-indigo-400" /> Previous Reports
          </Link>

          <Link
            to="/templates"
            onClick={onNavClick}
            className={`flex items-center px-4 py-3 rounded-xl transition font-medium text-sm ${
              isActive('/templates')
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5 mr-3 text-emerald-400" /> Templates
          </Link>

          <Link
            to="/settings"
            onClick={onNavClick}
            className={`flex items-center px-4 py-3 rounded-xl transition font-medium text-sm ${
              isActive('/settings')
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <SettingsIcon className="w-5 h-5 mr-3 text-amber-400" /> Settings
          </Link>
        </nav>
      </div>

      {/* User Shared Account Badge & Logout */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg">
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">
                {user?.account_name || 'Training & Placement Cell'}
              </p>
              <p className="text-[10px] text-indigo-300 truncate">
                {user?.email || 'spc@tpo.edu'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center px-3 py-2 bg-slate-800 hover:bg-red-900/30 hover:border-red-700/50 border border-slate-700 text-slate-300 hover:text-red-300 rounded-lg text-xs font-medium transition"
        >
          <LogOut className="w-3.5 h-3.5 mr-2" /> Log Out
        </button>
      </div>
    </div>
  );
}

function AppContent({
  user,
  onLogout,
  theme,
  onThemeChange
}: {
  user: any;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`flex flex-col md:flex-row min-h-screen ${theme === 'dark' ? 'dark bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Mobile Top Navbar Header (< md) */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white">SPC Assistant</h1>
            <p className="text-[10px] text-indigo-300">AI Documentation</p>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl transition"
          aria-label="Toggle Navigation Menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar (>= md) */}
      <div className="hidden md:block">
        <SidebarNav user={user} onLogout={onLogout} />
      </div>

      {/* Mobile Sidebar Drawer Overlay (< md) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[80vw]">
            <SidebarNav user={user} onLogout={onLogout} onNavClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/new-report" replace />} />
          <Route path="/new-report" element={<NewReport />} />
          <Route path="/reports" element={<PreviousReports />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/settings" element={<Settings theme={theme} onThemeChange={onThemeChange} />} />
          <Route path="*" element={<Navigate to="/new-report" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check saved user session
    const savedToken = localStorage.getItem('spc_token');
    const savedUser = localStorage.getItem('spc_user');
    const savedSettings = localStorage.getItem('spc_settings');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Auto-set default team user if none stored
      const defaultUser = { email: 'spc@tpo.edu', account_name: 'Training & Placement Cell' };
      const defaultToken = 'token_spc_shared_account_default';
      setUser(defaultUser);
      setToken(defaultToken);
      localStorage.setItem('spc_token', defaultToken);
      localStorage.setItem('spc_user', JSON.stringify(defaultUser));
    }

    if (savedSettings) {
      try {
        const s = JSON.parse(savedSettings);
        if (s.theme) setTheme(s.theme);
      } catch (e) {}
    }
  }, []);

  const handleLoginSuccess = (userObj: any, tokenStr: string) => {
    setUser(userObj);
    setToken(tokenStr);
  };

  const handleLogout = () => {
    localStorage.removeItem('spc_token');
    localStorage.removeItem('spc_user');
    setUser(null);
    setToken(null);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!token || !user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <AppContent user={user} onLogout={handleLogout} theme={theme} onThemeChange={handleThemeChange} />
    </BrowserRouter>
  );
}

export default App;
