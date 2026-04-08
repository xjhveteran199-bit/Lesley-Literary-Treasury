import { useEffect, useState, useRef } from 'react';
import { getAllCustomAuthors, type CustomAuthor } from '../../utils/db';
import { getPortraitUrl } from '../../utils/portraits';

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

interface WorldMapProps {
  authors: Author[];
}

function customToAuthor(c: CustomAuthor): Author {
  return {
    slug: c.id,
    name: c.name,
    location: c.location,
    portrait: getPortraitUrl(c.name.original || c.name.zh, c.portrait),
    color: c.color,
    categories: c.categories,
    audio: c.audio || undefined,
    years: c.years,
    isCustom: true,
  };
}

export default function WorldMap({ authors: staticAuthors }: WorldMapProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [customAuthors, setCustomAuthors] = useState<Author[]>([]);

  useEffect(() => {
    getAllCustomAuthors().then(list => {
      setCustomAuthors(list.filter(a => a.location.coordinates.lat !== 0 || a.location.coordinates.lng !== 0).map(customToAuthor));
    });
  }, []);

  // Merge static + custom, use DiceBear for static author portraits too
  const authors = [
    ...staticAuthors.map(a => ({
      ...a,
      portrait: getPortraitUrl(a.name.original || a.name.zh),
    })),
    ...customAuthors,
  ];
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const categories = [...new Set(authors.flatMap(a => a.categories))];

  const categoryLabels: Record<string, string> = {
    poetry: '诗歌',
    fiction: '小说',
    essay: '散文',
    drama: '戏剧',
    philosophy: '哲学',
    comics: '漫画',
    children: '儿童文学',
  };

  const filteredAuthors = activeCategory
    ? authors.filter(a => a.categories.includes(activeCategory))
    : authors;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;

      const map = L.map(mapRef.current!, {
        center: [30, 20],
        zoom: 2,
        minZoom: 2,
        maxZoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Force a resize after mount
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when filter changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;

      // Remove old markers
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      // Add new markers
      filteredAuthors.forEach(author => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:48px;height:48px;border-radius:50%;border:3px solid ${author.color};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;background:#fff;">
            <img src="${author.portrait}" alt="${author.name.zh}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:${author.color};background:${author.color}20;font-family:serif\\'>${author.name.zh[0]}</div>'" />
          </div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          popupAnchor: [0, -28],
        });

        const marker = L.marker(
          [author.location.coordinates.lat, author.location.coordinates.lng],
          { icon }
        ).addTo(map);

        const popupContent = `
          <div style="padding:16px;font-family:'LXGW WenKai',sans-serif;min-width:240px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid ${author.color};flex-shrink:0;background:#fff;">
                <img src="${author.portrait}" alt="${author.name.zh}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />
              </div>
              <div>
                <div style="font-weight:700;font-size:16px;color:#2D2A26;">${author.name.zh}</div>
                <div style="font-size:12px;color:#8B8680;font-style:italic;">${author.name.original}</div>
                <div style="font-size:12px;color:#8B8680;">${author.location.birthplace}</div>
              </div>
            </div>
            ${author.audio ? `
              <div style="margin-bottom:12px;padding:8px;background:#FFF8F0;border-radius:8px;">
                <p style="font-size:12px;color:#2D2A26;font-style:italic;margin:0;">「${author.audio.quote.zh}」</p>
              </div>
            ` : ''}
            <a href="${author.isCustom ? `/custom?id=${author.slug}` : `/authors/${author.slug}`}" style="display:block;text-align:center;padding:8px;border-radius:12px;color:white;font-size:14px;font-weight:700;text-decoration:none;background:${author.color};">
              探索 ${author.name.zh} 的世界
            </a>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'author-popup',
        });

        markersRef.current.push(marker);
      });
    });
  }, [filteredAuthors]);

  return (
    <div className="relative w-full h-full map-illustration">
      {/* Category Filter Pills */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] flex gap-2 flex-wrap justify-center px-4 max-w-[90vw]">
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

      {/* Map container */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Author count badge */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-card shadow-card">
        <span className="text-warm-muted text-sm font-body">
          共 <span className="text-terracotta font-bold">{filteredAuthors.length}</span> 位作家
        </span>
      </div>
    </div>
  );
}
