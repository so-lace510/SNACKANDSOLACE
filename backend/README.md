# SNACKANDSOLACE backend

## Setup

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r backend\requirements.txt
```

## Run

From the project root:

```powershell
py -m uvicorn backend.main:app --reload --port 8000
```

## Email delivery

Copy `.env.example` to `.env` and fill in the SMTP values. This project uses Gmail SSL SMTP on port 465 because port 587 may be blocked by some networks. For Gmail, enable 2-step verification and create a Google App Password. Use that 16-character App Password as `SMTP_PASSWORD`; do not use your normal Gmail password.

Add your Supabase project URL and `service_role` key to the same `.env` file:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The `service_role` key belongs only in FastAPI and must never be placed in React or committed to Git.

Set `ADMIN_API_KEY` in `.env` to protect `GET /api/orders`. Send it as the `X-Admin-Key` request header. Do not expose this key in the frontend.

API documentation is available at `http://127.0.0.1:8000/docs`.

Orders are stored locally in `backend/orders.db` and can be reviewed through `GET /api/orders` while developing. This endpoint is currently intended for local development and should be protected with admin authentication before deployment.
