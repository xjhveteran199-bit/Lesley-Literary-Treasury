import { useState, useEffect } from 'react';
import { loadAiSettings, saveAiSettings, getPresets, testConnection, type AiSettings as AiSettingsType } from '../../utils/ai';

interface AiSettingsProps {
  open: boolean;
  onClose: () => void;
}

const presets = getPresets();
const presetEntries = Object.entries(presets) as [string, { endpoint?: string; model?: string }][];

const presetLabels: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  ollama: 'Ollama (本地)',
};

export default function AiSettings({ open, onClose }: AiSettingsProps) {
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  useEffect(() => {
    if (open) {
      const saved = loadAiSettings();
      if (saved) {
        setEndpoint(saved.endpoint);
        setApiKey(saved.apiKey);
        setModel(saved.model);
      }
      setTestResult(null);
    }
  }, [open]);

  const applyPreset = (key: string) => {
    const p = presets[key];
    if (p) {
      if (p.endpoint) setEndpoint(p.endpoint);
      if (p.model) setModel(p.model);
      setTestResult(null);
    }
  };

  const handleSave = () => {
    const settings: AiSettingsType = { endpoint: endpoint.trim(), apiKey: apiKey.trim(), model: model.trim() };
    saveAiSettings(settings);
    window.dispatchEvent(new CustomEvent('ai-settings-changed'));
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await testConnection({ endpoint: endpoint.trim(), apiKey: apiKey.trim(), model: model.trim() });
      setTestResult(ok ? 'success' : 'fail');
    } catch {
      setTestResult('fail');
    }
    setTesting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md p-6 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-warm-dark">AI 设置</h2>
          <button onClick={onClose} className="text-warm-muted hover:text-warm-dark text-xl leading-none">&times;</button>
        </div>

        {/* Presets */}
        <div className="mb-4">
          <p className="text-xs text-warm-muted font-body mb-2">快捷预设</p>
          <div className="flex flex-wrap gap-2">
            {presetEntries.map(([key]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className="px-3 py-1.5 text-xs font-body rounded-lg bg-cream hover:bg-warm-border/50 text-warm-dark transition-colors"
              >
                {presetLabels[key] || key}
              </button>
            ))}
          </div>
        </div>

        {/* Endpoint */}
        <label className="block mb-3">
          <span className="text-xs text-warm-muted font-body">API 端点</span>
          <input
            type="url"
            value={endpoint}
            onChange={e => { setEndpoint(e.target.value); setTestResult(null); }}
            placeholder="https://api.openai.com/v1"
            className="mt-1 w-full px-3 py-2 text-sm font-body rounded-lg border border-warm-border bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/30 text-warm-dark"
          />
        </label>

        {/* API Key */}
        <label className="block mb-3">
          <span className="text-xs text-warm-muted font-body">API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setTestResult(null); }}
            placeholder="sk-..."
            className="mt-1 w-full px-3 py-2 text-sm font-body rounded-lg border border-warm-border bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/30 text-warm-dark"
          />
        </label>

        {/* Model */}
        <label className="block mb-4">
          <span className="text-xs text-warm-muted font-body">模型名称</span>
          <input
            type="text"
            value={model}
            onChange={e => { setModel(e.target.value); setTestResult(null); }}
            placeholder="gpt-4o"
            className="mt-1 w-full px-3 py-2 text-sm font-body rounded-lg border border-warm-border bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/30 text-warm-dark"
          />
        </label>

        {/* Test result */}
        {testResult && (
          <p className={`text-xs font-body mb-3 ${testResult === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {testResult === 'success' ? '连接成功！' : '连接失败，请检查配置'}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !endpoint.trim() || !model.trim()}
            className="flex-1 px-4 py-2 text-sm font-body rounded-lg border border-warm-border text-warm-muted hover:bg-cream transition-colors disabled:opacity-40"
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={!endpoint.trim() || !model.trim()}
            className="flex-1 px-4 py-2 text-sm font-body rounded-lg bg-terracotta text-white hover:bg-terracotta/90 transition-colors disabled:opacity-40"
          >
            保存
          </button>
        </div>

        <p className="text-[10px] text-warm-muted/60 font-body mt-3 text-center">
          API Key 仅存储在本地浏览器中，不会上传到任何服务器
        </p>
      </div>
    </div>
  );
}
