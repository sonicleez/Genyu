import React from 'react';
import { PRIMARY_GRADIENT } from '../../constants/presets';

export interface ProjectNameInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProjectNameInput: React.FC<ProjectNameInputProps> = ({ value, onChange }) => (
    <div className="relative w-full max-w-2xl mx-auto my-8">
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder=" "
            className={`peer w-full bg-transparent text-center text-4xl md:text-5xl font-extrabold outline-none border-none p-2 transition-all duration-300 ${value ? `bg-clip-text text-transparent bg-gradient-to-r ${PRIMARY_GRADIENT}` : 'text-gray-500'}`}
            style={{ textTransform: 'uppercase' }}
        />
        <label className={`absolute left-0 -top-3.5 w-full text-center text-gray-500 text-sm transition-all duration-300 pointer-events-none 
            peer-placeholder-shown:text-xl peer-placeholder-shown:top-2 peer-placeholder-shown:text-gray-400
            peer-focus:-top-3.5 peer-focus:text-sm peer-focus:text-green-400`}>
            NHẬP TÊN DỰ ÁN CỦA BẠN
        </label>
    </div>
);
