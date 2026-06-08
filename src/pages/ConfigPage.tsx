import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TerminalSquareIcon,
} from 'lucide-react';
import { parse as parseYaml, parseDocument } from 'yaml';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@/components/ui/shadcn-card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VisualConfigEditor, type VisualSectionId } from '@/components/config/VisualConfigEditor';
import { DiffModal } from '@/components/config/DiffModal';
import { useVisualConfig } from '@/hooks/useVisualConfig';
import { useNotificationStore, useAuthStore, useThemeStore, useConfigStore } from '@/stores';
import { configFileApi } from '@/services/api/configFile';
import styles from './ConfigPage.module.scss';

type ConfigEditorTab = 'visual' | 'source';
type ConfigRouteSection = VisualSectionId | 'source';

const VISUAL_CONFIG_SECTION_IDS: VisualSectionId[] = [
  'server',
  'auth',
  'system',
  'quota',
  'streaming',
  'payload',
];

const isVisualConfigSectionId = (value: string | undefined): value is VisualSectionId =>
  VISUAL_CONFIG_SECTION_IDS.includes(value as VisualSectionId);

const LazyConfigSourceEditor = lazy(() => import('@/components/config/ConfigSourceEditor'));

function readCommercialModeFromYaml(yamlContent: string): boolean {
  try {
    const parsed = parseYaml(yamlContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    return Boolean((parsed as Record<string, unknown>)['commercial-mode']);
  } catch {
    return false;
  }
}

function normalizeYamlForVisualDiff(yamlContent: string): string {
  try {
    const doc = parseDocument(yamlContent);
    return doc.toString({ indent: 2, lineWidth: 120, minContentWidth: 0 });
  } catch {
    return yamlContent;
  }
}

export function ConfigPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sectionId } = useParams<{ sectionId?: string }>();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

  const routeSection: ConfigRouteSection = sectionId === 'source' ? 'source' : isVisualConfigSectionId(sectionId) ? sectionId : 'server';
  const invalidSection = Boolean(sectionId) && sectionId !== 'source' && !isVisualConfigSectionId(sectionId);
  const activeTab: ConfigEditorTab = routeSection === 'source' ? 'source' : 'visual';
  const activeVisualSection: VisualSectionId = routeSection === 'source' ? 'server' : routeSection;

  const {
    visualValues,
    visualDirty,
    visualParseError,
    visualValidationErrors,
    visualHasPayloadValidationErrors,
    loadVisualValuesFromYaml,
    applyVisualChangesToYaml,
    setVisualValues,
  } = useVisualConfig();

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [serverYaml, setServerYaml] = useState('');
  const [mergedYaml, setMergedYaml] = useState('');
  const lastVisualParseNotificationRef = useRef('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const editorRef = useRef<ReactCodeMirrorRef | null>(null);

  const disableControls = connectionStatus !== 'connected';
  const isDirty = dirty || visualDirty;
  const hasVisualModeError = !!visualParseError;
  const hasVisualValidationErrors =
    activeTab === 'visual' &&
    (Object.values(visualValidationErrors).some(Boolean) || visualHasPayloadValidationErrors);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await configFileApi.fetchConfigYaml();
      setContent(data);
      setDirty(false);
      setDiffModalOpen(false);
      setServerYaml(data);
      setMergedYaml(data);
      loadVisualValuesFromYaml(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('notification.refresh_failed');
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [loadVisualValuesFromYaml, showNotification, t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!visualParseError) {
      lastVisualParseNotificationRef.current = '';
      return;
    }

    if (activeTab === 'visual') {
      navigate('/config/source', { replace: true });
    }

    if (lastVisualParseNotificationRef.current !== visualParseError) {
      lastVisualParseNotificationRef.current = visualParseError;
      showNotification(
        t('config_management.visual_mode_unavailable_detail', { message: visualParseError }),
        'error'
      );
    }
  }, [activeTab, navigate, showNotification, t, visualParseError]);

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const previousCommercialMode = readCommercialModeFromYaml(serverYaml);
      const nextCommercialMode = readCommercialModeFromYaml(mergedYaml);
      const commercialModeChanged = previousCommercialMode !== nextCommercialMode;

      await configFileApi.saveConfigYaml(mergedYaml);
      const latestContent = await configFileApi.fetchConfigYaml();
      setDirty(false);
      setDiffModalOpen(false);
      setContent(latestContent);
      setServerYaml(latestContent);
      setMergedYaml(latestContent);
      loadVisualValuesFromYaml(latestContent);

      // Keep the global config store in sync so sidebar / other pages reflect YAML changes immediately.
      try {
        useConfigStore.getState().clearCache();
        await useConfigStore.getState().fetchConfig(undefined, true);
      } catch (refreshError: unknown) {
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : typeof refreshError === 'string'
              ? refreshError
              : '';
        showNotification(
          `${t('notification.refresh_failed')}${message ? `: ${message}` : ''}`,
          'error'
        );
      }

      showNotification(t('config_management.save_success'), 'success');
      if (commercialModeChanged) {
        showNotification(t('notification.commercial_mode_restart_required'), 'warning');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('notification.save_failed')}: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === 'visual' && visualParseError) {
      showNotification(t('config_management.visual_mode_save_blocked'), 'error');
      return;
    }

    setSaving(true);
    try {
      const latestServerYaml = await configFileApi.fetchConfigYaml();

      const visualBaseYaml = dirty ? content : latestServerYaml;

      if (activeTab !== 'source') {
        const latestDocument = parseDocument(latestServerYaml);
        if (latestDocument.errors.length > 0) {
          showNotification(
            t('config_management.visual_mode_latest_yaml_invalid', {
              message:
                latestDocument.errors[0]?.message ??
                t('config_management.visual_mode_save_blocked'),
            }),
            'error'
          );
          return;
        }

        if (visualBaseYaml !== latestServerYaml) {
          const visualBaseDocument = parseDocument(visualBaseYaml);
          if (visualBaseDocument.errors.length > 0) {
            showNotification(
              t('config_management.visual_mode_latest_yaml_invalid', {
                message:
                  visualBaseDocument.errors[0]?.message ??
                  t('config_management.visual_mode_save_blocked'),
              }),
              'error'
            );
            return;
          }
        }
      }

      // In source mode, save exactly what the user edited. In visual mode, preserve the
      // local source draft when it has unsaved edits so source-only backend fields are not dropped.
      const nextMergedYaml =
        activeTab === 'source' ? content : applyVisualChangesToYaml(visualBaseYaml);

      // In visual mode, applyVisualChangesToYaml re-serializes YAML via parseDocument → toString,
      // which may reformat comments/whitespace. Normalize the server YAML through the same pipeline
      // so the diff only shows actual value changes, not cosmetic reformatting.
      let diffOriginal = latestServerYaml;
      if (activeTab !== 'source') {
        diffOriginal = normalizeYamlForVisualDiff(latestServerYaml);
      }

      if (diffOriginal === nextMergedYaml) {
        setDirty(false);
        setContent(latestServerYaml);
        setServerYaml(latestServerYaml);
        setMergedYaml(nextMergedYaml);
        loadVisualValuesFromYaml(latestServerYaml);
        showNotification(t('config_management.diff.no_changes'), 'info');
        return;
      }

      setServerYaml(diffOriginal);
      setMergedYaml(nextMergedYaml);
      setDiffModalOpen(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('notification.save_failed')}: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = useCallback((value: string) => {
    setContent(value);
    setDirty(true);
  }, []);

  const handleTabChange = useCallback(
    (tab: ConfigEditorTab) => {
      if (tab === activeTab) return;

      if (tab === 'source') {
        // Only rewrite YAML when there are pending visual changes; otherwise preserve raw YAML + comments.
        if (visualDirty) {
          const nextContent = applyVisualChangesToYaml(content);
          if (nextContent !== content) {
            setContent(nextContent);
            setDirty(true);
          }
        }
        navigate('/config/source');
      } else {
        const result = loadVisualValuesFromYaml(content);
        if (!result.ok) {
          showNotification(
            t('config_management.visual_mode_unavailable_detail', { message: result.error }),
            'error'
          );
          return;
        }
        navigate(`/config/${activeVisualSection}`);
      }
    },
    [
      activeTab,
      activeVisualSection,
      applyVisualChangesToYaml,
      content,
      loadVisualValuesFromYaml,
      navigate,
      showNotification,
      t,
      visualDirty,
    ]
  );

  // Search functionality
  const performSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next') => {
    if (!query || !editorRef.current?.view) return;

    const view = editorRef.current.view;
    const doc = view.state.doc.toString();
    const matches: number[] = [];
    const lowerQuery = query.toLowerCase();
    const lowerDoc = doc.toLowerCase();

    let pos = 0;
    while (pos < lowerDoc.length) {
      const index = lowerDoc.indexOf(lowerQuery, pos);
      if (index === -1) break;
      matches.push(index);
      pos = index + 1;
    }

    if (matches.length === 0) {
      setSearchResults({ current: 0, total: 0 });
      return;
    }

    // Find current match based on cursor position
    const selection = view.state.selection.main;
    const cursorPos = direction === 'prev' ? selection.from : selection.to;
    let currentIndex = 0;

    if (direction === 'next') {
      // Find next match after cursor
      for (let i = 0; i < matches.length; i++) {
        if (matches[i] > cursorPos) {
          currentIndex = i;
          break;
        }
        // If no match after cursor, wrap to first
        if (i === matches.length - 1) {
          currentIndex = 0;
        }
      }
    } else {
      // Find previous match before cursor
      for (let i = matches.length - 1; i >= 0; i--) {
        if (matches[i] < cursorPos) {
          currentIndex = i;
          break;
        }
        // If no match before cursor, wrap to last
        if (i === 0) {
          currentIndex = matches.length - 1;
        }
      }
    }

    const matchPos = matches[currentIndex];
    setSearchResults({ current: currentIndex + 1, total: matches.length });

    // Scroll to and select the match
    view.dispatch({
      selection: { anchor: matchPos, head: matchPos + query.length },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    // Do not auto-search on each keystroke. Clear previous results when query changes.
    if (!value) {
      setSearchResults({ current: 0, total: 0 });
      setLastSearchedQuery('');
    } else {
      setSearchResults({ current: 0, total: 0 });
    }
  }, []);

  const executeSearch = useCallback(
    (direction: 'next' | 'prev' = 'next') => {
      if (!searchQuery) return;
      setLastSearchedQuery(searchQuery);
      performSearch(searchQuery, direction);
    },
    [searchQuery, performSearch]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch(e.shiftKey ? 'prev' : 'next');
      }
    },
    [executeSearch]
  );

  const handlePrevMatch = useCallback(() => {
    if (!lastSearchedQuery) return;
    performSearch(lastSearchedQuery, 'prev');
  }, [lastSearchedQuery, performSearch]);

  const handleNextMatch = useCallback(() => {
    if (!lastSearchedQuery) return;
    performSearch(lastSearchedQuery, 'next');
  }, [lastSearchedQuery, performSearch]);

  const handleReload = useCallback(() => {
    if (!isDirty) {
      void loadConfig();
      return;
    }

    showConfirmation({
      title: t('common.unsaved_changes_title'),
      message: t('config_management.reload_confirm_message'),
      confirmText: t('config_management.reload'),
      cancelText: t('common.cancel'),
      variant: 'danger',
      onConfirm: async () => {
        await loadConfig();
      },
    });
  }, [isDirty, loadConfig, showConfirmation, t]);

  const pageActions = useMemo(
    () => (
      <div className={styles.pageActions}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReload}
          disabled={loading || saving}
        >
          <RefreshCwIcon data-icon="inline-start" className={loading ? styles.spinIcon : undefined} />
          {t('config_management.reload')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={
            disableControls ||
            loading ||
            saving ||
            !isDirty ||
            diffModalOpen ||
            hasVisualModeError ||
            hasVisualValidationErrors
          }
        >
          <CheckIcon data-icon="inline-start" />
          {t('config_management.save')}
        </Button>
      </div>
    ),
    [
      diffModalOpen,
      disableControls,
      handleReload,
      handleSave,
      hasVisualModeError,
      hasVisualValidationErrors,
      isDirty,
      loading,
      saving,
      t,
    ]
  );

  const configSkeleton = (
    <div className={styles.configSkeleton} aria-label={t('config_management.status_loading')}>
      <div className={styles.skeletonHeader}>
        <Skeleton className={styles.skeletonTitle} />
        <Skeleton className={styles.skeletonAction} />
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.skeletonPanel}>
            <Skeleton className={styles.skeletonLineWide} />
            <Skeleton className={styles.skeletonLine} />
            <Skeleton className={styles.skeletonControl} />
          </div>
        ))}
      </div>
    </div>
  );

  if (invalidSection) {
    return <Navigate to="/config/server" replace />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderCopy}>
          <h1 className={styles.pageTitle}>{t('config_management.title')}</h1>
          <p className={styles.pageDescription}>{t('config_management.description')}</p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => handleTabChange(value as ConfigEditorTab)}
        className={styles.workspaceTabs}
      >
        <Card className={styles.workspaceShell}>
          <CardHeader className={styles.workspaceHeader}>
            <CardAction className={styles.tabsAction}>
              <TabsList className={styles.tabsList}>
                <TabsTrigger value="visual" disabled={saving || loading}>
                  <SlidersHorizontalIcon data-icon="inline-start" />
                  {t('config_management.tabs.visual', { defaultValue: '可视化编辑' })}
                </TabsTrigger>
                <TabsTrigger value="source" disabled={saving || loading}>
                  <TerminalSquareIcon data-icon="inline-start" />
                  {t('config_management.tabs.source', { defaultValue: '源代码编辑' })}
                </TabsTrigger>
              </TabsList>
            </CardAction>
          </CardHeader>

          <CardContent className={styles.content}>
            <TabsContent value="visual" className={styles.tabContent}>
              {loading ? (
                configSkeleton
              ) : (
                <VisualConfigEditor
                  activeSectionId={activeVisualSection}
                  values={visualValues}
                  validationErrors={visualValidationErrors}
                  hasPayloadValidationErrors={visualHasPayloadValidationErrors}
                  disabled={disableControls || loading}
                  pageActions={pageActions}
                  onChange={setVisualValues}
                />
              )}
            </TabsContent>

            <TabsContent value="source" className={styles.tabContent}>
              {loading ? (
                configSkeleton
              ) : (
                <div className={styles.sourceWorkspace}>
                <div className={styles.sourceToolbar}>
                  <div className={styles.searchInputWrapper}>
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={t('config_management.search_placeholder', {
                        defaultValue: '搜索配置内容...',
                      })}
                      disabled={disableControls || loading}
                      className={styles.searchInput}
                      rightElement={
                        <div className={styles.searchRight}>
                          {searchQuery && lastSearchedQuery === searchQuery && (
                            <Badge variant="outline" className={styles.searchCount}>
                              {searchResults.total > 0
                                ? `${searchResults.current} / ${searchResults.total}`
                                : t('config_management.search_no_results', {
                                    defaultValue: '无结果',
                                  })}
                            </Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => executeSearch('next')}
                            disabled={!searchQuery || disableControls || loading}
                            title={t('config_management.search_button', { defaultValue: '搜索' })}
                          >
                            <SearchIcon />
                          </Button>
                        </div>
                      }
                    />
                  </div>

                  <div className={styles.searchActions}>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={handlePrevMatch}
                      disabled={
                        !searchQuery ||
                        lastSearchedQuery !== searchQuery ||
                        searchResults.total === 0
                      }
                      title={t('config_management.search_prev', { defaultValue: '上一个' })}
                    >
                      <ChevronUpIcon />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={handleNextMatch}
                      disabled={
                        !searchQuery ||
                        lastSearchedQuery !== searchQuery ||
                        searchResults.total === 0
                      }
                      title={t('config_management.search_next', { defaultValue: '下一个' })}
                    >
                      <ChevronDownIcon />
                    </Button>
                  </div>
                  <div className={styles.sourcePageActions}>{pageActions}</div>
                </div>

                <div className={styles.editorWrapper}>
                  <Suspense fallback={configSkeleton}>
                    <LazyConfigSourceEditor
                      editorRef={editorRef}
                      value={content}
                      onChange={handleChange}
                      theme={resolvedTheme}
                      editable={!disableControls && !loading}
                      placeholder={t('config_management.editor_placeholder')}
                    />
                  </Suspense>
                </div>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <DiffModal
        open={diffModalOpen}
        original={serverYaml}
        modified={mergedYaml}
        onConfirm={handleConfirmSave}
        onCancel={() => setDiffModalOpen(false)}
        loading={saving}
      />
    </div>
  );
}
