import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { SlideOutGuide } from '../SlideOutGuide';
import { Button } from '../ui/button';
import { Tv, Menu } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useSwipeToClose } from '@/src/hooks/useSwipeToClose';

export function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { handlers: swipeHandlers, style: swipeStyle } = useSwipeToClose({
    onClose: () => setSidebarOpen(false),
    direction: 'left',
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar - Fixed on desktop, sliding drawer on mobile */}
      <div 
        {...swipeHandlers}
        style={{ ...swipeStyle }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-muted/20 transform transition-transform duration-300",
          "md:relative md:translate-x-0 md:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ContextBar placeholder */}
        <header className="flex h-14 items-center border-b bg-card px-4 lg:px-8 shrink-0">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden min-h-[44px] min-w-[44px]" 
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold">Workspace</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsGuideOpen(true)}
                className="flex items-center gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors min-h-[44px] px-4"
              >
                <Tv className="w-4 h-4" />
                <span className="hidden sm:inline-block">Live Guide</span>
              </Button>
            </div>
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-8">
          {children}
        </main>
      </div>

      <SlideOutGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
