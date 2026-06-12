import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { Settings, Image as ImageIcon, Video, Home, Database, Printer, Trash, Edit, Check, Upload, Save, Lock, Unlock } from 'lucide-react';
import type { AppSettings, Frame, Session, PrintJob } from './types';
import Draggable from 'react-draggable';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [queue, setQueue] = useState<PrintJob[]>([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (activeTab === 'print') fetchQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchData = async () => {
    const [cRes, fRes, sRes] = await Promise.all([
      axios.get('/api/config'),
      axios.get('/api/frames'),
      axios.get('/api/sessions')
    ]);
    setSettings(cRes.data.config);
    setFrames(fRes.data.frames || []);
    setSessions(sRes.data.sessions || []);
  };

  const fetchQueue = async () => {
    const res = await axios.get('/api/print_queue');
    setQueue(res.data.pending || []);
  };

  const saveSettings = async (newSettings: Partial<AppSettings>) => {
    await axios.post('/api/config/home', newSettings);
    setSettings(s => s ? { ...s, ...newSettings } : null);
  };

  // UI / Theme Editor
  const ThemeEditor = () => {
    if (!settings) return null;
    return (
      <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-white uppercase tracking-widest">UI & Theme Editor</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">App Title</label>
            <input type="text" value={settings.title} onChange={e => saveSettings({ title: e.target.value })} className="w-full p-4 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Theme Style</label>
            <select value={settings.ui_theme} onChange={e => saveSettings({ ui_theme: e.target.value })} className="w-full p-4 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none">
              <option value="default">Default Dark</option>
              <option value="space">Space</option>
              <option value="vintage">Vintage</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Start Button Label</label>
            <input type="text" value={settings.btn_text} onChange={e => saveSettings({ btn_text: e.target.value })} className="w-full p-4 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Button Position</label>
            <select value={settings.btn_position} onChange={e => saveSettings({ btn_position: e.target.value as any })} className="w-full p-4 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none">
              <option value="center">Center</option>
              <option value="fixed-bottom">Fixed Bottom</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Countdown Time (s)</label>
            <input type="number" value={settings.countdown_time} onChange={e => saveSettings({ countdown_time: Number(e.target.value) })} className="w-full p-4 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Default WhatsApp Msg</label>
            <input type="text" value={settings.wa_message} onChange={e => saveSettings({ wa_message: e.target.value })} className="w-full p-4 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>
          
          <div className="col-span-2 space-y-4 bg-black/40 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
            <h3 className="font-bold uppercase tracking-widest text-indigo-400 text-sm border-b border-white/5 pb-2">Cloud Infrastructure</h3>
            <div className="grid grid-cols-3 gap-4">
              <input type="text" placeholder="GitHub Token" value={settings.github_token} onChange={e => saveSettings({ github_token: e.target.value })} className="p-3 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-mono" />
              <input type="text" placeholder="GitHub Repo (user/repo)" value={settings.github_repo} onChange={e => saveSettings({ github_repo: e.target.value })} className="p-3 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-mono" />
              <input type="text" placeholder="Netlify URL" value={settings.netlify_url} onChange={e => saveSettings({ netlify_url: e.target.value })} className="p-3 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-mono" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Frame Editor (Interactive Canvas)
  const [editingFrame, setEditingFrame] = useState<Partial<Frame> | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [resizing, setResizing] = useState<{idx: number, startX: number, startY: number, startW: number, startH: number, scale: number} | null>(null);
  const [dragging, setDragging] = useState<{idx: number, startX: number, startY: number, initialX: number, initialY: number, scale: number} | null>(null);
  const [rotating, setRotating] = useState<{idx: number, cx: number, cy: number, startAngle: number, initialR: number} | null>(null);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [customDimensions, setCustomDimensions] = useState({ w: 1200, h: 1800 });

  useEffect(() => {
    if (!resizing && !dragging && !rotating) return;
    
    const handleMove = (e: PointerEvent) => {
      setEditingFrame(f => {
        if (!f) return f;
        const slots = [...(f.slots || [])];
        
        if (resizing && slots[resizing.idx]) {
          const dx = (e.clientX - resizing.startX) / resizing.scale;
          const dy = (e.clientY - resizing.startY) / resizing.scale;
          slots[resizing.idx] = { 
            ...slots[resizing.idx], 
            w: Math.max(20, Math.round(resizing.startW + dx)), 
            h: Math.max(20, Math.round(resizing.startH + dy))
          };
        } else if (dragging && slots[dragging.idx]) {
          const dx = (e.clientX - dragging.startX) / dragging.scale;
          const dy = (e.clientY - dragging.startY) / dragging.scale;
          slots[dragging.idx] = {
            ...slots[dragging.idx],
            x: Math.round(dragging.initialX + dx),
            y: Math.round(dragging.initialY + dy)
          };
        } else if (rotating && slots[rotating.idx]) {
          const currentAngle = Math.atan2(e.clientY - rotating.cy, e.clientX - rotating.cx) * 180 / Math.PI;
          const diff = currentAngle - rotating.startAngle;
          slots[rotating.idx] = {
            ...slots[rotating.idx],
            r: Math.round(rotating.initialR + diff)
          };
        }
        
        return { ...f, slots };
      });
    };
    const handleUp = () => {
      setResizing(null);
      setDragging(null);
      setRotating(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [resizing, dragging, rotating]);

  const deleteSlot = (idx: number) => {
    setEditingFrame(f => {
      if (!f) return f;
      const slots = f.slots?.filter((_, i) => i !== idx);
      return { ...f, slots };
    });
  };

  const startNewFrame = (w: number, h: number) => {
    setEditingFrame({ id: Date.now().toString(), name: "New Layout", baseWidth: w, baseHeight: h, maxSlots: 3, slots: [], bg_data_url: "", hiasan_data_url: "" } as any);
    setShowSizePicker(false);
  };
  
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, field: 'bg_data_url' | 'hiasan_data_url') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (field === 'bg_data_url') {
        const img = new Image();
        img.onload = () => {
          setEditingFrame(f => f ? { ...f, [field]: dataUrl, baseWidth: img.width, baseHeight: img.height } : null);
        };
        img.src = dataUrl;
      } else {
        setEditingFrame(f => f ? { ...f, [field]: dataUrl } : null);
      }
    };
    reader.readAsDataURL(file);
  };

  const addSlot = () => {
    setEditingFrame(f => {
      if (!f) return f;
      return { ...f, slots: [...(f.slots || []), { x: 100, y: 100, w: 400, h: 300, r: 0 }] };
    });
  };

  const updateSlot = (idx: number, updates: Partial<any>) => {
    setEditingFrame(f => {
      if (!f) return f;
      const slots = [...(f.slots || [])];
      slots[idx] = { ...slots[idx], ...updates };
      return { ...f, slots };
    });
  };

  const saveFrame = async () => {
    if (!editingFrame) return;
    await axios.post('/api/frames', editingFrame);
    setEditingFrame(null);
    fetchData();
  };

  const deleteFrame = async (id: string) => {
    if (!confirm('Delete frame?')) return;
    await axios.delete(`/api/frames/${id}`);
    fetchData();
  };

  const FrameEditorUI = () => {
    if (showSizePicker) {
      return (
         <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6 items-center justify-center relative">
            <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-6">Choose Layout Size</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
                <button onClick={()=>startNewFrame(600, 1800)} className="bg-slate-900 border border-slate-700 hover:border-indigo-500 p-6 rounded-2xl text-center group transition-colors flex flex-col items-center shadow-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                  <div className="w-16 h-40 bg-slate-800 border border-slate-600 group-hover:border-indigo-400 mb-6 rounded-lg transition-colors shadow-inner"></div>
                  <h3 className="font-bold text-white tracking-widest uppercase text-sm">2x6 Strip</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-2 tracking-widest">600 x 1800 PX</p>
                </button>
                <button onClick={()=>startNewFrame(1200, 1800)} className="bg-slate-900 border border-slate-700 hover:border-indigo-500 p-6 rounded-2xl text-center group transition-colors flex flex-col items-center shadow-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                  <div className="w-28 h-40 bg-slate-800 border border-slate-600 group-hover:border-indigo-400 mb-6 rounded-lg transition-colors shadow-inner"></div>
                  <h3 className="font-bold text-white tracking-widest uppercase text-sm">4x6 Postcard</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-2 tracking-widest">1200 x 1800 PX</p>
                </button>
                <button onClick={()=>startNewFrame(1200, 1200)} className="bg-slate-900 border border-slate-700 hover:border-indigo-500 p-6 rounded-2xl text-center group transition-colors flex flex-col items-center shadow-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                  <div className="w-28 h-28 bg-slate-800 border border-slate-600 group-hover:border-indigo-400 mb-6 rounded-lg mt-12 transition-colors shadow-inner"></div>
                  <h3 className="font-bold text-white tracking-widest uppercase text-sm">Square</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-2 tracking-widest">1200 x 1200 PX</p>
                </button>
            </div>
            
            <div className="w-full max-w-3xl mt-8 bg-black/40 border border-slate-800 p-8 rounded-2xl flex items-end gap-6 shadow-inner relative overflow-hidden group">
                <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                <div className="flex-1 z-10">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Custom Width (PX)</label>
                  <input type="number" value={customDimensions.w} onChange={e=>setCustomDimensions(d=>({...d, w: Number(e.target.value)}))} className="w-full bg-[#0f172a] border border-slate-700 text-white p-4 rounded-xl outline-none focus:border-indigo-500 font-mono text-sm transition-colors shadow-inner"/>
                </div>
                <div className="flex-1 z-10">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Custom Height (PX)</label>
                  <input type="number" value={customDimensions.h} onChange={e=>setCustomDimensions(d=>({...d, h: Number(e.target.value)}))} className="w-full bg-[#0f172a] border border-slate-700 text-white p-4 rounded-xl outline-none focus:border-indigo-500 font-mono text-sm transition-colors shadow-inner"/>
                </div>
                <button onClick={()=>startNewFrame(customDimensions.w, customDimensions.h)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold tracking-widest uppercase transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] z-10 text-sm">Create</button>
            </div>
            <button onClick={()=>setShowSizePicker(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white uppercase tracking-widest font-bold text-xs transition-colors">Abort</button>
         </div>
      );
    }

    if (!editingFrame) return (
      <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6">
        <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Manage Frames</h2>
          <button onClick={() => setShowSizePicker(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold tracking-widest uppercase transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)]">Create New Layout</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {frames.map(f => (
            <div key={f.id} className="border border-slate-800 p-4 rounded-2xl bg-black/40 flex flex-col items-center group">
              <div className="w-full aspect-[2/3] bg-slate-900 border border-white/5 relative mb-4 overflow-hidden rounded-xl shadow-inner group-hover:scale-105 transition-transform" style={{ backgroundImage: `url(${f.bg_data_url})`, backgroundSize: 'cover' }}>
                {f.slots.map((s, i) => (
                  <div key={i} className="absolute bg-[#0f172a]/80 border border-dashed border-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]" style={{ left: `${(s.x/f.baseWidth)*100}%`, top: `${(s.y/f.baseHeight)*100}%`, width: `${(s.w/f.baseWidth)*100}%`, height: `${(s.h/f.baseHeight)*100}%`, zIndex: 10 }}></div>
                ))}
                {f.hiasan_data_url ? <img src={f.hiasan_data_url} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 30 }} /> : null}
              </div>
              <p className="font-bold truncate w-full text-center text-slate-300 font-mono text-sm tracking-widest uppercase">{f.name}</p>
              <div className="flex mt-3 gap-2 w-full">
                <button onClick={() => setEditingFrame(f)} className="flex-1 flex justify-center items-center py-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors border border-indigo-500/30 gap-2 font-bold text-xs uppercase tracking-widest"><Edit size={14} /> EDIT</button>
                <button onClick={() => deleteFrame(f.id)} className="flex-1 flex justify-center items-center py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-500/30 gap-2 font-bold text-xs uppercase tracking-widest"><Trash size={14} /> DELETE</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const MAX_VIEWER_WIDTH = 500;
    const currentBaseWidth = editingFrame.baseWidth || 1200;
    const fw = Math.min(currentBaseWidth, MAX_VIEWER_WIDTH);
    const scale = fw / currentBaseWidth;
    const fh = (editingFrame.baseHeight || 1800) * scale;

    return (
      <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6">
        <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Edit Frame Schema</h2>
          <div className="flex gap-4">
            <button onClick={() => setEditingFrame(null)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold tracking-widest uppercase transition-colors">Discard</button>
            <button onClick={saveFrame} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-colors">Save Schema</button>
          </div>
        </div>
        
        <div className="flex gap-8">
          <div className="w-auto shrink-0 bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center">
            <div className="mb-4 w-full flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visual Canvas</span>
              <button onClick={() => setIsLocked(!isLocked)} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border uppercase tracking-widest font-bold transition-colors ${isLocked ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                {isLocked ? <Lock size={12}/> : <Unlock size={12}/>} {isLocked ? 'Locked' : 'Unlocked'}
              </button>
            </div>
            
            <div 
              className="relative shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-[#020617] overflow-hidden origin-top-left border border-white/10 rounded-lg group"
              style={{ width: fw, height: fh, backgroundImage: `url(${editingFrame.bg_data_url})`, backgroundSize: '100% 100%' }}
            >
              {!editingFrame.bg_data_url && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>}
              
              {editingFrame.slots?.map((s, i) => (
                <div 
                  key={i}
                  className={`absolute border border-indigo-500 bg-indigo-500/20 flex items-center justify-center text-white font-mono font-bold shadow-[0_0_15px_rgba(79,70,229,0.3)] backdrop-blur-sm ${isLocked ? 'pointer-events-none' : 'hover:bg-indigo-500/40'}`}
                  style={{ 
                    left: s.x * scale, 
                    top: s.y * scale, 
                    width: s.w * scale, 
                    height: s.h * scale, 
                    zIndex: 10,
                    cursor: isLocked ? 'default' : 'move'
                  }}
                  onPointerDown={(e) => {
                    if (isLocked) return;
                    e.stopPropagation();
                    setDragging({ idx: i, startX: e.clientX, startY: e.clientY, initialX: s.x, initialY: s.y, scale });
                  }}
                >
                  <span className="w-full h-full flex justify-center items-center pointer-events-none" style={{ transform: `rotate(${s.r || 0}deg)` }}>LENS_{i + 1}</span>
                  
                  {!isLocked && (
                    <>
                      <div
                        className="resize-handle absolute bottom-0 right-0 w-5 h-5 bg-indigo-400 border-2 border-white rounded-tl-lg shadow shadow-black/50"
                        style={{ cursor: 'nwse-resize', transform: 'translate(25%, 25%)', zIndex: 20 }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setResizing({ idx: i, startX: e.clientX, startY: e.clientY, startW: s.w, startH: s.h, scale });
                        }}
                      />
                      <div
                        className="rotate-handle absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 bg-emerald-500 hover:bg-emerald-400 focus:bg-emerald-600 border-2 border-white rounded-full flex items-center justify-center shadow shadow-black/50 cursor-grab"
                        style={{ zIndex: 20 }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                          if (rect) {
                            const cx = rect.left + rect.width / 2;
                            const cy = rect.top + rect.height / 2;
                            const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
                            setRotating({ idx: i, cx, cy, startAngle, initialR: s.r || 0 });
                          }
                        }}
                      >
                         <svg className="w-3 h-3 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      </div>
                      <div
                        className="delete-handle absolute -top-3 -right-3 w-6 h-6 bg-rose-500 hover:bg-rose-600 border-2 border-white rounded-full flex items-center justify-center shadow shadow-black/50 cursor-pointer"
                        style={{ zIndex: 20 }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          deleteSlot(i);
                        }}
                      >
                         <Trash size={12} className="text-white pointer-events-none" />
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${editingFrame.hiasan_data_url})`, backgroundSize: '100% 100%', zIndex: 30 }}></div>
            </div>
            <p className="text-[10px] uppercase font-mono text-slate-500 mt-4 tracking-widest">Viewport Scale: {Math.round(scale*100)}% ({editingFrame.baseWidth}x{editingFrame.baseHeight})</p>
          </div>

          <div className="flex-1 space-y-6">
             <div>
               <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Schema ID / Name</label>
               <input type="text" value={editingFrame.name} onChange={e => setEditingFrame({ ...editingFrame, name: e.target.value })} className="w-full p-4 bg-slate-900 border border-slate-700 text-white rounded-xl font-mono text-sm outline-none focus:border-indigo-500" placeholder="Frame Name" />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Base Width</label>
                  <input type="number" value={editingFrame.baseWidth} onChange={e => setEditingFrame({ ...editingFrame, baseWidth: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Base Height</label>
                  <input type="number" value={editingFrame.baseHeight} onChange={e => setEditingFrame({ ...editingFrame, baseHeight: Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl outline-none focus:border-indigo-500 font-mono" />
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Base Layer (Bg)</label>
                 <input type="file" onChange={e => handleFile(e, 'bg_data_url')} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30 font-mono" />
               </div>
               <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Top Layer (Asset)</label>
                 <input type="file" onChange={e => handleFile(e, 'hiasan_data_url')} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600/20 file:text-emerald-400 hover:file:bg-emerald-600/30 font-mono" />
               </div>
             </div>
             
             <div className="pt-6 border-t border-slate-800">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-bold text-white uppercase tracking-widest">Lens Slots Configuration</h3>
                 <button onClick={addSlot} className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors">+ Append Slot</button>
               </div>
               
               <div className="space-y-3">
                 {editingFrame.slots?.map((s, i) => (
                   <div key={i} className="flex flex-wrap gap-2 items-center text-sm bg-slate-900 border border-slate-800 p-3 rounded-xl">
                     <span className="font-mono text-indigo-400 font-bold ml-2">LENS_{i+1}</span>
                     
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-500">X</span>
                       <input type="number" value={s.x} onChange={e=>updateSlot(i, {x:Number(e.target.value)})} className="w-16 bg-black border border-slate-700 text-white rounded p-1.5 focus:border-indigo-500 outline-none font-mono text-xs"/>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-500">Y</span>
                       <input type="number" value={s.y} onChange={e=>updateSlot(i, {y:Number(e.target.value)})} className="w-16 bg-black border border-slate-700 text-white rounded p-1.5 focus:border-indigo-500 outline-none font-mono text-xs"/>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-500">W</span>
                       <input type="number" value={s.w} onChange={e=>updateSlot(i, {w:Number(e.target.value)})} className="w-16 bg-black border border-slate-700 text-white rounded p-1.5 focus:border-indigo-500 outline-none font-mono text-xs"/>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-500">H</span>
                       <input type="number" value={s.h} onChange={e=>updateSlot(i, {h:Number(e.target.value)})} className="w-16 bg-black border border-slate-700 text-white rounded p-1.5 focus:border-indigo-500 outline-none font-mono text-xs"/>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-500">R°</span>
                       <input type="number" value={s.r || 0} onChange={e=>updateSlot(i, {r:Number(e.target.value)})} className="w-16 bg-black border border-slate-700 text-white rounded p-1.5 focus:border-indigo-500 outline-none font-mono text-xs"/>
                     </div>
                     <button onClick={() => deleteSlot(i)} className="ml-auto w-7 h-7 flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded transition-colors border border-rose-500/30">
                       <Trash size={12} />
                     </button>
                   </div>
                 ))}
                 {(!editingFrame.slots || editingFrame.slots.length === 0) && (
                   <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl font-mono text-xs uppercase tracking-widest">
                     No lens slots attached to this schema
                   </div>
                 )}
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'summary', icon: Home, label: 'Dashboard' },
    { id: 'frames', icon: ImageIcon, label: 'Frames Editor' },
    { id: 'print', icon: Printer, label: 'Print Server' },
    { id: 'remote', icon: Video, label: 'Remote Cam' },
    { id: 'sessions', icon: Database, label: 'History' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <div className="w-full h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden flex flex-col select-none">
      {/* TOP NAVIGATION BAR */}
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">PHOTOBOOTH <span className="text-indigo-400">PRO</span></h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Terminal Dashboard v4.2.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 leading-none">LOCAL IP</span>
              <span className="text-xs font-mono text-indigo-400">{window.location.hostname}</span>
            </div>
            <div className="h-6 w-[1px] bg-slate-700"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 leading-none">NETLIFY</span>
              <span className="text-xs font-mono text-emerald-400">LIVE</span>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
            <div className="w-2 h-2 rounded-full bg-slate-700"></div>
            <div className="w-2 h-2 rounded-full bg-slate-700"></div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR NAV */}
        <nav className="w-20 bg-[#0f172a] border-r border-slate-800 flex flex-col items-center py-8 gap-8 shrink-0 z-10">
          {tabs.map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)}
              title={t.label}
              className={`p-3 rounded-xl transition-colors ${activeTab === t.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-white border border-transparent'}`}
            >
              <t.icon className="w-6 h-6" />
            </button>
          ))}
          <div className="mt-auto mb-4">
            <button className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors" title="System Settings">
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </nav>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 bg-[#020617] p-8 flex flex-col gap-6 overflow-y-auto">
          {activeTab === 'summary' && (
            <div className="flex-1 flex flex-col gap-6">
              <div className="grid grid-cols-4 gap-4 shrink-0">
                <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Frame</p>
                  <h3 className="text-xl font-bold text-white">{frames.length > 0 ? frames[frames.length-1].name : 'None'}</h3>
                </div>
                <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sessions Today</p>
                  <h3 className="text-xl font-bold text-white">{sessions.length} <span className="text-xs text-emerald-400 font-normal">Active</span></h3>
                </div>
                <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Frames</p>
                  <h3 className="text-xl font-bold text-white">{frames.length}</h3>
                </div>
                <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Print Queue</p>
                  <h3 className="text-xl font-bold text-white">{queue.length} Pending</h3>
                </div>
              </div>

              <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 flex flex-col overflow-hidden relative group">
                  <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
                  <h2 className="text-2xl font-bold mb-4 z-10 text-white">System Monitor</h2>
                  <div className="flex-1 font-mono text-xs text-slate-400 space-y-2 overflow-y-auto z-10 p-4 bg-black/40 rounded-xl border border-white/5">
                    <p><span className="text-indigo-400">[{new Date().toLocaleTimeString()}]</span> System Initialized.</p>
                    {sessions.slice(0, 5).map(s => (
                      <p key={s.id}><span className="text-emerald-400">[{new Date(s.timestamp).toLocaleTimeString()}]</span> New session captured and processed successfully: {s.id.slice(0, 8)}</p>
                    ))}
                    {queue.slice(0, 3).map(q => (
                       <p key={q.id}><span className="text-amber-400">[{new Date(q.timestamp).toLocaleTimeString()}]</span> Print queue job appended: {q.id.slice(0,8)}</p>
                    ))}
                    <p className="animate-pulse">_</p>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'frames' && <FrameEditorUI />}

          {activeTab === 'settings' && <ThemeEditor />}

          {activeTab === 'print' && (
            <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-3xl p-8 flex flex-col gap-6">
               <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                  <h2 className="text-2xl font-bold text-white">Print Queue Server</h2>
                  <span className="px-4 py-2 bg-indigo-500/20 text-indigo-400 font-bold rounded-xl">{queue.length} PENDING</span>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                 {queue.length === 0 ? <p className="text-slate-500 font-mono col-span-3">No print jobs pending.</p> : queue.map(q => (
                   <div key={q.id} className="flex flex-col p-4 border border-slate-800 rounded-2xl bg-black/40 gap-4">
                     {q.image_url ? <img src={q.image_url} className="w-full aspect-square object-cover rounded-xl border border-slate-800" /> : <div className="w-full aspect-square bg-slate-900 rounded-xl border border-slate-800" />}
                     <div>
                       <span className="font-mono text-xs text-slate-500 block">JOB ID: {q.id.slice(0,8)}</span>
                       <span className="font-mono text-[10px] text-slate-600 block mb-3">SESSION: {q.session_id.slice(0,12)}</span>
                       <button onClick={() => axios.put(`/api/print_queue/${q.id}`).then(fetchQueue)} className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white px-4 py-3 rounded-xl font-bold text-sm tracking-wider transition-colors">
                         MARK PRINTED
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'remote' && (
            <div className="flex-1 flex items-center justify-center">
               <div className="flex flex-col items-center justify-center p-12 py-16 border border-slate-800 rounded-3xl bg-[#0f172a] shadow-2xl relative overflow-hidden group w-full max-w-lg">
                 <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
                 <div className="bg-white p-4 rounded-2xl mb-8 z-10 shadow-[0_0_40px_rgba(79,70,229,0.3)] group-hover:scale-105 transition-transform">
                    <QRCodeSVG value={`${window.location.protocol}//${window.location.host}/remote-cam?deviceId=default`} size={200} />
                 </div>
                 <h3 className="text-2xl font-bold text-white tracking-tight z-10">Pair Remote Camera</h3>
                 <p className="mt-2 font-mono text-sm text-slate-400 z-10 text-center max-w-xs">Scan code with any smartphone to link internal wireless lens.</p>
               </div>
            </div>
          )}

          {activeTab === 'sessions' && (
             <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-3xl p-8 space-y-6">
               <h2 className="text-2xl font-bold text-white">Session History</h2>
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                 {sessions.map(s => (
                   <div key={s.id} className="border border-slate-800 rounded-2xl bg-black/40 p-3 overflow-hidden flex flex-col group relative">
                     <div className="bg-slate-900 rounded-xl overflow-hidden mb-3 relative aspect-[2/3] border border-white/5">
                        {s.png_url ? <img src={s.png_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full bg-slate-900" />}
                     </div>
                     <span className="font-mono text-[10px] text-slate-500 mb-2 truncate text-center block">{s.id}</span>
                     <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(settings?.wa_message.replace('[LINK]', s.cloud_url || window.location.origin+'/share/'+s.id) || '')}`} target="_blank" rel="noreferrer" className="mt-auto block w-full text-center bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white text-xs py-2 font-bold tracking-wider rounded-xl transition-colors">
                       WHATSAPP
                     </a>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </main>
      </div>

      {/* FOOTER STATUS */}
      <footer className="h-10 bg-indigo-600 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex gap-4">
          <span className="text-[10px] font-bold text-white tracking-widest">SYSTEM: STABLE</span>
          <span className="text-[10px] font-medium text-indigo-200">DB_LOCK: OFF</span>
          <span className="text-[10px] font-medium text-indigo-200">WEBCAM: CONNECTED</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-indigo-100">LATENCY: 12ms</span>
            <div className="w-12 h-2 bg-indigo-800 rounded-full overflow-hidden">
               <div className="w-3/4 h-full bg-emerald-400"></div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-indigo-100">{new Date().toLocaleString()}</span>
        </div>
      </footer>
    </div>
  );
}
