import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useHotkeys } from './hooks/useHotkeys';
import { Header } from './components/common/Header';
import { ProjectNameInput } from './components/common/ProjectNameInput';
import { ApiKeyModal } from './components/modals/ApiKeyModal';
import { CharacterGeneratorModal } from './components/modals/CharacterGeneratorModal';
import { ScriptGeneratorModal } from './components/modals/ScriptGeneratorModal';
import { ImageViewerModal } from './components/modals/ImageViewerModal';
import { CharactersConsistencySection } from './components/sections/CharactersConsistencySection';
import { WeaponProductPropsSection } from './components/sections/WeaponProductPropsSection';
import { StyleSettingsSection } from './components/sections/StyleSettingsSection';
import { ScenesMapSection } from './components/sections/ScenesMapSection';
import { CharacterDetailModal } from './components/modals/CharacterDetailModal';
import { ProductDetailModal } from "./components/ProductDetailModal";
import { AdvancedImageEditor } from './components/modals/AdvancedImageEditor';
import { ScreenplayModal } from './components/modals/ScreenplayModal';
import { AuthModal } from './components/modals/AuthModal';
import { ProjectBrowserModal } from './components/modals/ProjectBrowserModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { ActivationScreen } from './components/ActivationScreen';
import { APP_NAME, PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from './constants/presets';
import { handleDownloadAll } from './utils/zipUtils';
import { Scene } from './types';
import { generateId } from './utils/helpers';


// Import Hooks
import { useStateManager } from './hooks/useStateManager';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useScriptGeneration } from './hooks/useScriptGeneration';
import { useCharacterLogic } from './hooks/useCharacterLogic';
import { useProductLogic } from './hooks/useProductLogic';
import { useSceneLogic } from './hooks/useSceneLogic';
import { useVideoGeneration } from './hooks/useVideoGeneration';
import { useAuth } from './hooks/useAuth';
import { useProjectSync } from './hooks/useProjectSync';
import { supabase } from './utils/supabaseClient';

const App: React.FC = () => {
    const { session, profile, isPro, subscriptionExpired, loading, signOut } = useAuth();
    // Core State & History
    const {
        state,
        updateStateAndRecord,
        undo,
        redo,
        handleSave,
        handleOpen,
        handleNewProject,
        stateRef,
        history
    } = useStateManager();

    // UI State
    const [zoom, setZoom] = useState(1);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    const [isScriptModalOpen, setScriptModalOpen] = useState(false);
    const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
    const [headerSticky, setHeaderSticky] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
    const [isContinuityMode, setIsContinuityMode] = useState(true);
    const [isOutfitLockMode, setIsOutfitLockMode] = useState(true);
    const [isImageViewerOpen, setImageViewerOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'table' | 'storyboard'>('table');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingImage, setEditingImage] = useState<any>(null);
    const [charGenState, setCharGenState] = useState<{ isOpen: boolean; charId: string | null }>({ isOpen: false, charId: null });
    const [isScreenplayModalOpen, setScreenplayModalOpen] = useState(false);
    const [draggedSceneIndex, setDraggedSceneIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);


    // Cloud Sync State
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [isProjectBrowserOpen, setProjectBrowserOpen] = useState(false);
    const [cloudProjects, setCloudProjects] = useState<any[]>([]);

    const mainContentRef = useRef<HTMLDivElement>(null);

    // Functional Hooks
    const {
        isBatchGenerating,
        isStopping,
        performImageGeneration,
        generateGroupConcept,
        handleGenerateAllImages,
        stopBatchGeneration
    } = useImageGeneration(state, stateRef, updateStateAndRecord, userApiKey, setProfileModalOpen, isContinuityMode, session?.user.id, isOutfitLockMode);

    const {
        isScriptGenerating,
        handleGenerateScript,
        handleRegenerateGroup,
        handleSmartMapAssets
    } = useScriptGeneration(state, updateStateAndRecord, userApiKey, setProfileModalOpen);

    const {
        updateCharacter,
        addCharacter,
        deleteCharacter,
        setDefaultCharacter,
        analyzeCharacterImage,
        analyzeAndGenerateSheets,
        generateCharacterSheets,
        generateCharacterImage
    } = useCharacterLogic(state, updateStateAndRecord, userApiKey, setProfileModalOpen, session?.user.id);

    const {
        addProduct,
        deleteProduct,
        updateProduct,
        handleProductMasterImageUpload,
        handleGenerateProductFromPrompt
    } = useProductLogic(state, updateStateAndRecord, userApiKey, setProfileModalOpen, session?.user.id);

    const {
        addScene,
        updateScene,
        removeScene,
        insertScene,
        moveScene,
        handleScriptUpload,
        triggerFileUpload,
        createGroup: addSceneGroup,
        updateGroup: updateSceneGroup,
        deleteGroup: deleteSceneGroup,
        assignSceneToGroup,
        applyGeneratedScript
    } = useSceneLogic(state, updateStateAndRecord);

    const {
        isVeoGenerating,
        isVideoGenerating,
        generateVeoPrompt,
        handleGenerateAllVeoPrompts,
        handleGenerateAllVideos,
        suggestVeoPresets,
        applyPresetToAll,
    } = useVideoGeneration(state, updateStateAndRecord, userApiKey, setProfileModalOpen);

    const {
        loading: projectLoading,
        error: projectError,
        saveProjectToCloud,
        fetchProjects,
        loadProjectFromCloud,
        deleteProjectFromCloud
    } = useProjectSync(session?.user?.id);

    const handleSignOut = async () => {
        await signOut();
        setProfileModalOpen(false);
        setShowSuccessToast("Đã đăng xuất thành công!");
        setTimeout(() => setShowSuccessToast(null), 3000);
    };

    // Hotkeys
    useHotkeys([
        { keys: 'ctrl+s', callback: handleSave },
        { keys: 'ctrl+o', callback: handleOpen },
        { keys: 'ctrl+z', callback: undo },
        { keys: 'ctrl+y', callback: redo },
        { keys: 'ctrl+shift+z', callback: redo },
    ]);

    // Handle Insert Angles: Create new scenes with different camera angles from source image
    const handleInsertAngles = useCallback(async (sourceSceneId: string, angles: string[], sourceImage: string) => {
        const sourceScene = state.scenes.find(s => s.id === sourceSceneId);
        if (!sourceScene) return;

        const sourceIndex = state.scenes.findIndex(s => s.id === sourceSceneId);

        // Map angle values to readable names for prompt
        const angleNameMap: Record<string, string> = {
            'wide_shot': 'Wide Shot (WS)',
            'medium_shot': 'Medium Shot (MS)',
            'close_up': 'Close Up (CU)',
            'extreme_close_up': 'Extreme Close Up (ECU)',
            'low_angle': 'Low Angle (Worm Eye View)',
            'high_angle': 'High Angle (Bird Eye View)',
            'over_shoulder': 'Over The Shoulder Shot (OTS)',
            'dutch_angle': 'Dutch Angle (Tilted Frame)',
        };

        // Create new scenes for each angle
        const newScenes: Scene[] = angles.map((angle, i) => ({
            id: generateId(),
            sceneNumber: `${sourceIndex + 2 + i}`, // Will be renumbered
            groupId: sourceScene.groupId,
            language1: sourceScene.language1,
            vietnamese: sourceScene.vietnamese,
            promptName: `${sourceScene.promptName || 'Scene'} - ${angleNameMap[angle] || angle}`,
            contextDescription: `${sourceScene.contextDescription}\n\n[CAMERA ANGLE: ${angleNameMap[angle] || angle}]`,
            visualDescription: sourceScene.visualDescription,
            characterIds: [...sourceScene.characterIds],
            productIds: [...(sourceScene.productIds || [])],
            cameraAngleOverride: angle === 'custom' ? '' : angle,
            generatedImage: null,
            veoPrompt: '',
            isGenerating: true, // Start as generating
            error: null,
        }));

        // Insert new scenes after source scene and renumber
        updateStateAndRecord(s => {
            const updatedScenes = [...s.scenes];
            updatedScenes.splice(sourceIndex + 1, 0, ...newScenes);
            const renumbered = updatedScenes.map((sc, idx) => ({
                ...sc,
                sceneNumber: `${idx + 1}`
            }));
            return { ...s, scenes: renumbered };
        });

        // Generate images for each new scene (with small delay between each)
        for (let i = 0; i < newScenes.length; i++) {
            setTimeout(() => {
                performImageGeneration(newScenes[i].id);
            }, i * 500); // 500ms delay between each
        }
    }, [state.scenes, updateStateAndRecord, performImageGeneration]);


    // Sticky Header Scroll Listener
    useEffect(() => {
        const handleScroll = () => {
            if (mainContentRef.current) setHeaderSticky(mainContentRef.current.scrollTop > 50);
        };
        const mainContent = mainContentRef.current;
        mainContent?.addEventListener('scroll', handleScroll);
        return () => mainContent?.removeEventListener('scroll', handleScroll);
    }, []);


    // State Hydration & Supabase Key Fetch with Realtime Updates
    useEffect(() => {
        if (session?.user?.id) {
            const userId = session.user.id;

            // Initial fetch
            const fetchApiKey = async () => {
                const { data, error } = await supabase
                    .from('user_api_keys')
                    .select('encrypted_key')
                    .eq('user_id', userId)
                    .eq('provider', 'gemini')
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle();

                if (data && !error) {
                    setUserApiKey(data.encrypted_key);
                    localStorage.setItem('geminiApiKey', data.encrypted_key);
                    console.log('[API Key] ✅ Loaded from Supabase');
                }
            };
            fetchApiKey();

            // Realtime subscription for admin updates
            const channel = supabase
                .channel('api-key-updates')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'user_api_keys',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload: any) => {
                        console.log('[API Key] 🔄 Realtime update received:', payload.eventType);
                        if (payload.new?.encrypted_key && payload.new?.is_active) {
                            setUserApiKey(payload.new.encrypted_key);
                            localStorage.setItem('geminiApiKey', payload.new.encrypted_key);
                            console.log('[API Key] ✅ Updated from admin');
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } else {
            // When logged out, we can decide whether to clear the key or keep local one
            // setUserApiKey(''); 
        }
    }, [session]);


    useEffect(() => {
        // Hydration logic if any
    }, [updateStateAndRecord]);

    // Derived Handlers
    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateStateAndRecord(s => ({ ...s, projectName: e.target.value.toUpperCase() }));
    };

    const handleStylePromptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateStateAndRecord(s => ({ ...s, stylePrompt: e.target.value }));
    };

    const handleImageModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateStateAndRecord(s => ({ ...s, imageModel: e.target.value }));
    };

    const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateStateAndRecord(s => ({ ...s, aspectRatio: e.target.value }));
    };

    const handleScriptLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateStateAndRecord(s => ({ ...s, scriptLanguage: e.target.value as any }));
    };

    const analyzeStyleFromImage = useCallback(async (imageData: string) => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;

        if (!apiKey) {
            setProfileModalOpen(true);
            return;
        }

        setIsAnalyzingStyle(true);

        try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });

            let data: string;
            let mimeType: string = 'image/jpeg';

            if (imageData.startsWith('data:')) {
                const [header, base64Data] = imageData.split(',');
                data = base64Data;
                mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            } else {
                throw new Error('Invalid image format');
            }

            const analyzePrompt = `Analyze the artistic style of this image in detail. Provide a comprehensive prompt that could be used to generate images in the exact same style.

Return the style description in English, including:
1. Art style (photorealistic, anime, watercolor, oil painting, digital art, etc.)
2. Color palette and mood
3. Lighting characteristics
4. Texture and detail level
5. Composition tendencies
6. Any distinctive visual elements

Format as a single paragraph of style instructions, suitable for use as an AI image generation prompt. Be specific and detailed.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: { parts: [{ inlineData: { data, mimeType } }, { text: analyzePrompt }] }
            });

            // Extract text from Gemini response - handle multiple formats
            let styleDescription = '';
            try {
                // Try different ways to get the text
                const candidate = response.candidates?.[0];
                const textPart = candidate?.content?.parts?.find((p: any) => p.text);
                styleDescription = textPart?.text || '';
            } catch (e) {
                console.error('Failed to extract text from response:', e);
            }

            if (styleDescription) {
                updateStateAndRecord(s => ({
                    ...s,
                    stylePrompt: 'custom',
                    customStyleInstruction: styleDescription.trim(),
                    customStyleImage: imageData // Save the image itself for visual reference
                }));
            } else {
                throw new Error('Không nhận được kết quả từ AI');
            }


        } catch (error: any) {
            console.error('Style analysis failed:', error);
            alert(`❌ Không thể phân tích style: ${error.message}`);
        } finally {
            setIsAnalyzingStyle(false);
        }
    }, [userApiKey, updateStateAndRecord]);

    const closeEditor = useCallback(() => {
        setIsEditorOpen(false);
    }, []);

    const openEditor = (id: string, image: string, type: any, propIndex?: number, viewKey?: string) => {
        // ... (existing logic to find history if it exists)
        let editorHistory = undefined;
        if (type === 'scene') {
            editorHistory = state.scenes.find(s => s.id === id)?.editHistory;
        } else if (['master', 'face', 'body', 'side', 'back'].includes(type) || viewKey) {
            editorHistory = state.characters.find(c => c.id === id)?.editHistory;
        }

        setEditingImage({ id, image, type, propIndex, viewKey, history: editorHistory });
        setIsEditorOpen(true);
    };

    const handleEditorSave = (newImage: string, history: any[], savedViewKey?: string) => {
        if (!editingImage) return;
        const { id, type, propIndex, viewKey: initialViewKey } = editingImage;
        const viewKey = savedViewKey || initialViewKey;

        if (type === 'prop' && typeof propIndex === 'number') {
            const char = state.characters.find(c => c.id === id);
            if (char) {
                const newProps = [...char.props];
                newProps[propIndex] = { ...newProps[propIndex], image: newImage };
                updateCharacter(id, { props: newProps });
            }
        } else if (type === 'master' || viewKey === 'master') updateCharacter(id, { masterImage: newImage, editHistory: history });
        else if (type === 'face' || viewKey === 'face') updateCharacter(id, { faceImage: newImage, editHistory: history });
        else if (type === 'body' || viewKey === 'body') updateCharacter(id, { bodyImage: newImage, editHistory: history });
        else if (type === 'side' || viewKey === 'side') updateCharacter(id, { sideImage: newImage, editHistory: history });
        else if (type === 'back' || viewKey === 'back') updateCharacter(id, { backImage: newImage, editHistory: history });
        else if (type === 'scene') updateScene(id, { generatedImage: newImage, editHistory: history });
        else if (type === 'product') {
            if (viewKey) {
                const product = state.products.find(p => p.id === id);
                if (product) updateProduct(id, { views: { ...product.views, [viewKey]: newImage } });
            } else updateProduct(id, { masterImage: newImage, editHistory: history });
        }
    };

    const handleCharGenSave = (image: string) => {
        if (charGenState.charId) updateCharacter(charGenState.charId, { masterImage: image });
    };

    const handleOpenImageViewer = (index: number) => {
        setCurrentImageIndex(index);
        setImageViewerOpen(true);
    };

    const handleCloudSave = async () => {
        if (!session) return;
        const nameToSave = state.projectName.trim() || 'Dự án chưa đặt tên';
        const { data, error } = await saveProjectToCloud(state, currentProjectId || undefined, profile?.subscription_tier);

        if (data) {
            setCurrentProjectId(data.id);
            setShowSuccessToast(`Đã lưu "${nameToSave}" thành công!`);
            setTimeout(() => setShowSuccessToast(null), 3000);
        } else {
            alert(`Lỗi khi lưu Cloud: ${error || 'Lỗi không xác định'}`);
        }
    };

    const handleCloudOpen = async () => {
        if (!session) return;
        const projects = await fetchProjects();
        setCloudProjects(projects);
        setProjectBrowserOpen(true);
    };

    const handleLoadProject = async (id: string) => {
        const { data, error } = await loadProjectFromCloud(id);
        if (data) {
            updateStateAndRecord(() => data);
            setCurrentProjectId(id);
            setProjectBrowserOpen(false);
            setShowSuccessToast('Đã tải dự án thành công!');
            setTimeout(() => setShowSuccessToast(null), 2000);
        } else {
            alert(`Lỗi khi tải dự án: ${error || 'Lỗi không xác định'}`);
        }
    };

    const handleDeleteProject = async (id: string) => {
        const { success, error } = await deleteProjectFromCloud(id);
        if (success) {
            setCloudProjects(prev => prev.filter(p => p.id !== id));
            if (currentProjectId === id) setCurrentProjectId(null);
        } else {
            alert(`Lỗi khi xóa: ${error || 'Lỗi không xác định'}`);
        }
    };

    return (
        <div className="h-screen w-screen bg-brand-dark text-brand-cream overflow-hidden relative">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-brand-cream/60 animate-pulse text-xs font-bold tracking-widest uppercase">Khởi tạo ứng dụng...</p>
                </div>
            ) : session && !isPro ? (
                <ActivationScreen email={session.user.email} onSignOut={handleSignOut} />
            ) : (
                <>
                    {/* Cloud Operation Overlay */}
                    {projectLoading && (
                        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
                            <div className="w-16 h-16 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mb-6"></div>
                            <h2 className="text-2xl font-bold text-white mb-2 tracking-widest uppercase">Cloud Syncing</h2>
                            <p className="text-brand-cream/60 animate-pulse text-sm">Đang tải dữ liệu và hình ảnh lên đám mây...</p>
                        </div>
                    )}

                    {/* Success Toast */}
                    {showSuccessToast && (
                        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[101] bg-brand-orange text-white px-8 py-4 rounded-2xl shadow-2xl animate-slide-up flex items-center space-x-3 border border-white/20">
                            <div className="bg-white/20 p-1 rounded-full text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <span className="font-bold text-lg">{showSuccessToast}</span>
                        </div>
                    )}
                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-brand-orange/20 rounded-full filter blur-3xl animate-pulse-slow"></div>
                        <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 bg-brand-red/10 rounded-full filter blur-3xl animate-pulse-slow delay-1000"></div>
                    </div>

                    <Header
                        isSticky={headerSticky}
                        onSave={handleSave}
                        onOpen={handleOpen}
                        onNewProject={handleNewProject}
                        onDownloadAll={() => handleDownloadAll(state)}
                        canDownload={state.scenes.some(s => s.generatedImage) || state.characters.some(c => c.masterImage) || state.products.some(p => p.masterImage)}
                        isContinuityMode={isContinuityMode}
                        toggleContinuityMode={() => setIsContinuityMode(!isContinuityMode)}
                        onUndo={undo}
                        onRedo={redo}
                        canUndo={history.past.length > 0}
                        canRedo={history.future.length > 0}
                        isLoggedIn={!!session}
                        onCloudSave={handleCloudSave}
                        onCloudOpen={handleCloudOpen}
                        onProfileClick={() => setProfileModalOpen(true)}
                        profile={profile}
                        subscriptionExpired={subscriptionExpired}
                    />

                    <main ref={mainContentRef} className="h-full w-full overflow-auto pt-20">
                        <div className="transition-transform duration-200 ease-out" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                            <div className="container mx-auto px-6 pb-24">
                                <ProjectNameInput value={state.projectName} onChange={handleProjectNameChange} />

                                <CharactersConsistencySection
                                    characters={state.characters}
                                    onSetDefaultCharacter={setDefaultCharacter}
                                    onDeleteCharacter={deleteCharacter}
                                    onUpdateCharacter={updateCharacter}
                                    onSetEditingCharacterId={setEditingCharacterId}
                                    onAddCharacter={addCharacter}
                                />

                                <WeaponProductPropsSection
                                    products={state.products}
                                    onEditProduct={setEditingProductId}
                                    onDeleteProduct={deleteProduct}
                                    onAddProduct={addProduct}
                                />

                                <StyleSettingsSection
                                    stylePrompt={state.stylePrompt}
                                    onStylePromptChange={handleStylePromptChange}
                                    customStyleInstruction={state.customStyleInstruction || ''}
                                    onCustomStyleInstructionChange={(val) => updateStateAndRecord(s => ({ ...s, customStyleInstruction: val }))}
                                    isContinuityMode={isContinuityMode}
                                    toggleContinuityMode={() => setIsContinuityMode(!isContinuityMode)}
                                    isOutfitLockMode={isOutfitLockMode}
                                    toggleOutfitLockMode={() => setIsOutfitLockMode(!isOutfitLockMode)}
                                    onAnalyzeStyleFromImage={analyzeStyleFromImage}
                                    isAnalyzingStyle={isAnalyzingStyle}
                                    imageModel={state.imageModel}
                                    onImageModelChange={handleImageModelChange}
                                    scriptModel={state.scriptModel || 'gemini-2.5-flash'}
                                    onScriptModelChange={(e) => updateStateAndRecord(s => ({ ...s, scriptModel: e.target.value }))}
                                    resolution={state.resolution}
                                    onResolutionChange={(val) => updateStateAndRecord(s => ({ ...s, resolution: val }))}
                                    aspectRatio={state.aspectRatio}
                                    onAspectRatioChange={handleAspectRatioChange}
                                    scriptLanguage={state.scriptLanguage}
                                    onScriptLanguageChange={handleScriptLanguageChange}
                                    customScriptLanguage={state.customScriptLanguage || ''}
                                    onCustomScriptLanguageChange={(val) => updateStateAndRecord(s => ({ ...s, customScriptLanguage: val }))}
                                    cameraModel={state.cameraModel || 'auto'}
                                    onCameraModelChange={(val) => updateStateAndRecord(s => ({ ...s, cameraModel: val }))}
                                    customCameraModel={state.customCameraModel || ''}
                                    onCustomCameraModelChange={(val) => updateStateAndRecord(s => ({ ...s, customCameraModel: val }))}
                                    defaultLens={state.defaultLens || 'auto'}
                                    onDefaultLensChange={(val) => updateStateAndRecord(s => ({ ...s, defaultLens: val }))}
                                    customDefaultLens={state.customDefaultLens || ''}
                                    onCustomDefaultLensChange={(val) => updateStateAndRecord(s => ({ ...s, customDefaultLens: val }))}
                                    customMetaTokens={state.customMetaTokens || ''}
                                    onCustomMetaTokensChange={(val) => updateStateAndRecord(s => ({ ...s, customMetaTokens: val }))}
                                    onOpenScriptGenerator={() => setScriptModalOpen(true)}
                                    isScriptGenerating={isScriptGenerating}
                                    onTriggerFileUpload={triggerFileUpload}
                                />

                                <ScenesMapSection
                                    scenes={state.scenes}
                                    viewMode={viewMode}
                                    setViewMode={setViewMode}
                                    characters={state.characters}
                                    products={state.products || []}
                                    updateScene={updateScene}
                                    removeScene={removeScene}
                                    insertScene={insertScene}
                                    moveScene={moveScene}
                                    performImageGeneration={performImageGeneration}
                                    handleOpenImageViewer={handleOpenImageViewer}
                                    handleGenerateAllImages={handleGenerateAllImages}
                                    isBatchGenerating={isBatchGenerating}
                                    isStopping={isStopping}
                                    stopBatchGeneration={stopBatchGeneration}
                                    handleGenerateAllVeoPrompts={handleGenerateAllVeoPrompts}
                                    generateVeoPrompt={generateVeoPrompt}
                                    suggestVeoPresets={suggestVeoPresets}
                                    applyPresetToAll={applyPresetToAll}
                                    isVeoGenerating={isVeoGenerating}
                                    handleGenerateAllVideos={handleGenerateAllVideos}
                                    isVideoGenerating={isVideoGenerating}
                                    addScene={addScene}
                                    detailedScript={state.detailedScript || ''}
                                    onDetailedScriptChange={(val) => updateStateAndRecord(s => ({ ...s, detailedScript: val }))}
                                    onCleanAll={() => {
                                        if (confirm('⚠️ Bạn có chắc muốn xóa toàn bộ kịch bản?')) {
                                            updateStateAndRecord(s => ({ ...s, scenes: [], sceneGroups: [], detailedScript: '' }));
                                        }
                                    }}
                                    createGroup={addSceneGroup} // Assuming these might be renamed or available via hook
                                    updateGroup={updateSceneGroup}
                                    deleteGroup={deleteSceneGroup}
                                    assignSceneToGroup={assignSceneToGroup}
                                    sceneGroups={state.sceneGroups || []}
                                    draggedSceneIndex={draggedSceneIndex}
                                    setDraggedSceneIndex={setDraggedSceneIndex}
                                    dragOverIndex={dragOverIndex}
                                    setDragOverIndex={setDragOverIndex}
                                    onClearAllImages={() => {
                                        updateStateAndRecord(s => ({
                                            ...s,
                                            scenes: s.scenes.map(scene => ({
                                                ...scene,
                                                generatedImage: null,
                                                endFrameImage: null,
                                                mediaId: null
                                            }))
                                        }));
                                    }}
                                    onInsertAngles={handleInsertAngles}
                                />
                                <div className="flex justify-end mt-8 gap-4">
                                    <button
                                        onClick={() => setScreenplayModalOpen(true)}
                                        className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg flex items-center gap-2 border border-purple-500/30 transition-all active:scale-95 text-xs font-bold"
                                    >
                                        📄 XUẤT KỊCH BẢN
                                    </button>
                                </div>
                            </div>
                        </div>
                    </main>

                    {zoom !== 1 && (
                        <button
                            onClick={() => setZoom(1)}
                            className={`absolute top-24 right-6 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all shadow-lg animate-fade-in`}
                        >
                            Reset Zoom (100%)
                        </button>
                    )}

                    <UserProfileModal
                        isOpen={isProfileModalOpen}
                        onClose={() => setProfileModalOpen(false)}
                        profile={profile}
                        session={session}
                        apiKey={userApiKey}
                        setApiKey={(key: string) => {
                            setUserApiKey(key);
                            localStorage.setItem('geminiApiKey', key);
                        }}
                        subscriptionExpired={subscriptionExpired}
                        onSignOut={handleSignOut}
                    />

                    <ScriptGeneratorModal
                        isOpen={isScriptModalOpen}
                        onClose={() => setScriptModalOpen(false)}
                        onGenerate={handleGenerateScript}
                        isGenerating={isScriptGenerating}
                        activePresetId={state.activeScriptPreset}
                        customPresets={state.customScriptPresets}
                        onPresetChange={(id) => updateStateAndRecord(s => ({ ...s, activeScriptPreset: id }))}
                        characters={state.characters}
                        products={state.products || []}
                        customInstruction={state.customScriptInstruction}
                        onCustomInstructionChange={(val) => updateStateAndRecord(s => ({ ...s, customScriptInstruction: val }))}
                        onAddPreset={(p) => updateStateAndRecord(s => ({ ...s, customScriptPresets: [...s.customScriptPresets, p] }))}
                        onApplyGenerated={applyGeneratedScript}
                        onRegenerateGroup={handleRegenerateGroup}
                        onGenerateMoodboard={generateGroupConcept}
                        scriptModel={state.scriptModel || 'gemini-2.5-flash'}
                        onScriptModelChange={(e) => updateStateAndRecord(s => ({ ...s, scriptModel: e.target.value }))}
                        onSmartMapAssets={handleSmartMapAssets}
                    />

                    <ScreenplayModal
                        isOpen={isScreenplayModalOpen}
                        onClose={() => setScreenplayModalOpen(false)}
                        state={state}
                    />

                    <CharacterDetailModal
                        isOpen={!!editingCharacterId}
                        onClose={() => setEditingCharacterId(null)}
                        character={state.characters.find(c => c.id === editingCharacterId) || null}
                        updateCharacter={updateCharacter}
                        setDefault={setDefaultCharacter}
                        onAnalyze={analyzeAndGenerateSheets}
                        onGenerateSheets={generateCharacterSheets}
                        onEditImage={openEditor}
                        onOpenCharGen={(id) => setCharGenState({ isOpen: true, charId: id })}
                        onDelete={deleteCharacter}
                    />

                    <CharacterGeneratorModal
                        isOpen={charGenState.isOpen}
                        onClose={() => setCharGenState({ isOpen: false, charId: null })}
                        onSave={handleCharGenSave}
                        apiKey={userApiKey}
                        model={state.imageModel}
                        charId={charGenState.charId}
                        updateCharacter={updateCharacter}
                        generateCharacterImage={generateCharacterImage}
                        characters={state.characters}
                    />

                    <AdvancedImageEditor
                        isOpen={isEditorOpen}
                        onClose={closeEditor}
                        sourceImage={editingImage?.image || ''}
                        onSave={handleEditorSave}
                        apiKey={userApiKey}
                        initialHistory={editingImage?.history}
                        character={editingImage?.type && ['master', 'face', 'body', 'side', 'back', 'prop'].includes(editingImage.type) ? state.characters.find(c => c.id === editingImage.id) : undefined}
                        product={editingImage?.type === 'product' ? state.products.find(p => p.id === editingImage.id) : undefined}
                        activeView={editingImage?.viewKey || editingImage?.type}
                    />

                    <ImageViewerModal
                        isOpen={isImageViewerOpen}
                        onClose={() => setImageViewerOpen(false)}
                        scenes={state.scenes}
                        currentIndex={currentImageIndex}
                        onNavigate={setCurrentImageIndex}
                        onRegenerate={performImageGeneration}
                        onEdit={(id, img) => openEditor(id, img, 'scene')}
                    />

                    <ProductDetailModal
                        isOpen={!!editingProductId}
                        onClose={() => setEditingProductId(null)}
                        product={state.products?.find(p => p.id === editingProductId) || null}
                        updateProduct={updateProduct}
                        onMasterImageUpload={handleProductMasterImageUpload}
                        onDelete={deleteProduct}
                        onGenerateProduct={handleGenerateProductFromPrompt}
                        onEdit={(id, img, view) => openEditor(id, img, 'product', undefined, view)}
                    />

                    {!session && <AuthModal isOpen={true} />}

                    <ProjectBrowserModal
                        isOpen={isProjectBrowserOpen}
                        onClose={() => setProjectBrowserOpen(false)}
                        projects={cloudProjects}
                        onLoad={handleLoadProject}
                        onDelete={handleDeleteProject}
                        loading={projectLoading}
                    />

                    <input
                        id="script-upload-input"
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleScriptUpload}
                    />
                </>
            )}
        </div>
    );
};

export default App;
