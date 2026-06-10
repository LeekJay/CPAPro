import type { ComponentProps, ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheckIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  MonitorCogIcon,
} from 'lucide-react';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar-context';
import { cn } from '@/lib/utils';

export interface SidebarNavItem {
  path: string;
  label: string;
  meta: string;
  icon: ReactNode;
}

export interface SidebarNavGroup {
  id: string;
  label: string;
  items: SidebarNavItem[];
}

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  apiBase: string;
  navGroups: SidebarNavGroup[];
  onLogout: () => void;
}

const normalizePath = (pathname: string) => {
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return trimmed === '/dashboard' ? '/' : trimmed;
};

function isItemActive(pathname: string, itemPath: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(itemPath);

  if (target === '/') {
    return current === '/';
  }

  return current === target || current.startsWith(`${target}/`);
}

function SidebarNavLink({ item }: { item: SidebarNavItem }) {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const active = isItemActive(location.pathname, item.path);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <NavLink to={item.path} onClick={() => setOpenMobile(false)}>
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ apiBase, navGroups, onLogout, ...props }: AppSidebarProps) {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const displayApiBase = apiBase || t('common.disconnected_status', { defaultValue: 'Disconnected' });

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <img src={INLINE_LOGO_JPEG} alt="CPAPro" className="size-8 rounded-lg object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
                  <span className="truncate text-sm font-medium leading-none">{t('title.abbr')}</span>
                  <span className="truncate text-xs leading-none text-sidebar-foreground/70">CLIProxyAPI panel</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarNavLink key={item.path} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">CP</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
                    <span className="truncate text-sm font-medium leading-none">{t('common.connected_status')}</span>
                    <span className="truncate text-xs leading-none text-sidebar-foreground/70">{displayApiBase}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">CP</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
                      <span className="truncate text-sm font-medium leading-none">CPAPro</span>
                      <span className="truncate text-xs leading-none text-muted-foreground">{displayApiBase}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <NavLink to="/system" className={cn('cursor-default')}>
                      <MonitorCogIcon />
                      {t('nav.system_info')}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink to="/config" className={cn('cursor-default')}>
                      <BadgeCheckIcon />
                      {t('nav.config_management')}
                    </NavLink>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onLogout}>
                  <LogOutIcon />
                  {t('header.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
