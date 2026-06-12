import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Download, Camera, Home } from 'lucide-react';
import type { Session } from './types';

export default function ClientShare() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // In a real app we'd have a targeted endpoint, but for now we fetch all and filter
    axios.get('/api/sessions').then(res => {
      const found = res.data.sessions.find((s: Session) => s.id === sessionId);
      if (found) setSession(found);
    });
  }, [sessionId]);

  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download failed', err);
      window.open(url, '_blank'); // fallback
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
        <div className="animate-pulse flex flex-col items-center">
          <Camera className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Loading memory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col items-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
      <div className="w-full max-w-md mx-auto space-y-8 mt-8 z-10">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-bold font-sans tracking-tight text-white uppercase">Your Photos</h1>
          <p className="text-indigo-400 text-xs font-mono tracking-widest">Session {sessionId.slice(0,8)}</p>
        </header>

        <main className="space-y-6">
          <div className="bg-[#0f172a] border border-indigo-500/30 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(79,70,229,0.1)] relative">
            {session.png_url ? <img src={session.png_url} className="w-full object-cover" alt="Photobooth collage" /> : <div className="w-full aspect-[2/3] bg-slate-900 border border-slate-800" />}
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest border border-white/10 uppercase text-white hover:border-indigo-500 transition-colors">
              High-Res Capture
            </div>
          </div>
          <button 
            onClick={() => forceDownload(session.png_url, `photobooth-${sessionId}.png`)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.2)] text-white py-4 rounded-xl font-bold tracking-widest uppercase hover:bg-indigo-500 transition-colors"
          >
            <Download className="w-5 h-5" /> Download Photo
          </button>

          {session.gif_url ? (
            <>
              <div className="h-px bg-slate-800 w-full my-8"></div>
              <div className="bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
                <img src={session.gif_url} className="w-full object-cover" alt="Animated GIF" />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest border border-white/10 uppercase text-white">
                  Motion Anim
                </div>
              </div>
              <button 
                onClick={() => forceDownload(session.gif_url, `photobooth-animation-${sessionId}.gif`)}
                className="w-full flex items-center justify-center gap-2 bg-[#0f172a] border border-slate-700 text-slate-300 py-4 rounded-xl font-bold tracking-widest uppercase hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Download className="w-5 h-5" /> Download Motion
              </button>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
