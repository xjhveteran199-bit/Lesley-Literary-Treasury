import { useEffect, useRef, useState } from 'react';
import { getAllCustomAuthors, type CustomAuthor } from '../../utils/db';

interface Author {
  slug: string;
  name: { zh: string; original: string };
  location: { coordinates: { lat: number; lng: number }; birthplace: string };
  portrait: string;
  color: string;
  categories: string[];
  audio?: { file: string; quote: { zh: string; original?: string }; duration: number };
  years: { birth: number; death: number | null };
  isCustom?: boolean;
}

interface Globe3DProps {
  authors: Author[];
}

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  label: string;
}

const categoryLabels: Record<string, string> = {
  poetry: '诗歌', fiction: '小说', essay: '散文', drama: '戏剧',
  philosophy: '哲学', comics: '漫画', children: '儿童文学',
};

function customToAuthor(c: CustomAuthor): Author {
  return {
    slug: c.id,
    name: c.name,
    location: c.location,
    portrait: c.portrait || `/images/authors/${c.id}.jpg`,
    color: c.color,
    categories: c.categories,
    audio: c.audio || undefined,
    years: c.years,
    isCustom: true,
  };
}

// Compute relationship arcs: authors sharing categories AND overlapping eras
function computeArcs(authors: Author[]): ArcData[] {
  const arcs: ArcData[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < authors.length; i++) {
    for (let j = i + 1; j < authors.length; j++) {
      const a = authors[i], b = authors[j];

      // Must share at least one category
      const sharedCats = a.categories.filter(c => b.categories.includes(c));
      if (sharedCats.length === 0) continue;

      // Must be in overlapping era (within 50 years of each other)
      const aEnd = a.years.death || (a.years.birth + 80);
      const bEnd = b.years.death || (b.years.birth + 80);
      const overlap = Math.min(aEnd, bEnd) - Math.max(a.years.birth, b.years.birth);
      if (overlap < 0) continue;

      // Skip if same location (distance < 2 degrees)
      const dist = Math.abs(a.location.coordinates.lat - b.location.coordinates.lat) +
                   Math.abs(a.location.coordinates.lng - b.location.coordinates.lng);
      if (dist < 2) continue;

      const key = [a.slug, b.slug].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);

      arcs.push({
        startLat: a.location.coordinates.lat,
        startLng: a.location.coordinates.lng,
        endLat: b.location.coordinates.lat,
        endLng: b.location.coordinates.lng,
        color: a.color,
        label: `${a.name.zh} ↔ ${b.name.zh}`,
      });
    }
  }
  return arcs;
}

const MARKER_SIZE_KEY = 'globe-marker-size';
const SHOW_ARCS_KEY = 'globe-show-arcs';

export default function Globe3D({ authors: staticAuthors }: Globe3DProps) {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<any>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [customAuthors, setCustomAuthors] = useState<Author[]>([]);
  const [markerSize, setMarkerSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem(MARKER_SIZE_KEY) || '40', 10);
    }
    return 40;
  });
  const [showArcs, setShowArcs] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SHOW_ARCS_KEY) !== 'false';
    }
    return true;
  });
  const [showSettings, setShowSettings] = useState(false);

  const setSelectedRef = useRef(setSelectedAuthor);
  setSelectedRef.current = setSelectedAuthor;
  const markerSizeRef = useRef(markerSize);
  markerSizeRef.current = markerSize;

  useEffect(() => {
    getAllCustomAuthors().then(list => {
      setCustomAuthors(
        list
          .filter(a => a.location.coordinates.lat !== 0 || a.location.coordinates.lng !== 0)
          .map(customToAuthor)
      );
    });
  }, []);

  // Save settings
  useEffect(() => { localStorage.setItem(MARKER_SIZE_KEY, String(markerSize)); }, [markerSize]);
  useEffect(() => { localStorage.setItem(SHOW_ARCS_KEY, String(showArcs)); }, [showArcs]);

  const resolvePortrait = (a: Author) => {
    // Check for user-uploaded custom portrait
    if (typeof window !== 'undefined') {
      const custom = localStorage.getItem(`portrait-${a.slug}`);
      if (custom) return custom;
    }
    if (a.portrait && !a.portrait.endsWith('.svg')) return a.portrait;
    return `/images/authors/${a.slug}.jpg`;
  };

  const authors = [
    ...staticAuthors.map(a => ({ ...a, portrait: resolvePortrait(a) })),
    ...customAuthors,
  ];

  const categories = [...new Set(authors.flatMap(a => a.categories))];

  const filteredAuthors = activeCategory
    ? authors.filter(a => a.categories.includes(activeCategory))
    : authors;

  const arcs = showArcs ? computeArcs(filteredAuthors) : [];

  // Build globe
  useEffect(() => {
    if (!globeContainerRef.current) return;
    let cancelled = false;

    import('globe.gl').then((mod) => {
      if (cancelled || !globeContainerRef.current) return;
      const Globe = mod.default;

      if (globeInstanceRef.current) {
        globeInstanceRef.current._destructor?.();
        globeContainerRef.current.innerHTML = '';
      }

      const globe = Globe()(globeContainerRef.current)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('#E07A5F')
        .atmosphereAltitude(0.2)
        .pointOfView({ lat: 30, lng: 20, altitude: 2.2 })
        // HTML markers
        .htmlElementsData(filteredAuthors)
        .htmlLat((d: any) => d.location.coordinates.lat)
        .htmlLng((d: any) => d.location.coordinates.lng)
        .htmlAltitude(0.02)
        .htmlElement((d: any) => {
          const size = markerSizeRef.current;
          const el = document.createElement('div');
          el.className = 'globe-marker';
          el.dataset.slug = d.slug;
          el.style.cssText = `
            width: ${size}px; height: ${size}px; border-radius: 50%;
            border: 3px solid ${d.color};
            overflow: hidden; cursor: pointer;
            background: #fff; position: relative;
            box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          `;
          el.innerHTML = `<img src="${d.portrait}" alt="${d.name.zh}"
            style="width:100%;height:100%;object-fit:cover;"
            onerror="this.style.display='none';this.parentElement.innerHTML+='<div style=\\'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${Math.max(12, size/3)}px;font-weight:700;color:${d.color};background:${d.color}20;font-family:serif\\'>${d.name.zh[0]}</div>'" />`;

          // Tooltip
          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: absolute; bottom: ${size + 6}px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.85); color: white; padding: 4px 10px;
            border-radius: 8px; font-size: 12px; white-space: nowrap;
            font-family: 'LXGW WenKai', sans-serif; pointer-events: none;
            opacity: 0; transition: opacity 0.2s ease;
          `;
          tooltip.textContent = d.name.zh;
          el.appendChild(tooltip);

          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.3)';
            el.style.boxShadow = `0 0 20px ${d.color}80`;
            el.style.zIndex = '100';
            tooltip.style.opacity = '1';
          });
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
            el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
            el.style.zIndex = '1';
            tooltip.style.opacity = '0';
          });
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedRef.current(d);
            globe.pointOfView({
              lat: d.location.coordinates.lat,
              lng: d.location.coordinates.lng,
              altitude: 1.2,
            }, 1000);
          });

          return el;
        })
        // Arcs for relationships
        .arcsData(arcs)
        .arcStartLat((d: any) => d.startLat)
        .arcStartLng((d: any) => d.startLng)
        .arcEndLat((d: any) => d.endLat)
        .arcEndLng((d: any) => d.endLng)
        .arcColor((d: any) => [`${d.color}60`, `${d.color}20`])
        .arcStroke(0.4)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(4000)
        .arcAltitudeAutoScale(0.3)
        .arcLabel((d: any) => `<span style="font-family:'LXGW WenKai',sans-serif;font-size:12px;color:white;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:6px;">${d.label}</span>`)
        .width(globeContainerRef.current.clientWidth)
        .height(globeContainerRef.current.clientHeight);

      // Auto-rotate
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.5;
      globe.controls().enableZoom = true;
      globe.controls().minDistance = 150;
      globe.controls().maxDistance = 600;

      let rotateTimer: any = null;
      const pauseRotation = () => {
        globe.controls().autoRotate = false;
        clearTimeout(rotateTimer);
        rotateTimer = setTimeout(() => {
          if (globeInstanceRef.current) globe.controls().autoRotate = true;
        }, 5000);
      };
      globeContainerRef.current.addEventListener('mousedown', pauseRotation);
      globeContainerRef.current.addEventListener('touchstart', pauseRotation);

      globeInstanceRef.current = globe;
    });

    return () => { cancelled = true; };
  }, []);

  // Update markers + arcs when filter/size/arcs change
  useEffect(() => {
    const globe = globeInstanceRef.current;
    if (!globe) return;

    // Re-render markers with new size
    globe.htmlElementsData([]);
    requestAnimationFrame(() => {
      globe.htmlElementsData(filteredAuthors);
      globe.arcsData(arcs);
    });
  }, [activeCategory, customAuthors, markerSize, showArcs]);

  // Listen for portrait updates from PortraitUpload
  useEffect(() => {
    const handler = () => {
      const globe = globeInstanceRef.current;
      if (!globe) return;
      globe.htmlElementsData([]);
      requestAnimationFrame(() => globe.htmlElementsData(filteredAuthors));
    };
    window.addEventListener('portrait-updated', handler);
    return () => window.removeEventListener('portrait-updated', handler);
  }, [filteredAuthors]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!globeInstanceRef.current || !globeContainerRef.current) return;
      globeInstanceRef.current
        .width(globeContainerRef.current.clientWidth)
        .height(globeContainerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: '#0a0a2e' }}>
      {/* Category Filter Pills */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] flex gap-2 flex-wrap justify-center px-4 max-w-[90vw]">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-1.5 rounded-pill text-sm font-body transition-all backdrop-blur-sm ${
            !activeCategory
              ? 'bg-terracotta text-white shadow-float'
              : 'bg-white/20 text-white hover:bg-white/30 shadow-card'
          }`}
        >
          全部
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`px-4 py-1.5 rounded-pill text-sm font-body transition-all backdrop-blur-sm ${
              activeCategory === cat
                ? 'bg-terracotta text-white shadow-float'
                : 'bg-white/20 text-white hover:bg-white/30 shadow-card'
            }`}
          >
            {categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      {/* Globe container */}
      <div ref={globeContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Bottom-left: author count + settings toggle */}
      <div className="absolute bottom-4 left-4 z-[100] flex flex-col gap-2">
        {/* Settings panel */}
        {showSettings && (
          <div className="bg-black/60 backdrop-blur-md px-4 py-3 rounded-xl w-56 animate-slide-up">
            {/* Marker size slider */}
            <div className="mb-3">
              <label className="text-white/70 text-xs font-body block mb-1">
                头像大小: {markerSize}px
              </label>
              <input
                type="range"
                min="24"
                max="64"
                step="4"
                value={markerSize}
                onChange={e => setMarkerSize(parseInt(e.target.value))}
                className="w-full h-1 accent-terracotta cursor-pointer"
              />
              <div className="flex justify-between text-white/40 text-[10px] mt-0.5">
                <span>小</span>
                <span>大</span>
              </div>
            </div>

            {/* Show arcs toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArcs}
                onChange={e => setShowArcs(e.target.checked)}
                className="accent-terracotta"
              />
              <span className="text-white/70 text-xs font-body">显示关联连线</span>
            </label>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-card">
            <span className="text-white/80 text-sm font-body">
              共 <span className="text-terracotta font-bold">{filteredAuthors.length}</span> 位作家
              {showArcs && arcs.length > 0 && (
                <span className="text-white/40 ml-2 text-xs">{arcs.length} 条关联</span>
              )}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all text-sm ${
              showSettings
                ? 'bg-terracotta text-white'
                : 'bg-black/40 backdrop-blur-sm text-white/60 hover:text-white'
            }`}
            title="地图设置"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Selected author popup card */}
      {selectedAuthor && (
        <div className="absolute bottom-20 right-4 z-[200] w-72 animate-slide-up">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/30">
            <button
              onClick={() => setSelectedAuthor(null)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-warm-muted hover:bg-black/20 transition-colors z-10"
            >
              ×
            </button>

            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0"
                  style={{ border: `3px solid ${selectedAuthor.color}` }}
                >
                  <img
                    src={selectedAuthor.portrait}
                    alt={selectedAuthor.name.zh}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-warm-dark">
                    {selectedAuthor.name.zh}
                  </h3>
                  <p className="font-western text-xs text-warm-muted italic">
                    {selectedAuthor.name.original}
                  </p>
                  <p className="text-xs text-warm-muted">
                    {selectedAuthor.location.birthplace}
                  </p>
                </div>
              </div>

              {/* Show related authors */}
              {(() => {
                const related = filteredAuthors.filter(a =>
                  a.slug !== selectedAuthor.slug &&
                  a.categories.some(c => selectedAuthor.categories.includes(c))
                ).slice(0, 3);
                if (related.length === 0) return null;
                return (
                  <div className="mb-3">
                    <p className="text-[10px] text-warm-muted mb-1">相关作家</p>
                    <div className="flex gap-1">
                      {related.map(r => (
                        <div key={r.slug} className="w-7 h-7 rounded-full overflow-hidden border-2" style={{ borderColor: r.color }}>
                          <img src={r.portrait} alt={r.name.zh} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      ))}
                      <span className="text-[10px] text-warm-muted self-center ml-1">
                        {related.map(r => r.name.zh).join('、')}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {selectedAuthor.audio && (
                <div className="mb-3 p-2.5 rounded-lg" style={{ background: `${selectedAuthor.color}10` }}>
                  <p className="text-xs text-warm-dark italic leading-relaxed">
                    「{selectedAuthor.audio.quote.zh}」
                  </p>
                </div>
              )}

              <a
                href={selectedAuthor.isCustom ? `/custom?id=${selectedAuthor.slug}` : `/authors/${selectedAuthor.slug}`}
                className="block text-center py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: selectedAuthor.color }}
              >
                探索 {selectedAuthor.name.zh} 的世界
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
