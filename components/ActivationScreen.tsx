import React from 'react';
import { ShieldAlert, LogOut, Clock, CheckCircle } from 'lucide-react';
import { APP_NAME, PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from '../constants/presets';

interface ActivationScreenProps {
    email?: string;
    onSignOut: () => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({ email, onSignOut }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0b] flex items-center justify-center p-6 overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-orange/10 blur-[120px] rounded-full animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="max-w-md w-full bg-gray-900/40 border border-gray-800 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-orange to-transparent opacity-50"></div>

                <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-brand-orange/10 rounded-2xl flex items-center justify-center mb-6 border border-brand-orange/20 animate-bounce-slow">
                        <ShieldAlert className="text-brand-orange" size={40} />
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">{APP_NAME}</h1>
                    <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                        Chào <span className="text-white font-medium">{email}</span>, tài khoản của bạn đang chờ quản trị viên kích hoạt.
                    </p>

                    <div className="space-y-4 w-full mb-8">
                        <div className="flex items-center space-x-3 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 group hover:border-brand-orange/30 transition-colors">
                            <div className="p-2 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                                <Clock className="text-blue-400" size={18} />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">Trạng thái</p>
                                <p className="text-white text-sm">Đang chờ kích hoạt...</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 group hover:border-green-500/30 transition-colors">
                            <div className="p-2 bg-green-500/10 rounded-lg group-hover:scale-110 transition-transform">
                                <CheckCircle className="text-green-400" size={18} />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-green-300 font-bold uppercase tracking-wider">Hành động</p>
                                <p className="text-white text-sm">Vui lòng liên hệ Admin để nâng cấp Pro.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={() => window.location.reload()}
                            className={`w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all shadow-lg shadow-brand-orange/20 active:scale-[0.98]`}
                        >
                            KIỂM TRA LẠI
                        </button>

                        <button
                            onClick={onSignOut}
                            className="w-full py-3.5 rounded-xl font-bold text-red-400 bg-red-400/5 hover:bg-red-400/10 border border-red-500/20 transition-all flex items-center justify-center space-x-2"
                        >
                            <LogOut size={18} />
                            <span>ĐĂNG XUẤT</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
