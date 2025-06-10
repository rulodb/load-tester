import { serve } from 'bun';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = 'results';

function getResultFiles() {
  try {
    const files = readdirSync(RESULTS_DIR)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const filePath = join(RESULTS_DIR, file);
        const stats = statSync(filePath);
        return {
          name: file,
          path: filePath,
          modified: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    return files;
  } catch {
    return [];
  }
}

serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/results') {
      const files = getResultFiles();
      return new Response(JSON.stringify(files), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname.startsWith('/api/result/')) {
      const filename = url.pathname.replace('/api/result/', '');
      try {
        const filePath = join(RESULTS_DIR, filename);
        return new Response(Bun.file(filePath));
      } catch {
        return new Response('File not found', { status: 404 });
      }
    }

    if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
      return new Response(Bun.file('public' + url.pathname));
    }

    return new Response(Bun.file('public/index.html'));
  }
});

console.log('Dashboard running on http://localhost:3000');
