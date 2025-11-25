
import React, { useState, useCallback, useRef, useEffect } from 'react';
import VoxelWorld, { VoxelWorldApi, NearbyNPC } from './components/VoxelWorld';
import Controls from './components/Controls';
import Joystick from './components/Joystick';
import CustomizationMenu from './components/CustomizationMenu';
import MainMenu from './components/MainMenu';
import BuildingPrompt from './components/BuildingPrompt';
import Captions from './components/Captions';
import InventoryBar from './components/InventoryBar';
import LessonModal from './components/LessonModal';
import StaminaBar from './components/StaminaBar';
import LowStaminaPopup from './components/LowStaminaPopup';
import QuestTracker from './components/QuestTracker';
import { Voxel, CharacterCustomization, InventoryItem, GameMode, WorldTheme, Quest } from './types';
import { GoogleGenAI, Type } from "@google/genai";

const INITIAL_WORLD_SIZE = 320;
const GROUND_LEVEL = -1; 
const BEDROCK_LEVEL = -2;

const DEFAULT_THEME: WorldTheme = {
  skyColor: '#87ceeb',
  fogColor: '#87ceeb',
  ambientLightColor: '#ffffff',
  directionalLightColor: '#ffffff',
  grassColor: '#567d46',
  roadColor: '#4a4a4a',
  sidewalkColor: '#a0a0a0',
  buildingWallColor: '#e5e7eb',
  roofColor: '#374151',
  treeTrunkColor: '#5a3825',
  treeLeavesColor: '#228b22',
  cloudColor: '#ffffff',
  bedrockColor: '#808080',
};

function generateWorldData(theme: WorldTheme) {
  const blockMap = new Map<string, { color: string; position: [number, number, number] }>();
  const forSaleSigns: [number, number, number][] = [];

  const setBlock = (pos: [number, number, number], color: string) => {
    blockMap.set(pos.join(','), { position: pos, color });
  };
  
  const buildForSaleSign = (center: [number, number, number], facing: 'x' | 'z' = 'z') => {
    forSaleSigns.push(center);
    const [cx, cy, cz] = center;
    const POST_COLOR = theme.treeTrunkColor;
    const SIGN_PANEL_COLOR = '#ffffff';
    const TEXT_COLOR = '#ef4444'; // red-500

    // Post
    setBlock([cx, cy + 1, cz], POST_COLOR);
    setBlock([cx, cy + 2, cz], POST_COLOR);
    setBlock([cx, cy + 3, cz], POST_COLOR);

    // Sign Panel (5 wide, 3 high)
    const signYBase = cy + 4;
    if (facing === 'z') { // Panel is on X-Y plane
        for (let x = -2; x <= 2; x++) {
          for (let y = 0; y < 3; y++) {
            setBlock([cx + x, signYBase + y, cz], SIGN_PANEL_COLOR);
          }
        }
        // Text replaces panel blocks
        setBlock([cx - 1, signYBase + 1, cz], TEXT_COLOR);
        setBlock([cx, signYBase + 1, cz], TEXT_COLOR);
        setBlock([cx + 1, signYBase + 1, cz], TEXT_COLOR);
    } else { // Panel is on Y-Z plane
        for (let z = -2; z <= 2; z++) {
          for (let y = 0; y < 3; y++) {
            setBlock([cx, signYBase + y, cz + z], SIGN_PANEL_COLOR);
          }
        }
        // Text replaces panel blocks
        setBlock([cx, signYBase + 1, cz - 1], TEXT_COLOR);
        setBlock([cx, signYBase + 1, cz], TEXT_COLOR);
        setBlock([cx, signYBase + 1, cz + 1], TEXT_COLOR);
    }
  };

  const GRASS_COLOR = theme.grassColor;
  const ROAD_COLOR = theme.roadColor;
  const SIDEWALK_COLOR = theme.sidewalkColor;
  const MEDIAN_COLOR = '#facc15';
  const CROSSWALK_COLOR = '#ffffff';
  const BEDROCK_COLOR = theme.bedrockColor;

  const halfSize = INITIAL_WORLD_SIZE / 2;
  
  const SIDEWALK_WIDTH = 6;
  const LANE_WIDTH = 8;
  const MEDIAN_WIDTH = 2;
  const ROADWAY_HALF_WIDTH = LANE_WIDTH + Math.floor(MEDIAN_WIDTH / 2);
  const CORRIDOR_HALF_WIDTH = ROADWAY_HALF_WIDTH + SIDEWALK_WIDTH;

  const roads = [
    { axis: 'z', position: -84 }, { axis: 'z', position: -24 }, { axis: 'z', position: 0 }, { axis: 'z', position: 72 },
    { axis: 'x', position: -96 }, { axis: 'x', position: -24 }, { axis: 'x', position: 36 }, { axis: 'x', position: 96 },
  ];
  const roadXPositions = roads.filter(r => r.axis === 'x').map(r => r.position).sort((a, b) => a - b);
  const roadZPositions = roads.filter(r => r.axis === 'z').map(r => r.position).sort((a, b) => a - b);
  
  const fillBlockWithGrass = (xStart: number, xEnd: number, zStart: number, zEnd: number) => {
    for (let x = xStart; x <= xEnd; x++) {
      for (let z = zStart; z <= zEnd; z++) {
        setBlock([x, GROUND_LEVEL, z], GRASS_COLOR);
      }
    }
  };


  // Pass 1: Base terrain
  for (let x = -halfSize; x < halfSize; x++) {
    for (let z = -halfSize; z < halfSize; z++) {
      setBlock([x, BEDROCK_LEVEL, z], BEDROCK_COLOR);
      setBlock([x, GROUND_LEVEL, z], GRASS_COLOR);
    }
  }

  // Pass 2: Roads and Sidewalks
  for (let x = -halfSize; x < halfSize; x++) {
    for (let z = -halfSize; z < halfSize; z++) {
      const onRoadX = roadXPositions.find(pos => Math.abs(x - pos) <= CORRIDOR_HALF_WIDTH);
      const onRoadZ = roadZPositions.find(pos => Math.abs(z - pos) <= CORRIDOR_HALF_WIDTH);
      
      if (!onRoadX && !onRoadZ) continue;

      const isIntersection = onRoadX !== undefined && onRoadZ !== undefined;
      const distToXCenter = onRoadX !== undefined ? Math.abs(x - onRoadX) : Infinity;
      const distToZCenter = onRoadZ !== undefined ? Math.abs(z - onRoadZ) : Infinity;

      if (isIntersection) {
        const inRoadBoxX = distToXCenter <= ROADWAY_HALF_WIDTH;
        const inRoadBoxZ = distToZCenter <= ROADWAY_HALF_WIDTH;

        if (inRoadBoxX && inRoadBoxZ) {
          // Center of intersection - Pavement only, no markings
          setBlock([x, GROUND_LEVEL, z], ROAD_COLOR);
        } else if (!inRoadBoxX && !inRoadBoxZ) {
          // Corners - Sidewalk
          setBlock([x, GROUND_LEVEL, z], SIDEWALK_COLOR);
        } else {
           // Crosswalk (Road extending into sidewalk line)
           setBlock([x, GROUND_LEVEL, z], ROAD_COLOR);
           
           // Zebra stripes
           if (inRoadBoxX) {
               // Crossing Z-road (vertical), stripes vary along X
               if (Math.abs(x - onRoadX!) % 2 === 0) setBlock([x, GROUND_LEVEL, z], CROSSWALK_COLOR);
           } else {
               // Crossing X-road (horizontal), stripes vary along Z
               if (Math.abs(z - onRoadZ!) % 2 === 0) setBlock([x, GROUND_LEVEL, z], CROSSWALK_COLOR);
           }
        }
      } else if (onRoadX !== undefined) {
        if (distToXCenter > ROADWAY_HALF_WIDTH) { setBlock([x, GROUND_LEVEL, z], SIDEWALK_COLOR); }
        else {
          setBlock([x, GROUND_LEVEL, z], ROAD_COLOR);
          if (distToXCenter < Math.ceil(MEDIAN_WIDTH / 2) && MEDIAN_WIDTH > 0) setBlock([x, GROUND_LEVEL, z], MEDIAN_COLOR);
        }
      } else if (onRoadZ !== undefined) {
        if (distToZCenter > ROADWAY_HALF_WIDTH) { setBlock([x, GROUND_LEVEL, z], SIDEWALK_COLOR); }
        else {
          setBlock([x, GROUND_LEVEL, z], ROAD_COLOR);
          if (distToZCenter < Math.ceil(MEDIAN_WIDTH / 2) && MEDIAN_WIDTH > 0) setBlock([x, GROUND_LEVEL, z], MEDIAN_COLOR);
        }
      }
    }
  }

  // Pass 2.5: Green Plots / Lawns
  const plotMargin = CORRIDOR_HALF_WIDTH + 1;
  fillBlockWithGrass(roadXPositions[0] + plotMargin, roadXPositions[1] - plotMargin, roadZPositions[0] + plotMargin, roadZPositions[1] - plotMargin);
  fillBlockWithGrass(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[0] + plotMargin, roadZPositions[1] - plotMargin);
  fillBlockWithGrass(roadXPositions[0] + plotMargin, roadXPositions[1] - plotMargin, roadZPositions[2] + plotMargin, roadZPositions[3] - plotMargin);
  fillBlockWithGrass(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[2] + plotMargin, roadZPositions[3] - plotMargin);
  fillBlockWithGrass(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[0] - 100, roadZPositions[0] - plotMargin);
  fillBlockWithGrass(roadXPositions[0] + plotMargin, roadXPositions[1] - plotMargin, roadZPositions[3] + plotMargin, roadZPositions[3] + 70);
  fillBlockWithGrass(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[3] + plotMargin, roadZPositions[3] + 70);
  
  // --- TREES & CLOUDS ---
  const TRUNK_COLOR = theme.treeTrunkColor;
  const LEAVES_COLOR = theme.treeLeavesColor;
  const CLOUD_COLOR = theme.cloudColor;

  const buildingZones = [
      { x: -8, z: 16, w: 24, d: 30 }, // Pizza
      { x: -8, z: -68, w: 20, d: 28 }, // Bank
      { x: -8, z: 88, w: 32, d: 36 }, // Sportswear
      { x: -72, z: 16, w: 32, d: 40 }, // Car Dealer
      { x: -6, z: -140, w: 24, d: 40 }, // School
      { x: 148, z: 16, w: 40, d: 40 }, // Construction area roughly
  ];

  const isObstructed = (x: number, z: number) => {
      for (const b of buildingZones) {
          if (x >= b.x - 3 && x < b.x + b.w + 3 && z >= b.z - 3 && z < b.z + b.d + 3) return true;
      }
      return false;
  };

  const buildTree = (x: number, z: number) => {
     const h = 3 + Math.floor(Math.random() * 4); 
     // Trunk
     for(let y = 0; y < h; y++) {
         setBlock([x, GROUND_LEVEL + 1 + y, z], TRUNK_COLOR);
     }
     // Leaves
     const leafStart = GROUND_LEVEL + 1 + h - 2;
     const leafEnd = GROUND_LEVEL + 1 + h + 1;
     for (let y = leafStart; y <= leafEnd; y++) {
         const radius = (y === leafEnd) ? 1 : 2;
         for (let lx = -radius; lx <= radius; lx++) {
             for (let lz = -radius; lz <= radius; lz++) {
                 if (Math.abs(lx) + Math.abs(lz) < radius * 1.5 + 0.5) {
                     setBlock([x + lx, y, z + lz], LEAVES_COLOR);
                 }
             }
         }
     }
  };

  const addTreesToZone = (xStart: number, xEnd: number, zStart: number, zEnd: number) => {
      const density = 0.02;
      for (let x = xStart + 2; x <= xEnd - 2; x+=3) {
          for (let z = zStart + 2; z <= zEnd - 2; z+=3) {
               if (Math.random() < density) {
                   if (!isObstructed(x, z)) {
                       buildTree(x, z);
                   }
               }
          }
      }
  };

  // Add trees to the green plots defined above
  addTreesToZone(roadXPositions[0] + plotMargin, roadXPositions[1] - plotMargin, roadZPositions[0] + plotMargin, roadZPositions[1] - plotMargin);
  addTreesToZone(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[0] + plotMargin, roadZPositions[1] - plotMargin);
  addTreesToZone(roadXPositions[0] + plotMargin, roadXPositions[1] - plotMargin, roadZPositions[2] + plotMargin, roadZPositions[3] - plotMargin);
  addTreesToZone(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[2] + plotMargin, roadZPositions[3] - plotMargin);
  addTreesToZone(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[0] - 100, roadZPositions[0] - plotMargin);
  addTreesToZone(roadXPositions[0] + plotMargin, roadXPositions[1] - plotMargin, roadZPositions[3] + plotMargin, roadZPositions[3] + 70);
  addTreesToZone(roadXPositions[1] + plotMargin, roadXPositions[2] - plotMargin, roadZPositions[3] + plotMargin, roadZPositions[3] + 70);

  const buildClouds = () => {
      const numClouds = 30;
      for (let i = 0; i < numClouds; i++) {
          const cx = Math.floor(Math.random() * INITIAL_WORLD_SIZE) - halfSize;
          const cz = Math.floor(Math.random() * INITIAL_WORLD_SIZE) - halfSize;
          const cy = 35 + Math.floor(Math.random() * 10);
          
          const w = 5 + Math.floor(Math.random() * 6);
          const l = 5 + Math.floor(Math.random() * 6);
          
          for (let x = 0; x < w; x++) {
              for (let z = 0; z < l; z++) {
                  const dx = x - w/2;
                  const dz = z - l/2;
                  if ((dx*dx)/(w*w/4) + (dz*dz)/(l*l/4) < 1) {
                       if (Math.random() > 0.3) setBlock([cx + x, cy, cz + z], CLOUD_COLOR);
                       if (Math.random() > 0.6) setBlock([cx + x, cy+1, cz + z], CLOUD_COLOR);
                  }
              }
          }
      }
  };
  buildClouds();


  // Pass 2.75: Train Track
  const GRAVEL_COLOR = '#80776b';
  const TIE_COLOR = '#5a3825';
  const RAIL_COLOR = '#a9a9a9';
  const trackBoundary = halfSize - 1;
  const trackWidth = 5;

  const buildTrackSection = (xStart: number, zStart: number, xEnd: number, zEnd: number) => {
    const isXAligned = (zEnd - zStart) < (xEnd - xStart);
    for (let x = xStart; x <= xEnd; x++) {
      for (let z = zStart; z <= zEnd; z++) {
        setBlock([x, GROUND_LEVEL, z], GRASS_COLOR);
        setBlock([x, GROUND_LEVEL, z], GRAVEL_COLOR);
        if (isXAligned) {
            if (x % 3 === 0) {
                setBlock([x, GROUND_LEVEL + 1, z - 1], TIE_COLOR);
                setBlock([x, GROUND_LEVEL + 1, z], TIE_COLOR);
                setBlock([x, GROUND_LEVEL + 1, z + 1], TIE_COLOR);
            }
        } else {
            if (z % 3 === 0) {
                setBlock([x - 1, GROUND_LEVEL + 1, z], TIE_COLOR);
                setBlock([x, GROUND_LEVEL + 1, z], TIE_COLOR);
                setBlock([x + 1, GROUND_LEVEL + 1, z], TIE_COLOR);
            }
        }
      }
    }
     for (let x = xStart; x <= xEnd; x++) {
      for (let z = zStart; z <= zEnd; z++) {
          if (isXAligned) {
            if (z === zStart + 1 || z === zEnd - 1) {
              setBlock([x, GROUND_LEVEL + 2, z], RAIL_COLOR);
            }
          } else {
             if (x === xStart + 1 || x === xEnd - 1) {
              setBlock([x, GROUND_LEVEL + 2, z], RAIL_COLOR);
            }
          }
      }
    }
  };
  
  buildTrackSection(-trackBoundary, -trackBoundary, trackBoundary, -trackBoundary + trackWidth - 1); // South
  buildTrackSection(-trackBoundary, trackBoundary - trackWidth + 1, trackBoundary, trackBoundary); // North
  buildTrackSection(-trackBoundary, -trackBoundary + trackWidth, -trackBoundary + trackWidth - 1, trackBoundary - trackWidth); // West
  buildTrackSection(trackBoundary - trackWidth + 1, -trackBoundary + trackWidth, trackBoundary, trackBoundary - trackWidth); // East


  const buildConstructionPlots = (origin: [number, number, number]) => {
    const [ox, oy, oz] = origin;
    const PLOT_COLOR = theme.grassColor === '#567d46' ? '#679457' : theme.grassColor; // Adjust plot color slightly or keep same
    const PLOT_SIZE = 13;
    const GAP = 5;

    for (let plotX = 0; plotX < 2; plotX++) {
      for (let plotZ = 0; plotZ < 2; plotZ++) {
        const startX = ox + plotX * (PLOT_SIZE + GAP);
        const startZ = oz + plotZ * (PLOT_SIZE + GAP);

        // Green plot
        for (let x = 0; x < PLOT_SIZE; x++) {
          for (let z = 0; z < PLOT_SIZE; z++) {
            setBlock([startX + x, oy, startZ + z], PLOT_COLOR);
          }
        }
        
        // Add "For Sale" sign in the middle
        const centerX = startX + Math.floor(PLOT_SIZE / 2);
        const centerZ = startZ + Math.floor(PLOT_SIZE / 2);
        buildForSaleSign([centerX, oy, centerZ], 'x');
      }
    }
  };
  
  const buildPizzaShop = (origin: [number, number, number]) => {
      const [ox, oy, oz] = origin;
      const width = 24; 
      const depth = 30; 
      const height = 9;
      const WALL_COLOR = '#b95000';
      const ROOF_COLOR = theme.roofColor;
      const DOOR_FRAME_COLOR = '#5a3825';
      const COUNTER_COLOR = '#d3d3d3';
      const OVEN_COLOR = '#222222';
      const FIRE_COLOR = '#ff4500';
      const TABLE_COLOR = '#654321';
      const BOOTH_COLOR = '#c00000';
      const TILE_A_COLOR = '#ffffff';
      const TILE_B_COLOR = '#000000';
      // Defined locally to fix error
      const TEXT_COLOR = '#ef4444'; 

      for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { const tileColor = (x + z) % 2 === 0 ? TILE_A_COLOR : TILE_B_COLOR; setBlock([ox + x, oy, oz + z], tileColor); } }
      const doorZStart = Math.floor(depth / 2) - 2; const doorWidth = 4; const doorHeight = 5; const windowYStart = 2; const windowYEnd = 6;
      for (let y = 1; y <= height; y++) { for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) { const isDoorArea = x === 0 && z >= doorZStart && z < doorZStart + doorWidth && y <= doorHeight; const isFrontWindow = x === 0 && y >= windowYStart && y <= windowYEnd && ((z >= 3 && z < doorZStart - 2) || (z >= doorZStart + doorWidth + 2 && z < depth - 3)); const isSideWindow = z === 0 && y >= windowYStart && y <= windowYEnd && ((x >= 4 && x <= 8) || (x >= width - 9 && x <= width - 5)); if (!isDoorArea && !isFrontWindow && !isSideWindow) { setBlock([ox + x, oy + y, oz + z], WALL_COLOR); } } } } }
      for (let y = 1; y <= doorHeight + 1; y++) { setBlock([ox, oy + y, oz + doorZStart - 1], DOOR_FRAME_COLOR); setBlock([ox, oy + y, oz + doorZStart + doorWidth], DOOR_FRAME_COLOR); }
      for (let z = doorZStart; z < doorZStart + doorWidth; z++) { setBlock([ox, oy + doorHeight + 1, oz + z], DOOR_FRAME_COLOR); }
      for (let z of [1, depth - 2]) { setBlock([ox - 1, oy, z], '#8b4513'); setBlock([ox - 1, oy + 1, z], '#22c55e'); }
      for (let x = -1; x <= width; x++) { for (let z = -1; z <= depth; z++) { setBlock([ox + x, oy + height + 1, oz + z], ROOF_COLOR); } }
      for(let x=10; x<16; x++) for(let z=10; z<16; z++) for(let y=1; y<=3; y++) { setBlock([ox + x, oy + height + 1 + y, oz + z], '#555555'); }
      setBlock([ox + 13, oy + height + 5, oz + 13], '#111111');
      const counterHeight = 2;
      for(let y = 1; y <= counterHeight; y++) { for(let z = 5; z < depth - 4; z++) setBlock([ox + width - 4, oy + y, oz + z], COUNTER_COLOR); for(let x = 4; x < width - 4; x++) setBlock([ox + x, oy + y, oz + depth - 5], COUNTER_COLOR); }
      setBlock([ox + width - 4, oy + counterHeight + 1, oz + depth - 7], '#333'); setBlock([ox + width - 4, oy + counterHeight + 1, oz + depth - 8], '#333');
      const PIZZA_BOX_COLOR = '#c2b280'; for(let y=1; y<=4; y++) { setBlock([ox + width - 2, oy + y, oz + depth - 7], PIZZA_BOX_COLOR); setBlock([ox + width - 2, oy + y, oz + depth - 8], PIZZA_BOX_COLOR); }
      const ovenSize = 6; const ovenHeight = 5; for(let x=1; x<=ovenSize; x++) for(let z=1; z<=ovenSize; z++) for(let y=1; y<=ovenHeight; y++) { if(x>1 && z>1) setBlock([ox+x, oy+y, oz+z], OVEN_COLOR); }
      for(let x=1; x<=ovenSize; x++) setBlock([ox+x, oy+ovenHeight, oz+1], WALL_COLOR); for(let z=1; z<=ovenSize; z++) setBlock([ox+1, oy+ovenHeight, oz+z], WALL_COLOR);
      setBlock([ox + ovenSize, oy + 1, oz + 3], FIRE_COLOR); setBlock([ox + ovenSize, oy + 1, oz + 4], FIRE_COLOR); setBlock([ox + ovenSize, oy + 2, oz + 3], FIRE_COLOR); setBlock([ox + ovenSize, oy + 2, oz + 4], FIRE_COLOR);
      for(let i = 0; i < 2; i++) { const tableX = 6 + i * 8; setBlock([ox + tableX, oy + 1, oz + 4], TABLE_COLOR); setBlock([ox + tableX + 1, oy + 1, oz + 4], TABLE_COLOR); setBlock([ox + tableX, oy + 1, oz + 5], TABLE_COLOR); setBlock([ox + tableX + 1, oy + 1, oz + 5], TABLE_COLOR); for(let y=1; y<=2; y++) { setBlock([ox + tableX - 1, oy + y, oz + 4], BOOTH_COLOR); setBlock([ox + tableX - 1, oy + y, oz + 5], BOOTH_COLOR); setBlock([ox + tableX + 2, oy + y, oz + 4], BOOTH_COLOR); setBlock([ox + tableX + 2, oy + y, oz + 5], BOOTH_COLOR); } for(let y=1; y<=4; y++) { setBlock([ox + tableX - 1, oy + y, oz + 3], BOOTH_COLOR); setBlock([ox + tableX, oy + y, oz + 3], BOOTH_COLOR); setBlock([ox + tableX + 1, oy + y, oz + 3], BOOTH_COLOR); setBlock([ox + tableX + 2, oy + y, oz + 3], BOOTH_COLOR); } }
      const signY = oy + height + 2; const signX = ox -1; const SIGN_BG = '#f0f0f0'; const PIZZA_CRUST = '#e3b471'; const PIZZA_CHEESE = '#ffdd57'; const PIZZA_PEPPERONI = '#d00000';
      const signHeight = 14; const signZStart = 4; const signZEnd = depth - 4; for(let z = signZStart; z < signZEnd; z++) for(let y = 0; y < signHeight; y++) { if (y === 0 || y === signHeight -1 || z === signZStart || z === signZEnd -1) { setBlock([signX, signY + y, oz + z], '#111111'); } else { setBlock([signX, signY + y, oz + z], SIGN_BG); } }
      const pizzaY = signY + 7; let sliceWidth = 8; for(let i = 0; i < sliceWidth; i++) { const rowWidth = sliceWidth - i; const rowZStart = oz + Math.floor(depth/2) - Math.floor(rowWidth/2); for(let j = 0; j < rowWidth; j++) { const sz = rowZStart + j; const sy = pizzaY + sliceWidth - 1 - i; if (i === 0) setBlock([signX-1, sy, sz], PIZZA_CRUST); else setBlock([signX-1, sy, sz], PIZZA_CHEESE); } }
      const pizzaCenterZ = oz + Math.floor(depth / 2); setBlock([signX - 2, pizzaY + 5, pizzaCenterZ - 2], PIZZA_PEPPERONI); setBlock([signX - 2, pizzaY + 4, pizzaCenterZ + 1], PIZZA_PEPPERONI); setBlock([signX - 2, pizzaY + 2, pizzaCenterZ - 1], PIZZA_PEPPERONI);
      const textY = signY + 2; const textX = signX - 1; const totalTextWidth = (3 * 4) + 1 + 3; const textZStart = oz + Math.floor(depth/2) - Math.floor(totalTextWidth/2); let currentZ = textZStart;
      const drawLetter = (letter: string[][]) => { const charHeight = letter.length; if (charHeight === 0) return; const charWidth = letter[0].length; for(let y=0; y<charHeight; y++) { for(let x=0; x<charWidth; x++) { if (letter[y][x] === 'X') { setBlock([textX, textY+(charHeight-1-y), currentZ + x], TEXT_COLOR); } } } currentZ += charWidth + 1; }
      const P = [['X','X','X'],['X',' ','X'],['X','X','X'],['X',' ',' '],['X',' ',' ']]; const I = [['X'],['X'],['X'],['X'],['X']]; const Z = [['X','X','X'],[' ',' ','X'],[' ','X',' '],['X',' ',' '],['X','X','X']]; const A = [[' ','X',' '],['X',' ','X'],['X','X','X'],['X',' ','X'],['X',' ','X']];
      drawLetter(P); drawLetter(I); drawLetter(Z); drawLetter(Z); drawLetter(A);
  }

  const buildBank = (origin: [number, number, number]) => {
      const [ox, oy, oz] = origin; const width = 20; const depth = 28; const height = 12;
      const WALL_COLOR = theme.buildingWallColor; const COLUMN_COLOR = '#f3f4f6'; const ROOF_COLOR = theme.roofColor; const TRIM_COLOR = '#9ca3af'; const STEP_COLOR = '#9ca3af'; const GOLD_COLOR = '#facc15'; const FLOOR_A_COLOR = '#ffffff'; const FLOOR_B_COLOR = '#e5e7eb'; const COUNTER_COLOR = '#855c3a'; const VAULT_COLOR = '#374151'; const PEDIMENT_COLOR = '#e5e7eb';
      for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { const floorColor = (x + z) % 2 === 0 ? FLOOR_A_COLOR : FLOOR_B_COLOR; setBlock([ox + x, oy, oz + z], floorColor); } }
      const entranceX = 0; const entranceZStart = Math.floor(depth / 2) - 5; const entranceLength = 10; const doorHeight = 8; for (let step = 0; step < 2; step++) { for (let z = entranceZStart - 2; z < entranceZStart + entranceLength + 2; z++) { for (let x = 0; x < 2 - step; x++) { setBlock([ox + entranceX - 1 - x, oy - step, oz + z], STEP_COLOR); } } }
      for (let y = 1; y <= height; y++) { for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) { const isDoorArea = x === 0 && z >= entranceZStart && z < entranceZStart + entranceLength && y <= doorHeight; if (!isDoorArea) { setBlock([ox + x, oy + y, oz + z], WALL_COLOR); } } } } }
      const columnHeight = height + 1; const columnPositionsZ = [4, 9, depth - 10, depth - 5]; for (const colZ of columnPositionsZ) { setBlock([ox-2, oy+1, oz + colZ], TRIM_COLOR); for (let y = 1; y <= columnHeight; y++) { for (let dz = -1; dz <= 1; dz++) { for (let dx = -1; dx <= 1; dx++) { if (Math.abs(dz) === 1 && Math.abs(dx) === 1) continue; setBlock([ox - 1 + dx, oy + y, oz + colZ + dz], COLUMN_COLOR); } } } setBlock([ox-2, oy + columnHeight, oz + colZ], TRIM_COLOR); }
      for (let y = 0; y < 6; y++) { for (let z = 0; z < depth; z++) { const centerZ = depth / 2; const distFromCenter = Math.abs(z - centerZ); if (distFromCenter < (depth / 2) - y * 1.5) { setBlock([ox - 2 + y, oy + height + 1 + y, oz + z], PEDIMENT_COLOR); } } }
      for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { setBlock([ox + x, oy + height + 1, oz + z], ROOF_COLOR); } }
      for (let x = -1; x <= width; x++) { for (let z = -1; z <= depth; z++) { if (x === -1 || x === width || z === -1 || z === depth) { setBlock([ox + x, oy + height + 2, oz + z], TRIM_COLOR); } } }
      const atmX = 14; setBlock([ox + atmX, oy + 1, oz - 1], '#333'); setBlock([ox + atmX, oy + 2, oz - 1], '#333'); setBlock([ox + atmX, oy + 2, oz - 2], '#a1a1aa');
      const counterHeight_inner = 2; const counterX = 4; for (let y = 1; y <= counterHeight_inner; y++) { for (let z = 4; z < depth - 4; z++) { setBlock([ox + counterX, oy + y, oz + z], COUNTER_COLOR); } }
      const vaultSize = 6; const vaultX = width - vaultSize - 2; const vaultZ = 2; for (let y = 1; y <= height-2; y++) { for (let i = 0; i < vaultSize; i++) { setBlock([ox + vaultX + i, oy + y, oz + vaultZ], VAULT_COLOR); setBlock([ox + vaultX, oy + y, oz + vaultZ + i], VAULT_COLOR); } }
      const vaultDoorZ = oz + vaultZ + vaultSize; for(let x = vaultX + 1; x < vaultX + vaultSize - 1; x++) { for (let y = 1; y <= 5; y++) { setBlock([ox + x, oy + y, vaultDoorZ], VAULT_COLOR); } }
      setBlock([ox + vaultX + Math.floor(vaultSize/2), oy + 3, vaultDoorZ+1], GOLD_COLOR); setBlock([ox + vaultX + Math.floor(vaultSize/2), oy + 2, vaultDoorZ+1], GOLD_COLOR);
  }

  const buildSportswearStore = (origin: [number, number, number]) => {
    const [ox, oy, oz] = origin; const width = 32; const depth = 36; const height = 18; const secondFloorY = oy + 9;
    const WALL_COLOR = theme.buildingWallColor; const ACCENT_COLOR = '#f97316'; const FLOOR_COLOR = '#a16207'; const SECOND_FLOOR_COLOR = '#ca8a04'; const ROOF_COLOR = theme.roofColor; const RACK_COLOR = '#4b5563'; const SHIRT_COLORS = ['#ef4444', '#3b82f6', '#22c55e']; const SHOE_BOX_COLOR = '#f8fafc'; const COUNTER_COLOR = '#f9fafb'; const MANNEQUIN_COLOR = '#9ca3af'; const COURT_COLOR = '#ef4444';
    const doorXStart = Math.floor(width / 2) - 2; const doorWidth = 4; const doorHeight = 5;
    for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { setBlock([ox + x, oy, oz + z], FLOOR_COLOR); } }
    const stairwellXStart = width - 7; const stairwellZStart = 24; const stairwellDepth = 9; for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { const isStairwell = x >= stairwellXStart && x < stairwellXStart + 5 && z >= stairwellZStart && z < stairwellZStart + stairwellDepth; if (!isStairwell) { setBlock([ox + x, secondFloorY, oz + z], SECOND_FLOOR_COLOR); } } }
    const stairWidth = 4; for (let i = 0; i < 9; i++) { for(let w=0; w<stairWidth; w++) { setBlock([ox + stairwellXStart + w, oy + 1 + i, oz + stairwellZStart + i], ACCENT_COLOR); } } for (let i = 0; i < 10; i++) { setBlock([ox + stairwellXStart - 1, oy + 2 + i, oz + stairwellZStart + i], RACK_COLOR); setBlock([ox + stairwellXStart + stairWidth, oy + 2 + i, oz + stairwellZStart + i], RACK_COLOR); }
    for (let y = 1; y <= height; y++) { if (y === secondFloorY - oy) continue; for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { const isOuterWall = x === 0 || x === width - 1 || z === 0 || z === depth - 1; if (isOuterWall) { const isGlassArea = z === 0 && ((y > 1 && y < 8) || (y > 10 && y < 17)) && x > 1 && x < width - 2; const isDoorArea = z === 0 && x >= doorXStart && x < doorXStart + doorWidth && y >= 1 && y <= doorHeight; if (!isGlassArea && !isDoorArea) { setBlock([ox + x, oy + y, oz + z], WALL_COLOR); } } } } }
    for (let y = 1; y <= doorHeight; y++) { setBlock([ox + doorXStart - 1, oy + y, oz], ACCENT_COLOR); setBlock([ox + doorXStart + doorWidth, oy + y, oz], ACCENT_COLOR); } for (let x = doorXStart - 1; x <= doorXStart + doorWidth; x++) { setBlock([ox + x, oy + doorHeight + 1, oz], ACCENT_COLOR); }
    for(let x = 0; x < width; x++) { setBlock([ox + x, oy + 9, oz - 1], ACCENT_COLOR); } for (let y = 1; y <= height; y++) { if (y === secondFloorY - oy) continue; setBlock([ox, oy + y, oz + 8], ACCENT_COLOR); setBlock([ox, oy + y, oz + depth - 9], ACCENT_COLOR); setBlock([ox + width - 1, oy + y, oz + 8], ACCENT_COLOR); setBlock([ox + width - 1, oy + y, oz + depth - 9], ACCENT_COLOR); }
    const roofY = oy + height; for (let z = 0; z < depth; z++) { for (let x = 0; x < width; x++) { setBlock([ox + x, roofY, oz + z], ROOF_COLOR); if (x > 2 && x < width - 2 && z > 2 && z < depth - 2) { setBlock([ox + x, roofY + 1, oz + z], COURT_COLOR); } } }
    const hoopZ = oz + depth - 4; const hoopX = ox + width / 2; setBlock([hoopX, roofY + 2, hoopZ], '#333'); setBlock([hoopX, roofY + 3, hoopZ], '#333'); setBlock([hoopX, roofY + 4, hoopZ], '#333'); setBlock([hoopX, roofY + 4, hoopZ-1], '#fff'); setBlock([hoopX-1, roofY + 4, hoopZ-1], '#fff'); setBlock([hoopX+1, roofY + 4, hoopZ-1], '#fff'); setBlock([hoopX, roofY + 3, hoopZ-2], '#f97316');
    for(let x=0; x<width; x++) { setBlock([ox+x, roofY+1, oz], '#555'); setBlock([ox+x, roofY+1, oz+depth-1], '#555'); } for(let z=0; z<depth; z++) { setBlock([ox, roofY+1, oz+z], '#555'); setBlock([ox+width-1, roofY+1, oz+z], '#555'); }
    for (let y = 1; y <= 2; y++) { for (let x = 5; x < 15; x++) { setBlock([ox + x, oy + y, oz + depth - 4], COUNTER_COLOR); } } setBlock([ox+6, oy+3, oz+depth-4], '#333');
    for (let z of [10, 22]) { for (let x = 4; x < width - 10; x++) { setBlock([ox + x, oy + 1, oz + z], RACK_COLOR); setBlock([ox + x, oy + 4, oz + z], RACK_COLOR); } for (let y = 1; y <= 4; y++) { setBlock([ox + 3, oy + y, oz + z], RACK_COLOR); setBlock([ox + width - 11, oy + y, oz + z], RACK_COLOR); } for (let x = 5; x < width - 11; x += 3) { setBlock([ox + x, oy + 3, oz + z], SHIRT_COLORS[x % 3]); } }
    const createMannequin = (x: number, z: number, floorY: number, shirtColor?: string) => { for (let y = 1; y <= 2; y++) setBlock([ox + x, floorY + y, oz + z], MANNEQUIN_COLOR); for (let y = 3; y <= 5; y++) setBlock([ox + x, floorY + y, oz + z], shirtColor || MANNEQUIN_COLOR); setBlock([ox + x, floorY + 6, oz + z], MANNEQUIN_COLOR); }
    createMannequin(8, 4, oy, SHIRT_COLORS[0]); createMannequin(width - 9, 24, oy); createMannequin(6, 2, oy, SHIRT_COLORS[1]); createMannequin(width - 6, 2, oy, SHIRT_COLORS[2]);
    for (let y = 1; y < 8; y += 2) { for (let x = 2; x < width - 2; x += 2) { setBlock([ox + x, secondFloorY + y, oz + depth - 1], SHOE_BOX_COLOR); setBlock([ox + x + 1, secondFloorY + y, oz + depth - 1], SHOE_BOX_COLOR); } }
    const rackZ2 = 16; for (let x = 4; x < width - 10; x++) { setBlock([ox + x, secondFloorY + 1, oz + rackZ2], RACK_COLOR); setBlock([ox + x, secondFloorY + 4, oz + rackZ2], RACK_COLOR); } for (let y = 1; y <= 4; y++) { setBlock([ox + 3, secondFloorY + y, oz + rackZ2], RACK_COLOR); setBlock([ox + width - 11, secondFloorY + y, oz + rackZ2], RACK_COLOR); } for (let x = 5; x < width - 11; x += 3) { setBlock([ox + x, secondFloorY + 3, oz + rackZ2], SHIRT_COLORS[(x+1) % 3]); }
  }

  const buildCarDealership = (origin: [number, number, number]) => {
    const [ox, oy, oz] = origin; const width = 32; const depth = 40; const height = 10;
    const WALL_COLOR = theme.buildingWallColor; const ACCENT_COLOR = '#3b82f6'; const FLOOR_COLOR = '#374151'; const ROOF_COLOR = theme.roofColor; const PARKING_LOT_COLOR = theme.roadColor; const PARKING_LINE_COLOR = '#ffffff'; const FLAG_POLE = '#f3f4f6';
    for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { setBlock([ox + x, oy, oz + z], FLOOR_COLOR); } }
    for (let x = 0; x < width; x++) { for (let z = -12; z < 0; z++) { setBlock([ox + x, oy, oz + z], PARKING_LOT_COLOR); } }
    for(let i = 0; i < 4; i++) { const carX = ox + 2 + i * 7; const carZ = oz - 10; for (let l = 0; l < 5; l++) { setBlock([carX + l, oy + 1, carZ], PARKING_LINE_COLOR); setBlock([carX + l, oy + 1, carZ + 8], PARKING_LINE_COLOR); } }
    const flagColors = ['#ef4444', '#3b82f6', '#eab308']; for(let i = 0; i < 4; i++) { const flagX = ox + 2 + i * 8; const flagZ = oz - 12; for(let h = 1; h <= 6; h++) setBlock([flagX, oy + h, flagZ], FLAG_POLE); setBlock([flagX, oy + 6, flagZ - 1], flagColors[i % 3]); setBlock([flagX, oy + 5, flagZ - 1], flagColors[i % 3]); }
    const dealershipDoorZStart = Math.floor(depth / 2) - 2; const dealershipDoorWidth = 4; const dealershipDoorHeight = 5;
    for (let y = 1; y <= height; y++) { for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) { const isFrontWall = x === width - 1; const isSideWall = z === depth - 1; const isDoorArea = isFrontWall && y <= dealershipDoorHeight && z >= dealershipDoorZStart && z < dealershipDoorZStart + dealershipDoorWidth; const isGlassArea = (isFrontWall || isSideWall) && y > 0 && y < height; if (!isGlassArea && !isDoorArea) { if(isDoorArea && x === width-1){} else { setBlock([ox + x, oy + y, oz + z], WALL_COLOR); } } } } } }
    const platformX = ox + width / 2; const platformZ = oz + depth / 2; const radius = 4; for (let x = -radius; x <= radius; x++) { for (let z = -radius; z <= radius; z++) { if (x*x + z*z <= radius*radius) { setBlock([platformX + x, oy + 1, platformZ + z], '#111827'); } } }
    setBlock([platformX, oy + 2, platformZ], '#ef4444'); setBlock([platformX+1, oy + 2, platformZ], '#ef4444'); setBlock([platformX-1, oy + 2, platformZ], '#ef4444'); setBlock([platformX, oy + 3, platformZ], '#ef4444');
    for (let y = 1; y <= height; y++) { setBlock([ox, oy+y, oz], WALL_COLOR); setBlock([ox+1, oy+y, oz], ACCENT_COLOR); setBlock([ox, oy+y, oz+1], ACCENT_COLOR); }
    for (let x = -1; x <= width; x++) { for (let z = -1; z <= depth; z++) { setBlock([ox + x, oy + height, oz + z], ROOF_COLOR); if (x === -1 || x === width || z === -1 || z === depth) { setBlock([ox + x, oy + height + 1, oz + z], ACCENT_COLOR); } } }
    const signY = oy + height + 2; const signX = ox + width; const SIGN_BG = '#ffffff'; const TEXT_COLOR = '#3b82f6';
    for(let z = 10; z < depth - 10; z++) for (let y = 0; y < 6; y++) setBlock([signX, signY + y, oz + z], SIGN_BG);
    const textY = signY + 1; let currentZ = oz + 10 + 2 + 15;
    const drawLetter = (letter: string[][]) => { const charHeight = letter.length; if (charHeight === 0) return; const charWidth = letter[0].length; currentZ -= charWidth; for(let y=0; y<charHeight; y++) { for(let x=0; x<charWidth; x++) { if (letter[y][x] === 'X') { setBlock([signX + 1, textY+(charHeight-1-y), currentZ + x], TEXT_COLOR); } } } currentZ -= 1; }
    const A = [[' ','X',' '],['X',' ','X'],['X','X','X'],['X',' ','X'],['X',' ','X']]; const U = [['X',' ','X'],['X',' ','X'],['X',' ','X'],['X',' ','X'],[' ','X',' ']]; const T = [['X','X','X'],[' ','X',' '],[' ','X',' '],[' ','X',' '],[' ','X',' ']]; const O = [[' ','X',' '],['X',' ','X'],['X',' ','X'],['X',' ','X'],[' ','X',' ']];
    drawLetter(A); drawLetter(U); drawLetter(T); drawLetter(O);
    const deskHeight = 2; for (let y = 1; y <= deskHeight; y++) { for (let x = 3; x < 10; x++) setBlock([ox+x, oy+y, oz+3], ACCENT_COLOR); for (let z = 4; z < 8; z++) setBlock([ox+3, oy+y, oz+z], ACCENT_COLOR); }
  }

  const buildSchool = (origin: [number, number, number]) => {
    const [ox, oy, oz] = origin; const width = 24; const depth = 40; const height = 16; const secondFloorY = oy + 8;
    const WALL_COLOR = '#a0522d'; const TRIM_COLOR = '#d2b48c'; const ROOF_COLOR = theme.roofColor; const DOOR_FRAME_COLOR = '#654321'; const FLOOR_COLOR = '#deb887'; const CLOCK_FACE_COLOR = '#f5f5dc'; const CLOCK_HAND_COLOR = '#000000'; const DESK_COLOR = '#8B4513'; const COMPUTER_COLOR = '#222222'; const PLAYGROUND_RED = '#ef4444'; const PLAYGROUND_YELLOW = '#eab308'; const PLAYGROUND_METAL = '#9ca3af';
    for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { setBlock([ox + x, oy, oz + z], FLOOR_COLOR); setBlock([ox + x, secondFloorY, oz + z], FLOOR_COLOR); } }
    const doorZStart = Math.floor(depth / 2) - 2; const doorWidth = 4; const doorHeight = 6;
    for (let y = 1; y < height; y++) { if (y === (secondFloorY - oy)) continue; for (let x = 0; x < width; x++) { for (let z = 0; z < depth; z++) { if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) { const isFrontWall = x === 0; const isDoorArea = isFrontWall && z >= doorZStart && z < doorZStart + doorWidth && y <= doorHeight; const isWindowY = (y >= 2 && y <= 5) || (y >= 10 && y <= 13); const isFrontWindow = isFrontWall && isWindowY && (z > 2 && z < depth - 3) && ((z - 3) % 6 < 4); const isBackWindow = x === width - 1 && isWindowY && (z > 2 && z < depth - 3) && ((z - 3) % 6 < 4); const isSideWindow = (z === 0 || z === depth - 1) && isWindowY && (x > 2 && x < width - 3) && ((x - 3) % 5 < 3); if (!isDoorArea && !isFrontWindow && !isBackWindow && !isSideWindow) { setBlock([ox + x, oy + y, oz + z], WALL_COLOR); } } } } }
    for (let step = 0; step < 2; step++) { for (let z = doorZStart - 1; z <= doorZStart + doorWidth; z++) { setBlock([ox - 1 - step, oy - step, oz + z], TRIM_COLOR); } }
    for(let y=1; y <= doorHeight; y++) { setBlock([ox, oy+y, oz + doorZStart -1], DOOR_FRAME_COLOR); setBlock([ox, oy+y, oz + doorZStart + doorWidth], DOOR_FRAME_COLOR); }
    for(let z=doorZStart-1; z<=doorZStart+doorWidth; z++) { setBlock([ox, oy + doorHeight + 1, oz + z], DOOR_FRAME_COLOR); }
    for(let x=-1; x<=width; x++) { for(let z=-1; z<=depth; z++) { setBlock([ox+x, oy+height, oz+z], ROOF_COLOR); if(x===-1 || x===width || z===-1 || z===depth) { setBlock([ox+x, oy+height+1, oz+z], TRIM_COLOR); } } }
    const towerSize = 6; const towerX = ox + width / 2 - towerSize / 2; const towerZ = oz + depth / 2 - towerSize / 2; const towerBaseY = oy + height + 1;
    for(let y = 0; y < 5; y++) { for(let x=0; x<towerSize; x++) { for(let z=0; z<towerSize; z++) { setBlock([towerX+x, towerBaseY+y, towerZ+z], WALL_COLOR); } } }
    for(let x=-1; x<=towerSize; x++) for(let z=-1; z<=towerSize; z++) setBlock([towerX+x, towerBaseY+5, towerZ+z], ROOF_COLOR);
    setBlock([towerX + 2, towerBaseY + 6, towerZ + 2], TRIM_COLOR); setBlock([towerX + 2, towerBaseY + 7, towerZ + 2], TRIM_COLOR);
    const clockY = towerBaseY + 2; const clockZ = oz + Math.floor(depth/2); const clockX = towerX - 1; for(let z_offset=-1; z_offset<=1; z_offset++) for(let y_offset=-1; y_offset<=1; y_offset++) setBlock([clockX, clockY+y_offset, clockZ+z_offset], CLOCK_FACE_COLOR); setBlock([clockX-1, clockY, clockZ], CLOCK_HAND_COLOR); setBlock([clockX-1, clockY+1, clockZ], CLOCK_HAND_COLOR);
    const playX = ox + width + 5; const playZ = oz + 5; for(let i=0; i<5; i++) { setBlock([playX + i, oy + i, playZ], PLAYGROUND_RED); setBlock([playX + 5 + i, oy + 5 - i, playZ], PLAYGROUND_YELLOW); }
    const swingZ = playZ + 15; for(let y=1; y<8; y++) { setBlock([playX, oy+y, swingZ], PLAYGROUND_METAL); setBlock([playX+10, oy+y, swingZ], PLAYGROUND_METAL); } for(let x=0; x<=10; x++) setBlock([playX+x, oy+8, swingZ], PLAYGROUND_METAL); setBlock([playX+3, oy+3, swingZ], PLAYGROUND_RED); setBlock([playX+7, oy+3, swingZ], PLAYGROUND_RED);
    const deskX = ox + width - 8; const deskZ = oz + depth - 10; for (let x = 0; x < 5; x++) { for (let z = 0; z < 3; z++) { setBlock([deskX + x, oy + 2, deskZ + z], DESK_COLOR); } } setBlock([deskX, oy + 1, deskZ], DESK_COLOR); setBlock([deskX + 4, oy + 1, deskZ], DESK_COLOR); setBlock([deskX, oy + 1, deskZ + 2], DESK_COLOR); setBlock([deskX + 4, oy + 1, deskZ + 2], DESK_COLOR);
    const monitorX = deskX + 2; const monitorZ = deskZ; for (let x_offset = -1; x_offset <= 1; x_offset++) { for (let y_offset = 0; y_offset <= 1; y_offset++) { setBlock([monitorX + x_offset, oy + 3 + y_offset, monitorZ], COMPUTER_COLOR); } }
    const chairX = deskX + 2; const chairZ = deskZ + 4; setBlock([chairX, oy + 1, chairZ], DESK_COLOR); for (let y = 1; y <= 2; y++) { setBlock([chairX, oy + y, chairZ + 1], DESK_COLOR); }
  }
  
  const buildSkyscraper = (origin: [number, number, number]) => {
    const [ox, oy, oz] = origin;
    const width = 28;
    const depth = 28;
    const height = 70;
    const floorHeight = 4;
    
    const CONCRETE = '#9ca3af';
    const DARK_CONCRETE = '#4b5563';
    const PILLAR_COLOR = '#374151';

    // Foundation
    for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) setBlock([ox + x, oy, oz + z], DARK_CONCRETE);

    for (let y = 1; y <= height; y++) {
      const isFloor = y % floorHeight === 0;

      // Central Core
      for (let x = 10; x < 18; x++) {
        for (let z = 10; z < 18; z++) {
           setBlock([ox + x, oy + y, oz + z], CONCRETE);
        }
      }

      if (isFloor) {
        // Floor slabs
        for (let x = 0; x < width; x++) {
          for (let z = 0; z < depth; z++) {
            setBlock([ox + x, oy + y, oz + z], DARK_CONCRETE);
          }
        }
      } else {
        // Structural Pillars at corners and intervals
        for(let x=0; x<width; x+=9) {
            setBlock([ox + x, oy + y, oz], PILLAR_COLOR);
            setBlock([ox + x, oy + y, oz + depth - 1], PILLAR_COLOR);
        }
        // Ensure right-most pillars exist if not hit by loop
        setBlock([ox + width - 1, oy + y, oz], PILLAR_COLOR);
        setBlock([ox + width - 1, oy + y, oz + depth - 1], PILLAR_COLOR);

        for(let z=0; z<depth; z+=9) {
             setBlock([ox, oy + y, oz + z], PILLAR_COLOR);
             setBlock([ox + width - 1, oy + y, oz + z], PILLAR_COLOR);
        }
        setBlock([ox, oy + y, oz + depth - 1], PILLAR_COLOR);
        setBlock([ox + width - 1, oy + y, oz + depth - 1], PILLAR_COLOR);
      }
    }
    
    // Roof
    for (let x = -1; x <= width; x++) for (let z = -1; z <= depth; z++) setBlock([ox + x, oy + height + 1, oz + z], DARK_CONCRETE);
  };

  buildPizzaShop([-8, -1, 16]);
  buildBank([-8, -1, -68]);
  buildSportswearStore([-8, -1, 88]);
  buildCarDealership([-72, -1, 16]);
  buildSchool([-6, -1, -140]);
  buildSkyscraper([-74, -1, 88]);
  buildConstructionPlots([148, -1, 16]);
  
  return { voxels: Array.from(blockMap.values()), forSaleSigns };
}

const App: React.FC = () => {
  const [voxels, setVoxels] = useState<Voxel[]>([]);
  const [selectedColor, setSelectedColor] = useState('#ef4444');
  const [selectedSize, setSelectedSize] = useState(1);
  const [isGlowEnabled, setIsGlowEnabled] = useState(false);
  const [isFreeCamera, setIsFreeCamera] = useState(false);
  const [movement, setMovement] = useState({ x: 0, y: 0 });
  const [movementMagnitude, setMovementMagnitude] = useState(0);
  const [stamina, setStamina] = useState(100);
  const [showStaminaPopup, setShowStaminaPopup] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customization, setCustomization] = useState<CharacterCustomization>({
    gender: 'male', skinColor: '#fcc2a2', hairStyle: 'short', hairColor: '#5a3825',
    eyeColor: '#5c98d9', facialHairStyle: 'none', facialHairColor: '#5a3825',
    shirtStyle: 'tshirt', shirtColor: '#ef4444', pantsStyle: 'jeans', pantsColor: '#3b82f6',
    shoeColor: '#1a1a1a', hatStyle: 'none', hatColor: '#000000', glassesStyle: 'none',
    glassesColor: '#000000', necklaceStyle: 'none', necklaceColor: '#000000',
    headwearStyle: 'none', headwearColor: '#000000'
  });
  const [nearbyNpc, setNearbyNpc] = useState<NearbyNPC | null>(null);
  const [transcription, setTranscription] = useState({ user: '', model: '' });
  const [isCarProximity, setIsCarProximity] = useState(false);
  const [isInCar, setIsInCar] = useState(false);
  const [forSaleSign, setForSaleSign] = useState<{isNear: boolean, position: [number, number, number] | null}>({isNear: false, position: null});
  const [isBuildingPromptOpen, setIsBuildingPromptOpen] = useState(false);
  const [isBuildingLoading, setIsBuildingLoading] = useState(false);
  const [isItemProximity, setIsItemProximity] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [lessonContent, setLessonContent] = useState<string | null>(null);
  const [cash, setCash] = useState(0);
  const [isInventoryVisible, setIsInventoryVisible] = useState(false);
  const inventoryTimeoutRef = useRef<number | null>(null);
  
  const [currentTheme, setCurrentTheme] = useState<WorldTheme>(DEFAULT_THEME);
  const [worldDescription, setWorldDescription] = useState('');
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);

  const [quests, setQuests] = useState<Quest[]>([
    { id: 1, title: 'Visit the Bank', description: 'Walk to the bank and ask the teller to withdraw $1000', completed: false },
    { id: 2, title: 'Rent a Car', description: 'Go to the auto store and enter a car', completed: false },
    { id: 3, title: 'Summon a Character', description: 'Ask the wizard to spawn a character of your choice', completed: false },
    { id: 4, title: 'Conjure an Object', description: 'Ask the wizard to follow you, bring him to a new location and ask him to spawn any object', completed: false },
    { id: 5, title: 'Build a Park', description: 'Ask a construction worker to build a park', completed: false },
    { id: 6, title: 'Learn Something New', description: 'Ask the teacher in the school for a lesson on any subject', completed: false },
    { id: 7, title: 'Order Pizza', description: 'Order a pizza from the chef at the pizza shop', completed: false },
    { id: 8, title: 'Consume Pizza', description: 'Grab the pizza off the counter, add it to inventory and consume it by clicking', completed: false },
  ]);

  const voxelWorldRef = useRef<VoxelWorldApi>(null);

  useEffect(() => {
    const data = generateWorldData(currentTheme);
    // Assign unique IDs to initial voxels
    const initialVoxels = data.voxels.map((v, i) => ({ ...v, id: i }));
    setVoxels(initialVoxels);
    // We need to pass forSaleSigns to VoxelWorld after mount or via prop if we updated VoxelWorld to take it
    if (voxelWorldRef.current) {
        voxelWorldRef.current.setForSaleSigns(data.forSaleSigns);
    }
    // Since ref might not be ready immediately, we might need another effect or initial prop
    // But VoxelWorld updates its internal state when props change usually.
    // Let's use a timeout or a callback ref if critical, but here we can pass as prop or just let VoxelWorld handle it.
    // Looking at VoxelWorld.tsx, it doesn't take forSaleSigns as prop, but has an imperative handle setForSaleSigns.
    setTimeout(() => {
       if (voxelWorldRef.current) voxelWorldRef.current.setForSaleSigns(data.forSaleSigns);
    }, 100);
  }, [currentTheme]);

  const handleAddVoxel = useCallback((position: [number, number, number], color: string, size: number = 1, glow: boolean = false) => {
    setCash(prev => prev - 1);
    setVoxels(prev => {
      const newVoxels = [...prev, { id: Date.now(), position, color, size, glow }];
      return newVoxels;
    });
  }, []);
  
  const handleAddVoxels = useCallback((newVoxelsData: { position: [number, number, number]; color: string; glow?: boolean }[]) => {
      setVoxels(prev => {
          const added = newVoxelsData.map((v, i) => ({ id: Date.now() + i, position: v.position, color: v.color, glow: v.glow }));
          return [...prev, ...added];
      });
  }, []);

  const handleRemoveVoxel = useCallback((id: number) => {
    setVoxels(prev => prev.filter(v => v.id !== id));
  }, []);

  const handleRemoveVoxels = useCallback((positions: [number, number, number][]) => {
      setVoxels(prev => prev.filter(v => !positions.some(p => p[0] === v.position[0] && p[1] === v.position[1] && p[2] === v.position[2])));
  }, []);

  const handleMove = useCallback((direction: { x: number; y: number }, magnitude: number) => {
    setMovement(direction);
    setMovementMagnitude(magnitude);
  }, []);

  const handleStartBuilding = async (prompt: string) => {
      if (forSaleSign.position && voxelWorldRef.current) {
          setIsBuildingLoading(true);
          await voxelWorldRef.current.startGenerativeBuild(prompt, forSaleSign.position);
          setIsBuildingLoading(false);
          setIsBuildingPromptOpen(false);
      }
  };
  
  const handlePickUpItem = () => {
      if (voxelWorldRef.current) {
          const item = voxelWorldRef.current.pickUpItem();
          if (item) {
              setInventory(prev => {
                  if (prev.length < 6) {
                      return [...prev, { id: item.id, type: item.type, name: item.type, icon: '🍕' }];
                  }
                  return prev;
              });
              
              if (item.type.toLowerCase().includes('pizza')) {
                  const staminaToRestore = 100 - stamina;
                  handleStaminaChange(staminaToRestore);
              }
              
              setIsInventoryVisible(true);
              if (inventoryTimeoutRef.current) {
                  clearTimeout(inventoryTimeoutRef.current);
              }
              inventoryTimeoutRef.current = window.setTimeout(() => {
                  setIsInventoryVisible(false);
              }, 5000);
          }
      }
  }

  const handleQuestProgress = (questId: number) => {
    completeQuest(questId);
  };

  const handleLessonGenerated = (html: string) => {
    setLessonContent(html);
    completeQuest(6);
  };

  const handleCashChange = (amount: number) => {
    setCash(prev => prev + amount);
  };

  const handleStaminaChange = useCallback((delta: number) => {
    setStamina(prev => {
      const newStamina = Math.max(0, Math.min(100, prev + delta));
      if (prev > 0 && newStamina === 0) {
        setShowStaminaPopup(true);
      } else if (newStamina > 0 && showStaminaPopup) {
        setShowStaminaPopup(false);
      }
      return newStamina;
    });
  }, [showStaminaPopup]);

  const handleItemUse = (index: number, item: InventoryItem) => {
    if (item.type.toLowerCase().includes('pizza')) {
      setStamina(100);
      setInventory(prev => prev.filter((_, i) => i !== index));
      completeQuest(8);
    }
  };

  const completeQuest = (questId: number) => {
    setQuests(prev => prev.map(q => 
      q.id === questId && !q.completed ? { ...q, completed: true } : q
    ));
  };

  const handleWorldDescriptionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!worldDescription.trim()) return;
      setIsGeneratingWorld(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
          const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: `Generate a JSON object defining a color palette and atmospheric settings for a voxel game world based on this description: "${worldDescription}".
              Ensure all colors are valid hex strings (e.g., "#ffffff").`,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          skyColor: { type: Type.STRING, description: "Hex color for the sky background." },
                          fogColor: { type: Type.STRING, description: "Hex color for the distance fog." },
                          ambientLightColor: { type: Type.STRING, description: "Hex color for ambient light." },
                          directionalLightColor: { type: Type.STRING, description: "Hex color for the sun/moon light." },
                          grassColor: { type: Type.STRING, description: "Hex color for the ground/grass." },
                          roadColor: { type: Type.STRING, description: "Hex color for roads." },
                          sidewalkColor: { type: Type.STRING, description: "Hex color for sidewalks." },
                          buildingWallColor: { type: Type.STRING, description: "Hex color for generic building walls." },
                          roofColor: { type: Type.STRING, description: "Hex color for building roofs." },
                          treeTrunkColor: { type: Type.STRING, description: "Hex color for tree trunks." },
                          treeLeavesColor: { type: Type.STRING, description: "Hex color for tree leaves." },
                          cloudColor: { type: Type.STRING, description: "Hex color for clouds." },
                          bedrockColor: { type: Type.STRING, description: "Hex color for bedrock layer." },
                      },
                      required: ["skyColor", "fogColor", "ambientLightColor", "directionalLightColor", "grassColor", "roadColor", "sidewalkColor", "buildingWallColor", "roofColor", "treeTrunkColor", "treeLeavesColor", "cloudColor", "bedrockColor"],
                  },
              },
          });
          
          const themeData = JSON.parse(response.text);
          setCurrentTheme(themeData);
          setWorldDescription('');
      } catch (error) {
          console.error("Error generating world theme:", error);
      } finally {
          setIsGeneratingWorld(false);
      }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none touch-none">
      <VoxelWorld
        ref={voxelWorldRef}
        voxels={voxels}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        isGlowEnabled={isGlowEnabled}
        onAddVoxel={handleAddVoxel}
        onAddVoxels={handleAddVoxels}
        onRemoveVoxel={handleRemoveVoxel}
        onRemoveVoxels={handleRemoveVoxels}
        movement={movement}
        movementMagnitude={movementMagnitude}
        isFreeCamera={isFreeCamera}
        characterCustomization={customization}
        worldSize={INITIAL_WORLD_SIZE}
        onNearestNpcChange={setNearbyNpc}
        onTranscriptionUpdate={(update) => {
            setTranscription(prev => {
                if (update.isFinal) return { user: '', model: '' };
                return { ...prev, ...update };
            });
        }}
        onCarProximityChange={setIsCarProximity}
        onForSaleProximityChange={(isNear, pos) => setForSaleSign({ isNear, position: pos })}
        onItemProximityChange={setIsItemProximity}
        onLessonGenerated={handleLessonGenerated}
        onCashChange={handleCashChange}
        onStaminaChange={handleStaminaChange}
        onQuestProgress={handleQuestProgress}
        currentCash={cash}
        currentStamina={stamina}
        worldTheme={currentTheme}
      />

      {/* World Description Input */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pointer-events-auto">
          <form onSubmit={handleWorldDescriptionSubmit} className="flex gap-2 justify-center">
              <input
                  type="text"
                  value={worldDescription}
                  onChange={(e) => setWorldDescription(e.target.value)}
                  placeholder={isGeneratingWorld ? "Generating world..." : "Describe a world (e.g. 'Mars colony', 'Neon city')..."}
                  className="w-full max-w-[115px] md:max-w-full bg-black/40 backdrop-blur-md text-white border border-white/20 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-white/50 shadow-lg"
                  disabled={isGeneratingWorld}
              />
              <button 
                type="submit" 
                disabled={isGeneratingWorld || !worldDescription.trim()}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full p-2 transition-colors disabled:opacity-50"
              >
                  {isGeneratingWorld ? (
                       <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                      </svg>
                  )}
              </button>
          </form>
      </div>
      
      <Controls
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        selectedSize={selectedSize}
        setSelectedSize={setSelectedSize}
        isGlowEnabled={isGlowEnabled}
        setIsGlowEnabled={setIsGlowEnabled}
        onBuild={() => voxelWorldRef.current?.build()}
        onDestroy={() => voxelWorldRef.current?.destroy()}
        onJump={() => voxelWorldRef.current?.jump()}
        isFreeCamera={isFreeCamera}
        onToggleFreeCamera={() => setIsFreeCamera(!isFreeCamera)}
        onCustomize={() => setIsCustomizing(true)}
        isNearNPC={!!nearbyNpc}
        isChatting={isChatting}
        onStartChat={() => { setIsChatting(true); if(nearbyNpc && voxelWorldRef.current) voxelWorldRef.current.startConversation(nearbyNpc); }}
        onEndChat={() => { setIsChatting(false); voxelWorldRef.current?.endConversation(); }}
        onSendTextMessage={(msg) => voxelWorldRef.current?.sendTextMessage(msg)}
        isNearCar={isCarProximity}
        isInCar={isInCar}
        onEnterExitCar={() => {
            if(voxelWorldRef.current) {
                if (isInCar) { voxelWorldRef.current.exitCar(); setIsInCar(false); }
                else { const entered = voxelWorldRef.current.enterCar(); if(entered) setIsInCar(true); }
            }
        }}
        isNearForSaleSign={forSaleSign.isNear}
        onStartBuilding={() => setIsBuildingPromptOpen(true)}
        isNearItem={isItemProximity}
        onPickUpItem={handlePickUpItem}
        cash={cash}
      />
      
      {!isFreeCamera && <Joystick onMove={handleMove} />}
      
      <StaminaBar stamina={stamina} />
      
      <QuestTracker quests={quests} />
      
      {showStaminaPopup && <LowStaminaPopup onClose={() => setShowStaminaPopup(false)} />}
      
      <MainMenu onCustomize={() => setIsCustomizing(true)} />
      
      <CustomizationMenu
        isOpen={isCustomizing}
        onClose={() => setIsCustomizing(false)}
        initialCustomization={customization}
        onSave={(newCustomization) => {
          setCustomization(newCustomization);
          setIsCustomizing(false);
        }}
      />
      
      <BuildingPrompt 
        isOpen={isBuildingPromptOpen}
        onClose={() => setIsBuildingPromptOpen(false)}
        onSubmit={handleStartBuilding}
        isLoading={isBuildingLoading}
      />
      
      {(isCustomizing || isInventoryVisible) && <InventoryBar items={inventory} onItemUse={handleItemUse} />}

      <Captions
        userCaption={transcription.user}
        modelCaption={transcription.model}
        isChatting={isChatting}
        speakerName={nearbyNpc ? nearbyNpc.name : 'NPC'}
      />

      {lessonContent && (
        <LessonModal 
          content={lessonContent} 
          onClose={() => setLessonContent(null)} 
        />
      )}
    </div>
  );
};

export default App;
