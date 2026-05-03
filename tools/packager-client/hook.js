/**
 * Client-side loader hooks
 * Intercepts network requests to load assets from embedded base64 data
 * @module client/hook
 *
 * PATCHED VERSION — fixes vs node_modules original:
 *   1. hookSystemLoader() also overrides HTMLImageElement.prototype.src so that
 *      Cocos image downloads (new Image(); img.src = url) are intercepted globally.
 *   2. hookSystemJsLoader() registers an auto-poll that calls hookCocosLoader()
 *      the first time cc.assetManager becomes available, patching Cocos' downloader
 *      as a belt-and-suspenders complement to the HTMLImageElement override.
 */

window.hookSystemLoader = function () {
	// Override URL constructor to handle asset: scheme
	var OriginalURL = window.URL;
	window.URL = function (url, base) {
		// Handle asset: scheme - convert relative paths to absolute blob URLs
		if (base && typeof base === 'string' && base.startsWith('asset:')) {
			var cleanUrl = url.replace(/^[./]+/, '');

			for (var key in window.ASSETS) {
				if (key.endsWith(cleanUrl)) {
					var blobUrl = window.getBlobURL(key);
					return new OriginalURL(blobUrl);
				}
			}

			return new OriginalURL(url, window.location.href);
		}

		// Default behavior
		if (base !== undefined) {
			return new OriginalURL(url, base);
		}

		return new OriginalURL(url);
	};
	window.URL.prototype = OriginalURL.prototype;
	window.URL.createObjectURL = OriginalURL.createObjectURL;
	window.URL.revokeObjectURL = OriginalURL.revokeObjectURL;

	// Override XMLHttpRequest to intercept asset requests
	var originalXHR = window.XMLHttpRequest;
	window.XMLHttpRequest = function () {
		var xhr = new originalXHR();
		var originalOpen = xhr.open;

		xhr.open = function (method, url) {
			var asset = window.getAsset(url);
			if (asset) {
				url = window.getBlobURL(url);
			}
			originalOpen.call(this, method, url);
		};

		return xhr;
	};

	// Override createElement to intercept script and style loading
	var originalCreateElement = document.createElement;
	document.createElement = function (tagName) {
		var element = originalCreateElement.call(document, tagName);

		if (tagName.toLowerCase() === 'script') {
			Object.defineProperty(element, 'src', {
				set: function (value) {
					var asset = window.getAsset(value);
					if (asset) {
						value = window.getBlobURL(value);
					}
					this.setAttribute('src', value);
				}
			});
		} else if (tagName.toLowerCase() === 'style') {
			Object.defineProperty(element, 'textContent', {
				set: function (value) {
					if (value.startsWith('@font-face')) {
						value = value.replace(/url\(["']?(.*?)["']?\)/g, function (match, p1) {
							var asset = window.getAsset(p1);
							if (asset) {
								var blobUrl = window.getBlobURL(p1);
								return 'url("' + blobUrl + '")';
							}
							return match;
						});
					}
					this.setAttribute('textContent', value);
				}
			});
		}
		return element;
	};

	// Override HTMLImageElement.prototype.src so ALL image assignments are intercepted,
	// including those done via `new Image(); img.src = url` outside createElement.
	// This is the primary fix for mobile: Cocos' downloadDomImage sets img.src directly.
	var origSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
	if (origSrcDesc && origSrcDesc.set) {
		Object.defineProperty(HTMLImageElement.prototype, 'src', {
			configurable: true,
			enumerable: true,
			get: function () {
				return origSrcDesc.get.call(this);
			},
			set: function (value) {
				if (value && typeof value === 'string' && !value.startsWith('data:') && !value.startsWith('blob:')) {
					var asset = window.getAsset && window.getAsset(value);
					if (asset) {
						value = window.getBlobURL(value);
					}
				}
				origSrcDesc.set.call(this, value);
			}
		});
	}

	console.log('System hooked successfully!');
};

/**
 * Hooks Cocos Creator's asset manager to load images from embedded data.
 * Belt-and-suspenders: also covered by the HTMLImageElement.prototype.src override,
 * but registering with cc.assetManager.downloader ensures correct MIME handling.
 */
window.hookCocosLoader = function () {
	if (!window.cc || !cc.assetManager) return;
	console.log('Hooking cc.assetManager...');

	function loadImage(url, options, onComplete) {
		var data = getAsset(url);
		if (data) {
			base64ToImage(data, onComplete);
		} else {
			onComplete(new Error('Asset not found: ' + url));
		}
	}

	cc.assetManager.downloader.register({
		'.png': loadImage,
		'.jpg': loadImage,
		'.jpeg': loadImage,
		'.gif': loadImage,
		'.bmp': loadImage,
		'.webp': loadImage
	});
};

/**
 * Hooks SystemJS module loader to resolve and load modules from embedded assets.
 * Waits for assets to be decompressed before hooking.
 */
window.hookSystemJsLoader = function () {
	function doHook() {
		// Override SystemJS resolve to handle embedded assets
		System.resolve = function (id, parentUrl) {
			var cleanUrl = id.replace(/^[./]+/, '');

			// Check if asset exists directly
			if (window.ASSETS && window.ASSETS[cleanUrl]) {
				return 'asset:' + cleanUrl;
			}

			// Search for matching asset path
			if (window.ASSETS) {
				for (var key in window.ASSETS) {
					if (key.endsWith('/' + id + '.js') || key.endsWith('/' + id)) {
						return 'asset:' + key;
					}
				}
			}

			return System.constructor.prototype.resolve.call(this, id, parentUrl);
		};

		// Override SystemJS instantiate to execute embedded modules
		System.instantiate = async function (url, parentUrl) {
			if (url.startsWith('asset:')) {
				var id = url.slice(6);
				var data = getAsset(id);
				if (!data) {
					console.error('Asset not found:', id);
					return System.constructor.prototype.instantiate.call(this, url, parentUrl);
				}
				var code = atob(data.split(',')[1]);
				eval(code);
				return System.getRegister();
			}

			return System.constructor.prototype.instantiate.call(this, url, parentUrl);
		};

		console.log('SystemJS hooked successfully!');
	}

	// Wait for assets to be ready before hooking SystemJS
	if (window.ASSETS_READY) {
		doHook();
	} else if (window.waitForAssets) {
		window.waitForAssets(doHook);
	} else {
		// Fallback: poll for assets
		var checkInterval = setInterval(function () {
			if (window.ASSETS_READY) {
				clearInterval(checkInterval);
				doHook();
			}
		}, 10);
	}

	// Auto-invoke hookCocosLoader once cc.assetManager is available.
	// Cocos initialises assetManager asynchronously after module loading; we poll
	// with rAF (first few frames) then fall back to setTimeout.
	window.waitForAssets(function pollCocos() {
		if (window.cc && cc.assetManager) {
			window.hookCocosLoader();
		} else {
			setTimeout(pollCocos, 50);
		}
	});
};
