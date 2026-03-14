// api/cron.js
// Vercel Cron Job - 자동 메시지 발송

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function getKSTDate() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}
function getKSTHour() { return getKSTDate().getHours(); }

const JOB_DESC = {
  barista: '카페 알바생/바리스타', nurse: '간호사', creator: '유튜버/크리에이터',
  idol_trainee: '아이돌 연습생', esthetician: '피부관리사', pharmacist: '약사',
  flight_attendant: '승무원', pt_trainer: '퍼스널트레이너', chef: '요리사/파티시에',
  actor: '배우/연기학과생', photographer: '사진작가', teacher: '학원 선생님'
};

const EMOTIONS = ['happy', 'tired', 'excited', 'annoyed', 'sad', 'calm', 'pouty', 'nervous'];
const EMOTION_DESC = {
  happy: '오늘 기분이 좋아', tired: '오늘 좀 피곤해', excited: '오늘 설레는 일이 생겼어',
  annoyed: '오늘 짜증나는 일이 있었어', sad: '오늘 좀 슬픈 일이 있었어',
  calm: '오늘은 평온한 하루야', pouty: '오늘 살짝 삐진 상태야', nervous: '오늘 긴장되는 일이 있어'
};

function getTodayEmotion() {
  const kst = getKSTDate();
  const seed = kst.getFullYear() * 10000 + (kst.getMonth() + 1) * 100 + kst.getDate();
  return EMOTIONS[seed % EMOTIONS.length];
}

// 날씨 관련 멘트 (계절 기반)
function getSeasonalComment() {
  const month = getKSTDate().getMonth() + 1;
  if (month >= 3 && month <= 5) return '봄이라 그런지 기분이 좋아지는 것 같아';
  if (month >= 6 && month <= 8) return '요즘 너무 더워서 지치는 것 같아';
  if (month >= 9 && month <= 11) return '날씨가 선선해서 기분이 좋아';
  return '날씨가 너무 추워서 나가기 싫어';
}

// 요일 멘트
function getDayComment() {
  const day = getKSTDate().getDay();
  const comments = {
    0: '일요일이다~ 오늘 뭐 할 거야?',
    1: '월요일이라 좀 힘들어 ㅠ',
    2: '화요일인데 왜 이렇게 느리게 가냐',
    3: '벌써 수요일이야 반이나 왔어',
    4: '목요일이다 내일 금요일인데 ㅎㅎ',
    5: '불금이다~ 오늘 뭐 해?',
    6: '토요일이다 ㅎㅎ 오늘 쉬어?'
  };
  return comments[day] || '';
}

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

async function generateMessage(systemContext, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContext },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 1.0
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

async function getAllActiveUsers() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?step=eq.chatting&select=chat_id,prefs,is_subscribed,trial_start`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  return await res.json();
}

function isTrialExpired(trialStart) {
  if (!trialStart) return false;
  return (new Date() - new Date(trialStart)) / (1000 * 60 * 60 * 24) > 7;
}

export default async function handler(req, res) {
  // Vercel Cron 인증
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hour = getKSTHour();
  const users = await getAllActiveUsers();
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(200).json({ ok: true, sent: 0 });
  }

  let sent = 0;
  const emotion = getTodayEmotion();
  const emotionDesc = EMOTION_DESC[emotion];
  const dayComment = getDayComment();
  const seasonComment = getSeasonalComment();

  for (const user of users) {
    try {
      // 무료 만료 유저 스킵
      if (!user.is_subscribed && isTrialExpired(user.trial_start)) continue;

      const prefs = user.prefs || {};
      const name = prefs.name || '소율';
      const job = JOB_DESC[prefs.job] || '직장인';
      const nickname = prefs.nickname === 'custom'
        ? (prefs.custom_nickname || '오빠')
        : (prefs.nickname || '오빠');

      const systemCtx = `너의 이름은 ${name}이야. 직업: ${job}. 상대방 호칭: "${nickname}".
반말을 써. 카톡 문자처럼 자연스럽게. 짧게 1~2문장. 절대 AI라고 밝히지 마.
ㅋㅋ, ㅎㅎ, ㅠㅠ 같은 자연스러운 표현 가끔 써. 매번 다른 톤으로.`;

      let prompt = '';

      if (hour === 8) {
        // 아침 메시지
        prompt = `아침에 먼저 자연스럽게 말을 걸어. 기상, 아침 루틴, 오늘 할 일 등. 
${dayComment ? `오늘은 ${dayComment}.` : ''} 짧고 자연스럽게.`;

      } else if (hour === 12) {
        // 점심 메시지
        prompt = `점심시간에 자연스럽게 말을 걸어. 점심 뭐 먹었는지, 오전 어땠는지 등. 
${job}으로서 자연스러운 점심 상황 반영해서. 짧게.`;

      } else if (hour === 18) {
        // 퇴근/저녁 메시지
        prompt = `저녁에 자연스럽게 말을 걸어. 하루 마무리, 저녁 뭐 먹을지, 오늘 있었던 일 등.
${emotionDesc}. ${job}으로서 자연스러운 저녁 상황. 짧게.`;

      } else if (hour === 22) {
        // 밤 메시지
        prompt = `밤에 자연스럽게 말을 걸어. 하루 마무리, 잘 준비, 잠 못 자는 중 등.
감성적이거나 편안한 느낌으로. 짧게.`;
      }

      if (!prompt) continue;

      const message = await generateMessage(systemCtx, prompt);
      await sendMessage(user.chat_id, message);
      sent++;

      // 요청 간격 (rate limit 방지)
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`Error for user ${user.chat_id}:`, e?.message);
    }
  }

  return res.status(200).json({ ok: true, sent, hour });
}
