import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  DownloadIcon,
  EyeIcon,
  KeyRoundIcon,
  PlusIcon,
  ShapesIcon,
  Trash2Icon,
} from 'lucide-react';
import { animate } from 'motion/mini';
import type { AnimationPlaybackControlsWithThen } from 'motion-dom';
import { useInterval } from '@/hooks/useInterval';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { LobeProviderIcon } from '@/components/common/LobeProviderIcon';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn-card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { copyToClipboard } from '@/utils/clipboard';
import {
  getTypeLabel,
  isRuntimeOnlyAuthFile,
  normalizeProviderKey,
} from '@/features/authFiles/constants';
import { resolveAuthFileEmail } from '@/features/authFiles/authFileMetadata';
import { AuthFileModelsModal } from '@/features/authFiles/components/AuthFileModelsModal';
import { AuthFileAccountAddDialog } from '@/features/authFiles/components/AuthFileAccountAddDialog';
import {
  AUTH_ACCOUNT_CHANNELS,
  type AuthAccountChannel,
} from '@/features/authFiles/authAccountChannels';
import { AuthFilesPrefixProxyEditorModal } from '@/features/authFiles/components/AuthFilesPrefixProxyEditorModal';
import { OAuthExcludedCard } from '@/features/authFiles/components/OAuthExcludedCard';
import { OAuthModelAliasCard } from '@/features/authFiles/components/OAuthModelAliasCard';
import { useAuthFilesData } from '@/features/authFiles/hooks/useAuthFilesData';
import { useAuthFilesModels } from '@/features/authFiles/hooks/useAuthFilesModels';
import { useAuthFilesOauth } from '@/features/authFiles/hooks/useAuthFilesOauth';
import { useAuthFilesPrefixProxyEditor } from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import {
  readAuthFilesUiState,
  writeAuthFilesUiState,
} from '@/features/authFiles/uiState';
import { useAuthStore, useNotificationStore } from '@/stores';
import styles from './AuthFilesPage.module.scss';

const easePower3Out = (progress: number) => 1 - (1 - progress) ** 4;
const easePower2In = (progress: number) => progress ** 3;
const BATCH_BAR_BASE_TRANSFORM = 'translateX(-50%)';
const BATCH_BAR_HIDDEN_TRANSFORM = 'translateX(-50%) translateY(56px)';
const DEFAULT_REGULAR_PAGE_SIZE = 9;

export function AuthFilesPage() {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const pageTransitionLayer = usePageTransitionLayer();
  const isCurrentLayer = pageTransitionLayer ? pageTransitionLayer.status === 'current' : true;
  const navigate = useNavigate();

  const [filter, setFilter] = useState<'all' | string>('all');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('list');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountChannel, setAccountChannel] = useState<AuthAccountChannel>('codex');
  const [batchActionBarVisible, setBatchActionBarVisible] = useState(false);
  const [uiStateHydrated, setUiStateHydrated] = useState(false);
  const floatingBatchActionsRef = useRef<HTMLDivElement>(null);
  const batchActionAnimationRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const previousSelectionCountRef = useRef(0);
  const selectionCountRef = useRef(0);
  const lastErrorNotificationRef = useRef('');

  const {
    files,
    selectedFiles,
    selectionCount,
    loading,
    error,
    uploading,
    deleting,
    deletingAll,
    statusUpdating,
    batchStatusUpdating,
    fileInputRef,
    loadFiles,
    handleUploadClick,
    handleFileChange,
    handleDelete,
    handleDeleteAll,
    handleDownload,
    handleStatusToggle,
    toggleSelect,
    selectAllVisible,
    invertVisibleSelection,
    deselectAll,
    batchDownload,
    batchSetStatus,
    batchDelete,
  } = useAuthFilesData();

  const {
    excluded,
    excludedError,
    modelAlias,
    modelAliasError,
    allProviderModels,
    loadExcluded,
    loadModelAlias,
    deleteExcluded,
    deleteModelAlias,
    handleMappingUpdate,
    handleDeleteLink,
    handleToggleFork,
    handleRenameAlias,
    handleDeleteAlias,
  } = useAuthFilesOauth({ viewMode, files });

  const {
    modelsModalOpen,
    modelsLoading,
    modelsList,
    modelsFileName,
    modelsFileType,
    modelsError,
    showModels,
    closeModelsModal,
  } = useAuthFilesModels();

  const {
    prefixProxyEditor,
    prefixProxyUpdatedText,
    prefixProxyDirty,
    openPrefixProxyEditor,
    closePrefixProxyEditor,
    handlePrefixProxyChange,
    handlePrefixProxySave,
  } = useAuthFilesPrefixProxyEditor({
    disableControls: connectionStatus !== 'connected',
    loadFiles,
  });

  const disableControls = connectionStatus !== 'connected';
  const normalizedFilter = normalizeProviderKey(String(filter));
  const pageSize = DEFAULT_REGULAR_PAGE_SIZE;

  useEffect(() => {
    const persisted = readAuthFilesUiState();
    if (persisted) {
      if (typeof persisted.filter === 'string' && persisted.filter.trim()) {
        setFilter(normalizeProviderKey(persisted.filter));
      }
      if (typeof persisted.page === 'number' && Number.isFinite(persisted.page)) {
        setPage(Math.max(1, Math.round(persisted.page)));
      }
    }

    setUiStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!uiStateHydrated) return;

    writeAuthFilesUiState({
      filter,
      page,
      pageSize,
    });
  }, [
    filter,
    page,
    pageSize,
    uiStateHydrated,
  ]);

  const handleHeaderRefresh = useCallback(async () => {
    await Promise.all([loadFiles(), loadExcluded(), loadModelAlias()]);
  }, [loadFiles, loadExcluded, loadModelAlias]);

  const handleAccountChannelSelect = useCallback((channel: AuthAccountChannel) => {
    setAccountChannel(channel);
    setAccountDialogOpen(true);
  }, []);

  const handleAccountCompleted = useCallback(() => {
    void loadFiles().catch(() => {});
  }, [loadFiles]);

  useHeaderRefresh(handleHeaderRefresh);

  useEffect(() => {
    if (!isCurrentLayer) return;
    loadFiles();
    loadExcluded();
    loadModelAlias();
  }, [isCurrentLayer, loadFiles, loadExcluded, loadModelAlias]);

  useInterval(
    () => {
      void loadFiles().catch(() => {});
    },
    isCurrentLayer ? 240_000 : null
  );

  useEffect(() => {
    if (!error) {
      lastErrorNotificationRef.current = '';
      return;
    }

    if (lastErrorNotificationRef.current === error) return;
    lastErrorNotificationRef.current = error;
    showNotification(error, 'error');
  }, [error, showNotification]);

  const existingTypes = useMemo(() => {
    const types = new Set<string>(['all']);
    files.forEach((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (type) types.add(type);
    });
    return Array.from(types);
  }, [files]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    files.forEach((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (!type) return;
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [files]);

  const filtered = useMemo(() => {
    return files.filter((item) => {
      const type = normalizeProviderKey(String(item.type ?? item.provider ?? ''));
      return normalizedFilter === 'all' || type === normalizedFilter;
    });
  }, [files, normalizedFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const providerA = normalizeProviderKey(String(a.provider ?? a.type ?? 'unknown'));
      const providerB = normalizeProviderKey(String(b.provider ?? b.type ?? 'unknown'));
      const providerCompare = providerA.localeCompare(providerB);
      if (providerCompare !== 0) return providerCompare;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);
  const selectablePageItems = useMemo(
    () => pageItems.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [pageItems]
  );
  const selectableFilteredItems = useMemo(
    () => sorted.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [sorted]
  );
  const selectedNames = useMemo(() => Array.from(selectedFiles), [selectedFiles]);
  const allPageItemsSelected =
    selectablePageItems.length > 0 &&
    selectablePageItems.every((file) => selectedFiles.has(file.name));
  const selectedHasStatusUpdating = useMemo(
    () => selectedNames.some((name) => statusUpdating[name] === true),
    [selectedNames, statusUpdating]
  );
  const batchStatusButtonsDisabled =
    disableControls ||
    selectedNames.length === 0 ||
    batchStatusUpdating ||
    selectedHasStatusUpdating;

  const copyTextWithNotification = useCallback(
    async (text: string) => {
      const copied = await copyToClipboard(text);
      showNotification(
        copied
          ? t('notification.link_copied', { defaultValue: 'Copied to clipboard' })
          : t('notification.copy_failed', { defaultValue: 'Copy failed' }),
        copied ? 'success' : 'error'
      );
    },
    [showNotification, t]
  );

  const openExcludedEditor = useCallback(
    (provider?: string) => {
      const providerValue = (provider || (filter !== 'all' ? String(filter) : '')).trim();
      const params = new URLSearchParams();
      if (providerValue) {
        params.set('provider', providerValue);
      }
      const nextSearch = params.toString();
      navigate(`/auth-files/oauth-excluded${nextSearch ? `?${nextSearch}` : ''}`, {
        state: { fromAuthFiles: true },
      });
    },
    [filter, navigate]
  );

  const openModelAliasEditor = useCallback(
    (provider?: string) => {
      const providerValue = (provider || (filter !== 'all' ? String(filter) : '')).trim();
      const params = new URLSearchParams();
      if (providerValue) {
        params.set('provider', providerValue);
      }
      const nextSearch = params.toString();
      navigate(`/auth-files/oauth-model-alias${nextSearch ? `?${nextSearch}` : ''}`, {
        state: { fromAuthFiles: true },
      });
    },
    [filter, navigate]
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const actionsEl = floatingBatchActionsRef.current;
    if (!actionsEl) {
      document.documentElement.style.removeProperty('--auth-files-action-bar-height');
      return;
    }

    const updatePadding = () => {
      const height = actionsEl.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--auth-files-action-bar-height', `${height}px`);
    };

    updatePadding();
    window.addEventListener('resize', updatePadding);

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePadding);
    ro?.observe(actionsEl);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updatePadding);
      document.documentElement.style.removeProperty('--auth-files-action-bar-height');
    };
  }, [batchActionBarVisible, selectionCount]);

  useEffect(() => {
    selectionCountRef.current = selectionCount;
    if (selectionCount > 0) {
      setBatchActionBarVisible(true);
    }
  }, [selectionCount]);

  useLayoutEffect(() => {
    if (!batchActionBarVisible) return;
    const currentCount = selectionCount;
    const previousCount = previousSelectionCountRef.current;
    const actionsEl = floatingBatchActionsRef.current;
    if (!actionsEl) return;

    batchActionAnimationRef.current?.stop();
    batchActionAnimationRef.current = null;

    if (currentCount > 0 && previousCount === 0) {
      batchActionAnimationRef.current = animate(
        actionsEl,
        {
          transform: [BATCH_BAR_HIDDEN_TRANSFORM, BATCH_BAR_BASE_TRANSFORM],
          opacity: [0, 1],
        },
        {
          duration: 0.28,
          ease: easePower3Out,
          onComplete: () => {
            actionsEl.style.transform = BATCH_BAR_BASE_TRANSFORM;
            actionsEl.style.opacity = '1';
          },
        }
      );
    } else if (currentCount === 0 && previousCount > 0) {
      batchActionAnimationRef.current = animate(
        actionsEl,
        {
          transform: [BATCH_BAR_BASE_TRANSFORM, BATCH_BAR_HIDDEN_TRANSFORM],
          opacity: [1, 0],
        },
        {
          duration: 0.22,
          ease: easePower2In,
          onComplete: () => {
            if (selectionCountRef.current === 0) {
              setBatchActionBarVisible(false);
            }
          },
        }
      );
    }

    previousSelectionCountRef.current = currentCount;
  }, [batchActionBarVisible, selectionCount]);

  useEffect(
    () => () => {
      batchActionAnimationRef.current?.stop();
      batchActionAnimationRef.current = null;
    },
    []
  );

  const renderProviderTabs = () => (
    <Tabs
      value={normalizedFilter}
      onValueChange={(type) => {
        setFilter(type);
        setPage(1);
      }}
      className={styles.providerTabs}
    >
      <TabsList className={styles.providerTabsList}>
        {existingTypes.map((type) => (
          <TabsTrigger key={type} value={type} className={styles.providerTabsTrigger}>
            {type !== 'all' ? (
              <LobeProviderIcon
                provider={type}
                className={styles.providerTabsIcon}
                fallbackLabel={getTypeLabel(t, type)}
              />
            ) : null}
            <span className={styles.providerTabsLabel}>{getTypeLabel(t, type)}</span>
            <span className={styles.providerTabsCount}>{typeCounts[type] ?? 0}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  const renderFilesTable = () => (
    <div className={styles.tablePanel}>
      <Table className={styles.authFilesTable}>
        <TableHeader>
          <TableRow>
            <TableHead className={styles.tableSelectCol}>
              <Checkbox
                checked={allPageItemsSelected}
                disabled={selectablePageItems.length === 0}
                aria-label={
                  allPageItemsSelected
                    ? t('auth_files.batch_deselect')
                    : t('auth_files.batch_select_page')
                }
                onCheckedChange={() => {
                  if (allPageItemsSelected) {
                    invertVisibleSelection(selectablePageItems);
                    return;
                  }
                  selectAllVisible(pageItems);
                }}
              />
            </TableHead>
            <TableHead className={styles.providerIconHead}>
              {t('auth_files.table_provider')}
            </TableHead>
            <TableHead>{t('auth_files.table_email')}</TableHead>
            <TableHead className={styles.tableActionsHead}>{t('common.action')}</TableHead>
            <TableHead className={styles.statusControlHead}>
              {t('auth_files.table_status_control')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((file) => {
            const isRuntimeOnly = isRuntimeOnlyAuthFile(file);
            const providerKey = normalizeProviderKey(
              String(file.type ?? file.provider ?? 'unknown')
            );
            const typeLabel = getTypeLabel(t, providerKey);
            const email = resolveAuthFileEmail(file);

            return (
              <TableRow
                key={file.name}
                data-state={selectedFiles.has(file.name) ? 'selected' : undefined}
                className={file.disabled ? styles.tableRowDisabled : undefined}
              >
                <TableCell className={styles.tableSelectCol}>
                  {!isRuntimeOnly && (
                    <Checkbox
                      checked={selectedFiles.has(file.name)}
                      aria-label={
                        selectedFiles.has(file.name)
                          ? t('auth_files.batch_deselect')
                          : t('auth_files.batch_select_all')
                      }
                      onCheckedChange={() => toggleSelect(file.name)}
                    />
                  )}
                </TableCell>
                <TableCell className={styles.providerIconCell}>
                  <div className={styles.tableProviderAvatar} title={typeLabel}>
                    <LobeProviderIcon
                      provider={providerKey}
                      size={18}
                      className={styles.tableProviderIcon}
                      fallbackLabel={typeLabel}
                    />
                  </div>
                </TableCell>
                <TableCell className={styles.emailCell}>
                  <span className={email ? styles.emailValue : styles.tableEmptyValue}>
                    {email ?? '-'}
                  </span>
                </TableCell>
                <TableCell className={styles.tableActionsCell}>
                  <div className={styles.tableActions}>
                    {(!isRuntimeOnly || providerKey === 'aistudio') && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => showModels(file)}
                        title={t('auth_files.models_button')}
                        aria-label={t('auth_files.models_button')}
                        disabled={disableControls}
                      >
                        <ShapesIcon data-icon="inline-start" />
                      </Button>
                    )}
                    {!isRuntimeOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDownload(file.name)}
                          title={t('auth_files.download_button')}
                          aria-label={t('auth_files.download_button')}
                          disabled={disableControls}
                        >
                          <DownloadIcon data-icon="inline-start" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openPrefixProxyEditor(file)}
                          title={t('auth_files.viewer_button')}
                          aria-label={t('auth_files.viewer_button')}
                          disabled={disableControls}
                        >
                          <EyeIcon data-icon="inline-start" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => handleDelete(file.name)}
                          title={t('auth_files.delete_button')}
                          aria-label={t('auth_files.delete_button')}
                          disabled={disableControls || deleting === file.name}
                        >
                          <Trash2Icon data-icon="inline-start" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className={styles.statusControlCell}>
                  {!isRuntimeOnly ? (
                    <Switch
                      size="sm"
                      aria-label={t('auth_files.status_toggle_label')}
                      checked={!file.disabled}
                      disabled={disableControls || statusUpdating[file.name] === true}
                      onCheckedChange={(value) => handleStatusToggle(file, value)}
                    />
                  ) : (
                    <span className={styles.tableEmptyValue}>-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderFilesSkeleton = () => (
    <div className={styles.tablePanel} aria-label={t('common.loading')}>
      <div className={styles.tableSkeleton}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.tableSkeletonRow}>
            <Skeleton className={styles.tableSkeletonCheck} />
            <Skeleton className={styles.tableSkeletonFile} />
            <Skeleton className={styles.tableSkeletonState} />
            <Skeleton className={styles.tableSkeletonHealth} />
            <Skeleton className={styles.tableSkeletonActions} />
          </div>
        ))}
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <Empty className={styles.emptyState}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <KeyRoundIcon />
        </EmptyMedia>
        <EmptyTitle>
          {normalizedFilter === 'all'
            ? t('auth_files.empty_title')
            : t('auth_files.filter_empty_title')}
        </EmptyTitle>
        <EmptyDescription>
          {normalizedFilter === 'all'
            ? t('auth_files.empty_desc')
            : t('auth_files.filter_empty_desc')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  );

  const titleNode = (
    <div className={styles.titleWrapper}>
      <span>{t('auth_files.title_section')}</span>
      {files.length > 0 && <span className={styles.countBadge}>{files.length}</span>}
    </div>
  );

  const deleteAllButtonLabel = (() => {
    return normalizedFilter === 'all'
      ? t('auth_files.delete_all_button')
      : `${t('common.delete')} ${getTypeLabel(t, normalizedFilter)}`;
  })();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('auth_files.title')}</h1>
        <p className={styles.description}>{t('auth_files.description')}</p>
      </div>

      <Card className={styles.filesPanel}>
        <CardHeader className={styles.filesPanelHeader}>
          <CardTitle>{titleNode}</CardTitle>
          <CardAction className={styles.filesPanelActions}>
            <div className={styles.headerActions}>
              <Button variant="secondary" size="sm" onClick={handleHeaderRefresh} disabled={loading}>
                {t('common.refresh')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUploadClick}
                disabled={disableControls || uploading}
                loading={uploading}
              >
                {t('auth_files.upload_button')}
              </Button>
              <ButtonGroup
                className={styles.accountButtonGroup}
                aria-label={t('auth_files.add_account_button')}
              >
                <Button size="sm" onClick={() => handleAccountChannelSelect(accountChannel)} disabled={disableControls}>
                  <PlusIcon data-icon="inline-start" />
                  {t('auth_files.add_account_button')}
                </Button>
                <ButtonGroupSeparator />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      aria-label={t('auth_files.add_account_channel_button')}
                      disabled={disableControls}
                    >
                      <ChevronDownIcon data-icon="inline-start" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={styles.accountChannelMenu}>
                    <DropdownMenuLabel>
                      {t('auth_files.add_account_button', { defaultValue: '添加账号' })}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {AUTH_ACCOUNT_CHANNELS.map((channel) => (
                        <DropdownMenuItem
                          key={channel.id}
                          onSelect={() => handleAccountChannelSelect(channel.id)}
                        >
                          <LobeProviderIcon
                            provider={channel.id}
                            className={styles.accountChannelIcon}
                            fallbackLabel={t(channel.titleKey)}
                          />
                          <span>{t(channel.titleKey)}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  handleDeleteAll({
                    filter,
                    problemOnly: false,
                    disabledOnly: false,
                    onResetFilterToAll: () => setFilter('all'),
                    onResetProblemOnly: () => {},
                    onResetDisabledOnly: () => {},
                  })
                }
                disabled={disableControls || loading || deletingAll}
                loading={deletingAll}
              >
                {deleteAllButtonLabel}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className={styles.filesPanelContent}>
        <div className={styles.filterSection}>
          {renderProviderTabs()}

          <div className={styles.filterContent}>
            {loading ? (
              renderFilesSkeleton()
            ) : pageItems.length === 0 ? (
              renderEmptyState()
            ) : (
              renderFilesTable()
            )}

            {!loading && sorted.length > pageSize && (
              <div className={styles.pagination}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                >
                  {t('auth_files.pagination_prev')}
                </Button>
                <div className={styles.pageInfo}>
                  {t('auth_files.pagination_info', {
                    current: currentPage,
                    total: totalPages,
                    count: sorted.length,
                  })}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                >
                  {t('auth_files.pagination_next')}
                </Button>
              </div>
            )}
          </div>
        </div>
        </CardContent>
      </Card>

      <OAuthExcludedCard
        disableControls={disableControls}
        excludedError={excludedError}
        excluded={excluded}
        onAdd={() => openExcludedEditor()}
        onEdit={openExcludedEditor}
        onDelete={deleteExcluded}
      />

      <OAuthModelAliasCard
        disableControls={disableControls}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAdd={() => openModelAliasEditor()}
        onEditProvider={openModelAliasEditor}
        onDeleteProvider={deleteModelAlias}
        modelAliasError={modelAliasError}
        modelAlias={modelAlias}
        allProviderModels={allProviderModels}
        onUpdate={handleMappingUpdate}
        onDeleteLink={handleDeleteLink}
        onToggleFork={handleToggleFork}
        onRenameAlias={handleRenameAlias}
        onDeleteAlias={handleDeleteAlias}
      />

      <AuthFileAccountAddDialog
        open={accountDialogOpen}
        channel={accountChannel}
        onOpenChange={setAccountDialogOpen}
        onCompleted={handleAccountCompleted}
      />

      <AuthFileModelsModal
        open={modelsModalOpen}
        fileName={modelsFileName}
        fileType={modelsFileType}
        loading={modelsLoading}
        error={modelsError}
        models={modelsList}
        excluded={excluded}
        onClose={closeModelsModal}
        onCopyText={copyTextWithNotification}
      />

      <AuthFilesPrefixProxyEditorModal
        disableControls={disableControls}
        editor={prefixProxyEditor}
        updatedText={prefixProxyUpdatedText}
        dirty={prefixProxyDirty}
        onClose={closePrefixProxyEditor}
        onCopyText={copyTextWithNotification}
        onSave={handlePrefixProxySave}
        onChange={handlePrefixProxyChange}
      />

      {batchActionBarVisible && typeof document !== 'undefined'
        ? createPortal(
            <div className={styles.batchActionContainer} ref={floatingBatchActionsRef}>
              <div className={styles.batchActionBar}>
                <div className={styles.batchActionLeft}>
                  <span className={styles.batchSelectionText}>
                    {t('auth_files.batch_selected', { count: selectionCount })}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => selectAllVisible(pageItems)}
                    disabled={selectablePageItems.length === 0}
                  >
                    {t('auth_files.batch_select_page')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => selectAllVisible(sorted)}
                    disabled={selectableFilteredItems.length === 0}
                  >
                    {t('auth_files.batch_select_filtered')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => invertVisibleSelection(pageItems)}
                    disabled={selectablePageItems.length === 0}
                  >
                    {t('auth_files.batch_invert_page')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    {t('auth_files.batch_deselect')}
                  </Button>
                </div>
                <div className={styles.batchActionRight}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void batchDownload(selectedNames)}
                    disabled={disableControls || selectedNames.length === 0}
                  >
                    {t('auth_files.batch_download')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => batchSetStatus(selectedNames, true)}
                    disabled={batchStatusButtonsDisabled}
                  >
                    {t('auth_files.batch_enable')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => batchSetStatus(selectedNames, false)}
                    disabled={batchStatusButtonsDisabled}
                  >
                    {t('auth_files.batch_disable')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => batchDelete(selectedNames)}
                    disabled={disableControls || selectedNames.length === 0}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
