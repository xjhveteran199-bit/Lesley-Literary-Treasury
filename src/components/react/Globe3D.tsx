import { useEffect, useRef, useState, useCallback } from 'react';
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

export default function Globe3D({ authors: staticAuthors }: Globe3DProps) {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<any>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hoveredAuthor, setHoveredAuthor] = useState<Author | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [customAuthors, setCustomAuthors] = useState<Author[]>([]);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const setSelectedRef = useRef(setSelectedAuthor);
  setSelectedRef.current = setSelectedAuthor;

  useEffect(() => {
    getAllCustomAuthors().then(list => {
      setCustomAuthors(
        list
          .filter(a => a.location.coordinates.lat !== 0 || a.location.coordinates.lng !== 0)
          .map(customToAuthor)
      );
    });
  }, []);

  // Resolve portrait: prefer local jpg/png, fall back to frontmatter path
  const resolvePortrait = (a: Author) => {
    // If portrait already points to a real image, use it
    if (a.portrait && !a.portrait.endsWith('.svg')) return a.portrait;
    // Try jpg fallback
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

  // Build globe
  useEffect(() => {
    if (!globeContainerRef.current) return;
    let cancelled = false;

    import('globe.gl').then((mod) => {
      if (cancelled || !globeContainerRef.current) return;
      const Globe = mod.default;

      // Clear previous
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
        // Author markers as HTML elements
        .htmlElementsData(filteredAuthors)
        .htmlLat((d: any) => d.location.coordinates.lat)
        .htmlLng((d: any) => d.location.coordinates.lng)
        .htmlAltitude(0.02)
        .htmlElement((d: any) => {
          const el = document.createElement('div');
          el.className = 'globe-marker';
          el.style.cssText = `
            width: 40px; height: 40px; border-radius: 50%;
            border: 3px solid ${d.color};
            overflow: hidden; cursor: pointer;
            background: #fff;
            box-shadow: 0 2px 12px rgba(0,0,0,0.3);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          `;
          el.innerHTML = `<img src="${d.portrait}" alt="${d.name.zh}"
            style="width:100%;height:100%;object-fit:cover;"
            onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:${d.color};background:${d.color}20;font-family:serif\\'>${d.name.zh[0]}</div>'" />`;

          // Tooltip element
          const tooltip = document.createElement('div');
          tooltip.className = 'globe-tooltip';
          tooltip.style.cssText = `
            position: absolute; bottom: 48px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); color: white; padding: 4px 10px;
            border-radius: 8px; font-size: 12px; white-space: nowrap;
            font-family: 'LXGW WenKai', sans-serif; pointer-events: none;
            opacity: 0; transition: opacity 0.2s ease;
          `;
          tooltip.textContent = d.name.zh;
          el.style.position = 'relative';
          el.appendChild(tooltip);

          el.addEventListener('mouseenter', (e) => {
            el.style.transform = 'scale(1.4)';
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
            // Fly to the author's location
            globe.pointOfView({
              lat: d.location.coordinates.lat,
              lng: d.location.coordinates.lng,
              altitude: 1.2,
            }, 1000);
          });

          return el;
        })
        .width(globeContainerRef.current.clientWidth)
        .height(globeContainerRef.current.clientHeight);

      // Auto-rotate
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.5;
      globe.controls().enableZoom = true;
      globe.controls().minDistance = 150;
      globe.controls().maxDistance = 600;

      // Stop auto-rotate on interaction, resume after 5s
      let rotateTimer: any = null;
      const pauseRotation = () => {
        globe.controls().autoRotate = false;
        clearTimeout(rotateTimer);
        rotateTimer = setTimeout(() => {
          if (globeInstanceRef.current) {
            globe.controls().autoRotate = true;
          }
        }, 5000);
      };
      globeContainerRef.current.addEventListener('mousedown', pauseRotation);
      globeContainerRef.current.addEventListener('touchstart', pauseRotation);

      globeInstanceRef.current = globe;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update data when filter changes
  useEffect(() => {
    if (!globeInstanceRef.current) return;
    globeInstanceRef.current.htmlElementsData(filteredAuthors);
  }, [activeCategory, customAuthors]);

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

  const closePopup = () => setSelectedAuthor(null);

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

      {/* Author count badge */}
      <div className="absolute bottom-4 left-4 z-[100] bg-black/40 backdrop-blur-sm px-4 py-2 rounded-card">
        <span className="text-white/80 text-sm font-body">
          共 <span className="text-terracotta font-bold">{filteredAuthors.length}</span> 位作家
        </span>
      </div>

      {/* Selected author popup card */}
      {selectedAuthor && (
        <div className="absolute bottom-20 right-4 z-[200] w-72 animate-slide-up">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/30">
            {/* Close button */}
            <button
              onClick={closePopup}
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
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
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
