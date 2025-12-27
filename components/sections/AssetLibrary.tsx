import React, { useState } from 'react';
import { Image as ImageIcon, Search, Trash2, CheckCircle2, Copy, Replace, Layers, X, Clock, Filter, Wand2 } from 'lucide-react';
import { ProjectState, GalleryAsset, Scene, Character, Product } from '../../types';

interface AssetLibraryProps {
    assets: GalleryAsset[];
    scenes: Scene[];
    characters: Character[];
    products: Product[];
    onReplaceScene: (sceneId: string, image: string) => void;
    onReplaceCharacterView: (charId: string, image: string, view: 'master' | 'face' | 'body' | 'side' | 'back') => void;
    onReplaceProductView: (productId: string, image: string, view: string) => void;
    onDeleteAsset: (assetId: string) => void;
    onClose: () => void;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({
    assets,
    scenes,
    characters,
    products,
    onReplaceScene,
    onReplaceCharacterView,
    onReplaceProductView,
    onDeleteAsset,
    onClose
}) => {
    const [filter, setFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAsset, setSelectedAsset] = useState<GalleryAsset | null>(null);
    const [showReplaceMenu, setShowReplaceMenu] = useState(false);

    const filteredAssets = assets.filter(asset => {
        const matchType = filter === 'all' || asset.type === filter;
        const matchSearch = !searchQuery || asset.prompt?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchType && matchSearch;
    });

    const categories = [
        { id: 'all', label: 'Tất cả' },
        { id: 'scene', label: 'Cảnh phim' },
        { id: 'character', label: 'Nhân vật' },
        { id: 'product', label: 'Sản phẩm' },
        { id: 'edit', label: 'Đã chỉnh sửa' },
    ];

    const handleReplace = (target: { type: 'scene' | 'char' | 'prod', id: string, view?: string }) => {
        if (!selectedAsset) return;

        if (target.type === 'scene') {
            onReplaceScene(target.id, selectedAsset.image);
        } else if (target.type === 'char') {
            onReplaceCharacterView(target.id, selectedAsset.image, target.view as any);
        } else if (target.type === 'prod') {
            onReplaceProductView(target.id, selectedAsset.image, target.view || 'master');
        }

        setShowReplaceMenu(false);
        alert('Đã thay thế thành công!');
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0b] border-l border-gray-800/80 shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <ImageIcon size={18} className="text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-wider">Thư viện Asset</h2>
                        <p className="text-[10px] text-gray-500 font-bold">{assets.length} hình ảnh trong phiên</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400">
                    <X size={20} />
                </button>
            </div>

            {/* Filters & Search */}
            <div className="p-3 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm prompt..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-gray-700"
                    />
                </div>
                <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilter(cat.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${filter === cat.id
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                                    : 'bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Assets Grid */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-800">
                {filteredAssets.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {filteredAssets.map(asset => (
                            <div
                                key={asset.id}
                                onClick={() => setSelectedAsset(asset)}
                                className={`group relative aspect-video rounded-lg overflow-hidden border cursor-pointer transition-all ${selectedAsset?.id === asset.id ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                <img src={asset.image} alt="Gallery" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                                    <p className="text-[8px] text-white line-clamp-2 leading-tight">{asset.prompt || 'Không có mô tả'}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className={`px-1 rounded-[2px] text-[7px] font-bold uppercase ${asset.type === 'scene' ? 'bg-blue-600' :
                                                asset.type === 'character' ? 'bg-green-600' :
                                                    asset.type === 'product' ? 'bg-orange-600' : 'bg-purple-600'
                                            }`}>
                                            {asset.type}
                                        </span>
                                        <span className="text-[7px] text-gray-400"><Clock size={6} className="inline mr-0.5" />{new Date(asset.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                        <ImageIcon size={48} strokeWidth={1} className="mb-2 opacity-20" />
                        <p className="text-xs">Chưa có ảnh nào trong thư viện</p>
                    </div>
                )}
            </div>

            {/* Selection Info / Replace Menu */}
            {selectedAsset && (
                <div className="p-4 border-t border-gray-800 bg-gray-950/80 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-20 aspect-video rounded-md overflow-hidden border border-gray-800 shrink-0 shadow-lg">
                            <img src={selectedAsset.image} className="w-full h-full object-cover" alt="Preview" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-[10px] text-gray-300 line-clamp-3 italic mb-1">"{selectedAsset.prompt || 'Asset không có mô tả'}"</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onDeleteAsset(selectedAsset.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                                    title="Xóa khỏi thư viện"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(selectedAsset.image);
                                        alert('Đã copy base64!');
                                    }}
                                    className="p-1.5 text-gray-400 hover:bg-gray-800 rounded-md transition-all"
                                    title="Copy Base64"
                                >
                                    <Copy size={14} />
                                </button>
                                <button
                                    onClick={() => window.open(selectedAsset.image, '_blank')}
                                    className="p-1.5 text-gray-400 hover:bg-gray-800 rounded-md transition-all"
                                    title="Mở ảnh lớn"
                                >
                                    <Replace size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <button
                            onClick={() => setShowReplaceMenu(!showReplaceMenu)}
                            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Replace size={16} />
                            Thay thế vào dự án
                        </button>
                    </div>

                    {showReplaceMenu && (
                        <div className="mt-3 p-3 bg-gray-900 rounded-xl border border-gray-800 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                            {/* Scenes */}
                            {scenes.length > 0 && (
                                <div>
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-1.5 block">Chọn Cảnh (Scene)</label>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {scenes.map((s, i) => (
                                            <button
                                                key={s.id}
                                                onClick={() => handleReplace({ type: 'scene', id: s.id })}
                                                className="aspect-square bg-gray-800 hover:bg-purple-600 rounded text-[10px] font-bold text-white transition-colors border border-gray-700 hover:border-purple-400"
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Characters */}
                            {characters.length > 0 && (
                                <div>
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-1.5 block">Chọn Nhân Vật (Character View)</label>
                                    <div className="space-y-2">
                                        {characters.map(char => (
                                            <div key={char.id} className="space-y-1">
                                                <p className="text-[9px] text-gray-400 truncate font-bold">{char.name || 'Unnamed'}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {['master', 'face', 'body', 'side', 'back'].map(view => (
                                                        <button
                                                            key={view}
                                                            onClick={() => handleReplace({ type: 'char', id: char.id, view })}
                                                            className="px-2 py-1 bg-gray-800 hover:bg-green-600 rounded text-[8px] font-bold text-gray-300 hover:text-white transition-colors border border-gray-700"
                                                        >
                                                            {view.toUpperCase()}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
