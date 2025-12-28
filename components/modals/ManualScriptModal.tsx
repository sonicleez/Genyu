/**
 * ManualScriptModal
 * 
 * Modal for importing voice-over scripts manually.
 * Paste script → AI analyzes → User confirms → Generate scene map
 */

import React, { useState, useCallback } from 'react';
import { X, FileText, Upload, Users, Layers, Clock, Play, Film, Palette, AlertTriangle, Check, ChevronDown, ChevronUp, Save, FolderOpen, Trash2 } from 'lucide-react';
import { Character, SceneGroup, Scene, ProjectState, CharacterStyleDefinition } from '../../types';
import { DirectorPreset, DIRECTOR_PRESETS, DirectorCategory } from '../../constants/directors';
import { BUILT_IN_CHARACTER_STYLES, getStylesByCategory } from '../../constants/characterStyles';
import { SCRIPT_MODELS } from '../../constants/presets';
import { useScriptAnalysis, ScriptAnalysisResult } from '../../hooks/useScriptAnalysis';
import { useResearchPresets, ResearchPreset } from '../../hooks/useResearchPresets';

interface ManualScriptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (
        scenes: Scene[],
        groups: SceneGroup[],
        newCharacters: { name: string; description: string }[],
        styleId: string | undefined,
        directorId: string | undefined,
        sceneCharacterMap: Record<number, string[]>,
        researchNotes?: { director?: string; dop?: string }  // NEW: Pass research notes for storage
    ) => void;
    existingCharacters: Character[];
    userApiKey: string | null;
    userId: string | null;
}

export const ManualScriptModal: React.FC<ManualScriptModalProps> = ({
    isOpen,
    onClose,
    onImport,
    existingCharacters,
    userApiKey,
    userId
}) => {
    // Script input
    const [scriptText, setScriptText] = useState('');
    const [readingSpeed, setReadingSpeed] = useState<'slow' | 'medium' | 'fast'>('medium');

    // Style & Director selection
    const [selectedStyleId, setSelectedStyleId] = useState<string>('faceless-mannequin');
    const [selectedDirectorId, setSelectedDirectorId] = useState<string>('werner_herzog');
    const [selectedModel, setSelectedModel] = useState<string>(SCRIPT_MODELS[0].value); // Use first model as default

    // UI state
    const [showStylePicker, setShowStylePicker] = useState(false);
    const [showDirectorPicker, setShowDirectorPicker] = useState(false);
    const [sceneCountAdjustment, setSceneCountAdjustment] = useState(0);

    // Research Notes state
    const [showResearchNotes, setShowResearchNotes] = useState(false);
    const [directorNotes, setDirectorNotes] = useState('');
    const [dopNotes, setDopNotes] = useState('');
    const [showPresetPicker, setShowPresetPicker] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [isSavingPreset, setIsSavingPreset] = useState(false);

    // Research Presets hook (cloud sync)
    const { presets, isLoading: presetsLoading, savePreset, deletePreset } = useResearchPresets(userId);

    // Analysis hook
    const { isAnalyzing, analysisResult, analysisError, analyzeScript, generateSceneMap, setAnalysisResult } = useScriptAnalysis(userApiKey);

    // Get selected items
    const selectedStyle = BUILT_IN_CHARACTER_STYLES.find(s => s.id === selectedStyleId);
    const allDirectors = Object.values(DIRECTOR_PRESETS).flat();
    const selectedDirector = allDirectors.find(d => d.id === selectedDirectorId);
    const stylesByCategory = getStylesByCategory([]);

    // Handle analyze
    const handleAnalyze = useCallback(async () => {
        if (!scriptText.trim()) return;
        await analyzeScript(
            scriptText,
            readingSpeed,
            selectedModel,
            selectedStyle || null,
            selectedDirector || null,
            // Pass Research Notes for AI context injection
            (directorNotes || dopNotes) ? { director: directorNotes || undefined, dop: dopNotes || undefined } : null
        );
    }, [scriptText, readingSpeed, selectedModel, analyzeScript, selectedStyle, selectedDirector, directorNotes, dopNotes]);

    // Handle import
    const handleImport = useCallback(() => {
        if (!analysisResult) return;

        const { scenes, groups, newCharacters, sceneCharacterMap } = generateSceneMap(
            analysisResult,
            selectedDirector || null,
            selectedStyle || null,
            existingCharacters
        );

        // Pass research notes for storage in ProjectState
        const notes = (directorNotes || dopNotes) ? { director: directorNotes || undefined, dop: dopNotes || undefined } : undefined;
        onImport(scenes, groups, newCharacters, selectedStyleId, selectedDirectorId, sceneCharacterMap, notes);
        onClose();
    }, [analysisResult, selectedDirector, selectedStyle, existingCharacters, onImport, onClose, generateSceneMap, selectedStyleId, selectedDirectorId, directorNotes, dopNotes]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #52525b;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #71717a;
                }
            `}</style>
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-violet-500/10 border border-zinc-700/50">
                {/* Header - Glassmorphism */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-700/50 bg-zinc-800/30 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Import Voice-Over Script</h2>
                            <p className="text-sm text-zinc-400 mt-0.5">AI-powered scene breakdown from your script</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-zinc-700/50 rounded-xl transition-all hover:scale-105">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className={`flex-1 px-8 py-6 ${analysisResult ? 'overflow-y-auto' : 'overflow-visible'}`}>
                    {!analysisResult ? (
                        // Step 1: Input Script - Premium 2-Column Layout
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
                            {/* Left Column - Script Input (3/5) */}
                            <div className="lg:col-span-3 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                    <label className="text-sm font-semibold text-white uppercase tracking-wider">
                                        Voice-Over Script
                                    </label>
                                </div>
                                <div className="relative flex-1">
                                    <textarea
                                        value={scriptText}
                                        onChange={(e) => setScriptText(e.target.value)}
                                        placeholder="Paste your voice-over script here...

Example:
Monte Carlo, March 2019. The casino is buzzing with high rollers...
John enters the room, wearing a tailored Armani suit..."
                                        className="w-full h-80 bg-zinc-800/50 border-2 border-zinc-700/50 rounded-2xl p-5 text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all duration-300 text-[15px] leading-relaxed"
                                    />
                                    <div className="absolute bottom-4 left-5 right-5 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">
                                                📝 {scriptText.split(/\s+/).filter(Boolean).length} words
                                            </span>
                                            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">
                                                ⏱️ ~{Math.ceil(scriptText.split(/\s+/).filter(Boolean).length / 150)} min
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Research Notes - Collapsible */}
                                <div className="mt-4 border border-zinc-700/50 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => setShowResearchNotes(!showResearchNotes)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800/70 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">📚</span>
                                            <span className="text-sm font-semibold text-white">Research Notes</span>
                                            <span className="text-xs text-zinc-500">(Director + DOP)</span>
                                        </div>
                                        {showResearchNotes ? (
                                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                                        )}
                                    </button>

                                    {showResearchNotes && (
                                        <div className="p-4 space-y-4 bg-zinc-900/30">
                                            {/* Director Notes */}
                                            <div>
                                                <label className="flex items-center gap-2 text-xs font-medium text-amber-400 mb-2">
                                                    <Film className="w-3.5 h-3.5" />
                                                    Director Notes (Câu chuyện, cảm xúc, nhịp điệu)
                                                </label>
                                                <textarea
                                                    value={directorNotes}
                                                    onChange={(e) => setDirectorNotes(e.target.value)}
                                                    placeholder="VD: Thể loại Intellectual Crime - Không dùng action, tập trung căng thẳng ngầm. Nhân vật chính luôn bình tĩnh..."
                                                    className="w-full h-24 bg-zinc-800/50 border border-amber-500/30 rounded-xl p-3 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                                                />
                                            </div>

                                            {/* DOP Notes */}
                                            <div>
                                                <label className="flex items-center gap-2 text-xs font-medium text-cyan-400 mb-2">
                                                    <Layers className="w-3.5 h-3.5" />
                                                    DOP Notes (Góc máy, ánh sáng, chuyển cảnh)
                                                </label>
                                                <textarea
                                                    value={dopNotes}
                                                    onChange={(e) => setDopNotes(e.target.value)}
                                                    placeholder="VD: Dùng Low-key lighting, contrast cao. Góc quay thấp làm nhân vật tỏ ra quyền lực. Match-cut cho chuyển cảnh mượt..."
                                                    className="w-full h-24 bg-zinc-800/50 border border-cyan-500/30 rounded-xl p-3 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10"
                                                />
                                            </div>

                                            {/* Preset buttons - Connected to Supabase */}
                                            <div className="pt-3 border-t border-zinc-700/30 space-y-3">
                                                {/* Save Preset Row */}
                                                {isSavingPreset ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={presetName}
                                                            onChange={(e) => setPresetName(e.target.value)}
                                                            placeholder="Tên preset..."
                                                            className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                if (!presetName.trim()) return alert('Vui lòng nhập tên preset');
                                                                const result = await savePreset(presetName, directorNotes, dopNotes);
                                                                if (result) {
                                                                    setIsSavingPreset(false);
                                                                    setPresetName('');
                                                                    alert('✅ Đã lưu preset!');
                                                                }
                                                            }}
                                                            disabled={presetsLoading}
                                                            className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-50"
                                                        >
                                                            {presetsLoading ? '...' : 'Lưu'}
                                                        </button>
                                                        <button
                                                            onClick={() => { setIsSavingPreset(false); setPresetName(''); }}
                                                            className="px-2 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setIsSavingPreset(true)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors"
                                                        >
                                                            <Save className="w-3.5 h-3.5" />
                                                            Save Preset
                                                        </button>
                                                        <button
                                                            onClick={() => setShowPresetPicker(!showPresetPicker)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors"
                                                        >
                                                            <FolderOpen className="w-3.5 h-3.5" />
                                                            Load Preset ({presets.length})
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Preset Picker Dropdown */}
                                                {showPresetPicker && presets.length > 0 && (
                                                    <div className="bg-zinc-800/80 border border-zinc-600 rounded-xl p-2 max-h-40 overflow-y-auto">
                                                        {presets.map((preset) => (
                                                            <div
                                                                key={preset.id}
                                                                className="flex items-center justify-between p-2 hover:bg-zinc-700/50 rounded-lg cursor-pointer group"
                                                            >
                                                                <div
                                                                    onClick={() => {
                                                                        setDirectorNotes(preset.director_notes);
                                                                        setDopNotes(preset.dop_notes);
                                                                        setShowPresetPicker(false);
                                                                    }}
                                                                    className="flex-1"
                                                                >
                                                                    <div className="text-xs font-medium text-white">{preset.name}</div>
                                                                    <div className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                                                                        {preset.director_notes?.substring(0, 50)}...
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm('Xóa preset này?')) {
                                                                            deletePreset(preset.id);
                                                                        }
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-all"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {showPresetPicker && presets.length === 0 && (
                                                    <div className="text-xs text-zinc-500 text-center py-2">
                                                        Chưa có preset nào. Hãy tạo preset mới!
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Error */}
                                {analysisError && (
                                    <div className="flex items-center gap-3 p-4 mt-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-sm">{analysisError}</span>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Settings (2/5) - Scrollable */}
                            <div className="lg:col-span-2 overflow-y-auto max-h-[70vh] space-y-4 pr-1 custom-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: '#52525b #27272a' }}>
                                {/* AI Settings Card - Compact */}
                                <div className="bg-zinc-800/30 rounded-2xl p-4 border border-zinc-700/30 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-lg">🤖</span>
                                        <span className="text-sm font-bold text-white uppercase tracking-wider">AI</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Model Selector */}
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Model</label>
                                            <select
                                                value={selectedModel}
                                                onChange={(e) => setSelectedModel(e.target.value)}
                                                className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                                            >
                                                {SCRIPT_MODELS.map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Reading Speed */}
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Reading Speed</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { value: 'slow', label: 'Slow', desc: '120 WPM', icon: '🐢' },
                                                    { value: 'medium', label: 'Medium', desc: '150 WPM', icon: '⚡' },
                                                    { value: 'fast', label: 'Fast', desc: '180 WPM', icon: '🚀' }
                                                ].map(speed => (
                                                    <button
                                                        key={speed.value}
                                                        onClick={() => setReadingSpeed(speed.value as any)}
                                                        className={`p-2.5 rounded-xl text-center transition-all ${readingSpeed === speed.value
                                                            ? 'bg-violet-500/20 border-2 border-violet-500 text-white'
                                                            : 'bg-zinc-900/50 border border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                                            }`}
                                                    >
                                                        <div className="text-lg mb-0.5">{speed.icon}</div>
                                                        <div className="text-[10px] font-bold">{speed.label}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Character Style Card - Compact */}
                                <div className="bg-zinc-800/30 rounded-2xl p-4 border border-zinc-700/30 backdrop-blur-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Palette className="w-4 h-4 text-fuchsia-400" />
                                            <span className="text-sm font-bold text-white uppercase tracking-wider">Style</span>
                                        </div>
                                        <button
                                            onClick={() => setShowStylePicker(!showStylePicker)}
                                            className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                                        >
                                            {showStylePicker ? 'Less' : 'More →'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: '#52525b #27272a' }}>
                                        {(showStylePicker ? BUILT_IN_CHARACTER_STYLES : BUILT_IN_CHARACTER_STYLES.slice(0, 4)).map(style => (
                                            <button
                                                key={style.id}
                                                onClick={() => setSelectedStyleId(style.id)}
                                                className={`p-2.5 rounded-xl text-left transition-all ${selectedStyleId === style.id
                                                    ? 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-violet-500/50'
                                                    : 'bg-zinc-900/50 border border-zinc-700 hover:border-zinc-600'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{style.icon}</span>
                                                    <span className="text-[10px] font-semibold text-white truncate">{style.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Director Card - Compact */}
                                <div className="bg-zinc-800/30 rounded-2xl p-4 border border-zinc-700/30 backdrop-blur-sm relative">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Film className="w-4 h-4 text-amber-400" />
                                            <span className="text-sm font-bold text-white uppercase tracking-wider">Director</span>
                                        </div>
                                    </div>

                                    {/* Selected Director Preview */}
                                    {selectedDirector && (
                                        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 mb-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-amber-200">{selectedDirector.name}</span>
                                                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium uppercase">
                                                    {selectedDirector.origin}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400 mb-2 line-clamp-2">{selectedDirector.description}</p>
                                            <div className="text-[10px] text-amber-400/80">🎬 {selectedDirector.signatureCameraStyle}</div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setShowDirectorPicker(!showDirectorPicker)}
                                        className="w-full bg-zinc-900/50 border border-zinc-700 hover:border-zinc-600 rounded-xl px-4 py-3 text-left flex items-center justify-between transition-all group"
                                    >
                                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                                            {selectedDirector ? 'Change Director' : 'Select a Director'}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showDirectorPicker ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Director Picker Overlay */}
                                    {showDirectorPicker && (
                                        <div className="absolute inset-0 bg-zinc-900/95 backdrop-blur-lg rounded-2xl z-50 overflow-hidden flex flex-col animate-fade-in">
                                            <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
                                                <span className="text-sm font-bold text-white">Select Director</span>
                                                <button
                                                    onClick={() => setShowDirectorPicker(false)}
                                                    className="text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: '#52525b #27272a' }}>
                                                {(['documentary', 'cinema', 'tvc', 'music_video'] as DirectorCategory[]).map(category => (
                                                    <div key={category}>
                                                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 sticky top-0 bg-zinc-900 py-1">
                                                            {category.replace('_', ' ')}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {DIRECTOR_PRESETS[category].map(dir => (
                                                                <button
                                                                    key={dir.id}
                                                                    onClick={() => { setSelectedDirectorId(dir.id); setShowDirectorPicker(false); }}
                                                                    className={`w-full p-3 rounded-xl text-left transition-all ${selectedDirectorId === dir.id
                                                                        ? 'bg-amber-500/20 border border-amber-500/50'
                                                                        : 'hover:bg-zinc-800 border border-transparent'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-medium text-white">{dir.name}</span>
                                                                        <span className="text-[9px] text-amber-400/70">{dir.origin}</span>
                                                                    </div>
                                                                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{dir.description}</p>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
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
                                onClick={() => { setAnalysisResult(null); }}
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
        </div >
    );
};

export default ManualScriptModal;
