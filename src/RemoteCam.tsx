import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { RefreshCw, Battery, Moon, Sun, Smartphone } from 'lucide-react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function RemoteCam() {
  const webcamRef = useRef<Webcam>(null);
  const [deviceId, setDeviceId] = useState(
    new URLSearchParams(window.location.search).get('deviceId') || 'default'
  );
  const [isBatterySaver, setIsBatterySaver] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(true);
  const [orientation, setOrientation] = useState<'portrait'|'landscape'>('portrait');

  useEffect(() => {
    // Wake Lock API
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake lock error', err);
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  useEffect(() => {
    if (!isTransmitting) return;

    const intervalId = setInterval(async () => {
      const imageSrc = webcamRef.current?.getScreenshot({ width: 720, height: 1280 }); // Default portraitish
      if (imageSrc) {
        await setDoc(doc(db, 'remote_camera', deviceId), { frame: imageSrc, lastUpdated: Date.now() }, { merge: true }).catch(() => {});
      }
    }, 100); // 10fps

    return () => clearInterval(intervalId);
  }, [deviceId, isTransmitting, orientation]);

  if (isBatterySaver) {
    return (
      <div 
        className="fixed inset-0 bg-black flex flex-col items-center justify-center text-gray-500 cursor-pointer"
        onClick={() => setIsBatterySaver(false)}
      >
        <Moon className="w-16 h-16 mb-4 opacity-50" />
        <p className="font-mono text-sm">Battery Saver Active</p>
        <p className="font-mono text-xs mt-2 opacity-50">Tap anywhere to wake</p>
        {/* @ts-ignore */}
        <div className="absolute opacity-0 pointer-events-none">
          {/* @ts-ignore */}
          <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col font-sans">
      <header className="h-16 flex items-center justify-between border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md px-6 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold tracking-widest text-xs uppercase text-white">LENS: {deviceId}</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
            className="p-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsBatterySaver(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-indigo-500/30 rounded-lg text-xs font-bold tracking-widest uppercase hover:bg-indigo-500 transition-colors shadow-[0_0_15px_rgba(79,70,229,0.2)] text-white"
          >
            <Battery className="w-4 h-4" /> Eco Mode
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {/* @ts-ignore */}
        <Webcam 
          audio={false} 
          ref={webcamRef} 
          screenshotFormat="image/jpeg" 
          screenshotQuality={0.8}
          videoConstraints={{ 
            facingMode: 'environment', // usually back camera for photobooth
            aspectRatio: orientation === 'portrait' ? 9/16 : 16/9
          }}
          className={`w-full h-full object-cover ${orientation === 'landscape' ? 'rotate-90 scale-150' : ''}`}
        />
        <div className="absolute inset-0 pointer-events-none border-[16px] border-[#020617]"></div>
        <div className="absolute inset-0 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle, transparent 70%, #020617 120%)'}}></div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 text-red-500 text-[10px] font-bold tracking-widest uppercase">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
          Transmitting Live
        </div>
      </div>
    </div>
  );
}
