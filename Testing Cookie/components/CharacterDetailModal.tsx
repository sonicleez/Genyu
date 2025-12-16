import React from 'react';
import { Character, CharacterProp } from '../types';
import Modal from './Modal';
import SingleImageSlot from './SingleImageSlot';

interface CharacterDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    character: Character | null;
    updateCharacter: (id: string, updates: Partial<Character>) => void;
    setDefault: (id: string) => void;
    onMasterUpload: (id: string, image: string) => void;
    onEditImage: (id: string, image: string, type: 'master' | 'face' | 'body' | 'prop' | 'side' | 'back', propIndex?: number) => void;
    onOpenCharGen: (id: string) => void;
    onDelete: (id: string) => void;
}

export const CharacterDetailModal: React.FC<CharacterDetailModalProps> = ({
    isOpen,
    onClose,
    character,
    updateCharacter,
    setDefault,
    onMasterUpload,
    onEditImage,
    onOpenCharGen,
    onDelete
}) => {
    if (!character) return null;

    const updateProp = (propIndex: number, field: keyof CharacterProp, value: string | null) => {
        const newProps = [...character.props];
        newProps[propIndex] = { ...newProps[propIndex], [field]: value };
        updateCharacter(character.id, { props: newProps });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Chỉnh sửa: ${character.name || 'Unnamed Character'}`}>
            <div className="space-y-6">

                {/* Header Actions */}
                <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setDefault(character.id)}
                            className={`px-3 py-1 rounded-full border border-gray-600 transition-colors ${character.isDefault ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500' : 'text-gray-400 hover:text-white hover:border-white'}`}
                        >
                            {character.isDefault ? '⭐ Default Character' : 'Set as Default'}
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            if (confirm("Bạn có chắc muốn xóa nhân vật này?")) {
                                onDelete(character.id);
                                onClose();
                            }
                        }}
                        className="text-red-500 hover:text-red-400 text-sm underline"
                    >
                        Delete Character
                    </button>
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Tên Nhân Vật</label>
                        <input
                            type="text"
                            value={character.name}
                            onChange={e => updateCharacter(character.id, { name: e.target.value })}
                            className="w-full bg-brand-dark/50 border border-gray-600 rounded px-3 py-2 text-brand-cream focus:outline-none focus:border-brand-orange"
                            placeholder="VD: Nguyễn Văn A"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Mô tả đặc điểm</label>
                        <textarea
                            value={character.description}
                            onChange={e => updateCharacter(character.id, { description: e.target.value })}
                            rows={3}
                            className="w-full bg-brand-dark/50 border border-gray-600 rounded px-3 py-2 text-brand-cream focus:outline-none focus:border-brand-orange"
                            placeholder="VD: Tóc vàng, mắt xanh, áo khoác da màu đen, có sẹo trên mặt..."
                        />
                    </div>
                </div>

                {/* Master Image */}
                <div>
                    <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Reference Chính</h3>
                    <SingleImageSlot
                        label="Ảnh Gốc (Master Reference)"
                        image={character.masterImage}
                        onUpload={(img) => onMasterUpload(character.id, img)}
                        onDelete={() => updateCharacter(character.id, { masterImage: null })}
                        onEdit={character.masterImage ? () => onEditImage(character.id, character.masterImage!, 'master') : undefined}
                        onGenerate={() => onOpenCharGen(character.id)}
                        aspect="auto"
                        subLabel="Upload hoặc Tạo AI"
                        isProcessing={character.isAnalyzing}
                    />
                    {/* Analyze Button */}
                    {character.masterImage && (!character.faceImage || !character.bodyImage) && !character.isAnalyzing && !character.workflowStatus && (
                        <button
                            onClick={() => onMasterUpload(character.id, character.masterImage!)}
                            className="w-full mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center space-x-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>🔍 Phân tích → Tạo Face ID + Body</span>
                        </button>
                    )}
                </div>

                <div className="border-t border-gray-700 my-4"></div>

                {/* Character Sheets (4 Views) */}
                <div>
                    <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Character Sheets (4 Views)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* 1. Face ID */}
                        <SingleImageSlot
                            label="Face ID"
                            image={character.faceImage}
                            onUpload={(img) => updateCharacter(character.id, { faceImage: img })}
                            onDelete={() => updateCharacter(character.id, { faceImage: null })}
                            onEdit={character.faceImage ? () => onEditImage(character.id, character.faceImage!, 'face') : undefined}
                            subLabel="Gương mặt"
                        />
                        {/* 2. Full Body */}
                        <SingleImageSlot
                            label="Full Body"
                            image={character.bodyImage}
                            onUpload={(img) => updateCharacter(character.id, { bodyImage: img })}
                            onDelete={() => updateCharacter(character.id, { bodyImage: null })}
                            onEdit={character.bodyImage ? () => onEditImage(character.id, character.bodyImage!, 'body') : undefined}
                            aspect="portrait"
                            subLabel="Toàn thân"
                        />
                        {/* 3. Side Profile */}
                        <SingleImageSlot
                            label="Side Profile"
                            image={character.sideImage}
                            onUpload={(img) => updateCharacter(character.id, { sideImage: img })}
                            onDelete={() => updateCharacter(character.id, { sideImage: null })}
                            onEdit={character.sideImage ? () => onEditImage(character.id, character.sideImage!, 'side') : undefined}
                            aspect="portrait"
                            subLabel="Góc nghiêng"
                        />
                        {/* 4. Back View */}
                        <SingleImageSlot
                            label="Back View"
                            image={character.backImage}
                            onUpload={(img) => updateCharacter(character.id, { backImage: img })}
                            onDelete={() => updateCharacter(character.id, { backImage: null })}
                            onEdit={character.backImage ? () => onEditImage(character.id, character.backImage!, 'back') : undefined}
                            aspect="portrait"
                            subLabel="Sau lưng"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};
