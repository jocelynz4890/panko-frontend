import { defineStore } from 'pinia'
import { ref } from 'vue'
import { recipeAPI, snapshotAPI } from '../api/api'
import { useAuthStore } from './auth'

export const useRecipesStore = defineStore('recipes', () => {
  const currentRecipe = ref(null)
  const snapshots = ref([])
  const loading = ref(false)
  const error = ref(null)

  const authStore = useAuthStore()

  async function fetchRecipe(recipeId) {
    loading.value = true
    error.value = null
    try {
      const response = await recipeAPI.getRecipe(recipeId)
      currentRecipe.value = response.data[0]
      
      // Fetch snapshots for this recipe
      if (currentRecipe.value?.snapshots?.length > 0) {
        await fetchSnapshots(recipeId)
      } else {
        snapshots.value = []
      }
      
      return currentRecipe.value
    } catch (err) {
      error.value = err.message || 'Failed to fetch recipe'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchSnapshots(recipeId) {
    loading.value = true
    error.value = null
    try {
      const response = await snapshotAPI.getSnapshots(recipeId)
      snapshots.value = response.data.sort((a, b) => {
        // Sort by date chronologically
        return new Date(a.date) - new Date(b.date)
      })
      return snapshots.value
    } catch (err) {
      error.value = err.message || 'Failed to fetch snapshots'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createRecipe(name, description) {
    if (!authStore.user) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await recipeAPI.createRecipe(authStore.user, name, description)
      return response.data.recipe
    } catch (err) {
      error.value = err.message || 'Failed to create recipe'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateRecipe(recipeId, newName, description) {
    loading.value = true
    error.value = null
    try {
      await recipeAPI.editRecipeName(recipeId, newName, description)
      await fetchRecipe(recipeId)
    } catch (err) {
      error.value = err.message || 'Failed to update recipe'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createSnapshot(snapshotData) {
    if (!authStore.user) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await snapshotAPI.createSnapshot(
        authStore.user,
        snapshotData.ingredientsList || '',
        snapshotData.subname || '',
        snapshotData.pictures || [],
        snapshotData.date || new Date().toISOString().split('T')[0],
        snapshotData.instructions || '',
        snapshotData.note || '',
        snapshotData.ranking || 1,
        snapshotData.recipe
      )
      const snapshotId = response.data.snapshot
      
      // Add snapshot to recipe if not already added
      if (snapshotData.recipe) {
        await recipeAPI.addSnapshot(snapshotId, snapshotData.recipe)
      }
      
      await fetchSnapshots(snapshotData.recipe)
      return snapshotId
    } catch (err) {
      error.value = err.message || 'Failed to create snapshot'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateSnapshot(snapshotId, snapshotData) {
    loading.value = true
    error.value = null
    try {
      await snapshotAPI.editSnapshot(
        snapshotId,
        snapshotData.ingredientsList || '',
        snapshotData.subname || '',
        snapshotData.pictures || [],
        snapshotData.date || new Date().toISOString().split('T')[0],
        snapshotData.instructions || '',
        snapshotData.note || '',
        snapshotData.ranking || 1
      )
      if (snapshotData.recipe) {
        await fetchSnapshots(snapshotData.recipe)
      }
    } catch (err) {
      error.value = err.message || 'Failed to update snapshot'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function setDefaultSnapshot(snapshotId, recipeId) {
    loading.value = true
    error.value = null
    try {
      await recipeAPI.setDefaultSnapshot(snapshotId, recipeId)
      await fetchRecipe(recipeId)
    } catch (err) {
      error.value = err.message || 'Failed to set default snapshot'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    currentRecipe,
    snapshots,
    loading,
    error,
    fetchRecipe,
    fetchSnapshots,
    createRecipe,
    updateRecipe,
    createSnapshot,
    updateSnapshot,
    setDefaultSnapshot
  }
})

