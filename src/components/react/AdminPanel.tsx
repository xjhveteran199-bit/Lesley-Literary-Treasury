import { useState, useEffect, useRef } from 'react';
import {
  getAllCustomAuthors,
  getCustomAuthor,
  saveCustomAuthor,
  deleteCustomAuthor,
  createAuthorTemplate,
  fileToDataUrl,
  nameToSlug,
  type CustomAuthor,
} from '../../utils/db';
import { getPortraitUrl } from '../../utils/portraits';

type View = 'list' | 'add' | 'edit';

export default function AdminPanel() {
  const [view, setView] = useState<View>('list');
  const [authors, setAuthors] = useState<CustomAuthor[]>([]);
  const [editingAuthor, setEditingAuthor] = useState<CustomAuthor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuthors();
  }, []);

  async function loadAuthors() {
    setLoading(true);
    const list = await getAllCustomAuthors();
    setAuthors(list.sort((a, b) => b.updatedAt - a.updatedAt));
    setLoading(false);
  }

  function handleAdd() {
    setEditingAuthor(null);
    setView('add');
  }

  function handleEdit(author: CustomAuthor) {
    setEditingAuthor(author);
    setView('edit');
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`确定要删除「${name}」吗？此操作不可撤销。`)) return;
    await deleteCustomAuthor(id);
    await loadAuthors();
  }

  async function handleSave(author: CustomAuthor) {
    await saveCustomAuthor(author);
    await loadAuthors();
    setView('list');
    setEditingAuthor(null);
  }

  if (loading) {
    return <div className="text-center py-12 text-warm-muted font-body">加载中...</div>;
  }

  if (view === 'add') {
    return <AddAuthorForm onSave={handleSave} onCancel={() => setView('list')} />;
  }

  if (view === 'edit' && editingAuthor) {
    return <EditAuthorForm author={editingAuthor} onSave={handleSave} onCancel={() => setView('list')} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-bold text-warm-dark">自定义作家</h2>
          <p className="text-warm-muted text-sm font-body mt-1">
            共 {authors.length} 位自定义作家
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-6 py-2.5 bg-terracotta text-white rounded-pill font-body font-bold shadow-card hover:shadow-float transition-all hover:scale-[1.02]"
        >
          + 添加作家
        </button>
      </div>

      {authors.length === 0 ? (
        <div className="text-center py-16 sketch-card">
          <p className="text-4xl mb-4">📝</p>
          <p className="text-warm-muted font-body mb-4">还没有自定义作家</p>
          <button
            onClick={handleAdd}
            className="px-6 py-2 bg-terracotta text-white rounded-pill font-body font-bold"
          >
            添加第一位作家
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {authors.map(author => (
            <div key={author.id} className="sketch-card p-4 flex items-center gap-4">
              <img
                src={getPortraitUrl(author.name.original || author.name.zh, author.portrait)}
                alt={author.name.zh}
                className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                style={{ border: `2px solid ${author.color}` }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-warm-dark truncate">{author.name.zh}</h3>
                <p className="text-warm-muted text-sm font-body truncate">{author.name.original}</p>
                <p className="text-warm-muted/60 text-xs font-body">
                  {author.location.birthplace || '未设置出生地'} · {author.works.length} 部作品
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(author)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-sage/20 text-sage font-body hover:bg-sage/30 transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(author.id, author.name.zh)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-500 font-body hover:bg-red-100 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Quick-add form: just enter a name */
function AddAuthorForm({ onSave, onCancel }: { onSave: (a: CustomAuthor) => void; onCancel: () => void }) {
  const [nameZh, setNameZh] = useState('');
  const [nameOriginal, setNameOriginal] = useState('');
  const [step, setStep] = useState<'name' | 'details'>('name');
  const [author, setAuthor] = useState<CustomAuthor | null>(null);

  function handleCreateFromName() {
    if (!nameZh.trim()) return;
    const template = createAuthorTemplate(nameZh.trim(), nameOriginal.trim() || undefined);
    setAuthor(template);
    setStep('details');
  }

  if (step === 'name') {
    return (
      <div className="max-w-md mx-auto">
        <button onClick={onCancel} className="text-warm-muted text-sm font-body mb-6 hover:text-terracotta transition-colors">
          ← 返回列表
        </button>
        <div className="sketch-card p-8 text-center">
          <p className="text-4xl mb-4">✨</p>
          <h2 className="font-display text-xl font-bold text-warm-dark mb-6">添加新作家</h2>

          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">中文名 *</label>
              <input
                type="text"
                value={nameZh}
                onChange={e => setNameZh(e.target.value)}
                placeholder="例：村上春树"
                className="w-full px-4 py-2.5 rounded-card bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateFromName()}
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">原名 / 英文名</label>
              <input
                type="text"
                value={nameOriginal}
                onChange={e => setNameOriginal(e.target.value)}
                placeholder="例：Haruki Murakami"
                className="w-full px-4 py-2.5 rounded-card bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body"
                onKeyDown={e => e.key === 'Enter' && handleCreateFromName()}
              />
            </div>
          </div>

          {nameZh.trim() && (
            <div className="mt-6 p-4 bg-cream rounded-card">
              <p className="text-sm text-warm-muted font-body mb-2">预览头像</p>
              <img
                src={getPortraitUrl(nameOriginal.trim() || nameZh.trim())}
                alt="preview"
                className="w-20 h-20 rounded-full mx-auto"
                style={{ border: `3px solid ${createAuthorTemplate(nameZh).color}` }}
              />
            </div>
          )}

          <button
            onClick={handleCreateFromName}
            disabled={!nameZh.trim()}
            className="mt-6 w-full py-3 bg-terracotta text-white rounded-pill font-body font-bold disabled:opacity-40 hover:shadow-float transition-all"
          >
            创建档案 →
          </button>
        </div>
      </div>
    );
  }

  if (author) {
    return <EditAuthorForm author={author} onSave={onSave} onCancel={onCancel} isNew />;
  }

  return null;
}

/** Full edit form for an author */
function EditAuthorForm({ author, onSave, onCancel, isNew = false }: {
  author: CustomAuthor;
  onSave: (a: CustomAuthor) => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [data, setData] = useState<CustomAuthor>({ ...author });
  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkDesc, setNewWorkDesc] = useState('');
  const [newWorkYear, setNewWorkYear] = useState('');
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  function update(patch: Partial<CustomAuthor>) {
    setData(prev => ({ ...prev, ...patch }));
  }

  function updateName(patch: Partial<CustomAuthor['name']>) {
    setData(prev => ({ ...prev, name: { ...prev.name, ...patch } }));
  }

  function updateLocation(patch: Partial<CustomAuthor['location']>) {
    setData(prev => ({ ...prev, location: { ...prev.location, ...patch } }));
  }

  function updateCoords(patch: Partial<CustomAuthor['location']['coordinates']>) {
    setData(prev => ({
      ...prev,
      location: { ...prev.location, coordinates: { ...prev.location.coordinates, ...patch } },
    }));
  }

  function updateAudio(patch: Partial<NonNullable<CustomAuthor['audio']>>) {
    setData(prev => ({
      ...prev,
      audio: { file: '', quote: { zh: '' }, duration: 8, ...prev.audio, ...patch },
    }));
  }

  async function handlePortraitUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    update({ portrait: dataUrl });
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    updateAudio({ file: dataUrl });
  }

  function addWork() {
    if (!newWorkTitle.trim()) return;
    const work = {
      title: { zh: newWorkTitle.trim() },
      year: newWorkYear ? parseInt(newWorkYear) : undefined,
      description: newWorkDesc.trim(),
    };
    setData(prev => ({ ...prev, works: [...prev.works, work] }));
    setNewWorkTitle('');
    setNewWorkDesc('');
    setNewWorkYear('');
  }

  function removeWork(index: number) {
    setData(prev => ({ ...prev, works: prev.works.filter((_, i) => i !== index) }));
  }

  function handleSubmit() {
    if (!data.name.zh.trim()) {
      alert('请输入作家中文名');
      return;
    }
    onSave(data);
  }

  const portraitSrc = getPortraitUrl(data.name.original || data.name.zh, data.portrait);

  const categoryOptions = [
    { value: 'poetry', label: '诗歌' },
    { value: 'fiction', label: '小说' },
    { value: 'essay', label: '散文' },
    { value: 'drama', label: '戏剧' },
    { value: 'philosophy', label: '哲学' },
    { value: 'comics', label: '漫画' },
    { value: 'children', label: '儿童文学' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onCancel} className="text-warm-muted text-sm font-body mb-6 hover:text-terracotta transition-colors">
        ← 返回列表
      </button>

      <h2 className="font-display text-xl font-bold text-warm-dark mb-6">
        {isNew ? '创建新作家' : `编辑：${author.name.zh}`}
      </h2>

      <div className="space-y-6">
        {/* Portrait Section */}
        <div className="sketch-card p-6">
          <h3 className="font-display font-bold text-warm-dark mb-4">📷 肖像</h3>
          <div className="flex items-center gap-6">
            <img
              src={portraitSrc}
              alt={data.name.zh}
              className="w-24 h-24 rounded-full object-cover"
              style={{ border: `3px solid ${data.color}` }}
            />
            <div className="space-y-2">
              <button
                onClick={() => portraitInputRef.current?.click()}
                className="block px-4 py-2 text-sm rounded-lg bg-sage/20 text-sage font-body hover:bg-sage/30 transition-colors"
              >
                上传自定义肖像
              </button>
              {data.portrait && (
                <button
                  onClick={() => update({ portrait: null })}
                  className="block text-xs text-warm-muted hover:text-red-500 font-body transition-colors"
                >
                  恢复默认头像
                </button>
              )}
              <input ref={portraitInputRef} type="file" accept="image/*" className="hidden" onChange={handlePortraitUpload} />
              <p className="text-xs text-warm-muted font-body">支持 JPG、PNG、SVG</p>
            </div>
          </div>

          {/* Color picker */}
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-body text-warm-muted">主题色</label>
            <input
              type="color"
              value={data.color}
              onChange={e => update({ color: e.target.value })}
              className="w-8 h-8 rounded-full border-0 cursor-pointer"
            />
            <span className="text-xs text-warm-muted font-mono">{data.color}</span>
          </div>
        </div>

        {/* Basic Info */}
        <div className="sketch-card p-6">
          <h3 className="font-display font-bold text-warm-dark mb-4">📝 基本信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">中文名 *</label>
              <input
                type="text" value={data.name.zh}
                onChange={e => updateName({ zh: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">原名</label>
              <input
                type="text" value={data.name.original}
                onChange={e => updateName({ original: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">出生年</label>
              <input
                type="number" value={data.years.birth}
                onChange={e => update({ years: { ...data.years, birth: parseInt(e.target.value) || 0 } })}
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">逝世年（在世留空）</label>
              <input
                type="number" value={data.years.death ?? ''}
                onChange={e => update({ years: { ...data.years, death: e.target.value ? parseInt(e.target.value) : null } })}
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">出生地</label>
              <input
                type="text" value={data.location.birthplace}
                onChange={e => updateLocation({ birthplace: e.target.value })}
                placeholder="例：东京, 日本"
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">国家（英文）</label>
              <input
                type="text" value={data.location.country}
                onChange={e => updateLocation({ country: e.target.value })}
                placeholder="例：Japan"
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">纬度</label>
              <input
                type="number" step="0.0001" value={data.location.coordinates.lat}
                onChange={e => updateCoords({ lat: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">经度</label>
              <input
                type="number" step="0.0001" value={data.location.coordinates.lng}
                onChange={e => updateCoords({ lng: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="mt-4">
            <label className="block text-sm font-body text-warm-muted mb-2">分类</label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    const cats = data.categories.includes(opt.value)
                      ? data.categories.filter(c => c !== opt.value)
                      : [...data.categories, opt.value];
                    update({ categories: cats });
                  }}
                  className={`px-3 py-1 rounded-pill text-sm font-body transition-all ${
                    data.categories.includes(opt.value)
                      ? 'bg-terracotta text-white'
                      : 'bg-cream text-warm-muted hover:bg-warm-border/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Era */}
          <div className="mt-4">
            <label className="block text-sm font-body text-warm-muted mb-1">时代</label>
            <input
              type="text" value={data.era}
              onChange={e => update({ era: e.target.value })}
              placeholder="例：20世纪"
              className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
            />
          </div>
        </div>

        {/* Audio Voice Card */}
        <div className="sketch-card p-6">
          <h3 className="font-display font-bold text-warm-dark mb-4">🎵 声音名片</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">金句（中文）</label>
              <input
                type="text" value={data.audio?.quote?.zh || ''}
                onChange={e => updateAudio({ quote: { ...data.audio?.quote, zh: e.target.value } })}
                placeholder="例：我的心略大于整个宇宙"
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-warm-muted mb-1">金句（原文）</label>
              <input
                type="text" value={data.audio?.quote?.original || ''}
                onChange={e => updateAudio({ quote: { zh: data.audio?.quote?.zh || '', original: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <div>
              <button
                onClick={() => audioInputRef.current?.click()}
                className="px-4 py-2 text-sm rounded-lg bg-sage/20 text-sage font-body hover:bg-sage/30 transition-colors"
              >
                {data.audio?.file ? '替换音频文件' : '上传音频文件'}
              </button>
              {data.audio?.file && (
                <span className="ml-3 text-xs text-warm-muted font-body">✓ 已上传</span>
              )}
              <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
            </div>
          </div>
        </div>

        {/* Works */}
        <div className="sketch-card p-6">
          <h3 className="font-display font-bold text-warm-dark mb-4">📚 代表著作</h3>

          {data.works.length > 0 && (
            <div className="space-y-2 mb-4">
              {data.works.map((work, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-cream rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-bold text-warm-dark truncate">{work.title.zh}</p>
                    <p className="text-xs text-warm-muted truncate">{work.description || '无描述'}</p>
                  </div>
                  {work.year && <span className="text-xs text-warm-muted flex-shrink-0">{work.year}</span>}
                  <button onClick={() => removeWork(i)} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 p-3 bg-cream/50 rounded-lg border-2 border-dashed border-warm-border">
            <input
              type="text" value={newWorkTitle}
              onChange={e => setNewWorkTitle(e.target.value)}
              placeholder="书名"
              className="w-full px-3 py-2 rounded-lg bg-white border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
            />
            <div className="flex gap-2">
              <input
                type="text" value={newWorkDesc}
                onChange={e => setNewWorkDesc(e.target.value)}
                placeholder="简介"
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
              <input
                type="number" value={newWorkYear}
                onChange={e => setNewWorkYear(e.target.value)}
                placeholder="年份"
                className="w-20 px-3 py-2 rounded-lg bg-white border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm"
              />
            </div>
            <button
              onClick={addWork}
              disabled={!newWorkTitle.trim()}
              className="px-4 py-1.5 text-sm rounded-lg bg-sage/20 text-sage font-body hover:bg-sage/30 transition-colors disabled:opacity-40"
            >
              + 添加作品
            </button>
          </div>
        </div>

        {/* Biography */}
        <div className="sketch-card p-6">
          <h3 className="font-display font-bold text-warm-dark mb-4">📖 传记</h3>
          <textarea
            value={data.biography}
            onChange={e => update({ biography: e.target.value })}
            placeholder="在此输入作家传记...支持 Markdown 格式"
            rows={8}
            className="w-full px-4 py-3 rounded-card bg-cream border-2 border-transparent focus:border-terracotta/30 outline-none font-body text-sm leading-relaxed resize-y"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 bg-terracotta text-white rounded-pill font-body font-bold shadow-card hover:shadow-float transition-all"
          >
            {isNew ? '创建作家' : '保存修改'}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-white text-warm-muted rounded-pill font-body shadow-card hover:shadow-float transition-all"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
