'use strict';
const $ = id => document.getElementById(id);
const S = Subtitles;
const storageKey = 'voicedesk-project-v1';
let cues = [], selected = null, mediaUrl = null, px = 60, cursor = 0, toastTimer, dirty = false;
const video = $('video');
const colors = [['#426fcb', '#ecf2ff'], ['#339480', '#e9f6f1'], ['#9a6cb2', '#f5edfa'], ['#c18240', '#fff4e6']];
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function color(speaker) {
  return colors[Math.max(0, [...new Set(cues.map(c => c.speaker))].indexOf(speaker)) % colors.length];
}
function paintSpeaker(node, speaker) { const [ink, tint] = color(speaker); node.style.setProperty('--speaker', ink); node.style.setProperty('--tint', tint); }
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function ordered() { return [...cues].sort((a, b) => a.start - b.start || a.end - b.end); }
function isOverlap(cue) { return cues.some(other => other.id !== cue.id && S.overlaps(cue, other)); }
function total() { return Math.max(10, Number.isFinite(video.duration) ? video.duration : 0, ...cues.map(c => c.end)); }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, cues })); $('save-state').textContent = '✓ 이 브라우저에 자동 저장됨'; }
  catch { $('save-state').textContent = '자동 저장 불가 · 프로젝트를 저장하세요'; }
}
function approveDiscard() { return !dirty || confirm('아직 적용하지 않은 수정이 있습니다. 이 수정을 버릴까요?'); }
function choose(id, seek = true) {
  if (!approveDiscard()) return;
  selected = id; dirty = false;
  renderList(); fillForm(); renderTimeline();
  const cue = cues.find(c => c.id === id); if (seek && cue) setTime(cue.start);
}
function setTime(time) {
  const max = Number.isFinite(video.duration) ? video.duration : total();
  cursor = Math.max(0, Math.min(time, max));
  if (mediaUrl && video.readyState >= 1) video.currentTime = cursor;
  renderPlayback();
}
function renderPlayback() {
  const time = mediaUrl && video.readyState >= 1 ? video.currentTime : cursor;
  cursor = time;
  $('position').textContent = S.formatTime(time);
  $('duration').textContent = S.formatTime(Number.isFinite(video.duration) ? video.duration : total());
  $('playhead').style.left = `${110 + time * px}px`;
  const overlay = $('subtitle-overlay'); overlay.replaceChildren();
  for (const cue of S.activeAt(ordered(), time)) overlay.append(el('div', 'subtitle-line', `${cue.speaker ? `[${cue.speaker}] ` : ''}${cue.text}`));
  const activeIds = new Set(S.activeAt(cues, time).map(c => c.id));
  document.querySelectorAll('.cue').forEach(node => node.classList.toggle('playing', activeIds.has(node.dataset.id)));
}
function renderList() {
  const list = $('cue-list'); list.replaceChildren();
  const query = $('search').value.trim().toLocaleLowerCase();
  const filtered = ordered().filter(c => (!query || `${c.speaker} ${c.text}`.toLocaleLowerCase().includes(query)) && (!$('overlap-only').checked || isOverlap(c)));
  $('cue-count').textContent = `${cues.length}개 자막`;
  if (!filtered.length) {
    const empty = el('div', 'empty-list', cues.length ? '조건에 맞는 자막이 없습니다.' : '아직 자막이 없어요.\nSRT를 불러오거나 자막을 직접 추가하세요.');
    empty.style.whiteSpace = 'pre-line'; list.append(empty);
  }
  const all = ordered();
  for (const cue of filtered) {
    const button = el('button', `cue${cue.id === selected ? ' selected' : ''}`); button.type = 'button'; button.dataset.id = cue.id; button.setAttribute('role', 'listitem');
    button.append(el('span', 'cue-number', String(all.indexOf(cue) + 1).padStart(2, '0')));
    const content = el('div', 'cue-content'), meta = el('div', 'cue-meta');
    const speaker = el('span', 'speaker-badge', cue.speaker || '화자 미지정'); paintSpeaker(speaker, cue.speaker); meta.append(speaker, el('span', '', `${S.formatTime(cue.start)} → ${S.formatTime(cue.end)}`));
    if (isOverlap(cue)) meta.append(el('span', 'overlap-badge', '동시 발화'));
    content.append(meta, el('div', 'cue-text', cue.text || '(내용을 입력하세요)')); button.append(content);
    button.onclick = () => choose(cue.id); list.append(button);
  }
  renderPlayback();
}
function fillForm() {
  const cue = cues.find(c => c.id === selected); $('edit-form').hidden = !cue;
  if (!cue) return;
  $('edit-title').textContent = `자막 ${ordered().findIndex(c => c.id === selected) + 1} 수정`;
  $('start-time').value = S.formatTime(cue.start); $('end-time').value = S.formatTime(cue.end);
  $('speaker').value = cue.speaker; $('cue-text').value = cue.text;
  $('speakers').replaceChildren(...[...new Set(cues.map(c => c.speaker).filter(Boolean))].map(speaker => { const option = el('option'); option.value = speaker; return option; }));
}
function renderTimeline() {
  const width = Math.max(600, total() * px + 50); $('timeline-content').style.width = `${width + 110}px`;
  $('zoom-label').textContent = `${px} px/s`;
  const ruler = $('ruler'); ruler.replaceChildren();
  const step = Math.max(1, Math.ceil(80 / px));
  for (let time = 0; time <= total(); time += step) {
    const tick = el('span', 'tick', S.formatTime(time).slice(0, 8)); tick.style.left = `${time * px}px`; ruler.append(tick);
  }
  ruler.onclick = event => setTime((event.clientX - ruler.getBoundingClientRect().left) / px);
  const lanes = $('lanes'); lanes.replaceChildren();
  const speakers = [...new Set(cues.map(c => c.speaker))];
  if (!speakers.length) speakers.push('');
  for (const speaker of speakers) {
    // Give same-speaker overlaps their own sublane as well.
    const tracks = [];
    for (const cue of ordered().filter(c => c.speaker === speaker)) {
      let track = tracks.find(items => items.every(other => !S.overlaps(cue, other)));
      if (!track) { track = []; tracks.push(track); } track.push(cue);
    }
    if (!tracks.length) tracks.push([]);
    tracks.forEach((items, index) => {
      const lane = el('div', 'lane');
      const label = el('span', 'lane-name', `${speaker || '화자 미지정'}${index ? ` (${index + 1})` : ''}`); paintSpeaker(label, speaker); label.style.color = color(speaker)[0]; lane.append(label);
      lane.onclick = event => { if (event.target === lane) setTime((event.clientX - lane.getBoundingClientRect().left) / px); };
      for (const cue of items) {
        const block = el('button', `timeline-cue${cue.id === selected ? ' selected' : ''}${isOverlap(cue) ? ' is-overlap' : ''}`, cue.text || '새 자막');
        block.style.left = `${cue.start * px}px`; block.style.width = `${Math.max(3, (cue.end - cue.start) * px)}px`; paintSpeaker(block, cue.speaker);
        block.title = `${cue.speaker}: ${cue.text}\n${S.formatTime(cue.start)} → ${S.formatTime(cue.end)}`; block.onclick = () => choose(cue.id); lane.append(block);
      }
      lanes.append(lane);
    });
  }
  $('overlap-count').textContent = cues.filter(isOverlap).length;
  renderPlayback();
}
function refresh() { renderList(); fillForm(); renderTimeline(); }
function commit() {
  const index = cues.findIndex(c => c.id === selected); if (index < 0) return true;
  try {
    const updated = { ...cues[index], start: S.parseTime($('start-time').value), end: S.parseTime($('end-time').value), speaker: $('speaker').value.trim(), text: $('cue-text').value.trim() };
    S.validate([updated]); cues[index] = updated; dirty = false; persist(); refresh(); return true;
  } catch (error) { toast(error.message); return false; }
}
function uid() { return globalThis.crypto?.randomUUID?.() || `cue-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function addCue(overlap = false) {
  if (dirty && !commit()) return;
  const parent = cues.find(c => c.id === selected);
  let speaker = parent?.speaker || '화자 1';
  if (overlap) {
    const existing = new Set(cues.map(c => c.speaker)); let number = 1;
    while (existing.has(`화자 ${number}`)) number++;
    speaker = `화자 ${number}`;
  }
  const start = overlap && parent ? parent.start : cursor;
  const end = overlap && parent ? parent.end : start + 2;
  const cue = { id: uid(), start, end, speaker, text: '' };
  cues.push(cue); selected = cue.id; persist(); refresh(); $('cue-text').focus();
}
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = el('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function togglePlay() {
  if (!mediaUrl) { toast('먼저 영상 또는 음성을 선택하세요.'); return; }
  if (video.paused) video.play().catch(() => toast('이 파일을 재생할 수 없습니다. 브라우저가 지원하는 형식인지 확인하세요.'));
  else video.pause();
}
$('open-media').onclick = $('open-media-empty').onclick = () => $('media-input').click();
$('media-input').onchange = event => {
  const file = event.target.files[0]; if (!file) return;
  video.pause(); if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = URL.createObjectURL(file); video.src = mediaUrl; video.load(); cursor = 0;
  $('media-name').textContent = file.name; $('empty-video').hidden = true;
  event.target.value = ''; renderPlayback();
};
video.addEventListener('loadedmetadata', () => { renderTimeline(); setTime(0); });
video.addEventListener('timeupdate', renderPlayback);
video.addEventListener('play', () => { $('play').textContent = 'Ⅱ'; $('play').setAttribute('aria-label', '일시정지'); });
video.addEventListener('pause', () => { $('play').textContent = '▶'; $('play').setAttribute('aria-label', '재생'); });
video.addEventListener('error', () => { $('empty-video').hidden = false; toast('미디어를 재생할 수 없습니다. MP4(H.264) 또는 WAV 등 지원 형식을 사용하세요.'); });
$('play').onclick = togglePlay; $('back').onclick = () => setTime(cursor - 3); $('forward').onclick = () => setTime(cursor + 3);
$('speed').onchange = () => { video.playbackRate = +$('speed').value; };
$('search').oninput = renderList; $('overlap-only').onchange = renderList;
$('apply-edit').onclick = commit;
for (const id of ['start-time', 'end-time', 'speaker', 'cue-text']) $(id).oninput = () => { dirty = true; $('save-state').textContent = '수정 중 · 수정 적용을 눌러 저장'; };
$('set-start').onclick = () => { $('start-time').value = S.formatTime(cursor); dirty = true; };
$('set-end').onclick = () => { $('end-time').value = S.formatTime(cursor); dirty = true; };
$('add-cue').onclick = () => addCue(); $('add-overlap').onclick = () => addCue(true);
$('delete-cue').onclick = () => {
  if (!confirm('선택한 자막을 삭제할까요?')) return;
  cues = cues.filter(c => c.id !== selected); selected = null; dirty = false; persist(); refresh();
};
$('export').onclick = () => {
  if (dirty && !commit()) return;
  try { if (!cues.length) throw Error('저장할 자막을 먼저 추가하세요.'); download('subtitles.srt', '\uFEFF' + S.toSrt(ordered()), 'application/x-subrip;charset=utf-8'); toast('SRT를 저장했습니다. 겹치는 발화는 여러 줄로 표시됩니다.'); }
  catch (error) { toast(error.message); }
};
$('save-project').onclick = () => { if (dirty && !commit()) return; download('voicedesk-project.json', JSON.stringify({ version: 1, cues }, null, 2), 'application/json'); toast('프로젝트를 저장했습니다. 영상 파일은 포함되지 않습니다.'); };
$('import').onclick = () => $('subtitle-input').click();
$('subtitle-input').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const source = await file.text();
    let imported;
    if (file.name.toLowerCase().endsWith('.json')) {
      const project = JSON.parse(source); if (project.version !== 1) throw Error('지원하지 않는 프로젝트 버전입니다.'); imported = S.validate(project.cues);
    } else imported = S.fromSrt(source);
    if (!imported.length) throw Error('불러올 자막이 없습니다.');
    if ((cues.length || dirty) && !confirm('현재 자막을 불러온 파일로 바꿀까요? 필요한 경우 먼저 프로젝트를 저장하세요.')) return;
    cues = imported; selected = cues[0]?.id || null; dirty = false; persist(); refresh(); toast(`${cues.length}개 자막을 불러왔습니다.`);
  } catch (error) { toast(`불러오기 실패: ${error.message}`); }
  finally { event.target.value = ''; }
};
$('new-project').onclick = () => {
  if ((cues.length || dirty) && !confirm('새 프로젝트를 시작할까요? 현재 자막과 미적용 수정은 지워집니다.')) return;
  video.pause(); video.removeAttribute('src'); video.load(); if (mediaUrl) URL.revokeObjectURL(mediaUrl); mediaUrl = null;
  $('empty-video').hidden = false; $('media-name').textContent = '미디어 미선택';
  cues = []; selected = null; dirty = false; cursor = 0; persist(); refresh();
};
$('zoom-in').onclick = () => { px = Math.min(240, px + 20); renderTimeline(); };
$('zoom-out').onclick = () => { px = Math.max(10, px - 20); renderTimeline(); };
$('load-demo').onclick = () => {
  if ((cues.length || dirty) && !confirm('현재 자막을 예제로 바꿀까요?')) return;
  cues = [
    { id: uid(), start: 0.8, end: 3.8, speaker: '화자 1', text: '오늘 회의에서 가장 중요한 건 접근성이에요.' },
    { id: uid(), start: 2.4, end: 3.2, speaker: '화자 2', text: '네, 맞아요.' },
    { id: uid(), start: 4.3, end: 7.4, speaker: '화자 2', text: '동시에 말해도 두 사람의 말을 모두 보여주면 좋겠어요.' },
    { id: uid(), start: 6.0, end: 7.8, speaker: '화자 1', text: '짧은 대답도 빠지지 않게요.' },
    { id: uid(), start: 8.5, end: 10.8, speaker: '화자 1', text: '각 화자의 시간을 따로 수정할 수 있어요.' }
  ];
  selected = cues[0].id; dirty = false; persist(); refresh(); setTime(2.5); toast('편집용 가상 대사입니다. 연결된 예제 영상은 없습니다.');
};
document.addEventListener('keydown', event => {
  if (event.target.closest('input, textarea, select, button, a')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { event.preventDefault(); setTime(cursor + (event.code === 'ArrowLeft' ? -0.1 : 0.1)); }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
try { const saved = localStorage.getItem(storageKey); if (saved) { const project = JSON.parse(saved); if (project.version !== 1) throw Error('version'); cues = S.validate(project.cues); selected = cues[0]?.id || null; } }
catch { toast('자동 저장 데이터를 읽지 못했습니다. 저장해 둔 프로젝트를 불러오세요.'); }
refresh();
