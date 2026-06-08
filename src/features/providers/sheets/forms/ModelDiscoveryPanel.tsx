import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCwIcon,
  SearchIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { ModelInfo } from '@/utils/models';
import styles from './sharedForm.module.scss';

interface ModelDiscoveryPanelProps {
  loading: boolean;
  error: string | null;
  models: ModelInfo[];
  hasFetched: boolean;
  existingNames: Set<string>;
  mutating?: boolean;
  onApply: (picked: ModelInfo[]) => void;
  onReload: () => void;
  onClose: () => void;
}

export function ModelDiscoveryPanel({
  loading,
  error,
  models,
  hasFetched,
  existingNames,
  mutating,
  onApply,
  onReload,
  onClose,
}: ModelDiscoveryPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) =>
      `${m.name} ${m.alias ?? ''}`.toLowerCase().includes(q)
    );
  }, [models, search]);

  const selectable = useMemo(
    () => filtered.filter((m) => !existingNames.has(m.name)),
    [filtered, existingNames]
  );

  const allSelectableChecked =
    selectable.length > 0 && selectable.every((m) => selected.has(m.name));

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelectableChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((m) => m.name)));
    }
  };

  const handleApply = () => {
    const picked = models.filter(
      (m) => selected.has(m.name) && !existingNames.has(m.name)
    );
    if (!picked.length) return;
    onApply(picked);
    setSelected(new Set());
  };

  return (
    <div className={styles.discoveryPanel}>
      <div className={styles.discoveryToolbar}>
        <div className={styles.discoverySearchWrap}>
          <Input
            type="search"
            className={styles.discoverySearch}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('providersPage.discovery.searchPlaceholder')}
            rightElement={<SearchIcon data-icon="inline-end" />}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onReload}
          disabled={loading}
          loading={loading}
          aria-label={t('providersPage.discovery.reload')}
        >
          {!loading && <RefreshCwIcon data-icon="inline-start" />}
          <span>{t('providersPage.discovery.reload')}</span>
        </Button>
      </div>

      {loading && !models.length ? (
        <div className={styles.discoveryEmpty}>
          {t('providersPage.discovery.loading')}
        </div>
      ) : error ? (
        <div className={styles.connectivityError}>{error}</div>
      ) : hasFetched && !models.length ? (
        <div className={styles.discoveryEmpty}>
          {t('providersPage.discovery.empty')}
        </div>
      ) : models.length ? (
        <>
          <div className={styles.discoveryBatchRow}>
            <label className={styles.discoveryCheckboxRow}>
              <Checkbox
                checked={allSelectableChecked}
                onCheckedChange={toggleAll}
                disabled={selectable.length === 0}
                aria-label={
                  allSelectableChecked
                    ? t('providersPage.discovery.clearAll')
                    : t('providersPage.discovery.selectAll')
                }
              />
              <span className={styles.discoveryCheckboxText}>
                <span className={styles.discoveryBatchLabel}>
                  {allSelectableChecked
                    ? t('providersPage.discovery.clearAll')
                    : t('providersPage.discovery.selectAll')}
                </span>
              </span>
            </label>
            <span className={styles.discoveryCount}>
              {t('providersPage.discovery.selectedCount', {
                selected: selected.size,
                total: selectable.length,
              })}
            </span>
          </div>
          <ul className={styles.discoveryList}>
            {filtered.map((m) => {
              const existing = existingNames.has(m.name);
              return (
                <li
                  key={m.name}
                  className={
                    existing
                      ? `${styles.discoveryItem} ${styles.discoveryItemExisting}`
                      : styles.discoveryItem
                  }
                >
                  {existing ? (
                    <>
                      <span className={styles.discoveryName}>{m.name}</span>
                      <span className={styles.discoveryAddedTag}>
                        {t('providersPage.discovery.alreadyAdded')}
                      </span>
                    </>
                  ) : (
                    <label className={styles.discoveryCheckboxRow}>
                      <Checkbox
                        checked={selected.has(m.name)}
                        onCheckedChange={() => toggle(m.name)}
                        aria-label={m.name}
                      />
                      <span className={styles.discoveryCheckboxText}>
                        <span className={styles.discoveryName}>{m.name}</span>
                      </span>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className={styles.discoveryEmpty}>
          {t('providersPage.discovery.notLoaded')}
        </div>
      )}

      <div className={styles.discoveryFooter}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          disabled={mutating}
        >
          {t('providersPage.discovery.close')}
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={mutating || selected.size === 0}
        >
          {t('providersPage.discovery.apply', { count: selected.size })}
        </Button>
      </div>
    </div>
  );
}
