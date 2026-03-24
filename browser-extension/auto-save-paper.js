(function () {
  var STORAGE_KEY = 'reading_papers_auto';

  function normalizeUrl(u) {
    if (!u) return '';
    return u.replace(/#.*$/, '').replace(/\/+$/, '') || u;
  }

  function isPaperDocumentUrl(url) {
    if (!url || url.length < 15) return false;
    if (/ieeexplore\.ieee\.org\/document\/\d+(\?|$)/i.test(url)) return true;
    if (/ieeexplore\.ieee\.org\/stamp\/stamp\.jsp\?.*arnumber=\d+/i.test(url)) return true;
    if (/arxiv\.org\/(abs|pdf)\/\d{4}\.\d{4,5}(v\d+)?(\?|$)/i.test(url)) return true;
    if (/dl\.acm\.org\/doi\/10\.[^?#]+/i.test(url)) return true;
    if (/link\.springer\.com\/(article|chapter)\/[^/?]+/i.test(url)) return true;
    if (/sciencedirect\.com\/science\/article\/(pii\/)?[^/?]+/i.test(url)) return true;
    return false;
  }

  function isJunkTitle(title) {
    if (!title || title.length < 3) return true;
    var t = title.trim();
    if (/^IEEE\s*Xplore\s*$/i.test(t)) return true;
    if (/^IEEE\s*Xplore\s*Login$/i.test(t)) return true;
    if (/^IEEE\s*Xplore\s*Full-Text\s*PDF/i.test(t)) return true;
    if (/^Sign\s*in$/i.test(t)) return true;
    if (/^Login$/i.test(t)) return true;
    if (/^arXiv\s*$/i.test(t)) return true;
    if (/^\d{4}\.\d{4,5}(v\d+)?\.pdf$/i.test(t)) return true;
    if (/^[^ ]+\.pdf$/i.test(t)) return true;
    if (t.length < 10 && /^(ACM|Springer|ScienceDirect)\s*$/i.test(t)) return true;
    return false;
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

  function titleFromUrl(url) {
    var m = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/);
    if (m) return 'arXiv ' + m[1];
    m = url.match(/ieeexplore\.ieee\.org\/document\/(\d+)/);
    if (m) return 'IEEE ' + m[1];
    m = url.match(/ieeexplore\.ieee\.org\/stamp\/stamp\.jsp\?.*arnumber=(\d+)/);
    if (m) return 'IEEE ' + m[1];
    m = url.match(/dl\.acm\.org\/doi\/(10\.[^?#]+)/);
    if (m) return 'ACM ' + (m[1].length > 40 ? m[1].slice(0, 37) + '...' : m[1]);
    m = url.match(/sciencedirect\.com\/science\/article\/pii\/([^/?]+)/);
    if (m) return 'ScienceDirect ' + m[1];
    return '(No title)';
  }

  function stripSiteSuffix(s) {
    if (!s || s.length < 3) return s;
    return s
      .replace(/\s*[\-|–—]\s*IEEE\s*Xplore.*$/i, '')
      .replace(/\s*[\-|–—]\s*ACM\s*Digital\s*Library.*$/i, '')
      .replace(/\s*[\-|–—]\s*Springer.*$/i, '')
      .replace(/\s*[\-|–—]\s*ScienceDirect.*$/i, '')
      .replace(/\s*[\-|–—]\s*arXiv.*$/i, '')
      .replace(/\s*[\|]\s*.*$/i, '')
      .trim();
  }

  function getTitleFromPage() {
    function cleanTitle(s) {
      var t = stripSiteSuffix((s || '').trim());
      return isJunkTitle(t) ? '' : t;
    }

    var cit = document.querySelector('meta[name="citation_title"]');
    if (cit && cit.getAttribute('content')) {
      var t = cleanTitle(cit.getAttribute('content') || '');
      if (t.length >= 2) return t;
    }
    var og = document.querySelector('meta[property="og:title"]');
    if (og && og.getAttribute('content')) {
      t = cleanTitle(og.getAttribute('content') || '');
      if (t.length >= 2) return t;
    }
    var dc = document.querySelector('meta[name="dc.Title"], meta[name="DC.Title"], meta[name="dc.title"], meta[name="twitter:title"]');
    if (dc && dc.getAttribute('content')) {
      t = cleanTitle(dc.getAttribute('content') || '');
      if (t.length >= 2) return t;
    }
    var host = location.hostname || '';
    if (/ieeexplore\.ieee\.org/i.test(host)) {
      var sel = document.querySelector('meta[name="citation_title"]');
      if (sel && sel.getAttribute('content')) {
        var t = (sel.getAttribute('content') || '').trim();
        if (t.length >= 2) return t;
      }
      var h1 = document.querySelector('h1.text-2xl, h1.document-title, .document-title, [class*="document-title"], h1');
      if (h1 && h1.textContent) {
        var t = cleanTitle(h1.textContent || '');
        if (t.length >= 2 && t.length < 500) return t;
      }
    }
    if (/arxiv\.org/i.test(host)) {
      var cit = document.querySelector('meta[name="citation_title"]');
      if (cit && cit.getAttribute('content')) {
        var t = (cit.getAttribute('content') || '').trim();
        if (t.length >= 2) return t;
      }
      cit = document.querySelector('h1.title, .title');
      if (cit && cit.textContent) {
        var t = cleanTitle((cit.textContent || '').replace(/^\s*Title:\s*/i, ''));
        if (t.length >= 2) return t;
      }
      var h1 = document.querySelector('h1');
      if (h1 && h1.textContent) {
        t = cleanTitle(h1.textContent || '');
        if (t.length >= 2 && t.length < 500) return t;
      }
    }
    if (/dl\.acm\.org/i.test(host)) {
      var acmCit = document.querySelector('meta[name="citation_title"]');
      if (acmCit && acmCit.getAttribute('content')) {
        var acmT = (acmCit.getAttribute('content') || '').trim();
        if (acmT.length >= 2) return acmT;
      }
      var h1 = document.querySelector('h1[class*="citation__title"], .citation__title, h1');
      if (h1 && h1.textContent) {
        var t = cleanTitle(h1.textContent || '');
        if (t.length >= 2 && t.length < 500) return t;
      }
    }
    if (/sciencedirect\.com/i.test(host)) {
      var sdCit = document.querySelector('meta[name="citation_title"], meta[name="dc.title"], meta[property="og:title"]');
      if (sdCit && sdCit.getAttribute('content')) {
        var sdT = cleanTitle(sdCit.getAttribute('content') || '');
        if (sdT.length >= 2) return sdT;
      }
      var sdH1 = document.querySelector('span.title-text, h1');
      if (sdH1 && sdH1.textContent) {
        var sdH1T = cleanTitle(sdH1.textContent || '');
        if (sdH1T.length >= 2 && sdH1T.length < 500) return sdH1T;
      }
    }
    var docTitle = cleanTitle(document.title || '');
    if (docTitle.length >= 2) return docTitle;
    var anyH1 = document.querySelector('h1');
    if (anyH1 && anyH1.textContent) {
      var t = cleanTitle(anyH1.textContent || '');
      if (t.length >= 2 && t.length < 500) return t;
    }
    return '';
  }

  function textFromMeta(names) {
    for (var i = 0; i < names.length; i++) {
      var m = document.querySelector('meta[name="' + names[i] + '"], meta[property="' + names[i] + '"]');
      if (m && m.getAttribute('content')) {
        var t = (m.getAttribute('content') || '').trim();
        if (t) return t;
      }
    }
    return '';
  }

  function getCitationMeta() {
    var authors = [];
    var authorNodes = document.querySelectorAll('meta[name="citation_author"], meta[name="dc.creator"], meta[name="DC.Creator"], meta[name="author"]');
    for (var i = 0; i < authorNodes.length; i++) {
      var a = (authorNodes[i].getAttribute('content') || '').trim();
      if (a && authors.indexOf(a) === -1) authors.push(a);
    }
    var authorStr = authors.join('; ');
    if (!authorStr) {
      var host = location.hostname || '';
      if (/arxiv\.org/i.test(host)) {
        var arxAuthors = [].slice.call(document.querySelectorAll('.authors a, .authors'));
        var arx = [];
        arxAuthors.forEach(function (n) {
          var t = (n.textContent || '').replace(/^\s*Authors?:\s*/i, '').trim();
          if (t && arx.indexOf(t) === -1) arx.push(t);
        });
        if (arx.length) authorStr = arx.join('; ');
      } else if (/ieeexplore\.ieee\.org/i.test(host)) {
        var ieeeAuthors = [].slice.call(document.querySelectorAll('[class*="author"] a, a[href*="/author/"]'));
        var ieee = [];
        ieeeAuthors.forEach(function (n) {
          var t = (n.textContent || '').trim();
          if (t && t.length < 120 && ieee.indexOf(t) === -1) ieee.push(t);
        });
        if (ieee.length) authorStr = ieee.join('; ');
      }
    }

    var venue = textFromMeta([
      'citation_journal_title',
      'citation_conference_title',
      'citation_inbook_title',
      'dc.source',
      'DC.Source',
      'og:site_name'
    ]);

    var year = '';
    var dateRaw = textFromMeta([
      'citation_publication_date',
      'citation_date',
      'dc.date',
      'DC.Date',
      'article:published_time'
    ]);
    if (dateRaw) {
      var ym = dateRaw.match(/\b(19|20)\d{2}\b/);
      if (ym) year = ym[0];
    }
    if (!year) {
      var txt = document.body ? (document.body.innerText || '') : '';
      var m = txt.match(/\b(19|20)\d{2}\b/);
      if (m) year = m[0];
    }

    return { authors: authorStr, venue: venue, year: year };
  }

  function trySave() {
    var url = location.href;
    if (!url || url.length < 10) return;

    var cleanUrl = url.replace(/#.*$/, '').replace(/\/+$/, '');
    if (!isPaperDocumentUrl(cleanUrl)) return;

    var canon = canonicalPaperUrl(cleanUrl);
    if (!canon) return;

    var titleFromPage = getTitleFromPage();
    if (isJunkTitle(titleFromPage)) titleFromPage = '';
    var title = (titleFromPage && titleFromPage.length >= 2) ? titleFromPage : titleFromUrl(cleanUrl);
    var citation = getCitationMeta();

    chrome.storage.local.get(STORAGE_KEY, function (data) {
      var list = data[STORAGE_KEY] || [];
      var existing = null;
      for (var i = 0; i < list.length; i++) {
        var pCanon = canonicalPaperUrl(list[i].url);
        if (pCanon === canon) { existing = list[i]; break; }
      }
      if (existing) {
        if (titleFromPage && titleFromPage.length >= 2 && (existing.title === '(No title)' || existing.title.indexOf('arXiv ') === 0 || existing.title.indexOf('IEEE ') === 0 || existing.title.indexOf('ACM ') === 0)) {
          existing.title = titleFromPage;
          existing.url = canon;
        }
        if (!existing.authors && citation.authors) existing.authors = citation.authors;
        if (!existing.venue && citation.venue) existing.venue = citation.venue;
        if (!existing.year && citation.year) existing.year = citation.year;
        if ((titleFromPage && titleFromPage.length >= 2) || (!existing.authors && citation.authors) || (!existing.venue && citation.venue) || (!existing.year && citation.year)) {
          chrome.storage.local.set({ reading_papers_auto: list });
        }
        return;
      }

      // If full page title is not available yet, still save with a safe URL-derived fallback
      // (e.g. arXiv/IEEE/ACM identifier) to avoid missing newly visited papers.
      if (!titleFromPage || titleFromPage.length < 2) {
        if (!title || title === '(No title)' || isJunkTitle(title)) return;
      }

      var today = new Date().toISOString().slice(0, 10);
      list.unshift({
        title: title,
        url: canon,
        date: today,
        keywords: [],
        notes: '',
        authors: citation.authors || '',
        venue: citation.venue || '',
        year: citation.year || ''
      });
      chrome.storage.local.set({ reading_papers_auto: list });
    });
  }

  trySave();
  setTimeout(trySave, 800);
  setTimeout(trySave, 2000);
  setTimeout(trySave, 5000);
  if (document.readyState !== 'complete') {
    window.addEventListener('load', function () {
      setTimeout(trySave, 500);
      setTimeout(trySave, 1500);
      setTimeout(trySave, 3500);
    });
  }
})();
