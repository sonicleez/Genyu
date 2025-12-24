import { useState, useCallback, useRef, useEffect } from 'react';
import { ProjectState } from '../types';
import { saveProject, openProject } from '../utils/fileUtils';
import { INITIAL_STATE } from '../constants/presets';
import { slugify } from '../utils/helpers';

export function useStateManager() {
    const [state, setState] = useState<ProjectState>(INITIAL_STATE);
    const stateRef = useRef<ProjectState>(state);
    const [history, setHistory] = useState<{ past: ProjectState[], future: ProjectState[] }>({ past: [], future: [] });

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const updateStateAndRecord = useCallback((updater: (prevState: ProjectState) => ProjectState) => {
        setState(prevState => {
            const newState = updater(prevState);
            stateRef.current = newState; // Ensure ref is updated immediately for loops/async functions
            setHistory(h => {
                const newPast = [...h.past, prevState];
                if (newPast.length > 50) newPast.shift();
                return { past: newPast, future: [] };
            });
            return newState;
        });
    }, []);

    const undo = useCallback(() => {
        setHistory(h => {
            if (h.past.length === 0) return h;
            const previous = h.past[h.past.length - 1];
            const newPast = h.past.slice(0, h.past.length - 1);
            setState(previous);
            return { past: newPast, future: [state, ...h.future] };
        });
    }, [state]);

    const redo = useCallback(() => {
        setHistory(h => {
            if (h.future.length === 0) return h;
            const next = h.future[0];
            const newFuture = h.future.slice(1);
            setState(next);
            return { past: [...h.past, state], future: newFuture };
        });
    }, [state]);

    const handleSave = useCallback(() => {
        const filename = state.projectName ? `${slugify(state.projectName)}.json` : 'untitled-project.json';
        if (typeof saveProject !== 'undefined') {
            saveProject(state, filename);
        }
    }, [state]);

    const handleOpen = useCallback(() => {
        if (typeof openProject !== 'undefined') {
            openProject((loadedState: ProjectState) => {
                updateStateAndRecord(() => loadedState);
            });
        }
    }, [updateStateAndRecord]);

    const handleNewProject = useCallback(() => {
        const hasContent = state.scenes.length > 0 || state.characters.length > 1 || state.projectName.trim();
        if (hasContent) {
            if (!window.confirm(' Bạn có chắc muốn tạo project mới? Mọi thay đổi chưa lưu sẽ bị mất!')) return;
        }
        updateStateAndRecord(() => ({
            ...INITIAL_STATE,
            apiKey: state.apiKey,
            imageModel: state.imageModel,
        }));
    }, [state.scenes.length, state.characters.length, state.projectName, state.apiKey, state.genyuToken, state.imageModel, updateStateAndRecord]);

    return {
        state,
        setState,
        stateRef,
        history,
        updateStateAndRecord,
        undo,
        redo,
        handleSave,
        handleOpen,
        handleNewProject
    };
}
