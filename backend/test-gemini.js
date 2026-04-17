require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function tester() {
  const response = await groq.chat.completions.create({
    model    : 'llama-3.3-70b-versatile',
    messages : [{ role: 'user', content: 'Dis bonjour en français' }],
  });
  console.log(response.choices[0].message.content);
}

tester();