import { defineStore } from 'pinia'
import { ref } from 'vue'
import { calendarAPI } from '../api/api'
import { useAuthStore } from './auth'

export const useCalendarStore = defineStore('calendar', () => {
  const scheduledRecipes = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pendingUpdates = ref([])

  const authStore = useAuthStore()

  async function fetchScheduledRecipes() {
    if (!authStore.token) return
    
    loading.value = true
    error.value = null
    try {
      const response = await calendarAPI.getScheduledRecipes(null)
      // API returns array of objects with scheduledRecipe property
      const data = response.data.scheduledRecipes || response.data
      scheduledRecipes.value = data.map(item => ({
        _id: item.scheduledRecipe.scheduledRecipe,
        recipe: item.scheduledRecipe.recipe,
        date: item.scheduledRecipe.date
      }))
    } catch (err) {
      error.value = err.message || 'Failed to fetch scheduled recipes'
    } finally {
      loading.value = false
    }
  }

  async function scheduleRecipe(recipeId, date, skipFetch = false) {
    if (!authStore.token) return null
    
    if (!skipFetch) {
      loading.value = true
    }
    error.value = null
    try {
      const response = await calendarAPI.assignRecipeToDate(null, recipeId, date)
      if (!skipFetch) {
        await fetchScheduledRecipes()
      }
      return response.data.scheduledRecipe
    } catch (err) {
      error.value = err.message || 'Failed to schedule recipe'
      throw err
    } finally {
      if (!skipFetch) {
        loading.value = false
      }
    }
  }

  async function deleteScheduledRecipe(scheduledRecipeId, skipFetch = false) {
    if (!skipFetch) {
      loading.value = true
    }
    error.value = null
    try {
      await calendarAPI.deleteScheduledRecipe(scheduledRecipeId)
      if (!skipFetch) {
        await fetchScheduledRecipes()
      }
    } catch (err) {
      error.value = err.message || 'Failed to delete scheduled recipe'
      throw err
    } finally {
      if (!skipFetch) {
        loading.value = false
      }
    }
  }

  function addPendingUpdate(update) {
    pendingUpdates.value.push(update)
  }

  function clearPendingUpdates() {
    pendingUpdates.value = []
  }

  async function submitPendingUpdates() {
    if (pendingUpdates.value.length === 0) return
    
    loading.value = true
    error.value = null
    try {
      // Process all pending updates without fetching after each one
      for (const update of pendingUpdates.value) {
        if (update.type === 'add') {
          await scheduleRecipe(update.recipe, update.date, true)
        } else if (update.type === 'delete') {
          await deleteScheduledRecipe(update.scheduledRecipe, true)
        } else if (update.type === 'move') {
          // Delete old and create new
          await deleteScheduledRecipe(update.oldScheduledRecipe, true)
          await scheduleRecipe(update.recipe, update.newDate, true)
        }
      }
      clearPendingUpdates()
      // Only fetch once at the end
      await fetchScheduledRecipes()
    } catch (err) {
      error.value = err.message || 'Failed to submit updates'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    scheduledRecipes,
    loading,
    error,
    pendingUpdates,
    fetchScheduledRecipes,
    scheduleRecipe,
    deleteScheduledRecipe,
    addPendingUpdate,
    clearPendingUpdates,
    submitPendingUpdates
  }
})

