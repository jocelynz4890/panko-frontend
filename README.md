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
