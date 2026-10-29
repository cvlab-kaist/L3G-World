# L3G-World Project Page — GitHub Pages

This directory contains the prepared static project page. `index.html` is the
entry point; no build step, Python backend, or external media host is required.
Videos, figures, chart data, 3D scenes, and viewer libraries are included locally.

## Publish

1. Put **this directory's contents** at the root of the repository's `gh-pages`
   branch. Keep `index.html`, `.nojekyll`, `assets/`, and `embeds/` together.
2. In the GitHub repository, open **Settings → Pages**.
3. Select **Deploy from a branch**, then **gh-pages** and **/(root)**, and save.
4. The project site will be available at
   `https://<owner>.github.io/<repository>/` after deployment completes.

Do not publish the parent `github/` directory or nest this directory inside the
selected publishing root. All application asset paths are relative, so the page
works under a repository URL as well as a domain root. No custom domain is set.

GitHub's instructions:
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Preview

From this directory:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Keep this local preview separate from the editable
project-page preview. The interactive Gaussian viewer requires WebGL2.

## Editing

- `index.html`: writing, author/resource links, navigation, section headings,
  TL;DR, and citation. The page citation is intentionally empty.
- `style.css`: typography, colors, and layout.
- `app.js`: qualitative galleries, tables, and synchronized playback.
- `assets/data/`: the current metrics and media manifests.
- `embeds/online/`: synchronized online-reconstruction input/RGB/VAE previews.
- `embeds/reconstruction/`: interactive Gaussian scenes and bundled libraries.

The original local page remains the editable source. This is a publication
snapshot, not a live synchronization of future edits. Internal filesystem paths
were removed from copied metadata; numerical measurements and media were kept.
Two unlinked legacy review directories are omitted; all sections of the current
project page are included.

Paper, arXiv, Models, and any unfinished author links remain inert placeholders.
Real author links and the Code button remain as in the source page.

This preparation does not commit, push, or enable GitHub Pages.
