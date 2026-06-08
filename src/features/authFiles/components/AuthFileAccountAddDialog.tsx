import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { LobeProviderIcon } from '@/components/common/LobeProviderIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn-dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useNotificationStore } from '@/stores';
import { oauthApi, type OAuthProvider } from '@/services/api/oauth';
import { vertexApi, type VertexImportResponse } from '@/services/api/vertex';
import { copyToClipboard } from '@/utils/clipboard';
import {
  AUTH_ACCOUNT_CHANNELS,
  type AuthAccountChannel,
} from '@/features/authFiles/authAccountChannels';
import styles from './AuthFileAccountAddDialog.module.scss';

interface ProviderState {
  url?: string;
  state?: string;
  status?: 'idle' | 'waiting' | 'success' | 'error';
  error?: string;
  polling?: boolean;
  projectId?: string;
  callbackUrl?: string;
  callbackSubmitting?: boolean;
  callbackStatus?: 'success' | 'error';
  callbackError?: string;
}

interface VertexImportResult {
  projectId?: string;
  email?: string;
  location?: string;
  authFile?: string;
}

interface VertexImportState {
  file?: File;
  fileName: string;
  location: string;
  loading: boolean;
  result?: VertexImportResult;
}

interface AuthFileAccountAddDialogProps {
  open: boolean;
  channel: AuthAccountChannel;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void | Promise<void>;
}

const CALLBACK_SUPPORTED: OAuthProvider[] = [
  'codex',
  'anthropic',
  'antigravity',
  'gemini-cli',
  'xai',
];
const XAI_CALLBACK_URL = 'http://127.0.0.1:56121/callback';
const SUCCESS_RESET_DELAY_MS = 5000;

const isOAuthProvider = (value: AuthAccountChannel): value is OAuthProvider => value !== 'vertex';

const getProviderI18nPrefix = (provider: OAuthProvider) => provider.replace('-', '_');
const getAuthKey = (provider: OAuthProvider, suffix: string) =>
  `auth_login.${getProviderI18nPrefix(provider)}_${suffix}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return typeof error === 'string' ? error : '';
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (!isRecord(error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
};

const isAbsoluteUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const readQueryLikeCallbackInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const queryStart = trimmed.indexOf('?');
  const hashStart = trimmed.indexOf('#');
  const rawParams =
    queryStart >= 0
      ? trimmed.slice(queryStart + 1)
      : hashStart >= 0
        ? trimmed.slice(hashStart + 1)
        : trimmed;

  if (!/(^|[&#?])(code|state|error)=/i.test(rawParams)) return null;
  return new URLSearchParams(rawParams.replace(/^[?#]/, ''));
};

const extractDisplayedXaiCode = (value: string): string => {
  const trimmed = value.trim();
  const codeMatch = trimmed.match(/\bcode\s*[:=]\s*([^\s&]+)/i);
  return (codeMatch?.[1] ?? trimmed).trim();
};

const buildXaiCallbackUrl = (input: string, state?: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isAbsoluteUrl(trimmed)) return trimmed;

  const params = readQueryLikeCallbackInput(trimmed);
  if (params) {
    const code = params.get('code')?.trim();
    const error = params.get('error')?.trim();
    const errorDescription = params.get('error_description')?.trim();
    const callbackState = params.get('state')?.trim() || state?.trim();
    if (!callbackState) return null;

    const callbackUrl = new URL(XAI_CALLBACK_URL);
    callbackUrl.searchParams.set('state', callbackState);
    if (code) callbackUrl.searchParams.set('code', code);
    if (error) callbackUrl.searchParams.set('error', error);
    if (errorDescription) callbackUrl.searchParams.set('error_description', errorDescription);
    return callbackUrl.toString();
  }

  const code = extractDisplayedXaiCode(trimmed);
  const callbackState = state?.trim();
  if (!code || !callbackState) return null;

  const callbackUrl = new URL(XAI_CALLBACK_URL);
  callbackUrl.searchParams.set('code', code);
  callbackUrl.searchParams.set('state', callbackState);
  return callbackUrl.toString();
};

const resolveCallbackUrl = (
  provider: OAuthProvider,
  input: string,
  state?: string
): string | null => {
  if (provider !== 'xai') return input.trim();
  return buildXaiCallbackUrl(input, state);
};

export function AuthFileAccountAddDialog({
  open,
  channel,
  onOpenChange,
  onCompleted,
}: AuthFileAccountAddDialogProps) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const [states, setStates] = useState<Record<OAuthProvider, ProviderState>>(
    {} as Record<OAuthProvider, ProviderState>
  );
  const [vertexState, setVertexState] = useState<VertexImportState>({
    fileName: '',
    location: '',
    loading: false,
  });
  const pollingTimers = useRef<Partial<Record<OAuthProvider, number>>>({});
  const successResetTimers = useRef<Partial<Record<OAuthProvider, number>>>({});
  const vertexFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedChannel =
    AUTH_ACCOUNT_CHANNELS.find((item) => item.id === channel) ?? AUTH_ACCOUNT_CHANNELS[0];

  const notifyCompleted = useCallback(() => {
    void onCompleted?.();
  }, [onCompleted]);

  const clearPollingTimer = useCallback((provider: OAuthProvider) => {
    const timer = pollingTimers.current[provider];
    if (timer !== undefined) {
      window.clearInterval(timer);
      delete pollingTimers.current[provider];
    }
  }, []);

  const clearSuccessResetTimer = useCallback((provider: OAuthProvider) => {
    const timer = successResetTimers.current[provider];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete successResetTimers.current[provider];
    }
  }, []);

  const clearProviderTimers = useCallback(
    (provider: OAuthProvider) => {
      clearPollingTimer(provider);
      clearSuccessResetTimer(provider);
    },
    [clearPollingTimer, clearSuccessResetTimer]
  );

  const clearTimers = useCallback(() => {
    Object.values(pollingTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearInterval(timer);
    });
    Object.values(successResetTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearTimeout(timer);
    });
    pollingTimers.current = {};
    successResetTimers.current = {};
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const updateProviderState = useCallback(
    (provider: OAuthProvider, next: Partial<ProviderState>) => {
      setStates((prev) => ({
        ...prev,
        [provider]: { ...(prev[provider] ?? {}), ...next },
      }));
    },
    []
  );

  const resetProviderAttempt = useCallback(
    (provider: OAuthProvider) => {
      clearProviderTimers(provider);
      setStates((prev) => {
        const current = prev[provider] ?? {};
        const next: ProviderState = {};
        if (provider === 'gemini-cli' && current.projectId !== undefined) {
          next.projectId = current.projectId;
        }
        return {
          ...prev,
          [provider]: next,
        };
      });
    },
    [clearProviderTimers]
  );

  const completeProviderAuth = useCallback(
    (provider: OAuthProvider) => {
      clearPollingTimer(provider);
      clearSuccessResetTimer(provider);
      updateProviderState(provider, {
        url: undefined,
        state: undefined,
        status: 'success',
        error: undefined,
        polling: false,
        callbackUrl: '',
        callbackSubmitting: false,
        callbackStatus: undefined,
        callbackError: undefined,
      });
      notifyCompleted();
      successResetTimers.current[provider] = window.setTimeout(() => {
        resetProviderAttempt(provider);
      }, SUCCESS_RESET_DELAY_MS);
    },
    [
      clearPollingTimer,
      clearSuccessResetTimer,
      notifyCompleted,
      resetProviderAttempt,
      updateProviderState,
    ]
  );

  const startPolling = useCallback(
    (provider: OAuthProvider, state: string) => {
      clearPollingTimer(provider);
      const timer = window.setInterval(async () => {
        try {
          const res = await oauthApi.getAuthStatus(state);
          if (res.status === 'ok') {
            completeProviderAuth(provider);
            showNotification(t(getAuthKey(provider, 'oauth_status_success')), 'success');
          } else if (res.status === 'error') {
            updateProviderState(provider, { status: 'error', error: res.error, polling: false });
            showNotification(
              `${t(getAuthKey(provider, 'oauth_status_error'))} ${res.error || ''}`.trim(),
              'error'
            );
            window.clearInterval(timer);
            delete pollingTimers.current[provider];
          }
        } catch (err: unknown) {
          const message = getErrorMessage(err);
          updateProviderState(provider, { status: 'error', error: message, polling: false });
          showNotification(
            `${t(getAuthKey(provider, 'oauth_status_error'))} ${message || ''}`.trim(),
            'error'
          );
          window.clearInterval(timer);
          delete pollingTimers.current[provider];
        }
      }, 3000);
      pollingTimers.current[provider] = timer;
    },
    [clearPollingTimer, completeProviderAuth, showNotification, t, updateProviderState]
  );

  const startAuth = useCallback(
    async (provider: OAuthProvider) => {
      clearProviderTimers(provider);
      const geminiState = provider === 'gemini-cli' ? states[provider] : undefined;
      const rawProjectId = provider === 'gemini-cli' ? (geminiState?.projectId || '').trim() : '';
      const projectId = rawProjectId
        ? rawProjectId.toUpperCase() === 'ALL'
          ? 'ALL'
          : rawProjectId
        : undefined;

      updateProviderState(provider, {
        url: undefined,
        state: undefined,
        status: 'waiting',
        polling: true,
        error: undefined,
        callbackStatus: undefined,
        callbackError: undefined,
        callbackUrl: '',
      });

      try {
        const res = await oauthApi.startAuth(
          provider,
          provider === 'gemini-cli' ? { projectId: projectId || undefined } : undefined
        );
        if (!res.state) {
          const message = t('auth_login.missing_state');
          updateProviderState(provider, {
            url: res.url,
            state: undefined,
            status: 'error',
            error: message,
            polling: false,
          });
          showNotification(message, 'error');
          return;
        }
        updateProviderState(provider, {
          url: res.url,
          state: res.state,
          status: 'waiting',
          polling: true,
        });
        startPolling(provider, res.state);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        updateProviderState(provider, { status: 'error', error: message, polling: false });
        showNotification(
          `${t(getAuthKey(provider, 'oauth_start_error'))}${message ? ` ${message}` : ''}`,
          'error'
        );
      }
    },
    [clearProviderTimers, showNotification, startPolling, states, t, updateProviderState]
  );

  const copyLink = useCallback(
    async (url?: string) => {
      if (!url) return;
      const copied = await copyToClipboard(url);
      showNotification(
        t(copied ? 'notification.link_copied' : 'notification.copy_failed'),
        copied ? 'success' : 'error'
      );
    },
    [showNotification, t]
  );

  const submitCallback = useCallback(
    async (provider: OAuthProvider) => {
      const callbackInput = (states[provider]?.callbackUrl || '').trim();
      if (!callbackInput) {
        showNotification(
          t(
            provider === 'xai'
              ? 'auth_login.xai_callback_required'
              : 'auth_login.oauth_callback_required'
          ),
          'warning'
        );
        return;
      }
      const redirectUrl = resolveCallbackUrl(provider, callbackInput, states[provider]?.state);
      if (!redirectUrl) {
        showNotification(
          t(
            provider === 'xai'
              ? 'auth_login.xai_callback_state_missing'
              : 'auth_login.missing_state'
          ),
          'warning'
        );
        return;
      }
      updateProviderState(provider, {
        callbackSubmitting: true,
        callbackStatus: undefined,
        callbackError: undefined,
      });
      try {
        await oauthApi.submitCallback(provider, redirectUrl);
        updateProviderState(provider, { callbackSubmitting: false, callbackStatus: 'success' });
        showNotification(t('auth_login.oauth_callback_success'), 'success');
      } catch (err: unknown) {
        const status = getErrorStatus(err);
        const message = getErrorMessage(err);
        const errorMessage =
          status === 404
            ? t('auth_login.oauth_callback_upgrade_hint', {
                defaultValue: 'Please update CLI Proxy API or check the connection.',
              })
            : message || undefined;
        updateProviderState(provider, {
          callbackSubmitting: false,
          callbackStatus: 'error',
          callbackError: errorMessage,
        });
        const notificationMessage = errorMessage
          ? `${t('auth_login.oauth_callback_error')} ${errorMessage}`
          : t('auth_login.oauth_callback_error');
        showNotification(notificationMessage, 'error');
      }
    },
    [showNotification, states, t, updateProviderState]
  );

  const handleVertexFilePick = () => {
    vertexFileInputRef.current?.click();
  };

  const handleVertexFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      showNotification(t('vertex_import.file_required'), 'warning');
      event.target.value = '';
      return;
    }
    setVertexState((prev) => ({
      ...prev,
      file,
      fileName: file.name,
      result: undefined,
    }));
    event.target.value = '';
  };

  const handleVertexImport = async () => {
    if (!vertexState.file) {
      showNotification(t('vertex_import.file_required'), 'warning');
      return;
    }
    const location = vertexState.location.trim();
    setVertexState((prev) => ({ ...prev, loading: true, result: undefined }));
    try {
      const res: VertexImportResponse = await vertexApi.importCredential(
        vertexState.file,
        location || undefined
      );
      const result: VertexImportResult = {
        projectId: res.project_id,
        email: res.email,
        location: res.location,
        authFile: res['auth-file'] ?? res.auth_file,
      };
      setVertexState((prev) => ({ ...prev, loading: false, result }));
      showNotification(t('vertex_import.success'), 'success');
      notifyCompleted();
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setVertexState((prev) => ({ ...prev, loading: false }));
      const notification = message
        ? `${t('notification.upload_failed')}: ${message}`
        : t('notification.upload_failed');
      showNotification(notification, 'error');
    }
  };

  const renderOAuthBody = (provider: OAuthProvider) => {
    const state = states[provider] || {};
    const canSubmitCallback = CALLBACK_SUPPORTED.includes(provider) && Boolean(state.url);
    const loginButtonLabel =
      state.status === 'success'
        ? t('auth_login.login_another_account')
        : t(getAuthKey(provider, 'oauth_button'));

    return (
      <FieldGroup className={styles.body}>
        {provider === 'gemini-cli' && (
          <Field>
            <FieldLabel htmlFor="auth-file-gemini-project-id">
              {t('auth_login.gemini_cli_project_id_label')}
            </FieldLabel>
            <Input
              id="auth-file-gemini-project-id"
              value={state.projectId || ''}
              disabled={Boolean(state.polling)}
              onChange={(event) =>
                updateProviderState(provider, {
                  projectId: event.target.value,
                })
              }
              placeholder={t('auth_login.gemini_cli_project_id_placeholder')}
            />
            <FieldDescription>{t('auth_login.gemini_cli_project_id_hint')}</FieldDescription>
          </Field>
        )}

        <div className={styles.actionRow}>
          <Button onClick={() => startAuth(provider)} loading={state.polling}>
            {loginButtonLabel}
          </Button>
          {state.status === 'waiting' && (
            <Badge variant="secondary">{t(getAuthKey(provider, 'oauth_status_waiting'))}</Badge>
          )}
          {state.status === 'success' && (
            <Badge variant="outline">{t(getAuthKey(provider, 'oauth_status_success'))}</Badge>
          )}
        </div>

        {state.url && (
          <Field>
            <FieldLabel htmlFor={`auth-file-${provider}-url`}>
              {t(getAuthKey(provider, 'oauth_url_label'))}
            </FieldLabel>
            <Input
              id={`auth-file-${provider}-url`}
              className={styles.urlInput}
              readOnly
              value={state.url}
            />
            <div className={styles.urlActions}>
              <Button variant="secondary" size="sm" onClick={() => copyLink(state.url)}>
                <CopyIcon data-icon="inline-start" />
                {t(getAuthKey(provider, 'copy_link'))}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(state.url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                {t(getAuthKey(provider, 'open_link'))}
              </Button>
            </div>
          </Field>
        )}

        {canSubmitCallback && (
          <Field>
            <FieldLabel htmlFor={`auth-file-${provider}-callback`}>
              {t(
                provider === 'xai'
                  ? 'auth_login.xai_callback_label'
                  : 'auth_login.oauth_callback_label'
              )}
            </FieldLabel>
            <Input
              id={`auth-file-${provider}-callback`}
              value={state.callbackUrl || ''}
              onChange={(event) =>
                updateProviderState(provider, {
                  callbackUrl: event.target.value,
                  callbackStatus: undefined,
                  callbackError: undefined,
                })
              }
              placeholder={t(
                provider === 'xai'
                  ? 'auth_login.xai_callback_placeholder'
                  : 'auth_login.oauth_callback_placeholder'
              )}
            />
            <FieldDescription>
              {t(
                provider === 'xai'
                  ? 'auth_login.xai_callback_hint'
                  : 'auth_login.oauth_callback_hint'
              )}
            </FieldDescription>
            <div className={styles.statusRow}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => submitCallback(provider)}
                loading={state.callbackSubmitting}
              >
                {t('auth_login.oauth_callback_button')}
              </Button>
              {state.callbackStatus === 'success' && state.status === 'waiting' && (
                <Badge variant="outline">{t('auth_login.oauth_callback_status_success')}</Badge>
              )}
            </div>
          </Field>
        )}
      </FieldGroup>
    );
  };

  const renderVertexBody = () => (
    <FieldGroup className={styles.body}>
      <Field>
        <FieldLabel htmlFor="auth-file-vertex-location">
          {t('vertex_import.location_label')}
        </FieldLabel>
        <Input
          id="auth-file-vertex-location"
          value={vertexState.location}
          onChange={(event) =>
            setVertexState((prev) => ({
              ...prev,
              location: event.target.value,
            }))
          }
          placeholder={t('vertex_import.location_placeholder')}
        />
        <FieldDescription>{t('vertex_import.location_hint')}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>{t('vertex_import.file_label')}</FieldLabel>
        <div className={styles.filePicker}>
          <Button variant="secondary" size="sm" onClick={handleVertexFilePick}>
            {t('vertex_import.choose_file')}
          </Button>
          <div
            className={`${styles.fileName} ${
              vertexState.fileName ? '' : styles.fileNamePlaceholder
            }`.trim()}
          >
            {vertexState.fileName || t('vertex_import.file_placeholder')}
          </div>
        </div>
        <FieldDescription>{t('vertex_import.file_hint')}</FieldDescription>
        <input
          ref={vertexFileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleVertexFileChange}
        />
      </Field>

      {vertexState.result && (
        <div className={styles.resultGrid} aria-label={t('vertex_import.result_title')}>
          {vertexState.result.projectId && (
            <>
              <span className={styles.resultKey}>{t('vertex_import.result_project')}</span>
              <span className={styles.resultValue}>{vertexState.result.projectId}</span>
            </>
          )}
          {vertexState.result.email && (
            <>
              <span className={styles.resultKey}>{t('vertex_import.result_email')}</span>
              <span className={styles.resultValue}>{vertexState.result.email}</span>
            </>
          )}
          {vertexState.result.location && (
            <>
              <span className={styles.resultKey}>{t('vertex_import.result_location')}</span>
              <span className={styles.resultValue}>{vertexState.result.location}</span>
            </>
          )}
          {vertexState.result.authFile && (
            <>
              <span className={styles.resultKey}>{t('vertex_import.result_file')}</span>
              <span className={styles.resultValue}>{vertexState.result.authFile}</span>
            </>
          )}
        </div>
      )}
    </FieldGroup>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>
            <span className={styles.dialogTitle}>
              <LobeProviderIcon
                provider={selectedChannel.id}
                className={styles.titleIcon}
                fallbackLabel={t(selectedChannel.titleKey)}
              />
              {t(selectedChannel.titleKey)}
            </span>
          </DialogTitle>
          <DialogDescription>{t(selectedChannel.descriptionKey)}</DialogDescription>
        </DialogHeader>

        {isOAuthProvider(channel) ? renderOAuthBody(channel) : renderVertexBody()}

        {channel === 'vertex' && (
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleVertexImport} loading={vertexState.loading}>
              {t('vertex_import.import_button')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
