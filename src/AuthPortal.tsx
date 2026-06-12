import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Camera } from 'lucide-react';
import axios from 'axios';

export default function AuthPortal() {
  const [role, setRole] = useState('photo');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // For Vercel hosting, we do client-side auth
      if (role === 'admin' && password === 'admin') {
        navigate('/admin');
      } else if (role === 'photo' && password === 'photo') {
        navigate('/photobooth');
      } else {
        // Fallback to API in case server is running
        const res = await axios.post('/api/login', { username: role, password });
        if (res.data.success) {
          if (role === 'admin') navigate('/admin');
          else navigate('/photobooth');
        } else {
          setError('Invalid credentials');
        }
      }
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-slate-200 font-sans p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
      
      <div className="max-w-md w-full bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-8 z-10">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold font-sans text-white tracking-tight">PHOTOBOOTH <span className="text-indigo-400">PRO</span></h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Terminal Authentication</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl">{error}</div>}
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">System Role</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className="pl-10 w-full bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none appearance-none"
                >
                  <option value="photo">Client Session</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Access Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none"
                  placeholder="Enter access code"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full flex justify-center py-4 px-4 border border-indigo-500/30 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.2)] text-sm font-bold tracking-widest text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none transition-colors uppercase"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
