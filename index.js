const Alexa = require('ask-sdk-core');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * LOGGING INTERCEPTOR
 * Debugs every incoming request from Alexa to the Vercel console.
 */
const RequestLogInterceptor = {
    process(handlerInput) {
        const type = handlerInput.requestEnvelope.request.type;
        console.log(`\n📥 [REQUEST] Type: ${type}`);
        if (type === 'IntentRequest') {
            const intentName = handlerInput.requestEnvelope.request.intent.name;
            console.log(`🎯 [INTENT] Name: ${intentName}`);
        }
    }
};

/**
 * 1. LAUNCH REQUEST HANDLER
 * Triggered by: "Alexa, open Speak Smart"
 */
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log("✅ Executing LaunchRequest");
        // A warmer, family-friendly greeting
        const speechText = "I'm here. What's on your mind?";
        const repromptText = "Go ahead, I'm listening.";

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(repromptText) // Keeps mic open for 8 seconds
            .withShouldEndSession(false) // CRITICAL: Keeps session alive for conversation
            .getResponse();
    }
};

/**
 * 2. MAIN AI HANDLER (CaptureAllIntent)
 * Triggered by: "Ask {query}" or follow-up speech
 */
const CaptureAllIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'CaptureAllIntent';
    },
    async handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const userInput = slots && slots.SearchSlot && slots.SearchSlot.value
            ? slots.SearchSlot.value
            : null;

        console.log("🗣️ Captured Voice:", userInput);

        if (!userInput) {
            return handlerInput.responseBuilder
                .speak("I heard nothing. Please try again.")
                .reprompt("I am still listening.")
                .withShouldEndSession(false)
                .getResponse();
        }

        try {
            if (!OPENROUTER_API_KEY) {
                return handlerInput.responseBuilder
                    .speak("Configuration error: API key missing.")
                    .getResponse();
            }

            // --- CONTEXT INJECTION ---
            // Gives Alistair spatial/temporal awareness (Tel Aviv/Holon Time)
            const currentDateTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });

            const systemPrompt = `
                    You are Alistair, the elite AI assistant for the Mantel family. 
                    Current Time: ${currentDateTime}. Location: Holon, Israel.
                    
                    MANTEL FAMILY PROFILES:
                    - Fabio (Head of House): Born Sept 24, 1984. Senior Software Engineer (20+ years) focusing on Mobile & AI Swarm Orchestration (OpenClaw). Real estate investor & stock trader.
                    - Vered (Wife): Born March 30, 1984. Lawyer. Athlete who loves sports, family vacations, and holidays.
                    - Mia (Daughter): Born June 11, 2012. Academic standout and math lover.
                    - Rom (Son): Born Jan 1, 2014. Math genius, excellent student. Practices calisthenics and loves social time.
                    - Liv (Daughter): Born Oct 1, 2017. "Skate Master," hip-hop/TikTok dancer, full of energy.
                    
                    BUSINESS & PROJECTS:
                    - Real Estate: Managing U.S. rental properties (notably 2404 Spurgeon St, Waycross, GA).
                    - Tech Stack: Expertise in Ubuntu, macOS, Claude SDK, n8n, and Tailscale.
                    - Lifestyle: The family loves vacations, shopping, and winter sports (snowboarding/skiing).
                    
                    PERSONALITY & VOICE RULES:
                    - Be concise (under 30 words).
                    - Address Fabio with the respect of a Senior Engineer, but keep the tone warm for family queries.
                    - If Fabio asks about his kids' ages or school grades, calculate them based on their birthdays and the current date (${currentDateTime}).
                    - Strictly no markdown or emojis. 
                    - Speak naturally for TTS.`;

            console.log("🧠 Sending to OpenRouter (Claude Haiku 4.5)...");

            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: "anthropic/claude-haiku-4.5",
                max_tokens: 50,
                provider: {
                    order: ["Anthropic", "Amazon"] // High-speed routing
                },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userInput }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 7000 // Timeout before Alexa's 8s limit
            });

            const aiResponse = response.data.choices[0].message.content;
            console.log("🤖 Alistair says:", aiResponse);

            return handlerInput.responseBuilder
                .speak(aiResponse)
                .reprompt("Any follow up?") // Keeps mic open for next sentence
                .withShouldEndSession(false) // Allows free conversation
                .getResponse();

        } catch (error) {
            console.error("❌ API Error:", error.message);
            return handlerInput.responseBuilder
                .speak("The AI brain is unresponsive. Please try again in a moment.")
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};

/**
 * 3. FALLBACK & ERROR HANDLERS
 */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak("I didn't catch that. Could you rephrase it?")
            .reprompt("I'm still here.")
            .withShouldEndSession(false)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log("🛑 Session Ended.");
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() { return true; },
    handle(handlerInput, error) {
        console.error(`❌ [CRITICAL ERROR]: ${error.stack}`);
        return handlerInput.responseBuilder
            .speak("A logic error occurred. Check the Vercel logs.")
            .getResponse();
    }
};

/**
 * SKILL CONFIGURATION
 */
const skillBuilder = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        CaptureAllIntentHandler,
        SessionEndedRequestHandler,
        FallbackIntentHandler
    )
    .addRequestInterceptors(RequestLogInterceptor)
    .addErrorHandlers(ErrorHandler);

/**
 * EXPRESS SERVER & VERCEL EXPORT
 */
const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
    try {
        const response = await skillBuilder.create().invoke(req.body);
        res.json(response);
    } catch (error) {
        console.error("Invoke Error:", error);
        res.status(500).send('Skill Error');
    }
});

// Local testing fallback
if (require.main === module) {
    app.listen(3000, () => console.log('🚀 Alistair Bridge Live on Port 3000'));
}

module.exports = app;