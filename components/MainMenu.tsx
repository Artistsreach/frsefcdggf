import React, { useState } from 'react';

interface MainMenuProps {
  onCustomize: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onCustomize }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-gray-800/80 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 active:scale-95 transition-transform hover:bg-gray-700/80"
        title="Menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-16 left-0 bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl min-w-56">
          <button
            onClick={() => {
              onCustomize();
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-3 text-white hover:bg-blue-600/50 transition-colors border-b border-white/10 font-semibold flex items-center gap-2"
          >
            <span>👤</span>
            <span>Customize Character</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
