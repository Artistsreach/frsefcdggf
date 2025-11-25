
import React, { useState, useRef } from 'react';

interface ControlsProps {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  selectedSize: number;
  setSelectedSize: (size: number) => void;
  isGlowEnabled: boolean;
  setIsGlowEnabled: (enabled: boolean) => void;
  onBuild: () => void;
  onDestroy: () => void;
  onJump: () => void;
  onUndo: () => void;
  onRedo: () => void;
  isFreeCamera: boolean;
  onToggleFreeCamera: () => void;
  isNearNPC: boolean;
  isChatting: boolean;
  onStartChat: () => void;
  onEndChat: () => void;
  onSendTextMessage: (message: string) => void;
  isNearCar: boolean;
  isInCar: boolean;
  onEnterExitCar: () => void;
  isNearForSaleSign: boolean;
  onStartBuilding: () => void;
  isNearItem: boolean;
  onPickUpItem: () => void;
  cash: number;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#f8fafc', '#a16207', '#44403c',
];

const BuildIcon = ({ color }: { color: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill={color} stroke="white" strokeWidth="1.5" />
    </svg>
);

const DestroyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5l-8 8-3-3 8-8 3 3zM15 4l-1.5 1.5M18 7l-1.5 1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 22l5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 11.5L18 6" />
  </svg>
);

const JumpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4-4 4 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16h16" />
    </svg>
);

const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6m-6 6h12a6 6 0 010 12h-3" />
    </svg>
);

const RedoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
    </svg>
);

const Controls: React.FC<ControlsProps> = ({
  selectedColor,
  setSelectedColor,
  selectedSize,
  setSelectedSize,
  isGlowEnabled,
  setIsGlowEnabled,
  onBuild,
  onDestroy,
  onJump,
  onUndo,
  onRedo,
  isFreeCamera,
  onToggleFreeCamera,
  isNearNPC,
  isChatting,
  onStartChat,
  onEndChat,
  onSendTextMessage,
  isNearCar,
  isInCar,
  onEnterExitCar,
  isNearForSaleSign,
  onStartBuilding,
  isNearItem,
  onPickUpItem,
  cash,
}) => {
  const [message, setMessage] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  
  const longPressTimer = useRef<number | null>(null);
  const isLongPress = useRef(false);

  const handleBuildDown = (e: React.PointerEvent) => {
    isLongPress.current = false;
    longPressTimer.current = window.setTimeout(() => {
      isLongPress.current = true;
      setIsPaletteOpen(prev => !prev);
    }, 500);
  };

  const handleBuildUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current) {
      onBuild();
    }
  };

  const handleBuildLeave = () => {
     if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendTextMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {/* Top Left: Stats */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 pointer-events-auto">
        <div className="flex items-center bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/10 shadow-lg">
          <span className="text-green-400 font-bold mr-1">$</span>
          <span className="font-mono text-lg">{cash.toLocaleString()}</span>
        </div>
      </div>

      {/* Top Right: Camera Toggle */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <button
          onClick={onToggleFreeCamera}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 active:scale-95 transition-transform ${isFreeCamera ? 'bg-blue-600' : 'bg-gray-800/80 backdrop-blur-md'}`}
        >
          <CameraIcon />
        </button>
      </div>

      {/* Center Bottom Actions (Interaction) - Moved up */}
      <div className="absolute bottom-[230px] left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-auto">
        {isNearNPC && !isChatting && (
          <button onClick={onStartChat} className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            Chat
          </button>
        )}
        {(isNearCar || isInCar) && (
          <button onClick={onEnterExitCar} className="bg-orange-500 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2">
            {isInCar ? 'Exit Vehicle' : 'Drive Vehicle'}
          </button>
        )}
        {isNearForSaleSign && (
           <button onClick={onStartBuilding} className="bg-green-600 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m8-2a2 2 0 00-2-2H9a2 2 0 00-2 2v4h6v-4z" />
              </svg>
              Build Here
           </button>
        )}
        {isNearItem && (
           <button onClick={onPickUpItem} className="bg-purple-600 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
              Pick Up
           </button>
        )}
      </div>

      {/* Chat Input - Moved up */}
      {isChatting && (
        <div className="absolute bottom-[116px] left-4 right-4 flex gap-2 pointer-events-auto">
          <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-black/60 backdrop-blur-md text-white rounded-full px-6 py-3 border border-white/20 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-lg"
              autoFocus
            />
            <button
              type="submit"
              className="bg-blue-600 text-white p-3 rounded-full shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
              disabled={!message.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          <button
            onClick={onEndChat}
            className="bg-red-500/80 backdrop-blur-md text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Bottom Right Actions - Moved up */}
      {!isChatting && (
        <div className="absolute bottom-[116px] right-4 flex flex-col items-end gap-4 pointer-events-auto">
          
          <div className="flex items-end gap-4">
             {/* Build Actions */}
             {!isInCar && (
                <div className="flex flex-col gap-3 items-end relative">
                    
                    {/* Palette Popup */}
                    {isPaletteOpen && (
                         <div className="absolute bottom-full mb-2 right-0 bg-black/80 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-xl animate-in fade-in zoom-in origin-bottom-right z-30">
                            <div className="mb-2 flex gap-1 justify-end">
                                <button
                                    onClick={() => setSelectedSize(1)}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${selectedSize === 1 ? 'bg-white text-black' : 'bg-gray-600/50 text-white hover:bg-gray-500'}`}
                                >
                                    Full
                                </button>
                                <button
                                    onClick={() => setSelectedSize(0.5)}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${selectedSize === 0.5 ? 'bg-white text-black' : 'bg-gray-600/50 text-white hover:bg-gray-500'}`}
                                >
                                    Small
                                </button>
                            </div>
                            <div className="mb-2 flex gap-1 justify-end">
                                <button
                                    onClick={() => setIsGlowEnabled(!isGlowEnabled)}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${isGlowEnabled ? 'bg-yellow-500 text-black' : 'bg-gray-600/50 text-white hover:bg-gray-500'}`}
                                >
                                    ✨ Glow
                                </button>
                            </div>
                            <div className="flex flex-wrap justify-end gap-1 w-[140px]">
                                {COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => { setSelectedColor(color); setIsPaletteOpen(false); }}
                                    className={`w-8 h-8 rounded-full border-2 shadow-sm transition-transform ${selectedColor === color ? 'border-white scale-110 z-10' : 'border-transparent hover:scale-110 opacity-90'}`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Select color ${color}`}
                                />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onDestroy}
                            className="w-14 h-14 bg-red-500/90 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-lg border-2 border-red-400 active:scale-90 transition-transform"
                            aria-label="Destroy Block"
                        >
                            <DestroyIcon />
                        </button>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={onUndo}
                                className="w-10 h-10 bg-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-md border border-blue-300 active:scale-90 transition-transform"
                                aria-label="Undo"
                                title="Undo"
                            >
                                <UndoIcon />
                            </button>
                            <button
                                onClick={onRedo}
                                className="w-10 h-10 bg-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-md border border-blue-300 active:scale-90 transition-transform"
                                aria-label="Redo"
                                title="Redo"
                            >
                                <RedoIcon />
                            </button>
                        </div>
                    </div>
                    <button
                        onPointerDown={handleBuildDown}
                        onPointerUp={handleBuildUp}
                        onPointerLeave={handleBuildLeave}
                        onContextMenu={(e) => e.preventDefault()}
                        className="w-16 h-16 bg-green-600/90 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-xl border-2 border-green-400 active:scale-90 transition-transform relative select-none touch-none"
                        aria-label="Build Block (Hold for Color)"
                    >
                        <BuildIcon color={selectedColor} />
                    </button>
                </div>
             )}
             
             {/* Jump */}
             {!isFreeCamera && !isInCar && (
                <button
                    onClick={onJump}
                    className="w-20 h-20 bg-gray-700/60 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl border-2 border-gray-500/50 active:scale-90 transition-transform"
                    aria-label="Jump"
                >
                    <JumpIcon />
                </button>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Controls;
