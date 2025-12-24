import { ProjectState } from '../types';
import { slugify } from './helpers';

// @ts-ignore
const JSZip = window.JSZip;

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
            const imgData = scene.generatedImage.split(',')[1];
            scenesFolder?.file(`${scene.sceneNumber}.png`, imgData, { base64: true });
            hasImages = true;
        }
    });

    // 2. ASSETS
    state.characters.forEach(c => {
        const cName = slugify(c.name) || c.id;
        if (c.masterImage) { charsFolder?.file(`${cName}_master.png`, c.masterImage.split(',')[1], { base64: true }); hasImages = true; }
        if (c.faceImage) { charsFolder?.file(`${cName}_face.png`, c.faceImage.split(',')[1], { base64: true }); hasImages = true; }
        if (c.bodyImage) { charsFolder?.file(`${cName}_body.png`, c.bodyImage.split(',')[1], { base64: true }); hasImages = true; }
        if (c.sideImage) { charsFolder?.file(`${cName}_side.png`, c.sideImage.split(',')[1], { base64: true }); hasImages = true; }
        if (c.backImage) { charsFolder?.file(`${cName}_back.png`, c.backImage.split(',')[1], { base64: true }); hasImages = true; }
    });

    state.products.forEach(p => {
        const pName = slugify(p.name) || p.id;
        if (p.masterImage) { productsFolder?.file(`${pName}_master.png`, p.masterImage.split(',')[1], { base64: true }); hasImages = true; }
        if (p.views) {
            if (p.views.front) { productsFolder?.file(`${pName}_front.png`, p.views.front.split(',')[1], { base64: true }); hasImages = true; }
            if (p.views.back) { productsFolder?.file(`${pName}_back.png`, p.views.back.split(',')[1], { base64: true }); hasImages = true; }
            if (p.views.left) { productsFolder?.file(`${pName}_left.png`, p.views.left.split(',')[1], { base64: true }); hasImages = true; }
            if (p.views.right) { productsFolder?.file(`${pName}_right.png`, p.views.right.split(',')[1], { base64: true }); hasImages = true; }
            if (p.views.top) { productsFolder?.file(`${pName}_top.png`, p.views.top.split(',')[1], { base64: true }); hasImages = true; }
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
