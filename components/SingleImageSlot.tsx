import React, { useRef } from 'react';

interface SingleImageSlotProps {
    label: string;
    image: string | null;
    onUpload: (base64: string) => void;
    onDelete: () => void;
    onEdit?: () => void;
    onGenerate?: () => void;
    aspect?: 'square' | 'portrait' | 'auto'; // Added 'auto'
    subLabel?: React.ReactNode;
    isProcessing?: boolean;
}

const SingleImageSlot: React.FC<SingleImageSlotProps> = ({ label, image, onUpload, onDelete, onEdit, onGenerate, aspect = 'square', subLabel, isProcessing }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => onUpload(ev.target?.result as string);
        reader.readAsDataURL(file);
        e.target.value = ''; // reset
    };

    // Determine aspect class
    let aspectClass = 'aspect-square';
    if (aspect === 'portrait') aspectClass = 'aspect-[3/4]';
    if (aspect === 'auto') aspectClass = 'min-h-[250px]'; // Flexible height, minimum for drop zone

    return (
        <div className="flex flex-col space-y-1 w-full">
            <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-400">{label}</span>
                {onGenerate && !image && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                        className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded flex items-center space-x-1 transition-colors"
                    >
                        <span>✨ Tạo bằng AI</span>
                    </button>
                )}
            </div>
            <div
                className={`relative border-2 border-dashed border-gray-600 rounded-lg hover:border-gray-500 transition-colors bg-gray-900/50 flex flex-col items-center justify-center cursor-pointer group overflow-hidden w-full ${aspectClass}`}
                onClick={() => !image && fileInputRef.current?.click()}
            >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

                {isProcessing ? (
                    <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center flex-col h-full">
                        {/* h-full needed if aspect auto */}
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange mb-2"></div>
                        <span className="text-[10px] text-brand-orange">AI Creating...</span>
                    </div>
                ) : image ? (
                    <>
                        {/* Use h-auto for auto aspect, else h-full object-cover for fixed */}
                        <img
                            src={image}
                            alt="slot"
                            className={`w-full ${aspect === 'auto' ? 'h-auto max-h-[500px] object-contain' : 'h-full object-cover'}`}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity flex-col space-y-2 p-2 h-full">
                            <div className="flex space-x-2">
                                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs">Up lại</button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white text-xs">Xóa</button>
                            </div>
                            {onEdit && (
                                <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-full p-1.5 bg-brand-orange hover:bg-brand-red rounded text-brand-cream text-xs font-semibold flex items-center justify-center">
                                    ✏️ Sửa ảnh (AI)
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center p-2 h-full flex flex-col items-center justify-center">
                        <span className="text-2xl text-gray-600">+</span>
                        {subLabel && <div className="text-[10px] text-gray-500 mt-1">{subLabel}</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SingleImageSlot;
