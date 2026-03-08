import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Image as ImageIcon, Download, Sparkles, Wand2, HardDrive, CheckCircle2, Edit2, Upload, X } from 'lucide-react';
import ImageEditor from './components/ImageEditor';

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ASPECT_RATIOS = [
  { label: 'Square (1:1)', value: '1:1' },
  { label: 'Portrait (3:4)', value: '3:4' },
  { label: 'Wide (4:3)', value: '4:3' },
  { label: 'Tall (9:16)', value: '9:16' },
  { label: 'Cinematic (16:9)', value: '16:9' },
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [referenceImage, setReferenceImage] = useState<{data: string, mimeType: string, url: string} | null>(null);
  
  // Google Drive state
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check if connected to Google Drive
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => setIsDriveConnected(data.connected))
      .catch(console.error);

    // Listen for OAuth success message from popup
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsDriveConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const matches = base64String.match(/^data:(.+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        setReferenceImage({
          mimeType: matches[1],
          data: matches[2],
          url: base64String
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConnectDrive = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await fetch(`/api/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get auth URL');
      }
      
      const { url } = await response.json();

      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups for this site to connect your account.');
      }
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError(err.message || 'Failed to connect to Google Drive.');
    }
  };

  const handleSaveToDrive = async () => {
    if (!generatedImage) return;
    setIsUploadingToDrive(true);
    setDriveUrl(null);
    setError(null);

    try {
      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: generatedImage,
          filename: `AI-Generated-${Date.now()}.png`
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload');
      
      setDriveUrl(data.url);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to save to Google Drive.');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setDriveUrl(null);
    
    try {
      const finalPrompt = negativePrompt.trim() 
        ? `${prompt}\n\nNegative prompt (do not include): ${negativePrompt}`
        : prompt;

      const parts: any[] = [];
      if (referenceImage) {
        parts.push({
          inlineData: {
            data: referenceImage.data,
            mimeType: referenceImage.mimeType,
          }
        });
      }
      parts.push({ text: finalPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: parts,
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
          },
        },
      });
      
      let imageUrl = null;
      const responseParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of responseParts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
          break;
        }
      }
      
      if (imageUrl) {
        setGeneratedImage(imageUrl);
      } else {
        setError("No image was generated. Please try a different prompt.");
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "An error occurred while generating the image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-inner mb-4">
            <Sparkles className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-zinc-100">
            AI Image Generator
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-zinc-400">
            Describe what you want to see, and Gemini will create it for you in seconds.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Controls Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
              <div className="space-y-6">
                
                {/* Prompt Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="prompt" className="block text-sm font-medium text-zinc-300">
                      Prompt
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + 'cinematic, highly detailed, 8k')}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        Cinematic
                      </button>
                      <button
                        onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + 'romantic, sensual, soft lighting, ethereal, intimate atmosphere')}
                        className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        Sensual & Soft
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="prompt"
                    rows={4}
                    className="block w-full rounded-2xl border-0 bg-zinc-950 py-3 px-4 text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm sm:leading-6 resize-none transition-shadow"
                    placeholder="A futuristic city with flying cars at sunset, cyberpunk style..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>

                {/* Negative Prompt Input */}
                <div className="space-y-3">
                  <label htmlFor="negativePrompt" className="block text-sm font-medium text-zinc-300">
                    Negative Prompt (Optional)
                  </label>
                  <textarea
                    id="negativePrompt"
                    rows={2}
                    className="block w-full rounded-2xl border-0 bg-zinc-950 py-3 px-4 text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm sm:leading-6 resize-none transition-shadow"
                    placeholder="blurry, low quality, distorted..."
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>

                {/* Reference Image Input */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-zinc-300">
                    Reference Image (Image-to-Image)
                  </label>
                  {referenceImage ? (
                    <div className="relative inline-block">
                      <img src={referenceImage.url} alt="Reference" className="h-24 w-24 object-cover rounded-xl border border-zinc-700" />
                      <button
                        onClick={() => setReferenceImage(null)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-24 px-4 transition bg-zinc-950 border-2 border-zinc-800 border-dashed rounded-2xl appearance-none cursor-pointer hover:border-emerald-500/50 hover:bg-zinc-900 focus:outline-none">
                      <span className="flex items-center space-x-2 text-zinc-400">
                        <Upload className="w-5 h-5" />
                        <span className="text-sm font-medium">Drop an image, or click to browse</span>
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isGenerating} />
                    </label>
                  )}
                </div>

                {/* Aspect Ratio Selector */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-zinc-300">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.value}
                        onClick={() => setAspectRatio(ratio.value)}
                        disabled={isGenerating}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                          aspectRatio === ratio.value
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                        }`}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate Image
                    </>
                  )}
                </button>

                {/* Error Message */}
                {error && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-7">
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-2 backdrop-blur-sm shadow-xl h-full min-h-[400px] flex flex-col">
              <div className="flex-1 rounded-2xl bg-zinc-950 border border-zinc-800/50 overflow-hidden relative flex items-center justify-center">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                    <p className="text-sm font-medium animate-pulse">Dreaming up your image...</p>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={generatedImage}
                    alt={prompt}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600 space-y-4 p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
                      <ImageIcon className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-sm font-medium">Your generated image will appear here</p>
                  </div>
                )}
              </div>
              
              {/* Action Bar */}
              {generatedImage && !isGenerating && (
                <div className="mt-2 p-3 bg-zinc-950 rounded-2xl border border-zinc-800/50 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 bg-zinc-800 text-zinc-100 px-5 py-2.5 rounded-xl font-semibold hover:bg-zinc-700 transition-transform active:scale-95 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded-xl font-semibold hover:bg-white transition-transform active:scale-95 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  
                  {!isDriveConnected ? (
                    <button
                      onClick={handleConnectDrive}
                      className="flex items-center gap-2 bg-[#4285F4] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#3367D6] transition-transform active:scale-95 text-sm"
                    >
                      <HardDrive className="w-4 h-4" />
                      Connect Drive
                    </button>
                  ) : driveUrl ? (
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-emerald-500 text-zinc-950 px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-400 transition-transform active:scale-95 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      View in Drive
                    </a>
                  ) : (
                    <button
                      onClick={handleSaveToDrive}
                      disabled={isUploadingToDrive}
                      className="flex items-center gap-2 bg-[#4285F4] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#3367D6] transition-transform active:scale-95 text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {isUploadingToDrive ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <HardDrive className="w-4 h-4" />
                      )}
                      {isUploadingToDrive ? 'Saving...' : 'Save to Drive'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {isEditing && generatedImage && (
        <ImageEditor
          imageUrl={generatedImage}
          onSave={(editedImageUrl) => {
            setGeneratedImage(editedImageUrl);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </div>
  );
}
