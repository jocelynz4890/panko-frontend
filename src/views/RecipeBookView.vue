<template>
  <div class="recipe-book-container">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div v-if="book" class="recipe-book-page-wrapper">
      <!-- Book header with name - Outside the book -->
      <div class="book-header">
        <h1 class="book-name">{{ book.name }}</h1>
        <button @click="handleAddRecipe" class="add-recipe-btn" :disabled="addingRecipe">
          {{ addingRecipe ? 'Creating...' : '+ Add Recipe' }}
        </button>
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
              <div v-if="sortedRecipes.length === 0" class="empty-state">
                No recipes yet. Add recipes to this book to see them here.
              </div>
              <div v-else class="contents-list">
                <div
                  v-for="recipe in sortedRecipes"
                  :key="recipe._id"
                  class="recipe-entry"
                >
                  <div class="recipe-name" @click="openRecipe(recipe._id)">
                    {{ recipe.name }}
                  </div>
                  <div class="snapshots-list">
                    <div
                      v-for="snapshot in getRecipeSnapshots(recipe._id)"
                      :key="snapshot._id"
                      class="snapshot-entry"
                      @click="openRecipe(recipe._id, snapshot._id)"
                    >
                      {{ snapshot.subname || 'Untitled Snapshot' }}
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
                      src="/assets/star.png"
                      alt="star"
                      class="star-icon"
                    />
                    <img
                      v-for="i in (5 - rating)"
                      :key="i + rating"
                      src="/assets/star.png"
                      alt="empty star"
                      class="star-icon empty"
                    />
                  </div>
                </div>
                <div class="recipes-by-rating">
                  <div
                    v-for="recipe in getRecipesByRating(rating)"
                    :key="recipe._id"
                    class="recipe-link"
                    @click="openRecipe(recipe._id)"
                  >
                    {{ recipe.name }}
                  </div>
                  <div v-if="getRecipesByRating(rating).length === 0" class="no-recipes">
                    No recipes with this rating
                  </div>
                </div>
              </div>
              <!-- Unranked recipes section -->
              <div class="rating-section">
                <div class="rating-header">
                  <div class="unranked-label">Unranked</div>
                </div>
                <div class="recipes-by-rating">
                  <div
                    v-for="recipe in getUnrankedRecipes()"
                    :key="recipe._id"
                    class="recipe-link"
                    @click="openRecipe(recipe._id)"
                  >
                    {{ recipe.name }}
                  </div>
                  <div v-if="getUnrankedRecipes().length === 0" class="no-recipes">
                    No unranked recipes
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="page right-page" :class="{ 'page-flipped': currentPage > 0 }">
            <!-- Right page content (can be blank or have additional info) -->
            <div class="page-content"></div>
          </div>
        </div>
        
        <!-- Bookmarks -->
        <div class="bookmarks">
          <div
            class="bookmark bookmark-toc"
            :class="{ active: currentView === 'contents' }"
            @click="switchView('contents')"
          >
            Table of Contents
          </div>
          <div
            class="bookmark bookmark-rankings"
            :class="{ active: currentView === 'rankings' }"
            @click="switchView('rankings')"
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
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useRecipesStore } from '../stores/recipes'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const recipeBooksStore = useRecipeBooksStore()
const recipesStore = useRecipesStore()
const authStore = useAuthStore()

const book = ref(null)
const recipes = ref([])
const snapshotsByRecipe = ref({}) // Map of recipeId -> snapshots array
const loading = ref(false)
const error = ref('')
const currentView = ref('contents')
const currentPage = ref(0)
const addingRecipe = ref(false)

// Check for view query parameter
onMounted(() => {
  const viewParam = route.query.view
  if (viewParam === 'rankings') {
    currentView.value = 'rankings'
  }
  loadBookData()
})

const sortedRecipes = computed(() => {
  return [...recipes.value].sort((a, b) => a.name.localeCompare(b.name))
})

const hasNextPage = computed(() => {
  // For now, we only have one page of content
  return false
})

async function loadBookData() {
  loading.value = true
  error.value = ''
  
  try {
    const bookId = route.params.id
    // Clear existing recipes and snapshots first to force reload
    recipes.value = []
    snapshotsByRecipe.value = {}
    
    // Always fetch fresh book data (no caching)
    book.value = await recipeBooksStore.fetchBook(bookId)
    
    // Load all recipes for this book
    if (book.value?.recipes?.length > 0) {
      // Load recipes and their snapshots
      for (const recipeId of book.value.recipes) {
        try {
          // Fetch fresh recipe data
          await recipesStore.fetchRecipe(recipeId)
          const recipe = recipesStore.currentRecipe
          if (recipe) {
            // Create a deep copy to avoid reactivity issues
            recipes.value.push({
              _id: recipe._id,
              name: recipe.name,
              description: recipe.description,
              snapshots: recipe.snapshots ? [...recipe.snapshots] : [],
              defaultSnapshot: recipe.defaultSnapshot
            })
            
            // Load snapshots for this recipe and store them per recipe
            if (recipe.snapshots?.length > 0) {
              await recipesStore.fetchSnapshots(recipeId)
              // Store snapshots for this specific recipe
              snapshotsByRecipe.value[recipeId] = [...recipesStore.snapshots]
            } else {
              // Initialize empty array for recipes with no snapshots
              snapshotsByRecipe.value[recipeId] = []
            }
          }
        } catch (err) {
          console.error(`Failed to load recipe ${recipeId}:`, err)
        }
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to load recipe book'
  } finally {
    loading.value = false
  }
}

function getRecipeSnapshots(recipeId) {
  // Get snapshots from our per-recipe map
  const recipeSnapshots = snapshotsByRecipe.value[recipeId] || []
  
  // Filter to only include snapshots that are actually in the recipe's snapshots array
  const recipe = recipes.value.find(r => r._id === recipeId)
  if (!recipe || !recipe.snapshots || recipe.snapshots.length === 0) return []
  
  const validSnapshots = recipeSnapshots.filter(s => 
    recipe.snapshots && recipe.snapshots.includes(s._id)
  )
  
  // Sort chronologically
  return validSnapshots.sort((a, b) => {
    const dateA = new Date(a.date || 0)
    const dateB = new Date(b.date || 0)
    return dateA - dateB
  })
}

function getRecipesByRating(rating) {
  return recipes.value.filter(recipe => {
    if (!recipe.defaultSnapshot) return false
    // Get snapshots from our per-recipe map
    const recipeSnapshots = snapshotsByRecipe.value[recipe._id] || []
    const defaultSnapshot = recipeSnapshots.find(s => s._id === recipe.defaultSnapshot)
    // Return true if default snapshot has this rating
    return defaultSnapshot && defaultSnapshot.ranking === rating
  })
}

function getUnrankedRecipes() {
  return recipes.value.filter(recipe => {
    // Recipe is unranked if:
    // 1. It has no default snapshot, OR
    // 2. It has a default snapshot but no snapshots loaded, OR
    // 3. The default snapshot has no ranking (ranking is 0, null, or undefined)
    if (!recipe.defaultSnapshot) return true
    
    const recipeSnapshots = snapshotsByRecipe.value[recipe._id] || []
    if (recipeSnapshots.length === 0) return true
    
    const defaultSnapshot = recipeSnapshots.find(s => s._id === recipe.defaultSnapshot)
    if (!defaultSnapshot) return true
    
    // Recipe is unranked if ranking is missing, 0, null, or undefined
    return !defaultSnapshot.ranking || defaultSnapshot.ranking === 0
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

function openRecipe(recipeId, snapshotId = null) {
  const bookId = route.params.id
  // Build query string properly
  const queryParams = []
  if (snapshotId) {
    queryParams.push(`snapshot=${snapshotId}`)
  }
  if (bookId) {
    queryParams.push(`book=${bookId}`)
  }
  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''
  router.push(`/recipe/${recipeId}${queryString}`)
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
}

.book-name {
  font-size: 1.5rem;
  color: var(--color-dark-brown);
  margin: 0;
  font-weight: 600;
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
}

.notebook {
  position: relative;
  /* Custom book background - shared with RecipeView */
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
  min-height: 800px;
  filter: contrast(1.05) brightness(0.98);
}

.pages-container {
  display: flex;
  gap: 0;
  min-height: 800px;
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

.page {
  flex: 1;
  /* Paper background - no gradient */
  background-color: #FFF8DC;
  padding: 2rem;
  box-shadow: 
    inset 0 0 20px rgba(0, 0, 0, 0.03),
    inset 0 0 60px rgba(139, 115, 85, 0.02);
  position: relative;
  min-height: 800px;
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

.add-recipe-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-medium-brown);
  color: white;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background-color 0.2s;
  white-space: nowrap;
  cursor: pointer;
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

.star-icon {
  width: 20px;
  height: 20px;
}

.star-icon.empty {
  opacity: 0.3;
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
}
</style>

