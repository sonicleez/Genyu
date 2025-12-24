import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PRIMARY_GRADIENT } from '../../constants/presets';

interface TextExpanderModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const TextExpanderModal: React.FC<TextExpanderModalProps> = ({ isOpen, onClose, title, value, onChange, placeholder }) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        if (isOpen) setLocalValue(value);
    }, [isOpen, value]);

    const handleSave = () => {
        onChange(localValue);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>📝</span> {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="flex-1 p-4 overflow-hidden">
                    <textarea
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        placeholder={placeholder}
                        autoFocus
                        className="w-full h-full min-h-[300px] bg-gray-800 border border-gray-600 rounded-lg p-4 text-white text-sm leading-relaxed focus:border-brand-orange focus:outline-none resize-none"
                    />
                </div>
                <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleSave} className={`px-6 py-2 bg-gradient-to-r ${PRIMARY_GRADIENT} text-white font-bold rounded-lg hover:opacity-90 transition-opacity`}>
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export interface ExpandableTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
    title?: string;
}

export const ExpandableTextarea: React.FC<ExpandableTextareaProps> = ({ value, onChange, placeholder, rows = 3, className = '', title = 'Chỉnh sửa nội dung' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const prevExpanded = useRef(isExpanded);

    useEffect(() => {
        if (prevExpanded.current && !isExpanded) {
            // Modal just closed, return focus to the trigger button
            triggerRef.current?.focus();
        }
        prevExpanded.current = isExpanded;
    }, [isExpanded]);

    return (
        <>
            <div className="relative group">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    className={className}
                />
                <button
                    ref={triggerRef}
                    onClick={() => setIsExpanded(true)}
                    className="absolute top-1 right-1 w-5 h-5 bg-gray-700/80 hover:bg-brand-orange text-gray-400 hover:text-white rounded flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                    title="Mở rộng để chỉnh sửa"
                >
                    ⛶
                </button>
            </div>
            <TextExpanderModal
                isOpen={isExpanded}
                onClose={() => setIsExpanded(false)}
                title={title}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
        </>
    );
};
