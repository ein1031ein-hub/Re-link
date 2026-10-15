// Re:link 데이터 파일
// 장소 정보는 2026.10.14~15 구글 지도 운영시간·최근 후기 기준으로 확인한 것.
// 배포 전 다시 확인하고, 바뀐 내용은 이 파일만 고치면 앱 전체에 반영된다.

// 에너지 단계: 1 = 낮음, 2 = 보통, 3 = 높음
// 관심사 키: create(창작) nature(자연) move(움직임) rest(쉼) learn(배움)
// 생활권 키: school(학교 근처·쌍문동) home(집 근처·도봉동) online(집 안)
// hours: 요일별 운영시간. 0=일 1=월 ... 6=토. 없으면 null(방문 전 확인 필요)

const INTERESTS = {
  create: '창작',
  nature: '자연',
  move: '움직임',
  rest: '쉼',
  learn: '배움',
};

const AREAS = {
  school: { label: '학교 근처', sub: '쌍문동' },
  home: { label: '집 근처', sub: '도봉동 (시연용)' },
  online: { label: '집 안', sub: '지금 있는 곳에서' },
};

const ENERGY = {
  1: { label: '낮음', emoji: '🌙', rule: '혼자, 조용히, 짧게' },
  2: { label: '보통', emoji: '⛅', rule: '가볍게, 부담 없이' },
  3: { label: '높음', emoji: '☀️', rule: '몸을 쓰거나 사람을 만나기' },
};

const TUE_SUN_10_18 = { 0: [10, 18], 2: [10, 18], 3: [10, 18], 4: [10, 18], 5: [10, 18], 6: [10, 18] };

const PLACES = [
  // ── 쌍문동 (학교 생활권) ──
  {
    id: 'dooly', area: 'school', name: '둘리뮤지엄', interests: ['create', 'learn'],
    energy: [2, 2], minutes: 90, hours: TUE_SUN_10_18, hoursText: '화~일 10:00~18:00 · 월 휴관',
    why: '보기만 해도 되는 전시라서 부담 없이 기분을 바꿀 수 있어요.',
  },
  {
    id: 'hamsukhon', area: 'school', name: '함석헌기념관', interests: ['learn'],
    energy: [1, 2], minutes: 60, hours: null, hoursText: '방문 전 운영시간 확인',
    why: '조용한 공간에서 천천히 둘러볼 수 있어요. 주민참여 프로그램도 열려요.',
  },
  {
    id: 'sseulmo', area: 'school', name: '쓸모의 발견 (독립서점)', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40, hours: { 2: [15, 20], 3: [15, 20], 4: [15, 20], 5: [15, 20] },
    hoursText: '화~금 15:00~20:00 · 주말·월 휴무',
    why: '작은 서점에서 책 한 권 넘겨보는 것만으로도 충분한 하루예요.',
  },
  {
    id: 'youngplants', area: 'school', name: '영플랜츠앤갤러리영', interests: ['rest', 'nature'],
    energy: [1, 1], minutes: 45, hours: null, hoursText: '방문 전 운영시간 확인',
    why: '수초 어항을 보며 차를 마시는 곳. 말없이 머물러도 괜찮아요.',
  },
  {
    id: 'youthhouse', area: 'school', name: '쌍문동 청소년문화의집', interests: ['learn', 'move'],
    energy: [2, 3], minutes: 60, social: true,
    hours: { 0: [9, 18], 2: [9, 21], 3: [9, 21], 4: [9, 21], 5: [9, 21], 6: [9, 21] },
    hoursText: '화~토 09:00~21:00 · 일 09:00~18:00',
    why: '프로그램에 참여하면서 자연스럽게 사람들과 어울릴 수 있어요.',
    note: '대학생 이용 가능 여부 확인 필요',
  },
  {
    id: 'ssangmunlib', area: 'school', name: '쌍문채움도서관', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40, hours: null, hoursText: '방문 전 운영시간 확인 (구립)',
    why: '조용하고 머물기 편한 공공 공간이에요. 근처 작은도서관도 좋아요.',
  },
  {
    id: 'ssangmunpark', area: 'school', name: '쌍문근린공원', interests: ['nature'],
    energy: [1, 2], minutes: 30, hours: 'always', hoursText: '상시 개방 (공원)',
    why: '나무 사이를 30분 걷는 것만으로도 머리가 가벼워져요.',
  },

  // ── 도봉동 (버스 약 20분) ──
  {
    id: 'peace', area: 'home', name: '평화문화진지', interests: ['create', 'learn'],
    energy: [2, 2], minutes: 90, hours: null, hoursText: '방문 전 운영시간 확인 · 전시 무료',
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
    energy: [1, 1], minutes: 40, hours: null, hoursText: '매일 운영 · 시간은 방문 전 확인',
    why: '등산로 입구에서 산을 바라보며 쉬어갈 수 있어요.',
  },
  {
    id: 'dada', area: 'home', name: '전통찻집 다다 (구 인아찻집)', interests: ['rest'],
    energy: [1, 1], minutes: 50, hours: null, hoursText: '방문 전 운영시간 확인',
    why: '따뜻한 차 한 잔과 함께 천천히 쉬어가는 시간이에요.',
    note: '상호 변경 확인 필요',
  },
  {
    id: 'changpo', area: 'home', name: '서울창포원', interests: ['nature'],
    energy: [1, 2], minutes: 40, hours: null, hoursText: '방문 전 개방시간 확인 (공공)',
    why: '넓은 정원을 천천히 걸으며 계절을 느낄 수 있어요.',
  },
  {
    id: 'musugol', area: 'home', name: '무수골 산책길', interests: ['nature', 'move'],
    energy: [2, 3], minutes: 60, hours: 'always', hoursText: '상시 (산책로)',
    why: '계곡 옆길을 따라 걷는 한 시간짜리 코스예요.',
  },
  {
    id: 'dobongsan', area: 'home', name: '도봉산 짧은 등산', interests: ['nature', 'move'],
    energy: [3, 3], minutes: 120, hours: 'always', hoursText: '일몰 전 하산 권장',
    why: '몸을 크게 움직이고 정상에서 바람을 맞는 경험이에요.',
  },
  {
    id: 'pool', area: 'home', name: '도봉실내수영장', interests: ['move'],
    energy: [3, 3], minutes: 60, hours: null, hoursText: '자유수영 시간 확인 (공공)',
    why: '물속에서는 생각이 조용해져요. 몸이 먼저 기분을 바꿔줘요.',
  },
  {
    id: 'gym', area: 'home', name: '도봉 다목적체육센터', interests: ['move'],
    energy: [3, 3], minutes: 60, social: true, hours: null, hoursText: '프로그램 시간 확인 (공공)',
    why: '정해진 시간의 운동 프로그램은 일상에 리듬을 만들어줘요.',
  },
  {
    id: 'musulib', area: 'home', name: '무수골도서관', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40, hours: null, hoursText: '방문 전 운영시간 확인 (공공)',
    why: '작고 조용한 도서관. 창가 자리에서 잠깐 쉬어가요.',
  },
  {
    id: 'miraclelib', area: 'home', name: '도봉기적의도서관', interests: ['rest', 'learn'],
    energy: [1, 1], minutes: 40, hours: null, hoursText: '방문 전 운영시간 확인 (공공)',
    why: '편하게 머물 수 있는 공공 공간이에요.',
  },

  // ── 집 안 (앱 안에서 바로 하는 마이크로 처방) ──
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
    id: 'message', area: 'online', name: '안부 메시지 한 통', interests: ['rest', 'learn'],
    energy: [2, 3], minutes: 5, inApp: true, social: true,
    why: '연결은 작게 시작해요. 답장이 오지 않아도 보낸 것으로 충분해요.',
    steps: ['요즘 생각나는 사람을 한 명 떠올려요.', '"요즘 잘 지내?" 한 줄이면 충분해요.', '보냈다면 오늘 처방은 완료예요.'],
  },
];

// 위기 연결처. 번호는 배포 전 반드시 재확인할 것.
// tel 이 null 이면 앱에 "번호 확인 후 등록 예정"으로 표시된다.
const CRISIS_CONTACTS = [
  { name: '자살예방상담전화', desc: '24시간 · 전국', tel: '109' },
  { name: '정신건강위기상담전화', desc: '24시간 · 전국', tel: '1577-0199' },
  { name: '덕성여대 학생상담센터', desc: '재학생 상담 · 평일', tel: null },
  { name: '도봉구정신건강복지센터', desc: '쌍문동 소재', tel: null },
];

// 위기 감지 키워드 (규칙 기반. AI를 거치지 않는다)
const CRISIS_KEYWORDS = [
  '죽고 싶', '죽고싶', '자살', '자해', '사라지고 싶', '사라지고싶', '없어지고 싶', '없어지고싶',
  '끝내고 싶', '끝내고싶', '살기 싫', '살기싫', '죽어버리', '목숨', '극단적', '뛰어내리',
  '손목', '유서', '죽을래', '죽는 게 나', '죽는게 나',
];

// 자유 입력에서 태그를 뽑는 규칙 (규칙 기반 키워드 추출)
const TAG_RULES = {
  energy: {
    1: ['피곤', '지쳐', '지친', '무기력', '힘이 없', '기운 없', '기운이 없', '아무것도 하기 싫', '우울', '귀찮', '번아웃', '못 일어', '잠만'],
    3: ['신나', '활기', '에너지 넘', '뭐라도 하고 싶', '움직이고 싶', '밖에 나가고 싶', '사람 만나고 싶', '컨디션 좋'],
  },
  interests: {
    create: ['그림', '만들', '공예', '그리', '창작', '글쓰', '사진', '전시', '예술', '뜨개'],
    nature: ['산책', '자연', '나무', '공원', '바람', '하늘', '꽃', '숲', '산'],
    move: ['운동', '수영', '등산', '땀', '몸을', '스트레칭', '요가', '헬스'],
    rest: ['쉬고', '쉬고 싶', '조용', '혼자', '차 한', '카페', '멍', '쉼'],
    learn: ['책', '배우', '공부', '강연', '궁금', '읽고'],
  },
  area: {
    online: ['집에만', '나가기 싫', '밖에 못', '방에', '집에서'],
    school: ['학교', '공강', '수업 끝', '캠퍼스'],
    home: ['집 근처', '동네'],
  },
};
