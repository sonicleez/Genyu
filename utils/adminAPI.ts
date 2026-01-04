/**
 * Admin API - Functions for admin dashboard
 * Requires service_role or admin access
 */

import { supabase } from './supabaseClient';

export interface AdminUser {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;

    // Profile data
    display_name?: string;

    // Global stats
    total_images: number;
    scenes_generated: number;
    characters_generated: number;
    gemini_images: number;
    gommo_images: number;
    text_tokens: number;

    // API Keys
    has_gemini_key: boolean;
    has_gommo_credentials: boolean;

    // Activity
    last_activity?: string;
    history_count: number;
}

export interface AdminStats {
    totalUsers: number;
    activeUsers24h: number;
    totalImages: number;
    totalScenes: number;
    totalCharacters: number;
    geminiImages: number;
    gommoImages: number;
    totalTextTokens: number;
}

export interface APIKeyInfo {
    user_id: string;
    email: string;
    key_type: 'gemini' | 'gommo';
    key_preview: string;
    created_at: string;
    last_used?: string;
}

/**
 * Check if current user is admin
 */
export async function isUserAdmin(): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Check if user email is in admin list or has admin role
        const adminEmails = ['admin@example.com', 'dangle@renoschuyler.com', 'xvirion@gmail.com']; // Admin emails
        if (adminEmails.includes(user.email || '')) return true;

        // Or check profiles table for role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        return profile?.role === 'admin';
    } catch {
        return false;
    }
}

/**
 * Get all users with their stats
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
    try {
        // Get profiles with global stats
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, display_name, created_at, updated_at');

        if (profileError) {
            console.error('[Admin] Profiles error:', profileError);
        }

        // Get all global stats
        const { data: stats, error: statsError } = await supabase
            .from('user_global_stats')
            .select('user_id, stats, updated_at');

        if (statsError) {
            console.error('[Admin] Stats error:', statsError);
        }

        // Get image counts per user
        const { data: imageCounts, error: imageError } = await supabase
            .from('generated_images_history')
            .select('user_id')
            .limit(1000);

        // Count images per user
        const imageCountMap: Record<string, number> = {};
        (imageCounts || []).forEach(row => {
            imageCountMap[row.user_id] = (imageCountMap[row.user_id] || 0) + 1;
        });

        // Create stats map
        const statsMap: Record<string, any> = {};
        (stats || []).forEach(row => {
            statsMap[row.user_id] = { ...row.stats, updated_at: row.updated_at };
        });

        // Combine data
        const users: AdminUser[] = (profiles || []).map(p => {
            const userStats = statsMap[p.id] || {};
            return {
                id: p.id,
                email: p.email || 'unknown',
                display_name: p.display_name,
                created_at: p.created_at,
                last_sign_in_at: null,
                total_images: userStats.totalImages || 0,
                scenes_generated: userStats.scenesGenerated || 0,
                characters_generated: userStats.charactersGenerated || 0,
                gemini_images: userStats.geminiImages || 0,
                gommo_images: userStats.gommoImages || 0,
                text_tokens: userStats.textTokens || 0,
                has_gemini_key: false,
                has_gommo_credentials: false,
                last_activity: userStats.updated_at || p.updated_at,
                history_count: imageCountMap[p.id] || 0
            };
        });

        // Sort by last activity
        users.sort((a, b) => {
            const dateA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
            const dateB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
            return dateB - dateA;
        });

        console.log('[Admin] Loaded', users.length, 'users');
        return users;
    } catch (e) {
        console.error('[Admin] Failed to fetch users:', e);
        return [];
    }
}

/**
 * Get aggregate admin stats
 */
export async function getAdminStats(): Promise<AdminStats> {
    try {
        // Get DOP prompt records for activity
        const { data: recentActivity } = await supabase
            .from('dop_prompt_records')
            .select('user_id, created_at')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const activeUsers24h = new Set((recentActivity || []).map(r => r.user_id)).size;

        // Aggregate from user_global_stats
        const { data: globalStats } = await supabase
            .from('user_global_stats')
            .select('stats');

        let totalStats = {
            totalUsers: globalStats?.length || 0,
            activeUsers24h,
            totalImages: 0,
            totalScenes: 0,
            totalCharacters: 0,
            geminiImages: 0,
            gommoImages: 0,
            totalTextTokens: 0
        };

        (globalStats || []).forEach((row: any) => {
            const s = row.stats || {};
            totalStats.totalImages += s.totalImages || 0;
            totalStats.totalScenes += s.scenesGenerated || 0;
            totalStats.totalCharacters += s.charactersGenerated || 0;
            totalStats.geminiImages += s.geminiImages || 0;
            totalStats.gommoImages += s.gommoImages || 0;
            totalStats.totalTextTokens += s.textTokens || 0;
        });

        return totalStats;
    } catch (e) {
        console.error('[Admin] Failed to fetch stats:', e);
        return {
            totalUsers: 0,
            activeUsers24h: 0,
            totalImages: 0,
            totalScenes: 0,
            totalCharacters: 0,
            geminiImages: 0,
            gommoImages: 0,
            totalTextTokens: 0
        };
    }
}

/**
 * Get API keys overview (keys stored in user_api_keys table)
 */
export async function getAPIKeysOverview(): Promise<APIKeyInfo[]> {
    try {
        const { data, error } = await supabase
            .from('user_api_keys')
            .select(`
                user_id,
                key_type,
                key_preview,
                created_at,
                last_used,
                profiles!inner(email)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((k: any) => ({
            user_id: k.user_id,
            email: k.profiles?.email || 'unknown',
            key_type: k.key_type,
            key_preview: k.key_preview || '***',
            created_at: k.created_at,
            last_used: k.last_used
        }));
    } catch (e) {
        console.error('[Admin] Failed to fetch API keys:', e);
        return [];
    }
}

/**
 * Get recent activity (generations)
 */
export async function getRecentActivity(limit: number = 50): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('generated_images_history')
            .select(`
                id,
                user_id,
                project_id,
                generation_type,
                model_id,
                aspect_ratio,
                resolution,
                created_at
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('[Admin] Failed to fetch activity:', e);
        return [];
    }
}

/**
 * Get DOP learning stats per model
 */
export async function getDOPModelStats(): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('dop_model_learnings')
            .select('*')
            .order('total_generations', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('[Admin] Failed to fetch DOP stats:', e);
        return [];
    }
}

/**
 * Get comprehensive DOP learning details including rejection patterns
 */
export async function getDOPLearningDetails(): Promise<{
    models: any[];
    rejectionStats: any;
    learningPatterns: any;
    recentRejections: any[];
}> {
    try {
        // Get model learnings
        const { data: models } = await supabase
            .from('dop_model_learnings')
            .select('*')
            .order('total_generations', { ascending: false });

        // Get recent rejections
        const { data: recentRejections } = await supabase
            .from('dop_prompt_records')
            .select('id, model_type, rejection_reasons, rejection_notes, rejected_at, keywords, prompt_used')
            .eq('was_rejected', true)
            .order('rejected_at', { ascending: false })
            .limit(50);

        // Calculate rejection stats per reason
        const rejectionStats: Record<string, number> = {};
        (recentRejections || []).forEach(r => {
            (r.rejection_reasons || []).forEach((reason: string) => {
                rejectionStats[reason] = (rejectionStats[reason] || 0) + 1;
            });
        });

        // Get learning patterns from approved prompts
        const { data: approvedRecords } = await supabase
            .from('dop_prompt_records')
            .select('model_type, keywords, quality_score')
            .eq('was_approved', true)
            .not('quality_score', 'is', null)
            .order('quality_score', { ascending: false })
            .limit(100);

        // Aggregate learning patterns
        const learningPatterns: Record<string, { count: number; avgScore: number }> = {};
        (approvedRecords || []).forEach(r => {
            (r.keywords || []).forEach((kw: string) => {
                if (!learningPatterns[kw]) {
                    learningPatterns[kw] = { count: 0, avgScore: 0 };
                }
                learningPatterns[kw].count++;
                learningPatterns[kw].avgScore =
                    (learningPatterns[kw].avgScore * (learningPatterns[kw].count - 1) + (r.quality_score || 0))
                    / learningPatterns[kw].count;
            });
        });

        console.log('[Admin] Loaded DOP learning details');
        return {
            models: models || [],
            rejectionStats,
            learningPatterns,
            recentRejections: recentRejections || []
        };
    } catch (e) {
        console.error('[Admin] Failed to fetch DOP learning details:', e);
        return {
            models: [],
            rejectionStats: {},
            learningPatterns: {},
            recentRejections: []
        };
    }
}

/**
 * Subscribe to real-time activity updates
 */
export function subscribeToActivity(callback: (payload: any) => void) {
    return supabase
        .channel('admin-activity')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'generated_images_history'
        }, callback)
        .subscribe();
}

/**
 * Subscribe to real-time DOP updates
 */
export function subscribeToDOPRecords(callback: (payload: any) => void) {
    return supabase
        .channel('admin-dop')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'dop_prompt_records'
        }, callback)
        .subscribe();
}

// ============== ADMIN CRUD FUNCTIONS ==============

/**
 * Update user role (admin/user)
 */
export async function setUserRole(userId: string, role: 'admin' | 'user'): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId);

        if (error) throw error;
        console.log(`[Admin] Set user ${userId} role to ${role}`);
        return true;
    } catch (e) {
        console.error('[Admin] Failed to set role:', e);
        return false;
    }
}

/**
 * Delete user (soft delete - just marks as deleted)
 */
export async function deleteUser(userId: string): Promise<boolean> {
    try {
        // Soft delete - update status
        const { error } = await supabase
            .from('profiles')
            .update({
                deleted_at: new Date().toISOString(),
                email: null // Remove email for privacy
            })
            .eq('id', userId);

        if (error) throw error;
        console.log(`[Admin] Deleted user ${userId}`);
        return true;
    } catch (e) {
        console.error('[Admin] Failed to delete user:', e);
        return false;
    }
}

/**
 * Update user profile
 */
export async function updateUser(userId: string, data: {
    display_name?: string;
    email?: string;
    role?: string;
}): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('profiles')
            .update(data)
            .eq('id', userId);

        if (error) throw error;
        console.log(`[Admin] Updated user ${userId}:`, data);
        return true;
    } catch (e) {
        console.error('[Admin] Failed to update user:', e);
        return false;
    }
}

/**
 * Get user's API keys
 */
export async function getUserAPIKeys(userId: string): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('user_api_keys')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('[Admin] Failed to get user keys:', e);
        return [];
    }
}

/**
 * Set API key for user
 */
export async function setUserAPIKey(userId: string, keyType: string, keyValue: string): Promise<boolean> {
    try {
        // Encrypt/preview key
        const keyPreview = keyValue.substring(0, 8) + '...' + keyValue.substring(keyValue.length - 4);

        const { error } = await supabase
            .from('user_api_keys')
            .upsert({
                user_id: userId,
                key_type: keyType,
                key_value: keyValue, // In production, encrypt this!
                key_preview: keyPreview,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,key_type' });

        if (error) throw error;
        console.log(`[Admin] Set ${keyType} key for user ${userId}`);
        return true;
    } catch (e) {
        console.error('[Admin] Failed to set key:', e);
        return false;
    }
}

/**
 * Delete API key for user
 */
export async function deleteUserAPIKey(userId: string, keyType: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('user_api_keys')
            .delete()
            .eq('user_id', userId)
            .eq('key_type', keyType);

        if (error) throw error;
        console.log(`[Admin] Deleted ${keyType} key for user ${userId}`);
        return true;
    } catch (e) {
        console.error('[Admin] Failed to delete key:', e);
        return false;
    }
}

/**
 * Get realtime user sessions (who's online)
 */
export async function getActiveSessions(): Promise<any[]> {
    try {
        // Get recent activity in last 5 minutes
        const { data, error } = await supabase
            .from('dop_prompt_records')
            .select('user_id, created_at, mode, model_type')
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by user
        const sessions: Record<string, any> = {};
        (data || []).forEach(record => {
            if (!sessions[record.user_id]) {
                sessions[record.user_id] = {
                    user_id: record.user_id,
                    last_activity: record.created_at,
                    actions: []
                };
            }
            sessions[record.user_id].actions.push({
                mode: record.mode,
                model: record.model_type,
                time: record.created_at
            });
        });

        return Object.values(sessions);
    } catch (e) {
        console.error('[Admin] Failed to get sessions:', e);
        return [];
    }
}

/**
 * Subscribe to all user activity (realtime)
 */
export function subscribeToUserActivity(callback: (payload: any) => void) {
    return supabase
        .channel('admin-user-activity')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'dop_prompt_records'
        }, (payload) => {
            callback({
                ...payload,
                event_type: 'dop_record'
            });
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'generated_images_history'
        }, (payload) => {
            callback({
                ...payload,
                event_type: 'image_generated'
            });
        })
        .subscribe();
}

/**
 * Get all users with full details for admin
 */
export async function getFullUserDetails(userId: string): Promise<any> {
    try {
        // Get profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        // Get global stats
        const { data: stats } = await supabase
            .from('user_global_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Get recent activity
        const { data: recentActivity } = await supabase
            .from('dop_prompt_records')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        // Get image history
        const { data: images } = await supabase
            .from('generated_images_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        return {
            profile,
            stats: stats?.stats,
            recentActivity,
            images
        };
    } catch (e) {
        console.error('[Admin] Failed to get user details:', e);
        return null;
    }
}

console.log('[Admin API] Full admin module loaded');
