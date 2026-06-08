import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OptionSelect } from '@/components/ui/shadcn-option-select';
import styles from './OpenAIBrandToolbar.module.scss';

export type OpenAISortBy = 'name' | 'priority' | 'recent-success';
export type SortDir = 'asc' | 'desc';

interface OpenAIBrandToolbarProps {
  sortBy: OpenAISortBy;
  sortDir: SortDir;
  onSortBy: (value: OpenAISortBy) => void;
  onSortDir: (value: SortDir) => void;
  availableModels: ReadonlyArray<string>;
  selectedModels: ReadonlySet<string>;
  onSelectedModelsChange: (next: Set<string>) => void;
}

export function OpenAIBrandToolbar({
  sortBy,
  sortDir,
  onSortBy,
  onSortDir,
  availableModels,
  selectedModels,
  onSelectedModelsChange,
}: OpenAIBrandToolbarProps) {
  const { t } = useTranslation();

  const sortOptions = useMemo(
    () => [
      { value: 'name', label: t('providersPage.toolbar.sort.name') },
      { value: 'priority', label: t('providersPage.toolbar.sort.priority') },
      {
        value: 'recent-success',
        label: t('providersPage.toolbar.sort.recentSuccess'),
      },
    ],
    [t]
  );

  const toggleModel = (name: string) => {
    const next = new Set(selectedModels);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onSelectedModelsChange(next);
  };

  const selectAll = () => onSelectedModelsChange(new Set(availableModels));
  const clearAll = () => onSelectedModelsChange(new Set());

  const filterLabel =
    selectedModels.size === 0
      ? t('providersPage.toolbar.filter.allModels')
      : t('providersPage.toolbar.filter.selectedModels', {
          selected: selectedModels.size,
          total: availableModels.length,
        });

  return (
    <div className={styles.root}>
      <div className={styles.sortGroup}>
        <span className={styles.label}>{t('providersPage.toolbar.sortBy')}</span>
        <OptionSelect
          value={sortBy}
          options={sortOptions}
          onChange={(value) => onSortBy(value as OpenAISortBy)}
          ariaLabel={t('providersPage.toolbar.sortBy')}
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          aria-label={
            sortDir === 'asc'
              ? t('providersPage.toolbar.sort.directionAsc')
              : t('providersPage.toolbar.sort.directionDesc')
          }
          title={
            sortDir === 'asc'
              ? t('providersPage.toolbar.sort.directionAsc')
              : t('providersPage.toolbar.sort.directionDesc')
          }
        >
          {sortDir === 'asc' ? (
            <ChevronUpIcon data-icon="inline-start" />
          ) : (
            <ChevronDownIcon data-icon="inline-start" />
          )}
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={availableModels.length === 0}
          >
            <SlidersHorizontalIcon data-icon="inline-start" />
            <span>{filterLabel}</span>
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          <DropdownMenuLabel className={styles.filterToolbar}>
            <Button
              variant="secondary"
              size="xs"
              onClick={selectAll}
              disabled={availableModels.length === 0}
            >
              {t('providersPage.toolbar.filter.selectAll')}
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={clearAll}
              disabled={selectedModels.size === 0}
            >
              {t('providersPage.toolbar.filter.clear')}
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableModels.length === 0 ? (
            <DropdownMenuLabel>{t('providersPage.toolbar.filter.empty')}</DropdownMenuLabel>
          ) : (
            <DropdownMenuGroup>
              {availableModels.map((name) => (
                <DropdownMenuCheckboxItem
                  key={name}
                  checked={selectedModels.has(name)}
                  onCheckedChange={() => toggleModel(name)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className={styles.filterItemLabel}>{name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
