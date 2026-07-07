# DocChat — Chat with your PDFs

A full-stack RAG (Retrieval-Augmented Generation) application that lets you upload PDF documents and have intelligent conversations about their content.

## Features

- **PDF Upload & Parsing** — Upload any PDF, automatically extracted and chunked
- **Vector Search** — FAISS-powered semantic search over document chunks
- **AI-Powered Answers** — Google Gemini Flash generates answers grounded in your documents
- **Source Citations** — Every answer shows which document chunks were used
- **Multi-Document** — Upload multiple PDFs, query across all of them
- **Persistent Storage** — Vector store persists to disk across restarts
- **Modern UI** — Dark-themed, responsive chat interface

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite |
| Backend | Express.js, Node.js |
| LLM | Google Gemini 2.0 Flash (free tier) |
| Embeddings | Google text-embedding-004 (free tier) |
| Vector Store | FAISS (with in-memory fallback) |
| Orchestration | LangChain.js |
| PDF Parsing | pdf-parse |
| Hosting | Render.com (free tier) |

## Architecture

```
User uploads PDF
    → pdf-parse extracts text
    → RecursiveCharacterTextSplitter chunks text
    → GoogleGenerativeAIEmbeddings generates vectors
    → FAISS stores vectors + metadata

User asks question
    → Question embedded with same model
    → FAISS similarity search → top 4 chunks
    → Chunks + question → Gemini Flash
    → Grounded answer + source citations
```

## Quick Start

### Prerequisites

- Node.js 18+
- A free Google AI Studio API key from [aistudio.google.com](https://aistudio.google.com)

### Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd rag-app

# Create .env file
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY

# Install & run server
cd server
npm install
npm run dev

# In another terminal — install & run client
cd client
npm install
npm run dev
```

Open http://localhost:5173 — upload a PDF and start chatting!

## Deploy to Render (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates both services
5. Add your `GOOGLE_API_KEY` in the Render dashboard environment variables
6. Deploy!

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Free API key from Google AI Studio |
| `PORT` | No | Server port (default: 3001) |

## Project Structure

```
rag-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx       # Document list + upload
│   │   │   ├── ChatPanel.jsx     # Chat interface
│   │   │   └── MessageBubble.jsx # Message rendering
│   │   ├── App.jsx               # Main app layout
│   │   ├── main.jsx              # Entry point
│   │   └── index.css             # Styles
│   └── vite.config.js
├── server/                 # Express backend
│   ├── routes/
│   │   ├── upload.js       # PDF upload + processing
│   │   └── query.js        # RAG query endpoint
│   ├── services/
│   │   ├── vectorStore.js  # FAISS vector store manager
│   │   └── ragChain.js     # LangChain RAG pipeline
│   └── index.js            # Server entry
├── render.yaml             # Render deployment config
└── .env.example
```

## License

MIT
