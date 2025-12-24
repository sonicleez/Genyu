import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, maxWidth = 'max-w-md' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className={`bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full ${maxWidth} m-4 p-6 relative animate-fade-in max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                {children}
            </div>
        </div>
    );
};

export default Modal;
