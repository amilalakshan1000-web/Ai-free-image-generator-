import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import { Readable } from 'stream';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// OAuth routes
app.get('/api/auth/url', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ 
      error: 'Google OAuth credentials are not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your secrets.' 
    });
  }

  const redirectUri = req.query.redirectUri as string;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const scopes = ['https://www.googleapis.com/auth/drive.file'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: redirectUri,
    prompt: 'consent'
  });

  res.json({ url });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, state } = req.query;
  const redirectUri = state as string;
  
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    const { tokens } = await oauth2Client.getToken(code as string);
    
    res.cookie('google_tokens', JSON.stringify(tokens), {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/auth/status', (req, res) => {
  const tokens = req.cookies.google_tokens;
  res.json({ connected: !!tokens });
});

app.post('/api/drive/upload', async (req, res) => {
  try {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) {
      return res.status(401).json({ error: 'Not authenticated with Google Drive' });
    }

    const tokens = JSON.parse(tokensStr);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const { image, filename } = req.body;
    const matches = image.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: filename,
    };
    const media = {
      mimeType: mimeType,
      body: stream,
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    res.json({ success: true, fileId: file.data.id, url: file.data.webViewLink });
  } catch (error: any) {
    console.error('Drive upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload to Drive' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
