import React, { useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, maxWidth = 'max-w-md' }) => {
    const mouseDownTarget = useRef<EventTarget | null>(null);

    if (!isOpen) return null;

    const handleMouseDown = (e: React.MouseEvent) => {
        mouseDownTarget.current = e.target;
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        // Only close if both mousedown AND mouseup happened on the backdrop (same target)
        if (mouseDownTarget.current === e.target && e.target === e.currentTarget) {
            onClose();
        }
        mouseDownTarget.current = null;
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
        >
            <div className={`bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full ${maxWidth} m-4 p-6 relative animate-fade-in max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                {children}
            </div>
        </div>
    );
};

export default Modal;
