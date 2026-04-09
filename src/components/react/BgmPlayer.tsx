import { useRef, useState, useEffect } from 'react';

interface Track {
  name: string;
  src: string;
}

const PRESET_TRACKS: Track[] = [
  { name: '花海 — 周杰伦', src: '/audio/bgm-huahai.mp3' },
];

const STORAGE_KEY = 'bgm-settings';

interface BgmSettings {
  currentTrackIndex: number;
  customTracks: Track[];
  volume: number;
}

function loadSettings(): BgmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { currentTrackIndex: 0, customTracks: [], volume: 0.3 };
}

function saveSettings(s: BgmSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const [settings, setSettings] = useState<BgmSettings>(loadSettings);
  const allTracks = [...PRESET_TRACKS, ...settings.customTracks];
  const currentTrack = allTracks[settings.currentTrackIndex] || allTracks[0];

  // Save settings on change
  useEffect(() => { saveSettings(settings); }, [settings]);

  // Auto-play after first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        const audio = audioRef.current;
        if (audio) {
          audio.volume = settings.volume;
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
  }, [hasInteracted, settings.volume]);

  // Switch track when index changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = currentTrack.src;
    audio.volume = settings.volume;
    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [settings.currentTrackIndex]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.volume = settings.volume;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSettings(s => ({ ...s, volume: v }));
    if (audioRef.current) audioRef.current.volume = v;
  };

  const switchTrack = (index: number) => {
    setSettings(s => ({ ...s, currentTrackIndex: index }));
  };

  const handleUploadBgm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('音频文件不能超过 20MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const name = file.name.replace(/\.[^.]+$/, '');
      setSettings(s => {
        const newCustom = [...s.customTracks, { name, src: dataUrl }];
        return { ...s, customTracks: newCustom, currentTrackIndex: PRESET_TRACKS.length + newCustom.length - 1 };
      });
    };
    reader.readAsDataURL(file);
  };

  const removeCustomTrack = (customIndex: number) => {
    setSettings(s => {
      const newCustom = s.customTracks.filter((_, i) => i !== customIndex);
      const globalIndex = PRESET_TRACKS.length + customIndex;
      let newIdx = s.currentTrackIndex;
      if (newIdx === globalIndex) newIdx = 0;
      else if (newIdx > globalIndex) newIdx--;
      return { ...s, customTracks: newCustom, currentTrackIndex: newIdx };
    });
  };

  return (
    <>
      <audio ref={audioRef} src={currentTrack.src} loop preload="auto" />
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUploadBgm} />

      <div className="fixed bottom-4 right-4 z-[1000]">
        {/* Expanded panel */}
        {showPanel && (
          <div
            className="absolute bottom-14 right-0 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 w-64 mb-2 animate-slide-up border border-warm-border/30"
            onMouseEnter={() => setShowPanel(true)}
            onMouseLeave={() => setShowPanel(false)}
          >
            <p className="text-xs text-warm-muted font-body mb-2">背景音乐</p>

            {/* Track list */}
            <div className="max-h-40 overflow-y-auto mb-3 space-y-1">
              {allTracks.map((track, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    settings.currentTrackIndex === i
                      ? 'bg-terracotta/10 text-terracotta font-bold'
                      : 'hover:bg-cream text-warm-dark'
                  }`}
                  onClick={() => switchTrack(i)}
                >
                  <span className="flex-1 truncate font-body">{track.name}</span>
                  {settings.currentTrackIndex === i && isPlaying && (
                    <span className="text-xs animate-pulse">♪</span>
                  )}
                  {i >= PRESET_TRACKS.length && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCustomTrack(i - PRESET_TRACKS.length); }}
                      className="text-warm-muted hover:text-red-400 text-xs ml-1"
                      title="删除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Upload button */}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full px-3 py-2 text-xs font-body rounded-lg bg-cream hover:bg-warm-border/50 text-warm-muted transition-colors mb-3"
            >
              ＋ 上传自定义音乐
            </button>

            {/* Volume control */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-warm-muted">🔈</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 accent-terracotta cursor-pointer"
              />
              <span className="text-xs text-warm-muted">🔊</span>
            </div>
          </div>
        )}

        {/* Music toggle button */}
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
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
