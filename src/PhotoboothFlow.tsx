import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, getDocs, setDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { defaultSettings } from './lib/defaults';

// We replace the axios calls with firebase.
import Webcam from 'react-webcam';
import GIF from 'gif.js.optimized';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Printer, Share2, Smartphone, MonitorSmartphone, Rocket } from 'lucide-react';
import type { AppSettings, Frame, Session } from './types';

type Step = 'HOME' | 'FRAME' | 'CAMERA' | 'CAPTURE' | 'PROCESSING' | 'RESULT';

export default function PhotoboothFlow() {
  const [step, setStep] = useState<Step>('HOME');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  
  const [camSource, setCamSource] = useState<'local' | 'remote'>('local');
  const [remoteFrame, setRemoteFrame] = useState<string>('');
  const webcamRef = useRef<Webcam>(null);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
           const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('rear'));
           setSelectedDeviceId(backCamera ? backCamera.deviceId : videoDevices[0].deviceId);
        }
      } catch (e) {
        console.error("Camera permission denied", e);
      }
    };
    getDevices();
  }, []);

  const [poses, setPoses] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(-1);
  const [flash, setFlash] = useState(false);

  const [resultData, setResultData] = useState<any>(null);
  const [waNumber, setWaNumber] = useState('');

  useEffect(() => {
    // Load config
    getDoc(doc(db, 'settings', 'home')).then((docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AppSettings);
      } else {
        setSettings(defaultSettings as any);
      }
    }).catch(e => {
       console.error(e);
       setSettings(defaultSettings as any);
    });

    // Load frames
    getDocs(collection(db, 'frames')).then((snapshot) => {
      const frs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Frame));
      setFrames(frs);
    }).catch(e => console.error(e));
  }, []);

  // Sync remote camera
  useEffect(() => {
    if (step === 'CAPTURE' && camSource === 'remote') {
      const unsub = onSnapshot(doc(db, 'remote_camera', 'default'), (doc) => {
        if (doc.exists() && doc.data().frame) {
          setRemoteFrame(doc.data().frame);
        }
      });
      return () => unsub();
    }
  }, [step, camSource]);

  const startSession = () => {
    setPoses([]);
    setStep('CAPTURE');
    runCaptureLoop(0);
  };

  const captureImage = () => {
    if (camSource === 'local') {
      return webcamRef.current?.getScreenshot() || '';
    } else {
      return remoteFrame;
    }
  };

  const runCaptureLoop = async (currentPoseIdx: number) => {
    if (!selectedFrame || currentPoseIdx >= selectedFrame.slots.length) {
      processFinalImage();
      return;
    }

    // Start Countdown
    let time = settings?.countdown_time || 8;
    setCountdown(time);

    const tick = setInterval(() => {
      time--;
      if (time > 0) {
        setCountdown(time);
      } else {
        clearInterval(tick);
        setCountdown(-1);
        
        // FLASH & CAPTURE
        setFlash(true);
        const audio = new Audio('/camera-shutter.mp3'); // Assuming standard shutter sound
        audio.play().catch(()=>{});

        setTimeout(() => {
          setFlash(false);
          const rawImg = captureImage();
          setPoses(prev => [...prev, rawImg]);

          // Preview for 2 seconds
          setTimeout(() => {
            runCaptureLoop(currentPoseIdx + 1);
          }, 2000);
        }, 150);
      }
    }, 1000);
  };

  const processFinalImage = async () => {
    setStep('PROCESSING');
    if (!selectedFrame) return;

    // Build the PNG Canvas
    const canvas = document.createElement('canvas');
    canvas.width = selectedFrame.baseWidth;
    canvas.height = selectedFrame.baseHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Background
    if (selectedFrame.bg_data_url) {
      const bg = new Image();
      let loaded = false;
      await new Promise(r => {
        bg.onload = () => { loaded = true; r(null); };
        bg.onerror = () => { r(null); };
        bg.src = selectedFrame.bg_data_url;
      });
      if (loaded) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    }

    // 2. Draw Foreground (Hiasan) first so photos are on top
    if (selectedFrame.hiasan_data_url) {
      const fg = new Image();
      let loaded = false;
      await new Promise(r => {
        fg.onload = () => { loaded = true; r(null); };
        fg.onerror = () => { r(null); };
        fg.src = selectedFrame.hiasan_data_url;
      });
      if (loaded) ctx.drawImage(fg, 0, 0, canvas.width, canvas.height);
    }

    // 3. Draw Poses (Photos) on top of Background and Foreground
    // Reverse or manipulate poses if needed (mirror)
    for (let i = 0; i < selectedFrame.slots.length; i++) {
      const slot = selectedFrame.slots[i];
      if (!poses[i]) continue;
      const img = new Image();
      let loaded = false;
      await new Promise(r => {
        img.onload = () => { loaded = true; r(null); };
        img.onerror = () => { r(null); };
        img.src = poses[i];
      });
      if (!loaded) continue;
      ctx.save();
      ctx.translate(slot.x + slot.w/2, slot.y + slot.h/2);
      ctx.rotate((slot.r || 0) * Math.PI / 180);
      ctx.scale(-1, 1); // Mirror for natural look
      ctx.drawImage(img, -slot.w/2, -slot.h/2, slot.w, slot.h);
      ctx.restore();
    }

    const pngB64 = canvas.toDataURL('image/png', 0.9);

    try {
      const sessionId = Date.now().toString() + Math.floor(Math.random()*1000).toString();
      const storage = getStorage();
      
      const pngRef = ref(storage, `sessions/${sessionId}.png`);
      await uploadString(pngRef, pngB64, 'data_url');
      const pngUrl = await getDownloadURL(pngRef);
      
      const sessionDocRef = doc(collection(db, 'sessions'), sessionId);
      const shareUrl = window.location.origin + `/share/${sessionId}`;

      const resData = {
        session_id: sessionId,
        local_url: pngUrl,
        share_link: shareUrl,
        qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`
      };

      await setDoc(sessionDocRef, {
        timestamp: Date.now(),
        png_url: pngUrl,
        gif_url: ""
      });

      setResultData(resData);
      setStep('RESULT');

      // Now build GIF in background asynchronously
      setTimeout(async () => {
        try {
          const gif = new (GIF as any)({
            workers: 2,
            quality: 10,
            width: selectedFrame.baseWidth / 4,
            height: selectedFrame.baseHeight / 4
          });

          for (let i = 0; i < poses.length; i++) {
              if (!poses[i]) continue;
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = selectedFrame.baseWidth / 4;
              tempCanvas.height = selectedFrame.baseHeight / 4;
              const tempCtx = tempCanvas.getContext('2d')!;
              
              const img = new Image();
              let loaded = false;
              await new Promise(r => { 
                img.onload = () => { loaded = true; r(null); }; 
                img.onerror = () => { r(null); };
                img.src = poses[i];
              });
              if (!loaded) continue;
              tempCtx.scale(-1, 1);
              tempCtx.drawImage(img, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
              gif.addFrame(tempCanvas, { delay: 400, copy: true });
          }

          gif.on('finished', async (blob: any) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const gifB64 = reader.result as string;
              
              const gifRef = ref(storage, `sessions/${sessionId}.gif`);
              await uploadString(gifRef, gifB64, 'data_url');
              const gifUrl = await getDownloadURL(gifRef);

              await setDoc(sessionDocRef, { gif_url: gifUrl }, { merge: true });
              setResultData((prev: any) => prev ? {...prev, gif_url: gifUrl} : null);
            };
            reader.readAsDataURL(blob);
          });
          gif.render();
        } catch(e) {
            console.error("GIF generation failed.", e);
        }
      }, 500);

    } catch (e) {
      console.error("Upload failed", e);
      alert("Failed to process image.");
      setStep('HOME');
    }
  };

  const handlePrint = async () => {
    if (!resultData) return;
    await addDoc(collection(db, 'print_queue'), { 
      session_id: resultData.session_id, 
      image_url: resultData.local_url,
      status: 'pending',
      timestamp: Date.now()
    });
    alert('Sent to print queue!');
  };

  const sendWa = () => {
    if (!resultData || !settings) return;
    const msg = settings.wa_message.replace('[LINK]', resultData.share_link);
    window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ---------------- UI STATES ----------------
  if (!settings) return null;

  if (step === 'HOME') {
    return (
      <div 
        className="min-h-screen flex flex-col items-center relative overflow-hidden" 
        style={{ 
          background: settings.bg_type === 'color' ? settings.bg_color : `url(${settings.bg_image}) center/cover no-repeat` 
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center z-10 w-full max-w-4xl">
          {settings.logo_image ? <img src={settings.logo_image} className="h-32 mb-8" alt="Logo" /> : null}
          <h1 className="text-6xl font-black mb-12 tracking-tight" style={{ color: settings.title_color }}>
            {settings.title}
          </h1>
          <button 
            onClick={() => setStep('FRAME')}
            className={`px-12 py-6 rounded-full text-2xl font-bold shadow-2xl transition-transform hover:scale-105 active:scale-95 ${settings.btn_position === 'fixed-bottom' ? 'fixed bottom-12' : ''}`}
            style={{ backgroundColor: settings.btn_bg_color, color: settings.btn_text_color }}
          >
            {settings.btn_text}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'FRAME') {
    return (
      <div className="min-h-screen bg-[#020617] p-8 flex flex-col relative overflow-hidden text-slate-200">
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
        <h2 className="text-4xl font-bold text-white text-center mb-8 uppercase tracking-widest z-10">Choose Your Frame</h2>
        <div className="flex-1 overflow-x-auto whitespace-nowrap snap-x p-4 flex gap-8 items-center justify-center z-10">
          {frames.map(f => (
            <div 
              key={f.id} 
              onClick={() => { setSelectedFrame(f); setStep('CAMERA'); }}
              className="inline-block relative w-80 aspect-[2/3] bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden cursor-pointer snap-center shadow-[0_0_30px_rgba(79,70,229,0.1)] hover:scale-105 hover:border-indigo-500/50 transition-all group"
            >
               {f.bg_data_url ? <img src={f.bg_data_url} className="absolute inset-0 w-full h-full object-cover" /> : null}
               {f.hiasan_data_url ? <img src={f.hiasan_data_url} className="absolute inset-0 w-full h-full object-cover" /> : null}
               <div className="absolute inset-0 flex items-center justify-center bg-black/opacity-0 group-hover:bg-black/60 transition-colors">
                 <span className="bg-indigo-600 border border-indigo-500 text-white px-8 py-3 font-bold uppercase tracking-widest text-sm rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Select</span>
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'CAMERA') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-8 relative overflow-hidden text-slate-200">
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
        
        <div className="bg-[#0f172a] border border-slate-800 p-8 flex flex-col items-center gap-8 rounded-3xl w-full max-w-2xl shadow-2xl z-10">
          <h2 className="text-3xl font-bold text-white tracking-widest uppercase">Select Camera Source</h2>
          
          <div className="grid grid-cols-2 gap-6 w-full">
            <button onClick={() => { setCamSource('local'); startSession(); }} className="flex flex-col items-center justify-center gap-4 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-8 rounded-2xl text-slate-300 hover:text-white hover:shadow-[0_0_20px_rgba(79,70,229,0.2)] transition-all">
              <MonitorSmartphone size={48} className="text-indigo-400 group-hover:text-indigo-300" />
              <span className="text-xl font-bold tracking-widest uppercase text-sm">Built-in Webcam</span>
            </button>
            <button onClick={() => { setCamSource('remote'); startSession(); }} className="flex flex-col items-center justify-center gap-4 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-8 rounded-2xl text-slate-300 hover:text-white hover:shadow-[0_0_20px_rgba(79,70,229,0.2)] transition-all">
              <Smartphone size={48} className="text-emerald-400 group-hover:text-emerald-300" />
              <span className="text-xl font-bold tracking-widest uppercase text-sm">Remote Lens</span>
            </button>
          </div>

          {devices.length > 0 && (
            <div className="w-full flex justify-center text-sm">
              <select 
                value={selectedDeviceId} 
                onChange={e => setSelectedDeviceId(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-white rounded-lg p-2 px-4 shadow focus:outline-none focus:border-indigo-500"
              >
                {devices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'CAPTURE') {
    return (
      <div className="min-h-screen bg-[#020617] relative flex items-center justify-center overflow-hidden">
        {camSource === 'local' ? (
          /* @ts-ignore */
          <Webcam videoConstraints={{ deviceId: selectedDeviceId }} audio={false} ref={webcamRef} className="w-full h-full object-cover mirror" mirrored={true} />
        ) : (
          remoteFrame ? <img src={remoteFrame} className="w-full h-full object-cover mirror" style={{ transform: 'scaleX(-1)' }} /> : <div className="w-full h-full bg-slate-900" />
        )}

        <div className="absolute inset-0 pointer-events-none opacity-20" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>

        {/* Layout Preview */}
        {selectedFrame && (
          <div className="absolute left-8 top-1/2 -translate-y-1/2 p-4 z-20 transition-all">
            <div 
              className="relative border-4 border-white/20 overflow-hidden shadow-2xl origin-left scale-100"
              style={{ 
                width: selectedFrame.baseWidth * 0.15, 
                height: selectedFrame.baseHeight * 0.15,
                background: selectedFrame.bg_data_url ? `url(${selectedFrame.bg_data_url})` : '#0f172a',
                backgroundSize: '100% 100%'
              }}
            >
              {selectedFrame.hiasan_data_url && <img src={selectedFrame.hiasan_data_url} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}
              {selectedFrame.slots.map((s, i) => (
                <div key={i} className="absolute bg-slate-800/80" style={{ 
                  left: `${(s.x / selectedFrame.baseWidth) * 100}%`,
                  top: `${(s.y / selectedFrame.baseHeight) * 100}%`,
                  width: `${(s.w / selectedFrame.baseWidth) * 100}%`,
                  height: `${(s.h / selectedFrame.baseHeight) * 100}%`,
                  transform: `rotate(${s.r || 0}deg)`
                }}>
                  {poses[i] ? (
                    <img src={poses[i]} className="absolute inset-0 w-full h-full object-cover rounded shadow" style={{transform: 'scaleX(-1)'}} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-white/20 backdrop-blur-sm">
                      <span className="text-white font-black tracking-widest leading-none drop-shadow-md text-xl">{i + 1}</span>
                      {poses.length === i && <div className="absolute bottom-2 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_red]"></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Countdown */}
        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <motion.span 
              key={countdown} 
              initial={{ scale: 0.5, opacity: 0 }} 
              animate={{ scale: [1, 2], opacity: [1, 0] }} 
              transition={{ duration: 1 }} 
              className="text-[250px] font-black text-white drop-shadow-[0_0_40px_rgba(79,70,229,0.8)] mix-blend-screen"
            >
              {countdown}
            </motion.span>
          </div>
        )}

        {/* FLASH */}
        <AnimatePresence>
          {flash && (
            <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-white z-50 pointer-events-none mix-blend-screen" />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (step === 'PROCESSING') {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-slate-200 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
        <motion.div 
          animate={{ y: [-500, -1000] }} 
          transition={{ duration: 3, ease: 'easeIn' }}
          className="absolute z-10"
        >
          <Rocket size={120} className="text-indigo-500 mb-4 drop-shadow-[0_0_30px_rgba(79,70,229,0.6)]" />
        </motion.div>
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 to-transparent animate-pulse smoke-screen"></div>
        </div>
        
        <div className="z-20 text-center space-y-4">
          <h2 className="text-4xl font-bold tracking-widest text-white uppercase">Composing Magic...</h2>
          <p className="text-slate-500 font-mono text-sm tracking-widest uppercase animate-pulse">Running compilation & cloud upload</p>
        </div>
      </div>
    );
  }

  if (step === 'RESULT' && resultData) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-8 relative overflow-hidden text-slate-200">
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
        
        <div className="max-w-6xl w-full bg-[#0f172a] border border-slate-800 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row z-10">
          
          <div className="md:w-1/2 bg-slate-900 border-r border-slate-800 p-8 flex items-center justify-center gap-6 relative">
            <div className="h-[70vh] flex justify-center w-full max-w-sm relative">
              {resultData?.local_url && <img src={resultData.local_url} className="max-h-full object-contain shadow-2xl rounded-xl border border-white/5 z-10" />}
              {resultData?.gif_url ? (
                <img src={resultData.gif_url} className="absolute -right-12 bottom-12 w-32 object-contain shadow-2xl rounded-xl border border-indigo-500/50 hover:scale-110 transition-transform rotate-6 z-20" title="Your Animated GIF" />
              ) : (
                <div className="absolute -right-12 bottom-12 w-32 aspect-[3/4] bg-slate-800 border border-slate-700/50 shadow-2xl rounded-xl flex items-center justify-center rotate-6 z-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Making GIF</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="md:w-1/2 p-12 flex flex-col justify-center space-y-8">
             <div>
               <h2 className="text-4xl font-black text-white tracking-widest uppercase">Beautiful!</h2>
               <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest">Your photos are ready to be shared and printed.</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
               {settings.enable_remote_print && (
                 <button onClick={handlePrint} className="flex flex-col items-center justify-center p-6 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-2xl transition-colors col-span-2">
                   <Printer size={32} className="mb-2" />
                   <span className="font-bold tracking-widest uppercase text-sm">Send to Printer Server</span>
                 </button>
               )}
               
               <div className="col-span-2 flex items-center justify-between p-6 border border-slate-700 bg-slate-900 rounded-2xl group hover:border-indigo-500/30 transition-colors">
                 <div className="space-y-2">
                   <p className="font-bold text-white uppercase tracking-widest text-sm">Scan to Download</p>
                   <p className="text-xs text-slate-500 font-mono">Scan QR code using your phone camera to download PNG and GIF.</p>
                 </div>
                 <div className="bg-white p-2 rounded-xl group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(79,70,229,0.3)] shrink-0 ml-4">
                   <QRCodeSVG value={resultData.share_link} size={110} />
                 </div>
               </div>

               <div className="col-span-2 space-y-3">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Send via WhatsApp</label>
                 <div className="flex gap-2">
                   <input type="tel" value={waNumber} onChange={e=>setWaNumber(e.target.value)} placeholder="+62 812..." className="flex-1 bg-slate-900 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                   <button onClick={sendWa} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 rounded-xl font-bold tracking-widest uppercase flex gap-2 items-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                     <Share2 size={16} /> Send
                   </button>
                 </div>
               </div>
             </div>

             <button onClick={() => {setStep('HOME'); setResultData(null);}} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold tracking-widest uppercase py-5 rounded-xl mt-4 transition-colors">
               Finish Session
             </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
