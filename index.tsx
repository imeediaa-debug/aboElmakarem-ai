import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// FIX: Changed inline object to a named interface `AIStudio` to avoid conflicts with other global declarations.
interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
}

declare global {
    interface Window {
        aistudio: AIStudio;
    }
}

type Result = {
    type: 'image' | 'video';
    src: string;
};

type Point = {
    x: number;
    y: number;
};

const App = () => {
    // API Key Management
    // FIX: Removed manual API key management state (apiKey, isModalOpen, tempApiKey) to comply with guidelines.
    // The API key will be sourced from process.env.API_KEY.

    // State management
    const [generationMode, setGenerationMode] = useState<'static' | 'animated' | 'modification'>('static');
    
    // Settings with local storage persistence
    const [prompt, setPrompt] = useState(() => localStorage.getItem('aboelmakarem-ai-prompt') || '');
    const [negativePrompt, setNegativePrompt] = useState(() => localStorage.getItem('aboelmakarem-ai-negativePrompt') || '');
    const [lighting, setLighting] = useState(() => localStorage.getItem('aboelmakarem-ai-lighting') || 'Cinematic');
    const [colorStyle, setColorStyle] = useState(() => localStorage.getItem('aboelmakarem-ai-colorStyle') || 'Standard');
    const [artStyle, setArtStyle] = useState(() => localStorage.getItem('aboelmakarem-ai-artStyle') || 'Photorealistic');
    const [photographyStyle, setPhotographyStyle] = useState(() => localStorage.getItem('aboelmakarem-ai-photographyStyle') || 'General');
    const [cameraAngle, setCameraAngle] = useState(() => localStorage.getItem('aboelmakarem-ai-cameraAngle') || 'Eye-level');
    const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('aboelmakarem-ai-aspectRatio') || '1:1');
    const [highQuality, setHighQuality] = useState(() => {
        const saved = localStorage.getItem('aboelmakarem-ai-highQuality');
        return saved ? JSON.parse(saved) : false;
    });
    
    // Input images
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [productImage, setProductImage] = useState<string | null>(null);
    const [animatedInput, setAnimatedInput] = useState<string | null>(null);
    const [modificationImage, setModificationImage] = useState<string | null>(null);

    // App status
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);
    
    // Veo (Video) API Key state
    const [veoApiKeySelected, setVeoApiKeySelected] = useState(false);
    const [checkingVeoKey, setCheckingVeoKey] = useState(false);

    // Canvas/Masking state
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(30);
    const lastPointRef = useRef<Point | null>(null);

    // FIX: Removed useEffect for checking manual API key as it's no longer used.

    // Check for Veo API key when switching to animated mode
    useEffect(() => {
        const checkVeoKey = async () => {
            if (generationMode === 'animated') {
                setCheckingVeoKey(true);
                try {
                    const hasKey = await window.aistudio.hasSelectedApiKey();
                    setVeoApiKeySelected(hasKey);
                } catch (e) {
                    console.error("Error checking for Veo API key:", e);
                    setVeoApiKeySelected(false);
                } finally {
                    setCheckingVeoKey(false);
                }
            }
        };
        checkVeoKey();
    }, [generationMode]);
    
    // FIX: Removed handleSaveApiKey as manual API key management is removed.

    const handleSelectVeoApiKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            // Assume success after dialog closes to handle race conditions
            setVeoApiKeySelected(true);
            setError(null);
        } catch (e) {
            console.error("Error opening Veo API key selection:", e);
            setError("فشل فتح نافذة اختيار مفتاح API. يرجى المحاولة مرة أخرى.");
        }
    };

    // Save settings to local storage whenever they change
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-prompt', prompt); }, [prompt]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-negativePrompt', negativePrompt); }, [negativePrompt]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-lighting', lighting); }, [lighting]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-colorStyle', colorStyle); }, [colorStyle]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-artStyle', artStyle); }, [artStyle]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-photographyStyle', photographyStyle); }, [photographyStyle]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-cameraAngle', cameraAngle); }, [cameraAngle]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-aspectRatio', aspectRatio); }, [aspectRatio]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-highQuality', JSON.stringify(highQuality)); }, [highQuality]);

    // Options
    const lightingOptions = [ { value: 'Cinematic', label: 'سينمائي' }, { value: 'Studio Softbox', label: 'ستوديو (Softbox)' }, { value: 'Natural Daylight', label: 'ضوء النهار الطبيعي' }, { value: 'Golden Hour', label: 'الساعة الذهبية' }, { value: 'Blue Hour', label: 'الساعة الزرقاء' }, { value: 'High-key', label: 'إضاءة عالية (High-key)' }, { value: 'Low-key', label: 'إضاءة منخفضة (Low-key)' }, { value: 'Hard Shadow', label: 'ظلال حادة' }, { value: 'Rim Lighting', label: 'إضاءة حافة' }];
    const colorStyleOptions = [ { value: 'Standard', label: 'عادي' }, { value: 'Vibrant', label: 'ألوان زاهية' }, { value: 'Muted Tones', label: 'ألوان هادئة' }, { value: 'Warm Tones', label: 'درجات دافئة' }, { value: 'Cool Tones', label: 'درجات باردة' }, { value: 'Black and White', label: 'أبيض وأسود' }, { value: 'Sepia', label: 'سيبيا' }];
    const artStyleOptions = [ { value: 'Photorealistic', label: 'واقعي جداً' }, { value: 'Anime/Manga', label: 'أنمي/مانجا' }, { value: 'Oil Painting', label: 'لوحة زيتية' }, { value: 'Watercolor', label: 'ألوان مائية' }, { value: 'Cyberpunk', label: 'سايبربانك' }, { value: 'Fantasy Art', label: 'فن خيالي' }, { value: 'Minimalist', label: 'تبسيطي' }];
    const photographyStyleOptions = [ { value: 'General', label: 'عام' }, { value: 'Portrait', label: 'بورتريه' }, { value: 'Landscape', label: 'منظر طبيعي' }, { value: 'Macro', label: 'تصوير مقرب (ماكرو)' }, { value: 'Street Photography', label: 'تصوير الشارع' }, { value: 'Architectural', label: 'تصوير معماري' }];
    const cameraAngleOptions = [ { value: 'Eye-level', label: 'مستوى العين' }, { value: 'High-angle', label: 'زاوية مرتفعة' }, { value: 'Low-angle', label: 'زاوية منخفضة' }, { value: 'Dutch angle', label: 'زاوية مائلة' }, { value: 'Birds-eye view', label: 'منظور عين الطائر' }];
    const staticAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    const animatedAspectRatios = ['16:9', '9:16', '1:1'];

    // Helper Functions
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setter(reader.result as string);
            reader.onerror = () => setError('فشل في قراءة الملف.');
            reader.readAsDataURL(file);
        }
    };

    const getApiErrorMessage = (error: any): string => {
        let message = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
        if (error && typeof error.message === 'string') {
            const lowerCaseError = error.message.toLowerCase();
            if (lowerCaseError.includes('api key not valid')) {
                // FIX: Updated error message as user cannot change the API key anymore.
                return 'مفتاح API المستخدم غير صالح أو منتهي الصلاحية. يرجى التأكد من تكوين المفتاح بشكل صحيح.';
            }
            if (lowerCaseError.includes('permission denied')) {
                return 'ليس لدى مفتاح API الإذن اللازم. تأكد من تفعيل Gemini API في مشروع Google Cloud الخاص بك.';
            }
             if (lowerCaseError.includes('requested entity was not found')) {
                setVeoApiKeySelected(false);
                return 'فشل المصادقة لإنشاء الفيديو. يرجى إعادة تحديد مفتاح API الخاص بك لخدمة الفيديو والمحاولة مرة أخرى.';
            }
            if (lowerCaseError.includes('quota')) {
                return 'تم تجاوز حصة الاستخدام لمفتاح API. يرجى التحقق من خطة الفوترة الخاصة بك.';
            }
            if (lowerCaseError.includes('model not found')) {
                return 'النموذج المطلوب غير متوفر حاليًا. قد يكون السبب مشكلة في الخدمة أو أن مفتاحك لا يدعم هذا النموذج.';
            }
            message = error.message;
        }
        return `فشل الطلب: ${message}`;
    };
    
    const preGenerationCheck = () => {
        // FIX: Removed manual API key check.
        if (generationMode === 'animated' && !veoApiKeySelected) {
            setError('الرجاء تحديد مفتاح API لخدمة الفيديو أولاً.');
            return false;
        }
        setError(null);
        setResults([]);
        setLoading(true);
        return true;
    }
    
    // Core Generation Logic
    const handleGenerateStatic = async () => {
        if (!prompt.trim() && !backgroundImage && !productImage) {
            setError('الرجاء إدخال وصف أو رفع صورة واحدة على الأقل.');
            return;
        }
        if (!preGenerationCheck()) return;

        const generateImage = async (parts: any[]) => {
            try {
                // FIX: Use process.env.API_KEY and remove manual key check.
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: [{ parts: parts }],
                    config: { responseModalities: [Modality.IMAGE] },
                });
                
                const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (imagePart?.inlineData) {
                    return { success: true, src: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` };
                }
                return { success: false, error: "لم يتم العثور على بيانات صورة في استجابة الـ API." };
            } catch (e) {
                console.error("Error during image generation:", e);
                return { success: false, error: getApiErrorMessage(e) };
            }
        };

        try {
            const loadingMessages = [ "تحليل المدخلات...", "تحليل الوصف...", "تحضير النمط العام...", "إنشاء النتيجة الأولى...", "إنشاء النتيجة الثانية...", "اللمسات الأخيرة..."];
            for (let i = 0; i < loadingMessages.length; i++) {
                setLoadingMessage(`الخطوة ${i + 1} من ${loadingMessages.length}: ${loadingMessages[i]}`);
                await new Promise(res => setTimeout(res, 300));
            }

            let basePrompt = `أنت مخرج فني محترف وخبير في التصوير الفوتوغرافي. مهمتك هي إنشاء صورة مذهلة بصريًا.`;
            if (highQuality) {
                basePrompt += ` استهدف جودة 4K فائقة الواقعية، مع تفاصيل دقيقة وإضاءة سينمائية وتصيير فوتوغرافي.`;
            }

            let constructedPrompt = `${basePrompt} الوصف: "${prompt.trim()}". النمط الفني: ${artStyle}. نمط التصوير: ${photographyStyle}. زاوية الكاميرا: ${cameraAngle}. تعديل الألوان: ${colorStyle}. الإضاءة: ${lighting}. نسبة العرض إلى الارتفاع: ${aspectRatio}.`;
            if (negativePrompt.trim()) constructedPrompt += ` | تجنب تمامًا ما يلي: ${negativePrompt.trim()}.`;

            const parts: any[] = [];
            if (backgroundImage) parts.push({ inlineData: { mimeType: backgroundImage.split(';')[0].split(':')[1], data: backgroundImage.split(',')[1] } });
            if (productImage) parts.push({ inlineData: { mimeType: productImage.split(';')[0].split(':')[1], data: productImage.split(',')[1] } });
            
            if (backgroundImage && productImage) {
                 constructedPrompt = `أنت خبير دمج صور فوتوغرافي محترف عالمي متخصص في إعلانات المنتجات. مهمتك هي دمج منتج من صورة إلى خلفية من صورة أخرى بطريقة فائقة الواقعية. الصورة الأولى هي الخلفية. الصورة الثانية هي صورة المنتج. التعليمات الصارمة: 1. تحليل الخلفية لفهم الإضاءة والظلال. 2. استخلاص المنتج بدقة. 3. دمج المنتج ومطابقة الإضاءة والظلال بشكل مثالي. 4. إضافة انعكاسات واقعية. 5. ضمان تناسب الحجم والمنظور. الهدف: إنشاء صورة واحدة متماسكة وواقعية. وصف إضافي من المستخدم: ${prompt.trim()}. النمط الفني: ${artStyle}. نمط الألوان: ${colorStyle}. الإضاءة: ${lighting}. نسبة العرض إلى الارتفاع: ${aspectRatio}. تجنب: ${negativePrompt.trim()}`;
            }
            
            parts.unshift({ text: constructedPrompt });
            
            const imageResults = await Promise.all([generateImage(parts), generateImage(parts)]);
            const successfulResults = imageResults.filter(res => res.success).map(res => res.src as string);
            const errors = imageResults.filter(res => !res.success).map(res => res.error as string);

            if (successfulResults.length > 0) {
                setResults(successfulResults.map(src => ({ type: 'image', src })));
            } else {
                setError(errors[0] || 'لم يتمكن الذكاء الاصطناعي من إنشاء صورة. حاول مرة أخرى بوصف مختلف.');
            }
        } catch (e) {
            console.error(e);
            setError(getApiErrorMessage(e));
        } finally {
            setLoading(false); setLoadingMessage('');
        }
    };

    const handleGenerateAnimation = async () => {
         if (!prompt.trim() && !animatedInput) {
            setError('الرجاء إدخال وصف أو رفع صورة للبدء.');
            return;
        }
        if (!preGenerationCheck()) return;

        try {
            setLoadingMessage('إعداد نموذج الفيديو...');
             // We don't need to pass the key here, it's picked up from the environment
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});

            const payload: any = {
                model: 'veo-3.1-fast-generate-preview',
                prompt: `مهمتك هي إنشاء فيديو قصير مذهل بناءً على الوصف التالي: "${prompt.trim()}". النمط الفني المطلوب: ${artStyle}. نمط الألوان: ${colorStyle}. تجنب تمامًا: ${negativePrompt.trim()}`,
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1' }
            };
            if (animatedInput) {
                payload.image = { imageBytes: animatedInput.split(',')[1], mimeType: animatedInput.split(';')[0].split(':')[1] };
            }
            
            setLoadingMessage('إرسال الطلب إلى نموذج الفيديو...');
            let operation = await ai.models.generateVideos(payload);
            setLoadingMessage('طلبك الآن في قائمة الانتظار، كن صبورًا.');

            let pollCount = 0;
            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                pollCount++;
                if (pollCount <= 3) {
                    setLoadingMessage(`جاري معالجة طلبك... (التحقق رقم ${pollCount})`);
                } else {
                    setLoadingMessage('فنان الذكاء الاصطناعي يرسم تحفتك... قد يستغرق هذا بضع دقائق.');
                }
                operation = await ai.operations.getVideosOperation({ operation });
            }

            setLoadingMessage('اكتمل العرض! جاري جلب الفيديو النهائي...');
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                 const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                 if (!videoResponse.ok) throw new Error(`فشل تحميل الفيديو: ${videoResponse.statusText}`);
                 const videoBlob = await videoResponse.blob();
                 const videoUrl = URL.createObjectURL(videoBlob);
                 setResults([{ type: 'video', src: videoUrl }]);
            } else {
                throw new Error("لم يتم العثور على رابط تنزيل الفيديو في استجابة الـ API.");
            }

        } catch (e: any) {
            console.error(e);
            setError(getApiErrorMessage(e));
        } finally {
            setLoading(false); setLoadingMessage('');
        }
    };

    const handleGenerateModification = async () => {
        if (!prompt.trim() || !modificationImage) {
            setError('الرجاء رفع صورة وإدخال وصف للتعديل.');
            return;
        }
        if (!preGenerationCheck()) return;

        try {
            setLoadingMessage('تحضير قناع التعديل...');
            const maskCanvas = maskCanvasRef.current;
            if (!maskCanvas) throw new Error("Mask canvas not found.");

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = maskCanvas.width;
            tempCanvas.height = maskCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error("Could not get context for temp canvas.");

            tempCtx.fillStyle = 'black';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.globalCompositeOperation = 'source-over';
            tempCtx.drawImage(maskCanvas, 0, 0);

            const maskDataUrl = tempCanvas.toDataURL('image/png');
            
            const modificationPrompt = `أنت خبير تعديل صور احترافي. مهمتك هي تعديل الصورة الأصلية بناءً على القناع والوصف. المناطق البيضاء في صورة القناع هي فقط ما يجب تعديله. حافظ على المناطق السوداء كما هي تمامًا. الوصف: "${prompt.trim()}". النمط الفني: ${artStyle}.`;

            const parts = [
                { text: modificationPrompt },
                { inlineData: { mimeType: modificationImage.split(';')[0].split(':')[1], data: modificationImage.split(',')[1] } },
                { inlineData: { mimeType: 'image/png', data: maskDataUrl.split(',')[1] } }
            ];

            setLoadingMessage('جاري تنفيذ التعديل...');
            // FIX: Use process.env.API_KEY.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: [{ parts }],
                config: { responseModalities: [Modality.IMAGE] },
            });

            const modifiedImagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (modifiedImagePart?.inlineData) {
                // FIX: Used the correct variable `modifiedImagePart` instead of `modificationImage` to construct the image URL.
                const imageUrl = `data:${modifiedImagePart.inlineData.mimeType};base64,${modifiedImagePart.inlineData.data}`;
                setResults([{ type: 'image', src: imageUrl }]);
            } else {
                throw new Error('لم يتم العثور على صورة معدلة في استجابة الـ API.');
            }

        } catch(e) {
            console.error(e);
            setError(getApiErrorMessage(e));
        } finally {
            setLoading(false); setLoadingMessage('');
        }
    };
    
    const handleUpscale = async (imageUrl: string, index: number) => {
        // FIX: Removed manual API key check.
        setLoading(true); // Use main loading state for simplicity
        setUpscalingIndex(index);
        setError(null);
        
        try {
            const upscalePrompt = "مهمتك كخبير تحسين صور: قم برفع جودة هذه الصورة إلى أقصى دقة ممكنة (Ultra HD)، مع زيادة الحدة والوضوح والتفاصيل دون إدخال أي عناصر جديدة أو تغيير المحتوى الأصلي.";
            const upscaleParts = [ { text: upscalePrompt }, { inlineData: { mimeType: imageUrl.split(';')[0].split(':')[1], data: imageUrl.split(',')[1] } } ];
            
            // FIX: Use process.env.API_KEY.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: [{ parts: upscaleParts }],
                config: { responseModalities: [Modality.IMAGE] },
            });
            const upscaledImagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            
            if (upscaledImagePart?.inlineData) {
                 const upscaledImageUrl = `data:${upscaledImagePart.inlineData.mimeType};base64,${upscaledImagePart.inlineData.data}`;
                 setResults(prevResults => {
                    const newResults = [...prevResults];
                    newResults[index] = { type: 'image', src: upscaledImageUrl };
                    return newResults;
                });
            } else {
                 throw new Error(`فشل تحسين جودة الصورة رقم ${index + 1}.`);
            }
        } catch(e) {
            console.error(e);
            setError(getApiErrorMessage(e));
        } finally {
             setUpscalingIndex(null);
             setLoading(false);
        }
    }

    // Canvas drawing logic
    useEffect(() => {
        const imageCanvas = imageCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!imageCanvas || !maskCanvas || !modificationImage) return;

        const image = new Image();
        image.src = modificationImage;
        image.onload = () => {
            const ctx = imageCanvas.getContext('2d');
            const maskCtx = maskCanvas.getContext('2d');
            if (!ctx || !maskCtx) return;
            
            const container = imageCanvas.parentElement;
            if (container) {
                imageCanvas.width = image.width;
                imageCanvas.height = image.height;
                maskCanvas.width = image.width;
                maskCanvas.height = image.height;
            } else {
                imageCanvas.width = image.width;
                imageCanvas.height = image.height;
                maskCanvas.width = image.width;
                maskCanvas.height = image.height;
            }
            
            ctx.drawImage(image, 0, 0, image.width, image.height);
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        };
    }, [modificationImage]);

    const getPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = maskCanvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const drawLine = (start: Point, end: Point) => {
        const ctx = maskCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = `rgba(255, 255, 255, 0.7)`;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const point = getPoint(e);
        lastPointRef.current = point;
        drawLine(point, point); // Draw a dot
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const currentPoint = getPoint(e);
        if (lastPointRef.current) {
            drawLine(lastPointRef.current, currentPoint);
        }
        lastPointRef.current = currentPoint;
    };
    
    const handleMouseUp = () => { setIsDrawing(false); lastPointRef.current = null; };
    const handleClearMask = () => {
        const ctx = maskCanvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    };


    // Components
    const FileUploader = ({ id, label, image, setter, icon, accept = "image/*", isFullWidth = false }: { id: string, label: string, image: string | null, setter: React.Dispatch<React.SetStateAction<string | null>>, icon: React.ReactElement, accept?: string, isFullWidth?: boolean }) => (
        <div className="form-group">
            <div className="form-group-header"> {icon} <label htmlFor={id}>{label}</label> </div>
            {image ? (
                <div className={`image-preview-container ${isFullWidth ? 'full-width' : ''}`}>
                    <img src={image} alt="preview" className="image-preview" />
                    <button className="clear-image-btn" onClick={() => setter(null)} disabled={loading}>&times;</button>
                </div>
            ) : ( <> <input type="file" id={id} className="file-upload-input" onChange={(e) => handleFileChange(e, setter)} accept={accept} disabled={loading} /> <label htmlFor={id} className="file-upload-label">اختر ملف</label> </> )}
        </div>
    );
    
    const VeoKeySetup = () => (
        <div className="veo-setup-container">
            <h3>مطلوب إعداد إضافي لإنشاء الفيديو</h3>
            <p>
                يستخدم إنشاء الفيديو نموذج Veo المتقدم من Google. لأسباب تتعلق بالفوترة والأمان، يجب عليك الموافقة على استخدام مفتاح API الخاص بك لهذه الميزة عبر نافذة Google الرسمية.
                <br />
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer">تعرف على المزيد حول فوترة Gemini API</a>.
            </p>
            <button className="veo-select-key-btn" onClick={handleSelectVeoApiKey}>
                تحديد مفتاح API لخدمة الفيديو
            </button>
        </div>
    );

    // Render Logic
    // FIX: Removed apiKey checks from disabled logic.
    const isGenerateDisabled = loading || 
        (generationMode === 'static' && (!prompt.trim() && !backgroundImage && !productImage)) || 
        (generationMode === 'animated' && (!veoApiKeySelected || (!prompt.trim() && !animatedInput))) ||
        (generationMode === 'modification' && (!prompt.trim() || !modificationImage));

    const currentAspectRatios = generationMode === 'static' ? staticAspectRatios : animatedAspectRatios;
    
    useEffect(() => {
        if (generationMode !== 'static' && !currentAspectRatios.includes(aspectRatio)) {
            setAspectRatio(currentAspectRatios[0]);
        }
    }, [generationMode, aspectRatio, currentAspectRatios]);

    return (
        <div className="app-container">
            {/* FIX: Removed API key modal. */}
            <header className="app-header"><h1 className="app-title">aboelmakarem ai</h1></header>
            <main className="main-container">
                <aside className="controls-panel">
                    <div className="form-section-title">لوحة التحكم</div>
                     {/* FIX: Removed "Change API Key" button. */}
                    
                    <div className="form-group">
                        <label>وضع الإنشاء</label>
                        <div className="mode-selector">
                           <button className={generationMode === 'static' ? 'active' : ''} onClick={() => setGenerationMode('static')} disabled={loading}>صورة ثابتة</button>
                           <button className={generationMode === 'animated' ? 'active' : ''} onClick={() => setGenerationMode('animated')} disabled={loading}>فيديو</button>
                           <button className={generationMode === 'modification' ? 'active' : ''} onClick={() => setGenerationMode('modification')} disabled={loading}>تعديل صورة</button>
                        </div>
                    </div>
                    
                    { generationMode === 'animated' && !checkingVeoKey && !veoApiKeySelected && <VeoKeySetup /> }
                    { checkingVeoKey && generationMode === 'animated' && <div className="veo-setup-container"><div className="spinner"></div><p>جاري التحقق من حالة المفتاح...</p></div> }
                    
                    { (generationMode !== 'animated' || veoApiKeySelected) && (
                        <>
                            <div className="form-group">
                               <label htmlFor="prompt-input">1. أدخل وصف {generationMode === 'modification' ? 'التعديل' : (generationMode === 'static' ? 'الصورة' : 'الفيديو')}</label>
                               <textarea id="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثال: كرسي ألعاب احترافي باللون الأسود والأحمر في غرفة مضاءة بالنيون" rows={4} disabled={loading} />
                            </div>
                            
                            {generationMode === 'static' && (
                                <div className="form-group">
                                   <label>2. ارفع الصور (اختياري)</label>
                                   <div style={{display: 'flex', gap: '1rem'}}>
                                     <FileUploader id="background-image" label="الخلفية" image={backgroundImage} setter={setBackgroundImage} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg>} />
                                     <FileUploader id="product-image" label="المنتج" image={productImage} setter={setProductImage} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z"/></svg>} />
                                   </div>
                                </div>
                            )}
                            {generationMode === 'animated' && <FileUploader id="animated-input" label="2. ارفع صورة للتحريك (اختياري)" image={animatedInput} setter={setAnimatedInput} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814z"/></svg>} accept="image/*" isFullWidth />}
                            {generationMode === 'modification' && (
                                <div className="form-group">
                                    <FileUploader id="modification-image" label="2. ارفع صورة للتعديل" image={modificationImage} setter={setModificationImage} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/></svg>} accept="image/*" isFullWidth />
                                    {modificationImage && (
                                        <div className="canvas-editor-container">
                                            <label>3. حدد المنطقة المراد تعديلها</label>
                                            <div className="canvas-wrapper">
                                                <canvas ref={imageCanvasRef} id="image-canvas" />
                                                <canvas ref={maskCanvasRef} id="mask-canvas" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}/>
                                            </div>
                                            <div className="brush-controls">
                                                <label><span>حجم الفرشاة</span> <span>{brushSize}px</span></label>
                                                <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} disabled={loading} />
                                                <div className="actions">
                                                    <button onClick={handleClearMask} disabled={loading}>مسح التحديد</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <details open>
                                <summary>الإعدادات المتقدمة</summary>
                                <div className="details-content">
                                     <div className="form-group">
                                        <label htmlFor="neg-prompt-input">وصف سلبي (Negative Prompt)</label>
                                        <textarea id="neg-prompt-input" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="مثال: جودة منخفضة، تشويش، ألوان باهتة" rows={2} disabled={loading} />
                                    </div>
                                    
                                    {generationMode === 'static' && (
                                        <>
                                        <div className="form-group">
                                            <label htmlFor="lighting-select">تعديل الإضاءة الاحترافي</label>
                                            <select id="lighting-select" value={lighting} onChange={(e) => setLighting(e.target.value)} disabled={loading}>
                                                {lightingOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="photo-style-select">نمط التصوير</label>
                                            <select id="photo-style-select" value={photographyStyle} onChange={(e) => setPhotographyStyle(e.target.value)} disabled={loading}>
                                                {photographyStyleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="camera-angle-select">زاوية الكاميرا</label>
                                            <select id="camera-angle-select" value={cameraAngle} onChange={(e) => setCameraAngle(e.target.value)} disabled={loading}>
                                                {cameraAngleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                        </>
                                    )}
                                    
                                    <div className="form-group">
                                        <label htmlFor="color-style-select">تعديل الألوان</label>
                                        <select id="color-style-select" value={colorStyle} onChange={(e) => setColorStyle(e.target.value)} disabled={loading}>
                                            {colorStyleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
        
                                    <div className="form-group">
                                        <label htmlFor="art-style-select">النمط الفني</label>
                                        <select id="art-style-select" value={artStyle} onChange={(e) => setArtStyle(e.target.value)} disabled={loading}>
                                            {artStyleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                    
                                    {generationMode !== 'modification' && (
                                        <div className="form-group">
                                            <label>تحديد الحجم (Aspect Ratio)</label>
                                            <div className="aspect-ratio-group">
                                                {currentAspectRatios.map(ratio => (
                                                    <button key={ratio} className={`aspect-ratio-btn ${aspectRatio === ratio ? 'active' : ''}`} onClick={() => setAspectRatio(ratio)} disabled={loading}>
                                                        {ratio}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {generationMode === 'static' && (
                                        <div className="toggle-switch">
                                            <label htmlFor="quality-toggle">جودة فائقة 4K (أبطأ)</label>
                                            <label className="switch">
                                                <input type="checkbox" id="quality-toggle" checked={highQuality} onChange={(e) => setHighQuality(e.target.checked)} disabled={loading} />
                                                <span className="slider"></span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </details>
                        </>
                    )}
                    
                    <button className="generate-btn" onClick={generationMode === 'static' ? handleGenerateStatic : generationMode === 'animated' ? handleGenerateAnimation : handleGenerateModification} disabled={isGenerateDisabled}>
                        {loading ? '...جاري الإنشاء' : generationMode === 'static' ? 'إنشاء صورتين' : generationMode === 'animated' ? 'إنشاء فيديو' : 'نفّذ التعديل'}
                    </button>
                </aside>
                <section className="display-panel">
                    {loading && ( <div className="loading-overlay"> <div className="spinner"></div> <p>{loadingMessage}</p> </div> )}
                    {!loading && error && <div className="error-message">{error}</div>}
                    
                    {!loading && results.length > 0 && (
                        <div className={`results-grid ${results.length === 1 ? 'single-item' : ''}`}>
                            {results.map((result, index) => (
                                <div className="result-card" key={index}>
                                    {upscalingIndex === index && ( <div className="loading-overlay"> <div className="spinner upscale-spinner"></div> <p>جاري تحسين الجودة...</p> </div> )}
                                    {result.type === 'image' ? ( <img src={result.src} alt={`Generated result ${index + 1}`} className="generated-image" /> ) : ( <video src={result.src} autoPlay loop muted playsInline className="generated-video" /> )}
                                    <div className="result-card-actions">
                                        {result.type === 'image' && (
                                          <button onClick={() => handleUpscale(result.src, index)} className="action-btn" title="تحسين الجودة" disabled={upscalingIndex !== null || loading}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41M12 11.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1h-3a.5.5 0 0 0-.5.5m-1.034 2.354-2.646-3.382a.25.25 0 0 1 0-.332l2.646-3.382a.25.25 0 0 1 .41 0l2.646 3.382a.25.25 0 0 1 0 .332l-2.646 3.382a.25.25 0 0 1-.41 0M4.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-.5.5m-2 4a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m0 5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-.5.5m2-4a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5"/></svg>
                                          </button>
                                        )}
                                        <a href={result.src} download={`aboelmakarem-ai-${result.type}-${index + 1}-${Date.now()}.${result.type === 'image' ? 'png' : 'mp4'}`} className="action-btn" title="تنزيل">
                                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/></svg>
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && !error && results.length === 0 && (
                         <div className="placeholder">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                             </svg>
                            <h2>ستظهر إبداعاتك هنا</h2>
                            <p>املأ الحقول في لوحة التحكم لبدء عملية الإبداع.</p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
