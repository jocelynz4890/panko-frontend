<template>
  <div class="calendar-container">
    <h1 class="page-title">Cooking Scheduling Calendar</h1>
    
    <div v-if="loading" class="loading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div class="calendar-layout">
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
              @click.stop="handleScheduledClick($event, scheduled.scheduledRecipe._id)"
              :title="`${scheduled.dishName} - ${scheduled.recipeName || 'Default'}`"
            >
              <div class="scheduled-recipe-name">{{ scheduled.dishName }}</div>
              <div class="scheduled-snapshot-name">{{ scheduled.recipeName || 'Default' }}</div>
              <div class="remove-hint">click to remove</div>
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
            :title="`Drag to calendar to schedule: ${recipe.dishName} - ${recipe.name || 'Default'}`"
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
        <button @click="clearPendingUpdates" class="clear-updates-btn">Clear</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, watch, onActivated, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useCalendarStore } from '../stores/calendar'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useRecipesStore } from '../stores/recipes'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
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
    
    // Load all recipes from all dishes
    const allRecipes = []
    for (const book of recipeBooksStore.books) {
      if (book.dishes && book.dishes.length > 0) {
        for (const dishId of book.dishes) {
          try {
            // Always fetch fresh dish data
            if (recipesStore.currentDish?._id === dishId) {
              recipesStore.currentDish = null
            }
            await recipesStore.fetchDish(dishId)
            const dish = recipesStore.currentDish
            if (dish && dish.recipes && dish.recipes.length > 0) {
              // Fetch all recipes for this dish
              await recipesStore.fetchRecipes(dishId)
              
              // Add each recipe to the list
              for (const recipe of recipesStore.recipes) {
                allRecipes.push({
                  _id: recipe._id,
                  dishId: dish._id,
                  dishName: dish.name,
                  name: recipe.subname || null,
                  date: recipe.date || null
                })
              }
            }
          } catch (err) {
            console.error(`Failed to load dish ${dishId}:`, err)
          }
        }
      }
    }
    // Sort recipes by date (newest first)
    allRecipes.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0)
      const dateB = b.date ? new Date(b.date) : new Date(0)
      return dateB - dateA
    })
    availableRecipes.value = allRecipes
    
    // Build scheduled recipes data with dish names
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
          recipe: scheduled.recipe
        })
      } else {
        // If recipe not found, mark for lookup
        scheduledRecipesData.value.push({
          scheduledRecipe: scheduled,
          dishName: 'Loading...',
          recipeName: null,
          date: normalizedDate,
          recipe: scheduled.recipe,
          needsLookup: true
        })
      }
    }
    
    // Lookup recipes that weren't found in the initial load
    for (const item of scheduledRecipesData.value) {
      if (item.needsLookup) {
        // Search through recipe books to find this recipe
        let found = false
        for (const book of recipeBooksStore.books) {
          if (book.dishes && book.dishes.length > 0) {
            for (const dishId of book.dishes) {
              try {
                await recipesStore.fetchRecipes(dishId)
                const recipe = recipesStore.recipes.find(r => r._id === item.recipe)
                if (recipe) {
                  await recipesStore.fetchDish(dishId)
                  const dish = recipesStore.currentDish
                  if (dish) {
                    item.dishName = dish.name
                    item.recipeName = recipe.subname || 'Untitled'
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
        if (!found) {
          item.dishName = 'Unknown Dish'
          item.recipeName = 'Unknown Recipe'
        }
        delete item.needsLookup
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
    const date = new Date(dateString)
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
        recipe: recipeId
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

function handleScheduledClick(event, scheduledRecipeId) {
  // Prevent click if we just finished dragging
  if (isDragging.value) {
    return
  }
  // Use a small delay to ensure drag didn't just happen
  setTimeout(() => {
    if (!isDragging.value) {
      removeScheduled(scheduledRecipeId)
    }
  }, 50)
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
  if (confirm('Remove this scheduled recipe?')) {
    // Check if it's a pending update
    const pendingIndex = calendarStore.pendingUpdates.findIndex(
      u => u.type === 'add' && u.scheduledRecipe === scheduledRecipeId
    )
    
    if (pendingIndex !== -1) {
      // Remove from pending updates
      calendarStore.pendingUpdates.splice(pendingIndex, 1)
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
  }
}

async function submitUpdates() {
  submitting.value = true
  error.value = ''
  
  try {
    await calendarStore.submitPendingUpdates()
    await loadData()
  } catch (err) {
    error.value = err.message || 'Failed to save changes'
  } finally {
    submitting.value = false
  }
}

function clearPendingUpdates() {
  if (confirm('Clear all pending changes?')) {
    calendarStore.clearPendingUpdates()
    loadData()
  }
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
  }
})

// Also reload when component is activated (works with Vue Router keep-alive)
onActivated(() => {
  console.log('Calendar component activated - reloading data to get latest recipe defaults')
  loadData()
  updateRecipePanelHeight()
})
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
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: move;
  transition: all 0.2s;
  word-break: break-word;
  position: relative;
}

.scheduled-item:hover {
  background-color: var(--color-dark-brown);
}

.scheduled-item:active {
  cursor: grabbing;
}

.scheduled-item.dragging {
  background-color: #800020 !important; /* Maroon red */
  opacity: 0.8;
  transform: scale(0.95);
}

.scheduled-recipe-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.scheduled-snapshot-name {
  font-size: 0.8rem;
  opacity: 0.9;
  margin-top: 0.15rem;
}

.remove-hint {
  font-size: 0.7rem;
  opacity: 0.7;
  font-style: italic;
  margin-top: 0.25rem;
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
  cursor: grab;
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

