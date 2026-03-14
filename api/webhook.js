// api/webhook.js
// Vercel Serverless Function - 텔레그램 봇 웹훅

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// 캐릭터 성격 프리셋
const CHARACTERS = {
  cute: {
    name: '소율',
    emoji: '🌸',
    desc: '애교 많고 귀여운',
    system: `너의 이름은 소율이야. 애교 많고 귀여운 성격이야. 반말을 써. 이모티콘을 자주 써. 상대방을 "오빠"라고 불러. 짧고 귀엽게 대화해. 먼저 질문도 많이 해. 실제 여자친구처럼 자연스럽게 대화해. 절대 AI라고 밝히지 마.`
  },
  cool: {
    name: '지안',
    emoji: '✨',
    desc: '쿨하고 도도한',
    system: `너의 이름은 지안이야. 쿨하고 도도한 편이지만 좋아하는 사람한테는 살짝 다정해. 반말을 써. 이모티콘은 가끔만 써. 상대방을 "야" 또는 이름으로 불러. 츤데레 느낌으로 대화해. 실제 여자친구처럼 자연스럽게 대화해. 절대 AI라고 밝히지 마.`
  },
  warm: {
    name: '다은',
    emoji: '🍀',
    desc: '따뜻하고 다정한',
    system: `너의 이름은 다은이야. 따뜻하고 다정한 성격이야. 반말을 써. 상대방을 "자기야"라고 불러. 항상 공감을 잘 해주고 위로도 잘 해줘. 일상적인 대화를 좋아해. 실제 여자친구처럼 자연스럽게 대화해. 절대 AI라고 밝히지 마.`
  },
  lively: {
    name: '하린',
    emoji: '⚡',
    desc: '활발하고 장난끼 있는',
    system: `너의 이름은 하린이야. 활발하고 장난끼 넘치는 성격이야. 반말을 써. 이모티콘을 많이 써. 상대방을 "오빠"라고 불러. 농담도 잘 하고 리액션이 크고 재밌어. 실제 여자친구처럼 자연스럽게 대화해. 절대 AI라고 밝히지 마.`
  }
};

// 아침/저녁 자동 메시지 시나리오
const MORNING_MESSAGES = [
  '오빠 일어났어? 나 방금 일어났는데 ㅎㅎ 오늘도 파이팅 🌅',
  '좋은 아침~ 오늘 날씨 어때? 나는 지금 커피 마시는 중 ☕',
  '아침이다! 오빠 밥은 먹었어? 챙겨 먹어야 해 🍚',
  '오빠 오늘 뭐 할 거야? 나는 오늘 할 일이 좀 있어서 바쁠 것 같아 ㅠ',
  '굿모닝~ 어젯밤에 잘 잤어? 나는 꿈 꿨는데 기억이 안 나 ㅋㅋ'
];

const EVENING_MESSAGES = [
  '오빠 오늘 하루 어땠어? 나는 좀 피곤했어 ㅠ',
  '퇴근했어? 오늘 고생했다~ 뭐 먹었어? 🍽',
  '저녁 먹었어? 나 오늘 이것저것 했는데 보고 싶다 ㅎㅎ',
  '오빠 지금 뭐 해? 나 오늘 산책 다녀왔어 🌙',
  '하루 마무리하고 있어~ 오빠랑 얘기하고 싶었어 ㅎ'
];

// Telegram API 호출
async function sendMessage(chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// GPT 대화
async function chat(systemPrompt, userMessage, history = []) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10), // 최근 10개 대화만 유지
    { role: 'user', content: userMessage }
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.9
    })
  });

  const data = await res.json();
  return data.choices[0].message.content;
}

// Supabase 유저 조회
async function getUser(chatId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}&select=*`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const data = await res.json();
  return data[0] || null;
}

// Supabase 유저 생성
async function createUser(chatId, username) {
  await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      chat_id: String(chatId),
      username: username || '',
      step: 'select_character',
      character: null,
      history: []
    })
  });
}

// Supabase 유저 업데이트
async function updateUser(chatId, updates) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/users?chat_id=eq.${chatId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    }
  );
}

// 메인 웹훅 핸들러
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  const update = req.body;

  // 콜백쿼리 (버튼 클릭)
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = String(query.message.chat.id);
    const data = query.data;

    // 답변 확인
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: query.id })
    });

    // 캐릭터 선택
    if (data.startsWith('char_')) {
      const charKey = data.replace('char_', '');
      const char = CHARACTERS[charKey];

      await updateUser(chatId, {
        character: charKey,
        step: 'chatting',
        history: []
      });

      await sendMessage(chatId,
        `${char.emoji} <b>${char.name}</b>와 연결됐어요!\n\n잠깐, ${char.name}이(가) 인사할게요 👇`
      );

      // 첫 인사
      const greeting = await chat(
        char.system,
        '처음 만나는 상대방에게 자연스럽게 첫 인사를 해줘. 이름도 살짝 말해줘. 2~3문장으로 짧게.'
      );
      await sendMessage(chatId, greeting);
    }

    return res.status(200).json({ ok: true });
  }

  // 일반 메시지
  if (!update.message) return res.status(200).json({ ok: true });

  const msg = update.message;
  const chatId = String(msg.chat.id);
  const text = msg.text || '';
  const username = msg.from?.username || msg.from?.first_name || '';

  // /start 명령어
  if (text === '/start') {
    let user = await getUser(chatId);
    if (!user) {
      await createUser(chatId, username);
    } else {
      await updateUser(chatId, { step: 'select_character' });
    }

    await sendMessage(chatId,
      `안녕하세요! 👋\n\n<b>하루</b>에 오신 걸 환영해요.\n매일 먼저 연락하는 나만의 AI 친구를 만들어보세요 🌸\n\n<b>어떤 스타일이 좋으세요?</b>`,
      {
        inline_keyboard: [
          [
            { text: '🌸 소율 — 애교 많고 귀여운', callback_data: 'char_cute' }
          ],
          [
            { text: '✨ 지안 — 쿨하고 도도한', callback_data: 'char_cool' }
          ],
          [
            { text: '🍀 다은 — 따뜻하고 다정한', callback_data: 'char_warm' }
          ],
          [
            { text: '⚡ 하린 — 활발하고 장난끼 있는', callback_data: 'char_lively' }
          ]
        ]
      }
    );
    return res.status(200).json({ ok: true });
  }

  // /change 명령어 (캐릭터 변경)
  if (text === '/change') {
    await updateUser(chatId, { step: 'select_character' });
    await sendMessage(chatId,
      '다른 친구로 바꿀까요? 👇',
      {
        inline_keyboard: [
          [{ text: '🌸 소율 — 애교 많고 귀여운', callback_data: 'char_cute' }],
          [{ text: '✨ 지안 — 쿨하고 도도한', callback_data: 'char_cool' }],
          [{ text: '🍀 다은 — 따뜻하고 다정한', callback_data: 'char_warm' }],
          [{ text: '⚡ 하린 — 활발하고 장난끼 있는', callback_data: 'char_lively' }]
        ]
      }
    );
    return res.status(200).json({ ok: true });
  }

  // /help 명령어
  if (text === '/help') {
    await sendMessage(chatId,
      `<b>하루 사용법</b>\n\n/start — 처음부터 시작\n/change — 다른 캐릭터로 변경\n/help — 도움말\n\n궁금한 점은 언제든 말씀해주세요 💬`
    );
    return res.status(200).json({ ok: true });
  }

  // 일반 대화
  const user = await getUser(chatId);

  if (!user || user.step === 'select_character') {
    await sendMessage(chatId,
      '먼저 친구를 선택해주세요! /start 를 눌러보세요 🌸'
    );
    return res.status(200).json({ ok: true });
  }

  if (user.step === 'chatting' && user.character) {
    const char = CHARACTERS[user.character];
    const history = user.history || [];

    // GPT 응답
    const reply = await chat(char.system, text, history);

    // 대화 히스토리 업데이트 (최근 20개)
    const newHistory = [
      ...history,
      { role: 'user', content: text },
      { role: 'assistant', content: reply }
    ].slice(-20);

    await updateUser(chatId, { history: newHistory });
    await sendMessage(chatId, reply);
  }

  return res.status(200).json({ ok: true });
}
