import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Modal from '../Modal';
import { IMAGE_MODELS, PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from '../../constants/presets';

export interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    image: string | null;
    onSave: (newImage: string) => void;
    apiKey: string;
    model: string;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, image, onSave, apiKey, model }) => {
    const [editPrompt, setEditPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(model);

    useEffect(() => {
        if (isOpen) {
            setEditPrompt('');
            setError(null);
            setIsEditing(false);
            setSelectedModel(model);
        }
    }, [isOpen, model]);

    if (!isOpen || !image) return null;

    const handleEdit = async () => {
        if (!editPrompt.trim()) return;
        const trimmedKey = apiKey?.trim();
        if (!trimmedKey) {
            setError("Missing API Key");
            return;
        }

        setIsEditing(true);
        setError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: trimmedKey });
            const [header, data] = image.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: [{
                    parts: [
                        { inlineData: { data, mimeType } },
                        { text: `Edit this image: ${editPrompt}. Maintain the core composition and identity, only applying the requested changes.` }
                    ]
                }]
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const base64ImageBytes = imagePart.inlineData.data;
                const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
                onSave(imageUrl);
                onClose();
            } else {
                setError("AI không trả về ảnh. Thử lại với prompt khác.");
            }
        } catch (err) {
            console.error("Edit failed", err);
            setError("Chỉnh sửa thất bại. Kiểm tra API Key hoặc thử lại.");
        } finally {
            setIsEditing(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nano Banana Editor (Sửa ảnh)">
            <div className="flex flex-col space-y-4">
                <div className="flex justify-end items-center space-x-2">
                    <span className="text-xs text-gray-400">Model:</span>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded text-xs text-white p-1 focus:outline-none focus:border-green-500"
                    >
                        {IMAGE_MODELS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full aspect-square bg-black/50 rounded flex items-center justify-center overflow-hidden">
                    <img src={image} alt="Target" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bạn muốn sửa gì?</label>
                    <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="VD: Đổi màu tóc thành đỏ, thêm vết sẹo trên má, làm quần áo cũ hơn..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md text-white p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleEdit}
                        disabled={isEditing || !editPrompt}
                        className={`w-full py-2 font-semibold text-white rounded-lg bg-gradient-to-r ${PRIMARY_GRADIENT} hover:${PRIMARY_GRADIENT_HOVER} transition-all disabled:opacity-50`}
                    >
                        {isEditing ? 'AI đang sửa...' : 'Thực hiện chỉnh sửa'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
