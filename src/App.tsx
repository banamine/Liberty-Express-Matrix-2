import React from 'react';
import { Route, Switch } from 'wouter';
import { WorkbenchLayout } from './components/layout/WorkbenchLayout';
import Dashboard from './pages/dashboard';
import UploadParse from './pages/upload';
import EpisodeDB from './pages/episodes';
import Player1 from './pages/player1';
import Player2 from './pages/player2';
import TVPlayer from './pages/tv';
import Scheduler1 from './pages/scheduler';
import ArchiveQueue from './pages/archive';
import Settings from './pages/settings';
import NewsPlayer from './pages/news-player';
import SeriesWorkbench from './pages/series-workbench';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <WorkbenchLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/upload" component={UploadParse} />
          <Route path="/episodes" component={EpisodeDB} />
          <Route path="/archive" component={ArchiveQueue} />
          <Route path="/series-workbench" component={SeriesWorkbench} />
          <Route path="/scheduler" component={Scheduler1} />
          <Route path="/player1" component={Player1} />
          <Route path="/player2" component={Player2} />
          <Route path="/tv" component={TVPlayer} />
          <Route path="/news-player" component={NewsPlayer} />
          <Route path="/tvnews-player" component={NewsPlayer} />
          <Route path="/settings" component={Settings} />
          <Route>
            <div className="flex h-[50vh] flex-col items-center justify-center text-center">
              <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
              <p className="mt-2 text-lg text-muted-foreground">Module not found.</p>
            </div>
          </Route>
        </Switch>
      </WorkbenchLayout>
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}
