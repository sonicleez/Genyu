import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Modal from './Modal';
import { Character } from '../types';

// Character Styles Configuration
export const CHARACTER_STYLES = [
    {
        value: 'pixar',
        label: '3D Animation (Pixar/Disney Style)',
        prompt: `3D Animation style, Pixar/Disney quality, smooth plastic-like skin texture, expressive large eyes, stylized proportions,
                 soft ambient lighting with key light for dramatic shadows, Subsurface Scattering on skin,
                 intricate clothing folds with bump/displacement mapping, ultra-clean lines.`
    },
    {
        value: 'cinematic',
        label: 'Realistic Cinematic',
        prompt: `Hyper-realistic cinematic portrait, Cinematic film grade, 35mm ARRI ALEXA footage,
                 Sharp focus on eyes and skin pores, cinematic depth of field, film grain, natural lighting
                 with professional 3-point setup, Color graded with filmic LUT. Skin with subsurface scattering.`
    },
    {
        value: 'fantasy',
        label: 'Digital Fantasy Art',
        prompt: `High fantasy digital painting style, painterly brushstrokes, rich saturated colors,
                 epic fantasy lighting with glows and rim lights, detailed armor/cloth textures,
                 RPG character concept art quality, Artstation trending.`
    },
];

const PRIMARY_GRADIENT = "from-orange-600 to-red-600";

interface CharacterGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (image: string) => void;
    apiKey: string;
    model: string;
    charId: string | null;
    updateCharacter: (id: string, updates: Partial<Character>) => void;
}

export const CharacterGeneratorModal: React.FC<CharacterGeneratorModalProps> = ({
    isOpen, onClose, onSave, apiKey, model, charId, updateCharacter
}) => {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('pixar');
    const [resolution, setResolution] = useState('1K');
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(model);

    useEffect(() => {
        if (isOpen) {
            setPrompt('');
            setGeneratedImage(null);
            setError(null);
            setSelectedModel(model);
            setResolution('1K');
            setAspectRatio('9:16');
        }
    }, [isOpen, model]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        if (!apiKey) {
            setError("Vui lòng nhập API Key Gemini.");
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

            // === GEMINI API ONLY ===
            console.log('[Character Gen] 🎨 Using Gemini API...');
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
                const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                onSave(imageUrl);
                console.log('[Character Gen] ✅ Character generated!');
                alert('✅ Character generated successfully!');
            } else {
                setError("AI không trả về ảnh. Thử lại.");
            }

        } catch (err: any) {
            console.error('[Character Gen] ❌ Error:', err);
            setError(err.message || "Lỗi tạo ảnh.");
        } finally {
            setIsGenerating(false);
            if (charId) {
                updateCharacter(charId, { isAnalyzing: false });
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="🎨 Tạo Nhân Vật">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Mô tả nhân vật</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="VD: Cô gái tóc đen dài, mắt nâu, mặc áo dài trắng..."
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none h-24 resize-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Phong cách</label>
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
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Tỉ lệ</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-green-500"
                        >
                            <option value="9:16">9:16 (Portrait)</option>
                            <option value="16:9">16:9 (Landscape)</option>
                            <option value="1:1">1:1 (Square)</option>
                        </select>
                    </div>
                </div>

                <div className="w-full aspect-square bg-gray-950 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden">
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

                <div className="flex space-x-3 pt-2">
                    {!generatedImage ? (
                        <button
                            onClick={() => {
                                if (!prompt.trim()) return;
                                if (charId) updateCharacter(charId, { isAnalyzing: true });
                                onClose();
                                setPrompt('');
                                handleGenerate();
                            }}
                            disabled={isGenerating || !prompt}
                            className="w-full py-3 font-bold text-white rounded-lg bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 shadow-lg"
                        >
                            Tạo Nhân Vật
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleGenerate}
                                className="flex-1 py-3 font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg"
                            >
                                Thử lại
                            </button>
                            <button
                                onClick={() => {
                                    onSave(generatedImage);
                                    onClose();
                                    setGeneratedImage(null);
                                }}
                                className={`flex-[2] py-3 font-bold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} shadow-lg`}
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
