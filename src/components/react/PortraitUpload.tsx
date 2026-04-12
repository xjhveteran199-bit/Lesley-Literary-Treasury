import { useState, useRef } from 'react';

interface PortraitUploadProps {
  slug: string;
  currentPortrait: string;
  authorName: string;
  color: string;
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic', '.heif'];

export default function PortraitUpload({ slug, currentPortrait, authorName, color }: PortraitUploadProps) {
  const [portrait, setPortrait] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`portrait-${slug}`) || currentPortrait;
    }
    return currentPortrait;
  });
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate by extension if MIME type is empty
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isImage = file.type.startsWith('image/') || IMAGE_EXTS.includes(ext);
    if (!isImage) {
      alert('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      localStorage.setItem(`portrait-${slug}`, dataUrl);
      setPortrait(dataUrl);
      setShowUpload(false);
      window.dispatchEvent(new CustomEvent('portrait-updated', { detail: { slug, portrait: dataUrl } }));
    };
    reader.onerror = () => alert('读取文件失败，请重试');
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleReset = () => {
    localStorage.removeItem(`portrait-${slug}`);
    setPortrait(currentPortrait);
    setShowUpload(false);
    window.dispatchEvent(new CustomEvent('portrait-updated', { detail: { slug, portrait: currentPortrait } }));
  };

  return (
    <div className="relative group flex-shrink-0">
      {/* File input always in DOM (not inside conditional) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />

      <div
        className="w-32 h-32 md:w-40 md:h-40 blob-shape overflow-hidden shadow-float cursor-pointer"
        style={{ border: `4px solid ${color}` }}
        onClick={() => setShowUpload(!showUpload)}
      >
        <img src={portrait} alt={authorName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-body">
            更换头像
          </span>
        </div>
      </div>

      {showUpload && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl p-3 z-50 w-48 animate-slide-up">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full px-3 py-2 text-sm font-body rounded-lg hover:bg-cream transition-colors text-warm-dark text-left"
          >
            📷 上传自定义头像
          </button>
          {portrait !== currentPortrait && (
            <button
              onClick={handleReset}
              className="w-full px-3 py-2 text-sm font-body rounded-lg hover:bg-cream transition-colors text-warm-muted text-left mt-1"
            >
              ↩ 恢复默认头像
            </button>
          )}
          <button
            onClick={() => setShowUpload(false)}
            className="w-full px-3 py-2 text-sm font-body rounded-lg hover:bg-cream transition-colors text-warm-muted text-left mt-1"
          >
            ✕ 取消
          </button>
        </div>
      )}
    </div>
  );
}
