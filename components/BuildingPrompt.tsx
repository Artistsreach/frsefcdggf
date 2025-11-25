
import React, { useState } from 'react';

interface BuildingPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

const BuildingPrompt: React.FC<BuildingPromptProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ease-in-out flex items-center justify-center p-4 ${isOpen ? 'bg-black/80 opacity-100' : 'bg-transparent opacity-0 pointer-events-none'}`}
      onClick={onClose}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="building-prompt-title"
    >
      <div
        className={`bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col border-4 border-orange-300 transition-all duration-300 ease-in-out ${isOpen ? 'scale-100' : 'scale-95'} animate-in zoom-in-95`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b-2 border-orange-200 flex justify-between items-center bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
          <div className="flex items-center gap-3 relative z-10">
            <span className="text-4xl animate-bounce">🏗️</span>
            <div>
              <h2 id="building-prompt-title" className="text-2xl font-bold tracking-wide">Create Your Vision</h2>
              <p className="text-sm text-orange-100 font-medium">What should we build?</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 hover:rotate-90 transition-all duration-300 text-2xl font-bold relative z-10"
            aria-label="Close building prompt"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="space-y-2">
            <label htmlFor="building-desc" className="block text-sm font-semibold text-gray-700">Building Description:</label>
            <textarea
              id="building-desc"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., a cozy wooden cabin with a red roof and a garden, or a modern skyscraper with glass windows"
              className="w-full h-32 p-4 bg-white text-gray-800 rounded-xl border-2 border-orange-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:outline-none resize-none shadow-sm hover:shadow-md transition-shadow"
              aria-label="Building description"
              disabled={isLoading}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-orange-100 to-amber-100 rounded-lg">
              <svg className="animate-spin h-5 w-5 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="font-semibold text-orange-700">Building in progress... 🏗️</span>
            </div>
          ) : (
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-6 py-3 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 font-semibold transition-all hover:shadow-lg transform hover:scale-105"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={!prompt.trim()} 
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Build Now ✨
              </button>
            </div>
          )}
        </form>

        <div className="px-6 py-3 border-t-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 flex justify-center">
          <p className="text-sm text-gray-600 font-medium">💡 Tip: Be specific! Describe colors, style, and details for better results</p>
        </div>
      </div>
    </div>
  );
};

export default BuildingPrompt;
