# Panko Frontend

A cozy recipe journaling application built with Vue 3, Vite, Pinia, and Axios.

## Features

- **Authentication**: Login and sign up with session management
- **Recipe Books**: Organize recipes into custom books with covers
- **Recipe Management**: Create and manage recipes with multiple snapshots (variations)
- **Calendar Planning**: Schedule recipes on specific dates with drag-and-drop
- **Cozy UI**: Minimalistic design with warm color palette

## Setup

1. Install dependencies:

```bash
npm install
```

2. Make sure the backend server is running on `http://localhost:8000`

3. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build

To build for production:

```bash
npm run build
```

## Deployment

**Important:** For production deployments, you must set the `VITE_API_BASE_URL` environment variable to point to your backend server.

### Setting the Environment Variable

Vite environment variables must be set **at build time** (not runtime). They are embedded into the built files.

**Option 1: Set during build**

```bash
VITE_API_BASE_URL=https://your-backend.onrender.com/api npm run build
```

**Option 2: Create a `.env.production` file**

```bash
# .env.production
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

**Option 3: Set in your deployment platform**

- **Vercel/Netlify/etc.**: Add `VITE_API_BASE_URL` as an environment variable in your deployment settings
- Make sure to rebuild after setting the variable

### Configuration Options

- **Backend on different domain**: Set `VITE_API_BASE_URL` to the full backend URL (e.g., `https://backend.example.com/api`)
- **Backend on same domain with reverse proxy**: Leave `VITE_API_BASE_URL` unset or set to `/api`
- **Local development**: Leave unset (Vite proxy automatically handles `/api` → `localhost:8000`)

### Troubleshooting

If you see "Network error. Please check your connection":

1. Check the browser console for the logged API Base URL
2. Verify `VITE_API_BASE_URL` is set correctly in your deployment environment
3. Ensure the backend server is accessible from the frontend domain (check CORS settings)
4. Rebuild the frontend after setting the environment variable

## Color Palette

- Dark Brown: `#6F4E37`
- Medium Brown: `#A67B5B`
- Cream: `#FED8B1`
- Light Brown: `#D99A6C`
- Gold: `#ECB176`

## Project Structure

```
src/
  ├── api/          # API service layer
  ├── components/   # Reusable components
  ├── router/       # Vue Router configuration
  ├── stores/       # Pinia stores
  ├── views/        # Page components
  └── style.css     # Global styles
```
