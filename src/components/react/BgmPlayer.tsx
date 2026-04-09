import { useRef, useState, useEffect } from 'react';

interface BgmPlayerProps {
  src: string;
  title?: string;
}

export default function BgmPlayer({ src, title = '花海 — 周杰伦' }: BgmPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [showPanel, setShowPanel] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-play after first user interaction with the page
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        const audio = audioRef.current;
        if (audio) {
          audio.volume = volume;
          audio.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
    };

    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [hasInteracted, volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.volume = volume;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="auto" />

      {/* Floating music button */}
      <div className="fixed bottom-4 right-4 z-[1000]">
        {/* Expanded panel */}
        {showPanel && (
          <div className="absolute bottom-14 right-0 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 w-56 mb-2 animate-slide-up border border-warm-border/30">
            <p className="text-xs text-warm-muted font-body mb-1">正在播放</p>
            <p className="text-sm font-display font-bold text-warm-dark mb-3 truncate">{title}</p>

            <div className="flex items-center gap-2">
              <span className="text-xs text-warm-muted">🔈</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 accent-terracotta cursor-pointer"
              />
              <span className="text-xs text-warm-muted">🔊</span>
            </div>
          </div>
        )}

        {/* Music toggle button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          onMouseEnter={() => setShowPanel(true)}
          onMouseLeave={() => setShowPanel(false)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-float transition-all hover:scale-110 ${
            isPlaying
              ? 'bg-terracotta text-white'
              : 'bg-white text-warm-muted border border-warm-border'
          }`}
          title={isPlaying ? '暂停音乐' : '播放音乐'}
        >
          {isPlaying ? (
            <span className="text-lg animate-spin-slow">🎵</span>
          ) : (
            <span className="text-lg">🎵</span>
          )}
        </button>
      </div>
    </>
  );
}
