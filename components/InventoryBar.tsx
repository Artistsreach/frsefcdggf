
import React from 'react';
import { InventoryItem } from '../types';

interface InventoryBarProps {
  items: InventoryItem[];
  onItemUse?: (index: number, item: InventoryItem) => void;
}

const InventoryBar: React.FC<InventoryBarProps> = ({ items, onItemUse }) => {
  const slots = Array(6).fill(null);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 bg-gray-900/50 backdrop-blur-sm p-2 rounded-xl z-50">
      {slots.map((_, index) => {
        const item = items[index];
        return (
          <div
            key={index}
            onClick={() => item && onItemUse && onItemUse(index, item)}
            className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl transition-colors
              ${item ? 'bg-gray-800/90 border-blue-500 cursor-pointer hover:bg-gray-700/90 hover:border-blue-400' : 'bg-gray-800/30 border-gray-600/50'}`}
            title={item?.name}
          >
            {item?.icon}
          </div>
        );
      })}
    </div>
  );
};

export default InventoryBar;
