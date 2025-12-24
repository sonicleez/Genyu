import React from 'react';

export const Tooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-black text-white text-xs rounded z-50 pointer-events-none text-center shadow-lg border border-gray-700">
        {text}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
    </div>
);
