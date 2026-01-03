import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Modal from '../Modal';
import { supabase } from '../../utils/supabaseClient';
import { PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from '../../constants/presets';
import { User, Key, Calendar, ShieldCheck, CreditCard, LogOut, BarChart3, Image, FileText, Layers, Package, Zap } from 'lucide-react';
import { GommoAI } from '../../utils/gommoAI';

export interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: any;
    session: any;
    apiKey: string;
    setApiKey: (key: string) => void;
    subscriptionExpired: boolean;
    onSignOut: () => void;
    // Gommo AI
    gommoDomain?: string;
    gommoAccessToken?: string;
    setGommoCredentials?: (domain: string, token: string) => void;
    usageStats?: {
        '1K'?: number;
        '2K'?: number;
        '4K'?: number;
        total?: number;
        scenes?: number;
        characters?: number;
        products?: number;
        concepts?: number;
        textTokens?: number;
        promptTokens?: number;
        candidateTokens?: number;
        textCalls?: number;
        lastGeneratedAt?: string;
    };
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen,
    onClose,
    profile,
    session,
    apiKey,
    setApiKey,
    subscriptionExpired,
    onSignOut,
    usageStats,
    gommoDomain = '',
    gommoAccessToken = '',
    setGommoCredentials
}) => {
    const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [localApiKey, setLocalApiKey] = useState(apiKey);

    // Gommo state - default domain is aivideoauto.com
    const [localGommoDomain, setLocalGommoDomain] = useState(gommoDomain || 'aivideoauto.com');
    const [localGommoToken, setLocalGommoToken] = useState(gommoAccessToken);
    const [gommoStatus, setGommoStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [gommoMsg, setGommoMsg] = useState('');
    const [gommoCredits, setGommoCredits] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setCheckStatus('idle');
            setStatusMsg('');
            setLocalApiKey(apiKey);
        }
    }, [isOpen, apiKey]);

    const handleVerify = async () => {
        const trimmedKey = localApiKey.trim();
        if (!trimmedKey) {
            setCheckStatus('error');
            setStatusMsg("Vui lòng nhập API Key.");
            return;
        }

        setCheckStatus('checking');
        try {
            const ai = new GoogleGenAI({ apiKey: trimmedKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'Test connection'
            });

            if (response.promptFeedback?.blockReason) {
                throw new Error(`Bị chặn: ${response.promptFeedback.blockReason}`);
            }

            // Save to Supabase silently
            if (session?.user?.id) {
                const payload = {
                    user_id: session.user.id,
                    user_email: session.user.email || null,
                    provider: 'gemini',
                    encrypted_key: trimmedKey,
                    is_active: true
                };

                const { error: supabaseError } = await supabase
                    .from('user_api_keys')
                    .upsert(payload, { onConflict: 'user_id,provider' });

                if (supabaseError) {
                    console.error('[API Key] Save error:', supabaseError.message);
                }
            }

            setApiKey(trimmedKey);
            setCheckStatus('success');
            setStatusMsg("✅ API Key hợp lệ!");

        } catch (error: any) {
            setCheckStatus('error');
            let msg = error.message || "Lỗi kết nối.";
            if (msg.includes('403')) msg = "Lỗi 403: Quyền bị từ chối.";
            else if (msg.includes('400')) msg = "Lỗi 400: API Key không hợp lệ.";
            setStatusMsg(msg);
        }
    };

    const handleGommoVerify = async () => {
        const domain = localGommoDomain.trim();
        const token = localGommoToken.trim();

        if (!domain || !token) {
            setGommoStatus('error');
            setGommoMsg('Vui lòng nhập Domain và Access Token.');
            return;
        }

        setGommoStatus('checking');
        try {
            const client = new GommoAI(domain, token);
            const info = await client.getAccountInfo();

            // Save credentials
            if (setGommoCredentials) {
                setGommoCredentials(domain, token);
            }

            // Show credits
            setGommoCredits(info.balancesInfo.credits_ai || 0);
            setGommoStatus('success');
            setGommoMsg(`✅ Xác thực thành công! Xin chào ${info.userInfo.name || info.userInfo.username}`);

        } catch (error: any) {
            setGommoStatus('error');
            setGommoMsg(error.message || 'Không thể kết nối Gommo API');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Thông tin tài khoản">
            <div className="space-y-6">
                {/* User Info Section */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <User className="text-blue-400" size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Tài khoản</p>
                            <p className="text-white font-medium">{session?.user?.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center space-x-2 text-gray-500 mb-1">
                                <CreditCard size={14} />
                                <span className="text-[10px] uppercase font-bold">Gói dịch vụ</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit ${subscriptionExpired ? 'bg-red-500/10 text-red-400 border-red-500/30' : profile?.subscription_tier === 'pro' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                                {subscriptionExpired ? 'EXPIRED' : profile?.subscription_tier?.toUpperCase() || 'FREE'}
                            </span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center space-x-2 text-gray-500 mb-1">
                                <Calendar size={14} />
                                <span className="text-[10px] uppercase font-bold">Hết hạn</span>
                            </div>
                            <p className="text-xs text-gray-300">
                                {profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString('vi-VN') : 'Không giới hạn'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Usage Stats Section */}
                {usageStats && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <BarChart3 className="text-purple-400" size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Thống kê sử dụng</p>
                                <p className="text-white font-medium">{usageStats.total || 0} ảnh đã tạo</p>
                            </div>
                        </div>

                        {/* Image Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-900/50 rounded-lg p-3 flex items-center space-x-2">
                                <Layers className="text-blue-400" size={16} />
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase">Scenes</p>
                                    <p className="text-white font-bold">{usageStats.scenes || 0}</p>
                                </div>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-3 flex items-center space-x-2">
                                <User className="text-green-400" size={16} />
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase">Characters</p>
                                    <p className="text-white font-bold">{usageStats.characters || 0}</p>
                                </div>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-3 flex items-center space-x-2">
                                <Package className="text-orange-400" size={16} />
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase">Products</p>
                                    <p className="text-white font-bold">{usageStats.products || 0}</p>
                                </div>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-3 flex items-center space-x-2">
                                <Image className="text-pink-400" size={16} />
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase">Concepts</p>
                                    <p className="text-white font-bold">{usageStats.concepts || 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* Token Stats */}
                        <div className="border-t border-gray-700 pt-3">
                            <div className="flex items-center space-x-2 mb-2">
                                <FileText className="text-yellow-400" size={14} />
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Token Usage (Text API)</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white">{((usageStats.textTokens || 0) / 1000).toFixed(1)}K</p>
                                    <p className="text-[9px] text-gray-500">Total</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-blue-400">{((usageStats.promptTokens || 0) / 1000).toFixed(1)}K</p>
                                    <p className="text-[9px] text-gray-500">Input</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-green-400">{((usageStats.candidateTokens || 0) / 1000).toFixed(1)}K</p>
                                    <p className="text-[9px] text-gray-500">Output</p>
                                </div>
                            </div>
                            <p className="text-[9px] text-gray-600 mt-2 text-center">
                                {usageStats.textCalls || 0} API calls • Last: {usageStats.lastGeneratedAt ? new Date(usageStats.lastGeneratedAt).toLocaleString('vi-VN') : 'N/A'}
                            </p>
                        </div>
                    </div>
                )}

                {/* API Key Section */}
                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Key className="text-gray-400" size={18} />
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Cấu hình API Key</h3>
                    </div>

                    {/* System/Assigned Key Warning */}
                    {(profile?.assigned_api_key || profile?.system_key_id) && (
                        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 flex items-start space-x-2">
                            <ShieldCheck className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="text-xs">
                                <p className="text-blue-300 font-medium">
                                    {profile?.assigned_api_key ? '🔑 Đang sử dụng API Key được Admin cấp' : '🔒 Đang sử dụng System Key'}
                                </p>
                                <p className="text-blue-400/70 mt-1">
                                    Key tự nhập sẽ không được sử dụng khi có key từ Admin.
                                </p>
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-gray-500">Nhập Google AI Studio Key (Gemini) để thực hiện các tác vụ tạo ảnh và kịch bản.</p>

                    <div className="relative">
                        <input
                            type="password"
                            value={localApiKey}
                            onChange={(e) => setLocalApiKey(e.target.value)}
                            placeholder="Nhập API Key..."
                            className="w-full px-3 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all text-sm"
                        />
                        <button
                            onClick={handleVerify}
                            disabled={checkStatus === 'checking'}
                            className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all ${checkStatus === 'checking' ? 'bg-gray-700 text-gray-500' : `bg-gradient-to-r ${PRIMARY_GRADIENT} text-white hover:shadow-lg shadow-orange-500/20 active:scale-95`}`}
                        >
                            {checkStatus === 'checking' ? '...' : 'Verify'}
                        </button>
                    </div>

                    {checkStatus !== 'idle' && (
                        <div className={`text-[11px] p-2.5 rounded-lg border flex items-start animate-fade-in ${checkStatus === 'checking' ? 'bg-blue-900/20 border-blue-800/50 text-blue-300' :
                            checkStatus === 'success' ? 'bg-green-900/20 border-green-800/50 text-green-300' :
                                'bg-red-900/20 border-red-800/50 text-red-300'
                            }`}>
                            <span>{statusMsg}</span>
                        </div>
                    )}
                </div>

                {/* Gommo AI Section */}
                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Zap className="text-yellow-400" size={18} />
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Gommo AI (Proxy)</h3>
                    </div>
                    <p className="text-xs text-gray-500">Cung cấp Domain và Access Token từ Gommo để sử dụng API ảnh.</p>

                    <div className="space-y-2">
                        <input
                            type="text"
                            value={localGommoDomain}
                            onChange={(e) => setLocalGommoDomain(e.target.value)}
                            placeholder="Domain (mặc định: aivideoauto.com)"
                            className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all text-sm text-gray-400"
                        />
                        <div className="relative">
                            <input
                                type="password"
                                value={localGommoToken}
                                onChange={(e) => setLocalGommoToken(e.target.value)}
                                placeholder="Access Token"
                                className="w-full px-3 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all text-sm"
                            />
                            <button
                                onClick={handleGommoVerify}
                                disabled={gommoStatus === 'checking'}
                                className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all ${gommoStatus === 'checking' ? 'bg-gray-700 text-gray-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:shadow-lg shadow-yellow-500/20 active:scale-95'}`}
                            >
                                {gommoStatus === 'checking' ? '...' : 'Verify'}
                            </button>
                        </div>
                    </div>

                    {gommoStatus !== 'idle' && (
                        <div className={`text-[11px] p-2.5 rounded-lg border flex items-start animate-fade-in ${gommoStatus === 'checking' ? 'bg-blue-900/20 border-blue-800/50 text-blue-300' :
                            gommoStatus === 'success' ? 'bg-green-900/20 border-green-800/50 text-green-300' :
                                'bg-red-900/20 border-red-800/50 text-red-300'
                            }`}>
                            <span>{gommoMsg}</span>
                        </div>
                    )}

                    {gommoCredits !== null && (
                        <div className="flex items-center justify-between bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-2">
                            <span className="text-xs text-yellow-300">💰 Credits Available:</span>
                            <span className="font-bold text-yellow-400">{gommoCredits.toLocaleString()}</span>
                        </div>
                    )}
                </div>

                {/* Info Footer */}
                <div className="pt-4 border-t border-gray-800 flex space-x-3">
                    <button
                        onClick={onSignOut}
                        className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-bold text-sm transition-all active:scale-95 border border-red-500/20"
                    >
                        <LogOut size={16} />
                        <span>ĐĂNG XUẤT</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-sm transition-all active:scale-95"
                    >
                        HOÀN TẤT
                    </button>
                </div>
            </div>
        </Modal>
    );
};
