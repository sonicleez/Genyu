import type { ProjectState } from '../types';

export const APP_NAME = "Scene Director";
export const PRIMARY_GRADIENT = "from-orange-600 to-red-600";
export const PRIMARY_GRADIENT_HOVER = "from-orange-500 to-red-500";

export const GLOBAL_STYLES = [
    {
        value: 'cinematic-realistic',
        label: 'Cinematic Realistic (Phim điện ảnh)',
        prompt: 'LIVE-ACTION MOVIE SCREENGRAB, shot on Arri Alexa, 35mm film, hyper-realistic, photorealistic, 8k, highly detailed skin texture, pores, dramatic natural lighting, shallow depth of field, color graded, film grain, masterpiece. NEGATIVE: (STRICT NO ANIME, NO CARTOON, NO 2D, NO DRAWING, NO ILLUSTRATION, NO PAINTING).'
    },
    {
        value: '3d-pixar',
        label: '3D Animation (Pixar/Disney)',
        prompt: '3D RENDER STYLE, Pixar animation style, octane render, unreal engine 5, cute, vibrant lighting, soft smooth textures, expressive, volumetric lighting, masterpiece, high fidelity, 8k. NEGATIVE: (STRICT NO PHOTOREALISM, NO REAL-LIFE, NO 2D, NO SKETCH).'
    },
    {
        value: 'anime-makoto',
        label: 'Anime (Makoto Shinkai Style)',
        prompt: 'ANIME STYLE, Makoto Shinkai art style, high quality 2D animation, beautiful sky, detailed background, vibrant colors, emotional atmosphere, cell shading, masterpiece, official art, 4k. NEGATIVE: (STRICT NO PHOTOREALISM, NO 3D RENDER, NO REAL-LIFE).'
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

export const CAMERA_MODELS = [
    { value: '', label: 'Auto (AI chọn)', prompt: '' },
    { value: 'arri-alexa-35', label: 'ARRI Alexa 35', prompt: 'Shot on ARRI Alexa 35, rich cinematic colors, natural skin tones, wide dynamic range' },
    { value: 'red-v-raptor', label: 'RED V-Raptor', prompt: 'Shot on RED V-Raptor 8K, high contrast, razor sharp details, vivid colors' },
    { value: 'sony-venice-2', label: 'Sony Venice 2', prompt: 'Shot on Sony Venice 2, natural color science, beautiful skin tones, filmic look' },
    { value: 'blackmagic-ursa', label: 'Blackmagic URSA', prompt: 'Shot on Blackmagic URSA, organic film-like texture, Blackmagic color science' },
    { value: 'canon-c70', label: 'Canon C70', prompt: 'Shot on Canon C70, documentary style, natural colors, versatile look' },
    { value: 'panasonic-s1h', label: 'Panasonic S1H', prompt: 'Shot on Panasonic S1H, natural tones, subtle film grain, professional video look' },
];

export const LENS_OPTIONS = [
    { value: '', label: 'Auto (AI chọn)', prompt: '', useCase: 'AI decides based on scene' },
    { value: '16mm', label: '16mm Ultra Wide', prompt: '16mm ultra wide angle lens, expansive field of view, dramatic perspective', useCase: 'Epic landscapes, architecture' },
    { value: '24mm', label: '24mm Wide', prompt: '24mm wide angle lens, environmental context, slight distortion', useCase: 'Establishing shots, interiors' },
    { value: '35mm', label: '35mm Standard Wide', prompt: '35mm lens, natural perspective, slight wide angle', useCase: 'Walking shots, dialogue scenes' },
    { value: '50mm', label: '50mm Standard', prompt: '50mm lens, natural human perspective, minimal distortion', useCase: 'Dialogue, interviews, portraits' },
    { value: '85mm', label: '85mm Portrait', prompt: '85mm portrait lens, shallow depth of field, beautiful bokeh, flattering compression', useCase: 'Close-ups, beauty shots' },
    { value: '135mm', label: '135mm Telephoto', prompt: '135mm telephoto lens, compressed background, intimate feel, creamy bokeh', useCase: 'Emotional moments, isolation' },
    { value: '200mm', label: '200mm Long Tele', prompt: '200mm telephoto lens, extreme background compression, voyeuristic feel', useCase: 'Surveillance, nature' },
    { value: 'anamorphic', label: 'Anamorphic 2.39:1', prompt: 'anamorphic lens, horizontal lens flares, oval bokeh, cinematic widescreen 2.39:1 aspect ratio', useCase: 'Cinematic epic look' },
    { value: 'macro', label: 'Macro Lens', prompt: 'macro lens, extreme close-up, sharp details, shallow depth of field', useCase: 'Product details, textures' },
];

export const CAMERA_ANGLES = [
    { value: '', label: 'Auto (AI chọn)' },
    { value: 'wide-shot', label: 'Wide Shot (WS)' },
    { value: 'medium-shot', label: 'Medium Shot (MS)' },
    { value: 'close-up', label: 'Close-Up (CU)' },
    { value: 'extreme-cu', label: 'Extreme Close-Up (ECU)' },
    { value: 'ots', label: 'Over-the-Shoulder (OTS)' },
    { value: 'low-angle', label: 'Low Angle (Hero Shot)' },
    { value: 'high-angle', label: 'High Angle (Vulnerable)' },
    { value: 'dutch-angle', label: 'Dutch Angle (Tension)' },
    { value: 'pov', label: 'POV (First Person)' },
    { value: 'establishing', label: 'Establishing Shot' },
    { value: 'two-shot', label: 'Two Shot' },
    { value: 'insert', label: 'Insert / Detail Shot' },
];

export const DEFAULT_META_TOKENS: Record<string, string> = {
    'film': 'cinematic lighting, depth of field, film grain, anamorphic lens flare, color graded, atmospheric haze',
    'documentary': 'natural light, handheld camera feel, raw authentic look, observational style, candid moments',
    'commercial': 'product hero lighting, clean studio aesthetics, vibrant colors, high production value, aspirational mood',
    'music-video': 'dramatic lighting, high contrast, stylized color palette, dynamic angles, music video aesthetic',
    'custom': 'professional photography, detailed textures, balanced composition, thoughtful lighting'
};

export const TRANSITION_TYPES = [
    { value: '', label: 'Auto', hint: 'AI decides transition' },
    { value: 'cut', label: 'Cut', hint: 'Direct cut - instant change' },
    { value: 'match-cut', label: 'Match Cut', hint: 'Visual similarity between scenes' },
    { value: 'dissolve', label: 'Dissolve', hint: 'Gradual blend between scenes' },
    { value: 'fade-black', label: 'Fade to Black', hint: 'Scene ends with black' },
    { value: 'fade-white', label: 'Fade to White', hint: 'Scene ends with white' },
    { value: 'wipe', label: 'Wipe', hint: 'Directional reveal' },
    { value: 'jump-cut', label: 'Jump Cut', hint: 'Jarring time skip' },
    { value: 'smash-cut', label: 'Smash Cut', hint: 'Sudden dramatic contrast' },
    { value: 'l-cut', label: 'L-Cut', hint: 'Audio continues over next scene' },
    { value: 'j-cut', label: 'J-Cut', hint: 'Audio precedes visual' },
];

export const VEO_MODES = [
    { value: 'image-to-video', label: '🎬 Image → Video', hint: 'Một ảnh tạo video' },
    { value: 'start-end-frame', label: '🎞️ Start/End Frame', hint: 'Hai ảnh làm điểm đầu & cuối' },
];

export const VEO_PRESETS = [
    {
        value: 'cinematic-master',
        label: '🎬 Cinematic Master (Single Shot)',
        prompt: 'Generate a high-end SINGLE-SHOT sequence. Follow the formula: [00:00-00:06] [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. Professional Arri Alexa look, steady motion.',
        keywords: 'steady cam, Arri Alexa, balanced composition, 6-second single shot'
    },
    {
        value: 'storytelling-multi',
        label: '🗣️ Storytelling (Multi-Shot Timestamp)',
        prompt: 'Generate a MULTI-SHOT sequence with 2-second segments. Use timestamps [00:00-00:02], [00:02-00:04], [00:04-00:06]. Focus on character interaction and dialogue sync. Each segment should have its own Camera/Shot type.',
        keywords: 'cross-cutting, dialogue exchange, multiple angles, synchronized sound'
    },
    {
        value: 'action-sequence',
        label: '⚡ Action Sequence (Multi-Shot)',
        prompt: 'STRICT REQUIREMENT: Generate 4 distinct shots using timestamps [00:00-00:02], [00:02-00:04], [00:04-00:06], [00:06-00:08]. Use high-energy camera movements (Arc, Dolly, Crane) in EACH segment to create kinetic motion blur.',
        keywords: 'rapid cuts, kinetic energy, motion blur, 4-shot sequence, professional editing'
    },
    {
        value: 'mood-atmosphere',
        label: '☁️ Mood & Atmosphere',
        prompt: 'Single shot focusing on lighting and emotion. Formula: [00:00-00:06] [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. Use Emotion and SFX tags heavily.',
        keywords: 'Emotion: Melancholy, volumetric lighting, atmospheric fog, slow movement'
    },
    {
        value: 'macro-detail',
        label: '🔭 Macro / Detail',
        prompt: 'Extreme close-up single shot. Focus on textures and micro-movements using macro lens and shallow depth of field.',
        keywords: 'Macro lens, extreme close-up, shallow depth of field, sharp textures'
    },
    {
        value: 'epic-establishment',
        label: '🚁 Epic Establishment',
        prompt: 'Wide aerial or high-angle crane shot. Single long take (6-8 seconds) revealing the vast scale of the environment.',
        keywords: 'Aerial view, crane shot, wide-angle lens, epic scale, reveal'
    }
];

export const IMAGE_ROLES = [
    { value: 'single', label: '📷 Single Image', color: 'gray' },
    { value: 'start-frame', label: '🟢 Start Frame', color: 'green' },
    { value: 'end-frame', label: '🔴 End Frame', color: 'red' },
];

export const IMAGE_MODELS = [
    { value: 'gemini-3-pro-image-preview', label: 'Google Nano Banana Pro (High Quality)' },
];

export const SCRIPT_MODELS = [
    { value: 'gemini-3-pro-preview|high', label: 'Gemini 3 Pro (High Reasoning)' },
    { value: 'gemini-3-pro-preview|low', label: 'Gemini 3 Pro (Low Latency)' },
    { value: 'gemini-3-flash-preview|high', label: 'Gemini 3 Flash (Smart)' },
    { value: 'gemini-3-flash-preview|medium', label: 'Gemini 3 Flash (Balanced)' },
    { value: 'gemini-3-flash-preview|low', label: 'Gemini 3 Flash (Fast)' },
    { value: 'gemini-3-flash-preview|minimal', label: 'Gemini 3 Flash (Minimal Thinking)' },
    { value: 'gemini-2.5-flash|none', label: 'Gemini 2.5 Flash (Legacy)' },
];

export const ASPECT_RATIOS = [
    { value: '16:9', label: '16:9 (Landscape - Cinematic)' },
    { value: '9:16', label: '9:16 (Portrait - Mobile/Reels)' },
    { value: '1:1', label: '1:1 (Square - Social)' },
    { value: '4:3', label: '4:3 (Classic TV)' },
    { value: '3:4', label: '3:4 (Portrait)' },
];

export const CHARACTER_STYLES = [
    {
        value: 'pixar',
        label: '3D Animation (Pixar/Disney Style)',
        prompt: 'STRICT STYLE: High-end 3D character render (Pixar/Disney style). TECHNICAL TOKENS: [Volumetric Subsurface Scattering, PBR Materials, Ray-traced Reflections, Octane Render quality, 8k resolution]. SIGNATURE: Soft rounded features, highly expressive eyes with glossy iris reflections, realistic fabric textures on stylized clothing. BACKGROUND: Pure Solid White Studio Background (RGB 255, 255, 255). LIGHTING: Global illumination, soft rim lights for 3D depth.'
    },
    {
        value: 'anime',
        label: 'Anime / Manga',
        prompt: 'STRICT STYLE: Masterpiece Japanese Anime illustration. TECHNICAL TOKENS: [Sharp Vector Lineart, Dynamic Cell Shading, Cinematic Atmospheric Perspective, High-detail IRIS lighting]. SIGNATURE: Crisp edges, vibrant hair highlights, clean gradients, expressive facial topology. BACKGROUND: Pure Solid White Studio Background (RGB 255, 255, 255). LIGHTING: Clean studio key lighting.'
    },
    {
        value: 'cinematic',
        label: 'Realistic Cinematic',
        prompt: 'STRICT STYLE: Hyper-realistic cinematic portrait. META TOKENS: [Ultra-detailed skin pores, Hyper-fine hair strands, Subsurface Scattering (SSS) on skin, Natural skin variations/freckles, Micro-displacement textures, NO-PLASTIC-LOOK]. SIGNATURE: Biological realism, accurate anatomical light occlusion, realistic eye moisture. BACKGROUND: Pure Solid White Studio Background (RGB 255, 255, 255). LIGHTING: High-end professional studio lighting (Key, Fill, Rim) for maximal skin texture definition.'
    },
    {
        value: 'comic',
        label: 'American Comic Book',
        prompt: 'STRICT STYLE: Modern American Comic Book art. TECHNICAL TOKENS: [Hand-drawn Hatching, Ben-Day dot shading, High-contrast Inkwork, dynamic silhouette]. SIGNATURE: Bold outlines, graphic shadows, vibrant primary color palettes, dramatic composition. BACKGROUND: Pure Solid White Studio Background (RGB 255, 255, 255).'
    },
    {
        value: 'fantasy',
        label: 'Digital Fantasy Art',
        prompt: 'STRICT STYLE: High-fantasy digital concept art. TECHNICAL TOKENS: [Intricate armor engravings, ethereal magical glow, layered painterly textures, sharp rim highlights]. SIGNATURE: Majestic presence, highly detailed costume materials (leather, steel, silk), atmospheric particles. BACKGROUND: Pure Solid White Studio Background (RGB 255, 255, 255).'
    },
    {
        value: 'clay',
        label: 'Claymation / Stop Motion',
        prompt: 'STRICT STYLE: Professional Claymation puppet style. TECHNICAL TOKENS: [Visible fingerprint textures, Hand-kneaded clay marks, Matte organic finish, Soft-shadow occlusion]. SIGNATURE: Tactile physical appearance, handcrafted imperfections, vibrant colored clay. BACKGROUND: Pure Solid White Studio Background (RGB 255, 255, 255). LIGHTING: Soft studio setup.'
    },
];

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const INITIAL_STATE: ProjectState = {
    projectName: '',
    stylePrompt: 'cinematic-realistic',
    imageModel: 'gemini-3-pro-image-preview',
    scriptModel: 'gemini-3-pro-preview|high',
    aspectRatio: '16:9',
    resolution: '1K',
    scriptLanguage: 'vietnamese',
    activeScriptPreset: 'film-animation',
    customScriptPresets: [],
    characters: Array.from({ length: 1 }).map(() => ({
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
    products: [
        {
            id: generateId(),
            name: '',
            description: '',
            masterImage: null,
            views: {
                front: null,
                back: null,
                left: null,
                right: null,
                top: null,
            },
            isAnalyzing: false,
        }
    ],
    scenes: [],
    sceneGroups: [],
};

export const CREATIVE_PRESETS = [
    {
        category: 'Genre/Thể loại',
        items: [
            { label: 'Cyberpunk', value: 'cyberpunk aesthetic, neon lighting, dark urban atmosphere' },
            { label: 'Western', value: 'western style, dusty desert, cinematic sun flares, gritty' },
            { label: 'Noir', value: 'film noir, high contrast, black and white, dramatic shadows' },
            { label: 'Sci-Fi', value: 'futuristic technology, sleek design, ethereal lighting' },
            { label: 'Horror', value: 'horror atmosphere, tense lighting, dark shadows' },
            { label: 'Slice of Life', value: 'natural lighting, realistic atmosphere, everyday moments' }
        ]
    },
    {
        category: 'Filming Style/Kiểu quay',
        items: [
            { label: 'Handheld', value: 'handheld camera feel, raw, authentic' },
            { label: 'Steadicam', value: 'smooth steadicam motion, fluid movement' },
            { label: 'Drone/Aerial', value: 'stunning aerial view, drone shot, sweeping landscape' },
            { label: 'Static/Classic', value: 'static camera, stable composition, classic framing' },
            { label: 'Long Take', value: 'continuous long take, immersive movement' }
        ]
    },
    {
        category: 'Shot Type/Đặc tả',
        items: [
            { label: 'POV', value: 'POV shot, first-person perspective, immersive' },
            { label: 'Extreme CU', value: 'extreme close-up, sharp macro details' },
            { label: 'Bird\'s Eye', value: 'bird\'s eye view, top-down perspective' },
            { label: 'Low Angle', value: 'heroic low angle shot, powerful perspective' },
            { label: 'High Angle', value: 'vulnerable high angle shot' },
            { label: 'Dutch Angle', value: 'unsettling dutch angle, tilted frame' }
        ]
    }
];
