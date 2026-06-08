import type { AuthFileItem } from '@/types';
import { normalizeStringValue, parseIdTokenPayload } from '@/utils/quota';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeEmailValue = (value: unknown): string | null => {
  const normalized = normalizeStringValue(value);
  if (!normalized) return null;
  const emailMatch = normalized.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
  const email = emailMatch?.[0]?.trim() ?? '';
  return EMAIL_PATTERN.test(email) ? email : null;
};

export const resolveAuthFileEmail = (file: AuthFileItem): string | null => {
  const metadata = isRecord(file.metadata) ? file.metadata : null;
  const attributes = isRecord(file.attributes) ? file.attributes : null;
  const account = isRecord(file.account) ? file.account : null;
  const user = isRecord(file.user) ? file.user : null;
  const profile = isRecord(file.profile) ? file.profile : null;
  const info = isRecord(file.info) ? file.info : null;
  const idTokenPayload = parseIdTokenPayload(file.id_token ?? metadata?.id_token ?? attributes?.id_token);

  const candidates = [
    file.email,
    file.account_email,
    file.accountEmail,
    file.user_email,
    file.userEmail,
    file.username,
    file.login,
    file.account,
    metadata?.email,
    metadata?.account_email,
    metadata?.accountEmail,
    metadata?.user_email,
    metadata?.userEmail,
    attributes?.email,
    attributes?.account_email,
    attributes?.accountEmail,
    attributes?.user_email,
    attributes?.userEmail,
    account?.email,
    account?.account_email,
    account?.user_email,
    account?.username,
    user?.email,
    user?.username,
    profile?.email,
    info?.email,
    idTokenPayload?.email,
  ];

  for (const candidate of candidates) {
    const email = normalizeEmailValue(candidate);
    if (email) return email;
  }

  return null;
};
