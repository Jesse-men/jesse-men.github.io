(function () {
  var STORAGE_KEY = 'reading_papers_auto';
  var url = location.href;
  var title = document.title || '';

  if (!url || url.length < 10) return;

  chrome.storage.local.get(STORAGE_KEY, function (data) {
    var list = data[STORAGE_KEY] || [];
    var exists = list.some(function (p) { return p.url === url; });
    if (exists) return;

    var today = new Date().toISOString().slice(0, 10);
    list.unshift({ title: title, url: url, date: today, keywords: [], notes: '' });
    chrome.storage.local.set({ reading_papers_auto: list });
  });
})();
