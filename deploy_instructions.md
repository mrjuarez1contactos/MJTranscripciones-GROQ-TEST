# Deploy Instructions

## 1. Backend (Render)

1.  **Create Service**: Go to Render.com -> New -> Web Service.
2.  **Repo**: Connect this repository.
3.  **Config**:
    -   **Root Directory**: `backend` (Important! don't leave empty)
    -   **Build Command**: `pip install -r requirements.txt`
    -   **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
    -   **Python Version**: 3.9+
4.  **Environment Variables** (Add these in Render Dashboard):
    -   `GROQ_API_KEY`: `gsk_...`
    -   `GEMINI_API_KEY`: `AIza...`
    -   `SESSION_SECRET_KEY`: `(Generate a random string)`
    -   `ALLOWED_ORIGIN`: `https://your-vercel-app.vercel.app` (Add this AFTER deploying frontend)

## 2. Frontend (Vercel)

1.  **Project**: Go to Vercel -> New Project -> Import from Git.
2.  **Env Variables**:
    -   `VITE_GOOGLE_CLIENT_ID`: `(Your Google OAuth Client ID)`
    -   `VITE_BACKEND_URL`: `https://your-render-service-name.onrender.com` (The URL provided by Render)
    -   **DELETE**: `VITE_GROQ_API_KEY` and `VITE_GEMINI_API_KEY` if they exist.
3.  **Deploy**: Click Deploy.

## 3. Post-Deploy Checks

-   **Verify Security**:
    -   Open Developer Tools -> Network in your deployed frontend.
    -   Reload.
    -   Verify request to `/api/session` returns a token.
    -   Verify no `VITE_GROQ_API_KEY` is visible in `main.js` or network calls.
-   **cors**: If you get CORS errors, check `ALLOWED_ORIGIN` in Render matches your Vercel URL exactly (no trailing slash).
