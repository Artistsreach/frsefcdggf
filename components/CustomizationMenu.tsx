
import React, { useState, useEffect, useRef } from 'react';
import { CharacterCustomization, HairStyle, ShirtStyle, PantsStyle, HatStyle, FacialHairStyle, GlassesStyle, NecklaceStyle, HeadwearStyle } from '../types';

interface CustomizationMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customization: CharacterCustomization) => void;
  initialCustomization: CharacterCustomization;
}

const SKIN_COLORS = ['#fcc2a2', '#e0a382', '#c98260', '#ad694b', '#8c5339', '#5b3725'];
const HAIR_COLORS = ['#5a3825', '#2c1d11', '#8d4a1d', '#dcb66f', '#e6e6e6', '#ab2424', '#4682B4'];
const EYE_COLORS = ['#5c98d9', '#8d4a1d', '#228B22', '#6B4226', '#44403c'];
const CLOTHING_COLORS = ['#4682B4', '#3a3a3a', '#e6e6e6', '#ab2424', '#228B22', '#DAA520', '#9932CC', '#FF69B4'];
const SHOE_COLORS = ['#1a1a1a', '#44403c', '#f8fafc', '#ab2424', '#DAA520'];
const HAT_COLORS = ['#4a4a4a', '#2a2a2a', '#DAA520', '#f8fafc', '#ef4444', '#3b82f6'];
const GLASSES_COLORS = ['#222222', '#f8fafc', '#4682B4', '#ab2424'];
const ACCESSORY_COLORS = ['#ffd700', '#c0c0c0', '#e52b50', '#0047ab', '#009e60']; // Gold, Silver, Ruby, Sapphire, Emerald

const GENDERS: Array<CharacterCustomization['gender']> = ['male', 'female'];
const HAIR_STYLES: HairStyle[] = ['short', 'long', 'ponytail', 'bald', 'mohawk', 'bun', 'longBob', 'pixie', 'pigtails', 'sideSwept', 'braid'];
const SHIRT_STYLES: ShirtStyle[] = ['tshirt', 'longsleeve', 'tankTop'];
const PANTS_STYLES: PantsStyle[] = ['jeans', 'shorts', 'skirt'];
const HAT_STYLES: HatStyle[] = ['fedora', 'cap', 'beanie', 'none'];
const FACIAL_HAIR_STYLES: FacialHairStyle[] = ['none', 'beard', 'mustache'];
const GLASSES_STYLES: GlassesStyle[] = ['none', 'round', 'square'];
const NECKLACE_STYLES: NecklaceStyle[] = ['none', 'choker', 'pendant'];
const HEADWEAR_STYLES: HeadwearStyle[] = ['none', 'tiara', 'headband'];


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-gray-300 mb-2 border-b border-gray-600 pb-1">{title}</h3>
    {children}
  </div>
);

const OptionButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
  >
    {label.charAt(0).toUpperCase() + label.slice(1)}
  </button>
);

const ColorPalette: React.FC<{ colors: string[]; selectedColor: string; onSelect: (color: string) => void }> = ({ colors, selectedColor, onSelect }) => (
  <div className="flex flex-wrap gap-2 mt-2">
    {colors.map(color => (
      <button
        key={color}
        onClick={() => onSelect(color)}
        className={`w-8 h-8 rounded-full transition-transform ${selectedColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
        style={{ backgroundColor: color }}
        aria-label={`Select color ${color}`}
      />
    ))}
  </div>
);

const CustomizationMenu: React.FC<CustomizationMenuProps> = ({ isOpen, onClose, onSave, initialCustomization }) => {
  const [customization, setCustomization] = useState(initialCustomization);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    startY: 0,
    isDragging: false,
  });

  useEffect(() => {
    if (isOpen) {
      setCustomization(initialCustomization);
    }
    // When the menu is opened or closed via props (not dragging), ensure inline styles are reset.
    if (menuRef.current) {
        menuRef.current.style.transform = '';
        menuRef.current.style.transition = '';
    }
  }, [isOpen, initialCustomization]);

  const handleSave = () => {
    onSave(customization);
  };

  const handleGenderChange = (gender: CharacterCustomization['gender']) => {
    setCustomization(c => ({
      ...c,
      gender,
      // Reset facial hair if switching to female
      facialHairStyle: gender === 'female' ? 'none' : c.facialHairStyle,
    }));
  };

  const handleHatChange = (style: HatStyle) => {
    setCustomization(c => ({ ...c, hatStyle: style, headwearStyle: 'none' }));
  };

  const handleHeadwearChange = (style: HeadwearStyle) => {
    setCustomization(c => ({ ...c, headwearStyle: style, hatStyle: 'none' }));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!menuRef.current) return;
    dragState.current.isDragging = true;
    dragState.current.startY = e.touches[0].clientY;
    menuRef.current.style.transition = 'none'; // Disable transition for direct manipulation
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current.isDragging || !menuRef.current) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragState.current.startY;

    // Only allow dragging down
    if (deltaY > 0) {
      menuRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current.isDragging || !menuRef.current) return;

    const menuEl = menuRef.current;
    dragState.current.isDragging = false;
    menuEl.style.transition = 'transform 0.3s ease-in-out'; // Re-enable transition
    
    const currentY = e.changedTouches[0].clientY;
    const deltaY = currentY - dragState.current.startY;
    const threshold = menuEl.clientHeight / 3; // Close if dragged more than a third of the way down

    if (deltaY > threshold) {
      // Animate it fully out of view, then call onClose
      menuEl.style.transform = `translateY(100%)`;
      setTimeout(() => {
        onClose();
      }, 300); // Match transition duration
    } else {
      // Snap back to original position
      menuEl.style.transform = `translateY(0px)`;
    }
  };


  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ease-in-out ${isOpen ? 'bg-black/60' : 'bg-transparent pointer-events-none'}`}
      onClick={onClose}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customization-title"
    >
      <div
        ref={menuRef}
        className={`absolute bottom-0 left-0 right-0 bg-gray-800/95 rounded-t-2xl shadow-lg w-full max-w-4xl mx-auto h-auto max-h-[60vh] flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        <div 
            className="p-4 border-b border-gray-700 text-center relative flex-shrink-0 cursor-grab touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-600 rounded-full" aria-hidden="true"></div>
            <h2 id="customization-title" className="text-xl font-bold text-white pt-4">Character Customization</h2>
            <button onClick={onClose} className="absolute top-3 right-4 text-gray-400 hover:text-white text-3xl leading-none" aria-label="Close customization menu">&times;</button>
        </div>
        
        <div className="p-4 overflow-y-auto custom-scrollbar flex-grow">
          <Section title="Appearance">
            <h4 className="text-md text-gray-400 font-medium">Gender</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {GENDERS.map(gender => <OptionButton key={gender} label={gender} isActive={customization.gender === gender} onClick={() => handleGenderChange(gender)} />)}
            </div>

            <h4 className="text-md text-gray-400 font-medium mt-3">Skin Color</h4>
            <ColorPalette colors={SKIN_COLORS} selectedColor={customization.skinColor} onSelect={color => setCustomization(c => ({ ...c, skinColor: color }))} />
            
            <h4 className="text-md text-gray-400 font-medium mt-3">Eye Color</h4>
            <ColorPalette colors={EYE_COLORS} selectedColor={customization.eyeColor} onSelect={color => setCustomization(c => ({ ...c, eyeColor: color }))} />

            <h4 className="text-md text-gray-400 font-medium mt-3">Hair Style</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {HAIR_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.hairStyle === style} onClick={() => setCustomization(c => ({ ...c, hairStyle: style }))} />)}
            </div>
            
            {customization.hairStyle !== 'bald' && (
              <>
                <h4 className="text-md text-gray-400 font-medium mt-3">Hair Color</h4>
                <ColorPalette colors={HAIR_COLORS} selectedColor={customization.hairColor} onSelect={color => setCustomization(c => ({ ...c, hairColor: color }))} />
              </>
            )}

            {customization.gender === 'male' && (
              <>
                <h4 className="text-md text-gray-400 font-medium mt-3">Facial Hair</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {FACIAL_HAIR_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.facialHairStyle === style} onClick={() => setCustomization(c => ({ ...c, facialHairStyle: style }))} />)}
                </div>

                {customization.facialHairStyle !== 'none' && (
                  <>
                    <h4 className="text-md text-gray-400 font-medium mt-3">Facial Hair Color</h4>
                    <ColorPalette colors={HAIR_COLORS} selectedColor={customization.facialHairColor} onSelect={color => setCustomization(c => ({ ...c, facialHairColor: color }))} />
                  </>
                )}
              </>
            )}
          </Section>

          <Section title="Clothing">
            <h4 className="text-md text-gray-400 font-medium">Shirt Style</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {SHIRT_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.shirtStyle === style} onClick={() => setCustomization(c => ({ ...c, shirtStyle: style }))} />)}
            </div>
            <h4 className="text-md text-gray-400 font-medium mt-3">Shirt Color</h4>
            <ColorPalette colors={CLOTHING_COLORS} selectedColor={customization.shirtColor} onSelect={color => setCustomization(c => ({ ...c, shirtColor: color }))} />

            <h4 className="text-md text-gray-400 font-medium mt-3">Pants Style</h4>
            <div className="flex flex-wrap gap-2 mt-2">
                {PANTS_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.pantsStyle === style} onClick={() => setCustomization(c => ({ ...c, pantsStyle: style }))} />)}
            </div>
            <h4 className="text-md text-gray-400 font-medium mt-3">Pants Color</h4>
            <ColorPalette colors={CLOTHING_COLORS} selectedColor={customization.pantsColor} onSelect={color => setCustomization(c => ({ ...c, pantsColor: color }))} />

            <h4 className="text-md text-gray-400 font-medium mt-3">Shoe Color</h4>
            <ColorPalette colors={SHOE_COLORS} selectedColor={customization.shoeColor} onSelect={color => setCustomization(c => ({ ...c, shoeColor: color }))} />
          </Section>
          
          <Section title="Accessories">
            <h4 className="text-md text-gray-400 font-medium">Hat Style</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {HAT_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.hatStyle === style} onClick={() => handleHatChange(style)} />)}
            </div>
            {customization.hatStyle !== 'none' && (
                <>
                    <h4 className="text-md text-gray-400 font-medium mt-3">Hat Color</h4>
                    <ColorPalette colors={HAT_COLORS} selectedColor={customization.hatColor} onSelect={color => setCustomization(c => ({ ...c, hatColor: color }))} />
                </>
            )}

            <h4 className="text-md text-gray-400 font-medium mt-3">Headwear Style</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {HEADWEAR_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.headwearStyle === style} onClick={() => handleHeadwearChange(style)} />)}
            </div>
            {customization.headwearStyle !== 'none' && (
                <>
                    <h4 className="text-md text-gray-400 font-medium mt-3">Headwear Color</h4>
                    <ColorPalette colors={ACCESSORY_COLORS} selectedColor={customization.headwearColor} onSelect={color => setCustomization(c => ({ ...c, headwearColor: color }))} />
                </>
            )}
            
            <h4 className="text-md text-gray-400 font-medium mt-3">Glasses Style</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {GLASSES_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.glassesStyle === style} onClick={() => setCustomization(c => ({ ...c, glassesStyle: style }))} />)}
            </div>
            {customization.glassesStyle !== 'none' && (
                <>
                    <h4 className="text-md text-gray-400 font-medium mt-3">Glasses Color</h4>
                    <ColorPalette colors={GLASSES_COLORS} selectedColor={customization.glassesColor} onSelect={color => setCustomization(c => ({ ...c, glassesColor: color }))} />
                </>
            )}

            <h4 className="text-md text-gray-400 font-medium mt-3">Necklace Style</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {NECKLACE_STYLES.map(style => <OptionButton key={style} label={style} isActive={customization.necklaceStyle === style} onClick={() => setCustomization(c => ({ ...c, necklaceStyle: style }))} />)}
            </div>
            {customization.necklaceStyle !== 'none' && (
                <>
                    <h4 className="text-md text-gray-400 font-medium mt-3">Necklace Color</h4>
                    <ColorPalette colors={ACCESSORY_COLORS} selectedColor={customization.necklaceColor} onSelect={color => setCustomization(c => ({ ...c, necklaceColor: color }))} />
                </>
            )}
          </Section>
        </div>
        
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-500 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">Save & Close</button>
        </div>
      </div>
    </div>
  );
};

export default CustomizationMenu;
