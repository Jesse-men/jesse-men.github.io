var READING_LIST_BASE = 'https://jesse-men.github.io/reading_papers.html';
var STORAGE_KEY = 'reading_papers_auto';
var MAX_URL_LEN = 1800;

var HISTORY_SITES = ['arxiv.org', 'ieeexplore.ieee.org', 'dl.acm.org', 'springer.com', 'sciencedirect.com'];

function normalizeUrl(u) {
  if (!u) return '';
  return u.replace(/#.*$/, '').replace(/\/+$/, '') || u;
}

function canonicalPaperUrl(url) {
  var u = (url || '').replace(/#.*$/, '').replace(/\/+$/, '');
  var m = u.match(/ieeexplore\.ieee\.org\/document\/(\d+)/i);
  if (m) return 'https://ieeexplore.ieee.org/document/' + m[1];
  m = u.match(/ieeexplore\.ieee\.org\/stamp\/stamp\.jsp\?.*arnumber=(\d+)/i);
  if (m) return 'https://ieeexplore.ieee.org/document/' + m[1];
  m = u.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?/i);
  if (m) return 'https://arxiv.org/abs/' + m[1];
  m = u.match(/dl\.acm\.org\/doi\/(10\.[^?#]+)/i);
  if (m) return 'https://dl.acm.org/doi/' + m[1];
  m = u.match(/link\.springer\.com\/(article|chapter)\/([^/?]+)/i);
  if (m) return 'https://link.springer.com/' + m[1] + '/' + m[2];
  m = u.match(/sciencedirect\.com\/science\/article\/pii\/([^/?]+)/i);
  if (m) return 'https://www.sciencedirect.com/science/article/pii/' + m[1];
  m = u.match(/sciencedirect\.com\/science\/article\/([^/?]+)/i);
  if (m) return 'https://www.sciencedirect.com/science/article/' + m[1];
  return null;
}

function isJunkTitle(title) {
  if (!title || title.length < 3) return true;
  var t = title.trim();
  if (/^IEEE\s*Xplore\s*$/i.test(t)) return true;
  if (/^IEEE\s*Xplore\s*Login$/i.test(t)) return true;
  if (/^IEEE\s*Xplore\s*Full-Text\s*PDF/i.test(t)) return true;
  if (/^Sign\s*in$/i.test(t)) return true;
  if (/^Login$/i.test(t)) return true;
  if (/^\d{4}\.\d{4,5}(v\d+)?\.pdf$/i.test(t)) return true;
  if (/^[^ ]+\.pdf$/i.test(t)) return true;
  return false;
}

function setStatus(text) {
  var el = document.getElementById('status');
  if (el) el.textContent = text;
}

function buildUrlWithPayload(list) {
  if (!list || list.length === 0) return { url: READING_LIST_BASE };
  var payload = btoa(unescape(encodeURIComponent(JSON.stringify(list))));
  var url = READING_LIST_BASE + '?extension_payload=' + encodeURIComponent(payload);
  while (url.length > MAX_URL_LEN && list.length > 1) {
    list = list.slice(0, list.length - 1);
    payload = btoa(unescape(encodeURIComponent(JSON.stringify(list))));
    url = READING_LIST_BASE + '?extension_payload=' + encodeURIComponent(payload);
  }
  return { url: url, truncated: list.length, total: list.length };
}

document.getElementById('open-reading-list').addEventListener('click', function () {
  chrome.storage.local.get(STORAGE_KEY, function (data) {
    var list = data[STORAGE_KEY] || [];
    var result = buildUrlWithPayload(list);
    var fullLen = list.length;
    if (fullLen > 0 && result.truncated < fullLen) {
      setStatus('First ' + result.truncated + ' of ' + fullLen + ' (URL limit).');
    }
    chrome.tabs.create({ url: result.url });
    window.close();
  });
});

document.getElementById('import-from-history').addEventListener('click', function () {
  setStatus('Searching history...');
  var startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var seen = {};
  var list = [];
  var done = 0;
  function checkDone() {
    done++;
    if (done < HISTORY_SITES.length) return;
    try {
      if (list.length === 0) {
        setStatus('No paper URLs found in last 30 days.');
        return;
      }
      var result = buildUrlWithPayload(list);
      chrome.tabs.create({ url: result.url });
      if (result.truncated !== undefined && list.length > result.truncated) {
        setStatus('First ' + result.truncated + ' of ' + list.length + ' (URL limit). Open again for more.');
      } else {
        setStatus(list.length + ' papers from history.');
      }
    } catch (e) {
      setStatus('Error: ' + (e.message || 'failed'));
    }
    window.close();
  }
  HISTORY_SITES.forEach(function (site) {
    chrome.history.search({ text: site, startTime: startTime, maxResults: 200 }, function (results) {
      if (!results) { checkDone(); return; }
      results.forEach(function (item) {
        var u = (item.url || '').trim();
        if (u.length < 15) return;
        var canon = canonicalPaperUrl(u);
        if (!canon) return;
        var title = (item.title || '').trim();
        if (isJunkTitle(title)) return;
        if (!title) title = '(No title)';
        if (seen[canon]) return;
        seen[canon] = true;
        list.push({
          title: title,
          url: canon,
          date: new Date().toISOString().slice(0, 10),
          keywords: [],
          notes: '',
          citationText: title + '. ' + canon
        });
      });
      checkDone();
    });
  });
});
