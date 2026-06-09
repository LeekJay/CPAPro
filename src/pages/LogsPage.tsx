import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Code2Icon,
  DownloadIcon,
  EyeOffIcon,
  FileTextIcon,
  FileWarningIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TimerIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import { logsApi, type LogsQuery } from '@/services/api/logs';
import { versionApi } from '@/services/api/version';
import { copyToClipboard } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import { MANAGEMENT_API_PREFIX } from '@/utils/constants';
import { formatUnixTimestamp } from '@/utils/format';
import {
  HTTP_METHODS,
  STATUS_GROUPS,
  resolveStatusGroup,
  type LogState,
} from './hooks/logTypes';
import { parseLogLine } from './hooks/logParsing';
import { useLogFilters } from './hooks/useLogFilters';
import { isNearBottom, useLogScroller } from './hooks/useLogScroller';
import { cn } from '@/lib/utils';
import styles from './LogsPage.module.scss';

interface ErrorLogItem {
  name: string;
  size?: number;
  modified?: number;
}

// 初始只渲染最近 100 行，滚动到顶部再逐步加载更多（避免一次性渲染过多导致卡顿）
const INITIAL_DISPLAY_LINES = 100;
const MAX_BUFFER_LINES = 10000;
const LONG_PRESS_MS = 650;
const LONG_PRESS_MOVE_THRESHOLD = 10;

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err !== 'object' || err === null) return '';
  if (!('message' in err)) return '';

  const message = (err as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
};

const getErrorPayloadText = (err: unknown): string => {
  if (typeof err !== 'object' || err === null) return '';
  const payloads = [
    (err as { data?: unknown }).data,
    (err as { details?: unknown }).details
  ].filter((payload) => payload !== undefined);
  return payloads
    .map((payload) => {
      if (typeof payload === 'string') return payload;
      try {
        return JSON.stringify(payload);
      } catch {
        return '';
      }
    })
    .join(' ');
};

const isLoggingToFileDisabledError = (err: unknown): boolean => {
  const text = `${getErrorMessage(err)} ${getErrorPayloadText(err)}`.toLowerCase();
  return text.includes('logging to file disabled');
};

const formatFileSize = (size?: number): string => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
};

const getLevelBadgeClassName = (level?: string): string => {
  switch (level) {
    case 'warn':
      return styles.levelWarn;
    case 'error':
    case 'fatal':
      return styles.levelError;
    case 'debug':
    case 'trace':
      return styles.levelDebug;
    case 'info':
      return styles.levelInfo;
    default:
      return '';
  }
};

const getStatusBadgeClassName = (statusCode?: number): string => {
  if (typeof statusCode !== 'number') return '';
  if (statusCode >= 200 && statusCode < 300) return styles.statusSuccess;
  if (statusCode >= 300 && statusCode < 400) return styles.statusInfo;
  if (statusCode >= 400 && statusCode < 500) return styles.statusWarn;
  return styles.statusError;
};

type TabType = 'logs' | 'errors';

export function LogsPage() {
  const { t } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const serverRuntimeKind = useAuthStore((state) => state.serverRuntimeKind);
  const updateServerRuntimeKind = useAuthStore((state) => state.updateServerRuntimeKind);
  const config = useConfigStore((state) => state.config);
  const requestLogEnabled = config?.requestLog ?? false;
  const loggingToFileEnabled = config?.loggingToFile ?? false;
  const cpaNeedsFileLogging = serverRuntimeKind === 'cpa' && !loggingToFileEnabled;
  const isHomeRuntime = serverRuntimeKind === 'home';
  const [fileLoggingRequired, setFileLoggingRequired] = useState(false);
  const showFileLoggingRequired = cpaNeedsFileLogging || fileLoggingRequired;

  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logState, setLogState] = useState<LogState>({ buffer: [], visibleFrom: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useLocalStorage('logsPage.autoRefresh', false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [hideManagementLogs, setHideManagementLogs] = useLocalStorage(
    'logsPage.hideManagementLogs',
    true
  );
  const [showRawLogs, setShowRawLogs] = useLocalStorage('logsPage.showRawLogs', false);
  const [structuredFiltersExpanded, setStructuredFiltersExpanded] = useLocalStorage(
    'logsPage.structuredFiltersExpanded.v2',
    false
  );
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [errorLogsError, setErrorLogsError] = useState('');
  const [requestLogId, setRequestLogId] = useState<string | null>(null);
  const [requestLogDownloading, setRequestLogDownloading] = useState(false);

  const logScrollerRef = useRef<ReturnType<typeof useLogScroller> | null>(null);
  const requestLogHomeIpByIdRef = useRef<Record<string, string>>({});
  const longPressRef = useRef<{
    timer: number | null;
    startX: number;
    startY: number;
    fired: boolean;
  } | null>(null);
  const logRequestInFlightRef = useRef(false);
  const pendingFullReloadRef = useRef(false);

  // 保存最新游标用于增量获取
  const latestCursorRef = useRef<LogsQuery['after']>(undefined);

  const disableControls = connectionStatus !== 'connected';
  const refreshDisabled = disableControls || loading || cpaNeedsFileLogging;
  const autoRefreshDisabled = disableControls || showFileLoggingRequired;
  const clearDisabled = disableControls || showFileLoggingRequired || isHomeRuntime;

  const loadLogs = async (incremental = false) => {
    if (connectionStatus !== 'connected') {
      setLoading(false);
      return;
    }

    if (cpaNeedsFileLogging) {
      if (!incremental) {
        latestCursorRef.current = undefined;
        requestLogHomeIpByIdRef.current = {};
        setFileLoggingRequired(false);
        setLogState({ buffer: [], visibleFrom: 0 });
        setError('');
        setLoading(false);
      }
      return;
    }

    if (logRequestInFlightRef.current) {
      if (!incremental) {
        pendingFullReloadRef.current = true;
      }
      return;
    }

    logRequestInFlightRef.current = true;

    if (!incremental) {
      setLoading(true);
    }
    setError('');

    try {
      const scrollerInstance = logScrollerRef.current;
      const stickToBottom =
        !incremental || isNearBottom(scrollerInstance?.logViewerRef.current ?? null);
      if (stickToBottom) {
        scrollerInstance?.requestScrollToBottom();
      }

      const params: LogsQuery =
        incremental && latestCursorRef.current
          ? { after: latestCursorRef.current, limit: MAX_BUFFER_LINES }
          : { limit: MAX_BUFFER_LINES };
      const data = await logsApi.fetchLogs(params);
      setFileLoggingRequired(false);

      // 更新游标
      if (data.latestCursor) {
        latestCursorRef.current = data.latestCursor;
      } else if (!incremental) {
        latestCursorRef.current = undefined;
      }
      if (data.requestLogHomeIpById) {
        requestLogHomeIpByIdRef.current = incremental
          ? { ...requestLogHomeIpByIdRef.current, ...data.requestLogHomeIpById }
          : data.requestLogHomeIpById;
      } else if (!incremental) {
        requestLogHomeIpByIdRef.current = {};
      }

      const newLines = Array.isArray(data.lines) ? data.lines : [];

      if (incremental && newLines.length > 0) {
        // 增量更新：追加新日志并限制缓冲区大小（避免内存与渲染膨胀）
        setLogState((prev) => {
          const prevRenderedCount = prev.buffer.length - prev.visibleFrom;
          const combined = [...prev.buffer, ...newLines];
          const dropCount = Math.max(combined.length - MAX_BUFFER_LINES, 0);
          const buffer = dropCount > 0 ? combined.slice(dropCount) : combined;
          let visibleFrom = Math.max(prev.visibleFrom - dropCount, 0);

          // 若用户停留在底部（跟随最新日志），则保持“渲染窗口”大小不变，避免无限增长
          if (stickToBottom) {
            visibleFrom = Math.max(buffer.length - prevRenderedCount, 0);
          }

          return { buffer, visibleFrom };
        });
      } else if (!incremental) {
        // 全量加载：默认只渲染最后 100 行，向上滚动再展开更多
        const buffer = newLines.slice(-MAX_BUFFER_LINES);
        const visibleFrom = Math.max(buffer.length - INITIAL_DISPLAY_LINES, 0);
        setLogState({ buffer, visibleFrom });
      }
    } catch (err: unknown) {
      console.error('Failed to load logs:', err);
      if (isLoggingToFileDisabledError(err)) {
        if (!incremental) {
          latestCursorRef.current = undefined;
          requestLogHomeIpByIdRef.current = {};
          setFileLoggingRequired(true);
          setLogState({ buffer: [], visibleFrom: 0 });
          setError('');
        }
        return;
      }
      if (!incremental) {
        setError(getErrorMessage(err) || t('logs.load_error'));
      }
    } finally {
      if (!incremental) {
        setLoading(false);
      }
      logRequestInFlightRef.current = false;
      if (pendingFullReloadRef.current) {
        pendingFullReloadRef.current = false;
        void loadLogs(false);
      }
    }
  };

  useHeaderRefresh(() => loadLogs(false));

  const clearLogs = async () => {
    if (isHomeRuntime) {
      showNotification(t('logs.home_clear_unavailable'), 'warning');
      return;
    }
    if (cpaNeedsFileLogging) {
      showNotification(t('logs.cpa_file_logging_required'), 'warning');
      return;
    }
    if (fileLoggingRequired) {
      showNotification(t('logs.file_logging_required'), 'warning');
      return;
    }
    showConfirmation({
      title: t('logs.clear_confirm_title', { defaultValue: 'Clear Logs' }),
      message: t('logs.clear_confirm'),
      variant: 'danger',
      confirmText: t('common.confirm'),
      onConfirm: async () => {
        try {
          await logsApi.clearLogs();
          setLogState({ buffer: [], visibleFrom: 0 });
          latestCursorRef.current = undefined;
          requestLogHomeIpByIdRef.current = {};
          setFileLoggingRequired(false);
          showNotification(t('logs.clear_success'), 'success');
        } catch (err: unknown) {
          const message = getErrorMessage(err);
          showNotification(
            `${t('notification.delete_failed')}${message ? `: ${message}` : ''}`,
            'error'
          );
        }
      },
    });
  };

  const downloadLogs = () => {
    const text = logState.buffer.join('\n');
    downloadBlob({ filename: 'logs.txt', blob: new Blob([text], { type: 'text/plain' }) });
    showNotification(t('logs.download_success'), 'success');
  };

  const loadErrorLogs = async () => {
    if (connectionStatus !== 'connected') {
      setLoadingErrors(false);
      return;
    }
    if (isHomeRuntime) {
      setLoadingErrors(false);
      setErrorLogs([]);
      setErrorLogsError('');
      return;
    }

    setLoadingErrors(true);
    setErrorLogsError('');
    try {
      const res = await logsApi.fetchErrorLogs();
      // API 返回 { files: [...] }
      setErrorLogs(Array.isArray(res.files) ? res.files : []);
    } catch (err: unknown) {
      console.error('Failed to load error logs:', err);
      setErrorLogs([]);
      const message = getErrorMessage(err);
      setErrorLogsError(
        message ? `${t('logs.error_logs_load_error')}: ${message}` : t('logs.error_logs_load_error')
      );
    } finally {
      setLoadingErrors(false);
    }
  };

  const downloadErrorLog = async (name: string) => {
    try {
      const response = await logsApi.downloadErrorLog(name);
      downloadBlob({ filename: name, blob: new Blob([response.data], { type: 'text/plain' }) });
      showNotification(t('logs.error_log_download_success'), 'success');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    }
  };

  useEffect(() => {
    if (connectionStatus === 'connected') {
      latestCursorRef.current = undefined;
      requestLogHomeIpByIdRef.current = {};
      setFileLoggingRequired(false);
      loadLogs(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, loggingToFileEnabled]);

  useEffect(() => {
    if (connectionStatus !== 'connected' || serverRuntimeKind !== 'unknown') return;
    let cancelled = false;
    const detectRuntime = async () => {
      const runtimeKind = await versionApi.detectRuntimeKind();
      if (!cancelled && (runtimeKind === 'cpa' || runtimeKind === 'home')) {
        updateServerRuntimeKind(runtimeKind);
      }
    };
    void detectRuntime();
    return () => {
      cancelled = true;
    };
  }, [connectionStatus, serverRuntimeKind, updateServerRuntimeKind]);

  useEffect(() => {
    if (activeTab !== 'errors') return;
    if (connectionStatus !== 'connected') return;
    void loadErrorLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connectionStatus, requestLogEnabled]);

  useEffect(() => {
    if (!autoRefresh || connectionStatus !== 'connected' || showFileLoggingRequired) {
      return;
    }
    const id = window.setInterval(() => {
      loadLogs(true);
    }, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, connectionStatus, showFileLoggingRequired]);

  const visibleLines = useMemo(
    () => logState.buffer.slice(logState.visibleFrom),
    [logState.buffer, logState.visibleFrom]
  );

  const trimmedSearchQuery = deferredSearchQuery.trim();
  const isSearching = trimmedSearchQuery.length > 0;
  const baseLines = isSearching ? logState.buffer : visibleLines;

  const parsedSearchLines = useMemo(() => {
    let working = baseLines;

    if (hideManagementLogs) {
      working = working.filter((line) => !line.includes(MANAGEMENT_API_PREFIX));
    }

    if (trimmedSearchQuery) {
      const queryLowered = trimmedSearchQuery.toLowerCase();
      working = working.filter((line) => line.toLowerCase().includes(queryLowered));
    }

    return working.map((line) => parseLogLine(line));
  }, [baseLines, hideManagementLogs, trimmedSearchQuery]);

  const filters = useLogFilters({ parsedLines: parsedSearchLines });
  const structuredFiltersPanelId = 'logs-structured-filters';
  const structuredFilterCount =
    filters.methodFilters.length + filters.statusFilters.length + filters.pathFilters.length;

  const { filteredParsedLines, filteredLines, removedCount } = useMemo(() => {
    const filteredParsed = parsedSearchLines.filter((line) => {
      if (
        filters.methodFilterSet.size > 0 &&
        (!line.method || !filters.methodFilterSet.has(line.method))
      ) {
        return false;
      }

      const statusGroup = resolveStatusGroup(line.statusCode);
      if (
        filters.statusFilterSet.size > 0 &&
        (!statusGroup || !filters.statusFilterSet.has(statusGroup))
      ) {
        return false;
      }

      if (filters.pathFilterSet.size > 0 && (!line.path || !filters.pathFilterSet.has(line.path))) {
        return false;
      }

      return true;
    });

    return {
      filteredParsedLines: filteredParsed,
      filteredLines: filteredParsed.map((line) => line.raw),
      removedCount: Math.max(baseLines.length - filteredParsed.length, 0)
    };
  }, [
    baseLines,
    filters.methodFilterSet,
    filters.pathFilterSet,
    filters.statusFilterSet,
    parsedSearchLines
  ]);

  const parsedVisibleLines = useMemo(
    () => (showRawLogs ? [] : filteredParsedLines),
    [filteredParsedLines, showRawLogs]
  );

  const rawVisibleText = useMemo(() => filteredLines.join('\n'), [filteredLines]);

  const scroller = useLogScroller({
    logState,
    setLogState,
    loading,
    isSearching,
    filteredLineCount: filteredLines.length,
    hasStructuredFilters: filters.hasStructuredFilters,
    showRawLogs
  });

  logScrollerRef.current = scroller;

  const copyLogLine = async (raw: string) => {
    const ok = await copyToClipboard(raw);
    if (ok) {
      showNotification(t('logs.copy_success', { defaultValue: 'Copied to clipboard' }), 'success');
    } else {
      showNotification(t('logs.copy_failed', { defaultValue: 'Copy failed' }), 'error');
    }
  };

  const clearLongPressTimer = () => {
    if (longPressRef.current?.timer) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  };

  const startLongPress = (event: ReactPointerEvent<HTMLDivElement>, id?: string) => {
    if (!requestLogEnabled) return;
    if (!id) return;
    if (requestLogId) return;
    clearLongPressTimer();
    longPressRef.current = {
      timer: window.setTimeout(() => {
        setRequestLogId(id);
        if (longPressRef.current) {
          longPressRef.current.fired = true;
          longPressRef.current.timer = null;
        }
      }, LONG_PRESS_MS),
      startX: event.clientX,
      startY: event.clientY,
      fired: false,
    };
  };

  const cancelLongPress = () => {
    clearLongPressTimer();
    longPressRef.current = null;
  };

  const handleLongPressMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = longPressRef.current;
    if (!current || current.timer === null || current.fired) return;
    const deltaX = Math.abs(event.clientX - current.startX);
    const deltaY = Math.abs(event.clientY - current.startY);
    if (deltaX > LONG_PRESS_MOVE_THRESHOLD || deltaY > LONG_PRESS_MOVE_THRESHOLD) {
      cancelLongPress();
    }
  };

  const closeRequestLogModal = () => {
    if (requestLogDownloading) return;
    setRequestLogId(null);
  };

  const downloadRequestLog = async (id: string) => {
    setRequestLogDownloading(true);
    try {
      const response = await logsApi.downloadRequestLogById(
        id,
        requestLogHomeIpByIdRef.current[id]
      );
      downloadBlob({
        filename: `request-${id}.log`,
        blob: new Blob([response.data], { type: 'text/plain' })
      });
      showNotification(t('logs.request_log_download_success'), 'success');
      setRequestLogId(null);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      setRequestLogDownloading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (longPressRef.current?.timer) {
        window.clearTimeout(longPressRef.current.timer);
        longPressRef.current.timer = null;
      }
    };
  }, []);

  const renderEmptyState = (title: string, description: string, tone: 'default' | 'warning' = 'default') => {
    const EmptyIcon = tone === 'warning' ? FileWarningIcon : FileTextIcon;
    return (
      <Empty className={styles.emptyState}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <EmptyIcon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  };

  const logMetricItems = [
    {
      label: t('logs.metric_buffer', { defaultValue: '缓冲行数' }),
      value: logState.buffer.length,
    },
    {
      label: t('logs.metric_visible', { defaultValue: '当前显示' }),
      value: filteredLines.length,
    },
    {
      label: t('logs.metric_filtered', { defaultValue: '已过滤' }),
      value: removedCount,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>{t('logs.title')}</h1>
          <Badge variant="outline" className={styles.runtimeBadge}>
            {t(`logs.runtime_${serverRuntimeKind}`)}
          </Badge>
        </div>
        <div className={styles.metricsGrid}>
          {logMetricItems.map((item) => (
            <Card key={item.label} className={styles.metricCard}>
              <CardContent className={styles.metricCardContent}>
                <span className={styles.metricValue}>{item.value}</span>
                <span className={styles.metricLabel}>{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        className={styles.tabs}
      >
        <TabsList variant="line" className={styles.tabsList}>
          <TabsTrigger value="logs">{t('logs.log_content')}</TabsTrigger>
          <TabsTrigger value="errors">{t('logs.error_logs_modal_title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className={styles.tabContent}>
          <Card className={styles.workbenchCard}>
            <CardHeader className={styles.cardHeader}>
              <div className={styles.cardTitleBlock}>
                <CardTitle>{t('logs.log_content')}</CardTitle>
                <CardDescription>
                  {t('logs.loaded_lines', { count: filteredLines.length })}
                  {removedCount > 0
                    ? ` · ${t('logs.filtered_lines', { count: removedCount })}`
                    : ''}
                </CardDescription>
              </div>
              <CardAction className={styles.cardActions}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadLogs(false)}
                  disabled={refreshDisabled}
                >
                  <RefreshCwIcon data-icon="inline-start" className={loading ? styles.spinIcon : undefined} />
                  {t('logs.refresh_button')}
                </Button>
                <Field
                  orientation="horizontal"
                  className={styles.inlineSwitch}
                  data-disabled={autoRefreshDisabled}
                >
                  <Switch
                    id="logs-auto-refresh"
                    checked={autoRefresh}
                    onCheckedChange={setAutoRefresh}
                    disabled={autoRefreshDisabled}
                    size="sm"
                  />
                  <FieldLabel htmlFor="logs-auto-refresh" className={styles.switchLabel}>
                    <TimerIcon />
                    {t('logs.auto_refresh')}
                  </FieldLabel>
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadLogs}
                  disabled={logState.buffer.length === 0}
                >
                  <DownloadIcon data-icon="inline-start" />
                  {t('logs.download_button')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearLogs}
                  disabled={clearDisabled}
                >
                  <Trash2Icon data-icon="inline-start" />
                  {t('logs.clear_button')}
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent className={styles.cardContent}>
              {(showFileLoggingRequired || error) && (
                <div className={styles.alertStack}>
                  {showFileLoggingRequired && (
                    <Alert>
                      <AlertTriangleIcon />
                      <AlertTitle>
                        {t(
                          cpaNeedsFileLogging
                            ? 'logs.cpa_file_logging_required_title'
                            : 'logs.file_logging_required_title'
                        )}
                      </AlertTitle>
                      <AlertDescription>
                        {t(
                          cpaNeedsFileLogging
                            ? 'logs.cpa_file_logging_required'
                            : 'logs.file_logging_required'
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangleIcon />
                      <AlertTitle>{t('common.error', { defaultValue: '错误' })}</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className={styles.filterSurface}>
                <div className={styles.filterTopRow}>
                  <Field className={styles.searchWrapper}>
                    <FieldLabel className="sr-only">{t('logs.search_placeholder')}</FieldLabel>
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={t('logs.search_placeholder')}
                      className={styles.searchInput}
                      rightElement={
                        searchQuery ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSearchQuery('')}
                            aria-label={t('common.clear', { defaultValue: '清空' })}
                          >
                            <XIcon />
                          </Button>
                        ) : (
                          <SearchIcon className={styles.searchIcon} />
                        )
                      }
                    />
                  </Field>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.filterPanelToggle}
                    onClick={() => setStructuredFiltersExpanded((prev) => !prev)}
                    aria-expanded={structuredFiltersExpanded}
                    aria-controls={structuredFiltersPanelId}
                    title={
                      structuredFiltersExpanded
                        ? t('logs.filter_panel_collapse')
                        : t('logs.filter_panel_expand')
                    }
                  >
                    <SlidersHorizontalIcon data-icon="inline-start" />
                    {t('logs.filter_panel_title')}
                    {structuredFilterCount > 0 && (
                      <Badge variant="secondary">
                        {t('logs.filter_panel_active_count', { count: structuredFilterCount })}
                      </Badge>
                    )}
                    {structuredFiltersExpanded ? (
                      <ChevronUpIcon data-icon="inline-end" />
                    ) : (
                      <ChevronDownIcon data-icon="inline-end" />
                    )}
                  </Button>
                </div>

                {structuredFiltersExpanded && (
                  <FieldSet id={structuredFiltersPanelId} className={styles.structuredFilters}>
                    <FieldLegend className="sr-only">{t('logs.filter_panel_title')}</FieldLegend>
                    <FieldGroup className={styles.filterGroupStack}>
                      <Field orientation="responsive" className={styles.filterField}>
                        <FieldContent className={styles.filterFieldContent}>
                          <FieldTitle>{t('logs.filter_method')}</FieldTitle>
                        </FieldContent>
                        <ToggleGroup
                          type="multiple"
                          value={filters.methodFilters}
                          onValueChange={(value) =>
                            filters.setMethodFilters(value as typeof filters.methodFilters)
                          }
                          variant="outline"
                          size="sm"
                          spacing={1}
                          className={styles.filterToggleGroup}
                        >
                        {HTTP_METHODS.map((method) => {
                          const active = filters.methodFilters.includes(method);
                          const count = filters.methodCounts[method] ?? 0;
                          return (
                            <ToggleGroupItem
                              key={method}
                              value={method}
                              className={styles.filterToggleItem}
                              disabled={count === 0 && !active}
                            >
                              {method}
                              <Badge variant="outline">{count}</Badge>
                            </ToggleGroupItem>
                          );
                        })}
                        </ToggleGroup>
                      </Field>

                      <Field orientation="responsive" className={styles.filterField}>
                        <FieldContent className={styles.filterFieldContent}>
                          <FieldTitle>{t('logs.filter_status')}</FieldTitle>
                        </FieldContent>
                        <ToggleGroup
                          type="multiple"
                          value={filters.statusFilters}
                          onValueChange={(value) =>
                            filters.setStatusFilters(value as typeof filters.statusFilters)
                          }
                          variant="outline"
                          size="sm"
                          spacing={1}
                          className={styles.filterToggleGroup}
                        >
                        {STATUS_GROUPS.map((statusGroup) => {
                          const active = filters.statusFilters.includes(statusGroup);
                          const count = filters.statusCounts[statusGroup] ?? 0;
                          return (
                            <ToggleGroupItem
                              key={statusGroup}
                              value={statusGroup}
                              className={styles.filterToggleItem}
                              disabled={count === 0 && !active}
                            >
                              {t(`logs.filter_status_${statusGroup}`)}
                              <Badge variant="outline">{count}</Badge>
                            </ToggleGroupItem>
                          );
                        })}
                        </ToggleGroup>
                      </Field>

                      <Field orientation="responsive" className={styles.filterField}>
                        <FieldContent className={styles.filterFieldContent}>
                          <FieldTitle>{t('logs.filter_path')}</FieldTitle>
                        </FieldContent>
                        {filters.pathOptions.length === 0 ? (
                          <div className={styles.filterChipHint}>{t('logs.filter_path_empty')}</div>
                        ) : (
                          <ToggleGroup
                            type="multiple"
                            value={filters.pathFilters}
                            onValueChange={filters.setPathFilters}
                            variant="outline"
                            size="sm"
                            spacing={1}
                            className={styles.filterToggleGroup}
                          >
                            {filters.pathOptions.map(({ path, count }) => (
                              <ToggleGroupItem
                                key={path}
                                value={path}
                                className={cn(styles.filterToggleItem, styles.pathFilterToggleItem)}
                                title={path}
                              >
                                <span className={styles.filterChipText}>{path}</span>
                                <Badge variant="outline">{count}</Badge>
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        )}
                      </Field>
                    </FieldGroup>

                    <div className={styles.filterFooter}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={filters.clearStructuredFilters}
                        disabled={!filters.hasStructuredFilters}
                      >
                        {t('logs.clear_filters')}
                      </Button>
                    </div>
                  </FieldSet>
                )}

                <FieldGroup className={styles.switchGrid}>
                  <Field orientation="horizontal" className={styles.switchRow}>
                    <Switch
                      id="logs-hide-management"
                      checked={hideManagementLogs}
                      onCheckedChange={setHideManagementLogs}
                      size="sm"
                    />
                    <FieldLabel htmlFor="logs-hide-management" className={styles.switchLabel}>
                      <EyeOffIcon />
                      {t('logs.hide_management_logs', { prefix: MANAGEMENT_API_PREFIX })}
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className={styles.switchRow}>
                    <Switch
                      id="logs-show-raw"
                      checked={showRawLogs}
                      onCheckedChange={setShowRawLogs}
                      size="sm"
                    />
                    <FieldLabel
                      htmlFor="logs-show-raw"
                      className={styles.switchLabel}
                      title={t('logs.show_raw_logs_hint', {
                        defaultValue: 'Show original log text for easier multi-line copy',
                      })}
                    >
                      <Code2Icon />
                      {t('logs.show_raw_logs', { defaultValue: 'Show raw logs' })}
                    </FieldLabel>
                  </Field>
                </FieldGroup>
              </div>

              {loading ? (
                <div className={styles.skeletonStack}>
                  <Skeleton className={styles.skeletonLine} />
                  <Skeleton className={styles.skeletonLine} />
                  <Skeleton className={styles.skeletonPanel} />
                </div>
              ) : logState.buffer.length > 0 && filteredLines.length > 0 ? (
                <div
                  ref={scroller.logViewerRef}
                  className={styles.logPanel}
                  onScroll={scroller.handleLogScroll}
                >
                  {scroller.canLoadMore && (
                    <div className={styles.loadMoreBanner}>
                      <span>{t('logs.load_more_hint')}</span>
                      <div className={styles.loadMoreStats}>
                        <Badge variant="secondary">
                          {t('logs.loaded_lines', { count: filteredLines.length })}
                        </Badge>
                        {removedCount > 0 && (
                          <Badge variant="outline">
                            {t('logs.filtered_lines', { count: removedCount })}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {t('logs.hidden_lines', { count: logState.visibleFrom })}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {showRawLogs ? (
                    <pre className={styles.rawLog} spellCheck={false}>
                      {rawVisibleText}
                    </pre>
                  ) : (
                    <div className={styles.logList}>
                      {parsedVisibleLines.map((line, index) => {
                        const rowClassName = cn(
                          styles.logRow,
                          line.level === 'warn' && styles.rowWarn,
                          (line.level === 'error' || line.level === 'fatal') && styles.rowError
                        );
                        return (
                          <div
                            key={`${logState.visibleFrom + index}-${line.raw}`}
                            className={rowClassName}
                            onDoubleClick={() => {
                              void copyLogLine(line.raw);
                            }}
                            onPointerDown={(event) => startLongPress(event, line.requestId)}
                            onPointerUp={cancelLongPress}
                            onPointerLeave={cancelLongPress}
                            onPointerCancel={cancelLongPress}
                            onPointerMove={handleLongPressMove}
                            title={t('logs.double_click_copy_hint', {
                              defaultValue: 'Double-click to copy',
                            })}
                          >
                            <div className={styles.timestamp}>{line.timestamp || '-'}</div>
                            <div className={styles.rowMain}>
                              {line.level && (
                                <Badge
                                  variant="outline"
                                  className={cn(styles.logBadge, getLevelBadgeClassName(line.level))}
                                >
                                  {line.level.toUpperCase()}
                                </Badge>
                              )}

                              {line.source && (
                                <Badge variant="secondary" className={styles.sourceBadge} title={line.source}>
                                  {line.source}
                                </Badge>
                              )}

                              {line.requestId && (
                                <Badge variant="outline" className={styles.requestIdBadge} title={line.requestId}>
                                  {line.requestId}
                                </Badge>
                              )}

                              {typeof line.statusCode === 'number' && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    styles.statusBadge,
                                    getStatusBadgeClassName(line.statusCode)
                                  )}
                                >
                                  {line.statusCode}
                                </Badge>
                              )}

                              {line.latency && <Badge variant="outline">{line.latency}</Badge>}
                              {line.ip && <Badge variant="outline">{line.ip}</Badge>}

                              {line.method && (
                                <Badge variant="secondary" className={styles.methodBadge}>
                                  {line.method}
                                </Badge>
                              )}

                              {line.path && (
                                <span className={styles.path} title={line.path}>
                                  {line.path}
                                </span>
                              )}

                              {line.message && <span className={styles.message}>{line.message}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : logState.buffer.length > 0 ? (
                renderEmptyState(t('logs.search_empty_title'), t('logs.search_empty_desc'))
              ) : showFileLoggingRequired ? (
                renderEmptyState(
                  t(
                    cpaNeedsFileLogging
                      ? 'logs.cpa_file_logging_required_title'
                      : 'logs.file_logging_required_title'
                  ),
                  t(
                    cpaNeedsFileLogging
                      ? 'logs.cpa_file_logging_required_desc'
                      : 'logs.file_logging_required_desc'
                  ),
                  'warning'
                )
              ) : (
                renderEmptyState(t('logs.empty_title'), t('logs.empty_desc'))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className={styles.tabContent}>
          <Card className={styles.workbenchCard}>
            <CardHeader className={styles.cardHeader}>
              <div className={styles.cardTitleBlock}>
                <CardTitle>{t('logs.error_logs_modal_title')}</CardTitle>
                <CardDescription>{t('logs.error_logs_description')}</CardDescription>
              </div>
              <CardAction className={styles.cardActions}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadErrorLogs}
                  loading={loadingErrors}
                  disabled={disableControls}
                >
                  {t('common.refresh')}
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent className={styles.cardContent}>
              {(isHomeRuntime || (requestLogEnabled && !isHomeRuntime) || errorLogsError) && (
                <div className={styles.alertStack}>
                  {isHomeRuntime && (
                    <Alert>
                      <AlertTriangleIcon />
                      <AlertTitle>{t('logs.error_logs_modal_title')}</AlertTitle>
                      <AlertDescription>{t('logs.error_logs_home_unavailable')}</AlertDescription>
                    </Alert>
                  )}

                  {requestLogEnabled && !isHomeRuntime && (
                    <Alert>
                      <AlertTriangleIcon />
                      <AlertTitle>{t('logs.error_logs_modal_title')}</AlertTitle>
                      <AlertDescription>{t('logs.error_logs_request_log_enabled')}</AlertDescription>
                    </Alert>
                  )}

                  {errorLogsError && (
                    <Alert variant="destructive">
                      <AlertTriangleIcon />
                      <AlertTitle>{t('common.error', { defaultValue: '错误' })}</AlertTitle>
                      <AlertDescription>{errorLogsError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className={styles.errorPanel}>
                {loadingErrors ? (
                  <div className={styles.skeletonTable}>
                    <Skeleton className={styles.skeletonLine} />
                    <Skeleton className={styles.skeletonLine} />
                    <Skeleton className={styles.skeletonLine} />
                  </div>
                ) : errorLogs.length === 0 ? (
                  renderEmptyState(
                    t('logs.error_logs_empty'),
                    t('logs.error_logs_description')
                  )
                ) : (
                  <Table className={styles.errorLogTable}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.name', { defaultValue: '名称' })}</TableHead>
                        <TableHead>{t('common.size', { defaultValue: '大小' })}</TableHead>
                        <TableHead>{t('common.updated_at', { defaultValue: '更新时间' })}</TableHead>
                        <TableHead className={styles.tableActionHead}>
                          {t('common.actions', { defaultValue: '操作' })}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorLogs.map((item) => (
                        <TableRow key={item.name}>
                          <TableCell className={styles.errorLogNameCell}>
                            <FileTextIcon className={styles.fileIcon} />
                            <span title={item.name}>{item.name}</span>
                          </TableCell>
                          <TableCell>{formatFileSize(item.size) || '-'}</TableCell>
                          <TableCell>
                            {item.modified ? formatUnixTimestamp(item.modified) : '-'}
                          </TableCell>
                          <TableCell className={styles.tableActionCell}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadErrorLog(item.name)}
                              disabled={disableControls}
                            >
                              <DownloadIcon data-icon="inline-start" />
                              {t('logs.error_logs_download')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(requestLogId)}
        onOpenChange={(open) => {
          if (!open) closeRequestLogModal();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logs.request_log_download_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {requestLogId ? t('logs.request_log_download_confirm', { id: requestLogId }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={requestLogDownloading}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!requestLogId || requestLogDownloading}
              onClick={(event) => {
                event.preventDefault();
                if (requestLogId) {
                  void downloadRequestLog(requestLogId);
                }
              }}
            >
              {requestLogDownloading && <RefreshCwIcon data-icon="inline-start" className={styles.spinIcon} />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
