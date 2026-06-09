import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  GaugeIcon,
  KeyRoundIcon,
  LanguagesIcon,
  LayoutDashboardIcon,
  MoonIcon,
  NetworkIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  ServerCogIcon,
  Settings2Icon,
  SunIcon,
  WaypointsIcon,
} from 'lucide-react';
import { AppSidebar, type SidebarNavGroup } from '@/components/app-sidebar';
import { PageTransition } from '@/components/common/PageTransition';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { MainRoutes } from '@/router/MainRoutes';
import {
  useAuthStore,
  useConfigStore,
  useLanguageStore,
  useNotificationStore,
  useThemeStore,
} from '@/stores';
import { triggerHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';
import { cn } from '@/lib/utils';
import type { Theme } from '@/types';

const THEME_OPTIONS: Array<{ key: Theme; labelKey: string }> = [
  { key: 'auto', labelKey: 'theme.auto' },
  { key: 'white', labelKey: 'theme.white' },
  { key: 'light', labelKey: 'theme.light' },
  { key: 'dark', labelKey: 'theme.dark' },
];

const normalizePath = (pathname: string) => {
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return trimmed === '/dashboard' ? '/' : trimmed;
};

const matchesNavItem = (pathname: string, itemPath: string) => {
  const current = normalizePath(pathname);
  const target = normalizePath(itemPath);

  if (target === '/') {
    return current === '/';
  }

  return current === target || current.startsWith(`${target}/`);
};

export function MainLayout() {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const location = useLocation();

  const apiBase = useAuthStore((state) => state.apiBase);
  const logout = useAuthStore((state) => state.logout);

  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);

  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const isLogsPage = location.pathname.startsWith('/logs');

  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight;
      if (height) {
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && headerRef.current
        ? new ResizeObserver(updateHeaderHeight)
        : null;
    if (resizeObserver && headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  useLayoutEffect(() => {
    const updateContentCenter = () => {
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      document.documentElement.style.setProperty('--content-center-x', `${rect.left + rect.width / 2}px`);
    };

    updateContentCenter();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && contentRef.current
        ? new ResizeObserver(updateContentCenter)
        : null;

    if (resizeObserver && contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateContentCenter);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateContentCenter);
      document.documentElement.style.removeProperty('--content-center-x');
    };
  }, []);

  useEffect(() => {
    fetchConfig().catch(() => {
      // Initial failures are surfaced through explicit user actions.
    });
  }, [fetchConfig]);

  const navGroups: SidebarNavGroup[] = useMemo(
    () => [
      {
        id: 'operate',
        label: t('nav_groups.operate'),
        items: [
          {
            path: '/',
            label: t('nav.dashboard'),
            meta: t('nav_meta.dashboard'),
            icon: <LayoutDashboardIcon />,
          },
        ],
      },
      {
        id: 'gateway',
        label: t('nav_groups.gateway'),
        items: [
          {
            path: '/ai-providers',
            label: t('nav.ai_providers'),
            meta: t('nav_meta.ai_providers'),
            icon: <NetworkIcon />,
          },
          {
            path: '/auth-files',
            label: t('nav.auth_files'),
            meta: t('nav_meta.auth_files'),
            icon: <KeyRoundIcon />,
          },
        ],
      },
      {
        id: 'observe',
        label: t('nav_groups.observe'),
        items: [
          {
            path: '/quota',
            label: t('nav.quota_management'),
            meta: t('nav_meta.quota_management'),
            icon: <GaugeIcon />,
          },
          {
            path: '/logs',
            label: t('nav.logs'),
            meta: t('nav_meta.logs'),
            icon: <ScrollTextIcon />,
          },
        ],
      },
      {
        id: 'control',
        label: t('nav_groups.control'),
        items: [
          {
            path: '/config',
            label: t('nav.config_management'),
            meta: t('nav_meta.config_management'),
            icon: <Settings2Icon />,
          },
          {
            path: '/system',
            label: t('nav.system_info'),
            meta: t('nav_meta.system_info'),
            icon: <ServerCogIcon />,
          },
        ],
      },
    ],
    [t]
  );

  const navItems = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups]);
  const navOrder = useMemo(() => navItems.map((item) => item.path), [navItems]);
  const currentItem = navItems.find((item) => matchesNavItem(location.pathname, item.path)) ?? navItems[0];
  const breadcrumbDetail = useMemo(() => {
    const normalizedPath = normalizePath(location.pathname);

    if (normalizedPath === '/auth-files') {
      const tab = new URLSearchParams(location.search).get('tab');
      if (tab === 'oauth-excluded') return t('oauth_excluded.title');
      if (tab === 'oauth-model-alias') return t('oauth_model_alias.title');
      return null;
    }

    if (normalizedPath === '/ai-providers') {
      const tab = new URLSearchParams(location.search).get('tab');
      if (tab === 'codex') return t('providersPage.providerNames.codex');
      if (tab === 'claude') return t('providersPage.providerNames.claude');
      if (tab === 'vertex') return t('providersPage.providerNames.vertex');
      if (tab === 'openaiCompatibility') {
        return t('providersPage.providerNames.openaiCompatibility');
      }
      if (tab === 'ampcode') return t('providersPage.providerNames.ampcode');
      return null;
    }

    if (normalizedPath.startsWith('/auth-files/oauth-excluded')) {
      return t('oauth_excluded.title');
    }

    if (normalizedPath.startsWith('/auth-files/oauth-model-alias')) {
      return t('oauth_model_alias.title');
    }

    if (normalizedPath === '/system') {
      const tab = new URLSearchParams(location.search).get('tab');
      if (tab === 'models') return t('system_info.models_title');
      if (tab === 'links') return t('system_info.quick_links_title');
      return null;
    }

    return null;
  }, [location.pathname, location.search, t]);

  const getRouteOrder = useCallback(
    (pathname: string) => {
      const normalizedPath = normalizePath(pathname);

      const aiProvidersIndex = navOrder.indexOf('/ai-providers');
      if (aiProvidersIndex !== -1) {
        if (normalizedPath === '/ai-providers') return aiProvidersIndex;
        if (normalizedPath.startsWith('/ai-providers/')) {
          if (normalizedPath.startsWith('/ai-providers/gemini')) return aiProvidersIndex + 0.1;
          if (normalizedPath.startsWith('/ai-providers/codex')) return aiProvidersIndex + 0.2;
          if (normalizedPath.startsWith('/ai-providers/claude')) return aiProvidersIndex + 0.3;
          if (normalizedPath.startsWith('/ai-providers/vertex')) return aiProvidersIndex + 0.4;
          if (normalizedPath.startsWith('/ai-providers/ampcode')) return aiProvidersIndex + 0.5;
          if (normalizedPath.startsWith('/ai-providers/openai')) return aiProvidersIndex + 0.6;
          return aiProvidersIndex + 0.05;
        }
      }

      const authFilesIndex = navOrder.indexOf('/auth-files');
      if (authFilesIndex !== -1) {
        if (normalizedPath === '/auth-files') return authFilesIndex;
        if (normalizedPath.startsWith('/auth-files/')) {
          if (normalizedPath.startsWith('/auth-files/oauth-excluded')) return authFilesIndex + 0.1;
          if (normalizedPath.startsWith('/auth-files/oauth-model-alias')) return authFilesIndex + 0.2;
          return authFilesIndex + 0.05;
        }
      }

      const exactIndex = navOrder.indexOf(normalizedPath);
      if (exactIndex !== -1) return exactIndex;
      const nestedIndex = navOrder.findIndex(
        (path) => path !== '/' && normalizedPath.startsWith(`${path}/`)
      );
      return nestedIndex === -1 ? null : nestedIndex;
    },
    [navOrder]
  );

  const getTransitionVariant = useCallback((fromPathname: string, toPathname: string) => {
    const from = normalizePath(fromPathname);
    const to = normalizePath(toPathname);
    const isAuthFiles = (pathname: string) =>
      pathname === '/auth-files' || pathname.startsWith('/auth-files/');
    const isAiProviders = (pathname: string) =>
      pathname === '/ai-providers' || pathname.startsWith('/ai-providers/');
    if (isAuthFiles(from) && isAuthFiles(to)) return 'ios';
    if (isAiProviders(from) && isAiProviders(to)) return 'ios';
    return 'vertical';
  }, []);

  const handleRefreshAll = async () => {
    clearCache();
    const results = await Promise.allSettled([
      fetchConfig(undefined, true),
      triggerHeaderRefresh(),
    ]);
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected && rejected.status === 'rejected') {
      const reason = rejected.reason;
      const message =
        typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : '';
      showNotification(
        `${t('notification.refresh_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
      return;
    }
    showNotification(t('notification.data_refreshed'), 'success');
  };

  const handleLanguageSelect = useCallback(
    (nextLanguage: string) => {
      if (isSupportedLanguage(nextLanguage)) {
        setLanguage(nextLanguage);
      }
    },
    [setLanguage]
  );

  const handleThemeSelect = useCallback(
    (nextTheme: string) => {
      if (THEME_OPTIONS.some((option) => option.key === nextTheme)) {
        setTheme(nextTheme as Theme);
      }
    },
    [setTheme]
  );

  const themeIcon: ReactNode =
    theme === 'dark' ? <MoonIcon /> : theme === 'auto' ? <WaypointsIcon /> : <SunIcon />;

  return (
    <SidebarProvider className="min-h-svh bg-background">
      <AppSidebar apiBase={apiBase} navGroups={navGroups} onLogout={logout} />
      <SidebarInset className="h-svh max-h-svh min-w-0 overflow-hidden bg-background">
        <header
          ref={headerRef}
          className="z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4"
        >
          <SidebarTrigger title={t('sidebar.toggle_collapse', { defaultValue: 'Toggle sidebar' })} />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#/">{t('title.abbr')}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                {breadcrumbDetail ? (
                  <BreadcrumbLink href={`#${currentItem?.path ?? '/'}`}>
                    {currentItem?.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="max-w-[52vw] truncate sm:max-w-none">
                    {currentItem?.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {breadcrumbDetail ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="max-w-[52vw] truncate sm:max-w-none">
                      {breadcrumbDetail}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={handleRefreshAll} title={t('header.refresh_all')}>
              <RefreshCwIcon />
              <span className="sr-only">{t('header.refresh_all')}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" title={t('language.switch')} aria-label={t('language.switch')}>
                  <LanguagesIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel>{t('language.switch')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={language} onValueChange={handleLanguageSelect}>
                  {LANGUAGE_ORDER.map((lang) => (
                    <DropdownMenuRadioItem key={lang} value={lang}>
                      {t(LANGUAGE_LABEL_KEYS[lang])}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" title={t('theme.switch')} aria-label={t('theme.switch')}>
                  {themeIcon}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuLabel>{t('theme.switch')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeSelect}>
                  {THEME_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.key} value={option.key}>
                      {t(option.labelKey)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div
          className={cn(
            'content !h-auto min-h-0 flex-1 !overflow-x-hidden !overflow-y-auto',
            isLogsPage && 'content-logs'
          )}
          ref={contentRef}
        >
          <main
            className={cn(
              'main-content !min-h-0 !gap-6 !overflow-x-hidden !px-4 !py-4 md:!px-6',
              isLogsPage && 'main-content-logs'
            )}
          >
            <PageTransition
              render={(routeLocation) => <MainRoutes location={routeLocation} />}
              getRouteOrder={getRouteOrder}
              getTransitionVariant={getTransitionVariant}
              scrollContainerRef={contentRef}
            />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
