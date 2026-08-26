sed -i -e "/app.post('\/api\/telemetry', async/i \\
  app.get('/api/probe', async (req, res) => {\\
    const { url } = req.query;\\
    if (!url || typeof url !== 'string') {\\
      return res.status(400).json({ error: 'Missing url parameter' });\\
    }\\
    try {\\
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });\\
      if (response.ok) {\\
        return res.json({ success: true });\\
      } else {\\
        return res.status(404).json({ success: false, status: response.status });\\
      }\\
    } catch (e: any) {\\
      return res.status(500).json({ success: false, error: e.message });\\
    }\\
  });\\
" server/routes.ts
