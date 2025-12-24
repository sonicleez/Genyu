import React from 'react';
import { Character, CharacterProp } from '../../types';
import Modal from '../Modal';
import SingleImageSlot from '../SingleImageSlot';

interface CharacterDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    character: Character | null;
    updateCharacter: (id: string, updates: Partial<Character>) => void;
    setDefault: (id: string) => void;
    onAnalyze: (id: string, image: string) => void;
    onGenerateSheets: (id: string) => void;
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
    onAnalyze,
    onGenerateSheets,
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
                        onUpload={(img) => updateCharacter(character.id, { masterImage: img })}
                        onDelete={() => updateCharacter(character.id, { masterImage: null })}
                        onEdit={character.masterImage ? () => onEditImage(character.id, character.masterImage!, 'master') : undefined}
                        onGenerate={() => onOpenCharGen(character.id)}
                        aspect="auto"
                        subLabel="Upload hoặc Tạo AI"
                        isProcessing={character.isAnalyzing}
                    />
                    {/* Analyze Button */}
                    {character.masterImage && !character.isAnalyzing && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <button
                                onClick={() => onAnalyze(character.id, character.masterImage!)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 shadow-lg shadow-indigo-900/40"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <span>1. Gợi ý Tên/Mô tả</span>
                            </button>

                            <button
                                disabled={!character.description}
                                onClick={() => onGenerateSheets(character.id)}
                                className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 shadow-lg ${character.description ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40' : 'bg-gray-700 opacity-50 cursor-not-allowed'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>2. Tạo Lora nhận diện</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-700 my-4"></div>

                {/* Character Sheets (2 Views) */}
                <div>
                    <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Góc Nhìn Nhân Vật</h3>
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                </div>
            </div>
        </Modal>
    );
};
