<template>
  <div class="recipe-container">
    <div v-if="loading && !recipe" class="loading">Loading...</div>
    <div v-if="error && !recipe" class="error">{{ error }}</div>
    
    <!-- Show dish page even if there was an error (e.g., timeout) -->
    <div v-if="dish || dishIdFromRoute" class="recipe-page-wrapper">
      <!-- Book header with name and edit button - Outside the book -->
      <div class="book-header">
        <h1 class="book-name">{{ currentBookName }}</h1>
        <div class="book-header-actions">
          <button 
            v-if="dish && dish._id && !dish._id.startsWith('temp-')"
            @click="showDeleteDishDialog = true"
            class="delete-dish-btn"
            title="Delete this dish"
          >
            Delete Dish
          </button>
          <button class="edit-toggle" @click="toggleEditMode" :disabled="saving">
            <img src="/assets/pencil.png" alt="Edit" class="edit-icon" />
            {{ saving ? 'Saving...' : (editMode ? 'Save' : 'Edit') }}
          </button>
        </div>
      </div>
      
      <div 
        class="notebook-wrapper panable-container"
        ref="panableContainer"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        :style="{ transform: `translate(${panX}px, ${panY}px)` }"
      >
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
              :class="{ 'untitled-dish': (dish?.name || editableDishName || 'New Dish') === 'New Dish' }"
            >
              {{ dish?.name || editableDishName || 'New Dish' }}
            </h1>
            <input
              v-else
              v-model="editableDishName"
              class="recipe-name-input"
              @blur="handleDishNameBlur"
            />
            <div class="recipe-header-row">
              <h2 
                v-if="!editMode"
                class="recipe-name"
              >
                {{ currentRecipe?.subname || (isNewRecipe ? editableRecipe.subname || 'New Recipe' : 'No recipes yet') }}
              </h2>
              <input
                v-else
                v-model="editableRecipe.subname"
                class="recipe-name-input"
                placeholder="Recipe name"
              />
              <button
                v-if="!isNewRecipe && currentRecipe && dish && currentRecipe._id !== dish.defaultRecipe"
                @click="setAsDefault(currentRecipe._id)"
                class="set-default-header-btn"
                title="Set as default recipe"
              >
                <img src="/assets/filled_in_star.png" alt="Star" class="star-icon-small" />
                Set as Default
              </button>
              <span
                v-if="!isNewRecipe && currentRecipe && dish && currentRecipe._id === dish.defaultRecipe"
                class="default-badge"
                title="This is the default recipe"
              >
                <img src="/assets/filled_in_star.png" alt="Star" class="star-icon-small" />
                Default
              </span>
              <button
                v-if="!isNewRecipe && currentRecipe"
                @click="showDeleteRecipeDialog = true"
                class="delete-recipe-btn"
                title="Delete this recipe"
              >
                Delete Recipe
              </button>
            </div>
          </div>
          
          <div class="recipe-image-container" :class="{ editable: editMode }">
            <div v-if="editMode" class="edit-indicator">
              <img src="/assets/pencil.png" alt="Edit" class="edit-indicator-icon" />
              <input
                ref="imageUploadRef"
                type="file"
                accept="image/*"
                @change="handleImageUpload"
                style="display: none"
              />
              <button @click="triggerImageUpload" class="upload-image-btn">Upload Image</button>
            </div>
            <img
              v-if="getDisplayImage()"
              :src="getDisplayImage()"
              :alt="dish.name"
              class="recipe-image"
            />
            <div v-else class="no-image">No image</div>
          </div>
          
          <div class="recipe-meta">
            <div class="meta-item" :class="{ editable: editMode }">
              <span class="meta-label">Date Made:</span>
              <span v-if="!editMode" class="meta-value">{{ formatDate(editableRecipe.date || currentRecipe?.date) }}</span>
              <input
                v-else
                v-model="editableRecipe.date"
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
                  :src="i <= (editableRecipe.ranking || currentRecipe?.ranking || 0) ? '/assets/filled_in_star.png' : '/assets/blank_star.png'"
                  alt="star"
                  class="star-icon"
                />
              </div>
              <div v-else class="stars-editor">
                <img
                  v-for="i in 5"
                  :key="i"
                  :src="i <= (editableRecipe.ranking || 0) ? '/assets/filled_in_star.png' : '/assets/blank_star.png'"
                  alt="star"
                  class="star-icon star-clickable"
                  @click="editableRecipe.ranking = i"
                  :title="`${i} star${i > 1 ? 's' : ''}`"
                />
              </div>
            </div>
          </div>
        </div>
        
        <!-- Right Page -->
        <div class="page right-page">
          <!-- Tab Content - Brown background shows through -->
          <div class="tab-content-wrapper">
            <!-- Recipe Tabs - Manila folder style, overlapping, right-aligned -->
            <div class="recipe-tabs-container">
              <div class="recipe-tabs" ref="tabsContainer">
              <!-- Existing recipes - displayed first (left to right) -->
              <div
                v-for="(recipe, index) in sortedRecipes"
                :key="recipe._id || index"
                class="recipe-tab"
                :class="{ 
                  active: currentRecipeIndex === index && !isNewRecipe, 
                  default: dish && recipe._id === dish.defaultRecipe 
                }"
                @click="switchRecipe(index)"
              >
                <span class="tab-label">{{ formatDateShort(recipe.date) || recipe.subname || `Recipe ${index + 1}` }}</span>
                <img v-if="dish && recipe._id === dish.defaultRecipe" src="/assets/filled_in_star.png" alt="Default" class="default-icon" title="Default Recipe" />
              </div>
              
              <!-- New Recipe Tab - Always last (rightmost) -->
              <div
                class="recipe-tab new-tab"
                :class="{ active: isNewRecipe }"
                @click="createNewRecipe"
              >
                <img src="/assets/plus_sign.png" alt="New" class="plus-icon" />
                New
              </div>
              </div>
            </div>
          
          <!-- Tab Content -->
          <div class="tab-content">
            <!-- Always show content, even if no recipes exist -->
            <div class="content-section">
              <div class="section" :class="{ editable: editMode }">
                <div v-if="editMode" class="edit-indicator">
                  <img src="/assets/pencil.png" alt="Edit" class="edit-indicator-icon" />
                </div>
                <h3 class="section-title">Ingredients</h3>
                <textarea
                  v-if="editMode"
                  v-model="editableRecipe.ingredientsList"
                  class="section-input"
                  rows="8"
                  placeholder="Enter ingredients..."
                ></textarea>
                <div 
                  v-else 
                  class="section-content" 
                  :class="{ 'empty-content': !(editableRecipe.ingredientsList || currentRecipe?.ingredientsList) }"
                  v-html="formatMarkdown(editableRecipe.ingredientsList || currentRecipe?.ingredientsList || 'No ingredients listed')"
                ></div>
              </div>
              
              <div class="section" :class="{ editable: editMode }">
                <div v-if="editMode" class="edit-indicator">
                  <img src="/assets/pencil.png" alt="Edit" class="edit-indicator-icon" />
                </div>
                <h3 class="section-title">Instructions</h3>
                <textarea
                  v-if="editMode"
                  v-model="editableRecipe.instructions"
                  class="section-input"
                  rows="10"
                  placeholder="Enter instructions..."
                ></textarea>
                <div 
                  v-else 
                  class="section-content" 
                  :class="{ 'empty-content': !(editableRecipe.instructions || currentRecipe?.instructions) }"
                  v-html="formatMarkdown(editableRecipe.instructions || currentRecipe?.instructions || 'No instructions listed')"
                ></div>
              </div>
              
              <div class="section" :class="{ editable: editMode }">
                <div v-if="editMode" class="edit-indicator">
                  <img src="/assets/pencil.png" alt="Edit" class="edit-indicator-icon" />
                </div>
                <h3 class="section-title">Notes</h3>
                <textarea
                  v-if="editMode"
                  v-model="editableRecipe.note"
                  class="section-input"
                  rows="6"
                  placeholder="Enter notes..."
                ></textarea>
                <div 
                  v-else 
                  class="section-content" 
                  :class="{ 'empty-content': !(editableRecipe.note || currentRecipe?.note) }"
                  v-html="formatMarkdown(editableRecipe.note || currentRecipe?.note || 'No notes')"
                ></div>
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
            <img src="/assets/table_of_contents_bookmark_horizontal.png" alt="Table of Contents" class="bookmark-bg" />
            <img src="/assets/home_navbar.png" alt="Home" class="bookmark-overlay bookmark-home-overlay" />
            <img src="/assets/bookmark_on_hover_horizontal.png" alt="Table of Contents" class="bookmark-bg-hover" />
            <img src="/assets/home_navbar.png" alt="Home" class="bookmark-overlay-hover bookmark-home-overlay" />
          </div>
          <div
            class="bookmark bookmark-rankings"
            @click="goToRankings"
            title="Go to Rankings"
          >
            <img src="/assets/ranking_bookmark_horizontal.png" alt="Rankings" class="bookmark-bg" />
            <img src="/assets/filled_in_star.png" alt="Star" class="bookmark-overlay bookmark-star-overlay" />
            <img src="/assets/bookmark_on_hover_horizontal.png" alt="Rankings" class="bookmark-bg-hover" />
            <img src="/assets/filled_in_star.png" alt="Star" class="bookmark-overlay-hover bookmark-star-overlay" />
          </div>
        </div>
        </div>
      </div>
    </div>
    </div>
    
    <!-- Confirmation Dialogs -->
    <ConfirmDialog
      v-model:show="showDeleteRecipeDialog"
      title="Delete Recipe"
      message="Are you sure you want to delete this recipe? This action cannot be undone."
      confirm-text="Delete"
      cancel-text="Cancel"
      :danger="true"
      @confirm="handleDeleteRecipe"
    />
    
    <ConfirmDialog
      v-model:show="showDeleteDishDialog"
      title="Delete Dish"
      message="Are you sure you want to delete this dish? This will delete all recipes associated with this dish. This action cannot be undone."
      confirm-text="Delete"
      cancel-text="Cancel"
      :danger="true"
      @confirm="handleDeleteDish"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecipesStore } from '../stores/recipes'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useAuthStore } from '../stores/auth'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { dishesAPI, recipeAPI } from '../api/api'

const route = useRoute()
const router = useRouter()
const recipesStore = useRecipesStore()
const recipeBooksStore = useRecipeBooksStore()
const authStore = useAuthStore()

// Helper function to get local date string (YYYY-MM-DD) instead of UTC
function getLocalDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const currentBookId = ref(null)
const currentBookName = ref('Recipe Book')

const dish = ref(null)
const dishIdFromRoute = ref(null)
const loading = ref(false)
const error = ref('')
const editMode = ref(false)
const saving = ref(false)
const currentRecipeIndex = ref(0)
const isNewRecipe = ref(true) // Start with new recipe if no recipes exist
const editableDishName = ref('New Dish')
const editableRecipe = ref({
  ingredientsList: '',
  instructions: '',
  note: '',
  date: getLocalDateString(),
  ranking: 1,
  subname: '',
  pictures: []
})
const tabsContainer = ref(null)
const recipesBackup = ref([])
const imageUploadRef = ref(null)
const showDeleteRecipeDialog = ref(false)
const showDeleteDishDialog = ref(false)
const panableContainer = ref(null)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const startX = ref(0)
const startY = ref(0)
const initialPanX = ref(0)
const initialPanY = ref(0)

// Sort recipes by date, newest first (for display: New button, then newest on left, then older on right)
const sortedRecipes = computed(() => {
  return [...recipesStore.recipes].sort((a, b) => {
    // Parse dates as local dates to avoid timezone issues
    const parseLocalDate = (dateString) => {
      if (!dateString) return new Date(0) // Recipes without dates go to the end (rightmost)
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateString.split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      return new Date(dateString)
    }
    const dateA = parseLocalDate(a.date)
    const dateB = parseLocalDate(b.date)
    // Sort: newest first (on left), oldest last (on right)
    // JavaScript sort: return < 0 means a comes before b, return > 0 means b comes before a
    // If newest recipes are appearing on the RIGHT, we need to reverse the sort
    // Current logic dateB - dateA should put newest first, but it's putting them last
    // Reverse: dateA - dateB will put the newer date first
    // If dateA is newer: positive → a before b → newest on left ✓
    // If dateB is newer: negative → a before b → but a is older, so oldest on left ✗
    // Actually that doesn't work either. Let me think...
    // If dateB - dateA puts newest on RIGHT, then we want the opposite
    // The opposite of dateB - dateA is dateA - dateB
    // But dateA - dateB: if dateA newer → positive → a before b → newest on left? 
    // No wait: if dateA is newer and a comes before b, then newest is on left ✓
    // So let's try dateA - dateB
    const timeDiff = dateA.getTime() - dateB.getTime()
    // If dates are equal, maintain original order (stable sort)
    if (timeDiff === 0) {
      return 0
    }
    // Reverse the sort to put newest on left
    return timeDiff
  })
})

// Format date as mm/dd/yy
// Parses date string as local date to avoid timezone issues
function formatDateShort(dateString) {
  if (!dateString) return ''
  // Parse date string as local date (YYYY-MM-DD format)
  let date
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse as local date to avoid UTC timezone issues
    const [year, month, day] = dateString.split('-').map(Number)
    date = new Date(year, month - 1, day)
  } else {
    date = new Date(dateString)
  }
  if (isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

const currentRecipe = computed(() => {
  if (isNewRecipe.value || currentRecipeIndex.value === -1) return null
  return sortedRecipes.value[currentRecipeIndex.value] || null
})

async function loadDish() {
  const dishId = route.params.id
  dishIdFromRoute.value = dishId
  
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
  } else {
    // If we don't have a book ID yet, try to find it after loading the recipe
    // This will be done after the recipe is loaded (see below)
  }
  
  // Check if this is a temporary ID (starts with "temp-")
  const isTempId = dishId && dishId.startsWith('temp-')
  
  // Clear recipes for new dishes to ensure blank slate
  if (isTempId) {
    recipesStore.recipes = []
    recipesBackup.value = []
    // Open new dishes in edit mode
    editMode.value = true
  }
  
  // Show empty state immediately
  if (!dish.value) {
    dish.value = {
      _id: dishId,
      name: 'New Dish',
      description: '',
      recipes: [],
      defaultRecipe: null
    }
    editableDishName.value = 'New Dish'
    isNewRecipe.value = true
    currentRecipeIndex.value = -1
    loadRecipeData(null)
  }
  
  loading.value = true
  error.value = ''
  
  try {
    if (!isTempId) {
      try {
        await recipesStore.fetchDish(dishId)
        const fetchedDish = recipesStore.currentDish
        if (fetchedDish) {
          // Create a separate copy to avoid reactivity issues
          dish.value = { ...fetchedDish }
          editableDishName.value = fetchedDish.name
          
          // If we don't have a book ID yet, try to find which book contains this dish
          if (!currentBookId.value) {
            try {
              await recipeBooksStore.fetchBooks()
              const bookWithDish = recipeBooksStore.books.find(book => 
                book.dishes && book.dishes.includes(fetchedDish._id)
              )
              if (bookWithDish) {
                currentBookId.value = bookWithDish._id
                currentBookName.value = bookWithDish.name
              }
            } catch (bookErr) {
              console.warn('Failed to find book for dish:', bookErr)
            }
          }
        }
      } catch (fetchErr) {
        // If fetch fails, dish might not exist yet - keep empty state
        console.warn('Failed to fetch dish:', fetchErr)
      }
    }
    
      // Load recipes if dish exists and has recipes (but not for temp IDs)
      if (!isTempId && dish.value && dish.value.recipes && dish.value.recipes.length > 0) {
        await recipesStore.fetchRecipes(dish.value._id)
        // Update backup after loading
        if (recipesStore.recipes.length > 0) {
          recipesBackup.value = [...recipesStore.recipes]
        }
      } else {
        // Clear recipes for new dishes (temp IDs) or dishes with no recipes
        recipesStore.recipes = []
        recipesBackup.value = []
      }
      
      if (dish.value && sortedRecipes.value.length > 0) {
        // Check if there's a recipe query parameter
        const recipeId = route.query.recipe
        if (recipeId) {
          const index = sortedRecipes.value.findIndex(r => r._id === recipeId)
          if (index !== -1) {
            currentRecipeIndex.value = index
            isNewRecipe.value = false
            loadRecipeData(sortedRecipes.value[index])
          }
        } else if (dish.value?.defaultRecipe) {
          const defaultIndex = sortedRecipes.value.findIndex(r => r._id === dish.value.defaultRecipe)
          if (defaultIndex !== -1) {
            currentRecipeIndex.value = defaultIndex
            isNewRecipe.value = false
            loadRecipeData(sortedRecipes.value[defaultIndex])
          }
        } else {
          // Load most recent recipe (index 0 - newest, after new button)
          currentRecipeIndex.value = 0
          isNewRecipe.value = false
          loadRecipeData(sortedRecipes.value[0])
        }
      } else if (dish.value && !isTempId) {
        // Dish exists but no recipes - show empty new recipe
        isNewRecipe.value = true
        currentRecipeIndex.value = -1
        loadRecipeData(null)
      } else {
      // Dish doesn't exist yet - create it
      // Open in edit mode for new dishes
      editMode.value = true
      try {
        // Try to create dish with a timeout
        const createPromise = recipesStore.createDish('New Dish', '')
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Creation timeout')), 5000)
        )
        
        try {
          const createdId = await Promise.race([createPromise, timeoutPromise])
          if (createdId) {
            dish.value._id = createdId
            // Check if there's a pending book to add it to
            const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
            if (bookId) {
              try {
                // Check if already in book
                const book = await recipeBooksStore.fetchBook(bookId)
                const isAlreadyInBook = book?.dishes?.includes(createdId)
                
                if (!isAlreadyInBook) {
                  await recipeBooksStore.addDishToBook(createdId, bookId)
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
                console.warn('Failed to add dish to book:', bookErr)
              }
            }
            
            // Update URL with real dish ID if it's a temp ID
            if (isTempId && currentBookId.value) {
              router.replace(`/recipe/${createdId}?book=${currentBookId.value}`)
            } else if (isTempId) {
              router.replace(`/recipe/${createdId}`)
            }
          }
        } catch (createErr) {
          console.warn('Dish creation timed out or failed:', createErr)
          // Keep showing empty state - user can save manually
        }
      } catch (createErr) {
        console.warn('Failed to create dish:', createErr)
      }
      
      // If creation failed, show empty state with placeholder
      dish.value = {
        _id: dishId,
        name: 'New Dish',
        description: '',
        recipes: [],
        defaultRecipe: null
      }
      editableDishName.value = 'New Dish'
      isNewRecipe.value = true
      currentRecipeIndex.value = -1
      loadRecipeData(null)
    }
  } catch (err) {
    error.value = err.message || 'Failed to load dish'
    // Even on error, show the dish page with empty state
    if (!dish.value) {
      dish.value = {
        _id: dishId,
        name: 'New Dish',
        description: '',
        recipes: [],
        defaultRecipe: null
      }
      editableDishName.value = 'New Dish'
      isNewRecipe.value = true
      currentSnapshotIndex.value = -1
      loadSnapshotData(null)
    }
  } finally {
    loading.value = false
  }
}

function loadRecipeData(recipe) {
  if (!recipe) {
    editableRecipe.value = {
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
  
  editableRecipe.value = {
    ingredientsList: recipe.ingredientsList || '',
    instructions: recipe.instructions || '',
    note: recipe.note || '',
    date: recipe.date ? recipe.date.split('T')[0] : getLocalDateString(),
    ranking: recipe.ranking || 1,
    subname: recipe.subname || '',
    pictures: recipe.pictures || []
  }
}

function switchRecipe(index) {
  // Index in sortedRecipes (most recent first, index 0 = newest)
  currentRecipeIndex.value = index
  isNewRecipe.value = false
  loadRecipeData(sortedRecipes.value[index])
  scrollToTab(index) // Scroll to this tab (newest is index 0, on left)
}

function createNewRecipe() {
  isNewRecipe.value = true
  // New recipe is always first (leftmost)
  currentRecipeIndex.value = -1 // Use -1 to indicate new recipe
  editableRecipe.value = {
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

function triggerImageUpload() {
  imageUploadRef.value?.click()
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  
  const recipeId = currentRecipe.value?._id
  
  // If we have a recipe ID, upload immediately
  if (recipeId) {
    try {
      saving.value = true
      const result = await recipesStore.uploadRecipeImage(recipeId, file)
      if (result?.image?.secureUrl) {
        // Add the uploaded image URL to the pictures array
        if (!editableRecipe.value.pictures) {
          editableRecipe.value.pictures = []
        }
        editableRecipe.value.pictures.push(result.image.secureUrl)
        // Update the current recipe if it exists
        if (currentRecipe.value) {
          currentRecipe.value.pictures = [...editableRecipe.value.pictures]
        }
      }
    } catch (err) {
      error.value = 'Failed to upload image: ' + err.message
    } finally {
      saving.value = false
      // Reset the file input
      if (imageUploadRef.value) {
        imageUploadRef.value.value = ''
      }
    }
  } else {
    // No recipe ID yet - store the file temporarily and create a preview
    // The image will be uploaded when the user saves the recipe
    try {
      // Create a preview URL for the image
      const previewUrl = URL.createObjectURL(file)
      
      // Store the file and preview in a temporary structure
      if (!editableRecipe.value.pictures) {
        editableRecipe.value.pictures = []
      }
      
      // Store as an object with the file and preview URL
      // We'll use a special format: { file: File, preview: string, isPending: true }
      editableRecipe.value.pictures.push({
        file: file,
        preview: previewUrl,
        isPending: true
      })
    } catch (err) {
      error.value = 'Failed to process image: ' + err.message
    } finally {
      // Reset the file input
      if (imageUploadRef.value) {
        imageUploadRef.value.value = ''
      }
    }
  }
}

function scrollToTab(index) {
  nextTick(() => {
    if (tabsContainer.value) {
      const tabs = tabsContainer.value.querySelectorAll('.recipe-tab')
      // Tabs order: [recipe 0, recipe 1, ..., recipe N, new tab (last)]
      // Index -1 means new tab (last tab)
      const targetIndex = index === -1 ? tabs.length - 1 : index
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
      // Save dish name first (this creates dish if needed)
      try {
        await updateDishName()
      } catch (err) {
        const isTimeout = err.message?.includes('timed out') || err.message?.includes('Request timed out')
        if (isTimeout) {
          saveErrors.push('Dish name save timed out. Your changes are saved locally. You can try saving again later.')
          console.warn('Dish name save timed out, continuing with recipe save...')
          // Continue - allow recipe to save even if dish name timed out
        } else {
          throw err // Re-throw non-timeout errors
        }
      }
      
      // Then save recipe (needs dish ID)
      try {
        await saveRecipe()
      } catch (err) {
        const isTimeout = err.message?.includes('timed out') || err.message?.includes('Request timed out')
        if (isTimeout) {
          saveErrors.push('Recipe save timed out. Your changes are saved locally. You can try saving again later.')
          console.warn('Recipe save timed out')
        } else {
          throw err // Re-throw non-timeout errors
        }
      }
      
      // Add dish to book on first save (if book ID is available) - non-blocking
      const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
      const dishId = dish.value?._id
      if (bookId && dishId && !dishId.startsWith('temp-')) {
        try {
          // Check if dish is already in the book
          const book = await recipeBooksStore.fetchBook(bookId)
          const isAlreadyInBook = book?.dishes?.includes(dishId)
          
          if (!isAlreadyInBook) {
            // First time saving - add to book
            await recipeBooksStore.addDishToBook(dishId, bookId)
            console.log('Dish added to book successfully on first save')
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
            console.warn('Failed to add dish to book:', bookErr)
            saveErrors.push('Dish saved but failed to add to book. You can add it manually from the book view.')
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

// Helper function to get display image (handles both URLs and pending files)
function getDisplayImage() {
  if (isNewRecipe.value) {
    // For new recipes, check editableRecipe for pending images
    if (editableRecipe.value.pictures && editableRecipe.value.pictures.length > 0) {
      const firstPic = editableRecipe.value.pictures[0]
      if (typeof firstPic === 'string') {
        return firstPic
      } else if (firstPic && firstPic.preview) {
        return firstPic.preview
      }
    }
    return null
  } else if (currentRecipe.value && currentRecipe.value.pictures && currentRecipe.value.pictures.length > 0) {
    return currentRecipe.value.pictures[0]
  }
  return null
}

async function saveRecipe() {
  if (!dishIdFromRoute.value) return
  
  // Ensure dish exists first
  if (!dish.value?._id || dish.value._id.startsWith('temp-')) {
    // Dish doesn't exist yet - create it first
    await updateDishName()
  }
  
  const dishId = dish.value?._id || dishIdFromRoute.value
  if (!dishId || dishId.startsWith('temp-')) {
    console.warn('Cannot save recipe - dish not created yet')
    return
  }
  
  try {
    if (isNewRecipe.value) {
      // Only create if there's actual content
      const hasContent = editableRecipe.value.ingredientsList.trim() || 
                        editableRecipe.value.instructions.trim() || 
                        editableRecipe.value.note.trim() ||
                        editableRecipe.value.subname.trim()
      
      if (hasContent) {
        // Check if this will be the first recipe before creating
        const wasFirstRecipe = sortedRecipes.value.length === 0
        
        // Separate pending images from regular URLs
        const pendingImages = []
        const regularPictures = []
        
        if (editableRecipe.value.pictures) {
          editableRecipe.value.pictures.forEach(pic => {
            if (typeof pic === 'string') {
              regularPictures.push(pic)
            } else if (pic && pic.isPending && pic.file) {
              pendingImages.push(pic)
            } else if (pic && pic.preview) {
              // If it's a pending image object, keep it for now
              pendingImages.push(pic)
            }
          })
        }
        
        // Create new recipe with only regular pictures (no pending uploads)
        const recipeId = await recipesStore.createRecipe({
          ...editableRecipe.value,
          pictures: regularPictures,
          dish: dishId
        })
        
        // Upload any pending images after recipe is created
        if (recipeId && pendingImages.length > 0) {
          for (const pendingImage of pendingImages) {
            if (pendingImage.file) {
              try {
                const result = await recipesStore.uploadRecipeImage(recipeId, pendingImage.file)
                if (result?.image?.secureUrl) {
                  regularPictures.push(result.image.secureUrl)
                  // Clean up the preview URL
                  if (pendingImage.preview) {
                    URL.revokeObjectURL(pendingImage.preview)
                  }
                }
              } catch (err) {
                console.error('Failed to upload pending image:', err)
                // Continue with other images
              }
            }
          }
          
          // Update the recipe with all uploaded images
          if (regularPictures.length > 0) {
            await recipesStore.updateRecipe(recipeId, {
              ...editableRecipe.value,
              pictures: regularPictures,
              dish: dishId
            })
          }
        }
        
        // Reload recipes to get the newly created one
        await recipesStore.fetchRecipes(dishId)
        
        // Update backup after fetching
        if (recipesStore.recipes.length > 0) {
          recipesBackup.value = [...recipesStore.recipes]
        }
        
        // If this was the first recipe, set it as default
        if (wasFirstRecipe && recipeId) {
          await recipesStore.setDefaultRecipe(recipeId, dishId)
        }
        
        // After creating, switch to the newly created recipe (it will be index 0 - newest)
        // Then prepare a new empty recipe tab
        if (recipesStore.recipes.length > 0) {
          // Switch to the newly created recipe (newest, index 0)
          currentRecipeIndex.value = 0
          isNewRecipe.value = false
          loadRecipeData(recipesStore.recipes[0])
        } else {
          // If no recipes loaded, stay in new recipe mode
          isNewRecipe.value = true
          currentRecipeIndex.value = -1
          editableRecipe.value = {
            ingredientsList: '',
            instructions: '',
            note: '',
            date: getLocalDateString(),
            ranking: 1,
            subname: '',
            pictures: []
          }
        }
      }
    } else if (currentRecipe.value) {
      // For existing recipes, handle pending images
      const pendingImages = []
      const regularPictures = []
      
      if (editableRecipe.value.pictures) {
        editableRecipe.value.pictures.forEach(pic => {
          if (typeof pic === 'string') {
            regularPictures.push(pic)
          } else if (pic && pic.isPending && pic.file) {
            pendingImages.push(pic)
          }
        })
      }
      
      // Upload pending images first
      if (pendingImages.length > 0) {
        for (const pendingImage of pendingImages) {
          if (pendingImage.file) {
            try {
              const result = await recipesStore.uploadRecipeImage(currentRecipe.value._id, pendingImage.file)
              if (result?.image?.secureUrl) {
                regularPictures.push(result.image.secureUrl)
                // Clean up the preview URL
                if (pendingImage.preview) {
                  URL.revokeObjectURL(pendingImage.preview)
                }
              }
            } catch (err) {
              console.error('Failed to upload pending image:', err)
              // Continue with other images
            }
          }
        }
      }
      
      // Update existing recipe with all pictures
      await recipesStore.updateRecipe(currentRecipe.value._id, {
        ...editableRecipe.value,
        pictures: regularPictures,
        dish: dishId
      })
      await recipesStore.fetchRecipes(dishId)
      // Reload the current recipe data to reflect the updated ranking
      const updatedRecipe = recipesStore.recipes.find(r => r._id === currentRecipe.value._id)
      if (updatedRecipe) {
        loadRecipeData(updatedRecipe)
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to save recipe'
    console.error('Save error:', err)
    throw err // Re-throw so toggleEditMode knows it failed
  }
}

async function handleDishNameBlur() {
  // Just update the local value, actual save happens on toggleEditMode
  // This prevents multiple API calls while typing
}

async function updateDishName() {
  if (!dishIdFromRoute.value) return
  
  const dishId = dish.value?._id || dishIdFromRoute.value
  const newName = editableDishName.value.trim()
  
  if (!newName) {
    editableDishName.value = dish.value?.name || 'New Dish'
    return
  }
  
  // Don't update if name hasn't changed
  if (dish.value?.name === newName && dish.value?._id && !dish.value._id.startsWith('temp-')) {
    return
  }
  
  try {
    // If dish doesn't exist yet or has temp ID, create it
    const isTempId = dishId.startsWith('temp-')
    if (!dish.value?._id || isTempId) {
      const createdId = await recipesStore.createDish(newName, dish.value?.description || '')
      if (createdId) {
        dish.value = {
          _id: createdId,
          name: newName,
          description: dish.value?.description || '',
          recipes: [],
          defaultRecipe: null
        }
        
        // Update route if it was a temp ID
        if (isTempId && createdId) {
          const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
          const newUrl = bookId ? `/recipe/${createdId}?book=${bookId}` : `/recipe/${createdId}`
          router.replace(newUrl)
          dishIdFromRoute.value = createdId
        }
        
        // Try to add to book
        const bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
        if (bookId) {
          try {
            // Check if already in book
            const book = await recipeBooksStore.fetchBook(bookId)
            const isAlreadyInBook = book?.dishes?.includes(createdId)
            
            if (!isAlreadyInBook) {
              await recipeBooksStore.addDishToBook(createdId, bookId)
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
            console.warn('Failed to add dish to book:', bookErr)
          }
        }
        
        // Update URL if it was a temp ID
        if (isTempId && currentBookId.value) {
          router.replace(`/recipe/${createdId}?book=${currentBookId.value}`)
        } else if (isTempId) {
          router.replace(`/recipe/${createdId}`)
        }
      }
    } else if (newName !== dish.value.name) {
      await recipesStore.updateDish(dish.value._id, newName, dish.value.description || '')
      if (dish.value) {
        dish.value.name = newName
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to update dish name'
    editableDishName.value = dish.value?.name || 'New Dish'
    throw err
  }
}

async function setAsDefault(recipeId) {
  if (!dish.value) return
  
  // Save current state - create immutable backup
  const recipesBefore = [...recipesStore.recipes]
  const currentRecipeIndexBefore = currentRecipeIndex.value
  const currentRecipeIdBefore = currentRecipe.value?._id
  
  // Update backup ref so watcher can restore if needed
  recipesBackup.value = [...recipesBefore]
  
  try {
    // Make the API call directly - don't use store method to avoid side effects
    const { dishesAPI } = await import('../api/api')
    await dishesAPI.setDefaultRecipe(recipeId, dish.value._id)
    
    // Update the local dish ref
    if (dish.value) {
      dish.value.defaultRecipe = recipeId
    }
    
    // IMPORTANT: Also update store's currentDish so calendar and other views see the change
    // This ensures that if the calendar has this dish loaded, it will see the updated default
    if (recipesStore.currentDish && recipesStore.currentDish._id === dish.value._id) {
      recipesStore.currentDish.defaultRecipe = recipeId
      // Force reactivity update
      recipesStore.currentDish = { ...recipesStore.currentDish }
    }
    
    // Check and restore recipes immediately
    if (recipesStore.recipes.length === 0 && recipesBefore.length > 0) {
      console.error('Recipes were cleared! Restoring immediately.')
      recipesStore.recipes = [...recipesBefore]
    }
    
    // Wait for any reactivity updates
    await nextTick()
    
    // Check again after nextTick - restore if still cleared
    if (recipesStore.recipes.length === 0 && recipesBefore.length > 0) {
      console.error('Recipes still cleared after nextTick! Restoring again.')
      recipesStore.recipes = [...recipesBefore]
    }
    
    // Ensure we stay on the same recipe
    if (!isNewRecipe.value && currentRecipeIdBefore) {
      const restoredIndex = sortedRecipes.value.findIndex(r => r._id === currentRecipeIdBefore)
      if (restoredIndex !== -1) {
        currentRecipeIndex.value = restoredIndex
        isNewRecipe.value = false
      }
    }
    
  } catch (err) {
    console.error('Error setting default recipe:', err)
    error.value = err.message || 'Failed to set default recipe'
    
    // Always restore recipes on error
    if (recipesStore.recipes.length === 0 && recipesBefore.length > 0) {
      recipesStore.recipes = [...recipesBefore]
    }
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Not set'
  // Parse date string as local date to avoid timezone issues
  let date
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse as local date to avoid UTC timezone issues
    const [year, month, day] = dateString.split('-').map(Number)
    date = new Date(year, month - 1, day)
  } else {
    date = new Date(dateString)
  }
  if (isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatMarkdown(text) {
  if (!text) return ''
  
  // Split text into lines for better processing
  const lines = text.split('\n')
  const result = []
  let inList = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Check if this is a bullet point
    const bulletMatch = line.match(/^[-*+]\s+(.+)$/)
    
    if (bulletMatch) {
      // Start a list if we're not in one
      if (!inList) {
        result.push('<ul>')
        inList = true
      }
      // Add the list item
      result.push(`<li>${bulletMatch[1]}</li>`)
    } else {
      // Close list if we were in one
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      
      // Handle non-list content
      if (line) {
        let processedLine = line
          // Bold
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          // Italic (but not if it's part of bold)
          .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
          // Code
          .replace(/`(.*?)`/g, '<code>$1</code>')
        result.push(processedLine + '<br>')
      } else if (i < lines.length - 1) {
        // Empty line (but not the last line)
        result.push('<br>')
      }
    }
  }
  
  // Close list if still open
  if (inList) {
    result.push('</ul>')
  }
  
  return result.join('')
}

function getActiveTabColor() {
  if (isNewRecipe.value) {
    return 'rgba(167, 123, 91, 0.3)' // var(--color-medium-brown) with opacity
  }
  return 'rgba(217, 154, 108, 0.3)' // var(--color-light-brown) with opacity
}

async function goToTableOfContents() {
  let bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
  
  // If we don't have a book ID, try to find which book contains this dish
  if (!bookId && dish.value?._id) {
    try {
      // Fetch all books and find which one contains this dish
      await recipeBooksStore.fetchBooks()
      const bookWithDish = recipeBooksStore.books.find(book => 
        book.dishes && book.dishes.includes(dish.value._id)
      )
      if (bookWithDish) {
        bookId = bookWithDish._id
        // Cache it for future use
        currentBookId.value = bookId
      }
    } catch (err) {
      console.warn('Failed to find book for dish:', err)
    }
  }
  
  if (bookId) {
    // Force reload by adding timestamp to ensure fresh data
    router.push(`/book/${bookId}?refresh=${Date.now()}`)
  } else {
    // Navigate to home if no book ID found
    router.push('/')
  }
}

async function goToRankings() {
  let bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
  
  // If we don't have a book ID, try to find which book contains this dish
  if (!bookId && dish.value?._id) {
    try {
      // Fetch all books and find which one contains this dish
      await recipeBooksStore.fetchBooks()
      const bookWithDish = recipeBooksStore.books.find(book => 
        book.dishes && book.dishes.includes(dish.value._id)
      )
      if (bookWithDish) {
        bookId = bookWithDish._id
        // Cache it for future use
        currentBookId.value = bookId
      }
    } catch (err) {
      console.warn('Failed to find book for dish:', err)
    }
  }
  
  if (bookId) {
    // Force reload by adding timestamp to ensure fresh data
    router.push(`/book/${bookId}?view=rankings&refresh=${Date.now()}`)
  } else {
    // Navigate to home if no book ID found
    router.push('/')
  }
}

async function handleDeleteRecipe() {
  if (!currentRecipe.value || !currentRecipe.value._id) return
  
  const recipeIdToDelete = currentRecipe.value._id
  const dishId = dish.value?._id
  
  try {
    saving.value = true
    error.value = ''
    
    // Clear backup first to prevent watcher from restoring deleted recipe
    const wasLastRecipe = recipesStore.recipes.length === 1
    if (wasLastRecipe) {
      recipesBackup.value = []
    }
    
    // Call the delete API and wait for response
    const response = await recipeAPI.deleteRecipe(recipeIdToDelete)
    
    // Check if deletion was successful
    if (response.data?.error) {
      error.value = response.data.error
      return
    }
    
    // Small delay to ensure backend syncs complete
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Reload recipes and dish to ensure UI is up to date
    if (dishId) {
      // Fetch recipes first to get the updated list
      await recipesStore.fetchRecipes(dishId)
      
      // Refresh the dish object to get updated recipes array
      await recipesStore.fetchDish(dishId)
      // Update local dish reference
      if (recipesStore.currentDish) {
        dish.value = { ...recipesStore.currentDish }
      }
      
      // Update backup after fetching (this will be empty if no recipes remain)
      if (recipesStore.recipes && recipesStore.recipes.length > 0) {
        recipesBackup.value = [...recipesStore.recipes]
      } else {
        recipesBackup.value = []
      }
      
      // Switch to another recipe or show new recipe
      if (recipesStore.recipes && recipesStore.recipes.length > 0) {
        // Switch to the first recipe (newest)
        currentRecipeIndex.value = 0
        isNewRecipe.value = false
        loadRecipeData(recipesStore.recipes[0])
      } else {
        // No recipes left - show new recipe form
        isNewRecipe.value = true
        currentRecipeIndex.value = -1
        loadRecipeData(null)
        // Clear editable recipe
        editableRecipe.value = {
          ingredientsList: '',
          instructions: '',
          note: '',
          date: getLocalDateString(),
          ranking: 1,
          subname: '',
          pictures: []
        }
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to delete recipe'
    console.error('Error deleting recipe:', err)
  } finally {
    saving.value = false
  }
}

async function handleDeleteDish() {
  if (!dish.value || !dish.value._id || dish.value._id.startsWith('temp-')) return
  
  try {
    saving.value = true
    error.value = ''
    
    await dishesAPI.deleteDish(dish.value._id)
    
    // Navigate back to the book or home
    let bookId = currentBookId.value || sessionStorage.getItem('pendingRecipeBook')
    
    if (bookId) {
      router.push(`/book/${bookId}`)
    } else {
      router.push('/')
    }
  } catch (err) {
    error.value = err.message || 'Failed to delete dish'
    console.error('Error deleting dish:', err)
  } finally {
    saving.value = false
  }
}

// Watch snapshots to restore if cleared and update backup
watch(() => recipesStore.recipes, (newRecipes, oldRecipes) => {
  // CRITICAL: If recipes were cleared unexpectedly, restore from backup immediately
  if (oldRecipes && oldRecipes.length > 0 && newRecipes.length === 0 && recipesBackup.value.length > 0) {
    console.error('Recipes were cleared unexpectedly - restoring from backup IMMEDIATELY', {
      oldCount: oldRecipes.length,
      newCount: newRecipes.length,
      backupCount: recipesBackup.value.length
    })
    // Use nextTick to ensure this runs after any clearing operation
    nextTick(() => {
      if (recipesStore.recipes.length === 0 && recipesBackup.value.length > 0) {
        recipesStore.recipes = [...recipesBackup.value]
      }
    })
    return
  }
  
  // Update backup when recipes change (but aren't being cleared)
  if (newRecipes.length > 0) {
    recipesBackup.value = [...newRecipes]
  }
  
  if (sortedRecipes.value.length > 0 && !isNewRecipe.value && currentRecipeIndex.value >= 0) {
    loadRecipeData(sortedRecipes.value[currentRecipeIndex.value])
  }
}, { deep: true, immediate: true })

// Watch for route changes to reload dish
watch(() => route.params.id, () => {
  loadDish()
})

onMounted(() => {
  loadDish()
})

// Touch panning handlers for mobile
function handleTouchStart(e) {
  if (e.touches.length === 1) {
    isPanning.value = true
    startX.value = e.touches[0].clientX
    startY.value = e.touches[0].clientY
    initialPanX.value = panX.value
    initialPanY.value = panY.value
  }
}

function handleTouchMove(e) {
  if (!isPanning.value || e.touches.length !== 1) return
  
  e.preventDefault()
  const deltaX = e.touches[0].clientX - startX.value
  const deltaY = e.touches[0].clientY - startY.value
  
  panX.value = initialPanX.value + deltaX
  panY.value = initialPanY.value + deltaY
}

function handleTouchEnd(e) {
  isPanning.value = false
}
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

.book-header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
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
  overflow: visible;
}

.notebook {
  position: relative;
  /* Warm dark burgundy red grainy inside cover behind pages */
  background-color: #8B3A3A;
  background-image: 
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.1) 0px,
      transparent 1px,
      transparent 2px,
      rgba(0, 0, 0, 0.1) 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.08) 0px,
      transparent 1px,
      transparent 2px,
      rgba(0, 0, 0, 0.08) 3px
    );
  background-size: 100% 4px, 4px 100%;
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
  width: 18px;
  height: 18px;
  margin-right: 0.25rem;
  object-fit: contain;
}

.pages-container {
  display: flex;
  gap: 0;
  min-height: 700px;
  position: relative;
  overflow: visible;
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
  /* Page background color */
  background-color: #FFF8DC;
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

/* Dish name (h1) styling */
.recipe-header .recipe-name {
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-dark-brown);
  margin-bottom: 0;
  border-bottom: none;
  padding-bottom: 0;
  font-family: 'Caveat', cursive;
}

.recipe-header .recipe-name.untitled-dish {
  font-style: italic;
  font-weight: 600;
}

.recipe-header-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  border-top: 2px solid var(--color-light-brown);
  padding-top: 0.5rem;
  margin-top: 0.5rem;
}

/* Recipe subname (h2) styling */
.recipe-header-row .recipe-name {
  font-size: 1.2rem;
  color: var(--color-medium-brown);
  font-weight: 500;
  font-style: normal;
  margin: 0;
  font-family: 'Caveat', cursive;
}

.set-default-header-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-light-brown);
  color: var(--color-dark-brown);
  border: 2px solid var(--color-medium-brown);
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
}

.set-default-header-btn:hover {
  background-color: var(--color-gold);
  border-color: var(--color-dark-brown);
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.default-badge {
  padding: 0.5rem 1rem;
  background-color: var(--color-gold);
  color: var(--color-dark-brown);
  border: 2px solid var(--color-medium-brown);
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.delete-recipe-btn,
.delete-dish-btn {
  padding: 0.5rem 1rem;
  background-color: #d32f2f;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-recipe-btn:hover,
.delete-dish-btn:hover {
  background-color: #b71c1c;
}

.recipe-name-input {
  font-size: 2rem;
  color: var(--color-dark-brown);
  margin-bottom: 0;
  padding-bottom: 0;
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: none;
  font-family: 'Caveat', cursive;
  font-weight: 500;
}

.recipe-name-input:focus {
  outline: none;
}

.recipe-header-row .recipe-name-input {
  font-size: 1.2rem;
  color: var(--color-medium-brown);
  font-weight: 500;
  font-style: normal;
  width: 100%;
  padding: 0.25rem;
  border: 2px solid var(--color-medium-brown);
  border-radius: 4px;
  background-color: white;
  font-family: 'Caveat', cursive;
  margin-top: 0.5rem;
}

.recipe-name-input:focus {
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
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.5rem;
}

.edit-indicator-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.upload-image-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-medium-brown);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.upload-image-btn:hover {
  background-color: var(--color-dark-brown);
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
  font-family: 'Caveat', cursive;
  font-size: 1.1rem;
}

.meta-value {
  color: var(--color-medium-brown);
  font-family: 'Caveat', cursive;
  font-size: 1.1rem;
  font-weight: 400;
}

.meta-input,
.rating-select {
  padding: 0.5rem;
  border: 2px solid var(--color-medium-brown);
  border-radius: 4px;
  background-color: white;
  font-size: 0.9rem;
  font-family: 'Caveat', cursive;
  font-weight: 500;
}

.meta-item {
  position: relative;
}

.meta-item.editable::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background-image: url('/assets/pencil.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.7;
}

.stars-display {
  display: flex;
  gap: 0.25rem;
}

.stars-editor {
  display: flex;
  gap: 0.25rem;
}

.star-icon {
  width: 24px;
  height: 24px;
}

.star-icon.empty {
  opacity: 0.3;
}

.star-icon.star-clickable {
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.star-icon.star-clickable:hover {
  transform: scale(1.2);
  opacity: 0.8;
}

.tab-content-wrapper {
  border-radius: 12px;
  padding-top: 0;
  position: relative;
  min-height: 400px;
  /* Transparent - let tab-content handle the background */
  background-color: transparent;
}

.recipe-tabs-container {
  position: relative;
  margin-bottom: 0;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  padding-bottom: 0;
  /* Same color as page background and content */
  background-color: #FFF8DC;
  border-radius: 4px 4px 0 0;
  max-height: 60px; /* Fixed height to prevent vertical expansion */
}

.recipe-tabs {
  display: flex;
  gap: 0;
  min-width: min-content;
  position: relative;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  align-items: flex-end; /* Align tabs to bottom */
  height: 100%;
  /* Order: New button (leftmost), newest snapshot, older snapshots (rightmost) */
}

.recipe-tab {
  padding: 0.75rem 1.5rem;
  background-color: var(--color-light-brown); /* Darker brown for tabs */
  border: 2px solid var(--color-medium-brown);
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
  height: fit-content;
  min-height: 48px; /* Fixed minimum height */
  flex-shrink: 0; /* Prevent tabs from shrinking */
  color: var(--color-dark-brown);
  font-weight: 500;
}

.recipe-tab:hover {
  background-color: var(--color-gold);
  box-shadow: 
    0 -4px 8px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  /* Maintain height on hover */
  height: fit-content;
  min-height: 48px;
}

.recipe-tab.active {
  background-color: var(--color-gold); /* Lighter for active tab */
  border-bottom: 2px solid var(--color-medium-brown);
  font-weight: 600;
  box-shadow: 
    0 -2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  /* Physically connect to content below - no gap */
  margin-bottom: -2px; /* Overlap border to connect seamlessly */
  border-radius: 8px 8px 0 0;
  z-index: 10; /* Ensure active tab is above content border */
  /* Maintain consistent height */
  height: fit-content;
  min-height: 48px;
}

.recipe-tab.default {
  border-color: var(--color-gold);
  border-width: 2px;
  box-shadow: 
    0 -2px 4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 0 8px rgba(236, 177, 118, 0.3);
}

.default-icon {
  width: 16px;
  height: 16px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.star-icon-small {
  width: 16px;
  height: 16px;
}

.new-tab {
  background-color: var(--color-medium-brown);
  color: white;
  border-color: var(--color-medium-brown);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.new-tab .plus-icon {
  width: 14px;
  height: 14px;
}

.new-tab:hover {
  background-color: var(--color-dark-brown);
  box-shadow: 
    0 -4px 8px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.new-tab.active {
  background-color: var(--color-medium-brown);
  box-shadow: 
    0 -2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  margin-bottom: -1px;
}

.tab-content {
  min-height: 400px;
  max-height: calc(700px - 200px); /* Allow scrolling if content is tall */
  overflow-y: auto;
  border-radius: 12px 12px 12px 12px; /* Rounded on all corners including top */
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
  font-family: 'Caveat', cursive;
  font-weight: 600;
}

.section-content {
  color: var(--color-dark-brown);
  white-space: pre-wrap;
  line-height: 1.6;
  font-family: 'Caveat', cursive;
  font-size: 1.2rem;
  font-weight: 400;
  padding: 0.75rem 0.75rem 0.75rem 1.5rem;
}

.section-content.empty-content {
  color: #999;
  opacity: 0.6;
  font-style: italic;
}

.section-content ul {
  margin: 0.25rem 0;
  padding-left: 4rem !important;
  list-style: none;
  margin-left: 1rem;
}

.section-content ul li {
  margin: 0.1rem 0;
  padding: 0;
  padding-left: 1.5rem !important;
  position: relative;
  line-height: 1.4;
}

.section-content ul li::before {
  content: '•';
  position: absolute;
  left: -3rem !important;
  color: var(--color-medium-brown);
  font-weight: 600;
  font-size: 1.3rem;
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
  padding: 0.75rem 0.75rem 0.75rem 1.5rem;
  border: 2px solid var(--color-light-brown);
  border-radius: 4px;
  font-size: 1.1rem;
  font-family: 'Caveat', cursive;
  font-weight: 400;
  resize: vertical;
  background-color: white;
  line-height: 1.8;
}

.section-input:focus {
  outline: none;
  border-color: var(--color-medium-brown);
}

.bookmarks {
  position: absolute;
  right: -80px;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
  z-index: 9999;
  background: transparent;
}

.bookmark {
  margin-bottom: -160px;
}

.bookmark {
  width: 80px;
  height: 240px;
  position: relative;
  cursor: pointer;
  border-radius: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  overflow: visible;
  background: transparent;
  pointer-events: none;
}

.bookmark img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: auto;
}

.bookmark-bg,
.bookmark-bg-hover {
  z-index: 1;
}

.bookmark-overlay,
.bookmark-overlay-hover {
  z-index: 2;
  width: 50px !important;
  height: 50px !important;
  object-fit: contain;
  opacity: 0.9;
  left: 40%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.bookmark-star-overlay {
  width: 37.5px !important;
  height: 37.5px !important;
}

.bookmark-home-overlay {
  width: 35px !important;
  height: 35px !important;
}

.bookmark-bg-hover,
.bookmark-overlay-hover {
  opacity: 0;
  transition: opacity 0.2s;
}

.bookmark:hover .bookmark-bg {
  opacity: 0;
}

.bookmark:hover .bookmark-bg-hover {
  opacity: 1;
}

.bookmark:hover .bookmark-overlay {
  opacity: 0;
}

.bookmark:hover .bookmark-overlay-hover {
  opacity: 0.9;
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
  
}

@media (max-width: 768px) {
  .recipe-container {
    padding: 0;
    overflow: hidden;
    position: relative;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .book-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--color-cream);
    padding: 1rem;
    margin: 0;
  }
  
  .panable-container {
    position: relative;
    width: max-content;
    min-width: 100%;
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    transition: transform 0.1s ease-out;
    flex: 1;
    overflow: visible;
  }
  
  .panable-container:active {
    cursor: grabbing;
  }
  
  .notebook-wrapper {
    width: max-content;
    min-width: 1000px;
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

