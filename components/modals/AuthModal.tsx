import React, { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from '../../constants/presets';

interface AuthModalProps {
    isOpen: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = isSignUp
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message);
        } else if (isSignUp) {
            setSuccessMsg("Đăng ký thành công! Vui lòng kiểm tra email để xác nhận (nếu có).");
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-brand-dark/90 border border-brand-orange/30 rounded-2xl shadow-2xl p-8 animate-in fade-in scale-in duration-300">
                <h2 className="text-3xl font-black text-center bg-gradient-to-r from-brand-orange to-brand-red bg-clip-text text-transparent mb-2">
                    {isSignUp ? 'JOIN THE VISION' : 'WELCOME BACK'}
                </h2>
                <p className="text-brand-cream/60 text-center mb-8 text-sm">
                    {isSignUp ? 'Create your account to start generating.' : 'Login to sync your projects and keys.'}
                </p>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-brand-orange mb-1 uppercase tracking-widest">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-brand-cream focus:outline-none focus:border-brand-orange/50 transition-all"
                            placeholder="director@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-brand-orange mb-1 uppercase tracking-widest">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-brand-cream focus:outline-none focus:border-brand-orange/50 transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs mt-2 bg-red-400/10 p-2 rounded-lg border border-red-400/20">{error}</p>}
                    {successMsg && <p className="text-green-400 text-xs mt-2 bg-green-400/10 p-2 rounded-lg border border-green-400/20">{successMsg}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-xl text-white font-bold bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all shadow-lg active:scale-95 disabled:opacity-50`}
                    >
                        {loading ? 'PROCESSING...' : (isSignUp ? 'CREATE ACCOUNT' : 'LOGIN')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-brand-cream/40 hover:text-brand-orange text-xs transition-colors"
                    >
                        {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </div>
        </div>
    );
};
