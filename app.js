// Re:link 앱 로직
// 구성: ① 입력(버튼 + 자유 입력 태그 추출) → ② 규칙 기반 매칭 엔진 → 처방전
//       ③ 위기 감지(규칙 기반, AI 없음) ④ 참여 체크인 → 다음 에너지 단계 조정

const $app = document.getElementById('app');

// ── 저장소 (로그인 없이 이 기기에만 저장) ──
const STORE_KEY = 'relink-v1';
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}
let store = Object.assign({ history: [], active: null, nextEnergy: null }, load());

// 현재 입력 상태
let form = { energy: null, area: null, interests: [], text: '' };
let lastResult = [];

// ── ③ 위기 감지 ──
function hasCrisisWord(text) {
  const t = (text || '').replace(/\s+/g, ' ');
  return CRISIS_KEYWORDS.some(k => t.includes(k));
}

// ── ① 자유 입력 → 태그 추출 (규칙 기반) ──
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
  if (place.inApp) return { known: true, open: true, label: '지금 바로 가능' };
  if (place.hours === 'always') return { known: true, open: true, label: '상시 이용 가능' };
  if (!place.hours) return { known: false, open: null, label: '운영시간 확인 필요' };
  const today = place.hours[now.getDay()];
  if (!today) return { known: true, open: false, closedToday: true, label: '오늘 휴무' };
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < today[0]) return { known: true, open: false, label: `${today[0]}시에 열어요` };
  if (h >= today[1]) return { known: true, open: false, closedToday: true, label: '오늘 운영 종료' };
  if (h + place.minutes / 60 > today[1]) return { known: true, open: true, label: `${today[1]}시 마감 · 서두르면 가능` };
  return { known: true, open: true, label: `지금 운영 중 · ${today[1]}시까지` };
}

// ── ② 매칭 엔진 ──
// DB에 있는 장소만 고른다. 점수 = 에너지 적합도 + 관심사 일치 + 운영 여부
function match({ energy, area, interests }) {
  const scored = PLACES
    .filter(p => p.area === area)
    .filter(p => p.energy[0] <= energy) // 지금 에너지보다 힘든 활동은 추천하지 않는다
    .map(p => {
      let score = 0;
      const [min, max] = p.energy;
      if (energy >= min && energy <= max) score += 4;
      else score += Math.max(0, 2 - (energy - max)); // 한 단계 가벼운 활동은 허용
      const hits = p.interests.filter(i => interests.includes(i));
      score += hits.length * 3;
      if (energy === 3 && p.social) score += 2; // 에너지가 높으면 사람 만남 포함 활동 우대
      const st = openStatus(p);
      if (st.closedToday) score -= 6;
      else if (st.open) score += 1;
      return { place: p, score, hits, status: st };
    })
    .sort((a, b) => b.score - a.score);

  // 같은 관심사만 3개 나오지 않도록 다양성 확보
  const picked = [];
  const usedMain = new Set();
  for (const s of scored) {
    if (picked.length >= 3) break;
    const main = s.place.interests[0];
    if (usedMain.has(main) && scored.length > 3) continue;
    picked.push(s); usedMain.add(main);
  }
  for (const s of scored) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.map(s => ({ ...s, reason: makeReason(s, energy) }));
}

function makeReason(s, energy) {
  const parts = [];
  parts.push(`에너지 ${ENERGY[energy].label}: ${ENERGY[energy].rule}.`);
  if (s.hits.length) parts.push(`고른 관심사(${s.hits.map(h => INTERESTS[h]).join(', ')})에 맞아요.`);
  parts.push(`약 ${s.place.minutes}분이면 충분해요.`);
  return parts.join(' ');
}

// ── 화면 그리기 ──
function render(html) {
  $app.innerHTML = `<section class="screen">${html}</section>`;
  window.scrollTo(0, 0);
}

function go(screen, arg) {
  ({ home, input, result, guide, checkin, crisis }[screen] || home)(arg);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-go]');
  if (el) go(el.dataset.go, el.dataset.arg);
});

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
const MOODS = ['😣', '😕', '😐', '🙂', '😊'];

// 홈
function home() {
  const a = store.active;
  const done = store.history.filter(h => h.done).length;
  render(`
    <h1>오늘 나에게 맞는<br>작은 처방 하나</h1>
    <p class="lead">약 대신, 동네의 공간과 활동으로.<br>지금 에너지에 맞춰 30분~1시간짜리 처방을 골라드려요.</p>

    ${a ? `
      <div class="card accent">
        <div class="small">진행 중인 처방 · ${fmtDate(a.at)}</div>
        <div class="rx-name" style="margin:4px 0 0">${a.name}</div>
        <button class="btn light" data-go="checkin">다녀왔어요? 체크인하기</button>
      </div>` : ''}

    <button class="btn" data-go="input">${a ? '새 처방 받기' : '처방 받기'}</button>

    <h2>나의 기록</h2>
    <div class="card">
      ${store.history.length ? `
        <p class="small">지금까지 처방 ${store.history.length}개 중 <b style="color:var(--accent)">${done}개</b> 참여했어요.</p>
        <ul class="history">
          ${store.history.slice(-5).reverse().map(h => `
            <li><span>${fmtDate(h.at)} · ${h.name}</span><span>${h.done ? MOODS[h.mood] : '<span class="small">못 갔어요</span>'}</span></li>`).join('')}
        </ul>` : `<p class="small">아직 기록이 없어요. 첫 처방을 받아보세요.</p>`}
    </div>

    <h2>Re:link는 이렇게 일해요</h2>
    <div class="card">
      <ol class="steps">
        <li>오늘의 에너지, 생활권, 관심사를 알려주세요.</li>
        <li>검증된 지역 자원 목록에서만 처방을 골라요.</li>
        <li>다녀온 뒤 체크인하면 다음 처방의 강도를 조금씩 조정해요.</li>
      </ol>
    </div>
  `);
}

// 입력
function input() {
  if (!form.energy && store.nextEnergy) form.energy = store.nextEnergy;
  const hint = store.nextEnergy
    ? `<div class="banner">지난 체크인을 바탕으로 에너지 <b>${ENERGY[store.nextEnergy].label}</b>를 먼저 골라뒀어요. 오늘 상태에 맞게 바꿔도 돼요.</div>`
    : '';

  render(`
    <h1>요즘 어때요?</h1>
    <p class="lead">한 줄로 적어도 되고, 아래 버튼만 골라도 돼요.</p>
    ${hint}

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

    <h2>끌리는 것 <span class="small">(여러 개 가능)</span></h2>
    <div class="choices wrap" id="interests">
      ${Object.entries(INTERESTS).map(([k, l]) => `<button class="chip" data-v="${k}">${l}</button>`).join('')}
    </div>

    <button class="btn" id="go">처방전 받기</button>
  `);

  const sync = () => {
    document.querySelectorAll('#energy .chip').forEach(c => c.classList.toggle('on', Number(c.dataset.v) === form.energy));
    document.querySelectorAll('#area .chip').forEach(c => c.classList.toggle('on', c.dataset.v === form.area));
    document.querySelectorAll('#interests .chip').forEach(c => c.classList.toggle('on', form.interests.includes(c.dataset.v)));
    document.getElementById('go').disabled = !(form.energy && form.area);
  };

  document.getElementById('energy').onclick = e => { const c = e.target.closest('.chip'); if (c) { form.energy = Number(c.dataset.v); sync(); } };
  document.getElementById('area').onclick = e => { const c = e.target.closest('.chip'); if (c) { form.area = c.dataset.v; sync(); } };
  document.getElementById('interests').onclick = e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const v = c.dataset.v;
    form.interests = form.interests.includes(v) ? form.interests.filter(i => i !== v) : [...form.interests, v];
    sync();
  };

  let timer;
  document.getElementById('free').oninput = e => {
    form.text = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (hasCrisisWord(form.text)) { crisis('detected'); return; }
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
    if (hasCrisisWord(form.text)) { crisis('detected'); return; }
    lastResult = match(form);
    result();
  };
  sync();
}

// 처방전
function result() {
  const f = form;
  const tags = [
    `<span class="tag">${ENERGY[f.energy].emoji} 에너지 ${ENERGY[f.energy].label}</span>`,
    `<span class="tag">${AREAS[f.area].label}</span>`,
    ...f.interests.map(i => `<span class="tag">${INTERESTS[i]}</span>`),
  ].join('');

  render(`
    <h1>오늘의 처방전</h1>
    <div class="tagline">${tags}</div>

    ${lastResult.length ? lastResult.map((r, i) => {
      const p = r.place;
      return `
      <div class="card">
        <div class="rx-head">
          <span class="rx-no">처방 ${String(i + 1).padStart(2, '0')}</span>
          <span class="tag gray">${p.inApp ? '앱에서 바로' : '공공 문화자원 정보'}</span>
        </div>
        <div class="rx-name">${p.name}</div>
        <div class="tagline">${p.interests.map(x => `<span class="tag">${INTERESTS[x]}</span>`).join('')}${p.social ? '<span class="tag warm">사람 만남</span>' : ''}</div>
        <div class="rx-meta">
          <div><b>소요</b>약 ${p.minutes}분</div>
          ${p.inApp ? '' : `<div><b>운영</b>${p.hoursText}</div>`}
          <div><b>지금</b><span class="${r.status.open === false ? 'closed' : r.status.open ? 'open' : ''}">${r.status.label}</span></div>
        </div>
        ${p.note ? `<div class="note">※ ${p.note}</div>` : ''}
        <div class="rx-why"><b>왜 이 처방?</b> ${p.why}<br><span class="small">${r.reason}</span></div>
        <div class="rx-actions">
          ${p.inApp
            ? `<button class="btn ghost" data-go="guide" data-arg="${p.id}">방법 보기</button>`
            : `<a class="btn ghost" href="https://map.naver.com/p/search/${encodeURIComponent(p.name.replace(/\s*\(.*\)/, ''))}" target="_blank" rel="noopener">지도 보기</a>`}
          <button class="btn" data-pick="${p.id}">이걸로 할게요</button>
        </div>
      </div>`;
    }).join('') : `<div class="card"><p>조건에 맞는 처방을 찾지 못했어요. 생활권이나 에너지를 바꿔볼까요?</p></div>`}

    <button class="btn ghost" data-go="input">조건 바꾸기</button>
  `);

  document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    const p = PLACES.find(x => x.id === b.dataset.pick);
    store.active = { id: p.id, name: p.name, energy: form.energy, at: new Date().toISOString() };
    save(store);
    if (p.inApp) guide(p.id); else home();
  });
}

// 앱 안 처방 가이드
function guide(id) {
  const p = PLACES.find(x => x.id === id);
  if (!p) return home();
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
    store.active = { id: p.id, name: p.name, energy: form.energy || p.energy[0], at: new Date().toISOString() };
    save(store);
    guide(p.id);
  };
}

// ④ 참여 체크인 → 다음 처방 단계 조정 (행동활성화: 작게 성공하고 한 단계씩 올리기)
function checkin() {
  const a = store.active;
  if (!a) return home();
  const c = { done: null, mood: null, barrier: null, text: '' };

  render(`
    <h1>${a.name}</h1>
    <p class="lead">어땠는지 짧게 알려주세요. 다음 처방에 반영할게요.</p>

    <h2>다녀왔나요?</h2>
    <div class="choices" style="grid-template-columns:1fr 1fr" id="done">
      <button class="chip" data-v="1">다녀왔어요</button>
      <button class="chip" data-v="0">못 갔어요</button>
    </div>

    <div id="more"></div>
    <button class="btn" id="submit" disabled>기록하기</button>
  `);

  const more = document.getElementById('more');
  const submit = document.getElementById('submit');
  const valid = () => { submit.disabled = !(c.done === true ? c.mood !== null : c.done === false); };

  document.getElementById('done').onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    c.done = b.dataset.v === '1';
    document.querySelectorAll('#done .chip').forEach(x => x.classList.toggle('on', x === b));
    more.innerHTML = c.done ? `
      <h2>기분은 어땠어요?</h2>
      <div class="mood" id="mood">${MOODS.map((m, i) => `<button class="chip" data-v="${i}">${m}</button>`).join('')}</div>
      <h2>한 줄 기록 <span class="small">(선택)</span></h2>
      <textarea id="note" placeholder="예) 생각보다 조용해서 좋았다"></textarea>
    ` : `
      <h2>무엇이 어려웠나요? <span class="small">(선택)</span></h2>
      <div class="choices wrap" id="barrier">
        ${['시간이 없었어요', '너무 멀었어요', '기운이 없었어요', '혼자 가기 어색했어요', '문이 닫혀 있었어요'].map(b => `<button class="chip" data-v="${b}">${b}</button>`).join('')}
      </div>
    `;
    const mood = document.getElementById('mood');
    if (mood) mood.onclick = e => {
      const m = e.target.closest('.chip'); if (!m) return;
      c.mood = Number(m.dataset.v);
      mood.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === m));
      valid();
    };
    const barrier = document.getElementById('barrier');
    if (barrier) barrier.onclick = e => {
      const m = e.target.closest('.chip'); if (!m) return;
      c.barrier = m.dataset.v;
      barrier.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === m));
    };
    valid();
  };

  submit.onclick = () => {
    const note = document.getElementById('note');
    c.text = note ? note.value : '';
    if (hasCrisisWord(c.text)) { crisis('detected'); return; }

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
      if (c.barrier === '너무 멀었어요') msg += '<br>"집 안" 처방부터 시작해도 좋아요.';
    }

    store.history.push({ ...a, done: c.done, mood: c.mood, barrier: c.barrier, note: c.text, checkedAt: new Date().toISOString() });
    store.active = null;
    store.nextEnergy = next;
    save(store);
    form = { energy: null, area: form.area, interests: form.interests, text: '' };

    render(`
      <h1>기록했어요</h1>
      <div class="card"><p>${msg}</p></div>
      <button class="btn" data-go="input">다음 처방 받기</button>
      <button class="btn ghost" data-go="home">처음으로</button>
    `);
  };
}

// 위기 연결 (항상 접근 가능)
function crisis(reason) {
  render(`
    <h1>${reason === 'detected' ? '혼자 견디지 않아도 돼요' : '지금 힘들어요'}</h1>
    <p class="lead">${reason === 'detected'
      ? '적어준 말이 마음에 걸려서, 처방 대신 지금 바로 이야기할 수 있는 곳을 먼저 보여드릴게요.'
      : '지금 바로 이야기할 수 있는 곳이에요. 전화가 부담되면 문자 상담도 있어요.'}</p>

    <div class="card" style="border-color:var(--warm)">
      <div class="crisis-card">
        <div><div class="name">긴급 상황</div><div class="small">생명이 위험하다면 바로</div></div>
        <a class="call" href="tel:119">119</a>
      </div>
    </div>

    ${CRISIS_CONTACTS.map(c => `
      <div class="card">
        <div class="crisis-card">
          <div><div class="name">${c.name}</div><div class="small">${c.desc}</div></div>
          ${c.tel ? `<a class="call" href="tel:${c.tel}">${c.tel}</a>` : `<span class="call off">번호 등록 예정</span>`}
        </div>
      </div>`).join('')}

    <p class="small" style="margin-top:16px">Re:link는 치료를 대체하지 않아요. 상담이 필요하면 학교 학생상담센터를 이용해 주세요.</p>
    <button class="btn ghost" data-go="home">처음으로</button>
  `);
}

home();
