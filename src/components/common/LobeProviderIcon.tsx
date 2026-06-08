import type { CSSProperties, ComponentType } from 'react';
import AiStudioIcon from '@lobehub/icons/es/AiStudio/components/Mono';
import AmpIcon from '@lobehub/icons/es/Amp/components/Mono';
import AnthropicIcon from '@lobehub/icons/es/Anthropic/components/Mono';
import AntigravityIcon from '@lobehub/icons/es/Antigravity/components/Mono';
import ChatGLMIcon from '@lobehub/icons/es/ChatGLM/components/Mono';
import ClaudeIcon from '@lobehub/icons/es/Claude/components/Mono';
import CodexIcon from '@lobehub/icons/es/Codex/components/Mono';
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek/components/Mono';
import GeminiIcon from '@lobehub/icons/es/Gemini/components/Mono';
import GeminiCLIIcon from '@lobehub/icons/es/GeminiCLI/components/Mono';
import GrokIcon from '@lobehub/icons/es/Grok/components/Mono';
import IFlyTekCloudIcon from '@lobehub/icons/es/IFlyTekCloud/components/Mono';
import KimiIcon from '@lobehub/icons/es/Kimi/components/Mono';
import MinimaxIcon from '@lobehub/icons/es/Minimax/components/Mono';
import OpenAIIcon from '@lobehub/icons/es/OpenAI/components/Mono';
import QwenIcon from '@lobehub/icons/es/Qwen/components/Mono';
import VertexAIIcon from '@lobehub/icons/es/VertexAI/components/Mono';
import XAIIcon from '@lobehub/icons/es/XAI/components/Mono';
import { cn } from '@/lib/utils';

type MonoIconComponent = ComponentType<{
  'aria-hidden'?: boolean;
  className?: string;
  role?: string;
  size?: number | string;
  style?: CSSProperties;
}>;

const PROVIDER_ICON_MAP: Record<string, MonoIconComponent> = {
  aistudio: AiStudioIcon,
  ai_studio: AiStudioIcon,
  'ai-studio': AiStudioIcon,
  amp: AmpIcon,
  ampcode: AmpIcon,
  anthropic: AnthropicIcon,
  antigravity: AntigravityIcon,
  chatglm: ChatGLMIcon,
  glm: ChatGLMIcon,
  zhipu: ChatGLMIcon,
  claude: ClaudeIcon,
  codex: CodexIcon,
  deepseek: DeepSeekIcon,
  gemini: GeminiIcon,
  'gemini-cli': GeminiCLIIcon,
  geminicli: GeminiCLIIcon,
  grok: GrokIcon,
  iflytekcloud: IFlyTekCloudIcon,
  spark: IFlyTekCloudIcon,
  kimi: KimiIcon,
  minimax: MinimaxIcon,
  openai: OpenAIIcon,
  openaicompatibility: OpenAIIcon,
  'openai-compatibility': OpenAIIcon,
  gpt: OpenAIIcon,
  qwen: QwenIcon,
  vertex: VertexAIIcon,
  vertexai: VertexAIIcon,
  'vertex-ai': VertexAIIcon,
  xai: XAIIcon,
  'x-ai': XAIIcon,
};

export interface LobeProviderIconProps {
  className?: string;
  fallbackLabel?: string;
  provider?: string | null;
  size?: number | string;
  style?: CSSProperties;
  title?: string;
}

export const normalizeLobeProviderKey = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

export function hasLobeProviderIcon(provider?: string | null): boolean {
  return Boolean(PROVIDER_ICON_MAP[normalizeLobeProviderKey(provider)]);
}

export function LobeProviderIcon({
  className,
  fallbackLabel,
  provider,
  size = 20,
  style,
  title,
}: LobeProviderIconProps) {
  const key = normalizeLobeProviderKey(provider);
  const Icon = PROVIDER_ICON_MAP[key];

  if (Icon) {
    return (
      <Icon
        aria-hidden={title ? undefined : true}
        className={className}
        role={title ? 'img' : undefined}
        size={size}
        style={style}
      />
    );
  }

  const label = (fallbackLabel || key || '?').trim().slice(0, 1).toUpperCase();
  return (
    <span
      aria-hidden={title ? undefined : true}
      className={cn(className)}
      role={title ? 'img' : undefined}
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        flex: 'none',
        fontSize: typeof size === 'number' ? Math.max(10, Math.round(size * 0.62)) : '0.7em',
        fontWeight: 700,
        height: size,
        justifyContent: 'center',
        lineHeight: 1,
        width: size,
        ...style,
      }}
    >
      {label}
    </span>
  );
}
