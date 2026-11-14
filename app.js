/**
 * MUSIC2D — Application Controller
 * Handles UI interactions, vinyl turntable physics, waveform visualization,
 * category filtering, playlist selection, and user feedback.
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = window.audioEngine;

  // DOM Elements
  const masterPlayBtn = document.getElementById('masterPlayBtn');
  const iconPause = masterPlayBtn.querySelector('.icon-pause');
  const iconPlay = masterPlayBtn.querySelector('.icon-play');
  
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');

  const vinylRecord = document.getElementById('vinylRecord');
  const tonearmWand = document.getElementById('tonearmWand');
  const strobeIndicator = document.getElementById('strobeIndicator');
  const turntablePowerBtn = document.getElementById('turntablePowerBtn');
  const pitchSlider = document.getElementById('pitchSlider');
  const rpm33Btn = document.getElementById('rpm33Btn');
  const rpm45Btn = document.getElementById('rpm45Btn');

  const currentTrackTitle = document.getElementById('currentTrackTitle');
  const currentTrackArtist = document.getElementById('currentTrackArtist');
  const currentTrackGenre = document.getElementById('currentTrackGenre');
  const likeCount = document.getElementById('likeCount');
  const likeCounterBtn = document.getElementById('likeCounterBtn');
  const labelCode = document.getElementById('labelCode');

  const currentTimeLabel = document.getElementById('currentTimeLabel');
  const totalTimeLabel = document.getElementById('totalTimeLabel');
  const waveformBarsContainer = document.getElementById('waveformBars');
  
  const cracklePill = document.getElementById('cracklePill');
  const crackleLed = document.getElementById('crackleLed');
  const soundFxToggle = document.getElementById('soundFxToggle');
  const volumeSlider = document.getElementById('volumeSlider');

  const categoryPills = document.querySelectorAll('.cat-pill');
  const albumCards = document.querySelectorAll('.album-card');
  const playlistRows = document.querySelectorAll('.playlist-row');
  const toastPopup = document.getElementById('toastPopup');
  const toastMsg = document.getElementById('toastMsg');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  // Application State
  let isPlaying = false;
  let isTurntablePowered = true;
  let currentRpm = 33;
  let isShuffle = false;
  let isRepeat = false;
  let baseWaveHeights = [];
  const TOTAL_BARS = 44;

  // Format seconds to mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // ==========================================================================
  // WAVEFORM GENERATION & SYNC
  // ==========================================================================
  function generateWaveform() {
    waveformBarsContainer.innerHTML = '';
    baseWaveHeights = [];

    // Static naturalistic distribution inspired by the uploaded reference image
    for (let i = 0; i < TOTAL_BARS; i++) {
      // Natural music waveform envelope (peaks and valleys)
      const centerFactor = 1 - Math.abs(i - TOTAL_BARS / 2) / (TOTAL_BARS / 2);
      const randomVariance = Math.random() * 0.45 + 0.35;
      const heightPercent = Math.min(95, Math.max(15, (centerFactor * 0.8 + randomVariance) * 85));
      baseWaveHeights.push(heightPercent);

      const bar = document.createElement('div');
      bar.className = 'wave-bar';
      bar.style.height = `${heightPercent}%`;
      bar.dataset.index = i;

      // Click to seek
      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        const percent = (i + 1) / TOTAL_BARS;
        engine.seek(percent);
        updateProgressUI();
        showToast(`Seeked to ${formatTime(engine.trackTime)}`);
      });

      waveformBarsContainer.appendChild(bar);
    }
  }

  function updateProgressUI() {
    const track = engine.getCurrentTrack();
    const duration = engine.trackDuration || track.duration;
    const current = Math.min(engine.trackTime, duration);
    const progressPercent = duration > 0 ? current / duration : 0;

    currentTimeLabel.textContent = formatTime(current);
    totalTimeLabel.textContent = formatTime(duration);

    // Update played vs unplayed waveform bar colors
    const bars = waveformBarsContainer.querySelectorAll('.wave-bar');
    const playedIndex = Math.floor(progressPercent * TOTAL_BARS);

    bars.forEach((bar, idx) => {
      if (idx <= playedIndex) {
        bar.classList.add('played');
      } else {
        bar.classList.remove('played');
      }
    });
  }

  // Live dynamic audio frequency visualization
  function animateWaveformFrequencies() {
    if (isPlaying) {
      const freqData = engine.getFrequencyData();
      if (freqData) {
        const bars = waveformBarsContainer.querySelectorAll('.wave-bar');
        bars.forEach((bar, idx) => {
          const freqIndex = Math.floor((idx / TOTAL_BARS) * (freqData.length / 2));
          const freqVal = freqData[freqIndex] || 0;
          const boost = (freqVal / 255) * 35;
          const newHeight = Math.min(98, baseWaveHeights[idx] + boost);
          bar.style.height = `${newHeight}%`;
        });
      }
      updateProgressUI();
      requestAnimationFrame(animateWaveformFrequencies);
    } else {
      // Return bars to baseline
      const bars = waveformBarsContainer.querySelectorAll('.wave-bar');
      bars.forEach((bar, idx) => {
        bar.style.height = `${baseWaveHeights[idx]}%`;
      });
      updateProgressUI();
    }
  }

  // ==========================================================================
  // PLAYBACK CONTROL LOGIC
  // ==========================================================================
  function setPlayState(play) {
    isPlaying = play;

    if (isPlaying) {
      // Turntable animation
      if (isTurntablePowered) {
        vinylRecord.classList.remove('paused');
        vinylRecord.classList.add(currentRpm === 45 ? 'spinning-fast' : 'spinning');
        tonearmWand.classList.add('playing');
        strobeIndicator.classList.add('active');
        strobeIndicator.classList.remove('inactive');
      }

      // Buttons icon
      iconPause.classList.remove('hidden');
      iconPlay.classList.add('hidden');

      engine.start();
      requestAnimationFrame(animateWaveformFrequencies);
    } else {
      // Turntable paused
      vinylRecord.classList.add('paused');
      tonearmWand.classList.remove('playing');

      iconPause.classList.add('hidden');
      iconPlay.classList.remove('hidden');

      engine.stop();
    }
  }

  // Master Play/Pause button
  masterPlayBtn.addEventListener('click', () => {
    setPlayState(!isPlaying);
    const track = engine.getCurrentTrack();
    showToast(isPlaying ? `Playing: ${track.title}` : 'Playback Paused');
  });

  // Previous & Next Track
  prevBtn.addEventListener('click', () => {
    const track = engine.prevTrack();
    loadTrackMeta(track);
    showToast(`Track: ${track.title}`);
  });

  nextBtn.addEventListener('click', () => {
    const track = engine.nextTrack();
    loadTrackMeta(track);
    showToast(`Track: ${track.title}`);
  });

  repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('active', isRepeat);
    engine.setRepeat(isRepeat);
    showToast(isRepeat ? 'Repeat Track: ON' : 'Repeat Track: OFF');
  });

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    showToast(isShuffle ? 'Shuffle Mode: ON' : 'Shuffle Mode: OFF');
  });

  // Track Meta Update
  function loadTrackMeta(track) {
    currentTrackTitle.textContent = track.title;
    currentTrackArtist.textContent = track.artist;
    currentTrackGenre.textContent = track.genre;
    likeCount.textContent = track.likes;
    labelCode.textContent = `LP-${Math.floor(100 + Math.random() * 899)}`;

    updateProgressUI();

    // Highlight corresponding album card if present
    albumCards.forEach(card => {
      const cardTitle = card.querySelector('.card-title')?.textContent.trim();
      if (cardTitle && cardTitle.toLowerCase() === track.title.toLowerCase()) {
        card.classList.add('active-card');
      } else {
        card.classList.remove('active-card');
      }
    });

    if (isPlaying) {
      engine.start();
    }
  }

  // ==========================================================================
  // TURNTABLE CONTROLS & PHYSICS
  // ==========================================================================
  // Motor Power Dial
  turntablePowerBtn.addEventListener('click', () => {
    isTurntablePowered = !isTurntablePowered;
    if (!isTurntablePowered) {
      strobeIndicator.classList.remove('active');
      strobeIndicator.classList.add('inactive');
      vinylRecord.classList.add('paused');
      tonearmWand.classList.remove('playing');
      showToast('Turntable Motor: OFF');
      if (isPlaying) setPlayState(false);
    } else {
      strobeIndicator.classList.add('active');
      strobeIndicator.classList.remove('inactive');
      showToast('Turntable Motor: ON (Ready)');
      setPlayState(true);
    }
  });

  // Click direct on Vinyl disc to toggle spin
  vinylRecord.addEventListener('click', () => {
    setPlayState(!isPlaying);
  });

  // Pitch Slider (Tempo / Rate fader)
  pitchSlider.addEventListener('input', (e) => {
    const rate = parseFloat(e.target.value);
    engine.setPlaybackRate(rate);

    // Adjust CSS animation duration to match realistic vinyl spin speed
    const baseDuration = currentRpm === 45 ? 1.333 : 1.818;
    const adjustedDuration = baseDuration / rate;
    vinylRecord.style.animationDuration = `${adjustedDuration}s`;

    const percentText = Math.round((rate - 1.0) * 100);
    const sign = percentText > 0 ? '+' : '';
    showToast(`Pitch: ${sign}${percentText}% (${rate.toFixed(2)}x)`);
  });

  // 33 vs 45 RPM Switch
  rpm33Btn.addEventListener('click', () => {
    currentRpm = 33;
    rpm33Btn.classList.add('active');
    rpm45Btn.classList.remove('active');
    engine.setRPM(33);
    vinylRecord.classList.remove('spinning-fast');
    if (isPlaying) vinylRecord.classList.add('spinning');
    showToast('Speed: 33⅓ RPM (Standard LP)');
  });

  rpm45Btn.addEventListener('click', () => {
    currentRpm = 45;
    rpm45Btn.classList.add('active');
    rpm33Btn.classList.remove('active');
    engine.setRPM(45);
    vinylRecord.classList.remove('spinning');
    if (isPlaying) vinylRecord.classList.add('spinning-fast');
    showToast('Speed: 45 RPM (Single / Maxi)');
  });

  // ==========================================================================
  // AUDIO ENHANCEMENTS (VINYL CRACKLE & VOLUME)
  // ==========================================================================
  function toggleCrackle() {
    const active = engine.toggleCrackle();
    crackleLed.classList.toggle('active', active);
    cracklePill.querySelector('.pill-txt').textContent = active ? 'VINYL CRACKLE: ON' : 'VINYL CRACKLE: OFF';
    showToast(active ? 'Vintage Vinyl Crackle: Enabled' : 'Vinyl Crackle: Muted');
  }

  cracklePill.addEventListener('click', toggleCrackle);
  soundFxToggle.addEventListener('click', toggleCrackle);

  volumeSlider.addEventListener('input', (e) => {
    engine.setVolume(e.target.value);
  });

  likeCounterBtn.addEventListener('click', () => {
    const track = engine.getCurrentTrack();
    let currentNum = parseInt(track.likes.replace(/[^0-9]/g, '')) || 392;
    currentNum += 1;
    track.likes = `+ ${currentNum}`;
    likeCount.textContent = track.likes;
    likeCounterBtn.style.transform = 'scale(1.2)';
    setTimeout(() => likeCounterBtn.style.transform = '', 200);
    showToast(`Liked! Total: ${track.likes}`);
  });

  // ==========================================================================
  // CATEGORIES & CAROUSEL INTERACTIVITY
  // ==========================================================================
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const category = pill.dataset.category;
      filterCardsByCategory(category);
      showToast(`Filter: ${pill.textContent}`);
    });
  });

  function filterCardsByCategory(category) {
    albumCards.forEach(card => {
      if (category === 'classic') {
        card.style.display = 'flex';
      } else if (category === '90s') {
        const title = card.querySelector('.card-title')?.textContent.toLowerCase();
        card.style.display = title.includes('daily') ? 'flex' : 'none';
      } else if (category === 'instrumental') {
        const title = card.querySelector('.card-title')?.textContent.toLowerCase();
        card.style.display = title.includes('not so') ? 'flex' : 'none';
      } else {
        card.style.display = 'flex';
      }
    });
  }

  // Click on Album Card to Play
  albumCards.forEach(card => {
    card.addEventListener('click', () => {
      const trackId = card.dataset.trackId;
      const track = engine.selectTrackById(trackId);
      if (track) {
        loadTrackMeta(track);
        setPlayState(true);
        showToast(`Now playing: ${track.title}`);
      }
    });

    const quickPlay = card.querySelector('.card-quick-play');
    if (quickPlay) {
      quickPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        card.click();
      });
    }
  });

  // Favorite Playlists
  playlistRows.forEach((row) => {
    row.addEventListener('click', () => {
      const name = row.querySelector('.playlist-name')?.textContent || 'Playlist';
      showToast(`Loading: ${name} (32 tracks)`);
      // Start track
      const track = engine.selectTrackById('the-suffering');
      if (track) {
        loadTrackMeta(track);
        setPlayState(true);
      }
    });
  });

  // Search input filtering
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    clearSearchBtn.classList.toggle('hidden', query.length === 0);

    albumCards.forEach(card => {
      const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
      const artist = card.querySelector('.card-artist')?.textContent.toLowerCase() || '';
      const match = title.includes(query) || artist.includes(query);
      card.style.display = match ? 'flex' : 'none';
    });
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    albumCards.forEach(c => c.style.display = 'flex');
  });

  // Sidebar navigation feedback
  const sideBtns = document.querySelectorAll('.side-btn');
  sideBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sideBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`View: ${btn.getAttribute('title')}`);
    });
  });

  // Toast Helper
  let toastTimer = null;
  function showToast(message) {
    if (!toastPopup) return;
    toastMsg.textContent = message;
    toastPopup.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastPopup.classList.add('hidden');
    }, 2800);
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  engine.onTrackEnded = () => {
    const track = engine.nextTrack();
    loadTrackMeta(track);
    setPlayState(true);
  };
  engine.onTrackDurationChange = updateProgressUI;
  engine.onPlaybackError = (error) => {
    console.error('Audio playback failed:', error);
    setPlayState(false);
    showToast('Could not play this audio file. Check the file path and format.');
  };

  generateWaveform();
  updateProgressUI();

  // Set default initial state to playing or ready
  // In the user's reference image, the track is at 1:54 / 3:35 and paused/playing
  // We start ready, tonearm in position
  vinylRecord.classList.add('paused');
  tonearmWand.classList.add('playing'); // Positioned on vinyl as in screenshot
  updateProgressUI();

  console.log('MUSIC2D Retro Vinyl Player Loaded Successfully.');
});
