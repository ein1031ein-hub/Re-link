// Re:link 데이터 파일
// 장소 정보는 2026.10.15 구글 지도 운영시간·최근 후기 기준으로 확인한 것.
// 배포 전 다시 확인하고, 바뀐 내용은 이 파일만 고치면 앱 전체에 반영된다.

// 에너지 단계: 1 = 낮음, 2 = 보통, 3 = 높음
// 관심사 키: create(창작) nature(자연) move(움직임) rest(쉼) learn(배움) social(사람·모임)
// 생활권 키: school(학교 근처·쌍문동) home(조금 멀리·도봉동) online(오늘은 집에서)
// hours: 요일별 운영시간. 0=일 1=월 ... 6=토. 11.5 = 11:30. 없으면 null(방문 전 확인 필요)
// daylight: true 면 야외 활동이라 18:00 이후·06:00 이전에는 추천하지 않는다
// travel: 덕성여대 기준 이동 시간 (예: '버스 9분'). null 이면 '확인 중'으로 표시

const INTERESTS = {
  create: '창작',
  nature: '자연',
  move: '움직임',
  rest: '쉼',
  learn: '배움',
  social: '사람·모임',
};

// 처방 목적 (상담센터가 정하거나 학생이 고른다)
const PURPOSES = {
  connect: { label: '사람과 연결', reason: '사람들 사이에 자연스럽게 섞일 수 있는 활동이에요.' },
  rhythm: { label: '생활에 리듬', reason: '정해진 시간에 다녀오면 하루에 리듬이 생겨요.' },
  care: { label: '나를 돌보기', reason: '나에게 쉬어갈 틈을 주는 활동이에요.' },
  out: { label: '밖으로 나가기', reason: '문밖으로 한 걸음 나가는 것 자체가 처방이에요.' },
};

const AREAS = {
  school: { label: '학교 근처', sub: '쌍문동' },
  home: { label: '조금 멀리', sub: '도봉동' },
  online: { label: '오늘은 집에서', sub: '준비 단계' },
};

// 도봉동 장소는 이동 시간을 하나로 처리 (덕성여대 → 도봉산역 방면 버스). 분 단위 숫자, 모르면 null
const HOME_TRAVEL_MIN = null;

const ENERGY = {
  1: { label: '낮음', emoji: '🌙', rule: '혼자, 조용히, 짧게' },
  2: { label: '보통', emoji: '⛅', rule: '가볍게, 부담 없이' },
  3: { label: '높음', emoji: '☀️', rule: '몸을 쓰거나 사람을 만나기' },
};

// 상담센터 처방 코드 (시연용. 실제 협약 아님)
const CODES = {
  DS2026: {
    org: '덕성여대 학생상담센터 (시연용 시나리오)',
    purpose: 'connect',
    weeks: 4,
    perWeek: 2,
  },
};

const TUE_SUN = (open, close) => ({ 0: [open, close], 2: [open, close], 3: [open, close], 4: [open, close], 5: [open, close], 6: [open, close] });
const SPORTS_CENTER_HOURS = { 0: [9, 18], 1: [6, 22], 2: [6, 22], 3: [6, 22], 4: [6, 22], 5: [6, 22], 6: [6, 18] };

const PLACES = [
  // ── 쌍문동 (학교 생활권) ──
  {
    id: 'dooly', area: 'school', name: '둘리뮤지엄', interests: ['create', 'learn'],
    energy: [2, 2], minutes: 90, travel: null, hours: TUE_SUN(10, 18), hoursText: '화~일 10:00~18:00 · 월 휴관',
    why: '보기만 해도 되는 전시라서 부담 없이 기분을 바꿀 수 있어요.',
  },
  {
    id: 'hamsukhon', area: 'school', name: '함석헌기념관', interests: ['learn'],
    energy: [1, 2], minutes: 60, travel: null, hours: TUE_SUN(9, 18), hoursText: '화~일 09:00~18:00 · 월 휴관',
    why: '조용한 공간에서 천천히 둘러볼 수 있어요. 주민참여 프로그램도 열려요.',
  },
  {
    id: 'sseulmo', area: 'school', name: '쓸모의 발견 (독립서점)', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40, travel: null, hours: { 2: [15, 20], 3: [15, 20], 4: [15, 20], 5: [15, 20] },
    hoursText: '화~금 15:00~20:00 · 주말·월 휴무',
    why: '작은 서점에서 책 한 권 넘겨보는 것만으로도 충분한 하루예요.',
  },
  {
    id: 'youngplants', area: 'school', name: '영플랜츠앤갤러리영', interests: ['rest', 'nature'],
    energy: [1, 1], minutes: 45, travel: null, hours: null, hoursText: '방문 전 운영시간 확인',
    why: '수초 어항을 보며 차를 마시는 곳. 말없이 머물러도 괜찮아요.',
  },
  {
    id: 'ssangmunlib', area: 'school', name: '쌍문채움도서관', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40, travel: null,
    hours: { 0: [9, 17], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [9, 17] },
    hoursText: '화~금 09:00~20:00 · 주말 ~17:00 · 월 휴관',
    why: '조용하고 머물기 편한 공공 공간이에요. 근처 작은도서관도 좋아요.',
  },
  {
    id: 'ssangmunpark', area: 'school', name: '쌍문근린공원', interests: ['nature'],
    energy: [1, 2], minutes: 30, travel: null, hours: 'always', daylight: true, hoursText: '상시 개방 (공원)',
    why: '나무 사이를 30분 걷는 것만으로도 머리가 가벼워져요.',
  },
  // TODO 쌍문동 에너지 높음(3) 장소 추가 자리
  // 학교 근처에서 에너지 높음을 고르면 지금은 조용한 곳 위주로 나온다.
  // 운동·모임 장소를 확인하면 아래 형식으로 추가:
  // { id: '', area: 'school', name: '', interests: ['move'], energy: [3, 3], minutes: 60, travel: null,
  //   social: true, hours: null, hoursText: '', why: '' },

  // ── 도봉동 (조금 멀리) ──
  {
    id: 'peace', area: 'home', name: '평화문화진지', interests: ['create', 'learn'],
    energy: [2, 2], minutes: 90, hours: TUE_SUN(9, 18), hoursText: '화~일 09:00~18:00 · 월 휴관 · 전시 무료',
    why: '무료 전시와 공예 프로그램이 있어요. 구경만 해도, 직접 만들어도 좋아요.',
  },
  {
    id: 'wood', area: 'home', name: '도봉구 희망목재문화체험장', interests: ['create'],
    energy: [3, 3], minutes: 120, social: true, hours: null,
    hoursText: '서울시공공서비스예약으로 예약',
    why: '손으로 무언가를 완성하는 경험은 "해냈다"는 감각을 돌려줘요.',
    note: '‘도봉산목재문화체험장’으로 이름이 바뀌었을 수 있음',
  },
  {
    id: 'dobongcoffee', area: 'home', name: '도봉산커피', interests: ['rest', 'nature'],
    energy: [1, 1], minutes: 40,
    hours: { 0: [9, 21], 1: [10, 22], 2: [10, 22], 3: [10, 22], 4: [10, 22], 5: [10, 22], 6: [10, 22] },
    hoursText: '월~토 10:00~22:00 · 일 09:00~21:00',
    why: '등산로 입구에서 산을 바라보며 쉬어갈 수 있어요.',
  },
  {
    id: 'dada', area: 'home', name: '전통찻집 다다카페 (구 인아찻집)', interests: ['rest'],
    energy: [1, 1], minutes: 50,
    hours: { 0: [12, 22], 1: [11.5, 22], 2: [11.5, 22], 3: [11.5, 22], 4: [11.5, 22], 5: [11.5, 22], 6: [12, 22] },
    hoursText: '평일 11:30~22:00 · 주말 12:00~22:00',
    why: '따뜻한 차 한 잔과 함께 천천히 쉬어가는 시간이에요.',
  },
  {
    id: 'changpo', area: 'home', name: '서울창포원', interests: ['nature'],
    energy: [1, 2], minutes: 40,
    hours: { 0: [5, 21], 1: [5, 21], 2: [5, 21], 3: [5, 21], 4: [5, 21], 5: [5, 21], 6: [5, 21] },
    hoursText: '매일 05:00~21:00',
    why: '넓은 정원을 천천히 걸으며 계절을 느낄 수 있어요.',
  },
  {
    id: 'musugol', area: 'home', name: '무수골 산책길', interests: ['nature', 'move'],
    energy: [2, 3], minutes: 60, hours: 'always', daylight: true, hoursText: '상시 (산책로)',
    why: '계곡 옆길을 따라 걷는 한 시간짜리 코스예요.',
  },
  {
    id: 'dobongsan', area: 'home', name: '도봉산 짧은 등산', interests: ['nature', 'move'],
    energy: [3, 3], minutes: 120, hours: 'always', daylight: true, hoursText: '일몰 전 하산 권장',
    why: '몸을 크게 움직이고 정상에서 바람을 맞는 경험이에요.',
  },
  {
    id: 'pool', area: 'home', name: '도봉동실내스포츠센터 (수영)', interests: ['move'],
    energy: [3, 3], minutes: 60, hours: SPORTS_CENTER_HOURS,
    hoursText: '평일 06:00~22:00 · 토 ~18:00 · 일 09:00~18:00',
    why: '물속에서는 생각이 조용해져요. 몸이 먼저 기분을 바꿔줘요.',
    note: '1·3·5주 일요일 휴관 · 자유수영 시간 별도 확인',
  },
  {
    id: 'gym', area: 'home', name: '도봉동실내스포츠센터 (운동 프로그램)', interests: ['move'],
    energy: [3, 3], minutes: 60, social: true, hours: SPORTS_CENTER_HOURS,
    hoursText: '평일 06:00~22:00 · 토 ~18:00 · 일 09:00~18:00',
    why: '정해진 시간의 운동 프로그램은 일상에 리듬을 만들어줘요.',
    note: '1·3·5주 일요일 휴관 · 자유수영 시간 별도 확인',
  },
  {
    id: 'musulib', area: 'home', name: '무수골도서관', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40, hours: { 1: [9, 18], 2: [9, 18], 3: [9, 18], 4: [9, 18], 5: [9, 18] },
    hoursText: '월~금 09:00~18:00 · 주말 휴관',
    why: '작고 조용한 도서관. 창가 자리에서 잠깐 쉬어가요.',
  },
  {
    id: 'miraclelib', area: 'home', name: '도봉기적의도서관', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40,
    hours: { 0: [9, 17], 1: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [9, 17] },
    hoursText: '월·수~금 09:00~20:00 · 주말 ~17:00 · 화 휴관',
    why: '편하게 머물 수 있는 공공 공간이에요.',
  },

  // ── 오늘은 집에서 (앱 안에서 바로 하는 준비 단계 처방) ──
  {
    id: 'msc', area: 'online', name: '자기연민 쉼 5분', interests: ['rest'],
    energy: [1, 2], minutes: 5, inApp: true,
    why: '힘든 순간 스스로에게 친구처럼 말을 건네는 연습이에요. (MSC 기반)',
    steps: [
      '가슴에 손을 얹고, 지금 힘든 마음을 알아차려요. "지금 많이 힘들구나."',
      '이런 마음은 누구에게나 찾아온다는 것을 떠올려요. "나만 그런 게 아니야."',
      '친한 친구에게 하듯 나에게 말해요. "오늘 하루 버틴 것만으로도 충분해."',
      '숨을 세 번 천천히 쉬고 마무리해요.',
    ],
  },
  {
    id: 'sky', area: 'online', name: '창밖 하늘 한 장', interests: ['nature', 'create'],
    energy: [1, 1], minutes: 5, inApp: true,
    why: '창문을 열고 바깥 공기를 느끼는, 가장 작은 자연 처방이에요.',
    steps: ['창문을 열어요.', '하늘을 1분 동안 바라봐요.', '마음에 드는 장면을 사진 한 장으로 남겨요.'],
  },
  {
    id: 'stretch', area: 'online', name: '10분 스트레칭', interests: ['move'],
    energy: [1, 2], minutes: 10, inApp: true,
    why: '몸이 풀리면 마음도 따라 풀려요. 누워서 해도 괜찮아요.',
    steps: ['목을 천천히 좌우로 돌려요.', '어깨를 위로 올렸다 툭 떨어뜨려요 (5번).', '양팔을 위로 쭉 뻗고 10초 버텨요.', '앉아서 다리를 펴고 발끝을 향해 숙여요.'],
  },
  {
    id: 'doodle', area: 'online', name: '15분 낙서', interests: ['create'],
    energy: [1, 2], minutes: 15, inApp: true,
    why: '잘 그릴 필요 없어요. 손을 움직이는 것 자체가 쉼이 돼요.',
    steps: ['종이와 펜을 하나 꺼내요.', '15분 타이머를 맞춰요.', '눈에 보이는 물건을 하나 골라 따라 그려요.'],
  },
  {
    id: 'lecture', area: 'online', name: '짧은 강연 한 편', interests: ['learn'],
    energy: [2, 2], minutes: 20, inApp: true,
    why: '평소 궁금했던 주제 하나를 20분만 들여다봐요.',
    steps: ['궁금했던 주제를 하나 떠올려요.', '20분 이내의 강연 영상을 하나 골라요.', '보고 나서 기억에 남는 문장을 하나 적어요.'],
  },
  {
    id: 'hometraining', area: 'online', name: '홈트 영상 20분 따라하기', interests: ['move'],
    energy: [2, 3], minutes: 20, inApp: true,
    why: '땀을 조금 흘리면 무기력이 한 걸음 물러나요.',
    steps: ['매트나 수건을 깔아요.', '20분 이내 홈트 영상을 하나 골라요.', '끝까지 못 해도 괜찮아요. 시작한 것만으로 성공이에요.'],
  },
  {
    id: 'message', area: 'online', name: '안부 메시지 한 통', interests: ['social'],
    energy: [2, 3], minutes: 5, inApp: true, social: true,
    why: '연결은 작게 시작해요. 답장이 오지 않아도 보낸 것으로 충분해요.',
    steps: ['요즘 생각나는 사람을 한 명 떠올려요.', '"요즘 잘 지내?" 한 줄이면 충분해요.', '보냈다면 오늘 처방은 완료예요.'],
  },
];

// 지역 프로그램 (일정이 있는 활동). 도봉문화재단 2026.10.15 기준 모집 공고.
// period: [시작, 마감] (그날 포함). 마감이 지나면 자동으로 숨겨진다.
// periodLabel: period 가 무슨 기간인지. 없으면 '접수'. 전시는 '전시'.
const DBFAC_APPLY = 'https://www.dbfac.or.kr/front/supportManageReq/supportManageListPage.do';
const PROGRAMS = [
  {
    id: 'prog-poem', type: 'program', name: "함석헌기념관 주민참여 '詩월의 문학'", place: '함석헌기념관 (쌍문동)',
    interests: ['social', 'learn'], social: true, energy: [2, 3], period: ['2026-10-17', '2026-10-24'],
    applyUrl: DBFAC_APPLY, why: '같은 관심사를 가진 동네 사람들과 시를 읽고 이야기하는 모임이에요.',
  },
  {
    id: 'prog-sseudam', type: 'program', name: '「도봉쓰담 읽고, 만들고, 잇다」', place: '도봉문화재단',
    interests: ['create', 'social'], social: true, energy: [2, 3], period: ['2026-11-19', '2026-11-28'],
    applyUrl: DBFAC_APPLY, why: '읽고 만드는 과정을 함께하며 자연스럽게 사람과 이어져요.',
  },
  {
    id: 'prog-exhibit', type: 'program', name: "「도봉쓰담」 전시 '도봉을 쓰다, 도봉을 담다'", place: '도봉문화재단',
    interests: ['create'], energy: [1, 2], period: ['2026-11-01', '2026-11-30'], periodLabel: '전시',
    applyUrl: DBFAC_APPLY, why: '우리 동네 이야기를 담은 전시. 천천히 구경만 해도 좋아요.',
  },
  {
    id: 'prog-chilling', type: 'program', name: '칠링페스타 (공연)', place: '도봉문화재단',
    interests: ['create'], energy: [2, 3], period: ['2026-11-03', '2026-11-15'],
    applyUrl: DBFAC_APPLY, why: '공연장에서 여러 사람과 같은 시간을 보내는 경험이에요.',
  },
];

// 위기 연결처. 번호는 배포 전 반드시 재확인할 것.
// tel 이 null 인 항목은 화면에 보이지 않는다. 번호를 채우면 코드 수정 없이 자동으로 표시된다.
// counseling: true 는 회송 화면의 "상담센터 연락처 보기" 대상 (번호가 있을 때만)
const CRISIS_CONTACTS = [
  { name: '자살예방상담전화', desc: '24시간 · 전국', tel: '109' },
  { name: '정신건강위기상담전화', desc: '24시간 · 전국', tel: '1577-0199' }, // 배포 전 재확인
  { name: '덕성여대 학생상담센터(덕우당)', desc: '재학생 상담', tel: '02-901-8506', counseling: true },
  { name: '도봉구정신건강복지센터', desc: '쌍문동 소재', tel: null },
];

// 위기 감지 키워드 (규칙 기반. AI를 거치지 않는다)
// 비교할 때 입력과 키워드 모두 공백을 지우고 비교한다 ('죽 고 싶 다'도 감지).
// 일상 표현과 겹치는 단어(손목, 목숨, 극단적)는 오탐이 많아서 뺐다.
// 오탐("배고파 죽을래" 등)은 바로 넘기지 않고 한 번 묻는 흐름이라 허용한다.
// 한계: "다 끝났으면", "내일이 안 왔으면"처럼 돌려 말하는 표현은 감지하지 못한다.
const CRISIS_KEYWORDS = [
  '죽고 싶', '죽고싶', '자살', '자해', '사라지고 싶', '사라지고싶', '없어지고 싶', '없어지고싶',
  '끝내고 싶', '끝내고싶', '살기 싫', '살기싫', '죽어버리', '뛰어내리',
  '유서', '죽을래', '죽는 게 나', '죽는게 나',
  '살고싶지않', '그만살고', '사라졌으면', '없어졌으면', '죽고시퍼', '죽고싶어', '살아서뭐해', '살이유가없',
];

// 자유 입력에서 태그를 뽑는 규칙 (규칙 기반 키워드 추출)
// 한 글자 단어('책', '산')는 다른 단어 속에 섞여 오탐이 나서 쓰지 않는다.
const TAG_RULES = {
  energy: {
    1: ['피곤', '지쳐', '지쳤', '지친', '무기력', '힘이 없', '기운 없', '기운이 없', '아무것도 하기 싫', '우울', '귀찮', '번아웃', '못 일어', '잠만'],
    3: ['신나', '활기', '에너지 넘', '뭐라도 하고 싶', '움직이고 싶', '밖에 나가고 싶', '사람 만나고 싶', '컨디션 좋'],
  },
  interests: {
    create: ['그림', '그리기', '만들', '공예', '창작', '글쓰', '사진', '전시', '예술', '뜨개'],
    nature: ['산책', '자연', '나무', '공원', '하늘', '꽃', '숲', '등산', '산에', '뒷산'],
    move: ['운동', '수영', '등산', '땀', '몸을', '스트레칭', '요가', '헬스'],
    rest: ['쉬고', '조용', '혼자', '차 한', '카페', '멍', '쉼'],
    learn: ['책 읽', '책을', '독서', '배우', '공부', '강연', '궁금', '읽고'],
    social: ['사람', '친구', '모임', '같이', '함께', '대화', '외로'],
  },
  area: {
    online: ['집에만', '나가기 싫', '밖에 못', '방에', '집에서'],
    school: ['학교', '공강', '수업 끝', '캠퍼스'],
    home: ['집 근처', '동네'],
  },
};
