import React, { useRef, useState, useEffect } from 'react';
import { GripVertical, Copy, Download, Layers, Play, Plus, RefreshCw, Trash, User, Box, Sparkles, Wand2, Image as ImageIcon } from 'lucide-react';
import { Scene, Character, Product } from '../../types';

const LiveTimer: React.FC<{ startTime: number }> = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 100);
        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <span className="font-bold text-yellow-400">
            {(elapsed / 1000).toFixed(1)}s
        </span>
    );
};
import { ExpandableTextarea } from '../common/ExpandableTextarea';
import { CAMERA_ANGLES, LENS_OPTIONS, TRANSITION_TYPES, VEO_MODES, VEO_PRESETS } from '../../constants/presets';

// Preset angles for Insert Angles feature
const INSERT_ANGLE_OPTIONS = [
    { value: 'wide_shot', label: 'Wide Shot (WS)' },
    { value: 'medium_shot', label: 'Medium Shot (MS)' },
    { value: 'close_up', label: 'Close Up (CU)' },
    { value: 'extreme_close_up', label: 'Extreme Close Up (ECU)' },
    { value: 'low_angle', label: 'Low Angle (Worm Eye)' },
    { value: 'high_angle', label: 'High Angle (Bird Eye)' },
    { value: 'over_shoulder', label: 'Over The Shoulder (OTS)' },
    { value: 'dutch_angle', label: 'Dutch Angle (Tilted)' },
    { value: 'custom', label: '📝 Tùy chỉnh (Nhập prompt)...' },
];

export interface SceneRowProps {
    scene: Scene;
    scenes: Scene[];
    index: number;
    characters: Character[];
    products: Product[];
    sceneGroups: any[];
    updateScene: (id: string, updates: Partial<Scene>) => void;
    assignSceneToGroup: (sceneId: string, groupId: string | undefined) => void;
    removeScene: (id: string) => void;
    generateImage: () => void;
    generateEndFrame: () => void;
    openImageViewer: () => void;
    onDragStart: (index: number) => void;
    onDragOver: (index: number) => void;
    onDrop: (index: number) => void;
    generateVeoPrompt: (sceneId: string) => void;
    onCopyPreviousStyle?: () => void;
    onInsertAngles?: (sceneId: string, selections: { value: string; customPrompt?: string }[], sourceImage: string) => void;
    onExpandScene?: (sceneId: string) => void;
    isExpandingSequence?: boolean;
    scriptLanguage?: string; // 'vietnamese' | 'language1' | 'custom'
    customScriptLanguage?: string;
}

export const SceneRow: React.FC<SceneRowProps> = ({
    scene, scenes, index, characters, products, sceneGroups, updateScene, assignSceneToGroup, removeScene,
    generateImage, generateEndFrame, openImageViewer,
    onDragStart, onDragOver, onDrop,
    generateVeoPrompt,
    onCopyPreviousStyle,
    onInsertAngles,
    onExpandScene,
    isExpandingSequence,
    scriptLanguage = 'vietnamese',
    customScriptLanguage
}) => {
    const endFrameInputRef = useRef<HTMLInputElement>(null);
    const [showAnglesDropdown, setShowAnglesDropdown] = useState(false);
    const [showScenePicker, setShowScenePicker] = useState(false);
    const [selectedAngles, setSelectedAngles] = useState<string[]>([]);
    const [customAnglePrompt, setCustomAnglePrompt] = useState('');
    const [showSecondaryLang, setShowSecondaryLang] = useState(false);


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

    // Download image with sequential numbering (001, 002, 003...)
    const handleDownloadImage = () => {
        if (!scene.generatedImage) return;

        const paddedNumber = String(index + 1).padStart(3, '0');
        const fileName = `${paddedNumber}.png`;

        const link = document.createElement('a');
        link.href = scene.generatedImage;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
        <div
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
            onDrop={() => onDrop(index)}
            className={`grid md:grid-cols-12 gap-4 items-start bg-gray-800/30 p-4 rounded-lg border transition-all group/row relative overflow-visible ${index === (window as any).dragOverIndex ? 'border-brand-orange bg-brand-orange/10 scale-[1.01] shadow-2xl z-10' : 'border-gray-700 hover:border-gray-500'
                }`}
        >
            {/* Drag Handle */}
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-gray-600 hover:text-brand-orange opacity-0 group-hover/row:opacity-100 transition-all p-2">
                <GripVertical size={20} />
            </div>

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
                <div className="pt-2 w-full">
                    <select
                        value={scene.groupId || ''}
                        onChange={(e) => assignSceneToGroup(scene.id, e.target.value || undefined)}
                        className="w-full bg-gray-900 border border-purple-900/30 rounded p-1 text-[9px] text-purple-400 focus:border-purple-500 font-bold uppercase tracking-wider text-center"
                        title="Assign to Group"
                    >
                        <option value="">No Group</option>
                        {sceneGroups?.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Script */}
            <div className="md:col-span-2 space-y-2">
                {(scene.voiceOverText || scene.isVOScene) && (
                    <div className="relative group/vo">
                        <ExpandableTextarea
                            value={scene.voiceOverText || ''}
                            onChange={(val) => updateScene(scene.id, { voiceOverText: val })}
                            placeholder="Voice Over (Lời bình)..."
                            rows={2}
                            className="w-full bg-violet-900/20 border border-violet-500/30 rounded p-2 text-xs text-violet-100 placeholder-violet-500/50 focus:border-violet-500 resize-none font-medium pr-8"
                            title="Voice Over Script (AI/Manual)"
                        />
                        {/* Expand Sequence Button */}
                        {onExpandScene && (scene.voiceOverText && scene.voiceOverText.length > 50) && (
                            <button
                                onClick={() => onExpandScene(scene.id)}
                                disabled={isExpandingSequence}
                                className="absolute right-1 top-1 p-1 text-violet-400 hover:text-white hover:bg-violet-500 rounded transition-all opacity-0 group-hover/vo:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="✨ Expand Sequence: AI will split this long VO into multiple visual shots"
                            >
                                {isExpandingSequence ? (
                                    <div className="w-3 h-3 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Sparkles size={12} />
                                )}
                            </button>
                        )}
                    </div>
                )}
                {/* Primary Script Field - Dynamic based on scriptLanguage */}
                <div className="relative">
                    <ExpandableTextarea
                        value={scriptLanguage === 'vietnamese' ? scene.vietnamese : scene.language1}
                        onChange={(val) => updateScene(scene.id, scriptLanguage === 'vietnamese' ? { vietnamese: val } : { language1: val })}
                        placeholder={`Script (${scriptLanguage === 'vietnamese' ? 'Việt' : scriptLanguage === 'custom' ? (customScriptLanguage || 'Custom') : 'EN'})...`}
                        rows={scene.voiceOverText ? 2 : 3}
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-white focus:border-green-500 resize-none"
                        title={scriptLanguage === 'vietnamese' ? 'Lời thoại Tiếng Việt' : scriptLanguage === 'custom' ? (customScriptLanguage || 'Custom Language') : 'English Script'}
                    />
                    <div className="absolute -top-2 right-2 flex gap-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${scriptLanguage === 'vietnamese' ? 'bg-red-500/20 text-red-400' : scriptLanguage === 'custom' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {scriptLanguage === 'vietnamese' ? '🇻🇳' : scriptLanguage === 'custom' ? '🌐' : '🇺🇸'} {scriptLanguage === 'custom' ? (customScriptLanguage || 'Custom') : (scriptLanguage === 'vietnamese' ? 'VN' : 'EN')}
                        </span>
                    </div>
                </div>

                {/* Toggle Secondary Language */}
                <button
                    onClick={() => setShowSecondaryLang(!showSecondaryLang)}
                    className="text-[9px] text-gray-500 hover:text-brand-orange flex items-center gap-1 py-0.5"
                >
                    {showSecondaryLang ? '− Ẩn' : '+'} {scriptLanguage === 'vietnamese' ? 'English' : 'Tiếng Việt'}
                </button>

                {/* Secondary Script Field (hidden by default) */}
                {showSecondaryLang && (
                    <ExpandableTextarea
                        value={scriptLanguage === 'vietnamese' ? scene.language1 : scene.vietnamese}
                        onChange={(val) => updateScene(scene.id, scriptLanguage === 'vietnamese' ? { language1: val } : { vietnamese: val })}
                        placeholder={scriptLanguage === 'vietnamese' ? 'English script...' : 'Lời thoại (Việt)...'}
                        rows={2}
                        className="w-full bg-gray-900/50 border border-gray-700/50 rounded p-2 text-xs text-gray-400 focus:border-green-500 resize-none"
                        title={scriptLanguage === 'vietnamese' ? 'English Script (Secondary)' : 'Vietnamese (Secondary)'}
                    />
                )}
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
                <div className="space-y-1.5 bg-gray-900/60 p-2 rounded border border-gray-700/50">
                    <div className="flex items-center justify-between mb-1">
                        <div className="text-[9px] text-gray-500 font-semibold">📹 Cinematography</div>
                        {index > 0 && onCopyPreviousStyle && (
                            <button
                                onClick={onCopyPreviousStyle}
                                className="text-[8px] flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-brand-orange px-1.5 py-0.5 rounded border border-gray-700 transition-all uppercase font-black tracking-tighter"
                                title="Copy camera settings from previous scene"
                            >
                                <Copy size={8} /> Copy Previous
                            </button>
                        )}
                    </div>
                    <select
                        value={scene.cameraAngleOverride || ''}
                        onChange={(e) => updateScene(scene.id, { cameraAngleOverride: e.target.value })}
                        className="w-full bg-gray-800 text-[11px] text-gray-300 border border-gray-600 rounded px-2 py-1.5 focus:border-brand-orange"
                        title="Camera Angle"
                    >
                        {CAMERA_ANGLES.map(angle => (
                            <option key={angle.value} value={angle.value}>🎬 {angle.label}</option>
                        ))}
                        <option value="custom" className="text-brand-orange font-bold">+ Tùy chỉnh (Shot/Angle)...</option>
                    </select>

                    {scene.cameraAngleOverride === 'custom' && (
                        <input
                            type="text"
                            value={scene.customCameraAngle || ''}
                            onChange={(e) => updateScene(scene.id, { customCameraAngle: e.target.value })}
                            placeholder="Nhập Shot Type (VD: Bird's Eye, Drone...)"
                            className="w-full bg-gray-900 border border-brand-orange rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                        />
                    )}

                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col space-y-1">
                            <select
                                value={scene.lensOverride || ''}
                                onChange={(e) => updateScene(scene.id, { lensOverride: e.target.value })}
                                className="w-full bg-gray-800 text-[11px] text-gray-300 border border-gray-600 rounded px-2 py-1 focus:border-brand-orange"
                                title="Lens"
                            >
                                {LENS_OPTIONS.map(lens => (
                                    <option key={lens.value} value={lens.value}>🔭 {lens.label}</option>
                                ))}
                                <option value="custom" className="text-brand-orange font-bold">+ Custom...</option>
                            </select>
                            {scene.lensOverride === 'custom' && (
                                <input
                                    type="text"
                                    value={scene.customLensOverride || ''}
                                    onChange={(e) => updateScene(scene.id, { customLensOverride: e.target.value })}
                                    placeholder="Lens..."
                                    className="w-full bg-gray-900 border border-brand-orange rounded px-1 py-0.5 text-[9px] text-white focus:outline-none"
                                />
                            )}
                        </div>
                        <div className="flex flex-col space-y-1">
                            <select
                                value={scene.transitionType || ''}
                                onChange={(e) => updateScene(scene.id, { transitionType: e.target.value })}
                                className="w-full bg-gray-800 text-[11px] text-gray-300 border border-gray-600 rounded px-2 py-1 focus:border-brand-orange"
                                title="Transition"
                            >
                                {TRANSITION_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>✂️ {t.label}</option>
                                ))}
                                <option value="custom" className="text-brand-orange font-bold">+ Custom...</option>
                            </select>
                            {scene.transitionType === 'custom' && (
                                <input
                                    type="text"
                                    value={scene.customTransitionType || ''}
                                    onChange={(e) => updateScene(scene.id, { customTransitionType: e.target.value })}
                                    placeholder="Trans..."
                                    className="w-full bg-gray-900 border border-brand-orange rounded px-1 py-0.5 text-[9px] text-white focus:outline-none"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="md:col-span-3 h-full space-y-2">
                <div className="flex items-center justify-between">
                    <select
                        value={scene.veoPreset || 'cinematic'}
                        onChange={(e) => updateScene(scene.id, { veoPreset: e.target.value })}
                        className="bg-gray-900 border border-blue-900/40 rounded px-2 py-1 text-[10px] text-blue-300 outline-none focus:border-blue-500 transition-all font-bold"
                        title="Veo Motion Preset"
                    >
                        {VEO_PRESETS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => generateVeoPrompt(scene.id)}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                        title="Tạo lại Veo Prompt"
                    >
                        <span>🔄 Gen</span>
                    </button>
                </div>
                <ExpandableTextarea
                    value={scene.veoPrompt}
                    onChange={(val) => updateScene(scene.id, { veoPrompt: val })}
                    placeholder="(00:00-00:05) Prompt cho Google Veo..."
                    rows={6}
                    className="w-full h-[130px] bg-gray-900 border border-blue-900/30 rounded p-2 text-[11px] text-blue-200 focus:border-blue-500 font-mono resize-none leading-relaxed"
                    title="Veo Video Prompt"
                />
            </div>

            {/* Characters & Products */}
            <div className="md:col-span-1 h-[160px] flex flex-col space-y-1 overflow-hidden">
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
            <div className="md:col-span-3 flex flex-col space-y-2 relative">
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

                <div className="flex gap-2">
                    <div
                        className={`relative flex-1 aspect-video bg-black rounded border overflow-hidden group cursor-pointer transition-colors ${scene.imageRole === 'start-frame' ? 'border-green-500' :
                            scene.imageRole === 'end-frame' ? 'border-red-500' : 'border-gray-600 hover:border-green-500'
                            }`}
                        onClick={() => scene.generatedImage && openImageViewer()}
                    >
                        {scene.generatedImage && (
                            <div className="absolute top-1 left-1 z-20 flex items-center gap-1">
                                {scene.generationDuration && (
                                    <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-yellow-400 backdrop-blur-sm border border-yellow-500/30 flex items-center gap-0.5" title="Execution Time">
                                        ⚡ {(scene.generationDuration / 1000).toFixed(1)}s
                                    </div>
                                )}
                                <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${scene.imageRole === 'start-frame' ? 'bg-green-600 text-white' :
                                    scene.imageRole === 'end-frame' ? 'bg-red-600 text-white' :
                                        'bg-gray-700 text-gray-300'
                                    }`}>
                                    {scene.imageRole === 'start-frame' ? '🟢 START' :
                                        scene.imageRole === 'end-frame' ? '🔴 END' : '📷'}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDownloadImage(); }}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 transition-colors"
                                    title={`Download as ${String(index + 1).padStart(3, '0')}.png`}
                                >
                                    <Download size={10} /> {String(index + 1).padStart(3, '0')}
                                </button>
                            </div>
                        )}


                        {scene.isGenerating && !scene.videoStatus ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10 backdrop-blur-[1px]">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2 shadow-[0_0_15px_rgba(34,197,94,0.4)]"></div>
                                <div className="text-[10px] text-green-400 font-mono flex flex-col items-center gap-1">
                                    <span className="tracking-widest animate-pulse">RENDERING</span>
                                    {scene.generationStartTime && (
                                        <div className="bg-black/40 px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
                                            ⏱ <LiveTimer startTime={scene.generationStartTime} />
                                        </div>
                                    )}
                                </div>
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

                    {scene.veoMode === 'start-end-frame' && (
                        <div className="relative w-28 aspect-video bg-black rounded border border-red-500/50 overflow-hidden group/end hover:border-red-500 transition-colors">
                            <input
                                ref={endFrameInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleEndFrameUpload}
                                className="hidden"
                            />

                            <div className="absolute top-1 left-1 z-20 px-1 py-0.5 rounded text-[7px] font-bold bg-red-600 text-white">
                                🔴 END
                            </div>

                            {scene.endFrameImage ? (
                                <>
                                    <img src={scene.endFrameImage} alt="End Frame" className="w-full h-full object-cover" />
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

                {/* NEW: Prop Reference Slot */}
                <div className="flex gap-2 mt-1 px-1">
                    <div className={`flex-1 h-20 relative rounded border border-dashed flex items-center transition-all ${scene.referenceImage ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700 bg-gray-900/30'}`}>
                        <div className="absolute -top-2 left-2 px-1 bg-gray-950 z-10 flex items-center gap-1 border border-gray-800 rounded">
                            <span className="text-[8px] text-blue-400 font-bold uppercase tracking-wider">🔗 Mỏ neo tham chiếu (Prop Anchor)</span>
                            {scene.referenceImage && (
                                <button
                                    onClick={() => updateScene(scene.id, { referenceImage: null, referenceImageDescription: '' })}
                                    className="text-[9px] text-red-500 hover:text-red-400 font-bold px-1"
                                >✕</button>
                            )}
                        </div>

                        {scene.referenceImage ? (
                            <div className="flex w-full h-full p-1.5 gap-2 items-center">
                                <div className="w-16 h-full rounded border border-blue-500/50 overflow-hidden shrink-0 group/ref relative shadow-lg">
                                    <img src={scene.referenceImage} alt="Ref" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/ref:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => window.open(scene.referenceImage!, '_blank')}>
                                        <span className="text-white text-[8px] font-bold">🔍 Xem</span>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                    <input
                                        type="text"
                                        value={scene.referenceImageDescription || ''}
                                        placeholder="Ghim vật thể: chảo, cá, ghế..."
                                        className="w-full bg-blue-950/40 border-none text-[10px] text-blue-100 px-2 py-1 rounded outline-none font-medium placeholder:text-blue-900/30"
                                        onChange={(e) => updateScene(scene.id, { referenceImageDescription: e.target.value })}
                                    />
                                    <p className="text-[8px] text-blue-500/70 leading-tight italic">
                                        AI sẽ lấy mẫu đúng hình dáng vật thể này.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center gap-4 py-2">
                                <button
                                    onClick={() => setShowScenePicker(!showScenePicker)}
                                    className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/20 text-[10px] font-black flex items-center gap-2 transition-all shadow-lg active:scale-95"
                                >
                                    <ImageIcon size={12} />
                                    Chọn mỏ neo sẵn có
                                </button>
                                <span className="text-[8px] text-gray-600 italic max-w-[130px] leading-tight text-center">Tái sử dụng ảnh đã tạo để giữ đạo cụ đồng nhất.</span>
                            </div>
                        )}

                        {/* Scene Picker Popover */}
                        {showScenePicker && (
                            <div className="absolute bottom-full left-0 mb-4 w-72 bg-gray-950 border border-blue-500/50 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[200] p-3 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 backdrop-blur-xl">
                                <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                        <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Kho ảnh (Scene Picker)</span>
                                    </div>
                                    <button onClick={() => setShowScenePicker(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1 custom-scrollbar">
                                    {scenes.filter(s => s.generatedImage && s.id !== scene.id).length > 0 ? (
                                        scenes.filter(s => s.generatedImage && s.id !== scene.id).map((s) => (
                                            <div
                                                key={s.id}
                                                className="aspect-video relative rounded-lg cursor-pointer group/picker border-2 border-transparent hover:border-blue-500 transition-all duration-200 shadow-lg hover:z-[210]"
                                                onClick={() => {
                                                    updateScene(scene.id, { referenceImage: s.generatedImage });
                                                    setShowScenePicker(false);
                                                }}
                                            >
                                                <div className="w-full h-full rounded-md overflow-hidden transition-transform duration-300 group-hover/picker:scale-[2.2] group-hover/picker:shadow-2xl group-hover/picker:ring-2 group-hover/picker:ring-blue-500">
                                                    <img src={s.generatedImage!} alt="Pick" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[8px] font-black px-1.5 rounded shadow-lg z-10">
                                                    SC {scenes.findIndex(os => os.id === s.id) + 1}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-3 py-8 text-center bg-black/20 rounded-lg">
                                            <p className="text-[10px] text-gray-600 font-bold italic mb-1">Kho ảnh trống</p>
                                            <p className="text-[8px] text-gray-700">Hãy tạo ảnh cho các cảnh khác trước.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Video Generation Display */}
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

                {scene.error && (
                    <div className="bg-red-900/90 p-2 text-center rounded mt-1">
                        <span className="text-white text-xs">{scene.error}</span>
                    </div>
                )}

                {/* Button Row: Generate Image + Insert Angles */}
                <div className="flex gap-1.5 mt-auto">
                    <button
                        onClick={generateImage}
                        disabled={scene.isGenerating}
                        className={`flex-1 py-1.5 font-bold text-[10px] rounded shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-1
                            ${scene.generatedImage
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {scene.generatedImage ? (
                            <><span>↻</span><span>Tạo Lại</span></>
                        ) : (
                            <><span>✨</span><span>Tạo Ảnh</span></>
                        )}
                    </button>

                    {/* Insert Angles Button */}
                    {scene.generatedImage && onInsertAngles && (
                        <div className="relative">
                            <button
                                onClick={() => setShowAnglesDropdown(!showAnglesDropdown)}
                                disabled={scene.isGenerating}
                                className="px-2 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] rounded shadow-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                title="Tạo thêm góc máy từ ảnh này"
                            >
                                <Layers size={12} />
                                <span>+Góc</span>
                            </button>

                            {/* Angles Dropdown */}
                            {showAnglesDropdown && (
                                <div className="absolute right-0 bottom-full mb-1 w-56 bg-gray-900 border border-purple-500 rounded-lg shadow-xl z-50 p-2">
                                    <div className="text-[9px] text-purple-300 font-bold mb-1.5 uppercase tracking-wider">Chọn góc máy cần tạo</div>
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {INSERT_ANGLE_OPTIONS.map(angle => (
                                            <label key={angle.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAngles.includes(angle.value)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedAngles([...selectedAngles, angle.value]);
                                                        } else {
                                                            setSelectedAngles(selectedAngles.filter(a => a !== angle.value));
                                                        }
                                                    }}
                                                    className="w-3 h-3 accent-purple-500"
                                                />
                                                <span className="text-[10px] text-gray-300">{angle.label}</span>
                                            </label>
                                        ))}
                                    </div>

                                    {/* Custom Prompt Input */}
                                    {selectedAngles.includes('custom') && (
                                        <div className="mt-2 pt-2 border-t border-purple-500/30">
                                            <label className="block text-[8px] font-bold text-purple-400 mb-1 uppercase">Mô tả góc máy tùy chỉnh</label>
                                            <textarea
                                                value={customAnglePrompt}
                                                onChange={(e) => setCustomAnglePrompt(e.target.value)}
                                                placeholder="VD: Góc nhìn từ chân nhân vật lên, hoặc nhìn qua khe cửa..."
                                                className="w-full h-16 bg-gray-950 border border-purple-500/30 rounded p-1.5 text-[10px] text-purple-200 outline-none focus:border-purple-500 resize-none shadow-inner"
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-1 mt-2 pt-2 border-t border-gray-700">
                                        <button
                                            onClick={() => { setShowAnglesDropdown(false); setSelectedAngles([]); setCustomAnglePrompt(''); }}
                                            className="flex-1 text-[9px] text-gray-400 hover:text-white py-1 rounded bg-gray-800"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (selectedAngles.length > 0 && scene.generatedImage) {
                                                    const selections = selectedAngles.map(val => ({
                                                        value: val,
                                                        customPrompt: val === 'custom' ? customAnglePrompt : undefined
                                                    }));
                                                    onInsertAngles(scene.id, selections, scene.generatedImage);
                                                    setShowAnglesDropdown(false);
                                                    setSelectedAngles([]);
                                                    setCustomAnglePrompt('');
                                                }
                                            }}
                                            disabled={selectedAngles.length === 0 || (selectedAngles.includes('custom') && !customAnglePrompt.trim())}
                                            className="flex-1 text-[9px] text-white py-1 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-bold"
                                        >
                                            Tạo {selectedAngles.length > 0 ? `(${selectedAngles.length})` : ''}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
