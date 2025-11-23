<template>
  <div class="recipe-container">
    <div v-if="loading && !recipe" class="loading">Loading...</div>
    <div v-if="error && !recipe" class="error">{{ error }}</div>
    
    <!-- Show recipe page even if there was an error (e.g., timeout) -->
    <div v-if="recipe || recipeIdFromRoute" class="recipe-wrapper">
      <!-- Edit Toggle Button - Right side -->
      <button class="edit-toggle" @click="toggleEditMode" :disabled="saving">
        <span class="edit-icon">✏️</span>
        {{ saving ? 'Saving...' : (editMode ? 'Save' : 'Edit') }}
      </button>
      
      <div class="recipe-spread">
        <!-- Left Page -->
        <div class="page left-page">
          <div class="recipe-header">
            <h1 
              v-if="!editMode"
              class="recipe-name"
            >
              {{ recipe?.name || editableRecipeName || 'New Recipe' }}
            </h1>
            <input
              v-else
              v-model="editableRecipeName"
              class="recipe-name-input"
              @blur="updateRecipeName"
            />
            <h2 
              v-if="!editMode"
              class="snapshot-name"
            >
              {{ currentSnapshot?.subname || (isNewSnapshot ? editableSnapshot.subname || 'New Snapshot' : 'No snapshots yet') }}
            </h2>
            <input
              v-else
              v-model="editableSnapshot.subname"
              class="snapshot-name-input"
              placeholder="Snapshot name"
            />
          </div>
          
          <div class="recipe-image-container" :class="{ editable: editMode }">
            <div v-if="editMode" class="edit-indicator">✏️</div>
            <img
              v-if="currentSnapshot && currentSnapshot.pictures && currentSnapshot.pictures.length > 0"
              :src="currentSnapshot.pictures[0]"
              :alt="recipe.name"
              class="recipe-image"
            />
            <div v-else class="no-image">No image</div>
          </div>
          
          <div class="recipe-meta">
            <div class="meta-item" :class="{ editable: editMode }">
              <span class="meta-label">Date Made:</span>
              <span v-if="!editMode" class="meta-value">{{ formatDate(editableSnapshot.date || currentSnapshot?.date) }}</span>
              <input
                v-else
                v-model="editableSnapshot.date"
                type="date"
                class="meta-input"
              />
            </div>
            
            <div class="meta-item" :class="{ editable: editMode }">
              <span class="meta-label">Rating:</span>
              <div v-if="!editMode" class="stars-display">
                <img
                  v-for="i in 5"
                  :key="i"
                  src="/assets/star.png"
                  alt="star"
                  class="star-icon"
                  :class="{ filled: i <= (editableSnapshot.ranking || currentSnapshot?.ranking || 0) }"
                />
              </div>
              <select v-else v-model.number="editableSnapshot.ranking" class="rating-select">
                <option v-for="i in 5" :key="i" :value="i">{{ i }} Star{{ i > 1 ? 's' : '' }}</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Right Page -->
        <div class="page right-page">
          <!-- Snapshot Tabs -->
          <div class="snapshot-tabs-container">
            <div class="snapshot-tabs" ref="tabsContainer">
              <div
                v-for="(snapshot, index) in sortedSnapshots"
                :key="snapshot._id || index"
                class="snapshot-tab"
                :class="{ active: currentSnapshotIndex === index && !isNewSnapshot, default: recipe && snapshot._id === recipe.defaultSnapshot }"
                @click="switchSnapshot(index)"
              >
                <span class="tab-label">{{ snapshot.subname || `Snapshot ${index + 1}` }}</span>
                <span v-if="recipe && snapshot._id === recipe.defaultSnapshot" class="default-icon" title="Default">⭐</span>
                <button
                  v-if="editMode && recipe && snapshot._id !== recipe.defaultSnapshot"
                  @click.stop="setAsDefault(snapshot._id)"
                  class="set-default-btn"
                  title="Set as default"
                >
                  ⭐
                </button>
              </div>
              
              <!-- New Snapshot Tab - Always show -->
              <div
                class="snapshot-tab new-tab"
                :class="{ active: isNewSnapshot || (sortedSnapshots.length === 0 && currentSnapshotIndex === 0) }"
                @click="createNewSnapshot"
              >
                + New
              </div>
            </div>
          </div>
          
          <!-- Tab Content -->
          <div class="tab-content">
            <!-- Always show content, even if no snapshots exist -->
            <div class="content-section">
              <div class="section" :class="{ editable: editMode }">
                <div v-if="editMode" class="edit-indicator">✏️</div>
                <h3 class="section-title">Ingredients</h3>
                <textarea
                  v-if="editMode"
                  v-model="editableSnapshot.ingredientsList"
                  class="section-input"
                  rows="8"
                  placeholder="Enter ingredients..."
                ></textarea>
                <div v-else class="section-content" v-html="formatMarkdown(editableSnapshot.ingredientsList || currentSnapshot?.ingredientsList || 'No ingredients listed')"></div>
              </div>
              
              <div class="section" :class="{ editable: editMode }">
                <div v-if="editMode" class="edit-indicator">✏️</div>
                <h3 class="section-title">Instructions</h3>
                <textarea
                  v-if="editMode"
                  v-model="editableSnapshot.instructions"
                  class="section-input"
                  rows="10"
                  placeholder="Enter instructions..."
                ></textarea>
                <div v-else class="section-content" v-html="formatMarkdown(editableSnapshot.instructions || currentSnapshot?.instructions || 'No instructions listed')"></div>
              </div>
              
              <div class="section" :class="{ editable: editMode }">
                <div v-if="editMode" class="edit-indicator">✏️</div>
                <h3 class="section-title">Notes</h3>
                <textarea
                  v-if="editMode"
                  v-model="editableSnapshot.note"
                  class="section-input"
                  rows="6"
                  placeholder="Enter notes..."
                ></textarea>
                <div v-else class="section-content" v-html="formatMarkdown(editableSnapshot.note || currentSnapshot?.note || 'No notes')"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecipesStore } from '../stores/recipes'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const recipesStore = useRecipesStore()
const recipeBooksStore = useRecipeBooksStore()
const authStore = useAuthStore()

const recipe = ref(null)
const recipeIdFromRoute = ref(null)
const loading = ref(false)
const error = ref('')
const editMode = ref(false)
const saving = ref(false)
const currentSnapshotIndex = ref(0)
const isNewSnapshot = ref(true) // Start with new snapshot if no snapshots exist
const editableRecipeName = ref('New Recipe')
const editableSnapshot = ref({
  ingredientsList: '',
  instructions: '',
  note: '',
  date: new Date().toISOString().split('T')[0],
  ranking: 1,
  subname: '',
  pictures: []
})
const tabsContainer = ref(null)

const sortedSnapshots = computed(() => {
  return [...recipesStore.snapshots].sort((a, b) => new Date(a.date) - new Date(b.date))
})

const currentSnapshot = computed(() => {
  if (isNewSnapshot.value) return null
  return sortedSnapshots.value[currentSnapshotIndex.value] || null
})

async function loadRecipe() {
  const recipeId = route.params.id
  recipeIdFromRoute.value = recipeId
  
  // Show empty state immediately
  if (!recipe.value) {
    recipe.value = {
      _id: recipeId,
      name: 'New Recipe',
      description: '',
      snapshots: [],
      defaultSnapshot: null
    }
    editableRecipeName.value = 'New Recipe'
    isNewSnapshot.value = true
    currentSnapshotIndex.value = 0
    loadSnapshotData(null)
  }
  
  loading.value = true
  error.value = ''
  
  // Check if this is a temporary ID (starts with "temp-")
  const isTempId = recipeId && recipeId.startsWith('temp-')
  
  try {
    if (!isTempId) {
      try {
        await recipesStore.fetchRecipe(recipeId)
        const fetchedRecipe = recipesStore.currentRecipe
        if (fetchedRecipe) {
          recipe.value = fetchedRecipe
          editableRecipeName.value = fetchedRecipe.name
        }
      } catch (fetchErr) {
        // If fetch fails, recipe might not exist yet - keep empty state
        console.warn('Failed to fetch recipe:', fetchErr)
      }
    }
    
    // Load snapshots if recipe exists and has snapshots
    if (recipe.value && recipe.value.snapshots && recipe.value.snapshots.length > 0) {
      await recipesStore.fetchSnapshots(recipe.value._id)
    }
    
    if (recipe.value && sortedSnapshots.value.length > 0) {
      // Check if there's a snapshot query parameter
      const snapshotId = route.query.snapshot
      if (snapshotId) {
        const index = sortedSnapshots.value.findIndex(s => s._id === snapshotId)
        if (index !== -1) {
          currentSnapshotIndex.value = index
          isNewSnapshot.value = false
          loadSnapshotData(sortedSnapshots.value[index])
        }
      } else if (recipe.value?.defaultSnapshot) {
        const defaultIndex = sortedSnapshots.value.findIndex(s => s._id === recipe.value.defaultSnapshot)
        if (defaultIndex !== -1) {
          currentSnapshotIndex.value = defaultIndex
          isNewSnapshot.value = false
          loadSnapshotData(sortedSnapshots.value[defaultIndex])
        }
      } else {
        // Load first snapshot
        currentSnapshotIndex.value = 0
        isNewSnapshot.value = false
        loadSnapshotData(sortedSnapshots.value[0])
      }
    } else if (recipe.value && !isTempId) {
      // Recipe exists but no snapshots - show empty new snapshot
      isNewSnapshot.value = true
      currentSnapshotIndex.value = 0
      loadSnapshotData(null)
    } else {
      // Recipe doesn't exist yet - create it
      try {
        // Try to create recipe with a timeout
        const createPromise = recipesStore.createRecipe('New Recipe', '')
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Creation timeout')), 5000)
        )
        
        try {
          const newRecipeId = await Promise.race([createPromise, timeoutPromise])
          if (newRecipeId) {
            recipe.value._id = newRecipeId
            // Check if there's a pending book to add it to
            const pendingBookId = sessionStorage.getItem('pendingRecipeBook')
            if (pendingBookId) {
              try {
                await recipeBooksStore.addRecipeToBook(newRecipeId, pendingBookId)
                sessionStorage.removeItem('pendingRecipeBook')
              } catch (bookErr) {
                console.warn('Failed to add recipe to book:', bookErr)
                // Store for later retry
                sessionStorage.setItem('pendingRecipeBook', pendingBookId)
                sessionStorage.setItem('pendingRecipeId', newRecipeId)
              }
            }
            
            // Update URL with real recipe ID if it's a temp ID
            if (isTempId) {
              router.replace(`/recipe/${newRecipeId}`)
            }
          }
        } catch (createErr) {
          console.warn('Recipe creation timed out or failed:', createErr)
          // Keep showing empty state - user can save manually
        }
      } catch (createErr) {
        console.warn('Failed to create recipe:', createErr)
      }
      
      // If creation failed, show empty state with placeholder
      recipe.value = {
        _id: recipeId,
        name: 'New Recipe',
        description: '',
        snapshots: [],
        defaultSnapshot: null
      }
      editableRecipeName.value = 'New Recipe'
      isNewSnapshot.value = true
      currentSnapshotIndex.value = 0
      loadSnapshotData(null)
    }
  } catch (err) {
    error.value = err.message || 'Failed to load recipe'
    // Even on error, show the recipe page with empty state
    if (!recipe.value) {
      recipe.value = {
        _id: recipeId,
        name: 'New Recipe',
        description: '',
        snapshots: [],
        defaultSnapshot: null
      }
      editableRecipeName.value = 'New Recipe'
      isNewSnapshot.value = true
      currentSnapshotIndex.value = 0
      loadSnapshotData(null)
    }
  } finally {
    loading.value = false
  }
}

function loadSnapshotData(snapshot) {
  if (!snapshot) {
    editableSnapshot.value = {
      ingredientsList: '',
      instructions: '',
      note: '',
      date: new Date().toISOString().split('T')[0],
      ranking: 1,
      subname: '',
      pictures: []
    }
    return
  }
  
  editableSnapshot.value = {
    ingredientsList: snapshot.ingredientsList || '',
    instructions: snapshot.instructions || '',
    note: snapshot.note || '',
    date: snapshot.date ? snapshot.date.split('T')[0] : new Date().toISOString().split('T')[0],
    ranking: snapshot.ranking || 1,
    subname: snapshot.subname || '',
    pictures: snapshot.pictures || []
  }
}

function switchSnapshot(index) {
  if (index === sortedSnapshots.value.length) {
    createNewSnapshot()
  } else {
    currentSnapshotIndex.value = index
    isNewSnapshot.value = false
    loadSnapshotData(sortedSnapshots.value[index])
    scrollToTab(index)
  }
}

function createNewSnapshot() {
  isNewSnapshot.value = true
  currentSnapshotIndex.value = sortedSnapshots.value.length
  editableSnapshot.value = {
    ingredientsList: '',
    instructions: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
    ranking: 1,
    subname: `Snapshot ${sortedSnapshots.value.length + 1}`,
    pictures: []
  }
  scrollToTab(sortedSnapshots.value.length)
}

function scrollToTab(index) {
  nextTick(() => {
    if (tabsContainer.value) {
      const tabs = tabsContainer.value.querySelectorAll('.snapshot-tab')
      if (tabs[index]) {
        tabs[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  })
}

async function toggleEditMode() {
  if (editMode.value) {
    // Save changes
    saving.value = true
    try {
      // Save recipe name first (this creates recipe if needed)
      await updateRecipeName()
      // Then save snapshot
      await saveSnapshot()
      
      // Try to add to book if pending
      const pendingBookId = sessionStorage.getItem('pendingRecipeBook')
      const recipeId = recipe.value?._id
      if (pendingBookId && recipeId && !recipeId.startsWith('temp-')) {
        try {
          await recipeBooksStore.addRecipeToBook(recipeId, pendingBookId)
          sessionStorage.removeItem('pendingRecipeBook')
        } catch (bookErr) {
          console.warn('Failed to add recipe to book, will retry later:', bookErr)
          // Keep in sessionStorage for next save
        }
      }
      
      editMode.value = false
    } catch (err) {
      console.error('Save error:', err)
      error.value = err.message || 'Failed to save. Please try again.'
      // Keep edit mode on if save failed
    } finally {
      saving.value = false
    }
  } else {
    editMode.value = true
  }
}

async function saveSnapshot() {
  if (!recipeIdFromRoute.value) return
  
  // Ensure recipe exists first
  if (!recipe.value?._id || recipe.value._id.startsWith('temp-')) {
    // Recipe doesn't exist yet - create it first
    await updateRecipeName()
  }
  
  const recipeId = recipe.value?._id || recipeIdFromRoute.value
  if (!recipeId || recipeId.startsWith('temp-')) {
    console.warn('Cannot save snapshot - recipe not created yet')
    return
  }
  
  try {
    if (isNewSnapshot.value) {
      // Only create if there's actual content
      const hasContent = editableSnapshot.value.ingredientsList.trim() || 
                        editableSnapshot.value.instructions.trim() || 
                        editableSnapshot.value.note.trim() ||
                        editableSnapshot.value.subname.trim()
      
      if (hasContent) {
        // Create new snapshot
        const snapshotId = await recipesStore.createSnapshot({
          ...editableSnapshot.value,
          recipe: recipeId
        })
        
        // If this is the first snapshot, set it as default
        if (sortedSnapshots.value.length === 0) {
          await recipesStore.setDefaultSnapshot(snapshotId, recipeId)
        }
        
        // Reload to get the new snapshot
        await recipesStore.fetchSnapshots(recipeId)
        // After creating, switch to a new empty snapshot tab
        isNewSnapshot.value = true
        currentSnapshotIndex.value = sortedSnapshots.value.length
        loadSnapshotData(null)
      }
    } else if (currentSnapshot.value) {
      // Update existing snapshot
      await recipesStore.updateSnapshot(currentSnapshot.value._id, {
        ...editableSnapshot.value,
        recipe: recipeId
      })
      await recipesStore.fetchSnapshots(recipeId)
    }
  } catch (err) {
    error.value = err.message || 'Failed to save snapshot'
    console.error('Save error:', err)
    throw err // Re-throw so toggleEditMode knows it failed
  }
}

async function updateRecipeName() {
  if (!recipeIdFromRoute.value) return
  
  const recipeId = recipe.value?._id || recipeIdFromRoute.value
  const newName = editableRecipeName.value.trim()
  
  if (!newName) {
    editableRecipeName.value = recipe.value?.name || 'New Recipe'
    return
  }
  
  try {
    // If recipe doesn't exist yet or has temp ID, create it
    const isTempId = recipeId.startsWith('temp-')
    if (!recipe.value?._id || isTempId || !recipe.value._id) {
      const createdId = await recipesStore.createRecipe(newName, recipe.value?.description || '')
      if (createdId) {
        recipe.value = {
          _id: createdId,
          name: newName,
          description: recipe.value?.description || '',
          snapshots: [],
          defaultSnapshot: null
        }
        
        // Try to add to book if pending
        const pendingBookId = sessionStorage.getItem('pendingRecipeBook')
        if (pendingBookId) {
          try {
            await recipeBooksStore.addRecipeToBook(createdId, pendingBookId)
            sessionStorage.removeItem('pendingRecipeBook')
          } catch (bookErr) {
            console.warn('Failed to add recipe to book:', bookErr)
          }
        }
        
        // Update URL if it was a temp ID
        if (isTempId) {
          router.replace(`/recipe/${createdId}`)
        }
      }
    } else if (newName !== recipe.value.name) {
      await recipesStore.updateRecipe(recipe.value._id, newName, recipe.value.description || '')
      recipe.value.name = newName
    }
  } catch (err) {
    error.value = err.message || 'Failed to update recipe name'
    editableRecipeName.value = recipe.value?.name || 'New Recipe'
  }
}

async function setAsDefault(snapshotId) {
  if (!recipe.value) return
  try {
    await recipesStore.setDefaultSnapshot(snapshotId, recipe.value._id)
    await loadRecipe()
  } catch (err) {
    error.value = err.message || 'Failed to set default snapshot'
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Not set'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatMarkdown(text) {
  if (!text) return ''
  // Simple markdown formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/`(.*?)`/g, '<code>$1</code>') // Code
    .replace(/\n/g, '<br>') // Line breaks
}

watch(() => recipesStore.snapshots, () => {
  if (sortedSnapshots.value.length > 0 && !isNewSnapshot.value) {
    loadSnapshotData(sortedSnapshots.value[currentSnapshotIndex.value])
  }
}, { deep: true })

// Watch for route changes to reload recipe
watch(() => route.params.id, () => {
  loadRecipe()
})

onMounted(() => {
  loadRecipe()
})
</script>

<style scoped>
.recipe-container {
  min-height: calc(100vh - 80px);
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  color: var(--color-dark-brown);
}

.error {
  color: #d32f2f;
}

.edit-toggle {
  position: fixed;
  top: 100px;
  right: 2rem;
  z-index: 100;
  padding: 0.75rem 1.5rem;
  background-color: var(--color-medium-brown);
  color: white;
  border-radius: 8px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  transition: background-color 0.2s;
  cursor: pointer;
}

.edit-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-toggle:hover {
  background-color: var(--color-dark-brown);
}

.edit-icon {
  font-size: 1.2rem;
}

.recipe-wrapper {
  margin-top: 4rem;
}

.recipe-spread {
  display: flex;
  gap: 2px;
  background-color: #f5f5dc;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  min-height: 700px;
}

.page {
  flex: 1;
  background-color: #FFF8DC;
  padding: 2rem;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.05);
  position: relative;
  min-height: 700px;
}

.page::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 20px,
    rgba(0, 0, 0, 0.1) 20px,
    rgba(0, 0, 0, 0.1) 22px
  );
}

.recipe-header {
  margin-bottom: 1.5rem;
}

.recipe-name {
  font-size: 2rem;
  color: var(--color-dark-brown);
  margin-bottom: 0.5rem;
  border-bottom: 2px solid var(--color-light-brown);
  padding-bottom: 0.5rem;
}

.snapshot-name {
  font-size: 1.2rem;
  color: var(--color-medium-brown);
  font-weight: normal;
  font-style: italic;
}

.recipe-name-input {
  font-size: 2rem;
  color: var(--color-dark-brown);
  margin-bottom: 0.5rem;
  border-bottom: 2px solid var(--color-light-brown);
  padding-bottom: 0.5rem;
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--color-medium-brown);
  font-family: inherit;
}

.recipe-name-input:focus {
  outline: none;
  border-bottom-color: var(--color-dark-brown);
}

.snapshot-name-input {
  font-size: 1.2rem;
  color: var(--color-medium-brown);
  font-weight: normal;
  font-style: italic;
  width: 100%;
  padding: 0.25rem;
  border: 2px solid var(--color-medium-brown);
  border-radius: 4px;
  background-color: white;
  font-family: inherit;
  margin-top: 0.5rem;
}

.snapshot-name-input:focus {
  outline: none;
  border-color: var(--color-dark-brown);
}

.recipe-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background-color: var(--color-cream);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  border: 2px solid var(--color-light-brown);
}

.recipe-image-container.editable {
  border-color: var(--color-medium-brown);
  border-width: 3px;
}

.edit-indicator {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  z-index: 1;
}

.recipe-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-medium-brown);
  font-style: italic;
}

.recipe-meta {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-label {
  font-weight: 600;
  color: var(--color-dark-brown);
}

.meta-value {
  color: var(--color-medium-brown);
}

.meta-input,
.rating-select {
  padding: 0.5rem;
  border: 2px solid var(--color-medium-brown);
  border-radius: 4px;
  background-color: white;
  font-size: 0.9rem;
}

.meta-item {
  position: relative;
}

.meta-item.editable::after {
  content: '✏️';
  position: absolute;
  top: 0;
  right: 0;
  font-size: 0.8rem;
  opacity: 0.7;
}

.stars-display {
  display: flex;
  gap: 0.25rem;
}

.star-icon {
  width: 24px;
  height: 24px;
  opacity: 0.3;
}

.star-icon.filled {
  opacity: 1;
}

.snapshot-tabs-container {
  margin-bottom: 1.5rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.snapshot-tabs {
  display: flex;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  min-width: min-content;
}

.snapshot-tab {
  padding: 0.75rem 1.5rem;
  background-color: var(--color-cream);
  border: 2px solid var(--color-light-brown);
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  position: relative;
}

.snapshot-tab:hover {
  background-color: var(--color-gold);
}

.snapshot-tab.active {
  background-color: var(--color-light-brown);
  border-bottom-color: var(--color-light-brown);
  font-weight: 600;
}

.snapshot-tab.default {
  border-color: var(--color-gold);
}

.default-icon {
  font-size: 0.9rem;
}

.set-default-btn {
  padding: 0.25rem 0.5rem;
  background-color: transparent;
  border: 1px solid var(--color-medium-brown);
  border-radius: 4px;
  font-size: 0.8rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.set-default-btn:hover {
  opacity: 1;
}

.new-tab {
  background-color: var(--color-medium-brown);
  color: white;
  border-color: var(--color-medium-brown);
}

.new-tab:hover {
  background-color: var(--color-dark-brown);
}

.tab-content {
  min-height: 400px;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  position: relative;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  border: 1px solid var(--color-light-brown);
}

.section.editable {
  border-color: var(--color-medium-brown);
  border-width: 2px;
}

.section-title {
  font-size: 1.2rem;
  color: var(--color-dark-brown);
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-light-brown);
  padding-bottom: 0.25rem;
}

.section-content {
  color: var(--color-dark-brown);
  white-space: pre-wrap;
  line-height: 1.6;
}

.section-content code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

.section-content strong {
  font-weight: 600;
}

.section-content em {
  font-style: italic;
}

.section-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--color-light-brown);
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  background-color: white;
}

.section-input:focus {
  outline: none;
  border-color: var(--color-medium-brown);
}

@media (max-width: 1024px) {
  .recipe-spread {
    flex-direction: column;
  }
  
  .edit-toggle {
    position: relative;
    top: 0;
    left: 0;
    margin-bottom: 1rem;
  }
}

@media (max-width: 768px) {
  .recipe-container {
    padding: 1rem;
  }
  
  .recipe-spread {
    padding: 1rem;
  }
  
  .page {
    padding: 1rem;
    min-height: auto;
  }
}
</style>

