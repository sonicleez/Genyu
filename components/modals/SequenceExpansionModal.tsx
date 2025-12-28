/**
 * SequenceExpansionModal
 * 
 * Modal for expanding a single VO scene into multiple sub-scenes.
 * Shows AI-generated Director emotional beats and DOP camera progression.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, Film, Camera, Clapperboard, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { Scene, ProjectState } from '../../types';
import { useSequenceExpansion, SubSceneProposal } from '../../hooks/useSequenceExpansion';

interface SequenceExpansionModalProps {
    isOpen: boolean;
    onClose: () => void;
    scene: Scene | null;
    onExpand: (parentSceneId: string, subScenes: SubSceneProposal[]) => void;
    userApiKey: string | null;
    researchNotes?: { director?: string; dop?: string };
}

export const SequenceExpansionModal: React.FC<SequenceExpansionModalProps> = ({
    isOpen,
    onClose,
    scene,
    onExpand,
    userApiKey,
    researchNotes
}) => {
    const [readingSpeed, setReadingSpeed] = useState<'slow' | 'medium' | 'fast'>('medium');
    const { isExpanding, expansionResult, expansionError, expandSequence, clearResult } = useSequenceExpansion(userApiKey);

    // Auto-expand when modal opens
    useEffect(() => {
        if (isOpen && scene && scene.voiceOverText && scene.voSecondsEstimate) {
            clearResult();
            expandSequence(
                scene.voiceOverText,
                scene.voSecondsEstimate,
                researchNotes?.director,
                researchNotes?.dop,
                readingSpeed
            );
        }
    }, [isOpen, scene?.id, readingSpeed]);

    const handleConfirm = useCallback(() => {
        if (!scene || !expansionResult) return;
        onExpand(scene.id, expansionResult.subScenes);
        onClose();
    }, [scene, expansionResult, onExpand, onClose]);

    if (!isOpen || !scene) return null;

    const estimatedSubScenes = Math.max(2, Math.min(5, Math.ceil((scene.voSecondsEstimate || 0) / (readingSpeed === 'fast' ? 3 : 4))));

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-zinc-700/50">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 bg-zinc-800/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Clapperboard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Expand Sequence</h2>
                            <p className="text-xs text-zinc-400">Scene {scene.sceneNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-700/50 rounded-xl transition-all">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* VO Preview */}
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Voice-Over Text</span>
                            <span className="text-xs text-amber-400 font-mono">{scene.voSecondsEstimate}s</span>
                        </div>
                        <p className="text-sm text-white leading-relaxed">{scene.voiceOverText || scene.vietnamese}</p>
                    </div>

                    {/* Speed Selector */}
                    <div className="flex items-center justify-between bg-zinc-800/30 rounded-xl p-3">
                        <span className="text-sm text-zinc-400">Pacing:</span>
                        <div className="flex gap-2">
                            {[
                                { val: 'slow', label: 'Slow (4s/scene)', icon: '🐢' },
                                { val: 'medium', label: 'Normal (4s)', icon: '⚡' },
                                { val: 'fast', label: 'Fast (3s)', icon: '🚀' }
                            ].map(opt => (
                                <button
                                    key={opt.val}
                                    onClick={() => setReadingSpeed(opt.val as any)}
                                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${readingSpeed === opt.val
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                                        }`}
                                >
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Loading State */}
                    {isExpanding && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
                            <p className="text-sm text-zinc-400">AI đang phân tích... ({estimatedSubScenes} sub-scenes)</p>
                        </div>
                    )}

                    {/* Error State */}
                    {expansionError && (
                        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{expansionError}</span>
                        </div>
                    )}

                    {/* Results */}
                    {expansionResult && !isExpanding && (
                        <div className="space-y-4">
                            {/* Rationale */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Film className="w-4 h-4 text-amber-400" />
                                        <span className="text-xs font-medium text-amber-400">Director</span>
                                    </div>
                                    <p className="text-xs text-zinc-300">{expansionResult.directorRationale}</p>
                                </div>
                                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Camera className="w-4 h-4 text-cyan-400" />
                                        <span className="text-xs font-medium text-cyan-400">DOP</span>
                                    </div>
                                    <p className="text-xs text-zinc-300">{expansionResult.dopRationale}</p>
                                </div>
                            </div>

                            {/* Sub-scenes Preview */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white">Sub-Scenes ({expansionResult.subScenes.length})</h3>
                                {expansionResult.subScenes.map((sub, idx) => (
                                    <div key={idx} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/30">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-amber-400">{sub.emotionalBeat}</span>
                                                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                                                    <span className="text-xs font-medium text-cyan-400">{sub.cameraProgression}</span>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                                    {sub.suggestedAngle} • {sub.suggestedLens} • {sub.duration}s
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-zinc-300 pl-11">{sub.contextDescription}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-700/50 bg-zinc-800/30 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!expansionResult || isExpanding}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Clapperboard className="w-4 h-4" />
                        Generate {expansionResult?.subScenes.length || 0} Sub-Scenes
                    </button>
                </div>
            </div>
        </div>
    );
};
