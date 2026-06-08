import { useTranslation } from 'react-i18next';
import { AlertTriangleIcon } from 'lucide-react';
import { LobeProviderIcon } from '@/components/common/LobeProviderIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProviderBrand, ProviderGroup } from '../types';
import styles from './ProviderCategoryList.module.scss';

interface ProviderCategoryListProps {
  groups: ProviderGroup[];
  activeBrand: ProviderBrand;
  onSelect: (brand: ProviderBrand) => void;
}

export function ProviderCategoryList({
  groups,
  activeBrand,
  onSelect,
}: ProviderCategoryListProps) {
  const { t } = useTranslation();

  return (
    <aside className={styles.aside}>
      <p className={styles.eyebrow}>{t('providersPage.categories.title')}</p>
      <div className={styles.list}>
        {groups.map((group) => {
          const active = group.id === activeBrand;
          const realResources = group.resources.filter(
            (r) => !r.flags.isPlaceholder
          );
          const total = realResources.length || (group.id === 'ampcode' ? 1 : 0);
          const activeCount = realResources.filter((r) => !r.disabled).length;
          const itemClass = `${styles.item} ${active ? styles.active : ''}`;

          return (
            <Button
              key={group.id}
              type="button"
              variant="ghost"
              className={itemClass}
              onClick={() => onSelect(group.id)}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.itemLeft}>
                <LobeProviderIcon
                  provider={group.id}
                  size={26}
                  className={styles.logo}
                  fallbackLabel={t(`providersPage.providerNames.${group.id}`)}
                />
                <span className={styles.itemText}>
                  <span className={styles.itemTitle}>
                    {t(`providersPage.providerNames.${group.id}`)}
                  </span>
                  <span className={styles.itemSubtitle}>
                    {group.id === 'ampcode'
                      ? t(
                          group.resources[0]?.disabled
                            ? 'providersPage.categories.ampcodeInactive'
                            : 'providersPage.categories.ampcodeActive'
                        )
                      : t('providersPage.categories.activeCount', {
                          active: activeCount,
                          total,
                        })}
                  </span>
                </span>
              </span>
              {group.issue ? (
                <AlertTriangleIcon className={styles.issueIcon} />
              ) : (
                <Badge
                  variant={group.id !== 'ampcode' && total === 0 ? 'secondary' : 'outline'}
                  className={styles.badge}
                >
                  {group.id === 'ampcode' ? (group.resources[0]?.disabled ? '—' : '1') : total}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
