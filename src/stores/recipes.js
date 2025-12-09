// Pinia store that manages dishes and their associated recipes (snapshots).
// Provides actions for loading a dish, creating/updating dishes and recipes,
// and uploading images, while tracking loading and error state for the UI.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dishesAPI, recipeAPI } from '../api/api'
import { useAuthStore } from './auth'

export const useRecipesStore = defineStore('recipes', () => {
  const currentDish = ref(null)
  const recipes = ref([])
  const loading = ref(false)
  const error = ref(null)

  const authStore = useAuthStore()

  /**
   * Load a single dish by id and populate both `currentDish` and `recipes`.
   * If the dish has recipes, this will also call `fetchRecipes` so the store
   * always exposes the latest set of snapshots for that dish.
   *
   * @param {string} dishId - The Mongo-style id of the dish to load.
   * @returns {Promise<object|null>} The loaded dish object, or null on failure.
   */
  async function fetchDish(dishId) {
    loading.value = true
    error.value = null
    try {
      const response = await dishesAPI.getDish(dishId)
      const dishes = response.data.dishes || response.data
      currentDish.value = Array.isArray(dishes) ? dishes[0] : dishes
      
      // Fetch recipes for this dish
      // Always clear recipes first, then load if dish has recipes
      const hasRecipesInDish = currentDish.value?.recipes?.length > 0
      
      if (hasRecipesInDish) {
        await fetchRecipes(dishId)
      } else {
        // Clear recipes if dish has no recipes
        recipes.value = []
      }
      
      return currentDish.value
    } catch (err) {
      error.value = err.message || 'Failed to fetch dish'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch all recipes (snapshots) for a given dish and sort them
   * chronologically by date, oldest to newest.
   *
   * @param {string} dishId - The id of the dish whose recipes should be loaded.
   * @returns {Promise<Array>} The sorted array of recipe objects.
   */
  async function fetchRecipes(dishId) {
    loading.value = true
    error.value = null
    try {
      const response = await recipeAPI.getRecipes(dishId)
      const recipesData = response.data.recipes || response.data
      recipes.value = (Array.isArray(recipesData) ? recipesData : []).sort((a, b) => {
        // Sort by date chronologically
        return new Date(a.date) - new Date(b.date)
      })
      return recipes.value
    } catch (err) {
      error.value = err.message || 'Failed to fetch recipes'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new dish for the currently authenticated user.
   *
   * @param {string} name - The display name of the dish.
   * @param {string} description - Optional description or notes about the dish.
   * @returns {Promise<object|null>} The created dish object from the backend.
   */
  async function createDish(name, description) {
    if (!authStore.token) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await dishesAPI.createDish(null, name, description)
      return response.data.dish
    } catch (err) {
      error.value = err.message || 'Failed to create dish'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update the basic metadata for an existing dish (name and description),
   * then refresh `currentDish` so the store reflects the latest data.
   *
   * @param {string} dishId - The id of the dish to update.
   * @param {string} newName - The new name to apply.
   * @param {string} description - The updated description text.
   */
  async function updateDish(dishId, newName, description) {
    loading.value = true
    error.value = null
    try {
      await dishesAPI.editDishName(dishId, newName, description)
      await fetchDish(dishId)
    } catch (err) {
      error.value = err.message || 'Failed to update dish'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new recipe (snapshot) for a dish, optionally with ingredients,
   * instructions, ranking, and an explicit date. If a date is not provided,
   * it defaults to the current day. After creation, the recipes list is
   * refreshed so the UI shows the new snapshot.
   *
   * @param {object} recipeData - A structured payload with fields like
   *   ingredientsList, subname, pictures, date, instructions, note, ranking, dish.
   * @returns {Promise<string|null>} The id of the created recipe, if successful.
   */
  async function createRecipe(recipeData) {
    if (!authStore.token) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await recipeAPI.createRecipe(
        null,
        recipeData.ingredientsList || '',
        recipeData.subname || '',
        recipeData.pictures || [],
        recipeData.date || (() => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        })(),
        recipeData.instructions || '',
        recipeData.note || '',
        recipeData.ranking || 1,
        recipeData.dish
      )
      const recipe = response.data.recipe
      const recipeId = recipe?._id || recipe
      
      // Add recipe to dish if not already added
      if (recipeData.dish) {
        await dishesAPI.addRecipe(recipeId, recipeData.dish)
      }
      
      await fetchRecipes(recipeData.dish)
      return recipeId
    } catch (err) {
      error.value = err.message || 'Failed to create recipe'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing recipe (snapshot) with new field values. If a dish id
   * is provided in `recipeData`, the function will re-fetch that dish's
   * recipes afterwards to keep the list in sync.
   *
   * @param {string} recipeId - The id of the recipe to update.
   * @param {object} recipeData - The new recipe field values.
   */
  async function updateRecipe(recipeId, recipeData) {
    loading.value = true
    error.value = null
    try {
      await recipeAPI.editRecipe(
        recipeId,
        recipeData.ingredientsList || '',
        recipeData.subname || '',
        recipeData.pictures || [],
        recipeData.date || (() => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        })(),
        recipeData.instructions || '',
        recipeData.note || '',
        recipeData.ranking || 1
      )
      if (recipeData.dish) {
        await fetchRecipes(recipeData.dish)
      }
    } catch (err) {
      error.value = err.message || 'Failed to update recipe'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Mark a particular recipe as the default for a dish. This updates the
   * backend and then adjusts `currentDish.defaultRecipe` locally without
   * performing a full reload of the dish or clearing the recipes list.
   *
   * @param {string} recipeId - The id of the recipe to make default.
   * @param {string} dishId - The id of the dish that owns the recipe.
   */
  async function setDefaultRecipe(recipeId, dishId) {
    loading.value = true
    error.value = null
    try {
      const response = await dishesAPI.setDefaultRecipe(recipeId, dishId)
      const updatedDish = response.data.dish?._id ? response.data.dish : response.data.dish
      // Update the defaultRecipe field locally without full reload
      // Only update if currentDish exists and matches - be careful not to trigger reloads
      if (currentDish.value && currentDish.value._id === dishId) {
        // Use Object.assign to update the field without replacing the object
        if (updatedDish && updatedDish.defaultRecipe) {
          Object.assign(currentDish.value, { defaultRecipe: updatedDish.defaultRecipe })
        } else {
          Object.assign(currentDish.value, { defaultRecipe: recipeId })
        }
      }
      // Don't call fetchDish - just update the field to avoid clearing recipes/view
    } catch (err) {
      error.value = err.message || 'Failed to set default recipe'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Upload an image file for a specific recipe. The backend associates the
   * uploaded file with the recipe and returns metadata about the upload.
   *
   * @param {string} recipeId - The id of the recipe to attach an image to.
   * @param {File|Blob} file - The image file selected by the user.
   * @returns {Promise<object|null>} Response data from the upload endpoint.
   */
  async function uploadRecipeImage(recipeId, file) {
    if (!authStore.token) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await recipeAPI.uploadImage(recipeId, file, null)
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to upload image'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    currentDish,
    recipes,
    loading,
    error,
    fetchDish,
    fetchRecipes,
    createDish,
    updateDish,
    createRecipe,
    updateRecipe,
    setDefaultRecipe,
    uploadRecipeImage
  }
})
