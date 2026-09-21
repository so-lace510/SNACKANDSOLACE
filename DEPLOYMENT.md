# Deployment

The Vercel frontend and FastAPI backend are separate services.

## 1. Deploy the backend on Render

1. Open Render and choose **New + > Web Service**.
2. Connect the `so-lace510/SNACKANDSOLACE` GitHub repository.
3. Use these settings:
   - Runtime: `Python 3`
   - Build command: `pip install -r backend/requirements.txt`
   - Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - Health check path: `/api/health`
4. Add the variables from `backend/.env.example`.
5. Deploy and copy the Render URL, for example `https://snackandsolace-api.onrender.com`.

For the first deployment, set these values using the real URLs and private keys:

```text
FRONTEND_URL=https://snackandsolace.vercel.app
ALLOWED_ORIGINS=https://snackandsolace.vercel.app,http://localhost:5173,http://127.0.0.1:5173
PAYSTACK_CALLBACK_URL=https://snackandsolace.vercel.app/checkout
VITE_API_URL=https://snackandsolace-api.onrender.com/api
```

`VITE_API_URL` belongs in Vercel. The other three belong in Render.

## 2. Configure Vercel

1. Open the Vercel project and select **Settings > Environment Variables**.
2. Add:
   - Name: `VITE_API_URL`
   - Value: `https://snackandsolace-api.onrender.com/api`
   - Environments: Production, Preview, and Development as needed
3. Select **Deployments > Redeploy** and choose the latest commit.

## 3. Finish the URL connection

The production frontend URL is `https://snackandsolace.vercel.app`. Set these Render variables to:

```text
FRONTEND_URL=https://snackandsolace.vercel.app
ALLOWED_ORIGINS=https://snackandsolace.vercel.app,http://localhost:5173,http://127.0.0.1:5173
PAYSTACK_CALLBACK_URL=https://snackandsolace.vercel.app/checkout
```

Save the Render variables and redeploy the backend. Test:

```text
https://snackandsolace-api.onrender.com/api/health
```

It should return a JSON response with `status` equal to `ok`.

## Security

Never put `PAYSTACK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASSWORD`, or `ADMIN_API_KEY` in Vercel or in React source code. Keep them only in the backend host's environment variables. Rotate any credential that has been shared publicly.
