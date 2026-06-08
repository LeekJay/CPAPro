import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import {
  getOpenAIProviderRecentStatusData,
  getOpenAIProviderTotalStats,
  getProviderRecentStatusData,
  getProviderTotalStats,
  type ProviderRecentUsageMap,
} from '@/components/providers/utils';
import type { OpenAIProviderConfig } from '@/types';
import type { StatusBarData } from '@/utils/recentRequests';
import type { ProviderResource } from '../types';
import styles from './ProviderResourceTable.module.scss';
import statusBarStyles from './providerStatusBar.module.scss';

interface ProviderResourceTableProps {
  resources: ProviderResource[];
  selectedId?: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
}

const columnWidths = ['18%', '18%', '6%', '14%', '24%', '20%'];

const resolveStatusBarData = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): StatusBarData => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderRecentStatusData(
      resource.raw as OpenAIProviderConfig,
      usageByProvider
    );
  }
  return getProviderRecentStatusData(
    usageByProvider,
    resource.brand,
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

const resolveTotalStats = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): { success: number; failure: number } => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderTotalStats(
      resource.raw as OpenAIProviderConfig,
      usageByProvider
    );
  }
  return getProviderTotalStats(
    usageByProvider,
    resource.brand,
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

export function ProviderResourceTable({
  resources,
  selectedId,
  disableMutations,
  usageByProvider,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
}: ProviderResourceTableProps) {
  const { t } = useTranslation();

  const renderMetric = (key: string, label: string, value: number) => (
    <span key={key} className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </span>
  );

  const renderFlagTag = (key: string, label: string) => (
    <span key={key} className={styles.flagTag}>
      {label}
    </span>
  );

  const renderModelsSummary = (r: ProviderResource) => {
    const items: ReactNode[] = [];
    if (r.brand === 'openaiCompatibility') {
      items.push(
        renderMetric('models', t('providersPage.table.metrics.models'), r.modelCount),
        renderMetric('keys', t('providersPage.table.metrics.keys'), r.apiKeyEntryCount),
        renderMetric('headers', t('providersPage.table.metrics.headers'), r.headerCount),
      );
    } else if (r.brand === 'ampcode') {
      items.push(
        renderMetric('mappings', t('providersPage.table.metrics.mappings'), r.modelCount),
        renderMetric('keys', t('providersPage.table.metrics.keys'), r.apiKeyEntryCount),
      );
    } else {
      items.push(
        renderMetric('models', t('providersPage.table.metrics.models'), r.modelCount),
        renderMetric('headers', t('providersPage.table.metrics.headers'), r.headerCount),
      );
      if (r.brand === 'codex' && r.flags.websockets) {
        items.push(renderFlagTag('ws', t('providersPage.table.websocketsTag')));
      }
      if (r.brand === 'claude' && r.flags.cloakEnabled) {
        items.push(renderFlagTag('cloak', t('providersPage.table.cloakTag')));
      }
    }
    return <div className={styles.metricsCell}>{items}</div>;
  };

  const renderStatus = (r: ProviderResource) => {
    if (r.brand === 'ampcode' && r.flags.isPlaceholder) {
      return (
        <Badge variant="secondary" className={styles.statusBadge}>
          <AlertTriangleIcon data-icon="inline-start" />
          {t('providersPage.status.notConfigured')}
        </Badge>
      );
    }
    if (r.disabled) {
      return (
        <Badge variant="secondary" className={styles.statusBadge}>
          <AlertTriangleIcon data-icon="inline-start" />
          {t('providersPage.status.disabled')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={styles.statusBadge}>
        <CheckCircle2Icon data-icon="inline-start" />
        {t('providersPage.status.active')}
      </Badge>
    );
  };

  const renderPrimary = (r: ProviderResource) => {
    if (r.brand === 'openaiCompatibility') {
      const extra = r.apiKeyEntryCount > 1 ? ` · +${r.apiKeyEntryCount - 1}` : '';
      return (
        <div className={styles.primaryCell}>
          <span className={styles.primaryName}>{r.name ?? r.identifier}</span>
          <span className={styles.primarySub}>
            {(r.apiKeyPreview ?? '—') + extra}
          </span>
        </div>
      );
    }
    if (r.brand === 'ampcode') {
      return (
        <div className={styles.primaryCell}>
          <span className={styles.primaryName}>Amp CLI</span>
          <span className={styles.primarySub}>
            {r.apiKeyPreview ?? t('providersPage.table.noFallbackKey')}
          </span>
        </div>
      );
    }
    return (
      <div className={styles.primaryCell}>
        <span className={styles.primaryName}>{r.apiKeyPreview ?? '—'}</span>
        {r.authIndex ? (
          <span className={styles.primarySub}>auth: {r.authIndex}</span>
        ) : null}
      </div>
    );
  };

  const renderBaseUrl = (r: ProviderResource) => {
    if (r.brand === 'claude' && !r.baseUrl) {
      return (
        <span className={styles.baseUrl}>
          https://api.anthropic.com {t('providersPage.status.defaultSuffix')}
        </span>
      );
    }
    if (r.brand === 'ampcode' && !r.baseUrl) {
      return <span className={styles.baseUrl}>{t('providersPage.status.notConfigured')}</span>;
    }
    return (
      <span className={styles.baseUrl}>
        {r.baseUrl ?? t('providersPage.status.notSet')}
      </span>
    );
  };

  return (
    <Table className={styles.resourceTable}>
      <colgroup>
        {columnWidths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>{t('providersPage.table.key')}</TableHead>
          <TableHead>{t('providersPage.table.baseUrl')}</TableHead>
          <TableHead>{t('providersPage.table.prefix')}</TableHead>
          <TableHead>{t('providersPage.table.models')}</TableHead>
          <TableHead>{t('providersPage.table.status')}</TableHead>
          <TableHead className={styles.alignRight}>{t('providersPage.table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => {
          const isAmpcode = resource.brand === 'ampcode';
          return (
            <TableRow
              key={resource.id}
              data-state={resource.id === selectedId ? 'selected' : undefined}
            >
              <TableCell>{renderPrimary(resource)}</TableCell>
              <TableCell>{renderBaseUrl(resource)}</TableCell>
              <TableCell>
                {resource.brand === 'ampcode' ? (
                  <span className={styles.baseUrl}>—</span>
                ) : resource.prefix ? (
                  <span className={styles.chip}>{resource.prefix}</span>
                ) : (
                  <span className={styles.baseUrl}>{t('providersPage.status.none')}</span>
                )}
              </TableCell>
              <TableCell>{renderModelsSummary(resource)}</TableCell>
              <TableCell>
                <div className={styles.statusCell}>
                  {renderStatus(resource)}
                  {usageByProvider && resource.brand !== 'ampcode' ? (
                    <>
                      {(() => {
                        const stats = resolveTotalStats(resource, usageByProvider);
                        return (
                          <div className={styles.stats}>
                            <span className={`${styles.statPill} ${styles.statSuccess}`}>
                              {t('stats.success')}: {stats.success}
                            </span>
                            <span className={`${styles.statPill} ${styles.statFailure}`}>
                              {t('stats.failure')}: {stats.failure}
                            </span>
                          </div>
                        );
                      })()}
                      <ProviderStatusBar
                        statusData={resolveStatusBarData(resource, usageByProvider)}
                        styles={statusBarStyles}
                      />
                    </>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className={styles.alignRight}>
                <div className={styles.actions}>
                  {!isAmpcode && onToggleDisabled ? (
                    <span
                      className={styles.toggleWrap}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        size="sm"
                        checked={!resource.disabled}
                        disabled={disableMutations}
                        onCheckedChange={(value) =>
                          onToggleDisabled(resource, !value)
                        }
                        aria-label={
                          resource.disabled
                            ? t('providersPage.actions.enable')
                            : t('providersPage.actions.disable')
                        }
                      />
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('providersPage.actions.view')}
                    title={t('providersPage.actions.view')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(resource);
                    }}
                  >
                    <EyeIcon data-icon="inline-start" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('providersPage.actions.edit')}
                    title={t('providersPage.actions.edit')}
                    disabled={disableMutations}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(resource);
                    }}
                  >
                    <PencilIcon data-icon="inline-start" />
                  </Button>
                  {isAmpcode ? (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      aria-label={t('providersPage.actions.clear')}
                      title={t('providersPage.actions.clear')}
                      disabled={disableMutations || resource.flags.isPlaceholder}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(resource);
                      }}
                    >
                      <Trash2Icon data-icon="inline-start" />
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      aria-label={t('providersPage.actions.delete')}
                      title={t('providersPage.actions.delete')}
                      disabled={disableMutations}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(resource);
                      }}
                    >
                      <Trash2Icon data-icon="inline-start" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
