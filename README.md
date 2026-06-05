# Job Queue

Agentic Job Queue is an AI-assisted job-search platform that helps users upload a resume, save job preferences, discover matching jobs, queue suitable opportunities, mark application progress, and save favorite jobs.

The project is built as a full-stack JavaScript application with a React/Vite frontend, an Express backend, MongoDB persistence, JWT authentication, PDF resume parsing, job discovery through JSearch with Remotive fallback, and AI-assisted scoring/generation utilities.

## Why this project exists

Most job seekers waste time opening multiple portals, manually filtering jobs, and tracking applications in spreadsheets. Job Queue solves this by creating a focused queue of jobs that match the user's resume and preferences, so the user can review and apply with less noise.

## Core features

- User registration and login with JWT authentication
- PDF resume upload and parsing
- Resume-based extraction of skills, projects, experience, and education
- Job preference form for role, location, job type, and minimum match score
- Job discovery using JSearch API, with Remotive fallback when needed
- AI-style match scoring based on skills, projects, and experience
- Queue of matched jobs only
- Favorites section for saving important jobs
- Application status tracking with statuses like queued, applied, interview, rejected, and offer
- Dark mode toggle
- Optional cover letter generation endpoint using Google Gemini, with a safe fallback letter when Gemini is unavailable

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, CSS, Framer Motion, Lucide React |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcryptjs |
| Resume parsing | multer, pdf-parse |
| Job search | JSearch API, Remotive API fallback |
| AI integration | Google Gemini API |

## Project structure

```txt
Job_Queue/
├── backend/
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── authRoutes.js
│   ├── calculateMatchScore.js
│   ├── generateCoverLetter.js
│   ├── jobApplications.js
│   ├── parseResume.js
│   ├── processJob.js
│   ├── searchJobs.js
│   ├── server.js
│   ├── uploadResumeRoute.js
│   └── userPreferences.js
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── auth.js
│   │   └── components/
│   └── index.html
├── package.json
├── README.md
├── CONTRIBUTORS.md
└── LICENSE
```

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/theashikagupta/Job_Queue.git
cd Job_Queue
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment variables

Create a `.env` file in the project root or inside the `backend/` folder:

```env
PORT=9000
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=resume_parser
JWT_SECRET=your_strong_jwt_secret

# Optional but recommended for job search
JSEARCH_API_KEY=your_rapidapi_jsearch_key
JSEARCH_API_HOST=jsearch.p.rapidapi.com

# Optional for cover letter generation
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
```

Important: never commit real API keys, database credentials, or JWT secrets.

### 4. Run the backend

```bash
npm run dev
```

By default, the server runs on:

```txt
http://localhost:9000
```

### 5. Run the frontend

In another terminal:

```bash
npm run frontend
```

Open the Vite local URL shown in the terminal.

## Main API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Check server and database status |
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT token |
| POST | `/uploadResume` | Upload and parse PDF resume |
| GET | `/api/preferences` | Fetch saved job preferences |
| POST | `/api/preferences` | Save job preferences |
| POST | `/api/jobs/search` | Search jobs, score them, and save results |
| GET | `/api/applications` | List user applications |
| PATCH | `/api/applications/:jobId/status` | Update application status |
| PATCH | `/api/applications/:jobId/favorite` | Toggle favorite job |
| POST | `/api/cover-letter` | Generate a cover letter draft |

Protected routes require this header:

```txt
Authorization: Bearer <token>
```

## How the agentic workflow works

1. The user uploads a resume.
2. The backend parses the PDF and stores structured resume data.
3. The user saves job preferences.
4. The backend searches jobs from external job APIs.
5. Each job is normalized into a common format.
6. The system calculates a match score using resume skills, projects, and experience.
7. Jobs above the selected threshold are queued.
8. The user reviews the queue, favorites jobs, opens apply links, and updates status.

This makes the project agentic because the system does more than display static data. It uses user goals, resume context, external job sources, scoring logic, and saved preferences to actively discover and organize suitable opportunities.

## Match score logic

The current scoring system uses weighted matching:

| Resume signal | Weight |
| --- | ---: |
| Skills | 50% |
| Projects | 30% |
| Experience | 20% |

The score is rule-based and explainable. It can later be upgraded with embeddings or an LLM-based evaluator for deeper semantic matching.

## Available scripts

```bash
npm run dev       # Start backend server
npm run start     # Start backend server
npm run backend   # Start backend server
npm run frontend  # Start Vite frontend
npm run build     # Build frontend
npm run preview   # Preview production frontend build
npm run check     # Syntax-check backend/helper files
```

## Roadmap

- Browser extension for extracting jobs from the current webpage
- Smarter resume-job matching with embeddings
- Better dashboard analytics
- Interview reminder workflow
- Resume improvement suggestions
- Safer autofill after explicit user approval
- Deployment setup for frontend and backend

## Security notes

- Passwords are hashed using bcryptjs.
- JWT is required for protected user routes.
- Uploaded resumes are temporarily stored and deleted after parsing.
- Secrets must stay in `.env` and must not be pushed to GitHub.

## Author

Built by [Ashika Gupta](https://github.com/theashikagupta).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
