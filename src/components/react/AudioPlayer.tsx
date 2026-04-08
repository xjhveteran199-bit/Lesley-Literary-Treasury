import { useRef, useState, useEffect } from 'react';

interface AudioPlayerProps {
  audioFile: string;
  quote: { zh: string; original?: string };
  authorName: string;
  color: string;
  duration: number;
}

export default function AudioPlayer({ audioFile, quote, authorName, color, duration }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setTotalDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * totalDuration;
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="rounded-card p-5 shadow-card" style={{ background: `${color}08`, border: `2px solid ${color}20` }}>
      <audio ref={audioRef} src={audioFile} preload="metadata" />

      {/* Quote */}
      <blockquote className="mb-4">
        <p className="text-warm-dark font-display text-lg leading-relaxed italic">
          「{quote.zh}」
        </p>
        {quote.original && (
          <p className="text-warm-muted font-western text-sm mt-1 italic">
            "{quote.original}"
          </p>
        )}
        <footer className="text-warm-muted text-sm mt-2 font-body">
          —— {authorName}
        </footer>
      </blockquote>

      {/* Player controls */}
      <div className="flex items-center gap-4">
        {/* Play button */}
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all hover:scale-110 active:scale-95"
          style={{ background: color }}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2l10 6-10 6z" />
            </svg>
          )}
        </button>

        {/* Waveform / Progress */}
        <div className="flex-1">
          <div
            className="h-8 rounded-lg cursor-pointer relative overflow-hidden"
            style={{ background: `${color}10` }}
            onClick={handleSeek}
          >
            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-lg transition-[width] duration-100"
              style={{ width: `${progress}%`, background: `${color}25` }}
            />

            {/* Decorative waveform bars */}
            <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-3">
              {Array.from({ length: 30 }).map((_, i) => {
                const barProgress = (i / 30) * 100;
                const isActive = barProgress <= progress;
                const height = 4 + Math.sin(i * 0.7) * 8 + Math.cos(i * 1.3) * 4;
                return (
                  <div
                    key={i}
                    className="rounded-full transition-colors duration-200"
                    style={{
                      width: 3,
                      height: `${height}px`,
                      background: isActive ? color : `${color}30`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div className="flex justify-between mt-1">
            <span className="text-warm-muted text-xs font-body">{formatTime(currentTime)}</span>
            <span className="text-warm-muted text-xs font-body">{formatTime(totalDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
