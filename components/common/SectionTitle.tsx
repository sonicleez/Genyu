import React from 'react';

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-3xl font-bold text-left mb-8 bg-clip-text text-transparent bg-gradient-to-r from-brand-orange to-brand-red">
        {children}
    </h2>
);
