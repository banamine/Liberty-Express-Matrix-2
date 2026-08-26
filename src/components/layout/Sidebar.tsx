import { Link, useLocation } from "wouter";
import { Tv, Upload, CalendarDays, Archive, Settings, ListVideo, Layers } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const [location] = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Tv },
    { name: 'Upload & Parse', href: '/upload', icon: Upload },
    { name: 'Episode DB', href: '/episodes', icon: ListVideo },
    { name: 'Archive Queue', href: '/archive', icon: Archive },
    { name: 'Series Ingestion', href: '/series-workbench', icon: Layers },
    { name: 'Scheduler (P1)', href: '/scheduler', icon: CalendarDays },
    { name: 'Player 1 (Linear)', href: '/player1', icon: Layers },
    { name: 'Live Player 2 (AJ)', href: '/player2', icon: Layers },
    { name: 'TV Player', href: '/tv', icon: Tv },
    { name: 'News Player', href: '/news-player', icon: Tv },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className={cn("flex h-full w-64 flex-col border-r bg-muted/20", className)}>
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2 font-bold tracking-tight text-primary">
          <Tv className="h-5 w-5" />
          <span>MATRIX STRIPPER</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} onClick={onClose} className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          v3.0.0 (Two-Paddock)
        </div>
      </div>
    </div>
  );
}
