<template>
  <div class="calendar-container">
    <h1 class="page-title">Cooking Calendar</h1>
    
    <div v-if="loading" class="loading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div 
      class="calendar-layout panable-container"
      ref="panableContainer"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }"
    >
      <div class="calendar-section">
        <div class="calendar-controls">
          <button @click="previousMonth" class="nav-month">← Previous</button>
          <h2 class="current-month">{{ currentMonthYear }}</h2>
          <button @click="nextMonth" class="nav-month">Next →</button>
        </div>
        <div class="calendar-wrapper" ref="calendarWrapperRef">
          <div class="calendar-grid">
        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="calendar-day"
          :class="{ 'other-month': !day.isCurrentMonth, 'today': day.isToday }"
          @drop="handleDrop($event, day.date)"
          @dragover.prevent="handleDragOver($event)"
          @dragenter.prevent="handleDragEnter($event)"
          @dragleave.prevent
        >
          <div class="day-number">{{ day.day }}</div>
          <div class="day-content">
            <div
              v-for="scheduled in getScheduledForDay(day.date)"
              :key="scheduled.scheduledRecipe._id"
              class="scheduled-item"
              :class="{ 'dragging': isDragging && draggedItem && draggedItem.scheduledRecipe._id === scheduled.scheduledRecipe._id }"
              :draggable="true"
              @dragstart="handleDragStart($event, scheduled)"
              @dragend="handleDragEnd($event)"
              @click="handleScheduledItemClick(scheduled)"
              :title="`${scheduled.dishName} - ${scheduled.recipeName || 'Default'} (click to open, drag to move)`"
            >
              <button
                class="remove-recipe-btn"
                @click.stop="handleRemoveScheduled(scheduled.scheduledRecipe._id)"
                @mousedown.stop
                title="Remove from calendar"
              >
                ×
              </button>
              <div class="scheduled-recipe-name">{{ scheduled.dishName }}</div>
              <div class="scheduled-snapshot-name">{{ scheduled.recipeName || 'Default' }}</div>
            </div>
            <div
              v-if="getScheduledForDay(day.date).length === 0"
              class="empty-day"
            >
              Drop recipes here
            </div>
          </div>
          </div>
        </div>
      </div>
      </div>
    
      <!-- Recipe Selection Panel -->
      <div class="snapshot-panel" ref="recipePanelRef" :style="{ height: recipePanelHeight }">
        <h3>Add Recipe to Calendar</h3>
        <div v-if="availableRecipes.length === 0" class="no-snapshots">
          No recipes available. Create recipes in your dishes first.
        </div>
        <div v-else class="snapshot-list">
          <div
            v-for="recipe in availableRecipes"
            :key="recipe._id"
            class="snapshot-option"
            draggable="true"
            @dragstart="handleDragStartRecipe($event, recipe)"
            @dragend="handleDragEnd"
            @click="handleRecipeListClick(recipe)"
            :title="`Click to open, drag to calendar to schedule: ${recipe.dishName} - ${recipe.name || 'Default'}`"
          >
            <div class="snapshot-option-recipe">{{ recipe.dishName }}</div>
            <div class="snapshot-option-name">{{ recipe.name || formatDateShort(recipe.date) || 'Default' }}</div>
            <div class="snapshot-option-date" v-if="recipe.date">
              {{ formatDateShort(recipe.date) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Batch Update Controls - Overlay at bottom right -->
  <!-- Using Teleport to body ensures it's outside any filtered containers -->
  <Teleport to="body">
    <div v-if="hasPendingUpdates" ref="batchControlsRef" class="batch-controls-overlay">
      <div class="batch-controls-content">
        <div class="pending-count">{{ pendingUpdatesCount }} pending changes</div>
        <button @click="submitUpdates" class="submit-updates-btn" :disabled="submitting">
          {{ submitting ? 'Saving...' : 'Save Changes' }}
        </button>
        <button @click="showClearPendingDialog = true" class="clear-updates-btn">Clear</button>
      </div>
    </div>
  </Teleport>
  
  <!-- Confirmation Dialogs -->
  <ConfirmDialog
    v-model:show="showDeleteScheduledDialog"
    title="Remove Scheduled Recipe"
    message="Are you sure you want to remove this scheduled recipe?"
    confirm-text="Remove"
    cancel-text="Cancel"
    :danger="true"
    @confirm="confirmRemoveScheduled"
  />
  
  <ConfirmDialog
    v-model:show="showClearPendingDialog"
    title="Clear Pending Changes"
    message="Are you sure you want to clear all pending changes?"
    confirm-text="Clear"
    cancel-text="Cancel"
    :danger="true"
    @confirm="confirmClearPendingUpdates"
  />
</template>

<script setup>
import { ref, computed, onMounted, watch, onActivated, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCalendarStore } from '../stores/calendar'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useRecipesStore } from '../stores/recipes'
import { useAuthStore } from '../stores/auth'
import { dishesAPI, recipeAPI } from '../api/api'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const calendarStore = useCalendarStore()
const recipeBooksStore = useRecipeBooksStore()
const recipesStore = useRecipesStore()
const authStore = useAuthStore()

const currentDate = ref(new Date())
const draggedItem = ref(null)
const draggedRecipe = ref(null)
const loading = ref(false)
const error = ref('')
const submitting = ref(false)
const availableRecipes = ref([])
const scheduledRecipesData = ref([])
const isDragging = ref(false) // Track if we're currently dragging to prevent click events
const calendarWrapperRef = ref(null)
const recipePanelRef = ref(null)
const recipePanelHeight = ref('auto')
const showDeleteScheduledDialog = ref(false)
const showClearPendingDialog = ref(false)
const pendingDeleteScheduledId = ref(null)
const panableContainer = ref(null)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const startX = ref(0)
const startY = ref(0)
const initialPanX = ref(0)
const initialPanY = ref(0)
const zoom = ref(1)
const initialZoom = ref(1)
const initialDistance = ref(0)
const isZooming = ref(false)

const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDate.getDay())
  
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    
    days.push({
      date: dateStr,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: date.getTime() === today.getTime()
    })
  }
  
  return days
})

const hasPendingUpdates = computed(() => {
  return calendarStore.pendingUpdates.length > 0
})

const pendingUpdatesCount = computed(() => {
  return calendarStore.pendingUpdates.length
})

function previousMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

function nextMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

function getScheduledForDay(date) {
  // Normalize dates to ensure proper comparison
  const normalizedDate = typeof date === 'string' ? date : date.toISOString().split('T')[0]
  return scheduledRecipesData.value.filter(item => {
    const itemDate = typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0]
    return itemDate === normalizedDate
  })
}

async function loadData() {
  loading.value = true
  error.value = ''
  
  try {
    // Load scheduled recipes
    await calendarStore.fetchScheduledRecipes()
    
    // Load all recipe books and their dishes
    await recipeBooksStore.fetchBooks()
    
    // Collect all dish IDs from all books
    const allDishIds = []
    for (const book of recipeBooksStore.books) {
      if (book.dishes && book.dishes.length > 0) {
        allDishIds.push(...book.dishes)
      }
    }
    
    // Remove duplicates
    const uniqueDishIds = [...new Set(allDishIds)]
    
    // Load all dishes in parallel (without recipes)
    const dishPromises = uniqueDishIds.map(async (dishId) => {
      try {
        const response = await dishesAPI.getDish(dishId)
        const dishes = response.data.dishes || response.data
        const dish = Array.isArray(dishes) ? dishes[0] : dishes
        // Ensure dish exists and has required properties
        if (!dish || !dish._id) {
          return null
        }
        return dish
      } catch (err) {
        console.error(`Failed to load dish ${dishId}:`, err)
        return null
      }
    })
    
    const loadedDishes = (await Promise.all(dishPromises)).filter(d => d !== null && d !== undefined)
    
    // Load all recipes in parallel for dishes that have recipes
    const recipePromises = loadedDishes.map(async (dish) => {
      if (dish && dish.recipes && dish.recipes.length > 0) {
        try {
          const response = await recipeAPI.getRecipes(dish._id)
          const recipesData = response.data.recipes || response.data
          const recipes = Array.isArray(recipesData) ? recipesData : []
          // Filter out any null/undefined recipes and ensure recipe has _id
          return recipes
            .filter(recipe => recipe && recipe._id) // Only include valid recipes
            .map(recipe => ({
              _id: recipe._id,
              dishId: dish._id,
              dishName: dish.name,
              name: recipe.subname || null,
              date: recipe.date || null
            }))
        } catch (err) {
          console.error(`Failed to load recipes for dish ${dish._id}:`, err)
          return []
        }
      }
      return []
    })
    
    // Wait for all recipes to load and flatten results
    // Filter out any invalid recipes and ensure all have required fields
    const results = await Promise.all(recipePromises)
    const allRecipes = results.flat().filter(recipe => 
      recipe && 
      recipe._id && 
      recipe.dishId && 
      recipe.dishName
    )
    // Sort recipes by date (newest first)
    allRecipes.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0)
      const dateB = b.date ? new Date(b.date) : new Date(0)
      return dateB - dateA
    })
    availableRecipes.value = allRecipes
    
    // Build scheduled recipes data with dish names
    // Filter out scheduled recipes that reference deleted recipes
    scheduledRecipesData.value = []
    
    // Match scheduled recipes to our loaded recipes
    for (const scheduled of calendarStore.scheduledRecipes) {
      // Normalize date to YYYY-MM-DD format
      let normalizedDate = scheduled.date
      if (scheduled.date instanceof Date) {
        normalizedDate = scheduled.date.toISOString().split('T')[0]
      } else if (typeof scheduled.date === 'string' && scheduled.date.includes('T')) {
        normalizedDate = scheduled.date.split('T')[0]
      }
      
      // Find the recipe in our loaded recipes
      const recipe = allRecipes.find(r => r._id === scheduled.recipe)
      
      if (recipe) {
        scheduledRecipesData.value.push({
          scheduledRecipe: scheduled,
          dishName: recipe.dishName,
          recipeName: recipe.name || 'Default',
          date: normalizedDate,
          recipe: scheduled.recipe,
          dishId: recipe.dishId
        })
      } else {
        // Recipe not found in initial load - try to lookup
        // But don't add "Unknown" items - filter them out if not found
        let found = false
        // Search through recipe books to find this recipe
        for (const book of recipeBooksStore.books) {
          if (book.dishes && book.dishes.length > 0) {
            for (const dishId of book.dishes) {
              try {
                await recipesStore.fetchRecipes(dishId)
                const foundRecipe = recipesStore.recipes.find(r => r._id === scheduled.recipe)
                if (foundRecipe) {
                  await recipesStore.fetchDish(dishId)
                  const dish = recipesStore.currentDish
                  if (dish) {
                    scheduledRecipesData.value.push({
                      scheduledRecipe: scheduled,
                      dishName: dish.name,
                      recipeName: foundRecipe.subname || 'Default',
                      date: normalizedDate,
                      recipe: scheduled.recipe,
                      dishId: dishId
                    })
                    found = true
                    break
                  }
                }
              } catch (err) {
                // Continue searching
              }
            }
            if (found) break
          }
        }
        // If recipe still not found after lookup, it was deleted - skip it (don't add to scheduledRecipesData)
        // The backend sync should have removed it, but if it's still in the list, filter it out
        if (!found) {
          console.warn(`Scheduled recipe references deleted recipe ${scheduled.recipe} - filtering out`)
          // Don't add to scheduledRecipesData - effectively filters it out
        }
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to load calendar data'
  } finally {
    loading.value = false
    updateRecipePanelHeight()
  }
}

function handleDragStart(event, scheduled) {
  console.log('Drag started for scheduled item:', scheduled)
  isDragging.value = true
  draggedItem.value = scheduled
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.dropEffect = 'move'
  // Store scheduled data in dataTransfer for reliable access
  const dragData = {
    type: 'scheduled',
    scheduledId: scheduled.scheduledRecipe._id,
    recipe: scheduled.recipe,
    currentDate: scheduled.date
  }
  event.dataTransfer.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer.setData('text/plain', 'scheduled')
  console.log('Drag data set:', dragData)
}

function handleDragStartRecipe(event, recipe) {
  console.log('Drag started for recipe:', recipe)
  try {
    draggedRecipe.value = recipe
    event.dataTransfer.effectAllowed = 'copy'
    // Store recipe data in dataTransfer for reliable access during drop
    const dragData = {
      type: 'recipe',
      recipeId: recipe._id,
      dishId: recipe.dishId,
      dishName: recipe.dishName,
      recipeName: recipe.name || 'Default',
      date: recipe.date
    }
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.setData('text/plain', 'recipe') // Fallback for some browsers
    console.log('Drag data stored:', dragData)
  } catch (error) {
    console.error('Error in handleDragStartRecipe:', error)
    event.preventDefault()
  }
}

function formatDateShort(dateString) {
  if (!dateString) return null
  try {
    // Parse date string as local date to avoid timezone issues
    let date
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Parse as local date to avoid UTC timezone issues
      const [year, month, day] = dateString.split('-').map(Number)
      date = new Date(year, month - 1, day)
    } else {
      date = new Date(dateString)
    }
    if (isNaN(date.getTime())) return dateString
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}

async function handleDrop(event, date) {
  event.preventDefault()
  event.stopPropagation()
  console.log('Drop event fired on date:', date)
  console.log('draggedRecipe.value:', draggedRecipe.value)
  console.log('draggedItem.value:', draggedItem.value)
  
  // Try to get data from dataTransfer first
  let dragData = null
  try {
    const dataString = event.dataTransfer.getData('application/json')
    console.log('dataTransfer.getData result:', dataString)
    if (dataString) {
      dragData = JSON.parse(dataString)
      console.log('Parsed drag data:', dragData)
    }
  } catch (e) {
    console.warn('Could not parse drag data from dataTransfer:', e)
  }
  
  // Fallback to component refs if dataTransfer failed (this is more reliable)
  if (!dragData) {
    console.log('No dataTransfer data, checking refs...')
    if (draggedItem.value) {
      console.log('Using draggedItem ref')
      dragData = {
        type: 'scheduled',
        scheduledId: draggedItem.value.scheduledRecipe._id,
        recipe: draggedItem.value.recipe,
        currentDate: draggedItem.value.date
      }
    } else if (draggedRecipe.value) {
      console.log('Using draggedRecipe ref (recipe)')
      dragData = {
        type: 'recipe',
        recipeId: draggedRecipe.value._id,
        dishId: draggedRecipe.value.dishId,
        dishName: draggedRecipe.value.dishName,
        recipeName: draggedRecipe.value.name || 'Default',
        date: draggedRecipe.value.date
      }
    }
  }
  
  console.log('Final dragData:', dragData)
  
  if (!dragData) {
    console.warn('No drag data available in drop handler')
    isDragging.value = false
    return
  }
  
  // Mark that drop is being processed
  isDragging.value = false
  
  if (dragData.type === 'scheduled') {
    // Moving existing scheduled item
    const scheduledItem = scheduledRecipesData.value.find(
      item => item.scheduledRecipe._id === dragData.scheduledId
    )
    if (scheduledItem) {
      // Normalize dates for comparison
      const oldDateNormalized = typeof scheduledItem.date === 'string' ? scheduledItem.date : new Date(scheduledItem.date).toISOString().split('T')[0]
      const newDateNormalized = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0]
      
      // Only move if date is actually different
      if (oldDateNormalized !== newDateNormalized) {
        // Add pending update for the move
        calendarStore.addPendingUpdate({
          type: 'move',
          oldScheduledRecipe: dragData.scheduledId,
          recipe: dragData.recipe,
          newDate: newDateNormalized,
          date: oldDateNormalized // Keep track of old date
        })
        
        // Remove from old location and add to new location
        const itemIndex = scheduledRecipesData.value.findIndex(
          item => item.scheduledRecipe._id === dragData.scheduledId
        )
        if (itemIndex !== -1) {
          const movedItem = scheduledRecipesData.value[itemIndex]
          movedItem.date = newDateNormalized
          scheduledRecipesData.value.splice(itemIndex, 1)
          scheduledRecipesData.value.push(movedItem)
          // Force reactivity update
          scheduledRecipesData.value = [...scheduledRecipesData.value]
          console.log('Moved scheduled item from', oldDateNormalized, 'to', newDateNormalized)
        }
      }
    }
  } else if (dragData.type === 'recipe') {
    // Adding new recipe
    const recipeId = dragData.recipeId
    const dishName = dragData.dishName
    const recipeName = dragData.recipeName
    
    if (recipeId) {
      console.log('Dropping recipe:', dragData, 'on date:', date)
      calendarStore.addPendingUpdate({
        type: 'add',
        recipe: recipeId,
        date: date
      })
      
      // Find the dishId from availableRecipes
      const recipeInfo = availableRecipes.value.find(r => r._id === recipeId)
      const dishId = recipeInfo?.dishId || null
      
      // Add to local state immediately
      const newScheduledItem = {
        scheduledRecipe: { 
          _id: 'pending-' + Date.now(), 
          recipe: recipeId, 
          date: date
        },
        dishName: dishName,
        recipeName: recipeName || null,
        date: date,
        recipe: recipeId,
        dishId: dishId
      }
      scheduledRecipesData.value.push(newScheduledItem)
      
      // Force reactivity update
      scheduledRecipesData.value = [...scheduledRecipesData.value]
      
      console.log('Added recipe to calendar day:', date)
      console.log('All scheduled items:', scheduledRecipesData.value)
    } else {
      console.warn('No recipe ID available:', dragData)
      error.value = `Unable to schedule. Please try again.`
      setTimeout(() => { error.value = '' }, 5000)
    }
  } else {
    console.warn('Unknown drag data type:', dragData.type)
  }
  
  // Clean up drag refs after drop is processed
  setTimeout(() => {
    draggedItem.value = null
    draggedRecipe.value = null
  }, 100)
}

function handleDragEnd(event) {
  // Don't clear refs or reset dragging immediately - let drop handler process first
  // The drop handler will set isDragging to false when it's done
  // If no drop happens, the refs will be cleared after a delay
  setTimeout(() => {
    if (isDragging.value) {
      // Still dragging means drop didn't happen, clean up
      isDragging.value = false
      draggedItem.value = null
      draggedRecipe.value = null
    }
  }, 300)
}

async function handleOpenRecipe(scheduled) {
  if (!scheduled.dishId) return
  
  const recipeId = scheduled.recipe
  const dishId = scheduled.dishId
  // Try to find which book contains this dish for navigation
  try {
    await recipeBooksStore.fetchBooks()
    const bookWithDish = recipeBooksStore.books.find(book => 
      book.dishes && book.dishes.includes(dishId)
    )
    if (bookWithDish) {
      router.push(`/recipe/${dishId}?book=${bookWithDish._id}&recipe=${recipeId}`)
    } else {
      router.push(`/recipe/${dishId}?recipe=${recipeId}`)
    }
  } catch (err) {
    console.warn('Failed to find book for dish, navigating without book:', err)
    router.push(`/recipe/${dishId}?recipe=${recipeId}`)
  }
}

function handleScheduledItemClick(scheduled) {
  // Only open if we're not dragging
  if (isDragging.value) {
    return
  }
  // Use a small delay to ensure drag didn't just happen
  setTimeout(() => {
    if (!isDragging.value) {
      handleOpenRecipe(scheduled)
    }
  }, 50)
}

function handleRecipeListClick(recipe) {
  // Only open if we're not dragging
  if (isDragging.value) {
    return
  }
  // Use a small delay to ensure drag didn't just happen
  setTimeout(() => {
    if (!isDragging.value && recipe.dishId) {
      const recipeId = recipe._id
      const dishId = recipe.dishId
      // Try to find which book contains this dish for navigation
      const findBookAndNavigate = async () => {
        try {
          await recipeBooksStore.fetchBooks()
          const bookWithDish = recipeBooksStore.books.find(book => 
            book.dishes && book.dishes.includes(dishId)
          )
          if (bookWithDish) {
            router.push(`/recipe/${dishId}?book=${bookWithDish._id}&recipe=${recipeId}`)
          } else {
            router.push(`/recipe/${dishId}?recipe=${recipeId}`)
          }
        } catch (err) {
          console.warn('Failed to find book for dish, navigating without book:', err)
          router.push(`/recipe/${dishId}?recipe=${recipeId}`)
        }
      }
      findBookAndNavigate()
    }
  }, 50)
}

function handleRemoveScheduled(scheduledRecipeId) {
  removeScheduled(scheduledRecipeId)
}


function handleDragOver(event) {
  event.preventDefault()
  // Check if we're dragging a scheduled item (move) or snapshot (copy)
  // Can't read dataTransfer.getData during dragover, so check refs instead
  if (draggedItem.value) {
    event.dataTransfer.dropEffect = 'move'
  } else if (draggedRecipe.value) {
    event.dataTransfer.dropEffect = 'copy'
  } else {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragEnter(event) {
  event.preventDefault()
  // Check refs to determine drop effect
  if (draggedItem.value) {
    event.dataTransfer.dropEffect = 'move'
  } else if (draggedRecipe.value) {
    event.dataTransfer.dropEffect = 'copy'
  } else {
    event.dataTransfer.dropEffect = 'copy'
  }
}

async function removeScheduled(scheduledRecipeId) {
  pendingDeleteScheduledId.value = scheduledRecipeId
  showDeleteScheduledDialog.value = true
}

function confirmRemoveScheduled() {
  const scheduledRecipeId = pendingDeleteScheduledId.value
  if (!scheduledRecipeId) return
  
  // Find the scheduled item to get its recipe and date
  const scheduledItem = scheduledRecipesData.value.find(
    item => item.scheduledRecipe._id === scheduledRecipeId
  )
  
  // Check if it's a pending 'add' update (match by recipe+date since adds don't have scheduledRecipe ID yet)
  let pendingAddIndex = -1
  if (scheduledItem && scheduledRecipeId.startsWith('pending-')) {
    // This is a pending add - match by recipe and date
    pendingAddIndex = calendarStore.pendingUpdates.findIndex(
      u => u.type === 'add' && 
           u.recipe === scheduledItem.recipe && 
           u.date === scheduledItem.date
    )
  }
  
  // Check if it's a pending 'move' update
  const pendingMoveIndex = calendarStore.pendingUpdates.findIndex(
    u => u.type === 'move' && u.oldScheduledRecipe === scheduledRecipeId
  )
  
  if (pendingAddIndex !== -1) {
    // Remove from pending updates (was just added, not saved yet)
    calendarStore.pendingUpdates.splice(pendingAddIndex, 1)
  } else if (pendingMoveIndex !== -1) {
    // Cancel the move and add delete instead
    // IMPORTANT: Use the original scheduledRecipe ID from the move, not the current one
    const moveUpdate = calendarStore.pendingUpdates[pendingMoveIndex]
    calendarStore.pendingUpdates.splice(pendingMoveIndex, 1)
    // Use the oldScheduledRecipe from the move to ensure we delete the correct item
    calendarStore.addPendingUpdate({
      type: 'delete',
      scheduledRecipe: moveUpdate.oldScheduledRecipe
    })
  } else {
    // Add to pending deletes
    calendarStore.addPendingUpdate({
      type: 'delete',
      scheduledRecipe: scheduledRecipeId
    })
  }
  
  // Update local state
  scheduledRecipesData.value = scheduledRecipesData.value.filter(
    item => item.scheduledRecipe._id !== scheduledRecipeId
  )
  
  pendingDeleteScheduledId.value = null
}

async function submitUpdates() {
  submitting.value = true
  error.value = ''
  
  try {
    await calendarStore.submitPendingUpdates()
    // Try to reload data, but don't fail if it times out
    // The save already succeeded, so pending updates are cleared
    try {
      await loadData()
    } catch (loadErr) {
      console.warn('Failed to reload calendar data after save (save succeeded):', loadErr)
      // Don't show error - the save worked, just refresh failed
    }
    // Force reactivity update to ensure UI reflects cleared pending updates
    await nextTick()
    // Double-check that pending updates are cleared
    if (calendarStore.pendingUpdates.length > 0) {
      console.warn('Pending updates still exist after save, forcing clear')
      calendarStore.clearPendingUpdates()
      await nextTick()
    }
  } catch (err) {
    // Only show error if the actual save operations failed
    error.value = err.message || 'Failed to save changes'
    console.error('Failed to submit updates:', err)
  } finally {
    submitting.value = false
  }
}

function clearPendingUpdates() {
  showClearPendingDialog.value = true
}

function confirmClearPendingUpdates() {
  calendarStore.clearPendingUpdates()
  loadData()
}

function updateRecipePanelHeight() {
  nextTick(() => {
    if (calendarWrapperRef.value && recipePanelRef.value) {
      const calendarHeight = calendarWrapperRef.value.offsetHeight
      recipePanelHeight.value = `${calendarHeight}px`
    }
  })
}

onMounted(() => {
  loadData()
  updateRecipePanelHeight()
})

watch(() => currentDate.value, () => {
  updateRecipePanelHeight()
})

// Reload data when navigating to this route (in case recipes were updated)
watch(() => route.path, (newPath, oldPath) => {
  if (newPath === '/calendar' && oldPath && oldPath !== newPath) {
    console.log('Calendar route activated - reloading data to get latest recipe defaults')
    loadData()
    updateRecipePanelHeight()
  } else if (oldPath === '/calendar' && newPath !== '/calendar') {
    // User is leaving the calendar page - clear pending updates
    console.log('Leaving calendar page - clearing pending updates')
    calendarStore.clearPendingUpdates()
  }
})

// Also reload when component is activated (works with Vue Router keep-alive)
onActivated(() => {
  console.log('Calendar component activated - reloading data to get latest recipe defaults')
  loadData()
  updateRecipePanelHeight()
})

// Clear pending updates when component is unmounted (user navigates away)
onBeforeUnmount(() => {
  console.log('Calendar component unmounting - clearing pending updates')
  calendarStore.clearPendingUpdates()
})

// Touch panning and zoom handlers for mobile
function handleTouchStart(e) {
  if (e.touches.length === 1) {
    isPanning.value = true
    isZooming.value = false
    startX.value = e.touches[0].clientX
    startY.value = e.touches[0].clientY
    initialPanX.value = panX.value
    initialPanY.value = panY.value
  } else if (e.touches.length === 2) {
    isPanning.value = false
    isZooming.value = true
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    initialDistance.value = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    )
    initialZoom.value = zoom.value
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 2 && isZooming.value) {
    e.preventDefault()
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    )
    const scale = currentDistance / initialDistance.value
    zoom.value = Math.max(0.5, Math.min(2, initialZoom.value * scale))
  } else if (isPanning.value && e.touches.length === 1) {
    e.preventDefault()
    const deltaX = e.touches[0].clientX - startX.value
    const deltaY = e.touches[0].clientY - startY.value
    
    panX.value = initialPanX.value + deltaX
    panY.value = initialPanY.value + deltaY
  }
}

function handleTouchEnd(e) {
  if (e.touches.length === 0) {
    isPanning.value = false
    isZooming.value = false
  } else if (e.touches.length === 1) {
    isZooming.value = false
    isPanning.value = true
    startX.value = e.touches[0].clientX
    startY.value = e.touches[0].clientY
    initialPanX.value = panX.value
    initialPanY.value = panY.value
  }
}

</script>

<style scoped>
.calendar-container {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  border-bottom: 2px solid var(--color-dark-brown);
  padding-bottom: 1rem;
  margin-bottom: 2rem;
  color: var(--color-dark-brown);
  text-align: center;
  font-size: 2rem;
}

.loading, .error {
  text-align: center;
  padding: 1rem;
  color: var(--color-dark-brown);
}

.error {
  color: #d32f2f;
}

.calendar-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.nav-month {
  padding: 0.5rem 1rem;
  background-color: var(--color-light-brown);
  color: var(--color-dark-brown);
  border-radius: 4px;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.nav-month:hover {
  background-color: var(--color-gold);
}

.current-month {
  color: var(--color-dark-brown);
  font-size: 1.5rem;
}

.calendar-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.calendar-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Allow shrinking */
}

.calendar-wrapper {
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  flex: 1;
  min-width: 0; /* Allow shrinking */
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background-color: var(--color-light-brown);
  overflow: visible; /* Allow hover effects to show */
}

.calendar-day {
  background-color: var(--color-cream);
  min-height: 120px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible; /* Allow hover scale to show */
}

.calendar-day.other-month {
  background-color: #f5f5f5;
  opacity: 0.6;
}

.calendar-day.today {
  background-color: var(--color-gold);
  font-weight: 600;
}

.day-number {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-dark-brown);
  margin-bottom: 0.5rem;
}

.day-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  overflow-x: visible;
}

.scheduled-item {
  background-color: var(--color-medium-brown);
  color: white;
  padding: 0.4rem 0.5rem;
  padding-top: 0.25rem;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  word-break: break-word;
  position: relative;
  user-select: none;
}

.scheduled-item[draggable="true"] {
  cursor: grab;
}

.scheduled-item[draggable="true"]:active {
  cursor: grabbing;
}

.scheduled-item:hover {
  background-color: var(--color-dark-brown);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.scheduled-item.dragging {
  background-color: #800020 !important; /* Maroon red */
  opacity: 0.8;
  transform: scale(0.95);
  cursor: grabbing;
}

.scheduled-recipe-name {
  font-weight: 600;
  font-size: 0.9rem;
  padding-right: 1.5rem;
}

.scheduled-snapshot-name {
  font-size: 0.8rem;
  opacity: 0.9;
  margin-top: 0.15rem;
}

.remove-recipe-btn {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0;
  transition: all 0.2s;
  flex-shrink: 0;
  z-index: 10;
}

.remove-recipe-btn:hover {
  background-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.15);
}


.empty-day {
  font-size: 0.75rem;
  color: var(--color-medium-brown);
  font-style: italic;
  text-align: center;
  padding: 0.5rem;
}

.snapshot-panel {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.snapshot-panel h3 {
  color: var(--color-dark-brown);
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.no-snapshots {
  color: var(--color-medium-brown);
  text-align: center;
  padding: 1rem;
}

.snapshot-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0; /* Allow scrolling */
  padding-right: 0.5rem; /* Space for scrollbar */
}

/* Custom scrollbar styling */
.snapshot-list::-webkit-scrollbar {
  width: 8px;
}

.snapshot-list::-webkit-scrollbar-track {
  background: var(--color-cream);
  border-radius: 4px;
}

.snapshot-list::-webkit-scrollbar-thumb {
  background: var(--color-medium-brown);
  border-radius: 4px;
}

.snapshot-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-dark-brown);
}

.snapshot-option {
  background-color: var(--color-cream);
  border: 2px solid var(--color-light-brown);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.snapshot-option:hover {
  background-color: var(--color-gold);
  border-color: var(--color-medium-brown);
}

.snapshot-option:active {
  cursor: grabbing;
}

.snapshot-option-recipe {
  font-weight: 600;
  color: var(--color-dark-brown);
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.snapshot-option-name {
  color: var(--color-dark-brown);
  margin-bottom: 0.15rem;
  font-size: 0.85rem;
}

.snapshot-option-date {
  font-size: 0.75rem;
  color: var(--color-medium-brown);
  font-style: italic;
}


/* Use :deep() to ensure styles apply when teleported, or make it global */
.batch-controls,
:deep(.batch-controls) {
  position: fixed !important;
  bottom: 2rem !important;
  right: 2rem !important;
  left: auto !important;
  top: auto !important;
  background-color: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 99999 !important; /* Extremely high z-index to ensure it stays on top and fixed */
  pointer-events: auto; /* Ensure it's clickable */
  transform: none !important; /* Ensure no transform affects positioning */
}

.pending-count {
  color: var(--color-dark-brown);
  font-weight: 600;
}

.submit-updates-btn,
.clear-updates-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}

.submit-updates-btn {
  background-color: var(--color-medium-brown);
  color: white;
}

.submit-updates-btn:hover:not(:disabled) {
  background-color: var(--color-dark-brown);
}

.submit-updates-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-updates-btn {
  background-color: var(--color-light-brown);
  color: var(--color-dark-brown);
}

.clear-updates-btn:hover {
  background-color: var(--color-gold);
}

@media (max-width: 768px) {
  .calendar-container {
    padding: 0;
    overflow: hidden;
    position: relative;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .page-title {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--color-cream);
    padding: 1rem;
    margin: 0;
    border-bottom: 2px solid var(--color-dark-brown);
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
    transform-origin: top left;
  }
  
  .panable-container:active {
    cursor: grabbing;
  }
  
  .calendar-layout {
    width: max-content;
    min-width: 800px;
    padding: 1rem;
  }
  
  .calendar-day {
    min-height: 80px;
    padding: 0.25rem;
  }
  
  .scheduled-item {
    font-size: 0.75rem;
    padding: 0.3rem 0.4rem;
  }
  
  .recipe-list {
    flex-direction: column;
  }
  
  .batch-controls {
    bottom: 1rem;
    right: 1rem;
    left: auto; /* Keep it in bottom right even on mobile */
    flex-direction: column;
    padding: 1rem;
    max-width: calc(100vw - 2rem); /* Don't overflow screen */
  }
  
  .calendar-controls {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>

<style>
/* Global styles for batch-controls overlay at bottom right */
/* Filter moved from body to #app, so body no longer creates containing block */
.batch-controls-overlay {
  position: fixed !important;
  bottom: 2rem !important;
  right: 2rem !important;
  left: auto !important;
  top: auto !important;
  width: auto !important;
  height: auto !important;
  z-index: 2147483647 !important; /* Maximum z-index */
  pointer-events: none !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  transform: none !important;
  filter: none !important;
  perspective: none !important;
}

.batch-controls-content {
  background-color: white !important;
  padding: 1rem 1.5rem !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  display: flex !important;
  align-items: center !important;
  gap: 1rem !important;
  pointer-events: auto !important;
  margin: 0 !important;
  white-space: nowrap !important;
  position: relative !important;
}
</style>

