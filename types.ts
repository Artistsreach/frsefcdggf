
export enum GameMode {
  BUILD = 'BUILD',
  DESTROY = 'DESTROY',
}

export interface Voxel {
  id: number;
  position: [number, number, number];
  color: string;
  size?: number;
  glow?: boolean;
}

export type HairStyle = 'short' | 'long' | 'ponytail' | 'bald' | 'mohawk' | 'bun' | 'longBob' | 'pixie' | 'pigtails' | 'sideSwept' | 'braid';
export type ShirtStyle = 'tshirt' | 'longsleeve' | 'tankTop';
export type PantsStyle = 'jeans' | 'shorts' | 'skirt';
export type HatStyle = 'cap' | 'fedora' | 'beanie' | 'none';
export type FacialHairStyle = 'none' | 'beard' | 'mustache';
export type GlassesStyle = 'none' | 'round' | 'square';
export type NecklaceStyle = 'none' | 'choker' | 'pendant';
export type HeadwearStyle = 'none' | 'tiara' | 'headband';

export interface CharacterCustomization {
  gender: 'male' | 'female';
  skinColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  eyeColor: string;
  facialHairStyle: FacialHairStyle;
  facialHairColor: string;
  shirtStyle: ShirtStyle;
  shirtColor: string;
  pantsStyle: PantsStyle;
  pantsColor: string;
  shoeColor: string;
  hatStyle: HatStyle;
  hatColor: string;
  glassesStyle: GlassesStyle;
  glassesColor: string;
  necklaceStyle: NecklaceStyle;
  necklaceColor: string;
  headwearStyle: HeadwearStyle;
  headwearColor: string;
}

export interface InventoryItem {
  id: string;
  type: string;
  name: string;
  icon: string;
}

export interface WorldTheme {
  skyColor: string;
  fogColor: string;
  ambientLightColor: string;
  directionalLightColor: string;
  grassColor: string;
  roadColor: string;
  sidewalkColor: string;
  buildingWallColor: string;
  roofColor: string;
  treeTrunkColor: string;
  treeLeavesColor: string;
  cloudColor: string;
  bedrockColor: string;
}

export interface Quest {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}
