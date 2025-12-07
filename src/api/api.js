import axios from 'axios'

// In production, if VITE_API_BASE_URL is not set, default to '/api'
// In development, the Vite proxy will handle '/api' -> localhost:8000
// In production, '/api' should be handled by a reverse proxy or set VITE_API_BASE_URL to the full backend URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// Always log API base URL for debugging (helps diagnose production issues)
console.log('[API Config] Base URL:', API_BASE, '| Mode:', import.meta.env.MODE, '| Dev:', import.meta.env.DEV)

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds timeout (backend default is 10s, but allow more time)
  withCredentials: false // Set to true if backend requires credentials
})

// Helper function to get token from localStorage
function getToken() {
  return localStorage.getItem('token')
}

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
    console.error('API Error:', {
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config?.baseURL + error.config?.url,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    })
    
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
      // Network error - provide more helpful message
      const errorMsg = error.code === 'ECONNREFUSED' 
        ? 'Cannot connect to server. Please check if the backend is running and VITE_API_BASE_URL is configured correctly.'
        : error.code === 'ERR_NETWORK'
        ? 'Network error. Please check your connection and ensure the backend server is accessible.'
        : 'Network error. Please check your connection.'
      return Promise.reject(new Error(errorMsg))
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
  createRecipeBook: (user, name, coverIndex) => 
    api.post('/RecipeBook/createRecipeBook', { token: getToken(), name, coverIndex }),
  
  editRecipeBookName: (book, newName) => 
    api.post('/RecipeBook/editRecipeBookName', { token: getToken(), book, newName }),
  
  deleteRecipeBook: (book) => 
    api.post('/RecipeBook/deleteRecipeBook', { token: getToken(), book }),
  
  getBooks: (user) => 
    api.post('/RecipeBook/_getBooks', { token: getToken() }),
  
  getBook: (book) => 
    api.post('/RecipeBook/_getBook', { book }),
  
  addDishToBook: (dish, book) => 
    api.post('/RecipeBook/addDishToBook', { token: getToken(), dish, book }),
  
  removeDishFromBook: (dish, book) => 
    api.post('/RecipeBook/removeDishFromBook', { token: getToken(), dish, book })
}

// Dishes API (formerly Recipes concept)
export const dishesAPI = {
  createDish: (user, name, description) => 
    api.post('/Dishes/createDish', { token: getToken(), name, description }),
  
  editDishName: (dish, newName, description) => 
    api.post('/Dishes/editDishName', { token: getToken(), dish, newName, description }),
  
  deleteDish: (dish) => 
    api.post('/Dishes/deleteDish', { token: getToken(), dish }),
  
  getDish: (dish) => 
    api.post('/Dishes/_getDish', { dish }),
  
  addRecipe: (recipe, dish) => 
    api.post('/Dishes/addRecipe', { token: getToken(), recipe, dish }),
  
  removeRecipe: (recipe, dish) => 
    api.post('/Dishes/removeRecipe', { token: getToken(), recipe, dish }),
  
  setDefaultRecipe: (recipe, dish) => 
    api.post('/Dishes/setDefaultRecipe', { token: getToken(), recipe, dish })
}

// Recipe API (formerly Snapshot concept)
export const recipeAPI = {
  createRecipe: (user, ingredientsList, subname, pictures, date, instructions, note, ranking, dish) => 
    api.post('/Recipe/createRecipe', { 
      token: getToken(), ingredientsList, subname, pictures, date, instructions, note, ranking, dish 
    }),
  
  editRecipe: (recipe, ingredientsList, subname, pictures, date, instructions, note, ranking) => 
    api.post('/Recipe/editRecipe', { 
      token: getToken(), recipe, ingredientsList, subname, pictures, date, instructions, note, ranking 
    }),
  
  deleteRecipe: (recipe) => 
    api.post('/Recipe/deleteRecipe', { token: getToken(), recipe }),
  
  deleteAllRecipesForDish: (dish) => 
    api.post('/Recipe/deleteAllRecipesForDish', { token: getToken(), dish }),
  
  getRecipes: (dish) => 
    api.post('/Recipe/_getRecipes', { dish }),
  
  uploadImage: (recipeId, file, user) => {
    const formData = new FormData()
    formData.append('recipe', recipeId)
    formData.append('file', file)
    const token = getToken()
    if (token) formData.append('token', token)
    if (user) formData.append('user', user)
    return api.post('/uploads/recipe-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}

// Calendar API
export const calendarAPI = {
  assignRecipeToDate: (user, recipe, date) => 
    api.post('/Calendar/assignRecipeToDate', { token: getToken(), recipe, date }),
  
  deleteScheduledRecipe: (scheduledRecipe) => 
    api.post('/Calendar/deleteScheduledRecipe', { token: getToken(), scheduledRecipe }),
  
  deleteAllScheduledRecipesWithRecipe: (recipe) => 
    api.post('/Calendar/deleteAllScheduledRecipesWithRecipe', { token: getToken(), recipe }),
  
  getScheduledRecipes: (user) => 
    api.post('/Calendar/_getScheduledRecipes', { token: getToken() })
}

export default api

