const {test} = require('node:test');
const assert = require('node:assert/strict');
const S = require('./subtitles.js');
const cue = (id,start,end,speaker,text) => ({id,start,end,speaker,text});
test('simultaneous speakers retain independent boundaries in SRT', () => {
 const cues=[cue('a',1,3,'화자 1','첫 발화'),cue('b',2,4,'화자 2','네')];
 assert.equal(S.toSrt(cues),'1\n00:00:01,000 --> 00:00:02,000\n[화자 1] 첫 발화\n\n2\n00:00:02,000 --> 00:00:03,000\n[화자 1] 첫 발화\n[화자 2] 네\n\n3\n00:00:03,000 --> 00:00:04,000\n[화자 2] 네\n');
 assert.equal(S.activeAt(cues,3).length,1);
 assert.equal(S.activeAt(cues,4).length,0);
 assert.equal(S.overlaps(cues[0],cue('c',3,5,'','')),false);
});
test('SRT import restores simultaneous speaker lines and multiline text',()=>{
 const parsed=S.fromSrt('\uFEFF1\r\n00:00:01,100 --> 00:00:02,200\r\n[화자 1] 안녕\r\n두 번째 줄\r\n[화자 2] 네\r\n');
 assert.equal(parsed.length,2);assert.equal(parsed[0].text,'안녕\n두 번째 줄');assert.equal(parsed[1].speaker,'화자 2');
 assert.equal(parsed[0].start,1.1);
});
test('invalid times, empty export and corrupt projects are rejected',()=>{
 for(const value of ['00:60','01:60:00','not time']) assert.throws(()=>S.parseTime(value));
 for(const item of [cue('a',-1,2,'','hi'),cue('a',2,2,'','hi'),cue('a',0,0.0001,'','hi'),cue('a',0,2,null,'hi')]) assert.throws(()=>S.validate([item]));
 assert.throws(()=>S.toSrt([cue('a',0,2,'','')]));
 assert.throws(()=>S.validate([cue('a',0,2,'','a'),cue('a',1,3,'','b')]));
 assert.throws(()=>S.fromSrt('bad file'));
});
test('time formats round milliseconds and preserve long recordings',()=>{
 assert.equal(S.formatTime(3723.045,','),'01:02:03,045');
 assert.equal(S.parseTime('01:02:03,045'),3723.045);
 assert.equal(S.formatTime(59.9999),'00:01:00.000');
});
test('SRT roundtrip preserves active dialogue at every speech boundary',()=>{
 const cues=[cue('a',1,5,'A','first'),cue('b',2,3,'B','second'),cue('c',2.5,6,'C','third')];
 const imported=S.fromSrt(S.toSrt(cues));
 for(const time of [0,1,2,2.5,3,4,5,5.5,6]) assert.deepEqual(S.activeAt(imported,time).map(c=>c.text).sort(),S.activeAt(cues,time).map(c=>c.text).sort());
});
test('speech, laughter, effect and music are formatted together without dropping overlap',()=>{
 const cues=[cue('a',1,3,'민수','괜찮아요?'),{...cue('b',2,4,'지연','웃음'),kind:'laughter'}, {...cue('c',2,2.8,'','문 닫히는 소리'),kind:'sound'}, {...cue('d',3,5,'','[잔잔한 음악]'),kind:'music'}];
 assert.equal(S.captionText(cues[1]),'[지연] [웃음]');
 assert.equal(S.captionText(cues[3]),'[잔잔한 음악]');
 const imported=S.fromSrt(S.toSrt(cues));
 for(const time of [1,2,2.5,2.8,3,4,4.5,5]) assert.deepEqual(S.activeAt(imported,time).map(S.captionText).sort(),S.activeAt(cues,time).map(S.captionText).sort());
 assert.equal(imported.find(c=>c.text==='웃음').kind,'laughter');
 assert.equal(imported.find(c=>c.text==='잔잔한 음악').kind,'music');
});
test('review checks count missing content, unreviewed cues and crowded display intervals',()=>{
 const cues=[{...cue('a',0,2,'A','a'),reviewed:true},cue('b',0,2,'B','b'),{...cue('c',0,2,'',''),kind:'sound'}];
 assert.deepEqual(S.reviewSummary(cues),{unreviewed:2,empty:1,crowded:1});
 assert.throws(()=>S.validate([{...cues[0],kind:'unknown'}]));
 assert.throws(()=>S.validate([{...cues[0],reviewed:'true'}]));
});
