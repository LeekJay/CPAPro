import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RefreshCwIcon } from 'lucide-react';
import { LobeProviderIcon } from '@/components/common/LobeProviderIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn-card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { resolveAuthFileEmail } from '@/features/authFiles/authFileMetadata';
import {
  getTypeLabel,
  normalizeProviderKey,
} from '@/features/authFiles/constants';
import { useNotificationStore, useQuotaStore } from '@/stores';
import type {
  AntigravityQuotaState,
  AuthFileItem,
  ClaudeQuotaState,
  CodexQuotaState,
  GeminiCliQuotaState,
  KimiQuotaState,
  XaiQuotaState,
} from '@/types';
import {
  formatKimiResetHint,
  formatQuotaResetTime,
  getStatusFromError,
} from '@/utils/quota';
import { QuotaProgressBar } from './QuotaCard';
import {
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  GEMINI_CLI_CONFIG,
  KIMI_CONFIG,
  XAI_CONFIG,
  type QuotaConfig,
  type QuotaStore,
} from './quotaConfigs';
import styles from '@/pages/QuotaPage.module.scss';

type QuotaState =
  | AntigravityQuotaState
  | ClaudeQuotaState
  | CodexQuotaState
  | GeminiCliQuotaState
  | KimiQuotaState
  | XaiQuotaState;

type QuotaUpdater<T> = T | ((prev: T) => T);
type QuotaSetter = (updater: QuotaUpdater<Record<string, QuotaState>>) => void;

type AnyQuotaConfig = Omit<
  QuotaConfig<QuotaState, unknown>,
  'buildSuccessState' | 'fetchQuota'
> & {
  buildSuccessState: (data: unknown) => QuotaState;
  fetchQuota: (file: AuthFileItem, t: TFunction) => Promise<unknown>;
};

type QuotaListRow = {
  id: string;
  config: AnyQuotaConfig;
  file: AuthFileItem;
  providerKey: string;
  providerLabel: string;
  email: string | null;
};

type QuotaSummary = {
  id: string;
  label: string;
  percent: number | null;
  percentLabel: string;
  amountLabel?: string | null;
  resetLabel?: string | null;
};

const MAX_QUOTA_ITEMS = 3;
const QUOTA_PROGRESS_HIGH_THRESHOLD = 70;
const QUOTA_PROGRESS_MEDIUM_THRESHOLD = 30;

const asAnyQuotaConfig = <TState, TData>(
  config: QuotaConfig<TState, TData>
): AnyQuotaConfig => config as unknown as AnyQuotaConfig;

const QUOTA_CONFIGS: AnyQuotaConfig[] = [
  asAnyQuotaConfig(CLAUDE_CONFIG),
  asAnyQuotaConfig(ANTIGRAVITY_CONFIG),
  asAnyQuotaConfig(CODEX_CONFIG),
  asAnyQuotaConfig(XAI_CONFIG),
  asAnyQuotaConfig(GEMINI_CLI_CONFIG),
  asAnyQuotaConfig(KIMI_CONFIG),
];

const clampPercent = (value: number | null): number | null => {
  if (value === null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
};

const formatPercentLabel = (percent: number | null) =>
  percent === null ? '--' : `${Math.round(percent)}%`;

const formatUsdFromCents = (cents: number | null): string => {
  if (cents === null) return '--';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

const formatXaiUsageAmount = (billing: NonNullable<XaiQuotaState['billing']>): string => {
  const used = formatUsdFromCents(billing.usedCents);
  const limit = formatUsdFromCents(billing.monthlyLimitCents);
  if (billing.monthlyLimitCents === null) return used;
  return `${used} / ${limit}`;
};

const getFileProviderKey = (file: AuthFileItem, fallback: string): string => {
  const rawType =
    typeof file.type === 'string'
      ? file.type
      : typeof file.provider === 'string'
        ? file.provider
        : fallback;
  return normalizeProviderKey(rawType);
};

const getQuotaSetter = (config: AnyQuotaConfig): QuotaSetter => {
  const setter = useQuotaStore.getState()[config.storeSetter];
  return setter as QuotaSetter;
};

const getQuotaSummaries = (
  providerType: string,
  quota: QuotaState,
  t: TFunction
): QuotaSummary[] => {
  if (quota.status !== 'success') return [];

  if (providerType === 'claude') {
    const state = quota as ClaudeQuotaState;
    return (state.windows ?? []).map((window) => {
      const used = clampPercent(window.usedPercent);
      const remaining = used === null ? null : 100 - used;
      const label = window.labelKey ? t(window.labelKey) : window.label;
      return {
        id: window.id,
        label,
        percent: remaining,
        percentLabel: formatPercentLabel(remaining),
        resetLabel: window.resetLabel,
      };
    });
  }

  if (providerType === 'antigravity') {
    const state = quota as AntigravityQuotaState;
    return (state.groups ?? []).map((group) => {
      const percent = clampPercent(group.remainingFraction * 100);
      return {
        id: group.id,
        label: group.label,
        percent,
        percentLabel: formatPercentLabel(percent),
        resetLabel: formatQuotaResetTime(group.resetTime),
      };
    });
  }

  if (providerType === 'codex') {
    const state = quota as CodexQuotaState;
    return (state.windows ?? []).map((window) => {
      const used = clampPercent(window.usedPercent);
      const remaining = used === null ? null : 100 - used;
      const label = window.labelKey
        ? t(window.labelKey, window.labelParams as Record<string, string | number>)
        : window.label;
      return {
        id: window.id,
        label,
        percent: remaining,
        percentLabel: formatPercentLabel(remaining),
        resetLabel: window.resetLabel,
      };
    });
  }

  if (providerType === 'xai') {
    const state = quota as XaiQuotaState;
    if (!state.billing) return [];
    const used = clampPercent(state.billing.usedPercent);
    const remaining = used === null ? null : 100 - used;
    return [
      {
        id: 'monthly-credits',
        label: t('xai_quota.monthly_credits'),
        percent: remaining,
        percentLabel: formatPercentLabel(remaining),
        amountLabel: formatXaiUsageAmount(state.billing),
        resetLabel: formatQuotaResetTime(state.billing.billingPeriodEnd),
      },
    ];
  }

  if (providerType === 'gemini-cli') {
    const state = quota as GeminiCliQuotaState;
    return (state.buckets ?? []).map((bucket) => {
      const percent =
        bucket.remainingFraction === null
          ? null
          : clampPercent(bucket.remainingFraction * 100);
      const amountLabel =
        bucket.remainingAmount === null || bucket.remainingAmount === undefined
          ? null
          : t('gemini_cli_quota.remaining_amount', { count: bucket.remainingAmount });
      return {
        id: bucket.id,
        label: bucket.label,
        percent,
        percentLabel: formatPercentLabel(percent),
        amountLabel,
        resetLabel: formatQuotaResetTime(bucket.resetTime),
      };
    });
  }

  if (providerType === 'kimi') {
    const state = quota as KimiQuotaState;
    return (state.rows ?? []).map((row) => {
      const remaining =
        row.limit > 0
          ? clampPercent(((row.limit - row.used) / row.limit) * 100)
          : row.used > 0
            ? 0
            : null;
      const label = row.labelKey
        ? t(row.labelKey, (row.labelParams ?? {}) as Record<string, string | number>)
        : (row.label ?? '');
      return {
        id: row.id,
        label,
        percent: remaining,
        percentLabel: formatPercentLabel(remaining),
        amountLabel: row.limit > 0 ? `${row.used} / ${row.limit}` : null,
        resetLabel: formatKimiResetHint(t, row.resetHint),
      };
    });
  }

  return [];
};

interface QuotaListTableProps {
  files: AuthFileItem[];
  loading: boolean;
  disabled: boolean;
}

export function QuotaListTable({ files, loading, disabled }: QuotaListTableProps) {
  const { t } = useTranslation();
  const quotaStore = useQuotaStore((state) => state) as QuotaStore;
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const rows = useMemo<QuotaListRow[]>(
    () =>
      files.flatMap((file) => {
        const config = QUOTA_CONFIGS.find((candidate) => candidate.filterFn(file));
        if (!config) return [];
        const providerKey = getFileProviderKey(file, config.type);
        return [
          {
            id: `${config.type}:${file.name}`,
            config,
            file,
            providerKey,
            providerLabel: getTypeLabel(t, providerKey),
            email: resolveAuthFileEmail(file),
          },
        ];
      }),
    [files, t]
  );

  useEffect(() => {
    if (loading) return;
    QUOTA_CONFIGS.forEach((config) => {
      const activeNames = new Set(
        rows.filter((row) => row.config.type === config.type).map((row) => row.file.name)
      );
      const setQuota = getQuotaSetter(config);
      setQuota((prev) => {
        let changed = false;
        const nextState: Record<string, QuotaState> = {};
        Object.entries(prev).forEach(([name, value]) => {
          if (activeNames.has(name)) {
            nextState[name] = value;
          } else {
            changed = true;
          }
        });
        return changed ? nextState : prev;
      });
    });
  }, [loading, rows]);

  const refreshRow = useCallback(
    async (row: QuotaListRow, notify = true): Promise<boolean> => {
      if (disabled || row.file.disabled) return false;
      const setQuota = getQuotaSetter(row.config);
      setQuota((prev) => ({
        ...prev,
        [row.file.name]: row.config.buildLoadingState(),
      }));

      try {
        const data = await row.config.fetchQuota(row.file, t);
        setQuota((prev) => ({
          ...prev,
          [row.file.name]: row.config.buildSuccessState(data),
        }));
        if (notify) {
          showNotification(
            t('auth_files.quota_refresh_success', { name: row.file.name }),
            'success'
          );
        }
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('common.unknown_error');
        const status = getStatusFromError(err);
        setQuota((prev) => ({
          ...prev,
          [row.file.name]: row.config.buildErrorState(message, status),
        }));
        if (notify) {
          showNotification(
            t('auth_files.quota_refresh_failed', { name: row.file.name, message }),
            'error'
          );
        }
        return false;
      }
    },
    [disabled, showNotification, t]
  );

  const handleRefreshAll = useCallback(async () => {
    if (disabled || rows.length === 0 || refreshingAll) return;
    setRefreshingAll(true);
    try {
      const results = await Promise.all(rows.map((row) => refreshRow(row, false)));
      const successCount = results.filter(Boolean).length;
      const failedCount = results.length - successCount;
      if (failedCount > 0) {
        showNotification(
          t('quota_management.refresh_all_partial', {
            success: successCount,
            failed: failedCount,
          }),
          'error'
        );
      } else {
        showNotification(t('quota_management.refresh_all_success', { count: successCount }), 'success');
      }
    } finally {
      setRefreshingAll(false);
    }
  }, [disabled, refreshRow, refreshingAll, rows, showNotification, t]);

  const renderQuotaCell = (row: QuotaListRow) => {
    const quota = row.config.storeSelector(quotaStore)[row.file.name] as QuotaState | undefined;
    const status = quota?.status ?? 'idle';

    if (status === 'loading') {
      return (
        <div className={styles.quotaListStack}>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className={styles.quotaListItem}>
              <div className={styles.quotaListItemHeader}>
                <Skeleton className={styles.quotaListLabelSkeleton} />
                <Skeleton className={styles.quotaListPercentSkeleton} />
              </div>
              <Skeleton className={styles.quotaListBarSkeleton} />
            </div>
          ))}
        </div>
      );
    }

    if (!quota || status === 'idle' || status === 'error') {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.quotaListRetryButton}
          onClick={() => void refreshRow(row)}
          disabled={disabled || row.file.disabled}
        >
          <RefreshCwIcon data-icon="inline-start" />
          {status === 'error'
            ? t('quota_management.retry_quota')
            : t('quota_management.card_idle_hint')}
        </Button>
      );
    }

    const summaries = getQuotaSummaries(row.config.type, quota, t);
    const visibleSummaries = summaries.slice(0, MAX_QUOTA_ITEMS);

    if (visibleSummaries.length === 0) {
      return <span className={styles.emptyValue}>{t('quota_management.no_quota')}</span>;
    }

    return (
      <div className={styles.quotaListStack}>
        {visibleSummaries.map((summary) => (
          <div key={summary.id} className={styles.quotaListItem}>
            <div className={styles.quotaListItemHeader}>
              <span className={styles.quotaListLabel} title={summary.label}>
                {summary.label}
              </span>
              <span className={styles.quotaListPercent}>
                {summary.percentLabel}
                {summary.amountLabel ? ` · ${summary.amountLabel}` : ''}
              </span>
            </div>
            <QuotaProgressBar
              percent={summary.percent}
              highThreshold={QUOTA_PROGRESS_HIGH_THRESHOLD}
              mediumThreshold={QUOTA_PROGRESS_MEDIUM_THRESHOLD}
            />
          </div>
        ))}
        {summaries.length > MAX_QUOTA_ITEMS && (
          <span className={styles.quotaListMore}>
            {t('quota_management.more_quota_items', {
              count: summaries.length - MAX_QUOTA_ITEMS,
            })}
          </span>
        )}
      </div>
    );
  };

  const renderResetCell = (row: QuotaListRow) => {
    const quota = row.config.storeSelector(quotaStore)[row.file.name] as QuotaState | undefined;
    if (quota?.status === 'loading') {
      return (
        <div className={styles.resetTimeStack}>
          <Skeleton className={styles.resetTimeSkeleton} />
          <Skeleton className={styles.resetTimeSkeleton} />
        </div>
      );
    }
    if (!quota || quota.status !== 'success') return <span className={styles.emptyValue}>-</span>;

    const resetLabels = getQuotaSummaries(row.config.type, quota, t)
      .slice(0, MAX_QUOTA_ITEMS)
      .map((summary) => summary.resetLabel)
      .filter((label): label is string => Boolean(label));

    if (resetLabels.length === 0) return <span className={styles.emptyValue}>-</span>;

    return (
      <div className={styles.resetTimeStack}>
        {resetLabels.map((label, index) => (
          <span key={`${label}-${index}`} className={styles.resetTimeValue}>
            {label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Card className={styles.quotaListCard}>
      <CardHeader className={styles.quotaListHeader}>
        <CardTitle>
          <div className={styles.titleWrapper}>
            <span className={styles.sectionTitleText}>{t('quota_management.title')}</span>
            <Badge variant="secondary">{rows.length}</Badge>
          </div>
        </CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRefreshAll()}
            disabled={disabled || loading || rows.length === 0 || refreshingAll}
            loading={refreshingAll}
          >
            {!refreshingAll && <RefreshCwIcon data-icon="inline-start" />}
            {t('quota_management.refresh_all_credentials')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.quotaListContent}>
        {loading ? (
          <div className={styles.quotaTableSkeleton}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className={styles.quotaTableSkeletonRow} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty className={styles.quotaEmpty}>
            <EmptyHeader>
              <EmptyTitle>{t('quota_management.empty_title')}</EmptyTitle>
              <EmptyDescription>{t('quota_management.empty_desc')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        ) : (
          <div className={styles.quotaTablePanel}>
            <Table className={styles.quotaTable}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('quota_management.provider_type')}</TableHead>
                  <TableHead>{t('quota_management.email')}</TableHead>
                  <TableHead className={styles.quotaColumnHead}>
                    {t('quota_management.quota')}
                  </TableHead>
                  <TableHead>{t('quota_management.reset_time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="outline" className={styles.providerBadge}>
                        <LobeProviderIcon
                          provider={row.providerKey}
                          className={styles.providerBadgeIcon}
                          fallbackLabel={row.providerLabel}
                        />
                        <span>{row.providerLabel}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className={styles.emailCell}>
                      <span className={row.email ? styles.emailValue : styles.emptyValue}>
                        {row.email ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell className={styles.quotaListQuotaCell}>
                      {renderQuotaCell(row)}
                    </TableCell>
                    <TableCell className={styles.resetTimeCell}>{renderResetCell(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
