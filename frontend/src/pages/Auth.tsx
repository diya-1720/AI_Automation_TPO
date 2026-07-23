import { useState, type FormEvent } from 'react';
import { Lock, Mail, UserCheck, Shield, Users, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface AuthProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('spc@tpo.edu');
  const [password, setPassword] = useState('spc12345');
  const [accountName, setAccountName] = useState('Training & Placement Cell');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/signup';
    const payload = mode === 'signin' 
      ? { email, password } 
      : { email, password, account_name: accountName };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      setSuccessMsg(mode === 'signin' ? 'Sign-in successful!' : 'Account registered successfully!');
      localStorage.setItem('spc_token', data.token);
      localStorage.setItem('spc_user', JSON.stringify(data.user));
      
      setTimeout(() => {
        onLoginSuccess(data.user, data.token);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
        
        {/* Left Side: Team Banner */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 flex flex-col justify-between border-r border-slate-700">
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                <Shield className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide text-white">SPC Assistant</h1>
                <p className="text-xs text-indigo-300">AI Documentation Platform</p>
              </div>
            </div>

            <div className="space-y-4 my-8">
              <div className="p-4 bg-slate-800/80 rounded-xl border border-indigo-500/30 backdrop-blur-sm">
                <div className="flex items-start space-x-3">
                  <Users className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm text-indigo-200">Team Shared Account</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Designed for team collaboration (20-30 members). Everyone signs in with the shared account credentials to maintain global document access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Default Team Login</h4>
                <p className="text-xs text-slate-300 font-mono">Email: <span className="text-indigo-300">spc@tpo.edu</span></p>
                <p className="text-xs text-slate-300 font-mono">Password: <span className="text-indigo-300">spc12345</span></p>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 pt-4 border-t border-slate-700/60 flex items-center justify-between">
            <span>© 2026 SPC Documentation</span>
            <span className="text-indigo-400 font-medium">Global Sync Active</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="p-8 flex flex-col justify-center">
          <div className="flex space-x-2 bg-slate-900 p-1.5 rounded-xl mb-6 border border-slate-700">
            <button
              onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'signin' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'signup' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            {mode === 'signin' ? 'Sign in to Shared Account' : 'Register Shared Team Account'}
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            {mode === 'signin'
              ? 'Enter credentials to access all global team documentation.'
              : 'Create a new team account for collaborative report generation.'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg flex items-center text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-900/40 border border-emerald-500/50 rounded-lg flex items-center text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account / Committee Name</label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Training & Placement Cell"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="spc@tpo.edu"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center text-sm disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
