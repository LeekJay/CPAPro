import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import styles from './ProviderHeaderCard.module.scss';

interface ProviderHeaderCardProps {
  totalActive: number;
  totalResources: number;
  providerFamilies: number;
  updatedAtLabel: string;
  issueCount?: number;
  isFetching?: boolean;
  isNewDisabled?: boolean;
  newLabel?: string;
  onRefresh: () => void;
  onNew: () => void;
}

export function ProviderHeaderCard({
  totalActive,
  totalResources,
  providerFamilies,
  updatedAtLabel,
  issueCount = 0,
  isFetching = false,
  isNewDisabled = false,
  newLabel,
  onRefresh,
  onNew,
}: ProviderHeaderCardProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.card}>
      <div className={styles.row}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{t('providersPage.header.title')}</h1>
        </div>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            loading={isFetching}
            aria-label={
              isFetching
                ? t('providersPage.actions.syncing')
                : t('providersPage.actions.refresh')
            }
          >
            {!isFetching && <RefreshCwIcon data-icon="inline-start" />}
            <span>
              {isFetching
                ? t('providersPage.actions.syncing')
                : t('providersPage.actions.refresh')}
            </span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onNew}
            disabled={isNewDisabled}
          >
            <PlusIcon data-icon="inline-start" />
            <span>{newLabel ?? t('providersPage.actions.new')}</span>
          </Button>
        </div>
      </div>

      <div className={styles.chips}>
        <Badge variant="outline">
          {t('providersPage.header.activeResources', {
            active: totalActive,
            total: totalResources,
          })}
        </Badge>
        <Badge variant="secondary">
          {t('providersPage.header.providerFamilies', { count: providerFamilies })}
        </Badge>
        <Badge variant="secondary">
          {t('providersPage.header.updatedAt', { time: updatedAtLabel })}
        </Badge>
        {issueCount > 0 ? (
          <Badge variant="destructive">
            {t('providersPage.header.issueCount', { count: issueCount })}
          </Badge>
        ) : null}
      </div>
    </section>
  );
}
