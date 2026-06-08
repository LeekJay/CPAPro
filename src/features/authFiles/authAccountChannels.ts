import type { OAuthProvider } from '@/services/api/oauth';

export type AuthAccountChannel = OAuthProvider | 'vertex';

export const AUTH_ACCOUNT_CHANNELS: Array<{
  id: AuthAccountChannel;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    id: 'codex',
    titleKey: 'auth_login.codex_oauth_title',
    descriptionKey: 'auth_login.codex_oauth_hint',
  },
  {
    id: 'anthropic',
    titleKey: 'auth_login.anthropic_oauth_title',
    descriptionKey: 'auth_login.anthropic_oauth_hint',
  },
  {
    id: 'antigravity',
    titleKey: 'auth_login.antigravity_oauth_title',
    descriptionKey: 'auth_login.antigravity_oauth_hint',
  },
  {
    id: 'gemini-cli',
    titleKey: 'auth_login.gemini_cli_oauth_title',
    descriptionKey: 'auth_login.gemini_cli_oauth_hint',
  },
  {
    id: 'kimi',
    titleKey: 'auth_login.kimi_oauth_title',
    descriptionKey: 'auth_login.kimi_oauth_hint',
  },
  {
    id: 'xai',
    titleKey: 'auth_login.xai_oauth_title',
    descriptionKey: 'auth_login.xai_oauth_hint',
  },
  {
    id: 'vertex',
    titleKey: 'vertex_import.title',
    descriptionKey: 'vertex_import.description',
  },
];
