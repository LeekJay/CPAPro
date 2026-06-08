import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '@/components/login-form';
import { useAuthStore, useLanguageStore, useNotificationStore } from '@/stores';
import { detectApiBaseFromLocation, normalizeApiBase } from '@/utils/connection';
import { isSupportedLanguage } from '@/utils/language';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import type { ApiError } from '@/types';

/**
 * 将 API 错误转换为本地化的用户友好消息
 */
type RedirectState = { from?: { pathname?: string } };

function getLocalizedErrorMessage(error: unknown, t: (key: string) => string): string {
  const apiError = error as Partial<ApiError>;
  const status = typeof apiError.status === 'number' ? apiError.status : undefined;
  const code = typeof apiError.code === 'string' ? apiError.code : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof apiError.message === 'string'
        ? apiError.message
        : typeof error === 'string'
          ? error
          : '';

  const withHttpStatus = (summary: string) => {
    if (!status) {
      return summary;
    }

    const genericAxiosMessage = `Request failed with status code ${status}`;
    const detail = message.trim();
    const backendDetail =
      detail && detail !== genericAxiosMessage
        ? ` (${t('login.error_backend_detail')}: ${detail})`
        : '';

    return `HTTP ${status}: ${summary}${backendDetail}`;
  };

  // 根据 HTTP 状态码判断
  if (status === 401) {
    return withHttpStatus(t('login.error_unauthorized'));
  }
  if (status === 403) {
    return withHttpStatus(t('login.error_forbidden'));
  }
  if (status === 404) {
    return withHttpStatus(t('login.error_not_found'));
  }
  if (status && status >= 500) {
    return withHttpStatus(t('login.error_server'));
  }

  // 根据 axios 错误码判断
  if (code === 'ECONNABORTED' || message.toLowerCase().includes('timeout')) {
    return t('login.error_timeout');
  }
  if (code === 'ERR_NETWORK' || message.toLowerCase().includes('network error')) {
    return t('login.error_network');
  }
  if (code === 'ERR_CERT_AUTHORITY_INVALID' || message.toLowerCase().includes('certificate')) {
    return t('login.error_ssl');
  }

  // 检查 CORS 错误
  if (message.toLowerCase().includes('cors') || message.toLowerCase().includes('cross-origin')) {
    return t('login.error_cors');
  }

  // 默认错误消息
  return withHttpStatus(t('login.error_invalid'));
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotificationStore();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const storedBase = useAuthStore((state) => state.apiBase);
  const storedKey = useAuthStore((state) => state.managementKey);
  const storedRememberPassword = useAuthStore((state) => state.rememberPassword);

  const [apiBase, setApiBase] = useState('');
  const [managementKey, setManagementKey] = useState('');
  const [showCustomBase, setShowCustomBase] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(true);
  const [autoLoginSuccess, setAutoLoginSuccess] = useState(false);
  const [error, setError] = useState('');

  const detectedBase = useMemo(() => detectApiBaseFromLocation(), []);
  const handleLanguageChange = useCallback(
    (selectedLanguage: string) => {
      if (!isSupportedLanguage(selectedLanguage)) {
        return;
      }
      setLanguage(selectedLanguage);
    },
    [setLanguage]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const autoLoggedIn = await restoreSession();
        if (autoLoggedIn) {
          setAutoLoginSuccess(true);
          // 延迟跳转，让用户看到成功动画
          setTimeout(() => {
            const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
            navigate(redirect, { replace: true });
          }, 1500);
        } else {
          setApiBase(storedBase || detectedBase);
          setManagementKey(storedKey || '');
          setRememberPassword(storedRememberPassword || Boolean(storedKey));
        }
      } finally {
        if (!autoLoginSuccess) {
          setAutoLoading(false);
        }
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!managementKey.trim()) {
      setError(t('login.error_required'));
      return;
    }

    const baseToUse = apiBase ? normalizeApiBase(apiBase) : detectedBase;
    setLoading(true);
    setError('');
    try {
      await login({
        apiBase: baseToUse,
        managementKey: managementKey.trim(),
        rememberPassword
      });
      showNotification(t('common.connected_status'), 'success');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = getLocalizedErrorMessage(err, t);
      setError(message);
      showNotification(`${t('notification.login_failed')}: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiBase, detectedBase, login, managementKey, navigate, rememberPassword, showNotification, t]);

  if (isAuthenticated && !autoLoading && !autoLoginSuccess) {
    const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
    return <Navigate to={redirect} replace />;
  }

  // 显示启动动画（自动登录中或自动登录成功）
  const showSplash = autoLoading || autoLoginSuccess;

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[0.92fr_1.08fr]">
      <div className="flex min-h-svh flex-col bg-background p-5 sm:p-8 lg:p-10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <img src={INLINE_LOGO_JPEG} alt="CPAPro" className="size-8 rounded-lg object-cover" />
          <span>{t('title.abbr')}</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-10 lg:py-12">
          {showSplash ? (
            <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
              <img src={INLINE_LOGO_JPEG} alt="CPAPro" className="size-16 rounded-2xl object-cover" />
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">{t('splash.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('splash.subtitle')}</p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 rounded-full bg-primary" />
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[420px] rounded-lg border bg-card p-6 shadow-sm sm:p-7">
              <LoginForm
                apiBase={apiBase}
                detectedBase={detectedBase}
                error={error}
                language={language}
                loading={loading}
                managementKey={managementKey}
                rememberPassword={rememberPassword}
                showCustomBase={showCustomBase}
                showKey={showKey}
                onApiBaseChange={setApiBase}
                onLanguageChange={handleLanguageChange}
                onManagementKeyChange={setManagementKey}
                onRememberPasswordChange={setRememberPassword}
                onShowCustomBaseChange={setShowCustomBase}
                onToggleShowKey={() => setShowKey((prev) => !prev)}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </div>
      </div>

      <div className="hidden min-h-svh border-l bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex w-full flex-col justify-between gap-10 p-10 xl:p-12">
          <div className="flex items-center gap-3">
            <img src={INLINE_LOGO_JPEG} alt="CPAPro" className="size-10 rounded-lg object-cover" />
            <div className="grid text-sm leading-tight">
              <span className="font-semibold">{t('title.abbr')}</span>
              <span className="text-xs text-muted-foreground">CLIProxyAPI panel</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[620px]">
            <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
              <div className="flex h-11 items-center gap-2 border-b bg-muted/40 px-4">
                <div className="size-2 rounded-full bg-destructive" />
                <div className="size-2 rounded-full bg-muted-foreground/50" />
                <div className="size-2 rounded-full bg-primary" />
                <div className="ml-3 h-5 w-40 rounded-md bg-muted" />
              </div>
              <div className="grid min-h-[360px] grid-cols-[180px_1fr]">
                <div className="border-r bg-sidebar p-3">
                  <div className="mb-4 flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-2">
                    <img src={INLINE_LOGO_JPEG} alt="" className="size-7 rounded-md object-cover" />
                    <div className="h-3 w-20 rounded-sm bg-sidebar-foreground/20" />
                  </div>
                  {['', '', '', '', ''].map((_, index) => (
                    <div
                      key={index}
                      className="mb-2 flex h-8 items-center gap-2 rounded-md px-2"
                    >
                      <div className="size-4 rounded-sm bg-sidebar-foreground/15" />
                      <div className="h-2.5 w-24 rounded-sm bg-sidebar-foreground/15" />
                    </div>
                  ))}
                </div>
                <div className="p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="mb-2 h-5 w-36 rounded-sm bg-foreground/15" />
                      <div className="h-3 w-52 rounded-sm bg-muted" />
                    </div>
                    <div className="h-8 w-24 rounded-md border bg-card" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="rounded-lg border bg-card p-3">
                        <div className="mb-5 h-3 w-16 rounded-sm bg-muted" />
                        <div className="h-7 w-20 rounded-sm bg-foreground/15" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border bg-card p-4">
                    <div className="mb-4 h-3 w-28 rounded-sm bg-muted" />
                    <div className="flex flex-col gap-3">
                      {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="grid grid-cols-[1fr_72px_48px] gap-3">
                          <div className="h-3 rounded-sm bg-muted" />
                          <div className="h-3 rounded-sm bg-muted" />
                          <div className="h-3 rounded-sm bg-muted" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="text-4xl font-bold leading-tight tracking-normal xl:text-5xl">
              CPAPro
            </div>
            <p className="mt-3 text-base text-muted-foreground">
              CPAPro, a modern CLIProxyAPI panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
