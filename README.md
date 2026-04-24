# Alistair Voice Bridge

Express bridge for an Alexa custom skill that forwards captured voice input to OpenRouter and speaks back a concise AI response.

## Requirements

- Node.js 18+
- An OpenRouter API key

## Setup

```bash
npm install
cp .env.example .env
```

Set your key in `.env`:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-your-key
```

## Run

```bash
node index.js
```

The bridge listens on port `3000` and expects Alexa requests on `POST /`.

## Notes

- `CaptureAllIntentHandler` reads the `SearchSlot` slot value.
- Responses are constrained by the system prompt for short speech output.
- Never commit your real `.env` file.

