import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useHotkeys } from './hooks/useHotkeys';
import { Image as ImageIcon } from 'lucide-react';
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
import UnifiedProductionHub from './components/common/UnifiedProductionHub';

import { AdvancedImageEditor } from './components/modals/AdvancedImageEditor';
import { ScreenplayModal } from './components/modals/ScreenplayModal';
import { AuthModal } from './components/modals/AuthModal';
import { ProjectBrowserModal } from './components/modals/ProjectBrowserModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { ManualScriptModal } from './components/modals/ManualScriptModal';
import { ExcelImportModal } from './components/modals/ExcelImportModal';
import { ActivationScreen } from './components/ActivationScreen';
import { AssetLibrary } from './components/sections/AssetLibrary';
import { KeyboardShortcuts } from './components/common/KeyboardShortcuts';
import { APP_NAME, PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from './constants/presets';
import { handleDownloadAll } from './utils/zipUtils';
import {
    ProjectState,
    ScriptPreset,
    DirectorPreset,
    Character,
    Product,
    Scene,
    AgentStatus,
    AgentState,
    ProductionLogEntry,
    CharacterStyleDefinition,
    GenerationConfig
} from './types';
import { generateId } from './utils/helpers';



// Import Hooks
import { fetchUserStatsFromCloud } from './utils/storageUtils';
import { useStateManager } from './hooks/useStateManager';
import { useImageGeneration } from './hooks/useImageGeneration';
import { useScriptGeneration } from './hooks/useScriptGeneration';
import { useCharacterLogic } from './hooks/useCharacterLogic';
import { useProductLogic } from './hooks/useProductLogic';
import { useSceneLogic } from './hooks/useSceneLogic';
import { useDOPLogic } from './hooks/useDOPLogic';
import { useVideoGeneration } from './hooks/useVideoGeneration';
import { useAuth } from './hooks/useAuth';
import { useProjectSync } from './hooks/useProjectSync';
import { useSequenceExpansion } from './hooks/useSequenceExpansion'; // [New Hook]
import { useDirectorChat } from './hooks/useDirectorChat';
import { useProductionLogger } from './hooks/useProductionLogger';
import { useGallery } from './hooks/useGallery';
import { useEditorLogic } from './hooks/useEditorLogic';
import { useStyleAnalysis } from './hooks/useStyleAnalysis';

import { supabase } from './utils/supabaseClient';


const App: React.FC = () => {
    const { session, profile, isPro, subscriptionExpired, loading, signOut } = useAuth();
    // Core State & History
    // --- Core State & History ---
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

    // --- Helper Logic ---


    // --- Helper Logic ---
    const { addToGallery } = useGallery(updateStateAndRecord);
    const [zoom, setZoom] = useState(1);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);

    // --- AI Agent Helper ---
    const { addProductionLog, setAgentState } = useProductionLogger(state, updateStateAndRecord);

    const [isScriptModalOpen, setScriptModalOpen] = useState(false);

    const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
    const [headerSticky, setHeaderSticky] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
    const [isContinuityMode, setIsContinuityMode] = useState(true);
    const [isOutfitLockMode, setIsOutfitLockMode] = useState(true);
    const [isDOPEnabled, setIsDOPEnabled] = useState(true); // DOP ON by default
    const [isImageViewerOpen, setImageViewerOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'table' | 'storyboard'>('table');

    // Editor & Analysis State extracted to hooks

    const [charGenState, setCharGenState] = useState<{ isOpen: boolean; charId: string | null; initialPrompt?: string }>({ isOpen: false, charId: null, initialPrompt: '' });
    const [isScreenplayModalOpen, setScreenplayModalOpen] = useState(false);
    const [draggedSceneIndex, setDraggedSceneIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);


    // Cloud Sync State
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [isProjectBrowserOpen, setProjectBrowserOpen] = useState(false);
    const [isLibraryOpen, setLibraryOpen] = useState(false);
    const [isManualScriptModalOpen, setManualScriptModalOpen] = useState(false);
    const [isExcelImportModalOpen, setExcelImportModalOpen] = useState(false);
    const [cloudProjects, setCloudProjects] = useState<any[]>([]);

    const mainContentRef = useRef<HTMLDivElement>(null);

    const {
        isScriptGenerating,
        handleGenerateScript,
        handleRegenerateGroup,
        handleSmartMapAssets
    } = useScriptGeneration(state, updateStateAndRecord, userApiKey, setProfileModalOpen, setAgentState);



    const {
        addCharacter,
        updateCharacter,
        deleteCharacter,
        setDefaultCharacter,
        analyzeAndGenerateSheets,
        generateCharacterSheets,
        generateCharacterImage
    } = useCharacterLogic(state, updateStateAndRecord, userApiKey, setProfileModalOpen, session?.user.id, addToGallery, setAgentState);


    const {
        addProduct,
        updateProduct,
        deleteProduct,
        handleProductMasterImageUpload,
        handleGenerateProductFromPrompt
    } = useProductLogic(state, updateStateAndRecord, userApiKey, setProfileModalOpen, session?.user.id, addToGallery, setAgentState);


    const {
        addScene,
        updateScene,
        removeScene,
        insertScene,
        moveScene,
        assignSceneToGroup,
        createGroup: addSceneGroup,
        updateGroup: updateSceneGroup,
        deleteGroup: deleteSceneGroup,
        handleScriptUpload,
        triggerFileUpload,
        applyGeneratedScript
    } = useSceneLogic(state, updateStateAndRecord, setAgentState);


    const {
        analyzeRaccord,
        suggestNextShot,
        validateRaccordWithVision,
        classifyErrors,
        makeRetryDecision
    } = useDOPLogic(state);

    const {
        performImageGeneration,
        isBatchGenerating,
        isStopping,
        stopBatchGeneration,
        handleGenerateAllImages,
        generateGroupConcept
    } = useImageGeneration(
        state,
        stateRef,
        updateStateAndRecord,
        userApiKey,
        setProfileModalOpen,
        isContinuityMode,
        setAgentState,
        addProductionLog,
        session?.user?.id,

        isOutfitLockMode,
        addToGallery,
        isDOPEnabled,
        validateRaccordWithVision,
        makeRetryDecision
    );

    // --- Director Chat Hook ---
    const handleClearAllImages = useCallback(() => {
        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(sc => ({
                ...sc,
                generatedImage: null,
                endFrameImage: null,
                mediaId: null
            }))
        }));
    }, [updateStateAndRecord]);

    const { handleCommand: handleDirectorCommand } = useDirectorChat({
        state,
        userApiKey,
        setAgentState,
        addProductionLog,
        stopBatchGeneration,
        updateStateAndRecord,
        handleGenerateAllImages,
        addScene,
        removeScene,
        insertScene,
        onClearAllImages: handleClearAllImages
    });




    const {
        isVeoGenerating,
        isVeoStopping,
        isVideoGenerating,
        generateVeoPrompt,
        handleGenerateAllVeoPrompts,
        handleGenerateAllVideos,
        suggestVeoPresets,
        applyPresetToAll,
        stopVeoGeneration,
    } = useVideoGeneration(state, updateStateAndRecord, userApiKey, setProfileModalOpen, setAgentState, addProductionLog);

    const {
        loading: projectLoading,
        error: projectError,
        saveProjectToCloud,
        fetchProjects,
        loadProjectFromCloud,
        deleteProjectFromCloud
    } = useProjectSync(session?.user?.id || null);

    // --- Extracted Hooks ---
    const {
        isEditorOpen,
        editingImage,
        openEditor,
        closeEditor,
        handleEditorSave
    } = useEditorLogic({
        state,
        updateCharacter,
        updateScene,
        updateProduct,
        addToGallery
    });

    const {
        analyzeStyleFromImage,
        isAnalyzingStyle
    } = useStyleAnalysis(userApiKey, updateStateAndRecord, setProfileModalOpen);


    const {
        expandScene,
        isExpanding: isSequenceExpanding
    } = useSequenceExpansion();

    // Handle Expand Scene (Agentic Sequence)
    const handleExpandScene = useCallback(async (sceneId: string) => {
        const sceneToExpand = state.scenes.find(s => s.id === sceneId);
        if (!sceneToExpand) return;

        // Use global research notes or fallback to scene internal logic if specific notes needed later
        const notes = state.researchNotes;

        const expandedScenes = await expandScene(sceneToExpand, notes, userApiKey);

        if (expandedScenes && expandedScenes.length > 0) {
            updateStateAndRecord(s => {
                const oldIndex = s.scenes.findIndex(sc => sc.id === sceneId);
                if (oldIndex === -1) return s;

                // Create full Scene objects from partials
                const newFullScenes: Scene[] = expandedScenes.map((partial, idx) => ({
                    ...sceneToExpand, // Inherit base properties
                    ...partial,
                    id: generateId(), // New Unique ID
                    sceneNumber: `${oldIndex + 1 + idx}`, // Temp numbering
                    generatedImage: null, // Clear image
                    veoPrompt: '', // Clear veo
                    isGenerating: false,
                    isVeoGenerating: false,
                    isVideoGenerating: false,
                    // Keep relationships
                    characterIds: [...sceneToExpand.characterIds],
                    productIds: [...(sceneToExpand.productIds || [])],
                    groupId: sceneToExpand.groupId
                } as Scene));

                // Replace 1 scene with N scenes
                const newScenesList = [...s.scenes];
                newScenesList.splice(oldIndex, 1, ...newFullScenes);

                // Renumber everything
                const renumbered = newScenesList.map((sc, i) => ({
                    ...sc,
                    sceneNumber: `${i + 1}`
                }));

                return { ...s, scenes: renumbered };
            });
            setShowSuccessToast(`✨ Expanded into ${expandedScenes.length} scenes!`);
            setTimeout(() => setShowSuccessToast(null), 3000);
        }
    }, [state.scenes, state.researchNotes, userApiKey, expandScene, updateStateAndRecord]);

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
        {
            keys: 'ctrl+k', callback: (e) => {
                e?.preventDefault();
                // 1. Try to find existing input
                let input = document.getElementById('director-command-bar') as HTMLInputElement;

                // 2. If not found, try to click the expansion button
                if (!input) {
                    const expandBtn = document.querySelector('[aria-label="Expand Hub"]') as HTMLButtonElement;
                    if (expandBtn) expandBtn.click();
                    // Wait for render
                    setTimeout(() => {
                        input = document.getElementById('director-command-bar') as HTMLInputElement;
                        if (input) input.focus();
                    }, 100);
                } else {
                    input.focus();
                }
            }
        },
        {
            keys: 'cmd+k', callback: (e) => {
                e?.preventDefault();
                let input = document.getElementById('director-command-bar') as HTMLInputElement;
                if (!input) {
                    const expandBtn = document.querySelector('[aria-label="Expand Hub"]') as HTMLButtonElement;
                    if (expandBtn) expandBtn.click();
                    setTimeout(() => {
                        input = document.getElementById('director-command-bar') as HTMLInputElement;
                        if (input) input.focus();
                    }, 100);
                } else {
                    input.focus();
                }
            }
        },

    ]);

    // Handle Insert Angles: Create new scenes with different camera angles from source image
    const handleInsertAngles = useCallback(async (sourceSceneId: string, selections: { value: string; customPrompt?: string }[], sourceImage: string) => {
        const sourceScene = state.scenes.find(s => s.id === sourceSceneId);
        if (!sourceScene) return;

        const sourceIndex = state.scenes.findIndex(s => s.id === sourceSceneId);

        // Detailed prompt instructions for each camera angle type
        // These describe how to compose the shot based on the source scene
        // Values must match CAMERA_ANGLES constants (with hyphens, not underscores)
        // Enhanced with SCALE LOCK and COMPOSITION ANCHOR for consistency
        const baseAnchors = `
[SCALE LOCK]: Maintain the relative size of the main subject within the frame. If the source shows character at approximately X% of frame height, the new angle should maintain similar relative prominence unless this specific angle type requires a change.
[COMPOSITION ANCHOR]: Keep the center of interest (main character/object focus) in approximately the same screen region unless the new camera angle requires repositioning.
[ENVIRONMENT LOCK]: Background elements, lighting direction, and color temperature MUST remain consistent with the source image.`;

        const anglePromptMap: Record<string, { name: string; instruction: string; angleValue: string }> = {
            'wide-shot': {
                name: 'Wide Shot (WS)',
                angleValue: 'wide-shot',
                instruction: `!!! MANDATORY CAMERA CHANGE: WIDE SHOT !!! Pull camera back significantly to show MUCH MORE environment. Character appears SMALLER in frame (max 30% of frame height). EXTEND walls, sky, ground, architecture logically. ${baseAnchors}`
            },
            'medium-shot': {
                name: 'Medium Shot (MS)',
                angleValue: 'medium-shot',
                instruction: `!!! MANDATORY CAMERA CHANGE: MEDIUM SHOT !!! Frame character from WAIST UP only. Character fills approximately 50-60% of frame height. Balance of character and environment. ${baseAnchors}`
            },
            'close-up': {
                name: 'Close Up (CU)',
                angleValue: 'close-up',
                instruction: `!!! MANDATORY CAMERA CHANGE: CLOSE UP !!! Frame from SHOULDERS UP. Face fills majority of frame (70%+ of frame height). Shallow depth of field, background becomes bokeh. Capture emotional detail. ${baseAnchors}`
            },
            'extreme-cu': {
                name: 'Extreme Close Up (ECU)',
                angleValue: 'extreme-cu',
                instruction: `!!! MANDATORY CAMERA CHANGE: EXTREME CLOSE UP !!! Fill entire frame with specific detail - EYES ONLY, or HANDS ONLY, or single object. No visible background. Dramatic macro-style shallow depth of field. ${baseAnchors}`
            },
            'low-angle': {
                name: 'Low Angle (Worm Eye View)',
                angleValue: 'low-angle',
                instruction: `!!! MANDATORY CAMERA CHANGE: LOW ANGLE !!! Camera positioned BELOW subject looking UP. Show ceiling/sky/overhead elements. Character appears powerful/dominant. CREATE logical overhead elements consistent with setting. ${baseAnchors}`
            },
            'high-angle': {
                name: 'High Angle (Bird Eye View)',
                angleValue: 'high-angle',
                instruction: `!!! MANDATORY CAMERA CHANGE: HIGH ANGLE !!! Camera positioned ABOVE subject looking DOWN. Show ground/floor details clearly. Subject appears smaller/vulnerable. EXTEND floor pattern and ground details. ${baseAnchors}`
            },
            'ots': {
                name: 'Over The Shoulder (OTS)',
                angleValue: 'ots',
                instruction: `!!! MANDATORY CAMERA CHANGE: OVER THE SHOULDER !!! Show character shoulder/back/hair in foreground (blurred, frame edge). Main subject in background. [180° RULE]: If source shows character facing RIGHT, camera must be from LEFT side to maintain screen direction. ${baseAnchors}`
            },
            'dutch-angle': {
                name: 'Dutch Angle (Tilted)',
                angleValue: 'dutch-angle',
                instruction: `!!! MANDATORY CAMERA CHANGE: DUTCH ANGLE !!! Tilt camera 15-30 degrees. Same framing distance but ROTATE the entire composition. Creates tension/unease. All environment elements visible but at an angle. ${baseAnchors}`
            },
        };

        // Create new scenes for each angle
        const newScenes: Scene[] = selections.map((selection, i) => {
            const angle = selection.value;
            const customPrompt = selection.customPrompt;

            const angleConfig = anglePromptMap[angle] || {
                name: angle === 'custom' ? 'Custom Angle' : angle,
                angleValue: angle === 'custom' ? 'custom' : angle,
                instruction: angle === 'custom' && customPrompt
                    ? `!!! MANDATORY CAMERA CHANGE: CUSTOM ANGLE !!! ${customPrompt}`
                    : `!!! MANDATORY CAMERA CHANGE: ${angle.toUpperCase()} !!!`
            };

            console.log('[InsertAngles] Creating scene:', { angle, customPrompt, angleConfig });

            return {
                id: generateId(),
                sceneNumber: `${sourceIndex + 2 + i}`, // Will be renumbered
                groupId: sourceScene.groupId,
                language1: sourceScene.language1,
                vietnamese: sourceScene.vietnamese,
                promptName: `${sourceScene.promptName || 'Scene'} - ${angleConfig.name}`,
                contextDescription: `${angleConfig.instruction}\n\nORIGINAL SCENE CONTEXT:\n${sourceScene.contextDescription}\n\n[CRITICAL: Use the attached REFERENCE IMAGE as the AUTHORITATIVE source for environment, character appearance, and styling. This is the SAME moment captured from a DIFFERENT camera position. The camera angle MUST change to ${angleConfig.name}.]`,
                visualDescription: sourceScene.visualDescription,
                characterIds: [...sourceScene.characterIds],
                productIds: [...(sourceScene.productIds || [])],
                cameraAngleOverride: angleConfig.angleValue || angle,
                referenceImage: sourceImage, // Use source image as reference for the new angle
                referenceImageDescription: `Source scene for angle variation. This image shows the exact environment, characters, and props. Recreate this scene from a ${angleConfig.name} camera position.`,
                generatedImage: null,
                veoPrompt: '',
                isGenerating: true, // Start as generating
                error: null,
            };

        });

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
        // [Fix] Ensure state update happens before generation trigger
        const insertDelay = state.generationConfig?.insertAngleDelay || 1000;
        setTimeout(async () => {
            for (let i = 0; i < newScenes.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, insertDelay));
                console.log(`[InsertAngles] Triggering generation for ${newScenes[i].id}`);
                performImageGeneration(newScenes[i].id);
            }
        }, 100);
    }, [state.scenes, updateStateAndRecord, performImageGeneration, state.generationConfig]);




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

            // Initial fetch - Check assigned key first, then system key, then user key
            const fetchApiKey = async () => {
                // 1. First, check if user has a directly assigned key in profiles
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('assigned_api_key, system_key_id')
                    .eq('id', userId)
                    .maybeSingle();

                // Priority 1: Direct assigned_api_key in profiles
                if (profile?.assigned_api_key) {
                    setUserApiKey(profile.assigned_api_key);
                    localStorage.setItem('geminiApiKey', profile.assigned_api_key);
                    console.log('[API Key] ✅ Loaded ASSIGNED key (directly in profile)');
                    return;
                }

                // Priority 2: System key via system_key_id
                if (profile?.system_key_id) {
                    const { data: systemKey, error: systemKeyError } = await supabase
                        .from('system_api_keys')
                        .select('encrypted_key')
                        .eq('id', profile.system_key_id)
                        .eq('is_active', true)
                        .maybeSingle();

                    if (systemKey && !systemKeyError) {
                        setUserApiKey(systemKey.encrypted_key);
                        localStorage.setItem('geminiApiKey', systemKey.encrypted_key);
                        console.log('[API Key] ✅ Loaded SYSTEM key (from system_api_keys)');
                        return;
                    }
                }

                // Priority 3: User-provided key in user_api_keys
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
                    console.log('[API Key] ✅ Loaded from user_api_keys');
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

    // Sync Usage Stats from Cloud
    useEffect(() => {
        const syncStats = async () => {
            if (session?.user?.id) {
                const cloudStats = await fetchUserStatsFromCloud(session.user.id);
                if (cloudStats) {
                    updateStateAndRecord(s => ({
                        ...s,
                        usageStats: cloudStats
                    }));
                }
            }
        };
        syncStats();
    }, [session?.user?.id, updateStateAndRecord]);


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

    // deleted: analyzeStyleFromImage
    // deleted: closeEditor
    // deleted: openEditor
    // deleted: handleEditorSave

    const handleDeleteAsset = (id: string) => {
        updateStateAndRecord(s => ({
            ...s,
            assetGallery: (s.assetGallery || []).filter(a => a.id !== id)
        }));
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

    const handleSendCommand = useCallback((command: string) => {
        handleDirectorCommand(command);
    }, [handleDirectorCommand]);


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
                                    onOpenManualScript={() => setManualScriptModalOpen(true)}
                                    onOpenExcelImport={() => setExcelImportModalOpen(true)}
                                    generationConfig={state.generationConfig || {
                                        imageDelay: 500,
                                        veoDelay: 200,
                                        insertAngleDelay: 1000,
                                        concurrencyLimit: 1
                                    }}
                                    onGenerationConfigChange={(config) => updateStateAndRecord(s => ({ ...s, generationConfig: config }))}
                                />



                                <div id="scenes-map-section">
                                    <ScenesMapSection
                                        scenes={state.scenes}
                                        viewMode={viewMode}
                                        setViewMode={setViewMode}
                                        characters={state.characters}
                                        products={state.products}
                                        sceneGroups={state.sceneGroups || []}
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
                                        analyzeRaccord={analyzeRaccord}
                                        suggestNextShot={suggestNextShot}
                                        isVeoGenerating={isVeoGenerating}
                                        isVeoStopping={isVeoStopping}
                                        stopVeoGeneration={stopVeoGeneration}
                                        handleGenerateAllVideos={handleGenerateAllVideos}
                                        isVideoGenerating={isVideoGenerating}
                                        addScene={addScene}
                                        detailedScript={state.detailedScript || ''}
                                        onDetailedScriptChange={(val) => updateStateAndRecord(s => ({ ...s, detailedScript: val }))}
                                        onCleanAll={() => updateStateAndRecord(s => ({ ...s, scenes: [] }))}
                                        createGroup={addSceneGroup}
                                        updateGroup={updateSceneGroup}
                                        deleteGroup={deleteSceneGroup}
                                        assignSceneToGroup={assignSceneToGroup}
                                        draggedSceneIndex={draggedSceneIndex}
                                        setDraggedSceneIndex={setDraggedSceneIndex}
                                        dragOverIndex={dragOverIndex}
                                        setDragOverIndex={setDragOverIndex}
                                        onClearAllImages={() => {
                                            if (confirm('⚠️ Delete ALL images? This action cannot be undone.')) {
                                                updateStateAndRecord(s => ({
                                                    ...s,
                                                    scenes: s.scenes.map(sc => ({
                                                        ...sc,
                                                        generatedImage: null,
                                                        endFrameImage: null,
                                                        mediaId: null
                                                    }))
                                                }));
                                            }
                                        }}
                                        onInsertAngles={handleInsertAngles}
                                        onExpandScene={handleExpandScene}
                                        isExpandingSequence={isSequenceExpanding}
                                        scriptLanguage={state.scriptLanguage}
                                        customScriptLanguage={state.customScriptLanguage}
                                    />
                                </div>




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

                    {/* Right Sidebar: Asset Library */}
                    <div className={`fixed right-0 top-16 bottom-0 z-40 transition-all duration-300 ease-in-out ${isLibraryOpen ? 'w-96' : 'w-0'}`}>
                        {isLibraryOpen && (
                            <AssetLibrary
                                assets={state.assetGallery || []}
                                scenes={state.scenes}
                                characters={state.characters}
                                products={state.products}
                                usageStats={state.usageStats}
                                onDeleteAsset={handleDeleteAsset}
                                onClose={() => setLibraryOpen(false)}
                                onReplaceScene={(id, img) => updateScene(id, { generatedImage: img })}
                                onReplaceCharacterView={(id, img, view) => updateCharacter(id, { [`${view}Image`]: img })}
                                onReplaceProductView={(id, img, view) => {
                                    const prod = state.products.find(p => p.id === id);
                                    if (prod) {
                                        if (view === 'master') updateProduct(id, { masterImage: img });
                                        else updateProduct(id, { views: { ...prod.views, [view]: img } });
                                    }
                                }}
                            />
                        )}
                    </div>

                    {/* Floating Gallery Button */}
                    <button
                        onClick={() => setLibraryOpen(!isLibraryOpen)}
                        className={`fixed right-6 bottom-24 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${isLibraryOpen
                            ? 'bg-purple-600 text-white rotate-90'
                            : 'bg-brand-dark text-white border border-gray-700 hover:border-purple-500'
                            }`}
                    >
                        <ImageIcon size={24} />
                        {state.assetGallery && state.assetGallery.length > 0 && !isLibraryOpen && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-brand-dark">
                                {state.assetGallery.length}
                            </span>
                        )}
                    </button>

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
                        usageStats={state.usageStats}
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
                        apiKey={userApiKey}
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
                        onOpenCharGen={(id, prompt) => setCharGenState({ isOpen: true, charId: id, initialPrompt: prompt || '' })}
                        onDelete={deleteCharacter}
                    />

                    <CharacterGeneratorModal
                        isOpen={charGenState.isOpen}
                        onClose={() => setCharGenState({ isOpen: false, charId: null, initialPrompt: '' })}
                        onSave={handleCharGenSave}
                        apiKey={userApiKey}
                        model={state.imageModel}
                        charId={charGenState.charId}
                        updateCharacter={updateCharacter}
                        generateCharacterImage={generateCharacterImage}
                        characters={state.characters}
                        initialPrompt={charGenState.initialPrompt}
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

                    <ManualScriptModal
                        isOpen={isManualScriptModalOpen}
                        onClose={() => setManualScriptModalOpen(false)}
                        onImport={(scenes, groups, newChars, styleId, directorId, sceneCharacterMap, researchNotes) => {
                            // 1. Initialize mapping for name check (lowercase) -> Character ID
                            const charNameMap = new Map<string, string>();

                            // Add existing characters to map
                            state.characters.forEach(c => {
                                charNameMap.set(c.name.toLowerCase(), c.id);
                            });

                            // 2. Create new Character objects
                            const createdCharacters: any[] = newChars.map(nc => {
                                const id = generateId();
                                // Add to map for resolution
                                charNameMap.set(nc.name.toLowerCase(), id);

                                return {
                                    id,
                                    name: nc.name,
                                    description: nc.description,
                                    masterImage: null,
                                    faceImage: null,
                                    bodyImage: null,
                                    sideImage: null,
                                    backImage: null,
                                    props: [],
                                    isDefault: false
                                };
                            });

                            // 3. Resolve scene character IDs
                            const updatedScenes = scenes.map((scene, index) => {
                                const charNamesFromMap = sceneCharacterMap[index] || [];
                                const resolvedIds = charNamesFromMap
                                    .map(name => charNameMap.get(name.toLowerCase()))
                                    .filter(Boolean) as string[];
                                return { ...scene, characterIds: resolvedIds };
                            });

                            // 4. Update groups to have IDs
                            const updatedGroups = groups.map(g => ({ ...g, id: generateId() }));

                            // Link scenes to groups
                            updatedScenes.forEach((scene, idx) => {
                                const matchingGroup = updatedGroups.find(g => g.name === groups[Math.floor(idx / (scenes.length / groups.length))]?.name);
                                if (matchingGroup) {
                                    (scene as any).groupId = matchingGroup.id;
                                }
                            });

                            // 5. Update State in one go (including researchNotes)
                            updateStateAndRecord(s => ({
                                ...s,
                                sceneGroups: [...(s.sceneGroups || []), ...updatedGroups],
                                scenes: [...s.scenes, ...updatedScenes],
                                globalCharacterStyleId: styleId || s.globalCharacterStyleId,
                                activeDirectorId: directorId || s.activeDirectorId,
                                characters: [...s.characters, ...createdCharacters],
                                researchNotes: researchNotes || s.researchNotes  // NEW: Save research notes
                            }));
                        }}
                        existingCharacters={state.characters}
                        userApiKey={userApiKey}
                        userId={session?.user?.id || null}
                        initialState={state.manualScriptState}
                        onStateChange={(manualScriptState) => {
                            updateStateAndRecord(s => ({
                                ...s,
                                manualScriptState
                            }));
                        }}
                    />

                    <ExcelImportModal
                        isOpen={isExcelImportModalOpen}
                        onClose={() => setExcelImportModalOpen(false)}
                        onImport={(result, directorId) => {
                            // Merge imported data into state
                            updateStateAndRecord(s => ({
                                ...s,
                                sceneGroups: [...(s.sceneGroups || []), ...result.groups],
                                scenes: [...s.scenes, ...result.scenes],
                                characters: [...s.characters, ...result.characters],
                                activeDirectorId: directorId || s.activeDirectorId
                            }));
                        }}
                    />
                    <input
                        id="script-upload-input"
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleScriptUpload}
                    />
                    {/* Keyboard Shortcuts Component */}
                    <KeyboardShortcuts
                        onTableView={() => setViewMode('table')}
                        onBoardView={() => setViewMode('storyboard')}
                        onScrollToSceneMap={() => document.getElementById('scenes-map-section')?.scrollIntoView({ behavior: 'smooth' })}
                        onSaveProject={handleSave}
                        onOpenProject={handleOpen}
                    />
                </>
            )}


            {/* Global UI Layer: Unified Production Hub */}
            <UnifiedProductionHub
                agents={state.agents || {
                    director: { status: 'idle' },
                    dop: { status: 'idle' }
                }}
                logs={state.productionLogs || []}
                onSendCommand={handleSendCommand}
                onAddUserLog={(msg) => addProductionLog('user', msg, 'info')}
                onClearChat={() => updateStateAndRecord(s => ({ ...s, productionLogs: [] }))}
                activeDirectorId={state.activeDirectorId}
                onDirectorChange={(directorId) => updateStateAndRecord(s => ({ ...s, activeDirectorId: directorId }))}
            />
        </div>
    );
};


export default App;

