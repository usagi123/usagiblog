/* Front-end controls for the Usagi Video Player block. */
(function () {
	'use strict';

	function formatTime(sec) {
		if (!isFinite(sec) || sec < 0) {
			sec = 0;
		}
		sec = Math.floor(sec);
		var h = Math.floor(sec / 3600);
		var m = Math.floor((sec % 3600) / 60);
		var s = sec % 60;
		var ss = (s < 10 ? '0' : '') + s;
		return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
	}

	function fullscreenElement() {
		return document.fullscreenElement || document.webkitFullscreenElement || null;
	}

	function init(root) {
		if (root.getAttribute('data-ready')) {
			return;
		}
		root.setAttribute('data-ready', '1');

		var sources = [];
		try {
			sources = JSON.parse(root.getAttribute('data-sources') || '[]');
		} catch (e) {}
		var current = parseInt(root.getAttribute('data-default'), 10) || 0;

		var q = function (sel) {
			return root.querySelector(sel);
		};
		var video = q('.usagi-video__media');
		var bigPlay = q('.usagi-video__bigplay');
		var playBtn = q('.usagi-video__play');
		var muteBtn = q('.usagi-video__mute');
		var seek = q('.usagi-video__seek');
		var curEl = q('.usagi-video__current');
		var durEl = q('.usagi-video__duration');
		var qualityWrap = q('.usagi-video__quality');
		var qualityBtn = q('.usagi-video__quality-btn');
		var qualityLabel = q('.usagi-video__quality-label');
		var menu = q('.usagi-video__menu');
		var fsBtn = q('.usagi-video__fs');

		// JS is running: swap native controls for ours.
		video.controls = false;
		root.classList.add('is-enhanced', 'is-paused');

		var seeking = false;
		var idleTimer = null;

		function togglePlay() {
			if (video.paused || video.ended) {
				var p = video.play();
				if (p && p.catch) {
					p.catch(function () {});
				}
			} else {
				video.pause();
			}
		}

		function setPlayingState() {
			var playing = !video.paused && !video.ended;
			root.classList.toggle('is-playing', playing);
			root.classList.toggle('is-paused', !playing);
			playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
			if (playing) {
				root.classList.add('has-started');
			}
			wake();
		}

		function updateMute() {
			var muted = video.muted || video.volume === 0;
			root.classList.toggle('is-muted', muted);
			muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
		}

		function paintSeek() {
			var dur = video.duration || 0;
			var pct = dur ? (parseFloat(seek.value) / dur) * 100 : 0;
			var buf = 0;
			if (dur && video.buffered.length) {
				for (var i = 0; i < video.buffered.length; i++) {
					if (video.buffered.start(i) <= video.currentTime + 0.5) {
						buf = Math.max(buf, video.buffered.end(i));
					}
				}
				buf = (buf / dur) * 100;
			}
			seek.style.setProperty('--usagi-played', pct + '%');
			seek.style.setProperty('--usagi-buffered', Math.max(pct, buf) + '%');
		}

		function updateTime() {
			if (!seeking) {
				seek.value = video.currentTime;
			}
			curEl.textContent = formatTime(seeking ? parseFloat(seek.value) : video.currentTime);
			paintSeek();
		}

		function updateDuration() {
			var dur = isFinite(video.duration) ? video.duration : 0;
			seek.max = dur;
			durEl.textContent = formatTime(dur);
			updateTime();
		}

		// Idle: hide the controls while playing and the pointer is still.
		function wake() {
			root.classList.remove('is-idle');
			clearTimeout(idleTimer);
			if (!video.paused && !menuOpen()) {
				idleTimer = setTimeout(function () {
					root.classList.add('is-idle');
				}, 2500);
			}
		}

		// ---- Resolution menu ----
		function menuOpen() {
			return !menu.hidden;
		}

		function closeMenu() {
			menu.hidden = true;
			qualityBtn.setAttribute('aria-expanded', 'false');
		}

		function buildMenu() {
			menu.innerHTML = '';
			sources.forEach(function (s, i) {
				var li = document.createElement('li');
				var b = document.createElement('button');
				b.type = 'button';
				b.setAttribute('role', 'menuitemradio');
				b.setAttribute('aria-checked', i === current ? 'true' : 'false');
				b.className = 'usagi-video__option' + (i === current ? ' is-active' : '');
				b.textContent = s.label;
				b.addEventListener('click', function (e) {
					e.stopPropagation();
					switchSource(i);
					closeMenu();
				});
				li.appendChild(b);
				menu.appendChild(li);
			});
		}

		function switchSource(i) {
			if (i === current || !sources[i]) {
				return;
			}
			var time = video.currentTime;
			var wasPlaying = !video.paused && !video.ended;
			var rate = video.playbackRate;
			current = i;
			qualityLabel.textContent = sources[i].label;
			buildMenu();
			root.classList.add('is-loading');
			video.src = sources[i].url;
			video.load();
			video.addEventListener('loadedmetadata', function restore() {
				video.removeEventListener('loadedmetadata', restore);
				try {
					video.currentTime = Math.min(time, video.duration || time);
				} catch (e) {}
				video.playbackRate = rate;
				if (wasPlaying) {
					var p = video.play();
					if (p && p.catch) {
						p.catch(function () {});
					}
				}
			});
		}

		if (sources.length < 2) {
			qualityWrap.hidden = true;
		} else {
			buildMenu();
		}

		qualityBtn.addEventListener('click', function (e) {
			e.stopPropagation();
			var open = !menuOpen();
			menu.hidden = !open;
			qualityBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
			wake();
		});
		document.addEventListener('click', function (e) {
			if (menuOpen() && !qualityWrap.contains(e.target)) {
				closeMenu();
			}
		});

		// ---- Fullscreen ----
		function toggleFullscreen() {
			if (fullscreenElement() === root) {
				(document.exitFullscreen || document.webkitExitFullscreen).call(document);
			} else if (root.requestFullscreen) {
				root.requestFullscreen();
			} else if (root.webkitRequestFullscreen) {
				root.webkitRequestFullscreen();
			} else if (video.webkitEnterFullscreen) {
				video.webkitEnterFullscreen(); // iPhone Safari
			}
		}

		function onFullscreenChange() {
			var fs = fullscreenElement() === root;
			root.classList.toggle('is-fullscreen', fs);
			fsBtn.setAttribute('aria-label', fs ? 'Exit fullscreen' : 'Fullscreen');
		}
		document.addEventListener('fullscreenchange', onFullscreenChange);
		document.addEventListener('webkitfullscreenchange', onFullscreenChange);

		// ---- Wiring ----
		bigPlay.addEventListener('click', togglePlay);
		playBtn.addEventListener('click', togglePlay);
		video.addEventListener('click', togglePlay);
		video.addEventListener('dblclick', toggleFullscreen);
		fsBtn.addEventListener('click', toggleFullscreen);
		muteBtn.addEventListener('click', function () {
			video.muted = !video.muted;
			if (!video.muted && video.volume === 0) {
				video.volume = 1;
			}
		});

		seek.addEventListener('input', function () {
			seeking = true;
			curEl.textContent = formatTime(parseFloat(seek.value));
			paintSeek();
		});
		seek.addEventListener('change', function () {
			video.currentTime = parseFloat(seek.value);
			seeking = false;
		});

		video.addEventListener('play', setPlayingState);
		video.addEventListener('pause', setPlayingState);
		video.addEventListener('ended', setPlayingState);
		video.addEventListener('volumechange', updateMute);
		video.addEventListener('timeupdate', updateTime);
		video.addEventListener('progress', paintSeek);
		video.addEventListener('loadedmetadata', updateDuration);
		video.addEventListener('durationchange', updateDuration);
		video.addEventListener('waiting', function () {
			root.classList.add('is-loading');
		});
		['playing', 'canplay', 'seeked', 'error'].forEach(function (ev) {
			video.addEventListener(ev, function () {
				root.classList.remove('is-loading');
			});
		});

		root.addEventListener('mousemove', wake);
		root.addEventListener('touchstart', wake, { passive: true });
		root.addEventListener('focusin', wake);
		root.addEventListener('mouseleave', function () {
			if (!video.paused && !menuOpen()) {
				root.classList.add('is-idle');
			}
		});

		// Keyboard shortcuts while the player has focus.
		root.addEventListener('keydown', function (e) {
			var tag = e.target.tagName;
			if (e.altKey || e.ctrlKey || e.metaKey) {
				return;
			}
			var onSeek = e.target === seek;
			switch (e.key) {
				case ' ':
				case 'k':
					if (tag === 'BUTTON' && e.key === ' ') {
						return; // let the focused button handle it
					}
					e.preventDefault();
					togglePlay();
					break;
				case 'm':
					video.muted = !video.muted;
					break;
				case 'f':
					toggleFullscreen();
					break;
				case 'ArrowLeft':
				case 'ArrowRight':
					if (onSeek) {
						return; // range input handles its own arrows
					}
					e.preventDefault();
					video.currentTime = Math.max(0, Math.min(video.duration || 0,
						video.currentTime + (e.key === 'ArrowLeft' ? -5 : 5)));
					break;
				case 'Escape':
					closeMenu();
					break;
				default:
					return;
			}
			wake();
		});

		updateMute();
		if (video.readyState >= 1) {
			updateDuration();
		}
	}

	function initAll() {
		Array.prototype.forEach.call(document.querySelectorAll('.usagi-video'), init);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAll);
	} else {
		initAll();
	}
})();
