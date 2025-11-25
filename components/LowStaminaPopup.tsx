import React from 'react';

interface LowStaminaPopupProps {
  onClose: () => void;
}

const LowStaminaPopup: React.FC<LowStaminaPopupProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 max-w-md mx-4 shadow-2xl border-2 border-red-500">
        <div className="text-center">
          <div className="text-6xl mb-4">🍕</div>
          <h2 className="text-3xl font-bold text-red-500 mb-3">Stamina Depleted!</h2>
          <p className="text-gray-300 text-lg mb-6">
            You're exhausted! Visit Luigi at the pizza shop to grab a delicious pizza and restore your energy.
          </p>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 transform hover:scale-105"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default LowStaminaPopup;
