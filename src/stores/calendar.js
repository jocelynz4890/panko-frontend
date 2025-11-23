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
    if (!authStore.user) return
    
    loading.value = true
    error.value = null
    try {
      const response = await calendarAPI.getScheduledRecipes(authStore.user)
      // API returns array of objects with scheduledRecipe property
      scheduledRecipes.value = response.data.map(item => ({
        _id: item.scheduledRecipe.scheduledRecipe,
        snapshot: item.scheduledRecipe.snapshot,
        date: item.scheduledRecipe.date
      }))
    } catch (err) {
      error.value = err.message || 'Failed to fetch scheduled recipes'
    } finally {
      loading.value = false
    }
  }

  async function scheduleRecipe(snapshotId, date) {
    if (!authStore.user) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await calendarAPI.assignSnapshotToDate(authStore.user, snapshotId, date)
      await fetchScheduledRecipes()
      return response.data.scheduledRecipe
    } catch (err) {
      error.value = err.message || 'Failed to schedule recipe'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteScheduledRecipe(scheduledRecipeId) {
    loading.value = true
    error.value = null
    try {
      await calendarAPI.deleteScheduledRecipe(scheduledRecipeId)
      await fetchScheduledRecipes()
    } catch (err) {
      error.value = err.message || 'Failed to delete scheduled recipe'
      throw err
    } finally {
      loading.value = false
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
      // Process all pending updates
      for (const update of pendingUpdates.value) {
        if (update.type === 'add') {
          await scheduleRecipe(update.snapshot, update.date)
        } else if (update.type === 'delete') {
          await deleteScheduledRecipe(update.scheduledRecipe)
        } else if (update.type === 'move') {
          // Delete old and create new
          await deleteScheduledRecipe(update.oldScheduledRecipe)
          await scheduleRecipe(update.snapshot, update.newDate)
        }
      }
      clearPendingUpdates()
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

