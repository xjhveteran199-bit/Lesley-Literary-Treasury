import { useEffect, useState } from 'react';

interface Author {
  slug: string;
  name: { zh: string; original: string };
  location: { coordinates: { lat: number; lng: number }; birthplace: string };
  portrait: string;
  color: string;
  categories: string[];
  audio?: { file: string; quote: { zh: string; original?: string }; duration: number };
  years: { birth: number; death: number | null };
}

interface WorldMapProps {
  authors: Author[];
}

export default function WorldMap({ authors }: WorldMapProps) {
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-cream">
        <div className="text-warm-muted font-body text-lg">Loading map...</div>
      </div>
    );
  }

  return <MapInner authors={authors} activeCategory={activeCategory} setActiveCategory={setActiveCategory} playingAudio={playingAudio} setPlayingAudio={setPlayingAudio} />;
}

function MapInner({ authors, activeCategory, setActiveCategory, playingAudio, setPlayingAudio }: WorldMapProps & {
  activeCategory: string | null;
  setActiveCategory: (c: string | null) => void;
  playingAudio: string | null;
  setPlayingAudio: (s: string | null) => void;
}) {
  const [L, setL] = useState<any>(null);
  const [MapComponents, setMapComponents] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      import('leaflet'),
      import('react-leaflet'),
    ]).then(([leaflet, reactLeaflet]) => {
      setL(leaflet.default);
      setMapComponents(reactLeaflet);
    });
  }, []);

  if (!L || !MapComponents) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-cream">
        <div className="text-warm-muted font-body text-lg animate-pulse">正在加载文学世界地图...</div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  const categories = [...new Set(authors.flatMap(a => a.categories))];

  const filteredAuthors = activeCategory
    ? authors.filter(a => a.categories.includes(activeCategory))
    : authors;

  const categoryLabels: Record<string, string> = {
    poetry: '诗歌',
    fiction: '小说',
    essay: '散文',
    drama: '戏剧',
    philosophy: '哲学',
    comics: '漫画',
    children: '儿童文学',
  };

  function createAuthorIcon(author: Author) {
    return L.divIcon({
      className: 'author-marker-wrapper',
      html: `
        <div class="author-marker" style="border-color: ${author.color}">
          <div style="width:100%;height:100%;background:${author.color}20;display:flex;align-items:center;justify-content:center;font-size:20px;font-family:'LXGW WenKai',sans-serif;color:${author.color};font-weight:700;">
            ${author.name.zh[0]}
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -28],
    });
  }

  function handlePlayAudio(audioFile: string) {
    if (playingAudio === audioFile) {
      setPlayingAudio(null);
      document.querySelectorAll('audio').forEach(a => a.pause());
      return;
    }
    document.querySelectorAll('audio').forEach(a => a.pause());
    setPlayingAudio(audioFile);
    const audio = new Audio(audioFile);
    audio.play().catch(() => {});
    audio.onended = () => setPlayingAudio(null);
  }

  return (
    <div className="relative w-full h-full map-illustration">
      {/* Category Filter Pills */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2 flex-wrap justify-center px-4 max-w-[90vw]">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-1.5 rounded-pill text-sm font-body transition-all ${
            !activeCategory
              ? 'bg-terracotta text-white shadow-float'
              : 'bg-white/90 text-warm-dark hover:bg-white shadow-card'
          }`}
        >
          全部
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`px-4 py-1.5 rounded-pill text-sm font-body transition-all ${
              activeCategory === cat
                ? 'bg-terracotta text-white shadow-float'
                : 'bg-white/90 text-warm-dark hover:bg-white shadow-card'
            }`}
          >
            {categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      <MapContainer
        center={[30, 20]}
        zoom={2}
        minZoom={2}
        maxZoom={12}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {filteredAuthors.map(author => (
          <Marker
            key={author.slug}
            position={[author.location.coordinates.lat, author.location.coordinates.lng]}
            icon={createAuthorIcon(author)}
          >
            <Popup>
              <div className="p-4 font-body">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ background: `${author.color}20`, color: author.color }}
                  >
                    {author.name.zh[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-warm-dark text-base leading-tight">{author.name.zh}</h3>
                    <p className="text-warm-muted text-xs font-western">{author.name.original}</p>
                    <p className="text-warm-muted text-xs">{author.location.birthplace}</p>
                  </div>
                </div>

                {author.audio && (
                  <div className="mb-3 p-2 bg-cream rounded-lg">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePlayAudio(author.audio!.file)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-transform hover:scale-110"
                        style={{ background: author.color }}
                      >
                        {playingAudio === author.audio.file ? '⏸' : '▶'}
                      </button>
                      <p className="text-xs text-warm-dark italic leading-snug">
                        「{author.audio.quote.zh}」
                      </p>
                    </div>
                  </div>
                )}

                <a
                  href={`/authors/${author.slug}`}
                  className="block w-full text-center py-2 rounded-xl text-white text-sm font-bold transition-transform hover:scale-[1.02]"
                  style={{ background: author.color }}
                >
                  探索 {author.name.zh} 的世界
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Author count badge */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-card shadow-card">
        <span className="text-warm-muted text-sm font-body">
          共 <span className="text-terracotta font-bold">{filteredAuthors.length}</span> 位作家
        </span>
      </div>
    </div>
  );
}
