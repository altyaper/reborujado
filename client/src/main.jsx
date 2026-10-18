import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [stage, setStage] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const [audio, setAudio] = useState([null, null]);
  const [error, setError] = useState('');
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const urls = useRef([]);

  useEffect(() => () => {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    urls.current.forEach(URL.revokeObjectURL);
  }, []);

  async function begin() {
    setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(x => MediaRecorder.isTypeSupported(x));
      const r = new MediaRecorder(media, mime ? { mimeType: mime } : {});
      recorder.current = r;
      const chunks = [];
      r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      r.onstop = async () => {
        clearInterval(timer.current);
        media.getTracks().forEach(t => t.stop());
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunks, { type: r.mimeType });
          const form = new FormData();
          form.append('audio', blob, 'recording');
          const response = await fetch('/api/reverse', { method: 'POST', body: form });
          if (!response.ok) throw new Error((await response.json()).error || 'Conversion failed');
          const url = URL.createObjectURL(await response.blob());
          urls.current.push(url);
          setAudio(old => { const next = [...old]; next[stage === 0 ? 0 : 1] = url; return next; });
          setStage(old => old === 0 ? 1 : 3);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
      };
      r.start();
      setRecording(true);
      setSeconds(10);
      let remaining = 10;
      timer.current = setInterval(() => {
        remaining -= 1;
        setSeconds(remaining);
        if (remaining <= 0) stop();
      }, 1000);
    } catch (e) { setError('Microphone access denied or unavailable. Use localhost or HTTPS.'); }
  }
  function stop() {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }
  function reset() {
    if (recording) stop();
    setAudio([null, null]); setStage(0); setError(''); setSeconds(10);
  }
  return <main>
    <div className="logo">↶ <span>REBORUJADO</span> ↷</div>
    <h1>Can you speak <em>backwards?</em></h1>
    <p className="subtitle">A hilarious two-player audio challenge.</p>
    <section className="panel">
      <div className="steps"><span className={stage === 0 ? 'active' : ''}>1 · Original</span><span className={stage === 1 || stage === 2 ? 'active' : ''}>2 · Imitate</span><span className={stage === 3 ? 'active' : ''}>3 · Reveal</span></div>
      {stage === 0 && <><h2>Player 1: Say something!</h2><p>Record a word or short phrase. You have 10 seconds.</p></>}
      {stage === 1 && <><h2>Listen to the reversed sound</h2><p>Player 2, listen carefully and try to copy it exactly.</p><audio controls src={audio[0]}/><button onClick={() => setStage(2)}>I'm ready to imitate →</button></>}
      {stage === 2 && <><h2>Player 2: Copy the sound!</h2><p>Record your best imitation of what you just heard.</p><audio controls src={audio[0]}/></>}
      {stage === 3 && <><h2>The big reveal!</h2><p>Here's Player 2's imitation reversed. Does it sound like the original?</p><audio controls src={audio[1]}/><p>Compare it with Player 1's reversed sound:</p><audio controls src={audio[0]}/><button onClick={reset}>↻ Play again</button></>}
      {(stage === 0 || stage === 2) && <><div className="countdown">{recording ? seconds + 's' : '🎙️'}</div><button disabled={busy} onClick={recording ? stop : begin}>{busy ? 'Reversing audio…' : recording ? '■ Stop recording' : '● Start recording'}</button></>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    <footer>No accounts. No saved recordings. Just fun.</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
