import { ProjectState } from '../types';
import { slugify } from './helpers';

// @ts-ignore
const JSZip = window.JSZip;

// Helper to extract base64 data and detect file extension from data URL
const extractImageData = (dataUrl: string): { base64: string; ext: string } | null => {
    if (!dataUrl) return null;

    // Handle data URL format: data:image/png;base64,XXXXX
    if (dataUrl.startsWith('data:')) {
        const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
            const mimeExt = match[1]; // png, jpeg, webp, etc.
            const base64 = match[2];
            // Map MIME types to file extensions
            let ext = 'png';
            if (mimeExt === 'jpeg' || mimeExt === 'jpg') ext = 'jpg';
            else if (mimeExt === 'webp') ext = 'webp';
            else if (mimeExt === 'gif') ext = 'gif';
            else if (mimeExt === 'png') ext = 'png';
            else ext = mimeExt; // fallback to mime type as extension
            return { base64, ext };
        }
        // Fallback: try simple split
        const parts = dataUrl.split(',');
        if (parts.length === 2) {
            return { base64: parts[1], ext: 'png' };
        }
    }

    // Not a data URL - skip
    console.warn('[ZIP Export] Skipping non-data URL image');
    return null;
};

export const handleDownloadAll = (state: ProjectState) => {
    if (!JSZip) {
        alert("JSZip not found. Please ensure it is loaded.");
        return;
    }

    const zip = new JSZip();
    const scenesFolder = zip.folder("Scenes");
    const assetsFolder = zip.folder("Assets");
    const charsFolder = assetsFolder?.folder("Characters");
    const productsFolder = assetsFolder?.folder("Products");

    let hasImages = false;

    // 1. SCENE MAP IMAGES
    state.scenes.forEach((scene) => {
        if (scene.generatedImage) {
            const imgData = extractImageData(scene.generatedImage);
            if (imgData) {
                scenesFolder?.file(`${scene.sceneNumber}.${imgData.ext}`, imgData.base64, { base64: true });
                hasImages = true;
            }
        }
    });

    // 2. ASSETS - Characters
    state.characters.forEach(c => {
        const cName = slugify(c.name) || c.id;
        const charImages: { key: string; img: string | null | undefined }[] = [
            { key: 'master', img: c.masterImage },
            { key: 'face', img: c.faceImage },
            { key: 'body', img: c.bodyImage },
            { key: 'side', img: c.sideImage },
            { key: 'back', img: c.backImage },
        ];
        charImages.forEach(({ key, img }) => {
            if (img) {
                const imgData = extractImageData(img);
                if (imgData) {
                    charsFolder?.file(`${cName}_${key}.${imgData.ext}`, imgData.base64, { base64: true });
                    hasImages = true;
                }
            }
        });
    });

    // 3. ASSETS - Products
    state.products.forEach(p => {
        const pName = slugify(p.name) || p.id;
        if (p.masterImage) {
            const imgData = extractImageData(p.masterImage);
            if (imgData) {
                productsFolder?.file(`${pName}_master.${imgData.ext}`, imgData.base64, { base64: true });
                hasImages = true;
            }
        }
        if (p.views) {
            const viewImages: { key: string; img: string | null | undefined }[] = [
                { key: 'front', img: p.views.front },
                { key: 'back', img: p.views.back },
                { key: 'left', img: p.views.left },
                { key: 'right', img: p.views.right },
                { key: 'top', img: p.views.top },
            ];
            viewImages.forEach(({ key, img }) => {
                if (img) {
                    const imgData = extractImageData(img);
                    if (imgData) {
                        productsFolder?.file(`${pName}_${key}.${imgData.ext}`, imgData.base64, { base64: true });
                        hasImages = true;
                    }
                }
            });
        }
    });

    if (!hasImages) {
        alert("Không có ảnh nào để tải xuống.");
        return;
    }

    zip.generateAsync({ type: "blob" }).then(function (content: Blob) {
        const filename = state.projectName ? `${slugify(state.projectName)}_full.zip` : 'project-images.zip';
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });
};
