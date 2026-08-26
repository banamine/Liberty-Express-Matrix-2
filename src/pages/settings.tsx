import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Github, Webhook, Loader2, Download, TerminalSquare } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { telemetry } from '../lib/telemetry';
import { useState } from 'react';
import { TelemetryViewer } from '../components/TelemetryViewer';

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTelemetry, setShowTelemetry] = useState(false);
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    staleTime: 60000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json() as Promise<Record<string, string>>;
    }
  });

  const mutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Settings saved', description: 'Your configuration has been updated.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const handleFallbackToggle = (checked: boolean) => {
    mutation.mutate({ AJ_LEGACY_FALLBACK: checked ? 'true' : 'false' });
  };

  const handleExportTelemetry = () => {
    try {
      const data = telemetry.exportAsString();
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telemetry-${new Date().toISOString()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Export Successful', description: 'Telemetry data downloaded.' });
      telemetry.info('system', 'Exported telemetry data');
    } catch (err: any) {
      toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const legacyFallback = settings?.AJ_LEGACY_FALLBACK === 'true';

  return (
    <div className="space-y-6 max-w-4xl">
      {showTelemetry && <TelemetryViewer onClose={() => setShowTelemetry(false)} />}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground mt-2">Configure database connections, external APIs, and application behavior.</p>
        </div>
        <Button variant="outline" onClick={() => setShowTelemetry(true)} className="gap-2">
          <TerminalSquare className="h-4 w-4" />
          Debug Telemetry
        </Button>
      </div>

      <div className="grid gap-6">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <TerminalSquare className="h-5 w-5 text-primary" />
            Telemetry & Debugging
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Download locally captured telemetry events. This data is not sent anywhere automatically.</p>
            <Button onClick={handleExportTelemetry} className="gap-2">
              <Download className="h-4 w-4" />
              Export Telemetry
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-primary" />
            Database Configuration
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Neon Postgres URL (DATABASE_URL)</Label>
              <Input 
                type="password"
                placeholder="postgresql://..." 
                value={settings?.DATABASE_URL || ""}
                readOnly
                disabled
              />
              <p className="text-xs text-muted-foreground">Configured via environment variables.</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <Github className="h-5 w-5 text-primary" />
            GitHub Integration
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Personal Access Token (GITHUB_TOKEN)</Label>
              <Input 
                type="password"
                placeholder="ghp_..." 
                value={settings?.GITHUB_TOKEN || ""}
                readOnly
                disabled
              />
              <p className="text-xs text-muted-foreground">Configured via environment variables.</p>
            </div>
            <Button variant="secondary" onClick={() => toast({ title: 'Sync Triggered', description: 'GitHub sync triggered' })}>
              Sync Repository
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <Webhook className="h-5 w-5 text-primary" />
            Watchdog Configuration
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">AJ_LEGACY_FALLBACK</Label>
                <p className="text-sm text-muted-foreground">Enable legacy segments feed when live HD falls behind.</p>
              </div>
              <Switch 
                checked={legacyFallback}
                onCheckedChange={handleFallbackToggle}
                disabled={mutation.isPending}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
