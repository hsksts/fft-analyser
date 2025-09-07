/* Web Audio Graphic EQ (JP/EN comments)
   - 10-band peaking EQ (31.5Hz–16kHz), ±20 dB
   - Bypass, master volume, global Q, presets
   - Sources: File / Microphone / White Noise / Pink Noise
   - Noise level (independent gain)
   - Spectrum analyzer with logarithmic frequency axis
*/

(() => {
  // -----------------------------
  // DOM references / DOM参照
  // -----------------------------
  const player = document.getElementById('player');
  const fileInput = document.getElementById('fileInput');
  const sourceSelect = document.getElementById('sourceSelect');
  const filePickerWrap = document.getElementById('filePickerWrap');

  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  const masterVol = document.getElementById('masterVol');
  const bypassChk = document.getElementById('bypass');
  const qGlobal = document.getElementById('qGlobal');

  const noiseLevel = document.getElementById('noiseLevel');

  const slidersWrap = document.getElementById('sliders');

  const presetSelect = document.getElementById('presetSelect');
  const applyPresetBtn = document.getElementById('applyPreset');
  const resetBtn = document.getElementById('resetEq');

  const canvas = document.getElementById('spectrum');
  const ctx2d = canvas.getContext('2d');

  // -----------------------------
  // Audio graph state / オーディオグラフの状態
  // -----------------------------
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();

  let mediaElementSource = null;  // MediaElementSourceNode
  let micStream = null;           // MediaStream
  let micSource = null;           // MediaStreamAudioSourceNode

  // Noise chain
  let noiseSource = null;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = parseFloat(noiseLevel.value);

  // Master & analyser
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = parseFloat(masterVol.value);

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;

  // 10-band (IEC 61260 nominal centers)
  const freqs = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  // Build filters (peaking EQ)
  const filters = freqs.map(f => {
    const biq = audioCtx.createBiquadFilter();
    biq.type = 'peaking';
    biq.frequency.value = f;
    biq.Q.value = parseFloat(qGlobal.value);
    biq.gain.value = 0;
    return biq;
  });

  // chain the filters
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }
  const firstFilter = filters[0];
  const lastFilter = filters[filters.length - 1];

  // -----------------------------
  // UI: create sliders / スライダーUI生成（±20 dB）
  // -----------------------------
  const sliderEls = [];
  const fmtHzLabel = (f) =>
    f >= 1000 ? `${(f/1000).toFixed(f%1000===0?0:1)}k` : `${f}`;

  freqs.forEach((f, i) => {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-labelledby', `label-${i}`);

    const lab = document.createElement('label');
    lab.id = `label-${i}`;
    lab.textContent = `${fmtHzLabel(f)} Hz`;
    lab.style.display = 'block';
    lab.style.textAlign = 'center';
    lab.style.marginBottom = '6px';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = -20;   // ±20 dB
    input.max = 20;
    input.step = 0.1;
    input.value = 0;
    input.className = 'slider-vert';
    input.setAttribute('aria-label', `${f} Hz gain (dB)`);

    const out = document.createElement('div');
    out.className = 'gainout';
    out.textContent = '0.0 dB';

    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      filters[i].gain.setTargetAtTime(val, audioCtx.currentTime, 0.015);
      out.textContent = `${val.toFixed(1)} dB`;
    });

    // Double-click to reset
    input.addEventListener('dblclick', () => {
      input.value = 0;
      filters[i].gain.setTargetAtTime(0, audioCtx.currentTime, 0.015);
      out.textContent = '0.0 dB';
    });

    wrap.appendChild(lab);
    wrap.appendChild(input);
    wrap.appendChild(out);
    slidersWrap.appendChild(wrap);
    sliderEls.push(input);
  });

  // -----------------------------
  // Routing helpers / ルーティング補助
  // -----------------------------
  function disconnectSources() {
    try { mediaElementSource && mediaElementSource.disconnect(); } catch {}
    try { micSource && micSource.disconnect(); } catch {}
    try { noiseSource && noiseSource.disconnect(); } catch {}
  }
  function clearPostChain() {
    try { lastFilter.disconnect(); } catch {}
    try { masterGain.disconnect(); } catch {}
    try { analyser.disconnect(); } catch {}
  }
  function connectPostChain(inputNode) {
    // input -> (EQ or bypass) -> master -> analyser -> destination
    if (bypassChk.checked) {
      inputNode.connect(masterGain);
    } else {
      inputNode.connect(firstFilter);
      lastFilter.connect(masterGain);
    }
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function updateQAll() {
    const q = parseFloat(qGlobal.value);
    filters.forEach(b => { b.Q.setValueAtTime(q, audioCtx.currentTime); });
  }

  // -----------------------------
  // File source / ファイルソース
  // -----------------------------
  let currentObjectUrl = null;

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    stopMicIfAny();

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    currentObjectUrl = URL.createObjectURL(f);
    player.src = currentObjectUrl;
    player.load();

    if (!mediaElementSource) {
      mediaElementSource = audioCtx.createMediaElementSource(player);
    }
    wireFileGraphAndPlay();
  });

  function wireFileGraphAndPlay() {
    audioCtx.resume();
    clearPostChain();
    disconnectSources();
    connectPostChain(mediaElementSource);
    player.play().catch(() => {/* user gesture may be required */});
  }

  // -----------------------------
  // Mic source / マイクソース
  // -----------------------------
  async function startMic() {
    if (micSource) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micSource = audioCtx.createMediaStreamSource(micStream);

      if (!player.paused) player.pause();

      audioCtx.resume();
      clearPostChain();
      disconnectSources();
      connectPostChain(micSource);
    } catch (err) {
      alert('マイクの取得に失敗しました。HTTPSでアクセスしているか、ブラウザの権限をご確認ください。\nFailed to access microphone. Please use HTTPS and allow mic permission.');
      sourceSelect.value = 'file';
      filePickerWrap.style.display = '';
      noiseLevel.disabled = true;
    }
  }

  function stopMicIfAny() {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    micSource = null;
  }

  // -----------------------------
  // Noise generators / ノイズ生成
  // -----------------------------
  function createWhiteNoise() {
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1; // white
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  function createPinkNoise() {
    // Voss-McCartney approx. using ScriptProcessor (deprecated but simple)
    const bufferSize = 16384;
    const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    node.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        out[i] *= 0.11; // normalize
        b6 = white * 0.115926;
      }
    };
    return node;
  }

  // -----------------------------
  // Presets / プリセット（dB）
  // 31.5,63,125,250,500,1k,2k,4k,8k,16k
  // -----------------------------
  const PRESETS = {
    flat:       [0,0,0,0,0,0,0,0,0,0],
    bassBoost:  [6,5,4,3,2,0,0,-1,-2,-3],
    trebleBoost:[-2,-2,-1,0,0,1,2,3,4,5],
    vocal:      [-2,-2,-1,0,1.5,3,3,1,-1,-2],
    loudness:   [5,4,2,1,0,0,0,1,3,5],
  };

  function applyPreset(name) {
    const gains = PRESETS[name] || PRESETS.flat;
    sliderEls.forEach((el, i) => {
      const g = gains[i];
      el.value = g;
      filters[i].gain.setTargetAtTime(g, audioCtx.currentTime, 0.02);
      const out = el.nextElementSibling;
      if (out) out.textContent = `${g.toFixed(1)} dB`;
    });
  }

  function resetEq() {
    sliderEls.forEach((el, i) => {
      el.value = 0;
      filters[i].gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
      const out = el.nextElementSibling;
      if (out) out.textContent = '0.0 dB';
    });
  }

  // -----------------------------
  // Spectrum (log-frequency axis) / スペクトラム（対数周波数）
  // -----------------------------
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  function drawSpectrum() {
    requestAnimationFrame(drawSpectrum);
    analyser.getByteFrequencyData(freqData);

    const { width, height } = canvas;
    ctx2d.fillStyle = '#111';
    ctx2d.fillRect(0, 0, width, height);

    const fMin = 20;
    const fMax = audioCtx.sampleRate / 2;
    const logMin = Math.log10(fMin);
    const logMax = Math.log10(fMax);
    const bins = freqData.length;

    const fx = (f) => {
      const clamped = Math.max(f, fMin);
      const t = (Math.log10(clamped) - logMin) / (logMax - logMin);
      return t * width;
    };

    // draw bars mapped to log-x
    for (let i = 0; i < bins; i++) {
      const f1 = (i * fMax) / bins;
      const f2 = ((i + 1) * fMax) / bins;
      const x1 = fx(f1);
      const x2 = fx(f2);
      const w = Math.max(1, x2 - x1);

      const v = freqData[i];
      const h = (v / 255) * height;

      ctx2d.fillStyle = '#24d1a0';
      ctx2d.fillRect(x1, height - h, w, h);
    }

    // decade grid lines
    ctx2d.strokeStyle = 'rgba(255,255,255,.08)';
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    [100, 1000, 10000].forEach((f) => {
      if (f > fMin && f < fMax) {
        const x = fx(f);
        ctx2d.moveTo(x, 0); ctx2d.lineTo(x, height);
      }
    });
    ctx2d.stroke();

    // band center markers & labels
    ctx2d.strokeStyle = 'rgba(255,255,255,.18)';
    ctx2d.fillStyle = 'rgba(255,255,255,.7)';
    ctx2d.font = '12px system-ui, sans-serif';
    ctx2d.textAlign = 'center';
    freqs.forEach((f) => {
      if (f > fMin && f < fMax) {
        const x = fx(f);
        ctx2d.beginPath();
        ctx2d.moveTo(x, 0);
        ctx2d.lineTo(x, height);
        ctx2d.stroke();
        const label = f >= 1000 ? `${(f/1000)}k` : `${f}`;
        ctx2d.fillText(label, x, 14);
      }
    });
  }
  drawSpectrum();

  // -----------------------------
  // Events / イベント
  // -----------------------------
  sourceSelect.addEventListener('change', () => {
    const mode = sourceSelect.value;
    const noiseMode = (mode === 'white' || mode === 'pink');
    noiseLevel.disabled = !noiseMode;

    stopMicIfAny();
    if (noiseSource) { try { noiseSource.disconnect(); } catch {} noiseSource = null; }

    if (mode === 'mic') {
      filePickerWrap.style.display = 'none';
      startMic();
    } else if (mode === 'file') {
      filePickerWrap.style.display = '';
      if (player.src) wireFileGraphAndPlay();
      else { clearPostChain(); disconnectSources(); }
    } else if (mode === 'white') {
      filePickerWrap.style.display = 'none';
      noiseSource = createWhiteNoise();
      audioCtx.resume();
      clearPostChain();
      noiseSource.connect(noiseGain);
      connectPostChain(noiseGain);
      noiseSource.start();
    } else if (mode === 'pink') {
      filePickerWrap.style.display = 'none';
      noiseSource = createPinkNoise();
      audioCtx.resume();
      clearPostChain();
      noiseSource.connect(noiseGain);
      connectPostChain(noiseGain);
      // ScriptProcessor: start()不要
    }
  });

  playBtn.addEventListener('click', async () => {
    await audioCtx.resume();
    const mode = sourceSelect.value;

    if (mode === 'file') {
      if (player.src) {
        if (!mediaElementSource) mediaElementSource = audioCtx.createMediaElementSource(player);
        clearPostChain(); disconnectSources();
        connectPostChain(mediaElementSource);
        player.play().catch(()=>{});
      }
    } else if (mode === 'mic') {
      startMic();
    } else if (mode === 'white') {
      if (!noiseSource) noiseSource = createWhiteNoise();
      clearPostChain();
      noiseSource.connect(noiseGain);
      connectPostChain(noiseGain);
      try { noiseSource.start(); } catch {}
    } else if (mode === 'pink') {
      if (!noiseSource) noiseSource = createPinkNoise();
      clearPostChain();
      noiseSource.connect(noiseGain);
      connectPostChain(noiseGain);
    }
  });

  pauseBtn.addEventListener('click', () => {
    const mode = sourceSelect.value;
    if (mode === 'file') {
      player.pause();
    } else if (mode === 'white') {
      try { noiseSource.stop(); } catch {}
      try { noiseSource.disconnect(); } catch {}
      noiseSource = null;
    } else if (mode === 'pink') {
      try { noiseSource.disconnect(); } catch {}
      noiseSource = null;
    }
  });

  masterVol.addEventListener('input', () => {
    masterGain.gain.setTargetAtTime(parseFloat(masterVol.value), audioCtx.currentTime, 0.01);
  });

  noiseLevel.addEventListener('input', () => {
    noiseGain.gain.setTargetAtTime(parseFloat(noiseLevel.value), audioCtx.currentTime, 0.01);
  });

  bypassChk.addEventListener('change', () => {
    clearPostChain(); disconnectSources();
    const mode = sourceSelect.value;
    if (mode === 'file' && mediaElementSource) {
      connectPostChain(mediaElementSource);
    } else if (mode === 'mic' && micSource) {
      connectPostChain(micSource);
    } else if ((mode === 'white' || mode === 'pink') && noiseSource) {
      noiseSource.connect(noiseGain);
      connectPostChain(noiseGain);
    }
  });

  qGlobal.addEventListener('input', updateQAll);
  applyPresetBtn.addEventListener('click', () => applyPreset(presetSelect.value));
  resetBtn.addEventListener('click', resetEq);

  // Cleanup on unload / ページ離脱時
  window.addEventListener('beforeunload', () => {
    stopMicIfAny();
    if (noiseSource) { try { noiseSource.disconnect(); } catch {} }
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    try { audioCtx.close(); } catch {}
  });

  // Initial route: keep analyser alive / 初期配線（解析器は接続維持）
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  // Initial preset
  applyPreset('flat');
})();
