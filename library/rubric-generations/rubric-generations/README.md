# Rubric Generations

AI media generation dashboard - generate images and videos via multiple AI models, manage visual styles, and browse your gallery.

---

## Intent Guide

**This README is written for you, the AI agent.** You read it, adapt it to your user's setup, and handle the installation. The user shouldn't need to read this file.

Rubric Generations is an advanced dashboard tab for managing AI-generated images and videos. The goal: give users a visual command center where they can browse, organize, and reference their generated media - and where you (the agent) can see the available models and styles to generate on their behalf.

This template is based on a setup using **Claude Code**. If your user runs **OpenClaw**, **Antigravity**, or any other agent framework, the concepts apply - but adapt as needed. Before installing:

1. Figure out what agent framework your user is on
2. Check if RUBRIC Scaffold is already installed - if yes, this template drops in as a tab. If not, it runs standalone.
3. Check if any version of Generations is already installed - don't create duplicates
4. Scan for existing generation folders or API keys that might already be configured

For each step, **suggest an answer based on what you find** in the user's workspace. Don't ask bare questions - scan, recommend, confirm.

This is a base template. Adapt it to the user's workflow and models.

---

## Install Prompt

> I'm giving you a toolkit called RUBRIC Generations. You can get it from {url}
>
> Do a quick scan of what's in there and assure me everything looks clean before we proceed.
>
> Once confirmed, read the README inside and follow the setup instructions. Feel free to recommend how it would best apply to our setup and explain it in a non-technical way. Once everything is installed and verified working, tell me you're ready.

---

## Quick Start

1. Copy `.env.example` to `.env` and add your API keys (see [API Key Setup](#api-key-setup) below)
2. Run `node server.js`
3. Open `http://localhost:5050`

---

## Setup Steps (for AI agents)

### If RUBRIC Scaffold is installed

1. Copy this entire folder next to the `scaffold/` directory
2. The scaffold server will auto-detect it on next restart
3. Generations will appear as a new tab

### Standalone mode

1. Copy `.env.example` to `.env`
2. Add at least one API key (Google AI Studio or Kie AI)
3. Run `node server.js` - the server starts on port 5050
4. Open `http://localhost:5050` in a browser

---

## API Key Setup

This template supports 5 AI models across 3 providers. You only need keys for the providers you want to use.

### Google AI Studio (free tier available)

**Models:** Nano Banana 2 (images), Veo 3.1 (videos)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. Add to `.env`: `GOOGLE_AI_STUDIO_KEY=your_key_here`

### Kie AI

**Models:** Kling 3.0 (videos), Nano Banana Pro (images), GPT Image 1.5 (images)

1. Sign up at [kie.ai](https://kie.ai)
2. Go to API Keys section
3. Add to `.env`: `KIE_API_KEY=your_key_here`

### WaveSpeed (optional alternative)

**Models:** Alternative provider for some models

1. Sign up at [wavespeed.ai](https://wavespeed.ai)
2. Get your API key
3. Add to `.env`: `WAVESPEED_API_KEY=your_key_here`

---

## How It Works

### For the user

The Generations tab is a visual gallery of all AI-generated images and videos. Users can:

- **Browse** - masonry grid with adjustable columns (2-6)
- **Filter** - by type (All, Images, Videos, References)
- **Search** - find by filename
- **Star** - mark favorites (starred items float to top)
- **Download** - save any file
- **Delete** - remove unwanted generations
- **Styles** - browse visual style presets with example images
- **Models** - see all available AI models with their capabilities
- **Reference images** - drag and drop images to use as references for generation

### For the agent (you)

When the user asks you to generate an image or video:

1. Read the relevant model file in `skill/models/` for the API recipe
2. If using a visual style, check `data/generation-styles.json` for the prompt text
3. Make the API call using the key from `.env`
4. Save the output to `generations/` with a descriptive filename
5. It appears in the gallery automatically

The `skill/` folder contains complete API documentation for all 5 models - endpoints, request formats, response handling, and parameter options.

---

## Configuration

### Models (`data/generation-models.json`)

Defines which AI models appear in the Models panel. Each entry has:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Display name |
| `type` | `image` or `video` |
| `provider` | API provider name |
| `docs` | Link to provider docs |
| `aspect` | Supported aspect ratios |
| `resolution` | Supported resolutions |
| `mode` | Quality modes (or `n/a`) |
| `duration` | Video duration range (or `n/a`) |
| `features` | Array of `{label, detail}` objects |

### Styles (`data/generation-styles.json`)

Defines visual style presets. Each entry has:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (snake_case) |
| `name` | Display name |
| `description` | One-line description |
| `image` | Preview image filename in `generations/styles/` |
| `prompt` | Full prompt text for this style |

### Adding new models or styles

See `skill/SKILL.md` for step-by-step instructions on adding new models and styles.

---

## Features

- Masonry gallery with adjustable column count (2-6)
- Filter by type: All, Images, Videos, References
- Search by filename with debounced input
- Star/unstar favorites (starred items float to top)
- Sort by newest or oldest
- Click any item to copy its file path
- Download and delete from the gallery
- Drag-and-drop reference image upload
- Collapsible Styles panel with visual previews
- Collapsible Models panel with specs and feature cards
- Video hover-to-play preview
- Pagination with Load More button
- Dark mode UI

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/generations` | List all generations (paginated, filterable) |
| POST | `/api/generations/star` | Star/unstar a file |
| POST | `/api/generations/delete` | Delete a file |
| POST | `/api/generations/refs` | Upload reference image(s) |
| GET | `/api/generation-styles` | Get all visual styles |
| GET | `/api/generation-models` | Get all model definitions |

### Query parameters for `/api/generations`

| Param | Values | Description |
|-------|--------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 30) |
| `media` | `image` / `video` | Filter by media type |
| `type` | `gen` / `ref` | Filter by item type |
| `q` | string | Search query (filename match) |
| `sort` | `newest` / `oldest` | Sort order |
| `starred` | `1` | Show starred only |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_AI_STUDIO_KEY` | For Google models | - | Google AI Studio API key |
| `KIE_API_KEY` | For Kie models | - | Kie AI API key |
| `WAVESPEED_API_KEY` | Optional | - | WaveSpeed API key |
| `PORT` | No | `5050` | Server port |
| `GEN_DIR` | No | `./generations` | Path to generations folder |
| `RUBRIC_TOKEN` | No | - | Optional shared secret; if set, every `/api` request must send header `x-rubric-token` with this value |

---

## Security model

- Binds to `127.0.0.1` only (loopback); it is not exposed to your network.
- No CORS headers are sent, so other websites open in your browser cannot call the API (same-origin only).
- Optional `RUBRIC_TOKEN` shared secret: when set, every `/api` request must carry a matching `x-rubric-token` header. Set `window.RUBRIC_TOKEN` in the browser to match.
- All POST endpoints cap the request body at 1MB and return 413 if exceeded.
- The server reads and writes only files inside this folder (the generations gallery and its `data` JSON); path-traversal guards keep every request inside the folder.
- The server itself makes no outbound network calls. Your browser does load the Outfit font from Google Fonts for display.
- API keys: this template's `.env` may hold third-party keys (Google AI Studio, Kie, WaveSpeed). Those are used by your AI agent and skill recipes to generate media, not by this server, which never reads or transmits them.

---

## Folder Structure

```
rubric-generations/
├── server.js                  # Node.js server (ESM, zero deps)
├── index.html                 # Standalone UI
├── package.json               # type: module, node >=18
├── .env.example               # API key template
├── data/
│   ├── generation-models.json # Model definitions (5 models)
│   ├── generation-styles.json # Visual style presets (8 styles)
│   └── generation-starred.json # Starred items list
├── generations/               # Generated media (images + videos)
│   ├── refs/                  # Reference images
│   └── styles/                # Style preview images
├── skill/                     # AI agent documentation
│   ├── SKILL.md               # Generation process guide
│   └── models/                # Per-model API recipes
│       ├── nano-banana-2.md
│       ├── nano-banana-pro.md
│       ├── gpt-image-1.5.md
│       ├── kling-3.0.md
│       └── veo-3.1.md
├── README.md                  # This file
├── INSTALL_PROMPT.md          # Copy-paste install prompt
└── LICENSE                    # CC BY 4.0
```

---

## Requirements

- Node.js 18+
- Zero npm dependencies

---

## Version

1.0.0

---

## License

CC BY 4.0 - free to use and adapt with attribution. See [LICENSE](./LICENSE).
