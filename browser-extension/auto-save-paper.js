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

  function getMeta(name) {
    var el = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
    if (!el) return '';
    return (el.getAttribute('content') || '').trim();
  }

  function getMetaAll(name) {
    var out = [];
    var els = document.querySelectorAll('meta[name="' + name + '"]');
    if (!els || !els.length) return out;
    for (var i = 0; i < els.length; i++) {
      var v = (els[i].getAttribute('content') || '').trim();
      if (v) out.push(v);
    }
    return out;
  }

  function getArxivAuthorsFromDom() {
    var out = [];
    var links = document.querySelectorAll('.authors a, div.authors a');
    if (!links || !links.length) return out;
    for (var i = 0; i < links.length; i++) {
      var t = (links[i].textContent || '').trim();
      if (t) out.push(t);
    }
    return out;
  }

  function parseYear(s) {
    var m = (s || '').match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  function buildCitationData(finalTitle, canonUrl) {
    var authors = getMetaAll('citation_author');
    if (authors.length === 0) authors = getMetaAll('dc.creator');
    if (authors.length === 0) authors = getMetaAll('DC.Creator');
    if (authors.length === 0) authors = getMetaAll('author');
    if (authors.length === 0 && /arxiv\.org/i.test(location.hostname || '')) {
      authors = getArxivAuthorsFromDom();
    }
    if (authors.length === 0) {
      var dcCreator = getMeta('dc.creator') || getMeta('DC.Creator');
      if (dcCreator) authors = dcCreator.split(/;|, and | and /i).map(function (x) { return x.trim(); }).filter(Boolean);
    }
    var year = parseYear(getMeta('citation_publication_date') || getMeta('citation_date') || getMeta('dc.date') || getMeta('DC.Date') || '');
    if (!year) {
      var m = (canonUrl || '').match(/arxiv\.org\/abs\/(\d{2})(\d{2})\./i);
      if (m) year = '20' + m[1];
    }
    var venue = getMeta('citation_journal_title') || getMeta('citation_conference_title') || getMeta('citation_inbook_title') || getMeta('og:site_name');
    var doi = getMeta('citation_doi');
    if (!doi) {
      var doiM = (canonUrl || '').match(/dl\.acm\.org\/doi\/(10\.[^/?#]+)/i);
      if (doiM) doi = doiM[1];
    }
    var citation = {
      title: finalTitle || '',
      authors: authors,
      year: year || '',
      venue: venue || '',
      doi: doi || '',
      url: canonUrl || ''
    };
    var authorText = authors.length ? (authors.length <= 3 ? authors.join(', ') : (authors[0] + ' et al.')) : '';
    var parts = [];
    if (authorText) parts.push(authorText);
    if (citation.year) parts.push('(' + citation.year + ')');
    if (citation.title) parts.push(citation.title + '.');
    if (citation.venue) parts.push(citation.venue + '.');
    if (citation.doi) parts.push('doi:' + citation.doi + '.');
    if (citation.url) parts.push(citation.url);
    citation.text = parts.join(' ');
    return citation;
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
    var citation = buildCitationData(title, canon);

    chrome.storage.local.get(STORAGE_KEY, function (data) {
      var list = data[STORAGE_KEY] || [];
      var existing = null;
      for (var i = 0; i < list.length; i++) {
        var pCanon = canonicalPaperUrl(list[i].url);
        if (pCanon === canon) { existing = list[i]; break; }
      }
      if (existing) {
        if (titleFromPage && titleFromPage.length >= 2 && (
          existing.title === '(No title)' ||
          existing.title.indexOf('arXiv ') === 0 ||
          existing.title.indexOf('IEEE ') === 0 ||
          existing.title.indexOf('ACM ') === 0 ||
          /^\[\d{4}\.\d{4,5}\]/.test((existing.title || '').trim())
        )) {
          existing.title = titleFromPage;
          existing.url = canon;
          if (citation && citation.text) {
            existing.citation = citation;
            existing.citationText = citation.text;
          }
          chrome.storage.local.set({ reading_papers_auto: list });
          return;
        }
        if ((!existing.citationText || existing.citationText.length < 10) && citation && citation.text) {
          existing.citation = citation;
          existing.citationText = citation.text;
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
        citation: citation,
        citationText: citation && citation.text ? citation.text : ''
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
