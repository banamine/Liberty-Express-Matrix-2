import React, { useState, useRef } from 'react';
import { Upload, FileUp, Loader2, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';

export default function UploadParse() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [urls, setUrls] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('/api/episodes/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Upload failed');
      setSuccessMsg(`Successfully parsed and imported ${data.count} episodes.`);
      queryClient.invalidateQueries({ queryKey: ['/api/episodes'] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlImport = async () => {
    if (!urls.trim()) return;
    
    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);
    
    const urlList = urls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http://') || u.startsWith('https://'));

    if (urlList.length === 0) {
      setError('Please enter at least one valid URL starting with http:// or https://');
      setIsUploading(false);
      return;
    }

    try {
      const res = await fetch('/api/episodes/import-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Import failed');
      setSuccessMsg(`Successfully imported ${data.count} episodes from ${urlList.length} URL(s).`);
      setUrls('');
      queryClient.invalidateQueries({ queryKey: ['/api/episodes'] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ingest & Import Modules</h2>
        <p className="text-muted-foreground mt-2">Import M3U playlists, CSV files, or bulk URLs into the Matrix database.</p>
      </div>

      <Tabs defaultValue="file" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="file">File Upload</TabsTrigger>
          <TabsTrigger value="url">Bulk URLs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="file" className="mt-0 space-y-4">
          <div 
            className={`rounded-xl border-2 border-dashed ${isDragging ? 'border-primary bg-primary/5' : 'border-border'} flex flex-col items-center justify-center p-12 text-center transition-colors cursor-pointer bg-card`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleChange}
              accept=".m3u,.m3u8,.csv,.json"
            />
            
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium">Parsing and ingesting data...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">Drag & Drop Playlists</h3>
                <p className="text-muted-foreground mb-6">Supports M3U, M3U8, and CSV up to 50MB</p>
                <Button className="pointer-events-none">
                  <Upload className="mr-2 h-4 w-4" />
                  Browse Files
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-0">
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Import from URLs</h3>
              <p className="text-sm text-muted-foreground">
                Paste one or more URLs (M3U, M3U8, or direct media links) below. Each URL must be on a new line.
              </p>
            </div>
            
            <Textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com/playlist.m3u&#10;https://example.com/video.mp4"
              className="min-h-[200px] font-mono text-sm"
              disabled={isUploading}
            />
            
            <div className="flex justify-end">
              <Button onClick={handleUrlImport} disabled={isUploading || !urls.trim()}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Import URLs
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive font-medium flex items-center">
          <div className="mr-3">Error:</div>
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-md text-primary font-medium flex items-center">
          <CheckCircle2 className="mr-3 h-5 w-5" />
          <div>{successMsg}</div>
        </div>
      )}
    </div>
  );
}
