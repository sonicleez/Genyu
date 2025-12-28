import React from 'react';
import { Table, LayoutGrid, Trash2, Plus, ImageMinus, ChevronDown, ChevronRight, Zap, Image as ImageIcon, Wind, Clock, Sun, StopCircle } from 'lucide-react';
import { SceneRow } from '../scenes/SceneRow';
import { StoryBoardCard } from '../scenes/StoryBoardCard';
import { Tooltip } from '../common/Tooltip';
import { Scene, Character, Product, SceneGroup } from '../../types';
import { PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER, VEO_PRESETS } from '../../constants/presets';

interface ScenesMapSectionProps {
    scenes: Scene[];
    viewMode: 'table' | 'storyboard';
    setViewMode: (mode: 'table' | 'storyboard') => void;
    characters: Character[];
    products: Product[];
    sceneGroups: SceneGroup[];
    updateScene: (id: string, updates: Partial<Scene>) => void;
    removeScene: (id: string) => void;
    insertScene: (index: number) => void;
    moveScene: (fromIndex: number, toIndex: number) => void;
    performImageGeneration: (id: string, refinement?: string, isEndFrame?: boolean) => void;
    handleOpenImageViewer: (index: number) => void;
    handleGenerateAllImages: () => void;
    isBatchGenerating: boolean;
    isStopping: boolean;
    stopBatchGeneration: () => void;
    handleGenerateAllVeoPrompts: () => void;
    generateVeoPrompt: (sceneId: string) => void;
    suggestVeoPresets: () => void;
    applyPresetToAll: (preset: string) => void;
    analyzeRaccord: (sceneId: string) => any[];
    suggestNextShot: (lastSceneId: string) => any;
    isVeoGenerating: boolean;
    isVeoStopping?: boolean;
    stopVeoGeneration?: () => void;
    handleGenerateAllVideos: () => void;
    isVideoGenerating: boolean;
    addScene: () => void;
    detailedScript: string;
    onDetailedScriptChange: (val: string) => void;
    onCleanAll: () => void;
    createGroup: (name: string, description?: string) => string;
    updateGroup: (id: string, updates: Partial<{ name: string; description: string }>) => void;
    deleteGroup: (id: string) => void;
    assignSceneToGroup: (sceneId: string, groupId: string | undefined) => void;
    draggedSceneIndex: number | null;
    setDraggedSceneIndex: (idx: number | null) => void;
    dragOverIndex: number | null;
    setDragOverIndex: (idx: number | null) => void;
    onClearAllImages: () => void;
    onInsertAngles?: (sceneId: string, selections: { value: string; customPrompt?: string }[], sourceImage: string) => void;
}

export const ScenesMapSection: React.FC<ScenesMapSectionProps> = ({
    scenes,
    viewMode,
    setViewMode,
    characters,
    products,
    updateScene,
    removeScene,
    insertScene,
    moveScene,
    performImageGeneration,
    handleOpenImageViewer,
    handleGenerateAllImages,
    isBatchGenerating,
    isStopping,
    stopBatchGeneration,
    handleGenerateAllVeoPrompts,
    generateVeoPrompt,
    suggestVeoPresets,
    applyPresetToAll,
    isVeoGenerating,
    isVeoStopping,
    stopVeoGeneration,
    handleGenerateAllVideos,
    isVideoGenerating,
    addScene,
    detailedScript,
    onDetailedScriptChange,
    onCleanAll,
    createGroup,
    updateGroup,
    deleteGroup,
    assignSceneToGroup,
    sceneGroups,
    draggedSceneIndex,
    setDraggedSceneIndex,
    dragOverIndex,
    setDragOverIndex,
    onClearAllImages,
    onInsertAngles,
    analyzeRaccord,
    suggestNextShot
}) => {
    const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
    const [activeGroupMenu, setActiveGroupMenu] = React.useState<string | null>(null);
    const [showDOP, setShowDOP] = React.useState(false);
    const [showDetailedScript, setShowDetailedScript] = React.useState(false);

    const toggleGroupCollapse = (groupId: string | undefined) => {
        const id = groupId || 'none';
        setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const isGroupCollapsed = (groupId: string | undefined) => {
        return !!collapsedGroups[groupId || 'none'];
    };

    const toggleAllGroups = (collapse: boolean) => {
        const newCollapsed: Record<string, boolean> = {};
        sceneGroups.forEach(g => { newCollapsed[g.id] = collapse; });
        newCollapsed['none'] = collapse;
        setCollapsedGroups(newCollapsed);
    };

    return (
        <div className="my-16">
            <div className="flex justify-between items-center mb-6 bg-gray-950/40 p-3 rounded-2xl border border-gray-800/50 backdrop-blur-md">
                <div className="flex items-center space-x-6 pl-2">
                    <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-orange to-brand-red tracking-tighter">SCENES MAP</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowDOP(!showDOP)}
                            className={`h-8 px-3 flex items-center gap-2 font-black text-[9px] rounded-lg transition-all uppercase tracking-widest border shadow-inner ${showDOP ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20' : 'bg-gray-900/80 text-blue-400 border-gray-700/50 hover:border-blue-500/50'}`}
                            title="DOP Assistant (Director of Photography) - Raccord & Flow"
                        >
                            <Zap size={11} className={showDOP ? 'animate-pulse' : ''} />
                            DOP Assistant
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Primary Action Group (1, 2, 3) */}
                    <div className="flex items-center bg-black/40 p-1 rounded-xl border border-gray-800/80 shadow-2xl">
                        <button
                            onClick={handleGenerateAllImages}
                            disabled={isBatchGenerating}
                            className={`h-9 px-4 font-black text-[9px] text-brand-cream rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all duration-300 disabled:opacity-50 uppercase tracking-widest flex items-center gap-2`}
                        >
                            <ImageIcon size={14} />
                            {isBatchGenerating ? '1. Tạo...' : '1. Tạo ảnh'}
                        </button>

                        <div className="w-px h-4 bg-gray-800 mx-1"></div>

                        <button
                            onClick={handleGenerateAllVeoPrompts}
                            disabled={isVeoGenerating}
                            className={`h-9 px-4 font-black text-[9px] text-brand-cream rounded-lg hover:bg-white/5 transition-all duration-300 disabled:opacity-50 uppercase tracking-widest flex items-center gap-2 ${isVeoGenerating ? 'text-brand-orange' : 'text-gray-400'}`}
                        >
                            <Zap size={14} />
                            {isVeoGenerating ? '2. Prompts...' : '2. Veo Prompts'}
                        </button>
                        {isVeoGenerating && stopVeoGeneration && (
                            <button
                                onClick={stopVeoGeneration}
                                className="h-9 px-3 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg transition-all flex items-center gap-1 text-[9px] font-bold uppercase"
                            >
                                <StopCircle size={14} />
                                {isVeoStopping ? 'Đang dừng...' : 'Dừng'}
                            </button>
                        )}

                        <div className="w-px h-4 bg-gray-800 mx-1"></div>

                        <button
                            onClick={handleGenerateAllVideos}
                            disabled={isVideoGenerating}
                            className={`h-9 px-4 font-black text-[9px] text-brand-cream rounded-lg hover:bg-white/5 transition-all duration-300 disabled:opacity-50 uppercase tracking-widest flex items-center gap-2 ${isVideoGenerating ? 'text-brand-orange' : 'text-gray-400'}`}
                        >
                            <Wind size={14} />
                            {isVideoGenerating ? '3. Video...' : '3. Video'}
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-800 mx-1"></div>

                    <button
                        onClick={addScene}
                        className={`h-9 px-4 font-black text-[9px] text-brand-cream rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all uppercase tracking-widest flex items-center gap-2`}
                    >
                        <Plus size={14} />
                        Scene
                    </button>

                    <button
                        onClick={() => {
                            const allVisual = scenes.map(s => s.contextDescription || '').filter(t => t).join('\n\n');
                            if (allVisual) {
                                navigator.clipboard.writeText(allVisual).then(() => alert('📋 Copied all Visual Prompts!'));
                            } else {
                                alert('⚠️ No Visual Prompts to copy.');
                            }
                        }}
                        className="h-9 w-9 flex items-center justify-center text-gray-400 hover:text-brand-cream bg-gray-900 border border-gray-800 rounded-lg transition-all active:scale-95"
                        title="Copy All Visual Prompts"
                    >
                        <ImageIcon size={14} />
                    </button>

                    {isBatchGenerating && (
                        <button
                            onClick={stopBatchGeneration}
                            disabled={isStopping}
                            className="h-9 px-4 font-black text-[9px] text-white rounded-lg bg-red-600 hover:bg-red-700 transition-all uppercase tracking-widest"
                        >
                            {isStopping ? '...' : 'STOP'}
                        </button>
                    )}

                    <button
                        onClick={() => {
                            if (confirm('⚠️ Xóa TẤT CẢ ảnh?')) {
                                onClearAllImages();
                            }
                        }}
                        className="h-9 w-9 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-600/20 bg-gray-900 border border-red-900/30 rounded-lg transition-all"
                        title="Xóa tất cả ảnh"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* DOP DASHBOARD OVERLAY */}
            {showDOP && (
                <div className="mb-8 p-6 bg-blue-900/10 border border-blue-500/30 rounded-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Zap size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-blue-100 uppercase tracking-tighter">DOP Continuity Logic (Raccord)</h3>
                                <p className="text-[10px] text-blue-400/80 font-bold uppercase">Giám sát tính nhất quán của bối cảnh & đạo cụ</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-[8px] font-black text-blue-300 uppercase">Automated Guard v1.0</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-950/50 rounded-xl p-4 border border-blue-500/10">
                            <h4 className="text-[10px] font-black text-blue-300 uppercase mb-3 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                                Phân tích Raccord (Scene Mới Nhất)
                            </h4>
                            <div className="space-y-2">
                                {scenes.filter(s => s.generatedImage).length > 0 ? (
                                    (() => {
                                        const lastGenScene = [...scenes].reverse().find(s => s.generatedImage);
                                        const insights = analyzeRaccord(lastGenScene!.id);
                                        if (insights.length === 0) return <p className="text-[10px] text-gray-500 font-bold">Mọi thứ đều ổn định (Perfect Raccord).</p>;
                                        return insights.map((ins, i) => (
                                            <div key={i} className={`p-2 rounded border ${ins.severity === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-200' : 'bg-blue-500/5 border-blue-500/20 text-blue-200'} text-[10px]`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-black uppercase tracking-widest">{ins.type}</span>
                                                    <span className="text-[8px] opacity-70 italic font-bold">Severity: {ins.severity}</span>
                                                </div>
                                                <p className="font-bold opacity-90">{ins.message}</p>
                                                {ins.suggestion && <p className="mt-1 text-[9px] text-white/50 leading-relaxed italic">💡 Suggestion: {ins.suggestion}</p>}
                                            </div>
                                        ));
                                    })()
                                ) : (
                                    <p className="text-[10px] text-gray-600 font-bold italic">Chưa có scene nào được tạo để bắt đầu phân tích raccord.</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-950/50 rounded-xl p-4 border border-blue-500/10">
                            <h4 className="text-[10px] font-black text-blue-300 uppercase mb-3 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                                Gợi ý DOP cho cảnh tiếp theo
                            </h4>
                            {scenes.length > 0 ? (
                                (() => {
                                    const lastScene = scenes[scenes.length - 1];
                                    const suggestion = suggestNextShot(lastScene.id);
                                    if (!suggestion) return null;
                                    return (
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <div className="px-2 py-1 bg-brand-orange/20 border border-brand-orange/40 rounded text-brand-orange text-[10px] font-black uppercase">
                                                    {suggestion.action}
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-brand-cream">{suggestion.recommendation.label}</p>
                                                    <p className="text-[10px] text-gray-500 font-medium leading-tight mt-1">{suggestion.recommendation.reason}</p>
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t border-gray-800">
                                                <p className="text-[9px] text-gray-400 uppercase font-black leading-none mb-2">Tip: Raccord de Story Flow</p>
                                                <p className="text-[10px] text-gray-500 italic">"Giữ nhịp điệu: Đừng quên nhân vật còn đang ở trạng thái tâm lý [VUI VẺ/LO LẮNG] từ cảnh {lastScene.sceneNumber}."</p>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* SECONDARY ROW: VEO PRESET CONTROLS */}
            <div className="flex justify-end mb-6">
                <div className="flex items-center gap-1 bg-gray-950/60 p-1 rounded-xl border border-gray-800/80 backdrop-blur-md shadow-xl h-10">
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-3 border-r border-gray-800 h-full flex items-center">Veo Tools:</span>
                    <button
                        onClick={suggestVeoPresets}
                        disabled={isVeoGenerating}
                        className="h-full px-3 text-[9px] font-black text-blue-400 hover:text-blue-300 transition-all uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500/5 rounded-lg"
                        title="AI sẽ tự động chọn Preset tốt nhất"
                    >
                        AI Suggest
                    </button>
                    <div className="w-px h-3 bg-gray-800"></div>
                    <div className="flex items-center px-3 gap-2">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">Preset:</span>
                        <select
                            onChange={(e) => {
                                if (e.target.value) applyPresetToAll(e.target.value);
                            }}
                            className="bg-transparent border-none text-[9px] font-black text-brand-cream outline-none cursor-pointer p-0 transition-all uppercase tracking-wider"
                            defaultValue=""
                        >
                            <option value="" disabled>Select...</option>
                            {VEO_PRESETS.map(p => (
                                <option key={p.value} value={p.value} className="bg-gray-900">{p.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-px h-3 bg-gray-800"></div>
                    <button
                        onClick={() => {
                            const allVeo = scenes.map(s => s.veoPrompt || '').filter(t => t).join('\n\n');
                            if (allVeo) {
                                navigator.clipboard.writeText(allVeo).then(() => alert('📋 Copied all Veo Prompts!'));
                            } else {
                                alert('⚠️ No Veo Prompts to copy.');
                            }
                        }}
                        className="h-full px-3 text-[9px] font-black text-brand-orange hover:text-white transition-all uppercase tracking-widest flex items-center gap-2 hover:bg-brand-orange/5 rounded-lg"
                        title="Copy All Veo Prompts"
                    >
                        Copy All
                    </button>
                </div>
            </div>

            {/* === DETAILED SCRIPT SECTION === */}
            <div className="mb-6 bg-gray-900/30 rounded-2xl border border-gray-800/50 overflow-hidden transition-all duration-300">
                <div
                    onClick={() => setShowDetailedScript(!showDetailedScript)}
                    className="flex justify-between items-center p-4 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg transition-all ${showDetailedScript ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-500'}`}>
                            {showDetailedScript ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                        <label className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-widest cursor-pointer">
                            <span className="text-lg mr-2">📜</span> Kịch bản Chi tiết (Detailed Story)
                        </label>
                    </div>
                    <div className="flex items-center gap-3">
                        {!showDetailedScript && detailedScript && (
                            <span className="text-[9px] text-gray-600 font-bold truncate max-w-md italic">
                                {detailedScript.substring(0, 100)}...
                            </span>
                        )}
                        <span className="text-[9px] font-black text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded uppercase tracking-wider">Reference Mode</span>
                    </div>
                </div>

                {showDetailedScript && (
                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <textarea
                            value={detailedScript}
                            onChange={(e) => onDetailedScriptChange(e.target.value)}
                            placeholder="Nội dung cốt truyện chi tiết sẽ được hiển thị ở đây giúp bạn nắm bắt mạch chuyện..."
                            className="w-full h-48 bg-black/40 text-gray-300 px-4 py-3 rounded-xl border border-gray-800/50 focus:outline-none focus:ring-1 focus:ring-brand-orange text-xs leading-relaxed scrollbar-thin scrollbar-thumb-gray-600 font-mono mb-3"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={onCleanAll}
                                className="flex items-center space-x-2 px-3 py-1.5 text-[9px] font-black text-red-500 hover:text-white hover:bg-red-600/20 rounded-lg border border-red-900/30 transition-all uppercase tracking-widest"
                                title="Xóa toàn bộ kịch bản và scene để làm lại từ đầu"
                            >
                                <Trash2 size={12} />
                                <span>Xóa sạch dự án (Clean All)</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* === LOCAL UTILITY TOOLBAR === */}
            <div className="flex items-center justify-between mb-4 bg-gray-800/20 p-2 rounded-xl border border-gray-700/30">
                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex bg-gray-900/80 p-0.5 rounded-lg border border-gray-700/50 h-9 items-center">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center space-x-2 px-3 h-full rounded-md transition-all ${viewMode === 'table' ? 'bg-brand-orange text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <Table size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Table</span>
                        </button>
                        <button
                            onClick={() => setViewMode('storyboard')}
                            className={`flex items-center space-x-2 px-3 h-full rounded-md transition-all ${viewMode === 'storyboard' ? 'bg-brand-orange text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <LayoutGrid size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Board</span>
                        </button>
                    </div>

                    {/* Group View Controls (Collapse/Expand) */}
                    <div className="flex bg-gray-900/80 p-0.5 rounded-lg border border-gray-700/50 h-9 items-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleAllGroups(true); }}
                            className="flex items-center space-x-2 px-3 h-full rounded-md text-gray-500 hover:text-gray-200 transition-all text-[9px] font-bold uppercase"
                        >
                            <ChevronRight size={12} />
                            <span>Collapse</span>
                        </button>
                        <div className="w-px h-3 bg-gray-700 mx-1"></div>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleAllGroups(false); }}
                            className="flex items-center space-x-2 px-3 h-full rounded-md text-gray-500 hover:text-gray-200 transition-all text-[9px] font-bold uppercase"
                        >
                            <ChevronDown size={12} />
                            <span>Expand</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        {scenes.length} Scenes / {sceneGroups.length} Groups
                    </span>
                </div>
            </div>

            {viewMode === 'table' && (
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 pb-2 text-sm font-bold text-gray-400 border-b-2 border-gray-700">
                    <div className="col-span-1 text-center relative group">Scene <span className="text-brand-orange">(?)</span><Tooltip text="Số thứ tự phân cảnh. Tên file ảnh sẽ được đặt theo cột này." /></div>
                    <div className="col-span-2">Script (Lang 1/Viet)</div>
                    <div className="col-span-2">Tên/Bối cảnh</div>
                    <div className="col-span-3">Veo Video Prompt <span className="text-blue-400">(New)</span></div>
                    <div className="col-span-1">Nhân vật</div>
                    <div className="col-span-3 text-center">Ảnh</div>
                </div>
            )}

            {/* === SCENES LIST WITH GROUPS === */}
            <div className={`mt-4 ${viewMode === 'storyboard' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6' : 'space-y-4'}`}>
                {(() => {
                    const renderedScenes: React.ReactNode[] = [];
                    let currentGroupId: string | undefined | 'initial' = 'initial';

                    scenes.forEach((scene, index) => {
                        // Check if we need to render a Group Header
                        if (scene.groupId !== currentGroupId) {
                            currentGroupId = scene.groupId;
                            const group = sceneGroups?.find(g => g.id === currentGroupId);
                            const groupScenes = scenes.filter(s => s.groupId === currentGroupId);
                            const scenesWithImages = groupScenes.filter(s => s.generatedImage).length;
                            const isCollapsed = isGroupCollapsed(currentGroupId);

                            const groupIdToDelete = currentGroupId;
                            const headerKey = `group-header-${currentGroupId || 'none'}-${index}`;
                            renderedScenes.push(
                                <div key={headerKey}
                                    onClick={() => toggleGroupCollapse(groupIdToDelete)}
                                    className={`col-span-full py-4 flex items-center justify-between border-b border-gray-700/50 mb-2 cursor-pointer hover:bg-white/5 transition-all group ${viewMode === 'table' ? 'px-4' : ''}`}
                                >
                                    <div className="flex items-center space-x-4 flex-1">
                                        {isCollapsed ? <ChevronRight size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-400" />}

                                        {/* Group Concept Thumbnail */}
                                        {group?.conceptImage && (
                                            <div className="w-16 h-10 rounded border border-gray-700 overflow-hidden shadow-lg flex-shrink-0">
                                                <img src={group.conceptImage} alt="Concept" className="w-full h-full object-cover" />
                                            </div>
                                        )}

                                        <div className="flex-1">
                                            {group ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center space-x-3">
                                                        <input
                                                            value={group.name}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                                                            className="bg-transparent border-none text-lg font-bold text-white focus:ring-1 focus:ring-purple-500 rounded px-1 min-w-[200px]"
                                                            placeholder="Group Name"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-black">Group</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${scenesWithImages === groupScenes.length ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                                                                {scenesWithImages}/{groupScenes.length} scenes
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] text-gray-500">
                                                        {group.timeOfDay && (
                                                            <span className="flex items-center gap-1 bg-gray-800/50 px-2 py-0.5 rounded">
                                                                <Clock size={10} /> {group.timeOfDay}
                                                            </span>
                                                        )}
                                                        {group.weather && (
                                                            <span className="flex items-center gap-1 bg-gray-800/50 px-2 py-0.5 rounded">
                                                                <Wind size={10} /> {group.weather}
                                                            </span>
                                                        )}
                                                        {group.lightingMood && (
                                                            <span className="flex items-center gap-1 bg-gray-800/50 px-2 py-0.5 rounded">
                                                                <Sun size={10} /> {group.lightingMood}
                                                            </span>
                                                        )}
                                                        <span className="italic truncate max-w-sm">{group.description || 'No description...'}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-bold text-gray-400">Default Group / Loose Scenes</h3>
                                                    <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                                                        {groupScenes.length} scenes
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                                        {!currentGroupId ? (
                                            <button
                                                onClick={() => {
                                                    const name = prompt("Enter Group Name (e.g., 'On Deck', 'Cabin'):");
                                                    if (name) {
                                                        const gId = createGroup(name);
                                                        assignSceneToGroup(scene.id, gId);
                                                    }
                                                }}
                                                className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-all flex items-center gap-1.5"
                                            >
                                                <Plus size={12} /> New Group
                                            </button>
                                        ) : (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveGroupMenu(activeGroupMenu === currentGroupId ? null : currentGroupId as string);
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg border border-transparent hover:border-gray-700 transition-all font-bold"
                                                >
                                                    •••
                                                </button>

                                                {activeGroupMenu === currentGroupId && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[60] overflow-hidden py-1 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Unassign this scene from group?')) {
                                                                    assignSceneToGroup(scene.id, undefined);
                                                                    setActiveGroupMenu(null);
                                                                }
                                                            }}
                                                            className="w-full text-left px-4 py-2 text-[10px] text-gray-300 hover:bg-gray-800 font-bold uppercase tracking-wider"
                                                        >
                                                            Unassign Scene
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Delete this group? Scenes will be unassigned.')) {
                                                                    deleteGroup(groupIdToDelete!);
                                                                    setActiveGroupMenu(null);
                                                                }
                                                            }}
                                                            className="w-full text-left px-4 py-2 text-[10px] text-red-400 hover:bg-red-500/10 font-bold uppercase tracking-wider border-t border-gray-800"
                                                        >
                                                            Delete Group
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // Skip rendering scenes if group is collapsed
                        if (isGroupCollapsed(currentGroupId)) return null;

                        // Render the Scene (Row or Card)
                        renderedScenes.push(
                            <React.Fragment key={scene.id}>
                                {viewMode === 'table' && (
                                    <>
                                        {/* Insert Button Before each row */}
                                        <div className="relative h-2 group/insert">
                                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-brand-orange/0 group-hover/insert:border-brand-orange/30 transition-all"></div>
                                            <button
                                                onClick={() => insertScene(index)}
                                                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-orange text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-all shadow-xl z-20 hover:scale-125"
                                                title="Chèn phân cảnh mới vào đây"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>

                                        <SceneRow
                                            scene={scene}
                                            scenes={scenes}
                                            index={index}
                                            characters={characters}
                                            products={products}
                                            sceneGroups={sceneGroups}
                                            assignSceneToGroup={assignSceneToGroup}
                                            updateScene={updateScene}
                                            removeScene={removeScene}
                                            generateImage={() => performImageGeneration(scene.id)}
                                            generateEndFrame={() => performImageGeneration(scene.id, undefined, true)}
                                            generateVeoPrompt={generateVeoPrompt}
                                            openImageViewer={() => handleOpenImageViewer(index)}
                                            onCopyPreviousStyle={() => {
                                                if (index > 0) {
                                                    const prev = scenes[index - 1];
                                                    updateScene(scene.id, {
                                                        cameraAngleOverride: prev.cameraAngleOverride,
                                                        customCameraAngle: prev.customCameraAngle,
                                                        lensOverride: prev.lensOverride,
                                                        customLensOverride: prev.customLensOverride,
                                                        transitionType: prev.transitionType,
                                                        customTransitionType: prev.customTransitionType
                                                    });
                                                }
                                            }}
                                            onDragStart={(idx) => setDraggedSceneIndex(idx)}
                                            onDragOver={(idx) => {
                                                if (dragOverIndex !== idx) {
                                                    setDragOverIndex(idx);
                                                }
                                            }}
                                            onDrop={(targetIdx) => {
                                                if (draggedSceneIndex !== null) {
                                                    moveScene(draggedSceneIndex, targetIdx);
                                                }
                                                setDraggedSceneIndex(null);
                                                setDragOverIndex(null);
                                            }}
                                            onInsertAngles={onInsertAngles}
                                        />

                                        {/* Last Insert Button */}
                                        {index === scenes.length - 1 && (
                                            <div className="relative h-2 group/insert">
                                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-brand-orange/0 group-hover/insert:border-brand-orange/30 transition-all"></div>
                                                <button
                                                    onClick={() => insertScene(index + 1)}
                                                    className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-orange text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-all shadow-xl z-20 hover:scale-125"
                                                    title="Thêm phân cảnh mới vào cuối"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {viewMode === 'storyboard' && (
                                    <StoryBoardCard
                                        scene={scene}
                                        index={index}
                                        characters={characters}
                                        products={products}
                                        sceneGroups={sceneGroups}
                                        assignSceneToGroup={assignSceneToGroup}
                                        updateScene={updateScene}
                                        removeScene={removeScene}
                                        generateImage={() => performImageGeneration(scene.id)}
                                        generateEndFrame={() => performImageGeneration(scene.id, undefined, true)}
                                        openImageViewer={() => handleOpenImageViewer(index)}
                                        onDragStart={(idx) => setDraggedSceneIndex(idx)}
                                        onDragOver={(idx) => {
                                            if (dragOverIndex !== idx) {
                                                setDragOverIndex(idx);
                                            }
                                        }}
                                        onDrop={(targetIdx) => {
                                            if (draggedSceneIndex !== null) {
                                                moveScene(draggedSceneIndex, targetIdx);
                                            }
                                            setDraggedSceneIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                        onInsertAngles={onInsertAngles}
                                        generateVeoPrompt={generateVeoPrompt}
                                        scenes={scenes}
                                    />
                                )}
                            </React.Fragment>
                        );
                    });

                    return renderedScenes;
                })()}
            </div>
        </div>
    );
};
