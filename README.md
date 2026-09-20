# Resume AI Tailor

Local MVP web app for tailoring a master DOCX resume to a pasted job description.

## Features

- Upload master resume DOCX
- Paste company name and job description
- AI detects job title automatically
- Calculates original and updated match scores
- Generates DOCX and PDF downloads
- Supports Grok/xAI or OpenAI from `.env`

## Run backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

On Mac/Linux, use:

```bash
cp .env.example .env
```

## Use Grok / xAI

Open `backend/.env` and use:

```env
AI_PROVIDER=grok
PORT=5000
XAI_API_KEY=your_xai_key_here
XAI_MODEL=grok-4.3
XAI_BASE_URL=
```

## Use OpenAI instead

Open `backend/.env` and use:

```env
AI_PROVIDER=openai
PORT=5000
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-5.5-mini
```

## Run frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

## Notes

For best formatting, upload a DOCX resume. PDF should be treated as final output, not the editable master template.
