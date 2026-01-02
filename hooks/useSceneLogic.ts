import React, { useCallback } from 'react';
import { ProjectState, Scene, DirectorPreset } from '../types';
import { generateId } from '../utils/helpers';

export function useSceneLogic(
    state: ProjectState,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    setAgentState: (agent: 'director' | 'dop', status: any, message?: string, stage?: string) => void

) {

    const addScene = useCallback(() => {
        const defaultCharacter = state.characters.find(c => c.isDefault);
        const lastScene = state.scenes[state.scenes.length - 1];
        const newScene: Scene = {
            id: generateId(),
            sceneNumber: `${state.scenes.length + 1}`,
            groupId: lastScene?.groupId, // Inherit group from last scene
            language1: '',
            vietnamese: '',
            promptName: '',
            contextDescription: '',
            characterIds: defaultCharacter ? [defaultCharacter.id] : [],
            productIds: [],
            generatedImage: null,
            veoPrompt: '',
            isGenerating: false,
            error: null,
        };
        updateStateAndRecord(s => ({ ...s, scenes: [...s.scenes, newScene] }));
    }, [state.characters, state.scenes, updateStateAndRecord]);

    const updateScene = useCallback((id: string, updates: Partial<Scene>) => {
        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(sc => sc.id === id ? { ...sc, ...updates } : sc)
        }));
    }, [updateStateAndRecord]);

    const removeScene = useCallback((id: string) => {
        updateStateAndRecord(s => {
            const newScenes = s.scenes.filter(sc => sc.id !== id);
            const renumbered = newScenes.map((sc, idx) => ({
                ...sc,
                sceneNumber: `${idx + 1}`
            }));
            return { ...s, scenes: renumbered };
        });
    }, [updateStateAndRecord]);

    const insertScene = useCallback((index: number, initialData?: Partial<Scene>) => {
        const defaultCharacter = state.characters.find(c => c.isDefault);
        const prevScene = index > 0 ? state.scenes[index - 1] : null;
        const id = generateId();
        const newScene: Scene = {
            id,
            sceneNumber: `${index + 1}`,
            groupId: prevScene?.groupId, // Inherit group from previous scene
            language1: '',
            vietnamese: '',
            promptName: '',
            contextDescription: '',
            characterIds: defaultCharacter ? [defaultCharacter.id] : [],
            productIds: [],
            generatedImage: null,
            veoPrompt: '',
            isGenerating: false,
            error: null,
            ...initialData // Override with initial data
        };

        updateStateAndRecord(s => {
            const newScenes = [...s.scenes];
            newScenes.splice(index, 0, newScene);
            const renumbered = newScenes.map((sc, idx) => ({
                ...sc,
                sceneNumber: `${idx + 1}`
            }));
            return { ...s, scenes: renumbered };
        });

        return id;
    }, [state.characters, state.scenes, updateStateAndRecord]);

    // Group Management
    const createGroup = useCallback((name: string, description: string = '') => {
        const newGroup = {
            id: generateId(),
            name,
            description
        };
        updateStateAndRecord(s => ({
            ...s,
            sceneGroups: [...(s.sceneGroups || []), newGroup]
        }));
        return newGroup.id;
    }, [updateStateAndRecord]);

    const updateGroup = useCallback((id: string, updates: Partial<{ name: string; description: string }>) => {
        updateStateAndRecord(s => ({
            ...s,
            sceneGroups: (s.sceneGroups || []).map(g => g.id === id ? { ...g, ...updates } : g)
        }));
    }, [updateStateAndRecord]);

    const deleteGroup = useCallback((id: string) => {
        if (!id) return;
        updateStateAndRecord(s => {
            const currentGroups = s.sceneGroups || [];
            const newGroups = currentGroups.filter(g => g.id !== id);
            const newScenes = s.scenes.map(sc =>
                sc.groupId === id ? { ...sc, groupId: undefined } : sc
            );
            return {
                ...s,
                sceneGroups: newGroups,
                scenes: newScenes
            };
        });
    }, [updateStateAndRecord]);

    const assignSceneToGroup = useCallback((sceneId: string, groupId: string | undefined) => {
        updateScene(sceneId, { groupId });
    }, [updateScene]);

    const moveScene = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        updateStateAndRecord(s => {
            const newScenes = [...s.scenes];
            const [movedItem] = newScenes.splice(fromIndex, 1);
            newScenes.splice(toIndex, 0, movedItem);
            const renumbered = newScenes.map((sc, idx) => ({
                ...sc,
                sceneNumber: `${idx + 1}`
            }));
            return { ...s, scenes: renumbered };
        });
    }, [updateStateAndRecord]);

    const handleScriptUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // @ts-ignore
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                // @ts-ignore
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                // @ts-ignore
                const json: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length <= 1) {
                    alert("File Excel trống hoặc chỉ có hàng tiêu đề.");
                    return;
                }

                const defaultCharacter = state.characters.find(c => c.isDefault);
                const newScenes: Scene[] = json.slice(1)
                    .filter(row => row && row.length > 0 && row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '')
                    .map(row => {
                        const sceneNumber = String(row[0] || '').trim();
                        let characterIds: string[] = [];

                        if (sceneNumber.toLowerCase().startsWith('c') && defaultCharacter) {
                            characterIds.push(defaultCharacter.id);
                        }

                        return {
                            id: generateId(),
                            sceneNumber: sceneNumber,
                            language1: String(row[1] || ''),
                            vietnamese: String(row[2] || ''),
                            promptName: String(row[3] || ''),
                            contextDescription: String(row[4] || ''),
                            characterIds: characterIds,
                            productIds: [],
                            generatedImage: null,
                            veoPrompt: '',
                            isGenerating: false,
                            error: null,
                        };
                    });

                updateStateAndRecord(s => ({ ...s, scenes: newScenes }));
                setAgentState('dop', 'success', `Đã nhập thành công ${newScenes.length} phân cảnh từ Excel.`);
            } catch (error) {

                console.error("Lỗi khi xử lý file Excel:", error);
                alert("Đã xảy ra lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file.");
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }, [state.characters, updateStateAndRecord]);

    const triggerFileUpload = useCallback(() => {
        document.getElementById('script-upload-input')?.click();
    }, []);

    const applyGeneratedScript = useCallback((detailedStory: string, groups: any[], scenes: any[], director?: DirectorPreset, globalStoryContext?: string) => {
        updateStateAndRecord(s => {
            const groupMap: Record<string, string> = {};
            const newGroups = groups.map(g => {
                const newId = generateId();
                groupMap[g.id] = newId;
                return {
                    id: newId,
                    name: g.name,
                    description: g.description,
                    continuityReferenceGroupId: g.continuity_reference_group_id,
                    stylePrompt: g.stylePrompt,
                    customStyleInstruction: g.customStyleInstruction
                };
            });

            // Map continuity references if they exist within the NEW groups
            const finalizedGroups = newGroups.map(g => ({
                ...g,
                continuityReferenceGroupId: g.continuityReferenceGroupId ? (groupMap[g.continuityReferenceGroupId] || g.continuityReferenceGroupId) : undefined
            }));

            // Determine which field to use based on scriptLanguage setting
            const scriptContent = (sc: any) => sc.voiceover || (sc.dialogues?.[0]?.line) || '';
            const useVietnameseField = s.scriptLanguage === 'vietnamese';

            const newScenes: Scene[] = scenes.map((sc: any) => ({
                id: generateId(),
                sceneNumber: sc.scene_number,
                groupId: groupMap[sc.group_id],
                promptName: sc.prompt_name,
                contextDescription: sc.visual_context,
                visualDescription: sc.visual_context,
                characterIds: sc.character_ids || [],
                productIds: sc.product_ids || [],
                dialogues: sc.dialogues || [],
                voiceover: sc.voiceover,
                cameraAngle: sc.camera_angle,
                generatedImage: null,
                veoPrompt: '',
                isGenerating: false,
                error: null,
                // Assign script to correct field based on scriptLanguage setting
                language1: useVietnameseField ? '' : scriptContent(sc),
                vietnamese: useVietnameseField ? scriptContent(sc) : ''
            }));

            return {
                ...s,
                detailedScript: detailedStory,
                sceneGroups: [...(s.sceneGroups || []), ...finalizedGroups],
                scenes: [...s.scenes, ...newScenes],
                activeDirectorId: director?.id,
                customDirectors: director?.isCustom ? [...(s.customDirectors || []), director] : s.customDirectors,
                researchNotes: {
                    ...s.researchNotes,
                    story: globalStoryContext || s.researchNotes?.story || ''
                }
            };
        });
        setAgentState('dop', 'success', `Đã trải kịch bản ra timeline với ${scenes.length} phân cảnh.`);
    }, [updateStateAndRecord]);


    return {
        addScene,
        updateScene,
        removeScene,
        insertScene,
        moveScene,
        createGroup,
        updateGroup,
        deleteGroup,
        assignSceneToGroup,
        handleScriptUpload,
        triggerFileUpload,
        applyGeneratedScript
    };
}
