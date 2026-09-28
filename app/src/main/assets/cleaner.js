(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.install(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';

  var VERSION = '1.1.1';
  var MARKER = 'data-jianlan-hidden';
  var LIST_KEYS = new Set(['aweme_list', 'data', 'cards', 'mix_items']);
  var FEED_PATH = /^\/aweme\/v[12]\/(?:web\/)?(?:tab\/feed|feed|follow\/feed|familiar\/feed|module\/feed|aweme\/post|aweme\/related|mix\/aweme|general\/search\/single|search\/item)\/?$/;
  var ZHIHU_MOBILE_LAYOUT = `
@media (max-width: 600px) {
  .ExploreHomePage {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
  }

  .ExploreHomePage-ContentSection,
  .ExploreHomePage-ContentSection-header,
  .ExploreHomePage-ContentSection-body,
  .ExploreHomePage-square,
  .ExploreHomePage-specials,
  .ExploreHomePage-roundtables,
  .ExploreHomePage-collections,
  .ExploreHomePage-columns,
  .ExploreHomePage-specialsLogin,
  .ExploreHomePage-specialCard,
  .ExploreHomePage-roundtableCard,
  .ExploreHomePage-collectionCard,
  .ExploreHomePage-columnCard {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .ExploreHomePage-square,
  .ExploreHomePage-specials,
  .ExploreHomePage-roundtables,
  .ExploreHomePage-collections,
  .ExploreHomePage-columns {
    flex-wrap: wrap !important;
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .ExploreHomePage-square > *,
  .ExploreHomePage-specials > *,
  .ExploreHomePage-specialsLogin,
  .ExploreHomePage-specialCard,
  .ExploreHomePage-roundtableCard,
  .ExploreHomePage-collectionCard,
  .ExploreHomePage-columnCard {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    flex: 0 1 100% !important;
  }

  .ExploreHomePage-specialsLogin img,
  .ExploreHomePage-specialCard img {
    max-width: 100% !important;
    height: auto !important;
  }

  .ExploreHomePage-specialsLoginBottomButton,
  .ExploreHomePage-specialsLogin button,
  .ExploreHomePage-specialCard > *,
  .ExploreHomePage-specialCard [class*="ExploreSpecialCard-"],
  .ExploreHomePage-roundtableCard [class*="ExploreRoundtableCard-"],
  .ExploreHomePage-collectionCard [class*="ExploreCollectionCard-"],
  .ExploreHomePage-columnCard > * {
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
  }

  .ExploreRoundtableCard-headerContainer,
  .ExploreRoundtableCard-headerBackgrounds {
    width: 100% !important;
  }

  .ExploreRoundtableCard-header,
  .ExploreCollectionCard-header {
    width: auto !important;
  }
}
`;

  function objectValue(value) {
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (_) { return null; }
    }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }

  function positiveFlag(value) { return value === true || value === 1; }

  function hasId(value) {
    return (typeof value === 'string' && value.trim() !== '' && value !== '0') ||
      (typeof value === 'number' && value > 0);
  }

  function isExplicitAd(item) {
    var record = objectValue(item);
    if (!record) return false;
    if (positiveFlag(record.is_ads)) return true;
    var inner = objectValue(record.aweme_info) || objectValue(record.aweme);
    if (inner && inner !== record && isExplicitAd(inner)) return true;
    var raw = objectValue(record.raw_ad_data);
    if (raw && (positiveFlag(raw.is_ad) || hasId(raw.ad_id) || hasId(raw.creative_id))) return true;
    var web = objectValue(record.web_raw_data);
    var brand = web && objectValue(web.brand_ad);
    return !!(brand && positiveFlag(brand.is_ad));
  }

  // Only known list envelopes are filtered; comments, live entries and ordinary videos stay intact.
  function filterPayload(payload) {
    var count = 0;
    function visit(value, key, depth) {
      if (!value || typeof value !== 'object' || depth > 8) return value;
      if (Array.isArray(value)) {
        if (!LIST_KEYS.has(key)) return value;
        var changed = false;
        var list = [];
        value.forEach(function (item) {
          if (isExplicitAd(item)) { count++; changed = true; return; }
          var next = visit(item, '', depth + 1);
          if (next !== item) changed = true;
          list.push(next);
        });
        return changed ? list : value;
      }
      var result = value;
      Object.keys(value).forEach(function (childKey) {
        var child = value[childKey];
        var next = visit(child, childKey, depth + 1);
        if (next !== child) {
          if (result === value) result = Object.assign({}, value);
          result[childKey] = next;
        }
      });
      return result;
    }
    var value = visit(payload, '', 0);
    return { value: value, count: count };
  }

  function hostMatches(host, domain) { return host === domain || host.endsWith('.' + domain); }

  function isFeedUrl(input, base) {
    try {
      var url = new URL(typeof input === 'string' ? input : input.url, base);
      return hostMatches(url.hostname, 'douyin.com') && FEED_PATH.test(url.pathname);
    } catch (_) { return false; }
  }

  function jsonType(value) { return /^\s*(?:application|text)\/(?:[\w.-]+\+)?json(?:\s*;|\s*$)/i.test(value || ''); }

  function install(win) {
    if (win.__jianlanCleaner && win.__jianlanCleaner.version === VERSION) return win.__jianlanCleaner;
    var doc = win.document;
    var stats = { version: VERSION, enabled: false, pageAdHidden: 0, adItemsFiltered: 0 };
    var hidden = new Set();
    var observer = null;
    var style = null;
    var timer = null;
    var undoNetwork = [];
    var host = win.location.hostname;
    var douyin = hostMatches(host, 'douyin.com') || hostMatches(host, 'iesdouyin.com');
    var bilibili = hostMatches(host, 'bilibili.com');
    var zhihu = hostMatches(host, 'zhihu.com');
    var weibo = hostMatches(host, 'weibo.com') || hostMatches(host, 'weibo.cn');
    var selectors = douyin ? [
      '[data-e2e="ad-link"]',
      '[data-e2e="feed-item"][data-is-ad="true"]',
      '[data-e2e="feed-item"][data-is-ad="1"]',
      '[data-e2e="download-app"]',
      '[data-e2e="download-app-banner"]',
      '[data-e2e="download-app-guide"]',
      '.download-app-container',
      'a[href="https://www.douyin.com/download"]'
    ] : bilibili ? [
      '.ad-report', '.ad-floor',
      '.download-app', '.openapp-dialog',
      '[data-type="download-app"]'
    ] : zhihu ? [
      '.TopstoryItem--advertCard', '.MBannerAd', '.MHotFeedAd', '.MRelateFeedAd',
      '.zhihuAdvert-MBanner', '.WeiboAd-wrap',
      'div[data-type="ad"]',
      '.AppBanner', '.MobileAppHeader-downloadLink', '.OpenInAppButton'
    ] : weibo ? [
      'div[feedtype="ad"]', 'div[ad-data]:not([ad-data=""])',
      '#app .ad-wrap',
      '#app .woo-frame.blog-config-page div.weibo-btn-box'
    ] : [];

    function scan() {
      timer = null;
      if (!stats.enabled || !doc.documentElement) return;
      if (style && !style.isConnected) doc.documentElement.appendChild(style);
      var targets = new Set();
      selectors.forEach(function (selector) {
        try {
          doc.querySelectorAll(selector).forEach(function (element) { targets.add(element); });
        } catch (_) { /* Unsupported selectors must not interrupt page startup. */ }
      });
      if (bilibili) {
        doc.querySelectorAll('.bili-video-card__info--ad').forEach(function (label) {
          var card = label.closest('.feed-card') || label.closest('.bili-video-card');
          if (card) targets.add(card);
        });
      }
      hidden.forEach(function (element) {
        if (!element.isConnected || !targets.has(element)) {
          element.removeAttribute(MARKER);
          hidden.delete(element);
        }
      });
      targets.forEach(function (element) {
        if (hidden.has(element)) return;
        // An existing marker belongs to somebody else; never undo their state.
        if (element.hasAttribute(MARKER)) return;
        element.setAttribute(MARKER, '1');
        hidden.add(element);
        stats.pageAdHidden++;
      });
    }

    function scheduleScan() {
      if (stats.enabled && timer === null) timer = win.setTimeout(scan, 50);
    }

    function installFetch() {
      if (typeof win.fetch !== 'function' || !win.Response || !win.Headers) return;
      var original = win.fetch;
      function decorate(response, source) {
        ['url', 'type', 'redirected'].forEach(function (key) {
          Object.defineProperty(response, key, { value: source[key], configurable: true });
        });
        var nativeClone = response.clone;
        Object.defineProperty(response, 'clone', {
          configurable: true,
          value: function () { return decorate(nativeClone.call(this), source); }
        });
        return response;
      }
      function wrappedFetch() {
        var args = arguments;
        var eligible = stats.enabled && isFeedUrl(args[0], win.location.href);
        return original.apply(this, args).then(async function (response) {
          if (!eligible || !stats.enabled || response.status !== 200 ||
              !jsonType(response.headers.get('content-type'))) return response;
          try {
            var result = filterPayload(await response.clone().json());
            if (!stats.enabled || result.count === 0) return response;
            var headers = new win.Headers(response.headers);
            headers.delete('content-length');
            headers.delete('content-encoding');
            var replacement = decorate(new win.Response(JSON.stringify(result.value), {
              status: response.status, statusText: response.statusText, headers: headers
            }), response);
            stats.adItemsFiltered += result.count;
            return replacement;
          } catch (_) { return response; }
        });
      }
      win.fetch = wrappedFetch;
      undoNetwork.push(function () { if (win.fetch === wrappedFetch) win.fetch = original; });
    }

    function installXhr() {
      if (!win.XMLHttpRequest) return;
      var proto = win.XMLHttpRequest.prototype;
      var originalOpen = proto.open;
      var textDescriptor = Object.getOwnPropertyDescriptor(proto, 'responseText');
      var responseDescriptor = Object.getOwnPropertyDescriptor(proto, 'response');
      if (!textDescriptor || !responseDescriptor || !textDescriptor.configurable ||
          !responseDescriptor.configurable || !textDescriptor.get || !responseDescriptor.get) return;
      var requests = new WeakMap();

      function filtered(xhr, value) {
        var request = requests.get(xhr);
        if (!stats.enabled || !request || !request.async || !request.eligible ||
            xhr.readyState !== 4 || xhr.status !== 200) return value;
        var type = xhr.responseType || '';
        if (type !== '' && type !== 'text' && type !== 'json') return value;
        if (request.checked) return request.changed ? request.value : value;
        request.checked = true;
        try {
          if (!jsonType(xhr.getResponseHeader('content-type'))) return value;
          var payload = type === 'json' ? value : JSON.parse(value);
          var result = filterPayload(payload);
          if (result.count) {
            request.value = type === 'json' ? result.value : JSON.stringify(result.value);
            request.changed = true;
            stats.adItemsFiltered += result.count;
            return request.value;
          }
        } catch (_) { /* Preserve malformed, binary and otherwise unsupported responses. */ }
        return value;
      }

      function open() {
        var result = originalOpen.apply(this, arguments);
        requests.set(this, {
          async: arguments.length < 3 || arguments[2] !== false,
          eligible: isFeedUrl(arguments[1], win.location.href), checked: false, changed: false
        });
        return result;
      }
      function responseText() { return filtered(this, textDescriptor.get.call(this)); }
      function response() { return filtered(this, responseDescriptor.get.call(this)); }
      proto.open = open;
      Object.defineProperty(proto, 'responseText', Object.assign({}, textDescriptor, { get: responseText }));
      Object.defineProperty(proto, 'response', Object.assign({}, responseDescriptor, { get: response }));
      undoNetwork.push(function () {
        if (proto.open === open) proto.open = originalOpen;
        if (Object.getOwnPropertyDescriptor(proto, 'responseText').get === responseText)
          Object.defineProperty(proto, 'responseText', textDescriptor);
        if (Object.getOwnPropertyDescriptor(proto, 'response').get === response)
          Object.defineProperty(proto, 'response', responseDescriptor);
      });
    }

    function setEnabled(enabled) {
      enabled = !!enabled;
      if (stats.enabled === enabled) return stats;
      stats.enabled = enabled;
      if (enabled) {
        if (selectors.length) {
          style = doc.createElement('style');
          style.id = 'jianlan-cleaner-style';
          style.textContent = '[' + MARKER + '="1"]{display:none!important}';
          if (zhihu) style.textContent += ZHIHU_MOBILE_LAYOUT;
          if (win.MutationObserver) {
            observer = new win.MutationObserver(scheduleScan);
            observer.observe(doc, {
              childList: true, subtree: true, attributes: true,
              attributeFilter: ['class', 'href', 'data-e2e', 'data-is-ad', 'data-type', 'feedtype', 'ad-data']
            });
          }
          scan();
        }
        if (douyin) { installFetch(); installXhr(); }
      } else {
        if (observer) { observer.disconnect(); observer = null; }
        if (timer !== null) { win.clearTimeout(timer); timer = null; }
        hidden.forEach(function (element) { element.removeAttribute(MARKER); });
        hidden.clear();
        if (style) { style.remove(); style = null; }
        undoNetwork.reverse().forEach(function (undo) { undo(); });
        undoNetwork = [];
      }
      return stats;
    }

    var controller = { version: VERSION, setEnabled: setEnabled };
    win.__jianlanStats = stats;
    win.__jianlanSetEnabled = setEnabled;
    win.__jianlanCleaner = controller;
    setEnabled(win.__jianlanInitialEnabled !== false);
    return controller;
  }

  return { install: install, filterPayload: filterPayload, isExplicitAd: isExplicitAd, isFeedUrl: isFeedUrl };
});
