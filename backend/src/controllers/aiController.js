import { getAIAdapter } from '../services/aiService.js';

export async function getAIStatus(req, res) {
  const { isConfigured, provider, model } = getAIAdapter();
  res.json({
    success: true,
    isConfigured,
    provider,
    model,
    disclaimer: 'The AI assistant provides general well-being information only. It is not a licensed clinician, doctor, or therapist, and cannot provide medical diagnosis or treatment.'
  });
}

export async function askAI(req, res, next) {
  try {
    const { message, history = [] } = req.body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a question or topic for the AI assistant.'
      });
    }

    if (message.length > 2500) {
      return res.status(400).json({
        success: false,
        error: 'Message length exceeds the 2,500 character limit.'
      });
    }

    const { adapter, isConfigured, provider, model } = getAIAdapter();

    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        error: 'AI assistant is not configured with an active API key on this server. To enable, configure AI_API_KEY in backend/.env.',
        isConfigured: false,
        provider
      });
    }

    // Keep conversation history limited to the last 6 messages to protect privacy and respect token limits
    const sanitizedHistory = Array.isArray(history)
      ? history.slice(-6).map(h => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: String(h.content || '').slice(0, 1500)
        }))
      : [];

    sanitizedHistory.push({
      role: 'user',
      content: message.trim()
    });

    try {
      const responseText = await adapter.generateResponse(sanitizedHistory);

      res.json({
        success: true,
        response: responseText,
        provider,
        model,
        disclaimer: 'General educational guidance only. Not medical or therapeutic advice.'
      });
    } catch (apiError) {
      console.error('[AI Provider Error]:', apiError.message);
      res.status(502).json({
        success: false,
        error: 'The AI service encountered an issue processing your request. Please try again in a moment.'
      });
    }
  } catch (error) {
    next(error);
  }
}
