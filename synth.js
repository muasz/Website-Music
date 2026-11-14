/**
 * MUSIC2D Web Audio Synthesizer & Procedural Vinyl Engine
 * Provides authentic vinyl crackle, pitch-shiftable lo-fi tracks,
 * real-time frequency analysis, and motor spin-up/spin-down effects.
 */

class RetroAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.isPlaying = false;
    this.playbackRate = 1.0;
    this.tempoScale = 1.0;
    this.crackleGain = null;
    this.crackleSource = null;
    this.isCrackleEnabled = true;
    this.audio = null;
    this.audioSource = null;
    this.audioConnectedToContext = false;
    this.audioTrackId = null;
    this.volume = 0.85;
    this.isRepeat = false;
    this.onTrackEnded = null;
    this.onPlaybackError = null;
    this.onTrackDurationChange = null;
    
    // Playback state
    this.currentTrackIndex = 0;
    this.trackTime = 114; // Default to 1:54 (114 seconds) to match image
    this.trackDuration = 215; // 3:35 (215 seconds) to match image
    this.intervalId = null;

    // Track definitions matching UI
    this.tracks = [
      {
        id: 'the-suffering',
        title: 'The Suffering',
        artist: 'by Coheed & Cambria',
        genre: 'Classic',
        likes: '+ 392',
        duration: 215, // 3:35
        currentTime: 114, // 1:54
        bpm: 78,
        rootFreq: 146.83, // D3
        chords: [
          [146.83, 174.61, 220.00, 261.63], // Dm7
          [130.81, 164.81, 196.00, 246.94], // Cmaj7
          [116.54, 146.83, 174.61, 220.00], // Bbmaj7
          [130.81, 164.81, 196.00, 246.94]  // C
        ]
      },
      {
        id: 'daily-chaos',
        title: 'Daily Chaos',
        artist: 'by Emily Bryan',
        genre: '90s',
        likes: '+ 184',
        duration: 182, // 3:02
        currentTime: 42,
        bpm: 84,
        rootFreq: 174.61, // F3
        chords: [
          [174.61, 220.00, 261.63, 329.63], // Fmaj7
          [164.81, 207.65, 246.94, 311.13], // E7
          [146.83, 174.61, 220.00, 261.63], // Dm7
          [130.81, 164.81, 196.00, 246.94]  // C7
        ]
      },
      {
        id: 'simple-things',
        title: 'Simple Things',
        artist: 'by Ryan Poppin',
        genre: 'Classic',
        likes: '+ 420',
        duration: 240, // 4:00
        currentTime: 75,
        bpm: 72,
        rootFreq: 130.81, // C3
        chords: [
          [130.81, 164.81, 196.00, 246.94], // Cmaj7
          [110.00, 138.59, 164.81, 207.65], // Am7
          [87.31, 110.00, 130.81, 164.81],  // Fmaj7
          [98.00, 123.47, 146.83, 174.61]   // G7
        ]
      },
      {
        id: 'not-so-good',
        title: 'Not so good',
        artist: 'by Bryan Thomas',
        genre: 'Instrumental',
        likes: '+ 251',
        duration: 198, // 3:18
        currentTime: 28,
        bpm: 68,
        rootFreq: 110.00, // A2
        chords: [
          [110.00, 130.81, 164.81, 196.00], // Am7
          [87.31, 110.00, 130.81, 164.81],  // Fmaj7
          [130.81, 164.81, 196.00, 246.94], // Cmaj7
          [98.00, 123.47, 146.83, 174.61]   // G
        ]
      },
      {
        id: 'disenchanted',
        title: 'Disenchanted',
        artist: 'by My Chemical Romance',
        genre: 'Rock',
        likes: '+ 0',
        duration: 0,
        currentTime: 0,
        src: './My%20Chemical%20Romance%20-%20Disenchanted.mp3'
      },
      {
        id: 'cant-help-falling-in-love',
        title: "Can't Help Falling in Love",
        artist: 'by Elvis Presley',
        genre: 'Classic',
        likes: '+ 0',
        duration: 0,
        currentTime: 0,
        src: './Elvis%20Presley%20-%20Can%27t%20Help%20Falling%20in%20Love%20%28Lyrics%29.mp3'
      }
    ];

    this.currentChordStep = 0;
    this.beatStep = 0;
    this.stepTimer = null;
  }

  openLocalTrackDatabase() {
    if (!window.indexedDB) {
      return Promise.reject(new Error('IndexedDB is unavailable in this browser context.'));
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open('music2d-local-library', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('hiddenTracks')) {
          db.createObjectStore('hiddenTracks', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the local music library.'));
    });
  }

  async loadLocalTracks() {
    const db = await this.openLocalTrackDatabase();
    let records;
    let hiddenTrackIds;

    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['tracks', 'hiddenTracks'], 'readonly');
        const tracksRequest = transaction.objectStore('tracks').getAll();
        const hiddenRequest = transaction.objectStore('hiddenTracks').getAll();
        tracksRequest.onsuccess = () => {
          records = tracksRequest.result;
        };
        hiddenRequest.onsuccess = () => {
          hiddenTrackIds = hiddenRequest.result.map(record => record.id);
        };
        transaction.oncomplete = () => resolve();
        tracksRequest.onerror = () => reject(tracksRequest.error || new Error('Could not read the local music library.'));
        hiddenRequest.onerror = () => reject(hiddenRequest.error || new Error('Could not read removed-track records.'));
        transaction.onabort = () => reject(transaction.error || new Error('Reading the local music library was aborted.'));
      });
    } finally {
      db.close();
    }

    const hiddenIds = new Set(hiddenTrackIds);
    this.tracks = this.tracks.filter(track => !hiddenIds.has(track.id));

    const loadedTracks = [];
    records.forEach(record => {
      if (this.tracks.some(track => track.id === record.id)) return;
      if (!record.file || typeof record.file.size !== 'number') {
        throw new Error(`Saved audio data is missing for "${record.title}".`);
      }

      const { file, ...metadata } = record;
      const track = {
        ...metadata,
        src: URL.createObjectURL(file),
        localFile: true
      };
      this.tracks.push(track);
      loadedTracks.push(track);
    });

    return loadedTracks;
  }

  async saveHiddenTrackId(id) {
    const db = await this.openLocalTrackDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('hiddenTracks', 'readwrite');
        transaction.objectStore('hiddenTracks').put({ id });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not save the removed-track record.'));
        transaction.onabort = () => reject(transaction.error || new Error('Saving the removed-track record was aborted.'));
      });
    } finally {
      db.close();
    }
  }

  async deleteStoredLocalTrack(id) {
    const db = await this.openLocalTrackDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('tracks', 'readwrite');
        transaction.objectStore('tracks').delete(id);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not delete the saved audio file.'));
        transaction.onabort = () => reject(transaction.error || new Error('Deleting the saved audio file was aborted.'));
      });
    } finally {
      db.close();
    }
  }

  async removeAudioTrack(id) {
    const index = this.tracks.findIndex(track => track.id === id);
    if (index === -1 || !this.tracks[index].src) {
      throw new Error('The selected audio track could not be found.');
    }

    const track = this.tracks[index];
    if (track.localFile) {
      await this.deleteStoredLocalTrack(id);
    } else {
      await this.saveHiddenTrackId(id);
    }

    const wasCurrent = index === this.currentTrackIndex;
    if (wasCurrent) this.stop();

    if (this.audioTrackId === id && this.audio) {
      this.audio.pause();
      this.audioTrackId = null;
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    if (track.localFile) URL.revokeObjectURL(track.src);

    this.tracks.splice(index, 1);
    if (index < this.currentTrackIndex) {
      this.currentTrackIndex--;
    } else if (wasCurrent) {
      this.currentTrackIndex = Math.min(index, this.tracks.length - 1);
    }

    const activeTrack = this.getCurrentTrack();
    this.trackTime = activeTrack.currentTime || 0;
    this.trackDuration = activeTrack.duration || 0;
    this.currentChordStep = 0;
    this.beatStep = 0;
    return { track, activeTrack, wasCurrent };
  }

  async addLocalTrack(file) {
    if (!file || typeof file.name !== 'string') {
      throw new Error('Choose an audio file to add.');
    }
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|aac|flac|webm)$/i.test(file.name)) {
      throw new Error(`"${file.name}" is not a supported audio file.`);
    }

    const filename = file.name.replace(/\.[^.]+$/, '');
    const parts = filename.split(/\s+-\s+/);
    const title = parts.length > 1 ? parts.slice(1).join(' - ') : filename;
    const artist = parts.length > 1 ? `by ${parts[0]}` : 'by Local Library';
    const idPart = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const record = {
      id: `local-${idPart}`,
      title,
      artist,
      genre: 'Local',
      likes: '+ 0',
      duration: 0,
      currentTime: 0,
      file
    };

    const db = await this.openLocalTrackDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('tracks', 'readwrite');
        transaction.objectStore('tracks').put(record);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not save this audio file.'));
        transaction.onabort = () => reject(transaction.error || new Error('Saving this audio file was aborted.'));
      });
    } finally {
      db.close();
    }

    const track = {
      id: record.id,
      title: record.title,
      artist: record.artist,
      genre: record.genre,
      likes: record.likes,
      duration: record.duration,
      currentTime: record.currentTime,
      src: URL.createObjectURL(file),
      localFile: true
    };
    this.tracks.push(track);
    return track;
  }

  /**
   * Initializes the Web Audio Context upon first user interaction
   */
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      // Frequency Analyser for Waveform Animation
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Setup procedural vinyl crackle engine
      this.setupVinylCrackle();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(error => {
        if (this.onPlaybackError) this.onPlaybackError(error);
      });
    }
  }

  loadAudioTrack(track) {
    if (!track.src) return;

    this.initContext();
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      if (window.location.protocol !== 'file:') {
        this.audioSource = this.ctx.createMediaElementSource(this.audio);
        this.audioSource.connect(this.masterGain);
        this.audioConnectedToContext = true;
      }
      this.audio.addEventListener('loadedmetadata', () => {
        const currentTrack = this.getCurrentTrack();
        if (currentTrack.id === this.audioTrackId && Number.isFinite(this.audio.duration)) {
          currentTrack.duration = this.audio.duration;
          this.trackDuration = this.audio.duration;
          if (this.onTrackDurationChange) this.onTrackDurationChange();
        }
      });
      this.audio.addEventListener('error', () => {
        const currentTrack = this.getCurrentTrack();
        if (currentTrack.src && currentTrack.id === this.audioTrackId && this.onPlaybackError) {
          const error = new Error(`Could not load audio file: ${currentTrack.src}`);
          this.onPlaybackError(error);
        }
      });
      this.audio.addEventListener('ended', () => {
        if (this.isRepeat) {
          this.audio.currentTime = 0;
          this.audio.play().catch(error => {
            if (this.onPlaybackError) this.onPlaybackError(error);
          });
        } else {
          this.finishTrack();
        }
      });
    } else {
      this.audio.pause();
    }

    if (this.audioTrackId !== track.id) {
      this.audioTrackId = track.id;
      this.audio.src = track.src;
      this.audio.load();
    }
    this.audio.playbackRate = this.playbackRate * this.tempoScale;
    this.audio.volume = this.audioConnectedToContext ? 1 : this.volume;
    this.trackTime = this.audio.currentTime || 0;
    this.trackDuration = track.duration || 0;
  }

  finishTrack() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.onTrackEnded) this.onTrackEnded();
  }

  /**
   * Generates continuous vintage vinyl record surface crackle & dust pops
   */
  setupVinylCrackle() {
    if (!this.ctx) return;

    // Buffer of pink noise + occasional clicks
    const bufferSize = this.ctx.sampleRate * 4;
    const crackleBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = crackleBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise filtering
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      let pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;

      // Random needle pop / dust scratch
      if (Math.random() < 0.0004) {
        pink += (Math.random() > 0.5 ? 0.35 : -0.35);
      }

      data[i] = pink * 0.15;
    }

    this.crackleSource = this.ctx.createBufferSource();
    this.crackleSource.buffer = crackleBuffer;
    this.crackleSource.loop = true;

    // Highpass to eliminate heavy mud, retain vintage airy warmth
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;

    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.setValueAtTime(this.isCrackleEnabled ? 0.18 : 0, this.ctx.currentTime);

    this.crackleSource.connect(hp);
    hp.connect(this.crackleGain);
    this.crackleGain.connect(this.masterGain);

    this.crackleSource.start();
  }

  toggleCrackle(forceState) {
    this.isCrackleEnabled = forceState !== undefined ? forceState : !this.isCrackleEnabled;
    if (this.crackleGain && this.ctx) {
      const targetGain = this.isCrackleEnabled && this.isPlaying ? 0.22 : 0;
      this.crackleGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.isCrackleEnabled;
  }

  /**
   * Play / Pause toggle with analog motor spin-up / spin-down pitch glide
   */
  start() {
    this.initContext();
    this.isPlaying = true;

    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }

    const track = this.getCurrentTrack();
    if (track.src) {
      this.loadAudioTrack(track);
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      }
      this.audio.play().catch(error => {
        this.isPlaying = false;
        if (this.onPlaybackError) this.onPlaybackError(error);
      });
    } else {
      if (this.audio) this.audio.pause();
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      }
      this.scheduleNextBeat();
    }

    // Fade in crackle
    if (this.crackleGain && this.isCrackleEnabled) {
      this.crackleGain.gain.setTargetAtTime(0.22, this.ctx.currentTime, 0.2);
    }

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (this.isPlaying) {
        if (track.src && this.audio) {
          this.trackTime = this.audio.currentTime;
          if (Number.isFinite(this.audio.duration)) {
            this.trackDuration = this.audio.duration;
            track.duration = this.audio.duration;
          }
        } else {
          this.trackTime += 0.25 * this.playbackRate;
        }
        if (!track.src && this.trackTime >= this.trackDuration) {
          this.finishTrack();
        }
      }
    }, 250);
  }

  stop() {
    this.isPlaying = false;
    if (this.audio) {
      if (this.getCurrentTrack().src) {
        this.trackTime = this.audio.currentTime || 0;
      }
      this.audio.pause();
    }
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Smooth motor pitch glide down
    if (this.ctx && this.masterGain && !this.getCurrentTrack().src) {
      this.masterGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.35);
      setTimeout(() => {
        if (!this.isPlaying && this.masterGain) {
          this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
      }, 500);
    }

    if (this.crackleGain) {
      this.crackleGain.gain.setTargetAtTime(0.02, this.ctx.currentTime, 0.2);
    }
  }

  /**
   * Synthesize a mellow Lo-Fi Rhodes chord with warm harmonic richness
   */
  playChord(chordFreqs) {
    if (!this.ctx || !this.isPlaying) return;

    chordFreqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Warm triangle/sine blend
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * this.playbackRate, this.ctx.currentTime);

      // Subtle vintage vibrato
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 4.5;
      lfoGain.gain.value = 1.2;
      lfo.connect(osc.frequency);
      lfo.start();

      // Lowpass warmth filter
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900 * this.playbackRate, this.ctx.currentTime);

      // Amplitude envelope
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07 / (idx + 1), now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.8);
      lfo.stop(now + 1.8);
    });
  }

  /**
   * Synthesize soft lo-fi sub-kick and acoustic brushed snare
   */
  playDrum(type) {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;

    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(110 * this.playbackRate, now);
      osc.frequency.exponentialRampToValueAtTime(35 * this.playbackRate, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'snare') {
      // Soft brushed noise burst
      const node = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
      node.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      node.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      node.start(now);
    }
  }

  /**
   * Rhythm sequencer loop
   */
  scheduleNextBeat() {
    if (!this.isPlaying) return;

    const track = this.tracks[this.currentTrackIndex];
    if (track.src) return;
    const beatDurationMs = (60 / (track.bpm * this.tempoScale * this.playbackRate)) * 500;

    // Chord triggers every 4 beats
    if (this.beatStep % 4 === 0) {
      const chord = track.chords[this.currentChordStep % track.chords.length];
      this.playChord(chord);
      this.currentChordStep++;
    }

    // Drum beat pattern: Kick on 0, Snare on 2
    if (this.beatStep % 4 === 0) {
      this.playDrum('kick');
    } else if (this.beatStep % 4 === 2) {
      this.playDrum('snare');
    }

    this.beatStep++;
    this.stepTimer = setTimeout(() => this.scheduleNextBeat(), beatDurationMs);
  }

  /**
   * Pitch slider / RPM update
   */
  setPlaybackRate(rate) {
    this.playbackRate = parseFloat(rate);
    if (this.audio) this.audio.playbackRate = this.playbackRate * this.tempoScale;
  }

  setRPM(rpm) {
    if (rpm === 45) {
      this.tempoScale = 45 / 33.33; // 1.35x speed
    } else {
      this.tempoScale = 1.0; // 33 RPM standard
    }
    if (this.audio) this.audio.playbackRate = this.playbackRate * this.tempoScale;
  }

  setVolume(vol) {
    this.volume = parseFloat(vol);
    if (this.audio && !this.audioConnectedToContext) {
      this.audio.volume = this.volume;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  seek(percent) {
    const position = Math.max(0, Math.min(1, percent)) * this.trackDuration;
    this.trackTime = position;
    if (this.getCurrentTrack().src && this.audio && Number.isFinite(this.audio.duration)) {
      this.audio.currentTime = position;
    }
  }

  setRepeat(enabled) {
    this.isRepeat = enabled;
  }

  getCurrentTrack() {
    return this.tracks[this.currentTrackIndex];
  }

  selectTrackById(id) {
    const idx = this.tracks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.currentTrackIndex = idx;
      this.trackTime = this.tracks[idx].currentTime;
      this.trackDuration = this.tracks[idx].duration;
      this.currentChordStep = 0;
      this.beatStep = 0;
      this.loadAudioTrack(this.tracks[idx]);
      return this.tracks[idx];
    }
    return null;
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    const track = this.tracks[this.currentTrackIndex];
    this.trackTime = 0;
    this.trackDuration = track.duration;
    this.currentChordStep = 0;
    this.beatStep = 0;
    this.loadAudioTrack(track);
    return track;
  }

  prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    const track = this.tracks[this.currentTrackIndex];
    this.trackTime = 0;
    this.trackDuration = track.duration;
    this.currentChordStep = 0;
    this.beatStep = 0;
    this.loadAudioTrack(track);
    return track;
  }

  /**
   * Retrieves live frequency levels to animate waveform bars
   */
  getFrequencyData() {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}

// Global instance
window.audioEngine = new RetroAudioEngine();
