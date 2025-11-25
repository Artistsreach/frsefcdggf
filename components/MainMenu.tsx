import React from 'react';

interface MainMenuProps {
  onCustomize: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onCustomize }) => {
  return (
    <div className="absolute top-20 left-4 z-40 flex flex-col gap-2 pointer-events-auto">
      <div className="bg-gray-800/80 backdrop-blur-md border border-white/10 rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={onCustomize}
          className="w-full text-left px-4 py-3 text-white hover:bg-blue-600/50 transition-colors font-semibold flex items-center gap-2"
        >
          <span>👤</span>
          <span>Customize</span>
        </button>
      </div>
    </div>
  );
};

export default MainMenu;
