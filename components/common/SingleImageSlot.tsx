import React, { useRef } from 'react';
import { Trash2, Brush, Plus } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface SingleImageSlotProps {
    image: string | null;
    label: string;
    onUpload: (image: string) => void;
    onRemove: () => void;
    onEdit?: () => void;
    isAnalyzing?: boolean;
}

export const SingleImageSlot: React.FC<SingleImageSlotProps> = ({ image, label, onUpload, onRemove, onEdit, isAnalyzing }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => onUpload(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col space-y-2 group">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
            <div className={`relative aspect-square rounded-xl bg-gray-900/50 border-2 border-dashed transition-all overflow-hidden ${image ? 'border-transparent' : 'border-gray-700 hover:border-brand-orange/50 hover:bg-gray-800/50'}`}>
                {image ? (
                    <>
                        <img src={image} alt={label} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 backdrop-blur-[2px]">
                            {onEdit && (
                                <button onClick={onEdit} className="p-2 bg-brand-orange text-white rounded-full hover:scale-110 transition-transform shadow-lg" title="Edit with Nano Banana">
                                    <Brush size={16} />
                                </button>
                            )}
                            <button onClick={onRemove} className="p-2 bg-red-600 text-white rounded-full hover:scale-110 transition-transform shadow-lg" title="Remove">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </>
                ) : (
                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={isAnalyzing}
                        className="w-full h-full flex flex-col items-center justify-center space-y-2 text-gray-500 hover:text-brand-orange transition-colors"
                    >
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center space-y-2">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-orange"></div>
                                <span className="text-[10px] animate-pulse">Analyzing...</span>
                            </div>
                        ) : (
                            <>
                                <Plus size={24} />
                                <span className="text-[10px] font-medium uppercase tracking-tighter">Upload</span>
                            </>
                        )}
                    </button>
                )}
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
            </div>
        </div>
    );
};
