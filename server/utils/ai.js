const Groq = require('groq-sdk');
const Sentiment = require('sentiment');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sentiment = new Sentiment();

// cache to avoid duplicate API calls for same message
const cache = new Map();

// rate limiter — max 25 req/min (safe under 30 limit)
let reqCount = 0;
let windowStart = Date.now();

function canMakeRequest() {
  const now = Date.now();
  if (now - windowStart > 60000) { reqCount = 0; windowStart = now; }
  if (reqCount >= 25) return false;
  reqCount++;
  return true;
}

async function analyzeWithGroq(msg) {
  const key = msg.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  if (!canMakeRequest()) {
    // fallback to local if rate limited
    return localFallback(msg);
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `Analyze this chat message and respond ONLY with valid JSON, no extra text:
{"sentiment":"Positive 😊","toxic":false,"replies":["Sure! What about you?","Sounds great!","Tell me more!","Haha nice!","Really? 😮"]}

Rules:
- sentiment: exactly "Positive 😊" or "Negative 😡" or "Neutral 😐"
- toxic: true if abusive/hateful, else false
- replies: array of exactly 5 short smart replies (max 6 words each) that make sense as RESPONSES to this message. Do NOT repeat the message itself. Make them varied and natural.

Message: "${msg}"`
      }],
      temperature: 0.8,
      max_tokens: 150,
    });

    let text = completion.choices[0]?.message?.content?.trim() || '';
    text = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    const result = {
      sentiment: ['Positive 😊','Negative 😡','Neutral 😐'].includes(parsed.sentiment) ? parsed.sentiment : localSentiment(msg),
      toxic: !!parsed.toxic,
      replies: Array.isArray(parsed.replies) ? parsed.replies.slice(0,5) : []
    };
    cache.set(key, result);
    return result;
  } catch (err) {
    console.error('Groq error:', err.message);
    return localFallback(msg);
  }
}

function localSentiment(msg) {
  const result = new Sentiment().analyze(msg);
  if (result.score > 1) return 'Positive 😊';
  if (result.score < -1) return 'Negative 😡';
  return 'Neutral 😐';
}

function localFallback(msg) {
  return { sentiment: localSentiment(msg), toxic: false, replies: [] };
}

exports.analyzeMessage = analyzeWithGroq;
