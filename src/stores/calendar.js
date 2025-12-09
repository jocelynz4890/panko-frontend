// Pinia store that coordinates calendar-based meal planning.
// Manages scheduled recipes, batched drag-and-drop updates, and communication
// with the calendar-related backend endpoints.
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

  /**
   * Fetch all scheduled recipes for the current user and normalize the
   * backend response into a flat array of {_id, recipe, date} objects.
   *
   * @returns {Promise<void>}
   */
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

  /**
   * Schedule a recipe on a specific date. When skipFetch is false, the store
   * will automatically refresh the full list of scheduled recipes afterwards.
   *
   * @param {string} recipeId - The id of the recipe to schedule.
   * @param {string} date - The date string (YYYY-MM-DD) to schedule on.
   * @param {boolean} [skipFetch=false] - Whether to skip the follow-up reload.
   * @returns {Promise<object|null>} The created scheduledRecipe payload.
   */
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

  /**
   * Remove a scheduled recipe by its id. When skipFetch is false, the store
   * will re-fetch the calendar data to keep the UI consistent with the server.
   *
   * @param {string} scheduledRecipeId - The id of the scheduled recipe to delete.
   * @param {boolean} [skipFetch=false] - Whether to skip the follow-up reload.
   * @returns {Promise<object>} The backend response data.
   */
  async function deleteScheduledRecipe(scheduledRecipeId, skipFetch = false) {
    if (!skipFetch) {
      loading.value = true
    }
    error.value = null
    try {
      const response = await calendarAPI.deleteScheduledRecipe(scheduledRecipeId)
      console.log('Delete response:', response.status, response.data)
      // Verify we got a successful response (status 200 and no error in response)
      if (response.status !== 200) {
        throw new Error(`Delete failed with status ${response.status}`)
      }
      if (response.data && response.data.error) {
        throw new Error(response.data.error)
      }
      // Success - backend confirmed deletion
      if (!skipFetch) {
        await fetchScheduledRecipes()
      }
      return response.data
    } catch (err) {
      console.error('Delete error:', err)
      error.value = err.message || 'Failed to delete scheduled recipe'
      throw err
    } finally {
      if (!skipFetch) {
        loading.value = false
      }
    }
  }

  /**
   * Queue a local calendar change (add, delete, or move) to be submitted in
   * a single batch, improving performance when the user makes many changes.
   *
   * @param {object} update - A description of the calendar operation to queue.
   */
  function addPendingUpdate(update) {
    pendingUpdates.value.push(update)
  }

  /**
   * Clear all locally queued updates. The array is reset in a way that
   * preserves reactivity so subscribers are properly notified.
   */
  function clearPendingUpdates() {
    pendingUpdates.value.length = 0
    // Force reactivity update
    pendingUpdates.value = []
  }

  /**
   * Submit all queued calendar updates to the backend in conflict-aware,
   * size-limited batches. This method attempts to resolve conflicts such as
   * "move then delete" before sending requests and only clears the queue
   * after confirming that all operations succeeded.
   *
   * @returns {Promise<void>}
   */
  async function submitPendingUpdates() {
    if (pendingUpdates.value.length === 0) return
    
    loading.value = true
    error.value = null
    try {
      // Resolve conflicts before processing
      // 1. If an item is moved multiple times, keep only the final move
      const movesByScheduledId = new Map()
      for (const update of pendingUpdates.value) {
        if (update.type === 'move') {
          const scheduledId = update.oldScheduledRecipe
          // Keep the most recent move (last one in array)
          movesByScheduledId.set(scheduledId, update)
        }
      }
      
      // 2. If an item is both moved and deleted, cancel the move and just delete
      const deletesSet = new Set()
      for (const update of pendingUpdates.value) {
        if (update.type === 'delete') {
          deletesSet.add(update.scheduledRecipe)
          // Remove any moves for this scheduled recipe
          // This ensures that if an item is moved then deleted, the move is canceled
          if (movesByScheduledId.has(update.scheduledRecipe)) {
            console.log('Canceling move for scheduled recipe that is being deleted:', update.scheduledRecipe)
            movesByScheduledId.delete(update.scheduledRecipe)
          }
        }
      }
      
      // 3. If an item is added and then deleted, cancel the add
      const addsToKeep = []
      for (const update of pendingUpdates.value) {
        if (update.type === 'add') {
          // Check if this add is being deleted
          // For adds, we need to check if the scheduledRecipe (if it exists) is being deleted
          // But adds don't have scheduledRecipe yet, so we need to check by recipe+date
          // Actually, deletes reference scheduledRecipe IDs, not recipe+date
          // So we can't easily match adds to deletes. We'll keep all adds for now.
          // The backend will handle duplicates.
          addsToKeep.push(update)
        }
      }
      
      // Separate updates by type (after conflict resolution)
      const adds = addsToKeep
      const deletes = pendingUpdates.value.filter(u => u.type === 'delete')
      const moves = Array.from(movesByScheduledId.values())
      
      // Process in batches to avoid overwhelming the backend
      const BATCH_SIZE = 5
      const results = []
      
      // Process deletes in batches - wait for backend responses
      for (let i = 0; i < deletes.length; i += BATCH_SIZE) {
        const batch = deletes.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(update => 
            deleteScheduledRecipe(update.scheduledRecipe, true).then(() => ({ success: true, update })).catch(err => {
              console.error('Failed to delete scheduled recipe:', err)
              return { success: false, update, error: err }
            })
          )
        )
        results.push(...batchResults)
      }
      
      // Process adds in batches - wait for backend responses
      for (let i = 0; i < adds.length; i += BATCH_SIZE) {
        const batch = adds.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(update => 
            scheduleRecipe(update.recipe, update.date, true).then(() => ({ success: true, update })).catch(err => {
              console.error('Failed to schedule recipe:', err)
              return { success: false, update, error: err }
            })
          )
        )
        results.push(...batchResults)
      }
      
      // Process moves in batches (each move is delete + add) - wait for backend responses
      for (let i = 0; i < moves.length; i += BATCH_SIZE) {
        const batch = moves.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(update => 
            Promise.all([
              deleteScheduledRecipe(update.oldScheduledRecipe, true),
              scheduleRecipe(update.recipe, update.newDate, true)
            ]).then(() => ({ success: true, update })).catch(err => {
              console.error('Failed to move scheduled recipe:', err)
              return { success: false, update, error: err }
            })
          )
        )
        results.push(...batchResults)
      }
      
      // Check if all operations succeeded
      const failed = results.filter(r => !r.success)
      if (failed.length > 0) {
        const errorMessages = failed.map(f => f.error?.message || 'Unknown error').join(', ')
        throw new Error(`Some operations failed: ${errorMessages}`)
      }
      
      // Only clear pending updates after confirming all backend responses succeeded
      // This ensures the backend has actually completed all operations
      pendingUpdates.value.length = 0
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

