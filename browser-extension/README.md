# Reading List — Auto-record papers (Chrome)

This extension **automatically saves** the current page when you visit a paper on:

- arXiv (arxiv.org)
- IEEE Xplore (ieeexplore.ieee.org)
- ACM Digital Library (dl.acm.org)
- Springer (*.springer.com)
- ScienceDirect (sciencedirect.com)

When you open your [Reading List](https://jesse-men.github.io/reading_papers.html) page, the extension sends the saved papers to the page; the page merges them into your local list (no duplicates by URL).

## Install (Chrome)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the folder that contains this `manifest.json` (the `browser-extension` folder in the repo).
5. Keep the folder where it is; Chrome loads the extension from that path.

## Usage

- Just browse papers on the sites above; each visit is stored in the extension.
- Open your Reading List page; any new auto-recorded papers are merged into the list (you’ll see a short message).
- You can then add keywords/notes via “Add paper” or edit the list and use “Export YAML” if needed.

## Data

- Data is stored only in your browser (Chrome’s extension storage).
- Nothing is sent to any server except when you open your Reading List page; then the list is sent only to that page (same origin) to merge into the list you see there.
