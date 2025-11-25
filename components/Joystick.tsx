
import React, { useState, useRef, useCallback } from 'react';

interface JoystickProps {
  onMove: (direction: { x: number; y: number }, magnitude: number) => void;
}

const JOYSTICK_AREA_SIZE = 200;
const JOYSTICK_SIZE = 160;
const THUMB_SIZE = 80;
const JOYSTICK_RADIUS = (JOYSTICK_SIZE - THUMB_SIZE) / 2;

const Joystick: React.FC<JoystickProps> = ({ onMove }) => {
  const [thumbPosition, setThumbPosition] = useState({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleInteractionMove = useCallback((clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    
    const baseRect = baseRef.current.getBoundingClientRect();
    const joystickCenterX = baseRect.left + baseRect.width / 2;
    const joystickCenterY = baseRect.top + baseRect.height / 2;

    let dx = clientX - joystickCenterX;
    let dy = clientY - joystickCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let clampedDx = dx;
    let clampedDy = dy;

    if (distance > JOYSTICK_RADIUS) {
      clampedDx = (dx / distance) * JOYSTICK_RADIUS;
      clampedDy = (dy / distance) * JOYSTICK_RADIUS;
    }

    setThumbPosition({ x: clampedDx, y: clampedDy });
    // Normalize and pass joystick values.
    // Pushing "up" (negative y on screen) corresponds to forward movement (via negation in VoxelWorld).
    // Pushing "right" (positive x on screen) corresponds to rightward movement.
    const magnitude = distance / JOYSTICK_RADIUS;
    onMove({
      x: clampedDx / JOYSTICK_RADIUS,
      y: clampedDy / JOYSTICK_RADIUS,
    }, Math.min(1, magnitude));
  }, [onMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleInteractionMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging.current) return;
    handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleInteractionMove]);
  
  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    setThumbPosition({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 }, 0);
  }, [onMove]);

  return (
    <div
      ref={baseRef}
      className="absolute bottom-[116px] left-4"
      style={{
        width: `${JOYSTICK_AREA_SIZE}px`,
        height: `${JOYSTICK_AREA_SIZE}px`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-hidden="true"
    >
      <div
        className="w-full h-full flex justify-center items-center"
      >
        <div
            className="w-full h-full rounded-full bg-gray-500/30 backdrop-blur-sm absolute"
            style={{
                width: `${JOYSTICK_SIZE}px`,
                height: `${JOYSTICK_SIZE}px`,
            }}
        />
        <div
          className="absolute rounded-full bg-gray-400/50"
          style={{
            width: `${THUMB_SIZE}px`,
            height: `${THUMB_SIZE}px`,
            transform: `translate(${thumbPosition.x}px, ${thumbPosition.y}px)`,
            transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      </div>
    </div>
  );
};

export default Joystick;
