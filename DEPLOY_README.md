# MJTranscripciones - Backend Seguro 🛡️

## 🚀 Despliegue en Render (Backend)

Sigue estos pasos EXACTOS para desplegar en 2 minutos:

1.  **Sube tu código a GitHub**:
    *   Este proyecto debe estar en tu GitHub.

2.  **Crea Servicio en Render**:
    *   Ve a [dashboard.render.com](https://dashboard.render.com) > **New** > **Web Service**.
    *   Conecta tu repositorio.

3.  **Configuración (Settings)**:
    *   **Name**: `mj-transcripciones-backend` (o el que gustes)
    *   **Root Directory**: `backend`  <-- **¡MUY IMPORTANTE!**
    *   **Runtime**: `Python 3`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4.  **Variables de Entorno (Environment)**:
    *   `GROQ_API_KEY`: `gsk_...` (Tu llave de Groq)
    *   `GEMINI_API_KEY`: `AIza...` (Tu llave de Gemini)
    *   `SESSION_SECRET_KEY`: `(Escribe algo aleatorio aquí)`
    *   `ALLOWED_ORIGIN`: `https://tu-app-en-vercel.vercel.app` (Si aún no tienes la URL de Vercel, pon `*` temporalmente, luego cámbialo).

5.  **Clic en "Create Web Service"**.

---

## 🛠️ Prueba de Vida

Una vez que Render diga "Live" (verde), prueba tu URL:

1.  **Docs**: `https://tu-servicio.onrender.com/docs` -> Deberías ver la interfaz de Swagger.
2.  **Health Check**: Intenta obtener un token.
    ```bash
    curl https://tu-servicio.onrender.com/api/session
    ```
    Respuesta esperada: `{"token": "...", "expiresAt": "..."}`

---

## 🌐 Conectar el Frontend (Vercel)

1.  Ve a tu proyecto en Vercel > Settings > Environment Variables.
2.  Edita `VITE_BACKEND_URL`.
3.  Pon la URL de Render: `https://tu-servicio.onrender.com` (SIN barra final `/`).
4.  Redesplegar Frontend.

¡Listo! Tu arquitectura es ahora 100% segura.
