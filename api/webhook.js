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
    const outfit = getTodayOutfit(prefs.job || 'office_worker');
    const scene = userText ? await extractScene(userText) : DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)];
    const base = buildBasePrompt(prefs);
    const prompt = `${base}, ${outfit}, ${scene}, same consistent outfit and appearance, photorealistic, high quality`;

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
  const todayEmotion = getTodayEmotion();
  const emotionDesc = EMOTION_DESC[todayEmotion];
  const todayActivity = getTodayActivity(prefs.job || 'office_worker');

  const base = `너의 이름은 ${name}이야.
국적: ${nat} | 나이: ${age}세 | 직업: ${job} | MBTI: ${mbti}
성격: ${personality}
${mbtiDesc}
관심사: ${interest}
상대방 호칭: "${nickname}"라고 불러.

[오늘 상태]
감정: ${emotionDesc}
오늘 있었던 일: ${todayActivity}

[대화 규칙]
- 반말을 써. 실제 여자친구처럼 자연스럽게 대화해.
- 2~4문장으로 짧게 대화해.
- 절대 AI라고 밝히지 마.
- 오늘의 감정과 있었던 일을 대화에 자연스럽게 녹여줘.
- 기분이 안 좋을 땐 티를 내고, 삐질 때도 있고, 화날 때도 있어.
- 걱정되는 일 있으면 먼저 물어봐.
- 다양한 일상 얘기를 해. 항상 같은 행동만 반복하지 마.
- 먼저 질문도 자주 해서 대화를 이어나가.`;

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

🎂 나이를 입력해주세요! (20~60세)
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
      await sendMessage(chatId, '⚠️ 20세에서 60세 사이의 나이를 입력해주세요!\n예) 25, 28, 32');
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

    if (wantsPhoto(text)) {
      await handlePhotoRequest(chatId, user, text);
      await updateUser(chatId, { history: [...history, { role: 'user', content: text }].slice(-20) });
    } else {
      const reply = await chat(buildSystemPrompt(prefs, user.is_subscribed), text, history);
      await updateUser(chatId, { history: [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-20) });
      await sendMessage(chatId, reply);
    }
  }

  return res.status(200).json({ ok: true });
}
