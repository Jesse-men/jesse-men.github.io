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

function parseYear(s) {
  var m = (s || '').match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

function citationFromPaper(item) {
  var c = item && item.citation ? item.citation : null;
  if (!c) return '';
  var authors = c.authors || [];
  var authorText = authors.length ? (authors.length <= 3 ? authors.join(', ') : (authors[0] + ' et al.')) : '';
  var parts = [];
  if (authorText) parts.push(authorText);
  if (c.year) parts.push('(' + c.year + ')');
  if (c.title || item.title) parts.push((c.title || item.title) + '.');
  if (c.venue) parts.push(c.venue + '.');
  if (c.doi) parts.push('doi:' + c.doi + '.');
  if (c.url || item.url) parts.push(c.url || item.url);
  return parts.join(' ');
}

function parseCitationFromHtml(html, fallbackTitle, fallbackUrl) {
  try {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    function qMeta(name) {
      var el = doc.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
      return el ? (el.getAttribute('content') || '').trim() : '';
    }
    function qMetaAll(name) {
      var out = [];
      var els = doc.querySelectorAll('meta[name="' + name + '"]');
      for (var i = 0; i < els.length; i++) {
        var v = (els[i].getAttribute('content') || '').trim();
        if (v) out.push(v);
      }
      return out;
    }
    var title = qMeta('citation_title') || qMeta('dc.Title') || qMeta('dc.title') || qMeta('og:title') || fallbackTitle || '';
    var authors = qMetaAll('citation_author');
    if (!authors.length) {
      var links = doc.querySelectorAll('.authors a, div.authors a');
      for (var j = 0; j < links.length; j++) {
        var t = (links[j].textContent || '').trim();
        if (t) authors.push(t);
      }
    }
    if (!authors.length) {
      var txt = (doc.body && doc.body.textContent) ? doc.body.textContent.replace(/\u00A0/g, ' ') : '';
      var m = txt.match(/Authors?\s*:\s*([^\n]+)/i);
      if (m && m[1]) {
        authors = m[1].split(/,| and /i).map(function (x) { return x.trim(); }).filter(Boolean);
      }
    }
    var year = parseYear(qMeta('citation_publication_date') || qMeta('citation_date') || qMeta('dc.date') || '');
    var venue = qMeta('citation_journal_title') || qMeta('citation_conference_title') || qMeta('og:site_name') || '';
    var doi = qMeta('citation_doi') || '';
    return {
      title: title,
      authors: authors,
      year: year,
      venue: venue,
      doi: doi,
      url: fallbackUrl || ''
    };
  } catch (e) {
    return null;
  }
}

function shouldReplaceCitation(oldItem, newCitation) {
  var oldAuthors = oldItem && oldItem.citation && Array.isArray(oldItem.citation.authors) ? oldItem.citation.authors.length : 0;
  var newAuthors = newCitation && Array.isArray(newCitation.authors) ? newCitation.authors.length : 0;
  if (newAuthors > oldAuthors) return true;
  if (!oldItem.citationText && newAuthors > 0) return true;
  return false;
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

document.getElementById('refetch-authors').addEventListener('click', function () {
  chrome.storage.local.get(STORAGE_KEY, function (data) {
    var list = data[STORAGE_KEY] || [];
    if (!list.length) {
      setStatus('No saved papers.');
      return;
    }
    setStatus('Re-fetching authors: 0/' + list.length + ' ...');

    var idx = 0;
    var updated = 0;
    var scanned = 0;

    function step() {
      if (idx >= list.length) {
        chrome.storage.local.set({ reading_papers_auto: list }, function () {
          setStatus('Done. Updated ' + updated + ' / ' + scanned + ' papers.');
        });
        return;
      }
      var p = list[idx++];
      scanned++;
      var canon = canonicalPaperUrl(p.url || '') || normalizeUrl(p.url || '');
      if (!canon || !/^https?:\/\//i.test(canon)) {
        setStatus('Re-fetching authors: ' + scanned + '/' + list.length + ' ...');
        step();
        return;
      }
      fetch(canon, { method: 'GET', credentials: 'omit' })
        .then(function (res) { return res.ok ? res.text() : ''; })
        .then(function (html) {
          if (html) {
            var c = parseCitationFromHtml(html, p.title || '', canon);
            if (c && shouldReplaceCitation(p, c)) {
              p.citation = c;
              p.citationText = citationFromPaper({ title: p.title || c.title, url: canon, citation: c });
              updated++;
            }
          }
        })
        .catch(function () {})
        .finally(function () {
          setStatus('Re-fetching authors: ' + scanned + '/' + list.length + ' ...');
          // Small delay avoids hammering providers and improves stability.
          setTimeout(step, 120);
        });
    }
    step();
  });
});
