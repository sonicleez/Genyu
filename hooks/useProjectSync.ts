import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { ProjectState } from '../types';
import { processProjectAssets } from '../utils/storageUtils';

export function useProjectSync(userId?: string) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveProjectToCloud = useCallback(async (state: ProjectState, projectId?: string, userTier: string = 'free') => {
        if (!userId) {
            const err = 'Vui lòng đăng nhập để lưu vào Cloud.';
            setError(err);
            return { data: null, error: err };
        }

        // Tier Checks
        if (userTier !== 'pro') {
            const err = 'Vui lòng nâng cấp lên Pro để lưu vào Cloud.';
            setError(err);
            return { data: null, error: err };
        }
        setLoading(true);
        setError(null);

        try {
            console.log('[useProjectSync] Starting save to cloud...');

            // Limit Check for NEW projects
            if (!projectId) {
                const { count, error: countErr } = await supabase
                    .from('projects')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);

                if (countErr) throw countErr;
                if (count !== null && count >= 3) {
                    const err = 'Bạn đã đạt giới hạn 3 dự án trên Cloud cho gói Pro. Vui lòng xóa bớt dự án cũ.';
                    setError(err);
                    return { data: null, error: err };
                }
            }
            // First, process and upload any base64 assets
            const processedState = await processProjectAssets(state, userId);

            // Ensure the name is captured from the state (or placeholder)
            const resolvedName = state.projectName.trim() || 'Dự án chưa đặt tên';

            const projectToSave = {
                user_id: userId,
                name: resolvedName,
                project_data: { ...processedState, projectName: resolvedName } as any,
                updated_at: new Date().toISOString()
            };

            let result;
            if (projectId) {
                result = await supabase
                    .from('projects')
                    .update(projectToSave)
                    .eq('id', projectId)
                    .select()
                    .single();
            } else {
                result = await supabase
                    .from('projects')
                    .insert(projectToSave)
                    .select()
                    .single();
            }

            if (result.error) throw result.error;
            return { data: result.data, error: null };
        } catch (err: any) {
            const errMsg = err.message || JSON.stringify(err);
            setError(errMsg);
            console.error('Save to cloud error:', err);
            return { data: null, error: errMsg };
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchProjects = useCallback(async () => {
        if (!userId) return [];
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, updated_at')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (err: any) {
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const loadProjectFromCloud = useCallback(async (projectId: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('project_data')
                .eq('id', projectId)
                .single();

            if (error) throw error;
            return { data: data.project_data as ProjectState, error: null };
        } catch (err: any) {
            const errMsg = err.message || JSON.stringify(err);
            setError(errMsg);
            return { data: null, error: errMsg };
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteProjectFromCloud = useCallback(async (projectId: string) => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;
            return { success: true, error: null };
        } catch (err: any) {
            const errMsg = err.message || JSON.stringify(err);
            setError(errMsg);
            return { success: false, error: errMsg };
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        saveProjectToCloud,
        fetchProjects,
        loadProjectFromCloud,
        deleteProjectFromCloud
    };
}
