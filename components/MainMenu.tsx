import React, { useState } from 'react';

interface MainMenuProps {
  onCustomize: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onCustomize }) => {
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
        <div className="absolute top-12 left-0 bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl min-w-48">
          <button
            onClick={() => {
              onCustomize();
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-3 text-white hover:bg-blue-600/50 transition-colors border-b border-white/10 font-semibold"
          >
            👤 Customize Character
          </button>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
