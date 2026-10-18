import React, { useEffect, useRef, useState } from 'react';
import './audio-player.css';

let activeAudio = null;

export function pauseAudioPlayers() {
  activeAudio?.pause();
  activeAudio = null;
}

export function formatTime(value) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// A new source gets a fresh player, including any in-flight playback request.
export default function AudioPlayer(props) {
  return <Player key={props.src || 'empty'} {...props}/>;
}

function Player({ src, label, caption, disabled = false }) {
  const audioRef = useRef(null);
  const mounted = useRef(false);
  const playRequest = useRef(0);
  const durationProbe = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    const audio = audioRef.current;
    return () => {
      mounted.current = false;
      playRequest.current += 1;
      audio.pause();
      if (activeAudio === audio) activeAudio = null;
      durationProbe.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      playRequest.current += 1;
      audioRef.current.pause();
      setPending(false);
      setPlaying(false);
    }
  }, [disabled]);

  async function readDuration() {
    const audio = audioRef.current;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
      return;
    }
    // Some browsers report Infinity for recorded blobs. Decode only when needed,
    // keeping the normal WAV path lightweight and never seeking to a fake time.
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!src?.startsWith('blob:') || !AudioContext || durationProbe.current) return;
    const controller = new AbortController();
    durationProbe.current = controller;
    let context;
    let closing = false;
    const closeContext = () => {
      if (!context || closing || context.state === 'closed') return;
      closing = true;
      context.close().catch(() => {});
    };
    try {
      const response = await fetch(src, { signal: controller.signal });
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted) return;
      context = new AudioContext();
      controller.signal.addEventListener('abort', closeContext, { once: true });
      const buffer = await context.decodeAudioData(bytes);
      if (mounted.current && !controller.signal.aborted && Number.isFinite(buffer.duration) && buffer.duration > 0) {
        setDuration(buffer.duration);
      }
    } catch {
      // Playback still works if a browser cannot decode metadata separately.
      // The final playback position supplies the duration when the clip ends.
    } finally {
      closeContext();
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!src || disabled) return;
    if (playing || pending) {
      playRequest.current += 1;
      audio.pause();
      setPending(false);
      setPlaying(false);
      return;
    }
    if (activeAudio !== audio) pauseAudioPlayers();
    activeAudio = audio;
    const request = ++playRequest.current;
    setError('');
    setPending(true);
    try {
      if (audio.error) audio.load();
      if (audio.ended || (duration > 0 && audio.currentTime >= duration)) audio.currentTime = 0;
      await audio.play();
      if (mounted.current && playRequest.current === request) setPending(false);
    } catch (cause) {
      if (!mounted.current || playRequest.current !== request) return;
      setPending(false);
      setPlaying(false);
      setLoading(false);
      if (activeAudio === audio) activeAudio = null;
      setError(cause?.name === 'NotAllowedError'
        ? 'Playback was blocked. Tap play to try again.'
        : 'Could not play this clip. Tap play to retry.');
    }
  }

  function seek(value) {
    if (disabled || !duration) return;
    const next = Math.min(duration, Math.max(0, Number(value)));
    try {
      audioRef.current.currentTime = next;
      setElapsed(next);
    } catch {
      // Metadata may still be loading; keep the current playback position.
    }
  }

  const progress = duration ? Math.min(100, Math.max(0, elapsed / duration * 100)) : 0;
  const isActive = playing || pending;
  const status = error || (disabled ? 'Paused while recording or processing' : loading ? 'Loading audio…' : playing ? 'Playing' : 'Ready to play');

  return <div className={`audio-player${isActive ? ' is-playing' : ''}${error ? ' has-error' : ''}`} role="group" aria-label={label}>
    <audio ref={audioRef} src={src || undefined} preload="metadata" hidden
      onLoadedMetadata={() => { setLoading(false); readDuration(); }}
      onDurationChange={readDuration}
      onCanPlay={() => setLoading(false)}
      onWaiting={() => setLoading(true)}
      onPlaying={() => setLoading(false)}
      onPlay={() => {
        if (activeAudio !== audioRef.current) pauseAudioPlayers();
        activeAudio = audioRef.current;
        setPlaying(true);
        setPending(false);
      }}
      onPause={() => {
        playRequest.current += 1;
        setPlaying(false);
        setPending(false);
        if (activeAudio === audioRef.current) activeAudio = null;
      }}
      onTimeUpdate={() => setElapsed(audioRef.current.currentTime || 0)}
      onEnded={() => {
        const end = audioRef.current.currentTime;
        if (Number.isFinite(end) && end > 0) {
          setElapsed(end);
          if (!duration) setDuration(end);
        }
        setPlaying(false);
        setPending(false);
        setLoading(false);
        if (activeAudio === audioRef.current) activeAudio = null;
      }}
      onError={() => {
        playRequest.current += 1;
        setError('Could not load this clip. Tap play to retry.');
        setLoading(false);
        setPlaying(false);
        setPending(false);
        if (activeAudio === audioRef.current) activeAudio = null;
      }}/>
    <div className="audio-player__heading">
      <span className="audio-player__caption">{caption}</span>
      <span className="audio-player__wave" aria-hidden="true"><i/><i/><i/><i/><i/></span>
    </div>
    <div className="audio-player__controls">
      <button type="button" className="audio-player__toggle" onClick={togglePlayback} disabled={disabled || !src}
        aria-label={`${isActive ? 'Pause' : 'Play'} ${label}`} title={`${isActive ? 'Pause' : 'Play'} ${label}`}>
        {pending || (playing && loading) ? <span className="audio-player__spinner" aria-hidden="true"/>
          : isActive ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6.5a1 1 0 0 1 0 1.72l-10 6.5A1 1 0 0 1 8 18.5z"/></svg>}
      </button>
      <div className="audio-player__timeline">
        <span className="audio-player__title">{label}</span>
        <input className="audio-player__seek" type="range" min="0" max={duration || 1} step="0.1"
          value={Math.min(elapsed, duration || 0)} disabled={disabled || !duration || !!error}
          onChange={event => seek(event.target.value)}
          onKeyDown={event => {
            if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
              event.preventDefault();
              seek(elapsed + (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1));
            }
          }}
          aria-label={`Seek ${label}`} aria-valuetext={`${formatTime(elapsed)} of ${duration ? formatTime(duration) : 'unknown duration'}`}
          style={{ '--audio-progress': `${progress}%` }}/>
        <div className="audio-player__time" aria-hidden="true"><span>{formatTime(elapsed)}</span><span>{duration ? formatTime(duration) : '–:––'}</span></div>
      </div>
    </div>
    <span className={`audio-player__status${error ? ' audio-player__status--error' : ''}`} role="status">{status}</span>
  </div>;
}
