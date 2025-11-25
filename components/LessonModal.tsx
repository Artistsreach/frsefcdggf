import React, { useMemo } from 'react';

interface LessonModalProps {
  content: string;
  onClose: () => void;
}

const LessonModal: React.FC<LessonModalProps> = ({ content, onClose }) => {
  // Create a sandboxed iframe document with Tailwind CSS and the lesson content
  const iframeContent = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    .correct-answer { animation: correctPulse 0.6s ease-in-out; }
    .wrong-answer { animation: shake 0.5s ease-in-out; }
    @keyframes correctPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); box-shadow: 0 0 30px rgba(34, 197, 94, 0.6); }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-in { animation: fadeIn 0.5s ease-out; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }, [content]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-900/95 via-blue-900/95 to-indigo-900/95 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl w-full max-w-6xl h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] md:max-h-[90vh] md:min-h-[640px] overflow-hidden flex flex-col shadow-2xl border-4 border-blue-300 animate-in zoom-in-95 duration-300">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2 flex justify-between items-center bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
          <div className="flex items-center gap-2 sm:gap-3 relative z-10">
            <span className="text-3xl sm:text-4xl animate-bounce">🎓</span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-wide">Interactive Lesson</h2>
              <p className="text-xs sm:text-sm text-blue-100 font-medium">Learn through play!</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 hover:rotate-90 transition-all duration-300 text-xl sm:text-2xl font-bold relative z-10"
            aria-label="Close lesson"
          >
            ×
          </button>
        </div>
        <div className="flex-1 min-h-0 md:min-h-[480px] overflow-hidden bg-white/80 backdrop-blur-sm">
          <iframe
            srcDoc={iframeContent}
            sandbox="allow-scripts"
            className="w-full h-full border-0"
            title="Interactive Lesson Content"
          />
        </div>
        <div className="px-4 py-2 sm:px-6 sm:py-3 border-t-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 flex justify-center shrink-0">
          <p className="text-xs sm:text-sm text-gray-600 font-medium">✨ Complete the activities to master the topic!</p>
        </div>
      </div>
    </div>
  );
};

export default LessonModal;
