import React from 'react';
import Modal from '../Modal';
import { ScreenplayView } from '../export/ScreenplayView';
import { ProjectState } from '../../types';

interface ScreenplayModalProps {
    isOpen: boolean;
    onClose: () => void;
    state: ProjectState;
}

export const ScreenplayModal: React.FC<ScreenplayModalProps> = ({ isOpen, onClose, state }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Xuất Kịch Bản Chuyên Nghiệp" maxWidth="max-w-5xl">
            <div className="flex flex-col h-[80vh]">
                <div className="flex justify-between items-center mb-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                    <p className="text-xs text-gray-400">Xem trước định dạng kịch bản chuẩn điện ảnh. Nhấn <span className="text-brand-green font-bold">In / Xuất PDF</span> để lưu file.</p>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-brand-green hover:bg-brand-green/80 text-brand-dark font-black rounded-lg transition-all active:scale-95 flex items-center gap-2"
                    >
                        🖨️ In / Xuất PDF
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-gray-950 p-8 rounded-xl border border-gray-800 custom-scrollbar">
                    <ScreenplayView state={state} />
                </div>
            </div>
        </Modal>
    );
};
