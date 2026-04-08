import { useEffect, useState } from 'react';
import { getCustomAuthor, type CustomAuthor } from '../../utils/db';
import { getPortraitUrl } from '../../utils/portraits';
import AudioPlayer from './AudioPlayer';

interface Props {
  slug?: string;
}

export default function CustomAuthorView({ slug: propSlug }: Props) {
  const [author, setAuthor] = useState<CustomAuthor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read slug from URL query param or props
    const params = new URLSearchParams(window.location.search);
    const slug = propSlug || params.get('id') || '';

    if (!slug) {
      setLoading(false);
      return;
    }

    getCustomAuthor(slug).then(a => {
      setAuthor(a || null);
      setLoading(false);
    });
  }, [propSlug]);

  if (loading) {
    return (
      <div className="pt-20 text-center py-16">
        <div className="text-warm-muted font-body animate-pulse">加载中...</div>
      </div>
    );
  }

  if (!author) {
    return (
      <div className="pt-20 text-center py-16">
        <p className="text-4xl mb-4">📭</p>
        <p className="text-warm-muted font-body mb-4">未找到此作家</p>
        <a href="/authors" className="text-terracotta font-body hover:underline">返回作家列表</a>
      </div>
    );
  }

  const { name, location, years, color, categories, era, audio, works, biography } = author;
  const portrait = getPortraitUrl(name.original || name.zh, author.portrait);
  const lifespan = years.death ? `${years.birth}–${years.death}` : `${years.birth}–`;

  const categoryLabels: Record<string, string> = {
    poetry: '诗歌', fiction: '小说', essay: '散文', drama: '戏剧',
    philosophy: '哲学', comics: '漫画', children: '儿童文学',
  };

  return (
    <div className="page-enter">
      {/* Hero Section */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}12 0%, ${color}05 100%)` }}>
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 overflow-hidden shadow-float" style={{ border: `4px solid ${color}`, borderRadius: '48% 52% 49% 51% / 52% 48% 51% 49%' }}>
                <img src={portrait} alt={name.zh} className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="text-center md:text-left">
              <h1 className="font-display text-3xl md:text-5xl font-bold text-warm-dark mb-2">{name.zh}</h1>
              <p className="font-western text-xl text-warm-muted italic mb-4">{name.original}</p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 rounded-pill text-sm font-body" style={{ background: `${color}15`, color }}>
                  {lifespan}
                </span>
                {location.birthplace && (
                  <span className="px-3 py-1 rounded-pill text-sm font-body bg-white/80 text-warm-muted">
                    📍 {location.birthplace}
                  </span>
                )}
                {categories.map(cat => (
                  <span key={cat} className="px-3 py-1 rounded-pill text-sm font-body bg-white/80 text-warm-muted">
                    {categoryLabels[cat] || cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-8 right-8 text-4xl opacity-10" style={{ animation: 'float-slow 8s ease-in-out infinite' }}>📖</div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Audio */}
        {audio && audio.quote.zh && (
          <section>
            <h2 className="font-display text-xl font-bold text-warm-dark mb-4 flex items-center gap-2">
              <span>🎵</span> 声音名片
            </h2>
            <AudioPlayer
              audioFile={audio.file}
              quote={audio.quote}
              authorName={name.zh}
              color={color}
              duration={audio.duration}
            />
          </section>
        )}

        {/* Biography */}
        {biography && (
          <section>
            <article className="font-body text-warm-dark/90 leading-relaxed whitespace-pre-wrap">
              {biography}
            </article>
          </section>
        )}

        {/* Works */}
        {works.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-warm-dark mb-6 flex items-center gap-2">
              <span>📚</span> 代表著作
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {works.map((work, i) => (
                <div key={i} className="sketch-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-22 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl" style={{ background: `${color}15` }}>
                      📕
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg font-bold text-warm-dark leading-tight">{work.title.zh}</h3>
                      {work.title.original && (
                        <p className="font-western text-sm text-warm-muted italic mt-0.5">{work.title.original}</p>
                      )}
                      {work.year && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-pill font-body" style={{ background: `${color}15`, color }}>
                          {work.year}
                        </span>
                      )}
                      {work.description && (
                        <p className="text-warm-dark/80 text-sm font-body mt-2 leading-relaxed">{work.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Navigation */}
        <nav className="flex justify-center pt-8 border-t border-warm-border">
          <a href="/authors" className="px-4 py-2 rounded-pill bg-white shadow-card text-warm-muted text-sm font-body hover:shadow-float transition-all">
            全部作家
          </a>
        </nav>
      </div>
    </div>
  );
}
