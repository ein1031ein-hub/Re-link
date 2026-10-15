// 자유 입력 태그 추출 테스트. 의존성 없음.
// 실행: node tests/tags.test.js
const ctx = require('./load-app')();

const cases = [
  // [입력, 기대 { energy, area, has: 있어야 할 관심사, not: 없어야 할 관심사 }]
  ['집 근처에서 산책하고 싶어', { area: null, has: ['nature'] }],
  ['사람 만나기 싫어', { not: ['social'] }],
  ['피곤한데 운동은 하고 싶어', { energy: 1, has: ['move'] }],
  ['혼자 조용히 쉬고 싶어', { has: ['rest'] }],
  // 추가 확인
  ['친구랑 같이 가기 싫음', { not: ['social'] }],
  ['산책은 싫고 운동하고 싶어', { has: ['move'], not: ['nature'] }],
  ['계산 과제 생산적으로', { not: ['nature', 'learn'] }],
  ['그리고 학교 끝나고', { area: 'school', not: ['create'] }],
];

let fail = 0;
console.log('입력 | 결과 (energy / area / 관심사)');
for (const [text, exp] of cases) {
  const t = ctx.extractTags(text);
  const errs = [];
  if ('energy' in exp && t.energy !== exp.energy) errs.push(`energy ${t.energy} ≠ ${exp.energy}`);
  if ('area' in exp && t.area !== exp.area) errs.push(`area ${t.area} ≠ ${exp.area}`);
  (exp.has || []).forEach(i => { if (!t.interests.includes(i)) errs.push(`${i} 없음`); });
  (exp.not || []).forEach(i => { if (t.interests.includes(i)) errs.push(`${i} 잘못 추가`); });
  if (errs.length) fail++;
  console.log(`${errs.length ? '❌' : '✅'} ${text} | ${t.energy ?? '-'} / ${t.area ?? '-'} / ${t.interests.join(', ') || '-'}${errs.length ? '  ← ' + errs.join(', ') : ''}`);
}

// 글 → 버튼 병합 규칙
const f = ctx.$('EMPTY_FORM()');
const step = (label, ok) => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${label}`); };
f.pick.energy = 3; f.text = '너무 지쳤어 산책하고 싶어'; ctx.applyTextTags(f);
step('직접 고른 에너지(높음)는 글("지쳤어")로 바뀌지 않음', f.energy === 3);
step('글에서 찾은 자연이 추가됨', f.interests.includes('nature'));
f.text = ''; ctx.applyTextTags(f);
step('글을 지우면 글에서 추가된 자연이 빠짐', !f.interests.includes('nature'));
f.userInterests = ['nature']; f.text = '산책'; ctx.applyTextTags(f); f.text = ''; ctx.applyTextTags(f);
step('직접 누른 자연은 글을 지워도 유지', f.interests.includes('nature'));
const g = ctx.$('EMPTY_FORM()'); g.preset.energy = 2; g.text = '지쳤어'; ctx.applyTextTags(g);
step('미리 골라둔 값(보통)은 글(낮음)로 채워짐', g.energy === 1);
g.dismissed.push('energy'); ctx.applyTextTags(g);
step('칩을 눌러 해제하면 미리 골라둔 값으로 돌아감', g.energy === 2);

console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
