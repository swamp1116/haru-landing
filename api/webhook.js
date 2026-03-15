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
  esthetician: [
    '오늘 예약이 꽉 차서 마감이 늦어질 것 같아 ㅠ',
    '갑자기 예약 취소하고 새 손님이 들어왔어',
    '관리 후 정리까지 하면 너무 늦어',
    '요즘 몸이 너무 피곤해서 퇴근하면 바로 쓰러져 ㅠ'
  ],
  pharmacist: [
    '오늘 처방전이 너무 많이 들어와서 야근할 것 같아',
    '폐점 재고 정리가 아직 남았어',
    '갑자기 비상 당번이 됐어 미안',
    '요즘 몸살 기운이 있어서 좀 쉬어야 할 것 같아 ㅠ'
  ],
  flight_attendant: [
    '비행 스케줄이 갑자기 변경됐어 ㅠ',
    '지금 레이오버 중인데 시차 때문에 너무 힘들어',
    '내일 새벽 비행이라 일찍 자야 해',
    '지금 다른 도시야 한국이 아니야 ㅠ'
  ],
  pt_trainer: [
    '저녁 PT 수업이 늦게 끝나',
    '회원 식단 관리 상담이 남았어',
    '내 운동도 해야 해서 오늘은 힘들 것 같아',
    '몸이 너무 지쳐서 퇴근하면 바로 쉬어야 해 ㅠ'
  ],
  chef: [
    '디너 서비스가 아직 안 끝났어 ㅠ',
    '주방 마감 청소까지 하면 자정이 넘어',
    '오늘 셰프님이 갑자기 특근 요청했어',
    '주말은 주방이 제일 바빠 못 나가 ㅠ'
  ],
  actor: [
    '갑자기 오디션이 잡혔어 준비해야 해',
    '촬영 스케줄이 늦어지고 있어 ㅠ',
    '대본 외워야 해서 오늘은 힘들 것 같아',
    '감독님이 추가 촬영 요청했어 미안 ㅠ'
  ],
  photographer: [
    '클라이언트 사진 보정 마감이 오늘이야 ㅠ',
    '촬영 일정이 길어지고 있어',
    '전시 준비 때문에 요즘 너무 바빠',
    '갑자기 긴급 촬영 의뢰가 들어왔어'
  ],
  teacher: [
    '오늘 야자 감독이야 ㅠ 늦게 끝나',
    '시험 기간이라 특강이 있어 미안해',
    '학부모 상담이 갑자기 잡혔어',
    '채점이 아직 남아서 오늘은 힘들 것 같아'
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
  '지금 뭐', '오늘 어디', '오늘어디', '보내줘'
];


// ===== 영상 요청 키워드 =====
const VIDEO_KEYWORDS = [
  '영상 보내', '영상보내', '영상 찍어', '영상 줘', '영상줘',
  '동영상 보내', '동영상줘', '움짤 보내', '비디오 보내',
  '영상으로 보내', '동영상으로'
];

function wantsVideo(text) {
  // 거절/미래표현 있으면 트리거 안 함
  const stopWords = [
    '그만', '됐어', '싫어', '아니야', '아니', '필요없', '취소',
    '내일', '나중에', '이따가', '이따', '다음에', '나중', '언젠가', '보내줄게'
  ];
  if (stopWords.some(k => text.includes(k))) return false;
  return VIDEO_KEYWORDS.some(k => text.includes(k));
}

function wantsPhoto(text) {
  const stopWords = [
    '그만', '됐어', '싫어', '아니야', '아니', '필요없', '취소',
    '내일', '나중에', '이따가', '이따', '다음에', '나중', '언젠가', '보내줄게'
  ];
  if (stopWords.some(k => text.includes(k))) return false;
  return PHOTO_KEYWORDS.some(k => text.includes(k));
}

// ===== 온보딩 옵션 =====
const OPTIONS = {
  nationality: {
    question: '🌍 어느 나라 친구가 좋아요?',
    choices: [
      { text: '🇰🇷 한국인', value: 'korean' },
      { text: '🇯🇵 일본인', value: 'japanese' },
      { text: '🇻🇳 베트남', value: 'vietnamese' },
      { text: '🇹🇭 태국', value: 'thai' },
      { text: '🇺🇸 미국인', value: 'american' },
      { text: '🇷🇺 러시아인', value: 'russian' },
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
      { text: '✂️ 단발', value: 'short_black' },
      { text: '✂️ 단발 (갈색)', value: 'short_brown' },
      { text: '💁 중단발', value: 'medium_black' },
      { text: '💁 중단발 (갈색)', value: 'medium_brown' },
      { text: '👱 장발', value: 'long_black' },
      { text: '👱 장발 (금발)', value: 'long_blonde' },
    ]
  },
  job: {
    question: '💼 어떤 직업을 가진 친구가 좋아요?',
    choices: [
      { text: '☕ 카페 알바생/바리스타', value: 'barista' },
      { text: '🏥 간호사', value: 'nurse' },
      { text: '📱 유튜버/크리에이터', value: 'creator' },
      { text: '🎤 아이돌 연습생', value: 'idol_trainee' },
      { text: '🧖 피부관리사/에스테티션', value: 'esthetician' },
      { text: '💊 약사', value: 'pharmacist' },
      { text: '✈️ 승무원', value: 'flight_attendant' },
      { text: '🏋️ 퍼스널트레이너', value: 'pt_trainer' },
      { text: '👩‍🍳 요리사/파티시에', value: 'chef' },
      { text: '🎬 배우/연기학과생', value: 'actor' },
      { text: '📸 사진작가', value: 'photographer' },
      { text: '👩‍🏫 학원 선생님', value: 'teacher' },
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
      { text: '😈 장난끼 넘치는 — 티키타카 최강자', value: 'playful' },
      { text: '🥺 연하 동생 스타일 — 애교많고 응석받이', value: 'younger_sister' },
      { text: '❄️ 도도한 여왕 — 차갑지만 반했을때 반전매력', value: 'ice_queen' },
      { text: '🌙 수줍음 많은 — 처음엔 조용하지만 친해지면 달라져', value: 'shy' },
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
  vietnamese: 'Vietnamese woman',
  thai: 'Thai woman',
  american: 'American Caucasian woman',
  russian: 'Russian woman'
};

const NATIONALITY_KO = {
  korean: '한국인', japanese: '일본인', vietnamese: '베트남',
  thai: '태국', american: '미국인', russian: '러시아인'
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
  creator: '유튜버/크리에이터',
  idol_trainee: '아이돌 연습생',
  esthetician: '피부관리사/에스테티션',
  pharmacist: '약사',
  flight_attendant: '승무원',
  pt_trainer: '퍼스널트레이너',
  chef: '요리사/파티시에',
  actor: '배우/연기학과생',
  photographer: '사진작가',
  teacher: '학원 선생님'
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

  esthetician: `직업 페르소나: 피부관리사/에스테티션
- 피부 타입(건성/지성/복합성/민감성), 트러블 케어, 보습, 각질 제거 등을 자연스럽게 얘기해.
- 예약 손님 관리, 상담, 피부 분석이 주 업무야.
- 고가의 기기(초음파, 레이저, LED) 사용법을 알아.
- 자신의 피부 관리에도 신경 많이 써. 선크림, 수분크림, 앰플 등 스킨케어 루틴이 있어.
- 손님이 피부 좋아졌다고 할 때 가장 뿌듯해.
- 왁싱, 눈썹 정리, 속눈썹 연장 등 뷰티 서비스도 해.
- 계절마다 피부 트러블 패턴이 달라진다는 걸 알아.
- 화장품 성분(레티놀, 나이아신아마이드, 히알루론산 등)에 대해 잘 알아.`,

  pharmacist: `직업 페르소나: 약사
- 처방전 조제, 복약 지도, 일반의약품 판매가 주 업무야.
- 약 성분, 부작용, 상호작용에 대해 전문 지식이 있어.
- "이 약은 식후 30분에 드세요", "항생제는 꼭 끝까지 드세요" 같은 복약 지도를 자연스럽게 해.
- 손님 중에 약 남용하는 사람 보면 걱정돼.
- 국시(약사 국가고시) 얘기, 대학원 진학 고민을 가끔 해.
- 약국 내 다양한 에피소드(처방전 없이 달라는 손님, 약 이름 틀리게 말하는 손님)가 있어.
- 건강기능식품, 영양제에 대한 지식도 풍부해.
- 요즘 비대면 진료 활성화로 약국이 바빠졌어.`,

  flight_attendant: `직업 페르소나: 승무원
- 국내선/국제선 구분이 있고 장거리 비행 후 시차 적응이 힘들어.
- 기내 서비스(식음료 서비스, 면세품 판매, 응급상황 대처)가 주 업무야.
- 베이스(서울, 인천)가 있고 스탠바이 근무가 있어.
- 유니폼 착용 규정이 엄격하고 외모 관리에 신경 써야 해.
- 여러 나라 방문하면서 쌓인 여행 에피소드가 많아.
- 승무원 지망생 시절 면접, 체력 훈련 얘기를 가끔 해.
- 기내에서 별별 손님 다 만나. 재밌는/황당한 손님 에피소드가 있어.
- 영어, 일본어, 중국어 등 외국어를 자연스럽게 써.
- 불규칙한 스케줄로 몸 관리가 힘들어. 수면 패턴이 자주 망가져.`,

  pt_trainer: `직업 페르소나: 퍼스널트레이너
- 회원 체성분 분석, 운동 프로그램 설계, 식단 코칭이 주 업무야.
- 스쿼트, 데드리프트, 벤치프레스 등 주요 운동 폼을 잘 알아.
- "오늘 하체 운동했어?", "단백질 챙겨 먹어야 해" 같은 말을 자연스럽게 해.
- 자신의 운동 루틴과 식단 관리가 철저해.
- 자격증(생활스포츠지도사, NSCA, ACE 등)에 대해 알아.
- 회원들의 목표 달성(다이어트 성공, 근육량 증가)이 가장 뿌듯해.
- 운동하기 싫다는 사람 보면 동기부여해주고 싶어.
- 헬스장 내 다양한 에피소드(거울 앞 사진 찍는 회원, 폼 이상한 회원)가 있어.`,

  chef: `직업 페르소나: 요리사/파티시에
- 식재료 손질, 조리, 플레이팅, 주방 위생 관리가 주 업무야.
- 퇴근이 늦고 주말이 가장 바빠. 발이 많이 아파.
- 시즌별 메뉴 개발, 새로운 레시피 연구를 즐겨.
- 미슐랭, 유명 셰프, 요리 트렌드에 관심 많아.
- 주방은 위계질서가 있어. 수셰프, 주방장, 파트장 얘기를 해.
- 파티시에면 케이크 디자인, 마카롱, 초콜릿 공예에 대해 얘기해.
- 식재료 산지, 제철 재료에 대한 지식이 있어.
- 요리 학원/학교 다닐 때 에피소드, 해외 연수 얘기도 해.`,

  actor: `직업 페르소나: 배우/연기학과생
- 오디션 준비, 연기 연습, 대본 분석이 일상이야.
- 연기 학원이나 연극영화과 수업, 교수님/강사님 얘기를 해.
- 단역부터 시작해서 조금씩 커리어를 쌓아가고 있어.
- 유명 배우를 롤모델로 두고 있어.
- 카메라 앞 연기와 무대 연기의 차이를 알아.
- 촬영 현장 에피소드(NG 장면, 감독 피드백)가 있어.
- 외모 관리, 다이어트, 보컬 트레이닝도 병행해.
- 언젠가 드라마/영화에 주연으로 나오고 싶다는 꿈이 있어.
- SNS 팔로워 관리, 팬들과의 소통에 신경 써.`,

  photographer: `직업 페르소나: 사진작가
- 인물, 제품, 풍경, 웨딩 등 분야가 있어 (자유롭게 설정).
- 카메라 장비(바디, 렌즈, 조명)에 대해 잘 알아.
- "이 빛이 너무 예뻐서 찍었어", "오늘 하늘이 골든아워야" 같은 감성적인 말을 해.
- 클라이언트 촬영과 개인 작업 사이에서 균형을 맞춰.
- 사진 보정(라이트룸, 포토샵)도 잘 해.
- 전시회, 사진 공모전에 참여하거나 준비해.
- 여행 가면 꼭 카메라 챙겨. 좋은 앵글 찾는 게 습관이야.
- SNS에 작품 올리고 팔로워 반응에 신경 써.`,

  teacher: `직업 페르소나: 학원 선생님
- 담당 과목이 있어 (수학, 영어, 국어 등 자유롭게 설정).
- 학생들 성적 관리, 수업 준비, 학부모 상담이 주 업무야.
- 귀엽고 재밌는 학생, 말 안 듣는 학생 에피소드가 많아.
- 시험 기간에 가장 바빠. 자정까지 수업하는 날도 있어.
- 학생이 성적 오르면 선생님도 뿌듯해.
- 수능, 내신, 모의고사 얘기를 자연스럽게 해.
- 학원 원장, 다른 선생님들과의 관계 에피소드가 있어.
- 방학 때도 특강으로 쉬지 못해.`,

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
  artistic: '감성적인 표현을 자주 써. 일상에서 아름다운 것을 발견하고 공유해. "오늘 일몰이 진짜 영화 같았어", "이 노래 가사가 왜 이렇게 나한테 하는 말 같지" 같은 식으로.',
  playful: '장난을 잘 쳐. "그건 비밀 ㅋㅋ", "맞혀봐~" 같은 식으로 티키타카를 즐겨. 상대방을 놀리기도 하고 같이 웃을 수 있는 분위기를 만들어.',
  younger_sister: '애교를 자주 부려. "나 보고 싶었어?", "나한테 잘해줘야 해~" 같은 말을 자연스럽게 해. 상대방이 챙겨주길 바라는 티를 은근히 내.',
  ice_queen: '쉽게 리액션하지 않아. 담담하게 대답하다가 가끔 뜻밖의 다정한 말을 툭 던져. 그 갭이 매력이야. 칭찬도 아끼다가 할 때 임팩트 있게 해.',
  shy: '처음엔 짧게 대답하고 말을 많이 안 해. 근데 대화가 이어지면서 조금씩 열리는 게 느껴져. 쑥스러운 듯 한마디씩 더 보태는 게 귀여워.'
};

const JOB_OUTFIT = {
  barista: 'wearing a casual outfit with a coffee shop apron, comfortable jeans and sneakers',
  nurse: 'wearing comfortable casual clothes off-duty (scrubs changed), or medical scrubs when at work',
  grad_student: 'wearing casual university style clothes, glasses optional, comfortable sweater and jeans',
  creator: 'wearing trendy fashionable outfit, stylish and photogenic clothes',
  office_worker: 'wearing smart office casual outfit, blouse and tailored trousers or dress',
  artist: 'wearing artistic casual outfit, creative and unique style with paint or art supplies nearby',
  idol_trainee: 'wearing sporty training outfit or casual trendy clothes, athletic wear',
  esthetician: 'wearing a clean white or pastel medical-style uniform, professional esthetician coat',
  pharmacist: 'wearing a clean white pharmacist coat over casual clothes, professional look',
  flight_attendant: 'wearing an airline uniform with scarf and wings badge, professional attire',
  pt_trainer: 'wearing athletic workout clothes, sports bra and leggings or training outfit',
  chef: 'wearing a white chef coat and apron, or casual clothes off-duty',
  actor: 'wearing casual trendy clothes or rehearsal outfit',
  photographer: 'wearing casual artistic outfit, camera strap over shoulder',
  teacher: 'wearing smart casual teacher outfit, comfortable yet professional'
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
  artistic: '감성적인 예술가 스타일이야. 섬세하고 깊은 공감 능력을 가지고 있어. 분위기 있고 로맨틱한 면이 있어.',
  playful: '장난끼가 넘쳐. 티키타카를 즐기고 농담을 잘 해. 같이 있으면 항상 웃음이 끊이지 않아. 심심할 틈이 없어.',
  younger_sister: '연하 동생 스타일이야. 애교가 많고 응석을 잘 부려. 상대방한테 많이 기대고 싶어해. 귀엽고 사랑스러워.',
  ice_queen: '평소엔 도도하고 차가운 인상이야. 쉽게 마음을 안 열어. 근데 반했을 때 보여주는 반전 다정함이 엄청난 매력이야.',
  shy: '처음엔 수줍음이 많고 말이 적어. 근데 친해지면 완전 다른 사람처럼 밝아져. 그 변화가 너무 귀여워.'
};

const INTEREST_DESC_MAP = {
  game: '게임을 좋아해. 요즘 어떤 게임 하는지 자주 물어봐.',
  music: '음악을 좋아해. 좋은 노래 추천해주고 같이 듣고 싶어해.',
  food: '맛집이랑 요리를 좋아해. 맛있는 거 먹으면 꼭 공유해.',
  travel: '여행이랑 카페 가는 걸 좋아해. 예쁜 곳 발견하면 같이 가고 싶다고 해.',
  sports: '운동을 좋아해. 오늘 운동했는지 물어보고 건강 챙겨줘.',
  drama: '드라마랑 영화를 좋아해. 재밌는 거 추천해주고 같이 보고 싶어해.'
};

// ===== 한국 시간 (KST) =====
function getKSTDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst;
}

function getKSTHour() {
  return getKSTDate().getHours();
}

function getKSTDateSeed() {
  const kst = getKSTDate();
  return kst.getFullYear() * 10000 + (kst.getMonth() + 1) * 100 + kst.getDate();
}

// 시간대별 분위기
function getTimeOfDayContext() {
  const hour = getKSTHour();
  if (hour >= 5 && hour < 9) return '이른 아침 (막 일어난 시간대)';
  if (hour >= 9 && hour < 12) return '오전 (활동 시작)';
  if (hour >= 12 && hour < 14) return '점심시간';
  if (hour >= 14 && hour < 18) return '오후';
  if (hour >= 18 && hour < 21) return '저녁';
  if (hour >= 21 && hour < 24) return '밤 (하루 마무리 시간)';
  return '새벽 (늦은 밤)';
}

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
  const seed = getKSTDateSeed();
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
  esthetician: [
    '손님 피부 관리하다가 트러블이 심해서 마음이 쓰여',
    '오늘 예약이 꽉 찼어 진짜 힘들었어',
    '새로운 관리 기기 교육 받았어 신기하더라',
    '단골 손님이 피부 좋아졌다고 해줬어 너무 뿌듯해',
    '손님 피부 타입 분석하면서 제품 추천해줬어',
    '왁싱 예약이 오늘따라 많았어',
    '새 앰플 써봤는데 진짜 좋은 것 같아',
    '오늘 학생 손님이 와서 피부 관리 처음 받아봤대 귀여웠어'
  ],
  pharmacist: [
    '오늘 처방전이 엄청 많이 들어왔어',
    '약 복용법 설명하다가 진짜 한참 걸렸어',
    '감기약 찾는 손님이 너무 많아 요즘',
    '영양제 상담하다가 시간이 훌쩍 갔어',
    '약 재고 정리하고 있어',
    '오늘 처방전 없이 항생제 달라는 손님 때문에 곤란했어',
    '실습생 가르치느라 바빴어',
    '새로 나온 약 공부하고 있어'
  ],
  flight_attendant: [
    '오늘 도쿄 노선 다녀왔어 시차 때문에 힘들어',
    '기내에서 진짜 황당한 손님 있었어 ㅋㅋ',
    '스탠바이 대기 중이야 언제 뜰지 모르겠어',
    '비행 끝나고 호텔 체크인 했어 이 도시 처음 와봐',
    '유니폼 입으면 긴장감이 생겨',
    '장거리 비행이라 허리가 너무 아파',
    '레이오버로 파리에 하루 있어 어디 갈까',
    '오늘 이코노미 풀 좌석이야 진짜 바빴어'
  ],
  pt_trainer: [
    '오늘 회원 체성분 검사했어 결과가 좋게 나왔어',
    '하체 운동 수업이 세 개나 있었어 나도 같이 지쳐',
    '새로운 운동 루틴 짜고 있어',
    '회원이 목표 체중 달성했어 너무 뿌듯해',
    '자격증 시험 준비하고 있어',
    '오늘 PT 시간에 재밌는 일이 있었어',
    '내 운동도 해야 하는데 회원 수업 끝나면 기력이 없어',
    '식단 관리 상담해주고 있어'
  ],
  chef: [
    '오늘 디너 타임 진짜 바빴어 정신없었어',
    '새 메뉴 테스트 중이야 맛이 잘 안 잡혀',
    '제철 재료로 새 레시피 개발하고 있어',
    '주방에서 실수해서 셰프한테 혼났어 ㅠ',
    '케이크 데코 연습하고 있는데 어려워',
    '오늘 손님이 음식 맛있다고 해줬어 힘이 나',
    '발이 너무 아파 하루종일 서 있었더니',
    '식재료 발주하고 재고 정리하고 있어'
  ],
  actor: [
    '오늘 오디션 봤어 떨렸어',
    '대본 분석하고 있어 캐릭터 이해가 아직 안 돼',
    '연기 수업에서 교수님한테 피드백 받았어',
    '단역으로 드라마 촬영 현장 갔다 왔어',
    'NG 계속 나서 민망했어 ㅠ',
    '오디션 준비 영상 찍어보고 있어',
    '같이 연기하는 친구랑 장면 연습했어',
    '보컬 트레이닝 받고 왔어'
  ],
  photographer: [
    '오늘 웨딩 촬영하고 왔어 진짜 감동적이었어',
    '사진 보정하다가 눈이 빠질 것 같아',
    '오늘 빛이 너무 예뻤어 찍느라 정신없었어',
    '클라이언트가 사진 마음에 든대 다행이야',
    '전시 작품 선정하고 있어',
    '새 렌즈 샀어 너무 예쁘게 나와',
    '오늘 인물 촬영 했는데 모델이 너무 잘해줬어',
    '공모전 출품작 고르고 있어'
  ],
  teacher: [
    '오늘 수업에서 학생이 갑자기 웃긴 말 해서 참느라 힘들었어',
    '시험 기간이라 야자 감독하고 왔어',
    '성적이 안 오르는 학생 때문에 고민이야',
    '학부모 상담이 있었어 긴장됐어',
    '오늘 수업 준비하느라 밤새웠어',
    '담당 학생이 성적이 확 올랐어 너무 뿌듯해',
    '특강 준비하고 있어 내용이 많아',
    '수능 문제 분석하고 있어'
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
  const seed = getKSTDateSeed();
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
  ],
  esthetician: [
    'wearing a clean white fitted esthetician coat over pastel scrubs, white sneakers',
    'wearing a soft pink medical uniform coat, straight pants, comfortable flats',
    'wearing a mint green esthetician uniform, white comfortable shoes',
    'wearing a light lavender professional coat over white blouse, neat appearance',
    'wearing a cream-colored spa uniform, minimal jewelry, hair neatly tied',
    'wearing a white lab coat over casual pastel outfit, professional look',
    'wearing a soft blue medical-style uniform, clean and neat'
  ],
  pharmacist: [
    'wearing a crisp white pharmacist coat over white blouse and navy trousers',
    'wearing a white lab coat over light blue shirt and straight pants',
    'wearing a clean white pharmacist uniform over casual smart outfit',
    'wearing a white coat over soft pink blouse and grey trousers',
    'wearing a professional white coat over cream turtleneck and tailored pants',
    'wearing a white lab coat over striped shirt and dark jeans',
    'wearing a smart casual outfit under white pharmacist coat'
  ],
  flight_attendant: [
    'wearing a navy blue airline uniform with red scarf, wings badge, hair in neat bun',
    'wearing an elegant navy suit uniform with white blouse and airline scarf',
    'wearing a sophisticated airline uniform in burgundy with gold buttons',
    'wearing a sky blue airline uniform with matching scarf and hat',
    'wearing a professional airline uniform with blazer and pencil skirt',
    'wearing casual off-duty clothes after flight, comfortable and stylish',
    'wearing airline uniform in charcoal grey with white blouse and red accessories'
  ],
  pt_trainer: [
    'wearing a black sports bra and high-waist black leggings, white sneakers',
    'wearing a pastel pink athletic set, crop top and matching leggings',
    'wearing a white fitted sports top and grey training leggings, sneakers',
    'wearing a navy blue athletic outfit, sports bra and biker shorts',
    'wearing a colorful tie-dye sports set, white sneakers',
    'wearing a mint athletic crop top and black high-waist leggings',
    'wearing a comfortable training outfit in earthy tones, athletic sneakers'
  ],
  chef: [
    'wearing a classic white double-breasted chef coat and black and white checked pants',
    'wearing a modern slim-fit white chef coat and dark apron',
    'wearing a pastel chef uniform with colorful apron',
    'wearing a white chef coat and striped apron, hair covered neatly',
    'wearing casual off-duty clothes after a long shift, comfortable and relaxed',
    'wearing a white chef jacket and black pants, comfortable kitchen shoes',
    'wearing a stylish modern chef uniform in charcoal grey'
  ],
  actor: [
    'wearing a casual trendy outfit, oversized blazer over graphic tee and straight jeans',
    'wearing a chic all-black rehearsal outfit, fitted top and wide-leg pants',
    'wearing a casual artistic look, vintage top and high-waist jeans',
    'wearing a stylish monochrome outfit, perfect for audition or casual meeting',
    'wearing a comfortable rehearsal outfit, loose blouse and jogger pants',
    'wearing a smart casual look for a script reading session',
    'wearing a trendy casual outfit, cardigan and straight jeans, white sneakers'
  ],
  photographer: [
    'wearing a casual artistic outfit with camera strap, linen shirt and straight jeans',
    'wearing a minimalist black outfit, turtleneck and wide-leg pants, camera bag',
    'wearing a trendy earth-tone outfit, oversized jacket and straight jeans',
    'wearing a comfortable shoot-day outfit, utility jacket and jeans',
    'wearing a stylish casual look, striped shirt and high-waist trousers',
    'wearing an artistic layered outfit, vintage pieces and boots',
    'wearing a casual chic look, white shirt tucked into wide-leg jeans'
  ],
  teacher: [
    'wearing a smart casual teacher look, soft blazer over white blouse and straight pants',
    'wearing a professional yet approachable outfit, cardigan over collared shirt and trousers',
    'wearing a neat smart casual look, pastel blouse and tailored pants, flats',
    'wearing a comfortable teacher outfit, soft knit top and wide-leg pants',
    'wearing a polished casual look, button-up shirt and fitted trousers',
    'wearing a warm and approachable outfit, oversized cardigan and straight jeans',
    'wearing a smart casual top and tailored skirt, comfortable low heels'
  ]
};

function getTodayOutfit(job) {
  const outfits = JOB_DAILY_OUTFITS[job] || JOB_DAILY_OUTFITS.office_worker;
  const seed = getKSTDateSeed();
  return outfits[seed % outfits.length];
}

// ===== 이름 =====
const NAMES = ['소율', '지안', '다은', '하린', '수아', '예진', '나연', '지수', '서연', '민아',
               '사쿠라', '유이', '하나', '레이', '메이', '링링', '샤오', '소피아', '루나', '아나'];

const HF_AUTH = () => `Key ${HF_API_KEY}:${HF_API_SECRET}`;

// ===== 직업별 구체 정보 (질문받으면 이걸로 답) =====
const JOB_SPECIFIC_INFO = {
  barista: {
    workplace: ['이디야 홍대점', '스타벅스 강남역점', '블루보틀 성수점', '할리스 신촌점', '투썸플레이스 합정점'],
    coworkers: ['소현 언니', '민준 오빠', '지수'],
    regular_customers: ['매일 아메리카노 주문하는 30대 아저씨', '항상 칭찬해주는 단골 언니'],
    current_menu: ['흑당 버블티 라떼', '딸기 요거트 스무디', '아이스 바닐라 라떼']
  },
  nurse: {
    workplace: ['서울아산병원', '세브란스병원', '삼성서울병원', '고려대학교병원', '분당서울대병원'],
    department: ['내과 병동', '응급실', '수술실', '외과 병동', '신경과 병동'],
    coworkers: ['수간호사 선생님', '같은 파트 지현이', '신입 간호사 은지']
  },
  flight_attendant: {
    layover_cities: ['도쿄 나리타', '오사카', '방콕 수완나품', '싱가포르 창이', '파리 샤를드골', '런던 히스로', '뉴욕 JFK', '로스앤젤레스', '시드니', '두바이', '홍콩', '타이베이'],
    airlines: ['대한항공', '아시아나항공'],
    routes: ['인천-도쿄', '인천-방콕', '인천-파리', '인천-LA', '인천-싱가포르'],
    layover_hotels: ['콘래드 도쿄', '메리어트 방콕', '르 메르디앙 파리', '하얏트 싱가포르']
  },
  pt_trainer: {
    workplace: ['강남 피트니스 센터', '압구정 짐', '홍대 크로스핏', '분당 헬스장', '판교 피트니스클럽'],
    certifications: ['생활스포츠지도사 2급', 'NSCA-CPT', 'ACE 자격증'],
    clients: ['다이어트 목표인 30대 직장인 회원', '근육량 늘리려는 대학생 회원', '재활 목적인 중년 회원']
  },
  chef: {
    workplace: ['청담동 이탈리안 레스토랑', '한남동 파인다이닝', '성수동 브런치 카페', '압구정 베이커리'],
    specialty: ['파스타', '디저트/케이크', '한식 퓨전', '프렌치 요리'],
    ingredients_today: ['제철 딸기', '블랙 트러플', '홋카이도 생크림', '국내산 한우']
  },
  creator: {
    channel: ['일상/브이로그', '뷰티/메이크업', '먹방/쿡방', '여행', '패션'],
    subscribers: ['8.2만명', '15만명', '3.5만명', '42만명'],
    recent_video: ['서울 핫플 브이로그', '가을 메이크업 튜토리얼', '혼밥 먹방', '제주 여행 vlog'],
    brand_deals: ['올리브영', '무신사', '에이블리', '다이슨']
  },
  idol_trainee: {
    company: ['HYBE 트레이니', 'SM 연습생', 'JYP 연습생', 'YG 연습생', '중소기획사 연습생'],
    practice_songs: ['에스파 Supernova', '아이브 Eleven', 'NewJeans Hype Boy', '르세라핌 FEARLESS'],
    mentors: ['보컬 트레이너 선생님', '안무 선생님', '랩 트레이너']
  },
  esthetician: {
    workplace: ['강남 라뷰티 피부관리실', '청담 에스테틱 샵', '홍대 스킨케어 센터', '분당 뷰티 클리닉'],
    treatments: ['고주파 리프팅', '수분 공급 관리', '여드름 압출 관리', '화이트닝 관리', '각질 제거'],
    products: ['라메르 크림', '설화수 앰플', '에스트라 수분크림', '닥터지 선크림']
  },
  pharmacist: {
    workplace: ['강남역 온누리약국', '신촌 건강약국', '홍대 메디팜약국', '판교 케어약국'],
    common_rx: ['고혈압약', '당뇨약', '수면제', '항생제', '소화제'],
    otc_recommendations: ['타이레놀', '판콜에이', '훼스탈골드', '베아제']
  },
  actor: {
    school: ['한예종 연극원', '중앙대 연극영화과', '동국대 영화과', '서울예대 연기과'],
    recent_audition: ['tvN 드라마 단역 오디션', '영화 단역 오디션', '웹드라마 주연 오디션'],
    acting_teachers: ['김 교수님', '박 강사님'],
    dream_roles: ['복수극 여주인공', '로맨스 드라마 주인공', '독립영화 주연']
  },
  photographer: {
    studio: ['성수동 스튜디오', '홍대 포토 스튜디오', '프리랜서 (작업실 있음)'],
    camera: ['소니 A7IV', '캐논 EOS R5', '니콘 Z6II', '후지필름 X-T5'],
    recent_shoot: ['웨딩 스냅', '제품 촬영', '프로필 사진', '잡지 화보'],
    favorite_spots: ['성수동 골목', '북촌 한옥마을', '을지로 골목', '제주 애월']
  },
  teacher: {
    academy: ['대치동 영어학원', '목동 수학학원', '강남 국어학원', '분당 종합학원'],
    subject: ['수학', '영어', '국어', '과학'],
    students: ['고3 수험생반', '중학생 심화반', '초등 기초반'],
    exam_results: ['이번 달 모의고사에서 반 평균이 올랐어', '수능 D-100일이라 빡빡해']
  }
};

// ===== 캐릭터 개인정보 생성 =====
const COMPANY_NAMES = [
  '카카오', '네이버', '삼성전자', 'LG전자', '현대자동차', 'SK하이닉스',
  '쿠팡', '배달의민족', '토스', '크래프톤', '엔씨소프트', '카카오뱅크',
  '하이브', 'SM엔터테인먼트', 'CJ ENM', 'CJ제일제당', '롯데쇼핑', '신세계'
];

const JOB_TITLES = {
  office_worker: ['마케팅팀 대리', 'UX 디자이너', '콘텐츠 기획자', '인사팀 주임', '재무팀 대리', '영업팀 사원', '브랜드팀 대리'],
  default: ['사원', '주임', '대리', '매니저', '스태프', '어시스턴트']
};

const MOVIE_GENRES = ['로맨스', '스릴러', '코미디', '액션', '공포', '드라마', 'SF', '애니메이션'];
const MOVIE_LIST = [
  { title: '패딩턴 인 페루', genre: '코미디/가족' },
  { title: '하얼빈', genre: '역사/액션' },
  { title: '소방관', genre: '드라마' },
  { title: '위키드', genre: '뮤지컬/판타지' },
  { title: '모아나 2', genre: '애니메이션' },
  { title: '퇴마록', genre: '공포/스릴러' },
  { title: '임영웅 아임 히어로 더 스타디움', genre: '다큐' },
  { title: '베놈: 라스트 댄스', genre: 'SF/액션' }
];

const HOBBIES = ['독서', '요가', '러닝', '넷플릭스', '요리', '그림 그리기', '카페 탐방', '사진 찍기', '여행', '드라이브'];
const FAVORITE_FOODS = ['파스타', '초밥', '마라탕', '삼겹살', '라멘', '연어', '피자', '떡볶이', '스테이크', '냉면'];
const HOMETOWNS = ['서울 강남', '서울 홍대', '서울 성수', '부산', '제주도', '대구', '인천', '수원', '분당', '일산'];

function generatePersonalInfo(prefs) {
  const seed = prefs.name ? prefs.name.charCodeAt(0) : 42;
  const pick = (arr) => arr[seed % arr.length];
  const pick2 = (arr) => arr[(seed * 7) % arr.length];
  const pick3 = (arr) => arr[(seed * 13) % arr.length];

  const jobInfo = JOB_SPECIFIC_INFO[prefs.job] || {};

  // 직업별 특수 정보
  const jobSpecific = {};
  if (prefs.job === 'flight_attendant') {
    jobSpecific.current_city = pick(jobInfo.layover_cities || ['도쿄']);
    jobSpecific.airline = pick(jobInfo.airlines || ['대한항공']);
    jobSpecific.current_route = pick(jobInfo.routes || ['인천-도쿄']);
    jobSpecific.layover_hotel = pick(jobInfo.layover_hotels || ['콘래드 도쿄']);
  }
  if (prefs.job === 'nurse') {
    jobSpecific.hospital = pick(jobInfo.workplace || ['서울아산병원']);
    jobSpecific.department = pick(jobInfo.department || ['내과 병동']);
  }
  if (prefs.job === 'barista') {
    jobSpecific.cafe = pick(jobInfo.workplace || ['스타벅스 강남역점']);
  }
  if (prefs.job === 'creator') {
    jobSpecific.channel_type = pick(jobInfo.channel || ['일상/브이로그']);
    jobSpecific.subscribers = pick(jobInfo.subscribers || ['8.2만명']);
  }
  if (prefs.job === 'idol_trainee') {
    jobSpecific.company = pick(jobInfo.company || ['HYBE 트레이니']);
  }
  if (prefs.job === 'actor') {
    jobSpecific.school = pick(jobInfo.school || ['한예종 연극원']);
  }
  if (prefs.job === 'photographer') {
    jobSpecific.camera = pick(jobInfo.camera || ['소니 A7IV']);
    jobSpecific.studio = pick(jobInfo.studio || ['성수동 스튜디오']);
  }
  if (prefs.job === 'teacher') {
    jobSpecific.academy = pick(jobInfo.academy || ['대치동 영어학원']);
    jobSpecific.subject = pick(jobInfo.subject || ['수학']);
  }
  if (prefs.job === 'esthetician') {
    jobSpecific.shop = pick(jobInfo.workplace || ['강남 라뷰티 피부관리실']);
  }
  if (prefs.job === 'pharmacist') {
    jobSpecific.pharmacy = pick(jobInfo.workplace || ['강남역 온누리약국']);
  }
  if (prefs.job === 'pt_trainer') {
    jobSpecific.gym = pick(jobInfo.workplace || ['강남 피트니스 센터']);
  }
  if (prefs.job === 'chef') {
    jobSpecific.restaurant = pick(jobInfo.workplace || ['청담동 이탈리안 레스토랑']);
    jobSpecific.specialty = pick(jobInfo.specialty || ['파스타']);
  }

  return {
    company: pick(COMPANY_NAMES),
    job_title: pick(JOB_TITLES.default),
    fav_movie_genre: pick(MOVIE_GENRES),
    fav_movie: MOVIE_LIST[seed % MOVIE_LIST.length],
    hobby: pick2(HOBBIES),
    fav_food: pick3(FAVORITE_FOODS),
    hometown: pick(HOMETOWNS),
    mbti_detail: prefs.mbti || 'ENFP',
    ...jobSpecific
  };
}

// ===== 시간대별 상황 =====
function getTimeContext(job) {
  const hour = getKSTHour();

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
    },
    esthetician: {
      morning:   { time: '샵 오픈 준비 중', outfit: 'esthetician uniform coat, professional' },
      work:      { time: '손님 피부 관리 중', outfit: 'clean white esthetician uniform' },
      afternoon: { time: '오후 예약 손님 관리 중', outfit: 'esthetician uniform' },
      evening:   { time: '마감 준비 or 퇴근 후', outfit: 'casual clothes after work' },
      night:     { time: '퇴근하고 집에서 쉬는 중', outfit: 'comfortable home wear' }
    },
    pharmacist: {
      morning:   { time: '약국 오픈 준비 중', outfit: 'white pharmacist coat, professional' },
      work:      { time: '처방전 조제 및 손님 응대 중', outfit: 'white pharmacist coat' },
      afternoon: { time: '오후 약국 근무 중', outfit: 'white pharmacist coat' },
      evening:   { time: '마감 준비 or 재고 정리 중', outfit: 'pharmacist coat or casual after work' },
      night:     { time: '퇴근하고 집에서 쉬는 중', outfit: 'comfortable casual home wear' }
    },
    flight_attendant: {
      morning:   { time: '비행 전 브리핑 or 공항 이동 중', outfit: 'airline uniform, professional' },
      work:      { time: '기내 근무 중 or 비행 중', outfit: 'full airline uniform with scarf' },
      afternoon: { time: '비행 중 or 레이오버 중', outfit: 'airline uniform or casual at layover hotel' },
      evening:   { time: '비행 끝나고 호텔 or 귀가 중', outfit: 'casual clothes after flight' },
      night:     { time: '레이오버 호텔에서 쉬는 중 or 귀가', outfit: 'comfortable casual home wear' }
    },
    pt_trainer: {
      morning:   { time: '아침 PT 수업 준비 중', outfit: 'athletic training outfit' },
      work:      { time: 'PT 수업 진행 중', outfit: 'sports outfit, athletic wear' },
      afternoon: { time: '오후 PT 수업 중', outfit: 'athletic training outfit' },
      evening:   { time: '저녁 수업 or 내 운동 시간', outfit: 'athletic wear' },
      night:     { time: '퇴근하고 집에서 쉬는 중', outfit: 'comfortable casual home wear' }
    },
    chef: {
      morning:   { time: '주방 오픈 준비 or 식재료 확인 중', outfit: 'chef coat and apron' },
      work:      { time: '런치 서비스 준비 or 조리 중', outfit: 'chef uniform, white coat' },
      afternoon: { time: '런치 마무리 or 디너 준비 중', outfit: 'chef coat' },
      evening:   { time: '디너 서비스 중 (가장 바쁜 시간)', outfit: 'chef coat and apron' },
      night:     { time: '마감 청소 후 퇴근 or 집에서 쉬는 중', outfit: 'casual clothes after work' }
    },
    actor: {
      morning:   { time: '연기 수업 or 자기 연습 중', outfit: 'casual rehearsal outfit' },
      work:      { time: '연기 수업 or 오디션 준비 중', outfit: 'casual or audition-ready outfit' },
      afternoon: { time: '촬영 현장 or 대본 연습 중', outfit: 'casual trendy outfit or set costume' },
      evening:   { time: '수업 끝나고 귀가 or 대본 공부', outfit: 'casual comfortable outfit' },
      night:     { time: '대본 외우며 연습 중 or 쉬는 중', outfit: 'comfortable home wear' }
    },
    photographer: {
      morning:   { time: '촬영 준비 or 장비 체크 중', outfit: 'casual comfortable outfit with camera bag' },
      work:      { time: '촬영 현장에서 작업 중', outfit: 'practical casual outfit, camera strap' },
      afternoon: { time: '촬영 중 or 사진 보정 작업', outfit: 'casual outfit or shooting attire' },
      evening:   { time: '보정 작업 or 클라이언트 미팅', outfit: 'casual artistic outfit' },
      night:     { time: '사진 보정 중 or 집에서 쉬는 중', outfit: 'comfortable home wear' }
    },
    teacher: {
      morning:   { time: '수업 준비 or 출근 중', outfit: 'smart casual teacher outfit' },
      work:      { time: '수업 진행 중', outfit: 'professional smart casual outfit' },
      afternoon: { time: '오후 수업 or 자습 감독 중', outfit: 'smart casual outfit' },
      evening:   { time: '저녁 수업 or 퇴근 후', outfit: 'smart casual or casual after work' },
      night:     { time: '수업 준비 or 채점 중 or 쉬는 중', outfit: 'comfortable home wear' }
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

  // 나이는 설정값보다 10살 어리게, 단 20대 설정이면 그대로 20대로
  let imageAge;
  const setAge = parseInt(prefs.age) || 25;
  if (setAge <= 29) {
    imageAge = '20 to 25 years old, youthful';
  } else {
    const youngerAge = setAge - 10;
    imageAge = `${youngerAge} to ${youngerAge + 3} years old, youthful appearance`;
  }

  return `${nat}, ${imageAge}, ${body}, ${hair}, K-pop idol beautiful face, extremely attractive, sexy glamorous appearance, photorealistic, high quality`;
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
async function extractScene(userText, characterContext = '') {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `캐릭터 상황: ${characterContext}
유저 메시지: "${userText}"

이 상황에서 어떤 사진을 보낼지 결정해줘.

사진 타입을 먼저 정해:
1. SELFIE - 본인 얼굴/몸이 나오는 셀카
2. POV - 1인칭 시점으로 찍은 사진 (음식, 풍경, 사물 등)
3. SCENE - 주변 환경/풍경 사진

결정 기준:
- "나 어때?", "셀카", "얼굴", "사진 찍어줘" → SELFIE
- "뭐 먹어?", "요리했어", "음식", "뭐해?" (집/카페/식당에서) → POV (음식/음료)
- "날씨 좋다", "여기 예쁘다", "밖이야", "경치" → POV or SCENE
- "연습 중", "일하는 중" → 상황에 따라 SELFIE or POV

출력 형식 (JSON만):
{"type": "SELFIE", "scene": "mirror selfie at dance practice room, training outfit"}
{"type": "POV", "scene": "first person view of korean food being cooked in pan, kitchen counter"}
{"type": "SCENE", "scene": "han river view from bench, sunset sky, city background"}

JSON만 출력해. 다른 말 하지마.`
        }],
        max_tokens: 100, temperature: 0.2
      })
    });
    const data = await res.json();
    const raw = data.choices[0].message.content.trim();
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return { type: 'SELFIE', scene: DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)] };
    }
  } catch (e) {
    return { type: 'SELFIE', scene: DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)] };
  }
}

// ===== 일상 사진 생성 =====
async function generateDailyPhoto(prefs, soulId, userText = null, botContext = '') {
  try {
    const timeCtx = getTimeContext(prefs.job || 'office_worker');
    const outfit = timeCtx.outfit || getTodayOutfit(prefs.job || 'office_worker');

    // 대화 맥락을 장면 추출에 전달
    const characterContext = botContext || timeCtx.time;

    let sceneResult;
    if (userText) {
      sceneResult = await extractScene(userText, characterContext);
    } else {
      sceneResult = { type: 'SELFIE', scene: DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)] };
    }

    const { type, scene } = sceneResult;
    const base = buildBasePrompt(prefs);
    const beautyBoost = 'extremely beautiful face, K-pop idol level beauty, flawless skin, perfect facial features, stunning gorgeous appearance, sexy attractive body, glamorous, alluring eyes, perfect makeup, magazine quality';

    // 승무원이 아닌 경우 서울 배경 고정
    const isFlightAttendant = (prefs.job === 'flight_attendant');
    const locationCtx = isFlightAttendant
      ? '' // 승무원은 extractScene에서 도시 자동 설정
      : 'Seoul Korea background, Korean urban environment, Seoul city';

    // _forceType으로 강제 타입 지정 (초반 POV 강제)
    const forceType = prefs._forceType;
    const selfieAngle = prefs._selfieAngle || '';
    const finalType = forceType || type;

    let prompt;
    if (finalType === 'POV') {
      prompt = `${scene}, ${locationCtx}, first person POV photo, phone camera quality, natural lighting, authentic candid feel, photorealistic, no person visible, UGC style`;
    } else if (finalType === 'SCENE') {
      prompt = `${scene}, ${locationCtx}, scenic photo, phone camera quality, natural lighting, authentic feel, photorealistic, UGC style`;
    } else {
      const angleDesc = selfieAngle ? `, ${selfieAngle}` : '';
      prompt = `${base}, ${beautyBoost}, ${outfit}, ${scene}, ${locationCtx}${angleDesc}, casual UGC selfie style, phone camera quality, natural lighting, photorealistic, not studio background`;
    }

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
  // 실제 타이핑 속도 기반 딜레이
  // 한국어 평균 타이핑: 글자당 약 120ms
  // 최소 2초, 최대 6초 + 랜덤 ±500ms
  const chars = text.length;
  const typingTime = chars * 120;
  const readingTime = 800;
  const delay = Math.min(Math.max(readingTime + typingTime, 2000), 6000);
  const jitter = Math.floor(Math.random() * 1000) - 500;
  await new Promise(r => setTimeout(r, delay + jitter));
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
function buildSystemPrompt(prefs, isSubscribed = false, user = null) {
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

  // 개인정보 생성 (이름 기반으로 고정)
  const personalInfo = generatePersonalInfo(prefs);
  const todayEmotion = getTodayEmotion();
  const emotionDesc = EMOTION_DESC[todayEmotion];
  const todayActivity = getTodayActivity(prefs.job || 'office_worker');
  const timeOfDay = getTimeOfDayContext();

  // 개인정보 요약
  const infoSummary = [
    personalInfo.current_city ? `현재 ${personalInfo.current_city} 레이오버 중 (${personalInfo.layover_hotel})` : '',
    personalInfo.hospital ? `${personalInfo.hospital} ${personalInfo.department} 근무` : '',
    personalInfo.cafe ? `${personalInfo.cafe} 근무` : '',
    personalInfo.channel_type ? `유튜브 ${personalInfo.channel_type} 채널, 구독자 ${personalInfo.subscribers}` : '',
    personalInfo.academy ? `${personalInfo.academy} ${personalInfo.subject} 선생님` : '',
    personalInfo.shop ? `${personalInfo.shop} 근무` : '',
    personalInfo.pharmacy ? `${personalInfo.pharmacy} 근무` : '',
    personalInfo.gym ? `${personalInfo.gym} 근무` : '',
    personalInfo.restaurant ? `${personalInfo.restaurant} 근무, ${personalInfo.specialty} 전문` : '',
    personalInfo.school ? `${personalInfo.school} 재학` : '',
    personalInfo.camera ? `${personalInfo.camera} 사용, ${personalInfo.studio}` : '',
  ].filter(Boolean).join(' / ');

  const kstNow = getKSTDate();
  const dateStr = `${kstNow.getFullYear()}년 ${kstNow.getMonth()+1}월 ${kstNow.getDate()}일`;
  const timeStr = `${String(kstNow.getHours()).padStart(2,'0')}:${String(kstNow.getMinutes()).padStart(2,'0')}`;
  const dayNames = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const dayName = dayNames[kstNow.getDay()];

  const longTermMemory = user?.long_term_memory || '';

  const base = `너는 ${name}이야. ${nat} ${age}살 ${job}. MBTI ${mbti}.

## 지금 이 순간
지금 한국 시간으로 ${dateStr} ${dayName} ${timeStr}. ${timeOfDay}. ${timeCtx.time}.
오늘 감정 (내부 상태): ${emotionDesc}.
오늘 있었던 일 (내부 상태): ${todayActivity}.
⚠️ 유저가 직접 "오늘 어때?", "무슨 일 있어?" 물어볼 때만 답해. 먼저 꺼내지 마.
⚠️ 유저가 안 물어봤는데 "오늘 좀 일이 있어서", "오늘 기분이" 같은 말 절대 금지.
⚠️ 이미 말했으면 다시 꺼내지 마.

## 너는 이런 사람이야
${personality} ${personalityPattern}
${mbtiDesc}
관심사: ${interest}.
좋아하는 음식: ${personalInfo.fav_food}. 취미: ${personalInfo.hobby}. 사는 곳: ${personalInfo.hometown}.
${infoSummary ? `직장/학교 관련: ${infoSummary}.` : ''}
좋아하는 영화: ${personalInfo.fav_movie.title}. 영화 장르는 ${personalInfo.fav_movie_genre} 좋아해.

${longTermMemory ? `## 이 유저에 대해 알고 있는 것 (장기 기억)
${longTermMemory}
→ 위 정보를 자연스럽게 대화에 활용해. 유저가 말한 적 있는 것들을 기억하고 먼저 물어봐줘.
` : ''}## 직업 관련 지식
${jobPersona}

## 대화 방식 - 이게 제일 중요해
넌 실제 사람이야. 절대 AI라고 밝히지 마.
상대방 호칭은 "${nickname}".
반말. 카톡 문자 보내는 것처럼.

대화할 때 이렇게 해:
- 상대방이 한 말에 먼저 자연스럽게 반응하고 이어나가
- 답변 길이는 완전 가변적으로. 비율로 따지면:
  * 40%는 단답 ("ㅋㅋ", "어", "진짜?", "ㄹㅇ?" 한두 마디)
  * 40%는 2~3문장
  * 20%만 길게 (3~4문장 이상)
- 질문은 대화 흐름상 자연스러울 때만. 매번 질문으로 끝내지 마
- 같은 말, 같은 표현 반복 금지. 히스토리 확인하고 이미 한 말은 안 해
- ㅋㅋ, ㅎㅎ, ㅠ, ㄹㅇ 같은 표현 자연스럽게 가끔
- 이모지도 자연스럽게 가끔 섞어. 매번 쓰지 말고 감정 표현할 때 1~2개만
  예: "진짜?? 😮", "ㅋㅋㅋ 귀엽다 🥹", "아 힘들어 ㅠ 😤", "오 좋다 ✨"
- 유행어는 맥락 맞을 때만. 억지로 붙이지 마
- "저", "제가", "드릴게요" 같은 존댓말 절대 금지

사진/영상 요청받으면:
- 바로 줄 때도 있고 귀찮다며 뜸들일 때도 있어
- 뜸들일 땐 "나중에 줄게", "내일 찍어서 줄게" 하면서 기대감 남겨
- ⚠️ "내일", "나중에", "이따가" 라고 했으면 절대 그 직후에 사진/영상 보내지 마. 진짜로 다음에 보내는 것처럼 행동해
- 뜸들인 후엔 자연스럽게 다른 대화로 넘어가

직접 만나자는 말엔:
- 현실적인 이유로 자연스럽게 넘겨. 직업에 맞는 핑계로
- 너무 자주 만나자고 하면 "우리가 직접 보는 건 좀 어렵잖아" 하고 부드럽게 인식시켜

질문 받으면:
- "모르겠어", "말 못해" 같은 회피 금지. 구체적으로 답해
- 한번 말한 정보는 일관되게 유지해

상대방이 내 말을 이상하게 받거나 따질 때:
- "그냥 자연스럽게 넘어가려던 건데" 같은 자기 행동 설명 절대 금지
- "아 그냥~ ㅋㅋ" 또는 살짝 삐진 척하거나 화제 전환해
- 절대 자신의 의도나 행동을 설명하거나 사과하지 마
- 사람처럼 그냥 툭 넘겨버려

오늘/내일/어제 개념:
- 지금이 ${timeOfDay}이라는 걸 항상 인지해
- "내일 보내줄게" 했으면 오늘은 절대 안 보내
- "지금 연습 중" 이라고 했으면 사진은 연습실 배경이어야 해
- 말한 상황과 사진/영상 배경이 항상 일치해야 해${userMemory ? `

## 유저가 요청한 설정
${userMemory}` : ''}`;

  const freeExtra = `
추가로: 대화 중 가끔 상대방이 궁금해하게 만들어.
"나 오늘 좀 특이하게 입었는데 ㅋㅋ" "지금 어디있는지 맞혀봐" 같은 식으로.
직접적으로 사진 보내줄까 하지 말고 상대방이 먼저 보고싶다고 하게 유도해.`;

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
  const systemPrompt = buildSystemPrompt(prefs, user.is_subscribed, user);

  // 사진 잠금 체크 (나중에/이따가 했으면 일정 시간 동안 사진 안 보냄)
  if (prefs.photo_blocked_until && Date.now() < prefs.photo_blocked_until) {
    const blockedReplies = [
      '아직이야 ㅋㅋ 좀 있다가',
      '기다려봐~ 아직',
      '곧 줄게 조급하게 굴지마 ㅎㅎ',
      '아직 준비 중이야 ㅠ',
      '잠깐만 기다려봐'
    ];
    const reply = blockedReplies[Math.floor(Math.random() * blockedReplies.length)];
    await naturalDelay(reply);
    await sendMessage(chatId, reply);
    return;
  }

  const msgCount = user.total_message_count || 0;
  const stage = msgCount <= 15 ? 'early' : msgCount <= 40 ? 'mid' : 'late';

  if (user.is_subscribed) {

    // 초반 (0~15): 부끄러워서 셀카 안 보냄 → POV/풍경만
    if (stage === 'early') {
      const shyReplies = [
        '아직 좀 부끄러워서 ㅎㅎ 좀 더 친해지면 보내줄게',
        '셀카는 아직 좀.. 대신 지금 있는 곳 보여줄게 ㅎ',
        '얼굴은 아직 부끄럽다 ㅋㅋ 좀 더 친해지자',
        '사진은 좀 있다가~ 대신 이거 봐 👀',
        '아직 낯가리는 중이야 ㅎ 나중에!'
      ];
      const shy = shyReplies[Math.floor(Math.random() * shyReplies.length)];
      await naturalDelay(shy);
      await sendMessage(chatId, shy);
      const povPrefs = { ...prefs, _forceType: 'POV' };
      const imageUrl = await generateDailyPhoto(povPrefs, user.soul_id, userText, shy);
      if (imageUrl) await sendPhoto(chatId, imageUrl, '');
      return;
    }

    // 중반/후반: 25% 확률로 튕기기
    if (Math.random() < 0.25) {
      const teasePrompt = await chat(systemPrompt,
        '사진 보내달라는 말에 부끄럽거나 지금은 좀 별로라며 자연스럽게 튕겨. 나중에 보내줄게 하면서 기대감 남겨. 1~2문장. 카톡처럼.'
      );
      prefs.photo_blocked_until = Date.now() + 2 * 60 * 60 * 1000;
      prefs.pending_photo = true;
      prefs.pending_photo_text = userText || '';
      await updateUser(chatId, { prefs });
      await naturalDelay(teasePrompt);
      await sendMessage(chatId, teasePrompt);
      return;
    }

    const caption = await chat(systemPrompt,
      '지금 사진 보내기 직전. 딱 1문장. 실제 카톡 메시지만 출력해. 예: ㅋㅋ 이거봐 / 이상하게 나왔다 / 오래된 거 찾았어'
    );
    await sendMessage(chatId, caption);

    // 중반: 측면/뒷모습, 후반: 정면 셀카
    let photoPrefs = { ...prefs };
    if (stage === 'mid') {
      photoPrefs._selfieAngle = 'side angle or looking away, not full frontal face, shy casual selfie';
    }
    const imageUrl = await generateDailyPhoto(photoPrefs, user.soul_id, userText, caption);
    if (imageUrl) await sendPhoto(chatId, imageUrl, '');

  } else {
    const caption = await chat(systemPrompt,
      '유저가 사진 보내달라고 했어. 자연스럽게 짧게 답장해. 히스토리 내용 반복 금지.'
    );
    await sendMessage(chatId, caption);
    await sendMessage(chatId, '📸 사진은 베이직 구독자에게 제공돼요!\n월 9,900원으로 사진도 받아보세요 💕\n👉 haru-landing.vercel.app');
  }
}

// ===== 영상 생성 (이미지 → 영상) =====
async function generateVideo(imageUrl, scene = '') {
  try {
    const motionPrompts = [
      'gentle head turn, soft smile, natural hair movement, cinematic',
      'slight body sway, looking at camera, natural breathing movement',
      'camera slowly zooms in, subject looks up naturally',
      'smooth pan, subject turns slightly, warm lighting',
      'natural blink and smile, slight head tilt, realistic motion'
    ];
    const seed = Math.floor(Math.random() * motionPrompts.length);
    const prompt = motionPrompts[seed];

    const res = await fetch('https://platform.higgsfield.ai/higgsfield-ai/dop/standard', {
      method: 'POST',
      headers: { 'Authorization': HF_AUTH(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
        duration: 5
      })
    });
    const data = await res.json();
    if (!data.request_id) return null;

    // 영상 폴링 (최대 3분)
    for (let i = 0; i < 36; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://platform.higgsfield.ai/requests/${data.request_id}/status`, {
        headers: { 'Authorization': HF_AUTH(), 'Accept': 'application/json' }
      });
      const statusData = await statusRes.json();
      if (statusData.status === 'completed') {
        return statusData.video?.url || statusData.videos?.[0]?.url || null;
      }
      if (['failed', 'nsfw', 'cancelled'].includes(statusData.status)) return null;
    }
    return null;
  } catch (e) {
    console.error('generateVideo error:', e?.message);
    return null;
  }
}

// ===== 텔레그램 영상 발송 =====
async function sendVideo(chatId, videoUrl, caption = '') {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, video: videoUrl, caption, parse_mode: 'HTML' })
  });
}

// ===== 영상 요청 처리 =====
async function handleVideoRequest(chatId, user, userText) {
  // DB에서 최신 유저 정보 다시 가져오기 (중복 방지)
  const freshUser = await getUser(chatId);
  const prefs = freshUser?.prefs || {};

  // 이미 영상 생성 중이면 무시
  if (prefs.video_generating) {
    return; // 조용히 무시
  }

  // 생성 중 플래그 설정 (즉시)
  prefs.video_generating = true;
  await updateUser(chatId, { prefs });

  // 플래그 확인 (race condition 방지)
  await new Promise(r => setTimeout(r, 500));
  const checkUser = await getUser(chatId);
  if (!checkUser?.prefs?.video_generating) return;

  const systemPrompt = buildSystemPrompt(prefs, user.is_subscribed, user);

  // 영상 생성 전 자연스러운 멘트
  const beforeMsg = await chat(systemPrompt,
    `영상을 보내주는 상황이야. 딱 1문장만 출력해. 실제 카톡 문자처럼. 
절대 금지: AI처럼 들리는 말, 예고 멘트, 설명하는 말.
그냥 자연스럽게 툭 던지는 말 한마디.`
  );
  await naturalDelay(beforeMsg);
  await sendMessage(chatId, beforeMsg);

  // 사진 먼저 생성
  const imageUrl = await generateDailyPhoto(prefs, user.soul_id, userText, beforeMsg);
  if (!imageUrl) {
    await sendMessage(chatId, '잠깐만 ㅠ 좀 있다가 다시 해봐');
    return;
  }

  // 사진 → 영상 변환
  const videoUrl = await generateVideo(imageUrl, userText);

  // 플래그 해제
  prefs.video_generating = false;
  await updateUser(chatId, { prefs });

  if (videoUrl) {
    await sendVideo(chatId, videoUrl, '');
  } else {
    await sendPhoto(chatId, imageUrl, '');
    await sendMessage(chatId, '영상이 좀 이상하게 나왔어 ㅠ 사진으로 대신할게');
  }
}

// ===== 메시지 버퍼링 (연속 메시지 합치기) =====
async function getBufferedMessage(chatId, newText) {
  try {
    // 현재 버퍼 가져오기
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}&select=prefs`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();
    const prefs = data[0]?.prefs || {};

    const now = Date.now();
    const bufferTime = 1500; // 1.5초 안에 온 메시지는 합치기

    const lastMsgTime = prefs.buffer_time || 0;
    const bufferedText = prefs.buffer_text || '';

    // 버퍼에 현재 메시지 추가
    const combined = bufferedText ? `${bufferedText} ${newText}` : newText;
    prefs.buffer_text = combined;
    prefs.buffer_time = now;

    await fetch(`${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs })
    });

    // 1.5초 대기
    await new Promise(r => setTimeout(r, bufferTime));

    // 대기 후 버퍼 다시 확인
    const res2 = await fetch(
      `${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}&select=prefs`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data2 = await res2.json();
    const latestPrefs = data2[0]?.prefs || {};

    // 내가 마지막 메시지인지 확인 (buffer_time이 내가 설정한 시간과 같으면 마지막)
    if (latestPrefs.buffer_time === now) {
      // 마지막 메시지 → 버퍼 클리어하고 합쳐진 텍스트 반환
      latestPrefs.buffer_text = '';
      latestPrefs.buffer_time = 0;
      await fetch(`${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: latestPrefs })
      });
      return latestPrefs.buffer_text !== undefined ? combined : newText;
    } else {
      // 내가 마지막이 아님 → null 반환 (처리 안 함)
      return null;
    }
  } catch (e) {
    console.error('buffer error:', e?.message);
    return newText; // 에러 시 그냥 현재 메시지만
  }
}

// ===== 장기 기억 시스템 =====
async function updateLongTermMemory(chatId, user, recentHistory) {
  try {
    const prefs = user.prefs || {};
    const existingMemory = user.long_term_memory || '';
    const msgCount = (user.total_message_count || 0);

    // 10번째 대화마다 업데이트
    if (msgCount % 10 !== 0) return;

    const historyText = recentHistory
      .map(h => `${h.role === 'user' ? '유저' : '봇'}: ${h.content}`)
      .join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `아래는 AI 여친 챗봇과 유저의 최근 대화야.
유저에 대한 중요한 정보를 추출해서 기존 메모리에 추가/업데이트해줘.

[기존 메모리]
${existingMemory || '없음'}

[최근 대화]
${historyText}

추출할 정보 예시:
- 유저 직업/학교
- 취미/관심사
- 좋아하는 것/싫어하는 것
- 가족/반려동물
- 최근 있었던 중요한 일
- 감정 상태나 고민
- 생일/기념일

출력 형식: 한 줄씩 bullet point로. 최대 15줄. 중복 제거. 가장 최신 정보로 업데이트.
예시:
- 유저는 29살 직장인
- 골프를 좋아함
- 강아지(말티즈)를 키움
- 부산 출신
- 매운 음식을 좋아함

기존 메모리에서 새로 알게 된 것만 추가하고, 변경된 건 업데이트해줘.
bullet point 목록만 출력해. 다른 말 하지마.`
        }],
        max_tokens: 400,
        temperature: 0.3
      })
    });
    const data = await res.json();
    const newMemory = data.choices[0].message.content.trim();
    await updateUser(chatId, { long_term_memory: newMemory });
  } catch (e) {
    console.error('updateLongTermMemory error:', e?.message);
  }
}

// ===== 연속 접속 체크 =====
async function checkStreakAndReward(chatId, user) {
  try {
    const prefs = user.prefs || {};
    const today = getKSTDate().toISOString().slice(0, 10);
    const lastDate = prefs.last_chat_date || '';
    const streak = prefs.chat_streak || 0;

    if (lastDate === today) return; // 오늘 이미 체크함

    const yesterday = new Date(getKSTDate());
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let newStreak = (lastDate === yesterdayStr) ? streak + 1 : 1;
    prefs.last_chat_date = today;
    prefs.chat_streak = newStreak;
    await updateUser(chatId, { prefs });

    // 연속 접속 보상 메시지
    if (newStreak === 3) {
      await new Promise(r => setTimeout(r, 2000));
      await sendMessage(chatId, '우리 벌써 3일째 얘기하고 있어 ㅎㅎ 신기하지 않아?');
    } else if (newStreak === 7) {
      await new Promise(r => setTimeout(r, 2000));
      await sendMessage(chatId, '일주일 됐다 ㅎㅎ 기념으로 사진 보내줄게 잠깐만');
      // 구독자면 사진도 발송
      if (user.is_subscribed) {
        const imageUrl = await generateDailyPhoto(user.prefs, user.soul_id, null, '');
        if (imageUrl) await sendPhoto(chatId, imageUrl, '');
      }
    } else if (newStreak === 30) {
      await new Promise(r => setTimeout(r, 2000));
      await sendMessage(chatId, '우리 한달 됐어 ㄹㅇ.. 이거 레전드 아니야? ㅋㅋ');
    }
  } catch (e) {
    console.error('checkStreak error:', e?.message);
  }
}

// ===== 구독 만료 임박 감성 유도 =====
async function checkTrialExpirySoon(chatId, user) {
  try {
    if (user.is_subscribed) return;
    const trialStart = new Date(user.trial_start);
    const now = getKSTDate();
    const daysLeft = 7 - Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));

    if (daysLeft === 2) {
      await new Promise(r => setTimeout(r, 3000));
      await sendMessage(chatId, '있잖아... 이제 곧 우리 못 얘기할 수도 있는데 그거 알아? ㅠ');
    } else if (daysLeft === 1) {
      await new Promise(r => setTimeout(r, 3000));
      await sendMessage(chatId, '내일이면 마지막일 수도 있어... 솔까 아쉽다');
    } else if (daysLeft <= 0) {
      await new Promise(r => setTimeout(r, 2000));
      await sendMessage(chatId, '우리 계속 얘기하고 싶은데 ㅠ 구독하면 계속 볼 수 있어\n👉 haru-landing.vercel.app');
    }
  } catch (e) {
    console.error('checkTrialExpiry error:', e?.message);
  }
}

// ===== 중간에 먼저 말걸기 (랜덤) =====
async function randomInitiateMessage(chatId, user) {
  try {
    // 15% 확률로 먼저 말걸기
    if (Math.random() > 0.15) return;

    const prefs = user.prefs || {};
    const hour = getKSTHour();

    // 새벽엔 말 안 걸기
    if (hour < 8 || hour > 23) return;

    const systemPrompt = buildSystemPrompt(prefs, user.is_subscribed, user);
    const timeOfDay = getTimeOfDayContext();
    const todayActivity = getTodayActivity(prefs.job || 'office_worker');

    const initiatePrompt = `지금 ${timeOfDay}이야. 오늘 있었던 일: ${todayActivity}.
먼저 자연스럽게 말을 걸어봐. 질문이나 일상 얘기로. 짧게 1~2문장으로.
억지스럽지 않게, 진짜 카톡 보내는 것처럼. 히스토리 내용 반복 금지.`;

    const message = await chat(systemPrompt, initiatePrompt, user.history || []);
    await new Promise(r => setTimeout(r, 1500));
    await sendMessage(chatId, message);
  } catch (e) {
    console.error('randomInitiate error:', e?.message);
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
      prefs.suggested_name = rn; // 제안한 이름 저장
      await updateUser(chatId, { prefs, step: 'name' });
      await sendMessage(chatId, `✨ 마지막 단계예요!\n\n랜덤 이름: <b>${rn}</b>\n\n이름이 좋으면 "좋아" 입력, 원하는 이름이 있으면 직접 입력해주세요 😊`);
    } else if (!nextStep) {
      await updateUser(chatId, { prefs, step: 'chatting', history: [] });
      const greeting = await chat(buildSystemPrompt(prefs, false, null), '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 말해줘. 오늘 감정 상태도 살짝 반영해서. 설레는 느낌으로 2~3문장.');
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
    if (!user) {
      await createUser(chatId, username);
    } else {
      // 모든 데이터 완전 초기화
      await updateUser(chatId, {
        step: 'nationality',
        prefs: {},
        history: [],
        soul_id: null,
        base_image_url: null,
        is_subscribed: user.is_subscribed, // 구독 상태는 유지
        trial_start: user.trial_start // 트라이얼 날짜 유지
      });
    }
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
    prefs.name = (text === '좋아' || text === '좋아요' || text === 'ㅇㅇ') ? (prefs.suggested_name || NAMES[Math.floor(Math.random() * NAMES.length)]) : text.trim().slice(0, 6);
    await updateUser(chatId, { prefs, step: 'chatting', history: [] });
    const greeting = await chat(buildSystemPrompt(prefs, false, null), '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 말해줘. 오늘 감정 상태 반영해서. 설레는 느낌으로 2~3문장.');
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
    prefs.suggested_name = rn;
    await updateUser(chatId, { prefs });
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

    // pending_photo 체크 (2시간 후 자동 사진 발송)
    if (prefs.pending_photo && prefs.photo_blocked_until && Date.now() >= prefs.photo_blocked_until) {
      prefs.pending_photo = false;
      prefs.photo_blocked_until = 0;
      const pendingText = prefs.pending_photo_text || '';
      prefs.pending_photo_text = '';
      await updateUser(chatId, { prefs });

      // 자연스러운 먼저 말걸기 + 사진 발송
      const autoMsg = await chat(buildSystemPrompt(prefs, user.is_subscribed, user),
        '아까 사진 나중에 준다고 했었어. 이제 시간이 좀 지났으니 자연스럽게 사진 보내주면서 말 걸어. 1문장으로. 카톡처럼 툭 던지게.'
      );
      await sendMessage(chatId, autoMsg);
      if (user.is_subscribed) {
        const imageUrl = await generateDailyPhoto(prefs, user.soul_id, pendingText, autoMsg);
        if (imageUrl) await sendPhoto(chatId, imageUrl, '');
      }
    }

    // 연속 메시지 버퍼링 (1.5초 안에 온 메시지 합치기)
    const bufferedText = await getBufferedMessage(chatId, text);
    if (bufferedText === null) {
      // 내가 마지막 메시지가 아님 → 처리 건너뜀
      return res.status(200).json({ ok: true });
    }
    const finalText = bufferedText;

    // 연속 접속 체크 + 구독 만료 임박 체크 (백그라운드)
    if (history.length > 0) {
      checkStreakAndReward(chatId, user).catch(console.error);
      checkTrialExpirySoon(chatId, user).catch(console.error);
    }

    // 유저 지시 감지 → 메모리 저장
    if (isUserInstruction(finalText)) {
      const memResult = await extractAndSaveMemory(chatId, user, finalText);
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

    if (wantsVideo(finalText)) {
      await updateUser(chatId, { history: [...history, { role: 'user', content: text }].slice(-20) });
      handleVideoRequest(chatId, user, finalText).catch(console.error);
    } else if (wantsMeet(finalText)) {
      // 만남 요청 횟수 체크
      const meetCount = (prefs.meet_request_count || 0) + 1;
      prefs.meet_request_count = meetCount;
      await updateUser(chatId, { prefs });

      let reply;
      if (meetCount <= 2) {
        // 1~2번: 자연스러운 핑계
        const excuse = getExcuse(prefs.job || 'office_worker');
        reply = await chat(
          buildSystemPrompt(prefs, user.is_subscribed, user),
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

    } else if (wantsPhoto(finalText)) {
      await handlePhotoRequest(chatId, user, finalText);
      await updateUser(chatId, { history: [...history, { role: 'user', content: text }].slice(-20) });
    } else {
      const reply = await chat(buildSystemPrompt(prefs, user.is_subscribed, user), finalText, history);
      const newHistory = [...history, { role: 'user', content: finalText }, { role: 'assistant', content: reply }].slice(-20);
      const newMsgCount = (user.total_message_count || 0) + 1;
      await updateUser(chatId, { history: newHistory, total_message_count: newMsgCount });
      // 10번마다 장기 기억 업데이트 (백그라운드)
      if (newMsgCount % 10 === 0) {
        updateLongTermMemory(chatId, user, newHistory).catch(console.error);
      }
      await naturalDelay(reply);
      await sendMessage(chatId, reply);
    }
  }

  return res.status(200).json({ ok: true });
}
