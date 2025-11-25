
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { Voxel, CharacterCustomization, HairStyle, ShirtStyle, PantsStyle, WorldTheme } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';

export interface NearbyNPC {
  id: string | number;
  name: string;
  type: 'chef' | 'pedestrian' | 'worker' | 'teacher' | 'teller' | 'wizard' | 'custom';
  persona: string;
}

interface VoxelWorldProps {
  voxels: Voxel[];
  selectedColor: string;
  selectedSize: number;
  isGlowEnabled: boolean;
  onAddVoxel: (position: [number, number, number], color: string, size?: number, glow?: boolean) => void;
  onAddVoxels: (voxels: { position: [number, number, number]; color: string; glow?: boolean }[]) => void;
  onRemoveVoxel: (id: number) => void;
  onRemoveVoxels: (positions: [number, number, number][]) => void;
  movement: { x: number; y: number };
  movementMagnitude: number;
  isFreeCamera: boolean;
  characterCustomization: CharacterCustomization;
  worldSize: number;
  onNearestNpcChange: (npc: NearbyNPC | null) => void;
  onTranscriptionUpdate: (update: { user?: string; model?: string; isFinal?: boolean }) => void;
  onCarProximityChange: (isNear: boolean) => void;
  onForSaleProximityChange: (isNear: boolean, signPosition: [number, number, number] | null) => void;
  onItemProximityChange: (isNear: boolean) => void;
  onLessonGenerated: (htmlContent: string) => void;
  onCashChange: (amount: number) => void;
  onStaminaChange: (delta: number) => void;
  onQuestProgress: (questId: number) => void;
  currentCash: number;
  currentStamina: number;
  worldTheme: WorldTheme;
  showCars: boolean;
  showPedestrians: boolean;
}

export interface VoxelWorldApi {
    build: () => void;
    destroy: () => void;
    jump: () => void;
    startConversation: (npc: NearbyNPC) => void;
    endConversation: () => void;
    sendTextMessage: (message: string) => Promise<void>;
    isInCar: () => boolean;
    enterCar: () => boolean;
    exitCar: () => void;
    setForSaleSigns: (signs: [number, number, number][]) => void;
    startGenerativeBuild: (prompt: string, signPosition: [number, number, number]) => Promise<void>;
    pickUpItem: () => { type: string; id: string } | null;
    undo: () => void;
    redo: () => void;
}

// --- Randomization Data for Pedestrians ---
const SKIN_COLORS = ['#fcc2a2', '#e0a382', '#c98260', '#ad694b', '#8c5339', '#5b3725'];
const HAIR_COLORS = ['#5a3825', '#2c1d11', '#8d4a1d', '#dcb66f', '#e6e6e6', '#ab2424', '#4682B4'];
const CLOTHING_COLORS = ['#4682B4', '#3a3a3a', '#e6e6e6', '#ab2424', '#228B22', '#DAA520', '#9932CC', '#FF69B4', '#f97316', '#ef4444'];
const HAIR_STYLES: HairStyle[] = ['short', 'long', 'ponytail', 'bald', 'mohawk', 'bun', 'longBob', 'pixie', 'pigtails', 'sideSwept', 'braid'];
const SHIRT_STYLES: ShirtStyle[] = ['tshirt', 'longsleeve', 'tankTop'];
const PANTS_STYLES: PantsStyle[] = ['jeans', 'shorts', 'skirt'];

const MALE_NAMES = ['Liam', 'Noah', 'Oliver', 'James', 'Elijah', 'William', 'Henry', 'Lucas', 'Ben', 'Theo'];
const FEMALE_NAMES = ['Olivia', 'Emma', 'Ava', 'Charlotte', 'Sophia', 'Amelia', 'Isabella', 'Mia', 'Evelyn', 'Harper'];
const SURNAMES = ['Smith', 'Jones', 'Chen', 'Kim', 'Garcia', 'Davis', 'Miller', 'Tanaka', 'Gupta', 'Rossi'];
const JOBS = ['architect', 'baker', 'artist', 'scientist', 'musician', 'teacher', 'programmer', 'journalist', 'florist', 'mechanic'];
const ADJECTIVES = ['cheerful', 'grumpy', 'curious', 'hurried', 'calm', 'energetic', 'thoughtful', 'dreamy', 'witty', 'shy'];
const HOBBIES = ['sketching old buildings', 'collecting stamps', 'playing guitar', 'stargazing', 'gardening', 'baking', 'reading mystery novels', 'jogging', 'playing chess', 'bird watching'];

const VOXEL_SIZE = 0.18;

// Helper to pick a random item from an array
const pickRandom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generatePersona = (gender: 'male' | 'female'): { name: string, persona: string } => {
    const name = `${pickRandom(gender === 'male' ? MALE_NAMES : FEMALE_NAMES)} ${pickRandom(SURNAMES)}`;
    const persona = `You are ${name}, a ${pickRandom(ADJECTIVES)} ${pickRandom(JOBS)} who enjoys ${pickRandom(HOBBIES)}. You are currently walking through the city. Keep your responses short, friendly, and in character. You are able to follow the player if they ask you to. If the user asks you to follow them, use the 'followPlayer' tool with shouldFollow=true. If they ask you to stop following, use the tool with shouldFollow=false.`;
    return { name, persona };
};


// Common function to create a character model
const createCharacter = (customization: CharacterCustomization) => {
    const characterGroup = new THREE.Group();
    let body_parts: Record<string, THREE.Object3D> = {};

    const voxelSize = VOXEL_SIZE;
    const materialCache: { [key: string]: THREE.MeshLambertMaterial } = {};
    const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);

    const getMaterial = (color: string) => {
        if (!materialCache[color]) {
            materialCache[color] = new THREE.MeshLambertMaterial({ color });
        }
        return materialCache[color];
    };

    const createVoxel = (pos: THREE.Vector3, color: string) => {
        const mat = getMaterial(color);
        const voxel = new THREE.Mesh(geometry, mat);
        voxel.position.copy(pos).multiplyScalar(voxelSize);
        return voxel;
    };
    
    const { 
        gender, skinColor, hairStyle, hairColor, eyeColor, facialHairStyle, facialHairColor, 
        shirtStyle, shirtColor, pantsStyle, pantsColor, shoeColor,
        hatStyle, hatColor, glassesStyle, glassesColor,
        necklaceStyle, necklaceColor, headwearStyle, headwearColor
    } = customization;
    
    const EYES = '#ffffff';
    const IRIS = eyeColor;
    const PUPIL = '#222222';
    const MOUTH = '#c18579';
    const SHOES = shoeColor;
    
    // --- HEAD & FACE ---
    const head = new THREE.Group();
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 0; z++) head.add(createVoxel(new THREE.Vector3(x, -1, z), skinColor));
    for (let x = -2; x <= 2; x++) for (let y = 0; y < 5; y++) for (let z = -2; z <= 1; z++) {
        if (y === 0 && (x < -1 || x > 1)) continue;
        head.add(createVoxel(new THREE.Vector3(x, y, z), skinColor));
    }
    const faceZ = -2.01;
    head.add(createVoxel(new THREE.Vector3(-1, 2, faceZ), EYES)); head.add(createVoxel(new THREE.Vector3(1, 2, faceZ), EYES));
    head.add(createVoxel(new THREE.Vector3(-1, 2, faceZ - 0.1), IRIS)); head.add(createVoxel(new THREE.Vector3(1, 2, faceZ - 0.1), IRIS));
    head.add(createVoxel(new THREE.Vector3(-1, 2, faceZ - 0.2), PUPIL)); head.add(createVoxel(new THREE.Vector3(1, 2, faceZ - 0.2), PUPIL));
    head.add(createVoxel(new THREE.Vector3(0, 1.5, -2), skinColor)); head.add(createVoxel(new THREE.Vector3(0, 0.5, faceZ), MOUTH));
    head.add(createVoxel(new THREE.Vector3(-3, 2, 0), skinColor)); head.add(createVoxel(new THREE.Vector3(-3, 1, 0), skinColor));
    head.add(createVoxel(new THREE.Vector3(3, 2, 0), skinColor)); head.add(createVoxel(new THREE.Vector3(3, 1, 0), skinColor));

    // --- FACIAL HAIR ---
    if (gender === 'male' && facialHairStyle !== 'none') {
      const facialHairZ = -2.02;
      if (facialHairStyle === 'mustache') {
          for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 1, facialHairZ), facialHairColor));
      } else if (facialHairStyle === 'beard') {
          for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 1, facialHairZ), facialHairColor));
          for (let x = -1; x <= 1; x++) for (let y = -1; y <= 0; y++) head.add(createVoxel(new THREE.Vector3(x, y, facialHairZ), facialHairColor));
          for (let y = -1; y <= 1; y++) {
              head.add(createVoxel(new THREE.Vector3(-2, y, -1), facialHairColor)); head.add(createVoxel(new THREE.Vector3(2, y, -1), facialHairColor));
              head.add(createVoxel(new THREE.Vector3(-2, y, 0), facialHairColor)); head.add(createVoxel(new THREE.Vector3(2, y, 0), facialHairColor));
          }
      }
    }

    // --- HAIR ---
    if (hairStyle !== 'bald') {
        if(hairStyle === 'short') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor));
            for (let x = -2; x <= 2; x++) head.add(createVoxel(new THREE.Vector3(x, 4, 2), hairColor));
            head.add(createVoxel(new THREE.Vector3(-2, 4, 1), hairColor)); head.add(createVoxel(new THREE.Vector3(2, 4, 1), hairColor));
            head.add(createVoxel(new THREE.Vector3(-2, 3, 1), hairColor)); head.add(createVoxel(new THREE.Vector3(2, 3, 1), hairColor));
            head.add(createVoxel(new THREE.Vector3(-2, 4, 0), hairColor)); head.add(createVoxel(new THREE.Vector3(2, 4, 0), hairColor));
            for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor));
        } else if (hairStyle === 'long') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor));
            for (let y = -2; y <= 4; y++) for (let x = -2; x <= 2; x++) head.add(createVoxel(new THREE.Vector3(x, y, 2), hairColor));
            for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor));
        } else if (hairStyle === 'ponytail') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor));
            for (let y = 0; y <= 4; y++) for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, y, 2), hairColor));
            for (let y = -4; y <= -1; y++) head.add(createVoxel(new THREE.Vector3(0, y, 2), hairColor));
        } else if (hairStyle === 'mohawk') {
            for (let y = 5; y <= 7; y++) for (let z = -2; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(0, y, z), hairColor));
        } else if (hairStyle === 'bun') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor));
            for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor));
            for (let y = 4; y <= 5; y++) for (let x = -1; x <= 1; x++) for (let z = 2; z <= 3; z++) head.add(createVoxel(new THREE.Vector3(x, y, z), hairColor));
        } else if (hairStyle === 'pixie') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor));
            for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor));
            head.add(createVoxel(new THREE.Vector3(-2, 4, 0), hairColor)); head.add(createVoxel(new THREE.Vector3(2, 4, 0), hairColor));
        } else if (hairStyle === 'longBob') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor));
            for (let y = 0; y <= 4; y++) for(let x = -2; x <= 2; x++) head.add(createVoxel(new THREE.Vector3(x, y, 1), hairColor));
            for (let y = 2; y <= 4; y++) { head.add(createVoxel(new THREE.Vector3(-2, y, 0), hairColor)); head.add(createVoxel(new THREE.Vector3(2, y, 0), hairColor)); }
            for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor));
        } else if (hairStyle === 'pigtails') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor)); // Top
            for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor)); // Bangs
            // Left pigtail
            for (let y = -4; y <= 3; y++) head.add(createVoxel(new THREE.Vector3(-3, y, 0), hairColor));
            head.add(createVoxel(new THREE.Vector3(-3, 4, -1), hairColor));
            // Right pigtail
            for (let y = -4; y <= 3; y++) head.add(createVoxel(new THREE.Vector3(3, y, 0), hairColor));
            head.add(createVoxel(new THREE.Vector3(3, 4, -1), hairColor));
        } else if (hairStyle === 'sideSwept') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor)); // Top
            for (let y = 0; y <= 4; y++) for(let x = 2; x <= 2; x++) head.add(createVoxel(new THREE.Vector3(x, y, 1), hairColor)); // Back right
            for (let y = 2; y <= 4; y++) { head.add(createVoxel(new THREE.Vector3(2, y, 0), hairColor)); } // Side right
            // Swept bangs
            for (let x = -2; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor));
            head.add(createVoxel(new THREE.Vector3(-2, 3, -2), hairColor));
        } else if (hairStyle === 'braid') {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(x, 5, z), hairColor)); // Top
            for (let x = -1; x <= 1; x++) head.add(createVoxel(new THREE.Vector3(x, 4, -2), hairColor)); // Bangs
            // Braid
            for (let y = -6; y <= 4; y++) head.add(createVoxel(new THREE.Vector3(0, y, 2), hairColor));
            for (let y = -5; y <= 3; y++) head.add(createVoxel(new THREE.Vector3(0, y, 3), hairColor));
        }
    }

    // --- HEADWEAR ---
    if (headwearStyle !== 'none') {
      const headwearY = 5.5;
      if (headwearStyle === 'headband') {
          for (let x = -2; x <= 2; x++) head.add(createVoxel(new THREE.Vector3(x, headwearY, -2), headwearColor));
          head.add(createVoxel(new THREE.Vector3(-2, headwearY, -1), headwearColor)); head.add(createVoxel(new THREE.Vector3(2, headwearY, -1), headwearColor));
      } else if (headwearStyle === 'tiara') {
          const tiaraZ = -2.5;
          head.add(createVoxel(new THREE.Vector3(0, headwearY + 1, tiaraZ), headwearColor));
          head.add(createVoxel(new THREE.Vector3(-1, headwearY, tiaraZ), headwearColor)); head.add(createVoxel(new THREE.Vector3(1, headwearY, tiaraZ), headwearColor));
          head.add(createVoxel(new THREE.Vector3(-2, headwearY - 1, tiaraZ), headwearColor)); head.add(createVoxel(new THREE.Vector3(2, headwearY - 1, tiaraZ), headwearColor));
      }
    }

    // --- GLASSES ---
    if (glassesStyle !== 'none') {
      const glassesZ = -2.5;
      const glassesY = 2;
      if (glassesStyle === 'square') {
          head.add(createVoxel(new THREE.Vector3(-2, glassesY + 1, glassesZ), glassesColor)); head.add(createVoxel(new THREE.Vector3(-1, glassesY + 1, glassesZ), glassesColor));
          head.add(createVoxel(new THREE.Vector3(-2, glassesY, glassesZ), glassesColor));     head.add(createVoxel(new THREE.Vector3(-1, glassesY, glassesZ), glassesColor));
          head.add(createVoxel(new THREE.Vector3(1, glassesY + 1, glassesZ), glassesColor));  head.add(createVoxel(new THREE.Vector3(2, glassesY + 1, glassesZ), glassesColor));
          head.add(createVoxel(new THREE.Vector3(1, glassesY, glassesZ), glassesColor));      head.add(createVoxel(new THREE.Vector3(2, glassesY, glassesZ), glassesColor));
      } else if (glassesStyle === 'round') {
          head.add(createVoxel(new THREE.Vector3(-1.5, glassesY + 0.5, glassesZ), glassesColor)); head.add(createVoxel(new THREE.Vector3(-1.5, glassesY - 0.5, glassesZ), glassesColor));
          head.add(createVoxel(new THREE.Vector3(-2, glassesY, glassesZ), glassesColor));         head.add(createVoxel(new THREE.Vector3(-1, glassesY, glassesZ), glassesColor));
          head.add(createVoxel(new THREE.Vector3(1.5, glassesY + 0.5, glassesZ), glassesColor));  head.add(createVoxel(new THREE.Vector3(1.5, glassesY - 0.5, glassesZ), glassesColor));
          head.add(createVoxel(new THREE.Vector3(1, glassesY, glassesZ), glassesColor));          head.add(createVoxel(new THREE.Vector3(2, glassesY, glassesZ), glassesColor));
      }
      head.add(createVoxel(new THREE.Vector3(0, glassesY, glassesZ), glassesColor)); // Bridge
      head.add(createVoxel(new THREE.Vector3(-3, glassesY, -1), glassesColor)); head.add(createVoxel(new THREE.Vector3(-3, glassesY, 0), glassesColor));
      head.add(createVoxel(new THREE.Vector3(3, glassesY, -1), glassesColor)); head.add(createVoxel(new THREE.Vector3(3, glassesY, 0), glassesColor));
    }

    // --- HAT ---
    if (hatStyle !== 'none') {
        const hatY = 6;
        if (hatStyle === 'fedora') {
            for (let x = -3; x <= 3; x++) for (let z = -3; z <= 2; z++) head.add(createVoxel(new THREE.Vector3(x, hatY, z), hatColor));
            for (let yOffset = 1; yOffset <= 2; yOffset++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(x, hatY + yOffset, z), hatColor));
            const bandY = hatY + 1;
            const tempColor = new THREE.Color(hatColor);
            const brightness = (tempColor.r * 0.299 + tempColor.g * 0.587 + tempColor.b * 0.114);
            const bandColor = brightness > 0.5 ? '#2a2a2a' : '#e6e6e6';
            for (let x = -2; x <= 2; x++) { head.add(createVoxel(new THREE.Vector3(x, bandY, -2.01), bandColor)); head.add(createVoxel(new THREE.Vector3(x, bandY, 1.01), bandColor)); }
            for (let z = -1; z <= 0; z++) { head.add(createVoxel(new THREE.Vector3(-2.01, bandY, z), bandColor)); head.add(createVoxel(new THREE.Vector3(2.01, bandY, z), bandColor)); }
        } else if (hatStyle === 'cap') {
            for (let y = 0; y < 3; y++) for (let r = 0; r < 10; r++) {
                const a = r/10 * Math.PI * 2;
                head.add(createVoxel(new THREE.Vector3(Math.cos(a)*2, hatY+y, Math.sin(a)*2-0.5), hatColor));
            }
            for (let x = -2; x <= 2; x++) for (let z = -1; z <= 1; z++) head.add(createVoxel(new THREE.Vector3(x, hatY, -2+z), hatColor));
        } else if (hatStyle === 'beanie') {
            for (let y = 0; y < 4; y++) for (let r = 0; r < 20; r++) {
                const a = r/20 * Math.PI * 2;
                const radius = 2.5 * (1 - y/8);
                head.add(createVoxel(new THREE.Vector3(Math.cos(a)*radius, hatY+y, Math.sin(a)*radius), hatColor));
            }
        }
    }

    // --- BODY ---
    const body = new THREE.Group();
    const bodyWidth = 2; // Male: 5-wide rect. Female: 5-wide shoulder, 3-wide waist.
    for (let x = -bodyWidth; x <= bodyWidth; x++) for (let y = -3; y <= 3; y++) for (let z = -1; z <= 1; z++) {
        if (gender === 'female' && Math.abs(x) > 1 && y < 2) continue; // Taper for female torso
        body.add(createVoxel(new THREE.Vector3(x, y, z), shirtColor));
    }
    
    // --- NECKLACE ---
    if (necklaceStyle !== 'none') {
      const neckY = 3.5;
      const neckZ = 1.1; // Front of the body
      if (necklaceStyle === 'choker') {
          for (let x = -1; x <= 1; x++) body.add(createVoxel(new THREE.Vector3(x, neckY, neckZ), necklaceColor));
          body.add(createVoxel(new THREE.Vector3(-1, neckY, 0), necklaceColor)); body.add(createVoxel(new THREE.Vector3(1, neckY, 0), necklaceColor));
      } else if (necklaceStyle === 'pendant') {
          body.add(createVoxel(new THREE.Vector3(-1, neckY, neckZ), necklaceColor)); body.add(createVoxel(new THREE.Vector3(1, neckY, neckZ), necklaceColor));
          body.add(createVoxel(new THREE.Vector3(0, neckY - 1, neckZ), necklaceColor));
      }
    }

    if (shirtStyle === 'tankTop') {
        const tankTopShoulderWidth = gender === 'female' ? 1 : 2;
        for(let x = -tankTopShoulderWidth; x <= tankTopShoulderWidth; x++){
            if(Math.abs(x) === tankTopShoulderWidth) {
                body.add(createVoxel(new THREE.Vector3(x, 3, 0), shirtColor)); // Straps
            }
        }
    }

    // --- ARMS ---
    const armL = new THREE.Group(); const armR = new THREE.Group();
    // Arms are now thinner (2x1) and shorter (6 voxels) for better proportions.
    for (let y = 0; y >= -5; y--) for (let x = 0; x < 2; x++) for (let z = 0; z <= 0; z++) { // z loop makes it 1 voxel deep
        const isSleeve = (shirtStyle === 'longsleeve') || (shirtStyle === 'tshirt' && y > -3); // sleeve logic adjusted for new length
        const color = isSleeve ? shirtColor : skinColor;
        armL.add(createVoxel(new THREE.Vector3(x, y, z), color));
        armR.add(createVoxel(new THREE.Vector3(-x, y, z), color));
    }
    
    // --- LEGS ---
    const legL = new THREE.Group(); const legR = new THREE.Group();
    for (let y = 0; y >= -8; y--) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        const isLegExposed = (pantsStyle === 'shorts' && y < -3) || (pantsStyle === 'skirt' && y < -4);
        let color = y < -6 ? SHOES : (isLegExposed ? skinColor : pantsColor);
        legL.add(createVoxel(new THREE.Vector3(x, y, z), color));
        legR.add(createVoxel(new THREE.Vector3(x, y, z), color));
    }
    // Add a tip to the shoes for a more defined shape
    legL.add(createVoxel(new THREE.Vector3(0, -8, 2), SHOES));
    legR.add(createVoxel(new THREE.Vector3(0, -8, 2), SHOES));


    // --- ASSEMBLY ---
    const headBaseY = (3.5 * voxelSize); const headGeomCenterY = (1.5 * voxelSize);
    head.position.y = headBaseY + headGeomCenterY; head.rotation.y = Math.PI;
    body.position.y = 0;
    const shoulderX = (gender === 'male' ? 3.5 : 3.0) * voxelSize; const shoulderY = 2.5 * voxelSize;
    armL.position.set(-shoulderX, shoulderY, 0); armR.position.set(shoulderX, shoulderY, 0);
    const hipX = 1.5 * voxelSize; const hipY = -4 * voxelSize;
    legL.position.set(-hipX, hipY, 0); legR.position.set(hipX, hipY, 0);
    
    body_parts = { head, body, armL, armR, legL, legR };
    characterGroup.add(head, body, armL, armR, legL, legR);
    
    // Align the visual model's feet with the bottom of a 3.6-unit-tall physics bounding box.
    characterGroup.position.y = 0.36;

    return { characterGroup, body_parts, createVoxel };
};

const createRandomPedestrian = (): {
    mesh: THREE.Group,
    body_parts: Record<string, THREE.Object3D>,
    name: string,
    persona: string,
} => {
    const gender = pickRandom(['male', 'female'] as const);
    const hairStyle = pickRandom(HAIR_STYLES);
    let pantsStyle = pickRandom(PANTS_STYLES);
    if (gender === 'male' && pantsStyle === 'skirt') {
        pantsStyle = 'jeans';
    }
    
    const { name, persona } = generatePersona(gender);

    const customization: CharacterCustomization = {
        gender: gender,
        skinColor: pickRandom(SKIN_COLORS),
        hairStyle: hairStyle,
        hairColor: hairStyle === 'bald' ? '#000000' : pickRandom(HAIR_COLORS),
        eyeColor: '#5c98d9',
        facialHairStyle: 'none',
        facialHairColor: '#000000',
        shirtStyle: pickRandom(SHIRT_STYLES),
        shirtColor: pickRandom(CLOTHING_COLORS),
        pantsStyle: pantsStyle,
        pantsColor: pickRandom(CLOTHING_COLORS),
        shoeColor: '#1a1a1a',
        hatStyle: 'none',
        hatColor: '#000000',
        glassesStyle: 'none',
        glassesColor: '#000000',
        necklaceStyle: 'none',
        necklaceColor: '#000000',
        headwearStyle: 'none',
        headwearColor: '#000000',
    };

    const { characterGroup, body_parts } = createCharacter(customization);
    const pedestrianMesh = new THREE.Group();
    pedestrianMesh.add(characterGroup);
    pedestrianMesh.name = "pedestrian";
    pedestrianMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });

    return { mesh: pedestrianMesh, body_parts, name, persona };
};

// ... (Existing Car, Train, Pizza code remains unchanged, skipping for brevity)
const createCar = (color: string = '#ef4444') => {
    const carGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = {
      body: new THREE.MeshLambertMaterial({ color }),
      glass: new THREE.MeshLambertMaterial({ color: '#a0e0ff' }),
      tire: new THREE.MeshLambertMaterial({ color: '#222222' }),
      hubcap: new THREE.MeshLambertMaterial({ color: '#bbbbbb' }),
      light: new THREE.MeshLambertMaterial({ color: '#ffff00' }),
      brake: new THREE.MeshLambertMaterial({ color: '#ff0000' }),
      grille: new THREE.MeshLambertMaterial({ color: '#333333' }),
      exhaust: new THREE.MeshLambertMaterial({ color: '#777777' }),
    };
    const addPart = (pos: [number, number, number], size: [number, number, number], mat: THREE.MeshLambertMaterial) => {
        const part = new THREE.Mesh(geometry, mat);
        part.scale.set(size[0], size[1], size[2]);
        part.position.set(pos[0], pos[1], pos[2]);
        carGroup.add(part);
    };
    addPart([0, 0.5, 0], [4, 2, 8], materials.body);
    addPart([0, 2.5, -1], [4, 2, 4], materials.body);
    addPart([0, 2.5, 1.01], [3.9, 1.9, 0.1], materials.glass);
    addPart([0, 2.5, -3.01], [3.9, 1.9, 0.1], materials.glass);
    addPart([-2.01, 2.5, -1], [0.1, 1.9, 3.9], materials.glass);
    addPart([2.01, 2.5, -1], [0.1, 1.9, 3.9], materials.glass);
    addPart([-2.05, 2.5, 0.8], [0.2, 0.6, 0.4], materials.body);
    addPart([2.05, 2.5, 0.8], [0.2, 0.6, 0.4], materials.body);
    addPart([0, 0.8, 4.0], [2.5, 0.6, 0.1], materials.grille);
    addPart([-1, 0.2, -4.01], [0.5, 0.5, 0.5], materials.exhaust);
    const wheelY = 0; const wheelX = 2; const wheelZ = 2.5;
    addPart([-wheelX, wheelY, wheelZ], [1, 2, 2], materials.tire);
    addPart([wheelX, wheelY, wheelZ], [1, 2, 2], materials.tire);
    addPart([-wheelX, wheelY, -wheelZ], [1, 2, 2], materials.tire);
    addPart([wheelX, wheelY, -wheelZ], [1, 2, 2], materials.tire);
    addPart([-wheelX - 0.01, wheelY, wheelZ], [1.1, 1.2, 1.2], materials.hubcap);
    addPart([wheelX + 0.01, wheelY, wheelZ], [1.1, 1.2, 1.2], materials.hubcap);
    addPart([-wheelX - 0.01, wheelY, -wheelZ], [1.1, 1.2, 1.2], materials.hubcap);
    addPart([wheelX + 0.01, wheelY, -wheelZ], [1.1, 1.2, 1.2], materials.hubcap);
    const lightWidth = 1.4; const lightHeight = 0.8; const lightXOffset = 1.2;
    addPart([-lightXOffset, 1, 4.01], [lightWidth, lightHeight, 0.1], materials.light);
    addPart([lightXOffset, 1, 4.01], [lightWidth, lightHeight, 0.1], materials.light);
    addPart([-lightXOffset, 1, -4.01], [lightWidth, lightHeight, 0.1], materials.brake);
    addPart([lightXOffset, 1, -4.01], [lightWidth, lightHeight, 0.1], materials.brake);
    carGroup.scale.setScalar(0.75);
    return carGroup;
};
const createTrain = () => {
    const trainGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const createPart = (pos: [number, number, number], size: [number, number, number], color: string, parent: THREE.Group) => {
        const mat = new THREE.MeshLambertMaterial({ color });
        const part = new THREE.Mesh(geometry, mat);
        part.scale.set(size[0], size[1], size[2]);
        part.position.set(pos[0], pos[1], pos[2]);
        part.castShadow = true;
        parent.add(part);
    };
    const engine = new THREE.Group();
    const ENGINE_COLOR = '#c00000'; const BASE_COLOR = '#222222'; const WHEEL_COLOR = '#444444'; const CABIN_COLOR = '#4a4a4a';
    createPart([0, 1.5, -2], [4, 4, 12], ENGINE_COLOR, engine);
    createPart([0, 0.5, 0], [4.5, 1, 14], BASE_COLOR, engine);
    createPart([0, 4, -4], [3, 3, 4], CABIN_COLOR, engine);
    createPart([0, 4, 3], [1.5, 1.5, 1.5], BASE_COLOR, engine);
    createPart([0, 2, 4.1], [2, 1, 0.2], '#ffff00', engine);
    for (let i = 0; i < 3; i++) {
        createPart([-2.3, 0, -2 + i * 3], [0.5, 2, 2], WHEEL_COLOR, engine);
        createPart([2.3, 0, -2 + i * 3], [0.5, 2, 2], WHEEL_COLOR, engine);
    }
    trainGroup.add(engine);
    const createCarriage = (color: string, zOffset: number) => {
        const carriage = new THREE.Group();
        const WINDOW_COLOR = '#a0e0ff';
        createPart([0, 1.5, 0], [4, 4, 10], color, carriage);
        createPart([0, 0.5, 0], [4.5, 1, 12], BASE_COLOR, carriage);
        for (let i = -1; i <= 1; i += 2) {
            createPart([-2.01, 2.5, i * 2], [0.1, 1.5, 2], WINDOW_COLOR, carriage);
            createPart([2.01, 2.5, i * 2], [0.1, 1.5, 2], WINDOW_COLOR, carriage);
        }
        for (let i = -1; i <= 1; i += 2) {
            createPart([-2.3, 0, i * 3], [0.5, 2, 2], WHEEL_COLOR, carriage);
            createPart([2.3, 0, i * 3], [0.5, 2, 2], WHEEL_COLOR, carriage);
        }
        carriage.position.z = zOffset;
        trainGroup.add(carriage);
    };
    createCarriage('#22c55e', -16); createCarriage('#eab308', -29);
    createCarriage('#3b82f6', -42); createCarriage('#9932CC', -55); createCarriage('#44403c', -68);
    trainGroup.scale.set(0.8, 0.8, 0.8);
    trainGroup.rotation.y = Math.PI / 2;
    return trainGroup;
};
const createPizzaInBox = (pizzaType: string) => {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = {
        box: new THREE.MeshLambertMaterial({ color: '#c2b280' }),
        crust: new THREE.MeshLambertMaterial({ color: '#e3b471' }),
        cheese: new THREE.MeshLambertMaterial({ color: '#ffdd57' }),
        pepperoni: new THREE.MeshLambertMaterial({ color: '#d00000' }),
        margherita: new THREE.MeshLambertMaterial({ color: '#22c55e' }),
    };
    const addPart = (pos: [number, number, number], size: [number, number, number], mat: THREE.MeshLambertMaterial) => {
        const part = new THREE.Mesh(geometry, mat);
        part.scale.set(size[0], size[1], size[2]);
        part.position.set(pos[0], pos[1], pos[2]);
        part.castShadow = true;
        group.add(part);
    };
    const boxSize = 4; const boxHeight = 1;
    addPart([0, 0, 0], [boxSize, 0.2, boxSize], materials.box);
    addPart([0, boxHeight/2, -boxSize/2], [boxSize, boxHeight, 0.2], materials.box);
    addPart([-boxSize/2, boxHeight/2, 0], [0.2, boxHeight, boxSize], materials.box);
    addPart([boxSize/2, boxHeight/2, 0], [0.2, boxHeight, boxSize], materials.box);
    addPart([0, boxHeight/2, boxSize/2], [boxSize, boxHeight, 0.2], materials.box);
    const pizzaRadius = boxSize / 2 - 0.5;
    for (let i = 0; i < 360; i += 20) {
        const angle = (i * Math.PI) / 180;
        addPart([Math.cos(angle) * pizzaRadius, 0.2, Math.sin(angle) * pizzaRadius], [0.5, 0.3, 0.5], materials.crust);
    }
     for (let r = 0; r < pizzaRadius - 0.2; r += 0.5) {
        for (let i = 0; i < 360; i += 30) {
            const angle = (i * Math.PI) / 180;
            addPart([Math.cos(angle) * r, 0.2, Math.sin(angle) * r], [0.5, 0.3, 0.5], materials.cheese);
        }
    }
    if (pizzaType.toLowerCase().includes('pepperoni')) {
        addPart([-0.5, 0.35, -0.5], [0.4, 0.1, 0.4], materials.pepperoni);
        addPart([0.6, 0.35, -0.8], [0.4, 0.1, 0.4], materials.pepperoni);
        addPart([0.8, 0.35, 0.4], [0.4, 0.1, 0.4], materials.pepperoni);
        addPart([-0.2, 0.35, 0.7], [0.4, 0.1, 0.4], materials.pepperoni);
    } else {
        addPart([-0.5, 0.35, -0.5], [0.3, 0.1, 0.3], materials.margherita);
        addPart([0.8, 0.35, 0.4], [0.3, 0.1, 0.3], materials.margherita);
    }
    const lid = new THREE.Group();
    const lidBase = new THREE.Mesh(geometry, materials.box);
    lidBase.scale.set(boxSize, 0.2, boxSize);
    lidBase.position.set(0, 0, 0);
    lid.add(lidBase);
    lid.position.set(0, boxHeight, -boxSize / 2);
    lid.rotation.x = -Math.PI / 6;
    group.add(lid);
    group.scale.set(0.5, 0.5, 0.5);
    return group;
}

// Audio helper functions
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createAudioBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const makePizzaFunctionDeclaration: FunctionDeclaration = {
  name: 'makePizza',
  parameters: {
    type: Type.OBJECT,
    description: 'Makes a pizza for a customer. This tool must be called whenever a customer orders a pizza.',
    properties: {
      pizzaType: {
        type: Type.STRING,
        description: 'The type of pizza to make, for example "pepperoni", "margherita", or "The Vesuvio Volcano Pizza". If not specified, default to margherita.',
      },
      quantity: {
        type: Type.INTEGER,
        description: 'The number of pizzas to make. Defaults to 1 if not specified.',
      },
    },
    required: ['pizzaType', 'quantity'],
  },
};

const buildStructureFunctionDeclaration: FunctionDeclaration = {
  name: 'buildStructure',
  parameters: {
    type: Type.OBJECT,
    description: 'Builds a structure on the construction site based on the user\'s description. Use this when the user asks to build something.',
    properties: {
      structureDescription: {
        type: Type.STRING,
        description: 'The description of the structure to build, e.g., "a small wooden cabin with a red roof".',
      },
    },
    required: ['structureDescription'],
  },
};

const presentLessonFunctionDeclaration: FunctionDeclaration = {
  name: 'presentLesson',
  parameters: {
    type: Type.OBJECT,
    description: 'Presents an engaging, interactive HTML lesson/game/quiz to the student. Make learning fun and interactive!',
    properties: {
      topic: {
        type: Type.STRING,
        description: 'The topic of the lesson.',
      },
      htmlContent: {
        type: Type.STRING,
        description: `CRITICAL: Create an INTERACTIVE, ENGAGING HTML experience (quiz, game, or interactive presentation). Requirements:

**FORMAT OPTIONS** (Choose the most appropriate):
1. **Interactive Quiz**: Multiple choice questions with instant feedback, score tracking, and celebration effects
2. **Educational Game**: Drag-and-drop matching, memory card games, word searches, puzzles
3. **Interactive Presentation**: Click-to-reveal sections, animated diagrams, interactive timelines
4. **Challenge/Activity**: Coding challenges, math games, fill-in-the-blank exercises

**IMPLEMENTATION GUIDE**:
- Use Tailwind CSS classes for beautiful, modern styling
- Include inline <script> tags for interactivity (vanilla JavaScript)
- Add buttons, clicks, animations, transitions, and visual feedback
- Use emojis and colorful gradients to make it engaging
- Track progress/score and show encouragement messages
- Include celebration animations when correct (confetti effects with emojis)
- Make it self-contained (no external dependencies)

**EXAMPLE QUIZ STRUCTURE**:
<div class="space-y-6">
  <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
    <h1 class="text-3xl font-bold">🧮 Math Quiz!</h1>
    <p class="text-lg">Score: <span id="score">0</span>/10</p>
  </div>
  <div id="questions" class="space-y-4"></div>
  <div id="result" class="hidden"></div>
  <script>
    let score = 0;
    const questions = [
      {q: "What is 5 + 3?", options: ["6", "7", "8", "9"], correct: 2},
      // ... more questions
    ];
    function showQuestion(idx) {
      // Render question with buttons
      // Add click handlers for feedback
      // Update score and show next question
    }
    showQuestion(0);
  </script>
</div>

**STYLING TIPS**:
- Use: bg-gradient-to-r, shadow-xl, rounded-2xl, hover:scale-105, transition-all
- Buttons: "bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all cursor-pointer"
- Success: "bg-green-500 text-white", Error: "bg-red-500 text-white"
- Add particle effects with animated emoji spans

Make it FUN, COLORFUL, and INTERACTIVE - students should enjoy learning!`,
      },
    },
    required: ['topic', 'htmlContent'],
  },
};

const withdrawFunctionDeclaration: FunctionDeclaration = {
  name: 'withdrawMoney',
  parameters: {
    type: Type.OBJECT,
    description: 'Withdraws money from the customer\'s bank account. The customer has unlimited funds in the bank.',
    properties: {
      amount: {
        type: Type.INTEGER,
        description: 'The amount of money to withdraw.',
      },
    },
    required: ['amount'],
  },
};

const depositFunctionDeclaration: FunctionDeclaration = {
  name: 'depositMoney',
  parameters: {
    type: Type.OBJECT,
    description: 'Deposits money into the customer\'s bank account.',
    properties: {
      amount: {
        type: Type.INTEGER,
        description: 'The amount of money to deposit.',
      },
    },
    required: ['amount'],
  },
};

const followPlayerFunctionDeclaration: FunctionDeclaration = {
  name: 'followPlayer',
  parameters: {
    type: Type.OBJECT,
    description: 'Control whether the NPC follows the player.',
    properties: {
      shouldFollow: {
        type: Type.BOOLEAN,
        description: 'True to start following, false to stop.',
      },
    },
    required: ['shouldFollow'],
  },
};

const spawnCustomNPCFunctionDeclaration: FunctionDeclaration = {
  name: 'spawnCustomNPC',
  parameters: {
    type: Type.OBJECT,
    description: 'Spawns a custom NPC with specific traits, detailed costume customization, and optional props/held items as requested by the user.',
    properties: {
      name: { type: Type.STRING, description: 'The name of the NPC.' },
      gender: { type: Type.STRING, enum: ['male', 'female'], description: 'Gender of the NPC.' },
      persona: { type: Type.STRING, description: 'A description of the NPC personality and role.' },
      skinColor: { type: Type.STRING, description: 'Hex color for skin.' },
      hairStyle: { type: Type.STRING, enum: ['short', 'long', 'ponytail', 'bald', 'mohawk', 'bun', 'longBob', 'pixie', 'pigtails', 'sideSwept', 'braid'] },
      hairColor: { type: Type.STRING, description: 'Hex color for hair.' },
      shirtStyle: { type: Type.STRING, enum: ['tshirt', 'longsleeve', 'tankTop'] },
      shirtColor: { type: Type.STRING, description: 'Hex color for shirt.' },
      pantsStyle: { type: Type.STRING, enum: ['jeans', 'shorts', 'skirt'] },
      pantsColor: { type: Type.STRING, description: 'Hex color for pants.' },
      shoeColor: { type: Type.STRING, description: 'Hex color for shoes.' },
      hatStyle: { type: Type.STRING, enum: ['cap', 'fedora', 'beanie', 'none'] },
      hatColor: { type: Type.STRING, description: 'Hex color for hat.' },
      glassesStyle: { type: Type.STRING, enum: ['none', 'round', 'square'] },
      glassesColor: { type: Type.STRING, description: 'Hex color for glasses.' },
      necklaceStyle: { type: Type.STRING, enum: ['none', 'choker', 'pendant'] },
      necklaceColor: { type: Type.STRING, description: 'Hex color for necklace.' },
      headwearStyle: { type: Type.STRING, enum: ['none', 'tiara', 'headband'] },
      headwearColor: { type: Type.STRING, description: 'Hex color for headwear.' },
      facialHairStyle: { type: Type.STRING, enum: ['none', 'beard', 'mustache'] },
      facialHairColor: { type: Type.STRING, description: 'Hex color for facial hair.' },
      heldProp: { type: Type.STRING, description: 'An item for the NPC to hold in their hand (e.g., sword, wand, staff, axe, gun, flower).'},
      backProp: { type: Type.STRING, description: 'An item for the NPC to wear on their back (e.g., wings, cape, backpack).'}
    },
    required: ['name', 'gender', 'persona'],
  },
};

const spawnObjectFunctionDeclaration: FunctionDeclaration = {
    name: 'spawnObject',
    parameters: {
        type: Type.OBJECT,
        description: 'Spawns a custom 3D voxel object/structure into the world using magic. Use this when the user asks to conjure or create an object (e.g. "spawn a car", "create a tree").',
        properties: {
            description: { type: Type.STRING, description: 'Detailed visual description of the object to spawn (e.g. "a large golden trophy", "a red sports car").' },
        },
        required: ['description']
    }
};

const VoxelWorld = forwardRef<VoxelWorldApi, VoxelWorldProps>(({
  voxels,
  selectedColor,
  selectedSize,
  isGlowEnabled,
  onAddVoxel,
  onAddVoxels,
  onRemoveVoxel,
  onRemoveVoxels,
  movement,
  movementMagnitude,
  isFreeCamera,
  characterCustomization,
  worldSize,
  onNearestNpcChange,
  onTranscriptionUpdate,
  onCarProximityChange,
  onForSaleProximityChange,
  onItemProximityChange,
  onLessonGenerated,
  onCashChange,
  onStaminaChange,
  onQuestProgress,
  currentCash,
  currentStamina,
  worldTheme,
  showCars,
  showPedestrians,
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const logicRef = useRef<any>({});
  
  const isFreeCameraRef = useRef(isFreeCamera);
  const showCarsRef = useRef(showCars);
  const showPedestriansRef = useRef(showPedestrians);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const lastNearestNpcId = useRef<string | number | null>(null);
  
  // Undo/Redo history - tracks build button and destroy button actions only
  const undoStackRef = useRef<Array<{ type: 'add' | 'remove', position?: [number, number, number], color?: string, size?: number, glow?: boolean, voxelId?: number }>>([]);
  const redoStackRef = useRef<Array<{ type: 'add' | 'remove', position?: [number, number, number], color?: string, size?: number, glow?: boolean, voxelId?: number }>>([]);
  const currentDragVoxelsRef = useRef<any[]>([]);

  const state = useRef({
    // Scene
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    renderer: null as THREE.WebGLRenderer | null,
    clock: new THREE.Clock(),
    ambientLight: null as THREE.AmbientLight | null,
    directionalLight: null as THREE.DirectionalLight | null,
    
    // Player, NPC, etc...
    player: {
        mesh: new THREE.Group(),
        body_parts: {} as Record<string, THREE.Object3D>,
        velocity: new THREE.Vector3(),
        isGrounded: false,
        run_time: 0,
        width: 1.6,
        height: 3.6,
        isInCar: false,
        currentCar: null as THREE.Group | null,
    },
    npc: {
      mesh: new THREE.Group(),
      body_parts: {} as Record<string, THREE.Object3D>,
      velocity: new THREE.Vector3(),
      isGrounded: false,
      run_time: 0,
      width: 1.6,
      height: 3.6,
      target: new THREE.Vector3(),
      waypoints: [] as THREE.Vector3[],
      currentTargetIndex: 0,
      isTalking: false,
      idleTimer: 0,
    },
    teller: {
      mesh: new THREE.Group(),
      body_parts: {} as Record<string, THREE.Object3D>,
      width: 1.6,
      height: 3.6,
      isTalking: false,
    },
    teacher: {
      mesh: new THREE.Group(),
      body_parts: {} as Record<string, THREE.Object3D>,
      width: 1.6,
      height: 3.6,
      isTalking: false,
    },
    wizard: {
        mesh: new THREE.Group(),
        body_parts: {} as Record<string, THREE.Object3D>,
        width: 1.6,
        height: 3.6,
        isTalking: false,
        shouldFollow: false,
    },
    constructionWorkers: [] as {
        mesh: THREE.Group,
        body_parts: Record<string, THREE.Object3D>,
        isBuilding: boolean,
        isPreparing: boolean,
        target: THREE.Vector3,
        buildQueue: { position: [number, number, number]; color: string }[],
        buildCooldown: number,
        id: string,
        name: string,
        persona: string,
        isTalking: boolean,
    }[],
    
    pedestrians: [] as {
        mesh: THREE.Group,
        body_parts: Record<string, THREE.Object3D>,
        run_time: number,
        path: THREE.CatmullRomCurve3,
        progress: number,
        speed: number,
        id: number,
        name: string,
        persona: string,
        isTalking: boolean,
        offset: THREE.Vector3,
        displacementVelocity: THREE.Vector3,
        isFollowingPlayer: boolean,
    }[],

    customNpcs: [] as {
        mesh: THREE.Group,
        body_parts: Record<string, THREE.Object3D>,
        run_time: number,
        id: string,
        name: string,
        persona: string,
        isTalking: boolean,
        target: THREE.Vector3,
        velocity: THREE.Vector3,
        idleTimer: number,
        width: number,
        height: number,
    }[],
    
    sidewalkPaths: [] as THREE.CatmullRomCurve3[],

    // Camera
    cameraTarget: new THREE.Vector3(),
    orbit_angle: { x: 0.2, y: 0, },
    manualCameraControl: false,
    touchState: {
        activePointers: new Map<number, { x: number, y: number }>(),
        lastPinchDist: null as number | null,
        lastTwoFingerCenter: null as { x: number, y: number } | null,
        lastThreeFingerCenter: null as { x: number, y: number } | null,
        lastDrawPoint: null as { x: number, y: number } | null,
        tapStartX: 0,
        tapStartY: 0,
        tapStartTime: 0,
        isTapCandidate: false,
        longPressTimer: null as ReturnType<typeof setTimeout> | null,
        twoFingerGestureType: null as 'pinch' | 'rotate' | null,
        pinchDistThreshold: 5, // pixels of distance change to trigger pinch
    },

    freeCamera: { pivot: new THREE.Vector3(), zoom: 12, isInitialized: false },

    // World
    voxelMap: new Map<string, Voxel>(),
    glowLights: new Map<string, THREE.PointLight>(),
    forSaleSigns: [] as THREE.Vector3[],
    instancedMesh: null as THREE.InstancedMesh | null,
    highlighter: new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x000000 })),
    targetBlock: null as { id: number; position: THREE.Vector3; normal: THREE.Vector3 } | null,
    isGlowEnabled: false,
    gridHelper: null as THREE.GridHelper | null,

    doors: [] as {
        leftPanel: THREE.Group,
        rightPanel: THREE.Group,
        centerPosition: THREE.Vector3,
        isOpen: boolean,
        axis: 'x' | 'z',
        width: number,
    }[],
    cars: [] as {
        mesh: THREE.Group,
        speed: number,
        desiredSpeed: number,
        timeStationary: number,
        path: THREE.CatmullRomCurve3,
        progress: number,
        offset: THREE.Vector3,
        displacementVelocity: THREE.Vector3,
    }[],
    intersectionCenters: [] as THREE.Vector3[],
    drivableCars: [] as {
        mesh: THREE.Group,
        velocity: THREE.Vector3,
        steering: number,
    }[],
    closestDrivableCar: null as THREE.Group | null,
    train: {
        mesh: new THREE.Group(),
        path: null as THREE.CatmullRomCurve3 | null,
        progress: 0,
        speed: 25,
    },
    pizzaCounterSpots: [] as THREE.Vector3[],
    placedItems: [] as { id: string, mesh: THREE.Group, type: string }[],
    
    gemini: {
        ai: null as GoogleGenAI | null,
        sessionPromise: null as Promise<any> | null,
        activeChatSession: null as { npcType: 'pedestrian' | 'chef' | 'worker' | 'teacher' | 'teller' | 'wizard' | 'custom'; id: number | string } | null,
        micStream: null as MediaStream | null,
        scriptProcessor: null as ScriptProcessorNode | null,
        inputAudioContext: null as AudioContext | null,
        outputAudioContext: null as AudioContext | null,
        outputNode: null as GainNode | null,
        sources: new Set<AudioBufferSourceNode>(),
        nextStartTime: 0,
    }

  }).current;

  const snapToGrid = (value: number, size: number): number => {
      if (size === 1) {
          return Math.round(value);
      } else {
          return Math.round(value / size) * size;
      }
  };

  const handleTap = (clientX: number, clientY: number) => {
      if (!rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), state.camera);
      
      let placePosition: [number, number, number] | null = null;
      if (state.instancedMesh) {
          const intersections = raycaster.intersectObject(state.instancedMesh);
          if (intersections.length > 0) {
              const intersection = intersections[0];
              if (intersection.instanceId !== undefined && intersection.face) {
                  const matrix = new THREE.Matrix4();
                  state.instancedMesh.getMatrixAt(intersection.instanceId, matrix);
                  const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
                  const normal = intersection.face.normal.clone().transformDirection(state.instancedMesh.matrixWorld).round();
                  const rawPos = pos.clone().add(normal.clone().multiplyScalar(selectedSize));
                  placePosition = [
                      snapToGrid(rawPos.x, selectedSize),
                      snapToGrid(rawPos.y, selectedSize),
                      snapToGrid(rawPos.z, selectedSize)
                  ];
              }
          }
      }
      if (!placePosition) {
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5);
          const target = new THREE.Vector3();
          const hit = raycaster.ray.intersectPlane(plane, target);
          if (hit) {
               placePosition = [snapToGrid(target.x, selectedSize), 0, snapToGrid(target.z, selectedSize)];
          }
      }
      if (placePosition) {
          onAddVoxel(placePosition, selectedColor, selectedSize, state.isGlowEnabled);
          undoStackRef.current.push({ type: 'add', position: placePosition, color: selectedColor, size: selectedSize, glow: state.isGlowEnabled });
          redoStackRef.current = [];
      }
  };

  const handleDestroy = (clientX: number, clientY: number) => {
      if (!rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), state.camera);
      
      if (state.instancedMesh) {
          const intersections = raycaster.intersectObject(state.instancedMesh);
          if (intersections.length > 0) {
              const intersection = intersections[0];
              if (intersection.instanceId !== undefined) {
                   if (!isFreeCameraRef.current && intersection.distance > 12) return;

                  const matrix = new THREE.Matrix4();
                  state.instancedMesh.getMatrixAt(intersection.instanceId, matrix);
                  const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
                  const key = `${pos.x},${pos.y},${pos.z}`;
                  const voxel = state.voxelMap.get(key);

                  if (voxel) {
                      onRemoveVoxel(voxel.id);
                      if (navigator.vibrate) navigator.vibrate(200); 
                  }
              }
          }
      }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    state.touchState.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.touchState.activePointers.size === 1) {
        currentDragVoxelsRef.current = [];
        state.touchState.isTapCandidate = true;
        state.touchState.tapStartX = e.clientX;
        state.touchState.tapStartY = e.clientY;
        state.touchState.tapStartTime = Date.now();
        state.touchState.lastDrawPoint = { x: e.clientX, y: e.clientY };

        if (state.touchState.longPressTimer) clearTimeout(state.touchState.longPressTimer);
        state.touchState.longPressTimer = setTimeout(() => {
             if (state.touchState.isTapCandidate) {
                 handleDestroy(state.touchState.tapStartX, state.touchState.tapStartY);
                 state.touchState.isTapCandidate = false;
             }
        }, 1600);
    } else {
        state.touchState.isTapCandidate = false;
        if (state.touchState.longPressTimer) {
            clearTimeout(state.touchState.longPressTimer);
            state.touchState.longPressTimer = null;
        }
    }

    if (state.touchState.activePointers.size === 2) {
        const pointers = Array.from(state.touchState.activePointers.values()) as { x: number; y: number }[];
        const p1 = pointers[0];
        const p2 = pointers[1];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        state.touchState.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        state.touchState.lastTwoFingerCenter = { x: cx, y: cy };
    }

    if (state.touchState.activePointers.size === 3) {
        const pointers = Array.from(state.touchState.activePointers.values()) as { x: number; y: number }[];
        const cx = (pointers[0].x + pointers[1].x + pointers[2].x) / 3;
        const cy = (pointers[0].y + pointers[1].y + pointers[2].y) / 3;
        state.touchState.lastThreeFingerCenter = { x: cx, y: cy };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!state.touchState.activePointers.has(e.pointerId)) return;
    const prev = state.touchState.activePointers.get(e.pointerId)!;
    const curr = { x: e.clientX, y: e.clientY };
    const deltaX = curr.x - prev.x;
    const deltaY = curr.y - prev.y;
    
    state.touchState.activePointers.set(e.pointerId, curr);

    if (state.touchState.activePointers.size === 1) {
        if (Math.abs(curr.x - state.touchState.tapStartX) > 10 || Math.abs(curr.y - state.touchState.tapStartY) > 10) {
            state.touchState.isTapCandidate = false;
            if (state.touchState.longPressTimer) {
                clearTimeout(state.touchState.longPressTimer);
                state.touchState.longPressTimer = null;
            }
        }
        
        if (isFreeCameraRef.current) {
            // Free camera: 1 finger draws voxels along a line
            if (state.touchState.lastDrawPoint && rendererRef.current) {
                const rect = rendererRef.current.domElement.getBoundingClientRect();
                const getWorldPoint = (clientX: number, clientY: number) => {
                    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
                    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(new THREE.Vector2(x, y), state.camera);
                    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5);
                    const target = new THREE.Vector3();
                    raycaster.ray.intersectPlane(plane, target);
                    return target;
                };
                
                const p1 = getWorldPoint(state.touchState.lastDrawPoint.x, state.touchState.lastDrawPoint.y);
                const p2 = getWorldPoint(curr.x, curr.y);
                
                // Bresenham-like line drawing with steps
                const steps = 5;
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const pos = new THREE.Vector3().lerpVectors(p1, p2, t);
                    const placePosition: [number, number, number] = [
                        snapToGrid(pos.x, selectedSize),
                        0,
                        snapToGrid(pos.z, selectedSize)
                    ];
                    onAddVoxel(placePosition, selectedColor, selectedSize, state.isGlowEnabled);
                    // Immediately capture the voxel ID after placement
                    const voxelData = state.voxelMap.get(`${placePosition[0]},${placePosition[1]},${placePosition[2]}`);
                    if (voxelData) {
                        currentDragVoxelsRef.current.push({ voxelId: voxelData.id, position: placePosition, color: selectedColor, size: selectedSize, glow: state.isGlowEnabled });
                    }
                }
            }
            
            state.touchState.lastDrawPoint = { x: curr.x, y: curr.y };
        } else {
            // Regular camera: 1 finger orbits
            const SENSITIVITY = 0.005;
            state.orbit_angle.y -= deltaX * SENSITIVITY;
            state.orbit_angle.x += deltaY * SENSITIVITY;
            state.orbit_angle.x = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, state.orbit_angle.x));
            state.manualCameraControl = true;
        }
    } else if (state.touchState.activePointers.size === 2) {
        // 2 fingers: Dynamic detection between pinch (zoom) and rotation (orbit)
        state.touchState.isTapCandidate = false;
        if (state.touchState.longPressTimer) {
             clearTimeout(state.touchState.longPressTimer);
             state.touchState.longPressTimer = null;
        }
        
        const pointers = Array.from(state.touchState.activePointers.values()) as { x: number; y: number }[];
        const p1 = pointers[0];
        const p2 = pointers[1];
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;
        
        if (state.touchState.lastPinchDist === null) {
            state.touchState.lastPinchDist = dist;
            state.touchState.lastTwoFingerCenter = { x: centerX, y: centerY };
        } else {
            const prevCenter = state.touchState.lastTwoFingerCenter!;
            const centerDeltaX = centerX - prevCenter.x;
            const centerDeltaY = centerY - prevCenter.y;
            const centerMovement = Math.sqrt(centerDeltaX * centerDeltaX + centerDeltaY * centerDeltaY);
            const pinchDelta = Math.abs(state.touchState.lastPinchDist - dist);
            
            if (isFreeCameraRef.current) {
                // Apply zoom if pinch is detected
                if (pinchDelta > 1) {
                    const pinchDeltaSigned = state.touchState.lastPinchDist - dist;
                    const ZOOM_SPEED = 0.05;
                    state.freeCamera.zoom += pinchDeltaSigned * ZOOM_SPEED;
                    state.freeCamera.zoom = Math.max(2, Math.min(50, state.freeCamera.zoom));
                }
                
                // Apply rotation if center movement is detected
                if (centerMovement > 1) {
                    const ROTATION_SENSITIVITY = 0.005;
                    state.orbit_angle.y -= centerDeltaX * ROTATION_SENSITIVITY;
                    state.orbit_angle.x += centerDeltaY * ROTATION_SENSITIVITY;
                    state.orbit_angle.x = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, state.orbit_angle.x));
                    state.manualCameraControl = true;
                }
            }
            
            state.touchState.lastPinchDist = dist;
            state.touchState.lastTwoFingerCenter = { x: centerX, y: centerY };
        }
    } else if (state.touchState.activePointers.size === 3) {
        // 3 fingers: Pan camera
        state.touchState.isTapCandidate = false;
        if (state.touchState.longPressTimer) {
             clearTimeout(state.touchState.longPressTimer);
             state.touchState.longPressTimer = null;
        }
        
        const pointers = Array.from(state.touchState.activePointers.values()) as { x: number; y: number }[];
        const cx = (pointers[0].x + pointers[1].x + pointers[2].x) / 3;
        const cy = (pointers[0].y + pointers[1].y + pointers[2].y) / 3;
        
        if (state.touchState.lastThreeFingerCenter && isFreeCameraRef.current) {
             const panDx = cx - state.touchState.lastThreeFingerCenter.x;
             const panDy = cy - state.touchState.lastThreeFingerCenter.y;
             const PAN_SPEED = 0.03 * (state.freeCamera.zoom / 10);
             const yaw = state.orbit_angle.y;
             const rightDir = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
             const forwardDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
             const moveVec = new THREE.Vector3();
             moveVec.add(rightDir.multiplyScalar(-panDx * PAN_SPEED));
             moveVec.add(forwardDir.multiplyScalar(panDy * PAN_SPEED));
             state.freeCamera.pivot.add(moveVec);
        }
        state.touchState.lastThreeFingerCenter = { x: cx, y: cy };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
     (e.target as HTMLElement).releasePointerCapture(e.pointerId);
     state.touchState.activePointers.delete(e.pointerId);
     
     if (state.touchState.activePointers.size === 0 && currentDragVoxelsRef.current.length > 0) {
        console.log('PointerUp: drag ended with', currentDragVoxelsRef.current.length, 'voxels. Adding to undo stack:', currentDragVoxelsRef.current);
        undoStackRef.current.push({ type: 'add', voxels: [...currentDragVoxelsRef.current] });
        redoStackRef.current = [];
        currentDragVoxelsRef.current = [];
     }
     
     if (state.touchState.activePointers.size < 2) {
        state.touchState.lastPinchDist = null;
        state.touchState.lastTwoFingerCenter = null;
        state.touchState.lastDrawPoint = null;
        state.touchState.twoFingerGestureType = null;
     }

     if (state.touchState.activePointers.size < 3) {
        state.touchState.lastThreeFingerCenter = null;
     }

     if (state.touchState.activePointers.size === 0) {
         if (state.touchState.longPressTimer) {
             clearTimeout(state.touchState.longPressTimer);
             state.touchState.longPressTimer = null;
         }

         if (state.touchState.isTapCandidate) {
             const duration = Date.now() - state.touchState.tapStartTime;
             if (duration < 300) {
                 handleTap(state.touchState.tapStartX, state.touchState.tapStartY);
             }
             state.touchState.isTapCandidate = false;
         }
     }
  };

  const isVoxelAt = (x: number, y: number, z: number) => state.voxelMap.has(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
  
  const checkCarWorldCollision = (pos: THREE.Vector3, quat: THREE.Quaternion) => {
    // Car dimensions (scaled 0.75): Width ~3, Length ~6.
    // Check interaction with voxels at wheel height and slightly above
    const halfW = 1.4;
    const halfL = 2.8;
    
    // Corners relative to center
    const points = [
        new THREE.Vector3(halfW, 0.5, halfL),
        new THREE.Vector3(-halfW, 0.5, halfL),
        new THREE.Vector3(halfW, 0.5, -halfL),
        new THREE.Vector3(-halfW, 0.5, -halfL),
        new THREE.Vector3(halfW, 0.5, 0), // Sides
        new THREE.Vector3(-halfW, 0.5, 0),
        new THREE.Vector3(0, 0.5, halfL), // Front/Back
        new THREE.Vector3(0, 0.5, -halfL),
        // Add 1/4 points for robust wall collision
        new THREE.Vector3(halfW, 0.5, halfL/2),
        new THREE.Vector3(-halfW, 0.5, halfL/2),
        new THREE.Vector3(halfW, 0.5, -halfL/2),
        new THREE.Vector3(-halfW, 0.5, -halfL/2),
    ];
    
    for (const p of points) {
        const worldP = p.clone().applyQuaternion(quat).add(pos);
        // Check at Y=1 (ground level + 1) and Y=2 to catch walls
        if (isVoxelAt(worldP.x, worldP.y, worldP.z)) return true;
        if (isVoxelAt(worldP.x, worldP.y + 1, worldP.z)) return true;
    }
    return false;
  };

  const checkCharacterVoxelCollision = (pos: THREE.Vector3, width: number, height: number) => {
    const halfWidth = width / 2;
    const relativePoints = [
        new THREE.Vector3(-halfWidth, -height / 2 + 0.51, -halfWidth), new THREE.Vector3(halfWidth, -height / 2 + 0.51, -halfWidth),
        new THREE.Vector3(-halfWidth, -height / 2 + 0.51, halfWidth), new THREE.Vector3(halfWidth, -height / 2 + 0.51, halfWidth),
        new THREE.Vector3(-halfWidth, 0, -halfWidth), new THREE.Vector3(halfWidth, 0, -halfWidth),
        new THREE.Vector3(-halfWidth, 0, halfWidth), new THREE.Vector3(halfWidth, 0, halfWidth),
        new THREE.Vector3(-halfWidth, height / 2 - 0.1, -halfWidth), new THREE.Vector3(halfWidth, height / 2 - 0.1, -halfWidth),
        new THREE.Vector3(-halfWidth, height / 2 - 0.1, halfWidth), new THREE.Vector3(halfWidth, height / 2 - 0.1, halfWidth),
    ];
    for (const p of relativePoints) {
        const checkPos = pos.clone().add(p);
        if (isVoxelAt(checkPos.x, checkPos.y, checkPos.z)) return true;
    }
    return false;
  };
  
  const checkRayCollision = (origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number) => {
    const dir = direction.clone().normalize();
    const ray = new THREE.Ray(origin, dir);
    const target = new THREE.Vector3();
    for(let i = 0.5; i < maxDist; i += 0.5) { 
        ray.at(i, target);
        if (isVoxelAt(target.x, target.y, target.z)) {
            const prevTarget = new THREE.Vector3();
            ray.at(i - 0.5, prevTarget);
            const prevVoxelPos = new THREE.Vector3(Math.floor(prevTarget.x), Math.floor(prevTarget.y), Math.floor(prevTarget.z));
            const hitVoxelPos = new THREE.Vector3(Math.floor(target.x), Math.floor(target.y), Math.floor(target.z));
            const normal = prevVoxelPos.sub(hitVoxelPos).normalize();
            return { distance: i, normal };
        }
    }
    return null;
  }
  
  const updateNPC = (delta: number) => {
    if (!state.npc.mesh) return;
    const npc = state.npc;
    const npcMesh = npc.mesh;
    const gravity = -20;
    const SPEED = 3;

    if (npc.isTalking) {
        npc.velocity.x = 0; npc.velocity.z = 0; npc.run_time = 0;
        // Face player while talking
        if (state.player.mesh) {
            const playerPos = state.player.mesh.position;
            npcMesh.lookAt(playerPos.x, npcMesh.position.y, playerPos.z);
        }
    } else {
        if (npc.waypoints.length === 0) {
            npc.velocity.x = 0; npc.velocity.z = 0; npc.run_time = 0;
        } else {
            const distanceToTarget = npcMesh.position.distanceTo(npc.target);
            if (distanceToTarget < 1.0) {
                npc.idleTimer += delta;
                if (npc.idleTimer > Math.random() * 5 + 2) { 
                    npc.idleTimer = 0;
                    npc.currentTargetIndex = (npc.currentTargetIndex + 1) % npc.waypoints.length;
                    if (npc.waypoints.length > 0) {
                        npc.target.copy(npc.waypoints[npc.currentTargetIndex]);
                    }
                }
                npc.velocity.x = 0; npc.velocity.z = 0; npc.run_time = 0;
            } else {
                let moveDirection = new THREE.Vector3().subVectors(npc.target, npcMesh.position).normalize();
                const avoidance = new THREE.Vector3();
                const probeDist = 2.5;
                const npcForward = new THREE.Vector3();
                npcMesh.getWorldDirection(npcForward);
                const whiskers = [
                    npcForward.clone(),
                    npcForward.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)),
                    npcForward.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4)),
                ];
                const npcRayOrigin = npcMesh.position.clone();
                npcRayOrigin.add(new THREE.Vector3(0, npc.height / 4, 0));
                whiskers.forEach(dir => {
                    const hit = checkRayCollision(npcRayOrigin, dir, probeDist);
                    if (hit) {
                        const avoidanceStrength = (probeDist - hit.distance) / probeDist;
                        avoidance.add(hit.normal.clone().multiplyScalar(avoidanceStrength));
                    }
                });
                if (avoidance.lengthSq() > 0.01) {
                    moveDirection.add(avoidance.normalize());
                    moveDirection.normalize();
                }
                const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
                const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
                npcMesh.quaternion.slerp(targetQuaternion, delta * 5.0);
                npc.velocity.x = moveDirection.x * SPEED;
                npc.velocity.z = moveDirection.z * SPEED;
                npc.run_time += delta * 15 * (SPEED / 10);
            }
        }
    }
    npc.velocity.y += gravity * delta;
    const nextPos = npcMesh.position.clone().add(npc.velocity.clone().multiplyScalar(delta));
    npc.isGrounded = false;
    if (npc.velocity.y <= 0) {
        if (isVoxelAt(nextPos.x, nextPos.y - npc.height / 2, nextPos.z)) {
            npc.velocity.y = 0;
            nextPos.y = Math.floor(nextPos.y - npc.height / 2) + 0.5 + npc.height / 2;
            npc.isGrounded = true;
        }
    }
    npcMesh.position.y = nextPos.y;
    const potentialPos = new THREE.Vector3(nextPos.x, npcMesh.position.y, nextPos.z);
    if (!checkCharacterVoxelCollision(potentialPos, npc.width, npc.height)) {
        npcMesh.position.x = potentialPos.x;
        npcMesh.position.z = potentialPos.z;
    } else {
        npc.velocity.x = 0; npc.velocity.z = 0;
    }
    const { armL, armR, legL, legR } = npc.body_parts;
    if (npc.isGrounded && npc.run_time > 0 && !npc.isTalking) {
        armL.rotation.x = Math.sin(npc.run_time) * 0.5; armR.rotation.x = Math.sin(npc.run_time + Math.PI) * 0.5;
        legL.rotation.x = Math.sin(npc.run_time + Math.PI) * 0.7; legR.rotation.x = Math.sin(npc.run_time) * 0.7;
    } else {
        armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
    }
  };
  
  const updateWizard = (delta: number) => {
    if (!state.wizard.mesh || !state.wizard.body_parts.head) return;
    const { armL, armR, legL, legR } = state.wizard.body_parts;
    
    if (state.wizard.shouldFollow && state.player.mesh) {
        // Follow player - move towards them
        const playerPos = state.player.mesh.position;
        const direction = new THREE.Vector3().subVectors(playerPos, state.wizard.mesh.position);
        const distance = direction.length();
        
        if (distance > 2) {
            // Move towards player
            direction.normalize();
            const speed = 3;
            const nextPos = state.wizard.mesh.position.clone().add(direction.multiplyScalar(speed * delta));
            
            // Handle gravity and ground collision
            let targetY = nextPos.y;
            if (isVoxelAt(nextPos.x, nextPos.y - 0.5, nextPos.z)) {
                targetY = Math.floor(nextPos.y) + 1.5;
            } else if (!isVoxelAt(nextPos.x, nextPos.y - 1.5, nextPos.z)) {
                if (isVoxelAt(nextPos.x, nextPos.y - 2.5, nextPos.z)) {
                    targetY = Math.floor(nextPos.y - 1) + 0.5;
                }
            }
            
            state.wizard.mesh.position.x = nextPos.x;
            state.wizard.mesh.position.z = nextPos.z;
            state.wizard.mesh.position.y = THREE.MathUtils.lerp(state.wizard.mesh.position.y, targetY, delta * 5);
            
            // Look at player
            state.wizard.mesh.lookAt(new THREE.Vector3(playerPos.x, state.wizard.mesh.position.y, playerPos.z));
            
            // Walking animation
            const time = state.clock.getElapsedTime() * 10;
            armL.rotation.x = Math.sin(time) * 0.5; armR.rotation.x = Math.sin(time + Math.PI) * 0.5;
            legL.rotation.x = Math.sin(time + Math.PI) * 0.7; legR.rotation.x = Math.sin(time) * 0.7;
        } else {
            // Stop moving when close to player
            armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
            state.wizard.mesh.lookAt(new THREE.Vector3(playerPos.x, state.wizard.mesh.position.y, playerPos.z));
        }
    } else if (state.wizard.isTalking && state.player.mesh) {
        // Stop and face player when talking
        armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
        const playerPos = state.player.mesh.position;
        state.wizard.mesh.lookAt(playerPos.x, state.wizard.mesh.position.y, playerPos.z);
    } else {
        // Idle animation
        const time = state.clock.getElapsedTime();
        armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
        // Fix head rotation to face forward (Math.PI) + oscillation
        state.wizard.body_parts.head.rotation.y = Math.PI + Math.sin(time * 0.5) * 0.3;
        state.wizard.body_parts.armR.rotation.x = -Math.PI / 4 + Math.sin(time * 2) * 0.1;
        state.wizard.body_parts.armR.rotation.z = Math.sin(time * 2) * 0.1;
    }
  };
  
  const updateCustomNPCs = (delta: number) => {
     state.customNpcs.forEach(npc => {
         if (npc.isTalking && state.player.mesh) {
             npc.velocity.set(0,0,0);
             npc.run_time = 0;
             const playerPos = state.player.mesh.position;
             const lookTarget = new THREE.Vector3(playerPos.x, npc.mesh.position.y, playerPos.z);
             npc.mesh.lookAt(lookTarget);
         } else {
             // Basic random wandering
             npc.idleTimer -= delta;
             if (npc.idleTimer <= 0) {
                 npc.idleTimer = Math.random() * 5 + 2;
                 const wanderRadius = 10;
                 const randomOffset = new THREE.Vector3((Math.random() - 0.5) * wanderRadius, 0, (Math.random() - 0.5) * wanderRadius);
                 npc.target.add(randomOffset);
             }
             
             const speed = 2.5;
             const direction = new THREE.Vector3().subVectors(npc.target, npc.mesh.position);
             const dist = direction.length();
             
             if (dist > 1) {
                 direction.normalize();
                 const nextPos = npc.mesh.position.clone().add(direction.multiplyScalar(speed * delta));
                 let targetY = nextPos.y;
                 if (isVoxelAt(nextPos.x, nextPos.y - 0.5, nextPos.z)) targetY = Math.floor(nextPos.y) + 1.5;
                 else if (!isVoxelAt(nextPos.x, nextPos.y - 1.5, nextPos.z)) { if (isVoxelAt(nextPos.x, nextPos.y - 2.5, nextPos.z)) targetY = Math.floor(nextPos.y - 1) + 0.5; }

                 npc.mesh.position.x = nextPos.x;
                 npc.mesh.position.z = nextPos.z;
                 npc.mesh.position.y = THREE.MathUtils.lerp(npc.mesh.position.y, targetY, delta * 5);
                 
                 npc.mesh.lookAt(new THREE.Vector3(npc.target.x, npc.mesh.position.y, npc.target.z));
                 npc.run_time += delta * 10;
             } else {
                 npc.run_time = 0;
             }
         }

         const { armL, armR, legL, legR } = npc.body_parts;
         if (npc.run_time > 0) {
            armL.rotation.x = Math.sin(npc.run_time) * 0.5; armR.rotation.x = Math.sin(npc.run_time + Math.PI) * 0.5;
            legL.rotation.x = Math.sin(npc.run_time + Math.PI) * 0.7; legR.rotation.x = Math.sin(npc.run_time) * 0.7;
         } else {
            armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
         }
     });
  };

  const updateTeller = (delta: number) => {
    if (!state.teller.mesh || !state.teller.body_parts.head) return;
    if (state.teller.isTalking && state.player.mesh) {
        const playerPos = state.player.mesh.position;
        state.teller.mesh.lookAt(playerPos.x, state.teller.mesh.position.y, playerPos.z);
    } else {
        state.teller.body_parts.head.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.4 - Math.PI / 2;
    }
  };
  const updateTeacher = (delta: number) => {
    if (!state.teacher.mesh || !state.teacher.body_parts.head) return;
    if (state.teacher.isTalking && state.player.mesh) {
        const playerPos = state.player.mesh.position;
        state.teacher.mesh.lookAt(playerPos.x, state.teacher.mesh.position.y, playerPos.z);
    } else {
        state.teacher.body_parts.head.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.7) * 0.3 + Math.PI;
    }
  };

  const updateConstructionWorkers = (delta: number) => {
    const SPEED = 4; const BUILD_DELAY = 0.1;
    state.constructionWorkers.forEach(worker => {
        const { armL, armR, legL, legR } = worker.body_parts;
        armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
        if (worker.isPreparing) {
            const dx = worker.target.x - worker.mesh.position.x;
            const dz = worker.target.z - worker.mesh.position.z;
            const distanceToTarget = Math.sqrt(dx * dx + dz * dz);
            if (distanceToTarget > 0.5) {
                const lookTarget = new THREE.Vector3(2 * worker.mesh.position.x - worker.target.x, worker.mesh.position.y, 2 * worker.mesh.position.z - worker.target.z);
                worker.mesh.lookAt(lookTarget);
                const moveDirection = new THREE.Vector3(dx, 0, dz).normalize();
                worker.mesh.position.add(moveDirection.multiplyScalar(SPEED * delta));
                const time = state.clock.getElapsedTime() * 10;
                armL.rotation.x = Math.sin(time) * 0.5; armR.rotation.x = Math.sin(time + Math.PI) * 0.5;
                legL.rotation.x = Math.sin(time + Math.PI) * 0.7; legR.rotation.x = Math.sin(time) * 0.7;
            }
        } else if (worker.isBuilding) {
            if (worker.buildQueue.length > 0) {
                const pos = worker.buildQueue[0].position;
                const nextVoxelPos = new THREE.Vector3(pos[0], pos[1], pos[2]);
                worker.target.copy(nextVoxelPos);
                const distXZ = new THREE.Vector2(worker.mesh.position.x, worker.mesh.position.z).distanceTo(new THREE.Vector2(worker.target.x, worker.target.z));
                if (distXZ > 0.1) {
                    const lookTarget = new THREE.Vector3(2 * worker.mesh.position.x - worker.target.x, worker.mesh.position.y, 2 * worker.mesh.position.z - worker.target.z);
                    worker.mesh.lookAt(lookTarget);
                }
                const time = state.clock.getElapsedTime() * 15;
                armR.rotation.x = -Math.PI / 2 + Math.sin(time) * 0.5; 
                worker.buildCooldown -= delta;
                if (worker.buildCooldown <= 0) {
                    const voxelToBuild = worker.buildQueue.shift();
                    if (voxelToBuild) onAddVoxel([voxelToBuild.position[0], voxelToBuild.position[1], voxelToBuild.position[2]], voxelToBuild.color, 1, voxelToBuild.glow);
                    worker.buildCooldown = BUILD_DELAY;
                }
            } else {
                worker.isBuilding = false; worker.target.copy(worker.mesh.position);
            }
        } else if (worker.isTalking && state.player.mesh) {
             const playerPos = state.player.mesh.position;
             worker.mesh.lookAt(playerPos.x, worker.mesh.position.y, playerPos.z);
        }
    });
  };

  const updatePedestrians = (delta: number) => {
    // Looser spring physics for "ragdoll" effect when hit
    const SPRING_K = 1.5;
    const DAMPING = 0.95;

    state.pedestrians.forEach(ped => {
        if (ped.isTalking) {
            ped.run_time = 0;
            // Face player if talking
            if (state.player.mesh) {
                 const lookTarget = state.player.mesh.position.clone();
                 lookTarget.y = ped.mesh.position.y;
                 ped.mesh.lookAt(lookTarget);
            }
            return;
        }

        if (ped.isFollowingPlayer && state.player.mesh) {
             const playerPos = state.player.mesh.position;
             const dist = ped.mesh.position.distanceTo(playerPos);
             const MIN_DIST = 2.5;
             const FOLLOW_SPEED = 4.5;

             if (dist > MIN_DIST) {
                 const moveDir = new THREE.Vector3().subVectors(playerPos, ped.mesh.position).normalize();
                 const moveStep = moveDir.multiplyScalar(FOLLOW_SPEED * delta);
                 const nextPos = ped.mesh.position.clone().add(moveStep);
                 
                 // Simple terrain check
                 let targetY = ped.mesh.position.y;
                 if (isVoxelAt(nextPos.x, nextPos.y - 0.5, nextPos.z)) {
                      targetY = Math.floor(nextPos.y) + 1.5; 
                 } else if (!isVoxelAt(nextPos.x, nextPos.y - 1.5, nextPos.z)) {
                      if (isVoxelAt(nextPos.x, nextPos.y - 2.5, nextPos.z)) targetY = Math.floor(nextPos.y - 1) + 0.5;
                 }

                 ped.mesh.position.x = nextPos.x;
                 ped.mesh.position.z = nextPos.z;
                 ped.mesh.position.y = THREE.MathUtils.lerp(ped.mesh.position.y, targetY, delta * 5);
                 
                 ped.mesh.lookAt(new THREE.Vector3(playerPos.x, ped.mesh.position.y, playerPos.z));
                 ped.run_time += delta * 10;
             } else {
                 ped.run_time = 0;
                 ped.mesh.lookAt(new THREE.Vector3(playerPos.x, ped.mesh.position.y, playerPos.z));
             }
             
             // Update animation manually for follow mode
             const { armL, armR, legL, legR } = ped.body_parts;
             if (ped.run_time > 0) {
                armL.rotation.x = Math.sin(ped.run_time) * 0.5; armR.rotation.x = Math.sin(ped.run_time + Math.PI) * 0.5;
                legL.rotation.x = Math.sin(ped.run_time + Math.PI) * 0.7; legR.rotation.x = Math.sin(ped.run_time) * 0.7;
            } else {
                armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
            }
            return; // Skip regular path logic
        }
        
        const pathLength = ped.path.getLength();
        if (pathLength > 0) {
            const progressDelta = (ped.speed / pathLength) * delta;
            ped.progress += progressDelta;

            let reachedEnd = false;
            if (ped.speed > 0 && ped.progress >= 1) {
                ped.progress = 1;
                reachedEnd = true;
            } else if (ped.speed < 0 && ped.progress <= 0) {
                ped.progress = 0;
                reachedEnd = true;
            }

            if (reachedEnd) {
                const currentPos = ped.mesh.position.clone();
                const SEARCH_RADIUS = 40; 
                
                // Find candidate paths
                const candidates: { path: THREE.CatmullRomCurve3, startT: number, dist: number }[] = [];
                
                state.sidewalkPaths.forEach(path => {
                    if (path === ped.path) return;
                    const pStart = path.getPointAt(0);
                    const pEnd = path.getPointAt(1);
                    const distStart = currentPos.distanceTo(pStart);
                    const distEnd = currentPos.distanceTo(pEnd);
                    
                    if (distStart < SEARCH_RADIUS) candidates.push({ path, startT: 0, dist: distStart });
                    if (distEnd < SEARCH_RADIUS) candidates.push({ path, startT: 1, dist: distEnd });
                });

                if (candidates.length > 0) {
                    const choice = pickRandom(candidates);
                    // Crosswalk logic: if dist > 2, create a bridge
                    if (choice.dist > 2) {
                        const bridgePath = new THREE.CatmullRomCurve3([currentPos.clone(), choice.path.getPointAt(choice.startT)]);
                        ped.path = bridgePath;
                        ped.progress = 0;
                        ped.speed = Math.abs(ped.speed); // Always forward on bridge
                    } else {
                        ped.path = choice.path;
                        ped.progress = choice.startT;
                        ped.speed = choice.startT === 0 ? Math.abs(ped.speed) : -Math.abs(ped.speed);
                    }
                } else {
                    ped.speed *= -1;
                }
            }
            
            // Path Following with Physics Offset
            const pathPosition = ped.path.getPointAt(ped.progress);

            // Spring physics to pull offset back to 0
            const springForce = ped.offset.clone().multiplyScalar(-SPRING_K);
            ped.displacementVelocity.add(springForce.multiplyScalar(delta));
            ped.displacementVelocity.multiplyScalar(DAMPING);
            ped.offset.add(ped.displacementVelocity.clone().multiplyScalar(delta));

            const newPosition = pathPosition.clone().add(ped.offset);
            // Add height if they were launched up
            if (ped.offset.y < 0) ped.offset.y = 0; // Basic ground collision
            ped.mesh.position.copy(newPosition);

            const lookDelta = 0.05 * Math.sign(ped.speed);
            const lookAtT = Math.max(0, Math.min(1, ped.progress + lookDelta));
            const lookAtPathPos = ped.path.getPointAt(lookAtT);
            // Blend lookAt between path direction and offset direction slightly for realism?
            // For now, looking along path + offset is stable.
            const lookAtTarget = lookAtPathPos.clone().add(ped.offset);
            if (lookAtTarget.distanceTo(newPosition) > 0.1) ped.mesh.lookAt(lookAtTarget);
        }
        
        ped.run_time += delta * 10 * Math.abs(ped.speed / 4);
        const { armL, armR, legL, legR } = ped.body_parts;
        if (ped.run_time > 0) {
            armL.rotation.x = Math.sin(ped.run_time) * 0.5; armR.rotation.x = Math.sin(ped.run_time + Math.PI) * 0.5;
            legL.rotation.x = Math.sin(ped.run_time + Math.PI) * 0.7; legR.rotation.x = Math.sin(ped.run_time) * 0.7;
        } else {
            armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
        }
    });
  };
  
  const updateCarProximityCheck = () => {
    if (!state.player.mesh || state.player.isInCar) {
        onCarProximityChange(false); state.closestDrivableCar = null; return;
    }
    const PROXIMITY_RADIUS = 6;
    let closestCar: THREE.Group | null = null;
    let minDistance = PROXIMITY_RADIUS;
    state.drivableCars.forEach(car => {
        const distance = state.player.mesh.position.distanceTo(car.mesh.position);
        if (distance < minDistance) { minDistance = distance; closestCar = car.mesh; }
    });
    state.closestDrivableCar = closestCar;
    onCarProximityChange(!!closestCar);
  };

  const updateNpcProximityCheck = () => {
    if (!state.player.mesh || state.player.isInCar || isFreeCameraRef.current) {
        if (lastNearestNpcId.current !== null) {
            onNearestNpcChange(null);
            lastNearestNpcId.current = null;
        }
        return;
    }
    
    const PROXIMITY_RADIUS = 3.5;
    let closestNpc: { id: string | number, name: string, type: string, persona: string, dist: number } | null = null;
    let minDistance = PROXIMITY_RADIUS;

    const check = (mesh: THREE.Group, id: string | number, name: string, type: string, persona: string) => {
        const dist = state.player.mesh.position.distanceTo(mesh.position);
        if (dist < minDistance) {
            minDistance = dist;
            closestNpc = { id, name, type, persona, dist };
        }
    };

    if (state.npc.mesh) check(state.npc.mesh, 'chef', 'Luigi', 'chef', 'You are Luigi, a passionate Italian pizza chef. You love making pizzas and talking about food. You are friendly and enthusiastic.');
    if (state.teller.mesh) check(state.teller.mesh, 'teller', 'Sarah', 'teller', 'You are Sarah, a professional bank teller. You are efficient, polite, and helpful with financial transactions.');
    if (state.teacher.mesh) check(state.teacher.mesh, 'teacher', 'Mrs. Crabtree', 'teacher', 'You are Mrs. Crabtree, a strict but knowledgeable school teacher. You love educating students and maintaining order.');
    if (state.wizard.mesh) check(state.wizard.mesh, 'wizard', 'Magnus', 'wizard', 'You are Magnus, a powerful but slightly eccentric wizard. You can summon new people using your magic wand. If the user describes a person with specific details like clothing or colors, call the "spawnCustomNPC" tool with those exact parameters. If they want the person holding something (sword, wand, staff, axe, gun, shield, flower, torch) use "heldProp". If they want something on their back (wings, cape, backpack, quiver, jetpack) use "backProp". You can also conjure objects into existence using your magic wand. If the user asks to spawn, create, or conjure an object (like "spawn a car" or "create a tree"), call the "spawnObject" tool with a description.');
    state.constructionWorkers.forEach(w => { check(w.mesh, w.id, w.name, 'worker', w.persona); });
    state.pedestrians.forEach(p => { check(p.mesh, p.id, p.name, 'pedestrian', p.persona); });
    state.customNpcs.forEach(c => { check(c.mesh, c.id, c.name, 'custom', c.persona); });

    if (closestNpc) {
        if (lastNearestNpcId.current !== closestNpc.id) {
            onNearestNpcChange({ id: closestNpc.id, name: closestNpc.name, type: closestNpc.type as any, persona: closestNpc.persona });
            lastNearestNpcId.current = closestNpc.id;
        }
    } else {
        if (lastNearestNpcId.current !== null) {
            onNearestNpcChange(null);
            lastNearestNpcId.current = null;
        }
    }
  };
  
  const updateForSaleProximityCheck = () => {
    if (!state.player.mesh || state.player.isInCar || isFreeCameraRef.current) {
        onForSaleProximityChange(false, null); return;
    }
    const PROXIMITY_RADIUS = 8;
    let closestSign: THREE.Vector3 | null = null;
    let minDistance = PROXIMITY_RADIUS;
    state.forSaleSigns.forEach(signPos => {
        const distance = state.player.mesh.position.distanceTo(signPos);
        if (distance < minDistance) { minDistance = distance; closestSign = signPos; }
    });
    if (closestSign) onForSaleProximityChange(true, [closestSign.x, closestSign.y, closestSign.z]);
    else onForSaleProximityChange(false, null);
  };

  const updateItemProximityCheck = () => {
    if (!state.player.mesh || state.player.isInCar || isFreeCameraRef.current) {
        onItemProximityChange(false); return;
    }
    const PROXIMITY_RADIUS = 3;
    let isNear = false;
    for (const item of state.placedItems) {
        if (state.player.mesh.position.distanceTo(item.mesh.position) < PROXIMITY_RADIUS) { isNear = true; break; }
    }
    onItemProximityChange(isNear);
  };

  const updatePlayer = (delta: number) => {
    if (!state.player.mesh || !state.player.body_parts.head) return;
    const player = state.player; const playerMesh = player.mesh;
    const gravity = -20;
    
    const WALK_SPEED = 4;
    const SPRINT_SPEED = 12;
    const SPRINT_THRESHOLD = 0.85;
    
    let currentSpeed = WALK_SPEED;
    if (movementMagnitude > SPRINT_THRESHOLD && currentStamina > 0) {
      currentSpeed = SPRINT_SPEED;
      const staminaDepleteRate = (20 / 60) * delta;
      onStaminaChange(-staminaDepleteRate);
    } else if (movementMagnitude > 0.1 && movementMagnitude <= SPRINT_THRESHOLD) {
      const speedFactor = Math.pow(movementMagnitude / SPRINT_THRESHOLD, 2);
      currentSpeed = WALK_SPEED + (SPRINT_SPEED - WALK_SPEED) * speedFactor;
    }
    
    const SPEED = currentSpeed;
    const CAR_SPEED = 15; 
    const CAR_TURN_SPEED = 1.5;

    if (player.isInCar && player.currentCar) {
        const car = state.drivableCars.find(c => c.mesh === player.currentCar);
        if (car) {
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.mesh.quaternion);
            const moveZ = -movement.y; const moveX = movement.x; 
            const acceleration = new THREE.Vector3();
            if (moveZ > 0) acceleration.add(forward.clone().multiplyScalar(CAR_SPEED * moveZ));
            else if (moveZ < 0) acceleration.add(forward.clone().multiplyScalar(CAR_SPEED * 0.5 * moveZ)); 
            
            car.velocity.add(acceleration.multiplyScalar(delta));
            
            car.steering = THREE.MathUtils.lerp(car.steering, moveX * CAR_TURN_SPEED, delta * 5);
            const speedFactor = Math.min(car.velocity.length() / 5, 3.0);
            car.mesh.rotation.y -= car.steering * delta * speedFactor;
        }
        return;
    }

    if (isFreeCameraRef.current) {
        player.velocity.x = 0; player.velocity.z = 0; player.run_time = 0;
    } else {
        if (movementMagnitude > 0.1) {
            state.manualCameraControl = false;
        }
        const forward = new THREE.Vector3();
        state.camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward);
        const moveDirection = new THREE.Vector3();
        moveDirection.add(forward.multiplyScalar(-movement.y));
        moveDirection.add(right.multiplyScalar(-movement.x)); 

        if (moveDirection.length() > 0.01) {
            moveDirection.normalize();
            const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
            const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
            playerMesh.quaternion.slerp(targetQuaternion, delta * 10.0);
            player.velocity.x = moveDirection.x * SPEED; player.velocity.z = moveDirection.z * SPEED;
            player.run_time += delta * 15 * (SPEED / 10);
        } else {
            player.velocity.x = 0; player.velocity.z = 0; player.run_time = 0;
        }
    }
    
    player.velocity.y += gravity * delta;
    const nextPos = playerMesh.position.clone().add(player.velocity.clone().multiplyScalar(delta));
    const halfWidth = player.width / 2; const height = player.height;
    player.isGrounded = false;

    if (player.velocity.y <= 0) {
        const checkPoints = [[0, 0], [-halfWidth, -halfWidth], [halfWidth, -halfWidth], [-halfWidth, halfWidth], [halfWidth, halfWidth]];
        for (const [dx, dz] of checkPoints) {
            if (isVoxelAt(nextPos.x + dx, nextPos.y - height / 2, nextPos.z + dz)) {
                player.velocity.y = 0;
                nextPos.y = Math.floor(nextPos.y - height / 2) + 0.5 + height / 2;
                player.isGrounded = true;
                break;
            }
        }
    }
    playerMesh.position.y = nextPos.y;

    // Helper for collision + step up logic
    const attemptMove = (targetX: number, targetZ: number) => {
        const currentY = playerMesh.position.y;
        const targetVec = new THREE.Vector3(targetX, currentY, targetZ);
        
        // 1. Check direct movement (Walking on flat ground)
        if (!checkCharacterVoxelCollision(targetVec, player.width, player.height)) {
            playerMesh.position.x = targetX;
            playerMesh.position.z = targetZ;
            return true;
        }

        // 2. Check step up (Walking up stairs)
        // Only allow stepping up if grounded.
        if (player.isGrounded) {
             // Check if we can step up 1 block. 
             // We add 1.1 to Y to ensure we are checking the space above the block we collided with.
             const stepUpVec = new THREE.Vector3(targetX, currentY + 1.0, targetZ);
             if (!checkCharacterVoxelCollision(stepUpVec, player.width, player.height)) {
                 playerMesh.position.x = targetX;
                 playerMesh.position.z = targetZ;
                 playerMesh.position.y += 1.0; // Snap up 1 block
                 return true;
             }
        }
        return false;
    };

    if (!attemptMove(nextPos.x, nextPos.z)) {
         // Try Slide X
         if (!attemptMove(nextPos.x, playerMesh.position.z)) {
             // Try Slide Z
             attemptMove(playerMesh.position.x, nextPos.z);
         }
    }
    
    const { armL, armR, legL, legR } = player.body_parts;
    if (player.isGrounded) {
        if (player.run_time > 0) {
            armL.rotation.x = Math.sin(player.run_time) * 0.5; armR.rotation.x = Math.sin(player.run_time + Math.PI) * 0.5;
            legL.rotation.x = Math.sin(player.run_time + Math.PI) * 0.7; legR.rotation.x = Math.sin(player.run_time) * 0.7;
        } else {
            armL.rotation.x = 0; armR.rotation.x = 0; legL.rotation.x = 0; legR.rotation.x = 0;
        }
    }
  };

  const updateCamera = (delta: number) => {
    const camera = state.camera; const target = state.cameraTarget; const orbit_angle = state.orbit_angle;
    if (isFreeCameraRef.current && state.freeCamera.isInitialized) {
        // Free camera movement logic
        const moveSpeed = 15 * delta;
        const yaw = state.orbit_angle.y;
        const forwardDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const rightDir = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

        if (Math.abs(movement.y) > 0.01) {
            state.freeCamera.pivot.add(forwardDir.clone().multiplyScalar(-movement.y * moveSpeed));
        }
        if (Math.abs(movement.x) > 0.01) {
             state.freeCamera.pivot.add(rightDir.clone().multiplyScalar(movement.x * moveSpeed));
        }

        const pivot = state.freeCamera.pivot; const zoom = state.freeCamera.zoom;
        const orbitPos = new THREE.Vector3(Math.sin(orbit_angle.y) * Math.cos(orbit_angle.x), Math.sin(orbit_angle.x), Math.cos(orbit_angle.y) * Math.cos(orbit_angle.x));
        camera.position.copy(pivot).add(orbitPos.multiplyScalar(zoom));
        camera.lookAt(pivot);
    } else if (state.player.isInCar && state.player.currentCar) {
        const car = state.player.currentCar; const carPos = car.position;
        const zoom = 10; 
        const carRotationY = car.rotation.y;
        const relativeYaw = orbit_angle.y;
        const absoluteYaw = carRotationY + relativeYaw;
        const pitch = orbit_angle.x;

        const offsetX = Math.sin(absoluteYaw) * Math.cos(pitch) * zoom;
        const offsetY = Math.sin(pitch) * zoom;
        const offsetZ = Math.cos(absoluteYaw) * Math.cos(pitch) * zoom;

        const cameraPos = carPos.clone().add(new THREE.Vector3(0, 2, 0)).add(new THREE.Vector3(offsetX, offsetY, offsetZ));
        const targetPos = carPos.clone().add(new THREE.Vector3(0, 1, 0));
        
        camera.position.lerp(cameraPos, delta * 5);
        target.lerp(targetPos, delta * 10);
        camera.lookAt(target);
    } else {
        const playerPos = state.player.mesh.position; const zoom = 6;
        
        // Camera always faces player's back - positioned 180 degrees behind player's rotation
        // Extract Y rotation from quaternion (player uses quaternions, not rotation.y)
        const euler = new THREE.Euler().setFromQuaternion(state.player.mesh.quaternion, 'YXZ');
        const playerRotationY = euler.y;
        const targetCameraAngle = playerRotationY + Math.PI; // 180 degrees behind player
        
        // Only auto-rotate if manual camera control is NOT active
        if (!state.manualCameraControl) {
            // Smoothly interpolate using shortest circular path
            const lerpFactor = Math.min(delta * 5, 1);
            const angleDiff = Math.atan2(Math.sin(targetCameraAngle - orbit_angle.y), Math.cos(targetCameraAngle - orbit_angle.y));
            orbit_angle.y += angleDiff * lerpFactor;
        }
        
        const orbitPos = new THREE.Vector3(Math.sin(orbit_angle.y) * Math.cos(orbit_angle.x), Math.sin(orbit_angle.x), Math.cos(orbit_angle.y) * Math.cos(orbit_angle.x));
        const cameraPos = playerPos.clone().add(orbitPos.multiplyScalar(zoom));
        const targetPos = playerPos.clone().add(new THREE.Vector3(0, 1.5, 0));
        
        // When in manual control, set camera directly instead of lerping (prevents snapping back)
        if (state.manualCameraControl) {
            camera.position.copy(cameraPos);
            target.copy(targetPos);
        } else {
            camera.position.lerp(cameraPos, delta * 10);
            target.lerp(targetPos, delta * 10);
        }
        camera.lookAt(target);
    }
  };

  const updateTargetBlock = () => {
    if (state.player.isInCar) { state.targetBlock = null; state.highlighter.visible = false; return; }
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), state.camera);
    const instancedMesh = state.instancedMesh;
    if (!instancedMesh) { state.targetBlock = null; state.highlighter.visible = false; return; };
    const intersections = raycaster.intersectObject(instancedMesh);
    if (intersections.length > 0) {
        const intersection = intersections[0];
        
        // In normal mode, limit interaction distance to prevent building too far
        if (!isFreeCameraRef.current && intersection.distance > 12) {
            state.targetBlock = null; state.highlighter.visible = false; return;
        }

        const instanceId = intersection.instanceId;
        if (typeof instanceId === 'number') {
            const matrix = new THREE.Matrix4();
            instancedMesh.getMatrixAt(instanceId, matrix);
            const position = new THREE.Vector3().setFromMatrixPosition(matrix);
            const normal = intersection.face?.normal.clone().transformDirection(instancedMesh.matrixWorld).round();
            if (normal && voxels[instanceId]) {
                state.targetBlock = { id: voxels[instanceId].id, position: position, normal: normal };
                state.highlighter.position.copy(position);
                state.highlighter.scale.set(selectedSize, selectedSize, selectedSize);
                state.highlighter.visible = true;
            } else { state.targetBlock = null; state.highlighter.visible = false; }
        } else { state.targetBlock = null; state.highlighter.visible = false; }
    } else { state.targetBlock = null; state.highlighter.visible = false; }
  };

  const updateDrivableCars = (delta: number) => {
    state.drivableCars.forEach(car => {
        // Physics for all drivable cars, including the one the player is driving
        car.velocity.multiplyScalar(1 - 1.0 * delta); // Reduced drag from 3 to 1
        car.steering *= 0.9; // Return to center
        
        // Calculate potential next position
        const nextPos = car.mesh.position.clone().add(car.velocity.clone().multiplyScalar(delta));
        
        // Check for world collision with updated robust check
        if (checkCarWorldCollision(nextPos, car.mesh.quaternion)) {
             // Simple bounce collision response
             car.velocity.multiplyScalar(-0.3);
        } else {
            car.mesh.position.copy(nextPos);
        }
        
        const carPos = car.mesh.position;
        let groundY = -1;
        if (isVoxelAt(carPos.x, carPos.y - 1, carPos.z)) groundY = Math.floor(carPos.y - 1) + 0.5;
        car.mesh.position.y = THREE.MathUtils.lerp(car.mesh.position.y, groundY + 1.0, delta * 10);

        // Interact with pedestrians
        state.pedestrians.forEach(ped => {
            const dist = car.mesh.position.distanceTo(ped.mesh.position);
            if (dist < 5.0) { // Increased interaction radius
                const pushDir = new THREE.Vector3().subVectors(ped.mesh.position, car.mesh.position).normalize();
                // Add impulse to pedestrian
                ped.displacementVelocity.add(pushDir.multiplyScalar(60)); // Strong push
                // Add vertical pop for fun
                ped.displacementVelocity.y += 5;
            }
        });
    });
  };

  const updateCarCollisions = () => {
      const COLLISION_RADIUS = 2.5;
      // Collect all cars into a unified list with their physics data
      const allCars = [
          ...state.cars.map(c => ({ type: 'npc' as const, data: c, pos: c.mesh.position, vel: c.displacementVelocity })),
          ...state.drivableCars.map(c => ({ type: 'drivable' as const, data: c, pos: c.mesh.position, vel: c.velocity }))
      ];

      for (let i = 0; i < allCars.length; i++) {
          for (let j = i + 1; j < allCars.length; j++) {
              const carA = allCars[i];
              const carB = allCars[j];
              const dist = carA.pos.distanceTo(carB.pos);

              if (dist < COLLISION_RADIUS * 2) {
                  // Collision detected
                  const normal = new THREE.Vector3().subVectors(carA.pos, carB.pos).normalize();
                  if (normal.lengthSq() === 0) normal.set(1, 0, 0); // Handle exact overlap

                  const overlap = COLLISION_RADIUS * 2 - dist;
                  const separation = normal.clone().multiplyScalar(overlap * 0.5);

                  // Separate cars
                  if (carA.type === 'npc') {
                      (carA.data as any).offset.add(separation);
                  } else {
                       carA.data.mesh.position.add(separation);
                  }

                  if (carB.type === 'npc') {
                      (carB.data as any).offset.sub(separation);
                  } else {
                      carB.data.mesh.position.sub(separation);
                  }

                  // Elastic Bounce
                  const relativeVel = new THREE.Vector3().subVectors(carA.vel, carB.vel);
                  const speed = relativeVel.dot(normal);

                  if (speed < 0) {
                      // Moving towards each other
                      const restitution = 0.8; // Bounciness
                      const impulse = normal.clone().multiplyScalar(speed * -(1 + restitution) * 0.5);
                      
                      // Apply impulse to velocities
                      carA.vel.add(impulse);
                      carB.vel.sub(impulse);
                  }
              }
          }
      }
  };

  useEffect(() => {
    if (state.scene && state.renderer) createPlayer(characterCustomization);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterCustomization, state.renderer]);


  useEffect(() => {
    isFreeCameraRef.current = isFreeCamera;
    showCarsRef.current = showCars;
    showPedestriansRef.current = showPedestrians;
    if (state.gridHelper) state.gridHelper.visible = isFreeCamera;
  }, [isFreeCamera, showCars, showPedestrians, state.gridHelper]);

  const prevIsFreeCamera = useRef(isFreeCamera);
  useEffect(() => {
      if (isFreeCamera && !prevIsFreeCamera.current) {
          state.freeCamera.pivot.copy(state.player.mesh.position);
          state.freeCamera.zoom = 12; // Reset zoom
          state.freeCamera.isInitialized = true;
      }
      prevIsFreeCamera.current = isFreeCamera;
  }, [isFreeCamera, state]);
  
  useEffect(() => {
      if (!state.scene) return;
      state.scene.background = new THREE.Color(worldTheme.skyColor);
      state.scene.fog = new THREE.Fog(worldTheme.fogColor, 48, 120);
      if (state.ambientLight) state.ambientLight.color.set(worldTheme.ambientLightColor);
      if (state.directionalLight) state.directionalLight.color.set(worldTheme.directionalLightColor);
  }, [worldTheme]);

  useEffect(() => {
      state.isGlowEnabled = isGlowEnabled;
  }, [isGlowEnabled]);

  const detectGreenAreaBounds = (centerX: number, centerZ: number): { minX: number, maxX: number, minZ: number, maxZ: number, valid: boolean } => {
    const groundY = -1;
    const maxPlotWidth = 100;
    const maxPlotDepth = 100;
    
    const normalizeColor = (color: string): string => color.toLowerCase().trim();
    const grassColors = new Set([
      normalizeColor('#567d46'),
      normalizeColor('#679457'),
      normalizeColor(worldTheme.grassColor)
    ]);
    
    const isGreenVoxel = (x: number, z: number): boolean => {
      const key = `${Math.floor(x)},${groundY},${Math.floor(z)}`;
      const voxel = state.voxelMap.get(key);
      if (!voxel) return false;
      return grassColors.has(normalizeColor(voxel.color));
    };
    
    const startX = Math.floor(centerX);
    const startZ = Math.floor(centerZ);
    
    if (!isGreenVoxel(startX, startZ)) {
      console.warn("Worker not on green area, using fallback 13x13");
      return { minX: startX - 6, maxX: startX + 6, minZ: startZ - 6, maxZ: startZ + 6, valid: false };
    }
    
    const visited = new Set<string>();
    const queue: [number, number][] = [[startX, startZ]];
    visited.add(`${startX},${startZ}`);
    
    let minX = startX, maxX = startX, minZ = startZ, maxZ = startZ;
    
    while (queue.length > 0) {
      const [x, z] = queue.shift()!;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      
      const width = maxX - minX + 1;
      const depth = maxZ - minZ + 1;
      if (width > maxPlotWidth || depth > maxPlotDepth) {
        console.warn(`Plot dimensions exceeded maximum (${width}x${depth} > ${maxPlotWidth}x${maxPlotDepth}), aborting detection`);
        return { minX: startX - 6, maxX: startX + 6, minZ: startZ - 6, maxZ: startZ + 6, valid: false };
      }
      
      const neighbors = [[x+1, z], [x-1, z], [x, z+1], [x, z-1]];
      for (const [nx, nz] of neighbors) {
        const key = `${nx},${nz}`;
        if (!visited.has(key) && isGreenVoxel(nx, nz)) {
          visited.add(key);
          queue.push([nx, nz]);
        }
      }
    }
    
    const width = maxX - minX + 1;
    const depth = maxZ - minZ + 1;
    
    console.log(`Detected green area: ${width}x${depth} (X: ${minX} to ${maxX}, Z: ${minZ} to ${maxZ})`);
    return { minX, maxX, minZ, maxZ, valid: true };
  };

  const startGenerativeBuild = async (prompt: string, signPosition: [number, number, number]) => {
    if (!state.gemini.ai) return;
    onCashChange(-500);
    const plotCenter = new THREE.Vector3(...signPosition);
    let closestWorker = null; let minDistance = Infinity;
    state.constructionWorkers.forEach(worker => {
        const distance = worker.mesh.position.distanceTo(plotCenter);
        if (!worker.isBuilding && !worker.isPreparing) {
             if (distance < minDistance) { minDistance = distance; closestWorker = worker; }
        }
    });
    if (!closestWorker) { console.warn("No available construction workers."); return; }
    closestWorker.isPreparing = true; closestWorker.target.copy(plotCenter);
    
    const bounds = detectGreenAreaBounds(plotCenter.x, plotCenter.z);
    
    if (!bounds.valid) {
      console.error("Failed to detect valid green area. Construction worker cannot build here.");
      closestWorker.isPreparing = false;
      return;
    }
    
    const plotWidth = bounds.maxX - bounds.minX + 1;
    const plotDepth = bounds.maxZ - bounds.minZ + 1;
    const plotOriginX = bounds.minX;
    const plotOriginZ = bounds.minZ;
    
    console.log(`Starting build on ${plotWidth}x${plotDepth} plot at origin (${plotOriginX}, ${plotOriginZ})`);
    
    const signVoxelsToRemove: [number, number, number][] = [];
    for (let x = -2; x <= 2; x++) { for (let y = 1; y <= 6; y++) { signVoxelsToRemove.push([plotCenter.x + x, plotCenter.y + y, plotCenter.z]); signVoxelsToRemove.push([plotCenter.x, plotCenter.y + y, plotCenter.z + x]); } }
    onRemoveVoxels(signVoxelsToRemove);
    state.forSaleSigns = state.forSaleSigns.filter(s => !s.equals(plotCenter));

    try {
        const response = await state.gemini.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an expert voxel architect. Generate a JSON array of voxels for the following request: "${prompt}".
            
            **Building Constraints & Guide:**
            1.  **Plot**: ${plotWidth}x${plotDepth} area. Coordinates must be:
                - X: 0 to ${plotWidth - 1}
                - Z: 0 to ${plotDepth - 1}
                - Y: 0 and up (ground level is 0, max height 30)
            2.  **Scale**: Build large, impressive, life-size structures. Don't build miniatures. A character is 2 blocks tall.
            3.  **CRITICAL - Use the ENTIRE plot area:**
                -   **For buildings, shops, towers, houses:** Spread the structure across the FULL ${plotWidth}x${plotDepth} area from X:0 to X:${plotWidth - 1} and Z:0 to Z:${plotDepth - 1}. Make it large and expansive, not a tiny structure in the middle.
                -   **For parks, gardens, playgrounds:** Fill the ENTIRE ${plotWidth}x${plotDepth} area with trees, paths, benches, flowers, playground equipment, etc. Don't leave the plot mostly empty.
                -   **Single objects (one tree, one obelisk, one statue):** These can be smaller and centered, but for multiple objects or structures, USE THE FULL AREA.
            4.  **Ground Integration**:
                -   The world already has a grass floor at Y=-1.
                -   **If building a structure (house, shop, tower):** Build a foundation/floor at Y=0.
                -   **If building a park/nature/outdoor area:** Do NOT build a solid base layer of grass at Y=0. Place objects (trees, paths, benches) directly at Y=0 so they sit on the existing world ground. Avoid creating a raised platform effect.
            5.  **Style**: Detailed, vibrant, and structurally sound.
            
            Return ONLY the JSON array of voxels. Remember: coordinates are 0-indexed with X from 0 to ${plotWidth - 1}, Z from 0 to ${plotDepth - 1}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            position: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: `The [x, y, z] coordinates. X: 0 to ${plotWidth - 1}, Z: 0 to ${plotDepth - 1}, Y: 0 and up` },
                            color: { type: Type.STRING, description: "Hex color code" }
                        },
                        required: ["position", "color"]
                    }
                },
            },
        });
        const jsonStr = response.text.trim();
        const generatedVoxels = JSON.parse(jsonStr);
        if (Array.isArray(generatedVoxels)) {
            const worldVoxels = generatedVoxels
              .map((v: any) => ({ 
                position: [
                  v.position[0] + plotOriginX,
                  v.position[1] + plotCenter.y + 1,
                  v.position[2] + plotOriginZ
                ], 
                color: v.color 
              }))
              .filter((v: any) => {
                const [x, y, z] = v.position;
                return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
              })
              .sort((a, b) => { if (a.position[1] !== b.position[1]) return a.position[1] - b.position[1]; if (a.position[0] !== b.position[0]) return a.position[0] - b.position[0]; return a.position[2] - b.position[2]; });
            closestWorker.isPreparing = false; closestWorker.isBuilding = true; closestWorker.buildQueue = worldVoxels;
            if (worldVoxels.length > 0) closestWorker.target.set(...worldVoxels[0].position); else closestWorker.isBuilding = false;
        } else { closestWorker.isPreparing = false; }
    } catch (error) { console.error("Error generating building with Gemini:", error); if (closestWorker) closestWorker.isPreparing = false; }
  };

  const spawnGenerativeObject = async (prompt: string) => {
    if (!state.gemini.ai || !state.wizard.mesh) return;
    
    // Spawn 4 units in front of wizard
    const wizardPos = state.wizard.mesh.position;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(state.wizard.mesh.quaternion);
    const spawnPos = wizardPos.clone().add(forward.multiplyScalar(4));
    
    // Find ground level
    let groundY = -Infinity;
    const sx = Math.round(spawnPos.x);
    const sz = Math.round(spawnPos.z);
    // Scan down from above the wizard's head to find ground
    for(let y=Math.ceil(wizardPos.y)+5; y >= -5; y--) {
        if(isVoxelAt(sx, y, sz)) {
            groundY = y;
            break;
        }
    }
    if (groundY === -Infinity) groundY = -1; // Default to ground level if not found

    try {
        const response = await state.gemini.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a voxel model for: "${prompt}".
            Return a JSON array.
            The model should fit in a 10x10x10 grid.
            Voxels should be relative to [0,0,0] (bottom center).
            Important: The object must be oriented upright with the Y axis pointing up. The object should be designed to sit on the ground (Y=0). The lowest point of the object must be at Y=0. Do not generate voxels below Y=0.
            Schema: Array<{position: [x, y, z], color: string}>.
            Ensure colors are hex strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            position: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                            color: { type: Type.STRING }
                        },
                        required: ["position", "color"]
                    }
                }
            }
        });

        const data = JSON.parse(response.text);
        if (Array.isArray(data)) {
            const voxelsToAdd = data.map((v: any) => ({
                position: [
                    sx + v.position[0],
                    groundY + 1 + v.position[1], // groundY is top of ground block, +1 starts object
                    sz + v.position[2]
                ] as [number, number, number],
                color: v.color
            }));
            onAddVoxels(voxelsToAdd);
        }
    } catch (e) {
        console.error("Error spawning object:", e);
    }
  };

  const performUndo = () => {
    if (undoStackRef.current.length === 0) {
      console.log('Undo: stack empty');
      return;
    }
    
    const action = undoStackRef.current.pop();
    console.log('Undo: popped action:', action);
    if (!action) return;
    
    if (action.type === 'add') {
        // Handle both single voxel and multiple voxels from drag
        if (action.voxels) {
            console.log('Undo: removing', action.voxels.length, 'dragged voxels');
            action.voxels.forEach((v: any) => {
                // Use stored voxel ID if available (drag voxels), otherwise lookup by position (tap/button)
                const voxelId = v.voxelId || state.voxelMap.get(`${v.position[0]},${v.position[1]},${v.position[2]}`)?.id;
                console.log('Undo: removing voxel id', voxelId);
                if (voxelId) onRemoveVoxel(voxelId);
            });
        } else {
            // Single voxel from build button
            console.log('Undo: removing single voxel at', action.position);
            const voxelData = state.voxelMap.get(`${action.position[0]},${action.position[1]},${action.position[2]}`);
            if (voxelData) onRemoveVoxel(voxelData.id);
        }
    } else if (action.type === 'remove') {
        onAddVoxel(action.position as [number, number, number], action.color, action.size, action.glow);
    }
    
    redoStackRef.current.push(action);
  };

  const performRedo = () => {
    if (redoStackRef.current.length === 0) return;
    
    const action = redoStackRef.current.pop();
    if (!action) return;
    
    if (action.type === 'add') {
        // Handle both single voxel and multiple voxels from drag
        if (action.voxels) {
            console.log('Redo: restoring', action.voxels.length, 'dragged voxels');
            action.voxels.forEach((v: any) => {
                onAddVoxel(v.position as [number, number, number], v.color, v.size, v.glow);
            });
        } else {
            // Single voxel from build button
            console.log('Redo: restoring single voxel');
            onAddVoxel(action.position as [number, number, number], action.color, action.size, action.glow);
        }
    } else if (action.type === 'remove') {
        onRemoveVoxel(action.voxelId);
    }
    
    undoStackRef.current.push(action);
  };

  useImperativeHandle(ref, () => ({
    build: () => { 
      if (state.targetBlock) { 
        const { position, normal } = state.targetBlock;
        const rawPos = new THREE.Vector3().copy(position).add(normal.clone().multiplyScalar(selectedSize));
        const newPosition: [number, number, number] = [
          snapToGrid(rawPos.x, selectedSize),
          snapToGrid(rawPos.y, selectedSize),
          snapToGrid(rawPos.z, selectedSize)
        ];
        onAddVoxel(newPosition, selectedColor, selectedSize, state.isGlowEnabled);
        undoStackRef.current.push({ type: 'add', position: newPosition, color: selectedColor, size: selectedSize, glow: state.isGlowEnabled });
        redoStackRef.current = [];
      }
    },
    destroy: () => { 
      if (state.targetBlock) {
        const voxelData = state.voxelMap.get(`${state.targetBlock.position.x},${state.targetBlock.position.y},${state.targetBlock.position.z}`);
        if (voxelData) {
          undoStackRef.current.push({ type: 'remove', position: [state.targetBlock.position.x, state.targetBlock.position.y, state.targetBlock.position.z], color: voxelData.color, size: voxelData.size, glow: voxelData.glow, voxelId: voxelData.id });
          redoStackRef.current = [];
          onRemoveVoxel(state.targetBlock.id);
        }
      }
    },
    undo: performUndo,
    redo: performRedo,
    jump: () => { if (state.player.isGrounded && !isFreeCamera) state.player.velocity.y = 10; },
    startConversation,
    endConversation,
    sendTextMessage: async (message: string) => {
      const sessionPromise = state.gemini.sessionPromise;
      if (!state.gemini.ai || !sessionPromise) return;
      try {
        const ttsResponse = await state.gemini.ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: message }] }],
            config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
        });
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return;
        const temp24kContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const decoded24k = await decodeAudioData(decode(base64Audio), temp24kContext, 24000, 1);
        await temp24kContext.close();
        const targetSampleRate = 16000;
        const offlineContext = new OfflineAudioContext(decoded24k.numberOfChannels, decoded24k.duration * targetSampleRate, targetSampleRate);
        const bufferSource = offlineContext.createBufferSource();
        bufferSource.buffer = decoded24k;
        bufferSource.connect(offlineContext.destination);
        bufferSource.start();
        const resampled16k = await offlineContext.startRendering();
        const pcmData = resampled16k.getChannelData(0);
        
        const pcmBlob = createAudioBlob(pcmData);
        sessionPromise.then((session) => { if (session) session.sendRealtimeInput({ media: pcmBlob }); }).catch(err => endConversation());
      } catch (error) { console.error("Error sending text message as audio:", error); }
    },
    isInCar: () => state.player.isInCar,
    enterCar: () => {
      if (state.player.isInCar || !state.closestDrivableCar) return false;
      onCashChange(-10);
      onQuestProgress(2);
      state.player.isInCar = true; 
      state.player.currentCar = state.closestDrivableCar; 
      state.player.mesh.visible = false; 
      state.player.velocity.set(0,0,0);
      
      // Reset camera orbit to be behind the car
      state.orbit_angle.y = Math.PI; 
      state.orbit_angle.x = 0.2;
      
      return true;
    },
    exitCar: () => {
      if (!state.player.isInCar || !state.player.currentCar) return;
      const car = state.player.currentCar;
      const exitOffset = new THREE.Vector3(3, 0, 0); exitOffset.applyQuaternion(car.quaternion);
      const exitPos = car.position.clone().add(exitOffset);
      exitPos.y = 20; let groundY = -1;
      for (let y = 20; y > -5; y--) { if(isVoxelAt(exitPos.x, y, exitPos.z)) { groundY = y + 0.5; break; } }
      state.player.mesh.position.set(exitPos.x, groundY + state.player.height / 2, exitPos.z);
      state.player.mesh.visible = true; state.player.isInCar = false; state.player.currentCar = null;
    },
    setForSaleSigns: (signs: [number, number, number][]) => { state.forSaleSigns = signs.map(pos => new THREE.Vector3(...pos)); },
    startGenerativeBuild,
    pickUpItem: () => {
        if (!state.player.mesh || state.player.isInCar) return null;
        const playerPos = state.player.mesh.position;
        let closestItemIndex = -1; let minDistance = 2.5;
        state.placedItems.forEach((item, index) => {
            const distance = playerPos.distanceTo(item.mesh.position);
            if (distance < minDistance) { minDistance = distance; closestItemIndex = index; }
        });
        if (closestItemIndex !== -1) { const item = state.placedItems[closestItemIndex]; state.scene.remove(item.mesh); state.placedItems.splice(closestItemIndex, 1); return { type: item.type, id: item.id }; }
        return null;
    },
  }));

  useEffect(() => {
    state.voxelMap = new Map<string, Voxel>();
    voxels.forEach(v => state.voxelMap.set(v.position.join(','), v));
    if (state.scene) {
        if (state.instancedMesh) {
            state.scene.remove(state.instancedMesh);
            state.instancedMesh.geometry.dispose();
            if (Array.isArray(state.instancedMesh.material)) state.instancedMesh.material.forEach(m => m.dispose()); else state.instancedMesh.material.dispose();
        }
        if (voxels.length > 0) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshLambertMaterial();
            const mesh = new THREE.InstancedMesh(geometry, material, voxels.length);
            mesh.castShadow = true; mesh.receiveShadow = true;
            const matrix = new THREE.Matrix4();
            const color = new THREE.Color();
            voxels.forEach((voxel, i) => {
                const voxelSize = voxel.size || 1;
                matrix.identity();
                matrix.scale(new THREE.Vector3(voxelSize, voxelSize, voxelSize));
                matrix.setPosition(voxel.position[0], voxel.position[1], voxel.position[2]);
                mesh.setMatrixAt(i, matrix);
                mesh.setColorAt(i, color.set(voxel.color));
            });
            state.instancedMesh = mesh;
            state.scene.add(mesh);
            
            // Add point lights for glowing voxels to illuminate surroundings
            if (state.glowLights && Array.isArray(state.glowLights)) {
                (state.glowLights as THREE.PointLight[]).forEach(light => state.scene.remove(light));
            }
            state.glowLights = [];
            voxels.forEach((voxel) => {
                if (voxel.glow) {
                    const light = new THREE.PointLight(voxel.color, 1.2, 15);
                    light.position.set(voxel.position[0], voxel.position[1], voxel.position[2]);
                    (state.glowLights as THREE.PointLight[]).push(light);
                    state.scene.add(light);
                }
            });
        } else { state.instancedMesh = null; }
    }
  }, [voxels]);
  
  const updateDoors = (delta: number) => {
    if (!state.player.mesh) return;
    state.doors.forEach(door => {
        const distance = state.player.mesh.position.distanceTo(door.centerPosition);
        const activationDistance = 6;
        const shouldBeOpen = distance < activationDistance;
        if (door.isOpen !== shouldBeOpen) door.isOpen = shouldBeOpen;
        const panelCenterOffset = door.width / 4;
        const panelWidth = door.width / 2;
        const openOffset = panelWidth - 0.1;
        const lerpSpeed = 5;
        if (door.axis === 'z') {
            const closedZLeft = door.centerPosition.z - panelCenterOffset;
            const closedZRight = door.centerPosition.z + panelCenterOffset;
            const targetZLeft = door.isOpen ? closedZLeft - openOffset : closedZLeft;
            const targetZRight = door.isOpen ? closedZRight + openOffset : closedZRight;
            door.leftPanel.position.z = THREE.MathUtils.lerp(door.leftPanel.position.z, targetZLeft, delta * lerpSpeed);
            door.rightPanel.position.z = THREE.MathUtils.lerp(door.rightPanel.position.z, targetZRight, delta * lerpSpeed);
        } else if (door.axis === 'x') {
            const closedXLeft = door.centerPosition.x - panelCenterOffset;
            const closedXRight = door.centerPosition.x + panelCenterOffset;
            const targetXLeft = door.isOpen ? closedXLeft - openOffset : closedXLeft;
            const targetXRight = door.isOpen ? closedXRight + openOffset : closedXRight;
            door.leftPanel.position.x = THREE.MathUtils.lerp(door.leftPanel.position.x, targetXLeft, delta * lerpSpeed);
            door.rightPanel.position.x = THREE.MathUtils.lerp(door.rightPanel.position.x, targetXRight, delta * lerpSpeed);
        }
    });
  };

  const updateCars = (delta: number) => {
    const INTERSECTION_RADIUS = 20; const YIELD_DISTANCE = 25; const SAFE_TIME_HEADWAY = 1.6; const MIN_DISTANCE = 6.0; const MAX_ACCEL = 1.5; const MAX_DECEL = 3.0; const JAM_THRESHOLD = 3.0; const JAM_NUDGE_FACTOR = 0.5;
    
    // Spring physics for rebounding
    const SPRING_K = 5.0; // Strength of return to path
    const DAMPING = 0.9; // Friction on lateral movement

    const carAccelerations = state.cars.map((car, carIndex) => {
        let leadCarInfo: { distance: number, car: any | null } = { distance: Infinity, car: null };
        const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.mesh.quaternion);
        state.cars.forEach((otherCar, otherCarIndex) => {
            if (carIndex === otherCarIndex) return;
            const toOther = new THREE.Vector3().subVectors(otherCar.mesh.position, car.mesh.position);
            const distance = toOther.length();
            if (distance < YIELD_DISTANCE) {
                toOther.normalize();
                if (carForward.dot(toOther) > 0.85) { if (distance < leadCarInfo.distance) leadCarInfo = { distance, car: otherCar }; }
            }
        });
        let targetSpeed = car.desiredSpeed;
        if (leadCarInfo.car) {
            let effectiveMinDistance = MIN_DISTANCE;
            if (car.timeStationary > JAM_THRESHOLD) effectiveMinDistance *= JAM_NUDGE_FACTOR;
            const safeDistance = effectiveMinDistance + car.speed * SAFE_TIME_HEADWAY;
            if (leadCarInfo.distance < safeDistance) targetSpeed = car.desiredSpeed * (leadCarInfo.distance / safeDistance);
        }
        const lookAheadPos = car.path.getPointAt((car.progress + 0.05) % 1);
        let approachingIntersection = null;
        for (const center of state.intersectionCenters) {
            if (lookAheadPos.distanceTo(center) < YIELD_DISTANCE && car.mesh.position.distanceTo(center) > INTERSECTION_RADIUS) { approachingIntersection = center; break; }
        }
        if (approachingIntersection) {
            for (const otherCar of state.cars) {
                if (otherCar === car) continue;
                const distToIntersection = otherCar.mesh.position.distanceTo(approachingIntersection);
                if (distToIntersection < INTERSECTION_RADIUS) {
                    const otherForward = new THREE.Vector3(0, 0, 1).applyQuaternion(otherCar.mesh.quaternion);
                    if (Math.abs(carForward.dot(otherForward)) < 0.5) { targetSpeed = 0; break; }
                }
            }
        }
        const speedDiff = targetSpeed - car.speed;
        let acceleration = speedDiff * 2.0;
        return Math.max(-MAX_DECEL, Math.min(MAX_ACCEL, acceleration));
    });

    state.cars.forEach((car, index) => {
        const acceleration = carAccelerations[index];
        car.speed += acceleration * delta;
        car.speed = Math.max(0, Math.min(car.desiredSpeed, car.speed));
        if (car.speed < 0.5) car.timeStationary += delta; else car.timeStationary = 0;
        
        const pathLength = car.path.getLength();
        if (pathLength > 0) {
            const progressDelta = (car.speed / pathLength) * delta;
            car.progress = (car.progress + progressDelta) % 1;
            
            // Rebound Physics: Apply spring force to pull offset back to 0
            const springForce = car.offset.clone().multiplyScalar(-SPRING_K);
            // a = F (mass=1), vel += a * dt
            car.displacementVelocity.add(springForce.multiplyScalar(delta));
            // Apply damping
            car.displacementVelocity.multiplyScalar(DAMPING);
            // Apply velocity to offset
            car.offset.add(car.displacementVelocity.clone().multiplyScalar(delta));

            const pathPosition = car.path.getPointAt(car.progress);
            const newPosition = pathPosition.clone().add(car.offset);
            car.mesh.position.copy(newPosition);
            
            // Look direction: primarily along path, but could be affected by velocity if we wanted sliding visuals
            const lookAtProgress = (car.progress + 0.001) % 1;
            const lookAtPathPos = car.path.getPointAt(lookAtProgress);
            // Maintain standard look-at path behavior for stability
            if (lookAtPathPos.distanceTo(pathPosition) > 0.01) {
                // Temporary target for looking at
                const targetLook = lookAtPathPos.add(car.offset); 
                car.mesh.lookAt(targetLook);
            }
        }

        // Interact with pedestrians
        state.pedestrians.forEach(ped => {
            const dist = car.mesh.position.distanceTo(ped.mesh.position);
            if (dist < 4.0) { // Radius approx
                const pushDir = new THREE.Vector3().subVectors(ped.mesh.position, car.mesh.position).normalize();
                // Add impulse to pedestrian
                ped.displacementVelocity.add(pushDir.multiplyScalar(10)); // NPC cars push slightly less hard
            }
        });
    });
  };

  const updateTrain = (delta: number) => {
    if (!state.train.mesh || !state.train.path) return;
    const train = state.train;
    const pathLength = train.path.getLength();
    if (pathLength === 0) return;
    const progressDelta = (train.speed / pathLength) * delta;
    train.progress = (train.progress + progressDelta) % 1;
    const newPosition = train.path.getPointAt(train.progress);
    train.mesh.position.copy(newPosition);
    const lookAtProgress = (train.progress + 0.001) % 1;
    const lookAtPosition = train.path.getPointAt(lookAtProgress);
    if (lookAtPosition.distanceTo(newPosition) > 0.01) {
        lookAtPosition.y = newPosition.y;
        train.mesh.lookAt(lookAtPosition);
    }
  };


  useEffect(() => {
    logicRef.current = { updatePlayer, updateCamera, updateTargetBlock, updateDoors, updateNPC, updateTeller, updateTeacher, updateWizard, updateCustomNPCs, updateCars, updatePedestrians, updateDrivableCars, updateCarProximityCheck, updateTrain, updateConstructionWorkers, updateForSaleProximityCheck, updateItemProximityCheck, updateCarCollisions, updateNpcProximityCheck };
  });

  // ... (createPlayer, spawnPizzaOnCounter, startConversation, endConversation, useEffect logic for scene setup)
  
  const createPlayer = (customization: CharacterCustomization) => {
      const playerMesh = state.player.mesh;
      if(state.scene.getObjectByName("player")) state.scene.remove(playerMesh);
      while(playerMesh.children.length > 0) playerMesh.remove(playerMesh.children[0]);
      const { characterGroup, body_parts } = createCharacter(customization);
      playerMesh.add(characterGroup);
      playerMesh.name = "player";
      state.player.body_parts = body_parts;
      playerMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
      if(!playerMesh.parent) playerMesh.position.set(0, 3, 0);
      state.scene.add(playerMesh);
  };

  const spawnPizzaOnCounter = (pizzaType: string) => {
    const occupiedSpots = state.placedItems.map(p => p.mesh.position.clone());
    const availableSpot = state.pizzaCounterSpots.find(spot => !occupiedSpots.some(occupied => occupied.equals(spot)));
    if (availableSpot) {
        const pizzaGroup = createPizzaInBox(pizzaType);
        pizzaGroup.position.copy(availableSpot);
        pizzaGroup.rotation.y = -Math.PI / 2;
        const id = Math.random().toString(36).substring(7);
        state.placedItems.push({ id, mesh: pizzaGroup, type: pizzaType });
        state.scene.add(pizzaGroup);
    } else { console.warn("No available counter space for a new pizza!"); }
  };
  
  const startConversation = async (npc: NearbyNPC) => {
    if (!state.gemini.ai || state.gemini.sessionPromise) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.gemini.micStream = stream;
        state.gemini.activeChatSession = { npcType: npc.type, id: npc.id };
        if (state.gemini.inputAudioContext?.state === 'suspended') await state.gemini.inputAudioContext.resume();
        if (state.gemini.outputAudioContext?.state === 'suspended') await state.gemini.outputAudioContext.resume();
        
        if (npc.type === 'chef') state.npc.isTalking = true;
        else if (npc.type === 'pedestrian') { const pedestrian = state.pedestrians.find(p => p.id === npc.id); if (pedestrian) pedestrian.isTalking = true; }
        else if (npc.type === 'worker') { const worker = state.constructionWorkers.find(w => w.id === npc.id); if (worker) worker.isTalking = true; }
        else if (npc.type === 'teacher') { state.teacher.isTalking = true; }
        else if (npc.type === 'teller') { state.teller.isTalking = true; }
        else if (npc.type === 'wizard') { state.wizard.isTalking = true; }
        else if (npc.type === 'custom') { const custom = state.customNpcs.find(c => c.id === npc.id); if (custom) custom.isTalking = true; }
        
        const isChef = npc.type === 'chef'; 
        const isWorker = npc.type === 'worker'; 
        const isTeacher = npc.type === 'teacher';
        const isTeller = npc.type === 'teller';
        const isPedestrian = npc.type === 'pedestrian';
        const isWizard = npc.type === 'wizard';
        
        const config: any = {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: isChef ? 'Puck' : (isWorker ? 'Fenrir' : (isTeacher ? 'Kore' : (isWizard ? 'Charon' : 'Zephyr'))) } } },
          systemInstruction: npc.persona,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        };
        if (isChef) config.tools = [{functionDeclarations: [makePizzaFunctionDeclaration]}];
        else if (isWorker) config.tools = [{functionDeclarations: [buildStructureFunctionDeclaration]}];
        else if (isTeacher) config.tools = [{functionDeclarations: [presentLessonFunctionDeclaration]}];
        else if (isTeller) config.tools = [{functionDeclarations: [withdrawFunctionDeclaration, depositFunctionDeclaration]}];
        else if (isPedestrian) config.tools = [{functionDeclarations: [followPlayerFunctionDeclaration]}];
        else if (isWizard) config.tools = [{functionDeclarations: [spawnCustomNPCFunctionDeclaration, spawnObjectFunctionDeclaration, followPlayerFunctionDeclaration]}];

        const sessionPromise = state.gemini.ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    if (!state.gemini.inputAudioContext || !state.gemini.micStream) return;
                    const source = state.gemini.inputAudioContext.createMediaStreamSource(state.gemini.micStream);
                    const scriptProcessor = state.gemini.inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createAudioBlob(inputData);
                        state.gemini.sessionPromise?.then((session) => { session.sendRealtimeInput({ media: pcmBlob }); });
                    };
                    source.connect(scriptProcessor); scriptProcessor.connect(state.gemini.inputAudioContext.destination);
                    state.gemini.scriptProcessor = scriptProcessor;
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        currentInputTranscription.current += text;
                        onTranscriptionUpdate({ user: currentInputTranscription.current });
                    }
                    if (message.serverContent?.outputTranscription) {
                        const text = message.serverContent.outputTranscription.text;
                        currentOutputTranscription.current += text;
                        onTranscriptionUpdate({ model: currentOutputTranscription.current });
                    }
                    if (message.serverContent?.turnComplete) {
                        onTranscriptionUpdate({ isFinal: true });
                        currentInputTranscription.current = ''; currentOutputTranscription.current = '';
                    }
                    if (message.toolCall) {
                      for (const fc of message.toolCall.functionCalls) {
                        if (fc.name === 'makePizza') {
                          const args = fc.args as { pizzaType: string; quantity: number };
                          const pizzaType = args.pizzaType || 'margherita';
                          const quantity = args.quantity || 1;
                          onCashChange(-5);
                          onQuestProgress(7);
                          for (let i = 0; i < quantity; i++) spawnPizzaOnCounter(pizzaType);
                          const result = `Mamma mia! ${quantity} ${pizzaType} pizza(s), coming right up! I've placed it on the counter for you.`;
                          state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id : fc.id, name: fc.name, response: { result: result }, }] }) });
                        } else if (fc.name === 'buildStructure') {
                            const args = fc.args as { structureDescription: string };
                            const workerId = state.gemini.activeChatSession?.id;
                            const worker = state.constructionWorkers.find(w => w.id === workerId);
                            let result = "I couldn't find the paperwork for this lot.";
                            if (worker) {
                                onQuestProgress(5);
                                startGenerativeBuild(args.structureDescription, [worker.target.x, worker.target.y, worker.target.z]);
                                result = `Alright! Starting construction on "${args.structureDescription}". Stand back!`;
                                worker.isTalking = false;
                            }
                            state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                        } else if (fc.name === 'presentLesson') {
                            const args = fc.args as { topic: string; htmlContent: string };
                            onLessonGenerated(args.htmlContent);
                            const result = "Lesson presented on screen.";
                            state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                        } else if (fc.name === 'withdrawMoney') {
                            const args = fc.args as { amount: number };
                            onCashChange(args.amount);
                            onQuestProgress(1);
                            const result = `Success. Withdrew $${args.amount}. Your new balance is infinite.`;
                            state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                        } else if (fc.name === 'depositMoney') {
                            const args = fc.args as { amount: number };
                            onCashChange(-args.amount);
                            const result = `Success. Deposited $${args.amount}.`;
                            state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                        } else if (fc.name === 'followPlayer') {
                            const args = fc.args as { shouldFollow: boolean };
                            const npcId = state.gemini.activeChatSession?.id;
                            if (npcId !== undefined) {
                                const ped = state.pedestrians.find(p => p.id === npcId);
                                if (ped) {
                                    ped.isFollowingPlayer = args.shouldFollow;
                                    const result = args.shouldFollow ? "I'm following you now." : "Okay, I'll stop following.";
                                    state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                                }
                            }
                        } else if (fc.name === 'spawnCustomNPC') {
                            const args = fc.args as { 
                                name: string, gender: 'male' | 'female', persona: string, 
                                skinColor?: string, hairStyle?: string, hairColor?: string, 
                                shirtStyle?: string, shirtColor?: string, 
                                pantsStyle?: string, pantsColor?: string, shoeColor?: string, 
                                hatStyle?: string, hatColor?: string, 
                                glassesStyle?: string, glassesColor?: string,
                                necklaceStyle?: string, necklaceColor?: string,
                                headwearStyle?: string, headwearColor?: string,
                                facialHairStyle?: string, facialHairColor?: string,
                                heldProp?: string, backProp?: string
                            };
                            const customization: CharacterCustomization = {
                                gender: args.gender,
                                skinColor: args.skinColor || pickRandom(SKIN_COLORS),
                                hairStyle: args.hairStyle as any || pickRandom(HAIR_STYLES),
                                hairColor: args.hairColor || pickRandom(HAIR_COLORS),
                                eyeColor: '#5c98d9',
                                facialHairStyle: args.facialHairStyle as any || 'none',
                                facialHairColor: args.facialHairColor || '#000000',
                                shirtStyle: args.shirtStyle as any || pickRandom(SHIRT_STYLES),
                                shirtColor: args.shirtColor || pickRandom(CLOTHING_COLORS),
                                pantsStyle: args.pantsStyle as any || pickRandom(PANTS_STYLES),
                                pantsColor: args.pantsColor || pickRandom(CLOTHING_COLORS),
                                shoeColor: args.shoeColor || '#1a1a1a',
                                hatStyle: args.hatStyle as any || 'none',
                                hatColor: args.hatColor || '#000000',
                                glassesStyle: args.glassesStyle as any || 'none',
                                glassesColor: args.glassesColor || '#000000',
                                necklaceStyle: args.necklaceStyle as any || 'none',
                                necklaceColor: args.necklaceColor || '#000000',
                                headwearStyle: args.headwearStyle as any || 'none',
                                headwearColor: args.headwearColor || '#000000',
                            };
                            
                            const { characterGroup, body_parts, createVoxel } = createCharacter(customization);
                            
                            const createProp = (type: string, isBackProp: boolean = false) => {
                                const group = new THREE.Group();
                                const lowerType = type.toLowerCase();
                                const voxelSize = VOXEL_SIZE;
                                
                                // HAND PROPS (held in right hand)
                                if (!isBackProp) {
                                    if (lowerType.includes('sword') || lowerType.includes('blade') || lowerType.includes('katana')) {
                                        // Handle
                                        group.add(createVoxel(new THREE.Vector3(0, -2, 0), '#5a3825'));
                                        group.add(createVoxel(new THREE.Vector3(0, -1, 0), '#5a3825'));
                                        // Guard
                                        group.add(createVoxel(new THREE.Vector3(0, 0, 0), '#ffd700'));
                                        group.add(createVoxel(new THREE.Vector3(-1, 0, 0), '#ffd700'));
                                        group.add(createVoxel(new THREE.Vector3(1, 0, 0), '#ffd700'));
                                        // Blade
                                        for(let y=1; y<=6; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#c0c0c0'));
                                        // Position in hand (arm is at shoulder, hand is ~9 voxels down)
                                        group.position.set(0.5 * voxelSize, -9 * voxelSize, 0);
                                        group.rotation.z = -0.3; // Slight forward angle
                                    } else if (lowerType.includes('wand') || lowerType.includes('magic')) {
                                        const len = 5;
                                        for(let y=0; y<len; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#5a3825'));
                                        group.add(createVoxel(new THREE.Vector3(0, len, 0), '#ff00ff'));
                                        group.add(createVoxel(new THREE.Vector3(0, len+1, 0), '#ffff00'));
                                        group.position.set(0.5 * voxelSize, -9 * voxelSize, 0);
                                        group.rotation.z = -0.4;
                                    } else if (lowerType.includes('staff') || lowerType.includes('rod')) {
                                        const len = 12;
                                        for(let y=0; y<len; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#5a3825'));
                                        // Ornamental top
                                        group.add(createVoxel(new THREE.Vector3(0, len, 0), '#ffd700'));
                                        group.add(createVoxel(new THREE.Vector3(-1, len, 0), '#ffd700'));
                                        group.add(createVoxel(new THREE.Vector3(1, len, 0), '#ffd700'));
                                        group.add(createVoxel(new THREE.Vector3(0, len+1, 0), '#9932CC'));
                                        group.position.set(0.5 * voxelSize, -9 * voxelSize, 0);
                                        group.rotation.z = -0.2;
                                    } else if (lowerType.includes('axe')) {
                                        // Handle
                                        for(let y=0; y<6; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#5a3825'));
                                        // Blade
                                        for(let x=-2; x<=2; x++) group.add(createVoxel(new THREE.Vector3(x, 6, 0), '#c0c0c0'));
                                        for(let x=-1; x<=1; x++) group.add(createVoxel(new THREE.Vector3(x, 7, 0), '#c0c0c0'));
                                        group.position.set(0.5 * voxelSize, -9 * voxelSize, 0);
                                        group.rotation.z = -0.3;
                                    } else if (lowerType.includes('shield')) {
                                        for(let x=-2; x<=2; x++) for(let y=-2; y<=2; y++) {
                                            if (Math.abs(x) + Math.abs(y) <= 3) {
                                                group.add(createVoxel(new THREE.Vector3(x, y, 0), '#4169E1'));
                                            }
                                        }
                                        group.add(createVoxel(new THREE.Vector3(0, 0, 0), '#ffd700'));
                                        group.position.set(-1 * voxelSize, -6 * voxelSize, 1 * voxelSize);
                                        group.rotation.y = Math.PI / 6;
                                    } else if (lowerType.includes('gun') || lowerType.includes('pistol')) {
                                        // Handle
                                        group.add(createVoxel(new THREE.Vector3(0, -1, 0), '#1a1a1a'));
                                        group.add(createVoxel(new THREE.Vector3(0, -2, 0), '#1a1a1a'));
                                        // Barrel
                                        for(let y=0; y<=3; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#5a5a5a'));
                                        group.position.set(0.5 * voxelSize, -8 * voxelSize, 0);
                                        group.rotation.z = -Math.PI / 3;
                                    } else if (lowerType.includes('flower') || lowerType.includes('rose')) {
                                        // Stem
                                        for(let y=0; y<4; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#228B22'));
                                        // Petals
                                        const flowerColor = lowerType.includes('rose') ? '#ff1744' : '#ffeb3b';
                                        group.add(createVoxel(new THREE.Vector3(0, 4, 0), flowerColor));
                                        group.add(createVoxel(new THREE.Vector3(-1, 4, 0), flowerColor));
                                        group.add(createVoxel(new THREE.Vector3(1, 4, 0), flowerColor));
                                        group.add(createVoxel(new THREE.Vector3(0, 5, 0), flowerColor));
                                        group.position.set(0.5 * voxelSize, -8 * voxelSize, 0);
                                    } else if (lowerType.includes('torch')) {
                                        // Handle
                                        for(let y=0; y<5; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#5a3825'));
                                        // Fire
                                        group.add(createVoxel(new THREE.Vector3(0, 5, 0), '#ff6600'));
                                        group.add(createVoxel(new THREE.Vector3(0, 6, 0), '#ffff00'));
                                        group.position.set(0.5 * voxelSize, -9 * voxelSize, 0);
                                    } else {
                                        // Generic hand prop
                                        for(let y=0; y<4; y++) group.add(createVoxel(new THREE.Vector3(0, y, 0), '#888888'));
                                        group.position.set(0.5 * voxelSize, -8 * voxelSize, 0);
                                    }
                                }
                                
                                // BACK PROPS (worn on back)
                                else {
                                    if (lowerType.includes('wing') || lowerType.includes('angel')) {
                                        const wingColor = lowerType.includes('dark') || lowerType.includes('demon') ? '#1a1a1a' : '#ffffff';
                                        const createWing = (dir: 1 | -1) => {
                                            const w = new THREE.Group();
                                            // Main wing structure
                                            for(let y=0; y<=4; y++) {
                                                for(let x=0; x<=y+1; x++) {
                                                    w.add(createVoxel(new THREE.Vector3(dir*x, y, -x*0.3), wingColor));
                                                }
                                            }
                                            return w;
                                        };
                                        group.add(createWing(-1));
                                        group.add(createWing(1));
                                        // Position on upper back behind shoulders
                                        group.position.set(0, 3 * voxelSize, -4 * voxelSize);
                                    } else if (lowerType.includes('cape') || lowerType.includes('cloak')) {
                                        const capeColor = lowerType.includes('red') ? '#ef4444' : 
                                                         lowerType.includes('blue') ? '#3b82f6' : 
                                                         lowerType.includes('black') ? '#1a1a1a' : '#9b2c2c';
                                        // Cape flowing down from shoulders
                                        for(let x=-2; x<=2; x++) {
                                            for(let y=-5; y<=2; y++) {
                                                if (y > 0 || Math.abs(x) <= 1) {
                                                    group.add(createVoxel(new THREE.Vector3(x, y, 0), capeColor));
                                                }
                                            }
                                        }
                                        // Position on upper back
                                        group.position.set(0, 3 * voxelSize, -3.5 * voxelSize);
                                    } else if (lowerType.includes('backpack') || lowerType.includes('bag')) {
                                        const packColor = '#5a3825';
                                        // Backpack body
                                        for(let x=-1; x<=1; x++) {
                                            for(let y=-2; y<=1; y++) {
                                                for(let z=0; z<=1; z++) {
                                                    group.add(createVoxel(new THREE.Vector3(x, y, z), packColor));
                                                }
                                            }
                                        }
                                        // Straps
                                        group.add(createVoxel(new THREE.Vector3(-1, 2, 0), '#1a1a1a'));
                                        group.add(createVoxel(new THREE.Vector3(1, 2, 0), '#1a1a1a'));
                                        group.position.set(0, 1 * voxelSize, -3.5 * voxelSize);
                                    } else if (lowerType.includes('quiver') || lowerType.includes('arrow')) {
                                        const quiverColor = '#5a3825';
                                        // Quiver body
                                        for(let y=-3; y<=0; y++) {
                                            group.add(createVoxel(new THREE.Vector3(0, y, 0), quiverColor));
                                            group.add(createVoxel(new THREE.Vector3(1, y, 0), quiverColor));
                                        }
                                        // Arrow tips sticking out
                                        for(let i=0; i<3; i++) {
                                            const offset = (i - 1) * 0.7;
                                            group.add(createVoxel(new THREE.Vector3(offset, 1, 0), '#c0c0c0'));
                                            group.add(createVoxel(new THREE.Vector3(offset, 2, 0), '#8B4513'));
                                        }
                                        group.position.set(1.5 * voxelSize, 1 * voxelSize, -3 * voxelSize);
                                        group.rotation.z = -0.3;
                                    } else if (lowerType.includes('jetpack')) {
                                        const jetColor = '#5a5a5a';
                                        // Two thruster cylinders
                                        for(let x of [-1, 1]) {
                                            for(let y=-2; y<=1; y++) {
                                                for(let z=0; z<=1; z++) {
                                                    group.add(createVoxel(new THREE.Vector3(x, y, z), jetColor));
                                                }
                                            }
                                            // Thruster glow
                                            group.add(createVoxel(new THREE.Vector3(x, -3, 0), '#ff6600'));
                                            group.add(createVoxel(new THREE.Vector3(x, -3, 1), '#ff6600'));
                                        }
                                        group.position.set(0, 1 * voxelSize, -4 * voxelSize);
                                    } else {
                                        // Generic back prop
                                        for(let x=-1; x<=1; x++) {
                                            for(let y=-2; y<=2; y++) {
                                                group.add(createVoxel(new THREE.Vector3(x, y, 0), '#888888'));
                                            }
                                        }
                                        group.position.set(0, 2 * voxelSize, -3.5 * voxelSize);
                                    }
                                }
                                
                                return group;
                            };

                            if (args.heldProp) {
                                const prop = createProp(args.heldProp, false);
                                body_parts.armR.add(prop);
                            }
                            if (args.backProp) {
                                const prop = createProp(args.backProp, true);
                                body_parts.body.add(prop);
                            }

                            const mesh = new THREE.Group();
                            mesh.add(characterGroup);
                            mesh.name = `custom_npc_${args.name}`;
                            mesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
                            
                            // Spawn near wizard
                            const spawnPos = state.wizard.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5));
                            mesh.position.copy(spawnPos);
                            state.scene.add(mesh);
                            
                            state.customNpcs.push({
                                mesh,
                                body_parts,
                                run_time: 0,
                                id: `custom_${Date.now()}`,
                                name: args.name,
                                persona: args.persona,
                                isTalking: false,
                                target: spawnPos.clone(),
                                velocity: new THREE.Vector3(),
                                idleTimer: 0,
                                width: 1.6,
                                height: 3.6
                            });
                            
                            onCashChange(-300);
                            onQuestProgress(3);
                            const result = `Abracadabra! ${args.name} has been summoned with the appearance you requested.`;
                            state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                        } else if (fc.name === 'spawnObject') {
                            const args = fc.args as { description: string };
                            spawnGenerativeObject(args.description);
                            onQuestProgress(4);
                            const result = `I have conjured a ${args.description} for you!`;
                            state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                        } else if (fc.name === 'followPlayer') {
                            const args = fc.args as { shouldFollow: boolean };
                            state.wizard.shouldFollow = args.shouldFollow;
                            const result = args.shouldFollow ? "I'll follow you!" : "Alright, I'll stay here.";
                            state.gemini.sessionPromise?.then((session) => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: result }, }] }) });
                        }
                      }
                    }
                    const modelTurn = message.serverContent?.modelTurn;
                    if (modelTurn && modelTurn.parts && modelTurn.parts.length > 0) {
                        const base64EncodedAudioString = modelTurn.parts[0].inlineData?.data;
                        if (base64EncodedAudioString && state.gemini.outputAudioContext && state.gemini.outputNode) {
                            state.gemini.nextStartTime = Math.max(state.gemini.nextStartTime, state.gemini.outputAudioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), state.gemini.outputAudioContext, 24000, 1);
                            const source = state.gemini.outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(state.gemini.outputNode);
                            source.addEventListener('ended', () => { state.gemini.sources.delete(source); });
                            source.start(state.gemini.nextStartTime);
                            state.gemini.nextStartTime = state.gemini.nextStartTime + audioBuffer.duration;
                            state.gemini.sources.add(source);
                        }
                    }
                    if (message.serverContent?.interrupted) {
                        for (const source of state.gemini.sources.values()) { source.stop(); state.gemini.sources.delete(source); }
                        state.gemini.nextStartTime = 0;
                    }
                },
                onerror: (e: ErrorEvent) => { console.error('Live session error:', e); endConversation(); },
                onclose: (e: CloseEvent) => { console.log('Live session closed'); endConversation(); },
            },
            config,
        });
        state.gemini.sessionPromise = sessionPromise;
    } catch (err) { console.error("Failed to get microphone:", err); endConversation(); }
  };

  const endConversation = () => {
    if (state.gemini.sessionPromise) {
        state.gemini.sessionPromise.then(session => { if (session && typeof session.close === 'function') session.close() }).catch(() => { });
    }
    const activeSession = state.gemini.activeChatSession;
    if (activeSession) {
      if (activeSession.npcType === 'chef') state.npc.isTalking = false;
      else if (activeSession.npcType === 'pedestrian') { const pedestrian = state.pedestrians.find(p => p.id === activeSession.id); if (pedestrian) pedestrian.isTalking = false; }
      else if (activeSession.npcType === 'worker') { const worker = state.constructionWorkers.find(w => w.id === activeSession.id); if (worker) worker.isTalking = false; }
      else if (activeSession.npcType === 'teacher') { state.teacher.isTalking = false; }
      else if (activeSession.npcType === 'teller') { state.teller.isTalking = false; }
      else if (activeSession.npcType === 'wizard') { state.wizard.isTalking = false; }
      else if (activeSession.npcType === 'custom') { const custom = state.customNpcs.find(c => c.id === activeSession.id); if (custom) custom.isTalking = false; }
    }
    if (state.gemini.micStream) state.gemini.micStream.getTracks().forEach(track => track.stop());
    if (state.gemini.scriptProcessor) state.gemini.scriptProcessor.disconnect();
    state.gemini.sources.forEach(source => source.stop());
    state.gemini.sources.clear();
    state.gemini.sessionPromise = null;
    state.gemini.micStream = null;
    state.gemini.scriptProcessor = null;
    state.gemini.nextStartTime = 0;
    state.gemini.activeChatSession = null;
    currentInputTranscription.current = '';
    currentOutputTranscription.current = '';
  };

  useEffect(() => {
    if (!mountRef.current || rendererRef.current) return;
    const currentMount = mountRef.current;

    // Basic setup
    state.camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = state.renderer;
    currentMount.appendChild(state.renderer.domElement);
    
    state.gemini.ai = new GoogleGenAI({apiKey: process.env.API_KEY as string});
    state.gemini.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    state.gemini.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    state.gemini.outputNode = state.gemini.outputAudioContext.createGain();
    state.gemini.outputNode.connect(state.gemini.outputAudioContext.destination);

    state.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    state.scene.add(state.ambientLight);
    state.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    state.directionalLight.position.set(10, 15, 5);
    state.directionalLight.castShadow = true;
    state.directionalLight.shadow.camera.top = 50;
    state.directionalLight.shadow.camera.bottom = -50;
    state.directionalLight.shadow.camera.left = -50;
    state.directionalLight.shadow.camera.right = 50;
    state.directionalLight.shadow.mapSize.width = 1024;
    state.directionalLight.shadow.mapSize.height = 1024;
    state.scene.add(state.directionalLight);

    state.scene.background = new THREE.Color(0x87ceeb);
    state.scene.fog = new THREE.Fog(0x87ceeb, 48, 120);
    
    const gridHelper = new THREE.GridHelper(worldSize, worldSize);
    gridHelper.position.set(-0.5, -1.499, -0.5);
    state.scene.add(gridHelper);
    state.gridHelper = gridHelper;
    
    const highlighterGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const highlighterEdges = new THREE.EdgesGeometry(highlighterGeo);
    // Updated highlighter to be more subtle white with some transparency
    state.highlighter = new THREE.LineSegments(
        highlighterEdges, 
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    );
    state.highlighter.visible = false;
    state.scene.add(state.highlighter);

    // ... (Pizza shop, Bank, Store, Dealership, School, Skyscraper setup - largely unchanged)
    const pizzaShopOrigin = { x: -8, y: -1, z: 16 };
    const shopWidth = 24; const shopDepth = 30; 
    const pizzaDoorZStart_local = Math.floor(shopDepth / 2) - 2;
    const pizzaDoorWidth = 4; const pizzaDoorHeight = 5;
    const PIZZA_DOOR_COLOR = '#87CEEB';
    const pizzaDoorCenterX = pizzaShopOrigin.x;
    const pizzaDoorCenterY = pizzaShopOrigin.y + pizzaDoorHeight / 2;
    const pizzaDoorCenterZ = pizzaShopOrigin.z + pizzaDoorZStart_local + (pizzaDoorWidth / 2) - 0.5;
    const pizzaLeftPanel = new THREE.Group();
    const pizzaRightPanel = new THREE.Group();
    const pizzaDoorPanelGeo = new THREE.BoxGeometry(0.2, pizzaDoorHeight, pizzaDoorWidth / 2);
    const pizzaDoorMat = new THREE.MeshLambertMaterial({ color: PIZZA_DOOR_COLOR, transparent: true, opacity: 0.8 });
    pizzaLeftPanel.add(new THREE.Mesh(pizzaDoorPanelGeo, pizzaDoorMat));
    pizzaRightPanel.add(new THREE.Mesh(pizzaDoorPanelGeo, pizzaDoorMat));
    const pizzaPanelOffsetFromCenter = pizzaDoorWidth / 4;
    const pizzaClosedZLeft = pizzaDoorCenterZ - pizzaPanelOffsetFromCenter;
    const pizzaClosedZRight = pizzaDoorCenterZ + pizzaPanelOffsetFromCenter;
    pizzaLeftPanel.position.set(pizzaDoorCenterX, pizzaDoorCenterY, pizzaClosedZLeft);
    pizzaRightPanel.position.set(pizzaDoorCenterX, pizzaDoorCenterY, pizzaClosedZRight);
    state.scene.add(pizzaLeftPanel); state.scene.add(pizzaRightPanel);
    state.doors.push({ leftPanel: pizzaLeftPanel, rightPanel: pizzaRightPanel, centerPosition: new THREE.Vector3(pizzaDoorCenterX, pizzaDoorCenterY, pizzaDoorCenterZ), isOpen: false, axis: 'z', width: pizzaDoorWidth, });

    const counterY = pizzaShopOrigin.y + 2.5;
    for (let i = 0; i < 4; i++) state.pizzaCounterSpots.push(new THREE.Vector3(pizzaShopOrigin.x + 20, counterY, pizzaShopOrigin.z + 8 + i * 5));
    for (let i = 0; i < 3; i++) state.pizzaCounterSpots.push(new THREE.Vector3(pizzaShopOrigin.x + 6 + i * 5, counterY, pizzaShopOrigin.z + 23));

    // Chef NPC
    const createChefNPC = () => {
        const chefCustomization: CharacterCustomization = { gender: 'male', skinColor: '#e0a382', hairStyle: 'short', hairColor: '#5a3825', eyeColor: '#6B4226', facialHairStyle: 'mustache', facialHairColor: '#5a3825', shirtStyle: 'longsleeve', shirtColor: '#ffffff', pantsStyle: 'jeans', pantsColor: '#3a3a3a', shoeColor: '#1a1a1a', hatStyle: 'none', hatColor: '', glassesStyle: 'none', glassesColor: '', necklaceStyle: 'none', necklaceColor: '', headwearStyle: 'none', headwearColor: '', };
        const { characterGroup, body_parts, createVoxel } = createCharacter(chefCustomization);
        const chefMesh = new THREE.Group();
        chefMesh.add(characterGroup);
        chefMesh.name = "chef_npc";
        state.npc.body_parts = body_parts;
        const hat = new THREE.Group(); const hatColor = '#ffffff'; const hatY = 6;
        for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) hat.add(createVoxel(new THREE.Vector3(x, hatY, z), hatColor));
        for (let y = 1; y < 4; y++) { for (let r = 0; r < 20; r++) { const a = r/20 * Math.PI * 2; const radius = 3 * (1 - y/8); hat.add(createVoxel(new THREE.Vector3(Math.cos(a)*radius, hatY+y, Math.sin(a)*radius), hatColor)); } }
        for (let x = -3; x <= 3; x++) hat.add(createVoxel(new THREE.Vector3(x, hatY, -2.5), hatColor));
        hat.add(createVoxel(new THREE.Vector3(-2, hatY, -3.5), hatColor)); hat.add(createVoxel(new THREE.Vector3(2, hatY, -3.5), hatColor));
        body_parts.head.add(hat);
        chefMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
        return chefMesh;
    };
    state.npc.mesh = createChefNPC();
    state.scene.add(state.npc.mesh);
    state.npc.mesh.position.set(pizzaShopOrigin.x + 21, pizzaShopOrigin.y + 0.5 + state.npc.height / 2, pizzaShopOrigin.z + 15);
    state.npc.mesh.rotation.y = -Math.PI / 2;
    state.npc.target.copy(state.npc.mesh.position);

    // Teller, Teacher, Workers
    const bankOrigin = { x: -8, y: -1, z: -68 };
    const createTellerNPC = () => {
        const tellerCustomization: CharacterCustomization = { gender: 'female', skinColor: '#fcc2a2', hairStyle: 'bun', hairColor: '#2c1d11', eyeColor: '#228B22', facialHairStyle: 'none', facialHairColor: '', shirtStyle: 'longsleeve', shirtColor: '#4682B4', pantsStyle: 'jeans', pantsColor: '#1a1a1a', shoeColor: '#1a1a1a', hatStyle: 'none', hatColor: '', glassesStyle: 'square', glassesColor: '#222222', necklaceStyle: 'pendant', necklaceColor: '#c0c0c0', headwearStyle: 'none', headwearColor: '', };
        const { characterGroup, body_parts } = createCharacter(tellerCustomization);
        const tellerMesh = new THREE.Group();
        tellerMesh.add(characterGroup);
        tellerMesh.name = "teller_npc";
        state.teller.body_parts = body_parts;
        tellerMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
        return tellerMesh;
    };
    state.teller.mesh = createTellerNPC();
    state.scene.add(state.teller.mesh);
    state.teller.mesh.position.set(bankOrigin.x + 6, bankOrigin.y + 0.5 + state.teller.height / 2, bankOrigin.z + 14);
    state.teller.mesh.rotation.y = -Math.PI / 2;

    const createTeacherNPC = () => {
        const teacherCustomization: CharacterCustomization = { gender: 'female', skinColor: '#e0a382', hairStyle: 'bun', hairColor: '#5a3825', eyeColor: '#6B4226', facialHairStyle: 'none', facialHairColor: '', shirtStyle: 'longsleeve', shirtColor: '#8b5cf6', pantsStyle: 'skirt', pantsColor: '#44403c', shoeColor: '#1a1a1a', hatStyle: 'none', hatColor: '', glassesStyle: 'round', glassesColor: '#222222', necklaceStyle: 'none', necklaceColor: '', headwearStyle: 'none', headwearColor: '', };
        const { characterGroup, body_parts } = createCharacter(teacherCustomization);
        const teacherMesh = new THREE.Group();
        teacherMesh.add(characterGroup);
        teacherMesh.name = "teacher_npc";
        state.teacher.body_parts = body_parts;
        teacherMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
        return teacherMesh;
    };
    state.teacher.mesh = createTeacherNPC();
    state.scene.add(state.teacher.mesh);
    state.teacher.mesh.position.set(12, 1.2, -106);
    state.teacher.mesh.rotation.y = Math.PI;

    const createWizardNPC = () => {
        const wizardCustomization: CharacterCustomization = { gender: 'male', skinColor: '#fcc2a2', hairStyle: 'short', hairColor: '#e6e6e6', eyeColor: '#9932CC', facialHairStyle: 'beard', facialHairColor: '#e6e6e6', shirtStyle: 'longsleeve', shirtColor: '#6b21a8', pantsStyle: 'skirt', pantsColor: '#6b21a8', shoeColor: '#000000', hatStyle: 'none', hatColor: '', glassesStyle: 'none', glassesColor: '', necklaceStyle: 'pendant', necklaceColor: '#ffd700', headwearStyle: 'none', headwearColor: '', };
        const { characterGroup, body_parts, createVoxel } = createCharacter(wizardCustomization);
        const wizardMesh = new THREE.Group();
        wizardMesh.add(characterGroup);
        wizardMesh.name = "wizard_npc";
        state.wizard.body_parts = body_parts;
        
        // Wizard Hat
        const hat = new THREE.Group(); const hatColor = '#4c1d95'; const hatY = 6;
        for (let y = 0; y < 6; y++) { for (let r = 0; r < 20; r++) { const a = r / 20 * Math.PI * 2; const radius = 3 * (1 - y / 5); hat.add(createVoxel(new THREE.Vector3(Math.cos(a) * radius, hatY + y, Math.sin(a) * radius), hatColor)); } }
        for (let x = -3; x <= 3; x++) hat.add(createVoxel(new THREE.Vector3(x, hatY, -3), hatColor));
        body_parts.head.add(hat);

        // Magic Wand
        const wand = new THREE.Group();
        const wandLen = 6;
        for(let y=0; y<wandLen; y++) wand.add(createVoxel(new THREE.Vector3(0, -2 + y, 1), '#5a3825'));
        wand.add(createVoxel(new THREE.Vector3(0, -2 + wandLen, 1), '#22d3ee')); // Glowing tip
        wand.rotation.x = Math.PI / 2;
        // Adjusted position to properly sit in the hand (scaled by voxelSize 0.18)
        wand.position.set(0, -4.0 * 0.18, 0);
        body_parts.armR.add(wand);

        wizardMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
        return wizardMesh;
    };
    state.wizard.mesh = createWizardNPC();
    state.scene.add(state.wizard.mesh);
    // Across from the bank at -8, -68. Let's put him at -45, -54 (green field across from bank on Z-68/X axis)
    state.wizard.mesh.position.set(-45, 1.3, -54);
    state.wizard.mesh.rotation.y = -Math.PI / 2;


    const createConstructionWorkerNPC = () => {
        const gender = pickRandom(['male', 'female'] as const);
        const workerCustomization: CharacterCustomization = { gender: gender, skinColor: pickRandom(SKIN_COLORS), hairStyle: 'short', hairColor: pickRandom(HAIR_COLORS), eyeColor: '#6B4226', facialHairStyle: 'none', facialHairColor: '', shirtStyle: 'tshirt', shirtColor: '#f97316', pantsStyle: 'jeans', pantsColor: '#3b82f6', shoeColor: '#5a3825', hatStyle: 'none', hatColor: '', glassesStyle: 'none', glassesColor: '', necklaceStyle: 'none', necklaceColor: '', headwearStyle: 'none', headwearColor: '', };
        const { characterGroup, body_parts, createVoxel } = createCharacter(workerCustomization);
        const workerMesh = new THREE.Group();
        workerMesh.add(characterGroup);
        workerMesh.name = "construction_worker_npc";
        const hat = new THREE.Group(); const hatColor = '#facc15'; const hatY = 5.5;
        for (let y = 0; y < 2; y++) { for (let r = 0; r < 20; r++) { const a = r / 20 * Math.PI * 2; const radius = 2.5 * (1 - y / 8); hat.add(createVoxel(new THREE.Vector3(Math.cos(a) * radius, hatY + y, Math.sin(a) * radius), hatColor)); } }
        for (let x = -3; x <= 3; x++) hat.add(createVoxel(new THREE.Vector3(x, hatY, -2.5), hatColor));
        hat.add(createVoxel(new THREE.Vector3(-2, hatY, -3.5), hatColor)); hat.add(createVoxel(new THREE.Vector3(2, hatY, -3.5), hatColor));
        body_parts.head.add(hat);
        workerMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
        return { mesh: workerMesh, body_parts, gender };
    };
    const emptyLotCenters = [{ pos: [154, -1, 22] }, { pos: [154, -1, 40] }, { pos: [172, -1, 22] }, { pos: [172, -1, 40] }, { pos: [66, -1, -54] }, { pos: [-60, -1, -12] }, { pos: [6, -1, -12] }, { pos: [66, -1, -12] }, { pos: [66, -1, 36] }, { pos: [-128, -1, 0] }, { pos: [128, -1, -40] }, { pos: [128, -1, 80] }, { pos: [0, -1, 120] }, { pos: [66, -1, 120] }, { pos: [-60, -1, -110] }, { pos: [66, -1, -110] },];
    const GROUND_Y = 1.3;
    emptyLotCenters.forEach((lot, index) => {
        const { mesh, body_parts, gender } = createConstructionWorkerNPC();
        mesh.position.set(lot.pos[0] + 3, GROUND_Y, lot.pos[2] + 3);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        const name = gender === 'male' ? pickRandom(MALE_NAMES) : pickRandom(FEMALE_NAMES);
        const persona = `You are ${name}, a hardworking construction worker. You are standing on your assigned plot of land, ready to build whatever the user imagines. You are friendly, practical, and eager to get to work. If the user mentions building something, ask for details if needed, or just say you're on it and call the "buildStructure" tool. You MUST call the "buildStructure" tool with the user's description to actually build. Keep responses concise and professional but friendly.`;
        state.constructionWorkers.push({ mesh, body_parts, isBuilding: false, isPreparing: false, target: new THREE.Vector3(...lot.pos), buildQueue: [], buildCooldown: 0, id: `worker_${index}`, name: name, persona: persona, isTalking: false, });
        state.scene.add(mesh);
    });

    // ... Windows setup ...
    const pizzaWindowMat = new THREE.MeshLambertMaterial({ color: PIZZA_DOOR_COLOR, transparent: true, opacity: 0.6 });
    const pizzaWindowsGroup = new THREE.Group();
    const frontWindowGeo = new THREE.BoxGeometry(0.2, 1, 1);
    const windowYStart = 2; const windowYEnd = 6;
    for (let y = windowYStart; y <= windowYEnd; y++) {
      for (let z = 3; z < pizzaDoorZStart_local - 2; z++) { const pane = new THREE.Mesh(frontWindowGeo, pizzaWindowMat); pane.position.set(pizzaShopOrigin.x, pizzaShopOrigin.y + y + 0.5, pizzaShopOrigin.z + z + 0.5); pizzaWindowsGroup.add(pane); }
      for (let z = pizzaDoorZStart_local + pizzaDoorWidth + 2; z < shopDepth - 3; z++) { const pane = new THREE.Mesh(frontWindowGeo, pizzaWindowMat); pane.position.set(pizzaShopOrigin.x, pizzaShopOrigin.y + y + 0.5, pizzaShopOrigin.z + z + 0.5); pizzaWindowsGroup.add(pane); }
    }
    const sideWindowGeo = new THREE.BoxGeometry(1, 1, 0.2);
    for (let y = windowYStart; y <= windowYEnd; y++) {
        for (let x = 4; x <= 8; x++) { const pane = new THREE.Mesh(sideWindowGeo, pizzaWindowMat); pane.position.set(pizzaShopOrigin.x + x + 0.5, pizzaShopOrigin.y + y + 0.5, pizzaShopOrigin.z); pizzaWindowsGroup.add(pane); }
        for (let x = shopWidth - 9; x <= shopWidth - 5; x++) { const pane = new THREE.Mesh(sideWindowGeo, pizzaWindowMat); pane.position.set(pizzaShopOrigin.x + x + 0.5, pizzaShopOrigin.y + y + 0.5, pizzaShopOrigin.z); pizzaWindowsGroup.add(pane); }
    }
    pizzaWindowsGroup.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
    state.scene.add(pizzaWindowsGroup);

    const bankWindowsGroup = new THREE.Group();
    const bankWindowGeo = new THREE.BoxGeometry(0.1, 1, 1);
    const BANK_GLASS_COLOR = '#a7f3d0';
    const bankWindowMat = new THREE.MeshLambertMaterial({ color: BANK_GLASS_COLOR, transparent: true, opacity: 0.5 });
    const bankDepth = 28; const counterX_local = 4; const counterHeight_bank = 2; const glassBaseY = bankOrigin.y + counterHeight_bank + 1; const glassAbsX = bankOrigin.x + counterX_local;
    for (let y = 0; y < 2; y++) { for (let z = 5; z < bankDepth - 5; z++) { if (z % 6 === 0) continue; const pane = new THREE.Mesh(bankWindowGeo, bankWindowMat); pane.position.set(glassAbsX, glassBaseY + y + 0.5, bankOrigin.z + z + 0.5); bankWindowsGroup.add(pane); } }
    state.scene.add(bankWindowsGroup);

    const storeOrigin = { x: -8, y: -1, z: 88 };
    const storeWidth = 32; const storeHeight = 18; const storeDoorXStart = Math.floor(storeWidth / 2) - 2; const storeDoorWidth = 4; const storeDoorHeight = 5;
    const storeWindowsGroup = new THREE.Group();
    const storeWindowGeo = new THREE.BoxGeometry(1, 1, 0.2);
    const storeWindowMat = new THREE.MeshLambertMaterial({ color: '#60a5fa', transparent: true, opacity: 0.4 });
    const createStoreWindows = (minY: number, maxY: number) => { for (let y = minY; y < maxY; y++) { for (let x = 2; x < storeWidth - 2; x++) { const isDoorArea = y < storeDoorHeight + 1 && x >= storeDoorXStart && x < storeDoorXStart + storeDoorWidth; if (!isDoorArea) { const pane = new THREE.Mesh(storeWindowGeo, storeWindowMat); pane.position.set(storeOrigin.x + x + 0.5, storeOrigin.y + y + 0.5, storeOrigin.z); storeWindowsGroup.add(pane); } } } };
    createStoreWindows(2, 8); createStoreWindows(11, 17);
    state.scene.add(storeWindowsGroup);
    const storeDoorCenterX = storeOrigin.x + storeDoorXStart + (storeDoorWidth / 2) - 0.5; const storeDoorCenterY = storeOrigin.y + (storeDoorHeight / 2) + 0.5; const storeDoorCenterZ = storeOrigin.z;
    const storeLeftPanel = new THREE.Group(); const storeRightPanel = new THREE.Group();
    const storeDoorPanelGeo = new THREE.BoxGeometry(storeDoorWidth / 2, storeDoorHeight, 0.2); const storeDoorMat = new THREE.MeshLambertMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 });
    storeLeftPanel.add(new THREE.Mesh(storeDoorPanelGeo, storeDoorMat)); storeRightPanel.add(new THREE.Mesh(storeDoorPanelGeo, storeDoorMat));
    const storePanelOffset = storeDoorWidth / 4;
    storeLeftPanel.position.set(storeDoorCenterX - storePanelOffset, storeDoorCenterY, storeDoorCenterZ); storeRightPanel.position.set(storeDoorCenterX + storePanelOffset, storeDoorCenterY, storeDoorCenterZ);
    state.scene.add(storeLeftPanel, storeRightPanel);
    state.doors.push({ leftPanel: storeLeftPanel, rightPanel: storeRightPanel, centerPosition: new THREE.Vector3(storeDoorCenterX, storeDoorCenterY, storeDoorCenterZ), isOpen: false, axis: 'x', width: storeDoorWidth, });

    const dealershipOrigin = { x: -72, y: -1, z: 16 };
    const dealershipWidth = 32; const dealershipDepth = 40; const dealershipHeight = 10; const dealershipDoorZStart = Math.floor(dealershipDepth / 2) - 2; const dealershipDoorWidth = 4; const dealershipDoorHeight = 5;
    const dealershipWindowMat = new THREE.MeshLambertMaterial({ color: '#60a5fa', transparent: true, opacity: 0.4 });
    const dealershipWindowsGroup = new THREE.Group();
    const frontWallX = dealershipOrigin.x + dealershipWidth - 1;
    const dealershipFrontWindowGeo = new THREE.BoxGeometry(0.2, 1, 1);
    for (let y = 1; y < dealershipHeight; y++) { for (let z = 0; z < dealershipDepth; z++) { const isDoorArea = y <= dealershipDoorHeight && z >= dealershipDoorZStart && z < dealershipDoorZStart + dealershipDoorWidth; if (!isDoorArea) { const pane = new THREE.Mesh(dealershipFrontWindowGeo, dealershipWindowMat); pane.position.set(frontWallX + 0.5, dealershipOrigin.y + y + 0.5, dealershipOrigin.z + z + 0.5); dealershipWindowsGroup.add(pane); } } }
    const sideWallZ = dealershipOrigin.z + dealershipDepth - 1;
    const dealershipSideWindowGeo = new THREE.BoxGeometry(1, 1, 0.2);
    for (let y = 1; y < dealershipHeight; y++) { for (let x = 0; x < dealershipWidth; x++) { const pane = new THREE.Mesh(dealershipSideWindowGeo, dealershipWindowMat); pane.position.set(dealershipOrigin.x + x + 0.5, dealershipOrigin.y + y + 0.5, sideWallZ + 0.5); dealershipWindowsGroup.add(pane); } }
    state.scene.add(dealershipWindowsGroup);
    const dealershipDoorCenterX = dealershipOrigin.x + dealershipWidth - 1; const dealershipDoorCenterY = dealershipOrigin.y + (dealershipDoorHeight / 2) + 0.5; const dealershipDoorCenterZ = dealershipOrigin.z + dealershipDoorZStart + (dealershipDoorWidth / 2) - 0.5;
    const dealershipLeftPanel = new THREE.Group(); const dealershipRightPanel = new THREE.Group();
    const dealershipDoorPanelGeo = new THREE.BoxGeometry(0.2, dealershipDoorHeight, dealershipDoorWidth / 2); const dealershipDoorMat = new THREE.MeshLambertMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 });
    dealershipLeftPanel.add(new THREE.Mesh(dealershipDoorPanelGeo, dealershipDoorMat)); dealershipRightPanel.add(new THREE.Mesh(dealershipDoorPanelGeo, dealershipDoorMat));
    const dealershipPanelOffset = dealershipDoorWidth / 4;
    dealershipLeftPanel.position.set(dealershipDoorCenterX + 0.5, dealershipDoorCenterY, dealershipDoorCenterZ - dealershipPanelOffset); dealershipRightPanel.position.set(dealershipDoorCenterX + 0.5, dealershipDoorCenterY, dealershipDoorCenterZ + dealershipPanelOffset);
    state.scene.add(dealershipLeftPanel, dealershipRightPanel);
    state.doors.push({ leftPanel: dealershipLeftPanel, rightPanel: dealershipRightPanel, centerPosition: new THREE.Vector3(dealershipDoorCenterX, dealershipDoorCenterY, dealershipDoorCenterZ), isOpen: false, axis: 'z', width: dealershipDoorWidth, });

    const schoolOrigin = { x: -6, y: -1, z: -140 };
    const schoolWidth = 24; const schoolDepth = 40; const schoolHeight = 16; const schoolDoorZStart_local = Math.floor(schoolDepth / 2) - 2; const schoolDoorWidth = 4; const schoolDoorHeight = 6;
    const schoolWindowMat = new THREE.MeshLambertMaterial({ color: '#add8e6', transparent: true, opacity: 0.6 });
    const schoolWindowsGroup = new THREE.Group();
    const makePanes = (geo: THREE.BoxGeometry, x: number, y: number, z: number) => { const pane = new THREE.Mesh(geo, schoolWindowMat); pane.position.set(x + 0.5, y + 0.5, z + 0.5); schoolWindowsGroup.add(pane); };
    const frontBackWallGeo = new THREE.BoxGeometry(0.2, 1, 1);
    for (let y_base of [2, 10]) { for (let h = 0; h < 4; h++) { for (let z = 3; z < schoolDepth - 3; z++) { if ((z-3) % 6 < 4) { makePanes(frontBackWallGeo, schoolOrigin.x, schoolOrigin.y + y_base + h, schoolOrigin.z + z); makePanes(frontBackWallGeo, schoolOrigin.x + schoolWidth - 1, schoolOrigin.y + y_base + h, schoolOrigin.z + z); } } } }
    const sideWallGeo_school = new THREE.BoxGeometry(1, 1, 0.2);
    for (let y_base of [2, 10]) { for (let h = 0; h < 4; h++) { for (let x = 3; x < schoolWidth - 3; x++) { if ((x-3) % 5 < 3) { makePanes(sideWallGeo_school, schoolOrigin.x + x, schoolOrigin.y + y_base + h, schoolOrigin.z); makePanes(sideWallGeo_school, schoolOrigin.x + x, schoolOrigin.y + y_base + h, schoolOrigin.z + schoolDepth - 1); } } } }
    state.scene.add(schoolWindowsGroup);
    const schoolDoorCenterX = schoolOrigin.x; const schoolDoorCenterY = schoolOrigin.y + (schoolDoorHeight / 2) + 0.5; const schoolDoorCenterZ = schoolOrigin.z + schoolDoorZStart_local + (schoolDoorWidth / 2) - 0.5;
    const schoolLeftPanel = new THREE.Group(); const schoolRightPanel = new THREE.Group();
    const schoolDoorPanelGeo = new THREE.BoxGeometry(0.2, schoolDoorHeight, schoolDoorWidth / 2); const schoolDoorMat = new THREE.MeshLambertMaterial({ color: '#8B4513', transparent: true, opacity: 0.9 });
    schoolLeftPanel.add(new THREE.Mesh(schoolDoorPanelGeo, schoolDoorMat)); schoolRightPanel.add(new THREE.Mesh(schoolDoorPanelGeo, schoolDoorMat));
    const schoolPanelOffset = schoolDoorWidth / 4;
    schoolLeftPanel.position.set(schoolDoorCenterX, schoolDoorCenterY, schoolDoorCenterZ - schoolPanelOffset); schoolRightPanel.position.set(schoolDoorCenterX, schoolDoorCenterY, schoolDoorCenterZ + schoolPanelOffset);
    state.scene.add(schoolLeftPanel, schoolRightPanel);
    state.doors.push({ leftPanel: schoolLeftPanel, rightPanel: schoolRightPanel, centerPosition: new THREE.Vector3(schoolDoorCenterX, schoolDoorCenterY, schoolDoorCenterZ), isOpen: false, axis: 'z', width: schoolDoorWidth, });

    const skyscraperOrigin = { x: -74, y: -1, z: 88 };
    const skyscraperWidth = 28; const skyscraperDepth = 28; const skyscraperHeight = 70; const skyscraperFloorHeight = 4;
    const skyscraperWindowsGroup = new THREE.Group();
    const skyscraperWindowMat = new THREE.MeshLambertMaterial({ color: '#60a5fa', transparent: true, opacity: 0.4 });
    const windowPaneGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    for (let y = 1; y <= skyscraperHeight; y++) {
        const isFloorLevel = y % skyscraperFloorHeight === 0; const isLobbyLevel = y <= 3;
        if (isFloorLevel) continue;
        for (let i = 1; i < skyscraperWidth - 1; i++) {
            const paneF = new THREE.Mesh(windowPaneGeo, skyscraperWindowMat); paneF.position.set(skyscraperOrigin.x + i, skyscraperOrigin.y + y, skyscraperOrigin.z); skyscraperWindowsGroup.add(paneF);
            const entranceWidth = 10; const entranceStart = Math.floor((skyscraperWidth - entranceWidth) / 2); const isEntrance = isLobbyLevel && i > entranceStart && i < entranceStart + entranceWidth;
            if (!isEntrance) { const paneB = new THREE.Mesh(windowPaneGeo, skyscraperWindowMat); paneB.position.set(skyscraperOrigin.x + i, skyscraperOrigin.y + y, skyscraperOrigin.z + skyscraperDepth - 1); skyscraperWindowsGroup.add(paneB); }
        }
        for (let i = 1; i < skyscraperDepth - 1; i++) {
            const paneL = new THREE.Mesh(windowPaneGeo, skyscraperWindowMat); paneL.position.set(skyscraperOrigin.x, skyscraperOrigin.y + y, skyscraperOrigin.z + i); skyscraperWindowsGroup.add(paneL);
            const paneR = new THREE.Mesh(windowPaneGeo, skyscraperWindowMat); paneR.position.set(skyscraperOrigin.x + skyscraperWidth - 1, skyscraperOrigin.y + y, skyscraperOrigin.z + i); skyscraperWindowsGroup.add(paneR);
        }
    }
    state.scene.add(skyscraperWindowsGroup);

    // ... Cars and rest of scene ...
    const CAR_COLORS = ['#ef4444', '#3b82f6', '#f97316', '#eab308', '#22c55e', '#f8fafc', '#44403c'];
    const NUM_CARS = 20; const CAR_Y_LEVEL = 0.5; const LANE_OFFSET = 5; const cornerOffset = 16;
    const roadX = [-96, -24, 36, 96]; const roadZ = [-84, -24, 0, 72];
    const y = CAR_Y_LEVEL;
    const pathPoints: THREE.Vector3[][] = [];
    const intersectionCenters: THREE.Vector3[] = [];
    roadX.forEach(x => { roadZ.forEach(z => { intersectionCenters.push(new THREE.Vector3(x, 0, z)); }); });
    state.intersectionCenters = intersectionCenters;
    const createCWPath = (x1: number, z1: number, x2: number, z2: number) => {
        const left = x1 + LANE_OFFSET; const right = x2 - LANE_OFFSET; const bottom = z1 + LANE_OFFSET; const top = z2 - LANE_OFFSET;
        return [ new THREE.Vector3(right, y, top + cornerOffset), new THREE.Vector3(right, y, top), new THREE.Vector3(right - cornerOffset, y, top), new THREE.Vector3(left + cornerOffset, y, top), new THREE.Vector3(left, y, top), new THREE.Vector3(left, y, top - cornerOffset), new THREE.Vector3(left, y, bottom + cornerOffset), new THREE.Vector3(left, y, bottom), new THREE.Vector3(left + cornerOffset, y, bottom), new THREE.Vector3(right - cornerOffset, y, bottom), new THREE.Vector3(right, y, bottom), new THREE.Vector3(right, y, bottom + cornerOffset), ];
    };
    const createCCWPath = (x1: number, z1: number, x2: number, z2: number) => {
        const left = x1 - LANE_OFFSET; const right = x2 + LANE_OFFSET; const bottom = z1 - LANE_OFFSET; const top = z2 + LANE_OFFSET;
        return [ new THREE.Vector3(left, y, top - cornerOffset), new THREE.Vector3(left, y, top), new THREE.Vector3(left + cornerOffset, y, top), new THREE.Vector3(right - cornerOffset, y, top), new THREE.Vector3(right, y, top), new THREE.Vector3(right, y, top - cornerOffset), new THREE.Vector3(right, y, bottom + cornerOffset), new THREE.Vector3(right, y, bottom), new THREE.Vector3(right - cornerOffset, y, bottom), new THREE.Vector3(left + cornerOffset, y, bottom), new THREE.Vector3(left, y, bottom), new THREE.Vector3(left, y, bottom + cornerOffset), ];
    };
    for (let i = 0; i < roadX.length - 1; i++) { for (let j = 0; j < roadZ.length - 1; j++) { pathPoints.push(createCWPath(roadX[i], roadZ[j], roadX[i+1], roadZ[j+1])); pathPoints.push(createCCWPath(roadX[i], roadZ[j], roadX[i+1], roadZ[j+1])); } }
    pathPoints.push(createCWPath(roadX[0], roadZ[0], roadX[roadX.length-1], roadZ[roadZ.length-1])); pathPoints.push(createCCWPath(roadX[0], roadZ[0], roadX[roadX.length-1], roadZ[roadZ.length-1]));
    const curves = pathPoints.map(points => new THREE.CatmullRomCurve3(points, true, 'centripetal'));
    for (let i = 0; i < NUM_CARS; i++) {
        const color = CAR_COLORS[i % CAR_COLORS.length]; const carMesh = createCar(color);
        carMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
        const path = curves[i % curves.length]; const startProgress = Math.random();
        carMesh.position.copy(path.getPointAt(startProgress));
        state.cars.push({ 
            mesh: carMesh, 
            speed: 0, 
            desiredSpeed: 8 + Math.random() * 7, 
            timeStationary: 0, 
            path: path, 
            progress: startProgress, 
            offset: new THREE.Vector3(), 
            displacementVelocity: new THREE.Vector3() 
        });
        state.scene.add(carMesh);
    }
    const dealershipCarData = [ { pos: [-62, CAR_Y_LEVEL, 41], color: '#ef4444', rotationY: Math.PI / 2 }, { pos: [-52, CAR_Y_LEVEL, 31], color: '#f8fafc', rotationY: 0 }, { pos: [-67, CAR_Y_LEVEL, 10], color: '#3b82f6', rotationY: Math.PI / 2 }, { pos: [-60, CAR_Y_LEVEL, 10], color: '#eab308', rotationY: Math.PI / 2 }, { pos: [-53, CAR_Y_LEVEL, 10], color: '#222222', rotationY: Math.PI / 2 }, ];
    dealershipCarData.forEach(carData => {
        const carMesh = createCar(carData.color); carMesh.position.set(carData.pos[0], carData.pos[1], carData.pos[2]); carMesh.rotation.y = carData.rotationY;
        carMesh.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
        state.drivableCars.push({ mesh: carMesh, velocity: new THREE.Vector3(), steering: 0, });
        state.scene.add(carMesh);
    });
    const trainTrackBoundary = worldSize / 2 - 3; const trainY = 2; const cornerRadius = 10;
    const trainPathPoints = [ new THREE.Vector3(trainTrackBoundary - cornerRadius, trainY, trainTrackBoundary), new THREE.Vector3(trainTrackBoundary, trainY, trainTrackBoundary - cornerRadius), new THREE.Vector3(trainTrackBoundary, trainY, -trainTrackBoundary + cornerRadius), new THREE.Vector3(trainTrackBoundary - cornerRadius, trainY, -trainTrackBoundary), new THREE.Vector3(-trainTrackBoundary + cornerRadius, trainY, -trainTrackBoundary), new THREE.Vector3(-trainTrackBoundary, trainY, -trainTrackBoundary + cornerRadius), new THREE.Vector3(-trainTrackBoundary, trainY, trainTrackBoundary - cornerRadius), new THREE.Vector3(-trainTrackBoundary + cornerRadius, trainY, trainTrackBoundary), ];
    state.train.path = new THREE.CatmullRomCurve3(trainPathPoints, true, 'catmullrom', 0.7);
    state.train.mesh = createTrain();
    state.scene.add(state.train.mesh);

    const roadXPositions = roadX.sort((a,b)=> a-b);
    const roadZPositions = roadZ.sort((a,b)=> a-b);
    const SIDEWALK_WIDTH = 6; const LANE_WIDTH = 8; const MEDIAN_WIDTH = 2; const ROADWAY_HALF_WIDTH = LANE_WIDTH + Math.floor(MEDIAN_WIDTH / 2);
    const sidewalkPaths: THREE.CatmullRomCurve3[] = [];
    const PEDESTRIAN_Y_LEVEL = 1.3;
    const SIDEWALK_OFFSET = ROADWAY_HALF_WIDTH + SIDEWALK_WIDTH / 2;
    roadXPositions.forEach(xPos => {
        for (let i = 0; i < roadZPositions.length - 1; i++) {
            const zStart = roadZPositions[i] + 10; const zEnd = roadZPositions[i+1] - 10;
            if (Math.abs(zEnd - zStart) < 20) continue;
            sidewalkPaths.push(new THREE.CatmullRomCurve3([ new THREE.Vector3(xPos + SIDEWALK_OFFSET, PEDESTRIAN_Y_LEVEL, zStart), new THREE.Vector3(xPos + SIDEWALK_OFFSET, PEDESTRIAN_Y_LEVEL, zEnd) ]));
            sidewalkPaths.push(new THREE.CatmullRomCurve3([ new THREE.Vector3(xPos - SIDEWALK_OFFSET, PEDESTRIAN_Y_LEVEL, zStart), new THREE.Vector3(xPos - SIDEWALK_OFFSET, PEDESTRIAN_Y_LEVEL, zEnd) ]));
        }
    });
    roadZPositions.forEach(zPos => {
        for (let i = 0; i < roadXPositions.length - 1; i++) {
            const xStart = roadXPositions[i] + 10; const xEnd = roadXPositions[i+1] - 10;
            if (Math.abs(xEnd - xStart) < 20) continue;
            sidewalkPaths.push(new THREE.CatmullRomCurve3([ new THREE.Vector3(xStart, PEDESTRIAN_Y_LEVEL, zPos + SIDEWALK_OFFSET), new THREE.Vector3(xEnd, PEDESTRIAN_Y_LEVEL, zPos + SIDEWALK_OFFSET) ]));
            sidewalkPaths.push(new THREE.CatmullRomCurve3([ new THREE.Vector3(xStart, PEDESTRIAN_Y_LEVEL, zPos - SIDEWALK_OFFSET), new THREE.Vector3(xEnd, PEDESTRIAN_Y_LEVEL, zPos - SIDEWALK_OFFSET) ]));
        }
    });
    state.sidewalkPaths = sidewalkPaths;

    // Pedestrians
    const numPedestrians = 15;
    for (let i = 0; i < numPedestrians; i++) {
        const { mesh, body_parts, name, persona } = createRandomPedestrian();
        const path = sidewalkPaths[Math.floor(Math.random() * sidewalkPaths.length)];
        state.scene.add(mesh);
        state.pedestrians.push({
            mesh, body_parts, run_time: 0, path, progress: Math.random(), speed: (Math.random() * 1.5 + 1.5) * (Math.random() < 0.5 ? 1 : -1),
            id: i, name, persona, isTalking: false, offset: new THREE.Vector3(), displacementVelocity: new THREE.Vector3(), isFollowingPlayer: false
        });
    }

    const animate = () => {
      const delta = Math.min(state.clock.getDelta(), 0.1);
      const logic = logicRef.current;
      
      if (logic.updatePlayer) logic.updatePlayer(delta);
      if (logic.updateCamera) logic.updateCamera(delta);
      if (logic.updateTargetBlock) logic.updateTargetBlock();
      if (logic.updateDoors) logic.updateDoors(delta);
      if (logic.updateNPC) logic.updateNPC(delta);
      if (logic.updateTeller) logic.updateTeller(delta);
      if (logic.updateTeacher) logic.updateTeacher(delta);
      if (logic.updateWizard) logic.updateWizard(delta);
      if (logic.updateCustomNPCs) logic.updateCustomNPCs(delta);
      // Update AI car visibility and physics
      state.cars.forEach(car => { car.mesh.visible = showCarsRef.current; });
      if (logic.updateCars) logic.updateCars(delta);
      
      // Update drivable car visibility and physics
      state.drivableCars.forEach(car => { car.mesh.visible = showCarsRef.current; });
      if (logic.updateDrivableCars) logic.updateDrivableCars(delta);
      
      // Update pedestrian visibility and physics
      state.pedestrians.forEach(ped => { ped.mesh.visible = showPedestriansRef.current; });
      if (logic.updatePedestrians) logic.updatePedestrians(delta);
      
      if (logic.updateConstructionWorkers) logic.updateConstructionWorkers(delta);
      if (logic.updateTrain) logic.updateTrain(delta);
      if (logic.updateCarCollisions) logic.updateCarCollisions();
      
      if (logic.updateCarProximityCheck) logic.updateCarProximityCheck();
      if (logic.updateForSaleProximityCheck) logic.updateForSaleProximityCheck();
      if (logic.updateItemProximityCheck) logic.updateItemProximityCheck();
      if (logic.updateNpcProximityCheck) logic.updateNpcProximityCheck();

      if (state.renderer && state.scene && state.camera) {
          state.renderer.render(state.scene, state.camera);
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        if (rendererRef.current && mountRef.current) {
            mountRef.current.removeChild(rendererRef.current.domElement);
        }
        if (state.renderer) {
             state.renderer.dispose();
        }
    };
  }, []);

  return (
    <div 
        ref={mountRef} 
        className="w-full h-full" 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }}
    />
  );
});

VoxelWorld.displayName = 'VoxelWorld';

export default VoxelWorld;
