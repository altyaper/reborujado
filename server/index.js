import express from 'express';
import multer from 'multer';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
app.post('/api/reverse', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Audio file required' });
  const dir = await mkdtemp(join(tmpdir(), 'reborujado-'));
  try {
    const input = join(dir, 'input.webm');
    const output = join(dir, 'reversed.wav');
    await writeFile(input, req.file.buffer);
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-t', '10', '-af', 'areverse', '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', output]);
      let stderr = '';
      ff.stderr.on('data', d => { stderr += d.toString().slice(0, 1000); });
      ff.on('error', reject);
      ff.on('close', code => code === 0 ? resolve() : reject(new Error(stderr || 'Audio conversion failed')));
    });
    res.type('audio/wav').send(await readFile(output));
  } catch (error) {
    console.error(error);
    res.status(422).json({ error: 'Unable to process audio. Try recording again.' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
app.use(express.static('public'));
app.get('*', (req, res) => res.sendFile(join(process.cwd(), 'public', 'index.html')));
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(413).json({ error: 'Recording too large' });
  res.status(500).json({ error: 'Unexpected server error' });
});
app.listen(process.env.PORT || 3001, () => console.log('Reborujado listening'));
