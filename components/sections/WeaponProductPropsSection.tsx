import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SectionTitle } from '../common/SectionTitle';
import { Product } from '../../types';

interface WeaponProductPropsSectionProps {
    products: Product[];
    onEditProduct: (id: string) => void;
    onDeleteProduct: (id: string) => void;
    onAddProduct: () => void;
}

export const WeaponProductPropsSection: React.FC<WeaponProductPropsSectionProps> = ({
    products,
    onEditProduct,
    onDeleteProduct,
    onAddProduct
}) => {
    return (
        <div className="my-16">
            <SectionTitle>Weapon/Product/Props</SectionTitle>
            <div className="grid md:grid-cols-3 gap-6">
                {products?.map((prod, index) => (
                    <div
                        key={prod.id}
                        className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-brand-orange cursor-pointer transition-all flex items-center space-x-4 relative group"
                        onClick={() => onEditProduct(prod.id)}
                    >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-lg bg-gray-900 border border-gray-600 overflow-hidden flex-shrink-0 relative">
                            {prod.masterImage ? (
                                <img src={prod.masterImage} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl">
                                    📦
                                </div>
                            )}

                            {/* Loading Indicator */}
                            {prod.isAnalyzing && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-orange"></div>
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-brand-cream truncate">{prod.name || `Product ${index + 1}`}</h3>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{prod.description || "No description"}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteProduct(prod.id); }}
                                className="p-1.5 text-gray-600 hover:text-red-500 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                ))}

                {/* Add Product Button */}
                <button
                    onClick={onAddProduct}
                    className="bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-700 hover:border-brand-orange hover:bg-gray-800/80 flex items-center justify-center space-x-3 transition-all group"
                >
                    <div className="w-10 h-10 rounded-full bg-gray-700 group-hover:bg-brand-orange/20 flex items-center justify-center transition-colors">
                        <Plus size={18} className="text-gray-500 group-hover:text-brand-orange" />
                    </div>
                    <span className="text-gray-400 group-hover:text-white font-medium">Thêm Sản Phẩm</span>
                </button>
            </div>
        </div>
    );
};
