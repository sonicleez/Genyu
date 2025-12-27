/**
 * ManualScriptModal
 * 
 * Modal for importing voice-over scripts manually.
 * Paste script → AI analyzes → User confirms → Generate scene map
 */

import React, { useState, useCallback } from 'react';
import { X, FileText, Upload, Users, Layers, Clock, Play, Film, Palette, AlertTriangle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Character, SceneGroup, Scene, ProjectState, CharacterStyleDefinition } from '../../types';
import { DirectorPreset, DIRECTOR_PRESETS, DirectorCategory } from '../../constants/directors';
import { BUILT_IN_CHARACTER_STYLES, getStylesByCategory } from '../../constants/characterStyles';
import { useScriptAnalysis, ScriptAnalysisResult } from '../../hooks/useScriptAnalysis';

interface ManualScriptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (
        scenes: Scene[],
        groups: SceneGroup[],
        newCharacters: { name: string; description: string }[],
        styleId: string | undefined,
        directorId: string | undefined
    ) => void;
    existingCharacters: Character[];
    userApiKey: string | null;
}

export const ManualScriptModal: React.FC<ManualScriptModalProps> = ({
    isOpen,
    onClose,
    onImport,
    existingCharacters,
    userApiKey
}) => {
    // Script input
    const [scriptText, setScriptText] = useState('');
    const [readingSpeed, setReadingSpeed] = useState<'slow' | 'medium' | 'fast'>('medium');

    // Style & Director selection
    const [selectedStyleId, setSelectedStyleId] = useState<string>('faceless-mannequin');
    const [selectedDirectorId, setSelectedDirectorId] = useState<string>('werner_herzog');

    // UI state
    const [showStylePicker, setShowStylePicker] = useState(false);
    const [showDirectorPicker, setShowDirectorPicker] = useState(false);
    const [sceneCountAdjustment, setSceneCountAdjustment] = useState(0);

    // Analysis hook
    const { isAnalyzing, analysisResult, analysisError, analyzeScript, generateSceneMap } = useScriptAnalysis(userApiKey);

    // Get selected items
    const selectedStyle = BUILT_IN_CHARACTER_STYLES.find(s => s.id === selectedStyleId);
    const allDirectors = Object.values(DIRECTOR_PRESETS).flat();
    const selectedDirector = allDirectors.find(d => d.id === selectedDirectorId);
    const stylesByCategory = getStylesByCategory([]);

    // Handle analyze
    const handleAnalyze = useCallback(async () => {
        if (!scriptText.trim()) return;
        await analyzeScript(scriptText, readingSpeed);
    }, [scriptText, readingSpeed, analyzeScript]);

    // Handle import
    const handleImport = useCallback(() => {
        if (!analysisResult) return;

        const { scenes, groups, newCharacters } = generateSceneMap(
            analysisResult,
            selectedDirector || null,
            selectedStyle || null,
            existingCharacters
        );

        onImport(scenes, groups, newCharacters, selectedStyleId, selectedDirectorId);
        onClose();
    }, [analysisResult, selectedDirector, selectedStyle, existingCharacters, onImport, onClose, generateSceneMap, selectedStyleId, selectedDirectorId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">Import Voice-Over Script</h2>
                            <p className="text-sm text-zinc-400">Paste your script and AI will create the scene map</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!analysisResult ? (
                        // Step 1: Input Script
                        <>
                            {/* Script Textarea */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Voice-Over Script
                                </label>
                                <textarea
                                    value={scriptText}
                                    onChange={(e) => setScriptText(e.target.value)}
                                    placeholder="Paste your voice-over script here..."
                                    className="w-full h-64 bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <div className="flex justify-between mt-2 text-sm text-zinc-500">
                                    <span>{scriptText.split(/\s+/).filter(Boolean).length} words</span>
                                    <span>~{Math.ceil(scriptText.split(/\s+/).filter(Boolean).length / 150)} min read</span>
                                </div>
                            </div>

                            {/* Settings Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Reading Speed */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        <Clock className="w-4 h-4 inline mr-1" /> Reading Speed
                                    </label>
                                    <select
                                        value={readingSpeed}
                                        onChange={(e) => setReadingSpeed(e.target.value as any)}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-white"
                                    >
                                        <option value="slow">Slow (120 WPM)</option>
                                        <option value="medium">Medium (150 WPM)</option>
                                        <option value="fast">Fast (180 WPM)</option>
                                    </select>
                                </div>

                                {/* Character Style */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        <Palette className="w-4 h-4 inline mr-1" /> Character Style
                                    </label>
                                    <button
                                        onClick={() => setShowStylePicker(!showStylePicker)}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-left flex items-center justify-between hover:bg-zinc-700/50 transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span>{selectedStyle?.icon || '🎨'}</span>
                                            <span className="text-white">{selectedStyle?.name || 'Select Style'}</span>
                                        </span>
                                        {showStylePicker ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                                    </button>
                                    {showStylePicker && (
                                        <div className="absolute mt-1 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-10 p-3 space-y-3">
                                            {Object.entries(stylesByCategory).map(([category, styles]) => (
                                                styles.length > 0 && (
                                                    <div key={category}>
                                                        <div className="text-xs text-zinc-500 uppercase mb-2">{category}</div>
                                                        <div className="space-y-1">
                                                            {styles.map(style => (
                                                                <button
                                                                    key={style.id}
                                                                    onClick={() => { setSelectedStyleId(style.id); setShowStylePicker(false); }}
                                                                    className={`w-full p-2 rounded-lg text-left flex items-center gap-2 ${selectedStyleId === style.id ? 'bg-violet-500/20 border border-violet-500/50' : 'hover:bg-zinc-700'
                                                                        }`}
                                                                >
                                                                    <span>{style.icon}</span>
                                                                    <div>
                                                                        <div className="text-sm text-white">{style.name}</div>
                                                                        <div className="text-xs text-zinc-400">{style.description}</div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Director */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        <Film className="w-4 h-4 inline mr-1" /> Director Style
                                    </label>
                                    <button
                                        onClick={() => setShowDirectorPicker(!showDirectorPicker)}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-left flex items-center justify-between hover:bg-zinc-700/50 transition-colors"
                                    >
                                        <span className="text-white">{selectedDirector?.name || 'Select Director'}</span>
                                        {showDirectorPicker ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                                    </button>
                                    {showDirectorPicker && (
                                        <div className="absolute mt-1 w-80 max-h-64 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-10 p-3">
                                            {(['documentary', 'cinema'] as DirectorCategory[]).map(category => (
                                                <div key={category} className="mb-3">
                                                    <div className="text-xs text-zinc-500 uppercase mb-2">{category}</div>
                                                    <div className="space-y-1">
                                                        {DIRECTOR_PRESETS[category].slice(0, 4).map(dir => (
                                                            <button
                                                                key={dir.id}
                                                                onClick={() => { setSelectedDirectorId(dir.id); setShowDirectorPicker(false); }}
                                                                className={`w-full p-2 rounded-lg text-left ${selectedDirectorId === dir.id ? 'bg-violet-500/20 border border-violet-500/50' : 'hover:bg-zinc-700'
                                                                    }`}
                                                            >
                                                                <div className="text-sm text-white">{dir.name}</div>
                                                                <div className="text-xs text-zinc-400 truncate">{dir.description}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Error */}
                            {analysisError && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                                    <AlertTriangle className="w-5 h-5" />
                                    <span>{analysisError}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        // Step 2: Review Analysis
                        <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-zinc-800/50 rounded-xl p-4">
                                    <div className="text-2xl font-bold text-white">{analysisResult.totalWords}</div>
                                    <div className="text-sm text-zinc-400">Words</div>
                                </div>
                                <div className="bg-zinc-800/50 rounded-xl p-4">
                                    <div className="text-2xl font-bold text-white">{Math.ceil(analysisResult.estimatedDuration / 60)}m</div>
                                    <div className="text-sm text-zinc-400">Duration</div>
                                </div>
                                <div className="bg-zinc-800/50 rounded-xl p-4">
                                    <div className="text-2xl font-bold text-violet-400">{analysisResult.chapters.length}</div>
                                    <div className="text-sm text-zinc-400">Chapters</div>
                                </div>
                                <div className="bg-zinc-800/50 rounded-xl p-4">
                                    <div className="text-2xl font-bold text-emerald-400">{analysisResult.suggestedSceneCount}</div>
                                    <div className="text-sm text-zinc-400">Scenes</div>
                                </div>
                            </div>

                            {/* Chapters */}
                            <div>
                                <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                                    <Layers className="w-5 h-5 text-violet-400" /> Chapters Detected
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {analysisResult.chapters.map((ch, i) => (
                                        <div key={ch.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                                            <div className="text-sm font-medium text-white">{ch.title}</div>
                                            <div className="text-xs text-zinc-500">{ch.suggestedTimeOfDay} • {ch.suggestedWeather}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Characters */}
                            <div>
                                <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                                    <Users className="w-5 h-5 text-emerald-400" /> Characters Found
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {analysisResult.characters.map((char, i) => {
                                        const exists = existingCharacters.some(c => c.name.toLowerCase() === char.name.toLowerCase());
                                        return (
                                            <div key={i} className={`border rounded-lg p-3 ${exists ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-white">{char.name}</span>
                                                    {exists ? (
                                                        <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Exists</span>
                                                    ) : (
                                                        <span className="text-xs text-amber-400">New</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-zinc-400 mt-1">{char.suggestedDescription}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Selected Style Preview */}
                            <div className="flex gap-4 p-4 bg-zinc-800/30 rounded-xl">
                                <div className="flex-1">
                                    <div className="text-sm text-zinc-400 mb-1">Character Style</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{selectedStyle?.icon}</span>
                                        <span className="text-white font-medium">{selectedStyle?.name}</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm text-zinc-400 mb-1">Director</div>
                                    <div className="text-white font-medium">{selectedDirector?.name}</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-zinc-800 bg-zinc-900/50">
                    {!analysisResult ? (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAnalyze}
                                disabled={!scriptText.trim() || isAnalyzing}
                                className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Analyze Script
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => { setScriptText(''); }}
                                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                            >
                                ← Back to Edit
                            </button>
                            <button
                                onClick={handleImport}
                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Generate {analysisResult.suggestedSceneCount} Scenes
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualScriptModal;
