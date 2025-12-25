import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { Character, Product, ScriptPreset } from '../../types';
import { PresetSelector } from '../PresetSelector';
import { createCustomPreset } from '../../utils/scriptPresets';
import { PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER, CREATIVE_PRESETS, GLOBAL_STYLES, SCRIPT_MODELS } from '../../constants/presets';
import { detectCharactersInText } from '../../utils/helpers';

export interface ScriptGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (idea: string, count: number, selectedCharacterIds: string[], selectedProductIds: string[]) => Promise<any>;
    isGenerating: boolean;
    activePresetId: string;
    customPresets: ScriptPreset[];
    onPresetChange: (presetId: string) => void;
    characters: Character[];
    products: Product[];
    customInstruction?: string;
    onCustomInstructionChange?: (val: string) => void;
    onAddPreset: (preset: ScriptPreset) => void;
    onApplyGenerated: (detailedStory: string, groups: any[], scenes: any[]) => void;
    onRegenerateGroup: (detailedStory: string, groupToRegen: any, allGroups: any[], sceneCount?: number) => Promise<any[] | null>;
    onGenerateMoodboard: (groupName: string, groupDesc: string, style?: string, customStyle?: string) => Promise<string | null>;
    scriptModel: string;
    onScriptModelChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onSmartMapAssets: (scenes: any[], characters: Character[], products: Product[]) => Promise<any>;
}

export const ScriptGeneratorModal: React.FC<ScriptGeneratorModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    isGenerating,
    activePresetId,
    customPresets,
    onPresetChange,
    characters,
    products,
    customInstruction,
    onCustomInstructionChange,
    onAddPreset,
    onApplyGenerated,
    onRegenerateGroup,
    onGenerateMoodboard,
    scriptModel,
    onScriptModelChange,
    onSmartMapAssets
}) => {
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [previewData, setPreviewData] = useState<{ detailedStory: string; groups: any[]; scenes: any[] } | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [idea, setIdea] = useState('');
    const [sceneCount, setSceneCount] = useState(5);
    const [isCreatingPreset, setIsCreatingPreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetDesc, setNewPresetDesc] = useState('');
    const [newPresetSystemPrompt, setNewPresetSystemPrompt] = useState('');
    const [newPresetTone, setNewPresetTone] = useState('');
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && characters.length > 0) {
            const defaultChar = characters.find(c => c.isDefault);
            if (defaultChar) setSelectedCharacterIds([defaultChar.id]);
        }
    }, [isOpen, characters]);

    const handlePresetSelect = (id: string) => {
        onPresetChange(id);
    };

    const handleAddPresetLocal = () => {
        if (!newPresetName.trim()) return alert("Vui lòng nhập tên preset.");
        const newPreset = createCustomPreset({
            name: newPresetName,
            category: 'custom',
            description: newPresetDesc,
            icon: '✨',
            systemPrompt: newPresetSystemPrompt,
            outputFormat: {
                hasDialogue: true,
                hasNarration: true,
                hasCameraAngles: true,
                sceneStructure: 'custom'
            },
            toneKeywords: newPresetTone.split(',').map(t => t.trim()),
            sceneGuidelines: '',
            exampleOutput: ''
        });
        onAddPreset(newPreset);
        setIsCreatingPreset(false);
        setNewPresetName('');
        setNewPresetDesc('');
        setNewPresetSystemPrompt('');
        setNewPresetTone('');
    };

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

    const handleSubmit = async () => {
        if (!idea.trim()) return alert("Vui lòng nhập ý tưởng.");
        const result = await onGenerate(idea, sceneCount, selectedCharacterIds, selectedProductIds);
        if (result) {
            setPreviewData(result);
            setStep('review');
        }
    };

    const handleApply = () => {
        if (!previewData) return;
        onApplyGenerated(previewData.detailedStory, previewData.groups, previewData.scenes);
        onClose();
        setIdea('');
    };

    const handleRegenGroupInternal = async (group: any) => {
        if (!previewData) return;

        // Calculate original scene count for this group
        const groupScenes = previewData.scenes.filter(s => s.group_id === group.id);
        const originalCount = groupScenes.length;

        const newScenesForGroup = await onRegenerateGroup(previewData.detailedStory, group, previewData.groups, originalCount);
        if (newScenesForGroup) {
            // Filter out old scenes for this group and add new ones
            const otherScenes = previewData.scenes.filter(s => s.group_id !== group.id);
            setPreviewData({
                ...previewData,
                scenes: [...otherScenes, ...newScenesForGroup].sort((a, b) => parseInt(a.scene_number) - parseInt(b.scene_number))
            });
        }
    };

    const handleSmartAssignAssets = async () => {
        if (!previewData) return;
        setIsScanning(true);

        try {
            const mapping = await onSmartMapAssets(previewData.scenes, characters, products);
            if (mapping) {
                const newScenes = previewData.scenes.map(scene => {
                    const sceneMapping = mapping[scene.scene_number];
                    if (sceneMapping) {
                        return {
                            ...scene,
                            character_ids: [...new Set([...(scene.character_ids || []), ...(sceneMapping.character_ids || [])])],
                            product_ids: [...new Set([...(scene.product_ids || []), ...(sceneMapping.product_ids || [])])]
                        };
                    }
                    return scene;
                });
                setPreviewData({ ...previewData, scenes: newScenes });
                setShowSuccessToast(true);
                setTimeout(() => setShowSuccessToast(false), 3000);
            }
        } catch (error) {
            console.error("Smart assignment failed:", error);
            alert("Gán thông minh thất bại. Vui lòng thử lại.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleGenerateMoodboardLocal = async (groupIdx: number) => {
        if (!previewData) return;
        const group = previewData.groups[groupIdx];
        const imageUrl = await onGenerateMoodboard(
            group.name,
            group.description,
            group.stylePrompt,
            group.customStyleInstruction,
            group.pacing
        );
        if (imageUrl) {
            const newGroups = [...previewData.groups];
            newGroups[groupIdx].conceptImage = imageUrl;
            setPreviewData({ ...previewData, groups: newGroups });
        }
    };

    const handleCopyAllPrompts = () => {
        if (!previewData) return;
        const allPrompts = previewData.scenes
            .map(s => s.visual_context)
            .join('\n\n');

        navigator.clipboard.writeText(allPrompts).then(() => {
            alert("Đã copy toàn bộ prompt vào bộ nhớ tạm!");
        }).catch(err => {
            console.error('Lỗi khi copy:', err);
            alert("Không thể copy. Vui lòng thử lại.");
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={step === 'input' ? "Viết Kịch Bản AI - Cinematic Pro" : "Kiểm tra & Hiệu chỉnh Kịch Bản"} maxWidth="max-w-7xl">
            {step === 'input' ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left Column: Input and Configuration (3/5 width) */}
                    <div className="lg:col-span-3 space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                                📝 Ý tưởng câu chuyện
                            </label>
                            <textarea
                                value={idea}
                                onChange={(e) => setIdea(e.target.value)}
                                placeholder="VD: Một cuộc rượt đuổi nghẹt thở dưới mưa neon, nhân vật chính bị thương và đang lẩn trốn trong một con hẻm chật hẹp..."
                                className="w-full h-48 px-4 py-3 bg-gray-800 border border-brand-green/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent resize-none shadow-inner text-lg"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                ✨ Hướng dẫn bổ sung cho AI (Meta Tokens)
                            </label>
                            <textarea
                                value={customInstruction || ''}
                                onChange={(e) => onCustomInstructionChange?.(e.target.value)}
                                placeholder="VD: Viết theo phong cách hài hước, dồn dập, tập trung vào thoại..."
                                className="w-full h-32 px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500 resize-none"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-300">Số lượng phân cảnh ước lượng:</span>
                                <div className="flex items-center bg-gray-950 rounded-lg p-1 border border-gray-700">
                                    <button onClick={() => setSceneCount(Math.max(1, sceneCount - 1))} className="w-8 h-8 text-gray-400 hover:text-white transition-colors">-</button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={sceneCount}
                                        onChange={(e) => setSceneCount(parseInt(e.target.value) || 1)}
                                        className="w-12 bg-transparent text-center text-white text-sm focus:outline-none [appearance:textfield]"
                                    />
                                    <button onClick={() => setSceneCount(Math.min(50, sceneCount + 1))} className="w-8 h-8 text-gray-400 hover:text-white transition-colors">+</button>
                                </div>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={isGenerating}
                                className={`px-8 py-3 font-bold text-white rounded-xl bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all disabled:opacity-50 flex items-center gap-3 active:scale-95`}
                            >
                                {isGenerating ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Đang phân cảnh...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xl">🎬</span>
                                        <span>Tạo Kịch Bản Điện Ảnh</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Selectors */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Thể loại kịch bản</label>
                            <PresetSelector activePresetId={activePresetId} customPresets={customPresets} onSelect={handlePresetSelect} />
                        </div>

                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3 text-brand-orange">Model AI (Gemini)</label>
                            <select
                                value={scriptModel}
                                onChange={onScriptModelChange}
                                className="w-full bg-gray-950 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange border border-gray-700 appearance-none text-xs"
                            >
                                {SCRIPT_MODELS.map(model => (
                                    <option key={model.value} value={model.value}>{model.label}</option>
                                ))}
                            </select>
                            <p className="text-[9px] text-gray-500 mt-2 italic px-1">Chọn model phù hợp với độ phức tạp của kịch bản.</p>
                        </div>

                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Nhân vật ({selectedCharacterIds.length})</label>
                            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                                {characters.map(char => (
                                    <label key={char.id} className={`flex items-center space-x-2 p-1.5 rounded-lg border cursor-pointer ${selectedCharacterIds.includes(char.id) ? 'bg-green-500/10 border-green-500/50' : 'bg-gray-900/50 border-gray-800'}`}>
                                        <input type="checkbox" checked={selectedCharacterIds.includes(char.id)} onChange={() => toggleCharacter(char.id)} className="w-3 h-3 text-green-500 bg-gray-700" />
                                        <span className="text-[10px] text-gray-300 truncate">{char.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Sản phẩm ({selectedProductIds.length})</label>
                            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                                {products.map(prod => (
                                    <label key={prod.id} className={`flex items-center space-x-2 p-1.5 rounded-lg border cursor-pointer ${selectedProductIds.includes(prod.id) ? 'bg-brand-orange/10 border-brand-orange/50' : 'bg-gray-900/50 border-gray-800'}`}>
                                        <input type="checkbox" checked={selectedProductIds.includes(prod.id)} onChange={() => toggleProduct(prod.id)} className="w-3 h-3 text-brand-orange bg-gray-700" />
                                        <span className="text-[10px] text-gray-300 truncate">{prod.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-[75vh]">
                    <div className="flex-1 overflow-auto pr-2 custom-scrollbar space-y-6">
                        {/* Detailed Story Section */}
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                            <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                📖 Tóm tắt cốt truyện (Detailed Script)
                            </label>
                            <textarea
                                value={previewData?.detailedStory || ''}
                                onChange={(e) => setPreviewData(prev => prev ? { ...prev, detailedStory: e.target.value } : null)}
                                className="w-full h-32 bg-gray-950 border border-gray-800 rounded-lg p-3 text-brand-cream text-sm focus:border-brand-green outline-none resize-none"
                            />
                        </div>

                        {/* Groups & Scenes Review */}
                        <div className="space-y-8">
                            {previewData?.groups.map((group, groupIdx) => {
                                const groupScenes = previewData.scenes.filter(s => s.group_id === group.id);
                                return (
                                    <div key={group.id} className="border border-purple-500/20 rounded-xl overflow-hidden bg-purple-500/5">
                                        <div className="bg-purple-900/20 p-3 flex flex-col md:flex-row md:items-center gap-4 border-b border-purple-500/20">
                                            <div className="flex-1">
                                                <input
                                                    value={group.name}
                                                    onChange={(e) => {
                                                        const newGroups = [...previewData.groups];
                                                        newGroups[groupIdx].name = e.target.value;
                                                        setPreviewData({ ...previewData, groups: newGroups });
                                                    }}
                                                    className="bg-transparent text-purple-300 font-bold text-lg outline-none w-full"
                                                />
                                                <input
                                                    value={group.description}
                                                    onChange={(e) => {
                                                        const newGroups = [...previewData.groups];
                                                        newGroups[groupIdx].description = e.target.value;
                                                        setPreviewData({ ...previewData, groups: newGroups });
                                                    }}
                                                    placeholder="Mô tả bối cảnh..."
                                                    className="bg-transparent text-purple-400/70 text-xs outline-none w-full mt-1 italic"
                                                />

                                                {/* Group Style Selection */}
                                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                                    <select
                                                        value={group.stylePrompt || ''}
                                                        onChange={(e) => {
                                                            const newGroups = [...previewData.groups];
                                                            newGroups[groupIdx].stylePrompt = e.target.value;
                                                            setPreviewData({ ...previewData, groups: newGroups });
                                                        }}
                                                        className="bg-gray-900/50 border border-purple-500/30 rounded px-2 py-1 text-[10px] text-purple-200 outline-none focus:border-purple-500 transition-all"
                                                    >
                                                        <option value="">Cùng style dự án (Mặc định)</option>
                                                        {GLOBAL_STYLES.map(s => (
                                                            <option key={s.value} value={s.value}>{s.label}</option>
                                                        ))}
                                                        <option value="custom">Tùy chỉnh (Custom Prompt)</option>
                                                    </select>

                                                    {group.stylePrompt === 'custom' && (
                                                        <input
                                                            value={group.customStyleInstruction || ''}
                                                            onChange={(e) => {
                                                                const newGroups = [...previewData.groups];
                                                                newGroups[groupIdx].customStyleInstruction = e.target.value;
                                                                setPreviewData({ ...previewData, groups: newGroups });
                                                            }}
                                                            placeholder="Nhập style prompt tùy chỉnh..."
                                                            className="flex-1 min-w-[200px] bg-gray-900/50 border border-purple-500/30 rounded px-2 py-1 text-[10px] text-purple-200 outline-none focus:border-purple-500 transition-all"
                                                        />
                                                    )}
                                                </div>

                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase">Nhịp độ:</span>
                                                    {(['slow', 'medium', 'fast'] as const).map(p => (
                                                        <button
                                                            key={p}
                                                            onClick={() => {
                                                                const newGroups = [...previewData.groups];
                                                                newGroups[groupIdx].pacing = p;
                                                                setPreviewData({ ...previewData, groups: newGroups });
                                                            }}
                                                            className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all border ${group.pacing === p
                                                                ? (p === 'fast' ? 'bg-red-500/20 border-red-500 text-red-300' : p === 'medium' ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-green-500/20 border-green-500 text-green-300')
                                                                : 'bg-gray-900/50 border-gray-800 text-gray-500 hover:border-gray-600'
                                                                }`}
                                                        >
                                                            {p === 'fast' ? '⚡ NHANH' : p === 'medium' ? '⚖️ VỪA' : '🐌 CHẬM'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Time & Weather Consistency Controls */}
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase">⏰ Thời gian:</span>
                                                    <select
                                                        value={group.timeOfDay || ''}
                                                        onChange={(e) => {
                                                            const newGroups = [...previewData.groups];
                                                            newGroups[groupIdx].timeOfDay = e.target.value || undefined;
                                                            setPreviewData({ ...previewData, groups: newGroups });
                                                        }}
                                                        className="bg-gray-900/50 border border-cyan-500/30 rounded px-2 py-0.5 text-[9px] text-cyan-200 outline-none"
                                                    >
                                                        <option value="">Auto</option>
                                                        <option value="dawn">🌅 Bình minh</option>
                                                        <option value="morning">☀️ Sáng</option>
                                                        <option value="noon">🌞 Trưa</option>
                                                        <option value="afternoon">🌤️ Chiều</option>
                                                        <option value="sunset">🌇 Hoàng hôn</option>
                                                        <option value="dusk">🌆 Chạng vạng</option>
                                                        <option value="night">🌙 Đêm</option>
                                                        <option value="custom">✏️ Tùy chỉnh</option>
                                                    </select>
                                                    {group.timeOfDay === 'custom' && (
                                                        <input
                                                            value={group.customTimeOfDay || ''}
                                                            onChange={(e) => {
                                                                const newGroups = [...previewData.groups];
                                                                newGroups[groupIdx].customTimeOfDay = e.target.value;
                                                                setPreviewData({ ...previewData, groups: newGroups });
                                                            }}
                                                            placeholder="VD: 3 giờ sáng..."
                                                            className="bg-gray-900/50 border border-cyan-500/30 rounded px-2 py-0.5 text-[9px] text-cyan-200 outline-none w-24"
                                                        />
                                                    )}

                                                    <span className="text-[9px] font-bold text-gray-500 uppercase ml-2">🌤️ Thời tiết:</span>
                                                    <select
                                                        value={group.weather || ''}
                                                        onChange={(e) => {
                                                            const newGroups = [...previewData.groups];
                                                            newGroups[groupIdx].weather = e.target.value || undefined;
                                                            setPreviewData({ ...previewData, groups: newGroups });
                                                        }}
                                                        className="bg-gray-900/50 border border-amber-500/30 rounded px-2 py-0.5 text-[9px] text-amber-200 outline-none"
                                                    >
                                                        <option value="">Auto</option>
                                                        <option value="clear">☀️ Quang đãng</option>
                                                        <option value="cloudy">⛅ Có mây</option>
                                                        <option value="overcast">☁️ U ám</option>
                                                        <option value="rainy">🌧️ Mưa</option>
                                                        <option value="snowy">❄️ Tuyết</option>
                                                        <option value="foggy">🌫️ Sương mù</option>
                                                        <option value="stormy">⛈️ Giông bão</option>
                                                        <option value="custom">✏️ Tùy chỉnh</option>
                                                    </select>
                                                    {group.weather === 'custom' && (
                                                        <input
                                                            value={group.customWeather || ''}
                                                            onChange={(e) => {
                                                                const newGroups = [...previewData.groups];
                                                                newGroups[groupIdx].customWeather = e.target.value;
                                                                setPreviewData({ ...previewData, groups: newGroups });
                                                            }}
                                                            placeholder="VD: mưa phùn nhẹ..."
                                                            className="bg-gray-900/50 border border-amber-500/30 rounded px-2 py-0.5 text-[9px] text-amber-200 outline-none w-28"
                                                        />
                                                    )}
                                                </div>

                                                {/* Lighting Mood */}
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase">💡 Ánh sáng:</span>
                                                    <input
                                                        value={group.lightingMood || ''}
                                                        onChange={(e) => {
                                                            const newGroups = [...previewData.groups];
                                                            newGroups[groupIdx].lightingMood = e.target.value;
                                                            setPreviewData({ ...previewData, groups: newGroups });
                                                        }}
                                                        placeholder="VD: warm golden hour, cold blue moonlight..."
                                                        className="flex-1 bg-gray-900/50 border border-yellow-500/30 rounded px-2 py-0.5 text-[9px] text-yellow-200 outline-none"
                                                    />
                                                </div>
                                            </div>


                                            <div className="flex flex-col items-center gap-2">
                                                {group.conceptImage ? (
                                                    <div className="relative group/mood">
                                                        <img src={group.conceptImage} alt="Concept Art" className="w-24 h-14 object-cover rounded-lg border border-purple-500/30" />
                                                        <button
                                                            onClick={() => handleGenerateMoodboardLocal(groupIdx)}
                                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover/mood:opacity-100 flex items-center justify-center text-[8px] font-bold text-white transition-all rounded-lg"
                                                        >
                                                            Tạo lại Concept
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleGenerateMoodboardLocal(groupIdx)}
                                                        className="w-24 h-14 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-dashed border-purple-500/30 flex flex-col items-center justify-center text-[8px] font-bold text-purple-300 transition-all gap-1"
                                                    >
                                                        <span>🖼️</span>
                                                        <span>CONCEPT ART</span>
                                                    </button>
                                                )}
                                            </div>

                                            {group.continuity_reference_group_id && (
                                                <div className="text-[10px] text-brand-orange bg-brand-orange/10 px-2 py-1 rounded border border-brand-orange/20 font-bold">
                                                    🔗 THAM CHIẾU: {previewData.groups.find(g => g.id === group.continuity_reference_group_id)?.name || 'N/A'}
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleRegenGroupInternal(group)}
                                                disabled={isGenerating}
                                                className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 rounded-lg text-[10px] font-bold text-purple-200 transition-all border border-purple-500/30 flex items-center gap-2"
                                            >
                                                {isGenerating ? '...' : '🔄 Viết lại nhóm này'}
                                            </button>
                                        </div>

                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {groupScenes.map((scene, sceneIdxInGroup) => (
                                                <div key={scene.scene_number} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 space-y-3">
                                                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                                        <span className="text-xs font-black text-brand-green bg-brand-green/10 px-2 py-0.5 rounded">
                                                            CẢNH {scene.scene_number}
                                                        </span>
                                                        <input
                                                            value={scene.prompt_name}
                                                            onChange={(e) => {
                                                                const newScenes = [...previewData.scenes];
                                                                const globalIdx = newScenes.findIndex(s => s.scene_number === scene.scene_number);
                                                                newScenes[globalIdx].prompt_name = e.target.value;
                                                                setPreviewData({ ...previewData, scenes: newScenes });
                                                            }}
                                                            className="bg-transparent text-gray-300 font-bold text-[10px] text-right outline-none flex-1 ml-2"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Mô tả hình ảnh (AI Prompt)</label>
                                                        <textarea
                                                            value={scene.visual_context}
                                                            onChange={(e) => {
                                                                const newScenes = [...previewData.scenes];
                                                                const globalIdx = newScenes.findIndex(s => s.scene_number === scene.scene_number);
                                                                newScenes[globalIdx].visual_context = e.target.value;
                                                                setPreviewData({ ...previewData, scenes: newScenes });
                                                            }}
                                                            className="w-full h-24 bg-gray-950/50 border border-gray-800 rounded p-2 text-[11px] text-gray-400 outline-none focus:border-brand-orange/50 resize-none"
                                                        />
                                                    </div>

                                                    {/* Character & Product Tags */}
                                                    <div className="flex flex-wrap gap-1">
                                                        {scene.character_ids?.map((cid: string) => {
                                                            const char = characters.find(c => c.id === cid);
                                                            if (!char) return null;
                                                            return (
                                                                <span key={cid} className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                                    👤 {char.name}
                                                                </span>
                                                            );
                                                        })}
                                                        {scene.product_ids?.map((pid: string) => {
                                                            const prod = products.find(p => p.id === pid);
                                                            if (!prod) return null;
                                                            return (
                                                                <span key={pid} className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                                    📦 {prod.name}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>

                                                    {(scene.dialogues?.length > 0 || scene.voiceover) && (
                                                        <div className="bg-gray-950/30 p-2 rounded border border-gray-800/50">
                                                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mb-1 block">Lời thoại / Thuyết minh</label>
                                                            <p className="text-[10px] text-brand-cream/80 italic leading-relaxed">
                                                                {scene.voiceover || scene.dialogues?.[0]?.line || '...'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-800 flex justify-between items-center bg-brand-dark/50 p-4 -m-4 rounded-b-xl backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setStep('input')}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium text-gray-300 transition-all border border-gray-700"
                            >
                                Quay lại sửa yêu cầu
                            </button>
                            <div className="relative flex items-center gap-2">
                                <button
                                    onClick={handleSmartAssignAssets}
                                    disabled={isScanning}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border flex items-center gap-2 ${isScanning
                                        ? 'bg-purple-600/10 border-purple-500/20 text-purple-400 cursor-not-allowed'
                                        : 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500/30 text-purple-200 shadow-lg shadow-purple-500/10'
                                        }`}
                                    title="Tự động nhận diện nhân vật & sản phẩm từ ngữ cảnh"
                                >
                                    <span className={`w-2 h-2 bg-purple-500 rounded-full ${isScanning ? 'animate-ping' : 'animate-pulse'}`}></span>
                                    {isScanning ? 'Đang phân tích ngữ cảnh...' : 'Gán nhân vật & Sản phẩm (Smart)'}
                                </button>
                                {showSuccessToast && (
                                    <span className="absolute left-0 -top-10 whitespace-nowrap bg-brand-green text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-brand-green/20 shadow-xl animate-bounce-in flex items-center gap-1">
                                        ✨ Đã gán xong Nhân vật & Sản phẩm!
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleCopyAllPrompts}
                                className="px-6 py-2 text-sm font-bold text-brand-orange border border-brand-orange/30 rounded-lg hover:bg-brand-orange/10 transition-all flex items-center gap-2"
                                title="Copy toàn bộ visual prompts cách nhau một dòng"
                            >
                                📋 Copy All Prompts
                            </button>
                            <button
                                onClick={() => handleSubmit()}
                                className="px-6 py-2 text-sm font-bold text-brand-green border border-brand-green/30 rounded-lg hover:bg-brand-green/10 transition-all flex items-center gap-2"
                            >
                                🔄 Tạo lại lần nữa
                            </button>
                            <button
                                onClick={handleApply}
                                className={`px-10 py-2 font-bold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all shadow-lg active:scale-95`}
                            >
                                ✅ Áp dụng vào Scene Map
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
