(function (root) {
  'use strict';
  const parseTime = value => {
    const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(value.trim());
    if (!match || +match[3] > 59 || (match[1] !== undefined && +match[2] > 59)) throw Error('시간 형식을 확인하세요. 예: 00:00:01.200');
    return ((+(match[1] || 0) * 3600 + +match[2] * 60 + +match[3]) * 1000 + +(match[4] || '0').padEnd(3, '0')) / 1000;
  };
  function formatTime(seconds, separator = '.') {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
  }
  function validate(cues) {
    if (!Array.isArray(cues)) throw Error('자막 목록이 올바르지 않습니다.');
    const ids = new Set();
    for (const cue of cues) {
      if (!cue || typeof cue.id !== 'string' || ids.has(cue.id) || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || !Number.isSafeInteger(Math.round(cue.end * 1000)) || Math.round(cue.start * 1000) >= Math.round(cue.end * 1000) || typeof cue.text !== 'string' || typeof cue.speaker !== 'string') throw Error('자막의 시간·내용·화자 형식을 확인하세요. 종료는 시작보다 최소 1ms 늦어야 합니다.');
      ids.add(cue.id);
    }
    return cues;
  }
  const activeAt = (cues, time) => cues.filter(cue => cue.start <= time && time < cue.end);
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  function toSrt(cues) {
    validate(cues);
    if (cues.some(cue => !cue.text.trim())) throw Error('내용이 비어 있는 자막을 먼저 입력하거나 삭제하세요.');
    const times = [...new Set(cues.flatMap(cue => [Math.round(cue.start * 1000), Math.round(cue.end * 1000)]))].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < times.length - 1; i++) {
      const lines = cues.filter(cue => Math.round(cue.start * 1000) <= times[i] && Math.round(cue.end * 1000) >= times[i + 1]);
      if (!lines.length) continue;
      result.push(`${result.length + 1}\n${formatTime(times[i] / 1000, ',')} --> ${formatTime(times[i + 1] / 1000, ',')}\n${lines.map(cue => `${cue.speaker.trim() ? `[${cue.speaker.replace(/[\r\n]/g, ' ')}] ` : ''}${cue.text.trim().replace(/\n\s*\n/g, '\n')}`).join('\n')}\n`);
    }
    return result.join('\n');
  }
  function fromSrt(source) {
    const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
    const cues = [];
    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.split('\n');
      if (/^\d+$/.test(lines[0].trim())) lines.shift();
      const timing = /^(\S+)\s*-->\s*(\S+)(?:\s+.*)?$/.exec(lines.shift() || '');
      if (!timing || !lines.length) throw Error('SRT 형식을 확인하세요. 시간과 내용이 필요합니다.');
      const start = parseTime(timing[1]), end = parseTime(timing[2]);
      // Speaker-tagged simultaneous lines are restored as separate editable cues.
      let current = null;
      for (const line of lines) {
        const speaker = /^\[([^\]]+)\]\s*(.*)$/.exec(line);
        if (speaker) {
          current = { id: `import-${cues.length}`, start, end, speaker: speaker[1], text: speaker[2] };
          cues.push(current);
        } else if (current) current.text += '\n' + line;
        else {
          current = { id: `import-${cues.length}`, start, end, speaker: '', text: line };
          cues.push(current);
        }
      }
    }
    return validate(cues);
  }
  const api = { parseTime, formatTime, validate, activeAt, overlaps, toSrt, fromSrt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Subtitles = api;
})(globalThis);
