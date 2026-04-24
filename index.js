const Alexa = require('ask-sdk-core');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const RequestLogInterceptor = {
    process(handlerInput) {
        const type = handlerInput.requestEnvelope.request.type;
        console.log(`\n📥 [REQUEST] Type: ${type}`);
        if (type === 'IntentRequest') {
            console.log(`🎯 [INTENT] Name: ${handlerInput.requestEnvelope.request.intent.name}`);
        }
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' &&
            request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.log("⚠️  FALLBACK TRIGGERED: Alexa hit a dead end.");

        return handlerInput.responseBuilder
            .speak("I'm sorry, Fabio. I didn't quite catch that. Try starting your command with the word 'ask'.")
            .reprompt("Alistair is listening. Please say 'ask' followed by your command.")
            .withShouldEndSession(false)
            .getResponse();
    }
};

// 1. The "Wake Up" Handler
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log("✅ Inside LaunchRequestHandler execution");
        return handlerInput.responseBuilder
            .speak("Alistair online. Standing by for your command, Fabio.")
            .reprompt("What is the mission?")
            .getResponse();
    }
};

// 2. The "Mission Command" Handler
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
                .speak("I heard nothing. Please try your command again.")
                .reprompt("I am listening.")
                .withShouldEndSession(false)
                .getResponse();
        }

        try {
            if (!OPENROUTER_API_KEY) {
                console.error('Missing OPENROUTER_API_KEY in environment variables.');
                return handlerInput.responseBuilder
                    .speak('I am missing the API key configuration. Please check the server setup.')
                    .withShouldEndSession(false)
                    .getResponse();
            }

            console.log("🧠 Routing to Claude Haiku via OpenRouter...");

            // Context Injection: Gives Alistair spatial and temporal awareness
            const currentDateTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });
            const dynamicSystemPrompt = `You are Alistair, an elite AI voice assistant. Current system time: ${currentDateTime}. Keep your answers extremely concise (under 30 words) because they will be read aloud by a text-to-speech engine. Do not use markdown, emojis, or code blocks. Speak naturally.`;

            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: "anthropic/claude-haiku-4.5",
                max_tokens: 45, // RESTORED: Critical for beating the 8-second Alexa timeout
                provider: {
                    order: ["Anthropic", "Amazon"] // RESTORED: Forces fastest available routing
                },
                messages: [
                    { role: "system", content: dynamicSystemPrompt },
                    { role: "user", content: userInput }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message.content;
            console.log("🤖 Alistair says:", aiResponse);

            return handlerInput.responseBuilder
                .speak(aiResponse)
                .reprompt("Is there anything else?")
                .withShouldEndSession(false)
                .getResponse();

        } catch (error) {
            console.error("❌ OpenRouter API Error:", error.message);
            if (error.response) console.error(error.response.data);

            return handlerInput.responseBuilder
                .speak("I am having trouble connecting to the AI brain. Please check the server logs.")
                .reprompt("Want to try again?")
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};

// 3. The "Goodbye" Handler
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log("🛑 Session Ended Request");
        return handlerInput.responseBuilder.getResponse();
    }
};

const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        console.log(`Fallback: You triggered ${intentName}`);
        return handlerInput.responseBuilder
            .speak(`I haven't learned how to handle ${intentName} yet.`)
            .getResponse();
    }
};

// 4. The Global Error Handler
const ErrorHandler = {
    canHandle() { return true; },
    handle(handlerInput, error) {
        console.error(`❌ [ERROR]: ${error.message}`);
        console.error(error.stack);
        return handlerInput.responseBuilder
            .speak("Apologies, I encountered a logic error. Check the terminal.")
            .getResponse();
    }
};

const skillBuilder = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        CaptureAllIntentHandler,
        SessionEndedRequestHandler,
        FallbackIntentHandler,
        IntentReflectorHandler
    )
    .addRequestInterceptors(RequestLogInterceptor)
    .addErrorHandlers(ErrorHandler);

const app = express();

// Modernized: Use native Express middleware instead of body-parser
app.use(express.json());

app.post('/', async (req, res) => {
    try {
        const response = await skillBuilder.create().invoke(req.body);
        res.send(response);
    } catch (error) {
        console.error("Invoke Error:", error);
        res.status(500).send('Skill Error');
    }
});

// Export for Vercel serverless; listen locally when run directly
if (require.main === module) {
    app.listen(3000, () => console.log('🚀 Alistair Bridge active on port 3000'));
}

module.exports = app;