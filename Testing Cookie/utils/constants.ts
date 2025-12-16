import type { ProjectState } from '../types';

// --- APP CONFIG ---
export const APP_NAME = "Scene Director";
export const PRIMARY_GRADIENT = "from-brand-orange to-brand-red";
export const PRIMARY_GRADIENT_HOVER = "from-brand-orange/80 to-brand-red/80";

// --- GLOBAL STYLES ---
export const GLOBAL_STYLES = [
    {
        value: 'cinematic-realistic',
        label: 'Cinematic Realistic (Phim điện ảnh)',
        prompt: 'Cinematic movie screengrab, shot on Arri Alexa, photorealistic, 8k, highly detailed texture, dramatic lighting, shallow depth of field, color graded, film grain, masterpiece, award winning, trending on artstation, aesthetics, highly detailed, sharp focus.'
    },
    {
        value: '3d-pixar',
        label: '3D Animation (Pixar/Disney)',
        prompt: '3D render style, Pixar animation style, octane render, unreal engine 5, cute, vibrant lighting, soft smooth textures, expressive, volumetric lighting, masterpiece, redshift, disney pixar style, high fidelity, 8k.'
    },
    {
        value: 'anime-makoto',
        label: 'Anime (Makoto Shinkai Style)',
        prompt: 'Anime style, Makoto Shinkai art style, high quality 2D animation, beautiful sky, detailed background, vibrant colors, emotional atmosphere, cell shading, masterpiece, best quality, official art, key visual, 4k, detailed illustration.'
    },
    {
        value: 'vintage-film',
        label: 'Vintage 1980s Film (Retro)',
        prompt: '1980s vintage movie look, film grain, retro aesthetic, warm tones, soft focus, kodak portra 400, nostalgia atmosphere, analog photography, grainy, nostalgic, classic movie.'
    },
    {
        value: 'cyberpunk',
        label: 'Cyberpunk / Sci-Fi',
        prompt: 'Cyberpunk aesthetic, neon lighting, dark atmosphere, futuristic, high contrast, wet streets, technological details, blade runner style, futuristic, glowing neon, high tech, intricate details, masterpiece.'
    },
    {
        value: 'watercolor',
        label: 'Watercolor / Artistic',
        prompt: 'Watercolor painting style, soft edges, artistic, painterly, dreamy atmosphere, paper texture, pastel colors, traditional medium, wet on wet, masterpiece, artistic, detailed.'
    },
    {
        value: 'dark-fantasy',
        label: 'Dark Fantasy (Game Style)',
        prompt: 'Dark fantasy art, elden ring style, gritty, atmospheric, ominous lighting, detailed armor and textures, epic scale, oil painting aesthetic, masterpiece, oil painting, intricate, ominous, highly detailed, trending on artstation.'
    }
];

// --- IMAGE MODELS ---
export const IMAGE_MODELS = [
    { value: 'gemini-2.5-flash-image', label: 'Google Nano Banana (Fast)' },
    { value: 'gemini-3-pro-image-preview', label: 'Google Nano Banana Pro (High Quality)' },
];

// --- ASPECT RATIOS ---
export const ASPECT_RATIOS = [
    { value: '16:9', label: '16:9 (Landscape - Cinematic)' },
    { value: '9:16', label: '9:16 (Portrait - Mobile/Reels)' },
    { value: '1:1', label: '1:1 (Square - Social)' },
    { value: '4:3', label: '4:3 (Classic TV)' },
    { value: '3:4', label: '3:4 (Portrait)' },
];

// --- CHARACTER STYLES ---
export const CHARACTER_STYLES = [
    { value: 'pixar', label: '3D Animation (Pixar/Disney Style)' },
    { value: 'anime', label: 'Anime / Manga' },
    { value: 'cinematic', label: 'Realistic Cinematic' },
    { value: 'comic', label: 'American Comic Book' },
    { value: 'fantasy', label: 'Digital Fantasy Art' },
    { value: 'clay', label: 'Claymation / Stop Motion' },
];

// --- Helper to generate ID ---
export const generateId = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// --- INITIAL STATE FACTORY ---
export const createInitialState = (): ProjectState => ({
    projectName: '',
    stylePrompt: 'cinematic-realistic',
    imageModel: 'gemini-2.5-flash-image',
    aspectRatio: '16:9',
    genyuToken: '',
    resolution: '1K',
    scriptLanguage: 'vietnamese',
    characters: Array.from({ length: 3 }).map(() => ({
        id: generateId(),
        name: '',
        description: '',
        masterImage: null,
        faceImage: null,
        bodyImage: null,
        sideImage: null,
        backImage: null,
        props: [
            { id: generateId(), name: '', image: null },
            { id: generateId(), name: '', image: null },
            { id: generateId(), name: '', image: null },
        ],
        isDefault: false,
        isAnalyzing: false,
    })),
    products: [], // Initialize empty product list
    scenes: [],
    activeScriptPreset: 'film-director', // Default preset
    customScriptPresets: [],
});
