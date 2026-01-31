import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  Package,
  QrCode,
  Barcode,
  BarChart3,
  Settings,
  LogOut,
  User,
  TrendingUp,
  TrendingDown,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useShopSettings } from '@/hooks/useShopSettings';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

const adminItems = [{ icon: Shield, label: "Admin", href: "/admin" }];

const primaryItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Package, label: 'Inventory', href: '/inventory' },
  { icon: TrendingUp, label: 'Sales', href: '/sales' },
  { icon: TrendingDown, label: 'Purchases', href: '/purchases' },
  { icon: BarChart3, label: 'Reports', href: '/reports' },
];

const peopleItems = [
  { icon: User, label: 'Customers', href: '/customers' },
  { icon: User, label: 'Suppliers', href: '/suppliers' },
  { icon: User, label: 'Employees', href: '/employees' },
];

const toolsItems = [
  { icon: Barcode, label: 'Barcode Printing', href: '/barcode-printing' },
  { icon: QrCode, label: 'Scan', href: '/scan' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

function NavSectionLabel({ children }: { children: string }) {
  return <div className="px-3 pt-3 pb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{children}</div>;
}

function NavItem(props: { href: string; label: string; icon: any; isActive: boolean }) {
  const { href, label, icon: Icon, isActive } = props;
  return (
    <Link
      to={href}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all',
        isActive
          ? 'bg-primary text-primary-foreground shadow-soft'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeSidebar"
          className="absolute inset-0 bg-primary rounded-xl"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ zIndex: -1 }}
        />
      )}
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { settings: shopSettings } = useShopSettings();

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-card border-r border-border z-40">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          {shopSettings?.logo_url ? (
            <img
              src={shopSettings.logo_url}
              alt={`${shopSettings.shop_name || 'Shop'} logo`}
              className="w-10 h-10 rounded-xl object-cover border border-border"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-semibold text-foreground truncate">
              {shopSettings?.shop_name || 'SuitStock'}
            </h1>
            <p className="text-xs text-muted-foreground hindi truncate">
              {shopSettings?.shop_name_hindi || 'सूट स्टॉक'}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <NavSectionLabel>Main</NavSectionLabel>
        <div className="space-y-1">
          {primaryItems.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            return <NavItem key={item.href} {...item} isActive={isActive} />;
          })}
        </div>

        <NavSectionLabel>People</NavSectionLabel>
        <div className="space-y-1">
          {peopleItems.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            return <NavItem key={item.href} {...item} isActive={isActive} />;
          })}
        </div>

        <Collapsible
          defaultOpen={toolsItems.some((i) => location.pathname === i.href || location.pathname.startsWith(i.href))}
        >
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tools</div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Toggle
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="space-y-1">
              {toolsItems.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href);
                return <NavItem key={item.href} {...item} isActive={isActive} />;
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {isPlatformAdmin && (
          <>
            <NavSectionLabel>Admin</NavSectionLabel>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href);
                return <NavItem key={item.href} {...item} isActive={isActive} />;
              })}
            </div>
          </>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-3">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
