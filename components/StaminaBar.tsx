import React from 'react';

interface StaminaBarProps {
  stamina: number;
}

const StaminaBar: React.FC<StaminaBarProps> = ({ stamina }) => {
  const staminaPercent = Math.max(0, Math.min(100, stamina));
  const isLow = staminaPercent < 30;
  const isCritical = staminaPercent < 10;

  return (
    <div className="absolute top-[calc(1rem+2.5rem+10px)] left-1/2 transform -translate-x-1/2 w-64 flex items-center gap-2">
      <span className="text-yellow-300 text-lg">⚡</span>
      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isCritical ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${staminaPercent}%` }}
        />
      </div>
    </div>
  );
};

export default StaminaBar;
