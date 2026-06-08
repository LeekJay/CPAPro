import { useTranslation } from 'react-i18next';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { LobeProviderIcon } from '@/components/common/LobeProviderIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProviderRecentUsageMap } from '@/components/providers/utils';
import type { ProviderGroup, ProviderResource } from '../types';
import { ProviderResourceTable } from './ProviderResourceTable';
import {
  OpenAIBrandToolbar,
  type OpenAISortBy,
  type SortDir,
} from './OpenAIBrandToolbar';
import styles from './ProviderResourcePanel.module.scss';

export interface OpenAIPanelControls {
  sortBy: OpenAISortBy;
  sortDir: SortDir;
  onSortBy: (value: OpenAISortBy) => void;
  onSortDir: (value: SortDir) => void;
  availableModels: ReadonlyArray<string>;
  selectedModels: ReadonlySet<string>;
  onSelectedModelsChange: (next: Set<string>) => void;
}

interface ProviderResourcePanelProps {
  group: ProviderGroup;
  filter: string;
  onFilterChange: (value: string) => void;
  filteredResources: ProviderResource[];
  selectedId: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  openaiControls?: OpenAIPanelControls;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
  onCreate: () => void;
}

export function ProviderResourcePanel({
  group,
  filter,
  onFilterChange,
  filteredResources,
  selectedId,
  disableMutations,
  usageByProvider,
  openaiControls,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
  onCreate,
}: ProviderResourcePanelProps) {
  const { t } = useTranslation();

  const realResources = filteredResources.filter((r) => !r.flags.isPlaceholder);

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleArea}>
            <div className={styles.titleRow}>
              <LobeProviderIcon
                provider={group.id}
                size={26}
                className={styles.logo}
                fallbackLabel={t(`providersPage.providerNames.${group.id}`)}
              />
              <h2 className={styles.title}>
                {t(`providersPage.providerNames.${group.id}`)}
              </h2>
            </div>
          </div>
          {group.id !== 'ampcode' ? (
            <div className={styles.searchWrap}>
              <Input
                type="search"
                className={styles.searchInput}
                value={filter}
                onChange={(event) => onFilterChange(event.target.value)}
                placeholder={t('providersPage.table.filterPlaceholder')}
                rightElement={<SearchIcon data-icon="inline-end" />}
              />
            </div>
          ) : null}
        </div>
        {openaiControls ? (
          <div className={styles.headerToolbarRow}>
            <OpenAIBrandToolbar
              sortBy={openaiControls.sortBy}
              sortDir={openaiControls.sortDir}
              onSortBy={openaiControls.onSortBy}
              onSortDir={openaiControls.onSortDir}
              availableModels={openaiControls.availableModels}
              selectedModels={openaiControls.selectedModels}
              onSelectedModelsChange={openaiControls.onSelectedModelsChange}
            />
          </div>
        ) : null}
      </div>

      {group.issue ? (
        <div className={styles.issue}>
          <div className={styles.issueTitle}>
            {t('providersPage.table.providerIssue')}
            {group.issue.status ? ` · ${group.issue.status}` : ''}
          </div>
          <div>{group.issue.message}</div>
        </div>
      ) : null}

      {realResources.length === 0 && group.id !== 'ampcode' ? (
        <div className={styles.empty}>
          <div>{t('providersPage.table.empty')}</div>
          <div className={styles.emptyAction}>
            <Button
              type="button"
              onClick={onCreate}
              variant="secondary"
              size="sm"
            >
              <PlusIcon data-icon="inline-start" />
              <span>{t('providersPage.actions.new')}</span>
            </Button>
          </div>
        </div>
      ) : (
        <ProviderResourceTable
          resources={filteredResources}
          selectedId={selectedId}
          disableMutations={disableMutations}
          usageByProvider={usageByProvider}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleDisabled={onToggleDisabled}
        />
      )}
    </section>
  );
}
