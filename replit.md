# Voxel Builder 3D

## Overview

Voxel Builder 3D is an interactive 3D voxel-based building game designed for mobile touch screens. Players navigate a procedurally generated world, build and destroy voxel structures, customize their character, and interact with NPCs through AI-powered conversations. The application leverages Google's Gemini AI for natural language interactions and generative building capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 19.2.0 with TypeScript
- Component-based UI architecture using functional components with hooks
- State management through local component state (useState, useRef)
- No global state management library; parent-child prop passing pattern

**3D Rendering**: Three.js (v0.181.1)
- Custom voxel-based 3D world renderer
- Real-time camera controls with both first-person and free-camera modes
- Instanced mesh rendering for performance optimization with large voxel counts
- Character model built from primitive geometries with customizable appearance
- Touch-based controls including virtual joystick for mobile interaction

**UI Components**:
- `VoxelWorld`: Core 3D rendering component managing Three.js scene, camera, and game logic
- `Controls`: Mobile-optimized control panel for building, destroying, and game interactions
- `Joystick`: Virtual joystick for character movement on touch devices
- `CustomizationMenu`: Character appearance customization interface
- `BuildingPrompt`: AI-powered generative building input
- `Captions`: Real-time conversation transcription display
- `InventoryBar`: Player inventory visualization

**Styling**: Tailwind CSS via CDN for utility-first styling approach

### AI Integration

**Google Gemini API** (@google/genai v1.29.1)
- Multimodal Live API for real-time voice conversations with NPCs
- Each NPC has a unique persona and context provided to the AI
- Audio streaming for both speech input (microphone) and output (text-to-speech)
- Function calling capability for AI to trigger game actions
- Generative building feature using text prompts to create voxel structures

**Conversation Flow**:
1. Player approaches NPC and initiates conversation
2. Audio stream established with Gemini Live API
3. Real-time transcription displayed as captions
4. AI responds contextually based on NPC persona
5. AI can execute game functions (e.g., generate lesson content, initiate building)

### Game Mechanics

**Voxel System**:
- Position-based voxel storage using Map with stringified coordinates
- Color customization with 14 preset colors
- Variable voxel sizes (1, 2, 3 units)
- Raycasting for voxel placement and destruction
- Collision detection for player-world interaction

**World Generation**:
- Procedural city generation with roads, sidewalks, buildings
- Ground level with grass and bedrock layers
- Dynamic theme system (sky color, fog, lighting, material colors)
- Interactive elements: cars, for-sale signs, NPCs, collectible items

**Character System**:
- Highly customizable player avatar (gender, skin, hair, clothing, accessories)
- Third-person camera following character
- Physics-based movement with gravity and jumping
- Vehicle entry/exit mechanics

**NPC System**:
- Multiple NPC types (chef, teacher, teller, wizard, pedestrian, worker)
- Proximity detection for interactions
- Unique personas and conversation contexts
- Positioned at specific world locations (restaurants, schools, banks, etc.)

**Animated Objects**:
- Wizard NPC can spawn animated objects using AI generation
- Objects animate according to their function:
  - Dogs: Walk along circular paths with bobbing animation
  - Birds: Fly along curved paths with wing-flapping motion
  - Drones: Hover and fly with smooth oscillation
  - Helicopters: Stationary with spinning rotor blades
  - Balls: Physics-based bouncing and rolling with friction
  - Race cars: Drive along paths with proper rotation
- Object type detection from player's spoken description
- Voxel-based animations using instanced mesh matrix updates
- Each animated object maintains its own path and animation state

### Build Tool & Development

**Vite** (v6.2.0)
- Development server with hot module replacement
- Environment variable injection for API keys
- Path aliasing (@/ pointing to project root)
- React plugin for JSX transformation

**Configuration**:
- TypeScript with ES2022 target
- Module resolution via bundler strategy
- Import maps for CDN-based dependencies (Three.js, React)
- Server running on port 5000, accepting all hosts

## External Dependencies

### Core Dependencies

**Three.js** (v0.181.1)
- 3D graphics library for WebGL rendering
- Loaded via both npm package and CDN import map
- Used for scene management, geometries, materials, lighting, cameras

**React & React DOM** (v19.2.0)
- UI framework for component-based architecture
- Loaded via CDN import map
- Handles UI state, rendering, and lifecycle management

**Google Gemini AI** (@google/genai v1.29.1)
- Google's generative AI SDK
- Multimodal Live API for real-time voice interactions
- Function calling for game integration
- Requires GEMINI_API_KEY environment variable

### Development Tools

- **Vite**: Build tool and dev server
- **TypeScript**: Type safety and enhanced developer experience
- **@vitejs/plugin-react**: React support for Vite
- **Tailwind CSS**: Utility-first CSS framework (loaded via CDN)

### Browser APIs

- **WebGL**: For 3D rendering via Three.js
- **MediaDevices API**: Microphone access for voice conversations
- **Web Audio API**: Audio playback for AI speech synthesis
- **Touch Events API**: Mobile touch input handling
- **Pointer Lock API**: First-person camera controls

### Environment Configuration

Required environment variables:
- `GEMINI_API_KEY`: Google Gemini API authentication key (set in .env.local)

### External Services

**Google AI Studio**: Deployment and hosting platform for the application
- App accessible via Google Drive integration
- Frame permissions requested for microphone access
- Metadata configuration in metadata.json