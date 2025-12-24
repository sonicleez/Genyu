import React, { useState, useEffect } from 'react';
import { Brush } from 'lucide-react';
import { Scene } from '../../types';

export interface ImageViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenes: Scene[];
    currentIndex: number;
    onNavigate: (index: number) => void;
    onRegenerate: (sceneId: string, prompt?: string) => void;
    onEdit: (sceneId: string, image: string) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, onClose, scenes, currentIndex, onNavigate, onRegenerate, onEdit }) => {
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
                            ✨ Sửa ảnh này (Prompt)
                        </button>
                        <button
                            onClick={() => {
                                if (currentScene.generatedImage) {
                                    onEdit(currentScene.id, currentScene.generatedImage);
                                    onClose();
                                }
                            }}
                            className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded shadow-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Brush size={16} />
                            Advanced Edit (Layers/Mask)
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
