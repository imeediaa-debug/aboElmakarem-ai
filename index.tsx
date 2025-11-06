import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// Declare aistudio types for typescript
// Fix: Use a named interface 'AIStudio' to avoid type conflicts with other declarations.
// This resolves the error about subsequent property declarations needing the same type.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio: AIStudio;
    }
}

type Result = {
    type: 'image' | 'video';
    src: string;
};

const App = () => {
    // State management with local storage persistence
    const [generationMode, setGenerationMode] = useState<'static' | 'animated'>('static');
    const [apiKeySelected, setApiKeySelected] = useState(false);
    
    const [prompt, setPrompt] = useState(() => localStorage.getItem('aboelmakarem-ai-prompt') || '');
    const [negativePrompt, setNegativePrompt] = useState(() => localStorage.getItem('aboelmakarem-ai-negativePrompt') || '');
    const [lighting, setLighting] = useState(() => localStorage.getItem('aboelmakarem-ai-lighting') || 'Cinematic');
    const [colorStyle, setColorStyle] = useState(() => localStorage.getItem('aboelmakarem-ai-colorStyle') || 'Standard');
    const [artStyle, setArtStyle] = useState(() => localStorage.getItem('aboelmakarem-ai-artStyle') || 'Photorealistic');
    const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('aboelmakarem-ai-aspectRatio') || '1:1');
    const [highQuality, setHighQuality] = useState(() => {
        const saved = localStorage.getItem('aboelmakarem-ai-highQuality');
        return saved ? JSON.parse(saved) : false;
    });
    
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [productImage, setProductImage] = useState<string | null>(null);
    const [animatedInput, setAnimatedInput] = useState<string | null>(null);

    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);

    // Save settings to local storage whenever they change
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-prompt', prompt); }, [prompt]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-negativePrompt', negativePrompt); }, [negativePrompt]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-lighting', lighting); }, [lighting]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-colorStyle', colorStyle); }, [colorStyle]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-artStyle', artStyle); }, [artStyle]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-aspectRatio', aspectRatio); }, [aspectRatio]);
    useEffect(() => { localStorage.setItem('aboelmakarem-ai-highQuality', JSON.stringify(highQuality)); }, [highQuality]);

    // Check for API key when switching to animated mode
    useEffect(() => {
        if (generationMode === 'animated') {
            const checkApiKey = async () => {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setApiKeySelected(hasKey);
            };
            checkApiKey();
        }
    }, [generationMode]);


    // Options
    const lightingOptions = [
        { value: 'Cinematic', label: 'سينمائي' },
        { value: 'Studio Softbox', label: 'ستوديو (Softbox)' },
        { value: 'Natural Daylight', label: 'ضوء النهار الطبيعي' },
        { value: 'Golden Hour', label: 'الساعة الذهبية' },
        { value: 'Blue Hour', label: 'الساعة الزرقاء' },
        { value: 'High-key', label: 'إضاءة عالية (High-key)' },
        { value: 'Low-key', label: 'إضاءة منخفضة (Low-key)' },
        { value: 'Hard Shadow', label: 'ظلال حادة' },
        { value: 'Rim Lighting', label: 'إضاءة حافة' },
    ];
    const colorStyleOptions = [
        { value: 'Standard', label: 'عادي' },
        { value: 'Vibrant', label: 'ألوان زاهية' },
        { value: 'Muted Tones', label: 'ألوان هادئة' },
        { value: 'Warm Tones', label: 'درجات دافئة' },
        { value: 'Cool Tones', label: 'درجات باردة' },
        { value: 'Black and White', label: 'أبيض وأسود' },
        { value: 'Sepia', label: 'سيبيا' },
    ];
    const artStyleOptions = [
        { value: 'Photorealistic', label: 'واقعي جداً' },
        { value: 'Anime/Manga', label: 'أنمي/مانجا' },
        { value: 'Oil Painting', label: 'لوحة زيتية' },
        { value: 'Watercolor', label: 'ألوان مائية' },
        { value: 'Cyberpunk', label: 'سايبربانك' },
        { value: 'Fantasy Art', label: 'فن خيالي' },
        { value: 'Minimalist', label: 'تبسيطي' },
    ];
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

    const handleSelectApiKey = async () => {
        await window.aistudio.openSelectKey();
        setApiKeySelected(true); // Assume success to avoid race conditions. The API call will fail if it's not set.
    };
    
    // Core Generation Logic
    const handleGenerateStatic = async () => {
        if (!prompt.trim() && !backgroundImage && !productImage) {
            setError('الرجاء إدخال وصف أو رفع صورة واحدة على الأقل.');
            return;
        }
        setLoading(true);
        setError(null);
        setResults([]);

        const generateImage = async (parts: any[]) => {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: [{ parts: parts }],
                    config: { responseModalities: [Modality.IMAGE] },
                });
                
                if (response?.candidates?.length > 0 && response.candidates[0].content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        }
                    }
                }
            } catch (e) {
                console.error("Error during image generation:", e);
            }
            return null;
        };

        try {
            const loadingMessages = [
                "تحليل المدخلات...", "تحليل الوصف...", "تحضير النمط العام...",
                "إنشاء النتيجة الأولى...", "إنشاء النتيجة الثانية...", "اللمسات الأخيرة..."
            ];
            for (let i = 0; i < loadingMessages.length; i++) {
                setLoadingMessage(`الخطوة ${i + 1} من ${loadingMessages.length}: ${loadingMessages[i]}`);
                await new Promise(res => setTimeout(res, 300));
            }

            let basePrompt = `أنت مخرج فني محترف وخبير في التصوير الفوتوغرافي للمنتجات. مهمتك هي إنشاء صورة مذهلة بصريًا.`;
            if (highQuality) {
                basePrompt += ` استهدف جودة 4K فائقة الواقعية، مع تفاصيل دقيقة وإضاءة سينمائية وتصيير فوتوغرافي.`;
            }

            let constructedPrompt = `${basePrompt} الوصف: "${prompt.trim()}". النمط الفني: ${artStyle}. تعديل الألوان: ${colorStyle}. الإضاءة: ${lighting}. نسبة العرض إلى الارتفاع: ${aspectRatio}.`;
            if (negativePrompt.trim()) constructedPrompt += ` | تجنب تمامًا ما يلي: ${negativePrompt.trim()}.`;

            const parts: any[] = [];
            if (backgroundImage) parts.push({ inlineData: { mimeType: backgroundImage.split(';')[0].split(':')[1], data: backgroundImage.split(',')[1] } });
            if (productImage) parts.push({ inlineData: { mimeType: productImage.split(';')[0].split(':')[1], data: productImage.split(',')[1] } });
            
            if (backgroundImage && productImage) {
                 constructedPrompt = `أنت خبير دمج صور فوتوغرافي محترف عالمي متخصص في إعلانات المنتجات. مهمتك هي دمج منتج من صورة إلى خلفية من صورة أخرى بطريقة فائقة الواقعية. الصورة الأولى هي الخلفية. الصورة الثانية هي صورة المنتج. التعليمات الصارمة: 1. تحليل الخلفية لفهم الإضاءة والظلال. 2. استخلاص المنتج بدقة. 3. دمج المنتج ومطابقة الإضاءة والظلال بشكل مثالي. 4. إضافة انعكاسات واقعية. 5. ضمان تناسب الحجم والمنظور. الهدف: إنشاء صورة واحدة متماسكة وواقعية. وصف إضافي من المستخدم: ${prompt.trim()}. النمط الفني: ${artStyle}. نمط الألوان: ${colorStyle}. الإضاءة: ${lighting}. نسبة العرض إلى الارتفاع: ${aspectRatio}. تجنب: ${negativePrompt.trim()}`;
            }
            
            parts.unshift({ text: constructedPrompt });
            
            const imagePromises = await Promise.all([generateImage(parts), generateImage(parts)]);
            const successfulResults = imagePromises.filter(url => url !== null) as string[];

            if (successfulResults.length > 0) {
                setResults(successfulResults.map(src => ({ type: 'image', src })));
            } else {
                setError('لم يتمكن الذكاء الاصطناعي من إنشاء صورة. حاول مرة أخرى بوصف مختلف.');
            }
        } catch (e) {
            console.error(e);
            setError('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };

    const handleGenerateAnimation = async () => {
         if (!prompt.trim() && !animatedInput) {
            setError('الرجاء إدخال وصف أو رفع صورة للبدء.');
            return;
        }
        setLoading(true);
        setError(null);
        setResults([]);

        try {
            setLoadingMessage('التحقق من مفتاح API...');
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

            const payload: any = {
                model: 'veo-3.1-fast-generate-preview',
                prompt: `مهمتك هي إنشاء فيديو قصير مذهل بناءً على الوصف التالي: "${prompt.trim()}". النمط الفني المطلوب: ${artStyle}. نمط الألوان: ${colorStyle}. تجنب تمامًا: ${negativePrompt.trim()}`,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
                }
            };
            if (animatedInput) {
                payload.image = {
                    imageBytes: animatedInput.split(',')[1],
                    mimeType: animatedInput.split(';')[0].split(':')[1],
                };
            }
            
            setLoadingMessage('إرسال الطلب إلى نموذج الفيديو...');
            let operation = await ai.models.generateVideos(payload);
            setLoadingMessage('طلبك في قائمة الانتظار...');

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                setLoadingMessage('جاري إنشاء الإطارات... قد يستغرق هذا بضع دقائق.');
                operation = await ai.operations.getVideosOperation({ operation });
            }

            setLoadingMessage('جاري جلب الفيديو النهائي...');
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                 const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                 const videoBlob = await videoResponse.blob();
                 const videoUrl = URL.createObjectURL(videoBlob);
                 setResults([{ type: 'video', src: videoUrl }]);
            } else {
                throw new Error("لم يتم العثور على رابط تنزيل الفيديو.");
            }

        } catch (e: any) {
            console.error(e);
             if (e.message?.includes("Requested entity was not found")) {
                setError('فشل التحقق من مفتاح API. الرجاء اختياره مرة أخرى.');
                setApiKeySelected(false);
            } else {
                setError('حدث خطأ أثناء إنشاء الفيديو. يرجى المحاولة مرة أخرى.');
            }
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };
    
    const handleUpscale = async (imageUrl: string, index: number) => {
        setUpscalingIndex(index);
        setError(null);
        
        try {
            const upscalePrompt = "مهمتك كخبير تحسين صور: قم برفع جودة هذه الصورة إلى أقصى دقة ممكنة (Ultra HD)، مع زيادة الحدة والوضوح والتفاصيل دون إدخال أي عناصر جديدة أو تغيير المحتوى الأصلي.";
            const upscaleParts = [
                { text: upscalePrompt },
                { inlineData: { mimeType: imageUrl.split(';')[0].split(':')[1], data: imageUrl.split(',')[1] } }
            ];
            
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
                 setError(`فشل تحسين جودة الصورة رقم ${index + 1}.`);
            }
        } catch(e) {
            console.error(e);
            setError('حدث خطأ أثناء تحسين الجودة.');
        } finally {
             setUpscalingIndex(null);
        }
    }

    // Components
    const FileUploader = ({ id, label, image, setter, icon, accept = "image/*", isFullWidth = false }: { id: string, label: string, image: string | null, setter: React.Dispatch<React.SetStateAction<string | null>>, icon: React.ReactElement, accept?: string, isFullWidth?: boolean }) => (
        <div className="form-group">
            <div className="form-group-header">
                {icon}
                <label htmlFor={id}>{label}</label>
            </div>
            {image ? (
                <div className={`image-preview-container ${isFullWidth ? 'full-width' : ''}`}>
                    <img src={image} alt="preview" className="image-preview" />
                    <button className="clear-image-btn" onClick={() => setter(null)} disabled={loading}>&times;</button>
                </div>
            ) : (
                <>
                    <input type="file" id={id} className="file-upload-input" onChange={(e) => handleFileChange(e, setter)} accept={accept} disabled={loading} />
                    <label htmlFor={id} className="file-upload-label">اختر ملف</label>
                </>
            )}
        </div>
    );
    
    // Render Logic
    const isGenerateDisabled = loading || (generationMode === 'static' && !prompt.trim() && !backgroundImage && !productImage) || (generationMode === 'animated' && (!prompt.trim() && !animatedInput)) || (generationMode === 'animated' && !apiKeySelected);
    const currentAspectRatios = generationMode === 'static' ? staticAspectRatios : animatedAspectRatios;
    
    useEffect(() => {
        if (!currentAspectRatios.includes(aspectRatio)) {
            setAspectRatio(currentAspectRatios[0]);
        }
    }, [generationMode, aspectRatio, currentAspectRatios]);


    return (
        <div className="app-container">
            <header className="app-header">
                <h1 className="app-title">aboelmakarem ai</h1>
            </header>
            <main className="main-container">
                <aside className="controls-panel">
                    <div className="form-section-title">لوحة التحكم</div>

                    <div className="form-group">
                        <label>وضع الإنشاء</label>
                        <div className="mode-selector">
                           <button className={generationMode === 'static' ? 'active' : ''} onClick={() => setGenerationMode('static')} disabled={loading}>صورة ثابتة</button>
                           <button className={generationMode === 'animated' ? 'active' : ''} onClick={() => setGenerationMode('animated')} disabled={loading}>صورة متحركة (فيديو)</button>
                        </div>
                    </div>

                    {generationMode === 'animated' && !apiKeySelected && (
                        <div className="api-key-prompt">
                            <p>لإنشاء الفيديوهات، يجب اختيار مفتاح API خاص بك.</p>
                             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer">تعرف على الأسعار والفوترة</a>
                            <button onClick={handleSelectApiKey} disabled={loading}>اختيار مفتاح API</button>
                        </div>
                    )}

                    <div className="form-group">
                       <label htmlFor="prompt-input">1. أدخل وصف {generationMode === 'static' ? 'الصورة' : 'الفيديو'}</label>
                       <textarea id="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثال: كرسي ألعاب احترافي باللون الأسود والأحمر في غرفة مضاءة بالنيون" rows={4} disabled={loading} />
                    </div>
                    
                    {generationMode === 'static' ? (
                        <div className="form-group">
                           <label>2. ارفع الصور (اختياري)</label>
                           <div style={{display: 'flex', gap: '1rem'}}>
                             <FileUploader id="background-image" label="صورة الخلفية" image={backgroundImage} setter={setBackgroundImage} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg>} />
                             <FileUploader id="product-image" label="صورة المنتج" image={productImage} setter={setProductImage} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z"/></svg>} />
                           </div>
                        </div>
                    ) : (
                        <FileUploader id="animated-input" label="2. ارفع صورة للتحريك (اختياري)" image={animatedInput} setter={setAnimatedInput} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814z"/></svg>} accept="image/*" isFullWidth />
                    )}
                    
                    <details open>
                        <summary>الإعدادات المتقدمة</summary>
                        <div className="details-content">
                             <div className="form-group">
                                <label htmlFor="neg-prompt-input">وصف سلبي (Negative Prompt)</label>
                                <textarea id="neg-prompt-input" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="مثال: جودة منخفضة، تشويش، ألوان باهتة" rows={2} disabled={loading} />
                            </div>
                            
                            {generationMode === 'static' && (
                                <div className="form-group">
                                    <label htmlFor="lighting-select">تعديل الإضاءة الاحترافي</label>
                                    <select id="lighting-select" value={lighting} onChange={(e) => setLighting(e.target.value)} disabled={loading}>
                                        {lightingOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
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

                    <button className="generate-btn" onClick={generationMode === 'static' ? handleGenerateStatic : handleGenerateAnimation} disabled={isGenerateDisabled}>
                        {loading ? '...جاري الإنشاء' : (generationMode === 'static' ? 'إنشاء صورتين' : 'إنشاء فيديو')}
                    </button>
                </aside>
                <section className="display-panel">
                    {loading && (
                        <div className="loading-overlay">
                            <div className="spinner"></div>
                            <p>{loadingMessage}</p>
                        </div>
                    )}

                    {!loading && error && <div className="error-message">{error}</div>}
                    
                    {!loading && results.length > 0 && (
                        <div className={`results-grid ${results.length === 1 ? 'single-item' : ''}`}>
                            {results.map((result, index) => (
                                <div className="result-card" key={index}>
                                    {upscalingIndex === index && (
                                        <div className="loading-overlay">
                                            <div className="spinner upscale-spinner"></div>
                                            <p>جاري تحسين الجودة...</p>
                                        </div>
                                    )}
                                    {result.type === 'image' ? (
                                        <img src={result.src} alt={`Generated result ${index + 1}`} className="generated-image" />
                                    ) : (
                                        <video src={result.src} autoPlay loop muted playsInline className="generated-video" />
                                    )}
                                    <div className="result-card-actions">
                                        {result.type === 'image' && (
                                          <button onClick={() => handleUpscale(result.src, index)} className="action-btn" title="تحسين الجودة" disabled={upscalingIndex !== null}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41M12 11.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1h-3a.5.5 0 0 0-.5.5m-1.034 2.354-2.646-3.382a.25.25 0 0 1 0-.332l2.646-3.382a.25.25 0 0 1 .41 0l2.646 3.382a.25.25 0 0 1 0 .332l-2.646 3.382a.25.25 0 0 1-.41 0M4.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-.5.5m-2 4a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m0 5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-.5-.5m2-4a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5"/></svg>
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