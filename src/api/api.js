import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 seconds timeout (backend default is 10s, but allow more time)
})

// Request interceptor to add auth token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  const user = localStorage.getItem('user')
  if (token && user) {
    // Token is stored, but API doesn't use it in headers based on spec
    // We'll pass it in request body where needed
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Log response for debugging
    console.log('API Response:', response.config.url, response.data)
    return response
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.data || error.message)
    if (error.response?.data?.error) {
      return Promise.reject(new Error(error.response.data.error))
    }
    if (error.response?.status === 500) {
      return Promise.reject(new Error('Server error. Please try again later.'))
    }
    if (error.response?.status === 404) {
      return Promise.reject(new Error('API endpoint not found'))
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection.'))
    }
    return Promise.reject(error)
  }
)

// Authentication API
export const authAPI = {
  register: (username, password) => 
    api.post('/Authentication/register', { username, password }),
  
  authenticate: (username, password) => 
    api.post('/Authentication/authenticate', { username, password }),
  
  createSession: (user) => 
    api.post('/Authentication/createSession', { user }),
  
  validateSession: (token) => 
    api.post('/Authentication/validateSession', { token })
}

// RecipeBook API
export const recipeBookAPI = {
  createRecipeBook: (user, name) => 
    api.post('/RecipeBook/createRecipeBook', { user, name }),
  
  editRecipeBookName: (book, newName) => 
    api.post('/RecipeBook/editRecipeBookName', { book, newName }),
  
  deleteRecipeBook: (book) => 
    api.post('/RecipeBook/deleteRecipeBook', { book }),
  
  getBooks: (user) => 
    api.post('/RecipeBook/_getBooks', { user }),
  
  getBook: (book) => 
    api.post('/RecipeBook/_getBook', { book }),
  
  addRecipeToBook: (recipe, book) => 
    api.post('/RecipeBook/addRecipeToBook', { recipe, book }),
  
  removeRecipeFromBook: (recipe, book) => 
    api.post('/RecipeBook/removeRecipeFromBook', { recipe, book })
}

// Recipe API
export const recipeAPI = {
  createRecipe: (user, name, description) => 
    api.post('/Recipes/createRecipe', { user, name, description }),
  
  editRecipeName: (recipe, newName, description) => 
    api.post('/Recipes/editRecipeName', { recipe, newName, description }),
  
  deleteRecipe: (recipe) => 
    api.post('/Recipes/deleteRecipe', { recipe }),
  
  getRecipe: (recipe) => 
    api.post('/Recipes/_getRecipe', { recipe }),
  
  addSnapshot: (snapshot, recipe) => 
    api.post('/Recipes/addSnapshot', { snapshot, recipe }),
  
  removeSnapshot: (snapshot, recipe) => 
    api.post('/Recipes/removeSnapshot', { snapshot, recipe }),
  
  setDefaultSnapshot: (snapshot, recipe) => 
    api.post('/Recipes/setDefaultSnapshot', { snapshot, recipe })
}

// Snapshot API
export const snapshotAPI = {
  createSnapshot: (user, ingredientsList, subname, pictures, date, instructions, note, ranking, recipe) => 
    api.post('/Snapshot/createSnapshot', { 
      user, ingredientsList, subname, pictures, date, instructions, note, ranking, recipe 
    }),
  
  editSnapshot: (snapshot, ingredientsList, subname, pictures, date, instructions, note, ranking) => 
    api.post('/Snapshot/editSnapshot', { 
      snapshot, ingredientsList, subname, pictures, date, instructions, note, ranking 
    }),
  
  deleteSnapshot: (snapshot) => 
    api.post('/Snapshot/deleteSnapshot', { snapshot }),
  
  deleteAllSnapshotsForRecipe: (recipe) => 
    api.post('/Snapshot/deleteAllSnapshotsForRecipe', { recipe }),
  
  getSnapshots: (recipe) => 
    api.post('/Snapshot/_getSnapshots', { recipe })
}

// Calendar API
export const calendarAPI = {
  assignSnapshotToDate: (user, snapshot, date) => 
    api.post('/Calendar/assignSnapshotToDate', { user, snapshot, date }),
  
  deleteScheduledRecipe: (scheduledRecipe) => 
    api.post('/Calendar/deleteScheduledRecipe', { scheduledRecipe }),
  
  deleteAllScheduledRecipesWithSnapshot: (snapshot) => 
    api.post('/Calendar/deleteAllScheduledRecipesWithSnapshot', { snapshot }),
  
  getScheduledRecipes: (user) => 
    api.post('/Calendar/_getScheduledRecipes', { user })
}

export default api

