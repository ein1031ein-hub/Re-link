// 추천 규칙 테스트 (장벽 반영, 다양성, 나에게 잘 맞았던 활동). 의존성 없음.
// 실행: node tests/match.test.js
const ctx = require('./load-app')();
const $ = ctx.$;

let fail = 0;
const check = (label, ok, detail = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${label}${detail ? '  → ' + detail : ''}`); };
const names = r => r.items.map(i => i.place.name);
const form = (o) => Object.assign($('EMPTY_FORM()'), o);
const setHistory = h => { $('store').history = h; };
const fixedNow = new Date('2026-10-20T14:00:00'); // 화요일 오후 (대부분 운영 중)
$('Date').now = () => fixedNow.getTime();

// F1: '시간이 없었어요' → 활동 + 왕복 이동이 짧은 곳 먼저
const f1 = form({ purpose: 'out', energy: 2, area: 'school', interests: [] });
setHistory([]);
const before = ctx.match(f1);
setHistory([{ id: 'peace', name: '평화문화진지', done: false, barrier: '시간이 없었어요', at: fixedNow.toISOString() }]);
const after = ctx.match(f1);
const tot = r => r.items.map(i => ctx.totalMinutes(i.place) ?? Infinity); // 모르면 가장 긴 것으로 본다
check('F1 장벽 전후 1순위 비교', true, `전: ${names(before)[0]} (${tot(before)[0]}분) / 후: ${names(after)[0]} (${tot(after)[0]}분)`);
check('F1 장벽 후 1순위의 활동+왕복 시간이 전보다 짧거나 같음', tot(after)[0] <= tot(before)[0]);
check('F1 장벽 후 1순위는 60분 이내', tot(after)[0] <= 60);
check('F1 이유 문장에 "짧게 다녀올 수 있는 곳" 표시', after.items[0].reason.includes('짧게 다녀올 수 있는 곳'), after.items[0].reason);
check('F1 안내 문구 등록', $('BARRIER_LINES')['시간이 없었어요'].includes('짧게 다녀올 수 있는 곳'));

// D8: 직접 고른 관심사는 2개까지, 아니면 1개
setHistory([]);
const create = r => r.items.filter(i => i.place.interests[0] === 'create').length;
const tapped = form({ purpose: 'out', energy: 3, area: 'school', userInterests: ['create'], interests: ['create'] });
const notTapped = form({ purpose: 'out', energy: 3, area: 'school', interests: ['create'], fromText: { energy: null, area: null, interests: ['create'] } });
check('D8 창작을 직접 고르면 창작 2개까지', create(ctx.match(tapped)) === 2, names(ctx.match(tapped)).join(', '));
check('D8 글에서만 찾은 창작은 1개', create(ctx.match(notTapped)) === 1, names(ctx.match(notTapped)).join(', '));

// F3: 나에게 잘 맞았던 활동 (2회 이상인 종류만, 기분 평균)
const rec = (id, mood) => ({ id, done: true, mood });
check('F3 기록 1회뿐이면 표시 안 함', ctx.bestFit([rec('dooly', 4)]) === null);
const b = ctx.bestFit([rec('ssangmunlib', 1), rec('ssangmunpark', 2), rec('dooly', 3), rec('peace', 4), { id: 'dooly', done: false, mood: null }]);
check('F3 창작(둘리 3, 평화문화진지 4) 평균 3.5가 1위', b && b.kind === 'create' && b.n === 2, b && `${b.kind} ${b.n}회 평균 ${b.avg}`);
check('F3 삭제된 장소 기록은 무시', ctx.bestFit([rec('youngplants', 4), rec('youngplants', 4)]) === null);

console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
