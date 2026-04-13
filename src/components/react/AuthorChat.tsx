import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadAiSettings,
  buildSystemPrompt,
  chatWithAuthor,
  streamResponse,
  type AuthorInfo,
  type ChatMessage,
} from '../../utils/ai';
import { getChatHistory, saveChatMessage, clearChatHistory, type StoredMessage } from '../../utils/chatHistory';
import AiSettings from './AiSettings';

interface AuthorChatProps {
  slug: string;
  author: AuthorInfo;
  portrait: string;
  color: string;
}

/** Simple markdown-ish rendering: bold, italic, quotes, line breaks */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/「(.+?)」/g, '<q class="text-warm-dark/70 italic">「$1」</q>')
    .replace(/\n/g, '<br/>');
}

const SUGGESTIONS_MAP: Record<string, string[]> = {
  poetry: ['你最爱的一首诗是哪首？', '写诗对你来说意味着什么？', '你如何看待现代诗歌？'],
  fiction: ['你最满意的小说是哪部？', '你笔下的角色有你的影子吗？', '你的创作灵感来自哪里？'],
  philosophy: ['你认为人生的意义是什么？', '你的哲学思想核心是什么？', '你如何看待自由与责任？'],
  essay: ['你最喜欢写什么题材的散文？', '你的文字风格是如何形成的？', '写作对你意味着什么？'],
  drama: ['你最得意的戏剧作品是哪部？', '你如何看待舞台与文学的关系？', '戏剧对社会有什么意义？'],
};

const DEFAULT_SUGGESTIONS = [
  '你觉得什么是好的文学作品？',
  '你的一天是怎样度过的？',
  '给我推荐一本你的书吧',
  '你最想对年轻读者说什么？',
];

function getSuggestions(categories: string[]): string[] {
  for (const cat of categories) {
    if (SUGGESTIONS_MAP[cat]) return [...SUGGESTIONS_MAP[cat], DEFAULT_SUGGESTIONS[3]];
  }
  return DEFAULT_SUGGESTIONS;
}

export default function AuthorChat({ slug, author, portrait, color }: AuthorChatProps) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasSettings, setHasSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = getSuggestions(author.categories);

  // Load history + check settings on mount
  useEffect(() => {
    getChatHistory(slug).then(setMessages).catch(() => {});
    setHasSettings(!!loadAiSettings());
    const onSettingsChanged = () => setHasSettings(!!loadAiSettings());
    const onOpenSettings = () => setSettingsOpen(true);
    window.addEventListener('ai-settings-changed', onSettingsChanged);
    window.addEventListener('open-ai-settings', onOpenSettings);
    return () => {
      window.removeEventListener('ai-settings-changed', onSettingsChanged);
      window.removeEventListener('open-ai-settings', onOpenSettings);
    };
  }, [slug]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  const sendMessage = useCallback(async (text: string) => {
    const settings = loadAiSettings();
    if (!settings) {
      setSettingsOpen(true);
      return;
    }

    const userMsg: StoredMessage = { role: 'user', content: text.trim(), timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setStreaming(true);
    setStreamText('');

    // Save user message
    saveChatMessage(slug, userMsg).catch(() => {});

    // Build API messages
    const systemPrompt = buildSystemPrompt(author);
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...newMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const stream = await chatWithAuthor(apiMessages, settings, abort.signal);
      const fullText = await streamResponse(stream, (chunk) => {
        setStreamText(prev => prev + chunk);
      });

      const assistantMsg: StoredMessage = { role: 'assistant', content: fullText, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamText('');
      saveChatMessage(slug, assistantMsg).catch(() => {});
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || '请求失败');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, slug, author]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !streaming) sendMessage(input);
    }
  };

  const handleClear = async () => {
    if (streaming) {
      abortRef.current?.abort();
    }
    await clearChatHistory(slug).catch(() => {});
    setMessages([]);
    setStreamText('');
    setError(null);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <>
      <AiSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-warm-dark flex items-center gap-2">
            <span>💬</span> 与{author.name.zh}对话
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-1 text-xs font-body rounded-lg border border-warm-border text-warm-muted hover:bg-cream transition-colors"
              title="AI 设置"
            >
              ⚙ 设置
            </button>
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="px-3 py-1.5 text-sm font-body rounded-lg text-white transition-colors"
                style={{ backgroundColor: color }}
              >
                开始对话
              </button>
            )}
          </div>
        </div>

        {!expanded ? (
          /* Collapsed preview */
          <div
            className="rounded-2xl p-6 cursor-pointer hover:shadow-float transition-all border border-warm-border/30"
            style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)` }}
            onClick={() => setExpanded(true)}
          >
            <div className="flex items-start gap-3">
              <img src={portrait} alt={author.name.zh} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: color }} />
              <div>
                <p className="text-sm text-warm-dark font-body italic mb-2">
                  "点击这里，与我聊聊文学与人生吧。"
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 3).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 text-[11px] font-body rounded-full bg-white/80 text-warm-muted">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Expanded chat */
          <div className="rounded-2xl border border-warm-border/30 overflow-hidden" style={{ background: `linear-gradient(180deg, ${color}05, white)` }}>
            {/* Messages area */}
            <div className="h-[400px] overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && !streaming && (
                <div className="text-center py-8">
                  <img src={portrait} alt={author.name.zh} className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2" style={{ borderColor: color }} />
                  <p className="text-sm text-warm-muted font-body mb-4">
                    {hasSettings
                      ? `你好！我是${author.name.zh}，有什么想和我聊的？`
                      : '请先配置 AI 设置，然后就可以和我对话了'}
                  </p>
                  {hasSettings && (
                    <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(s)}
                          className="px-3 py-1.5 text-xs font-body rounded-full border border-warm-border/50 text-warm-muted hover:bg-white hover:shadow-card transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {!hasSettings && (
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="px-4 py-2 text-sm font-body rounded-lg text-white transition-colors"
                      style={{ backgroundColor: color }}
                    >
                      配置 AI 设置
                    </button>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' && (
                    <img src={portrait} alt={author.name.zh} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border" style={{ borderColor: color }} />
                  )}
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm font-body leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-white shadow-card text-warm-dark rounded-tr-sm'
                        : 'rounded-tl-sm text-warm-dark'
                    }`}
                    style={msg.role === 'assistant' ? { backgroundColor: `${color}10` } : undefined}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </div>
              ))}

              {/* Streaming message */}
              {streaming && (
                <div className="flex gap-2">
                  <img src={portrait} alt={author.name.zh} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border" style={{ borderColor: color }} />
                  <div
                    className="max-w-[75%] px-3 py-2 rounded-2xl rounded-tl-sm text-sm font-body leading-relaxed text-warm-dark"
                    style={{ backgroundColor: `${color}10` }}
                  >
                    {streamText ? (
                      <span dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }} />
                    ) : (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: color, animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: color, animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: color, animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="text-center">
                  <p className="text-xs text-red-500 font-body bg-red-50 inline-block px-3 py-1.5 rounded-lg">
                    {error}
                  </p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-warm-border/30 p-3 bg-white/50">
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`对${author.name.zh}说点什么...`}
                  rows={1}
                  className="flex-1 px-3 py-2 text-sm font-body rounded-xl border border-warm-border/50 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-terracotta/20 text-warm-dark placeholder:text-warm-muted/50"
                  style={{ maxHeight: '100px' }}
                  disabled={streaming}
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="px-3 py-2 text-sm font-body rounded-xl bg-warm-muted/20 text-warm-muted hover:bg-warm-muted/30 transition-colors flex-shrink-0"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="px-3 py-2 text-sm font-body rounded-xl text-white transition-colors flex-shrink-0 disabled:opacity-40"
                    style={{ backgroundColor: color }}
                  >
                    发送
                  </button>
                )}
              </form>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-warm-muted/50 font-body">Shift+Enter 换行</span>
                {messages.length > 0 && (
                  <button
                    onClick={handleClear}
                    className="text-[10px] text-warm-muted/50 font-body hover:text-red-400 transition-colors"
                  >
                    清空对话
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
