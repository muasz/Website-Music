/**
 * MUSIC2D — Application Controller
 * Handles UI interactions, vinyl turntable physics, waveform visualization,
 * category filtering, playlist selection, and user feedback.
 */

// ---------------------------------------------------------------------------
// YouTube IFrame API — module-level globals accessible everywhere in this file
// ---------------------------------------------------------------------------
let _ytPlayer = null;
let _ytPlayerReady = false;
let _ytInstanceReady = false;
let _ytCurrentVideoId = null;
let _ytPendingAutoplay = false;
let _ytTimeInterval = null;

// Called automatically by the YT IFrame API script after it loads
window.onYouTubeIframeAPIReady = function () { _ytPlayerReady = true; };

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
  const playerColumn = document.querySelector('.player-column');
  const youtubePlayerContainer = document.getElementById('youtubePlayerContainer');

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
  const albumCardsRow = document.getElementById('albumCardsRow');
  const addTrackBtn = document.getElementById('addTrackBtn');
  const addYoutubeTrackBtn = document.getElementById('addYoutubeTrackBtn');
  const trackFileInput = document.getElementById('trackFileInput');
  const youtubeTrackDialog = document.getElementById('youtubeTrackDialog');
  const youtubeTrackForm = document.getElementById('youtubeTrackForm');
  const youtubeUrlInput = document.getElementById('youtubeUrlInput');
  const youtubeTitleInput = document.getElementById('youtubeTitleInput');
  const youtubeArtistInput = document.getElementById('youtubeArtistInput');
  const cancelYoutubeTrackBtn = document.getElementById('cancelYoutubeTrackBtn');
  const playlistRows = document.querySelectorAll('.playlist-row');
  const toastPopup = document.getElementById('toastPopup');
  const toastMsg = document.getElementById('toastMsg');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const getAlbumCards = () => albumCardsRow.querySelectorAll('.album-card');

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
        // Also seek the YouTube player if applicable
        if (engine.getCurrentTrack().youtubeVideoId && _ytPlayer && typeof _ytPlayer.seekTo === 'function') {
          _ytPlayer.seekTo(engine.trackTime, true);
        }
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
  function clearYoutubePlayer() {
    // Visual layout reset only — keep the YT iframe in DOM so audio can keep running
    playerColumn.classList.remove('youtube-active');
    delete youtubePlayerContainer.dataset.videoId;
  }

  // ---- YouTube IFrame API helpers ----

  /**
   * Create or reuse the hidden YT player for the given videoId.
   * autoplay=true  → starts playback immediately (or as soon as the player is ready).
   * autoplay=false → cues the video without playing.
   */
  function getClosestYtRate(targetRate) {
    const supported = (_ytPlayer && typeof _ytPlayer.getAvailablePlaybackRates === 'function')
      ? _ytPlayer.getAvailablePlaybackRates()
      : [];
    const rates = supported.length ? supported : [0.5, 0.75, 1, 1.25, 1.5, 2];
    return rates.reduce((prev, curr) =>
      Math.abs(curr - targetRate) < Math.abs(prev - targetRate) ? curr : prev
    );
  }

  function syncYtSettings() {
    if (!_ytPlayer || !_ytInstanceReady) return;
    if (typeof _ytPlayer.setVolume === 'function') {
      const vol = Math.round(parseFloat(volumeSlider.value) * 100);
      _ytPlayer.setVolume(Math.max(0, Math.min(100, vol)));
    }
    if (typeof _ytPlayer.setPlaybackRate === 'function') {
      const pitchRate = parseFloat(pitchSlider.value) || 1.0;
      const rpmFactor = currentRpm === 45 ? 1.35 : 1.0;
      _ytPlayer.setPlaybackRate(getClosestYtRate(pitchRate * rpmFactor));
    }
  }

  function ensureYtPlayer(videoId, autoplay) {
    _ytPendingAutoplay = autoplay;

    if (!_ytPlayerReady) {
      // API not ready yet — retry shortly
      setTimeout(() => ensureYtPlayer(videoId, _ytPendingAutoplay), 300);
      return;
    }

    if (!_ytPlayer) {
      // First time: create the player inside the hidden container
      _ytInstanceReady = false;
      _ytCurrentVideoId = videoId;
      _ytPlayer = new YT.Player('youtubePlayerContainer', {
        height: '180',
        width: '320',
        videoId: videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.protocol.startsWith('http') ? window.location.origin : undefined
        },
        events: {
          onReady: (e) => {
            _ytInstanceReady = true;
            syncYtSettings();
            if (_ytCurrentVideoId && _ytCurrentVideoId !== videoId) {
              if (_ytPendingAutoplay) {
                e.target.loadVideoById(_ytCurrentVideoId);
              } else {
                e.target.cueVideoById(_ytCurrentVideoId);
              }
            } else if (_ytPendingAutoplay) {
              e.target.playVideo();
            }
          },
          onStateChange: onYtStateChange,
          onError: onYtError
        }
      });
    } else if (!_ytInstanceReady) {
      // Player created but onReady hasn't fired yet — onReady will pick up _ytCurrentVideoId
      _ytCurrentVideoId = videoId;
    } else if (_ytCurrentVideoId !== videoId) {
      // Different video — load it
      if (autoplay) {
        _ytPlayer.loadVideoById(videoId);  // loads and plays
      } else {
        _ytPlayer.cueVideoById(videoId);   // loads, does not play
      }
      _ytCurrentVideoId = videoId;
    } else if (autoplay) {
      // Same video, just ensure it's playing
      if (typeof _ytPlayer.getPlayerState === 'function' && _ytPlayer.getPlayerState() !== 1) {
        _ytPlayer.playVideo();
      }
    }
  }

  function onYtError(event) {
    stopYtTimeSync();
    setPlayState(false);
    const messages = {
      2: 'Invalid YouTube video link.',
      5: 'YouTube player failed to play this video.',
      100: 'YouTube video not found or private.',
      101: 'This YouTube video cannot be embedded here.',
      150: 'This YouTube video cannot be embedded here.'
    };
    const fallback = window.location.protocol === 'file:'
      ? 'YouTube embeds require http://localhost (not file://).'
      : `YouTube playback error (code ${event.data}).`;
    showToast(messages[event.data] || fallback);
  }

  /** Handles YT player state changes (ended, etc.) */
  function onYtStateChange(event) {
    // YT.PlayerState.ENDED = 0
    if (event.data === 0) {
      stopYtTimeSync();
      if (engine.isRepeat) {
        _ytPlayer.seekTo(0, true);
        setPlayState(true);
      } else {
        // Auto-advance to the next track
        setPlayState(false);
        const track = engine.nextTrack();
        loadTrackMeta(track, false);
        setPlayState(true);
      }
    }
    // YT.PlayerState.PLAYING = 1 — sync duration and speed/volume once playing
    if (event.data === 1 && _ytPlayer) {
      syncYtSettings();
      const dur = _ytPlayer.getDuration();
      if (dur > 0) {
        engine.trackDuration = dur;
        const t = engine.getCurrentTrack();
        if (t) t.duration = dur;
        if (engine.onTrackDurationChange) engine.onTrackDurationChange();
      }
    }
  }

  /** Poll the YT player for current time and feed it into the engine so the
   *  waveform progress bar stays in sync. */
  function startYtTimeSync() {
    stopYtTimeSync();
    _ytTimeInterval = setInterval(() => {
      if (_ytPlayer && typeof _ytPlayer.getCurrentTime === 'function') {
        engine.trackTime = _ytPlayer.getCurrentTime() || 0;
        const dur = _ytPlayer.getDuration();
        if (dur > 0) {
          engine.trackDuration = dur;
          const t = engine.getCurrentTrack();
          if (t) t.duration = dur;
        }
      }
    }, 500);
  }

  function stopYtTimeSync() {
    if (_ytTimeInterval) {
      clearInterval(_ytTimeInterval);
      _ytTimeInterval = null;
    }
  }
  function setPlayState(play) {
    isPlaying = play;
    const track = engine.getCurrentTrack();

    if (isPlaying) {
      // Turntable animation — runs for ALL track types including YouTube
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

      // engine.start() handles crackle + local audio (for YouTube: crackle only)
      engine.start();
      if (track.youtubeVideoId) {
        ensureYtPlayer(track.youtubeVideoId, true);
        startYtTimeSync();
      }
      requestAnimationFrame(animateWaveformFrequencies);
    } else {
      // Turntable paused
      vinylRecord.classList.add('paused');
      tonearmWand.classList.remove('playing');

      iconPause.classList.add('hidden');
      iconPlay.classList.remove('hidden');

      if (track.youtubeVideoId) {
        if (_ytPlayer && typeof _ytPlayer.pauseVideo === 'function') _ytPlayer.pauseVideo();
        stopYtTimeSync();
      }
      engine.stop(); // fades crackle + pauses local audio
    }
  }

  // Master Play/Pause button
  masterPlayBtn.addEventListener('click', () => {
    setPlayState(!isPlaying);
    const track = engine.getCurrentTrack();
    showToast(isPlaying ? `Playing: ${track.title}` : 'Playback Paused');
  });

  // Previous & Next Track
  function navigateTrack(direction) {
    const shouldResume = isPlaying;
    setPlayState(false);
    const track = direction === 'previous' ? engine.prevTrack() : engine.nextTrack();
    loadTrackMeta(track, false);
    if (shouldResume) setPlayState(true);
    showToast(`Track: ${track.title}`);
  }

  prevBtn.addEventListener('click', () => navigateTrack('previous'));
  nextBtn.addEventListener('click', () => navigateTrack('next'));

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
  function loadTrackMeta(track, autoplayYoutube = false) {
    currentTrackTitle.textContent = track.title;
    currentTrackArtist.textContent = track.artist;
    currentTrackGenre.textContent = track.genre;
    likeCount.textContent = track.likes;
    labelCode.textContent = `LP-${Math.floor(100 + Math.random() * 899)}`;

    const isYoutubeTrack = Boolean(track.youtubeVideoId);
    // Always show the turntable — never switch to YouTube video layout
    playerColumn.classList.remove('youtube-active');

    if (isYoutubeTrack) {
      // Reset engine time display; actual duration comes from YT player
      engine.trackTime = 0;
      engine.trackDuration = 0;
      // Cue or switch video in the hidden YT player
      ensureYtPlayer(track.youtubeVideoId, autoplayYoutube);
      if (autoplayYoutube) startYtTimeSync();
    } else {
      stopYtTimeSync();
      if (_ytPlayer && _ytInstanceReady && typeof _ytPlayer.pauseVideo === 'function') {
        _ytPlayer.pauseVideo();
      }
    }

    updateProgressUI();

    // Highlight corresponding album card if present
    getAlbumCards().forEach(card => {
      card.classList.toggle('active-card', card.dataset.trackId === track.id);
    });

    if (isPlaying && !isYoutubeTrack) {
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
    syncYtSettings();

    // Adjust CSS animation duration to match realistic vinyl spin speed
    const baseDuration = currentRpm === 45 ? 1.333 : 1.818;
    const adjustedDuration = baseDuration / rate;
    vinylRecord.style.animationDuration = `${adjustedDuration}s`;

    const percentText = Math.round((rate - 1.0) * 100);
    const sign = percentText > 0 ? '+' : '';
    const track = engine.getCurrentTrack();
    if (track && track.youtubeVideoId) {
      const rpmFactor = currentRpm === 45 ? 1.35 : 1.0;
      const ytRate = getClosestYtRate(rate * rpmFactor);
      showToast(`YouTube Speed: ${ytRate}x`);
    } else {
      showToast(`Pitch: ${sign}${percentText}% (${rate.toFixed(2)}x)`);
    }
  });

  // 33 vs 45 RPM Switch
  rpm33Btn.addEventListener('click', () => {
    currentRpm = 33;
    rpm33Btn.classList.add('active');
    rpm45Btn.classList.remove('active');
    engine.setRPM(33);
    syncYtSettings();
    vinylRecord.classList.remove('spinning-fast');
    if (isPlaying) vinylRecord.classList.add('spinning');
    showToast('Speed: 33⅓ RPM (Standard LP)');
  });

  rpm45Btn.addEventListener('click', () => {
    currentRpm = 45;
    rpm45Btn.classList.add('active');
    rpm33Btn.classList.remove('active');
    engine.setRPM(45);
    syncYtSettings();
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
    syncYtSettings();
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
    getAlbumCards().forEach(card => {
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

  function addSavedTrackCard(track) {
    const template = albumCardsRow.querySelector('.album-card');
    if (!template) {
      throw new Error('Cannot add a track card because the album carousel is empty.');
    }

    const card = template.cloneNode(true);
    card.dataset.trackId = track.id;
    card.dataset.source = track.youtubeVideoId ? 'youtube' : 'local';
    card.classList.remove('active-card');
    card.querySelector('.card-title').textContent = track.title;
    card.querySelector('.card-artist').textContent = track.artist;
    card.querySelector('.card-quick-play').title = `Play ${track.title}`;
    addTrackSourceBadge(card, track);
    addRemoveTrackButton(card, track);
    albumCardsRow.appendChild(card);

    const query = searchInput.value.toLowerCase().trim();
    if (query) {
      const searchableText = `${track.title} ${track.artist}`.toLowerCase();
      card.style.display = searchableText.includes(query) ? 'flex' : 'none';
    } else {
      const activeCategory = document.querySelector('.cat-pill.active')?.dataset.category || 'classic';
      if (activeCategory !== 'classic') filterCardsByCategory(activeCategory);
    }
  }

  function addTrackSourceBadge(card, track) {
    if (card.querySelector('.track-source-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'track-source-badge';
    badge.textContent = track.youtubeVideoId ? 'ONLINE' : 'OFFLINE';
    card.querySelector('.card-info').appendChild(badge);
  }

  function addRemoveTrackButton(card, track) {
    if ((!track.src && !track.youtubeVideoId) || card.querySelector('.card-remove-track')) return;

    const button = document.createElement('button');
    button.className = 'card-remove-track';
    button.type = 'button';
    button.textContent = '×';
    button.title = `Remove ${track.title} from the player`;
    button.setAttribute('aria-label', button.title);
    card.querySelector('.card-art-frame').appendChild(button);
  }

  getAlbumCards().forEach(card => {
    const track = engine.tracks.find(item => item.id === card.dataset.trackId);
    if (track) {
      addTrackSourceBadge(card, track);
      addRemoveTrackButton(card, track);
    }
  });

  async function removeTrackCard(card, button) {
    const track = engine.tracks.find(item => item.id === card.dataset.trackId);
    if (!track || (!track.src && !track.youtubeVideoId)) return;

    const removalMessage = track.youtubeVideoId
      ? `Remove "${track.title}" from this browser's library? The YouTube video will not be affected.`
      : `Remove "${track.title}" from the player? The original file on disk will not be deleted.`;
    const confirmed = window.confirm(removalMessage);
    if (!confirmed) return;

    button.disabled = true;
    if (engine.getCurrentTrack().id === track.id) setPlayState(false);
    const result = await engine.removeAudioTrack(track.id);
    card.remove();
    if (result.wasCurrent) {
      loadTrackMeta(result.activeTrack);
    }
    showToast(`Removed: ${track.title}`);
  }

  // Click on album cards, including cards restored or added after page load.
  albumCardsRow.addEventListener('click', (e) => {
    const removeButton = e.target.closest('.card-remove-track');
    if (removeButton) {
      e.preventDefault();
      e.stopPropagation();
      const card = removeButton.closest('.album-card');
      removeTrackCard(card, removeButton).catch(error => {
        console.error('Could not remove audio track:', error);
        removeButton.disabled = false;
        showToast('Could not remove this song from the player.');
      });
      return;
    }

    const card = e.target.closest('.album-card');
    if (!card) return;

    const selectedTrack = engine.tracks.find(track => track.id === card.dataset.trackId);
    if (!selectedTrack) return;

    setPlayState(false);
    const track = engine.selectTrackById(card.dataset.trackId);
    if (track) {
      loadTrackMeta(track, false);
      setPlayState(true); // start for all track types — vinyl spins, YT plays audio
      showToast(`Now playing: ${track.title}`);
    }
  });

  let isAddingTracks = false;
  addTrackBtn.addEventListener('click', (e) => {
    if (isAddingTracks) e.preventDefault();
  });

  trackFileInput.addEventListener('change', async () => {
    const files = Array.from(trackFileInput.files || []);
    if (files.length === 0) return;

    isAddingTracks = true;
    addTrackBtn.setAttribute('aria-disabled', 'true');
    let addedCount = 0;
    let failedCount = 0;

    try {
      for (const file of files) {
        try {
          const track = await engine.addLocalTrack(file);
          addSavedTrackCard(track);
          addedCount++;
        } catch (error) {
          console.error(`Could not add audio file "${file.name}":`, error);
          failedCount++;
        }
      }
    } finally {
      isAddingTracks = false;
      addTrackBtn.setAttribute('aria-disabled', 'false');
      trackFileInput.value = '';
    }

    if (failedCount > 0) {
      showToast(`${addedCount} song(s) added; ${failedCount} could not be added.`);
    } else {
      showToast(`${addedCount} song(s) added and saved in this browser.`);
    }
  });

  addYoutubeTrackBtn.addEventListener('click', () => {
    youtubeTrackDialog.showModal();
    youtubeUrlInput.focus();
  });

  cancelYoutubeTrackBtn.addEventListener('click', () => youtubeTrackDialog.close());

  youtubeTrackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = youtubeTrackForm.querySelector('.youtube-dialog-submit');
    submitButton.disabled = true;

    try {
      const track = await engine.addYoutubeTrack(
        youtubeUrlInput.value,
        youtubeTitleInput.value,
        youtubeArtistInput.value
      );
      addSavedTrackCard(track);
      youtubeTrackDialog.close();
      youtubeTrackForm.reset();
      showToast('YouTube link saved. Internet is required to play it.');
    } catch (error) {
      console.error('Could not save YouTube link:', error);
      showToast(error.message || 'Could not save this YouTube link.');
    } finally {
      submitButton.disabled = false;
    }
  });

  // Favorite Playlists
  playlistRows.forEach((row) => {
    row.addEventListener('click', () => {
      const name = row.querySelector('.playlist-name')?.textContent || 'Playlist';
      showToast(`Loading: ${name} (32 tracks)`);
      // Start track
      setPlayState(false);
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

    getAlbumCards().forEach(card => {
      const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
      const artist = card.querySelector('.card-artist')?.textContent.toLowerCase() || '';
      const match = title.includes(query) || artist.includes(query);
      card.style.display = match ? 'flex' : 'none';
    });
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    getAlbumCards().forEach(c => c.style.display = 'flex');
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
    // For YouTube tracks, track-ended is handled by onYtStateChange.
    // This callback fires only for local/synth tracks.
    setPlayState(false);
    const track = engine.nextTrack();
    loadTrackMeta(track, false);
    setPlayState(true);
  };
  engine.onTrackDurationChange = updateProgressUI;
  engine.onPlaybackError = (error) => {
    console.error('Audio playback failed:', error);
    setPlayState(false);
    showToast('Could not play this audio file. Check the file path and format.');
  };

  engine.loadLocalTracks()
    .then(tracks => {
      const availableTrackIds = new Set(engine.tracks.map(track => track.id));
      getAlbumCards().forEach(card => {
        if (!availableTrackIds.has(card.dataset.trackId)) card.remove();
      });
      tracks.forEach(addSavedTrackCard);
    })
    .catch(error => {
      console.error('Could not restore saved local tracks:', error);
      showToast('Could not load saved songs. Check this browser’s storage settings.');
    });

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
