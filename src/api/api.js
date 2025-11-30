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
  createRecipeBook: (user, name, coverIndex) => 
    api.post('/RecipeBook/createRecipeBook', { user, name, coverIndex }),
  
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

// Dishes API (formerly Recipes concept)
export const dishesAPI = {
  createDish: (user, name, description) => 
    api.post('/Dishes/createDish', { user, name, description }),
  
  editDishName: (dish, newName, description) => 
    api.post('/Dishes/editDishName', { dish, newName, description }),
  
  deleteDish: (dish) => 
    api.post('/Dishes/deleteDish', { dish }),
  
  getDish: (dish) => 
    api.post('/Dishes/_getDish', { dish }),
  
  addRecipe: (recipe, dish) => 
    api.post('/Dishes/addRecipe', { recipe, dish }),
  
  removeRecipe: (recipe, dish) => 
    api.post('/Dishes/removeRecipe', { recipe, dish }),
  
  setDefaultRecipe: (recipe, dish) => 
    api.post('/Dishes/setDefaultRecipe', { recipe, dish })
}

// Recipe API (formerly Snapshot concept)
export const recipeAPI = {
  createRecipe: (user, ingredientsList, subname, pictures, date, instructions, note, ranking, dish) => 
    api.post('/Recipe/createRecipe', { 
      user, ingredientsList, subname, pictures, date, instructions, note, ranking, dish 
    }),
  
  editRecipe: (recipe, ingredientsList, subname, pictures, date, instructions, note, ranking) => 
    api.post('/Recipe/editRecipe', { 
      recipe, ingredientsList, subname, pictures, date, instructions, note, ranking 
    }),
  
  deleteRecipe: (recipe) => 
    api.post('/Recipe/deleteRecipe', { recipe }),
  
  deleteAllRecipesForDish: (dish) => 
    api.post('/Recipe/deleteAllRecipesForDish', { dish }),
  
  getRecipes: (dish) => 
    api.post('/Recipe/_getRecipes', { dish }),
  
  uploadImage: (recipeId, file, user) => {
    const formData = new FormData()
    formData.append('recipe', recipeId)
    formData.append('file', file)
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
    api.post('/Calendar/assignRecipeToDate', { user, recipe, date }),
  
  deleteScheduledRecipe: (scheduledRecipe) => 
    api.post('/Calendar/deleteScheduledRecipe', { scheduledRecipe }),
  
  deleteAllScheduledRecipesWithRecipe: (recipe) => 
    api.post('/Calendar/deleteAllScheduledRecipesWithRecipe', { recipe }),
  
  getScheduledRecipes: (user) => 
    api.post('/Calendar/_getScheduledRecipes', { user })
}

export default api

