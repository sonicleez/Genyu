import React, { useState, useRef, useEffect } from 'react';
import { Type, GoogleGenAI } from "@google/genai";
import { X, Undo, Eraser, Brush, Download, Wand2, Image as ImageIcon, History } from 'lucide-react';
import MaskCanvas, { MaskCanvasHandle } from './MaskCanvas';

interface AdvancedImageEditorProps {
    isOpen: boolean;
    onClose: () => void;
    sourceImage: string;
    onSave: (editedImage: string) => void;
    apiKey: string;
    genyuToken?: string;
}

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const AdvancedImageEditor: React.FC<AdvancedImageEditorProps> = ({
    isOpen,
    onClose,
    sourceImage,
    onSave,
    apiKey,
    genyuToken: genyuTokenProp
}) => {
    // Canvas State
    const canvasRef = useRef<MaskCanvasHandle>(null);
    const [brushSize, setBrushSize] = useState(20);
    const [isEraser, setIsEraser] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [maskOpacity, setMaskOpacity] = useState(0.5); // Added based on instruction
    const [brushRadius, setBrushRadius] = useState(20); // Added based on instruction

    // Image State
    const [currentImage, setCurrentImage] = useState(sourceImage);
    const [history, setHistory] = useState<{ id: string, image: string, prompt: string }[]>([
        { id: generateId(), image: sourceImage, prompt: 'Original' }
    ]);

    // Dimensions for the canvas
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 }); // Added based on instruction
    const [genyuToken, setGenyuToken] = useState<string | null>(null); // Added based on instruction

    // Load Token from localStorage
    useEffect(() => {
        const t = localStorage.getItem('genyuToken');
        if (t) setGenyuToken(t);
    }, []);

    // Initial Load & CORS Handling
    useEffect(() => {
        if (isOpen && sourceImage) {
            // Check if image is URL (not base64)
            if (!sourceImage.startsWith('data:')) {
                // Preload with CORS to ensure Canvas doesn't get tainted
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = sourceImage;
                img.onload = () => {
                    // Update state to use this loaded URL (or original if it works)
                    // We just need to warm the cache or ensure browser accepts it
                    setCurrentImage(sourceImage);
                };
                img.onerror = () => {
                    // Fallback: Convert to Base64 via Proxy if direct load fails
                    console.log("Direct load failed, trying proxy for CORS...");
                    fetch(`http://localhost:3001/api/proxy/fetch-image?url=${encodeURIComponent(sourceImage)}`)
                        .then(res => res.blob())
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onloadend = () => setCurrentImage(reader.result as string);
                            reader.readAsDataURL(blob);
                        })
                        .catch(err => console.error("Proxy fetch failed:", err));
                }
            } else {
                setCurrentImage(sourceImage);
            }
            setHistory([{ id: 'original', image: sourceImage, prompt: 'Original' }]);
            setMaskOpacity(0.5);
            setBrushRadius(20);
        }
    }, [isOpen, sourceImage]);

    // Initial Load & Resize Handler
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const updateDimensions = () => {
                const { clientWidth, clientHeight } = containerRef.current!;
                // Maintain aspect ratio of the source image if possible, but fit within container
                const img = new Image();
                img.src = currentImage;
                img.onload = () => {
                    const aspect = img.width / img.height;
                    let newWidth = clientWidth;
                    let newHeight = clientWidth / aspect;

                    if (newHeight > clientHeight) {
                        newHeight = clientHeight;
                        newWidth = clientHeight * aspect;
                    }

                    setDimensions({ width: newWidth, height: newHeight });
                };
            };

            updateDimensions();
            window.addEventListener('resize', updateDimensions);
            return () => window.removeEventListener('resize', updateDimensions);
        }
    }, [isOpen, currentImage]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);

        try {
            // 1. Get Mask
            const maskBase64 = await canvasRef.current?.getMaskDataURL();
            if (!maskBase64) throw new Error("Failed to generate mask");

            const cleanSource = currentImage.split(',')[1];
            const cleanMask = maskBase64.split(',')[1];

            // 2. Decide API Route
            // If valid genyuToken exists, use the Proxy (FX Flow)
            // Otherwise fallback to Gemini API Key
            // We verify token format simply here, server does real check
            const useProxy = !!genyuToken && genyuToken.length > 20;

            if (useProxy) {
                console.log("🚀 Using Genyu API Proxy (FX Flow)...");
                const response = await fetch('http://localhost:3001/api/proxy/genyu/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: genyuToken,
                        prompt: prompt,
                        image: currentImage, // Send full data URL, server cleans it
                        mask: maskBase64
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Proxy Error: ${errorText}`);
                }

                const data = await response.json();
                console.log("✅ Proxy Response:", data);

                let newImageBase64 = data.image;

                // Handle legacy or direct return fallback
                if (!newImageBase64) {
                    // Try old paths just in case server logic missed something or direct pass-through
                    if (data.images && data.images[0]) {
                        newImageBase64 = typeof data.images[0] === 'string' ? data.images[0] : data.images[0].imageInput?.content;
                    } else if (Array.isArray(data) && data[0]) {
                        newImageBase64 = data[0];
                    }
                }

                if (newImageBase64) {
                    if (!newImageBase64.startsWith('data:image')) {
                        newImageBase64 = `data:image/jpeg;base64,${newImageBase64}`;
                    }
                    console.log("Setting new image for chain editing...");
                    setCurrentImage(newImageBase64);
                    setHistory(prev => [...prev, { id: generateId(), image: newImageBase64!, prompt }]);
                    // IMPORTANT: Clear the mask so user sees the new image clearly
                    canvasRef.current?.clear();
                } else {
                    console.warn("Could not find image in proxy response", data);
                    throw new Error("AI generated something, but I couldn't find the image in the response.");
                }

            } else {
                // FALLBACK: Pure Gemini API
                console.log("Using Standard Gemini API...");
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [
                            { inlineData: { data: cleanSource, mimeType: 'image/jpeg' } },
                            { inlineData: { data: cleanMask, mimeType: 'image/png' } },
                            { text: prompt }
                        ]
                    }
                });

                const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (imagePart?.inlineData) {
                    const newImage = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                    setCurrentImage(newImage);
                    setHistory(prev => [...prev, { id: generateId(), image: newImage, prompt }]);
                    canvasRef.current?.clear(); // Clear mask after successful edit
                } else {
                    throw new Error("No image generated from Gemini");
                }
            }

        } catch (err: any) {
            console.error("Edit failed:", err);
            setError(err.message || "Generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUndo = () => {
        canvasRef.current?.undo();
    };

    const handleRestoreHistory = (scan: typeof history[0]) => {
        setCurrentImage(scan.image);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
            <div className="bg-[#121212] w-full h-full md:w-[95vw] md:h-[90vh] md:rounded-2xl flex flex-col overflow-hidden relative shadow-2xl border border-gray-800">

                {/* Header */}
                <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-[#1a1a1a]">
                    <div className="flex items-center space-x-2 text-purple-400">
                        <Wand2 size={24} />
                        <span className="font-bold text-lg tracking-wide text-white">CyberMask Studio</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={handleUndo} className="p-2 text-gray-400 hover:text-white transition-colors" title="Undo Mask (Ctrl+Z)">
                            <Undo size={20} />
                        </button>
                        <div className="h-6 w-px bg-gray-700 mx-2"></div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Main Workspace */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left: History & Reference */}
                    <div className="w-20 md:w-64 bg-[#151515] border-r border-gray-800 flex flex-col">
                        <div className="p-4 border-b border-gray-800 text-gray-400 text-xs font-bold uppercase tracking-wider">History</div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {history.map((scan, i) => (
                                <div
                                    key={scan.id}
                                    onClick={() => handleRestoreHistory(scan)}
                                    className={`p-2 rounded-lg cursor-pointer transition-all border ${currentImage === scan.image ? 'border-purple-500 bg-purple-500/10' : 'border-transparent hover:bg-gray-800'}`}
                                >
                                    <img src={scan.image} className="w-full h-24 object-cover rounded mb-2 bg-black" />
                                    <div className="hidden md:block text-xs text-gray-400 truncate">{i === 0 ? 'Original' : scan.prompt}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Center: Canvas */}
                    <div className="flex-1 bg-[#0a0a0a] flex flex-col relative">

                        {/* Floating Toolbar */}
                        <div className="absolute top-4 right-4 bg-[#1a1a1a]/90 backdrop-blur border border-gray-700 rounded-full px-6 py-3 flex items-center space-x-6 shadow-2xl z-20">
                            <button
                                onClick={() => setIsEraser(false)}
                                className={`flex flex-col items-center space-y-1 ${!isEraser ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Brush size={20} />
                                <span className="text-[10px] font-bold">Brush</span>
                            </button>

                            <button
                                onClick={() => canvasRef.current?.clear()}
                                className="flex flex-col items-center space-y-1 text-gray-500 hover:text-red-400"
                            >
                                <Eraser size={20} />
                                <span className="text-[10px] font-bold">Clear</span>
                            </button>

                            <div className="w-px h-8 bg-gray-700"></div>

                            <div className="flex items-center space-x-3">
                                <span className="text-xs text-gray-400">Size</span>
                                <input
                                    type="range"
                                    min="5"
                                    max="100"
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="w-24 accent-purple-500"
                                />
                                <span className="text-xs w-6 text-right text-gray-500">{brushSize}</span>
                            </div>
                        </div>

                        {/* Canvas Container */}
                        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden" ref={containerRef}>
                            <MaskCanvas
                                ref={canvasRef}
                                image={currentImage}
                                width={dimensions.width}
                                height={dimensions.height}
                                brushRadius={brushSize / 2}
                                brushColor={isEraser ? "#00000000" : "rgba(168, 85, 247, 0.6)"} // Transparent for eraser (hacky), purple opacity for brush
                            // Note: react-canvas-draw eraser mode is handled via props usually, but we might check docs
                            // Actually, react-canvas-draw doesn't support 'eraser' mode easily without a specific prop.
                            // Workaround: We might need to implement eraser by drawing with destination-out globalCompositeOperation if we built raw canvas.
                            // For react-canvas-draw, we can just "Undo" for now or use white brush then filter? 
                            // Proper Fix: CanvasDraw has no eraser. Use Undo.
                            // BETTER: We can just support Undo for MVP. 
                            // OR: Pass `brushColor="#000000"` to paint black (which is 'no mask') IF we treat black as transparent.
                            // BUT: Our mask is white = edit. So painting black = erase mask.
                            // Yes: Painting black in the mask layer effectively removes the mask.
                            // So Eraser = Brush with black color.
                            />
                            {/* Eraser Logic Patch: If isEraser, set brushColor to transparent? No, that draws nothing.
                                We want to ERASE the purple strokes.
                                React-canvas-draw is additive.
                                We will stick to Undo for now or implement a 'Clear' button.
                                For user fidelity, let's change eraser button to 'Clear Mask' for MVP.
                             */}
                        </div>
                    </div>
                </div>

                {/* Bottom Bar: Prompt */}
                <div className="p-6 bg-[#1a1a1a] border-t border-gray-800 flex items-center justify-center space-x-4">
                    <div className="max-w-3xl w-full relative">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            placeholder="Describe what to change in the highlighted area..."
                            className="w-full bg-[#0d0d0d] border border-gray-700 rounded-lg py-4 pl-6 pr-32 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-inner text-lg"
                        />
                        <div className="absolute right-2 top-2 bottom-2">
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !prompt}
                                className="h-full px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-md shadow-lg transform transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Working...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={18} />
                                        <span>Generate</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => { onSave(currentImage); onClose(); }}
                        className="h-14 px-6 bg-brand-orange hover:bg-brand-red text-brand-cream font-bold rounded-lg shadow flex items-center space-x-2"
                    >
                        <Download size={20} />
                        <span>Save</span>
                    </button>
                </div>

                {error && (
                    <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-xl animate-bounce">
                        ⚠️ {error}
                    </div>
                )}
            </div>
        </div>
    );
};
