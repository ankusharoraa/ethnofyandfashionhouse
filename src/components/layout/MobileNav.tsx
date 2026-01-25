import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  Package,
  QrCode,
  Settings,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: Package, label: 'Inventory', href: '/inventory' },
  { icon: TrendingUp, label: 'Sales', href: '/sales' },
  { icon: TrendingDown, label: 'Purchases', href: '/purchases' },
  { icon: QrCode, label: 'Scan', href: '/scan' },
  { icon: Settings, label: 'More', href: '/settings' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-area-bottom md:hidden">
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
                className="relative flex flex-col items-center justify-center touch-target min-w-[72px]"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-1 w-12 h-1 bg-primary rounded-full"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <div
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className={cn('w-5 h-5', isActive && 'stroke-[2.5]')} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
