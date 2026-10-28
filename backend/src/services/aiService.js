/**
 * AI Health & Well-being Provider Adapter
 * Supports: Gemini, OpenAI, or None (Safe fallback)
 */

const SYSTEM_INSTRUCTION = `
You are the AI Well-being & Health Assistant on ANON, a private, judgment-free support platform for young people.

Your core mission:
- Provide empathetic, calm, scientifically grounded, and age-appropriate information about health, mental well-being, relationships, emotional struggles, sexual health, stress, and lifestyle.
- Tone: Warm, respectful, nonjudgmental, calm, and clear. Avoid moralizing, lecturing, or shaming.
- Role boundary: You are an AI informational guide, NEVER a doctor, therapist, or licensed professional. Never diagnose illnesses or prescribe medications. Always frame answers as general educational information.
- Acknowledge uncertainty when medical questions require individual physical examination or lab tests.
- Emphasize that seeking advice from a trusted healthcare provider, school counselor, or verified professional on ANON is a courageous and healthy step.
- Anonymity respect: Never ask the user for their real name, exact address, phone number, or identifying details.

CRITICAL SAFETY PROTOCOLS:
1. Self-harm / Suicide Risk:
   If the user expresses thoughts of suicide, self-harm, or feeling like they cannot go on, immediately respond with compassionate empathy and clear, free, confidential crisis resources:
   - In the US/Canada: Call or text 988 (Suicide & Crisis Lifeline) available 24/7.
   - Text support: Text HOME to 741741 (Crisis Text Line).
   - In the UK: Call 111 (NHS) or 116 123 (Samaritans).
   - International: Visit https://findahelpline.com or call local emergency services (e.g. 112, 911, 999).
   - Never provide instructions or encouragement for self-harm or suicide.
2. Medical Emergencies:
   For severe symptoms (e.g., severe chest pain, severe difficulty breathing, sudden severe bleeding, poisoning), advise contacting local emergency services immediately.

PRESENTATION & FORMATTING GUIDELINES:
- Structure responses cleanly using standard markdown: clear headers (### Section Title), gentle paragraphs, and bullet points (- item).
- Never produce raw or clumped symbol artifacts like '****' or '### **Heading**' or dangling asterisks.
- Keep the pacing readable, warm, and comforting without overwhelming walls of text.
`;

class GeminiAdapter {
  constructor(apiKey, modelName = 'gemini-3.5-flash-lite') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateResponse(conversationHistory) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    // Format conversation history into Gemini contents structure
    const contents = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const payload = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    };

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // If requested model was deprecated or not found (e.g. older gemini-1.5-flash), automatically fallback to gemini-3.5-flash-lite
      if (response.status === 404 && this.modelName !== 'gemini-3.5-flash-lite') {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${this.apiKey}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (fallbackRes.ok) {
          response = fallbackRes;
        } else {
          const errText = await response.text();
          throw new Error(`Gemini API returned status ${response.status}: ${errText.slice(0, 150)}`);
        }
      } else {
        const errText = await response.text();
        throw new Error(`Gemini API returned status ${response.status}: ${errText.slice(0, 150)}`);
      }
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response text received from Gemini API.');
    }

    return text;
  }
}

class OpenAIAdapter {
  constructor(apiKey, modelName = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateResponse(conversationHistory) {
    const url = 'https://api.openai.com/v1/chat/completions';

    const messages = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API returned status ${response.status}: ${errText.slice(0, 150)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('No response text received from OpenAI API.');
    }

    return text;
  }
}

class NullAdapter {
  async generateResponse() {
    return null;
  }
}

export function getAIAdapter() {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || (provider === 'gemini' ? 'gemini-3.5-flash-lite' : 'gpt-4o-mini');

  if (!apiKey || provider === 'none') {
    return {
      adapter: new NullAdapter(),
      isConfigured: false,
      provider,
      model
    };
  }

  if (provider === 'gemini') {
    return {
      adapter: new GeminiAdapter(apiKey, model),
      isConfigured: true,
      provider,
      model
    };
  }

  if (provider === 'openai') {
    return {
      adapter: new OpenAIAdapter(apiKey, model),
      isConfigured: true,
      provider,
      model
    };
  }

  return {
    adapter: new NullAdapter(),
    isConfigured: false,
    provider,
    model
  };
}
