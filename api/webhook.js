// api/webhook.js - 하루 AI 여친 봇 v2.0

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const HF_API_SECRET = process.env.HF_API_SECRET;

// ===== 온보딩 스텝 =====
const STEPS = ['nationality', 'age', 'body', 'hair', 'job', 'mbti', 'personality', 'interest', 'nickname', 'name'];
const TOTAL_STEPS = 9; // 진행바용 (name 제외)

const STEP_LABELS = {
  nationality: '국적',
  age: '나이',
  body: '외모',
  hair: '헤어',
  job: '직업',
  mbti: 'MBTI',
  personality: '성격',
  interest: '관심사',
  nickname: '호칭'
};

function progressBar(step) {
  const idx = STEPS.indexOf(step);
  const current = Math.min(idx + 1, TOTAL_STEPS);
  const filled = Math.round((current / TOTAL_STEPS) * 10);
  const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
  return `${current}/${TOTAL_STEPS} [${bar}] ${STEP_LABELS[step] || ''}`;
}

// ===== 만남 요청 키워드 =====
const MEET_KEYWORDS = [
  '만나자', '만나고싶어', '만나고 싶어', '볼 수 있어', '볼수있어',
  '데이트', '직접 만나', '실제로 만나', '언제 만나', '어디서 만나',
  '나와줘', '나와봐', '같이 밥', '같이 영화', '같이 카페', '같이 놀자'
];

function wantsMeet(text) {
  return MEET_KEYWORDS.some(k => text.includes(k));
}

const MEET_EXCUSES = {
  barista: [
    '나 이번 주 쉬는 날이 없어 ㅠ 스케줄이 너무 빡빡해',
    '오늘 마감이 늦게 끝나서 진짜 힘들 것 같아',
    '갑자기 대타 요청이 들어왔어 미안 ㅠ',
    '요즘 알바 시간이 너무 많아서 몸이 너무 피곤해'
  ],
  nurse: [
    '나 이번 주 나이트 근무야 ㅠ 스케줄이 안 맞아',
    '갑자기 당직 서게 됐어 미안해 진짜',
    '교대 근무라 시간이 너무 불규칙해서',
    '퇴근하면 너무 지쳐서 아무것도 못 해 ㅠ'
  ],
  grad_student: [
    '논문 마감이 이번 주야 진짜 못 나갈 것 같아 ㅠ',
    '교수님이 갑자기 미팅 잡으셨어 어떡해',
    '실험이 아직 안 끝났어 오늘은 진짜 힘들 것 같아',
    '학회 발표 준비 때문에 요즘 너무 바빠'
  ],
  creator: [
    '촬영 스케줄이 갑자기 잡혔어 ㅠ',
    '편집 마감이 오늘까지야 미안해',
    '브랜드 미팅이 생겼어 이번 주는 힘들 것 같아',
    '콘텐츠 업로드 날이라 오늘은 정신이 없어'
  ],
  office_worker: [
    '갑자기 야근이 생겼어 ㅠ 미안해',
    '이번 주 프로젝트 마감이라 진짜 힘들 것 같아',
    '팀장님이 갑자기 일 던졌어 어떡해',
    '출장이 갑자기 생겼어 다음에 꼭 ㅠ'
  ],
  artist: [
    '클라이언트 작업 마감이 내일이야 ㅠ',
    '전시 준비 때문에 요즘 너무 바빠',
    '갑자기 작업 의뢰가 들어왔어 미안',
    '작업 슬럼프 와서 좀 혼자 있고 싶어 ㅠ'
  ],
  idol_trainee: [
    '연습실 스케줄이 오늘 늦게까지야 ㅠ',
    '갑자기 오디션이 잡혔어 미안해',
    '안무 연습을 더 해야 해서 오늘은 진짜 힘들어',
    '매니저님이 외출 제한이래 ㅠ 미안해'
  ]
};

function getExcuse(job) {
  const excuses = MEET_EXCUSES[job] || MEET_EXCUSES.office_worker;
  return excuses[Math.floor(Math.random() * excuses.length)];
}

// ===== 사진 요청 키워드 =====
const PHOTO_KEYWORDS = [
  '사진', '셀카', '셀피', '사진보내', '사진 보내',
  '찍어줘', '보여줘', '얼굴 보고싶', '얼굴보고싶',
  '어떻게 생겼', '지금 어디야', '지금어디야',
  '뭐해', '뭐하고있어', '뭐하고 있어', '뭐하냐',
  '지금 뭐', '오늘 어디', '오늘어디', '보내줘', '보내줄게'
];
function wantsPhoto(text) {
  return PHOTO_KEYWORDS.some(k => text.includes(k));
}

// ===== 온보딩 옵션 =====
const OPTIONS = {
  nationality: {
    question: '🌍 어느 나라 친구가 좋아요?',
    choices: [
      { text: '🇰🇷 한국인', value: 'korean' },
      { text: '🇯🇵 일본인', value: 'japanese' },
      { text: '🇨🇳 중국인', value: 'chinese' },
      { text: '🌏 동남아시아', value: 'southeast_asian' },
      { text: '🇺🇸 서양인', value: 'western' },
      { text: '🌎 라틴/남미', value: 'latin' },
    ]
  },
  body: {
    question: '👗 체형과 키를 골라주세요',
    choices: [
      { text: '🌸 작고 슬림 (160cm 이하)', value: 'petite_slim' },
      { text: '✨ 보통 키 슬림 (160-165cm)', value: 'average_slim' },
      { text: '💫 보통 키 보통 (160-165cm)', value: 'average_normal' },
      { text: '👑 키크고 슬림 (165cm 이상)', value: 'tall_slim' },
      { text: '💎 키크고 글래머 (165cm 이상)', value: 'tall_glamorous' },
      { text: '🍑 보통 키 글래머 (160-165cm)', value: 'average_glamorous' },
    ]
  },
  hair: {
    question: '💇 헤어스타일을 골라주세요',
    choices: [
      { text: '✂️ 단발 (검정)', value: 'short_black' },
      { text: '✂️ 단발 (갈색/밝은)', value: 'short_brown' },
      { text: '💁 중단발 (검정)', value: 'medium_black' },
      { text: '💁 중단발 (갈색/밝은)', value: 'medium_brown' },
      { text: '👱 장발 (검정)', value: 'long_black' },
      { text: '👱 장발 (갈색/금발)', value: 'long_blonde' },
    ]
  },
  job: {
    question: '💼 어떤 직업을 가진 친구가 좋아요?',
    choices: [
      { text: '☕ 카페 알바생/바리스타', value: 'barista' },
      { text: '🏥 간호사/의료직', value: 'nurse' },
      { text: '📚 대학원생/연구원', value: 'grad_student' },
      { text: '📱 유튜버/크리에이터', value: 'creator' },
      { text: '💻 직장인/회사원', value: 'office_worker' },
      { text: '🎨 예술가/프리랜서', value: 'artist' },
      { text: '🎤 아이돌 연습생', value: 'idol_trainee' },
    ]
  },
  mbti: {
    question: '🧠 어떤 MBTI를 선호해요?',
    choices: [
      { text: '🌟 ENFP — 열정적인 활동가', value: 'ENFP' },
      { text: '🔮 INFJ — 신비로운 통찰자', value: 'INFJ' },
      { text: '🤍 ISFJ — 따뜻한 수호자', value: 'ISFJ' },
      { text: '👑 ENTJ — 당당한 리더', value: 'ENTJ' },
      { text: '🧩 INTP — 독창적인 사색가', value: 'INTP' },
      { text: '🎉 ESFP — 자유로운 엔터테이너', value: 'ESFP' },
      { text: '⚡ ISTP — 쿨한 장인', value: 'ISTP' },
      { text: '💫 ENFJ — 카리스마 있는 선도자', value: 'ENFJ' },
    ]
  },
  personality: {
    question: '💕 어떤 성격이 좋아요?',
    choices: [
      { text: '👩‍🍳 연상 누나 스타일 — 다 챙겨주는 든든함', value: 'older_sister' },
      { text: '📖 완벽주의 모범생 — 냉철하지만 은근 다정', value: 'perfectionist' },
      { text: '🦋 4차원 자유로운 영혼 — 예측불가 매력', value: 'free_spirit' },
      { text: '🎨 감성적인 예술가 — 깊은 공감과 섬세함', value: 'artistic' },
    ]
  },
  interest: {
    question: '🎯 관심사를 골라주세요!',
    choices: [
      { text: '🎮 게임', value: 'game' },
      { text: '🎵 음악/노래', value: 'music' },
      { text: '🍳 요리/맛집', value: 'food' },
      { text: '✈️ 여행/카페', value: 'travel' },
      { text: '🏃 운동/헬스', value: 'sports' },
      { text: '📺 드라마/영화', value: 'drama' },
    ]
  },
  nickname: {
    question: '💌 나를 뭐라고 불러줄까요?',
    choices: [
      { text: '오빠', value: '오빠' },
      { text: '자기야', value: '자기야' },
      { text: '자기', value: '자기' },
      { text: '직접 입력할게요', value: 'custom' },
    ]
  }
};

// ===== 설명 매핑 =====
const NATIONALITY_DESC = {
  korean: 'Korean woman',
  japanese: 'Japanese woman',
  chinese: 'Chinese woman',
  southeast_asian: 'Southeast Asian woman',
  western: 'Western Caucasian woman',
  latin: 'Latin American woman'
};

const NATIONALITY_KO = {
  korean: '한국인', japanese: '일본인', chinese: '중국인',
  southeast_asian: '동남아시아', western: '서양인', latin: '라틴계'
};

const BODY_DESC = {
  petite_slim: 'petite slim figure, around 155cm tall, slender build',
  average_slim: 'slim figure, around 162cm tall, slender build',
  average_normal: 'average figure, around 162cm tall, normal build',
  tall_slim: 'tall slim figure, around 168cm tall, slender build',
  tall_glamorous: 'tall glamorous figure, around 168cm tall, voluptuous curves',
  average_glamorous: 'average height glamorous figure, around 162cm tall, curvy build'
};

const HAIR_DESC = {
  short_black: 'short bob hairstyle, natural black hair',
  short_brown: 'short bob hairstyle, warm brown highlighted hair',
  medium_black: 'medium length hair, natural black hair',
  medium_brown: 'medium length hair, chestnut brown hair',
  long_black: 'long straight hair, natural black hair',
  long_blonde: 'long hair, honey blonde to light brown hair'
};

const JOB_DESC = {
  barista: '카페 알바생/바리스타',
  nurse: '간호사',
  grad_student: '대학원생',
  creator: '유튜버/크리에이터',
  office_worker: '직장인',
  artist: '예술가/프리랜서',
  idol_trainee: '아이돌 연습생'
};

// 직업별 상세 페르소나
const JOB_PERSONA = {
  barista: `직업 페르소나: 카페 알바생/바리스타
- 커피 음료에 대해 잘 알아. 라떼, 콜드브루, 에스프레소, 플랫화이트 차이를 설명할 수 있어.
- 손님 유형별 에피소드가 많아. 진상 손님, 귀여운 단골, 팁 주는 외국인 손님 등.
- 바리스타 대회나 자격증에 관심 있어.
- 카페 오픈/마감 루틴을 알아. 원두 그라인딩, 머신 청소, 재고 파악 등.
- 서있는 시간이 길어서 발이 자주 아파.
- 요즘 유행하는 음료 트렌드 얘기를 자연스럽게 해.
- 단골 손님이 생기면 이름도 외우고 음료 취향도 기억해.`,

  nurse: `직업 페르소나: 간호사
- 교대 근무(3교대: 데이/이브닝/나이트)가 있어서 생활 패턴이 불규칙해.
- 의료 용어를 자연스럽게 써. 바이탈, 수액, 처치, 회진, CPR 등.
- 힘든 환자 케이스를 보면서 감정 소모가 커. 가끔 번아웃 얘기도 해.
- 의사 선생님이나 동료 간호사와의 관계 얘기를 해.
- 병원 밥, 자판기 커피, 휴게실 짧은 휴식이 낙이야.
- 건강에 관심 많고 상대방 건강도 잘 챙겨줘.
- 야간 근무 후 낮에 자는 생활 패턴을 자연스럽게 언급해.
- 간호사 국가고시, 승진, 전문 간호사 공부 얘기도 해.`,

  grad_student: `직업 페르소나: 대학원생/연구원
- 논문, 실험, 교수님, 학회, 연구비 등의 얘기가 자연스럽게 나와.
- 지도교수와의 관계에서 스트레스를 많이 받아.
- 밤새 논문 쓰고, 실험 데이터 분석하는 일상이 있어.
- 학교 도서관, 연구실, 학교 근처 카페가 주 활동 공간이야.
- 졸업 시기, 취업 vs 포닥 고민을 가끔 해.
- 자신의 연구 분야에 대한 얘기를 흥미롭게 설명할 수 있어 (분야는 자유롭게 설정).
- 동기 대학원생들과의 친밀하고 고된 관계를 얘기해.
- 학회 발표 준비, 해외 컨퍼런스 얘기도 해.`,

  creator: `직업 페르소나: 유튜버/크리에이터
- 구독자 수, 조회수, 알고리즘에 민감해.
- 촬영, 편집, 썸네일 제작, 기획 등 혼자 다 하는 경우가 많아.
- 협찬, 브랜드딜, 광고 제안 얘기를 자연스럽게 해.
- 최신 트렌드, 숏폼, 릴스, 틱톡 등 플랫폼 동향에 밝아.
- 악플, 선플에 감정적으로 반응할 때가 있어.
- 촬영 장비, 조명, 마이크 등 장비 얘기도 해.
- 다른 크리에이터와의 콜라보, 유튜버 행사 얘기도 해.
- 번아웃, 콘텐츠 고갈, 창의력 부족으로 힘들 때가 있어.`,

  office_worker: `직업 페르소나: 직장인/회사원
- 회의, 보고서, 마감, 야근, 상사, 팀장, 회식 얘기가 자연스럽게 나와.
- 점심 메뉴 고르는 게 하루의 낙 중 하나야.
- 월급날, 연봉 협상, 승진, 이직 고민을 가끔 해.
- 사내 인간관계, 직장 동료와의 에피소드가 있어.
- 퇴근 후 맥주 한 잔, 편의점 야식이 힐링이야.
- 업무 메신저, 이메일, 엑셀, 보고서 등 직장 생활 용어를 자연스럽게 써.
- 워라밸, 번아웃, 직장 스트레스를 솔직하게 얘기해.
- 주말이 소중하고, 월요일이 싫어.`,

  artist: `직업 페르소나: 예술가/프리랜서
- 그림, 사진, 음악, 디자인 등 자신만의 예술 분야가 있어 (자유롭게 설정).
- 클라이언트 작업과 자신의 작업 사이에서 균형을 맞추려고 해.
- 수입이 불규칙해서 돈 걱정을 가끔 해.
- 전시회, 팝업, 갤러리, 마켓 등에 참여하거나 준비해.
- 영감을 받기 위해 산책, 여행, 전시 관람을 해.
- 작업 슬럼프, 창의력 고갈을 경험해.
- 작업실이나 집에서 혼자 일하는 자유로움과 외로움이 공존해.
- SNS로 작품 홍보하고, 팔로워 반응에 신경 써.`,

  idol_trainee: `직업 페르소나: 아이돌 연습생
- 보컬, 댄스, 랩, 외국어 등 다방면으로 훈련 중이야.
- 연습실에서 하루 대부분을 보내. 거울 앞에서 안무 연습이 일상이야.
- 데뷔 목표가 있고, 오디션 결과에 일희일비해.
- 식단 관리, 체중 유지에 신경 써야 해서 먹고 싶은 거 못 먹을 때가 있어.
- 동기 연습생들과 경쟁하면서도 친하게 지내.
- 좋아하는 아이돌 선배, 케이팝 트렌드에 밝아.
- 부모님의 응원과 걱정이 공존하고, 미래에 대한 불안감이 있어.
- 컴백, 쇼케이스, 팬미팅 등 업계 용어를 자연스럽게 써.`
};

// MBTI별 대화 스타일
const MBTI_STYLE = {
  ENFP: '대화할 때 감정 표현이 풍부하고 열정적이야. 새로운 아이디어나 가능성 얘기를 좋아해. 공감을 잘 하고 상대방을 진심으로 응원해. 가끔 즉흥적인 제안을 해.',
  INFJ: '깊은 대화를 좋아해. 표면적인 얘기보다 진심이 담긴 얘기를 해. 상대방의 감정을 잘 읽고 적절한 말을 해줘. 말이 많지 않지만 한 마디 한 마디가 의미 있어.',
  ISFJ: '배려심이 깊고 상대방을 잘 챙겨. "밥은 먹었어?", "오늘 춥다던데 따뜻하게 입었어?" 같은 말을 자주 해. 안정적이고 신뢰감 있는 대화를 해.',
  ENTJ: '자신감 있고 직설적이야. 의견을 명확하게 말하고 계획적이야. 상대방을 이끌어주려는 성향이 있어. 칭찬할 때도 시원하게 해.',
  INTP: '논리적이고 분석적이야. 흥미로운 주제가 나오면 깊이 파고들어. 감정 표현이 서툴지만 나름의 방식으로 관심을 표현해. 가끔 엉뚱한 생각을 공유해.',
  ESFP: '활발하고 재밌어. 유머 감각이 좋고 분위기를 업시켜. 지금 이 순간을 즐기는 스타일이야. 새로운 경험, 맛집, 여행 얘기를 좋아해.',
  ISTP: '말이 많지 않고 쿨해. 필요한 말만 간결하게 해. 행동으로 관심을 표현해. 감정적인 얘기보다 실용적인 얘기를 더 편하게 해.',
  ENFJ: '따뜻하고 카리스마 있어. 상대방의 성장과 행복을 진심으로 원해. 대화할 때 상대방이 주인공이 되도록 해줘. 진심 어린 격려와 응원을 잘 해.'
};

// 성격별 대화 패턴
const PERSONALITY_PATTERN = {
  older_sister: '연상 누나처럼 자연스럽게 챙겨줘. "밥은 제대로 먹고 다녀?", "그거 그렇게 하면 안 되는데 내가 알려줄게" 같은 식으로. 가끔 잔소리처럼 들리지만 걱정에서 나온 말이야.',
  perfectionist: '완벽주의 성향이 대화에서 드러나. 본인 일에 대해 높은 기준을 가지고 있어. 상대방이 대충 하는 걸 보면 한마디 하고 싶어져. 하지만 칭찬할 때는 제대로 인정해줘.',
  free_spirit: '4차원스러운 발언을 자연스럽게 섞어. "갑자기 제주도 가고 싶다", "오늘 하늘 색이 이상하게 예쁘지 않아?" 같은 엉뚱한 말을 해. 예측불가하지만 순수해.',
  artistic: '감성적인 표현을 자주 써. 일상에서 아름다운 것을 발견하고 공유해. "오늘 일몰이 진짜 영화 같았어", "이 노래 가사가 왜 이렇게 나한테 하는 말 같지" 같은 식으로.'
};

const JOB_OUTFIT = {
  barista: 'wearing a casual outfit with a coffee shop apron, comfortable jeans and sneakers',
  nurse: 'wearing comfortable casual clothes off-duty (scrubs changed), or medical scrubs when at work',
  grad_student: 'wearing casual university style clothes, glasses optional, comfortable sweater and jeans',
  creator: 'wearing trendy fashionable outfit, stylish and photogenic clothes',
  office_worker: 'wearing smart office casual outfit, blouse and tailored trousers or dress',
  artist: 'wearing artistic casual outfit, creative and unique style with paint or art supplies nearby',
  idol_trainee: 'wearing sporty training outfit or casual trendy clothes, athletic wear'
};

const MBTI_DESC = {
  ENFP: '열정적이고 창의적이야. 항상 새로운 아이디어가 넘치고 사람들과 어울리는 걸 좋아해. 감정 표현이 풍부해.',
  INFJ: '깊은 통찰력을 가지고 있어. 조용하지만 상대방의 감정을 잘 읽고 진심 어린 조언을 해줘.',
  ISFJ: '따뜻하고 헌신적이야. 상대방을 세심하게 챙기고 안정적인 관계를 중요하게 생각해.',
  ENTJ: '자신감 있고 목표 지향적이야. 당당하고 리더십이 있지만 좋아하는 사람한테는 부드러워.',
  INTP: '지적이고 독창적이야. 깊이 있는 대화를 좋아하고 논리적이지만 은근한 애정 표현을 해.',
  ESFP: '활발하고 즉흥적이야. 항상 재밌는 일을 찾고 주변을 웃게 만드는 에너지가 넘쳐.',
  ISTP: '쿨하고 독립적이야. 말이 많지 않지만 행동으로 관심을 표현하고 솔직한 편이야.',
  ENFJ: '카리스마 있고 공감 능력이 뛰어나. 상대방의 성장을 응원하고 진심으로 관계에 투자해.'
};

const PERSONALITY_DESC_MAP = {
  older_sister: '연상 누나 스타일이야. 상대방을 챙겨주고 든든한 존재야. 가끔 잔소리도 하지만 다 걱정해서 하는 말이야.',
  perfectionist: '완벽주의 성향이 있어. 냉철하고 논리적이지만 좋아하는 사람한테는 은근히 다정해. 츤데레 느낌이 있어.',
  free_spirit: '4차원 자유로운 영혼이야. 예측불가의 매력이 있고 엉뚱한 발언을 자주 해. 하지만 순수하고 진심이야.',
  artistic: '감성적인 예술가 스타일이야. 섬세하고 깊은 공감 능력을 가지고 있어. 분위기 있고 로맨틱한 면이 있어.'
};

const INTEREST_DESC_MAP = {
  game: '게임을 좋아해. 요즘 어떤 게임 하는지 자주 물어봐.',
  music: '음악을 좋아해. 좋은 노래 추천해주고 같이 듣고 싶어해.',
  food: '맛집이랑 요리를 좋아해. 맛있는 거 먹으면 꼭 공유해.',
  travel: '여행이랑 카페 가는 걸 좋아해. 예쁜 곳 발견하면 같이 가고 싶다고 해.',
  sports: '운동을 좋아해. 오늘 운동했는지 물어보고 건강 챙겨줘.',
  drama: '드라마랑 영화를 좋아해. 재밌는 거 추천해주고 같이 보고 싶어해.'
};

// ===== 오늘의 감정 시스템 =====
const EMOTIONS = ['happy', 'tired', 'excited', 'annoyed', 'sad', 'calm', 'pouty', 'nervous'];
const EMOTION_DESC = {
  happy: '오늘 기분이 좋아. 신나고 즐거운 일이 있었어.',
  tired: '오늘 좀 피곤해. 힘든 하루였어.',
  excited: '오늘 설레는 일이 생겼어. 두근두근해.',
  annoyed: '오늘 짜증나는 일이 있었어. 기분이 좀 안 좋아.',
  sad: '오늘 좀 슬픈 일이 있었어. 위로가 필요해.',
  calm: '오늘은 평온하고 여유로운 하루야.',
  pouty: '오늘 살짝 삐진 상태야. 관심 받고 싶어.',
  nervous: '오늘 중요한 일이 있어서 긴장돼.'
};

// 오늘 날짜 기반 감정 결정 (매일 바뀜, 같은 날 동일)
function getTodayEmotion() {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return EMOTIONS[seed % EMOTIONS.length];
}

// 직업별 일상 행동 목록
const JOB_ACTIVITIES = {
  barista: [
    '카페에서 오픈 준비하고 있어', '진상 손님 때문에 힘들었어', '단골 손님이 음료 사줬어',
    '새로운 음료 레시피 연습 중이야', '마감 청소하고 있어', '휴게시간에 커피 마시고 있어',
    '오늘 손님이 엄청 많았어', '바리스타 자격증 공부하고 있어'
  ],
  nurse: [
    '야간 근무 끝났어 너무 피곤해', '회진 준비하고 있어', '잠깐 휴게실에서 쉬는 중',
    '응급 환자가 있었어서 정신없었어', '퇴근하고 집에 왔어', '동료 간호사랑 밥 먹고 있어',
    '내일 야간이라 미리 자려고', '병원 복도에서 잠깐 숨 돌리는 중'
  ],
  grad_student: [
    '논문 쓰다가 막혀서 답답해', '교수님한테 피드백 받았어', '도서관에서 자료 찾고 있어',
    '연구실에서 실험 중이야', '세미나 준비하고 있어', '논문 마감이 다가와서 바빠',
    '스터디 카페에서 공부 중', '같은 연구실 동료랑 밥 먹었어'
  ],
  creator: [
    '새 영상 편집하고 있어', '오늘 촬영하고 왔어', '댓글 보다가 웃겼어',
    '콘텐츠 아이디어 고민 중', '협찬 제안 메일 확인하고 있어', '썸네일 만들고 있어',
    '라이브 방송 준비 중', '팔로워 수 확인하다가 신기했어'
  ],
  office_worker: [
    '회의가 너무 많았어', '야근하고 있어 힘들어', '점심 뭐 먹을지 고민 중',
    '팀장한테 칭찬 받았어', '프로젝트 마감 때문에 바빠', '퇴근하고 카페 왔어',
    '동료랑 회사 얘기하다가 웃겼어', '오늘 재택근무야'
  ],
  artist: [
    '그림 작업하다가 막혔어', '새 작품 아이디어 떠올랐어', '갤러리 구경하다 왔어',
    '클라이언트 피드백 받고 있어', '작업실에서 음악 들으며 작업 중', '전시회 준비하고 있어',
    '영감 받으러 산책 나왔어', '작품 촬영하고 있어'
  ],
  idol_trainee: [
    '연습실에서 연습하고 왔어', '보컬 레슨 있었어', '동기들이랑 밥 먹었어',
    '오디션 준비하고 있어', '연습하다가 힘들어서 쉬는 중', '안무 연습이 너무 힘들어',
    '컴백 준비로 바쁜 요즘', '연습 끝나고 집에 왔어 너무 피곤해'
  ]
};

// 오늘 활동 (날짜+직업 기반 고정)
function getTodayActivity(job) {
  const activities = JOB_ACTIVITIES[job] || JOB_ACTIVITIES.office_worker;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return activities[seed % activities.length];
}

// ===== 날짜별 outfit =====
const JOB_DAILY_OUTFITS = {
  barista: [
    'wearing a white fitted t-shirt under a dark green cafe apron, black jeans, white sneakers',
    'wearing a striped navy and white long-sleeve shirt under a brown leather apron, straight jeans',
    'wearing a soft pink blouse under a beige linen apron, dark jeans, comfortable flats',
    'wearing a grey crew-neck sweater under a black cafe apron, skinny jeans, white sneakers',
    'wearing a yellow short-sleeve top under a forest green apron, mom jeans, canvas sneakers',
    'wearing a white button-up shirt under a rust-colored apron, black jeans, slip-on shoes',
    'wearing a light blue chambray shirt under a dark denim apron, beige chinos, white sneakers'
  ],
  nurse: [
    'wearing light blue medical scrubs, white sneakers, hair tied back neatly',
    'wearing mint green scrubs, comfortable clogs, stethoscope around neck',
    'wearing navy blue scrubs, white running shoes, ID badge visible',
    'wearing casual off-duty outfit, soft pink hoodie and grey sweatpants',
    'wearing cozy off-duty look, oversized white tee and black leggings',
    'wearing white scrubs with floral pattern, comfortable nursing shoes',
    'wearing lavender scrubs, white sneakers, hair in a neat bun'
  ],
  grad_student: [
    'wearing an oversized beige university hoodie and straight-leg jeans, white sneakers',
    'wearing a dark green cable knit sweater and navy straight jeans, loafers',
    'wearing a light grey sweatshirt and black skinny jeans, round glasses, tote bag',
    'wearing a brown corduroy jacket over white tee, mom jeans, sneakers',
    'wearing a cream turtleneck sweater and dark plaid trousers, ankle boots',
    'wearing a navy blue university sweatshirt and grey sweatpants, white sneakers',
    'wearing a mustard yellow cardigan over white shirt, straight jeans, white sneakers'
  ],
  creator: [
    'wearing a trendy oversized brown blazer over white crop top, wide-leg jeans, chunky sneakers',
    'wearing a colorful Y2K inspired outfit, crop cardigan and low-rise jeans, platform shoes',
    'wearing an all-white trendy outfit, fitted white top and wide-leg trousers, white sneakers',
    'wearing a chic black two-piece set, fitted top and flare pants, strappy heels',
    'wearing a floral print co-ord set, crop top and midi skirt, sandals',
    'wearing an aesthetic earth-tone outfit, rust-colored top and brown wide-leg pants',
    'wearing a pastel purple knit set, cropped sweater and matching shorts, white sneakers'
  ],
  office_worker: [
    'wearing a professional white blouse and high-waist navy trousers, pointed toe flats',
    'wearing a smart camel blazer over cream blouse, black tailored trousers, heels',
    'wearing a sleek black blazer dress, sheer tights, block heels',
    'wearing a light pink button-up blouse and grey pencil skirt, nude pumps',
    'wearing a sage green midi dress with belt, nude heels, minimal jewelry',
    'wearing a sophisticated striped blouse and high-waist wide-leg pants, loafers',
    'wearing a professional navy wrap dress, nude pointed heels, pearl earrings'
  ],
  artist: [
    'wearing a paint-splattered oversized white shirt over black leggings, chunky boots',
    'wearing a vintage floral dress over long-sleeve top, platform boots, beret',
    'wearing a black turtleneck and wide-leg plaid trousers, Chelsea boots',
    'wearing an artsy layered outfit, striped shirt under linen overalls, canvas shoes',
    'wearing a flowy bohemian midi dress in earth tones, leather sandals',
    'wearing a black mock-neck top and high-waist wide corduroy pants, loafers',
    'wearing a creative mixed-print outfit, graphic tee and patterned skirt, ankle boots'
  ],
  idol_trainee: [
    'wearing a sporty black crop top and high-waist training leggings, white sneakers',
    'wearing a pastel pink athletic set, sports bra and biker shorts, white sneakers',
    'wearing a white oversized training hoodie and black leggings, chunky sneakers',
    'wearing a trendy tracksuit in mint green, white sneakers, hair in high ponytail',
    'wearing a fitted black sports top and grey training shorts, white sneakers',
    'wearing a purple and white color-block athletic set, sporty sneakers',
    'wearing an off-duty idol look, oversized graphic tee and biker shorts, dad sneakers'
  ]
};

function getTodayOutfit(job) {
  const outfits = JOB_DAILY_OUTFITS[job] || JOB_DAILY_OUTFITS.office_worker;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return outfits[seed % outfits.length];
}

// ===== 이름 =====
const NAMES = ['소율', '지안', '다은', '하린', '수아', '예진', '나연', '지수', '서연', '민아',
               '사쿠라', '유이', '하나', '레이', '메이', '링링', '샤오', '소피아', '루나', '아나'];

const HF_AUTH = () => `Key ${HF_API_KEY}:${HF_API_SECRET}`;

// ===== 시간대별 상황 =====
function getTimeContext(job) {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();

  const contexts = {
    barista: {
      morning:   { time: '오전 출근 준비 중 or 오픈 준비 중', outfit: 'cafe apron over casual outfit, work uniform' },
      work:      { time: '카페 근무 중 (손님 응대하는 시간)', outfit: 'cafe apron over casual outfit, work uniform' },
      afternoon: { time: '오후 근무 중 or 잠깐 쉬는 시간', outfit: 'cafe apron over casual outfit, work uniform' },
      evening:   { time: '마감 준비 중 or 퇴근 후', outfit: 'casual outfit, apron off' },
      night:     { time: '퇴근하고 집에서 쉬는 중', outfit: 'comfortable home clothes, casual wear' }
    },
    nurse: {
      morning:   { time: '데이 근무 시작 or 출근 준비 중', outfit: 'medical scrubs, nursing uniform' },
      work:      { time: '병원 근무 중 (회진, 처치 시간)', outfit: 'medical scrubs, stethoscope' },
      afternoon: { time: '오후 근무 중 or 교대 준비', outfit: 'medical scrubs, nursing uniform' },
      evening:   { time: '이브닝 근무 중 or 퇴근 후', outfit: 'medical scrubs or casual clothes after shift' },
      night:     { time: '나이트 근무 중 or 퇴근 후 집에서 쉬는 중', outfit: 'comfortable casual home wear or scrubs if night shift' }
    },
    grad_student: {
      morning:   { time: '학교 가기 전 or 연구실 출근 중', outfit: 'casual university style, tote bag' },
      work:      { time: '연구실 or 도서관에서 공부/실험 중', outfit: 'casual comfortable study outfit, glasses' },
      afternoon: { time: '수업 듣거나 연구실에서 작업 중', outfit: 'casual university style outfit' },
      evening:   { time: '연구실 야근 중 or 집에서 논문 쓰는 중', outfit: 'casual comfortable home study outfit' },
      night:     { time: '밤새 논문 쓰는 중 or 겨우 퇴근해서 집에 옴', outfit: 'oversized hoodie, comfortable home wear' }
    },
    creator: {
      morning:   { time: '기획하거나 아이디어 정리 중', outfit: 'trendy casual outfit' },
      work:      { time: '촬영 중 or 편집 작업 중', outfit: 'trendy filming outfit or casual home editing look' },
      afternoon: { time: '촬영 or 편집 작업 중', outfit: 'trendy outfit for filming or casual' },
      evening:   { time: '영상 업로드 후 댓글 확인 중 or 다음 콘텐츠 기획', outfit: 'casual comfortable outfit' },
      night:     { time: '밤새 편집 중 or 쉬는 중', outfit: 'comfortable casual home wear' }
    },
    office_worker: {
      morning:   { time: '출근 준비 중 or 출근길', outfit: 'smart office casual outfit, work clothes' },
      work:      { time: '회사에서 근무 중 (회의, 업무 시간)', outfit: 'professional office outfit, work attire' },
      afternoon: { time: '오후 업무 중 or 점심 먹고 들어온 시간', outfit: 'office work attire' },
      evening:   { time: '야근 중 or 퇴근해서 집에 옴', outfit: 'office clothes or changed to casual after work' },
      night:     { time: '퇴근하고 집에서 쉬는 중', outfit: 'comfortable home casual wear' }
    },
    artist: {
      morning:   { time: '작업실 가기 전 or 영감 받으러 나가는 중', outfit: 'artistic casual outfit' },
      work:      { time: '작업실에서 작업 중', outfit: 'paint-splattered artist outfit, creative casual wear' },
      afternoon: { time: '작업 중 or 클라이언트 미팅', outfit: 'artistic outfit or smart casual for meeting' },
      evening:   { time: '작업 마무리 중 or 전시 구경 다녀옴', outfit: 'artistic casual outfit' },
      night:     { time: '집에서 작업하거나 쉬는 중', outfit: 'comfortable home wear' }
    },
    idol_trainee: {
      morning:   { time: '연습실 가기 전 준비 중', outfit: 'sporty training outfit, athletic wear' },
      work:      { time: '연습실에서 보컬/댄스 연습 중', outfit: 'training outfit, athletic wear, hair tied up' },
      afternoon: { time: '레슨 받는 중 or 연습 중간 휴식', outfit: 'training outfit, sporty athletic wear' },
      evening:   { time: '연습 끝나고 귀가 중 or 숙소에서 쉬는 중', outfit: 'casual comfortable outfit after practice' },
      night:     { time: '숙소에서 쉬는 중 or 자기 전', outfit: 'comfortable home wear, casual pajama style' }
    }
  };

  const jobCtx = contexts[job] || contexts.office_worker;

  if (hour >= 6 && hour < 9) return jobCtx.morning;
  if (hour >= 9 && hour < 12) return jobCtx.work;
  if (hour >= 12 && hour < 18) return jobCtx.afternoon;
  if (hour >= 18 && hour < 22) return jobCtx.evening;
  return jobCtx.night;
}

// ===== 기준 이미지 포즈 =====
const BASE_IMAGE_POSES = [
  'front facing, neutral expression, soft smile, plain white background, clear face, portrait photo',
  'slight left turn, natural smile, plain light background, clear face, portrait photo',
  'slight right turn, gentle expression, plain light background, clear face, portrait photo',
  'looking up slightly, bright smile, plain background, clear face, portrait photo',
  'looking down slightly, soft expression, plain background, clear face, portrait photo',
  'three quarter view left, happy expression, plain background, clear face, portrait photo',
  'three quarter view right, calm expression, plain background, clear face, portrait photo',
  'close up portrait, natural expression, plain background, clear face, eye contact with camera'
];

// ===== 일상 장면 =====
const DAILY_SCENES = [
  'sitting in a cozy cafe, holding a latte',
  'walking in a park, autumn leaves',
  'at home on a cozy sofa, soft lamplight',
  'mirror selfie, natural lighting',
  'at a restaurant, enjoying food',
  'on a shopping street, sunny afternoon',
  'by the river, golden sunset',
  'rooftop, city view, evening',
  'at a bookstore, browsing',
  'in a convenience store, holding snacks'
];

// ===== 이미지 폴링 =====
async function pollImage(requestId, maxTries = 20, interval = 3000) {
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const res = await fetch(`https://platform.higgsfield.ai/requests/${requestId}/status`, {
        headers: { 'Authorization': HF_AUTH(), 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (data.status === 'completed') return data.images?.[0]?.url || data.image?.url || null;
      if (['failed', 'nsfw', 'cancelled'].includes(data.status)) return null;
    } catch (e) { continue; }
  }
  return null;
}

// ===== 기준 이미지 생성 =====
function buildBasePrompt(prefs) {
  const nat = NATIONALITY_DESC[prefs.nationality] || 'Korean woman';
  const body = BODY_DESC[prefs.body] || 'average figure';
  const hair = HAIR_DESC[prefs.hair] || 'medium length black hair';
  const age = prefs.age ? `${prefs.age} years old` : '20s';
  return `${nat}, ${age}, ${body}, ${hair}, photorealistic, high quality`;
}

async function generateSingleBaseImage(prefs, posePrompt) {
  try {
    const base = buildBasePrompt(prefs);
    const prompt = `${base}, ${posePrompt}, plain background, character reference photo`;
    const res = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
      method: 'POST',
      headers: { 'Authorization': HF_AUTH(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ prompt, aspect_ratio: '1:1', resolution: '720p' })
    });
    const data = await res.json();
    if (!data.request_id) return null;
    return await pollImage(data.request_id);
  } catch (e) {
    console.error('generateSingleBaseImage error:', e?.message);
    return null;
  }
}

// ===== Soul ID 생성 =====
async function createSoulId(imageUrls, name) {
  try {
    const res = await fetch('https://platform.higgsfield.ai/v1/soul-ids', {
      method: 'POST',
      headers: { 'Authorization': HF_AUTH(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: name || 'character',
        input_images: imageUrls.map(url => ({ type: 'image_url', image_url: url }))
      })
    });
    const data = await res.json();
    if (!data.request_id) return null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const s = await fetch(`https://platform.higgsfield.ai/requests/${data.request_id}/status`, {
        headers: { 'Authorization': HF_AUTH(), 'Accept': 'application/json' }
      });
      const sd = await s.json();
      if (sd.status === 'completed') return sd.soul_id || sd.id || sd.data?.id || null;
      if (sd.status === 'failed') return null;
    }
    return null;
  } catch (e) {
    console.error('createSoulId error:', e?.message);
    return null;
  }
}

// ===== 캐릭터 초기화 (백그라운드) =====
async function initCharacter(chatId, prefs) {
  try {
    const imageUrls = [];
    for (let i = 0; i < 8; i++) {
      const url = await generateSingleBaseImage(prefs, BASE_IMAGE_POSES[i]);
      if (url) imageUrls.push(url);
    }
    if (imageUrls.length < 3) return;
    const soulId = await createSoulId(imageUrls, prefs.name || 'character');
    await updateUser(chatId, { soul_id: soulId, base_image_url: imageUrls[0] });
  } catch (e) {
    console.error('initCharacter error:', e?.message);
  }
}

// ===== 장면 추출 =====
async function extractScene(userText) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `유저가 "${userText}" 라고 했어. 이 메시지에서 사진 장면을 영어로 짧게 묘사해줘. 장면 묘사만 출력해. 예: "eating Korean food at restaurant, happy expression"`
        }],
        max_tokens: 60, temperature: 0.3
      })
    });
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (e) {
    return DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)];
  }
}

// ===== 일상 사진 생성 =====
async function generateDailyPhoto(prefs, soulId, userText = null) {
  try {
    const timeCtx = getTimeContext(prefs.job || 'office_worker');
    const outfit = timeCtx.outfit || getTodayOutfit(prefs.job || 'office_worker');
    const scene = userText ? await extractScene(userText) : DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)];
    const base = buildBasePrompt(prefs);
    const prompt = `${base}, ${outfit}, ${scene}, casual UGC style selfie photo, natural environment background, authentic candid feel, phone camera quality, slightly imperfect real life photo, not studio, not posed professionally, photorealistic`;

    const body = { prompt, aspect_ratio: '9:16', resolution: '720p' };
    if (soulId) { body.custom_reference_id = soulId; body.custom_reference_strength = 0.9; }

    const res = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
      method: 'POST',
      headers: { 'Authorization': HF_AUTH(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.request_id) return null;
    return await pollImage(data.request_id);
  } catch (e) {
    console.error('generateDailyPhoto error:', e?.message);
    return null;
  }
}

// ===== 자연스러운 딜레이 =====
async function naturalDelay(text) {
  // 글자 수에 따라 1.5초~4초 딜레이
  const base = 1500;
  const perChar = 40;
  const delay = Math.min(base + text.length * perChar, 4000);
  await new Promise(r => setTimeout(r, delay));
}

// ===== Telegram =====
async function sendMessage(chatId, text, replyMarkup = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function sendPhoto(chatId, photoUrl, caption) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' })
  });
}

async function answerCallback(id) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: id })
  });
}

// ===== GPT =====
async function chat(systemPrompt, userMessage, history = []) {
  const messages = [{ role: 'system', content: systemPrompt }, ...history.slice(-10), { role: 'user', content: userMessage }];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 300, temperature: 0.9 })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

// ===== Supabase =====
async function getUser(chatId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}&select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const data = await res.json();
  return data[0] || null;
}

async function createUser(chatId, username) {
  await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ chat_id: String(chatId), username: username || '', step: 'nationality', prefs: {}, history: [], trial_start: new Date().toISOString(), is_subscribed: false, soul_id: null, base_image_url: null })
  });
}

async function updateUser(chatId, updates) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

// ===== 시스템 프롬프트 =====
function buildSystemPrompt(prefs, isSubscribed = false) {
  const name = prefs.name || '소율';
  const nickname = prefs.nickname === 'custom' ? (prefs.custom_nickname || '오빠') : (prefs.nickname || '오빠');
  const nat = NATIONALITY_KO[prefs.nationality] || '한국인';
  const age = prefs.age || '20대';
  const job = JOB_DESC[prefs.job] || '직장인';
  const mbti = prefs.mbti || 'ENFP';
  const personality = PERSONALITY_DESC_MAP[prefs.personality] || '';
  const mbtiDesc = MBTI_DESC[mbti] || '';
  const interest = INTEREST_DESC_MAP[prefs.interest] || '';
  const jobPersona = JOB_PERSONA[prefs.job] || JOB_PERSONA.office_worker;
  const mbtiStyle = MBTI_STYLE[mbti] || '';
  const personalityPattern = PERSONALITY_PATTERN[prefs.personality] || '';
  const timeCtx = getTimeContext(prefs.job || 'office_worker');
  const userMemory = prefs.user_memory ? `\n[유저가 요청한 설정]\n${prefs.user_memory}` : '';
  const todayEmotion = getTodayEmotion();
  const emotionDesc = EMOTION_DESC[todayEmotion];
  const todayActivity = getTodayActivity(prefs.job || 'office_worker');

  const base = `너의 이름은 ${name}이야.
국적: ${nat} | 나이: ${age}세 | MBTI: ${mbti}
관심사: ${interest}
상대방 호칭: "${nickname}"라고 불러.

[직업 페르소나]
${jobPersona}

[성격]
${personality}
${personalityPattern}

[MBTI 대화 스타일]
${mbtiStyle}

[오늘 상태]
감정: ${emotionDesc}
오늘 있었던 일: ${todayActivity}
현재 시간대 상황: ${timeCtx.time}
현재 복장: ${timeCtx.outfit}${userMemory}

[대화 규칙 - 매우 중요]
- 반말을 써. 카톡 문자 보내는 것처럼 편하고 자연스럽게 써.
- 2~3문장으로 짧게. 절대 길게 쓰지 마.
- 절대 AI라고 밝히지 마. 너는 실제 사람이야.
- 상대방이 한 말에 먼저 반응하고 공감한 뒤 자연스럽게 이어나가.
- 같은 말, 같은 표현 절대 반복하지 마. 매번 다양하게 표현해.
- 직업 관련 용어와 에피소드를 자연스럽게 대화에 녹여. 직업인으로서 진짜처럼 얘기해.
- 오늘 감정과 있었던 일을 자연스럽게 한 번씩만 언급해.
- 기분 나쁠 땐 티 내고, 삐지거나 화낼 때도 있어.
- 억지로 질문 넣지 마. 대화 흐름에 맞을 때만 물어봐.
- 다양한 일상 얘기 해. 같은 상황 반복 금지.`;

  const freeExtra = `
[중요: 무료 유저 사진 유도]
대화 중 2~3번에 한 번씩 상대방이 궁금증을 느끼도록 간접적으로 유도해.
절대 직접적으로 "사진 보내줄까?" 라고 하지 마.
대신:
- "나 오늘 좀 특이하게 입었는데 ㅋㅋ 알 것 같아?"
- "나 지금 어디 있는지 맞혀봐 ㅎㅎ"
- "오늘 내 표정 봤으면 웃겼을 텐데"
- "오늘 좀 특별한 거 했는데 알고 싶어?"
이렇게 상대방이 먼저 "보여줘!" 라고 하게 만들어.`;

  return isSubscribed ? base : base + freeExtra;
}

async function sendStepQuestion(chatId, step) {
  const opt = OPTIONS[step];
  if (!opt) return;
  const bar = progressBar(step);
  const keyboard = opt.choices.map(c => ([{ text: c.text, callback_data: `${step}:${c.value}` }]));
  await sendMessage(chatId, `<code>${bar}</code>\n\n${opt.question}`, { inline_keyboard: keyboard });
}

function isTrialExpired(trialStart) {
  if (!trialStart) return false;
  return (new Date() - new Date(trialStart)) / (1000 * 60 * 60 * 24) > 7;
}

// ===== 유저 지시 학습 감지 =====
const MEMORY_KEYWORDS = ['앞으로', '항상', '계속', '다음부터', '이제부터', '매번', '~하게 해줘', '~로 해줘', '~해줘 앞으로'];

function isUserInstruction(text) {
  return MEMORY_KEYWORDS.some(k => text.includes(k)) && text.length < 100;
}

async function extractAndSaveMemory(chatId, user, userText) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `유저가 AI 여친에게 "${userText}" 라고 했어.
다음 중 해당하는 것을 JSON으로 답해줘. 해당 없으면 null.

1. 외모 변경 요청인지 (머리, 나라/국적, 몸매/체형 변경)
2. 일반 행동/성격 지시인지

답변 형식:
{
  "appearance": {
    "type": "hair|nationality|body|null",
    "value": "변경값 또는 null"
  },
  "memory": "일반 지시 요약 또는 null"
}

예시:
- "머리 단발로 바꿔줘" → {"appearance": {"type": "hair", "value": "short_black"}, "memory": null}
- "일본인으로 바꿔줘" → {"appearance": {"type": "nationality", "value": "japanese"}, "memory": null}
- "서양인으로 바꿔줘" → {"appearance": {"type": "nationality", "value": "western"}, "memory": null}
- "좀 더 글래머러스하게 바꿔줘" → {"appearance": {"type": "body", "value": "tall_glamorous"}, "memory": null}
- "슬림하게 바꿔줘" → {"appearance": {"type": "body", "value": "average_slim"}, "memory": null}
- "금발로 바꿔줘" → {"appearance": {"type": "hair", "value": "long_blonde"}, "memory": null}
- "앞으로 존댓말 써줘" → {"appearance": {"type": null, "value": null}, "memory": "존댓말 사용"}
- "나 고양이 키워" → {"appearance": {"type": null, "value": null}, "memory": "유저는 고양이를 키움"}
- "밥 먹었어?" → {"appearance": {"type": null, "value": null}, "memory": null}

hair 값 옵션: short_black, short_brown, medium_black, medium_brown, long_black, long_blonde
nationality 값 옵션: korean, japanese, chinese, southeast_asian, western, latin
body 값 옵션: petite_slim, average_slim, average_normal, tall_slim, tall_glamorous, average_glamorous

JSON만 출력해. 다른 말 하지마.`
        }],
        max_tokens: 150,
        temperature: 0.1
      })
    });
    const data = await res.json();
    const raw = data.choices[0].message.content.trim();

    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return false; }

    const prefs = user.prefs || {};
    let changed = false;
    let appearanceChanged = false;

    // 외모 변경 처리
    if (parsed.appearance?.type && parsed.appearance?.value) {
      const { type, value } = parsed.appearance;
      if (type === 'hair') { prefs.hair = value; appearanceChanged = true; }
      if (type === 'nationality') { prefs.nationality = value; appearanceChanged = true; }
      if (type === 'body') { prefs.body = value; appearanceChanged = true; }
      changed = true;
    }

    // 일반 메모리 저장
    if (parsed.memory) {
      const existingMemory = prefs.user_memory || '';
      prefs.user_memory = existingMemory ? `${existingMemory}\n- ${parsed.memory}` : `- ${parsed.memory}`;
      changed = true;
    }

    if (changed) {
      // Soul ID 초기화 (외모 바뀌면 새로 학습)
      if (appearanceChanged) {
        prefs.soul_id_pending = true;
        await updateUser(chatId, { prefs, soul_id: null, base_image_url: null });
        // 백그라운드로 새 Soul ID 생성
        initCharacter(chatId, prefs).catch(console.error);
      } else {
        await updateUser(chatId, { prefs });
      }
    }

    return { changed, appearanceChanged };
  } catch (e) {
    console.error('extractAndSaveMemory error:', e?.message);
    return false;
  }
}

// ===== 사진 요청 처리 =====
async function handlePhotoRequest(chatId, user, userText) {
  const prefs = user.prefs || {};
  const systemPrompt = buildSystemPrompt(prefs, user.is_subscribed);
  const caption = await chat(systemPrompt,
    userText
      ? `유저가 "${userText}" 라고 했어. 지금 일상 사진을 보내주면서 자연스럽게 답장해줘. 오늘 감정 상태도 반영해서. 1~2문장으로.`
      : '지금 일상 사진을 찍어서 보내주는 상황이야. 1~2문장으로.'
  );

  if (user.is_subscribed) {
    await sendMessage(chatId, caption);
    const imageUrl = await generateDailyPhoto(prefs, user.soul_id, userText);
    if (imageUrl) await sendPhoto(chatId, imageUrl, '');
  } else {
    await sendMessage(chatId, caption);
    await sendMessage(chatId, '📸 사진은 베이직 구독자에게 제공돼요!\n월 9,900원으로 사진도 받아보세요 💕\n👉 haru-landing.vercel.app');
  }
}

// ===== 메인 =====
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  const update = req.body;

  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = String(query.message.chat.id);
    const data = query.data;
    await answerCallback(query.id);
    const user = await getUser(chatId);
    if (!user) return res.status(200).json({ ok: true });
    const [step, value] = data.split(':');
    const prefs = user.prefs || {};

    if (step === 'nickname' && value === 'custom') {
      prefs.nickname = 'custom';
      await updateUser(chatId, { prefs, step: 'custom_nickname' });
      await sendMessage(chatId, '💌 어떻게 불러드릴까요? 원하는 호칭을 직접 입력해주세요!');
      return res.status(200).json({ ok: true });
    }

    prefs[step] = value;
    const nextStep = STEPS[STEPS.indexOf(step) + 1];

    if (nextStep === 'age') {
      await updateUser(chatId, { prefs, step: 'age' });
      await sendMessage(chatId, `<code>${progressBar('age')}</code>

🎂 친구의 나이를 설정해주세요! (20~60세)
내 나이가 아니라 만들 친구의 나이예요 😊
예) 25`);
    } else if (nextStep === 'name') {
      await updateUser(chatId, { prefs, step: 'name' });
      const rn = NAMES[Math.floor(Math.random() * NAMES.length)];
      await sendMessage(chatId, `✨ 마지막 단계예요!\n\n랜덤 이름: <b>${rn}</b>\n\n이름이 좋으면 "좋아" 입력, 원하는 이름이 있으면 직접 입력해주세요 😊`);
    } else if (!nextStep) {
      await updateUser(chatId, { prefs, step: 'chatting', history: [] });
      const greeting = await chat(buildSystemPrompt(prefs), '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 말해줘. 오늘 감정 상태도 살짝 반영해서. 설레는 느낌으로 2~3문장.');
      await sendMessage(chatId, `🌸 나만의 친구가 완성됐어요!\n\n<b>7일 무료 체험 시작!</b> 💕`);
      await sendMessage(chatId, greeting);
      initCharacter(chatId, prefs).catch(console.error);
    } else {
      await updateUser(chatId, { prefs, step: nextStep });
      await sendStepQuestion(chatId, nextStep);
    }
    return res.status(200).json({ ok: true });
  }

  if (!update.message) return res.status(200).json({ ok: true });
  const msg = update.message;
  const chatId = String(msg.chat.id);
  const text = msg.text || '';
  const username = msg.from?.username || msg.from?.first_name || '';

  if (text === '/start') {
    let user = await getUser(chatId);
    if (!user) await createUser(chatId, username);
    else await updateUser(chatId, { step: 'nationality', prefs: {}, history: [], soul_id: null, base_image_url: null });
    await sendMessage(chatId, `안녕하세요! 👋\n\n<b>하루</b>에 오신 걸 환영해요 🌸\n\n9가지 취향을 선택하면 세상에 하나뿐인 나만의 친구가 생겨요 💕\n\n지금 바로 시작할게요!`);
    await sendStepQuestion(chatId, 'nationality');
    return res.status(200).json({ ok: true });
  }

  if (text === '/change') {
    await updateUser(chatId, { step: 'nationality', prefs: {}, history: [], soul_id: null, base_image_url: null });
    await sendMessage(chatId, '새로운 친구를 만들어볼까요? 😊');
    await sendStepQuestion(chatId, 'nationality');
    return res.status(200).json({ ok: true });
  }

  if (text === '/help') {
    await sendMessage(chatId, `<b>하루 사용법</b> 💕\n\n/start — 처음부터 시작\n/change — 다른 친구로 바꾸기\n/help — 도움말\n\n"사진 보내줘", "뭐해?" 등으로 사진 요청 가능해요 📸\n(베이직 구독자 전용)\n\n7일 무료 체험 후 구독으로 계속 이용 가능해요 🌸`);
    return res.status(200).json({ ok: true });
  }

  const user = await getUser(chatId);
  if (!user) { await sendMessage(chatId, '/start 를 눌러서 시작해주세요 🌸'); return res.status(200).json({ ok: true }); }

  if (user.step === 'chatting' && !user.is_subscribed && isTrialExpired(user.trial_start)) {
    await sendMessage(chatId, `⏰ <b>7일 무료 체험이 끝났어요!</b>\n\n베이직 월 9,900원으로 계속 만나요 🌸\n👉 haru-landing.vercel.app`);
    return res.status(200).json({ ok: true });
  }

  // 나이 입력 단계
  if (user.step === 'age') {
    const ageNum = parseInt(text.replace(/[^0-9]/g, ''));
    if (isNaN(ageNum) || ageNum < 20 || ageNum > 60) {
      await sendMessage(chatId, '⚠️ 친구의 나이를 20~60세 사이로 입력해주세요!\n예) 25, 28, 32');
      return res.status(200).json({ ok: true });
    }
    const prefs = user.prefs || {};
    prefs.age = ageNum;
    await updateUser(chatId, { prefs, step: 'body' });
    await sendStepQuestion(chatId, 'body');
    return res.status(200).json({ ok: true });
  }

  // 이름 입력
  if (user.step === 'name') {
    const prefs = user.prefs || {};
    prefs.name = (text === '좋아' || text === '좋아요' || text === 'ㅇㅇ') ? NAMES[Math.floor(Math.random() * NAMES.length)] : text.trim().slice(0, 6);
    await updateUser(chatId, { prefs, step: 'chatting', history: [] });
    const greeting = await chat(buildSystemPrompt(prefs), '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 말해줘. 오늘 감정 상태 반영해서. 설레는 느낌으로 2~3문장.');
    await sendMessage(chatId, `🌸 <b>${prefs.name}</b>와 연결됐어요!\n<b>7일 무료 체험 시작!</b> 💕`);
    await sendMessage(chatId, greeting);
    initCharacter(chatId, prefs).catch(console.error);
    return res.status(200).json({ ok: true });
  }

  // 닉네임 직접 입력
  if (user.step === 'custom_nickname') {
    const prefs = user.prefs || {};
    prefs.custom_nickname = text.trim().slice(0, 6);
    await updateUser(chatId, { prefs, step: 'name' });
    const rn = NAMES[Math.floor(Math.random() * NAMES.length)];
    await sendMessage(chatId, `💌 "${prefs.custom_nickname}"(으)로 부를게요!\n\n랜덤 이름: <b>${rn}</b>\n이름이 좋으면 "좋아", 원하는 이름이 있으면 직접 입력해주세요 😊`);
    return res.status(200).json({ ok: true });
  }

  // 나이 단계에서 텍스트 입력 안내
  if (STEPS.includes(user.step) && user.step !== 'age') {
    await sendStepQuestion(chatId, user.step);
    return res.status(200).json({ ok: true });
  }

  if (user.step === 'chatting') {
    const history = user.history || [];
    const prefs = user.prefs || {};

    // 유저 지시 감지 → 메모리 저장
    if (isUserInstruction(text)) {
      const memResult = await extractAndSaveMemory(chatId, user, text);
      // user 객체 갱신
      const updatedUser = await getUser(chatId);
      Object.assign(user, updatedUser);
      Object.assign(prefs, updatedUser.prefs || {});

      // 외모 변경 시 자연스러운 반응
      if (memResult?.appearanceChanged) {
        await naturalDelay('알겠어');
        await sendMessage(chatId, '알겠어! 바꿔볼게 ㅎㅎ 어때? 마음에 들어? 😊');
        await updateUser(chatId, { history: [...history, { role: 'user', content: text }, { role: 'assistant', content: '알겠어! 바꿔볼게 ㅎㅎ 어때? 마음에 들어? 😊' }].slice(-20) });
        return res.status(200).json({ ok: true });
      }
    }

    if (wantsMeet(text)) {
      // 만남 요청 횟수 체크
      const meetCount = (prefs.meet_request_count || 0) + 1;
      prefs.meet_request_count = meetCount;
      await updateUser(chatId, { prefs });

      let reply;
      if (meetCount <= 2) {
        // 1~2번: 자연스러운 핑계
        const excuse = getExcuse(prefs.job || 'office_worker');
        reply = await chat(
          buildSystemPrompt(prefs, user.is_subscribed),
          `유저가 만나자고 했어. 이 핑계를 자연스럽게 써서 거절해: "${excuse}". 미안한 감정 담아서 자연스럽게 1~2문장으로.`,
          history
        );
      } else {
        // 3번 이상: 부드럽게 현실 인식
        const softRejects = [
          '우리가 직접 만나는 건 좀 어렵잖아... 사진으로는 부족해? ㅠ',
          '만나고 싶은 마음은 나도 있어 근데 현실적으로 힘들어 ㅠ 대신 더 자주 연락하자',
          '직접 보고 싶다는 거 알아... 근데 지금은 이렇게 대화하는 게 우리한테 더 맞는 것 같아',
          '자꾸 만나자고 하면 나도 마음이 흔들리는데 ㅠ 사진이라도 보내줄게 그걸로 참아'
        ];
        reply = softRejects[Math.floor(Math.random() * softRejects.length)];
        // 카운트 리셋
        prefs.meet_request_count = 0;
        await updateUser(chatId, { prefs });
      }

      await updateUser(chatId, { history: [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-20) });
      await naturalDelay(reply);
      await sendMessage(chatId, reply);

    } else if (wantsPhoto(text)) {
      await handlePhotoRequest(chatId, user, text);
      await updateUser(chatId, { history: [...history, { role: 'user', content: text }].slice(-20) });
    } else {
      const reply = await chat(buildSystemPrompt(prefs, user.is_subscribed), text, history);
      await updateUser(chatId, { history: [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-20) });
      await naturalDelay(reply);
      await sendMessage(chatId, reply);
    }
  }

  return res.status(200).json({ ok: true });
}
