import React, { useState } from 'react';
import { Quest } from '../types';

interface QuestTrackerProps {
  quests: Quest[];
}

const QuestTracker: React.FC<QuestTrackerProps> = ({ quests }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeQuest = quests.find(q => !q.completed);
  const completedCount = quests.filter(q => q.completed).length;

  return (
    <div className="absolute top-20 right-4 z-50">
      {/* Minimized state - compact header only */}
      {isMinimized && (
        <div className="bg-gray-900/80 backdrop-blur-md text-white rounded-xl p-3 shadow-2xl border-2 border-purple-500/50 cursor-pointer active:scale-95 transition-transform"
             onClick={() => setIsMinimized(false)}>
          <div className="flex items-center justify-between gap-3 min-w-max">
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <span className="text-sm font-bold text-purple-300">{completedCount}/{quests.length}</span>
            </div>
            <span className="text-lg">▶</span>
          </div>
        </div>
      )}

      {/* Expanded state - full quest log */}
      {!isMinimized && (
        <div className="bg-gray-900/80 backdrop-blur-md text-white rounded-xl p-3 md:p-4 shadow-2xl border-2 border-purple-500/50 w-72 sm:w-80 max-h-screen sm:max-h-none overflow-y-auto">
          {/* Header with minimize button */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl">📜</span>
              <h2 className="text-lg md:text-xl font-bold text-purple-300">Quest Log</h2>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="ml-auto p-2 hover:bg-purple-500/20 rounded-lg transition-colors active:scale-90 touch-none"
              aria-label="Minimize quest log"
            >
              <span className="text-lg">▼</span>
            </button>
          </div>
          
          {/* Progress text */}
          <div className="text-xs md:text-sm text-gray-300 mb-3 font-medium">
            Progress: {completedCount}/{quests.length} quests completed
          </div>

          {/* Progress bar */}
          <div className="h-1.5 md:h-2 bg-gray-700 rounded-full mb-4">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / quests.length) * 100}%` }}
            />
          </div>

          {/* Active quest highlight */}
          {activeQuest && (
            <div className="bg-purple-900/40 rounded-lg p-3 border-2 border-purple-400/50 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-lg md:text-xl flex-shrink-0">⭐</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-yellow-300 mb-1 text-sm md:text-base break-words">
                    Quest {activeQuest.id}: {activeQuest.title}
                  </div>
                  <div className="text-xs md:text-sm text-gray-200 break-words">
                    {activeQuest.description}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quest list */}
          <div className="space-y-2 max-h-60 md:max-h-64 overflow-y-auto pr-1">
            {quests.map((quest) => (
              <div 
                key={quest.id}
                className={`flex items-center gap-2 p-2 md:p-2.5 rounded-lg transition-all touch-target ${
                  quest.completed 
                    ? 'bg-green-900/30 border border-green-500/30' 
                    : quest.id === activeQuest?.id 
                      ? 'opacity-50' 
                      : 'bg-gray-800/30 opacity-40'
                }`}
              >
                <span className="text-lg md:text-xl flex-shrink-0">
                  {quest.completed ? '✅' : quest.id === activeQuest?.id ? '🔄' : '⭕'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs md:text-sm font-medium truncate ${quest.completed ? 'line-through text-green-400' : 'text-gray-300'}`}>
                    {quest.title}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Completion celebration */}
          {completedCount === quests.length && (
            <div className="mt-3 md:mt-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-3 border-2 border-yellow-400/50 text-center">
              <div className="text-2xl md:text-3xl mb-1">🎉</div>
              <div className="font-bold text-yellow-300 text-sm md:text-base">All Quests Complete!</div>
              <div className="text-xs text-gray-300">You're a master adventurer!</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestTracker;
