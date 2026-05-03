/**
 * Client-side asset helper utilities
 * Injected into the final HTML to handle asset loading from embedded base64 data
 * @module client/asset-helper
 *
 * PATCHED VERSION — fixes vs node_modules original:
 *   1. getAsset() handles absolute https:// URLs (strips scheme + host + first path segment)
 *   2. getBlobURL() caches Blob object URLs to avoid memory leaks on mobile
 */

/**
 * Decompresses gzip base64 string to JSON object using native DecompressionStream
 * IMPORTANT: This runs synchronously by blocking until decompression completes
 */
(function () {
	var compressedBase64 = '__COMPRESSED_ASSETS__';
	var scriptList = __SCRIPT_LIST__;

	// Convert base64 to Uint8Array
	var binaryString = atob(compressedBase64);
	var bytes = new Uint8Array(binaryString.length);
	for (var i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	// Initialize empty ASSETS - will be populated async
	window.ASSETS = {};
	window.ASSETS_READY = false;
	window.ASSETS_CALLBACKS = [];

	/**
	 * Waits for assets to be ready, then calls callback
	 * @param {function} cb - Callback to call when assets are ready
	 */
	window.waitForAssets = function (cb) {
		if (window.ASSETS_READY) {
			cb();
		} else {
			window.ASSETS_CALLBACKS.push(cb);
		}
	};

	/**
	 * Decodes base64 data URI and returns the content string
	 * @param {string} base64DataUri - Base64 data URI (e.g., "data:application/javascript;base64,...")
	 * @returns {string} Decoded content
	 */
	function decodeBase64Content(base64DataUri) {
		var base64 = base64DataUri.split(',')[1];
		return atob(base64);
	}

	/**
	 * Executes all scripts in order after assets are decompressed
	 */
	function executeScripts() {
		console.log('Executing ' + scriptList.length + ' scripts via eval...');
		for (var i = 0; i < scriptList.length; i++) {
			var scriptPath = scriptList[i];
			var scriptData = window.ASSETS[scriptPath];
			if (scriptData) {
				try {
					var scriptContent = decodeBase64Content(scriptData);
					eval(scriptContent);
				} catch (err) {
					console.error('Failed to eval script: ' + scriptPath, err);
				}
			} else {
				console.warn('Script not found in ASSETS: ' + scriptPath);
			}
		}
		console.log('All scripts executed!');
	}

	function onAssetsReady() {
		window.ASSETS_READY = true;
		console.log('Assets decompressed! (' + Object.keys(window.ASSETS).length + ' assets)');

		// Execute deferred scripts first
		executeScripts();

		// Then call any waiting callbacks
		window.ASSETS_CALLBACKS.forEach(function (cb) { cb(); });
		window.ASSETS_CALLBACKS = [];
	}

	// Use native DecompressionStream (modern browsers)
	if (typeof DecompressionStream !== 'undefined') {
		var ds = new DecompressionStream('gzip');
		var blob = new Blob([bytes]);
		var decompressedStream = blob.stream().pipeThrough(ds);

		new Response(decompressedStream).text().then(function (jsonStr) {
			window.ASSETS = JSON.parse(jsonStr);
			onAssetsReady();
		}).catch(function (err) {
			console.error('Failed to decompress assets:', err);
			onAssetsReady(); // Still mark as ready to not block forever
		});
	} else {
		console.error('DecompressionStream not supported. Please use a modern browser (Chrome 80+, Firefox 113+, Safari 16.4+).');
		onAssetsReady();
	}
})();

/**
 * Resolves an asset key from a URL.
 *
 * Handles three URL forms:
 *   1. Relative: "assets/main/import/ab/abcdef.json"  →  stripped of leading "./"
 *   2. Absolute same-origin: "https://host/reponame/assets/..."  →  try "reponame/assets/…" then "assets/…"
 *   3. Anything else: returned as-is after stripping leading dots/slashes
 *
 * @param {string} url - Asset URL to retrieve
 * @returns {string|null} Base64 data URI or null if not found
 */
window.getAsset = function (url) {
	var cleanUrl = url.replace(/^[./]+/, '');

	// Fast path: direct key match (handles relative URLs)
	if (window.ASSETS && window.ASSETS[cleanUrl]) return window.ASSETS[cleanUrl];

	// Slow path: absolute URL — extract pathname and try progressively shorter paths
	if (cleanUrl.indexOf('://') !== -1) {
		var schemeEnd = cleanUrl.indexOf('://') + 3;
		var pathStart = cleanUrl.indexOf('/', schemeEnd);
		if (pathStart !== -1) {
			// fullPath = everything after the leading "/" (e.g. "goosain-bolt/assets/main/…")
			var fullPath = cleanUrl.slice(pathStart + 1);
			if (window.ASSETS && window.ASSETS[fullPath]) return window.ASSETS[fullPath];

			// Strip first path segment (repo/sub-directory prefix in GitHub Pages style URLs)
			var segIdx = fullPath.indexOf('/');
			if (segIdx !== -1) {
				var subPath = fullPath.slice(segIdx + 1);
				if (window.ASSETS && window.ASSETS[subPath]) return window.ASSETS[subPath];
			}
		}
	}

	return null;
};

/**
 * Converts a base64 data URI to a Blob
 * @param {string} base64 - Base64 data URI
 * @returns {Blob} Blob object
 */
window.base64ToBlob = function (base64) {
	var arr = base64.split(',');
	var mime = arr[0].match(/:(.*?);/)[1];
	var bstr = atob(arr[1]);
	var n = bstr.length;
	var u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new Blob([u8arr], { type: mime });
};

/**
 * Returns a cached Blob URL for an asset.
 * Caching prevents repeated Blob + createObjectURL allocations (critical on mobile).
 * @param {string} url - Asset URL
 * @returns {string|null} Blob URL or null if asset not found
 */
var _blobUrlCache = {};
window.getBlobURL = function (url) {
	if (_blobUrlCache[url]) return _blobUrlCache[url];
	var base64 = getAsset(url);
	if (!base64) return null;
	var blob = base64ToBlob(base64);
	var blobUrl = URL.createObjectURL(blob);
	_blobUrlCache[url] = blobUrl;
	return blobUrl;
};

/**
 * Loads a base64 data URI as an Image
 * @param {string} base64 - Base64 data URI
 * @param {function(Error|null, HTMLImageElement=): void} cb - Callback function
 */
window.base64ToImage = function (base64, cb) {
	var img = new Image();
	img.onload = function () { cb(null, img); };
	img.onerror = function () { cb(new Error('Load image failed')); };
	img.src = base64;
};
