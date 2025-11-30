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
    pendingUpdates.value.length = 0
    // Force reactivity update
    pendingUpdates.value = []
  }

  async function submitPendingUpdates() {
    if (pendingUpdates.value.length === 0) return
    
    loading.value = true
    error.value = null
    try {
      // Separate updates by type
      const adds = []
      const deletes = []
      const moves = []
      
      for (const update of pendingUpdates.value) {
        if (update.type === 'add') {
          adds.push(update)
        } else if (update.type === 'delete') {
          deletes.push(update)
        } else if (update.type === 'move') {
          moves.push(update)
        }
      }
      
      // Process in batches to avoid overwhelming the backend
      const BATCH_SIZE = 5
      
      // Process deletes in batches
      for (let i = 0; i < deletes.length; i += BATCH_SIZE) {
        const batch = deletes.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(update => 
            deleteScheduledRecipe(update.scheduledRecipe, true).catch(err => {
              console.error('Failed to delete scheduled recipe:', err)
              throw err
            })
          )
        )
      }
      
      // Process adds in batches
      for (let i = 0; i < adds.length; i += BATCH_SIZE) {
        const batch = adds.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(update => 
            scheduleRecipe(update.recipe, update.date, true).catch(err => {
              console.error('Failed to schedule recipe:', err)
              throw err
            })
          )
        )
      }
      
      // Process moves in batches (each move is delete + add)
      for (let i = 0; i < moves.length; i += BATCH_SIZE) {
        const batch = moves.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(update => 
            Promise.all([
              deleteScheduledRecipe(update.oldScheduledRecipe, true),
              scheduleRecipe(update.recipe, update.newDate, true)
            ]).catch(err => {
              console.error('Failed to move scheduled recipe:', err)
              throw err
            })
          )
        )
      }
      
      // Clear pending updates immediately after successful operations
      // This updates the UI right away - do this BEFORE fetch to ensure UI updates
      pendingUpdates.value = []
      
      // Try to fetch updated data, but don't fail if it times out
      // The operations already succeeded, so we can refresh the UI later
      try {
        await fetchScheduledRecipes()
      } catch (fetchErr) {
        // Log but don't throw - operations succeeded, fetch is just for refresh
        console.warn('Failed to refresh scheduled recipes after save (operations succeeded):', fetchErr)
        // Don't set error.value here - operations succeeded
      }
    } catch (err) {
      error.value = err.message || 'Failed to submit updates'
      // Don't clear pending updates on error - let user retry
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

