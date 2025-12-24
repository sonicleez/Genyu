import React from 'react';
import { Trash2, Brush, GripVertical } from 'lucide-react';
import { SceneRowProps } from './SceneRow';
import { ExpandableTextarea } from '../common/ExpandableTextarea';

export const StoryBoardCard: React.FC<SceneRowProps> = ({
    scene, index, updateScene, assignSceneToGroup, sceneGroups, removeScene,
    generateImage, openImageViewer,
    onDragStart, onDragOver, onDrop
}) => {
    return (
        <div
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
            onDrop={() => onDrop(index)}
            className={`flex flex-col bg-gray-800/40 rounded-xl border transition-all group/card relative overflow-hidden h-full ${index === (window as any).dragOverIndex ? 'border-brand-orange bg-brand-orange/10 scale-[1.02] shadow-2xl z-10' : 'border-gray-700/50 hover:border-gray-500'
                }`}
        >
            {/* Image Section */}
            <div
                className="aspect-video bg-black relative cursor-pointer overflow-hidden group/img"
                onClick={() => scene.generatedImage && openImageViewer()}
            >
                {scene.isGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange mb-2"></div>
                        <span className="text-[10px] text-brand-orange animate-pulse">Rendering...</span>
                    </div>
                ) : scene.generatedImage ? (
                    <img src={scene.generatedImage} alt={`Scene ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 space-y-2">
                        <span className="text-3xl">🖼️</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold">No Image</span>
                    </div>
                )}

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); generateImage(); }}
                        className="p-2 bg-brand-orange text-white rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="Tạo lại ảnh"
                    >
                        <Brush size={16} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); removeScene(scene.id); }}
                        className="p-2 bg-red-600 text-white rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="Xóa cảnh"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                {/* Drag Handle Overlay */}
                <div className="absolute top-2 left-2 p-1.5 bg-black/50 text-white rounded cursor-grab active:cursor-grabbing opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <GripVertical size={14} />
                </div>
            </div>

            {/* Content Section */}
            <div className="p-3 flex-1 flex flex-col space-y-2">
                <ExpandableTextarea
                    value={scene.language1 || scene.vietnamese || ''}
                    onChange={(val) => updateScene(scene.id, { language1: val })}
                    placeholder="Nội dung kịch bản..."
                    rows={3}
                    className="w-full bg-transparent border-none p-0 text-xs text-gray-300 focus:ring-0 resize-none overflow-hidden scrollbar-none italic leading-relaxed"
                />

                <div className="mt-auto pt-2 flex justify-between items-center border-t border-gray-700/50">
                    <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-md border border-brand-orange/20">
                            {scene.sceneNumber || (index + 1)}
                        </span>
                        {scene.groupId && (
                            <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 uppercase">
                                {sceneGroups?.find(g => g.id === scene.groupId)?.name}
                            </span>
                        )}
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Scene</span>
                    </div>
                    <div className="text-[9px] text-gray-600 italic truncate max-w-[100px]">
                        {scene.promptName || 'Untitled'}
                    </div>
                </div>
            </div>
        </div>
    );
};
