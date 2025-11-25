import React, { useState } from 'react';

interface MainMenuProps {
  onCustomize: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onCustomize }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-lg"
      >
        ☰ Menu
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl min-w-48">
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
