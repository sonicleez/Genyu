/**
 * Settings Modals
 * API Key and Token management modals
 */

import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Modal from './Modal';
import { PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from '../utils/appConstants';

// ==================== API KEY MODAL ====================
export interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
    setApiKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, apiKey, setApiKey }) => {
    const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCheckStatus('idle');
            setStatusMsg('');
        }
    }, [isOpen]);

    const handleVerify = async () => {
        if (!apiKey.trim()) {
            setCheckStatus('error');
            setStatusMsg("Vui lòng nhập API Key.");
            return;
        }

        setCheckStatus('checking');
        try {
            const ai = new GoogleGenAI({ apiKey });
            await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: 'Test connection' }] }
            });
            setCheckStatus('success');
            setStatusMsg("Kết nối thành công! Key hợp lệ.");
            setTimeout(onClose, 1500);
        } catch (error: any) {
            setCheckStatus('error');
            let msg = error.message || "Lỗi kết nối.";
            if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
                msg = "Lỗi 403: Quyền bị từ chối. Hãy kiểm tra: 1) Project GCP đã bật Generative AI API chưa? 2) Billing đã kích hoạt chưa?";
            } else if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
                msg = "Lỗi 400: API Key không hợp lệ.";
            }
            setStatusMsg(msg);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quản lý API Key">
            <p className="text-gray-400 mb-4">Nhập Gemini API key của bạn (Paid Tier 1) để sử dụng.</p>
            <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API Key"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {checkStatus !== 'idle' && (
                <div className={`mt-3 text-sm p-3 rounded-lg border flex items-start ${checkStatus === 'checking' ? 'bg-blue-900/30 border-blue-800 text-blue-200' :
                    checkStatus === 'success' ? 'bg-green-900/30 border-green-800 text-green-200' :
                        'bg-red-900/30 border-red-800 text-red-200'
                    }`}>
                    <span className="mr-2 text-lg">
                        {checkStatus === 'checking' && '⏳'}
                        {checkStatus === 'success' && '✅'}
                        {checkStatus === 'error' && '⚠️'}
                    </span>
                    <span>{statusMsg}</span>
                </div>
            )}

            <div className="flex justify-end mt-6 space-x-2">
                <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium">Đóng</button>
                <button
                    onClick={handleVerify}
                    disabled={checkStatus === 'checking'}
                    className={`px-6 py-2 font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {checkStatus === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra & Lưu'}
                </button>
            </div>
        </Modal>
    );
};

// ==================== GENYU TOKEN MODAL ====================
export interface GenyuTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    setToken: (token: string) => void;
    recaptchaToken: string;
    setRecaptchaToken: (token: string) => void;
}

interface ExtensionStatus {
    hasRecaptcha: boolean;
    recaptchaLength: number;
    projectId: string | null;
    lastUpdated: string | null;
    tokenAgeSeconds: number | null;
    extensionActive: boolean;
    recaptchaToken: string | null;
}

export const GenyuTokenModal: React.FC<GenyuTokenModalProps> = ({ isOpen, onClose, token, setToken, recaptchaToken, setRecaptchaToken }) => {
    const [testResult, setTestResult] = useState<any>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);

    // Fetch Extension status when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchExtensionStatus();
            // Poll every 3 seconds while modal is open
            const interval = setInterval(fetchExtensionStatus, 3000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const fetchExtensionStatus = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/tokens');
            const data = await response.json();
            setExtensionStatus(data);
        } catch (error) {
            console.error('Failed to fetch extension status:', error);
            setExtensionStatus(null);
        }
    };

    const handleAutoFill = () => {
        // Fill Session token if available
        if (extensionStatus?.sessionToken) {
            setToken(extensionStatus.sessionToken);
        }

        // Fill reCAPTCHA token from pool (get first available token)
        if (extensionStatus?.tokenPool && extensionStatus.tokenPool.length > 0) {
            const firstToken = extensionStatus.tokenPool[0];
            setRecaptchaToken(firstToken.token);
            console.log('Auto-filled token from pool, age:', firstToken.age, 's');
        } else if (extensionStatus?.recaptchaToken) {
            // Fallback to old single token if pool is empty
            setRecaptchaToken(extensionStatus.recaptchaToken);
        }
    };


    const handleTestTokens = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const response = await fetch('http://localhost:3001/api/test-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, recaptchaToken })
            });

            const result = await response.json();
            setTestResult(result);
            console.log('Token Test Result:', result);
        } catch (error) {
            console.error('Test failed:', error);
            setTestResult({ ready: false, message: '❌ Server error' });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Genyu Token & Extension">
            <div className="space-y-4">
                {/* Extension Status Card */}
                <div className={`p-4 rounded-lg border ${extensionStatus?.extensionActive
                    ? 'bg-green-900/20 border-green-600'
                    : 'bg-yellow-900/20 border-yellow-600'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-lg">
                            {extensionStatus?.extensionActive ? '🟢 Extension Active' : '🟡 Extension Disconnected'}
                        </span>
                        <button
                            onClick={fetchExtensionStatus}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                        >
                            Refresh
                        </button>
                    </div>

                    {extensionStatus?.extensionActive ? (
                        <div className="text-sm space-y-1">
                            <p className="text-green-400">✅ Token Pool: {extensionStatus.poolSize || 0} tokens available</p>
                            <p className="text-gray-400">Last updated: {extensionStatus.tokenAgeSeconds}s ago</p>
                            {extensionStatus.projectId && (
                                <p className="text-gray-400">Project: {extensionStatus.projectId.substring(0, 20)}...</p>
                            )}
                            <button
                                onClick={handleAutoFill}
                                className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white font-semibold text-sm"
                            >
                                📥 Auto Fill Token
                            </button>
                        </div>
                    ) : (
                        <div className="text-sm text-yellow-300">
                            <p>Extension chưa gửi token. Hãy:</p>
                            <ol className="list-decimal ml-4 mt-1 space-y-1 text-yellow-200">
                                <li>Mở tab <a href="https://labs.google/fx/tools/flow" target="_blank" className="underline">labs.google</a></li>
                                <li>Đợi Extension tự động generate tokens (mỗi 5s)</li>
                                <li>Token Pool sẽ tự động được tạo</li>
                            </ol>
                        </div>
                    )}
                </div>

                {/* Manual Session Token Input */}
                <div>
                    <p className="text-gray-400 mb-2">Session Token (Manual - Optional):</p>
                    <p className="text-xs text-gray-500 mb-1">Chỉ cần nếu Extension không hoạt động</p>
                    <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="eyJh..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                {/* Recaptcha Token Display */}
                <div>
                    <p className="text-gray-400 mb-2">reCAPTCHA Token:</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={recaptchaToken}
                            onChange={(e) => setRecaptchaToken(e.target.value)}
                            placeholder="0cAFcWeA... (Auto-filled from Extension)"
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {recaptchaToken ? `${recaptchaToken.length} chars` : 'No token'}
                    </p>
                </div>

                {/* Test Result Display */}
                {testResult && (
                    <div className={`p-4 rounded-lg ${testResult.ready ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
                        <p className="font-bold mb-2">{testResult.message}</p>
                        {testResult.issues && testResult.issues.length > 0 && (
                            <ul className="text-sm space-y-1">
                                {testResult.issues.map((issue: string, i: number) => (
                                    <li key={i} className="text-red-400">• {issue}</li>
                                ))}
                            </ul>
                        )}
                        {testResult.ready && (
                            <p className="text-sm text-green-400 mt-2">✅ Ready to generate!</p>
                        )}
                    </div>
                )}
            </div>
            <div className="flex justify-between mt-6">
                <button
                    onClick={handleTestTokens}
                    disabled={isTesting}
                    className="px-6 py-2 font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                >
                    {isTesting ? 'Testing...' : '🔍 Test Tokens'}
                </button>
                <button onClick={onClose} className="px-6 py-2 font-semibold text-white rounded-lg bg-green-600 hover:bg-green-500">
                    Save & Close
                </button>
            </div>
        </Modal>
    );
};


// ==================== COFFEE MODAL ====================
export interface CoffeeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CoffeeModal: React.FC<CoffeeModalProps> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Cho @Mrsonic30 1 follow ">
        <p className="text-gray-400 mb-4 text-center">Nếu bạn thấy những chia sẻ của mình hữu ích!</p>
        <div className="flex flex-col items-center">
            <img src="N/a images" alt="QR Code for coffee" className="w-64 h-64 rounded-lg border-2 border-gray-700" />
            <p className="text-xs text-gray-500 mt-4">Đổi nội dung bong bóng này tùy theo nhu cầu của bạn.</p>
        </div>
    </Modal>
);

// ==================== COFFEE BUTTON ====================
export interface CoffeeButtonProps {
    onClick: () => void;
}

export const CoffeeButton: React.FC<CoffeeButtonProps> = ({ onClick }) => (
    <button onClick={onClick} className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl shadow-lg transition-transform hover:scale-110 bg-gradient-to-br ${PRIMARY_GRADIENT}`}>
        ☕
    </button>
);
