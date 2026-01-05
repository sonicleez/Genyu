import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Session } from '@supabase/supabase-js';

export const useAuth = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (!error) setProfile(data);
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = () => supabase.auth.signOut();

    const isPro = profile?.subscription_tier === 'pro' && (
        !profile?.subscription_expires_at ||
        new Date(profile.subscription_expires_at) > new Date()
    );

    const subscriptionExpired = profile?.subscription_tier === 'pro' &&
        profile?.subscription_expires_at &&
        new Date(profile.subscription_expires_at) <= new Date();

    const isAdmin = (profile?.role === 'admin') ||
        (['admin@example.com', 'dangle@renoschuyler.com', 'xvirion@gmail.com'].includes(session?.user?.email || ''));

    return { session, profile, isPro, isAdmin, subscriptionExpired, loading, signOut };
};
