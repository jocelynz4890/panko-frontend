<template>
  <div class="recipe-book-container">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div v-if="book" class="recipe-book-page-wrapper">
      <!-- Book header with name - Outside the book -->
      <div class="book-header">
        <h1 class="book-name">{{ book.name }}</h1>
        <div class="book-header-actions">
          <button @click="handleRenameClick" class="action-btn rename-btn" title="Rename book">
            <img src="/assets/pencil.png" alt="Rename" class="action-icon" />
            Rename
          </button>
          <button @click="handleDeleteClick" class="action-btn delete-btn" title="Delete book">
            🗑️ Delete
          </button>
          <button @click="handleAddRecipe" class="add-recipe-btn" :disabled="addingRecipe">
            <img src="/assets/plus_sign.png" alt="Add" class="plus-icon" />
            {{ addingRecipe ? 'Creating...' : 'Add Recipe' }}
          </button>
        </div>
      </div>
      
      <div class="notebook-wrapper">
        <div class="notebook">
          <!-- Book pages -->
          <div class="pages-container">
          <div class="page left-page" :class="{ 'page-flipped': currentPage > 0 }">
            <div v-if="currentView === 'contents'" class="contents-view">
              <div class="contents-header">
                <h2 class="page-title">Table of Contents</h2>
              </div>
              <div v-if="sortedDishes.length === 0" class="empty-state">
                No dishes yet. Add dishes to this book to see them here.
              </div>
              <div v-else class="contents-list">
                <!-- Regular dishes -->
                <div
                  v-for="dish in regularDishes"
                  :key="dish._id"
                  class="recipe-entry"
                >
                  <div 
                    class="recipe-name" 
                    :class="{ 'untitled-dish': dish.name === 'New Dish' }"
                    @click="openDish(dish._id)"
                  >
                    {{ truncateName(dish.name) }}
                  </div>
                  <div class="snapshots-list">
                    <div
                      v-for="recipe in getDishRecipes(dish._id)"
                      :key="recipe._id"
                      class="snapshot-entry"
                      @click="openDish(dish._id, recipe._id)"
                    >
                      {{ truncateName(recipe.subname || 'Untitled Recipe') }}
                    </div>
                  </div>
                </div>
                
                <!-- Divider before special sections -->
                <div v-if="untitledDishes.length > 0 || noRecipeDishes.length > 0" class="contents-divider"></div>
                
                <!-- Untitled Dishes -->
                <div v-if="untitledDishes.length > 0" class="special-section">
                  <div class="special-section-header">Untitled Dishes</div>
                  <div
                    v-for="dish in untitledDishes"
                    :key="dish._id"
                    class="recipe-entry"
                  >
                    <div 
                      class="recipe-name" 
                      :class="{ 'untitled-dish': dish.name === 'New Dish' }"
                      @click="openDish(dish._id)"
                    >
                      {{ dish.name }}
                    </div>
                    <div class="snapshots-list">
                      <div
                        v-for="recipe in getDishRecipes(dish._id)"
                        :key="recipe._id"
                        class="snapshot-entry"
                        @click="openDish(dish._id, recipe._id)"
                      >
                        {{ recipe.subname || 'Untitled Recipe' }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- No Recipe (dishes with no recipes) -->
                <div v-if="noRecipeDishes.length > 0" class="special-section">
                  <div class="special-section-header">No Recipe</div>
                  <div
                    v-for="dish in noRecipeDishes"
                    :key="dish._id"
                    class="recipe-entry"
                  >
                    <div 
                      class="recipe-name" 
                      :class="{ 'untitled-dish': dish.name === 'New Dish' }"
                      @click="openDish(dish._id)"
                    >
                      {{ dish.name }}
                    </div>
                    <div class="snapshots-list">
                      <div
                        v-for="recipe in getDishRecipes(dish._id)"
                        :key="recipe._id"
                        class="snapshot-entry"
                        @click="openDish(dish._id, recipe._id)"
                      >
                        {{ recipe.subname || 'Untitled Recipe' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else-if="currentView === 'rankings'" class="rankings-view">
              <h2 class="page-title">Rankings</h2>
              <div v-for="rating in [5, 4, 3, 2, 1]" :key="rating" class="rating-section">
                <div class="rating-header">
                  <div class="stars">
                    <img
                      v-for="i in rating"
                      :key="i"
                      src="/assets/filled_in_star.png"
                      alt="star"
                      class="star-icon"
                    />
                    <img
                      v-for="i in (5 - rating)"
                      :key="i + rating"
                      src="/assets/blank_star.png"
                      alt="empty star"
                      class="star-icon empty"
                    />
                  </div>
                </div>
                <div class="recipes-by-rating">
                  <div
                    v-for="dish in getDishesByRating(rating)"
                    :key="dish._id"
                    class="recipe-link"
                    @click="openDish(dish._id)"
                  >
                    {{ truncateName(dish.name) }}
                  </div>
                  <div v-if="getDishesByRating(rating).length === 0" class="no-recipes">
                    No dishes with this rating
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="page right-page" :class="{ 'page-flipped': currentPage > 0 }">
            <!-- Right page content -->
            <div v-if="currentView === 'contents'" class="dictionary-view-wrapper">
              <div class="dictionary-view">
              <div v-if="sortedDishes.length === 0" class="empty-state">
                No dishes yet.
              </div>
              <div v-else>
                <div
                  v-for="group in dictionaryGroups"
                  :key="group.letter"
                  class="dictionary-group"
                >
                  <div class="dictionary-letter">{{ group.letter }}</div>
                  <div
                    v-for="dish in group.dishes"
                    :key="dish._id"
                    class="dictionary-entry"
                  >
                    <div class="dictionary-recipe-line">
                      <span 
                        class="dictionary-recipe-name" 
                        :class="{ 'untitled-dish': dish.name === 'New Dish' }"
                        @click="openDish(dish._id)"
                      >
                        {{ truncateName(dish.name) }}
                      </span>
                      <span class="dictionary-dots">................................................................................</span>
                      <span class="dictionary-date">{{ getDishDate(dish._id) }}</span>
                    </div>
                    <div
                      v-for="recipe in getDishRecipes(dish._id)"
                      :key="recipe._id"
                      class="dictionary-snapshot-line"
                      @click="openDish(dish._id, recipe._id)"
                    >
                      <span class="dictionary-snapshot-name">{{ truncateName(recipe.subname || 'Untitled Recipe') }}</span>
                      <span class="dictionary-dots">................................................................................</span>
                      <span class="dictionary-date">{{ formatRecipeDate(recipe.date) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
            
            <div v-else-if="currentView === 'rankings'" class="rankings-view">
              <!-- Unranked recipes section on right page -->
              <div class="rating-section">
                <div class="rating-header">
                  <div class="unranked-label">Unranked</div>
                  <div class="unranked-divider"></div>
                </div>
                <div class="recipes-by-rating">
                  <div
                    v-for="dish in getUnrankedDishes()"
                    :key="dish._id"
                    class="recipe-link"
                    @click="openDish(dish._id)"
                  >
                    {{ truncateName(dish.name) }}
                  </div>
                  <div v-if="getUnrankedDishes().length === 0" class="no-recipes">
                    No unranked dishes
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="page-content"></div>
          </div>
          
          <!-- Bookmarks -->
          <div class="bookmarks">
            <div
              class="bookmark bookmark-toc"
              :class="{ active: currentView === 'contents' }"
              @click="switchView('contents')"
              title="Table of Contents"
            >
              <img src="/assets/table_of_contents_bookmark_horizontal.png" alt="Table of Contents" class="bookmark-bg" />
              <img src="/assets/home_navbar.png" alt="Home" class="bookmark-overlay bookmark-home-overlay" />
              <img src="/assets/bookmark_on_hover_horizontal.png" alt="Table of Contents" class="bookmark-bg-hover" />
              <img src="/assets/home_navbar.png" alt="Home" class="bookmark-overlay-hover bookmark-home-overlay" />
            </div>
            <div
              class="bookmark bookmark-rankings"
              :class="{ active: currentView === 'rankings' }"
              @click="switchView('rankings')"
              title="Rankings"
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
    
    <!-- Rename Book Modal -->
    <div v-if="showRenameModal" class="modal-overlay" @click.self="closeRenameModal">
      <div class="modal-content">
        <h2>Rename Recipe Book</h2>
        <form @submit.prevent="handleRenameBook">
          <div class="form-group">
            <label for="renameBookName">Book Name</label>
            <input
              id="renameBookName"
              v-model="renameBookName"
              type="text"
              required
              placeholder="Enter book name"
              maxlength="50"
            />
          </div>
          
          <div v-if="renameError" class="error-message">{{ renameError }}</div>
          
          <div class="modal-actions">
            <button type="button" @click="closeRenameModal" class="cancel-button">Cancel</button>
            <button type="submit" :disabled="renaming" class="submit-button">
              {{ renaming ? 'Renaming...' : 'Rename Book' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content">
        <h2>Delete Recipe Book</h2>
        <p>Are you sure you want to delete "{{ book?.name }}"? This action cannot be undone.</p>
        
        <div v-if="deleteError" class="error-message">{{ deleteError }}</div>
        
        <div class="modal-actions">
          <button type="button" @click="closeDeleteModal" class="cancel-button">Cancel</button>
          <button type="button" @click="handleDeleteBook" :disabled="deleting" class="submit-button delete-confirm-button">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useRecipesStore } from '../stores/recipes'
import { useAuthStore } from '../stores/auth'
import { dishesAPI, recipeAPI } from '../api/api'

const route = useRoute()
const router = useRouter()
const recipeBooksStore = useRecipeBooksStore()
const recipesStore = useRecipesStore()
const authStore = useAuthStore()

const book = ref(null)
const dishes = ref([])
const recipesByDish = ref({}) // Map of dishId -> recipes array
const loading = ref(false)
const error = ref('')
const currentView = ref('contents')
const currentPage = ref(0)
const addingRecipe = ref(false)

const showRenameModal = ref(false)
const renameBookName = ref('')
const renameError = ref('')
const renaming = ref(false)

const showDeleteModal = ref(false)
const deleteError = ref('')
const deleting = ref(false)

// Check for view query parameter
onMounted(() => {
  const viewParam = route.query.view
  if (viewParam === 'rankings') {
    currentView.value = 'rankings'
  }
  loadBookData()
})

const sortedDishes = computed(() => {
  return [...dishes.value]
    .filter(dish => dish && dish._id && dish.name) // Filter out invalid dishes
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Categorized dishes for table of contents
const regularDishes = computed(() => {
  return sortedDishes.value.filter(dish => {
    if (!dish || !dish._id) return false
    const recipes = getDishRecipes(dish._id)
    return recipes.length > 0 && dish.name !== 'New Dish'
  })
})

const untitledDishes = computed(() => {
  return sortedDishes.value.filter(dish => {
    if (!dish || !dish._id) return false
    const recipes = getDishRecipes(dish._id)
    return recipes.length > 0 && dish.name === 'New Dish'
  })
})

const noRecipeDishes = computed(() => {
  return sortedDishes.value.filter(dish => {
    if (!dish || !dish._id) return false
    const recipes = getDishRecipes(dish._id)
    return recipes.length === 0
  })
})

// Dictionary-style grouping by first letter
const dictionaryGroups = computed(() => {
  const groups = {}
  
  sortedDishes.value.forEach(dish => {
    if (!dish || !dish.name) return // Skip invalid dishes
    const firstLetter = dish.name.charAt(0).toUpperCase()
    if (!groups[firstLetter]) {
      groups[firstLetter] = []
    }
    groups[firstLetter].push(dish)
  })
  
  // Convert to array and sort by letter
  return Object.keys(groups)
    .sort()
    .map(letter => ({
      letter,
      dishes: groups[letter]
    }))
})

function getDishDate(dishId) {
  const dish = dishes.value.find(d => d._id === dishId)
  if (!dish) return ''
  
  // Get the most recent recipe date, or empty if no recipes
  const recipes = getDishRecipes(dishId)
  if (recipes.length === 0) return ''
  
  // Get the most recent recipe (they're sorted chronologically, oldest first)
  const mostRecent = recipes[recipes.length - 1]
  return formatRecipeDate(mostRecent.date)
}

function formatRecipeDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  
  // Format as MM/DD/YYYY
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

function truncateName(name, maxLength = 20) {
  if (!name) return ''
  if (name.length <= maxLength) return name
  return name.substring(0, maxLength) + '...'
}

const hasNextPage = computed(() => {
  // For now, we only have one page of content
  return false
})

async function loadBookData() {
  loading.value = true
  error.value = ''
  
  try {
    const bookId = route.params.id
    // Clear existing dishes and recipes first to force reload
    dishes.value = []
    recipesByDish.value = {}
    
    // Always fetch fresh book data (no caching)
    book.value = await recipeBooksStore.fetchBook(bookId)
    console.log('Loaded book:', book.value)
    console.log('Book dishes:', book.value?.dishes)
    console.log('Book recipes (old):', book.value?.recipes)
    
    // Load all dishes for this book
    // Check both dishes and recipes (in case API still returns recipes)
    const dishIds = book.value?.dishes || book.value?.recipes || []
    console.log('Dish IDs to load:', dishIds)
    
    if (dishIds.length > 0) {
      // First, fetch all dishes in parallel (without recipes)
      const dishPromises = dishIds.map(async (dishId) => {
        try {
          const response = await dishesAPI.getDish(dishId)
          const dishes = response.data.dishes || response.data
          const dish = Array.isArray(dishes) ? dishes[0] : dishes
          // Ensure dish has required properties and recipes is always an array
          if (dish) {
            return {
              ...dish,
              recipes: Array.isArray(dish.recipes) ? dish.recipes : [],
              name: dish.name || 'Untitled',
              description: dish.description || '',
              defaultRecipe: dish.defaultRecipe || null
            }
          }
          return null
        } catch (err) {
          console.error(`Failed to load dish ${dishId}:`, err)
          return null
        }
      })
      
      const loadedDishes = (await Promise.all(dishPromises)).filter(d => d !== null)
      
      // Then, fetch all recipes in parallel for dishes that have recipes
      const recipePromises = loadedDishes.map(async (dish) => {
        // Ensure dish exists and has recipes property
        if (!dish || !dish._id) {
          return { dishId: dish?._id || null, recipes: [] }
        }
        
        // Normalize recipes to always be an array
        const recipesArray = Array.isArray(dish.recipes) ? dish.recipes : []
        
        if (recipesArray.length > 0) {
          try {
            const response = await recipeAPI.getRecipes(dish._id)
            const recipesData = response.data.recipes || response.data
            const recipes = Array.isArray(recipesData) ? recipesData : []
            return { dishId: dish._id, recipes: recipes.sort((a, b) => new Date(a.date) - new Date(b.date)) }
          } catch (err) {
            console.error(`Failed to load recipes for dish ${dish._id}:`, err)
            return { dishId: dish._id, recipes: [] }
          }
        }
        return { dishId: dish._id, recipes: [] }
      })
      
      const recipeResults = await Promise.all(recipePromises)
      
      // Process results - ensure all dishes have valid structure
      for (const dish of loadedDishes) {
        if (!dish || !dish._id) {
          console.warn('Skipping invalid dish:', dish)
          continue // Skip invalid dishes
        }
        
        // Normalize the recipes property to always be an array
        let recipesArray = []
        if (dish.recipes) {
          if (Array.isArray(dish.recipes)) {
            recipesArray = [...dish.recipes]
          } else {
            console.warn(`Dish ${dish._id} has non-array recipes property:`, typeof dish.recipes, dish.recipes)
            recipesArray = []
          }
        }
        
        dishes.value.push({
          _id: dish._id,
          name: dish.name || 'Untitled',
          description: dish.description || '',
          recipes: recipesArray,
          defaultRecipe: dish.defaultRecipe || null
        })
      }
      
      // Store recipes by dish
      for (const result of recipeResults) {
        recipesByDish.value[result.dishId] = result.recipes
      }
    } else {
      console.warn('No dishes found in book:', book.value)
    }
    
    console.log('Final dishes array:', dishes.value)
    console.log('Final recipesByDish:', recipesByDish.value)
  } catch (err) {
    error.value = err.message || 'Failed to load recipe book'
  } finally {
    loading.value = false
  }
}

function getDishRecipes(dishId) {
  // Get recipes from our per-dish map
  const dishRecipes = recipesByDish.value[dishId] || []
  
  // Filter to only include recipes that are actually in the dish's recipes array
  const dish = dishes.value.find(d => d._id === dishId)
  if (!dish || !dish.recipes || dish.recipes.length === 0) return []
  
  const validRecipes = dishRecipes.filter(r => 
    dish.recipes && dish.recipes.includes(r._id)
  )
  
  // Sort chronologically
  return validRecipes.sort((a, b) => {
    const dateA = new Date(a.date || 0)
    const dateB = new Date(b.date || 0)
    return dateA - dateB
  })
}

function getDishesByRating(rating) {
  return dishes.value.filter(dish => {
    if (!dish || !dish._id || !dish.defaultRecipe) return false
    // Get recipes from our per-dish map
    const dishRecipes = recipesByDish.value[dish._id] || []
    const defaultRecipe = dishRecipes.find(r => r._id === dish.defaultRecipe)
    // Return true if default recipe has this rating
    return defaultRecipe && defaultRecipe.ranking === rating
  })
}

function getUnrankedDishes() {
  return dishes.value.filter(dish => {
    if (!dish || !dish._id) return false
    // Dish is unranked if:
    // 1. It has no default recipe, OR
    // 2. It has a default recipe but no recipes loaded, OR
    // 3. The default recipe has no ranking (ranking is 0, null, or undefined)
    if (!dish.defaultRecipe) return true
    
    const dishRecipes = recipesByDish.value[dish._id] || []
    if (dishRecipes.length === 0) return true
    
    const defaultRecipe = dishRecipes.find(r => r._id === dish.defaultRecipe)
    if (!defaultRecipe) return true
    
    // Dish is unranked if ranking is missing, 0, null, or undefined
    return !defaultRecipe.ranking || defaultRecipe.ranking === 0
  })
}

function switchView(view) {
  currentView.value = view
  currentPage.value = 0
}

function previousPage() {
  if (currentPage.value > 0) {
    currentPage.value--
  }
}

function nextPage() {
  if (hasNextPage.value) {
    currentPage.value++
  }
}

function openDish(dishId, recipeId = null) {
  const bookId = route.params.id
  // Build query string properly
  const queryParams = []
  if (recipeId) {
    queryParams.push(`recipe=${recipeId}`)
  }
  if (bookId) {
    queryParams.push(`book=${bookId}`)
  }
  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''
  router.push(`/recipe/${dishId}${queryString}`)
}

async function handleAddRecipe() {
  if (!book.value || !authStore.user) {
    error.value = 'Invalid book or user'
    return
  }
  
  addingRecipe.value = true
  error.value = ''
  
  // Generate a temporary ID for navigation
  // The recipe page will create the actual recipe
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // Store the book ID in sessionStorage so the recipe page knows which book to add it to
  sessionStorage.setItem('pendingRecipeBook', book.value._id)
  
  // Navigate immediately - don't wait for API calls
  router.push(`/recipe/${tempId}?book=${book.value._id}`)
  
  // The recipe page will handle creating the recipe
  // We don't need to create it here since the recipe page will do it
  addingRecipe.value = false
}

function handleRenameClick() {
  if (!book.value) return
  renameBookName.value = book.value.name
  renameError.value = ''
  showRenameModal.value = true
}

function closeRenameModal() {
  showRenameModal.value = false
  renameBookName.value = ''
  renameError.value = ''
}

async function handleRenameBook() {
  if (!book.value || !renameBookName.value.trim()) {
    renameError.value = 'Please enter a book name'
    return
  }
  
  // Debug: Check if function exists
  if (typeof recipeBooksStore.editBookName !== 'function') {
    console.error('editBookName is not a function. Available methods:', Object.keys(recipeBooksStore))
    renameError.value = 'Edit function not available. Please refresh the page.'
    return
  }
  
  renaming.value = true
  renameError.value = ''
  
  try {
    await recipeBooksStore.editBookName(book.value._id, renameBookName.value.trim())
    // Reload book data to get updated name
    await loadBookData()
    closeRenameModal()
  } catch (err) {
    renameError.value = err.message || 'Failed to rename book'
  } finally {
    renaming.value = false
  }
}

function handleDeleteClick() {
  if (!book.value) return
  deleteError.value = ''
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deleteError.value = ''
}

async function handleDeleteBook() {
  if (!book.value) return
  
  deleting.value = true
  deleteError.value = ''
  
  try {
    await recipeBooksStore.deleteBook(book.value._id)
    // Navigate back to home after deletion
    router.push('/')
  } catch (err) {
    deleteError.value = err.message || 'Failed to delete book'
  } finally {
    deleting.value = false
  }
}

// Reload book data when returning to this page (if using keep-alive)
onActivated(() => {
  const viewParam = route.query.view
  if (viewParam === 'rankings') {
    currentView.value = 'rankings'
  } else {
    currentView.value = 'contents'
  }
  // Always reload to get fresh data (especially after adding recipes)
  loadBookData()
})

// Also watch for route changes to reload
watch(() => route.params.id, () => {
  loadBookData()
})

// Watch for refresh query param or view changes
watch(() => route.query.view, (newView) => {
  if (newView === 'rankings') {
    currentView.value = 'rankings'
  } else {
    currentView.value = 'contents'
  }
  // Reload when view changes
  loadBookData()
})

// Watch for refresh query param
watch(() => route.query.refresh, () => {
  // Reload when refresh param changes
  loadBookData()
})
</script>

<style scoped>
.recipe-book-container {
  min-height: calc(100vh - 80px);
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 2rem;
}

.recipe-book-page-wrapper {
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
  gap: 1rem;
}

.book-name {
  font-size: 1.5rem;
  color: var(--color-dark-brown);
  margin: 0;
  font-weight: 600;
  flex: 1;
}

.book-header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-icon {
  width: 18px;
  height: 18px;
}

.rename-btn {
  background-color: var(--color-light-brown);
  color: var(--color-dark-brown);
}

.rename-btn:hover {
  background-color: var(--color-gold);
}

.delete-btn {
  background-color: #d32f2f;
  color: white;
}

.delete-btn:hover {
  background-color: #b71c1c;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  color: var(--color-dark-brown);
}

.error {
  color: #d32f2f;
}

.notebook-wrapper {
  width: 100%;
  max-width: 1600px;
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
  min-height: 800px;
  filter: contrast(1.05) brightness(0.98);
  overflow: visible;
}

.pages-container {
  display: flex;
  gap: 0;
  min-height: 800px;
  max-height: 90vh;
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

.page {
  flex: 1;
  /* Paper background - no gradient */
  background-color: #FFF8DC;
  padding: 3rem;
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.03),
    inset 0 0 60px rgba(139, 115, 85, 0.02);
  position: relative;
  min-height: 800px;
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 3D shadows for page depth */
.left-page {
  border-radius: 8px 0 0 8px;
  /* 3D shadow effect - pages stacked */
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.03),
    inset 0 0 60px rgba(139, 115, 85, 0.02),
    -8px 0 16px rgba(0, 0, 0, 0.15),
    -4px 0 8px rgba(0, 0, 0, 0.1),
    -2px 0 4px rgba(0, 0, 0, 0.08);
  /* Ensure consistent height */
  display: flex;
  flex-direction: column;
  min-height: 800px;
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.right-page {
  border-radius: 0 8px 8px 0;
  /* 3D shadow effect - pages stacked */
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.03),
    inset 0 0 60px rgba(139, 115, 85, 0.02),
    8px 0 16px rgba(0, 0, 0, 0.15),
    4px 0 8px rgba(0, 0, 0, 0.1),
    2px 0 4px rgba(0, 0, 0, 0.08);
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: visible;
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

.page-title {
  color: var(--color-dark-brown);
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  border-bottom: 2px solid var(--color-light-brown);
  padding-bottom: 0.5rem;
}

.contents-list {
  list-style: none;
}

.recipe-entry {
  margin-bottom: 1.5rem;
}

.recipe-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-dark-brown);
  cursor: pointer;
  margin-bottom: 0.5rem;
  transition: color 0.2s;
}

.recipe-name:hover {
  color: var(--color-medium-brown);
  text-decoration: underline;
}

.recipe-name.untitled-dish {
  font-style: italic;
  font-weight: 500;
}

.snapshots-list {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
}

.snapshot-entry {
  font-size: 0.95rem;
  color: var(--color-medium-brown);
  cursor: pointer;
  margin-bottom: 0.25rem;
  padding-left: 0.5rem;
  transition: color 0.2s;
}

.snapshot-entry:hover {
  color: var(--color-dark-brown);
  text-decoration: underline;
}

.contents-header {
  margin-bottom: 1.5rem;
}

.contents-divider {
  height: 1px;
  background-color: var(--color-light-brown);
  margin: 1.5rem 0;
  opacity: 0.6;
}

.special-section {
  margin-top: 1rem;
}

.special-section-header {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-medium-brown);
  margin-bottom: 0.75rem;
  font-style: italic;
}

.add-recipe-btn {
  padding: 0.75rem 1rem;
  background-color: var(--color-medium-brown);
  color: white;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background-color 0.2s;
  white-space: nowrap;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.plus-icon {
  width: 16px;
  height: 16px;
}

.add-recipe-btn:hover:not(:disabled) {
  background-color: var(--color-dark-brown);
}

.add-recipe-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  color: var(--color-medium-brown);
  padding: 2rem;
  font-style: italic;
}

.contents-view,
.rankings-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.rating-section {
  margin-bottom: 2rem;
}

.rankings-divider {
  height: 1px;
  background-color: var(--color-light-brown);
  margin: 1.5rem 0;
  opacity: 0.6;
}

.rating-header {
  margin-bottom: 0.75rem;
}

.stars {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.unranked-label {
  font-size: 1.1rem;
  color: var(--color-medium-brown);
  font-weight: 500;
  font-style: italic;
  margin-bottom: 0.5rem;
}

.unranked-divider {
  height: 1px;
  background-color: var(--color-light-brown);
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
  opacity: 0.6;
}

.star-icon {
  width: 20px;
  height: 20px;
}

.recipes-by-rating {
  margin-left: 1rem;
}

.recipe-link {
  color: var(--color-dark-brown);
  cursor: pointer;
  margin-bottom: 0.5rem;
  padding-left: 0.5rem;
  transition: color 0.2s;
}

.recipe-link:hover {
  color: var(--color-medium-brown);
  text-decoration: underline;
}

.no-recipes {
  color: var(--color-medium-brown);
  font-style: italic;
  font-size: 0.9rem;
  padding-left: 0.5rem;
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
  margin-bottom: -150px;
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
  pointer-events: auto;
}

.bookmark img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bookmark-bg {
  z-index: 1;
}

.bookmark-bg-hover {
  z-index: 1;
}

.bookmark-overlay {
  z-index: 2;
  width: 50px !important;
  height: 50px !important;
  object-fit: contain;
  opacity: 0.9;
  left: 40%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.bookmark-overlay-hover {
  z-index: 3;
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
  width: 40px !important;
  height: 40px !important;
}

.bookmark-bg-hover,
.bookmark-overlay-hover {
  opacity: 0;
  transition: opacity 0.2s;
}

/* When hovering over any image in the bookmark, show hover state */
/* Hover on background image */
.bookmark .bookmark-bg:hover ~ .bookmark-bg {
  opacity: 0;
}

.bookmark .bookmark-bg:hover ~ .bookmark-bg-hover {
  opacity: 1;
}

.bookmark .bookmark-bg:hover ~ .bookmark-overlay {
  opacity: 0;
}

.bookmark .bookmark-bg:hover ~ .bookmark-overlay-hover {
  opacity: 0.9;
}

/* Hover on overlay image */
.bookmark .bookmark-overlay:hover ~ .bookmark-bg {
  opacity: 0;
}

.bookmark .bookmark-overlay:hover ~ .bookmark-bg-hover {
  opacity: 1;
}

.bookmark .bookmark-overlay:hover {
  opacity: 0;
}

.bookmark .bookmark-overlay:hover ~ .bookmark-overlay-hover {
  opacity: 0.9;
}

/* Hover on hover background image - use parent to affect all siblings */
.bookmark:has(.bookmark-bg-hover:hover) .bookmark-bg {
  opacity: 0;
}

.bookmark:has(.bookmark-bg-hover:hover) .bookmark-bg-hover {
  opacity: 1;
}

.bookmark:has(.bookmark-bg-hover:hover) .bookmark-overlay {
  opacity: 0;
}

.bookmark:has(.bookmark-bg-hover:hover) .bookmark-overlay-hover {
  opacity: 0.9;
}

/* Hover on hover overlay image - use parent to affect all siblings */
.bookmark:has(.bookmark-overlay-hover:hover) .bookmark-bg {
  opacity: 0;
}

.bookmark:has(.bookmark-overlay-hover:hover) .bookmark-bg-hover {
  opacity: 1;
}

.bookmark:has(.bookmark-overlay-hover:hover) .bookmark-overlay {
  opacity: 0;
}

.bookmark:has(.bookmark-overlay-hover:hover) .bookmark-overlay-hover {
  opacity: 0.9;
}


/* Dictionary view styles */
.dictionary-view-wrapper {
  padding: 0 20px;
  width: calc(100% + 40px);
  margin-left: -20px;
  overflow-x: visible;
  overflow-y: auto;
}

.dictionary-view {
  padding: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: visible;
  overflow-y: auto;
}

.dictionary-group {
  margin-bottom: 1.5rem;
}

.dictionary-letter {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-dark-brown);
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-light-brown);
  padding-bottom: 0.25rem;
}

.dictionary-entry {
  margin-bottom: 0.75rem;
}

.dictionary-recipe-line,
.dictionary-snapshot-line {
  display: flex;
  align-items: baseline;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 0.25rem;
  width: 100%;
  max-width: none;
  overflow: visible;
  gap: 0;
  position: relative;
}

.dictionary-snapshot-line {
  margin-left: 1.5rem;
  font-size: 0.9rem;
  color: var(--color-medium-brown);
  cursor: pointer;
}

.dictionary-snapshot-line:hover {
  color: var(--color-dark-brown);
}

.dictionary-recipe-name {
  font-weight: 500;
  color: var(--color-dark-brown);
  cursor: pointer;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.dictionary-recipe-name:hover {
  color: var(--color-medium-brown);
  text-decoration: underline;
}

.dictionary-recipe-name.untitled-dish {
  font-style: italic;
  font-weight: 400;
}

.dictionary-snapshot-name {
  white-space: nowrap;
  margin-right: 0.5rem;
}

.dictionary-dots {
  flex: 0 1 auto;
  overflow: hidden;
  white-space: nowrap;
  color: var(--color-light-brown);
  font-size: 0.7rem;
  margin: 0;
  padding: 0;
  opacity: 0.4;
  min-width: 0;
  max-width: 60%;
  letter-spacing: 2px;
}

.dictionary-date {
  white-space: nowrap;
  color: var(--color-medium-brown);
  font-size: 0.9rem;
  margin: 0;
  padding: 0;
  margin-left: 0.5rem;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}


.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h2 {
  color: var(--color-dark-brown);
  margin-bottom: 1.5rem;
  text-align: center;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-dark-brown);
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--color-light-brown);
  border-radius: 4px;
  font-size: 1rem;
  background-color: var(--color-cream);
  font-family: 'Caveat', cursive;
  font-size: 1.2rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.cancel-button,
.submit-button {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  border: none;
}

.cancel-button {
  background-color: var(--color-light-brown);
  color: var(--color-dark-brown);
}

.submit-button {
  background-color: var(--color-medium-brown);
  color: white;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--color-dark-brown);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-confirm-button {
  background-color: #d32f2f;
}

.delete-confirm-button:hover:not(:disabled) {
  background-color: #b71c1c;
}

.error-message {
  color: #d32f2f;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #ffebee;
  border-radius: 4px;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .notebook {
    padding: 1rem;
  }
  
  .pages-container {
    flex-direction: column;
  }
  
  .pages-container::before {
    display: none;
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
  
  .book-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .book-header-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  
  .modal-content {
    padding: 1.5rem;
  }
}
</style>

