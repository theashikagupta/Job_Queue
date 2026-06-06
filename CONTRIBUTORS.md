# Contributors

Thank you for contributing to Job Queue. This file recognizes project contributors and explains how future contributors can work on the repository cleanly.

## Project owner

| Name | GitHub | Role |
| --- | --- | --- |
| Ashika Gupta | [@theashikagupta](https://github.com/theashikagupta) | Project creator and maintainer |

## Contributors

Add your name here after your first accepted contribution.

| Name | GitHub | Contribution |
| --- | --- | --- |
| Ashika Gupta | [@theashikagupta](https://github.com/theashikagupta) | Full-stack development, project idea, authentication, dashboard, resume parsing, job queue workflow |

## Contribution guidelines

### 1. Pick a focused issue or improvement

Good first contributions include:

- UI fixes and responsive design improvements
- Better empty states and loading states
- Dashboard filters
- API error handling improvements
- README or documentation improvements
- Test cases for match score logic
- Better resume parsing edge cases

Avoid mixing unrelated changes in one pull request.

### 2. Set up the project locally

```bash
git clone https://github.com/theashikagupta/Job_Queue.git
cd Job_Queue
npm install
```

Create a `.env` file using the environment variables listed in `README.md`.

### 3. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

Use clear branch names:

```txt
feature/favorites-filter
fix/login-error-message
chore/update-readme
```

### 4. Check your code before committing

```bash
npm run check
npm run build
```

A pull request should not knowingly break the app.

### 5. Commit with clear messages

Use direct commit messages:

```txt
Add favorites filter to dashboard
Fix JWT session expiry handling
Improve resume upload validation
```

### 6. Open a pull request

Your PR description should include:

- What changed
- Why it changed
- Screenshots or screen recording for UI changes
- Any environment variables or setup changes
- Known limitations, if any

## Code style expectations

- Keep functions small and readable.
- Do not hardcode secrets or API keys.
- Keep user-specific data protected behind authentication.
- Prefer clear names over clever shortcuts.
- Handle loading, empty, and error states in the UI.
- Keep backend responses consistent and easy to debug.

## Areas where help is useful

| Area | Useful improvements |
| --- | --- |
| Frontend | Responsive layout, accessibility, better dashboard UX |
| Backend | Validation, tests, cleaner error handling |
| AI/job matching | Better scoring, semantic matching, explainable score reasons |
| Resume parsing | More robust parsing for different resume formats |
| Documentation | Setup guides, screenshots, API examples |
| Deployment | Frontend/backend hosting guide |

## Recognition

Contributors who make meaningful changes should be added to the Contributors table with a short description of their work.
