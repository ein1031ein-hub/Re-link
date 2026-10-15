// 테스트용: data.js 와 app.js 를 그대로 읽어서 함수들을 꺼내 쓸 수 있게 한다. 의존성 없음.
// 화면(document)·저장소(localStorage)는 가짜로 대신한다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function loadApp() {
  const el = () => ({ innerHTML: '', hidden: false, value: '', style: {}, classList: { toggle() {} }, querySelectorAll: () => [], focus() {} });
  const mem = {};
  const ctx = vm.createContext({
    document: { getElementById: el, addEventListener() {}, querySelectorAll: () => [] },
    window: { scrollTo() {}, addEventListener() {} },
    location: { hash: '', replace() {} },
    history: { replaceState() {} },
    localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } },
    confirm: () => true,
    console,
  });
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), ctx);
  // const 로 선언된 값(EMPTY_FORM 등)은 ctx 에 바로 붙지 않아서 이걸로 꺼낸다
  ctx.$ = expr => vm.runInContext(expr, ctx);
  return ctx;
};
