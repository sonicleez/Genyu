import React from 'react';
import { SectionTitle } from '../common/SectionTitle';
import { GLOBAL_STYLES, IMAGE_MODELS, ASPECT_RATIOS, CAMERA_MODELS, LENS_OPTIONS } from '../../constants/presets';

interface StyleSettingsSectionProps {
    stylePrompt: string;
    onStylePromptChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    customStyleInstruction: string;
    onCustomStyleInstructionChange: (val: string) => void;
    imageModel: string;
    onImageModelChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    resolution: string;
    onResolutionChange: (val: string) => void;
    aspectRatio: string;
    onAspectRatioChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    scriptLanguage: string;
    onScriptLanguageChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    customScriptLanguage: string;
    onCustomScriptLanguageChange: (val: string) => void;
    cameraModel: string;
    onCameraModelChange: (val: string) => void;
    customCameraModel: string;
    onCustomCameraModelChange: (val: string) => void;
    defaultLens: string;
    onDefaultLensChange: (val: string) => void;
    customDefaultLens: string;
    onCustomDefaultLensChange: (val: string) => void;
    customMetaTokens: string;
    onCustomMetaTokensChange: (val: string) => void;
    onOpenScriptGenerator: () => void;
    isScriptGenerating: boolean;
    onTriggerFileUpload: () => void;
    onAnalyzeStyleFromImage?: (image: string) => Promise<void>;
    isAnalyzingStyle?: boolean;
    isContinuityMode: boolean;
    toggleContinuityMode: () => void;
    isOutfitLockMode: boolean;
    toggleOutfitLockMode: () => void;
    onOpenManualScript?: () => void; // NEW: Open Manual Script Import modal
}


export const StyleSettingsSection: React.FC<StyleSettingsSectionProps> = ({
    stylePrompt,
    onStylePromptChange,
    customStyleInstruction,
    onCustomStyleInstructionChange,
    imageModel,
    onImageModelChange,
    resolution,
    onResolutionChange,
    aspectRatio,
    onAspectRatioChange,
    scriptLanguage,
    onScriptLanguageChange,
    customScriptLanguage,
    onCustomScriptLanguageChange,
    cameraModel,
    onCameraModelChange,
    customCameraModel,
    onCustomCameraModelChange,
    defaultLens,
    onDefaultLensChange,
    customDefaultLens,
    onCustomDefaultLensChange,
    customMetaTokens,
    onCustomMetaTokensChange,
    onOpenScriptGenerator,
    isScriptGenerating,
    onTriggerFileUpload,
    onAnalyzeStyleFromImage,
    isAnalyzingStyle,
    isContinuityMode,
    toggleContinuityMode,
    isOutfitLockMode,
    toggleOutfitLockMode,
    onOpenManualScript
}) => {

    const handleStyleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onAnalyzeStyleFromImage) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            onAnalyzeStyleFromImage(reader.result as string);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };


    return (
        <div className="my-16 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
            <SectionTitle>Your Styles</SectionTitle>
            <div className="grid md:grid-cols-3 gap-6 items-start">
                <div className="md:col-span-2 space-y-4">
                    {/* Row 1: Global Style + Model Images */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Phong cách Tổng thể (Global Style)</label>
                            <select
                                value={stylePrompt}
                                onChange={onStylePromptChange}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 appearance-none"
                            >
                                {GLOBAL_STYLES.map(style => (
                                    <option key={style.value} value={style.value}>{style.label}</option>
                                ))}
                                <option value="custom" className="text-brand-orange font-bold">+ Custom Style (Tự nhập Prompt)...</option>
                            </select>
                            {stylePrompt === 'custom' && (
                                <div className="mt-2 animate-fadeIn space-y-2">
                                    <textarea
                                        value={customStyleInstruction}
                                        onChange={e => onCustomStyleInstructionChange(e.target.value)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        placeholder="Nhập mô tả phong cách, ánh sáng, màu sắc (VD: Cyberpunk city, neon lights, rain, high contrast, 8k masterpiece...)"
                                        className="w-full bg-gray-900/80 text-white px-3 py-2 rounded-md border border-brand-orange text-xs focus:outline-none min-h-[80px]"
                                    />
                                    {onAnalyzeStyleFromImage && (
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleStyleImageUpload}
                                                className="hidden"
                                                id="style-image-upload"
                                            />
                                            <label
                                                htmlFor="style-image-upload"
                                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md text-center cursor-pointer transition-all ${isAnalyzingStyle
                                                    ? 'bg-purple-600/50 text-gray-300 cursor-wait'
                                                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                                                    }`}
                                            >
                                                {isAnalyzingStyle ? (
                                                    <span className="flex items-center justify-center space-x-2">
                                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        <span>Đang phân tích...</span>
                                                    </span>
                                                ) : (
                                                    <span>📷 Upload ảnh để phân tích Style</span>
                                                )}
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Model Images</label>
                            <select
                                value={imageModel}
                                onChange={onImageModelChange}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 appearance-none"
                            >
                                {IMAGE_MODELS.map(model => (
                                    <option key={model.value} value={model.value}>{model.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Resolution + Aspect Ratio + Script Language */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Độ phân giải (Resolution)</label>
                            <select
                                value={resolution || '1K'}
                                onChange={(e) => onResolutionChange(e.target.value)}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600 appearance-none"
                            >
                                <option value="1K">1K (Standard) - Gemini</option>
                                <option value="2K">2K (High Res) - Google Pro Only</option>
                                <option value="4K">4K (Ultra) - Google Pro Only</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Tỷ lệ ảnh (Aspect Ratio)</label>
                            <select
                                value={aspectRatio}
                                onChange={onAspectRatioChange}
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
                                value={scriptLanguage}
                                onChange={onScriptLanguageChange}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-600"
                            >
                                <option value="vietnamese">Tiếng Việt</option>
                                <option value="language1">Tiếng Anh (Default)</option>
                                <option value="custom" className="text-brand-orange font-bold">+ Custom Language...</option>
                            </select>
                            {scriptLanguage === 'custom' && (
                                <div className="mt-2 animate-fadeIn">
                                    <input
                                        type="text"
                                        value={customScriptLanguage}
                                        onChange={e => onCustomScriptLanguageChange(e.target.value)}
                                        placeholder="Nhập tên ngôn ngữ (VD: French, Japanese, Spanish...)"
                                        className="w-full bg-gray-900/80 text-white px-3 py-2 rounded-md border border-brand-orange text-xs focus:outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* === CINEMATOGRAPHY SETTINGS (NEW) === */}
                    <div className="mt-4 pt-4 border-t border-gray-600">
                        {/* Continuity Controls */}
                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-800">
                            <button
                                onClick={toggleContinuityMode}
                                className={`flex flex-col items-start p-3 rounded-xl border transition-all ${isContinuityMode ? 'bg-purple-500/10 border-purple-500/50' : 'bg-gray-900/50 border-gray-800 hober:border-gray-700'}`}
                            >
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isContinuityMode ? 'text-purple-400' : 'text-gray-500'}`}>Shot Continuity</span>
                                <span className="text-xs font-bold text-gray-200 mt-1">{isContinuityMode ? 'On: Multi-Shot Lock' : 'Off: Independent'}</span>
                            </button>

                            <button
                                onClick={toggleOutfitLockMode}
                                className={`flex flex-col items-start p-3 rounded-xl border transition-all ${isOutfitLockMode ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}
                            >
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isOutfitLockMode ? 'text-blue-400' : 'text-gray-500'}`}>Outfit Lock (Clothes)</span>
                                <span className="text-xs font-bold text-gray-200 mt-1">{isOutfitLockMode ? 'On: Strict Outfit' : 'Off: Flexible'}</span>
                            </button>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-semibold text-brand-orange">📹 Cinematography</span>
                            <span className="text-[10px] text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">Pro Settings</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Camera Body</label>
                                <select
                                    value={cameraModel || 'auto'}
                                    onChange={(e) => onCameraModelChange(e.target.value)}
                                    className="w-full bg-gray-700 text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange border border-gray-600 appearance-none"
                                >
                                    {CAMERA_MODELS.map(cam => (
                                        <option key={cam.value} value={cam.value}>{cam.label}</option>
                                    ))}
                                    <option value="custom" className="text-brand-orange font-bold">+ Custom Camera...</option>
                                </select>
                                {cameraModel === 'custom' && (
                                    <div className="mt-1 animate-fadeIn">
                                        <input
                                            type="text"
                                            value={customCameraModel}
                                            onChange={e => onCustomCameraModelChange(e.target.value)}
                                            placeholder="VD: IMAX 70mm, GoPro Hero 11..."
                                            className="w-full bg-gray-900/80 text-white px-2 py-1.5 rounded border border-brand-orange text-[10px] focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Default Lens</label>
                                <select
                                    value={defaultLens || 'auto'}
                                    onChange={(e) => onDefaultLensChange(e.target.value)}
                                    className="w-full bg-gray-700 text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange border border-gray-600 appearance-none"
                                >
                                    {LENS_OPTIONS.map(lens => (
                                        <option key={lens.value} value={lens.value}>{lens.label}</option>
                                    ))}
                                    <option value="custom" className="text-brand-orange font-bold">+ Custom Lens...</option>
                                </select>
                                {defaultLens === 'custom' && (
                                    <div className="mt-1 animate-fadeIn">
                                        <input
                                            type="text"
                                            value={customDefaultLens}
                                            onChange={e => onCustomDefaultLensChange(e.target.value)}
                                            placeholder="VD: 70-200mm f/2.8, Fisheye 8mm..."
                                            className="w-full bg-gray-900/80 text-white px-2 py-1.5 rounded border border-brand-orange text-[10px] focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">
                                Meta Tokens <span className="text-gray-500">(để trống = AI tự thêm creative tokens)</span>
                            </label>
                            <input
                                type="text"
                                value={customMetaTokens}
                                onChange={(e) => onCustomMetaTokensChange(e.target.value)}
                                placeholder="VD: cinematic lighting, film grain, shallow depth of field..."
                                className="w-full bg-gray-900 text-white px-2 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange border border-gray-600 placeholder-gray-600"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center h-full space-y-3">
                    <div className="w-full">
                        <button
                            onClick={onOpenScriptGenerator}
                            disabled={isScriptGenerating}
                            className={`w-full px-6 py-4 font-semibold text-white rounded-lg transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center ${isScriptGenerating
                                ? 'bg-blue-600/50 cursor-wait'
                                : 'bg-gradient-to-r from-blue-500 to-blue-300 hover:from-blue-400 hover:to-blue-200 shadow-lg shadow-blue-500/20'
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
                        <button
                            onClick={onOpenManualScript || onTriggerFileUpload}
                            className={`w-full px-6 py-2 font-semibold text-white rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-violet-700/20`}
                        >
                            📝 Manual Script
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
