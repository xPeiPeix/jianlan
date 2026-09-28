const test = require('node:test');
const assert = require('node:assert/strict');
const cleaner = require('../app/src/main/assets/cleaner.js');

const FEED = 'https://www.douyin.com/aweme/v1/web/tab/feed/?count=10';
const payload = () => ({
  status_code: 0,
  aweme_list: [
    { aweme_id: 'normal', desc: '品牌合作与购物分享', is_ads: false },
    { aweme_id: 'live', cell_room: { rawdata: '{}' }, is_ads: 0 },
    { aweme_id: 'empty-metadata', raw_ad_data: '{}' },
    { aweme_id: 'ad', is_ads: true }
  ],
  has_more: true
});

class Element {
  constructor(selector = '') {
    this.selector = selector;
    this.attrs = new Map();
    this.isConnected = true;
    this.parent = null;
  }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  removeAttribute(name) { this.attrs.delete(name); }
  appendChild(child) { child.isConnected = true; child.parent = this; }
  remove() { this.isConnected = false; this.parent = null; }
}

function makeXhrClass() {
  return class FakeXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this._type = '';
      this._body = '';
      this.contentType = 'application/json';
    }
    open(method, url, async = true) {
      this.method = method;
      this.url = url;
      this.async = async;
      this.readyState = 1;
      this._body = '';
    }
    complete(body, status = 200, contentType = 'application/json') {
      this._body = body;
      this.status = status;
      this.contentType = contentType;
      this.readyState = 4;
    }
    getResponseHeader(name) { return name.toLowerCase() === 'content-type' ? this.contentType : null; }
    get responseType() {
      if (this.throwTypeRead) throw new Error('responseType must not be inspected');
      return this._type;
    }
    set responseType(type) { this._type = type; }
    get responseText() {
      if (this._type !== '' && this._type !== 'text') throw new DOMException('Wrong responseType', 'InvalidStateError');
      return this._body;
    }
    get response() { return this._body; }
  };
}

function makeWindow(host = 'www.douyin.com', fetchImpl = async () => new Response('{}')) {
  const timers = new Map();
  let nextTimer = 1;
  const observers = [];
  const doc = {
    elements: [], styles: [], documentElement: new Element(),
    createElement(tag) {
      assert.equal(tag, 'style');
      const element = new Element();
      element.isConnected = false;
      this.styles.push(element);
      return element;
    },
    querySelectorAll(selector) { return this.elements.filter(element => element.selector === selector && element.isConnected); }
  };
  const win = {
    document: doc,
    location: { hostname: host, href: `https://${host}/` },
    Response, Headers,
    XMLHttpRequest: makeXhrClass(),
    fetch: fetchImpl,
    setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; this.active = false; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    },
    flushMutation() {
      observers.filter(observer => observer.active).forEach(observer => observer.fn([]));
      [...timers.entries()].forEach(([id, fn]) => { timers.delete(id); fn(); });
    },
    timers, observers
  };
  return win;
}

test('only explicit advertising flags are removed; normal commerce, live and empty metadata survive', () => {
  const source = payload();
  const before = JSON.stringify(source);
  const result = cleaner.filterPayload(source);
  assert.equal(result.count, 1);
  assert.deepEqual(result.value.aweme_list.map(item => item.aweme_id), ['normal', 'live', 'empty-metadata']);
  assert.equal(JSON.stringify(source), before, 'source response must not be mutated');
  assert.equal(result.value.has_more, true);
  assert.equal(result.value.aweme_list[0], source.aweme_list[0]);
});

test('search/feed envelopes recognize explicit metadata, including serialized card records', () => {
  const source = {
    data: [
      { aweme_info: { is_ads: 1 } },
      { aweme: { raw_ad_data: JSON.stringify({ creative_id: '123' }) } },
      { aweme: JSON.stringify({ web_raw_data: JSON.stringify({ brand_ad: JSON.stringify({ is_ad: 1 }) }) }) },
      { aweme_info: { is_ads: 'false', raw_ad_data: JSON.stringify({ ad_id: 0 }) } },
      { cell_room: { id: 'normal-live' } }
    ],
    cards: [{ aweme: JSON.stringify({ is_ads: true }) }, { aweme: 'invalid-json' }],
    comments: [{ is_ads: true, text: 'unrelated list must not be filtered' }]
  };
  const result = cleaner.filterPayload(source);
  assert.equal(result.count, 4);
  assert.equal(result.value.data.length, 2);
  assert.equal(result.value.cards.length, 1);
  assert.equal(result.value.comments, source.comments);
});

test('unmarked payloads retain object identity; unknown API routes and foreign hosts are excluded', () => {
  const source = { aweme_list: [{ is_ads: 0, raw_ad_data: 'not JSON' }] };
  assert.equal(cleaner.filterPayload(source).value, source);
  assert.equal(cleaner.isFeedUrl(FEED), true);
  assert.equal(cleaner.isFeedUrl('/aweme/v1/web/search/item/', 'https://www.douyin.com/'), true);
  assert.equal(cleaner.isFeedUrl('https://douyin.com.evil.invalid/aweme/v1/web/tab/feed/'), false);
  assert.equal(cleaner.isFeedUrl('https://www.douyin.com/aweme/v1/web/aweme/detail/'), false);
  assert.equal(cleaner.isFeedUrl('https://api.bilibili.com/x/player/wbi/playurl'), false);
});

test('DOM cleanup and duplicate injection are reversible without touching login UI or pre-existing markers', () => {
  const win = makeWindow();
  const ad = new Element('[data-e2e="ad-link"]');
  const login = new Element('.login-dialog');
  const external = new Element('[data-e2e="download-app"]');
  external.setAttribute('data-jianlan-hidden', 'external');
  win.document.elements.push(ad, login, external);
  const originalFetch = win.fetch;
  const originalOpen = win.XMLHttpRequest.prototype.open;
  const controller = cleaner.install(win);
  const installedFetch = win.fetch;
  const initialStats = win.__jianlanStats;
  assert.equal(ad.getAttribute('data-jianlan-hidden'), '1');
  assert.equal(login.hasAttribute('data-jianlan-hidden'), false);
  assert.equal(initialStats.pageAdHidden, 1);
  assert.equal(cleaner.install(win), controller);
  assert.equal(win.fetch, installedFetch);
  assert.equal(win.__jianlanStats, initialStats);
  assert.equal(win.document.styles.length, 1);
  win.__jianlanSetEnabled(false);
  assert.equal(ad.hasAttribute('data-jianlan-hidden'), false);
  assert.equal(external.getAttribute('data-jianlan-hidden'), 'external');
  assert.equal(win.document.styles[0].isConnected, false);
  assert.equal(win.observers.some(observer => observer.active), false);
  assert.equal(win.fetch, originalFetch);
  assert.equal(win.XMLHttpRequest.prototype.open, originalOpen);
  assert.equal(initialStats.enabled, false);
  assert.deepEqual(Object.keys(initialStats).sort(), ['adItemsFiltered', 'enabled', 'pageAdHidden', 'version']);
  win.__jianlanSetEnabled(true);
  assert.equal(ad.getAttribute('data-jianlan-hidden'), '1');
  win.__jianlanSetEnabled(false);
});

test('document-start without an html element and later SPA insertions are handled', () => {
  const win = makeWindow('m.douyin.com');
  win.document.documentElement = null;
  cleaner.install(win);
  assert.equal(win.document.styles[0].isConnected, false);
  win.document.documentElement = new Element();
  const prompt = new Element('[data-e2e="download-app-banner"]');
  win.document.elements.push(prompt);
  win.flushMutation();
  assert.equal(win.document.styles[0].isConnected, true);
  assert.equal(prompt.getAttribute('data-jianlan-hidden'), '1');
  win.observers[0].fn([]);
  assert.equal(win.timers.size, 1);
  win.__jianlanSetEnabled(false);
  assert.equal(win.timers.size, 0);
});

test('Bilibili uses only marked DOM cleanup and leaves network APIs untouched', () => {
  const win = makeWindow('m.bilibili.com');
  const ad = new Element('.ad-report');
  const normalVideo = new Element('.bili-video-card');
  win.document.elements.push(ad, normalVideo);
  const originalFetch = win.fetch;
  const originalOpen = win.XMLHttpRequest.prototype.open;
  cleaner.install(win);
  assert.equal(win.fetch, originalFetch);
  assert.equal(win.XMLHttpRequest.prototype.open, originalOpen);
  assert.equal(ad.getAttribute('data-jianlan-hidden'), '1');
  assert.equal(normalVideo.hasAttribute('data-jianlan-hidden'), false);
  win.__jianlanSetEnabled(false);
});

test('fetch keeps request arguments and response identity fields, clone and JSON consumption', async () => {
  const original = new Response(JSON.stringify(payload()), {
    status: 200, statusText: 'OK', headers: {
      'content-type': 'application/json; charset=utf-8', 'content-length': '900', 'content-encoding': 'gzip', 'x-fixture': 'kept'
    }
  });
  Object.defineProperty(original, 'url', { value: FEED });
  Object.defineProperty(original, 'redirected', { value: true });
  Object.defineProperty(original, 'type', { value: 'basic' });
  const request = new Request(FEED, { credentials: 'include' });
  const options = { cache: 'no-store' };
  let received;
  const win = makeWindow('www.douyin.com', function (...args) { received = { self: this, args }; return Promise.resolve(original); });
  cleaner.install(win);
  const response = await win.fetch(request, options);
  assert.equal(received.self, win);
  assert.equal(received.args[0], request);
  assert.equal(received.args[1], options);
  assert.equal(response.status, 200);
  assert.equal(response.statusText, 'OK');
  assert.equal(response.url, FEED);
  assert.equal(response.redirected, true);
  assert.equal(response.type, 'basic');
  assert.equal(response.headers.get('x-fixture'), 'kept');
  assert.equal(response.headers.has('content-length'), false);
  assert.equal(response.headers.has('content-encoding'), false);
  const cloned = response.clone();
  assert.equal(cloned.url, FEED);
  assert.equal(cloned.type, 'basic');
  assert.equal((await cloned.json()).aweme_list.length, 3);
  assert.equal(response.bodyUsed, false);
  assert.equal((await response.json()).aweme_list.length, 3);
  assert.equal(response.bodyUsed, true);
  assert.equal(win.__jianlanStats.adItemsFiltered, 1);
  assert.equal(original.bodyUsed, false);
  win.__jianlanSetEnabled(false);
});

test('fetch passes non-200, non-JSON, malformed JSON, unrelated URLs and unmarked JSON through unchanged', async () => {
  const fixtures = [
    [FEED, new Response(JSON.stringify(payload()), { status: 403, headers: { 'content-type': 'application/json' } })],
    [FEED, new Response(JSON.stringify(payload()), { status: 201, headers: { 'content-type': 'application/json' } })],
    [FEED, new Response(JSON.stringify(payload()), { headers: { 'content-type': 'text/html' } })],
    [FEED, new Response('{bad', { headers: { 'content-type': 'application/json' } })],
    ['https://www.douyin.com/aweme/v1/web/unknown/', new Response(JSON.stringify(payload()), { headers: { 'content-type': 'application/json' } })],
    [FEED, new Response('{"aweme_list":[{"aweme_id":"normal"}]}', { headers: { 'content-type': 'application/json' } })]
  ];
  for (const [url, original] of fixtures) {
    const win = makeWindow('www.douyin.com', async () => original);
    cleaner.install(win);
    assert.equal(await win.fetch(url), original);
    assert.equal(original.bodyUsed, false);
    assert.equal(win.__jianlanStats.adItemsFiltered, 0);
    win.__jianlanSetEnabled(false);
  }
});

test('turning cleanup off while fetch is in flight preserves the returned response', async () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  const win = makeWindow('www.douyin.com', () => promise);
  cleaner.install(win);
  const pending = win.fetch(FEED);
  win.__jianlanSetEnabled(false);
  const original = new Response(JSON.stringify(payload()), { headers: { 'content-type': 'application/json' } });
  resolve(original);
  assert.equal(await pending, original);
  assert.equal(win.__jianlanStats.adItemsFiltered, 0);
});

test('fetch rejections preserve the original error', async () => {
  const error = new DOMException('Aborted', 'AbortError');
  const win = makeWindow('www.douyin.com', () => Promise.reject(error));
  cleaner.install(win);
  await assert.rejects(win.fetch(FEED), caught => caught === error);
  win.__jianlanSetEnabled(false);
});

test('XHR text and json contracts retain types and count filtering once across repeated reads', () => {
  const win = makeWindow();
  const originalText = Object.getOwnPropertyDescriptor(win.XMLHttpRequest.prototype, 'responseText');
  cleaner.install(win);
  const xhr = new win.XMLHttpRequest();
  xhr.open('GET', FEED);
  xhr.complete(JSON.stringify(payload()));
  assert.equal(JSON.parse(xhr.responseText).aweme_list.length, 3);
  assert.equal(xhr.response, xhr.responseText);
  assert.equal(win.__jianlanStats.adItemsFiltered, 1);
  xhr.open('GET', FEED);
  xhr.responseType = 'json';
  const source = payload();
  xhr.complete(source);
  assert.equal(xhr.response.aweme_list.length, 3);
  assert.equal(source.aweme_list.length, 4);
  assert.equal(xhr.response, xhr.response);
  assert.throws(() => xhr.responseText, { name: 'InvalidStateError' });
  assert.equal(win.__jianlanStats.adItemsFiltered, 2);
  win.__jianlanSetEnabled(false);
  assert.equal(xhr.response, source, 'native data is exposed again after disabling');
  assert.equal(Object.getOwnPropertyDescriptor(win.XMLHttpRequest.prototype, 'responseText').get, originalText.get);
});

test('XHR synchronous, binary, incomplete, failed and non-JSON responses pass through', () => {
  const win = makeWindow();
  cleaner.install(win);
  const sync = new win.XMLHttpRequest();
  sync.open('GET', FEED, false);
  const text = JSON.stringify(payload());
  sync.complete(text);
  sync.throwTypeRead = true;
  assert.equal(sync.responseText, text);
  assert.equal(sync.response, text);
  const binary = new win.XMLHttpRequest();
  binary.open('GET', FEED);
  binary.responseType = 'arraybuffer';
  const buffer = new ArrayBuffer(16);
  binary.complete(buffer);
  assert.equal(binary.response, buffer);
  assert.throws(() => binary.responseText, { name: 'InvalidStateError' });
  for (const [status, type, state] of [[403, 'application/json', 4], [200, 'text/html', 4], [200, 'application/json', 3]]) {
    const xhr = new win.XMLHttpRequest();
    xhr.open('GET', FEED);
    xhr.complete(text, status, type);
    xhr.readyState = state;
    assert.equal(xhr.responseText, text);
  }
  assert.equal(win.__jianlanStats.adItemsFiltered, 0);
  win.__jianlanSetEnabled(false);
});

test('initial disabled state creates no hooks or observer; disabling does not replace later third-party fetch hooks', () => {
  const win = makeWindow();
  win.__jianlanInitialEnabled = false;
  const original = win.fetch;
  cleaner.install(win);
  assert.equal(win.__jianlanStats.enabled, false);
  assert.equal(win.fetch, original);
  assert.equal(win.observers.length, 0);
  win.__jianlanSetEnabled(true);
  const laterHook = function () { return Promise.resolve(new Response('{}')); };
  win.fetch = laterHook;
  win.__jianlanSetEnabled(false);
  assert.equal(win.fetch, laterHook);
});
