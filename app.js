// Re:link 앱 로직
// 링크워커 흐름: ① 의뢰(처방 코드) → ② 대화(입력·태그 추출) → ③ 처방(매칭 엔진)
//               → ④ 체크인·단계 조정 → ⑤ 상담 때 보여줄 기록 → ⑥ 회송
// 위기 감지는 규칙 기반으로만 처리한다 (AI 없음).

const $app = document.getElementById('app');

// ── 저장소 (로그인 없이 이 기기에만 저장) ──
const STORE_KEY = 'relink-v1';
const EMPTY_STORE = () => ({ history: [], active: null, nextEnergy: null, code: null, reports: {}, demo: false });
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
}
let store = Object.assign(EMPTY_STORE(), load());

// 현재 입력 상태
const EMPTY_FORM = () => ({ purpose: null, energy: null, area: null, interests: [], text: '', ackWords: [] });
let form = EMPTY_FORM();
let lastResult = { items: [], programs: [], prepOnly: false, emptyReason: null };

const DAY = 24 * 60 * 60 * 1000;
const MOODS = ['😣', '😕', '😐', '🙂', '😊'];

// ── 공통 도우미 ──
const codeInfo = () => (store.code ? CODES[store.code.code] : null);
const findItem = id => PLACES.find(p => p.id === id) || PROGRAMS.find(p => p.id === id);
const fmtDate = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
const fmtHour = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const demoTag = '<span class="tag gray">시연용</span>';

function codeProgress() {
  if (!store.code) return null;
  const c = codeInfo();
  const goal = c.weeks * c.perWeek;
  const since = new Date(store.code.startedAt).getTime();
  const done = store.history.filter(h => h.done && new Date(h.at).getTime() >= since).length;
  return { goal, done: Math.min(done, goal), start: store.code.startedAt, end: new Date(since + c.weeks * 7 * DAY).toISOString() };
}

function progressBar(done, goal) {
  return `<div class="bar"><span style="width:${Math.round((done / goal) * 100)}%"></span></div>`;
}

// ── 위기 감지 ──
function crisisWords(text) {
  const t = (text || '').replace(/\s+/g, ' ');
  return CRISIS_KEYWORDS.filter(k => t.includes(k));
}
// 이미 "아니에요"라고 답한 단어는 다시 묻지 않는다
function needsCrisisCheck(text, acked = []) {
  return crisisWords(text).some(w => !acked.includes(w));
}

// ── 자유 입력 → 태그 추출 (규칙 기반) ──
function extractTags(text) {
  const found = { energy: null, area: null, interests: [] };
  if (!text) return found;
  for (const [level, words] of Object.entries(TAG_RULES.energy)) {
    if (words.some(w => text.includes(w))) found.energy = Number(level);
  }
  for (const [key, words] of Object.entries(TAG_RULES.interests)) {
    if (words.some(w => text.includes(w))) found.interests.push(key);
  }
  for (const [key, words] of Object.entries(TAG_RULES.area)) {
    if (words.some(w => text.includes(w))) found.area = key;
  }
  return found;
}

// ── 운영 여부 계산 ──
function openStatus(place, now = new Date()) {
  if (place.inApp) return { open: true, label: '지금 바로 가능' };
  if (place.hours === 'always') return { open: true, label: '상시 이용 가능' };
  if (!place.hours) return { open: null, label: '운영시간 확인 필요' };
  const today = place.hours[now.getDay()];
  if (!today) return { open: false, closedToday: true, label: '오늘 휴무' };
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < today[0]) return { open: false, label: `${fmtHour(today[0])}에 열어요` };
  if (h >= today[1]) return { open: false, closedToday: true, label: '오늘 운영 종료' };
  if (h + place.minutes / 60 > today[1]) return { open: true, label: `${fmtHour(today[1])} 마감 · 서두르면 가능` };
  return { open: true, label: `지금 운영 중 · ${fmtHour(today[1])}까지` };
}

function travelText(p) {
  if (p.inApp) return null;
  if (p.area === 'home') {
    return HOME_TRAVEL_MIN ? `덕성여대에서 버스 약 ${HOME_TRAVEL_MIN}분 (도봉산역 방면)` : '덕성여대에서 버스 · 확인 중 (도봉산역 방면)';
  }
  return p.travel ? `덕성여대에서 ${p.travel}` : '확인 중';
}

// 프로그램 접수 상태
function programStatus(prog, now = new Date()) {
  const start = new Date(prog.period[0] + 'T00:00:00');
  const end = new Date(prog.period[1] + 'T23:59:59');
  if (now > end) return null; // 마감 → 숨김
  if (now < start) return { open: false, label: `접수 예정 · ${fmtDate(start)}부터` };
  const left = Math.floor((end - now) / DAY);
  return { open: true, label: left === 0 ? '모집 중 · 오늘 마감' : `모집 중 · D-${left}` };
}

// ── 매칭 엔진 ──
// DB에 있는 장소·프로그램만 고른다. 점수 = 에너지 적합도 + 처방 목적 + 관심사 + 운영 여부
function scoreItem(p, f) {
  let score = 0;
  const [min, max] = p.energy;
  if (f.energy >= min && f.energy <= max) score += 4;
  else score += Math.max(0, 2 - (f.energy - max)); // 한 단계 가벼운 활동은 허용

  const hits = p.interests.filter(i => f.interests.includes(i));
  if (f.interests.includes('social') && p.social && !hits.includes('social')) hits.push('social');
  score += hits.length * 3;

  if (f.purpose === 'connect' && p.social) score += 8;
  if (f.purpose === 'out' && (p.interests.includes('nature') || p.interests.includes('move'))) score += 2;
  if (f.purpose === 'rhythm' && (p.interests.includes('move') || p.interests.includes('learn'))) score += 2;
  if (f.purpose === 'care' && p.interests.includes('rest')) score += 3;
  if (f.energy === 3 && p.social) score += 2;
  return { score, hits };
}

function match(f) {
  const outward = f.purpose === 'connect' || f.purpose === 'out';

  let scored = PLACES
    .filter(p => p.area === f.area)
    .filter(p => p.energy[0] <= f.energy) // 지금 에너지보다 힘든 활동은 추천하지 않는다
    .map(p => {
      const { score, hits } = scoreItem(p, f);
      const status = openStatus(p);
      let s = score;
      if (status.closedToday) s -= 6;
      else if (status.open) s += 1;
      if (store.reports[p.id]) s -= 2;
      return { place: p, score: s, hits, status };
    })
    .sort((a, b) => b.score - a.score);

  // 같은 관심사만 3개 나오지 않도록 다양성 확보
  const picked = [];
  const usedMain = new Set();
  for (const s of scored) {
    if (picked.length >= 3) break;
    if (usedMain.has(s.place.interests[0]) && scored.length > 3) continue;
    picked.push(s); usedMain.add(s.place.interests[0]);
  }
  for (const s of scored) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }

  // 목적이 '사람과 연결' / '밖으로 나가기'면 집 안 처방은 준비 단계로만
  let items = picked;
  let prepOnly = false;
  let emptyReason = null;
  if (f.area === 'online' && outward) {
    if (f.energy === 1) { items = picked.slice(0, 1); prepOnly = true; }
    else { items = []; emptyReason = 'outward'; }
  }
  if (f.area === 'school' && f.energy === 3 && !items.some(i => i.place.energy[1] === 3)) emptyReason = emptyReason || 'schoolHigh';

  // 지역 프로그램 (집에서 고른 날에도 '다음 걸음'으로 보여준다. 에너지 낮음이면 생략)
  const programs = f.energy === 1 ? [] : PROGRAMS
    .map(p => ({ prog: p, status: programStatus(p), ...scoreItem(p, f) }))
    .filter(x => x.status && x.prog.energy[0] <= f.energy)
    .sort((a, b) => (b.status.open - a.status.open) || (b.score - a.score))
    .slice(0, 2);

  return {
    items: items.map(s => ({ ...s, reason: makeReason(s, f) })),
    programs,
    prepOnly,
    emptyReason,
  };
}

function makeReason(s, f) {
  const parts = [`에너지 ${ENERGY[f.energy].label}: ${ENERGY[f.energy].rule}.`];
  if (f.purpose === 'connect' && s.place.social) parts.push(PURPOSES.connect.reason);
  if (s.hits.length) parts.push(`고른 방식(${s.hits.map(h => INTERESTS[h]).join(', ')})에 맞아요.`);
  parts.push(`약 ${s.place.minutes}분이면 충분해요.`);
  return parts.join(' ');
}

// ── 화면 그리기 ──
function render(html) {
  $app.innerHTML = `<section class="screen">${html}</section>`;
  window.scrollTo(0, 0);
}

const SCREENS = {};
function go(screen, arg) { (SCREENS[screen] || SCREENS.home)(arg); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-go]');
  if (el) { e.preventDefault(); go(el.dataset.go, el.dataset.arg); }
});

// 홈
SCREENS.home = function home() {
  const a = store.active;
  const c = codeInfo();
  const pr = codeProgress();
  const done = store.history.filter(h => h.done).length;

  render(`
    <h1>상담실 밖에서도<br>이어지는 회복</h1>
    <p class="lead">학생상담센터가 처방하고, 동네가 함께해요.<br>상담을 기다리는 동안, 상담과 상담 사이에.</p>

    ${c ? `
      <div class="card rx-info">
        <div class="rx-head"><span class="rx-no">나의 처방 정보</span>${demoTag}</div>
        <div class="kv"><b>처방 기관</b><span>${c.org}</span></div>
        <div class="kv"><b>처방 목적</b><span>${PURPOSES[c.purpose].label}</span></div>
        <div class="kv"><b>기간</b><span>${c.weeks}주 · 주 ${c.perWeek}회 참여 목표 <span class="small">(${fmtDate(pr.start)}~${fmtDate(pr.end)})</span></span></div>
        <div class="kv"><b>진행</b><span><b class="em">${pr.done} / ${pr.goal}회</b></span></div>
        ${progressBar(pr.done, pr.goal)}
        <button class="btn ghost" data-go="report">상담 때 보여줄 기록</button>
      </div>` : ''}

    ${a ? `
      <div class="card accent">
        <div class="small">진행 중인 처방 · ${fmtDate(a.at)}</div>
        <div class="rx-name" style="margin:4px 0 0">${a.name}</div>
        <button class="btn light" data-go="checkin">다녀왔어요? 체크인하기</button>
      </div>` : ''}

    ${c
      ? `<button class="btn" data-go="input">${a ? '새 처방 받기' : '오늘의 처방 받기'}</button>`
      : `<button class="btn" data-go="code">상담센터에서 처방 코드를 받았어요</button>
         <button class="link" data-go="input">코드 없이 먼저 둘러볼게요</button>`}

    <h2>나의 기록</h2>
    <div class="card">
      ${store.history.length ? `
        <p class="small">지금까지 처방 ${store.history.length}개 중 <b class="em">${done}개</b> 참여했어요.</p>
        <ul class="history">
          ${store.history.slice(-5).reverse().map(h => `
            <li><span>${fmtDate(h.at)} · ${h.name}</span><span>${h.done ? MOODS[h.mood] : '<span class="small">못 갔어요</span>'}</span></li>`).join('')}
        </ul>` : `<p class="small">아직 기록이 없어요. 첫 처방을 받아보세요.</p>`}
    </div>

    <h2>Re:link는 이렇게 일해요</h2>
    <div class="card">
      <ol class="steps">
        <li>학생상담센터에서 처방 코드를 받아요.</li>
        <li>지금 필요한 것과 에너지에 맞춰, 검증된 지역 활동을 처방해요.</li>
        <li>다녀온 기록으로 다음 처방을 조정하고, 원하면 상담 때 함께 봐요.</li>
      </ol>
    </div>

    <div class="demo-links">
      <button class="link" id="demoLoad">체험용 예시 기록 불러오기</button>
      ${store.history.length || store.code ? '<button class="link" id="demoClear">예시 기록 지우기</button>' : ''}
    </div>
  `);

  document.getElementById('demoLoad').onclick = () => {
    if (store.history.length && !store.demo && !confirm('지금 기록이 예시 기록으로 바뀌어요. 계속할까요?')) return;
    loadDemo(); home();
  };
  const clr = document.getElementById('demoClear');
  if (clr) clr.onclick = () => {
    if (!confirm('이 기기에 저장된 기록을 모두 지울까요?')) return;
    store = EMPTY_STORE(); form = EMPTY_FORM(); save(); home();
  };
};

// ① 의뢰 받기: 처방 코드 입력
SCREENS.code = function code() {
  render(`
    <h1>처방 코드 입력</h1>
    <p class="lead">상담 선생님께 받은 코드를 입력하면, 선생님이 정한 처방 목적에 맞춰 활동을 추천해요.</p>
    <div class="card">
      <input id="codeIn" class="input" placeholder="예) DS2026" autocomplete="off" autocapitalize="characters">
      <p class="small" style="margin-top:8px">시연용 코드: DS2026</p>
      <p class="err" id="codeErr"></p>
    </div>
    <button class="btn" id="codeGo">확인</button>
    <button class="link" data-go="input">코드 없이 먼저 둘러볼게요</button>
  `);
  const inp = document.getElementById('codeIn');
  const submit = () => {
    const v = inp.value.trim().toUpperCase();
    if (!CODES[v]) { document.getElementById('codeErr').textContent = '코드를 다시 확인해 주세요.'; return; }
    store.code = { code: v, startedAt: new Date().toISOString() };
    form.purpose = CODES[v].purpose;
    save();
    go('home');
  };
  document.getElementById('codeGo').onclick = submit;
  inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
  inp.focus();
};

// ② 입력
SCREENS.input = function input() {
  const c = codeInfo();
  if (!form.purpose && c) form.purpose = c.purpose;
  if (!form.energy && store.nextEnergy) form.energy = store.nextEnergy;
  const hint = store.nextEnergy
    ? `<div class="banner">지난 체크인을 바탕으로 에너지 <b>${ENERGY[store.nextEnergy].label}</b>를 먼저 골라뒀어요. 오늘 상태에 맞게 바꿔도 돼요.</div>`
    : '';

  render(`
    <h1>요즘 어때요?</h1>
    <p class="lead">한 줄로 적어도 되고, 아래 버튼만 골라도 돼요.</p>
    ${hint}

    <h2>요즘 가장 필요한 건?</h2>
    ${c ? `<p class="small" style="margin:-4px 0 8px">상담센터가 정한 목적을 먼저 골라뒀어요. ${demoTag}</p>` : ''}
    <div class="choices two" id="purpose">
      ${Object.entries(PURPOSES).map(([k, p]) => `<button class="chip" data-v="${k}">${p.label}</button>`).join('')}
    </div>

    <h2>한 줄로 말하기 <span class="small">(선택)</span></h2>
    <textarea id="free" placeholder="예) 수업 끝나고 너무 지쳐서 혼자 조용히 쉬고 싶어">${form.text}</textarea>
    <div class="tagline" id="tags"></div>

    <h2>오늘 에너지</h2>
    <div class="choices three" id="energy">
      ${[1, 2, 3].map(l => `<button class="chip" data-v="${l}"><span class="emoji">${ENERGY[l].emoji}</span>${ENERGY[l].label}</button>`).join('')}
    </div>

    <h2>어디서 할까요?</h2>
    <div class="choices three" id="area">
      ${Object.entries(AREAS).map(([k, a]) => `<button class="chip" data-v="${k}">${a.label}<span class="sub">${a.sub}</span></button>`).join('')}
    </div>

    <h2>이런 방식이면 좋겠어요 <span class="small">(선택)</span></h2>
    <div class="choices wrap" id="interests">
      ${Object.entries(INTERESTS).map(([k, l]) => `<button class="chip" data-v="${k}">${l}</button>`).join('')}
    </div>

    <button class="btn" id="go">처방전 받기</button>
  `);

  const sync = () => {
    document.querySelectorAll('#purpose .chip').forEach(x => x.classList.toggle('on', x.dataset.v === form.purpose));
    document.querySelectorAll('#energy .chip').forEach(x => x.classList.toggle('on', Number(x.dataset.v) === form.energy));
    document.querySelectorAll('#area .chip').forEach(x => x.classList.toggle('on', x.dataset.v === form.area));
    document.querySelectorAll('#interests .chip').forEach(x => x.classList.toggle('on', form.interests.includes(x.dataset.v)));
    document.getElementById('go').disabled = !(form.purpose && form.energy && form.area);
  };
  const pickOne = (id, key, cast = v => v) => {
    document.getElementById(id).onclick = e => { const x = e.target.closest('.chip'); if (x) { form[key] = cast(x.dataset.v); sync(); } };
  };
  pickOne('purpose', 'purpose');
  pickOne('energy', 'energy', Number);
  pickOne('area', 'area');
  document.getElementById('interests').onclick = e => {
    const x = e.target.closest('.chip'); if (!x) return;
    const v = x.dataset.v;
    form.interests = form.interests.includes(v) ? form.interests.filter(i => i !== v) : [...form.interests, v];
    sync();
  };

  const askCrisis = () => {
    confirmCrisis(() => { form.ackWords = [...new Set([...form.ackWords, ...crisisWords(form.text)])]; go('input'); });
  };

  let timer;
  document.getElementById('free').oninput = e => {
    form.text = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (needsCrisisCheck(form.text, form.ackWords)) { askCrisis(); return; }
      const t = extractTags(form.text);
      const chips = [];
      if (t.energy) { form.energy = t.energy; chips.push(`<span class="tag warm">에너지 ${ENERGY[t.energy].label}</span>`); }
      if (t.area) { form.area = t.area; chips.push(`<span class="tag warm">${AREAS[t.area].label}</span>`); }
      t.interests.forEach(i => {
        if (!form.interests.includes(i)) form.interests.push(i);
        chips.push(`<span class="tag warm">${INTERESTS[i]}</span>`);
      });
      document.getElementById('tags').innerHTML = chips.length
        ? `<span class="small">글에서 찾은 태그 →</span> ${chips.join('')}` : '';
      sync();
    }, 400);
  };

  document.getElementById('go').onclick = () => {
    if (needsCrisisCheck(form.text, form.ackWords)) { askCrisis(); return; }
    lastResult = match(form);
    go('result');
  };
  sync();
};

// 위기 키워드 확인 화면 (바로 이동하지 않고 한 번 묻는다)
function confirmCrisis(onContinue) {
  render(`
    <h1>혹시 지금 많이<br>힘든 마음이 있나요?</h1>
    <p class="lead">적어준 말 중에 마음에 걸리는 표현이 있었어요. 괜찮다면 그대로 계속해도 돼요.</p>
    <button class="btn warm" data-go="crisis" data-arg="detected">도움받을 곳 보기</button>
    <button class="btn ghost" id="cont">아니에요, 계속할게요</button>
  `);
  document.getElementById('cont').onclick = onContinue;
}

// ③ 처방전
SCREENS.result = function result() {
  const f = form;
  const { items, programs, prepOnly, emptyReason } = lastResult;
  const purposeLabel = PURPOSES[f.purpose].label;
  const tags = [
    `<span class="tag warm">처방 목적: ${purposeLabel}</span>`,
    `<span class="tag">${ENERGY[f.energy].emoji} 에너지 ${ENERGY[f.energy].label}</span>`,
    `<span class="tag">${AREAS[f.area].label}</span>`,
    ...f.interests.map(i => `<span class="tag">${INTERESTS[i]}</span>`),
  ].join('');

  const card = (r, i) => {
    const p = r.place;
    const travel = travelText(p);
    return `
    <div class="card">
      <div class="rx-head">
        <span class="rx-no">처방 ${String(i + 1).padStart(2, '0')}</span>
        <span class="tag gray">${p.inApp ? (prepOnly ? '오늘의 준비 단계' : '앱에서 바로') : '공공 문화자원 정보'}</span>
      </div>
      <div class="tagline"><span class="tag warm">처방 목적: ${purposeLabel}</span></div>
      <div class="rx-name">${p.name}</div>
      <div class="tagline">${p.interests.filter(x => x !== 'social').map(x => `<span class="tag">${INTERESTS[x]}</span>`).join('')}${p.social ? '<span class="tag warm">사람 만남</span>' : ''}</div>
      <div class="rx-meta">
        <div><b>활동</b>약 ${p.minutes}분</div>
        ${travel ? `<div><b>이동</b>${travel}</div>` : ''}
        ${p.inApp ? '' : `<div><b>운영</b>${p.hoursText}</div>`}
        <div><b>지금</b><span class="${r.status.open === false ? 'closed' : r.status.open ? 'open' : ''}">${r.status.label}</span></div>
      </div>
      ${p.note ? `<div class="note">※ ${p.note}</div>` : ''}
      ${store.reports[p.id] ? `<div class="note">⚠ 최근 이용자 제보: 운영 확인 필요</div>` : ''}
      <div class="rx-why"><b>왜 이 처방?</b> ${p.why}<br><span class="small">${r.reason}</span></div>
      <div class="rx-actions">
        ${p.inApp
          ? `<button class="btn ghost" data-go="guide" data-arg="${p.id}">방법 보기</button>`
          : `<a class="btn ghost" href="https://map.naver.com/p/search/${encodeURIComponent(p.name.replace(/\s*\(.*\)/, ''))}" target="_blank" rel="noopener">지도 보기</a>`}
        <button class="btn" data-pick="${p.id}">이걸로 할게요</button>
      </div>
    </div>`;
  };

  const progCard = x => `
    <div class="card">
      <div class="rx-head">
        <span class="tag program">지역 프로그램</span>
        <span class="${x.status.open ? 'open' : 'small'}" style="font-size:13px">${x.status.label}</span>
      </div>
      <div class="rx-name">${x.prog.name}</div>
      <div class="rx-meta">
        <div><b>장소</b>${x.prog.place}</div>
        <div><b>접수</b>${fmtDate(x.prog.period[0] + 'T00:00')}~${fmtDate(x.prog.period[1] + 'T00:00')}</div>
      </div>
      <div class="rx-why">${x.prog.why}</div>
      <div class="rx-actions">
        <a class="btn ghost" href="${x.prog.applyUrl}" target="_blank" rel="noopener">신청 페이지</a>
        <button class="btn" data-pick="${x.prog.id}">이걸로 할게요</button>
      </div>
    </div>`;

  render(`
    <h1>오늘의 처방전</h1>
    <div class="tagline">${tags}</div>

    ${prepOnly ? `<div class="banner">처방 목적(${purposeLabel})에 맞춰, 집 안 활동은 <b>오늘의 준비 단계</b>로 하나만 드려요. 기운이 생기면 집 밖 처방을 받아봐요.</div>` : ''}

    ${items.map(card).join('')}

    ${emptyReason === 'outward' ? `
      <div class="card">
        <p>처방 목적(${purposeLabel})에 맞춰 오늘은 집 밖 활동을 처방할게요.</p>
        <button class="btn" id="toSchool">학교 근처에서 찾기</button>
      </div>` : ''}
    ${emptyReason === 'schoolHigh' ? `
      <div class="banner">학교 근처의 활발한 활동은 아직 준비 중이에요. '조금 멀리 · 도봉동'에서 더 찾을 수 있어요.
        <button class="link" id="toHome" style="display:block;margin-top:6px">도봉동에서 찾기 →</button></div>` : ''}
    ${!items.length && !emptyReason ? `<div class="card"><p>조건에 맞는 처방을 찾지 못했어요. 생활권이나 에너지를 바꿔볼까요?</p></div>` : ''}

    ${programs.length ? `<h2>지금 모집 중인 지역 프로그램</h2>${programs.map(progCard).join('')}` : ''}

    <button class="btn ghost" data-go="input">조건 바꾸기</button>
  `);

  const reArea = area => { form.area = area; lastResult = match(form); go('result'); };
  const ts = document.getElementById('toSchool'); if (ts) ts.onclick = () => reArea('school');
  const th = document.getElementById('toHome'); if (th) th.onclick = () => reArea('home');

  document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    const p = findItem(b.dataset.pick);
    store.active = { id: p.id, name: p.name, energy: form.energy, purpose: form.purpose, at: new Date().toISOString() };
    save();
    if (p.inApp) go('guide', p.id); else go('home');
  });
};

// 앱 안 처방 가이드
SCREENS.guide = function guide(id) {
  const p = findItem(id);
  if (!p || !p.steps) return go('home');
  render(`
    <h1>${p.name}</h1>
    <p class="lead">${p.why}</p>
    <div class="card"><ol class="steps">${p.steps.map(s => `<li>${s}</li>`).join('')}</ol></div>
    ${store.active && store.active.id === p.id
      ? `<button class="btn" data-go="checkin">다 했어요 · 체크인</button>`
      : `<button class="btn" id="start">이걸로 할게요</button>`}
    <button class="btn ghost" data-go="home">나중에 할게요</button>
  `);
  const s = document.getElementById('start');
  if (s) s.onclick = () => {
    store.active = { id: p.id, name: p.name, energy: form.energy || p.energy[0], purpose: form.purpose, at: new Date().toISOString() };
    save();
    go('guide', p.id);
  };
};

// ④ 참여 체크인 → 다음 처방 단계 조정 (행동활성화: 작게 성공하고 한 단계씩 올리기)
const BARRIERS = ['시간이 없었어요', '너무 멀었어요', '기운이 없었어요', '혼자 가기 어색했어요', '문이 닫혀 있었어요'];

SCREENS.checkin = function checkin() {
  const a = store.active;
  if (!a) return go('home');
  const c = { done: null, mood: null, barrier: null, text: '' };

  render(`
    <h1>${a.name}</h1>
    <p class="lead">어땠는지 짧게 알려주세요. 다음 처방에 반영할게요.</p>

    <h2>다녀왔나요?</h2>
    <div class="choices two" id="done">
      <button class="chip" data-v="1">다녀왔어요</button>
      <button class="chip" data-v="0">못 갔어요</button>
    </div>

    <div id="more"></div>
    <button class="btn" id="submit" disabled>기록하기</button>
  `);

  const more = document.getElementById('more');
  const submit = document.getElementById('submit');
  const valid = () => { submit.disabled = !(c.done === true ? c.mood !== null : c.done === false); };
  const single = (el, key, cast) => {
    if (el) el.onclick = e => {
      const m = e.target.closest('.chip'); if (!m) return;
      c[key] = cast(m.dataset.v);
      el.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === m));
      valid();
    };
  };

  document.getElementById('done').onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    c.done = b.dataset.v === '1';
    c.mood = null; c.barrier = null;
    document.querySelectorAll('#done .chip').forEach(x => x.classList.toggle('on', x === b));
    more.innerHTML = c.done ? `
      <h2>기분은 어땠어요?</h2>
      <div class="mood" id="mood">${MOODS.map((m, i) => `<button class="chip" data-v="${i}">${m}</button>`).join('')}</div>
      <h2>한 줄 기록 <span class="small">(선택 · 나만 볼 수 있어요)</span></h2>
      <textarea id="note" placeholder="예) 생각보다 조용해서 좋았다"></textarea>
    ` : `
      <h2>무엇이 어려웠나요? <span class="small">(선택)</span></h2>
      <div class="choices wrap" id="barrier">
        ${BARRIERS.map(b => `<button class="chip" data-v="${b}">${b}</button>`).join('')}
      </div>
    `;
    single(document.getElementById('mood'), 'mood', Number);
    single(document.getElementById('barrier'), 'barrier', v => v);
    valid();
  };

  submit.onclick = () => {
    const note = document.getElementById('note');
    c.text = note ? note.value : '';
    if (needsCrisisCheck(c.text)) { confirmCrisis(() => finishCheckin(a, c)); return; }
    finishCheckin(a, c);
  };
};

function finishCheckin(a, c) {
  const lv = a.energy || 1;
  let next, msg;
  if (c.done && c.mood >= 2) {
    next = Math.min(3, lv + 1);
    msg = next > lv
      ? `잘 해냈어요! 다음엔 에너지 <b>${ENERGY[next].label}</b> 단계 처방을 한번 시도해볼까요?`
      : '잘 해냈어요! 지금 리듬을 유지해봐요.';
  } else if (c.done) {
    next = lv;
    msg = '다녀온 것만으로도 충분해요. 다음에도 비슷한 강도로 해볼게요.';
  } else {
    next = Math.max(1, lv - 1);
    msg = '괜찮아요. 다음엔 조금 더 작고 가까운 처방으로 시작해요.';
    if (c.barrier === '혼자 가기 어색했어요') msg += '<br>혼자서도 편한 곳 위주로 골라볼게요.';
    if (c.barrier === '너무 멀었어요') msg += '<br>"학교 근처" 처방부터 시작해도 좋아요.';
    if (c.barrier === '문이 닫혀 있었어요') {
      store.reports[a.id] = new Date().toISOString();
      msg += '<br>알려줘서 고마워요. 정보 확인 목록에 올렸어요.';
    }
  }

  store.history.push({ id: a.id, name: a.name, energy: lv, purpose: a.purpose, at: a.at, done: c.done, mood: c.mood, barrier: c.barrier, note: c.text, checkedAt: new Date().toISOString() });
  store.active = null;
  store.nextEnergy = next;
  save();
  form = { ...EMPTY_FORM(), purpose: form.purpose, area: form.area, interests: form.interests };

  if (needsReferral()) return go('referral', lv);

  render(`
    <h1>기록했어요</h1>
    <div class="card"><p>${msg}</p></div>
    <button class="btn" data-go="input">다음 처방 받기</button>
    <button class="btn ghost" data-go="home">처음으로</button>
  `);
}

// ⑥ 회송 규칙: 기분 😣/😕 2회 연속, 또는 '못 갔어요' 3회 연속
function needsReferral() {
  const h = store.history;
  const last2 = h.slice(-2);
  const last3 = h.slice(-3);
  const lowMood = last2.length === 2 && last2.every(x => x.done && x.mood <= 1);
  const missed = last3.length === 3 && last3.every(x => !x.done);
  return lowMood || missed;
}

SCREENS.referral = function referral(lv) {
  render(`
    <h1>혼자 애쓰지 않아도 돼요</h1>
    <div class="card">
      <p>최근 처방이 조금 버거웠던 것 같아요. 처방을 바꾸는 것도 좋지만, 상담 선생님과 한번 이야기해보면 어때요?</p>
    </div>
    <button class="btn" data-go="crisis" data-arg="contacts">상담센터 연락처 보기</button>
    ${store.code ? `<button class="btn ghost" data-go="report">상담 선생님께 보여줄 기록 만들기</button>` : ''}
    <button class="btn ghost" id="lighter">처방을 더 가볍게 바꿔볼게요</button>
  `);
  document.getElementById('lighter').onclick = () => {
    const base = Number(lv) || store.nextEnergy || 1;
    store.nextEnergy = Math.max(1, base - 1);
    form.energy = store.nextEnergy;
    save();
    go('input');
  };
};

// ⑤ 상담 선생님께 보여주기 (전송 없음, 학생이 직접 화면을 보여주는 방식)
SCREENS.report = function report() {
  const c = codeInfo();
  const pr = codeProgress();
  const since = pr ? new Date(pr.start).getTime() : 0;
  const hist = store.history.filter(h => new Date(h.at).getTime() >= since);
  const done = hist.filter(h => h.done);

  const barriers = {};
  hist.filter(h => !h.done && h.barrier).forEach(h => { barriers[h.barrier] = (barriers[h.barrier] || 0) + 1; });
  const places = {};
  done.forEach(h => { places[h.name] = (places[h.name] || 0) + 1; });

  render(`
    <h1>상담 때 보여줄 기록</h1>
    <div class="banner">이 화면은 상담 시간에 선생님께 직접 보여주는 용도예요. 어디에도 전송되지 않아요.</div>

    <div class="card">
      <div class="rx-head"><span class="rx-no">처방 요약</span>${demoTag}</div>
      ${c ? `
        <div class="kv"><b>처방 기관</b><span>${c.org}</span></div>
        <div class="kv"><b>처방 목적</b><span>${PURPOSES[c.purpose].label}</span></div>
        <div class="kv"><b>기간</b><span>${fmtDate(pr.start)}~${fmtDate(pr.end)} (${c.weeks}주)</span></div>
        <div class="kv"><b>참여</b><span><b class="em">${pr.goal}회 중 ${pr.done}회 참여</b></span></div>
        ${progressBar(pr.done, pr.goal)}` : `<p class="small">처방 코드 없이 사용한 기록이에요.</p>`}
    </div>

    <div class="card">
      <div class="rx-no">기분 변화</div>
      ${done.length ? `
        <div class="moodbars">
          ${done.map(h => `<div><span class="mb" style="height:${(h.mood + 1) * 12}px"></span><span>${MOODS[h.mood]}</span><span class="small">${fmtDate(h.checkedAt || h.at)}</span></div>`).join('')}
        </div>` : '<p class="small">아직 체크인 기록이 없어요.</p>'}
    </div>

    <div class="card">
      <div class="rx-no">자주 겪은 어려움</div>
      ${Object.keys(barriers).length ? `<ul class="history">${Object.entries(barriers).sort((a, b) => b[1] - a[1]).map(([b, n]) => `<li><span>${b}</span><span>${n}회</span></li>`).join('')}</ul>`
        : '<p class="small">기록된 어려움이 없어요.</p>'}
    </div>

    <div class="card">
      <div class="rx-no">다녀온 곳</div>
      ${Object.keys(places).length ? `<ul class="history">${Object.entries(places).map(([p, n]) => `<li><span>${p}</span><span>${n}회</span></li>`).join('')}</ul>`
        : '<p class="small">아직 다녀온 곳이 없어요.</p>'}
    </div>

    <p class="small" style="margin-top:12px">개인 메모(한 줄 기록)는 포함되지 않아요.<br>상담센터 연동(선생님이 직접 확인)은 정식 서비스에서 제공 예정이에요.</p>
    <button class="btn ghost" data-go="home">처음으로</button>
  `);
};

// 위기·상담 연결 (상단 버튼으로 항상 접근 가능)
SCREENS.crisis = function crisis(reason) {
  const title = { detected: '혼자 견디지 않아도 돼요', contacts: '이야기할 수 있는 곳' }[reason] || '지금 힘들어요';
  const lead = {
    detected: '지금 바로 이야기할 수 있는 곳이에요. 어떤 이야기든 괜찮아요.',
    contacts: '상담 선생님과 이야기하고 싶다면 학생상담센터로 연락해 보세요.',
  }[reason] || '지금 바로 이야기할 수 있는 곳이에요.';
  const list = reason === 'contacts'
    ? [...CRISIS_CONTACTS].sort((a, b) => (b.name.includes('학생상담센터') - a.name.includes('학생상담센터')))
    : CRISIS_CONTACTS;

  render(`
    <h1>${title}</h1>
    <p class="lead">${lead}</p>

    ${reason === 'contacts' ? '' : `
    <div class="card" style="border-color:var(--warm)">
      <div class="crisis-card">
        <div><div class="name">긴급 상황</div><div class="small">생명이 위험하다면 바로</div></div>
        <a class="call" href="tel:119">119</a>
      </div>
    </div>`}

    ${list.map(c => `
      <div class="card">
        <div class="crisis-card">
          <div><div class="name">${c.name}</div><div class="small">${c.desc}</div></div>
          ${c.tel ? `<a class="call" href="tel:${c.tel}">${c.tel}</a>` : `<span class="call off">번호 등록 예정</span>`}
        </div>
      </div>`).join('')}

    <p class="small" style="margin-top:16px">Re:link는 치료를 대체하지 않아요. 상담이 필요하면 학교 학생상담센터를 이용해 주세요.</p>
    <button class="btn ghost" data-go="home">처음으로</button>
  `);
};

// 체험용 예시 기록 (심사위원이 처음 열어도 기록·요약 화면을 바로 볼 수 있게)
function loadDemo() {
  const now = Date.now();
  const ago = d => new Date(now - d * DAY).toISOString();
  store = EMPTY_STORE();
  store.demo = true;
  store.code = { code: 'DS2026', startedAt: ago(13) };
  const rec = (d, id, energy, done, mood, barrier) => {
    const p = findItem(id);
    return { id, name: p.name, energy, purpose: 'connect', at: ago(d), checkedAt: ago(d - 0.2), done, mood, barrier, note: '' };
  };
  store.history = [
    rec(12, 'ssangmunlib', 1, true, 1, null),
    rec(10, 'ssangmunpark', 1, false, null, '혼자 가기 어색했어요'),
    rec(8, 'ssangmunpark', 1, true, 2, null),
    rec(5, 'dooly', 2, true, 3, null),
    rec(2, 'peace', 2, true, 4, null),
  ];
  store.nextEnergy = 3;
  form = { ...EMPTY_FORM(), purpose: 'connect' };
  save();
}

go('home');
