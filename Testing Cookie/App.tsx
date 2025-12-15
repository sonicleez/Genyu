
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ProjectState, Character, Scene, CharacterProp, ScriptPreset, Product } from './types';
import { Trash2, Plus } from 'lucide-react';
import { useHotkeys } from './hooks/useHotkeys';
import { saveProject, openProject } from './utils/fileUtils';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { PresetSelector } from './components/PresetSelector';
import { getPresetById } from './utils/scriptPresets';
import { buildScriptPrompt } from './utils/promptBuilder';
import { AdvancedImageEditor } from './components/AdvancedImageEditor';
import Modal from './components/Modal';
import SingleImageSlot from './components/SingleImageSlot';
import { CharacterDetailModal } from './components/CharacterDetailModal';
import { ProductDetailModal } from './components/ProductDetailModal';

// @ts-ignore
const JSZip = window.JSZip;
// @ts-ignore
const XLSX = window.XLSX;


const APP_NAME = "Khung Ứng Dụng";
const PRIMARY_GRADIENT = "from-orange-600 to-red-600";
const PRIMARY_GRADIENT_HOVER = "from-orange-500 to-red-500";

const slugify = (text: string): string => {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
};

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// --- DEFINED GLOBAL STYLES ---
const GLOBAL_STYLES = [
    {
        value: 'cinematic-realistic',
        label: 'Cinematic Realistic (Phim điện ảnh)',
        prompt: 'Cinematic movie screengrab, shot on Arri Alexa, photorealistic, 8k, highly detailed texture, dramatic lighting, shallow depth of field, color graded, film grain.'
    },
    {
        value: '3d-pixar',
        label: '3D Animation (Pixar/Disney)',
        prompt: '3D render style, Pixar animation style, octane render, unreal engine 5, cute, vibrant lighting, soft smooth textures, expressive, volumetric lighting, masterpiece.'
    },
    {
        value: 'anime-makoto',
        label: 'Anime (Makoto Shinkai Style)',
        prompt: 'Anime style, Makoto Shinkai art style, high quality 2D animation, beautiful sky, detailed background, vibrant colors, emotional atmosphere, cell shading.'
    },
    {
        value: 'vintage-film',
        label: 'Vintage 1980s Film (Retro)',
        prompt: '1980s vintage movie look, film grain, retro aesthetic, warm tones, soft focus, kodak portra 400, nostalgia atmosphere.'
    },
    {
        value: 'cyberpunk',
        label: 'Cyberpunk / Sci-Fi',
        prompt: 'Cyberpunk aesthetic, neon lighting, dark atmosphere, futuristic, high contrast, wet streets, technological details, blade runner style.'
    },
    {
        value: 'watercolor',
        label: 'Watercolor / Artistic',
        prompt: 'Watercolor painting style, soft edges, artistic, painterly, dreamy atmosphere, paper texture, pastel colors.'
    },
    {
        value: 'dark-fantasy',
        label: 'Dark Fantasy (Game Style)',
        prompt: 'Dark fantasy art, elden ring style, gritty, atmospheric, ominous lighting, detailed armor and textures, epic scale, oil painting aesthetic.'
    }
];

// ========== CINEMATOGRAPHY OPTIONS ==========
const CAMERA_MODELS = [
    { value: '', label: 'Auto (AI chọn)', prompt: '' },
    { value: 'arri-alexa-35', label: 'ARRI Alexa 35', prompt: 'Shot on ARRI Alexa 35, rich cinematic colors, natural skin tones, wide dynamic range' },
    { value: 'red-v-raptor', label: 'RED V-Raptor', prompt: 'Shot on RED V-Raptor 8K, high contrast, razor sharp details, vivid colors' },
    { value: 'sony-venice-2', label: 'Sony Venice 2', prompt: 'Shot on Sony Venice 2, natural color science, beautiful skin tones, filmic look' },
    { value: 'blackmagic-ursa', label: 'Blackmagic URSA', prompt: 'Shot on Blackmagic URSA, organic film-like texture, Blackmagic color science' },
    { value: 'canon-c70', label: 'Canon C70', prompt: 'Shot on Canon C70, documentary style, natural colors, versatile look' },
    { value: 'panasonic-s1h', label: 'Panasonic S1H', prompt: 'Shot on Panasonic S1H, natural tones, subtle film grain, professional video look' },
];

const LENS_OPTIONS = [
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

const CAMERA_ANGLES = [
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

const DEFAULT_META_TOKENS: Record<string, string> = {
    'film': 'cinematic lighting, depth of field, film grain, anamorphic lens flare, color graded, atmospheric haze',
    'documentary': 'natural light, handheld camera feel, raw authentic look, observational style, candid moments',
    'commercial': 'product hero lighting, clean studio aesthetics, vibrant colors, high production value, aspirational mood',
    'music-video': 'dramatic lighting, high contrast, stylized color palette, dynamic angles, music video aesthetic',
    'custom': 'professional photography, detailed textures, balanced composition, thoughtful lighting'
};

const TRANSITION_TYPES = [
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

// Veo 3.1 Mode Options
const VEO_MODES = [
    { value: 'image-to-video', label: '🎬 Image → Video', hint: 'Một ảnh tạo video' },
    { value: 'start-end-frame', label: '🎞️ Start/End Frame', hint: 'Hai ảnh làm điểm đầu & cuối' },
];

const IMAGE_ROLES = [
    { value: 'single', label: '📷 Single Image', color: 'gray' },
    { value: 'start-frame', label: '🟢 Start Frame', color: 'green' },
    { value: 'end-frame', label: '🔴 End Frame', color: 'red' },
];


const IMAGE_MODELS = [
    { value: 'gemini-2.5-flash-image', label: 'Google Nano Banana (Fast)' },
    { value: 'gemini-3-pro-image-preview', label: 'Google Nano Banana Pro (High Quality)' },
];

const INITIAL_STATE: ProjectState = {
    projectName: '',
    stylePrompt: 'cinematic-realistic', // Default to value
    imageModel: 'gemini-2.5-flash-image',
    aspectRatio: '16:9',
    genyuToken: '',
    resolution: '1K', // Default resolution
    scriptLanguage: 'vietnamese',

    // Script Preset System
    activeScriptPreset: 'film-animation', // Default to Film preset
    customScriptPresets: [],

    characters: Array.from({ length: 3 }).map(() => ({
        id: generateId(),
        name: '',
        description: '',
        masterImage: null,
        faceImage: null,
        bodyImage: null,
        props: [
            { id: generateId(), name: '', image: null },
            { id: generateId(), name: '', image: null },
            { id: generateId(), name: '', image: null },
        ],
        isDefault: false,
        isAnalyzing: false,
    })),
    products: [],
    scenes: [],
};

const ASPECT_RATIOS = [
    { value: '16:9', label: '16:9 (Landscape - Cinematic)' },
    { value: '9:16', label: '9:16 (Portrait - Mobile/Reels)' },
    { value: '1:1', label: '1:1 (Square - Social)' },
    { value: '4:3', label: '4:3 (Classic TV)' },
    { value: '3:4', label: '3:4 (Portrait)' },
];

const CHARACTER_STYLES = [
    {
        value: 'pixar',
        label: '3D Animation (Pixar/Disney Style)',
        prompt: 'STRICT STYLE: 3D rendered character in Pixar/Disney animation style. MUST have: soft rounded features, smooth gradient shading, large expressive eyes with glossy reflections, exaggerated proportions (big head, small body for cute characters), vibrant saturated colors, soft ambient lighting with rim lights, no hard edges, clean subsurface scattering on skin. Art style: Toy Story, Inside Out, Zootopia aesthetic. Render engine style: Arnold/RenderMan quality.'
    },
    {
        value: 'anime',
        label: 'Anime / Manga',
        prompt: 'STRICT STYLE: Japanese anime/manga illustration. MUST have: large detailed eyes with highlights and sparkles, sharp clean lineart, cel-shaded coloring with minimal gradients, vibrant hair colors with chunky highlights, sharp angular shadows, exaggerated facial expressions, simplified nose (small dots or lines), detailed clothing folds. Art style: Studio Ghibli, Makoto Shinkai, modern anime aesthetic. NO realistic shading, NO western cartoon style.'
    },
    {
        value: 'cinematic',
        label: 'Realistic Cinematic',
        prompt: 'STRICT STYLE: Photorealistic cinematic rendering. MUST have: realistic skin texture with pores and subsurface scattering, accurate anatomy and proportions, natural hair strands with physics, realistic fabric materials with wrinkles, professional studio lighting (key light + fill + rim), shallow depth of field, film grain texture, color grading like Hollywood movies. Photography style: 85mm portrait lens, f/2.8 aperture, cinematic color palette. NO cartoon features, NO stylization.'
    },
    {
        value: 'comic',
        label: 'American Comic Book',
        prompt: 'STRICT STYLE: American comic book illustration. MUST have: bold black ink outlines (thick outer lines, thinner inner details), strong contrast with dramatic shadows, halftone dot shading, dynamic poses with motion lines, exaggerated anatomy (muscular heroes, curvy females), vibrant primary colors (red, blue, yellow dominance), Ben-Day dots texture. Art style: Marvel/DC comics, Jack Kirby, Jim Lee aesthetic. NO soft gradients, NO realistic rendering.'
    },
    {
        value: 'fantasy',
        label: 'Digital Fantasy Art',
        prompt: 'STRICT STYLE: Epic fantasy digital painting. MUST have: painterly brush strokes visible, rich atmospheric lighting (magical glows, dramatic backlighting), detailed costume design with ornate patterns, fantasy elements (armor, robes, magical effects), semi-realistic proportions with idealized features, rich color palette with jewel tones, ethereal atmosphere with particles/mist. Art style: concept art for games like World of Warcraft, League of Legends, Magic: The Gathering. Medium: digital painting with visible brush work.'
    },
    {
        value: 'clay',
        label: 'Claymation / Stop Motion',
        prompt: 'STRICT STYLE: Claymation/stop-motion puppet style. MUST have: visible fingerprint textures on clay surface, slightly lumpy handmade appearance, matte finish with no glossy shine, simple geometric shapes, visible wire armature bumps, exaggerated simplified features, chunky proportions, soft pastel or earthy colors, slight imperfections showing handcrafted quality. Art style: Wallace & Gromit, Coraline, Kubo aesthetic. NO smooth 3D rendering, NO clean digital look.'
    },
];

// --- Helper Functions ---
const downloadImage = (base64Image: string, filename: string) => {
    if (!base64Image) return;
    const link = document.createElement('a');
    link.href = base64Image;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


// --- Sub-components ---

interface HeaderProps {
    isSticky: boolean;
    onApiKeyClick: () => void;
    onSave: () => void;
    onOpen: () => void;
    onNewProject: () => void;
    onDownloadAll: () => void;
    canDownload: boolean;
    isContinuityMode: boolean;
    toggleContinuityMode: () => void;
    onGenyuClick: () => void;
}
const Header: React.FC<HeaderProps> = ({ isSticky, onApiKeyClick, onSave, onOpen, onNewProject, onDownloadAll, canDownload, isContinuityMode, toggleContinuityMode, onGenyuClick }) => (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isSticky ? 'bg-black/50 backdrop-blur-sm shadow-lg' : 'bg-transparent'}`}>
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>

            <div className="flex items-center space-x-4">
                {/* Continuity Toggle */}
                <div className="flex items-center space-x-2 bg-gray-800/80 px-3 py-1.5 rounded-full border border-gray-600" title="Khi bật: AI sẽ nhìn thấy ảnh của cảnh trước để vẽ cảnh sau giống bối cảnh/ánh sáng.">
                    <span className="text-xs font-semibold text-gray-300">Khóa Bối Cảnh (Continuity):</span>
                    <button
                        onClick={toggleContinuityMode}
                        className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${isContinuityMode ? 'bg-brand-orange' : 'bg-gray-600'}`}
                    >
                        <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${isContinuityMode ? 'translate-x-5' : ''}`}></div>
                    </button>
                </div>

                <div className="flex items-center space-x-2 md:space-x-4">
                    <button onClick={onNewProject} className="px-3 py-2 text-xs md:text-sm font-semibold text-white bg-blue-600/50 rounded-lg hover:bg-blue-600/70 transition-colors">📄 New</button>
                    <button onClick={onSave} className="px-3 py-2 text-xs md:text-sm font-semibold text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors">Lưu (Ctrl+S)</button>
                    <button onClick={onOpen} className="px-3 py-2 text-xs md:text-sm font-semibold text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors">Mở (Ctrl+O)</button>
                    {canDownload && <button onClick={onDownloadAll} className={`px-3 py-2 text-xs md:text-sm font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all`}>Tải Full ZIP</button>}
                    <button onClick={onGenyuClick} className="px-3 py-2 text-xs md:text-sm font-semibold text-white bg-purple-600/50 rounded-lg hover:bg-purple-600/70 transition-colors">Genyu API</button>
                    <button onClick={onApiKeyClick} className="px-3 py-2 text-xs md:text-sm font-semibold text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors">API Key</button>
                </div>
            </div>
        </div>
    </header>
);

interface ProjectNameInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
const ProjectNameInput: React.FC<ProjectNameInputProps> = ({ value, onChange }) => (
    <div className="relative w-full max-w-2xl mx-auto my-8">
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder=" "
            className={`peer w-full bg-transparent text-center text-4xl md:text-5xl font-extrabold outline-none border-none p-2 transition-all duration-300 ${value ? `bg-clip-text text-transparent bg-gradient-to-r ${PRIMARY_GRADIENT}` : 'text-gray-500'}`}
            style={{ textTransform: 'uppercase' }}
        />
        <label className={`absolute left-0 -top-3.5 w-full text-center text-gray-500 text-sm transition-all duration-300 pointer-events-none 
            peer-placeholder-shown:text-xl peer-placeholder-shown:top-2 peer-placeholder-shown:text-gray-400
            peer-focus:-top-3.5 peer-focus:text-sm peer-focus:text-green-400`}>
            NHẬP TÊN DỰ ÁN CỦA BẠN
        </label>
    </div>
);

// --- Text Expander Modal (Popup for editing any text) ---
interface TextExpanderModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}
const TextExpanderModal: React.FC<TextExpanderModalProps> = ({ isOpen, onClose, title, value, onChange, placeholder }) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        if (isOpen) setLocalValue(value);
    }, [isOpen, value]);

    const handleSave = () => {
        onChange(localValue);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>📝</span> {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="flex-1 p-4 overflow-hidden">
                    <textarea
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        placeholder={placeholder}
                        autoFocus
                        className="w-full h-full min-h-[300px] bg-gray-800 border border-gray-600 rounded-lg p-4 text-white text-sm leading-relaxed focus:border-brand-orange focus:outline-none resize-none"
                    />
                </div>
                <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleSave} className={`px-6 py-2 bg-gradient-to-r ${PRIMARY_GRADIENT} text-white font-bold rounded-lg hover:opacity-90 transition-opacity`}>
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Expandable Textarea with popup button ---
interface ExpandableTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
    title?: string;
}
const ExpandableTextarea: React.FC<ExpandableTextareaProps> = ({ value, onChange, placeholder, rows = 3, className = '', title = 'Chỉnh sửa nội dung' }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <div className="relative group">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    className={className}
                />
                <button
                    onClick={() => setIsExpanded(true)}
                    className="absolute top-1 right-1 w-5 h-5 bg-gray-700/80 hover:bg-brand-orange text-gray-400 hover:text-white rounded flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                    title="Mở rộng để chỉnh sửa"
                >
                    ⛶
                </button>
            </div>
            <TextExpanderModal
                isOpen={isExpanded}
                onClose={() => setIsExpanded(false)}
                title={title}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
        </>
    );
};


interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
    setApiKey: (key: string) => void;
}
const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, apiKey, setApiKey }) => {
    const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCheckStatus('idle');
            setStatusMsg('');
        }
    }, [isOpen]);

    const handleVerify = async () => {
        if (!apiKey.trim()) {
            setCheckStatus('error');
            setStatusMsg("Vui lòng nhập API Key.");
            return;
        }

        setCheckStatus('checking');
        try {
            const ai = new GoogleGenAI({ apiKey });
            // Test connection with a cheap/fast model to verify key permissions
            await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: 'Test connection' }] }
            });
            setCheckStatus('success');
            setStatusMsg("Kết nối thành công! Key hợp lệ.");
            setTimeout(onClose, 1500);
        } catch (error: any) {
            setCheckStatus('error');
            let msg = error.message || "Lỗi kết nối.";
            if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
                msg = "Lỗi 403: Quyền bị từ chối. Hãy kiểm tra: 1) Project GCP đã bật Generative AI API chưa? 2) Billing đã kích hoạt chưa?";
            } else if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
                msg = "Lỗi 400: API Key không hợp lệ.";
            }
            setStatusMsg(msg);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quản lý API Key">
            <p className="text-gray-400 mb-4">Nhập Gemini API key của bạn (Paid Tier 1) để sử dụng.</p>
            <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API Key"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {checkStatus !== 'idle' && (
                <div className={`mt-3 text-sm p-3 rounded-lg border flex items-start ${checkStatus === 'checking' ? 'bg-blue-900/30 border-blue-800 text-blue-200' :
                    checkStatus === 'success' ? 'bg-green-900/30 border-green-800 text-green-200' :
                        'bg-red-900/30 border-red-800 text-red-200'
                    }`}>
                    <span className="mr-2 text-lg">
                        {checkStatus === 'checking' && '⏳'}
                        {checkStatus === 'success' && '✅'}
                        {checkStatus === 'error' && '⚠️'}
                    </span>
                    <span>{statusMsg}</span>
                </div>
            )}

            <div className="flex justify-end mt-6 space-x-2">
                <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium">Đóng</button>
                <button
                    onClick={handleVerify}
                    disabled={checkStatus === 'checking'}
                    className={`px-6 py-2 font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {checkStatus === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra & Lưu'}
                </button>
            </div>
        </Modal>
    );
};

interface GenyuTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    setToken: (token: string) => void;
    recaptchaToken: string;
    setRecaptchaToken: (token: string) => void;
}
const GenyuTokenModal: React.FC<GenyuTokenModalProps> = ({ isOpen, onClose, token, setToken, recaptchaToken, setRecaptchaToken }) => {
    const [testResult, setTestResult] = useState<any>(null);
    const [isTesting, setIsTesting] = useState(false);

    const handleTestTokens = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const response = await fetch('http://localhost:3001/api/test-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, recaptchaToken })
            });

            const result = await response.json();
            setTestResult(result);
            console.log('Token Test Result:', result);
        } catch (error) {
            console.error('Test failed:', error);
            setTestResult({ ready: false, message: '❌ Server error' });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Genyu Token & Recaptcha">
            <div className="space-y-4">
                <div>
                    <p className="text-gray-400 mb-2">1. Session Token (Cookie):</p>
                    <p className="text-xs text-gray-500 mb-1">F12 → Application → Cookies → __Secure-next-auth.session-token</p>
                    <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="eyJh..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>
                <div>
                    <p className="text-gray-400 mb-2">2. Recaptcha Token (Google Labs):</p>
                    <p className="text-xs text-gray-500 mb-1">F12 → Network → Filter "video:batchAsyncGenerateVideoStartImage" → Payload → clientContext.recaptchaToken</p>
                    <input
                        type="text"
                        value={recaptchaToken}
                        onChange={(e) => setRecaptchaToken(e.target.value)}
                        placeholder="0cAFcWeA..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                {/* Test Result Display */}
                {testResult && (
                    <div className={`p-4 rounded-lg ${testResult.ready ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
                        <p className="font-bold mb-2">{testResult.message}</p>
                        {testResult.issues && testResult.issues.length > 0 && (
                            <ul className="text-sm space-y-1">
                                {testResult.issues.map((issue: string, i: number) => (
                                    <li key={i} className="text-red-400">• {issue}</li>
                                ))}
                            </ul>
                        )}
                        {testResult.ready && (
                            <p className="text-sm text-green-400 mt-2">✅ Ready to generate videos!</p>
                        )}
                    </div>
                )}
            </div>
            <div className="flex justify-between mt-6">
                <button
                    onClick={handleTestTokens}
                    disabled={isTesting}
                    className="px-6 py-2 font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                >
                    {isTesting ? 'Testing...' : '🔍 Test Tokens'}
                </button>
                <button onClick={onClose} className="px-6 py-2 font-semibold text-white rounded-lg bg-green-600 hover:bg-green-500">
                    Save & Close
                </button>
            </div>
        </Modal>
    );
};

interface CoffeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
}
const CoffeeModal: React.FC<CoffeeModalProps> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Cho @Mrsonic30 1 follow ">
        <p className="text-gray-400 mb-4 text-center">Nếu bạn thấy những chia sẻ của mình hữu ích!</p>
        <div className="flex flex-col items-center">
            <img src="N/a images" alt="QR Code for coffee" className="w-64 h-64 rounded-lg border-2 border-gray-700" />
            <p className="text-xs text-gray-500 mt-4">Đổi nội dung bong bóng này tùy theo nhu cầu của bạn.</p>
        </div>
    </Modal>
);

interface CoffeeButtonProps {
    onClick: () => void;
}
const CoffeeButton: React.FC<CoffeeButtonProps> = ({ onClick }) => (
    <button onClick={onClick} className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl shadow-lg transition-transform hover:scale-110 bg-gradient-to-br ${PRIMARY_GRADIENT}`}>
        ☕
    </button>
);

// --- Character Generator Modal ---
interface CharacterGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (image: string) => void;
    apiKey: string;
    genyuToken?: string;
    model: string;
    charId: string | null;
    updateCharacter: (id: string, updates: Partial<Character>) => void;
}

const CharacterGeneratorModal: React.FC<CharacterGeneratorModalProps> = ({ isOpen, onClose, onSave, apiKey, genyuToken, model, charId, updateCharacter }) => {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('pixar');
    const [resolution, setResolution] = useState('1K'); // Added resolution state
    const [aspectRatio, setAspectRatio] = useState('9:16'); // Default 9:16 for characters
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(model); // Local state for control

    useEffect(() => {
        if (isOpen) {
            setPrompt('');
            setGeneratedImage(null);
            setError(null);
            setSelectedModel(model); // Sync with prop on open
            setResolution('1K'); // Reset resolution
            setAspectRatio('9:16'); // Reset aspect ratio
        }
    }, [isOpen, model]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        // Check for either API Key or Genyu Token
        if (!apiKey && !genyuToken) {
            setError("Vui lòng nhập API Key (Gemini) hoặc Token (Genyu).");
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const styleConfig = CHARACTER_STYLES.find(s => s.value === style);
            const stylePrompt = styleConfig?.prompt || styleConfig?.label || style;

            const fullPrompt = `
CHARACTER DESIGN TASK:
Create a professional character sheet with the following specifications:

${stylePrompt}

CHARACTER DESCRIPTION:
${prompt}

MANDATORY REQUIREMENTS:
- Background: Solid neutral background (White/Dark Grey) for easy masking.
- Framing: Full body, clear silhouette.
- Pose: Standard A-Pose or T-Pose.
- Lighting: Studio softbox lighting, rim light for separation, high contrast.
- Quality: 8K, Ultra-Sharp focus, Hyper-detailed texture, Ray-tracing style.
- Consistency: Unified style, no artifacts, clean lines.

CRITICAL: The style must be STRICTLY enforced. Do not blend styles or deviate from the specified aesthetic.
            `.trim();

            if (genyuToken) {
                // >>> ROUTE 1: GENYU PROXY <<<
                console.log("Using Genyu Proxy for Character...");

                let genyuAspect = "IMAGE_ASPECT_RATIO_PORTRAIT";
                if (aspectRatio === "16:9") genyuAspect = "IMAGE_ASPECT_RATIO_LANDSCAPE";
                if (aspectRatio === "1:1") genyuAspect = "IMAGE_ASPECT_RATIO_SQUARE";
                if (aspectRatio === "4:3") genyuAspect = "IMAGE_ASPECT_RATIO_LANDSCAPE";

                const response = await fetch('http://localhost:3001/api/proxy/genyu/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: genyuToken,
                        prompt: fullPrompt,
                        aspect: genyuAspect,
                        style: styleConfig?.label || style
                    })
                });

                if (!response.ok) {
                    const errJson = await response.json();
                    throw new Error(errJson.error || "Genyu Proxy Failed");
                }

                const data = await response.json();
                console.log("Genyu Char Response:", data);

                // Handle Google Labs / Fx Flow Direct Response
                let genyuImage = null;
                if (data.submissionResults && data.submissionResults.length > 0) {
                    const submission = data.submissionResults[0]?.submission;
                    const result = submission?.result || data.submissionResults[0]?.result;
                    genyuImage = result?.fifeUrl || result?.media?.fifeUrl;
                } else if (data.media && data.media.length > 0) {
                    // Fallback for "Keys: media, workflows" case
                    const mediaItem = data.media[0];
                    genyuImage = mediaItem.fifeUrl || mediaItem.url;

                    if (!genyuImage && mediaItem.image) {
                        const img = mediaItem.image;
                        genyuImage = img.fifeUrl || img.url;

                        // Check generatedImage key
                        if (!genyuImage && img.generatedImage) {
                            const genImg = img.generatedImage;
                            genyuImage = genImg.fifeUrl || genImg.url || (typeof genImg === 'string' ? genImg : null);
                        }

                        // If image is just a string
                        if (!genyuImage && typeof img === 'string') {
                            genyuImage = img;
                        }
                    }
                }

                // Fallback
                if (!genyuImage) {
                    genyuImage = data.data?.images?.[0]?.url || data.data?.url || data.url || data.imageUrl;
                }

                if (genyuImage) {
                    // Auto-save to character master image (same as Gemini flow)
                    onSave(genyuImage);
                    alert('✅ Character generated successfully (Genyu)!');
                    console.log('✅ Genyu character auto-saved to master image');
                } else {
                    let errorMsg = `Cannot find image URL. Keys: ${Object.keys(data).join(', ')}`;
                    if (data.media && Array.isArray(data.media) && data.media.length > 0) {
                        const m = data.media[0];
                        errorMsg += `. Media[0] Keys: ${Object.keys(m).join(', ')}`;
                        if (m.image) errorMsg += `. Image Keys: ${Object.keys(m.image).join(', ')}`;
                    }
                    if (data.submissionResults) errorMsg += `. Has SubResults.`;
                    setError(errorMsg);
                    alert(`❌ ${errorMsg}`);
                    throw new Error(errorMsg);
                }

            } else {
                // >>> ROUTE 2: GEMINI DIRECT <<<
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: selectedModel,
                    contents: { parts: [{ text: fullPrompt }] },
                    config: {
                        imageConfig: {
                            aspectRatio: aspectRatio,
                            imageSize: resolution
                        }
                    }
                });

                const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (imagePart?.inlineData) {
                    const base64ImageBytes = imagePart.inlineData.data;
                    const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64ImageBytes}`;

                    // Auto-save to character master image
                    onSave(imageUrl);
                    alert('✅ Character generated successfully!');
                    console.log('✅ Character auto-saved to master image');
                } else {
                    setError("AI không trả về ảnh. Thử lại.");
                    alert('❌ AI không trả về ảnh. Vui lòng thử lại.');
                }
            }

        } catch (err: any) {
            console.error(err);
            const errorMsg = err.message || "Lỗi tạo ảnh.";
            setError(errorMsg);
            alert(`❌ ${errorMsg}`);
        } finally {
            setIsGenerating(false);

            // Clear loading state on character card
            if (charId) {
                updateCharacter(charId, { isAnalyzing: false });
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Tạo Nhân Vật Mới (AI Creator)">
            <div className="space-y-4">
                <div className="flex justify-end items-center space-x-2">
                    <span className="text-xs text-gray-400">Model:</span>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded text-xs text-white p-1 focus:outline-none focus:border-green-500"
                    >
                        {IMAGE_MODELS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>

                {/* 1. Describe */}
                <div>
                    <label className="block text-sm font-bold text-gray-300 mb-1">1. Mô tả nhân vật của bạn</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="VD: Một chú chó đốm dễ thương, đeo vòng cổ đỏ, mắt to tròn..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md text-white p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* 2. Configure */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Phong cách (Style)</label>
                        <select
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-green-500"
                        >
                            {CHARACTER_STYLES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    {/* Resolution & Aspect Ratio */}
                    <div className="flex space-x-2">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-400 mb-1">Tỷ lệ (Ratio)</label>
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-green-500"
                            >
                                <option value="9:16">9:16 (Portrait)</option>
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="1:1">1:1 (Square)</option>
                                <option value="4:3">4:3 (TV)</option>
                                <option value="3:4">3:4 (Portrait)</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-400 mb-1">Độ phân giải</label>
                            <select
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-green-500"
                            >
                                <option value="1K">1K (1024x1024) - Chuẩn</option>
                                <option value="2K">2K (2048x2048) - Nét</option>
                                <option value="4K">4K (4096x4096) - Siêu Nét</option>
                            </select>
                        </div>
                    </div>
                </div>
                {resolution !== '1K' && selectedModel === 'gemini-2.5-flash-image' && (
                    <p className="text-[10px] text-yellow-400 mt-1">* 2K/4K yêu cầu Nano Banana Pro</p>
                )}

                {/* Image Display Area */}
                <div className="w-full aspect-square bg-gray-950 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden relative">
                    {isGenerating ? (
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mb-2"></div>
                            <span className="text-green-500 text-sm animate-pulse">AI đang vẽ...</span>
                        </div>
                    ) : generatedImage ? (
                        <img src={generatedImage} alt="Generated Character" className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-gray-600 text-sm">Ảnh sẽ hiện ở đây</span>
                    )}
                </div>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                {/* Actions */}
                <div className="flex space-x-3 pt-2">
                    {!generatedImage ? (
                        <button
                            onClick={() => {
                                if (!prompt.trim()) return;
                                if (!apiKey && !genyuToken) {
                                    setError("Vui lòng nhập API Key (Gemini) hoặc Token (Genyu).");
                                    return;
                                }

                                // Set loading state on character card
                                if (charId) {
                                    updateCharacter(charId, { isAnalyzing: true });
                                }

                                // Close modal immediately
                                onClose();
                                setPrompt(''); // Clear input

                                // Trigger generation in background
                                handleGenerate();
                            }}
                            disabled={isGenerating || !prompt}
                            className={`w-full py-3 font-bold text-white rounded-lg bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 shadow-lg`}
                        >
                            Tạo Nhân Vật
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleGenerate}
                                className="flex-1 py-3 font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                Thử lại
                            </button>
                            <button
                                onClick={() => {
                                    onSave(generatedImage);
                                    onClose();
                                    setGeneratedImage(null); // Reset for next time
                                }}
                                className={`flex-[2] py-3 font-bold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all shadow-lg transform hover:scale-105`}
                            >
                                ✅ Lưu ảnh này
                            </button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// --- Script Generator Modal ---
interface ScriptGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (idea: string, count: number, selectedCharacterIds: string[], selectedProductIds: string[]) => Promise<void>;
    isGenerating: boolean;
    activePresetId: string;
    customPresets: ScriptPreset[];
    onPresetChange: (presetId: string) => void;
    characters: Character[];
    products: Product[];
}

const ScriptGeneratorModal: React.FC<ScriptGeneratorModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    isGenerating,
    activePresetId,
    customPresets,
    onPresetChange,
    characters,
    products
}) => {
    const [idea, setIdea] = useState('');
    const [sceneCount, setSceneCount] = useState(5);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

    // Initialize selected characters and products when modal opens
    useEffect(() => {
        if (isOpen && characters.length > 0) {
            setSelectedCharacterIds(characters.map(c => c.id));
        }
        if (isOpen && products.length > 0) {
            setSelectedProductIds(products.map(p => p.id));
        }
    }, [isOpen, characters.length, products.length]);

    const toggleCharacter = (id: string) => {
        setSelectedCharacterIds(prev =>
            prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
        );
    };

    const toggleProduct = (id: string) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    const handleSubmit = () => {
        if (!idea.trim()) return alert("Vui lòng nhập ý tưởng.");

        // Close modal immediately (non-blocking)
        onClose();
        setIdea(''); // Clear input

        // Trigger generation in background
        onGenerate(idea, sceneCount, selectedCharacterIds, selectedProductIds);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Viết Kịch Bản AI - Cinematic Pro">
            <div className="space-y-4">
                {/* Preset Selector */}
                <PresetSelector
                    activePresetId={activePresetId}
                    customPresets={customPresets}
                    onSelect={onPresetChange}
                />

                {/* Character Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">👤 Nhân vật xuất hiện</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 bg-gray-900/50 rounded-lg border border-gray-700">
                        {characters.map(char => (
                            <label key={char.id} className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-800 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedCharacterIds.includes(char.id)}
                                    onChange={() => toggleCharacter(char.id)}
                                    className="rounded border-gray-600 text-green-500 focus:ring-green-500 bg-gray-700 w-3.5 h-3.5"
                                />
                                <div className="flex items-center space-x-1.5 truncate">
                                    {char.masterImage ? (
                                        <img src={char.masterImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px]">{char.name.charAt(0)}</div>
                                    )}
                                    <span className="text-xs text-gray-300 truncate">{char.name || 'Unnamed'}</span>
                                </div>
                            </label>
                        ))}
                        {characters.length === 0 && <span className="text-gray-500 text-xs p-2 col-span-3">Chưa có nhân vật.</span>}
                    </div>
                </div>

                {/* Product Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">📦 Sản phẩm / Đạo cụ đặc biệt</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 bg-gray-900/50 rounded-lg border border-brand-orange/30">
                        {products.map(prod => (
                            <label key={prod.id} className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-800 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedProductIds.includes(prod.id)}
                                    onChange={() => toggleProduct(prod.id)}
                                    className="rounded border-gray-600 text-brand-orange focus:ring-brand-orange bg-gray-700 w-3.5 h-3.5"
                                />
                                <div className="flex items-center space-x-1.5 truncate">
                                    {prod.masterImage ? (
                                        <img src={prod.masterImage} alt="" className="w-5 h-5 rounded object-cover" />
                                    ) : (
                                        <div className="w-5 h-5 rounded bg-gray-600 flex items-center justify-center text-[10px]">📦</div>
                                    )}
                                    <span className="text-xs text-gray-300 truncate">{prod.name || 'Unnamed'}</span>
                                </div>
                            </label>
                        ))}
                        {products.length === 0 && <span className="text-gray-500 text-xs p-2 col-span-3">Chưa có sản phẩm.</span>}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ý tưởng câu chuyện</label>
                    <textarea
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="VD: Một cuộc rượt đuổi nghẹt thở dưới mưa neon, nhân vật chính bị thương..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md text-white p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">AI sẽ tính toán Blocking (vị trí đứng), Góc máy (OTS, Low angle) và Khớp nối bối cảnh.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Số lượng phân cảnh ước lượng</label>
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={sceneCount}
                        onChange={(e) => setSceneCount(parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md text-white p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSubmit}
                        disabled={isGenerating}
                        className={`w-full py-3 font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all disabled:opacity-50 flex justify-center items-center`}
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Đạo diễn đang phân cảnh...
                            </>
                        ) : 'Tạo Kịch Bản Điện Ảnh'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// --- Image Editor Modal ---
interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    image: string | null;
    onSave: (newImage: string) => void;
    apiKey: string;
    model: string;
}
const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, image, onSave, apiKey, model }) => {
    const [editPrompt, setEditPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(model); // Local selection

    useEffect(() => {
        if (isOpen) {
            setEditPrompt('');
            setError(null);
            setIsEditing(false);
            setSelectedModel(model); // Sync
        }
    }, [isOpen, model]);

    if (!isOpen || !image) return null;

    const handleEdit = async () => {
        if (!editPrompt.trim()) return;
        if (!apiKey) {
            setError("Missing API Key");
            return;
        }

        setIsEditing(true);
        setError(null);

        try {
            const ai = new GoogleGenAI({ apiKey });
            const [header, data] = image.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

            const response = await ai.models.generateContent({
                model: selectedModel, // Use local model
                contents: {
                    parts: [
                        { inlineData: { data, mimeType } },
                        { text: `Edit this image: ${editPrompt}. Maintain the core composition and identity, only applying the requested changes.` }
                    ]
                },
                config: {
                    imageConfig: {}
                }
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const base64ImageBytes = imagePart.inlineData.data;
                const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
                onSave(imageUrl);
                onClose();
            } else {
                setError("AI không trả về ảnh. Thử lại với prompt khác.");
            }
        } catch (err) {
            console.error("Edit failed", err);
            setError("Chỉnh sửa thất bại. Kiểm tra API Key hoặc thử lại.");
        } finally {
            setIsEditing(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nano Banana Editor (Sửa ảnh)">
            <div className="flex flex-col space-y-4">
                <div className="flex justify-end items-center space-x-2">
                    <span className="text-xs text-gray-400">Model:</span>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded text-xs text-white p-1 focus:outline-none focus:border-green-500"
                    >
                        {IMAGE_MODELS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full aspect-square bg-black/50 rounded flex items-center justify-center overflow-hidden">
                    <img src={image} alt="Target" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bạn muốn sửa gì?</label>
                    <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="VD: Đổi màu tóc thành đỏ, thêm vết sẹo trên má, làm quần áo cũ hơn..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md text-white p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleEdit}
                        disabled={isEditing || !editPrompt}
                        className={`w-full py-2 font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all disabled:opacity-50`}
                    >
                        {isEditing ? 'AI đang sửa...' : 'Thực hiện chỉnh sửa'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};


// --- New Components ---
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-3xl font-bold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-green-200">{children}</h2>
);



// --- Compact Character Card (List View) ---
interface CharacterCardProps {
    character: Character;
    index: number;
    setDefault: (id: string) => void;
    onDelete: () => void;
    onValuesChange: (id: string, updates: Partial<Character>) => void;
    onEdit: () => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, index, setDefault, onDelete, onValuesChange, onEdit }) => {
    return (
        <div
            onClick={onEdit}
            className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-brand-orange cursor-pointer transition-all flex items-center space-x-4 relative group"
        >
            {/* Avatar Preview */}
            <div className="w-14 h-14 rounded-lg bg-gray-900 border border-gray-600 overflow-hidden flex-shrink-0 relative">
                {character.masterImage ? (
                    <img src={character.masterImage} alt={character.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl font-bold">
                        {character.name.charAt(0) || '👤'}
                    </div>
                )}

                {/* Loading Indicator */}
                {(character.isAnalyzing || character.workflowStatus === 'active') && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-orange"></div>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <input
                    onClick={(e) => e.stopPropagation()}
                    type="text"
                    value={character.name}
                    onChange={(e) => onValuesChange(character.id, { name: e.target.value })}
                    placeholder={`Character ${index + 1}`}
                    className="bg-transparent font-bold text-brand-cream focus:outline-none focus:border-b border-brand-orange w-full truncate placeholder-gray-600"
                />
                <p className="text-xs text-gray-400 truncate mt-0.5">{character.description || "No description"}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-1">
                <button
                    onClick={(e) => { e.stopPropagation(); setDefault(character.id); }}
                    className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${character.isDefault ? 'text-yellow-400' : 'text-gray-600 opacity-0 group-hover:opacity-100'}`}
                    title="Set Default"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 text-gray-600 hover:text-red-500 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                    <Trash2 size={14} />
                </button>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
        </div>
    );
};



// --- Added Missing Components ---

const Tooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-black text-white text-xs rounded z-50 pointer-events-none text-center shadow-lg border border-gray-700">
        {text}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
    </div>
);

interface ImageViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenes: Scene[];
    currentIndex: number;
    onNavigate: (index: number) => void;
    onRegenerate: (sceneId: string, prompt?: string) => void;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, onClose, scenes, currentIndex, onNavigate, onRegenerate }) => {
    const [refinePrompt, setRefinePrompt] = useState('');
    const currentScene = scenes[currentIndex];

    useEffect(() => {
        if (isOpen) setRefinePrompt('');
    }, [isOpen, currentIndex]);

    if (!isOpen || !currentScene) return null;

    const handlePrev = () => currentIndex > 0 && onNavigate(currentIndex - 1);
    const handleNext = () => currentIndex < scenes.length - 1 && onNavigate(currentIndex + 1);

    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-4xl z-50">&times;</button>

            <div className="w-full h-full max-w-7xl flex flex-col md:flex-row gap-4" onClick={e => e.stopPropagation()}>
                {/* Image Area */}
                <div className="flex-1 flex items-center justify-center relative bg-gray-900/50 rounded-lg overflow-hidden">
                    {currentScene.generatedImage ? (
                        <img src={currentScene.generatedImage} className="max-w-full max-h-full object-contain shadow-2xl" alt={`Scene ${currentScene.sceneNumber}`} />
                    ) : (
                        <div className="text-gray-500 flex flex-col items-center">
                            <span className="text-4xl mb-2">📷</span>
                            <span>Chưa có ảnh</span>
                        </div>
                    )}

                    {/* Navigation */}
                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full disabled:opacity-0 transition-all backdrop-blur-md"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={currentIndex === scenes.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full disabled:opacity-0 transition-all backdrop-blur-md"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded-full text-white text-sm backdrop-blur-sm">
                        {currentIndex + 1} / {scenes.length}
                    </div>
                </div>

                {/* Info Sidebar */}
                <div className="w-full md:w-80 bg-gray-800 rounded-lg p-6 flex flex-col border border-gray-700 overflow-y-auto">
                    <h3 className="text-xl font-bold text-white mb-1">{currentScene.sceneNumber}: {currentScene.promptName || 'Untitled'}</h3>
                    <div className="text-xs text-gray-400 mb-4 font-mono">{currentScene.id}</div>

                    <div className="space-y-4 flex-1">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Bối cảnh</label>
                            <p className="text-sm text-gray-200 mt-1">{currentScene.contextDescription || 'Chưa có mô tả'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Script (Viet)</label>
                            <p className="text-sm text-gray-300 italic mt-1">{currentScene.vietnamese || '...'}</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <label className="text-xs font-bold text-brand-orange uppercase mb-2 block">AI Refinement (Sửa ảnh)</label>
                        <textarea
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            placeholder="VD: Làm cho trời tối hơn, thêm mưa..."
                            rows={3}
                            className="w-full bg-brand-dark/50 border border-gray-600 rounded p-2 text-sm text-brand-cream focus:border-brand-orange mb-3"
                        />
                        <button
                            onClick={() => onRegenerate(currentScene.id, refinePrompt)}
                            disabled={!currentScene.generatedImage}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            ✨ Sửa ảnh này
                        </button>
                        <button
                            onClick={() => onRegenerate(currentScene.id)}
                            className="w-full mt-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded transition-colors text-sm"
                        >
                            🔄 Tạo lại hoàn toàn
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface SceneRowProps {
    scene: Scene;
    index: number;
    characters: Character[];
    products: Product[];
    updateScene: (id: string, updates: Partial<Scene>) => void;
    removeScene: (id: string) => void;
    generateImage: () => void;
    generateEndFrame: () => void;
    openImageViewer: () => void;
}

const SceneRow: React.FC<SceneRowProps> = ({ scene, index, characters, products, updateScene, removeScene, generateImage, generateEndFrame, openImageViewer }) => {
    const endFrameInputRef = React.useRef<HTMLInputElement>(null);

    const handleEndFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateScene(scene.id, { endFrameImage: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="grid md:grid-cols-12 gap-4 items-start bg-gray-800/30 p-4 rounded-lg border border-gray-700 hover:border-gray-500 transition-all group/row">
            {/* Scene Number */}
            <div className="md:col-span-1 flex flex-col items-center space-y-2">
                <div className="bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-gray-300 text-sm">{index + 1}</div>
                <input
                    type="text"
                    value={scene.sceneNumber}
                    onChange={(e) => updateScene(scene.id, { sceneNumber: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-center font-bold text-white focus:border-green-500 text-sm"
                    placeholder="SC.."
                />
                <button onClick={() => removeScene(scene.id)} className="text-red-500 hover:text-red-400 text-xs opacity-0 group-hover/row:opacity-100 transition-opacity">Xóa</button>
            </div>

            {/* Script */}
            <div className="md:col-span-2 space-y-2">
                <ExpandableTextarea
                    value={scene.language1}
                    onChange={(val) => updateScene(scene.id, { language1: val })}
                    placeholder="Script (Lang 1)..."
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-gray-300 focus:border-green-500 resize-none"
                    title="Script (Language 1)"
                />
                <ExpandableTextarea
                    value={scene.vietnamese}
                    onChange={(val) => updateScene(scene.id, { vietnamese: val })}
                    placeholder="Lời thoại (Việt)..."
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-white focus:border-green-500 resize-none"
                    title="Lời thoại Tiếng Việt"
                />
            </div>

            {/* Context + Cinematography */}
            <div className="md:col-span-2 space-y-2">
                <input
                    type="text"
                    value={scene.promptName}
                    onChange={(e) => updateScene(scene.id, { promptName: e.target.value })}
                    placeholder="Tên cảnh (VD: Rượt đuổi)"
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs font-bold text-white focus:border-green-500"
                />
                <ExpandableTextarea
                    value={scene.contextDescription}
                    onChange={(val) => updateScene(scene.id, { contextDescription: val })}
                    placeholder="Mô tả bối cảnh để AI vẽ..."
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-white focus:border-green-500 resize-none"
                    title="Mô tả bối cảnh (Context Description)"
                />
                {/* Per-Scene Cinematography Overrides - IMPROVED SIZE */}
                <div className="space-y-1.5 bg-gray-900/60 p-2 rounded border border-gray-700/50">
                    <div className="text-[9px] text-gray-500 font-semibold">📹 Cinematography</div>
                    <select
                        value={scene.cameraAngleOverride || ''}
                        onChange={(e) => updateScene(scene.id, { cameraAngleOverride: e.target.value })}
                        className="w-full bg-gray-800 text-[11px] text-gray-300 border border-gray-600 rounded px-2 py-1.5 focus:border-brand-orange"
                        title="Camera Angle"
                    >
                        {CAMERA_ANGLES.map(angle => (
                            <option key={angle.value} value={angle.value}>🎬 {angle.label}</option>
                        ))}
                    </select>
                    <div className="grid grid-cols-2 gap-1.5">
                        <select
                            value={scene.lensOverride || ''}
                            onChange={(e) => updateScene(scene.id, { lensOverride: e.target.value })}
                            className="bg-gray-800 text-[11px] text-gray-300 border border-gray-600 rounded px-2 py-1 focus:border-brand-orange"
                            title="Lens"
                        >
                            {LENS_OPTIONS.map(lens => (
                                <option key={lens.value} value={lens.value}>🔭 {lens.label}</option>
                            ))}
                        </select>
                        <select
                            value={scene.transitionType || ''}
                            onChange={(e) => updateScene(scene.id, { transitionType: e.target.value })}
                            className="bg-gray-800 text-[11px] text-purple-300 border border-purple-800/50 rounded px-2 py-1 focus:border-purple-500"
                            title="Transition"
                        >
                            {TRANSITION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>✂️ {t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Veo Prompt */}
            <div className="md:col-span-3 h-full">
                <ExpandableTextarea
                    value={scene.veoPrompt}
                    onChange={(val) => updateScene(scene.id, { veoPrompt: val })}
                    placeholder="(00:00-00:05) Prompt cho Google Veo..."
                    rows={7}
                    className="w-full h-[160px] bg-gray-900 border border-blue-900/30 rounded p-2 text-[11px] text-blue-200 focus:border-blue-500 font-mono resize-none leading-relaxed"
                    title="Veo Video Prompt"
                />
            </div>

            {/* Characters & Products */}
            <div className="md:col-span-1 h-[160px] flex flex-col space-y-1 overflow-hidden">
                {/* Characters Section */}
                <div className="flex-1 overflow-y-auto space-y-0.5 bg-gray-900/50 p-1.5 rounded border border-gray-700 custom-scrollbar">
                    <div className="text-[8px] text-gray-500 font-semibold mb-0.5 sticky top-0 bg-gray-900/90 px-1">👤 Nhân vật</div>
                    {characters.map(char => (
                        <label key={char.id} className="flex items-center space-x-1.5 cursor-pointer hover:bg-gray-800 p-0.5 rounded">
                            <input
                                type="checkbox"
                                checked={scene.characterIds.includes(char.id)}
                                onChange={(e) => {
                                    const newIds = e.target.checked
                                        ? [...scene.characterIds, char.id]
                                        : scene.characterIds.filter(id => id !== char.id);
                                    updateScene(scene.id, { characterIds: newIds });
                                }}
                                className="h-2.5 w-2.5 cursor-pointer appearance-none rounded border border-gray-600 bg-gray-700 checked:border-green-500 checked:bg-green-500 transition-all"
                            />
                            <span className="text-[9px] truncate text-gray-400">{char.name || '?'}</span>
                        </label>
                    ))}
                </div>

                {/* Products Section */}
                <div className="flex-1 overflow-y-auto space-y-0.5 bg-gray-900/50 p-1.5 rounded border border-brand-orange/30 custom-scrollbar">
                    <div className="text-[8px] text-gray-500 font-semibold mb-0.5 sticky top-0 bg-gray-900/90 px-1">📦 Sản phẩm</div>
                    {products.length > 0 ? products.map(prod => (
                        <label key={prod.id} className="flex items-center space-x-1.5 cursor-pointer hover:bg-gray-800 p-0.5 rounded">
                            <input
                                type="checkbox"
                                checked={(scene.productIds || []).includes(prod.id)}
                                onChange={(e) => {
                                    const currentIds = scene.productIds || [];
                                    const newIds = e.target.checked
                                        ? [...currentIds, prod.id]
                                        : currentIds.filter(id => id !== prod.id);
                                    updateScene(scene.id, { productIds: newIds });
                                }}
                                className="h-2.5 w-2.5 cursor-pointer appearance-none rounded border border-gray-600 bg-gray-700 checked:border-brand-orange checked:bg-brand-orange transition-all"
                            />
                            <span className="text-[9px] truncate text-gray-400">{prod.name || '?'}</span>
                        </label>
                    )) : (
                        <span className="text-[8px] text-gray-600 italic">Chưa có</span>
                    )}
                </div>
            </div>

            {/* Image & Actions */}
            <div className="md:col-span-3 flex flex-col space-y-2">
                {/* Veo Mode Selection */}
                <div className="flex items-center gap-2 bg-gray-900/60 p-1.5 rounded border border-gray-700/50">
                    <span className="text-[9px] text-gray-500 font-semibold">🎥 Veo:</span>
                    {VEO_MODES.map(mode => (
                        <label key={mode.value} className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="radio"
                                name={`veo-mode-${scene.id}`}
                                value={mode.value}
                                checked={(scene.veoMode || 'image-to-video') === mode.value}
                                onChange={() => updateScene(scene.id, {
                                    veoMode: mode.value as 'image-to-video' | 'start-end-frame',
                                    imageRole: mode.value === 'start-end-frame' ? 'start-frame' : 'single'
                                })}
                                className="w-3 h-3 accent-brand-orange"
                            />
                            <span className="text-[10px] text-gray-300">{mode.label}</span>
                        </label>
                    ))}
                </div>

                {/* Image Display with Role Badge */}
                <div className="flex gap-2">
                    {/* Main Image (Start Frame or Single) */}
                    <div
                        className={`relative flex-1 aspect-video bg-black rounded border overflow-hidden group cursor-pointer transition-colors ${scene.imageRole === 'start-frame' ? 'border-green-500' :
                            scene.imageRole === 'end-frame' ? 'border-red-500' : 'border-gray-600 hover:border-green-500'
                            }`}
                        onClick={() => scene.generatedImage && openImageViewer()}
                    >
                        {/* Role Badge */}
                        {scene.generatedImage && (
                            <div className={`absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded text-[8px] font-bold ${scene.imageRole === 'start-frame' ? 'bg-green-600 text-white' :
                                scene.imageRole === 'end-frame' ? 'bg-red-600 text-white' :
                                    'bg-gray-700 text-gray-300'
                                }`}>
                                {scene.imageRole === 'start-frame' ? '🟢 START' :
                                    scene.imageRole === 'end-frame' ? '🔴 END' : '📷'}
                            </div>
                        )}

                        {scene.isGenerating && !scene.videoStatus ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2"></div>
                                <span className="text-[10px] text-green-400 animate-pulse">Rendering Image...</span>
                            </div>
                        ) : scene.generatedImage ? (
                            <>
                                <img src={scene.generatedImage} alt="Generated" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-xs font-bold border border-white px-3 py-1 rounded-full backdrop-blur-sm">🔍 Phóng to</span>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs flex-col">
                                <span className="text-2xl mb-1">🖼️</span>
                                <span>{scene.veoMode === 'start-end-frame' ? 'Start Frame' : 'Image'}</span>
                            </div>
                        )}
                    </div>

                    {/* End Frame (only shown when Start/End Frame mode) */}
                    {scene.veoMode === 'start-end-frame' && (
                        <div className="relative w-28 aspect-video bg-black rounded border border-red-500/50 overflow-hidden group/end hover:border-red-500 transition-colors">
                            {/* Hidden file input */}
                            <input
                                ref={endFrameInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleEndFrameUpload}
                                className="hidden"
                            />

                            {/* End Frame Badge */}
                            <div className="absolute top-1 left-1 z-20 px-1 py-0.5 rounded text-[7px] font-bold bg-red-600 text-white">
                                🔴 END
                            </div>

                            {scene.endFrameImage ? (
                                <>
                                    <img src={scene.endFrameImage} alt="End Frame" className="w-full h-full object-cover" />
                                    {/* Hover overlay with actions */}
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1 opacity-0 group-hover/end:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => updateScene(scene.id, { endFrameImage: null })}
                                            className="text-[9px] text-red-400 hover:text-red-300"
                                        >
                                            ✕ Xóa
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 text-[9px]">
                                    <div className="flex flex-col items-center gap-1">
                                        <button
                                            onClick={() => endFrameInputRef.current?.click()}
                                            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[9px] flex items-center gap-1"
                                        >
                                            📁 Upload
                                        </button>
                                        <button
                                            onClick={generateEndFrame}
                                            className="px-2 py-1 bg-red-900/50 hover:bg-red-800 text-red-300 rounded text-[9px] flex items-center gap-1"
                                        >
                                            ✨ AI Gen
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Video Display (Separate Box) */}
                {(scene.generatedVideo || (scene.isGenerating && (scene.videoStatus === 'starting' || scene.videoStatus === 'active'))) && (
                    <div className="relative w-full aspect-video bg-black rounded border border-gray-600 overflow-hidden mt-1">
                        {scene.isGenerating && (scene.videoStatus === 'starting' || scene.videoStatus === 'active') ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mb-2"></div>
                                <span className="text-[10px] text-red-400 animate-pulse">Generating Video...</span>
                            </div>
                        ) : scene.generatedVideo ? (
                            <video
                                src={scene.generatedVideo}
                                controls
                                className="w-full h-full object-cover"
                            />
                        ) : null}
                    </div>
                )}

                {/* Error Message (Global for Scene) */}
                {scene.error && (
                    <div className="bg-red-900/90 p-2 text-center rounded">
                        <span className="text-white text-xs">{scene.error}</span>
                    </div>
                )}

                <button
                    onClick={generateImage}
                    disabled={scene.isGenerating}
                    className={`w-full py-2 font-bold text-xs rounded shadow-lg transition-all transform active:scale-95 flex items-center justify-center space-x-2
                        ${scene.generatedImage
                            ? 'bg-gray-700 text-white hover:bg-gray-600'
                            : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {scene.generatedImage ? (
                        <><span>↻</span> <span>Tạo Lại</span></>
                    ) : (
                        <><span>✨</span> <span>Tạo Ảnh AI</span></>
                    )}
                </button>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    // Initialize State with LocalStorage check for Genyu Token
    const [state, setState] = useState<ProjectState>(() => {
        const savedToken = localStorage.getItem('genyuToken');
        const savedRecaptcha = localStorage.getItem('recaptchaToken');
        return (savedToken || savedRecaptcha) ? { ...INITIAL_STATE, genyuToken: savedToken || undefined, recaptchaToken: savedRecaptcha || undefined } : INITIAL_STATE;
    });

    const stateRef = useRef(state); // Ref to hold latest state for async ops

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const [history, setHistory] = useState<{ past: ProjectState[], future: ProjectState[] }>({ past: [], future: [] });
    const [zoom, setZoom] = useState(1);
    const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [isCoffeeModalOpen, setCoffeeModalOpen] = useState(false);
    const [isScriptModalOpen, setScriptModalOpen] = useState(false);
    const [genyuModalOpen, setGenyuModalOpen] = useState(false); // New State
    const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);

    // Initialize API Key from LocalStorage
    const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
    const [isHeaderSticky, setHeaderSticky] = useState(false);
    const [isContinuityMode, setIsContinuityMode] = useState(true);
    const mainContentRef = useRef<HTMLDivElement>(null);
    const [isImageViewerOpen, setImageViewerOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isBatchGenerating, setIsBatchGenerating] = useState(false);
    const [isScriptGenerating, setIsScriptGenerating] = useState(false);
    const [isVeoGenerating, setIsVeoGenerating] = useState(false);

    // Editing State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingImage, setEditingImage] = useState<{ id: string, image: string, type: 'master' | 'face' | 'body' | 'prop', propIndex?: number } | null>(null);

    // Character Gen State
    const [charGenState, setCharGenState] = useState<{ isOpen: boolean; charId: string | null }>({ isOpen: false, charId: null });

    // --- State Management ---
    // ... existing updateStateAndRecord, handleProjectNameChange, etc ...
    const updateStateAndRecord = (updater: (prevState: ProjectState) => ProjectState) => {
        setState(prevState => {
            const newState = updater(prevState);
            setHistory(h => {
                const newPast = [...h.past, prevState];
                if (newPast.length > 50) newPast.shift();
                return { past: newPast, future: [] };
            });
            return newState;
        });
    };

    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value.toUpperCase();
        updateStateAndRecord(s => ({ ...s, projectName: newName }));
    };

    const handleStylePromptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStyle = e.target.value;
        updateStateAndRecord(s => ({ ...s, stylePrompt: newStyle }));
    };

    const handleImageModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value;
        updateStateAndRecord(s => ({ ...s, imageModel: newModel }));
    };

    const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRatio = e.target.value;
        updateStateAndRecord(s => ({ ...s, aspectRatio: newRatio }));
    };

    const handleScriptLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const lang = e.target.value as 'vietnamese' | 'language1';
        updateStateAndRecord(s => ({ ...s, scriptLanguage: lang }));
    };

    const undo = useCallback(() => {
        setHistory(h => {
            if (h.past.length === 0) return h;
            const previous = h.past[h.past.length - 1];
            const newPast = h.past.slice(0, h.past.length - 1);
            setState(previous);
            return { past: newPast, future: [state, ...h.future] };
        });
    }, [state]);

    const redo = useCallback(() => {
        setHistory(h => {
            if (h.future.length === 0) return h;
            const next = h.future[0];
            const newFuture = h.future.slice(1);
            setState(next);
            return { past: [...h.past, state], future: newFuture };
        });
    }, [state]);

    // --- File & Hotkey Handlers ---
    const handleSave = () => {
        const filename = state.projectName ? `${slugify(state.projectName)}.json` : 'untitled-project.json';
        saveProject(state, filename);
    };

    const handleOpen = () => {
        openProject((loadedState: ProjectState) => {
            updateStateAndRecord(() => loadedState);
        });
    };

    const handleNewProject = () => {
        const hasContent = state.scenes.some(s => s.generatedImage) ||
            state.characters.some(c => c.masterImage || c.faceImage || c.bodyImage) ||
            state.projectName.trim();

        if (hasContent) {
            const confirmed = window.confirm(
                '⚠️ Bạn có chắc muốn tạo project mới?\n\n' +
                'Mọi thay đổi chưa lưu sẽ bị mất!\n' +
                '(Hãy ấn "Lưu" trước nếu cần)'
            );
            if (!confirmed) return;
        }

        // Reset to initial state
        updateStateAndRecord(() => ({
            ...INITIAL_STATE,
            // Keep API settings
            apiKey: state.apiKey,
            genyuToken: state.genyuToken,
            imageModel: state.imageModel,
        }));

        console.log('✨ New project created!');
    };

    useHotkeys([
        { keys: 'ctrl+s', callback: handleSave },
        { keys: 'ctrl+o', callback: handleOpen },
        { keys: 'ctrl+z', callback: undo },
        { keys: 'ctrl+shift+z', callback: redo },
    ]);

    // --- Character Logic ---
    const updateCharacter = (id: string, updates: Partial<Character>) => {
        updateStateAndRecord(s => ({
            ...s,
            characters: s.characters.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
    };

    const addCharacter = () => {
        const newChar: Character = {
            id: generateId(),
            name: '',
            description: '',
            masterImage: null,
            faceImage: null,
            bodyImage: null,
            props: [
                { id: generateId(), name: '', image: null },
                { id: generateId(), name: '', image: null },
                { id: generateId(), name: '', image: null },
            ],
            isDefault: false,
            isAnalyzing: false,
        };
        updateStateAndRecord(s => ({
            ...s,
            characters: [...s.characters, newChar]
        }));
    };

    const deleteCharacter = (id: string) => {
        if (state.characters.length <= 1) {
            alert("Bạn cần ít nhất 1 nhân vật.");
            return;
        }
        if (confirm("Bạn có chắc muốn xóa nhân vật này?")) {
            updateStateAndRecord(s => ({
                ...s,
                characters: s.characters.filter(c => c.id !== id)
            }));
        }
    };

    // --- Polling for Google Labs Workflow (Character Images) ---
    const pollCharacterWorkflows = async (
        charId: string,
        token: string,
        faceWorkflowId: string | null,
        bodyWorkflowId: string | null
    ) => {
        const cleanedToken = cleanToken(token);
        let faceUrl: string | null = null;
        let bodyUrl: string | null = null;
        let attempts = 0;
        const maxAttempts = 40; // 40 * 3s = 120s timeout

        const pollWorkflow = async (workflowId: string): Promise<string | null> => {
            try {
                const res = await fetch('http://localhost:3001/api/proxy/google/workflow/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: cleanedToken, workflowId })
                });
                const data = await res.json();

                if (data.state === 'SUCCEEDED' && data.media && data.media.length > 0) {
                    const m = data.media[0];
                    return m.fifeUrl || m.url || m.image?.fifeUrl || null;
                }

                if (data.state === 'FAILED') {
                    console.error("Workflow failed:", workflowId);
                    return null;
                }

                return 'pending'; // Still active
            } catch (err) {
                console.error("Poll error:", err);
                return null;
            }
        };

        // Poll loop
        while (attempts < maxAttempts && (!faceUrl || !bodyUrl)) {
            await new Promise(r => setTimeout(r, 3000)); // Wait 3s
            attempts++;

            if (faceWorkflowId && !faceUrl) {
                const result = await pollWorkflow(faceWorkflowId);
                if (result && result !== 'pending') faceUrl = result;
            }

            if (bodyWorkflowId && !bodyUrl) {
                const result = await pollWorkflow(bodyWorkflowId);
                if (result && result !== 'pending') bodyUrl = result;
            }

            // Update state if we got results
            if ((faceUrl && !bodyWorkflowId) || (bodyUrl && !faceWorkflowId) || (faceUrl && bodyUrl)) {
                updateStateAndRecord(s => ({
                    ...s,
                    characters: s.characters.map(c => c.id === charId ? {
                        ...c,
                        faceImage: faceUrl || c.faceImage,
                        bodyImage: bodyUrl || c.bodyImage,
                        workflowStatus: 'succeeded' as const,
                        faceWorkflowId: undefined,
                        bodyWorkflowId: undefined
                    } : c)
                }));
                console.log("Character workflows completed!");
                return;
            }
        }

        // Timeout
        if (attempts >= maxAttempts) {
            console.warn("Polling timeout after 120s");
            updateStateAndRecord(s => ({
                ...s,
                characters: s.characters.map(c => c.id === charId ? {
                    ...c,
                    workflowStatus: 'failed' as const
                } : c)
            }));
        }
    };

    // --- Product Handlers ---
    const [editingProductId, setEditingProductId] = useState<string | null>(null);

    const addProduct = () => {
        const newProduct: Product = {
            id: generateId(),
            name: '',
            description: '',
            masterImage: null,
            views: { front: null, back: null, left: null, right: null, top: null },
            isAnalyzing: false
        };
        updateStateAndRecord(s => ({ ...s, products: [...(s.products || []), newProduct] }));
    };

    const deleteProduct = (id: string) => {
        if (window.confirm('Delete this product?')) {
            updateStateAndRecord(s => ({ ...s, products: s.products.filter(p => p.id !== id) }));
        }
    };

    const updateProduct = (id: string, updates: Partial<Product>) => {
        updateStateAndRecord(s => ({
            ...s,
            products: s.products.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
    };

    // Product Image Analysis & Multi-View Generation
    const handleProductMasterImageUpload = async (id: string, image: string) => {
        const apiKey = userApiKey || process.env.API_KEY;
        updateProduct(id, { masterImage: image, isAnalyzing: true });

        if (!apiKey && !state.genyuToken) {
            updateProduct(id, { isAnalyzing: false });
            setApiKeyModalOpen(true);
            return;
        }

        try {
            // 1. Analyze Product with Gemini
            let productName = "";
            let productDescription = "";

            if (apiKey) {
                const ai = new GoogleGenAI({ apiKey });
                let data: string;
                let mimeType: string = 'image/jpeg';

                if (image.startsWith('data:')) {
                    const [header, b64] = image.split(',');
                    mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    data = b64;
                } else {
                    const response = await fetch(image);
                    const blob = await response.blob();
                    mimeType = blob.type;
                    data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                }

                const analyzePrompt = `
                Analyze this PRODUCT/PROP image. Return JSON:
                {"name": "Product Name (e.g., Vintage Camera, Magic Sword)", "description": "Detailed physical description: material, color, texture, shape, distinctive features."}
                `;
                const analysisRes = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ inlineData: { data, mimeType } }, { text: analyzePrompt }] },
                    config: { responseMimeType: "application/json" }
                });
                const text = analysisRes.text || '{}';
                let json = { name: "", description: "" };
                try {
                    json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                } catch (e) { console.error("JSON parse error", e); }

                productName = json.name;
                productDescription = json.description;
                updateProduct(id, { name: json.name, description: json.description });
            }

            // 2. Generate 5 Views using Genyu Proxy
            const genyuToken = state.genyuToken;
            if (genyuToken) {
                const viewPrompts = [
                    { key: 'front', prompt: `Product photography, FRONT VIEW of ${productDescription || 'this product'}. Studio lighting, white background, 8K detail, centered, straight-on angle.` },
                    { key: 'back', prompt: `Product photography, BACK VIEW of ${productDescription || 'this product'}. Studio lighting, white background, 8K detail, centered, rear angle showing back side.` },
                    { key: 'left', prompt: `Product photography, LEFT SIDE VIEW of ${productDescription || 'this product'}. Studio lighting, white background, 8K detail, centered, 90-degree left profile.` },
                    { key: 'right', prompt: `Product photography, RIGHT SIDE VIEW of ${productDescription || 'this product'}. Studio lighting, white background, 8K detail, centered, 90-degree right profile.` },
                    { key: 'top', prompt: `Product photography, TOP-DOWN VIEW of ${productDescription || 'this product'}. Studio lighting, white background, 8K detail, bird's eye view from directly above.` },
                ];

                const callProxy = async (prompt: string): Promise<string | null> => {
                    const res = await fetch('http://localhost:3001/api/proxy/genyu/image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token: genyuToken,
                            recaptchaToken: state.recaptchaToken,
                            prompt: prompt,
                            aspect: "IMAGE_ASPECT_RATIO_SQUARE", // Square for product views
                            style: "Product Photography"
                        })
                    });
                    const d = await res.json();
                    if (!res.ok) { console.error("Proxy Error:", d); return null; }

                    let imgUrl = null;
                    if (d.media && d.media.length > 0) {
                        const m = d.media[0];
                        imgUrl = m.fifeUrl || m.url || m.image?.fifeUrl || m.image?.url;
                        if (!imgUrl && m.image?.generatedImage?.encodedImage) {
                            imgUrl = `data:image/jpeg;base64,${m.image.generatedImage.encodedImage}`;
                        }
                    }
                    return imgUrl;
                };

                // Generate all 5 views in parallel
                const results = await Promise.all(viewPrompts.map(v => callProxy(v.prompt)));

                const newViews = {
                    front: results[0],
                    back: results[1],
                    left: results[2],
                    right: results[3],
                    top: results[4]
                };

                updateProduct(id, { views: newViews, isAnalyzing: false });
                console.log("Product Views Generated:", newViews);

            } else {
                // No Genyu token - just save master and description
                updateProduct(id, { isAnalyzing: false });
                alert("Cần Genyu Token để tạo các góc nhìn sản phẩm.");
            }

        } catch (error) {
            console.error("Product Analysis Error:", error);
            updateProduct(id, { isAnalyzing: false });
        }
    };

    // Generate Product from Prompt (No Master Image - AI Creates Everything)
    const handleGenerateProductFromPrompt = async (id: string) => {
        const product = state.products?.find(p => p.id === id);
        if (!product || !product.description) {
            alert("Vui lòng nhập mô tả sản phẩm trước.");
            return;
        }

        const genyuToken = state.genyuToken;
        if (!genyuToken) {
            alert("Cần Genyu Token để tạo sản phẩm.");
            setGenyuModalOpen(true);
            return;
        }

        updateProduct(id, { isAnalyzing: true });

        try {
            // Step 1: Generate Master Image from description
            const masterPrompt = `Professional product photography of ${product.description}. Studio lighting, white background, 8K detail, centered, front view, high quality product shot.`;

            const res = await fetch('http://localhost:3001/api/proxy/genyu/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: genyuToken,
                    recaptchaToken: state.recaptchaToken,
                    prompt: masterPrompt,
                    aspect: "IMAGE_ASPECT_RATIO_SQUARE",
                    style: "Product Photography"
                })
            });
            const d = await res.json();

            let masterImage = null;
            if (d.media && d.media.length > 0) {
                const m = d.media[0];
                masterImage = m.fifeUrl || m.url || m.image?.fifeUrl || m.image?.url;
                if (!masterImage && m.image?.generatedImage?.encodedImage) {
                    masterImage = `data:image/jpeg;base64,${m.image.generatedImage.encodedImage}`;
                }
            }

            if (masterImage) {
                updateProduct(id, { masterImage: masterImage });
                // Trigger 5-view generation
                await handleProductMasterImageUpload(id, masterImage);
            } else {
                updateProduct(id, { isAnalyzing: false });
                alert("Không thể tạo ảnh sản phẩm. Vui lòng thử lại.");
            }

        } catch (error) {
            console.error("Product Generation Error:", error);
            updateProduct(id, { isAnalyzing: false });
        }
    };

    // Auto Extraction Logic from Master Image
    const handleMasterImageUpload = async (id: string, image: string) => {
        const apiKey = userApiKey || process.env.API_KEY;
        updateCharacter(id, { masterImage: image, isAnalyzing: true });

        if (!apiKey) {
            // Still save the image even if no API key
            updateCharacter(id, { isAnalyzing: false });
            setApiKeyModalOpen(true);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });

            let data: string;
            let mimeType: string = 'image/jpeg';

            if (image.startsWith('data:')) {
                const [header, base64Data] = image.split(',');
                data = base64Data;
                mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            } else {
                // If it's a URL, use our local proxy to avoid CORS
                try {
                    console.log("LOG: Starting fetch via Proxy for URL:", image);
                    const proxyUrl = `http://localhost:3001/api/proxy/fetch-image?url=${encodeURIComponent(image)}`;
                    const imgRes = await fetch(proxyUrl);
                    console.log("LOG: Proxy Fetch status:", imgRes.status);

                    if (!imgRes.ok) throw new Error(`Fetch failed with status ${imgRes.status}`);

                    const blob = await imgRes.blob();
                    mimeType = blob.type;
                    console.log("LOG: Blob received, type:", mimeType, "size:", blob.size);

                    data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            // Extract base64 part from "data:image/xyz;base64,..."
                            const base64 = result.split(',')[1];
                            console.log("LOG: Base64 conversion successful. Length:", base64.length);
                            resolve(base64);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (fetchErr: any) {
                    console.error("LOG: Failed to fetch image (CORS?):", fetchErr);
                    alert("Lỗi tải ảnh (CORS). Vui lòng kiểm tra Console (F12). Chi tiết: " + fetchErr.message);
                    throw new Error("Could not fetch image for AI analysis. CORS issue?");
                }
            }

            console.log("LOG: Sending to Gemini...");
            const model = state.imageModel || 'gemini-2.5-flash-image';

            // 1. Analyze and Extract Name/Desc (Existing Logic)
            const analyzePrompt = `
            Analyze this character. Return JSON:
            {"name": "Suggest Name", "description": "Vietnamese description physical features, clothing, style, colors."}
            `;
            const analysisPromise = ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ inlineData: { data, mimeType } }, { text: analyzePrompt }] },
                config: { responseMimeType: "application/json" }
            });

            // Wait for analysis FIRST to get the description for image gen
            const analysisRes = await analysisPromise;
            const text = analysisRes.text || '{}';
            let json = { name: "", description: "" };
            try {
                json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) { console.error("JSON parse error", e); }

            updateCharacter(id, { name: json.name, description: json.description });

            // --- STEP 2 & 3: GENERATE IMAGES (Face & Body) ---
            const genyuToken = state.genyuToken;

            // DEBUG CHECKPOINT
            console.log("DEBUG: GenyuToken in State:", genyuToken ? "YES" : "NO");

            if (genyuToken) {
                // >>> ROUTE 1: GOOGLE LABS (FX FLOW) - High Quality <<<
                console.log("Using Google Labs Proxy for Character Gen...");
                // alert("DEBUG: Starting Google Labs Gen..."); // Temporary Alert

                const facePrompt = `
                (STRICT REFERENCE ADHERENCE)
                Create an extreme close-up Face ID portrait of this character: ${json.description}.
                
                STYLE GUIDE:
                - VISUAL STYLE: Unreal Engine 5 Render, 8K Ultra HD, hyper-detailed texture.
                - LIGHTING: Studio rim lighting, soft fill, professional photography.
                - FRAMING: Center frame, neutral expression, looking straight at camera (Passport style).
                - BACKGROUND: Pure solid dark grey or white background (Clean for masking).
                - DETAILS: Focus purely on facial features, eyes, skin texture, and hair. Must look exactly like the description.
                `.trim();

                const bodyPrompt = `
                (STRICT CHARACTER SHEET)
                Create a full-body character design sheet for: ${json.description}.
                
                STYLE GUIDE:
                - VISUAL STYLE: Same as Face ID (Unreal Engine 5 Render, 8K).
                - POSE: Static A-Pose or T-Pose (Best for 3D modeling/Reference).
                - FRAMING: Full body from head to toe, shoes visible.
                - BACKGROUND: Solid white studio background. NO complex environment.
                - OUTFIT: Complete, detailed outfit as described.
                `.trim();

                // Helper to=call Proxy
                const callProxy = async (prompt: string, aspect: string): Promise<string | { workflowId: string } | null> => {
                    const res = await fetch('http://localhost:3001/api/proxy/genyu/image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token: genyuToken,
                            recaptchaToken: state.recaptchaToken, // Pass dynamic Recaptcha
                            prompt: prompt,
                            aspect: aspect,
                            style: "3D Model / Character Sheet" // Specialized style signal
                        })
                    });
                    const d = await res.json();

                    if (!res.ok) {
                        console.error("Proxy Error:", d);
                        return null;
                    }

                    // Extract Image logic - UPDATED for Google Labs Response
                    let imgUrl = null;
                    let workflowId = null;

                    // Check Google Labs format first (media array)
                    if (d.media && d.media.length > 0) {
                        const m = d.media[0];
                        console.log("DEBUG: media[0] content:", m);
                        console.log("DEBUG: Full media[0] JSON:", JSON.stringify(m, null, 2));

                        // Try to get URL first
                        imgUrl = m.fifeUrl || m.url || m.image?.fifeUrl || m.image?.url;

                        // If no URL, check for base64 encodedImage
                        if (!imgUrl && m.image?.generatedImage?.encodedImage) {
                            const base64 = m.image.generatedImage.encodedImage;
                            imgUrl = `data:image/jpeg;base64,${base64}`;
                            console.log("Extracted base64 image, length:", base64.length);
                        }

                        // If still no image but has workflowId (shouldn't happen now)
                        if (!imgUrl && m.workflowId) {
                            workflowId = m.workflowId;
                            console.log("Google Labs returned workflowId (async mode). WorkflowId:", workflowId);
                        }
                    }

                    // Fallback: Old format (submissionResults)
                    if (!imgUrl && !workflowId && d.submissionResults && d.submissionResults.length > 0) {
                        const r = d.submissionResults[0]?.submission?.result || d.submissionResults[0]?.result;
                        imgUrl = r?.fifeUrl || r?.media?.fifeUrl;
                    }

                    // Return workflowId for polling if available
                    if (workflowId) {
                        return { workflowId };
                    }

                    if (!imgUrl) {
                        console.warn("Genyu Res (No Image):", d);
                        console.warn("Will return null for Gemini fallback...");
                        return null;
                    }

                    return imgUrl;
                };

                try {
                    // Execute Parallel
                    console.log("Calling Proxies...");
                    const [faceResult, bodyResult] = await Promise.all([
                        callProxy(facePrompt, "IMAGE_ASPECT_RATIO_SQUARE"),
                        callProxy(bodyPrompt, "IMAGE_ASPECT_RATIO_PORTRAIT")
                    ]);

                    console.log("Proxy Results:", { faceResult, bodyResult });

                    // Extract URLs or workflowIds
                    const faceUrl = typeof faceResult === 'string' ? faceResult : null;
                    const bodyUrl = typeof bodyResult === 'string' ? bodyResult : null;
                    const faceWorkflowId = typeof faceResult === 'object' && faceResult?.workflowId ? faceResult.workflowId : null;
                    const bodyWorkflowId = typeof bodyResult === 'object' && bodyResult?.workflowId ? bodyResult.workflowId : null;

                    // If both returned workflowIds (async mode), start polling
                    if (faceWorkflowId || bodyWorkflowId) {
                        console.log("Async workflows detected. Starting polling...");
                        alert("Google Labs đang tạo ảnh (async mode). Sẽ tự động cập nhật khi hoàn thành...");

                        // Save workflow IDs and mark as active
                        updateStateAndRecord(s => ({
                            ...s,
                            characters: s.characters.map(c => c.id === id ? {
                                ...c,
                                faceWorkflowId: faceWorkflowId || undefined,
                                bodyWorkflowId: bodyWorkflowId || undefined,
                                workflowStatus: 'active' as const,
                                isAnalyzing: false
                            } : c)
                        }));

                        // Start polling (will be implemented next)
                        pollCharacterWorkflows(id, genyuToken, faceWorkflowId, bodyWorkflowId);
                        return; // Exit early - polling will update later
                    }

                    // If both failed, fallback to Gemini Direct
                    if (!faceUrl && !bodyUrl) {
                        console.warn("Google Labs Proxy failed. Falling back to Gemini Direct...");
                        throw new Error("Proxy returned null - will use Gemini fallback");
                    }

                    // Update State with direct URLs (sync mode success)
                    updateStateAndRecord(s => ({
                        ...s,
                        characters: s.characters.map(c => c.id === id ? {
                            ...c,
                            faceImage: faceUrl || c.faceImage,
                            bodyImage: bodyUrl || c.bodyImage,
                            isAnalyzing: false
                        } : c)
                    }));
                } catch (proxyErr: any) {
                    console.error("Proxy Error - Using Gemini Fallback:", proxyErr);
                    // Don't alert here - just fall through to Gemini Direct below
                    // Mark as not analyzing so Gemini can take over
                    updateCharacter(id, { isAnalyzing: false });
                }
            } else {
                // >>> ROUTE 2: GEMINI DIRECT (Fallback) <<<
                console.log("Using Gemini Direct for Character Gen...");

                // 2. Generate Face ID (Crop/Refine)
                const facePrompt = "Generate a close-up portrait of this character's face. Keep facial features identical to the reference. Neutral background.";
                const facePromise = ai.models.generateContent({
                    model: model,
                    contents: { parts: [{ inlineData: { data, mimeType } }, { text: facePrompt }] },
                    config: { responseModalities: [Modality.IMAGE] }
                });

                // 3. Generate Body Sheet
                const bodyPrompt = "Generate a full-body character view on a neutral background. Keep clothing and body type identical to the reference.";
                const bodyPromise = ai.models.generateContent({
                    model: model,
                    contents: { parts: [{ inlineData: { data, mimeType } }, { text: bodyPrompt }] },
                    config: { responseModalities: [Modality.IMAGE] }
                });

                const [faceRes, bodyRes] = await Promise.all([facePromise, bodyPromise]);

                // Process Images (Gemini returns inline base64 often, or blob?)
                // Google GenAI Node SDK returns weird structure for images.
                // Actually the previous implementation logic was:
                // const faceImg = faceRes.candidates[0].content.parts[0].inlineData...
                // But wait, the previous code in view_file showed:
                // const [analysisRes, faceRes, bodyRes] = await Promise.all(...)
                // then processed TEXT. It cut off before processing IMAGES in the previous view_file (line 1460).
                // I need to assume the previous logic for Gemini Image extraction was correct or I need to write it.
                // Actually, looking at the previous file content (Step 835), the code abruptly ended at 1460.
                // I need to see how it handled the image response.
                // BUT, I am REPLACING it. So I should implement standard Gemini image handling if I keep the fallback.

                // Standard handler:
                const getImg = (res: any) => {
                    const p = res.candidates?.[0]?.content?.parts?.[0];
                    if (p?.inlineData) return `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
                    // Or if server returns link?
                    return null;
                };

                updateCharacter(id, {
                    faceImage: getImg(faceRes),
                    bodyImage: getImg(bodyRes),
                    isAnalyzing: false
                });
            }

        } catch (error: any) {
            console.error("Analysis Failed", error);
            updateCharacter(id, { isAnalyzing: false });
            alert("Lỗi khi phân tích/tạo nhân vật: " + error.message);
        }
    };


    const handleCharGenSave = (image: string) => {
        if (charGenState.charId) {
            // Just save the master image, no auto-analysis
            updateCharacter(charGenState.charId, { masterImage: image });
            console.log('✅ Master image saved. User can manually trigger analysis.');
        }
    };

    // ... existing setDefaultCharacter, openEditor, handleEditorSave, addScene, updateScene, removeScene, handleScriptUpload, triggerFileUpload, handleGenerateScript, performImageGeneration, generateVeoPrompt, handleGenerateAllVeoPrompts, handleGenerateAllImages, handleDownloadAll, handleOpenImageViewer ...
    const setDefaultCharacter = (id: string) => {
        updateStateAndRecord(s => {
            const newCharacters = s.characters.map(c => ({
                ...c,
                isDefault: c.id === id,
            }));
            const newScenes = s.scenes.map(scene => {
                const sceneNumber = scene.sceneNumber.toLowerCase();
                if (sceneNumber.startsWith('c')) {
                    return { ...scene, characterIds: [id] };
                }
                return scene;
            });
            return { ...s, characters: newCharacters, scenes: newScenes };
        });
    };

    // --- Editing Logic ---
    const openEditor = (id: string, image: string, type: 'master' | 'face' | 'body' | 'prop', propIndex?: number) => {
        setEditingImage({ id, image, type, propIndex });
        setIsEditorOpen(true);
    };

    const handleEditorSave = (newImage: string) => {
        if (!editingImage) return;
        const { id, type, propIndex } = editingImage;

        if (type === 'prop' && typeof propIndex === 'number') {
            const char = state.characters.find(c => c.id === id);
            if (char) {
                const newProps = [...char.props];
                newProps[propIndex] = { ...newProps[propIndex], image: newImage };
                updateCharacter(id, { props: newProps });
            }
        } else if (type === 'master') {
            updateCharacter(id, { masterImage: newImage });
        } else if (type === 'face') {
            updateCharacter(id, { faceImage: newImage });
        } else if (type === 'body') {
            updateCharacter(id, { bodyImage: newImage });
        }
    };

    // --- Scene Logic ---
    const addScene = () => {
        const defaultCharacter = state.characters.find(c => c.isDefault);
        const newScene: Scene = {
            id: generateId(),
            sceneNumber: `${state.scenes.length + 1}`,
            language1: '',
            vietnamese: '',
            promptName: '',
            contextDescription: '',
            characterIds: defaultCharacter ? [defaultCharacter.id] : [],
            productIds: [],
            generatedImage: null,
            veoPrompt: '',
            isGenerating: false,
            error: null,
        };
        updateStateAndRecord(s => ({ ...s, scenes: [...s.scenes, newScene] }));
    };

    const updateScene = (id: string, updates: Partial<Scene>) => {
        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(sc => sc.id === id ? { ...sc, ...updates } : sc)
        }));
    };

    const removeScene = (id: string) => {
        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.filter(sc => sc.id !== id)
        }));
    };

    const handleScriptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length <= 1) {
                    alert("File Excel trống hoặc chỉ có hàng tiêu đề.");
                    return;
                }

                const defaultCharacter = state.characters.find(c => c.isDefault);
                const newScenes: Scene[] = json.slice(1)
                    .filter(row => row && row.length > 0 && row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '')
                    .map(row => {
                        const sceneNumber = String(row[0] || '').trim();
                        let characterIds: string[] = [];

                        if (sceneNumber.toLowerCase().startsWith('c') && defaultCharacter) {
                            characterIds.push(defaultCharacter.id);
                        }

                        return {
                            id: generateId(),
                            sceneNumber: sceneNumber,
                            language1: String(row[1] || ''),
                            vietnamese: String(row[2] || ''),
                            promptName: String(row[3] || ''),
                            contextDescription: String(row[4] || ''),
                            characterIds: characterIds,
                            productIds: [],
                            generatedImage: null,
                            veoPrompt: '',
                            isGenerating: false,
                            error: null,
                        };
                    });

                updateStateAndRecord(s => ({ ...s, scenes: newScenes }));
                alert(`Đã tải lên thành công ${newScenes.length} phân cảnh.`);
            } catch (error) {
                console.error("Lỗi khi xử lý file Excel:", error);
                alert("Đã xảy ra lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file.");
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const triggerFileUpload = () => {
        document.getElementById('script-upload-input')?.click();
    };

    const handleGenerateScript = async (idea: string, count: number, selectedCharacterIds: string[], selectedProductIds: string[]) => {
        const apiKey = userApiKey || process.env.API_KEY;
        if (!apiKey) {
            alert("Vui lòng nhập API Key để sử dụng tính năng này.");
            setApiKeyModalOpen(true);
            return;
        }

        setIsScriptGenerating(true);

        try {
            // Get active preset
            const activePreset = getPresetById(state.activeScriptPreset, state.customScriptPresets);
            if (!activePreset) {
                throw new Error("Preset not found");
            }

            // Filter selected characters
            const activeCharacters = state.characters.filter(c => selectedCharacterIds.includes(c.id));

            // Filter selected products
            const activeProducts = (state.products || []).filter(p => selectedProductIds.includes(p.id));

            // Build prompt using preset, characters and products
            const prompt = buildScriptPrompt(idea, activePreset, activeCharacters, activeProducts, count);

            console.log('🎬 Generating script with preset:', activePreset.name);
            console.log('Prompt:', prompt);

            const ai = new GoogleGenAI({ apiKey });

            // Dynamic JSON schema based on preset
            const schemaProperties: any = {
                scene_number: { type: Type.STRING },
                prompt_name: { type: Type.STRING },
                visual_description: { type: Type.STRING },
                character_ids: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                product_ids: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            };

            // Add fields based on preset format
            if (activePreset.outputFormat.hasDialogue) {
                schemaProperties.dialogues = {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            characterName: { type: Type.STRING },
                            line: { type: Type.STRING }
                        }
                    }
                };
            }

            if (activePreset.outputFormat.hasNarration) {
                schemaProperties.voiceover = { type: Type.STRING };
            }

            if (activePreset.outputFormat.hasCameraAngles) {
                schemaProperties.camera_angle = { type: Type.STRING };
            }

            // Legacy fields for backward compatibility
            schemaProperties.vietnamese_dialogue = { type: Type.STRING };
            schemaProperties.english_dialogue = { type: Type.STRING };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: schemaProperties,
                            required: ["scene_number", "visual_description", "prompt_name", "character_ids"]
                        }
                    }
                }
            });

            const generatedScenesRaw = JSON.parse(response.text || '[]');

            console.log('✅ Generated scenes:', generatedScenesRaw);

            // Parse scenes with structured fields
            const newScenes: Scene[] = generatedScenesRaw.map((item: any) => ({
                id: generateId(),
                sceneNumber: item.scene_number || '',
                promptName: item.prompt_name || '',

                // Legacy fields (maintain backward compatibility)
                vietnamese: item.vietnamese_dialogue || item.voiceover || '',
                language1: item.english_dialogue || '',
                contextDescription: item.visual_description || item.visual_context || '',

                // Structured fields (new)
                voiceover: item.voiceover,
                dialogues: item.dialogues || [],
                cameraAngle: item.camera_angle,
                visualDescription: item.visual_description || item.visual_context,

                characterIds: item.character_ids || [],
                productIds: item.product_ids || [],
                generatedImage: null,
                veoPrompt: '',
                isGenerating: false,
                error: null,
            }));

            if (newScenes.length > 0) {
                updateStateAndRecord(s => ({
                    ...s,
                    scenes: [...s.scenes, ...newScenes]
                }));
                alert(`✨ Đã tạo ${newScenes.length} cảnh với preset "${activePreset.name}"!`);
            } else {
                throw new Error("Không có dữ liệu phân cảnh nào được tạo.");
            }

        } catch (error) {
            console.error("Script generation failed:", error);
            alert("Tạo kịch bản thất bại. Vui lòng thử lại.");
        } finally {
            setIsScriptGenerating(false);
        }
    };

    // --- Image Generation Logic ---
    const performImageGeneration = async (sceneId: string, refinementPrompt?: string, isEndFrame: boolean = false) => {
        const currentState = stateRef.current; // Use FRESH state
        const currentSceneIndex = currentState.scenes.findIndex(s => s.id === sceneId);
        const sceneToUpdate = currentState.scenes[currentSceneIndex];
        if (!sceneToUpdate) return;

        // --- 1. GET GLOBAL STYLE PROMPT ---
        const selectedStyle = GLOBAL_STYLES.find(s => s.value === currentState.stylePrompt);
        const styleInstruction = selectedStyle ? selectedStyle.prompt : '';

        // --- 2. GET CINEMATOGRAPHY SETTINGS ---
        const cameraModelInfo = CAMERA_MODELS.find(c => c.value === currentState.cameraModel);
        const cameraPrompt = cameraModelInfo?.prompt || '';

        // Lens: use scene override if exists, otherwise global default
        const effectiveLens = sceneToUpdate.lensOverride || currentState.defaultLens || '';
        const lensInfo = LENS_OPTIONS.find(l => l.value === effectiveLens);
        const lensPrompt = lensInfo?.prompt || '';

        // Camera Angle: use scene override if exists
        const effectiveAngle = sceneToUpdate.cameraAngleOverride || '';
        const angleInfo = CAMERA_ANGLES.find(a => a.value === effectiveAngle);
        const anglePrompt = angleInfo ? angleInfo.label : '';

        // Meta Tokens: custom or auto-generated
        const activePreset = getPresetById(currentState.activeScriptPreset, currentState.customScriptPresets);
        const presetCategory = activePreset?.category || 'custom';
        const metaTokens = currentState.customMetaTokens || DEFAULT_META_TOKENS[presetCategory] || DEFAULT_META_TOKENS['custom'];

        // Construct enhanced prompt with cinematography
        let cinematographyParts: string[] = [];
        if (cameraPrompt) cinematographyParts.push(cameraPrompt);
        if (lensPrompt) cinematographyParts.push(lensPrompt);
        if (anglePrompt) cinematographyParts.push(anglePrompt);

        const cinematographyPrompt = cinematographyParts.length > 0
            ? cinematographyParts.join(', ') + '.'
            : '';

        // Construct basic prompt with cinematography and meta tokens
        let finalPrompt = `${styleInstruction}. ${cinematographyPrompt} ${metaTokens}. ${sceneToUpdate.contextDescription}`.trim();

        // APPEND BASIC CHARACTER & PROP INFO (Fallback for No-API-Key Users)
        const currentStateSnapshot = stateRef.current;
        const selectedCharsForPrompt = currentStateSnapshot.characters.filter(c => sceneToUpdate.characterIds.includes(c.id));
        if (selectedCharsForPrompt.length > 0) {
            const charDesc = selectedCharsForPrompt.map((c) => {
                const propsText = c.props?.filter(p => p.image).map((p, idx) => p.name || `Accessory #${idx + 1}`).join(', ');
                return `[${c.name}: ${c.description}${propsText ? `. WITH PROPS: ${propsText}` : ''}]`;
            }).join(' ');
            finalPrompt += `\n\nAppearing Characters: ${charDesc}`;
            console.log("Updated Base Prompt with Chars:", finalPrompt);
        }

        // APPEND PRODUCT/PROPS INFO (NEW)
        const selectedProdsForPrompt = (currentStateSnapshot.products || []).filter(p => (sceneToUpdate.productIds || []).includes(p.id));
        if (selectedProdsForPrompt.length > 0) {
            const prodDesc = selectedProdsForPrompt.map(p => `[Product: ${p.name} - ${p.description}]`).join(' ');
            finalPrompt += `\n\nFeatured Products: ${prodDesc}`;
            console.log("Updated Base Prompt with Products:", finalPrompt);
        }

        // --- 3. FILM CONTINUITY: Include Previous Scene Context ---
        const previousSceneIndex = currentSceneIndex - 1;
        if (previousSceneIndex >= 0) {
            const previousScene = currentState.scenes[previousSceneIndex];
            if (previousScene && previousScene.contextDescription) {
                // Get transition type from previous scene
                const transitionInfo = previousScene.transitionType
                    ? TRANSITION_TYPES.find(t => t.value === previousScene.transitionType)
                    : null;
                const transitionHint = transitionInfo?.hint || 'smooth visual continuity';

                // Build continuity prompt
                const continuityPrompt = `\n\n[FILM CONTINUITY: Previous scene "${previousScene.promptName || 'Scene ' + previousSceneIndex}" showed: ${previousScene.contextDescription.slice(0, 150)}... Transition: ${transitionHint}. Ensure visual coherence and narrative flow.]`;
                finalPrompt += continuityPrompt;
                console.log("🎞️ Film Continuity applied from scene:", previousSceneIndex);
            }
        }

        console.log("🎬 Cinematography applied:", { cameraPrompt, lensPrompt, anglePrompt, metaTokens });

        if (!finalPrompt && !refinementPrompt) {
            alert("Vui lòng nhập mô tả bối cảnh.");
            return;
        }

        const apiKey = userApiKey || process.env.API_KEY;
        const genyuToken = currentState.genyuToken;

        if (!apiKey && !genyuToken) {
            setApiKeyModalOpen(true);
            alert("Vui lòng nhập API Key (Gemini) hoặc Token (Genyu) để tiếp tục.");
            return;
        }

        setState(s => ({
            ...s,
            scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: true, error: null } : sc)
        }));

        try {
            let finalImagePrompt = finalPrompt;

            // --- STEP 1: PROMPT ENHANCEMENT (Director Mode) ---
            // Only if API Key is available. If Genyu-only users, skip enhancement.
            if (apiKey) {
                try {
                    const ai = new GoogleGenAI({ apiKey });
                    const selectedChars = currentState.characters.filter(c => sceneToUpdate.characterIds.includes(c.id));

                    const characterInstructions = selectedChars.map((c, i) => {
                        const propsText = c.props?.filter(p => p.image).map((p, idx) => p.name || `Accessory #${idx + 1}`).join(', ');
                        const propsSegment = propsText ? `\n  - equipped with PROPS: ${propsText}` : '';
                        return `- Character ${i + 1} (${c.name}): ${c.description}.${propsSegment}`;
                    }).join('\n');

                    const charNames = selectedChars.map(c => c.name).join(', ') || 'None';

                    let continuityInstruction = "";
                    if (isContinuityMode && currentSceneIndex > 0 && currentState.scenes[currentSceneIndex - 1].generatedImage) {
                        continuityInstruction = "CONTINUITY: Match lighting and environment of the previous scene.";
                    }

                    const directorPrompt = `
                    Act as a Film Director / Cinematographer.
                    Rewrite this scene description into a detailed Image Generation Prompt.
                    
                    SCENE: "${sceneToUpdate.contextDescription}"
                    STYLE: ${styleInstruction}
                    CHARACTERS: ${charNames}
                    DETAILS:
                    ${characterInstructions}
                    ${continuityInstruction}
                    ${refinementPrompt ? `REFINEMENT REQUEST: ${refinementPrompt}` : ''}

                    CRITICAL INSTRUCTION: 
                    I have provided visual references for the characters and their props. 
                    Look at the images provided (Face, Body, Props). 
                    describe the PROPS in extreme detail based on the visual reference. 
                    If the user uploaded a specific LEGO car, describe it as a "Lego technic car with blue stripes..." etc. matching the image.
                    Ensure the prompt enforces the presence of these specific props.

                    OUTPUT: A single, high-quality, descriptive English prompt for the AI image generator. Focus on visual details, lighting, composition, and mood.
                    `;

                    // Collect Multimodal Parts (Text + Images)
                    const directorParts: any[] = [{ text: directorPrompt }];

                    selectedChars.forEach((c) => {
                        if (c.faceImage) {
                            const [h, d] = c.faceImage.split(',');
                            const m = h.match(/:(.*?);/)?.[1] || 'image/jpeg';
                            directorParts.push({ text: `[Visual Ref: ${c.name} Face]` });
                            directorParts.push({ inlineData: { data: d, mimeType: m } });
                        }
                        if (c.bodyImage) {
                            const [h, d] = c.bodyImage.split(',');
                            const m = h.match(/:(.*?);/)?.[1] || 'image/jpeg';
                            directorParts.push({ text: `[Visual Ref: ${c.name} Outfit]` });
                            directorParts.push({ inlineData: { data: d, mimeType: m } });
                        }
                        if (c.props) {
                            c.props.forEach(p => {
                                if (p.image) {
                                    const [h, d] = p.image.split(',');
                                    const m = h.match(/:(.*?);/)?.[1] || 'image/jpeg';
                                    directorParts.push({ text: `[Visual Ref: ${c.name} Prop - ${p.name}]` });
                                    directorParts.push({ inlineData: { data: d, mimeType: m } });
                                }
                            });
                        }
                    });

                    // Add Previous Scene for Continuity if available
                    if (isContinuityMode && currentSceneIndex > 0 && currentState.scenes[currentSceneIndex - 1].generatedImage) {
                        const prevImg = currentState.scenes[currentSceneIndex - 1].generatedImage;
                        if (prevImg) {
                            const [h, d] = prevImg.split(',');
                            const m = h.match(/:(.*?);/)?.[1] || 'image/jpeg';
                            directorParts.push({ text: `[Visual Ref: Previous Scene Context]` });
                            directorParts.push({ inlineData: { data: d, mimeType: m } });
                        }
                    }

                    const enhancementResp = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: { parts: directorParts }
                    });
                    finalImagePrompt = enhancementResp.text || finalPrompt;
                } catch (e) {
                    console.warn("Prompt enhancement failed, using raw prompt", e);
                }
            }



            // --- STEP 2: GENERATION ---
            let imageUrl = "";
            const currentResolution = currentState.resolution || '1K';
            const isHighRes = currentResolution === '2K' || currentResolution === '4K';

            // PRIORITY LOGIC:
            if (genyuToken && !isHighRes) {
                // >>> ROUTE 1: GENYU PROXY (Only for 1K/Standard) <<<
                console.log("Using Genyu Proxy for Scene (1K Mode)...");

                let genyuAspect = "IMAGE_ASPECT_RATIO_LANDSCAPE"; // Default 16:9
                if (currentState.aspectRatio === "9:16") genyuAspect = "IMAGE_ASPECT_RATIO_PORTRAIT";
                if (currentState.aspectRatio === "3:4") genyuAspect = "IMAGE_ASPECT_RATIO_PORTRAIT"; // Map 3:4 to Portrait
                if (currentState.aspectRatio === "1:1") genyuAspect = "IMAGE_ASPECT_RATIO_SQUARE";
                if (currentState.aspectRatio === "4:3") genyuAspect = "IMAGE_ASPECT_RATIO_LANDSCAPE"; // Map 4:3 to Landscape

                // Build request body (matching old working code)
                const requestBody: any = {
                    token: genyuToken,
                    prompt: finalImagePrompt,
                    aspect: genyuAspect,
                    style: styleInstruction
                };

                // Only add recaptchaToken if it exists (fallback to server default)
                if (currentState.recaptchaToken) {
                    requestBody.recaptchaToken = currentState.recaptchaToken;
                }

                const response = await fetch('http://localhost:3001/api/proxy/genyu/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errJson = await response.json();
                    throw new Error(errJson.error || "Genyu Proxy Failed");
                }

                const data = await response.json();
                console.log("Genyu Scene Response:", data);

                // Handle Google Labs / Fx Flow Direct Response
                let genyuImage = null;
                let extractedMediaId = null;

                if (data.submissionResults && data.submissionResults.length > 0) {
                    const submission = data.submissionResults[0]?.submission;
                    const result = submission?.result || data.submissionResults[0]?.result;
                    genyuImage = result?.fifeUrl || result?.media?.fifeUrl;

                    // Extract MediaID for Video Gen
                    extractedMediaId = result?.mediaGenerationId || result?.media?.mediaGenerationId;

                    // Fallback to workflows if not in result
                    if (!extractedMediaId && data.workflows && data.workflows.length > 0) {
                        extractedMediaId = data.workflows[0].primaryMediaKey;
                    }

                } else if (data.media && data.media.length > 0) {
                    // Fallback for "Keys: media, workflows" case
                    const mediaItem = data.media[0];
                    genyuImage = mediaItem.fifeUrl || mediaItem.url;

                    // Try to find Media ID in mediaItem
                    extractedMediaId = mediaItem.id || mediaItem.mediaId || mediaItem.mediaGenerationId; // Guessing properties

                    if (!genyuImage && mediaItem.image) {
                        const img = mediaItem.image;
                        genyuImage = img.fifeUrl || img.url;

                        // Check generatedImage key
                        if (!genyuImage && img.generatedImage) {
                            const genImg = img.generatedImage;
                            genyuImage = genImg.fifeUrl || genImg.url || (typeof genImg === 'string' ? genImg : null);
                        }

                        // If image is just a string
                        if (!genyuImage && typeof img === 'string') {
                            genyuImage = img;
                        }
                    }

                    // Fallback to workflows for ID if missing in media item
                    if (!extractedMediaId && data.workflows && data.workflows.length > 0) {
                        extractedMediaId = data.workflows[0].primaryMediaKey;
                    }
                }

                // Fallback for old Genyu API (if user switches back)
                if (!genyuImage) {
                    genyuImage = data.data?.images?.[0]?.url || data.data?.url || data.url || data.imageUrl;
                }

                if (genyuImage) {
                    imageUrl = genyuImage;
                    // If we found a mediaId, log it
                    if (extractedMediaId) {
                        console.log("Captured Media ID for Video:", extractedMediaId);
                        // Store it in the scene state (will update below)
                    }
                } else {
                    const debugKeys = Object.keys(data).join(', ');
                    throw new Error(`Cannot find image URL. Keys: ${debugKeys}`);
                }

                // Save to endFrameImage or generatedImage based on isEndFrame flag
                setState(s => ({
                    ...s,
                    scenes: s.scenes.map(sc => sc.id === sceneId ? {
                        ...sc,
                        ...(isEndFrame
                            ? { endFrameImage: imageUrl }
                            : { generatedImage: imageUrl, imageRole: sc.veoMode === 'start-end-frame' ? 'start-frame' : 'single' }
                        ),
                        mediaId: isEndFrame ? sc.mediaId : extractedMediaId,
                        error: null,
                        isGenerating: false
                    } : sc)
                }));
                console.log(isEndFrame ? "🔴 End Frame saved" : "🟢 Start Frame/Image saved");
                return;


            } else if (apiKey) {
                // >>> ROUTE 2: GEMINI DIRECT (Full Control + High Res) <<<
                const ai = new GoogleGenAI({ apiKey });
                const parts: any[] = [];

                // Add Reference Images for Gemini
                const selectedChars = currentState.characters.filter(c => sceneToUpdate.characterIds.includes(c.id));
                for (const char of selectedChars) {
                    if (char.faceImage) {
                        const [header, data] = char.faceImage.split(',');
                        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                        parts.push({ text: `Reference for ${char.name}'s FACE:` });
                        parts.push({ inlineData: { data, mimeType } });
                    }
                    if (char.bodyImage) {
                        const [header, data] = char.bodyImage.split(',');
                        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                        parts.push({ text: `Reference for ${char.name}'s OUTFIT:` });
                        parts.push({ inlineData: { data, mimeType } });
                    }
                    // Inject PROPS references
                    if (char.props && char.props.length > 0) {
                        for (const prop of char.props) {
                            if (prop.image) {
                                const [header, data] = prop.image.split(',');
                                const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                                parts.push({ text: `Reference for ${char.name}'s PROP (${prop.name || 'Accessory'}):` });
                                parts.push({ inlineData: { data, mimeType } });
                            }
                        }
                    }
                }

                if (isContinuityMode && currentSceneIndex > 0 && !refinementPrompt) {
                    const prevScene = currentState.scenes[currentSceneIndex - 1];
                    if (prevScene.generatedImage) {
                        const [header, data] = prevScene.generatedImage.split(',');
                        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                        parts.push({ text: `Reference for PREVIOUS SCENE:` });
                        parts.push({ inlineData: { data, mimeType } });
                    }
                }

                if (refinementPrompt && sceneToUpdate.generatedImage) {
                    const [header, data] = sceneToUpdate.generatedImage.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    parts.push({ inlineData: { data, mimeType } });
                }

                parts.push({ text: finalImagePrompt });

                // Force Pro model for High Res if current model is Flash
                let modelToUse = currentState.imageModel || 'gemini-2.5-flash-image';
                if (isHighRes && modelToUse === 'gemini-2.5-flash-image') {
                    modelToUse = 'gemini-3-pro-image-preview'; // Auto-upgrade to Pro for 2K/4K
                }

                const response = await ai.models.generateContent({
                    model: modelToUse,
                    contents: { parts },
                    config: {
                        imageConfig: {
                            aspectRatio: currentState.aspectRatio || "16:9",
                            imageSize: currentResolution
                        }
                    },
                });

                const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (imagePart?.inlineData) {
                    imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                } else {
                    throw new Error("Không nhận được ảnh từ API.");
                }
            } else {
                throw new Error("Missing Credentials");
            }

            // Save Result (handles both routes)
            setState(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? {
                    ...sc,
                    ...(isEndFrame
                        ? { endFrameImage: imageUrl }
                        : { generatedImage: imageUrl, imageRole: sc.veoMode === 'start-end-frame' ? 'start-frame' : 'single' }
                    ),
                    isGenerating: false,
                    error: null
                } : sc)
            }));
            console.log(isEndFrame ? "🔴 End Frame saved (Gemini)" : "🟢 Image saved (Gemini)");

        } catch (error) {
            console.error("Image generation failed:", error);
            let errorMessage = "Tạo ảnh thất bại.";
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setState(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: false, error: errorMessage } : sc)
            }));
        }
    };

    // --- Veo Prompt Generation ---
    const generateVeoPrompt = async (sceneId: string) => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene || !scene.generatedImage) return;

        const apiKey = userApiKey || process.env.API_KEY;
        if (!apiKey) return;

        try {
            const ai = new GoogleGenAI({ apiKey });
            let data: string;
            let mimeType: string = 'image/jpeg';

            if (scene.generatedImage.startsWith('data:')) {
                const [header, base64Data] = scene.generatedImage.split(',');
                data = base64Data;
                mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            } else {
                // Fetch URL via Proxy or Direct (if CORS allows, but likely need proxy)
                // Use the proxy we made for analysis
                try {
                    const proxyUrl = `http://localhost:3001/api/proxy/fetch-image?url=${encodeURIComponent(scene.generatedImage)}`;
                    const imgRes = await fetch(proxyUrl);
                    const blob = await imgRes.blob();
                    mimeType = blob.type;
                    data = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error("Fetch image failed", e);
                    return alert("Không thể tải ảnh phân cảnh để phân tích.");
                }
            }

            const scriptText = state.scriptLanguage === 'vietnamese' ? scene.vietnamese : scene.language1;
            const context = scene.contextDescription || '';
            const promptName = scene.promptName || '';

            const prompt = `
             Role: Expert Video Prompt Engineer for Google Veo 3.1.
             
             **INPUT DATA:**
             - Visual Reference: Keyframe Image provided.
             - Context: "${context}"
             - Scene Intent: "${promptName}"
             - Dialogue: "${scriptText}"
             
             **TASK:** 
             Analyze the scene and generate the OPTIMAL text-to-video prompt.
             Do NOT be rigid. Choose the best structure based on the scene content:
             
             1. **Timestamped Format** (Use for Dialogue/Complex Action):
                Structure: "(00:00-00:05) [Camera Movement] of [Subject] [Action]..."
                *Why?* Essential for lip-sync, precise acting, or timed events.
             
             2. **Narrative Format** (Use for Atmosphere/Scenery/B-Roll):
                Structure: "A cinematic [Shot Type] of [Subject]..."
                *Why?* Better for flowing, atmospheric, or establishing shots without rigid timing.
                
             3. **JSON Format** (Use ONLY if technical separation is critical):
                Structure: JSON with keys "camera", "subject", "lighting", "action".

             **VEO 3.1 OPTIMIZATION CHECKLIST:**
             - **Camera:** Use specific terms: "Truck Left", "Dolly In", "Rack Focus", "Low Angle", "Aerial Orbit".
             - **Lighting:** Define source: "Volumetric fog", "Rembrandt lighting", "Neon rim light".
             - **Micro-Movements (CRITICAL):**
                - If Dialogue exists ("${scriptText}"): MUST include "character talking", "lips moving naturally", "expressive face".
                - Background: "wind blowing hair", "dust particles", "flickering neon", "rain".
             - **Style:** "Photorealistic, 4k, High Fidelity, Cinematic Motion Blur".
             
             **OUTPUT:**
             Return ONLY the final prompt string (in English). Do not include explanations.
             `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { data, mimeType } },
                        { text: prompt }
                    ]
                }
            });

            const veoPrompt = response.text?.trim() || '';

            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, veoPrompt } : sc)
            }));

        } catch (e) {
            console.error("Veo prompt gen failed", e);
        }
    };

    const handleGenerateAllVeoPrompts = async () => {
        const scenesToProcess = state.scenes.filter(s => s.generatedImage && !s.veoPrompt);
        if (scenesToProcess.length === 0) {
            return alert("Không có phân cảnh nào (đã có ảnh) cần tạo Veo prompt.");
        }

        setIsVeoGenerating(true);
        const apiKey = userApiKey || process.env.API_KEY;
        if (!apiKey) {
            setApiKeyModalOpen(true);
            setIsVeoGenerating(false);
            return;
        }

        try {
            for (const scene of scenesToProcess) {
                await generateVeoPrompt(scene.id);
                await new Promise(r => setTimeout(r, 200));
            }
        } finally {
            setIsVeoGenerating(false);
        }
    };

    // --- Google Veo 3.1 Video Generation ---
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);

    // Helper: Clean Token Client Side
    const cleanToken = (t: string) => {
        if (!t) return "";
        if (t.includes('session-token=')) {
            return t.split('session-token=')[1].split(';')[0].trim();
        }
        return t.trim();
    };

    const checkVideoStatus = async (operationsToCheck: { sceneId: string, name: string }[], token: string) => {
        if (operationsToCheck.length === 0) {
            setIsVideoGenerating(false);
            return;
        }

        const cleanT = cleanToken(token);

        try {
            // Construct payload for status check
            const payload = {
                token: cleanT, // Send success logic needs clean token too? Proxy uses 'token' from body for Auth.
                operations: operationsToCheck.map(op => ({
                    operation: { name: op.name },
                    sceneId: op.sceneId,
                    status: "MEDIA_GENERATION_STATUS_ACTIVE"
                }))
            };

            const response = await fetch('http://localhost:3001/api/proxy/google/video/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) return;

            const data = await response.json();
            const updates = data.operations;

            if (!updates || !Array.isArray(updates)) {
                setTimeout(() => checkVideoStatus(operationsToCheck, token), 5000);
                return;
            }

            let pendingOps: { sceneId: string, name: string }[] = [];

            const updateMap = new Map();
            updates.forEach((u: any) => {
                if (u.sceneId) updateMap.set(u.sceneId, u);
            });

            updateStateAndRecord(s => {
                const newScenes = s.scenes.map(scene => {
                    const op = operationsToCheck.find(o => o.sceneId === scene.id);
                    if (!op) return scene;

                    const update = updateMap.get(scene.id);
                    if (!update) {
                        pendingOps.push(op);
                        return scene;
                    }

                    if (update.status === 'MEDIA_GENERATION_STATUS_SUCCEEDED') {
                        const vidUrl = update.result?.video?.video?.url || update.result?.video?.url || update.result?.url;
                        return {
                            ...scene,
                            generatedVideo: vidUrl,
                            videoStatus: 'succeeded',
                            isGenerating: false,
                            videoOperationName: undefined
                        };
                    } else if (update.status === 'MEDIA_GENERATION_STATUS_FAILED') {
                        return {
                            ...scene,
                            videoStatus: 'failed',
                            isGenerating: false,
                            error: "Gen Video Failed",
                            videoOperationName: undefined
                        };
                    } else {
                        pendingOps.push(op);
                        return { ...scene, videoStatus: 'active' };
                    }
                });
                return { ...s, scenes: newScenes };
            });

            if (pendingOps.length > 0) {
                setTimeout(() => checkVideoStatus(pendingOps, token), 5000);
            } else {
                setIsVideoGenerating(false);
            }

        } catch (e) {
            console.error("Poll Error", e);
            setIsVideoGenerating(false);
        }
    };

    const handleGenerateAllVideos = async () => {
        const rawToken = state.genyuToken;
        console.log("Video Gen - Token Raw:", rawToken ? "OK" : "MISSING");

        if (!rawToken) return alert("Cần Genyu Token để tạo Video (Google Labs).");

        // Clean Token immediately
        const genyuToken = cleanToken(rawToken);
        console.log("Video Gen - Token Cleaned:", genyuToken.substring(0, 10) + "...");

        // Filter valid scenes: Has MediaID (Image source) + Veo Prompt + No Video yet
        const scenesToProcess = state.scenes.filter(s => s.mediaId && s.veoPrompt && !s.generatedVideo);

        console.log("Video Gen - Valid Scenes:", scenesToProcess.length);
        if (scenesToProcess.length === 0) {
            const missingMediaId = state.scenes.filter(s => !s.mediaId && s.generatedImage).length;
            const missingPrompt = state.scenes.filter(s => s.mediaId && !s.veoPrompt).length;

            return alert(`Không tìm thấy phân cảnh nào đủ điều kiện!\n\n- Số ảnh chưa có Media ID: ${missingMediaId} (Cần tạo lại ảnh)\n- Số ảnh chưa có Veo Prompt: ${missingPrompt} (Cần tạo Prompt)`);
        }

        // Removed confirm for debugging
        // if (!confirm(`Sẽ tạo video cho ${scenesToProcess.length} phân cảnh. Tiếp tục?`)) return;

        console.log("Starting Video Gen Loop...");
        setIsVideoGenerating(true);
        let startedOps: { sceneId: string, name: string }[] = [];
        let errorMsg = "";

        for (const scene of scenesToProcess) {
            // Update UI to 'Starting...'
            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === scene.id ? { ...sc, isGenerating: true, videoStatus: 'starting' } : sc)
            }));

            try {
                // Map Aspect Ratio
                let videoAspect = "VIDEO_ASPECT_RATIO_LANDSCAPE";
                if (state.aspectRatio === "9:16" || state.aspectRatio === "3:4") videoAspect = "VIDEO_ASPECT_RATIO_PORTRAIT";

                // DEBUG: Verify Tokens
                alert(`Debug Request:\nRecaptcha: ${state.recaptchaToken?.substring(0, 10)}...\nToken: ${genyuToken.substring(0, 10)}...`);

                const response = await fetch('http://localhost:3001/api/proxy/google/video/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: genyuToken,
                        recaptchaToken: state.recaptchaToken, // Send dynamic Recaptcha
                        prompt: scene.veoPrompt,
                        mediaId: scene.mediaId, // This must be valid!
                        aspectRatio: videoAspect
                    })
                });

                const data = await response.json();
                console.log(`Video Start Res [${scene.sceneNumber}]:`, data);

                if (data.requests && data.requests.length > 0) {
                    const opName = data.requests[0].operation?.name;
                    if (opName) {
                        startedOps.push({ sceneId: scene.id, name: opName });
                        // Update Scene
                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(sc => sc.id === scene.id ? { ...sc, videoOperationName: opName, videoStatus: 'active' } : sc)
                        }));
                    } else {
                        errorMsg = "No operation name returned.";
                    }
                } else {
                    // Failed start
                    console.warn("Failed to start video for scene", scene.id, data);

                    // Extract detailed error
                    let details = "Unknown Error";
                    if (data.details) {
                        // Proxied error
                        details = JSON.stringify(data.details);
                        if (data.details.error) {
                            details = `${data.details.error.code} - ${data.details.error.message}`;
                        }
                    } else if (data.error) {
                        details = data.error.message || JSON.stringify(data.error);
                    }

                    errorMsg = `Google API Error: ${details}`;

                    updateStateAndRecord(s => ({
                        ...s,
                        scenes: s.scenes.map(sc => sc.id === scene.id ? { ...sc, isGenerating: false, error: details } : sc)
                    }));
                }

                // Add delay between requests to be safe
                await new Promise(r => setTimeout(r, 500));

            } catch (e: any) {
                console.error("Start Video Error", e);
                errorMsg = e.message;
                updateStateAndRecord(s => ({
                    ...s,
                    scenes: s.scenes.map(sc => sc.id === scene.id ? { ...sc, isGenerating: false, error: "Req Error" } : sc)
                }));
            }
        }

        // Start Polling
        if (startedOps.length > 0) {
            alert(`Đã khởi tạo thành công ${startedOps.length} video. Hệ thống sẽ tự động theo dõi tiến độ.`);
            setTimeout(() => checkVideoStatus(startedOps, genyuToken), 5000);
        } else {
            setIsVideoGenerating(false);
            alert(`Không thể bắt đầu tạo video nào!\nLỗi cuối cùng: ${errorMsg}\n\nVui lòng kiểm tra Console (F12) để xem chi tiết.`);
        }
    };


    const CONCURRENCY_LIMIT = 5;
    const handleGenerateAllImages = async () => {
        if (isContinuityMode) {
            const scenesToGenerate = state.scenes.filter(s => !s.generatedImage && s.contextDescription);
            if (scenesToGenerate.length === 0) return alert("Đã đủ ảnh.");

            setIsBatchGenerating(true);
            try {
                for (const scene of scenesToGenerate) {
                    await performImageGeneration(scene.id);
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsBatchGenerating(false);
            }
        } else {
            const scenesToGenerate = state.scenes.filter(s => !s.generatedImage && s.contextDescription);
            if (scenesToGenerate.length === 0) {
                alert("Tất cả các phân cảnh có mô tả đã có ảnh.");
                return;
            }
            setIsBatchGenerating(true);

            const runWithConcurrency = async (tasks: (() => Promise<any>)[], limit: number) => {
                const results: Promise<any>[] = [];
                const executing: Promise<any>[] = [];
                for (const task of tasks) {
                    const p = task();
                    results.push(p);

                    if (limit <= tasks.length) {
                        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
                        executing.push(e);
                        if (executing.length >= limit) {
                            await Promise.race(executing);
                        }
                    }
                }
                return Promise.all(results);
            };

            const generationTasks = scenesToGenerate.map(scene => () => performImageGeneration(scene.id));

            try {
                await runWithConcurrency(generationTasks, CONCURRENCY_LIMIT);
            } catch (error) {
                console.error("An error occurred during batch generation:", error);
            } finally {
                setIsBatchGenerating(false);
            }
        }
    };

    const handleDownloadAll = () => {
        const zip = new JSZip();
        const scenesWithImages = state.scenes.filter(s => s.generatedImage);

        if (scenesWithImages.length === 0) {
            alert("Không có ảnh nào để tải xuống.");
            return;
        }

        scenesWithImages.forEach((scene) => {
            const imgData = scene.generatedImage!.split(',')[1];
            zip.file(`${scene.sceneNumber}.png`, imgData, { base64: true });
        });

        zip.generateAsync({ type: "blob" }).then(function (content) {
            const filename = state.projectName ? `${slugify(state.projectName)}.zip` : 'project-images.zip';
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    };

    const handleOpenImageViewer = (sceneIndex: number) => {
        setCurrentImageIndex(sceneIndex);
        setImageViewerOpen(true);
    };

    // --- Effect Hooks ---
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setZoom(prev => Math.max(0.2, Math.min(3, prev - e.deltaY * 0.001)));
            }
        };
        const mainContent = mainContentRef.current;
        mainContent?.addEventListener('wheel', handleWheel, { passive: false });
        return () => mainContent?.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (mainContentRef.current && mainContentRef.current.scrollTop > 50) {
                setHeaderSticky(true);
            } else {
                setHeaderSticky(false);
            }
        };
        const mainContent = mainContentRef.current;
        mainContent?.addEventListener('scroll', handleScroll);
        return () => mainContent?.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="h-screen w-screen bg-brand-dark text-brand-cream overflow-hidden relative">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-brand-orange/20 rounded-full filter blur-3xl animate-pulse-slow"></div>
                <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 bg-brand-red/10 rounded-full filter blur-3xl animate-pulse-slow delay-1000"></div>
            </div>

            <Header
                isSticky={isHeaderSticky}
                onApiKeyClick={() => setApiKeyModalOpen(true)}
                onSave={handleSave}
                onOpen={handleOpen}
                onNewProject={handleNewProject}
                onDownloadAll={handleDownloadAll}
                canDownload={state.scenes.some(s => s.generatedImage)}
                isContinuityMode={isContinuityMode}
                toggleContinuityMode={() => setIsContinuityMode(!isContinuityMode)}
                onGenyuClick={() => setGenyuModalOpen(true)}
            />

            <main ref={mainContentRef} className="h-full w-full overflow-auto pt-20">
                <div className="transition-transform duration-200 ease-out" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                    <div className="container mx-auto px-6 pb-24">
                        <ProjectNameInput value={state.projectName} onChange={handleProjectNameChange} />

                        <div className="my-16">
                            <SectionTitle>Quản lý Nhân vật (Model Sheets)</SectionTitle>
                            <div className="grid md:grid-cols-3 gap-6">
                                {state.characters.map((char, index) => (
                                    <CharacterCard
                                        key={char.id}
                                        character={char}
                                        index={index}
                                        setDefault={setDefaultCharacter}
                                        onDelete={() => deleteCharacter(char.id)}
                                        onValuesChange={updateCharacter}
                                        onEdit={() => setEditingCharacterId(char.id)}
                                    />
                                ))}
                                {/* Add Character Button */}
                                <button
                                    onClick={addCharacter}
                                    className="bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-700 hover:border-brand-orange hover:bg-gray-800/80 flex items-center justify-center space-x-3 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-700 group-hover:bg-brand-orange/20 flex items-center justify-center transition-colors">
                                        <Plus size={18} className="text-gray-500 group-hover:text-brand-orange" />
                                    </div>
                                    <span className="text-gray-400 group-hover:text-white font-medium">Thêm Nhân Vật</span>
                                </button>
                            </div>
                        </div>


                        {/* --- PRODUCTS & PROPS SECTION --- */}
                        <div className="my-16">
                            <SectionTitle>Sản phẩm & Đạo cụ đặc biệt (Product/Props)</SectionTitle>
                            <div className="grid md:grid-cols-3 gap-6">
                                {state.products?.map((prod, index) => (
                                    <div
                                        key={prod.id}
                                        className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-brand-orange cursor-pointer transition-all flex items-center space-x-4 relative group"
                                        onClick={() => setEditingProductId(prod.id)}
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-14 h-14 rounded-lg bg-gray-900 border border-gray-600 overflow-hidden flex-shrink-0 relative">
                                            {prod.masterImage ? (
                                                <img src={prod.masterImage} alt={prod.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl">
                                                    📦
                                                </div>
                                            )}

                                            {/* Loading Indicator */}
                                            {prod.isAnalyzing && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-orange"></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-brand-cream truncate">{prod.name || `Product ${index + 1}`}</h3>
                                            <p className="text-xs text-gray-400 truncate mt-0.5">{prod.description || "No description"}</p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center space-x-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteProduct(prod.id); }}
                                                className="p-1.5 text-gray-600 hover:text-red-500 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>
                                ))}

                                {/* Add Product Button */}
                                <button
                                    onClick={addProduct}
                                    className="bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-700 hover:border-brand-orange hover:bg-gray-800/80 flex items-center justify-center space-x-3 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-700 group-hover:bg-brand-orange/20 flex items-center justify-center transition-colors">
                                        <Plus size={18} className="text-gray-500 group-hover:text-brand-orange" />
                                    </div>
                                    <span className="text-gray-400 group-hover:text-white font-medium">Thêm Sản Phẩm</span>
                                </button>
                            </div>
                        </div>

                        <div className="my-16 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                            <SectionTitle>Kịch bản & Phong cách</SectionTitle>
                            <div className="grid md:grid-cols-3 gap-6 items-start">
                                <div className="md:col-span-2 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Phong cách Tổng thể (Global Style)</label>
                                            <select
                                                value={state.stylePrompt}
                                                onChange={handleStylePromptChange}
                                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 appearance-none"
                                            >
                                                {GLOBAL_STYLES.map(style => (
                                                    <option key={style.value} value={style.value}>{style.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Model tạo ảnh (Cho Scene)</label>
                                                <select
                                                    value={state.imageModel}
                                                    onChange={handleImageModelChange}
                                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 appearance-none"
                                                >
                                                    {IMAGE_MODELS.map(model => (
                                                        <option key={model.value} value={model.value}>{model.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Độ phân giải (Resolution)</label>
                                                <select
                                                    value={state.resolution || '1K'}
                                                    onChange={(e) => updateStateAndRecord(s => ({ ...s, resolution: e.target.value }))}
                                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 appearance-none"
                                                >
                                                    <option value="1K">1K (Standard) - Genyu/Gemini</option>
                                                    <option value="2K">2K (High Res) - Google Pro Only</option>
                                                    <option value="4K">4K (Ultra) - Google Pro Only</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">Áp dụng một "System Prompt" nhất quán cho toàn bộ dự án để tránh lệch tông màu/ánh sáng.</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Tỷ lệ ảnh (Aspect Ratio)</label>
                                            <select
                                                value={state.aspectRatio}
                                                onChange={handleAspectRatioChange}
                                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600"
                                            >
                                                {ASPECT_RATIOS.map(ratio => (
                                                    <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Ngôn ngữ nguồn cho Script</label>
                                            <select
                                                value={state.scriptLanguage}
                                                onChange={handleScriptLanguageChange}
                                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600"
                                            >
                                                <option value="vietnamese">Tiếng Việt (Cột 3)</option>
                                                <option value="language1">Ngôn ngữ 1 (Cột 2)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* === CINEMATOGRAPHY SETTINGS (NEW) === */}
                                    <div className="mt-4 pt-4 border-t border-gray-600">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <span className="text-sm font-semibold text-brand-orange">📹 Cinematography</span>
                                            <span className="text-[10px] text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">Pro Settings</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Camera Body</label>
                                                <select
                                                    value={state.cameraModel || ''}
                                                    onChange={(e) => updateStateAndRecord(s => ({ ...s, cameraModel: e.target.value }))}
                                                    className="w-full bg-gray-900 text-white px-2 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange border border-gray-600"
                                                >
                                                    {CAMERA_MODELS.map(cam => (
                                                        <option key={cam.value} value={cam.value}>{cam.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Default Lens</label>
                                                <select
                                                    value={state.defaultLens || ''}
                                                    onChange={(e) => updateStateAndRecord(s => ({ ...s, defaultLens: e.target.value }))}
                                                    className="w-full bg-gray-900 text-white px-2 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange border border-gray-600"
                                                >
                                                    {LENS_OPTIONS.map(lens => (
                                                        <option key={lens.value} value={lens.value}>{lens.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">
                                                Meta Tokens <span className="text-gray-500">(để trống = AI tự thêm creative tokens)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={state.customMetaTokens || ''}
                                                onChange={(e) => updateStateAndRecord(s => ({ ...s, customMetaTokens: e.target.value }))}
                                                placeholder="VD: cinematic lighting, film grain, shallow depth of field..."
                                                className="w-full bg-gray-900 text-white px-2 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange border border-gray-600 placeholder-gray-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center justify-center h-full space-y-3">
                                    <div className="w-full">
                                        <button
                                            onClick={() => setScriptModalOpen(true)}
                                            disabled={isScriptGenerating}
                                            className={`w-full px-6 py-4 font-semibold text-white rounded-lg transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center ${isScriptGenerating
                                                ? 'bg-blue-600/50 cursor-wait'
                                                : 'bg-gradient-to-r from-blue-500 to-blue-300 hover:from-blue-400 hover:to-blue-200'
                                                }`}
                                        >
                                            {isScriptGenerating ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5 text-white mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span className="text-sm">Đang tạo kịch bản...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-lg">✨ Viết Kịch Bản AI</span>
                                                    <span className="text-xs font-normal opacity-80 mt-1">Từ ý tưởng đến phân cảnh</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="w-full relative">
                                        <input type="file" id="script-upload-input" className="hidden" onChange={handleScriptUpload} accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
                                        <button onClick={triggerFileUpload} className={`w-full px-6 py-2 font-semibold text-white rounded-lg bg-gray-700 hover:bg-gray-600 transition-all duration-300`}>
                                            Upload Excel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="my-16">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-orange to-brand-red">Bảng trình bày Kịch bản</h2>
                                <div className="flex items-center space-x-2">
                                    <button onClick={handleGenerateAllImages} disabled={isBatchGenerating} className={`px-4 py-2 font-semibold text-brand-cream rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} shadow-lg shadow-brand-orange/20 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}>
                                        {isBatchGenerating ? 'Đang tạo (Tuần tự)...' : '1. Tạo ảnh hàng loạt'}
                                    </button>
                                    <button onClick={handleGenerateAllVeoPrompts} disabled={isVeoGenerating} className={`px-4 py-2 font-semibold text-brand-cream rounded-lg bg-gradient-to-r from-brand-red to-brand-brown hover:from-brand-orange hover:to-brand-red shadow-lg shadow-brand-red/20 transition-all duration-300 transform hover:scale-105 disabled:opacity-50`}>
                                        {isVeoGenerating ? 'Đang tạo Prompt...' : '2. Tạo Veo Prompts'}
                                    </button>
                                    <button onClick={handleGenerateAllVideos} disabled={isVideoGenerating} className={`px-4 py-2 font-semibold text-brand-cream rounded-lg bg-gradient-to-r from-brand-brown to-brand-orange hover:from-brand-red hover:to-brand-orange shadow-lg shadow-brand-orange/20 transition-all duration-300 transform hover:scale-105 disabled:opacity-50`}>
                                        {isVideoGenerating ? 'Đang tạo Video...' : '3. Tạo Video (Veo)'}
                                    </button>
                                    <button onClick={() => {
                                        const s = state.scenes;
                                        alert(`Debug Info:\nToken Len: ${state.genyuToken?.length || 0}\nScenes: ${s.length}\nHas MediaId: ${s.filter(x => x.mediaId).length}\nHas Prompt: ${s.filter(x => x.veoPrompt).length}\nHas Video: ${s.filter(x => x.generatedVideo).length}`);
                                        console.log('Scenes:', s);
                                    }} className="px-2 py-2 text-brand-orange hover:text-brand-cream border border-brand-brown hover:bg-brand-brown/50 rounded transition-colors">
                                        🐞
                                    </button>
                                    <button onClick={addScene} className={`px-4 py-2 font-semibold text-brand-cream rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} shadow-lg shadow-brand-orange/20 transition-all duration-300 transform hover:scale-105`}>+ Thêm Phân đoạn</button>
                                </div>
                            </div>
                            <div className="hidden md:grid grid-cols-12 gap-4 px-4 pb-2 text-sm font-bold text-gray-400 border-b-2 border-gray-700">
                                <div className="col-span-1 text-center relative group">Scene <span className="text-brand-orange">(?)</span><Tooltip text="Số thứ tự phân cảnh. Tên file ảnh sẽ được đặt theo cột này." /></div>
                                <div className="col-span-2">Script (Lang 1/Viet)</div>
                                <div className="col-span-2">Tên/Bối cảnh</div>
                                <div className="col-span-3">Veo Video Prompt <span className="text-blue-400">(New)</span></div>
                                <div className="col-span-1">Nhân vật</div>
                                <div className="col-span-3 text-center">Ảnh</div>
                            </div>
                            <div className="space-y-4 mt-4">
                                {state.scenes.map((scene, index) => (
                                    <SceneRow
                                        key={scene.id}
                                        scene={scene}
                                        index={index}
                                        characters={state.characters}
                                        products={state.products || []}
                                        updateScene={updateScene}
                                        removeScene={removeScene}
                                        generateImage={() => performImageGeneration(scene.id)}
                                        generateEndFrame={() => performImageGeneration(scene.id, undefined, true)}
                                        openImageViewer={() => handleOpenImageViewer(index)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main >

            <footer className="absolute bottom-0 left-0 right-0 p-4 text-center text-xs text-gray-600 z-10">
                Created by <a href="https://ai.fibusvideo.com" target="_blank" rel="noopener noreferrer" className="hover:text-brand-orange">@Mrsonic30</a>
            </footer>

            {
                zoom !== 1 && (
                    <button
                        onClick={() => setZoom(1)}
                        className={`absolute top-24 right-6 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all shadow-lg animate-fade-in`}
                    >
                        Reset Zoom (100%)
                    </button>
                )
            }

            <CoffeeButton onClick={() => setCoffeeModalOpen(true)} />

            <ApiKeyModal
                isOpen={isApiKeyModalOpen}
                onClose={() => setApiKeyModalOpen(false)}
                apiKey={userApiKey}
                setApiKey={(key: string) => {
                    setUserApiKey(key);
                    localStorage.setItem('geminiApiKey', key);
                }}
            />
            <GenyuTokenModal
                isOpen={genyuModalOpen}
                onClose={() => setGenyuModalOpen(false)}
                token={state.genyuToken || ''}
                setToken={(token) => {
                    updateStateAndRecord(s => ({ ...s, genyuToken: token }));
                    localStorage.setItem('genyuToken', token);
                }}
                recaptchaToken={state.recaptchaToken || ''}
                setRecaptchaToken={(token) => {
                    updateStateAndRecord(s => ({ ...s, recaptchaToken: token }));
                    localStorage.setItem('recaptchaToken', token);
                }}
            />
            <CoffeeModal isOpen={isCoffeeModalOpen} onClose={() => setCoffeeModalOpen(false)} apiKey={userApiKey} />
            <ScriptGeneratorModal
                isOpen={isScriptModalOpen}
                onClose={() => setScriptModalOpen(false)}
                onGenerate={handleGenerateScript}
                isGenerating={isScriptGenerating}
                activePresetId={state.activeScriptPreset}
                customPresets={state.customScriptPresets}
                onPresetChange={(presetId) => updateStateAndRecord(s => ({ ...s, activeScriptPreset: presetId }))}
                characters={state.characters}
                products={state.products || []}
            />
            <CharacterDetailModal
                isOpen={!!editingCharacterId}
                onClose={() => setEditingCharacterId(null)}
                character={state.characters.find(c => c.id === editingCharacterId) || null}
                updateCharacter={updateCharacter}
                setDefault={setDefaultCharacter}
                onMasterUpload={handleMasterImageUpload}
                onEditImage={openEditor}
                onOpenCharGen={(id) => setCharGenState({ isOpen: true, charId: id })}
                onDelete={deleteCharacter}
            />
            <CharacterGeneratorModal
                isOpen={charGenState.isOpen}
                onClose={() => setCharGenState({ isOpen: false, charId: null })}
                onSave={handleCharGenSave}
                apiKey={userApiKey || process.env.API_KEY || ''}
                genyuToken={state.genyuToken}
                model={state.imageModel || 'gemini-2.5-flash-image'}
                charId={charGenState.charId}
                updateCharacter={updateCharacter}
            />
            <AdvancedImageEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                sourceImage={editingImage?.image || ''}
                onSave={handleEditorSave}
                apiKey={userApiKey || process.env.API_KEY || ''}
                genyuToken={state.genyuToken}
            />
            <ImageViewerModal
                isOpen={isImageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                scenes={state.scenes}
                currentIndex={currentImageIndex}
                onNavigate={setCurrentImageIndex}
                onRegenerate={performImageGeneration}
            />
            <ProductDetailModal
                isOpen={!!editingProductId}
                onClose={() => setEditingProductId(null)}
                product={state.products?.find(p => p.id === editingProductId) || null}
                updateProduct={updateProduct}
                onMasterImageUpload={handleProductMasterImageUpload}
                onDelete={deleteProduct}
                onGenerateProduct={handleGenerateProductFromPrompt}
            />
        </div >
    );
};

export default App;
