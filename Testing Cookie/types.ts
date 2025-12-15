export interface CharacterProp {
  id: string;
  name: string; // Tên vật phẩm (ví dụ: "Kiếm", "Búa") để AI nhận diện trong prompt
  image: string | null; // Base64
}

export interface Character {
  id: string;
  name: string;
  description: string;

  // Cấu trúc mới
  masterImage: string | null; // Ảnh gốc tổng thể (Reference)
  faceImage: string | null; // Slot 1: Face ID (Auto-generated or Manual)
  bodyImage: string | null; // Slot 2: Outfit/Turnaround (Auto-generated or Manual)
  props: CharacterProp[]; // Slot 3-5: Props (Max 3)

  isDefault: boolean;
  isAnalyzing?: boolean;

  // Google Labs Workflow Polling (for async Face/Body generation)
  faceWorkflowId?: string;
  bodyWorkflowId?: string;
  workflowStatus?: 'pending' | 'active' | 'succeeded' | 'failed';
}

export interface SceneDialogue {
  characterName: string;
  line: string;
}

export interface Scene {
  id: string;
  sceneNumber: string;

  // Legacy fields (backward compatibility)
  language1: string;
  vietnamese: string;

  // Structured Script Output Fields (New)
  voiceover?: string; // Narration/voiceover text
  dialogues?: SceneDialogue[]; // Array of character dialogues
  cameraAngle?: string; // Camera position and movement (AI-generated)
  visualDescription?: string; // Visual/environment description

  // Cinematography Overrides (User can customize per-scene)
  cameraAngleOverride?: string; // User override for camera angle
  lensOverride?: string; // User override for lens selection
  transitionType?: string; // Transition to next scene

  // Generation metadata
  promptName: string;
  contextDescription: string;
  characterIds: string[];
  productIds: string[]; // Referenced Products/Props in this scene
  generatedImage: string | null;

  // Video generation
  mediaId?: string; // Google Labs Media ID for Video Gen
  generatedVideo?: string; // URL of generated video
  videoOperationName?: string; // Operation Name for Polling
  videoStatus?: string; // Status: 'active', 'succeeded', 'failed'
  veoPrompt: string; // Prompt tối ưu cho Google Veo

  // UI state
  isGenerating: boolean;
  error: string | null;
}

// Script Preset System
export type ScriptCategory = 'film' | 'documentary' | 'commercial' | 'music-video' | 'custom';
export type SceneStructure = 'traditional' | 'documentary' | 'commercial' | 'montage';

export interface OutputFormat {
  hasDialogue: boolean;
  hasNarration: boolean;
  hasCameraAngles: boolean;
  sceneStructure: SceneStructure;
}

export interface ScriptPreset {
  id: string;
  name: string;
  category: ScriptCategory;
  description: string;
  icon: string;

  // AI Configuration
  systemPrompt: string;
  outputFormat: OutputFormat;

  // Guidelines
  toneKeywords: string[];
  sceneGuidelines: string;
  exampleOutput: string;

  // Metadata
  isDefault: boolean;
  isCustom: boolean;
  createdAt: string;
}

// Advanced Image Editor
export interface DetectedObject {
  id: string;
  name: string;
  description: string;
  position: string; // "left", "center", "right", "top", "bottom", etc.
  selected?: boolean;
}

export interface EditHistory {
  id: string;
  image: string; // base64
  timestamp: number;
  operation: string; // "Original", "Removed person", "Style transfer", etc.
}

export type EditingMode = 'remove' | 'add' | 'style' | 'inpaint' | 'text-edit';

export interface ProjectState {
  projectName: string;
  stylePrompt: string;
  imageModel: string; // Selected Image Gen Model
  aspectRatio: string; // "16:9" | "9:16" | "1:1" | "4:3" | "3:4"
  resolution: string;
  genyuToken?: string; // Optional: For Genyu.io API
  recaptchaToken?: string; // Optional: For Google Labs Recaptcha
  scriptLanguage: 'vietnamese' | 'language1'; // Ngôn ngữ chính để tạo Veo prompt

  // Script Preset System
  activeScriptPreset: string; // ID of currently selected preset
  customScriptPresets: ScriptPreset[]; // User-created presets

  // Cinematography Settings (NEW)
  cameraModel?: string; // Global camera body selection
  defaultLens?: string; // Default lens for all scenes
  customMetaTokens?: string; // Custom creative tokens (if empty, AI generates)

  characters: Character[];
  products: Product[]; // List of Products/Props
  scenes: Scene[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  masterImage: string | null;
  views: {
    front: string | null;
    back: string | null;
    left: string | null;
    right: string | null;
    top: string | null;
  };
  isAnalyzing: boolean;
}