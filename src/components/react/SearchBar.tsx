import { useState, useMemo } from 'react';

interface Author {
  slug: string;
  name: { zh: string; original: string };
  categories: string[];
  years: { birth: number; death: number | null };
  color: string;
  location: { birthplace: string; country: string };
}

interface SearchBarProps {
  authors: Author[];
}

const categoryLabels: Record<string, string> = {
  poetry: '诗歌', fiction: '小说', essay: '散文', drama: '戏剧',
  philosophy: '哲学', comics: '漫画', children: '儿童文学',
};

type SortMode = 'name' | 'year' | 'country';

export default function SearchBar({ authors }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('name');

  const categories = useMemo(() => [...new Set(authors.flatMap(a => a.categories))], [authors]);

  const filtered = useMemo(() => {
    let result = authors;

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(a =>
        a.name.zh.includes(q) ||
        a.name.original.toLowerCase().includes(q) ||
        a.location.birthplace.includes(q) ||
        a.location.country.toLowerCase().includes(q)
      );
    }

    if (activeCategory) {
      result = result.filter(a => a.categories.includes(activeCategory));
    }

    result = [...result].sort((a, b) => {
      if (sortMode === 'year') return a.years.birth - b.years.birth;
      if (sortMode === 'country') return a.location.country.localeCompare(b.location.country);
      return a.name.zh.localeCompare(b.name.zh, 'zh');
    });

    return result;
  }, [authors, query, activeCategory, sortMode]);

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-muted">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索作家（中文名、原名、国家...）"
          className="w-full pl-12 pr-4 py-3 rounded-card bg-white shadow-card border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-warm-dark placeholder:text-warm-muted/50 transition-colors"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-pill text-sm font-body transition-all ${
              !activeCategory ? 'bg-terracotta text-white shadow-sm' : 'bg-white text-warm-muted hover:bg-warm-border/50'
            }`}
          >
            全部
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-pill text-sm font-body transition-all ${
                activeCategory === cat ? 'bg-terracotta text-white shadow-sm' : 'bg-white text-warm-muted hover:bg-warm-border/50'
              }`}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-warm-muted text-xs font-body">排序:</span>
          {(['name', 'year', 'country'] as SortMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-2 py-1 rounded-lg text-xs font-body transition-all ${
                sortMode === mode ? 'bg-navy text-white' : 'text-warm-muted hover:text-warm-dark'
              }`}
            >
              {{ name: '姓名', year: '年代', country: '国家' }[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-warm-muted text-sm font-body mb-4">
        共 <span className="text-terracotta font-bold">{filtered.length}</span> 位作家
      </p>

      {/* Author grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((author, i) => (
          <a
            key={author.slug}
            href={`/authors/${author.slug}`}
            className="sketch-card p-4 text-center group"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div
              className="w-16 h-16 mx-auto mb-3 blob-shape flex items-center justify-center text-2xl font-display font-bold transition-transform group-hover:scale-110"
              style={{ background: `${author.color}20`, color: author.color }}
            >
              {author.name.zh[0]}
            </div>
            <h3 className="font-display text-sm font-bold text-warm-dark leading-tight mb-1">
              {author.name.zh}
            </h3>
            <p className="font-western text-xs text-warm-muted italic truncate">
              {author.name.original}
            </p>
            <p className="text-warm-muted/60 text-xs mt-1 font-body">
              {author.years.birth}{author.years.death ? `–${author.years.death}` : '–'}
            </p>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-warm-muted font-body">没有找到匹配的作家</p>
        </div>
      )}
    </div>
  );
}
