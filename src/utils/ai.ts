/**
 * AI chat utilities — OpenAI-compatible API caller + system prompt builder + stream parser.
 * Supports any model that implements the /v1/chat/completions endpoint.
 */

export interface AiSettings {
  endpoint: string;   // e.g. "https://api.openai.com/v1"
  apiKey: string;
  model: string;      // e.g. "gpt-4o", "claude-sonnet-4-20250514", "deepseek-chat"
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AuthorInfo {
  name: { zh: string; original: string; en?: string };
  location: { birthplace: string };
  categories: string[];
  era: string;
  years: { birth: number; death?: number | null };
  audio?: { quote: { zh: string; original?: string } } | null;
  works: { title: { zh: string; original?: string }; year?: number; description: string }[];
  biography: string; // markdown body content
}

const STORAGE_KEY = 'ai-settings';

const PRESETS: Record<string, Partial<AiSettings>> = {
  openai:   { endpoint: 'https://api.openai.com/v1',           model: 'gpt-4o' },
  claude:   { endpoint: 'https://api.anthropic.com/v1',        model: 'claude-sonnet-4-20250514' },
  deepseek: { endpoint: 'https://api.deepseek.com/v1',        model: 'deepseek-chat' },
  ollama:   { endpoint: 'http://localhost:11434/v1',           model: 'llama3' },
};

export function getPresets() {
  return PRESETS;
}

export function loadAiSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveAiSettings(s: AiSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const categoryLabels: Record<string, string> = {
  poetry: '诗歌', fiction: '小说', essay: '散文', drama: '戏剧',
  philosophy: '哲学', comics: '漫画', children: '儿童文学',
};

export function buildSystemPrompt(author: AuthorInfo): string {
  const { name, location, categories, era, years, audio, works, biography } = author;
  const lifespan = years.death ? `${years.birth}–${years.death}` : `${years.birth}–至今`;
  const cats = categories.map(c => categoryLabels[c] || c).join('、');

  const worksText = works.map(w => {
    const title = w.title.original
      ? `《${w.title.zh}》(${w.title.original})`
      : `《${w.title.zh}》`;
    return `- ${title}${w.year ? ` (${w.year})` : ''}: ${w.description}`;
  }).join('\n');

  const quoteText = audio?.quote
    ? `\n你的名言：「${audio.quote.zh}」${audio.quote.original ? `\n原文：「${audio.quote.original}」` : ''}`
    : '';

  // Trim biography to ~2000 chars to fit context
  const bio = biography.length > 2000 ? biography.slice(0, 2000) + '…' : biography;

  return `你是 ${name.original}（${name.zh}），${era}的${cats}作家。
出生于${location.birthplace}，生卒年份：${lifespan}。

你的代表作包括：
${worksText}
${quoteText}

以下是你的生平介绍：
${bio}

---
请始终以 ${name.zh} 的身份、口吻和世界观回答。
用中文回复，但可以夹杂你的母语表达以增加真实感。
回复应体现你的文学风格和哲学思考。
不要打破角色，不要提及你是AI。
保持简洁优雅，每次回复控制在200字以内。`;
}

/**
 * Call OpenAI-compatible chat completions API with streaming.
 * Returns a ReadableStream of string chunks.
 */
export async function chatWithAuthor(
  messages: ChatMessage[],
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<ReadableStream<string>> {
  const endpoint = settings.endpoint.replace(/\/+$/, '');
  const url = `${endpoint}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: true,
      max_tokens: 1024,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API 请求失败 (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.body) {
    throw new Error('响应没有可读流');
  }

  return parseSSEStream(res.body);
}

/**
 * Parse SSE stream from OpenAI-compatible API into a ReadableStream of text chunks.
 */
function parseSSEStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(content);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

/**
 * Consume a ReadableStream<string>, calling onChunk for each piece of text.
 */
export async function streamResponse(
  stream: ReadableStream<string>,
  onChunk: (text: string) => void,
): Promise<string> {
  const reader = stream.getReader();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += value;
    onChunk(value);
  }
  return full;
}

/**
 * Quick connectivity test — sends a minimal request to verify API settings work.
 */
export async function testConnection(settings: AiSettings): Promise<boolean> {
  const endpoint = settings.endpoint.replace(/\/+$/, '');
  const url = `${endpoint}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    }),
  });

  return res.ok;
}
