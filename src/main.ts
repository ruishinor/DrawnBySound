import { APP_NAME } from './app/config';
import { Renderer } from './core/render/Renderer';
import { MODE_BY_ID, StereoXY, type ModeContext } from './core/render/modes';
import type { AudioFrameSource } from './core/capture/AudioFrameSource';
import { SyntheticSource } from './core/capture/SyntheticSource';
import { decodeAudioFile } from './core/capture/FileAdapter';
import { AudioGraph } from './core/pipeline/AudioGraph';
import { FilePlayer } from './core/pipeline/FilePlayer';
import { MediaFilePlayer } from './core/pipeline/MediaFilePlayer';
import type { TransportPlayer } from './core/pipeline/TransportPlayer';
import { LiveSource } from './core/capture/LiveSource';
import { startMic, type MicHandle } from './core/capture/MicAdapter';
import { startSystemCapture } from './core/capture/SystemCaptureAdapter';
import { detectCapabilities, realtimeSupported } from './core/capture/Capabilities';
import { startOscillator, type OscillatorHandle } from './core/capture/OscillatorSource';
import type { FeatureBus } from './core/pipeline/FeatureBus';
import { createFeatureFrame } from './core/features/FeatureFrame';
import { SettingsStore } from './app/SettingsStore';
import { SettingsPanel } from './app/ui/SettingsPanel';
import { DebugOverlay } from './app/ui/DebugOverlay';
import { COPY } from './app/ui/copy';
import { toRenderParams } from './core/grammar/mappings';
import { PerfMonitor } from './core/diagnostics/PerfMonitor';
import { downloadBlob, timestampedName } from './core/export/StillExport';
import {
  describeAudioEngineFailure,
  describeDecodeFailure,
  describeMicrophoneFailure,
  describePlaybackFailure,
} from './core/capture/AudioErrors';

const WINDOW = 2048;

declare global {
  interface Window {
    __vibrato?: Record<string, (...args: never[]) => unknown>;
  }
}

function setStatus(message: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = message;
}

function fail(message: string): never {
  setStatus(message);
  throw new Error(message);
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function argmax(a: Float32Array): number {
  let m = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[m]) m = i;
  return m;
}

function main(): void {
  document.title = APP_NAME;

  const canvas = document.getElementById('viz') as HTMLCanvasElement | null;
  if (!canvas) fail('Canvas element not found.');

  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) fail(COPY.webgl2Missing);

  const renderer = new Renderer(gl);
  const store = new SettingsStore();
  const perf = new PerfMonitor();
  const overlay = new DebugOverlay();
  const canUseRealtime = realtimeSupported();

  // A source that reports no audio: the trace decays to black (stopped state).
  const SILENCE: AudioFrameSource = { sampleRate: 48000, channels: 2, read: () => false };

  // --- session state ---------------------------------------------------------
  let source: AudioFrameSource = new SyntheticSource();
  let graph: AudioGraph | null = null;
  let liveBus: FeatureBus | null = null;
  let micHandle: MicHandle | null = null;
  let oscHandle: OscillatorHandle | null = null;
  let player: TransportPlayer | null = null;

  const left = new Float32Array(WINDOW);
  const right = new Float32Array(WINDOW);
  const positions = new Float32Array(WINDOW * 2);
  const featureFrame = createFeatureFrame();
  const modeCtx: ModeContext = {
    left,
    right,
    count: WINDOW,
    sampleRate: 48000,
    timeSec: 0,
    gain: 1,
    scale: 0.9,
    spread: 0.5,
    phaseDelaySamples: WINDOW >> 3,
    frame: featureFrame,
  };

  const transportEl = document.getElementById('transport');
  const playPauseBtn = document.getElementById('playpause');
  const seekEl = document.getElementById('seek') as HTMLInputElement | null;
  const timeEl = document.getElementById('time');

  const stopAll = (): void => {
    player?.stop();
    player = null;
    micHandle?.stop();
    micHandle = null;
    oscHandle?.stop();
    oscHandle = null;
    liveBus = null;
    source = SILENCE;
    if (transportEl) transportEl.hidden = true;
    // No active graph source -> no analysis (don't FFT a frozen ring).
    graph?.pauseAnalysis();
  };

  const ensureGraph = async (): Promise<AudioGraph> => {
    graph ??= await AudioGraph.create();
    await graph.resume();
    return graph;
  };

  const activatePlayer = async (
    g: AudioGraph,
    nextPlayer: TransportPlayer,
    label: string,
  ): Promise<void> => {
    g.resumeAnalysis(); // fresh normalizer state per source (§15.4)
    player = nextPlayer;
    liveBus = g.bus;
    source = new LiveSource(g.ring, g.ctx.sampleRate);
    if (transportEl) transportEl.hidden = false;
    if (seekEl) {
      seekEl.max = String(player.duration);
      seekEl.value = '0';
    }
    try {
      await player.play();
      setStatus(`${APP_NAME} — ${label}`);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'NotAllowedError') {
        setStatus(`${APP_NAME} — ${label} · ${describePlaybackFailure(error)}`);
        console.warn('Autoplay did not start:', error);
        return;
      }
      stopAll();
      throw error;
    }
  };

  const startDecodedFile = async (
    g: AudioGraph,
    buffer: AudioBuffer,
    label: string,
  ): Promise<void> => {
    await activatePlayer(g, new FilePlayer(g, buffer), label);
  };

  // --- controls --------------------------------------------------------------
  const panelEl = document.getElementById('panel');
  const panel = panelEl ? new SettingsPanel(panelEl, store, () => {}) : null;
  document.getElementById('settings-btn')?.addEventListener('click', () => panel?.toggle());

  document.getElementById('demo')?.addEventListener('click', () => {
    stopAll();
    source = new SyntheticSource();
    setStatus(`${APP_NAME} — demo signal`);
  });

  // Explicit stop/listening state (PRD §19.1, §23-14): halt all capture and
  // playback; the trace decays to black rather than freezing.
  document.getElementById('stop')?.addEventListener('click', () => {
    stopAll();
    source = SILENCE;
    setStatus(`${APP_NAME} — stopped · not listening`);
  });

  document.getElementById('mic')?.addEventListener('click', () => {
    setStatus(`${APP_NAME} — starting audio engine…`);
    void (async () => {
      let g: AudioGraph;
      try {
        g = await ensureGraph();
      } catch (error) {
        stopAll();
        source = new SyntheticSource();
        setStatus(describeAudioEngineFailure(error));
        console.error('Audio engine start failed:', error);
        return;
      }

      stopAll();
      g.resumeAnalysis();
      setStatus(`${APP_NAME} — requesting microphone permission…`);
      try {
        micHandle = await startMic(g);
        liveBus = g.bus;
        source = new LiveSource(g.ring, g.ctx.sampleRate);
        setStatus(`${APP_NAME} — listening (microphone)`);
      } catch (error) {
        stopAll();
        source = new SyntheticSource();
        setStatus(describeMicrophoneFailure(error));
        console.error('Mic start failed:', error);
      }
    })();
  });

  // System / other-app audio capture (best-effort, PRD §13.4). Returns a status
  // string so the same logic backs both the button and the test hook.
  const startSystemMode = async (): Promise<string> => {
    setStatus(`${APP_NAME} — starting system-audio capture…`);
    let g: AudioGraph;
    try {
      g = await ensureGraph();
    } catch (error) {
      stopAll();
      source = new SyntheticSource();
      const msg = describeAudioEngineFailure(error);
      setStatus(msg);
      console.error('Audio engine start failed:', error);
      return msg;
    }

    stopAll();
    g.resumeAnalysis();
    try {
      micHandle = await startSystemCapture(g); // shares the MicHandle shape
      liveBus = g.bus;
      source = new LiveSource(g.ring, g.ctx.sampleRate);
      const msg = `${APP_NAME} — listening (system audio)`;
      setStatus(msg);
      return msg;
    } catch (error) {
      // Honest failure + fallback (PRD §13.4, §19.4): explain, suggest another mode.
      stopAll();
      const detail = error instanceof Error ? error.message : 'System audio capture failed.';
      const msg = `${detail} ${COPY.systemCaptureLimited}`;
      setStatus(msg);
      console.error('System capture failed:', error);
      source = new SyntheticSource();
      return msg;
    }
  };
  document.getElementById('system')?.addEventListener('click', () => void startSystemMode());

  // Capability-honest UI (PRD §11, §13.1): disable unsupported modes with an
  // explanation rather than misrepresenting them.
  for (const cap of detectCapabilities()) {
    const btn = document.getElementById(cap.id === 'system' ? 'system' : cap.id === 'mic' ? 'mic' : '');
    if (btn instanceof HTMLButtonElement) {
      btn.title = cap.note;
      if (!cap.available) {
        btn.disabled = true;
        btn.textContent = `${cap.label} unavailable`;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
      }
    }
  }

  // The real-time pipeline needs cross-origin isolation (SAB). On hosts without
  // COOP/COEP headers, degrade honestly: demo only, with an explanation (§14.3).
  if (!canUseRealtime) {
    for (const id of ['mic', 'system', 'file']) {
      const el = document.getElementById(id);
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.disabled = true;
        el.title =
          'Live analysis needs cross-origin isolation (COOP/COEP headers). See README → Deployment.';
        el.style.opacity = '0.45';
      }
    }
    setStatus(`${APP_NAME} — demo only · this host lacks COOP/COEP headers for live analysis`);
  }

  // Pause off-thread analysis while the tab is hidden (PRD §14.6). Audio and an
  // explicitly-started listening session continue; rAF already pauses rendering.
  document.addEventListener('visibilitychange', () => {
    if (!graph) return;
    if (document.hidden) graph.pauseAnalysis();
    else if (micHandle || oscHandle || player) graph.resumeAnalysis();
  });

  const fileInput = document.getElementById('file') as HTMLInputElement | null;
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = ''; // allow selecting the same file again after a failure
    setStatus(`Opening ${file.name}…`);

    void (async () => {
      let g: AudioGraph;
      try {
        g = await ensureGraph();
      } catch (error) {
        stopAll();
        source = new SyntheticSource();
        setStatus(describeAudioEngineFailure(error));
        console.error('Audio engine start failed:', error);
        return;
      }

      stopAll();
      let primaryError: unknown;
      try {
        const buffer = await decodeAudioFile(g.ctx, file);
        await startDecodedFile(g, buffer, file.name);
        return;
      } catch (error) {
        primaryError = error;
        console.warn('Decoded-buffer file path failed; trying browser media playback:', error);
      }

      try {
        const fallback = await MediaFilePlayer.create(g, file);
        await activatePlayer(g, fallback, `${file.name} · browser codec fallback`);
      } catch (fallbackError) {
        stopAll();
        source = new SyntheticSource();
        setStatus(describeDecodeFailure(file.name, fallbackError));
        console.error('File open failed:', { primaryError, fallbackError });
      }
    })();
  });

  playPauseBtn?.addEventListener('click', () => {
    if (!player) return;
    if (player.isPlaying) {
      player.pause();
      return;
    }
    void player.play().catch((error) => {
      setStatus(describePlaybackFailure(error));
      console.error('Playback start failed:', error);
    });
  });
  seekEl?.addEventListener('input', () => {
    player?.seek(Number.parseFloat(seekEl.value));
  });

  document.getElementById('export')?.addEventListener('click', () => {
    void (async () => {
      try {
        const blob = await renderer.capturePNG();
        downloadBlob(blob, timestampedName());
      } catch (err: unknown) {
        console.error('Export failed:', err);
        setStatus('Export failed.');
      }
    })();
  });

  // --- resize ----------------------------------------------------------------
  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    renderer.resize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  const applyDemoFrame = (t: number): void => {
    featureFrame.rms = 0.45;
    featureFrame.centroid = 0.5 + 0.25 * Math.sin(t * 0.2);
    featureFrame.onset = 0;
    featureFrame.stereoWidth = 0.5;
    featureFrame.bands.fill(0.3);
  };

  // --- render loop -----------------------------------------------------------
  let lastNow = performance.now();
  let statusTick = 0;
  const frame = (): void => {
    const now = performance.now();
    const fps = perf.update(now - lastNow);
    lastNow = now;
    const s = store.get();
    const t = now / 1000;

    if (liveBus && graph) graph.readFeatures(featureFrame);
    else applyDemoFrame(t);

    const params = toRenderParams(featureFrame, s, t);
    const mode = MODE_BY_ID.get(s.mode) ?? StereoXY;

    const hasData = source.read(left, right, WINDOW);
    let count = 0;
    if (hasData) {
      modeCtx.count = WINDOW;
      modeCtx.sampleRate = source.sampleRate;
      modeCtx.timeSec = t;
      modeCtx.gain = s.inputGain;
      modeCtx.scale = params.scale;
      modeCtx.spread = params.spread;
      mode.build(positions, modeCtx);
      count = WINDOW;
    }
    renderer.renderFrame(positions, count, params);

    // Transport UI sync.
    if (player && transportEl && !transportEl.hidden) {
      if (playPauseBtn) playPauseBtn.textContent = player.isPlaying ? '❚❚' : '▶';
      if (seekEl && document.activeElement !== seekEl) seekEl.value = String(player.currentTime);
      if (timeEl) timeEl.textContent = `${fmtTime(player.currentTime)} / ${fmtTime(player.duration)}`;
    }

    // Debug overlay (PRD §19.3).
    overlay.setVisible(s.showDebug);
    if (s.showDebug) {
      let category = '-';
      let confidence = 0;
      if (featureFrame.classes) {
        for (const k in featureFrame.classes) {
          const v = featureFrame.classes[k as keyof typeof featureFrame.classes];
          if (v > confidence) {
            confidence = v;
            category = k;
          }
        }
      }
      overlay.update({
        fps,
        rms: featureFrame.rms,
        gain: liveBus ? liveBus.gain : 1,
        clipped: featureFrame.clip,
        centroid: featureFrame.centroid,
        onset: featureFrame.onset,
        dominantBand: argmax(featureFrame.bands),
        mode: s.mode,
        category,
        confidence,
        voicePresent: featureFrame.voicePresent ?? 0,
      });
    }

    if (liveBus && !player && ++statusTick % 6 === 0) {
      if (liveBus.clipped) setStatus(`${APP_NAME} — listening · clipping`);
      else if (liveBus.rms < 1e-3) setStatus(`${APP_NAME} — listening · no signal`);
      else setStatus(`${APP_NAME} — listening · gain ${liveBus.gain.toFixed(2)}`);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // --- test/automation hooks (dev builds only; stripped from production) ------
  if (import.meta.env.DEV) window.__vibrato = {
    loadDemo: () => {
      stopAll();
      source = new SyntheticSource();
    },
    loadUrl: (async (url: string) => {
      const g = await ensureGraph();
      const buffer = await g.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      stopAll();
      await startDecodedFile(g, buffer, url.split('/').pop() ?? 'file');
      return { sampleRate: buffer.sampleRate, length: buffer.length, channels: buffer.numberOfChannels };
    }) as never,
    startOscTest: (async () => {
      const g = await ensureGraph();
      stopAll();
      g.resumeAnalysis();
      oscHandle = startOscillator(g);
      liveBus = g.bus;
      source = new LiveSource(g.ring, g.ctx.sampleRate);
    }) as never,
    setModeById: ((id: string) => {
      if (MODE_BY_ID.has(id)) store.update({ mode: id });
    }) as never,
    setGain: ((g: number) => store.update({ inputGain: g })) as never,
    capabilities: (() => detectCapabilities()) as never,
    startSystem: (async () => startSystemMode()) as never,
    setSetting: ((key: string, value: unknown) => store.update({ [key]: value } as never)) as never,
    play: (() => player?.play()) as never,
    pause: (() => player?.pause()) as never,
    seek: ((t: number) => player?.seek(t)) as never,
    transportState: (() =>
      player ? { playing: player.isPlaying, currentTime: player.currentTime, duration: player.duration } : null) as never,
    exportPng: (async () => (await renderer.capturePNG()).size) as never,
    averageLuminance: (() => renderer.readbackAverageLuminance()) as never,
    probe: (() => {
      const ok = source.read(left, right, WINDOW);
      let max = 0;
      for (let i = 0; i < WINDOW; i++) {
        const a = Math.abs(left[i]);
        if (a > max) max = a;
      }
      return { ok, max, sampleRate: source.sampleRate, channels: source.channels };
    }) as never,
    liveStats: (() =>
      liveBus
        ? { counter: liveBus.counter, rms: liveBus.rms, gain: liveBus.gain, clipped: liveBus.clipped }
        : null) as never,
    featureFrame: (() => {
      if (!graph) return null;
      graph.readFeatures(featureFrame);
      let category = '-';
      let confidence = 0;
      if (featureFrame.classes) {
        for (const k in featureFrame.classes) {
          const v = featureFrame.classes[k as keyof typeof featureFrame.classes];
          if (v > confidence) {
            confidence = v;
            category = k;
          }
        }
      }
      return {
        rms: featureFrame.rms,
        centroid: featureFrame.centroid,
        onset: featureFrame.onset,
        stereoWidth: featureFrame.stereoWidth,
        bands: Array.from(featureFrame.bands),
        specCounter: featureFrame.tLastUpdate,
        category,
        confidence,
        voicePresent: featureFrame.voicePresent ?? 0,
        classCounter: graph.classBus.counter,
      };
    }) as never,
  };

  if (canUseRealtime) {
    setStatus(`${APP_NAME} — demo signal · WebGL2${renderer.hdr ? ' · HDR' : ''}`);
  }
}

main();
