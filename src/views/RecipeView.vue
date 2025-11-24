<template>
  <div class="recipe-container">
    <div v-if="loading && !recipe" class="loading">Loading...</div>
    <div v-if="error && !recipe" class="error">{{ error }}</div>
    
    <!-- Show recipe page even if there was an error (e.g., timeout) -->
    <div v-if="recipe || recipeIdFromRoute" class="recipe-page-wrapper">
      <!-- Book header with name and edit button - Outside the book -->
      <div class="book-header">
        <h1 class="book-name">{{ currentBookName }}</h1>
        <button class="edit-toggle" @click="toggleEditMode" :disabled="saving">
          <span class="edit-icon">✏️</span>
          {{ saving ? 'Saving...' : (editMode ? 'Save' : 'Edit') }}
        </button>
      </div>
      
      <div class="notebook-wrapper">
        <div class="notebook">
          <!-- Book pages -->
          <div class="pages-container">
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
              @blur="handleRecipeNameBlur"
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
          <!-- Tab Content - Brown background shows through -->
          <div class="tab-content-wrapper">
            <!-- Snapshot Tabs - Manila folder style, overlapping, right-aligned -->
            <div class="snapshot-tabs-container">
              <div class="snapshot-tabs" ref="tabsContainer">
              <!-- New Snapshot Tab - Always first (leftmost) -->
              <div
                class="snapshot-tab new-tab"
                :class="{ active: isNewSnapshot }"
                :style="{ 
                  zIndex: isNewSnapshot ? 100 : (sortedSnapshots.length + 11),
                  marginTop: `0px`,
                  marginLeft: `0px`
                }"
                @click="createNewSnapshot"
              >
                + New
              </div>
              
              <!-- Existing snapshots - newest first, oldest last (left to right after new button) -->
              <div
                v-for="(snapshot, index) in sortedSnapshots"
                :key="snapshot._id || index"
                class="snapshot-tab"
                :class="{ 
                  active: currentSnapshotIndex === index && !isNewSnapshot, 
                  default: recipe && snapshot._id === recipe.defaultSnapshot 
                }"
                :style="{ 
                  zIndex: currentSnapshotIndex === index && !isNewSnapshot ? 100 : (sortedSnapshots.length - index + 10),
                  marginTop: `${(index + 1) * 6}px`,
                  marginLeft: `${(index + 1) * 3}px`
                }"
                @click="switchSnapshot(index)"
              >
                <span class="tab-label">{{ formatDateShort(snapshot.date) || snapshot.subname || `Snapshot ${index + 1}` }}</span>
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
        
        <!-- Bookmarks - Always visible, shared with RecipeBookView -->
        <div class="bookmarks">
          <div
            class="bookmark bookmark-toc"
            @click="goToTableOfContents"
            title="Go to Table of Contents"
          >
            Table of Contents
          </div>
          <div
            class="bookmark bookmark-rankings"
            @click="goToRankings"
            title="Go to Rankings"
          >
            Rankings
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

const currentBookId = ref(null)
const currentBookName = ref('Recipe Book')

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

// Sort snapshots by date, newest first (for display: New button, then newest, then older)
const sortedSnapshots = computed(() => {
  return [...recipesStore.snapshots].sort((a, b) => {
    const dateA = new Date(a.date || 0)
    const dateB = new Date(b.date || 0)
    return dateB - dateA // Most recent first (newest first)
  })
})

// Format date as mm/dd/yy
function formatDateShort(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

const currentSnapshot = computed(() => {
  if (isNewSnapshot.value || currentSnapshotIndex.value === -1) return null
  return sortedSnapshots.value[currentSnapshotIndex.value] || null
})

async function loadRecipe() {
  const recipeId = route.params.id
  recipeIdFromRoute.value = recipeId
  
  // Get book ID from query or sessionStorage
  const bookIdFromQuery = route.query.book
  const bookIdFromStorage = sessionStorage.getItem('pendingRecipeBook')
  if (bookIdFromQuery) {
    currentBookId.value = bookIdFromQuery
  } else if (bookIdFromStorage) {
    currentBookId.value = bookIdFromStorage
  }
  
  // Load book name if we have book ID
  if (currentBookId.value) {
    try {
      const book = await recipeBooksStore.fetchBook(currentBookId.value)
      if (book) {
        currentBookName.value = book.name
      }
    } catch (err) {
      console.warn('Failed to load book:', err)
    }
  }
  
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
    currentSnapshotIndex.value = -1
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
          // Load most recent snapshot (index 0 - newest, after new button)
          currentSnapshotIndex.value = 0
          isNewSnapshot.value = false
          loadSnapshotData(sortedSnapshots.value[0])
        }
      } else if (recipe.value && !isTempId) {
        // Recipe exists but no snapshots - show empty new snapshot
        isNewSnapshot.value = true
        currentSnapshotIndex.value = -1
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
          const createdId = await Promise.race([createPromise, timeoutPromise])
          if (createdId) {
            recipe.value._id = createdId
            // Check if there's a pending book to add it to
            const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
            if (bookId) {
              try {
                // Check if already in book
                const book = await recipeBooksStore.fetchBook(bookId)
                const isAlreadyInBook = book?.recipes?.includes(createdId)
                
                if (!isAlreadyInBook) {
                  await recipeBooksStore.addRecipeToBook(createdId, bookId)
                }
                
                if (sessionStorage.getItem('pendingRecipeBook')) {
                  sessionStorage.removeItem('pendingRecipeBook')
                }
                if (!currentBookId.value) {
                  currentBookId.value = bookId
                  // Load book name
                  try {
                    const updatedBook = await recipeBooksStore.fetchBook(bookId)
                    if (updatedBook) {
                      currentBookName.value = updatedBook.name
                    }
                  } catch (err) {
                    console.warn('Failed to load book name:', err)
                  }
                }
              } catch (bookErr) {
                console.warn('Failed to add recipe to book:', bookErr)
              }
            }
            
            // Update URL with real recipe ID if it's a temp ID
            if (isTempId && currentBookId.value) {
              router.replace(`/recipe/${createdId}?book=${currentBookId.value}`)
            } else if (isTempId) {
              router.replace(`/recipe/${createdId}`)
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
      currentSnapshotIndex.value = -1
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
      currentSnapshotIndex.value = -1
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
  // Index in sortedSnapshots (most recent first, index 0 = newest)
  currentSnapshotIndex.value = index
  isNewSnapshot.value = false
  loadSnapshotData(sortedSnapshots.value[index])
  scrollToTab(index) // Scroll to this tab (newest is index 0, on left)
}

function createNewSnapshot() {
  isNewSnapshot.value = true
  // New snapshot is always first (leftmost)
  currentSnapshotIndex.value = -1 // Use -1 to indicate new snapshot
  editableSnapshot.value = {
    ingredientsList: '',
    instructions: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
    ranking: 1,
    subname: '',
    pictures: []
  }
  scrollToTab(-1) // Scroll to new tab (first in visual order)
}

function scrollToTab(index) {
  nextTick(() => {
    if (tabsContainer.value) {
      const tabs = tabsContainer.value.querySelectorAll('.snapshot-tab')
      // Tabs order: [new tab (index 0), newest snapshot (index 1), ..., oldest snapshot]
      // Index -1 means new tab (first tab, index 0)
      const targetIndex = index === -1 ? 0 : (index + 1) // +1 because new tab is first
      if (tabs[targetIndex]) {
        tabs[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  })
}

async function toggleEditMode() {
  if (editMode.value) {
    // Save changes
    saving.value = true
    error.value = ''
    let saveErrors = []
    
    try {
      // Save recipe name first (this creates recipe if needed)
      try {
        await updateRecipeName()
      } catch (err) {
        const isTimeout = err.message?.includes('timed out') || err.message?.includes('Request timed out')
        if (isTimeout) {
          saveErrors.push('Recipe name save timed out. Your changes are saved locally. You can try saving again later.')
          console.warn('Recipe name save timed out, continuing with snapshot save...')
          // Continue - allow snapshot to save even if recipe name timed out
        } else {
          throw err // Re-throw non-timeout errors
        }
      }
      
      // Then save snapshot (needs recipe ID)
      try {
        await saveSnapshot()
      } catch (err) {
        const isTimeout = err.message?.includes('timed out') || err.message?.includes('Request timed out')
        if (isTimeout) {
          saveErrors.push('Snapshot save timed out. Your changes are saved locally. You can try saving again later.')
          console.warn('Snapshot save timed out')
        } else {
          throw err // Re-throw non-timeout errors
        }
      }
      
      // Add recipe to book on first save (if book ID is available) - non-blocking
      const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
      const recipeId = recipe.value?._id
      if (bookId && recipeId && !recipeId.startsWith('temp-')) {
        try {
          // Check if recipe is already in the book
          const book = await recipeBooksStore.fetchBook(bookId)
          const isAlreadyInBook = book?.recipes?.includes(recipeId)
          
          if (!isAlreadyInBook) {
            // First time saving - add to book
            await recipeBooksStore.addRecipeToBook(recipeId, bookId)
            console.log('Recipe added to book successfully on first save')
          }
          
          // Clean up sessionStorage
          if (sessionStorage.getItem('pendingRecipeBook')) {
            sessionStorage.removeItem('pendingRecipeBook')
          }
          
          // Set current book ID if not already set
          if (!currentBookId.value) {
            currentBookId.value = bookId
            // Load book name
            try {
              const updatedBook = await recipeBooksStore.fetchBook(bookId)
              if (updatedBook) {
                currentBookName.value = updatedBook.name
              }
            } catch (err) {
              console.warn('Failed to load book name:', err)
            }
          }
        } catch (bookErr) {
          const isTimeout = bookErr.message?.includes('timed out') || bookErr.message?.includes('Request timed out')
          if (isTimeout) {
            saveErrors.push('Adding recipe to book timed out. You can add it manually from the book view.')
          } else {
            console.warn('Failed to add recipe to book:', bookErr)
            saveErrors.push('Recipe saved but failed to add to book. You can add it manually from the book view.')
          }
          // Keep in sessionStorage for retry
        }
      }
      
      // If there were timeout errors, show warning but allow edit mode to turn off
      if (saveErrors.length > 0) {
        error.value = saveErrors.join(' ')
        // Still allow edit mode to turn off - user can retry later
        editMode.value = false
      } else {
        editMode.value = false
      }
    } catch (err) {
      console.error('Save error:', err)
      const isTimeout = err.message?.includes('timed out') || err.message?.includes('Request timed out')
      if (isTimeout) {
        error.value = 'Save timed out. Your changes are saved locally. You can try saving again later.'
        // Allow edit mode to turn off even on timeout
        editMode.value = false
      } else {
        error.value = err.message || 'Failed to save. Please try again.'
        // Keep edit mode on if save failed (non-timeout error)
      }
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
        
        // Reload snapshots
        await recipesStore.fetchSnapshots(recipeId)
        // After creating, switch to the newly created snapshot (it will be index 0 - newest)
        // Then prepare a new empty snapshot tab
        if (sortedSnapshots.value.length > 0) {
          // Switch to the newly created snapshot (newest, index 0)
          currentSnapshotIndex.value = 0
          isNewSnapshot.value = false
          loadSnapshotData(sortedSnapshots.value[0])
        } else {
          // If no snapshots loaded, stay in new snapshot mode
          isNewSnapshot.value = true
          currentSnapshotIndex.value = -1
          editableSnapshot.value = {
            ingredientsList: '',
            instructions: '',
            note: '',
            date: new Date().toISOString().split('T')[0],
            ranking: 1,
            subname: '',
            pictures: []
          }
        }
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

async function handleRecipeNameBlur() {
  // Just update the local value, actual save happens on toggleEditMode
  // This prevents multiple API calls while typing
}

async function updateRecipeName() {
  if (!recipeIdFromRoute.value) return
  
  const recipeId = recipe.value?._id || recipeIdFromRoute.value
  const newName = editableRecipeName.value.trim()
  
  if (!newName) {
    editableRecipeName.value = recipe.value?.name || 'New Recipe'
    return
  }
  
  // Don't update if name hasn't changed
  if (recipe.value?.name === newName && recipe.value?._id && !recipe.value._id.startsWith('temp-')) {
    return
  }
  
  try {
    // If recipe doesn't exist yet or has temp ID, create it
    const isTempId = recipeId.startsWith('temp-')
    if (!recipe.value?._id || isTempId) {
      const createdId = await recipesStore.createRecipe(newName, recipe.value?.description || '')
      if (createdId) {
        recipe.value = {
          _id: createdId,
          name: newName,
          description: recipe.value?.description || '',
          snapshots: [],
          defaultSnapshot: null
        }
        
        // Update route if it was a temp ID
        if (isTempId && createdId) {
          const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
          const newUrl = bookId ? `/recipe/${createdId}?book=${bookId}` : `/recipe/${createdId}`
          router.replace(newUrl)
          recipeIdFromRoute.value = createdId
        }
        
        // Try to add to book
        const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
        if (bookId) {
          try {
            // Check if already in book
            const book = await recipeBooksStore.fetchBook(bookId)
            const isAlreadyInBook = book?.recipes?.includes(createdId)
            
            if (!isAlreadyInBook) {
              await recipeBooksStore.addRecipeToBook(createdId, bookId)
            }
            
            if (sessionStorage.getItem('pendingRecipeBook')) {
              sessionStorage.removeItem('pendingRecipeBook')
            }
            if (!currentBookId.value) {
              currentBookId.value = bookId
              // Load book name
              try {
                const updatedBook = await recipeBooksStore.fetchBook(bookId)
                if (updatedBook) {
                  currentBookName.value = updatedBook.name
                }
              } catch (err) {
                console.warn('Failed to load book name:', err)
              }
            }
          } catch (bookErr) {
            console.warn('Failed to add recipe to book:', bookErr)
          }
        }
        
        // Update URL if it was a temp ID
        if (isTempId && currentBookId.value) {
          router.replace(`/recipe/${createdId}?book=${currentBookId.value}`)
        } else if (isTempId) {
          router.replace(`/recipe/${createdId}`)
        }
      }
    } else if (newName !== recipe.value.name) {
      await recipesStore.updateRecipe(recipe.value._id, newName, recipe.value.description || '')
      if (recipe.value) {
        recipe.value.name = newName
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to update recipe name'
    editableRecipeName.value = recipe.value?.name || 'New Recipe'
    throw err
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
  let formatted = text
    // Bullet points first (before other replacements)
    .replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive list items in ul
    .replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic (but not if it's part of bold)
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Code
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Line breaks (but preserve in lists)
    .replace(/(?<!<\/li>)\n(?!<li>)/g, '<br>')
  
  return formatted
}

function getActiveTabColor() {
  if (isNewSnapshot.value) {
    return 'rgba(167, 123, 91, 0.3)' // var(--color-medium-brown) with opacity
  }
  return 'rgba(217, 154, 108, 0.3)' // var(--color-light-brown) with opacity
}

function goToTableOfContents() {
  const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
  if (bookId) {
    // Force reload by adding timestamp to ensure fresh data
    router.push(`/book/${bookId}?refresh=${Date.now()}`)
  } else {
    // Navigate to home if no book ID
    router.push('/')
  }
}

function goToRankings() {
  const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
  if (bookId) {
    // Force reload by adding timestamp to ensure fresh data
    router.push(`/book/${bookId}?view=rankings&refresh=${Date.now()}`)
  } else {
      // Navigate to home if no book ID
      router.push('/')
  }
}

watch(() => recipesStore.snapshots, () => {
  if (sortedSnapshots.value.length > 0 && !isNewSnapshot.value && currentSnapshotIndex.value >= 0) {
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
  display: flex;
  flex-direction: column;
  align-items: center;
}

.recipe-page-wrapper {
  width: 100%;
  max-width: 1600px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Book header - Outside the book */
.book-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 1rem;
}

.book-name {
  color: var(--color-dark-brown);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.notebook-wrapper {
  width: 100%;
  position: relative;
  /* Brown background shows through as book cover */
  background-color: var(--color-dark-brown);
  padding: 1rem;
  border-radius: 8px;
}

.notebook {
  position: relative;
  /* Custom book background - shared with RecipeBookView */
  background: 
    repeating-linear-gradient(
      0deg,
      rgba(139, 115, 85, 0.03) 0px,
      transparent 1px,
      transparent 2px,
      rgba(139, 115, 85, 0.03) 3px
    ),
    radial-gradient(circle at 20% 50%, rgba(250, 235, 215, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(250, 235, 215, 0.3) 0%, transparent 50%),
    linear-gradient(135deg, #f5f5dc 0%, #fef9e7 50%, #f5f5dc 100%);
  background-size: 100% 4px, 100% 100%, 100% 100%, 100% 100%;
  border-radius: 8px;
  padding: 2rem;
  min-height: 700px;
  filter: contrast(1.05) brightness(0.98);
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
  padding: 0.5rem 1rem;
  background-color: var(--color-medium-brown);
  color: white;
  border-radius: 4px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
  cursor: pointer;
}

.edit-toggle:hover:not(:disabled) {
  background-color: var(--color-dark-brown);
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

.pages-container {
  display: flex;
  gap: 0;
  min-height: 700px;
  position: relative;
}

/* Page binding gradient in the middle - smoother */
.pages-container::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  width: 24px;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(139, 115, 85, 0.06) 15%,
    rgba(139, 115, 85, 0.10) 30%,
    rgba(111, 78, 55, 0.15) 50%,
    rgba(139, 115, 85, 0.10) 70%,
    rgba(139, 115, 85, 0.06) 85%,
    transparent 100%
  );
  z-index: 2;
  box-shadow: 
    inset -2px 0 6px rgba(0, 0, 0, 0.08),
    inset 2px 0 6px rgba(0, 0, 0, 0.08);
}

.recipe-spread {
  display: flex;
  gap: 0;
  width: 100%;
  min-height: 700px;
  position: relative;
}

.page {
  flex: 1;
  /* Paper background - no gradient */
  background-color: #FFF8DC;
  padding: 2rem 4rem;
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.03),
    inset 0 0 60px rgba(139, 115, 85, 0.02);
  position: relative;
  min-height: 700px;
}

/* Brown inside covers and 3D shadows */
.left-page {
  border-radius: 8px 0 0 8px;
  padding-right: 4rem;
  /* 3D shadow effect - pages stacked, showing depth */
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.03),
    inset 0 0 60px rgba(139, 115, 85, 0.02),
    -8px 0 16px rgba(0, 0, 0, 0.15),
    -4px 0 8px rgba(0, 0, 0, 0.1),
    -2px 0 4px rgba(0, 0, 0, 0.08);
}

.right-page {
  border-radius: 0 8px 8px 0;
  padding-left: 4rem;
  /* Transparent - brown background shows through */
  background-color: transparent;
  /* 3D shadow effect - pages stacked, showing depth */
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.03),
    inset 0 0 60px rgba(139, 115, 85, 0.02),
    8px 0 16px rgba(0, 0, 0, 0.15),
    4px 0 8px rgba(0, 0, 0, 0.1),
    2px 0 4px rgba(0, 0, 0, 0.08);
  /* Allow scrolling if content overflows */
  overflow-y: auto;
  max-height: 100%;
}

/* Left and right page styles moved above */

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

.right-page::before {
  left: auto;
  right: 0;
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

.tab-content-wrapper {
  border-radius: 12px;
  padding-top: 0;
  position: relative;
  min-height: 400px;
  /* Pale/orange brown background - lighter and more orange-tinted */
  background-color: rgba(217, 154, 108, 0.4); /* var(--color-light-brown) with opacity - more pale/orange */
}

.snapshot-tabs-container {
  position: relative;
  margin-bottom: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  padding-bottom: 0;
  display: flex;
  justify-content: flex-end; /* Right-align tabs */
  /* Same color as page background and content */
  background-color: #FFF8DC;
  border-radius: 4px 4px 0 0;
}

.snapshot-tabs {
  display: flex;
  gap: 0;
  min-width: min-content;
  position: relative;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  /* Order: New button (leftmost), newest snapshot, older snapshots (rightmost) */
}

.snapshot-tab {
  padding: 0.75rem 1.5rem;
  background-color: #FFF8DC; /* Same as page background */
  border: 2px solid var(--color-light-brown);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  position: relative;
  margin-right: -8px; /* Overlap tabs more */
  box-shadow: 
    0 -2px 4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.snapshot-tab:hover {
  background-color: var(--color-gold);
  transform: translateY(-3px);
  box-shadow: 
    0 -4px 8px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.snapshot-tab.active {
  background-color: #FFF8DC; /* Same as page and content */
  border-bottom: 2px solid var(--color-light-brown);
  font-weight: 600;
  transform: translateY(-1px);
  box-shadow: 
    0 -2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  /* Physically connect to content below - no gap */
  margin-bottom: -2px; /* Overlap border to connect seamlessly */
  border-radius: 8px 8px 0 0;
  z-index: 10; /* Ensure active tab is above content border */
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
  transform: translateY(-3px);
  box-shadow: 
    0 -4px 8px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.new-tab.active {
  background-color: var(--color-medium-brown);
  transform: translateY(-1px);
  box-shadow: 
    0 -2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  margin-bottom: -1px;
}

.tab-content {
  min-height: 400px;
  max-height: calc(700px - 200px); /* Allow scrolling if content is tall */
  overflow-y: auto;
  border-radius: 0 0 12px 12px;
  padding: 1.5rem;
  transition: background-color 0.3s;
  border: 2px solid var(--color-light-brown);
  border-top: none;
  margin-top: -2px; /* Physically connected to active tab - overlap border */
  position: relative;
  z-index: 1;
  /* Pale/orange brown to match tab-content-wrapper */
  background-color: rgba(217, 154, 108, 0.4); /* var(--color-light-brown) with opacity - more pale/orange */
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.05),
    inset 0 0 30px rgba(139, 115, 85, 0.02);
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  /* Transparent to allow tab connection to show through */
  background-color: transparent;
}

.section {
  position: relative;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.9);
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

.bookmarks {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 10;
}

.bookmark {
  width: 40px;
  height: 120px;
  background-color: var(--color-medium-brown);
  color: white;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px 0 0 4px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: -2px 2px 4px rgba(0, 0, 0, 0.2);
}

.bookmark:hover {
  background-color: var(--color-dark-brown);
  transform: translateX(-5px);
}

.bookmark.active {
  background-color: var(--color-dark-brown);
  width: 50px;
}

@media (max-width: 1024px) {
  .recipe-spread {
    flex-direction: column;
  }
  
  .book-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .spiral-binding {
    display: none;
  }
  
  .pages-container {
    margin-left: 0;
  }
  
  .bookmarks {
    right: 10px;
    flex-direction: row;
    top: auto;
    bottom: 10px;
    transform: none;
  }
  
  .bookmark {
    width: 100px;
    height: 40px;
    writing-mode: horizontal-tb;
    border-radius: 4px;
  }
  
  .bookmark.active {
    width: 110px;
    height: 45px;
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

