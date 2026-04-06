import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.join(__dirname, '..', 'dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const app = express();
const port = Number(process.env.PORT || 4000);

app.disable('x-powered-by');

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));

  app.use((request, response, next) => {
    if (request.method !== 'GET') {
      next();
      return;
    }

    response.sendFile(frontendIndexPath);
  });
} else {
  app.use((_request, response) => {
    response.status(503).send('Frontend build not found. Run npm run build first.');
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Static app server running on http://localhost:${port}`);
});