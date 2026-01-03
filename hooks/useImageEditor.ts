/**
 * useImageEditor Hook
 * 
 * Unified image editing module that supports:
 * - Loading images from any source (scenes, characters, gallery, Gommo library, file upload)
 * - Editing with Gemini native or any model
 * - Consistent state management for editor modal
 */

import { useState, useCallback } from 'react';

// Image source types for tracking origin
export type ImageSource =
    | { type: 'scene'; sceneId: string }
    | { type: 'character'; characterId: string; view: 'master' | 'face' | 'body' | 'side' | 'back' }
    | { type: 'product'; productId: string; view: string }
    | { type: 'gallery'; assetId: string }
    | { type: 'gommo'; groupId?: string; spaceId?: string; imageId: string }
    | { type: 'upload'; filename?: string }
    | { type: 'url'; originalUrl: string };

export interface EditorImage {
    id: string;
    image: string; // base64 or URL
    prompt?: string;
    source: ImageSource;
    createdAt: number;
    model?: string; // Which model generated this image
    provider?: 'gemini' | 'gommo'; // Which provider
}

export interface ImageEditorState {
    isOpen: boolean;
    currentImage: EditorImage | null;
    history: EditorImage[];
    isLoading: boolean;
    error: string | null;
}

export interface UseImageEditorReturn {
    // State
    editorState: ImageEditorState;

    // Actions
    openEditor: (image: EditorImage) => void;
    openEditorWithUrl: (url: string, prompt?: string) => Promise<void>;
    openEditorWithBase64: (base64: string, source: ImageSource, prompt?: string) => void;
    closeEditor: () => void;

    // Quick open helpers
    openSceneForEdit: (sceneId: string, image: string, prompt?: string) => void;
    openCharacterForEdit: (characterId: string, view: string, image: string) => void;
    openGalleryAssetForEdit: (assetId: string, image: string, prompt?: string) => void;
    openGommoImageForEdit: (imageId: string, imageUrl: string, groupId?: string) => void;
    openUploadedImageForEdit: (file: File) => Promise<void>;

    // History management
    addToHistory: (image: EditorImage) => void;
    clearHistory: () => void;

    // Result handling
    onEditorSave: (editedImage: string, history: any[], viewKey?: string) => void;
    setOnSaveCallback: (callback: (editedImage: string, source: ImageSource) => void) => void;
}

// Helper: Generate unique ID
const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper: Convert URL to base64
async function urlToBase64(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[ImageEditor] Failed to convert URL to base64:', error);
        throw error;
    }
}

// Helper: Convert File to base64
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function useImageEditor(): UseImageEditorReturn {
    const [editorState, setEditorState] = useState<ImageEditorState>({
        isOpen: false,
        currentImage: null,
        history: [],
        isLoading: false,
        error: null
    });

    const [onSaveCallback, setOnSaveCallbackState] = useState<((editedImage: string, source: ImageSource) => void) | null>(null);

    // ═══════════════════════════════════════════════════════════════
    // CORE ACTIONS
    // ═══════════════════════════════════════════════════════════════

    const openEditor = useCallback((image: EditorImage) => {
        console.log('[ImageEditor] Opening editor with image:', image.id, 'source:', image.source.type);
        setEditorState(prev => ({
            ...prev,
            isOpen: true,
            currentImage: image,
            error: null
        }));
    }, []);

    const openEditorWithUrl = useCallback(async (url: string, prompt?: string) => {
        setEditorState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const base64 = await urlToBase64(url);
            const image: EditorImage = {
                id: generateId(),
                image: base64,
                prompt,
                source: { type: 'url', originalUrl: url },
                createdAt: Date.now()
            };
            openEditor(image);
        } catch (error: any) {
            setEditorState(prev => ({
                ...prev,
                isLoading: false,
                error: error.message || 'Failed to load image from URL'
            }));
        } finally {
            setEditorState(prev => ({ ...prev, isLoading: false }));
        }
    }, [openEditor]);

    const openEditorWithBase64 = useCallback((base64: string, source: ImageSource, prompt?: string) => {
        const image: EditorImage = {
            id: generateId(),
            image: base64,
            prompt,
            source,
            createdAt: Date.now()
        };
        openEditor(image);
    }, [openEditor]);

    const closeEditor = useCallback(() => {
        setEditorState(prev => ({
            ...prev,
            isOpen: false,
            currentImage: null,
            error: null
        }));
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // QUICK OPEN HELPERS (Typed shortcuts for common use cases)
    // ═══════════════════════════════════════════════════════════════

    const openSceneForEdit = useCallback((sceneId: string, image: string, prompt?: string) => {
        console.log('[ImageEditor] Opening scene for edit:', sceneId);
        openEditorWithBase64(image, { type: 'scene', sceneId }, prompt);
    }, [openEditorWithBase64]);

    const openCharacterForEdit = useCallback((characterId: string, view: string, image: string) => {
        console.log('[ImageEditor] Opening character for edit:', characterId, view);
        openEditorWithBase64(
            image,
            { type: 'character', characterId, view: view as any }
        );
    }, [openEditorWithBase64]);

    const openGalleryAssetForEdit = useCallback((assetId: string, image: string, prompt?: string) => {
        console.log('[ImageEditor] Opening gallery asset for edit:', assetId);
        openEditorWithBase64(image, { type: 'gallery', assetId }, prompt);
    }, [openEditorWithBase64]);

    const openGommoImageForEdit = useCallback(async (imageId: string, imageUrl: string, groupId?: string) => {
        console.log('[ImageEditor] Opening Gommo image for edit:', imageId);
        setEditorState(prev => ({ ...prev, isLoading: true }));

        try {
            const base64 = await urlToBase64(imageUrl);
            const image: EditorImage = {
                id: generateId(),
                image: base64,
                source: { type: 'gommo', imageId, groupId },
                createdAt: Date.now(),
                provider: 'gommo'
            };
            openEditor(image);
        } catch (error: any) {
            setEditorState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Failed to load Gommo image'
            }));
        }
    }, [openEditor]);

    const openUploadedImageForEdit = useCallback(async (file: File) => {
        console.log('[ImageEditor] Opening uploaded file for edit:', file.name);
        setEditorState(prev => ({ ...prev, isLoading: true }));

        try {
            const base64 = await fileToBase64(file);
            const image: EditorImage = {
                id: generateId(),
                image: base64,
                source: { type: 'upload', filename: file.name },
                createdAt: Date.now()
            };
            openEditor(image);
        } catch (error: any) {
            setEditorState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Failed to load uploaded file'
            }));
        }
    }, [openEditor]);

    // ═══════════════════════════════════════════════════════════════
    // HISTORY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    const addToHistory = useCallback((image: EditorImage) => {
        setEditorState(prev => ({
            ...prev,
            history: [...prev.history, image].slice(-50) // Keep last 50
        }));
    }, []);

    const clearHistory = useCallback(() => {
        setEditorState(prev => ({
            ...prev,
            history: []
        }));
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // RESULT HANDLING
    // ═══════════════════════════════════════════════════════════════

    const onEditorSave = useCallback((editedImage: string, history: any[], viewKey?: string) => {
        console.log('[ImageEditor] Editor save called, history length:', history.length);

        if (editorState.currentImage && onSaveCallback) {
            onSaveCallback(editedImage, editorState.currentImage.source);
        }

        // Add to history
        if (editorState.currentImage) {
            addToHistory({
                ...editorState.currentImage,
                id: generateId(),
                image: editedImage,
                createdAt: Date.now()
            });
        }

        closeEditor();
    }, [editorState.currentImage, onSaveCallback, addToHistory, closeEditor]);

    const setOnSaveCallback = useCallback((callback: (editedImage: string, source: ImageSource) => void) => {
        setOnSaveCallbackState(() => callback);
    }, []);

    return {
        editorState,
        openEditor,
        openEditorWithUrl,
        openEditorWithBase64,
        closeEditor,
        openSceneForEdit,
        openCharacterForEdit,
        openGalleryAssetForEdit,
        openGommoImageForEdit,
        openUploadedImageForEdit,
        addToHistory,
        clearHistory,
        onEditorSave,
        setOnSaveCallback
    };
}

export default useImageEditor;
