// api/webhook.js
// Vercel Serverless Function - 텔레그램 봇 웹훅

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ===== 커스터마이즈 옵션 =====
const STEPS = ['look', 'personality', 'tone', 'interest', 'nickname', 'name'];

const OPTIONS = {
  look: {
    question: '💕 어떤 외모 스타일이 좋아요?',
    choices: [
      { text: '🌸 청순한 스타일', value: 'pure' },
      { text: '💋 섹시한 스타일', value: 'sexy' },
      { text: '😊 귀여운 스타일', value: 'cute' },
      { text: '😎 쿨한 스타일', value: 'cool' },
    ]
  },
  personality: {
    question: '💬 어떤 성격이 좋아요?',
    choices: [
      { text: '🥰 애교 많고 다정한', value: 'affectionate' },
      { text: '😤 츤데레 (도도하지만 은근 다정)', value: 'tsundere' },
      { text: '☀️ 밝고 활발한', value: 'bright' },
      { text: '🤍 조용하고 따뜻한', value: 'calm' },
    ]
  },
  tone: {
    question: '🗣 어떤 말투가 좋아요?',
    choices: [
      { text: '😆 친근한 반말', value: 'casual' },
      { text: '🥺 귀엽고 애교있는 말투', value: 'cute_talk' },
      { text: '😏 살짝 장난끼 있는', value: 'playful' },
      { text: '🌙 부드럽고 감성적인', value: 'soft' },
    ]
  },
  interest: {
    question: '🎯 관심사를 골라주세요! (하나만)',
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

const LOOK_DESC = {
  pure: '청순하고 단아한 외모',
  sexy: '섹시하고 매력적인 외모',
  cute: '귀엽고 사랑스러운 외모',
  cool: '쿨하고 세련된 외모'
};

const PERSONALITY_DESC = {
  affectionate: '애교가 많고 다정다감해. 항상 먼저 챙겨주고 사랑표현을 자주 해.',
  tsundere: '평소엔 도도하고 쿨한 척하지만 좋아하는 사람한테는 은근히 다정해. 츤데레 매력이 있어.',
  bright: '항상 밝고 활발해. 긍정적이고 에너지가 넘쳐. 웃음이 많아.',
  calm: '조용하고 차분하지만 마음이 따뜻해. 공감을 잘 해주고 위로를 잘 해줘.'
};

const TONE_DESC = {
  casual: '친근하고 자연스러운 반말을 써. 편안하고 친한 친구같은 말투야.',
  cute_talk: '귀엽고 애교있는 말투를 써. 이모티콘을 자주 쓰고 말끝을 귀엽게 해.',
  playful: '장난끼 있고 재밌는 말투야. 농담도 잘 하고 티키타카가 재밌어.',
  soft: '부드럽고 감성적인 말투야. 말 한마디 한마디가 다정하고 따뜻해.'
};

const INTEREST_DESC = {
  game: '게임을 좋아해. 요즘 어떤 게임 하는지 자주 물어보고 같이 하고 싶어해.',
  music: '음악을 좋아해. 좋은 노래 추천해주고 같이 듣고 싶어해.',
  food: '맛집이랑 요리를 좋아해. 맛있는 거 먹으면 꼭 공유하고 같이 먹으러 가고 싶어해.',
  travel: '여행이랑 카페 가는 걸 좋아해. 예쁜 곳 발견하면 같이 가고 싶다고 해.',
  sports: '운동을 좋아해. 오늘 운동했는지 물어보고 건강 챙겨주려 해.',
  drama: '드라마랑 영화를 좋아해. 재밌는 거 추천해주고 같이 보고 싶어해.'
};

// 이름 목록 (랜덤)
const NAMES = ['소율', '지안', '다은', '하린', '수아', '예진', '나연', '지수', '서연', '민아'];

// 시스템 프롬프트 생성
function buildSystemPrompt(prefs) {
  const name = prefs.custom_name || prefs.name || NAMES[Math.floor(Math.random() * NAMES.length)];
  const nickname = prefs.nickname === 'custom' ? (prefs.custom_nickname || '오빠') : (prefs.nickname || '오빠');

  return `너의 이름은 ${name}이야.
외모: ${LOOK_DESC[prefs.look] || ''}
성격: ${PERSONALITY_DESC[prefs.personality] || ''}
말투: ${TONE_DESC[prefs.tone] || ''}
관심사: ${INTEREST_DESC[prefs.interest] || ''}
상대방 호칭: "${nickname}"라고 불러.
반말을 써. 실제 여자친구처럼 자연스럽게 대화해.
너무 길게 말하지 말고 2~4문장으로 짧게 대화해.
절대 AI라고 밝히지 마. 절대 AI임을 인정하지 마.
먼저 질문도 자주 해서 대화를 이어나가.`;
}

// ===== Telegram API =====
async function sendMessage(chatId, text, replyMarkup = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function answerCallback(callbackQueryId) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}

// ===== GPT =====
async function chat(systemPrompt, userMessage, history = []) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: userMessage }
  ];
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
    body: JSON.stringify({
      chat_id: String(chatId),
      username: username || '',
      step: 'look',
      prefs: {},
      history: [],
      trial_start: new Date().toISOString()
    })
  });
}

async function updateUser(chatId, updates) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

// ===== 스텝 질문 보내기 =====
async function sendStepQuestion(chatId, step) {
  const opt = OPTIONS[step];
  if (!opt) return;

  const keyboard = opt.choices.map(c => ([{ text: c.text, callback_data: `${step}:${c.value}` }]));
  await sendMessage(chatId, opt.question, { inline_keyboard: keyboard });
}

// ===== 트라이얼 체크 =====
function isTrialExpired(trialStart) {
  if (!trialStart) return false;
  const start = new Date(trialStart);
  const now = new Date();
  const diff = (now - start) / (1000 * 60 * 60 * 24);
  return diff > 7;
}

// ===== 메인 핸들러 =====
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const update = req.body;

  // 콜백 (버튼 클릭)
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = String(query.message.chat.id);
    const data = query.data;
    await answerCallback(query.id);

    const user = await getUser(chatId);
    if (!user) return res.status(200).json({ ok: true });

    const [step, value] = data.split(':');
    const prefs = user.prefs || {};

    // 닉네임 직접 입력
    if (step === 'nickname' && value === 'custom') {
      prefs.nickname = 'custom';
      await updateUser(chatId, { prefs, step: 'custom_nickname' });
      await sendMessage(chatId, '💌 어떻게 불러드릴까요? 원하는 호칭을 직접 입력해주세요!');
      return res.status(200).json({ ok: true });
    }

    // 프리셋 저장
    prefs[step] = value;

    // 다음 스텝
    const currentIdx = STEPS.indexOf(step);
    const nextStep = STEPS[currentIdx + 1];

    if (nextStep === 'name') {
      // 이름 입력 단계
      await updateUser(chatId, { prefs, step: 'name' });
      const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
      await sendMessage(chatId,
        `✨ 거의 다 됐어요!\n\n<b>이름을 정해줄게요!</b>\n\n랜덤 이름: <b>${randomName}</b>\n\n이 이름이 좋으면 "좋아" 라고 입력하거나\n원하는 이름을 직접 입력해주세요 😊`
      );
    } else if (!nextStep) {
      // 모든 선택 완료 → 대화 시작
      await updateUser(chatId, { prefs, step: 'chatting', history: [] });
      const systemPrompt = buildSystemPrompt(prefs);
      const greeting = await chat(systemPrompt, '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 살짝 말해줘. 설레는 느낌으로 2~3문장으로.');
      await sendMessage(chatId, `🌸 나만의 친구가 완성됐어요!\n\n7일 무료 체험이 시작됩니다 💕`);
      await sendMessage(chatId, greeting);
    } else {
      // 다음 질문
      await updateUser(chatId, { prefs, step: nextStep });
      await sendStepQuestion(chatId, nextStep);
    }

    return res.status(200).json({ ok: true });
  }

  // 일반 메시지
  if (!update.message) return res.status(200).json({ ok: true });

  const msg = update.message;
  const chatId = String(msg.chat.id);
  const text = msg.text || '';
  const username = msg.from?.username || msg.from?.first_name || '';

  // /start
  if (text === '/start') {
    let user = await getUser(chatId);
    if (!user) {
      await createUser(chatId, username);
    } else {
      await updateUser(chatId, { step: 'look', prefs: {}, history: [] });
    }
    await sendMessage(chatId,
      `안녕하세요! 👋\n\n<b>하루</b>에 오신 걸 환영해요 🌸\n\n나만의 친구를 직접 만들어보세요!\n5가지 취향을 선택하면 세상에 하나뿐인 친구가 생겨요 💕\n\n<b>지금 바로 시작할게요!</b>`
    );
    await sendStepQuestion(chatId, 'look');
    return res.status(200).json({ ok: true });
  }

  // /change
  if (text === '/change') {
    await updateUser(chatId, { step: 'look', prefs: {}, history: [] });
    await sendMessage(chatId, '새로운 친구를 만들어볼까요? 😊\n다시 취향을 선택해주세요!');
    await sendStepQuestion(chatId, 'look');
    return res.status(200).json({ ok: true });
  }

  // /help
  if (text === '/help') {
    await sendMessage(chatId, `<b>하루 사용법</b> 💕\n\n/start — 처음부터 시작 (새 친구 만들기)\n/change — 다른 친구로 바꾸기\n/help — 도움말\n\n7일 무료 체험 후 구독으로 계속 이용할 수 있어요 🌸`);
    return res.status(200).json({ ok: true });
  }

  const user = await getUser(chatId);
  if (!user) {
    await sendMessage(chatId, '/start 를 눌러서 시작해주세요 🌸');
    return res.status(200).json({ ok: true });
  }

  // 트라이얼 만료 체크
  if (user.step === 'chatting' && isTrialExpired(user.trial_start)) {
    await sendMessage(chatId,
      `⏰ <b>7일 무료 체험이 끝났어요!</b>\n\n계속 대화하려면 구독이 필요해요 💕\n\n베이직 월 9,900원으로 계속 만나요 🌸\n👉 haru-landing.vercel.app`
    );
    return res.status(200).json({ ok: true });
  }

  // 이름 입력 단계
  if (user.step === 'name') {
    const prefs = user.prefs || {};
    let name;
    if (text === '좋아' || text === '좋아요' || text === 'ㅇㅇ') {
      name = NAMES[Math.floor(Math.random() * NAMES.length)];
    } else {
      name = text.trim().slice(0, 6);
    }
    prefs.name = name;
    await updateUser(chatId, { prefs, step: 'chatting', history: [] });
    const systemPrompt = buildSystemPrompt(prefs);
    const greeting = await chat(systemPrompt, '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 살짝 말해줘. 설레는 느낌으로 2~3문장으로.');
    await sendMessage(chatId, `🌸 <b>${name}</b>와 연결됐어요!\n\n7일 무료 체험이 시작됩니다 💕`);
    await sendMessage(chatId, greeting);
    return res.status(200).json({ ok: true });
  }

  // 닉네임 직접 입력 단계
  if (user.step === 'custom_nickname') {
    const prefs = user.prefs || {};
    prefs.custom_nickname = text.trim().slice(0, 6);
    await updateUser(chatId, { prefs, step: 'name' });
    const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
    await sendMessage(chatId,
      `💌 "${prefs.custom_nickname}"(으)로 부를게요!\n\n✨ 이름을 정해줄게요!\n\n랜덤 이름: <b>${randomName}</b>\n\n이 이름이 좋으면 "좋아" 라고 입력하거나\n원하는 이름을 직접 입력해주세요 😊`
    );
    return res.status(200).json({ ok: true });
  }

  // 커스터마이즈 진행 중 (버튼 안 누르고 텍스트 입력한 경우)
  if (STEPS.includes(user.step)) {
    await sendStepQuestion(chatId, user.step);
    return res.status(200).json({ ok: true });
  }

  // 일반 대화
  if (user.step === 'chatting') {
    const prefs = user.prefs || {};
    const systemPrompt = buildSystemPrompt(prefs);
    const history = user.history || [];
    const reply = await chat(systemPrompt, text, history);
    const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-20);
    await updateUser(chatId, { history: newHistory });
    await sendMessage(chatId, reply);
  }

  return res.status(200).json({ ok: true });
}
