var READING_LIST_BASE = 'https://jesse-men.github.io/reading_papers.html';
var STORAGE_KEY = 'reading_papers_auto';

function extractPaperUrl(url) {
  if (!url) return url;
  var m = url.match(/^(chrome-extension|moz-extension):\/\/[^/]+\/(https?:\/\/[^\s]+)$/);
  if (m) return m[2].replace(/#.*$/, '');
  return url;
}

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'add-to-reading-list',
    title: 'Add current page to Reading List',
    contexts: ['page', 'link']
  });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  var url = (info.linkUrl || (tab && tab.url) || '').trim();
  var title = (tab && tab.title) || '';
  if (!url) return;

  var paperUrl = extractPaperUrl(url);
  var openUrl = READING_LIST_BASE + '?add=1&url=' + encodeURIComponent(paperUrl) + '&title=' + encodeURIComponent(title);

  chrome.storage.local.get(STORAGE_KEY, function (data) {
    var list = data[STORAGE_KEY] || [];
    var exists = list.some(function (p) { return p.url === paperUrl; });
    if (!exists) {
      var today = new Date().toISOString().slice(0, 10);
      list.unshift({ title: title || '(No title)', url: paperUrl, date: today, keywords: [], notes: '' });
      chrome.storage.local.set({ reading_papers_auto: list });
    }
    chrome.tabs.create({ url: openUrl });
  });
});
