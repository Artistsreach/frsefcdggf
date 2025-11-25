import React, { useState } from 'react';

interface MainMenuProps {
  onCustomize: () => void;
  showCars: boolean;
  onToggleCars: (show: boolean) => void;
  showPedestrians: boolean;
  onTogglePedestrians: (show: boolean) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onCustomize, showCars, onToggleCars, showPedestrians, onTogglePedestrians }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-20 left-4 z-50 pointer-events-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800/80 backdrop-blur-md text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-lg border border-white/10 hover:bg-gray-700/80"
        title="Menu"
      >
        ☰
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl min-w-56">
          <button
            onClick={() => {
              onCustomize();
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-3 text-white hover:bg-blue-600/50 transition-colors border-b border-white/10 font-semibold"
          >
            👤 Customize Character
          </button>
          <button
            onClick={() => onToggleCars(!showCars)}
            className="w-full text-left px-4 py-3 text-white hover:bg-blue-600/50 transition-colors border-b border-white/10 font-semibold flex items-center justify-between"
          >
            🚗 Cars
            <span className={`text-sm ${showCars ? 'text-green-400' : 'text-gray-500'}`}>
              {showCars ? 'ON' : 'OFF'}
            </span>
          </button>
          <button
            onClick={() => onTogglePedestrians(!showPedestrians)}
            className="w-full text-left px-4 py-3 text-white hover:bg-blue-600/50 transition-colors font-semibold flex items-center justify-between"
          >
            🚶 Pedestrians
            <span className={`text-sm ${showPedestrians ? 'text-green-400' : 'text-gray-500'}`}>
              {showPedestrians ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
