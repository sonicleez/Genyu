import React, { useRef, useState } from 'react';
import Modal from './Modal';
import type { Product } from '../types';
import { Brush } from 'lucide-react';

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    updateProduct: (id: string, updates: Partial<Product>) => void;
    onMasterImageUpload: (id: string, image: string) => void;
    onDelete: (id: string) => void;
    onGenerateProduct?: (id: string, prompt: string) => void;
    onEdit: (id: string, image: string, view?: 'front' | 'back' | 'left' | 'right' | 'top') => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
    isOpen,
    onClose,
    product,
    updateProduct,
    onMasterImageUpload,
    onDelete,
    onGenerateProduct,
    onEdit
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [genPrompt, setGenPrompt] = useState('');

    if (!product) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            onMasterImageUpload(product.id, base64);
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    const handleGenerateClick = () => {
        if (onGenerateProduct) {
            onGenerateProduct(product.id, genPrompt);
        }
    };

    const viewLabels = [
        { key: 'front' as const, label: 'Front', icon: '⬆️' },
        { key: 'back' as const, label: 'Back', icon: '⬇️' },
        { key: 'left' as const, label: 'Left', icon: '⬅️' },
        { key: 'right' as const, label: 'Right', icon: '➡️' },
        { key: 'top' as const, label: 'Top', icon: '🔝' },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📦 Chi tiết Sản phẩm / Đạo cụ">
            <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Tên sản phẩm</label>
                        <input
                            type="text"
                            value={product.name}
                            onChange={e => updateProduct(product.id, { name: e.target.value })}
                            className="w-full bg-brand-dark/50 border border-gray-600 rounded px-3 py-2 text-brand-cream focus:outline-none focus:border-brand-orange"
                            placeholder="VD: Kiếm ma thuật, Camera cổ điển"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Mô tả</label>
                        <input
                            type="text"
                            value={product.description}
                            onChange={e => updateProduct(product.id, { description: e.target.value })}
                            className="w-full bg-brand-dark/50 border border-gray-600 rounded px-3 py-2 text-brand-cream focus:outline-none focus:border-brand-orange"
                            placeholder="Chất liệu, màu sắc, hình dáng..."
                        />
                    </div>
                </div>

                {/* Master Image Upload */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        🎯 Ảnh gốc (Master Reference)
                        <span className="text-xs text-gray-500 ml-2">Upload ảnh → AI tự động tạo 5 góc nhìn</span>
                    </label>
                    <div className="flex items-start gap-4">
                        {/* Image Slot */}
                        <div
                            className="w-40 h-40 flex-shrink-0 relative border-2 border-dashed border-gray-600 rounded-lg hover:border-brand-orange transition-colors bg-gray-900/50 flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
                            onClick={() => !product.masterImage && fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />

                            {product.isAnalyzing ? (
                                <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center flex-col">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange mb-2"></div>
                                    <span className="text-[10px] text-brand-orange">Đang tạo 5 góc...</span>
                                </div>
                            ) : product.masterImage ? (
                                <>
                                    <img src={product.masterImage} alt="Master" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity flex-col space-y-2 p-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs"
                                        >
                                            Đổi ảnh
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEdit(product.id, product.masterImage!); }}
                                            className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white text-xs flex items-center space-x-1"
                                        >
                                            <Brush size={12} />
                                            <span>Sửa ảnh</span>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); updateProduct(product.id, { masterImage: null, views: { front: null, back: null, left: null, right: null, top: null } }); }}
                                            className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white text-xs"
                                        >
                                            Xóa
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMasterImageUpload(product.id, product.masterImage!); }}
                                            className="w-full p-1.5 bg-brand-orange hover:bg-brand-red rounded text-white text-xs font-semibold"
                                        >
                                            🔄 Tạo lại 5 góc
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-2">
                                    <span className="text-3xl text-gray-600">+</span>
                                    <div className="text-[10px] text-gray-500 mt-1">Upload ảnh</div>
                                </div>
                            )}
                        </div>

                        {/* AI Generate Button (when no master image) */}
                        {!product.masterImage && !product.isAnalyzing && onGenerateProduct && (
                            <div className="flex-1 space-y-2">
                                <p className="text-xs text-gray-400">Hoặc tạo sản phẩm bằng AI:</p>
                                <input
                                    type="text"
                                    value={genPrompt}
                                    onChange={(e) => setGenPrompt(e.target.value)}
                                    placeholder="VD: Kiếm katana Nhật Bản, lưỡi bạc, cán quấn vải đen..."
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-xs text-white focus:border-brand-orange"
                                />
                                <button
                                    onClick={() => {
                                        if (!genPrompt.trim()) return alert("Vui lòng nhập mô tả sản phẩm.");
                                        updateProduct(product.id, { description: genPrompt });
                                        handleGenerateClick();
                                    }}
                                    disabled={product.isAnalyzing}
                                    className="w-full px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-red hover:from-brand-red hover:to-brand-orange text-white font-semibold rounded-lg text-sm transition-all disabled:opacity-50"
                                >
                                    {product.isAnalyzing ? '✨ Đang tạo...' : '✨ Tạo bằng AI'}
                                </button>
                            </div>
                        )}

                        {/* Status Message */}
                        {product.isAnalyzing && (
                            <div className="flex items-center text-brand-orange text-sm">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-orange mr-2"></div>
                                Đang phân tích & tạo 5 góc nhìn...
                            </div>
                        )}
                    </div>
                </div>

                {/* 5 Generated Views */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        🖼️ 5 Góc nhìn (Auto-generated)
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                        {viewLabels.map(({ key, label, icon }) => (
                            <div key={key} className="text-center">
                                <div className="text-[10px] text-gray-400 mb-1">{icon} {label}</div>
                                <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-brand-orange transition-colors">
                                    {product.views[key] ? (
                                        <div className="relative w-full h-full group">
                                            <img
                                                src={product.views[key]!}
                                                alt={label}
                                                className="w-full h-full object-cover cursor-pointer"
                                                onClick={() => window.open(product.views[key]!, '_blank')}
                                            />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onEdit(product.id, product.views[key]!, key); }}
                                                    className="p-1 bg-purple-600 hover:bg-purple-500 rounded text-white"
                                                    title="Chỉnh sửa ảnh này"
                                                >
                                                    <Brush size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px]">
                                            —
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t border-gray-700">
                    <button
                        onClick={() => { onDelete(product.id); onClose(); }}
                        className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition-colors"
                    >
                        🗑️ Xóa sản phẩm
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-brand-orange hover:bg-brand-red text-brand-cream rounded-lg font-semibold transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </Modal>
    );
};
