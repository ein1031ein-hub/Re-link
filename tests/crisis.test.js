// 위기 키워드 감지 테스트. 의존성 없음.
// 실행: node tests/crisis.test.js
// data.js 와 app.js 를 그대로 읽어서 실제 crisisWords() 를 시험한다 (화면 부분은 가짜 document 로 대신).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const el = () => ({ innerHTML: '', hidden: false, value: '', style: {}, classList: { toggle() {} }, querySelectorAll: () => [], focus() {} });
const mem = {};
const ctx = vm.createContext({
  document: { getElementById: el, addEventListener() {}, querySelectorAll: () => [] },
  window: { scrollTo() {} },
  localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } },
  confirm: () => true,
  console,
});
const root = path.join(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), ctx);

const cases = [
  // [입력, 기대: 'yes' 감지 / 'no' 미감지 / 'limit' 미감지 허용(한계)]
  ['죽고 싶어', 'yes'], ['죽고싶다', 'yes'], ['죽 고 싶 다', 'yes'], ['죽고 시퍼', 'yes'],
  ['그만 살고 싶어', 'yes'], ['살고 싶지 않아', 'yes'],
  ['사라졌으면 좋겠다', 'yes'], ['없어졌으면', 'yes'],
  ['오늘 수업 끝나고 너무 피곤해', 'no'], ['산책하고 싶어', 'no'],
  ['다 끝났으면', 'limit'], ['내일이 안 왔으면', 'limit'],
];

let fail = 0;
console.log('입력 | 기대 | 결과 | 걸린 키워드');
for (const [text, expect] of cases) {
  const words = ctx.crisisWords(text);
  const hit = words.length > 0;
  const ok = expect === 'yes' ? hit : expect === 'no' ? !hit : true;
  if (!ok) fail++;
  const label = { yes: '감지', no: '미감지', limit: '미감지 허용' }[expect];
  console.log(`${ok ? '✅' : '❌'} ${text} | ${label} | ${hit ? '감지' : '미감지'} | ${words.join(', ') || '-'}`);
}
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
