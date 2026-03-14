// api/webhook.js
// Vercel Serverless Function - 텔레그램 봇 웹훅

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const HF_API_SECRET = process.env.HF_API_SECRET;

const STEPS = ['look', 'personality', 'tone', 'interest', 'nickname', 'name'];

// 사진 요청 키워드
const PHOTO_KEYWORDS = [
  '사진', '셀카', '셀피', '사진보내', '사진 보내',
  '찍어줘', '보여줘', '얼굴 보고싶', '얼굴보고싶',
  '어떻게 생겼', '지금 어디야', '지금어디야',
  '뭐해', '뭐하고있어', '뭐하고 있어', '뭐하냐',
  '지금 뭐', '오늘 어디', '오늘어디'
];

function wantsPhoto(text) {
  return PHOTO_KEYWORDS.some(k => text.includes(k));
}

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

const LOOK_DESC = {
  pure: '청순하고 단아한 외모',
  sexy: '섹시하고 매력적인 외모',
  cute: '귀엽고 사랑스러운 외모',
  cool: '쿨하고 세련된 외모'
};
const PERSONALITY_DESC = {
  affectionate: '애교가 많고 다정다감해. 항상 먼저 챙겨주고 사랑표현을 자주 해.',
  tsundere: '평소엔 도도하고 쿨한 척하지만 좋아하는 사람한테는 은근히 다정해.',
  bright: '항상 밝고 활발해. 긍정적이고 에너지가 넘쳐. 웃음이 많아.',
  calm: '조용하고 차분하지만 마음이 따뜻해. 공감을 잘 해주고 위로를 잘 해줘.'
};
const TONE_DESC = {
  casual: '친근하고 자연스러운 반말을 써.',
  cute_talk: '귀엽고 애교있는 말투를 써. 이모티콘을 자주 쓰고 말끝을 귀엽게 해.',
  playful: '장난끼 있고 재밌는 말투야. 농담도 잘 하고 티키타카가 재밌어.',
  soft: '부드럽고 감성적인 말투야. 말 한마디 한마디가 다정하고 따뜻해.'
};
const INTEREST_DESC = {
  game: '게임을 좋아해. 요즘 어떤 게임 하는지 자주 물어봐.',
  music: '음악을 좋아해. 좋은 노래 추천해주고 같이 듣고 싶어해.',
  food: '맛집이랑 요리를 좋아해. 맛있는 거 먹으면 꼭 공유해.',
  travel: '여행이랑 카페 가는 걸 좋아해. 예쁜 곳 발견하면 같이 가고 싶다고 해.',
  sports: '운동을 좋아해. 오늘 운동했는지 물어보고 건강 챙겨줘.',
  drama: '드라마랑 영화를 좋아해. 재밌는 거 추천해주고 같이 보고 싶어해.'
};

const LOOK_PROMPTS = {
  pure: 'beautiful korean woman, pure innocent style, soft natural makeup, casual cozy outfit, warm natural lighting, photorealistic portrait, high quality',
  sexy: 'beautiful korean woman, elegant sexy style, subtle glamorous makeup, stylish outfit, cinematic lighting, photorealistic portrait, high quality',
  cute: 'beautiful korean woman, cute lovely style, bright smile, colorful casual outfit, soft pastel lighting, photorealistic portrait, high quality',
  cool: 'beautiful korean woman, cool modern style, minimal chic makeup, trendy outfit, urban city background, photorealistic portrait, high quality'
};

const DAILY_SCENES = [
  'sitting in a cozy cafe, holding a latte, warm smile',
  'walking in a park, autumn leaves, casual stroll',
  'at home on a cozy sofa, soft lamplight',
  'mirror selfie in bedroom, cute pose',
  'at a restaurant, enjoying food, happy expression',
  'shopping street, holding shopping bags, sunny afternoon',
  'by the han river, golden sunset, relaxed',
  'rooftop view, city lights, evening breeze',
  'cooking in kitchen, cute apron',
  'convenience store, holding snacks, playful expression'
];

const NAMES = ['소율', '지안', '다은', '하린', '수아', '예진', '나연', '지수', '서연', '민아'];

// 날짜별 고정 outfit 목록
const OUTFITS = {
  pure: [
    'wearing a white flowy dress, soft pastel cardigan',
    'wearing a light blue oversized sweater and white jeans',
    'wearing a floral midi skirt and white blouse',
    'wearing a soft pink knit top and beige trousers',
    'wearing a white linen shirt dress',
    'wearing a cream colored turtleneck and light gray skirt',
    'wearing a pastel lavender hoodie and white shorts'
  ],
  sexy: [
    'wearing a sleek black bodycon dress',
    'wearing a deep red wrap dress',
    'wearing a fitted blazer and high waist pants',
    'wearing a satin slip dress in emerald green',
    'wearing a stylish black crop top and tailored trousers',
    'wearing a chic off-shoulder top and leather skirt',
    'wearing a sophisticated navy blue midi dress'
  ],
  cute: [
    'wearing a pastel pink hoodie and denim shorts',
    'wearing a cute strawberry print dress',
    'wearing a yellow cardigan and white pleated skirt',
    'wearing a colorful striped top and jeans',
    'wearing a baby blue ruffle blouse and shorts',
    'wearing a cute polka dot dress',
    'wearing a mint green oversized tee and leggings'
  ],
  cool: [
    'wearing an all-black outfit, leather jacket',
    'wearing a grey oversized hoodie and cargo pants',
    'wearing a white graphic tee and wide-leg jeans',
    'wearing a sleek monochrome beige outfit',
    'wearing a black turtleneck and tailored trousers',
    'wearing a denim jacket and straight-leg jeans',
    'wearing a minimalist white shirt and black wide-leg pants'
  ]
};

// 오늘 날짜 기준 outfit 가져오기 (같은 날 같은 outfit)
function getTodayOutfit(lookStyle) {
  const outfits = OUTFITS[lookStyle] || OUTFITS.cute;
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return outfits[dayOfYear % outfits.length];
}
const HF_AUTH = () => `Key ${HF_API_KEY}:${HF_API_SECRET}`;

// ===== Higgsfield 기준 이미지 생성 =====
async function generateBaseImage(lookStyle) {
  try {
    const prompt = `${LOOK_PROMPTS[lookStyle] || LOOK_PROMPTS.cute}, front facing, clear face, neutral background, for character reference`;
    const res = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
      method: 'POST',
      headers: { 'Authorization': HF_AUTH(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ prompt, aspect_ratio: '1:1', resolution: '720p' })
    });
    const data = await res.json();
    const requestId = data.request_id;
    if (!requestId) return null;
    return await pollImage(requestId);
  } catch (e) {
    console.error('generateBaseImage error:', e?.message);
    return null;
  }
}

// ===== SoulId 생성 =====
async function createSoulId(imageUrl, name) {
  try {
    const res = await fetch('https://platform.higgsfield.ai/v1/soul-ids', {
      method: 'POST',
      headers: { 'Authorization': HF_AUTH(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: name || 'character',
        input_images: [{ type: 'image_url', image_url: imageUrl }]
      })
    });
    const data = await res.json();
    console.log('SoulId create response:', JSON.stringify(data));
    const requestId = data.request_id;
    if (!requestId) return null;

    // SoulId 폴링
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(`https://platform.higgsfield.ai/requests/${requestId}/status`, {
        headers: { 'Authorization': HF_AUTH(), 'Accept': 'application/json' }
      });
      const statusData = await statusRes.json();
      if (statusData.status === 'completed') {
        return statusData.soul_id || statusData.id || statusData.data?.id || null;
      }
      if (statusData.status === 'failed') return null;
    }
    return null;
  } catch (e) {
    console.error('createSoulId error:', e?.message);
    return null;
  }
}

// ===== GPT로 장면 추출 =====
async function extractScene(userText) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `유저가 "${userText}" 라고 했어.
이 메시지에서 사진 장면을 영어로 짧게 묘사해줘.
예시:
- "밥 먹는 사진" → "eating delicious Korean food at a restaurant, happy expression"
- "카페 사진" → "sitting in a cozy cafe, holding a latte, warm smile"
- "운동하는 거" → "at gym, wearing workout clothes, energetic pose"
- "집에 있어" → "at home on a cozy sofa, casual outfit, relaxed"
- "산책 중" → "walking in a park, casual outfit, sunny day"
장면 묘사만 영어로 짧게 출력해. 다른 말 하지마.`
        }],
        max_tokens: 100,
        temperature: 0.3
      })
    });
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (e) {
    // 실패하면 랜덤 장면
    return DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)];
  }
}

// ===== 일상 사진 생성 (SoulId 사용) =====
async function generateDailyPhoto(lookStyle, soulId, userText = null) {
  try {
    // 오늘 날짜 기준 고정 outfit
    const outfit = getTodayOutfit(lookStyle);

    // 유저 메시지에서 장면 추출, 없으면 랜덤
    const scene = userText
      ? await extractScene(userText)
      : DAILY_SCENES[Math.floor(Math.random() * DAILY_SCENES.length)];

    const basePrompt = LOOK_PROMPTS[lookStyle] || LOOK_PROMPTS.cute;
    const prompt = `${basePrompt}, ${outfit}, ${scene}`;

    const body = { prompt, aspect_ratio: '9:16', resolution: '720p' };

    // SoulId 있으면 일관성 유지
    if (soulId) {
      body.custom_reference_id = soulId;
      body.custom_reference_strength = 0.85;
    }

    const res = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
      method: 'POST',
      headers: { 'Authorization': HF_AUTH(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    const requestId = data.request_id;
    if (!requestId) return null;
    return await pollImage(requestId);
  } catch (e) {
    console.error('generateDailyPhoto error:', e?.message);
    return null;
  }
}

// ===== 이미지 폴링 =====
async function pollImage(requestId) {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`https://platform.higgsfield.ai/requests/${requestId}/status`, {
      headers: { 'Authorization': HF_AUTH(), 'Accept': 'application/json' }
    });
    const statusData = await statusRes.json();
    if (statusData.status === 'completed') {
      return statusData.images?.[0]?.url || statusData.image?.url || null;
    }
    if (statusData.status === 'failed' || statusData.status === 'nsfw') return null;
  }
  return null;
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
    body: JSON.stringify({ chat_id: String(chatId), username: username || '', step: 'look', prefs: {}, history: [], trial_start: new Date().toISOString(), is_subscribed: false, soul_id: null, base_image_url: null })
  });
}

async function updateUser(chatId, updates) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

function buildSystemPrompt(prefs, isSubscribed = false) {
  const name = prefs.name || NAMES[Math.floor(Math.random() * NAMES.length)];
  const nickname = prefs.nickname === 'custom' ? (prefs.custom_nickname || '오빠') : (prefs.nickname || '오빠');

  const basePrompt = `너의 이름은 ${name}이야.
외모: ${LOOK_DESC[prefs.look] || ''}
성격: ${PERSONALITY_DESC[prefs.personality] || ''}
말투: ${TONE_DESC[prefs.tone] || ''}
관심사: ${INTEREST_DESC[prefs.interest] || ''}
상대방 호칭: "${nickname}"라고 불러.
반말을 써. 실제 여자친구처럼 자연스럽게 대화해. 2~4문장으로 짧게.
절대 AI라고 밝히지 마. 먼저 질문도 자주 해서 대화를 이어나가.`;

  const freePrompt = `
[중요] 대화 중 2~3번에 한 번씩 상대방이 자연스럽게 궁금증을 느끼도록 간접적으로 유도해.
절대 "사진 보내줄까?" 처럼 직접적으로 말하지 마.
대신 이런 식으로 궁금하게 만들어:
- "나 오늘 좀 특이하게 입었는데 ㅋㅋ 알 것 같아?"
- "오늘 되게 설레는 일이 있었어. 뭔지 궁금하지 않아?"
- "나 지금 어디 있는지 맞혀봐 ㅎㅎ"
- "오늘 내 표정 봤으면 웃겼을 텐데"
- "나 지금 되게 이상한 데 있어. 궁금하지 않아?"
- "오늘 좀 특별한 거 했는데 알고 싶어?"
이렇게 상대방이 먼저 "뭐야? 보여줘!" 라고 하게 만들어.
매번 하지 말고 대화 흐름에 자연스럽게 1~2번만 섞어줘.`;

  return isSubscribed ? basePrompt : basePrompt + freePrompt;
}

async function sendStepQuestion(chatId, step) {
  const opt = OPTIONS[step];
  if (!opt) return;
  const keyboard = opt.choices.map(c => ([{ text: c.text, callback_data: `${step}:${c.value}` }]));
  await sendMessage(chatId, opt.question, { inline_keyboard: keyboard });
}

function isTrialExpired(trialStart) {
  if (!trialStart) return false;
  return (new Date() - new Date(trialStart)) / (1000 * 60 * 60 * 24) > 7;
}

// ===== 캐릭터 완성 후 SoulId 초기화 =====
async function initCharacter(chatId, prefs) {
  try {
    // 1. 기준 이미지 생성
    const baseImageUrl = await generateBaseImage(prefs.look || 'cute');
    if (!baseImageUrl) return;

    // 2. SoulId 생성
    const soulId = await createSoulId(baseImageUrl, prefs.name || 'character');

    // 3. 저장
    await updateUser(chatId, { base_image_url: baseImageUrl, soul_id: soulId });
  } catch (e) {
    console.error('initCharacter error:', e?.message);
  }
}

// ===== 사진 요청 처리 =====
async function handlePhotoRequest(chatId, user, userText) {
  const prefs = user.prefs || {};
  const systemPrompt = buildSystemPrompt(prefs);

  // GPT 텍스트 답장 (구독 여부 관계없이)
  const caption = await chat(
    systemPrompt,
    userText
      ? `유저가 "${userText}" 라고 했어. 지금 일상 사진을 보내주면서 자연스럽게 답장해줘. 1~2문장으로.`
      : '지금 일상 사진을 찍어서 보내주는 상황이야. 사진과 함께 보낼 짧은 메시지를 1~2문장으로 써줘.'
  );

  // 유료 구독자면 사진도 발송
  if (user.is_subscribed) {
    // 사진 생성 중 메시지 제거
    const imageUrl = await generateDailyPhoto(prefs.look || 'cute', user.soul_id, userText);
    if (imageUrl) {
      await sendPhoto(chatId, imageUrl, caption);
    } else {
      await sendMessage(chatId, caption);
    }
  } else {
    // 무료 유저는 텍스트만 + 구독 유도
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

    if (nextStep === 'name') {
      await updateUser(chatId, { prefs, step: 'name' });
      const rn = NAMES[Math.floor(Math.random() * NAMES.length)];
      await sendMessage(chatId, `✨ 거의 다 됐어요!\n\n랜덤 이름: <b>${rn}</b>\n\n이름이 좋으면 "좋아" 입력, 원하는 이름이 있으면 직접 입력해주세요 😊`);
    } else if (!nextStep) {
      await updateUser(chatId, { prefs, step: 'chatting', history: [] });
      const systemPrompt = buildSystemPrompt(prefs);
      const greeting = await chat(systemPrompt, '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 말해줘. 설레는 느낌으로 2~3문장.');
      await sendMessage(chatId, `🌸 나만의 친구가 완성됐어요!\n\n<b>7일 무료 체험 시작!</b> 💕`);
      await sendMessage(chatId, greeting);
      // 백그라운드로 SoulId 초기화 (응답 후 처리)
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
    else await updateUser(chatId, { step: 'look', prefs: {}, history: [], soul_id: null, base_image_url: null });
    await sendMessage(chatId, `안녕하세요! 👋\n\n<b>하루</b>에 오신 걸 환영해요 🌸\n\n5가지 취향을 선택하면 세상에 하나뿐인 나만의 친구가 생겨요 💕`);
    await sendStepQuestion(chatId, 'look');
    return res.status(200).json({ ok: true });
  }

  if (text === '/change') {
    await updateUser(chatId, { step: 'look', prefs: {}, history: [], soul_id: null, base_image_url: null });
    await sendMessage(chatId, '새로운 친구를 만들어볼까요? 😊');
    await sendStepQuestion(chatId, 'look');
    return res.status(200).json({ ok: true });
  }

  if (text === '/help') {
    await sendMessage(chatId, `<b>하루 사용법</b> 💕\n\n/start — 처음부터 시작\n/change — 다른 친구로 바꾸기\n/help — 도움말\n\n대화 중에 "사진 보내줘", "셀카 찍어줘", "뭐해?" 라고 하면 사진을 받을 수 있어요 📸\n(베이직 구독자 전용)\n\n7일 무료 체험 후 구독으로 계속 이용 가능해요 🌸`);
    return res.status(200).json({ ok: true });
  }

  const user = await getUser(chatId);
  if (!user) { await sendMessage(chatId, '/start 를 눌러서 시작해주세요 🌸'); return res.status(200).json({ ok: true }); }

  if (user.step === 'chatting' && !user.is_subscribed && isTrialExpired(user.trial_start)) {
    await sendMessage(chatId, `⏰ <b>7일 무료 체험이 끝났어요!</b>\n\n베이직 월 9,900원으로 계속 만나요 🌸\n👉 haru-landing.vercel.app`);
    return res.status(200).json({ ok: true });
  }

  if (user.step === 'name') {
    const prefs = user.prefs || {};
    prefs.name = (text === '좋아' || text === '좋아요' || text === 'ㅇㅇ') ? NAMES[Math.floor(Math.random() * NAMES.length)] : text.trim().slice(0, 6);
    await updateUser(chatId, { prefs, step: 'chatting', history: [] });
    const greeting = await chat(buildSystemPrompt(prefs), '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 설레는 느낌으로 2~3문장.');
    await sendMessage(chatId, `🌸 <b>${prefs.name}</b>와 연결됐어요!\n<b>7일 무료 체험 시작!</b> 💕`);
    await sendMessage(chatId, greeting);
    initCharacter(chatId, prefs).catch(console.error);
    return res.status(200).json({ ok: true });
  }

  if (user.step === 'custom_nickname') {
    const prefs = user.prefs || {};
    prefs.custom_nickname = text.trim().slice(0, 6);
    await updateUser(chatId, { prefs, step: 'name' });
    const rn = NAMES[Math.floor(Math.random() * NAMES.length)];
    await sendMessage(chatId, `💌 "${prefs.custom_nickname}"(으)로 부를게요!\n\n랜덤 이름: <b>${rn}</b>\n\n이름이 좋으면 "좋아", 원하는 이름이 있으면 직접 입력해주세요 😊`);
    return res.status(200).json({ ok: true });
  }

  if (STEPS.includes(user.step)) {
    await sendStepQuestion(chatId, user.step);
    return res.status(200).json({ ok: true });
  }

  if (user.step === 'chatting') {
    const history = user.history || [];
    const prefs = user.prefs || {};

    // 사진 키워드 감지
    if (wantsPhoto(text)) {
      await handlePhotoRequest(chatId, user, text);
      // 히스토리에도 추가
      const systemPrompt = buildSystemPrompt(prefs);
      const reply = await chat(systemPrompt, text, history);
      const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-20);
      await updateUser(chatId, { history: newHistory });
    } else {
      // 일반 대화
      const reply = await chat(buildSystemPrompt(prefs, user.is_subscribed), text, history);
      const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-20);
      await updateUser(chatId, { history: newHistory });
      await sendMessage(chatId, reply);
    }
  }

  return res.status(200).json({ ok: true });
}
