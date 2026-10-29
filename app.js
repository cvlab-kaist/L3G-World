'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const play = video => { if (video.paused) video.play().catch(() => {}); };
const fmt = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function videoTransport(video, options = {}) {
  const bar = node('div', undefined, 'video-transport');
  const button = node('button', '▶', 'transport-play'); button.type = 'button';
  const seek = node('input', undefined, 'transport-seek'); seek.type = 'range'; seek.min = 0; seek.max = 1; seek.step = .001; seek.value = 0;
  seek.setAttribute('aria-label', 'Video position');
  const time = node('output', '0:00 / 0:00', 'transport-time');
  let scrubbing = false, resume = false;
  function update() {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!scrubbing) seek.value = duration ? video.currentTime / duration : 0;
    time.textContent = `${fmt(video.currentTime / video.playbackRate)} / ${fmt(duration / video.playbackRate)}`;
    button.textContent = video.paused ? '▶' : 'Ⅱ';
    button.setAttribute('aria-label', video.paused ? 'Play synchronized videos' : 'Pause synchronized videos');
  }
  button.addEventListener('click', () => {
    if (options.toggle) options.toggle(); else if (video.paused) play(video); else video.pause();
    update();
  });
  seek.addEventListener('input', () => {
    if (!scrubbing) { resume = !video.paused; scrubbing = true; options.startSeek?.(); video.pause(); }
    if (Number.isFinite(video.duration)) video.currentTime = Math.min(Number(seek.value) * video.duration, Math.max(0, video.duration - .001));
    options.synchronize?.(true); update();
  });
  seek.addEventListener('change', () => {
    scrubbing = false;
    if (options.endSeek) options.endSeek(resume); else if (resume) play(video);
    options.synchronize?.(true); update();
  });
  ['loadedmetadata', 'timeupdate', 'seeking', 'seeked', 'play', 'pause', 'ratechange', 'emptied'].forEach(event => video.addEventListener(event, update));
  bar.append(button, seek, time); update();
  return {element:bar, update, button, seek, time};
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

// Sample one shared gradient field so the color continues across button gaps.
function alignResourceGradient() {
  const group = $('.resources');
  const bounds = group.getBoundingClientRect();
  group.style.setProperty('--resource-gradient-width', `${bounds.width}px`);
  group.style.setProperty('--resource-gradient-height', `${bounds.height}px`);
  $$('.resource', group).forEach(button => {
    const box = button.getBoundingClientRect();
    button.style.setProperty('--resource-gradient-x', `${bounds.left - box.left}px`);
    button.style.setProperty('--resource-gradient-y', `${bounds.top - box.top}px`);
  });
}
const resourceObserver = new ResizeObserver(alignResourceGradient);
resourceObserver.observe($('.resources'));
$$('.resource').forEach(button => resourceObserver.observe(button));
document.fonts.ready.then(alignResourceGradient);

$('#bibtex-modal-code').textContent = $('#bibtex-code').textContent;
$$('.copy-bibtex').forEach(button => button.addEventListener('click', async () => {
  const code = document.getElementById(button.dataset.copyTarget);
  const citation = code.textContent;
  if (!citation.trim()) return;
  try {
    await navigator.clipboard.writeText(citation);
    toast('BibTeX copied.');
  } catch {
    const selection = window.getSelection();
    const range = document.createRange(); range.selectNodeContents(code);
    selection.removeAllRanges(); selection.addRange(range);
    toast('BibTeX selected. Press Ctrl+C or ⌘C to copy.');
  }
}));

async function main() {
  const response = await fetch('assets/data/site.json');
  if (!response.ok) throw new Error('Scene data could not be loaded.');
  const data = await response.json();
  const growthResponse = await fetch('assets/data/memory_growth_timing.json');
  if (!growthResponse.ok) throw new Error('Memory graph measurements could not be loaded.');
  const growthTimelines = new Map((await growthResponse.json()).map(row => [row.scene, row]));
  function interpolate(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    }
    return ys.at(-1);
  }
  // Charts have no independent decoder/clock: every seek draws the requested
  // generated-video frame immediately, using the exact nonuniform source map.
  function drawGrowth(charts, sceneId, video) {
    const row = growthTimelines.get(sceneId);
    if (!row || !charts.length) return;
    const index = Math.max(0, Math.min(row.source_frame_indices.length - 1, Math.floor(video.currentTime * row.fps + 1e-6)));
    const frame = row.source_frame_indices[index];
    charts.forEach(canvas => {
      const field = canvas.dataset.metric;
      const signature = `${sceneId}:${field}:${index}`;
      if (canvas.dataset.signature === signature) return;
      canvas.dataset.signature = signature;
      canvas.dataset.outputFrame = index;
      canvas.dataset.sourceFrame = frame;
      canvas.dataset.durationSeconds = frame / 16;
      const values = row[field], xs = row.measurement_frames;
      const ref = row.reference, refXs = ref.measurement_frames, refValues = ref[field];
      const value = interpolate(xs, values, frame), referenceValue = interpolate(refXs, refValues, frame);
      canvas.dataset.value = value;
      canvas.dataset.referenceValue = referenceValue;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      const width = 832, height = 360, left = 90, right = 798, top = 92, bottom = 282;
      const color = field === 'primitives_k' ? '#197ec0' : '#15977e';
      const unit = field === 'primitives_k' ? 'K Gaussians' : 'MiB';
      const peak = Math.max(...values, ...refValues) * 1.1;
      const magnitude = 10 ** Math.floor(Math.log10(peak / 4));
      const tick = Math.ceil(peak / 4 / magnitude) * magnitude, maximum = tick * 4;
      const px = x => left + x / 960 * (right - left), py = y => bottom - y / maximum * (bottom - top);
      ctx.fillStyle = '#f8fbfa'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = color; ctx.font = '500 28px Inter, Arial, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`${value.toFixed(1)} ${unit}`, left, 35);
      ctx.fillStyle = '#62746c'; ctx.font = '19px Inter, Arial, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`${(frame / 16).toFixed(1)} s`, right, 35);
      ctx.lineWidth = 1; ctx.font = '18px Inter, Arial, sans-serif';
      for (let i = 0; i <= 4; i++) {
        const y = i * tick; ctx.strokeStyle = '#dce7e1'; ctx.beginPath(); ctx.moveTo(left, py(y)); ctx.lineTo(right, py(y)); ctx.stroke();
        ctx.fillStyle = '#51665f'; ctx.textAlign = 'right'; ctx.fillText(Number(y.toPrecision(5)).toString(), left - 12, py(y) + 5);
      }
      for (const x of [0, 240, 480, 720, 960]) { ctx.textAlign = 'center'; ctx.fillText(x / 16, px(x), bottom + 28); }
      ctx.font = '20px Inter, Arial, sans-serif'; ctx.fillText('Generation video duration (s)', (left + right) / 2, 344);
      function line(xValues, yValues, stroke, dotted) {
        const end = dotted ? xValues.at(-1) : frame;
        const points = xValues.filter(x => x < end); points.push(end);
        ctx.beginPath(); ctx.strokeStyle = stroke; ctx.lineWidth = dotted ? 3 : 4;
        ctx.setLineDash(dotted ? [2, 7] : []); ctx.lineCap = 'round';
        points.forEach((x, i) => { const y = interpolate(xValues, yValues, x); if (i) ctx.lineTo(px(x), py(y)); else ctx.moveTo(px(x), py(y)); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      line(refXs, refValues, '#999fa4', true); line(xs, values, color, false);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px(frame), py(value), 3.5, 0, 2 * Math.PI); ctx.fill();
      for (const [x, label, stroke, dotted] of [[left, 'L3G-World', color, false], [left + 185, ref.label, '#999fa4', true]]) {
        ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.setLineDash(dotted ? [2, 7] : []);
        ctx.beginPath(); ctx.moveTo(x, 63); ctx.lineTo(x + 31, 63); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#51665f'; ctx.font = '17px Inter, Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, x + 41, 68);
      }
    });
  }
  $$('[data-improvement]').forEach(label => {
    const value = data.efficiency_improvements[label.dataset.improvement];
    label.textContent = `${value.factor.toFixed(2)}×`;
    label.parentElement.title = `Ratio of the unrounded, equal-weight DL3DV and RealEstate10K means; compared with ${value.baseline}, the best prior mean for this metric. The abstract reports the largest per-dataset ratio.`;
  });
  // Section names belong to the HTML; reuse them in scene dialogs and labels.
  const names = Object.fromEntries($$('#all-galleries > section[data-category]').map(section => [
    section.dataset.category, $('.scenario-heading', section).textContent.trim()
  ]));
  names.long = $('#consistency .section-heading').textContent.trim();

  let videosEnabled = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visible = new Set();
  const pairs = new WeakMap();
  const dialog = $('#scene-dialog');
  let galleryAnimation;
  const galleryActive = () => videosEnabled && !$('dialog[open]') && !document.hidden;
  function updateSpeedCaption(video, caption, item) {
    if (!caption) return;
    const segment = item?.preview_speed_segments?.find(s => video.currentTime >= s.start && video.currentTime < s.end);
    caption.textContent = segment ? `${segment.multiplier}× speed` : '4× speed';
    caption.dataset.active = String(Boolean(segment));
  }
  const pairVideos = pair => [pair.generated, pair.memory];
  function pausePair(pair) { pairVideos(pair).forEach(video => video.pause()); }
  function syncPair(pair, force = false) {
    const master = pair.generated;
    pair.transport?.update();
    updateSpeedCaption(master, pair.speedCaption, pair.item);
    drawGrowth(pair.growth, pair.sceneId, master);
    if (!Number.isFinite(master.duration) || !master.duration) return;
    for (const follower of pairVideos(pair).slice(1)) {
      if (!Number.isFinite(follower.duration)) continue;
      const target = Math.min(master.currentTime / master.duration * follower.duration, Math.max(0, follower.duration - .01));
      const rate = Math.min(16, Math.max(.0625, master.playbackRate * follower.duration / master.duration));
      if (follower.playbackRate !== rate) follower.playbackRate = rate;
      if (force || Math.abs(follower.currentTime - target) > .06) follower.currentTime = target;
      if (galleryActive() && visible.has(pair) && !master.paused && !master.seeking && master.readyState >= 3) play(follower);
      else follower.pause();
    }
  }
  function galleryTick() {
    visible.forEach(pair => syncPair(pair));
    galleryAnimation = requestAnimationFrame(galleryTick);
  }
  function updateGalleryPlayback() {
    $$('[data-gallery-play]').forEach(button => {
      button.textContent = videosEnabled ? 'Ⅱ Pause videos' : '▶ Play videos';
      button.setAttribute('aria-pressed', String(videosEnabled));
    });
    cancelAnimationFrame(galleryAnimation);
    visible.forEach(pair => {
      if (galleryActive() && !pair.pausedByUser && !pair.scrubbing) { play(pair.generated); syncPair(pair); }
      else pausePair(pair);
    });
    if (galleryActive() && visible.size) galleryAnimation = requestAnimationFrame(galleryTick);
  }
  const observer = new IntersectionObserver(entries => {
    for (const {target: stage, isIntersecting} of entries) {
      const pair = pairs.get(stage);
      if (!pair) continue;
      if (isIntersecting) {
        visible.add(pair);
        for (const video of pairVideos(pair)) {
          if (!video.getAttribute('src')) {
            video.preload = 'auto';
            video.src = video.dataset.src;
          }
        }
      } else { visible.delete(pair); pausePair(pair); }
    }
    updateGalleryPlayback();
  }, {threshold: .15});
  $$('[data-gallery-play]').forEach(button => button.addEventListener('click', () => { videosEnabled = !videosEnabled; updateGalleryPlayback(); }));

  function inputFigure(path, label) {
    const figure = node('figure', undefined, 'input-figure');
    const image = node('img'); image.src = path; image.alt = label; image.loading = 'lazy';
    figure.append(image, node('figcaption', label));
    return figure;
  }
  function setSelected(strip, selected) {
    $$('.scene-thumb', strip).forEach((button, index) => {
      button.classList.toggle('selected', index === selected);
      button.setAttribute('aria-pressed', String(index === selected));
      button.tabIndex = index === selected ? 0 : -1;
    });
  }
  function thumbnailStrip(items, label, onSelect, imageFor = item => item.inputs[0]) {
    const strip = node('div', undefined, 'scene-thumbnails');
    strip.setAttribute('role', 'toolbar'); strip.setAttribute('aria-label', label);
    items.forEach((item, index) => {
      const button = node('button', undefined, 'scene-thumb');
      button.dataset.sceneId = item.scene_id;
      button.setAttribute('aria-label', `${label}: ${item.title || `Image ${index + 1}`}`);
      const image = node('img'); image.src = imageFor(item); image.alt = ''; image.loading = 'lazy';
      button.append(image); strip.append(button);
      button.addEventListener('click', () => { setSelected(strip, index); onSelect(item, index); });
    });
    strip.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = $$('.scene-thumb', strip); const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus({preventScroll:true}); buttons[next].click();
      buttons[next].scrollIntoView({block:'nearest', inline:'nearest'});
    });
    setSelected(strip, 0);
    return strip;
  }
  function showScene(stage, scene, variantIndex = 0) {
    const previous = pairs.get(stage);
    observer.unobserve(stage);
    if (previous) {
      visible.delete(previous); pausePair(previous);
      pairVideos(previous).forEach(video => { video.removeAttribute('src'); video.load(); });
    }
    const item = scene.variants[variantIndex]; stage.replaceChildren();
    stage.dataset.sceneId = scene.scene_id; stage.dataset.variantId = item.id;
    const left = node('div', undefined, 'stage-left');
    const inputPane = node('div', undefined, 'stage-input-pane');
    const inputHeader = node('div', undefined, 'stage-label');
    const inputs = node('div', undefined, 'stage-inputs' + (scene.category === 'multi' ? ' multiview-grid' : ''));
    if (scene.category === 'stitch') {
      const toggle = node('div', undefined, 'input-toggle'); toggle.setAttribute('role', 'group'); toggle.setAttribute('aria-label', 'Displayed anchor input');
      const image = node('img'); image.src = item.inputs[0]; image.alt = 'Image 1'; inputs.append(image);
      item.inputs.forEach((path, index) => {
        const button = node('button', `Image ${index + 1}`); button.setAttribute('aria-pressed', String(index === 0));
        button.addEventListener('click', () => {
          image.src = path; image.alt = `Image ${index + 1}`;
          $$('button', toggle).forEach(other => other.setAttribute('aria-pressed', String(other === button)));
        }); toggle.append(button);
      }); inputHeader.append(toggle);
    } else {
      inputHeader.append(node('span', item.inputs.length > 1 ? 'Input Images' : 'Input Image'));
      item.inputs.forEach((path, index) => { const image = node('img'); image.src = path; image.alt = `Input image ${index + 1}`; inputs.append(image); });
    }
    inputPane.append(inputHeader, inputs);
    const memoryPane = node('div', undefined, 'stage-memory-pane');
    const memoryView = node('div', undefined, 'memory-viewport');
    const memory = node('video', undefined, item.memory_montage ? 'scene-memory montage' : 'scene-memory');
    memory.dataset.src = item.memory; memory.poster = item.memory_poster || ''; memory.setAttribute('aria-hidden', 'true');
    memoryView.append(memory); memoryPane.append(node('span', '3D Memory Update', 'stage-label'), memoryView);
    if (item.memory_note) memoryPane.append(node('p', item.memory_note, 'memory-provenance-note'));
    left.append(inputPane, memoryPane);
    const right = node('div', undefined, 'stage-generated-pane');
    const heading = node('div', undefined, 'stage-label'); heading.append(node('span', 'Generated Video'));
    let speedCaption = null;
    if (item.preview_speed_segments?.length) {
      speedCaption = node('p', '4× speed', 'playback-speed-caption');
      speedCaption.dataset.active = 'false';
    }
    if (scene.variants.length > 1) {
      const variants = node('select', undefined, 'stage-variants'); variants.setAttribute('aria-label', 'Accepted generation version');
      scene.variants.forEach((version, index) => variants.append(new Option(`Version ${index + 1}`, index)));
      variants.value = variantIndex; variants.addEventListener('change', () => showScene(stage, scene, Number(variants.value))); heading.append(variants);
    }
    const expand = node('button', 'Expand ↗', 'stage-expand'); expand.setAttribute('aria-label', 'Expand generated video and memory');
    expand.addEventListener('click', () => openScene(scene, variantIndex)); heading.append(expand);
    const viewport = node('div', undefined, 'stage-video-viewport');
    const generated = node('video', undefined, 'scene-generated'); generated.controls = false; generated.poster = item.poster;
    generated.dataset.src = item.generated; generated.playbackRate = item.playback_rate;
    generated.setAttribute('aria-label', `Generated video: ${scene.title}`);
    for (const video of [generated, memory]) { video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.preload = 'none'; }
    viewport.append(generated); right.append(heading, viewport);
    if (speedCaption) right.append(speedCaption);
    stage.append(left, right);
    const growth = [];
    if (item.growth_primitives && item.growth_memory) {
      const panel = node('div', undefined, 'stage-growth-panel');
      for (const [key, label, metric] of [['growth_primitives','Gaussian primitives (K)','primitives_k'],['growth_memory','3D memory (MiB)','memory_mib']]) {
        const figure = node('figure', undefined, 'growth-chart');
        const canvas = node('canvas', undefined, 'scene-growth'); canvas.width = 1664; canvas.height = 720; canvas.dataset.metric = metric;
        canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', `${label}, synchronized with generated video`);
        figure.append(node('figcaption',label,'stage-label'),canvas); panel.append(figure); growth.push(canvas);
      }
      stage.append(panel);
    }
    stage.classList.toggle('has-growth', growth.length > 0);
    const pair = {generated, memory, growth, item, speedCaption, sceneId:scene.scene_id, pausedByUser:false, scrubbing:false}; pairs.set(stage, pair);
    pair.transport = videoTransport(generated, {
      toggle: () => {
        if (generated.paused) { pair.pausedByUser = false; videosEnabled = true; updateGalleryPlayback(); }
        else { pair.pausedByUser = true; pausePair(pair); }
      },
      startSeek: () => { pair.scrubbing = true; pausePair(pair); },
      endSeek: resume => { pair.scrubbing = false; if (resume && !pair.pausedByUser && galleryActive()) play(generated); },
      synchronize: force => syncPair(pair, force)
    });
    viewport.after(pair.transport.element);
    ['loadedmetadata','seeking','seeked','timeupdate','play','pause','ratechange'].forEach(event => generated.addEventListener(event, () => syncPair(pair, event !== 'timeupdate')));
    memory.addEventListener('loadedmetadata', () => syncPair(pair, true));
    drawGrowth(growth, scene.scene_id, generated);
    observer.observe(stage); updateGalleryPlayback();
  }
  function renderGalleries() {
    const longRoot = $('#long-horizon-gallery'); longRoot.replaceChildren();
    const longScenes = data.long_horizon_scenes || [];
    if (longScenes.length) {
      const stage = node('div', undefined, 'feature-stage');
      stage.setAttribute('aria-label', 'Long-Horizon Consistency selected scene');
      longRoot.append(thumbnailStrip(longScenes, 'Choose long-horizon scene', scene => showScene(stage, scene)), stage);
      showScene(stage, longScenes[0]);
    }
    const root = $('#all-galleries');
    for (const section of $$(':scope > section[data-category]', root)) {
      const category = section.dataset.category;
      const gallery = $('[data-scene-gallery]', section);
      if (!gallery) continue;
      gallery.replaceChildren();
      const scenes = data.scenes.filter(scene => scene.category === category && scene.source !== 'SpatialVID');
      const first = scenes.findIndex(scene => scene.scene_id === section.dataset.firstScene);
      if (first > 0) scenes.unshift(scenes.splice(first, 1)[0]);
      if (!scenes.length) { gallery.append(node('p', 'No scenes selected.', 'loading')); continue; }
      const stage = node('div', undefined, 'feature-stage'); stage.setAttribute('aria-label', names[category] + ' selected scene');
      if (category === 'stitch') {
        const groups = new Map(); scenes.forEach(scene => { if (!groups.has(scene.first_anchor)) groups.set(scene.first_anchor, []); groups.get(scene.first_anchor).push(scene); });
        const anchors = [...groups.values()].map(group => group[0]);
        const secondRow = node('div', undefined, 'anchor-selector-row');
        function selectFirst(item) {
          const group = groups.get(item.first_anchor);
          secondRow.replaceChildren(node('span', 'Image 2', 'selector-label'), thumbnailStrip(group, 'Choose Image 2', scene => showScene(stage, scene), scene => scene.inputs[1]));
          showScene(stage, group[0]);
        }
        const firstRow = node('div', undefined, 'anchor-selector-row');
        firstRow.append(node('span', 'Image 1', 'selector-label'), thumbnailStrip(anchors, 'Choose Image 1', selectFirst));
        gallery.append(firstRow, secondRow, stage); selectFirst(anchors[0]);
      } else {
        const strip = thumbnailStrip(scenes, 'Choose scene', scene => showScene(stage, scene));
        gallery.append(strip, stage); showScene(stage, scenes[0]);
      }
    }
    updateGalleryPlayback();
  }

  // One master clock. Memory exports may use a different FPS/container duration;
  // map them by normalized rollout progress, including seeks, pauses and loops.
  const master = $('#modal-generated');
  const slaves = [$('#modal-memory'), $('#modal-condition')];
  const modalCharts = [$('#modal-growth-primitives'), $('#modal-growth-memory')];
  let variant, modalScene;
  function synchronize(force = false) {
    updateSpeedCaption(master, $('#modal-speed-caption'), variant);
    if (modalScene) drawGrowth(modalCharts, modalScene.scene_id, master);
    if (!dialog.open || !Number.isFinite(master.duration) || !master.duration) return;
    const phase = master.currentTime / master.duration;
    slaves.forEach(video => {
      if (!video.getAttribute('src') || !Number.isFinite(video.duration)) return;
      const target = Math.min(phase * video.duration, Math.max(0, video.duration - .01));
      video.playbackRate = Math.min(16, Math.max(.0625, master.playbackRate * video.duration / master.duration));
      if (force || Math.abs(video.currentTime - target) > .06) video.currentTime = target;
      if (master.paused || master.seeking || document.hidden) video.pause(); else play(video);
    });
    modalTransport.update();
  }
  const modalTransport = videoTransport(master, {synchronize});
  modalTransport.button.id = 'modal-play'; modalTransport.seek.id = 'modal-seek'; modalTransport.time.id = 'modal-time';
  master.after(modalTransport.element);
  let modalAnimation;
  function modalTick() { synchronize(); modalAnimation = requestAnimationFrame(modalTick); }
  ['play', 'pause', 'seeking', 'seeked', 'timeupdate', 'ratechange', 'loadedmetadata'].forEach(event => master.addEventListener(event, () => synchronize(event !== 'timeupdate')));
  master.addEventListener('ended', () => { master.currentTime = 0; synchronize(true); if (!document.hidden) play(master); });
  slaves.forEach(video => video.addEventListener('loadedmetadata', () => synchronize(true)));
  function loadVariant(item) {
    variant = item;
    let speedCaption = $('#modal-speed-caption');
    if (!speedCaption) {
      speedCaption = node('p', '4× speed', 'playback-speed-caption');
      speedCaption.id = 'modal-speed-caption'; master.closest('.video-pane').append(speedCaption);
    }
    speedCaption.hidden = !item.preview_speed_segments?.length;
    speedCaption.dataset.active = 'false';
    $('#dialog-title').textContent = item.category === 'stitch' ? 'Image 1 + Image 2' : item.title;
    $('#dialog-category').textContent = names[item.category];
    $('#modal-prompt').textContent = item.prompt || 'Caption not available.';
    const inputs = $('#dialog-inputs'); inputs.replaceChildren();
    inputs.classList.toggle('stitch-inputs', item.category === 'stitch');
    item.inputs.forEach((path, index) => {
      if (item.category === 'stitch' && index) inputs.append(node('span', '+', 'stitch-plus'));
      inputs.append(inputFigure(path, `Image ${index + 1}`));
    });
    [master, ...slaves].forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    master.poster = item.poster; master.src = item.generated; master.playbackRate = item.playback_rate;
    slaves[0].poster = item.memory_poster || '';
    let memoryNote = $('#modal-memory-note');
    if (!memoryNote) { memoryNote = node('p', '', 'memory-provenance-note'); memoryNote.id = 'modal-memory-note'; slaves[0].closest('.video-pane').append(memoryNote); }
    memoryNote.textContent = item.memory_note || ''; memoryNote.hidden = !item.memory_note;
    slaves[0].classList.toggle('montage', item.memory_montage);
    for (const [video, path] of [[slaves[0], item.memory], [slaves[1], item.condition]]) {
      video.closest('.video-pane').hidden = !path;
      if (path) video.src = path;
    }
    $('#modal-growth').hidden = !item.growth_primitives;
    modalCharts.forEach(canvas => { delete canvas.dataset.signature; });
    if (item.growth_primitives) drawGrowth(modalCharts, modalScene.scene_id, master);
    if (videosEnabled) play(master);
  }
  function openScene(scene, variantIndex = 0) {
    modalScene = scene;
    visible.forEach(pausePair);
    cancelAnimationFrame(galleryAnimation);
    $('#variant-label').hidden = scene.variants.length < 2;
    const select = $('#variant-select'); select.replaceChildren();
    scene.variants.forEach((item, index) => select.append(new Option(item.experiment, index)));
    dialog.showModal(); document.body.classList.add('modal-open');
    select.value = variantIndex; loadVariant(scene.variants[variantIndex]);
    modalAnimation = requestAnimationFrame(modalTick);
  }
  $('#variant-select').addEventListener('change', event => loadVariant(modalScene.variants[Number(event.target.value)]));
  $('#close-scene').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    cancelAnimationFrame(modalAnimation);
    [master, ...slaves].forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    document.body.classList.remove('modal-open'); updateGalleryPlayback();
  });
  document.addEventListener('visibilitychange', () => {
    updateGalleryPlayback();
    if (document.hidden && dialog.open) master.pause();
  });
  for (const modal of $$('dialog')) modal.addEventListener('click', event => {
    const box = modal.getBoundingClientRect();
    if (event.target === modal && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) modal.close();
  });

  const methodCopy = {
    archi_mem: 'L3G-Mem allocates new primitives to uncovered or high-error regions, retrieves visible memory tokens, and jointly predicts new Gaussians and residual corrections. Each Gaussian also stores a renderable VAE feature.',
    archi_gen: 'L3G-Gen conditions video diffusion on camera-aligned latent memory renderings, opacity, text, and history. Generated observations return to L3G-Mem to update the persistent scene before the next chunk.'
  };
  $$('.architecture-figure-button').forEach(button => {
    const key = button.dataset.figure;
    const image = $('img', button);
    image.src = data.figures[key]; image.alt = methodCopy[key];
  });
  $$('.architecture-figure-button, .comparison-figure-button').forEach(button => {
    const image = $('img', button);
    button.addEventListener('click', () => {
      $('#large-figure').src = image.src; $('#large-figure').alt = image.alt;
      $('#figure-dialog').showModal(); document.body.classList.add('modal-open'); updateGalleryPlayback();
    });
  });
  $('#close-figure').addEventListener('click', () => $('#figure-dialog').close());
  $('#figure-dialog').addEventListener('close', () => { document.body.classList.remove('modal-open'); updateGalleryPlayback(); });
  $('#open-bibtex').addEventListener('click', () => { $('#bibtex-dialog').showModal(); document.body.classList.add('modal-open'); updateGalleryPlayback(); });
  $('#close-bibtex').addEventListener('click', () => $('#bibtex-dialog').close());
  $('#bibtex-dialog').addEventListener('close', () => { document.body.classList.remove('modal-open'); updateGalleryPlayback(); });

  const numeric = (value, digits = 3) => value === null ? '—' : value.toLocaleString('en-US', {minimumFractionDigits:digits, maximumFractionDigits:digits});
  const mainLabels = ['Primitives\n(K) ↓', '3D Memory Cost\n(MiB) ↓', 'Memory Reconstruction\n(FPS) ↑', 'Render FPS\n(RGB) ↑', 'Render FPS\n(VAE) ↑',
    'PSNR ↑', 'SSIM ↑', 'LPIPS ↓', 'LPIPS ↓', 'FID ↓', 'IQ ↑', 'AQ ↑', 'SC ↑', 'BC ↑', 'TransErr ↓', 'RotErr (°) ↓', 'MEt3R ↓'];
  const mainGroups = [['Efficiency',5], ['Self-consistency',3], ['Generation quality',6], ['Pose error',2], ['3D consistency',1]];
  const mainDigits = [0,1,2,2,2,2,3,3,3,2,3,3,3,3,3,2,3];
  const mainDirections = ['min','min','max','max','max','max','max','min','min','min','max','max','max','max','min','min','min'];
  function tableHead(table, labels, groups, first = 'Method') {
    const head = node('thead'), top = node('tr');
    const method = node('th', first); method.rowSpan = 2; method.scope = 'col'; top.append(method);
    groups.forEach(([name, count]) => { const th = node('th', name); th.colSpan = count; th.scope = 'colgroup'; top.append(th); });
    const bottom = node('tr'); labels.forEach(label => { const th = node('th', label); th.scope = 'col'; bottom.append(th); });
    head.append(top, bottom); table.append(head);
  }
  function tableRows(table, rows, digits, directions, roundUpColumns = []) {
    const body = node('tbody');
    const values = Object.values(rows);
    const ranks = directions.map((direction, index) =>
      [...new Set(values.map(row => row[index]).filter(Number.isFinite))]
        .sort((a, b) => direction === 'min' ? a - b : b - a));
    Object.entries(rows).forEach(([name, values]) => {
      const row = node('tr');
      if (name.startsWith('L3G')) row.className = name.endsWith('Fast') ? 'ours student' : 'ours';
      const method = node('th', name); method.scope = 'row'; row.append(method);
      values.forEach((value, index) => {
        const scale = 10 ** digits[index];
        const display = value !== null && roundUpColumns.includes(index)
          ? Math.ceil(Number((value * scale).toPrecision(14))) / scale : value;
        const rankClass = value === ranks[index][0] ? 'best'
          : value === ranks[index][1] ? 'second-best' : '';
        row.append(node('td', numeric(display, digits[index]), rankClass));
      });
      body.append(row);
    });
    table.append(body);
  }
  for (const dataset of ['dl3dv', 're10k']) {
    const section = node('section', undefined, 'dataset-results');
    section.id = `dataset-panel-${dataset}`;
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', `dataset-tab-${dataset}`);
    section.hidden = dataset !== 'dl3dv';
    const title = dataset === 'dl3dv' ? 'DL3DV' : 'RealEstate10K';
    section.append(node('h3', title), node('p', 'Scroll horizontally for all metrics →', 'table-scroll-hint'));
    const viewport = node('div', undefined, 'table-scroll'); viewport.tabIndex = 0; viewport.setAttribute('role', 'region'); viewport.setAttribute('aria-label', `${title} quantitative results; scroll for all metrics`);
    const table = node('table', undefined, 'full-quality-table'); table.id = `quality-${dataset}`;
    const caption = node('caption', `All 17 metrics on ${title}`, 'sr-only'); table.append(caption);
    tableHead(table, mainLabels, mainGroups); tableRows(table, data.quality[dataset], mainDigits, mainDirections, [1,2,3,4]);
    viewport.append(table); section.append(viewport); $('#quality-tables').append(section);
  }
  const datasetTabs = $$('.dataset-tabs [role="tab"]');
  function selectDataset(dataset) {
    datasetTabs.forEach(button => {
      const selected = button.dataset.dataset === dataset;
      button.setAttribute('aria-selected', String(selected));
      button.classList.toggle('active', selected);
      button.tabIndex = selected ? 0 : -1;
      $(`#dataset-panel-${button.dataset.dataset}`).hidden = !selected;
    });
  }
  datasetTabs.forEach((button, index) => {
    button.addEventListener('click', () => selectDataset(button.dataset.dataset));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? datasetTabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + datasetTabs.length) % datasetTabs.length;
      datasetTabs[next].focus(); selectDataset(datasetTabs[next].dataset.dataset);
    });
  });
  const memoryTable = $('#ablation-memory-table');
  tableHead(memoryTable, ['MSE ↓', 'Cosine ↑', 'Gaussians\n(K) ↓', 'Recon. latency\n(ms) ↓', 'Render FPS\n(VAE) ↑', 'PSNR ↑', 'SSIM ↑', 'LPIPS ↓'], [['VAE reconstruction',2],['Efficiency',3],['RGB reconstruction',3]], 'Variant');
  tableRows(memoryTable, data.ablation.memory, [3,3,0,2,2,2,3,3], ['min','max','min','min','max','max','max','min']);
  const worldTable = $('#ablation-world-table');
  tableHead(worldTable, mainLabels.slice(5), mainGroups.slice(1), 'Variant');
  tableRows(worldTable, data.ablation.world, mainDigits.slice(5), mainDirections.slice(5));
  renderGalleries();
  document.documentElement.dataset.ready = 'true';
}

main().catch(error => {
  console.error(error);
  $$('[data-scene-gallery]').forEach(gallery => gallery.replaceChildren(node('p', 'The scene gallery could not load. Please refresh the page.', 'loading')));
  toast('Some page content could not load. Please refresh.');
});
