import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import { Trash2, FolderOpen, Calendar, Clock } from 'lucide-react';
import { PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER } from '../../constants/presets';

interface ProjectInfo {
    id: string;
    name: string;
    updated_at: string;
}

interface ProjectBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: ProjectInfo[];
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
    loading: boolean;
}

export const ProjectBrowserModal: React.FC<ProjectBrowserModalProps> = ({
    isOpen, onClose, projects, onLoad, onDelete, loading
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cloud Projects">
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Tìm kiếm project..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-brand-cream focus:outline-none focus:border-brand-orange/50 transition-all text-sm"
                />
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {loading && (
                    <div className="py-20 text-center">
                        <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-brand-cream/40 text-xs">Đang tải danh sách...</p>
                    </div>
                )}

                {!loading && filteredProjects.length === 0 && (
                    <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl">
                        <p className="text-brand-cream/40 text-sm">Không tìm thấy dự án nào.</p>
                    </div>
                )}

                {!loading && filteredProjects.map(project => (
                    <div
                        key={project.id}
                        className="group flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-brand-orange/30 transition-all"
                    >
                        <div className="flex-1 min-w-0 mr-4">
                            <h3 className="text-brand-cream font-bold truncate group-hover:text-brand-orange transition-colors">
                                {project.name}
                            </h3>
                            <div className="flex items-center space-x-4 mt-1 text-[10px] text-brand-cream/40 uppercase tracking-widest">
                                <span className="flex items-center">
                                    <Calendar size={10} className="mr-1" />
                                    {formatDate(project.updated_at)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => onLoad(project.id)}
                                className="p-2 text-brand-orange hover:bg-brand-orange/10 rounded-lg transition-colors"
                                title="Mở dự án"
                            >
                                <FolderOpen size={18} />
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm(`Bạn có chắc muốn xóa dự án "${project.name}"?`)) {
                                        onDelete(project.id);
                                    }
                                }}
                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Xóa dự án"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-6 py-2 text-brand-cream/40 hover:text-brand-cream text-sm font-bold transition-colors"
                >
                    ĐÓNG
                </button>
            </div>
        </Modal>
    );
};
