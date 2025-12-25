import React, { useRef, useState } from 'react';
import { GripVertical, Copy, Download, Layers } from 'lucide-react';
import { Scene, Character, Product } from '../../types';
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
}

export const SceneRow: React.FC<SceneRowProps> = ({
    scene, index, characters, products, sceneGroups, updateScene, assignSceneToGroup, removeScene,
    generateImage, generateEndFrame, openImageViewer,
    onDragStart, onDragOver, onDrop,
    generateVeoPrompt,
    onCopyPreviousStyle,
    onInsertAngles
}) => {
    const endFrameInputRef = useRef<HTMLInputElement>(null);
    const [showAnglesDropdown, setShowAnglesDropdown] = useState(false);
    const [selectedAngles, setSelectedAngles] = useState<string[]>([]);
    const [customAnglePrompt, setCustomAnglePrompt] = useState('');


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
            <div className="md:col-span-3 flex flex-col space-y-2">
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
                    <div className="bg-red-900/90 p-2 text-center rounded">
                        <span className="text-white text-xs">{scene.error}</span>
                    </div>
                )}

                {/* Button Row: Generate Image + Insert Angles */}
                <div className="flex gap-1.5">
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
        </div >
    );
};
