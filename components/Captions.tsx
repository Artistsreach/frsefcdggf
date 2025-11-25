
import React from 'react';

interface CaptionsProps {
  userCaption: string;
  modelCaption: string;
  isChatting: boolean;
  speakerName: string;
}

const Captions: React.FC<CaptionsProps> = ({ userCaption, modelCaption, isChatting, speakerName }) => {
  const showCaptions = isChatting && (userCaption || modelCaption);

  return (
    <div
      className={`absolute bottom-[260px] left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 text-center text-white text-lg font-semibold pointer-events-none transition-opacity duration-300 ${showCaptions ? 'opacity-100' : 'opacity-0'}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {userCaption && (
        <p className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1 mb-2 inline-block max-w-full break-words">
          <span className="font-bold text-blue-300">You:</span> {userCaption}
        </p>
      )}
      {userCaption && modelCaption && <br />}
      {modelCaption && (
        <p className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1 inline-block max-w-full break-words">
          <span className="font-bold text-orange-300">{speakerName}:</span> {modelCaption}
        </p>
      )}
    </div>
  );
};

export default Captions;
