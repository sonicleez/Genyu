import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import CanvasDraw from "react-canvas-draw";

interface MaskCanvasProps {
    image: string;
    width: number;
    height: number;
    brushRadius: number;
    brushColor?: string;
    className?: string;
    disabled?: boolean;
}

export interface MaskCanvasHandle {
    undo: () => void;
    clear: () => void;
    getDataURL: () => string; // Returns the drawing as an image
    getMaskDataURL: () => Promise<string>; // Returns a clean B&W mask
    hasDrawing: () => boolean; // Returns true if any strokes were drawn
}

const MaskCanvas = forwardRef<MaskCanvasHandle, MaskCanvasProps>(({ image, width, height, brushRadius, brushColor = "#a855f7", className, disabled = false }, ref) => {
    const canvasRef = useRef<any>(null);
    const [canvasKey, setCanvasKey] = useState(0); // Force re-render when dimensions change

    useEffect(() => {
        setCanvasKey(prev => prev + 1);
    }, [width, height]);

    useImperativeHandle(ref, () => ({
        undo: () => {
            canvasRef.current?.undo();
        },
        clear: () => {
            canvasRef.current?.clear();
        },
        getDataURL: () => {
            return canvasRef.current?.getDataURL();
        },
        getMaskDataURL: async () => {
            // This function creates a binary mask (white drawing on black background)
            // React-canvas-draw gives us the drawing on a transparent background
            const drawingDataUrl = canvasRef.current?.getDataURL();

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve('');

                    // 1. Fill black background
                    ctx.fillStyle = "black";
                    ctx.fillRect(0, 0, width, height);

                    // 2. Draw the drawing layer on top. 
                    // The drawing layer (React-canvas-draw) provides a transparent canvas with colored strokes.
                    // We draw it onto our black background.
                    ctx.drawImage(img, 0, 0, width, height);

                    // 3. Convert non-black pixels to white (simple thresholding)
                    // This ensures that even if we had translucent brush colors, they become solid white in the mask.
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const alpha = data[i + 3];
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        // CRITICAL: We need to distinguish between the Brush (purple) and Eraser (transparent/black).
                        // react-canvas-draw doesn't have a built-in "erase" mode that cuts through other paths in the same layer.
                        // It just draws more paths. If the brush color is #00000000, it draws transparent paths which don't change anything.

                        // BUT, if we use a specific "eraser" color (e.g. solid black #000000) for the brush, 
                        // we can detect it here and turn those pixels black in the final mask.

                        // If color is roughly black AND alpha is high, it's an eraser stroke
                        if (alpha > 0) {
                            if (r < 10 && g < 10 && b < 10) {
                                // Eraser stroke -> make it black in mask
                                data[i] = 0;
                                data[i + 1] = 0;
                                data[i + 2] = 0;
                                data[i + 3] = 255;
                            } else {
                                // Brush stroke -> make it white in mask
                                data[i] = 255;
                                data[i + 1] = 255;
                                data[i + 2] = 255;
                                data[i + 3] = 255;
                            }
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);

                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = drawingDataUrl;
            });
        },
        hasDrawing: () => {
            const saveData = canvasRef.current?.getSaveData();
            if (!saveData) return false;
            try {
                const parsed = JSON.parse(saveData);
                return parsed.lines && parsed.lines.length > 0;
            } catch (e) {
                return false;
            }
        }
    }));

    return (
        <div className={`relative ${className}`} style={{ width, height }}>
            {/* Background Image Layer */}
            <img
                src={image}
                alt="Reference"
                crossOrigin="anonymous" // CRITICAL: Allow CORS
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                style={{ width, height }}
            />

            {/* Drawing Layer */}
            <CanvasDraw
                key={canvasKey}
                ref={canvasRef}
                brushColor={brushColor}
                brushRadius={brushRadius}
                lazyRadius={0} // Immediate drawing
                canvasWidth={width}
                canvasHeight={height}
                hideGrid={true}
                disabled={disabled}
                hideInterface={disabled}
                backgroundColor="transparent"
                imgSrc="" // We handle background manually to ensure proper scaling
                className={`absolute inset-0 ${disabled ? 'pointer-events-none' : ''}`}
                style={{ background: 'transparent' }}
            />
        </div>
    );
});

export default MaskCanvas;
