/* Editor side of the Usagi Video Player block (no build step needed). */
(function (wp, cfg) {
	if (!wp || !wp.blocks || !cfg) {
		return;
	}

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useState = wp.element.useState;
	var be = wp.blockEditor;
	var c = wp.components;

	function formatSize(bytes) {
		return Math.round(bytes / (1024 * 1024)) + ' MB';
	}

	function resolutionValue(label) {
		var n = parseInt(label, 10);
		return isNaN(n) ? 0 : n;
	}

	// Highest resolution first; keep the default pointing at the same video.
	function sortSources(sources, defaultUrl) {
		var sorted = sources.slice().sort(function (a, b) {
			return resolutionValue(b.label) - resolutionValue(a.label);
		});
		var idx = 0;
		sorted.forEach(function (s, i) {
			if (s.url === defaultUrl) {
				idx = i;
			}
		});
		return { sources: sorted, defaultIndex: idx };
	}

	// Read the video's height locally (before uploading) to label it, e.g. "1080p".
	function detectLabel(file) {
		return new Promise(function (resolve) {
			if (!file.type || file.type.indexOf('video/') !== 0) {
				resolve('');
				return;
			}
			var video = document.createElement('video');
			var url = URL.createObjectURL(file);
			var finished = false;
			function done(label) {
				if (finished) {
					return;
				}
				finished = true;
				URL.revokeObjectURL(url);
				resolve(label);
			}
			video.preload = 'metadata';
			video.muted = true;
			video.onloadedmetadata = function () {
				done(video.videoHeight ? video.videoHeight + 'p' : '');
			};
			video.onerror = function () {
				done('');
			};
			setTimeout(function () {
				done('');
			}, 8000);
			video.src = url;
		});
	}

	// Upload through this site's REST endpoint, which forwards to catbox.moe.
	function uploadToCatbox(file, onProgress) {
		return new Promise(function (resolve, reject) {
			if (file.size > cfg.maxUpload) {
				reject(new Error(
					file.name + ' is ' + formatSize(file.size) + ', over the ' + formatSize(cfg.maxUpload) +
					' limit. Upload it on catbox.moe yourself and paste the link instead.'
				));
				return;
			}
			var xhr = new XMLHttpRequest();
			xhr.open('POST', cfg.uploadUrl);
			xhr.setRequestHeader('X-WP-Nonce', cfg.nonce);
			xhr.upload.onprogress = function (e) {
				if (e.lengthComputable) {
					onProgress(e.loaded / e.total);
				}
			};
			xhr.upload.onload = function () {
				onProgress(1);
			};
			xhr.onload = function () {
				var data = null;
				try {
					data = JSON.parse(xhr.responseText);
				} catch (err) {}
				if (xhr.status >= 200 && xhr.status < 300 && data && data.url) {
					resolve(data.url);
				} else {
					reject(new Error((data && data.message) || 'Upload failed (HTTP ' + xhr.status + ').'));
				}
			};
			xhr.onerror = function () {
				reject(new Error('Network error while uploading ' + file.name + '.'));
			};
			var form = new FormData();
			form.append('file', file);
			xhr.send(form);
		});
	}

	function isHttpUrl(value) {
		return /^https?:\/\/\S+$/i.test(value);
	}

	function UploadArea(props) {
		var upload = props.upload;
		var urlState = useState('');
		var url = urlState[0];
		var setUrl = urlState[1];
		var busy = !!upload.status;

		function addUrl() {
			var value = url.trim();
			if (!isHttpUrl(value)) {
				props.onError('Enter a full link starting with https://');
				return;
			}
			props.onAddUrl(value);
			setUrl('');
		}

		return el('div', { className: 'usagi-video-editor__upload' },
			el('div', { className: 'usagi-video-editor__row' },
				el(c.FormFileUpload, {
					accept: 'video/*',
					multiple: true,
					disabled: busy,
					onChange: function (e) {
						props.onFiles(Array.prototype.slice.call(e.target.files || []));
						e.target.value = '';
					},
					render: function (o) {
						return el(c.Button, { variant: 'primary', isPrimary: true, disabled: busy, onClick: o.openFileDialog },
							props.uploadLabel);
					}
				}),
				el('span', { className: 'usagi-video-editor__or' }, 'or'),
				el('input', {
					type: 'url',
					className: 'usagi-video-editor__url components-text-control__input',
					placeholder: 'Paste a https://files.catbox.moe/… link',
					value: url,
					disabled: busy,
					onChange: function (e) {
						setUrl(e.target.value);
					},
					onKeyDown: function (e) {
						if (e.key === 'Enter') {
							e.preventDefault();
							addUrl();
						}
					}
				}),
				el(c.Button, { variant: 'secondary', isSecondary: true, disabled: busy || !url.trim(), onClick: addUrl }, 'Add link')
			),
			el('p', { className: 'usagi-video-editor__hint' },
				'Pick several files at once to add several resolutions. Max ' + formatSize(cfg.maxUpload) + ' per file.'),
			upload.status && el('div', { className: 'usagi-video-editor__progress' },
				el(c.Spinner),
				el('span', null, upload.status),
				el('div', { className: 'usagi-video-editor__bar' },
					el('div', { style: { width: Math.round(upload.progress * 100) + '%' } }))
			),
			upload.error && el(c.Notice, { status: 'error', isDismissible: true, onRemove: props.clearError }, upload.error)
		);
	}

	function Edit(props) {
		var attrs = props.attributes;
		var setAttributes = props.setAttributes;
		var sources = attrs.sources || [];
		var defaultIndex = attrs.defaultIndex < sources.length ? attrs.defaultIndex : 0;
		var blockProps = be.useBlockProps({ className: 'usagi-video-editor' });

		var uploadState = useState({ status: '', progress: 0, error: '' });
		var upload = uploadState[0];
		var setUpload = uploadState[1];

		var posterState = useState('');
		var posterStatus = posterState[0];
		var setPosterStatus = posterState[1];

		// Uses the latest saved list so sequential uploads don't overwrite each other.
		var latest = { sources: sources, defaultIndex: defaultIndex };

		function commit(next, defaultUrl) {
			var sorted = sortSources(next, defaultUrl);
			latest = sorted;
			setAttributes(sorted);
		}

		function currentDefaultUrl() {
			var s = latest.sources[latest.defaultIndex];
			return s ? s.url : null;
		}

		function addSource(url, label) {
			var list = latest.sources.filter(function (s) {
				return s.url !== url;
			});
			var defUrl = currentDefaultUrl() || url;
			list.push({ url: url, label: label || 'Source ' + (list.length + 1) });
			commit(list, defUrl);
		}

		function handleFiles(files) {
			if (!files.length) {
				return;
			}
			var chain = Promise.resolve();
			var failed = [];
			files.forEach(function (file, i) {
				chain = chain.then(function () {
					var prefix = files.length > 1 ? '(' + (i + 1) + '/' + files.length + ') ' : '';
					setUpload({ status: prefix + 'Reading ' + file.name + '…', progress: 0, error: '' });
					return detectLabel(file).then(function (label) {
						return uploadToCatbox(file, function (p) {
							setUpload({
								status: p < 1 ? prefix + 'Uploading ' + file.name + '… ' + Math.round(p * 100) + '%'
									: prefix + 'Sending ' + file.name + ' to catbox.moe… (this can take a while)',
								progress: p,
								error: ''
							});
						}).then(function (url) {
							addSource(url, label);
						});
					}).catch(function (err) {
						failed.push(err.message);
					});
				});
			});
			chain.then(function () {
				setUpload({ status: '', progress: 0, error: failed.join(' ') });
			});
		}

		function uploadPoster(file) {
			setPosterStatus('Uploading poster…');
			uploadToCatbox(file, function () {}).then(function (url) {
				setAttributes({ poster: url });
				setPosterStatus('');
			}).catch(function (err) {
				setPosterStatus(err.message);
			});
		}

		function updateLabel(index, label) {
			var list = sources.map(function (s, i) {
				return i === index ? { url: s.url, label: label } : s;
			});
			// Don't re-sort while typing; sort happens on blur.
			setAttributes({ sources: list });
		}

		function removeSource(index) {
			var defUrl = sources[defaultIndex] && index !== defaultIndex ? sources[defaultIndex].url : null;
			var list = sources.filter(function (s, i) {
				return i !== index;
			});
			commit(list, defUrl || (list[0] && list[0].url));
		}

		var uploadArea = el(UploadArea, {
			upload: upload,
			uploadLabel: sources.length ? 'Upload another resolution' : 'Upload video to catbox.moe',
			onFiles: handleFiles,
			onAddUrl: function (url) {
				addSource(url, '');
			},
			onError: function (msg) {
				setUpload({ status: '', progress: 0, error: msg });
			},
			clearError: function () {
				setUpload({ status: upload.status, progress: upload.progress, error: '' });
			}
		});

		var inspector = el(be.InspectorControls, null,
			el(c.PanelBody, { title: 'Poster image', initialOpen: true },
				attrs.poster && el('img', { src: attrs.poster, alt: '', className: 'usagi-video-editor__poster' }),
				el(c.TextControl, {
					label: 'Poster URL',
					value: attrs.poster,
					onChange: function (v) {
						setAttributes({ poster: v.trim() });
					}
				}),
				el(c.FormFileUpload, {
					accept: 'image/*',
					onChange: function (e) {
						if (e.target.files && e.target.files[0]) {
							uploadPoster(e.target.files[0]);
						}
						e.target.value = '';
					},
					render: function (o) {
						return el(c.Button, { variant: 'secondary', isSecondary: true, onClick: o.openFileDialog }, 'Upload poster to catbox.moe');
					}
				}),
				attrs.poster && el(c.Button, {
					variant: 'link', isLink: true, isDestructive: true,
					onClick: function () {
						setAttributes({ poster: '' });
					}
				}, 'Remove poster'),
				posterStatus && el('p', { className: 'usagi-video-editor__hint' }, posterStatus)
			)
		);

		if (!sources.length) {
			return el('div', blockProps,
				inspector,
				el(c.Placeholder, {
					icon: 'video-alt3',
					label: 'Video Player',
					instructions: 'Upload a video to catbox.moe, or paste a catbox link you already have.'
				}, uploadArea)
			);
		}

		return el('div', blockProps,
			inspector,
			el('video', {
				className: 'usagi-video-editor__preview',
				src: sources[defaultIndex].url,
				poster: attrs.poster || undefined,
				controls: true,
				preload: 'metadata'
			}),
			props.isSelected && el('div', { className: 'usagi-video-editor__panel' },
				el('strong', null, 'Resolutions'),
				el('ul', { className: 'usagi-video-editor__list' },
					sources.map(function (s, i) {
						return el('li', { key: s.url },
							el('input', {
								type: 'text',
								className: 'usagi-video-editor__label components-text-control__input',
								value: s.label,
								'aria-label': 'Resolution label',
								onChange: function (e) {
									updateLabel(i, e.target.value);
								},
								onBlur: function () {
									commit(sources, sources[defaultIndex] && sources[defaultIndex].url);
								}
							}),
							el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', className: 'usagi-video-editor__link' }, s.url),
							i === defaultIndex
								? el('span', { className: 'usagi-video-editor__default' }, 'Default')
								: el(c.Button, {
									variant: 'tertiary', isTertiary: true,
									onClick: function () {
										setAttributes({ defaultIndex: i });
									}
								}, 'Make default'),
							el(c.Button, {
								variant: 'tertiary', isTertiary: true, isDestructive: true,
								onClick: function () {
									removeSource(i);
								}
							}, 'Remove')
						);
					})
				),
				uploadArea
			)
		);
	}

	wp.blocks.registerBlockType('usagiblog/video-player', {
		apiVersion: 2,
		title: 'Video Player',
		description: 'Video with custom controls and a resolution switcher, hosted on catbox.moe.',
		category: 'media',
		icon: 'video-alt3',
		keywords: ['video', 'catbox', 'player'],
		supports: { html: false },
		attributes: {
			sources: { type: 'array', default: [] },
			defaultIndex: { type: 'number', default: 0 },
			poster: { type: 'string', default: '' }
		},
		edit: Edit,
		save: function () {
			return null; // Rendered by PHP.
		}
	});
})(window.wp, window.usagiblogVideo);
