import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpenIcon,
  CheckCircle2Icon,
  CodeIcon,
  ExternalLinkIcon,
  InfoIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { LobeProviderIcon } from '@/components/common/LobeProviderIcon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn-dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAuthStore,
  useConfigStore,
  useNotificationStore,
  useModelsStore,
} from '@/stores';
import { configApi, versionApi } from '@/services/api';
import { apiKeysApi } from '@/services/api/apiKeys';
import { classifyModels } from '@/utils/models';
import { STORAGE_KEY_AUTH } from '@/utils/constants';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import styles from './SystemPage.module.scss';

const parseVersionSegments = (version?: string | null) => {
  if (!version) return null;
  const cleaned = version.trim().replace(/^v/i, '');
  if (!cleaned) return null;
  const parts = cleaned
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
    .filter(Number.isFinite);
  return parts.length ? parts : null;
};

const compareVersions = (latest?: string | null, current?: string | null) => {
  const latestParts = parseVersionSegments(latest);
  const currentParts = parseVersionSegments(current);
  if (!latestParts || !currentParts) return null;
  const length = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < length; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return 1;
    if (l < c) return -1;
  }
  return 0;
};

const SYSTEM_PAGE_TABS = ['overview', 'models', 'links'] as const;
type SystemPageTab = (typeof SYSTEM_PAGE_TABS)[number];

function isSystemPageTab(value: string | null): value is SystemPageTab {
  return Boolean(value && SYSTEM_PAGE_TABS.includes(value as SystemPageTab));
}

export function SystemPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showNotification, showConfirmation } = useNotificationStore();
  const auth = useAuthStore();
  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);
  const updateConfigValue = useConfigStore((state) => state.updateConfigValue);

  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const modelsError = useModelsStore((state) => state.error);
  const fetchModelsFromStore = useModelsStore((state) => state.fetchModels);

  const [modelStatus, setModelStatus] = useState<{
    type: 'success' | 'warning' | 'error' | 'muted';
    message: string;
  }>();
  const [requestLogModalOpen, setRequestLogModalOpen] = useState(false);
  const [requestLogDraft, setRequestLogDraft] = useState(false);
  const [requestLogTouched, setRequestLogTouched] = useState(false);
  const [requestLogSaving, setRequestLogSaving] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(false);

  const apiKeysCache = useRef<string[]>([]);
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastModelsErrorNotificationRef = useRef('');

  const otherLabel = useMemo(
    () => (i18n.language?.toLowerCase().startsWith('zh') ? '其他' : 'Other'),
    [i18n.language]
  );
  const groupedModels = useMemo(() => classifyModels(models, { otherLabel }), [models, otherLabel]);
  const modelRows = useMemo(
    () =>
      groupedModels.flatMap((group) =>
        group.items.map((model) => ({
          ...model,
          providerId: group.id,
          providerLabel: group.label,
        }))
      ),
    [groupedModels]
  );
  const pageTabParam = searchParams.get('tab');
  const activePageTab: SystemPageTab = isSystemPageTab(pageTabParam) ? pageTabParam : 'overview';
  const requestLogEnabled = config?.requestLog ?? false;
  const requestLogDirty = requestLogDraft !== requestLogEnabled;
  const canEditRequestLog = auth.connectionStatus === 'connected' && Boolean(config);

  const appVersion = __APP_VERSION__ || t('system_info.version_unknown');
  const apiVersion = auth.serverVersion || t('system_info.version_unknown');
  const buildTime = auth.serverBuildDate
    ? new Date(auth.serverBuildDate).toLocaleString(i18n.language)
    : t('system_info.version_unknown');

  const normalizeApiKeyList = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const keys: string[] = [];

    input.forEach((item) => {
      const record =
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : null;
      const value =
        typeof item === 'string'
          ? item
          : record
            ? (record['api-key'] ?? record['apiKey'] ?? record.key ?? record.Key)
            : '';
      const trimmed = String(value ?? '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      keys.push(trimmed);
    });

    return keys;
  };

  const resolveApiKeysForModels = useCallback(async () => {
    if (apiKeysCache.current.length) {
      return apiKeysCache.current;
    }

    const configKeys = normalizeApiKeyList(config?.apiKeys);
    if (configKeys.length) {
      apiKeysCache.current = configKeys;
      return configKeys;
    }

    try {
      const list = await apiKeysApi.list();
      const normalized = normalizeApiKeyList(list);
      if (normalized.length) {
        apiKeysCache.current = normalized;
      }
      return normalized;
    } catch (err) {
      console.warn('Auto loading API keys for models failed:', err);
      return [];
    }
  }, [config?.apiKeys]);

  const fetchModels = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
    if (auth.connectionStatus !== 'connected') {
      setModelStatus({
        type: 'warning',
        message: t('notification.connection_required'),
      });
      return;
    }

    if (!auth.apiBase) {
      showNotification(t('notification.connection_required'), 'warning');
      return;
    }

    if (forceRefresh) {
      apiKeysCache.current = [];
    }

    setModelStatus({ type: 'muted', message: t('system_info.models_loading') });
    try {
      const apiKeys = await resolveApiKeysForModels();
      const primaryKey = apiKeys[0];
      const list = await fetchModelsFromStore(auth.apiBase, primaryKey, forceRefresh);
      const hasModels = list.length > 0;
      setModelStatus({
        type: hasModels ? 'success' : 'warning',
        message: hasModels
          ? t('system_info.models_count', { count: list.length })
          : t('system_info.models_empty'),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      const suffix = message ? `: ${message}` : '';
      const text = `${t('system_info.models_error')}${suffix}`;
      setModelStatus({ type: 'error', message: text });
      showNotification(text, 'error');
    }
  };

  const handleClearLoginStorage = () => {
    showConfirmation({
      title: t('system_info.clear_login_title', { defaultValue: 'Clear Login Storage' }),
      message: t('system_info.clear_login_confirm'),
      variant: 'danger',
      confirmText: t('common.confirm'),
      onConfirm: () => {
        auth.logout();
        if (typeof localStorage === 'undefined') return;
        const keysToRemove = [STORAGE_KEY_AUTH, 'isLoggedIn', 'apiBase', 'apiUrl', 'managementKey'];
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        showNotification(t('notification.login_storage_cleared'), 'success');
      },
    });
  };

  const openRequestLogModal = useCallback(() => {
    setRequestLogTouched(false);
    setRequestLogDraft(requestLogEnabled);
    setRequestLogModalOpen(true);
  }, [requestLogEnabled]);

  const handleInfoVersionTap = useCallback(() => {
    versionTapCount.current += 1;
    if (versionTapTimer.current) {
      clearTimeout(versionTapTimer.current);
    }

    if (versionTapCount.current >= 7) {
      versionTapCount.current = 0;
      versionTapTimer.current = null;
      openRequestLogModal();
      return;
    }

    versionTapTimer.current = setTimeout(() => {
      versionTapCount.current = 0;
      versionTapTimer.current = null;
    }, 1500);
  }, [openRequestLogModal]);

  const handleRequestLogClose = useCallback(() => {
    setRequestLogModalOpen(false);
    setRequestLogTouched(false);
  }, []);

  const handleRequestLogSave = async () => {
    if (!canEditRequestLog) return;
    if (!requestLogDirty) {
      setRequestLogModalOpen(false);
      return;
    }

    const previous = requestLogEnabled;
    setRequestLogSaving(true);
    updateConfigValue('request-log', requestLogDraft);

    try {
      await configApi.updateRequestLog(requestLogDraft);
      clearCache('request-log');
      showNotification(t('notification.request_log_updated'), 'success');
      setRequestLogModalOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      updateConfigValue('request-log', previous);
      showNotification(
        `${t('notification.update_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      setRequestLogSaving(false);
    }
  };

  const handleVersionCheck = useCallback(async () => {
    setCheckingVersion(true);
    try {
      const data = await versionApi.checkLatest();
      const latestRaw = data?.['latest-version'] ?? data?.latest_version ?? data?.latest ?? '';
      const latest = typeof latestRaw === 'string' ? latestRaw : String(latestRaw ?? '');
      const comparison = compareVersions(latest, auth.serverVersion);

      if (!latest) {
        showNotification(t('system_info.version_check_error'), 'error');
        return;
      }

      if (comparison === null) {
        showNotification(t('system_info.version_current_missing'), 'warning');
        return;
      }

      if (comparison > 0) {
        showNotification(t('system_info.version_update_available', { version: latest }), 'warning');
      } else {
        showNotification(t('system_info.version_is_latest'), 'success');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      const suffix = message ? `: ${message}` : '';
      showNotification(`${t('system_info.version_check_error')}${suffix}`, 'error');
    } finally {
      setCheckingVersion(false);
    }
  }, [auth.serverVersion, showNotification, t]);

  useEffect(() => {
    fetchConfig().catch(() => {
      // ignore
    });
  }, [fetchConfig]);

  useEffect(() => {
    if (requestLogModalOpen && !requestLogTouched) {
      setRequestLogDraft(requestLogEnabled);
    }
  }, [requestLogModalOpen, requestLogTouched, requestLogEnabled]);

  useEffect(() => {
    return () => {
      if (versionTapTimer.current) {
        clearTimeout(versionTapTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.connectionStatus, auth.apiBase]);

  useEffect(() => {
    if (!modelsError) {
      lastModelsErrorNotificationRef.current = '';
      return;
    }

    if (lastModelsErrorNotificationRef.current === modelsError) return;
    lastModelsErrorNotificationRef.current = modelsError;
    showNotification(modelsError, 'error');
  }, [modelsError, showNotification]);

  const modelStatusTitle =
    modelStatus?.type === 'success'
      ? t('common.success')
      : modelStatus?.type === 'warning'
        ? t('common.warning')
        : modelStatus?.type === 'error'
          ? t('common.error')
          : t('common.info');

  const renderModelsSkeleton = () => (
    <div className={styles.modelsTable}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('system_info.models_column_provider')}</TableHead>
            <TableHead>{t('system_info.models_column_model')}</TableHead>
            <TableHead>{t('system_info.models_column_alias')}</TableHead>
            <TableHead>{t('system_info.models_column_description')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
      {Array.from({ length: 4 }, (_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton className={styles.modelSkeletonTitle} /></TableCell>
          <TableCell><Skeleton className={styles.modelSkeletonWide} /></TableCell>
          <TableCell><Skeleton className={styles.modelSkeletonSubtitle} /></TableCell>
          <TableCell><Skeleton className={styles.modelSkeletonTags} /></TableCell>
        </TableRow>
      ))}
        </TableBody>
      </Table>
    </div>
  );

  const handlePageTabChange = useCallback(
    (value: string) => {
      if (!isSystemPageTab(value)) return;

      const nextParams = new URLSearchParams(searchParams);
      if (value === 'overview') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', value);
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{t('system_info.title')}</h1>
      <Tabs value={activePageTab} onValueChange={handlePageTabChange} className={styles.pageTabs}>
        <TabsList variant="line" className={styles.pageTabsList}>
          <TabsTrigger value="overview">{t('system_info.tab_overview')}</TabsTrigger>
          <TabsTrigger value="models">{t('system_info.tab_models')}</TabsTrigger>
          <TabsTrigger value="links">{t('system_info.tab_links')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className={styles.pageTabContent}>
          <div className={styles.content}>
            <Card className={styles.aboutCard}>
              <CardContent className={styles.aboutContent}>
                <div className={styles.aboutHeader}>
                  <img src={INLINE_LOGO_JPEG} alt="CPAPro" className={styles.aboutLogo} />
                  <div className={styles.aboutTitle}>{t('system_info.about_title')}</div>
                </div>

                <div className={styles.aboutInfoGrid}>
                  <button
                    type="button"
                    className={`${styles.infoTile} ${styles.tapTile}`}
                    onClick={handleInfoVersionTap}
                  >
                    <div className={styles.tileHeader}>
                      <div className={styles.tileLabel}>{t('footer.version')}</div>
                    </div>
                    <div className={styles.tileValue}>{appVersion}</div>
                  </button>

                  <div className={styles.infoTile}>
                    <div className={styles.tileHeader}>
                      <div className={styles.tileLabel}>{t('footer.api_version')}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={styles.tileAction}
                        onClick={() => void handleVersionCheck()}
                        loading={checkingVersion}
                        title={t('system_info.version_check_button')}
                        aria-label={t('system_info.version_check_button')}
                      >
                        {t('system_info.version_check_button')}
                      </Button>
                    </div>
                    <div className={styles.tileValue}>{apiVersion}</div>
                  </div>

                  <div className={styles.infoTile}>
                    <div className={styles.tileLabel}>{t('footer.build_date')}</div>
                    <div className={styles.tileValue}>{buildTime}</div>
                  </div>

                  <div className={styles.infoTile}>
                    <div className={styles.tileLabel}>{t('connection.status')}</div>
                    <div className={styles.tileValue}>{t(`common.${auth.connectionStatus}_status`)}</div>
                    <div className={styles.tileSub}>{auth.apiBase || '-'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('system_info.clear_login_title')}</CardTitle>
                <CardDescription>{t('system_info.clear_login_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={styles.clearLoginActions}>
                  <Button variant="danger" onClick={handleClearLoginStorage}>
                    {t('system_info.clear_login_button')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className={styles.pageTabContent}>
          <Card>
            <CardHeader className={styles.cardHeaderRow}>
              <div>
                <CardTitle>{t('system_info.models_title')}</CardTitle>
                <CardDescription>{t('system_info.models_desc')}</CardDescription>
              </div>
              <CardAction>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchModels({ forceRefresh: true })}
                  loading={modelsLoading}
                >
                  {t('common.refresh')}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className={styles.modelsContent}>
              {modelStatus && modelStatus.type !== 'error' && (
                <div className={styles.statusLine}>
                  <Badge variant={modelStatus.type === 'warning' ? 'secondary' : 'outline'}>
                    {modelStatus.type === 'success' ? (
                      <CheckCircle2Icon data-icon="inline-start" />
                    ) : modelStatus.type === 'warning' ? (
                      <TriangleAlertIcon data-icon="inline-start" />
                    ) : (
                      <InfoIcon data-icon="inline-start" />
                    )}
                    {modelStatusTitle}
                  </Badge>
                  <span>{modelStatus.message}</span>
                </div>
              )}
              {modelsLoading ? (
                renderModelsSkeleton()
              ) : (
                <div className={styles.modelsTable}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('system_info.models_column_provider')}</TableHead>
                        <TableHead>{t('system_info.models_column_model')}</TableHead>
                        <TableHead>{t('system_info.models_column_alias')}</TableHead>
                        <TableHead>{t('system_info.models_column_description')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <Empty className={styles.tableEmptyState}>
                              <EmptyHeader>
                                <EmptyTitle>{t('system_info.models_empty')}</EmptyTitle>
                                <EmptyDescription>{t('system_info.models_desc')}</EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          </TableCell>
                        </TableRow>
                      ) : (
                        modelRows.map((model) => (
                          <TableRow key={`${model.providerId}-${model.name}-${model.alias ?? 'default'}`}>
                            <TableCell>
                              <div className={styles.providerCell}>
                                <LobeProviderIcon
                                  provider={model.providerId}
                                  size={18}
                                  className={styles.groupIcon}
                                  fallbackLabel={model.providerLabel}
                                />
                                <span>{model.providerLabel}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={styles.modelName}>{model.name}</span>
                            </TableCell>
                            <TableCell>
                              {model.alias ? (
                                <Badge variant="secondary">{model.alias}</Badge>
                              ) : (
                                <span className={styles.mutedCell}>-</span>
                              )}
                            </TableCell>
                            <TableCell className={styles.descriptionCell}>
                              {model.description || <span className={styles.mutedCell}>-</span>}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className={styles.pageTabContent}>
          <Card>
            <CardHeader>
              <CardTitle>{t('system_info.quick_links_title')}</CardTitle>
              <CardDescription>{t('system_info.quick_links_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={styles.quickLinks}>
                <a
                  href="https://github.com/router-for-me/CLIProxyAPI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkCard}
                >
                  <div className={`${styles.linkIcon} ${styles.github}`}>
                    <CodeIcon />
                  </div>
                  <div className={styles.linkContent}>
                    <div className={styles.linkTitle}>
                      {t('system_info.link_main_repo')}
                      <ExternalLinkIcon />
                    </div>
                    <div className={styles.linkDesc}>{t('system_info.link_main_repo_desc')}</div>
                  </div>
                </a>

                <a
                  href="https://github.com/CuzTeam/CPAPro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkCard}
                >
                  <div className={`${styles.linkIcon} ${styles.github}`}>
                    <CodeIcon />
                  </div>
                  <div className={styles.linkContent}>
                    <div className={styles.linkTitle}>
                      {t('system_info.link_webui_repo')}
                      <ExternalLinkIcon />
                    </div>
                    <div className={styles.linkDesc}>{t('system_info.link_webui_repo_desc')}</div>
                  </div>
                </a>

                <a
                  href="https://help.router-for.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkCard}
                >
                  <div className={`${styles.linkIcon} ${styles.docs}`}>
                    <BookOpenIcon />
                  </div>
                  <div className={styles.linkContent}>
                    <div className={styles.linkTitle}>
                      {t('system_info.link_docs')}
                      <ExternalLinkIcon />
                    </div>
                    <div className={styles.linkDesc}>{t('system_info.link_docs_desc')}</div>
                  </div>
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={requestLogModalOpen}
        onOpenChange={(open) => {
          if (!open) handleRequestLogClose();
        }}
      >
        <DialogContent className={styles.requestLogDialog}>
          <DialogHeader>
            <DialogTitle>{t('basic_settings.request_log_title')}</DialogTitle>
            <DialogDescription>{t('basic_settings.request_log_warning')}</DialogDescription>
          </DialogHeader>
        <div className={styles.requestLogModal}>
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>{t('common.warning')}</AlertTitle>
            <AlertDescription>{t('basic_settings.request_log_warning')}</AlertDescription>
          </Alert>
          <label className={styles.requestLogSwitchRow}>
            <span>{t('basic_settings.request_log_enable')}</span>
            <Switch
              checked={requestLogDraft}
              disabled={!canEditRequestLog || requestLogSaving}
              onCheckedChange={(value) => {
                setRequestLogDraft(value);
                setRequestLogTouched(true);
              }}
              aria-label={t('basic_settings.request_log_enable')}
            />
          </label>
        </div>
          <DialogFooter>
            <Button variant="secondary" onClick={handleRequestLogClose} disabled={requestLogSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleRequestLogSave}
              loading={requestLogSaving}
              disabled={!canEditRequestLog || !requestLogDirty}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
