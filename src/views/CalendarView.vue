<template>
  <div class="calendar-container">
    <h1 class="page-title">Meal Planning Calendar</h1>
    
    <div v-if="loading" class="loading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div class="calendar-controls">
      <button @click="previousMonth" class="nav-month">← Previous</button>
      <h2 class="current-month">{{ currentMonthYear }}</h2>
      <button @click="nextMonth" class="nav-month">Next →</button>
    </div>
    
    <div class="calendar-wrapper">
      <div class="calendar-grid">
        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="calendar-day"
          :class="{ 'other-month': !day.isCurrentMonth, 'today': day.isToday }"
          @drop="handleDrop($event, day.date)"
          @dragover.prevent
          @dragenter.prevent
        >
          <div class="day-number">{{ day.day }}</div>
          <div class="day-content">
            <div
              v-for="scheduled in getScheduledForDay(day.date)"
              :key="scheduled.scheduledRecipe._id"
              class="scheduled-item"
              :draggable="true"
              @dragstart="handleDragStart($event, scheduled)"
              @click="removeScheduled(scheduled.scheduledRecipe._id)"
              :title="`${scheduled.recipeName} - ${scheduled.snapshotName || 'Default'}`"
            >
              {{ scheduled.recipeName }}
              <span class="remove-hint">(click to remove)</span>
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
    
    <!-- Recipe Selection Panel -->
    <div class="recipe-panel">
      <h3>Add Recipe to Calendar</h3>
      <div v-if="availableRecipes.length === 0" class="no-recipes">
        No recipes available. Create recipes in your recipe books first.
      </div>
      <div v-else class="recipe-list">
        <div
          v-for="recipe in availableRecipes"
          :key="recipe._id"
          class="recipe-option"
          :draggable="true"
          @dragstart="handleDragStartRecipe($event, recipe)"
        >
          <div class="recipe-option-name">{{ recipe.name }}</div>
          <div class="recipe-option-snapshot" v-if="recipe.defaultSnapshotName">
            {{ recipe.defaultSnapshotName }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Batch Update Controls -->
    <div v-if="hasPendingUpdates" class="batch-controls">
      <div class="pending-count">{{ pendingUpdatesCount }} pending changes</div>
      <button @click="submitUpdates" class="submit-updates-btn" :disabled="submitting">
        {{ submitting ? 'Saving...' : 'Save Changes' }}
      </button>
      <button @click="clearPendingUpdates" class="clear-updates-btn">Clear</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCalendarStore } from '../stores/calendar'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useRecipesStore } from '../stores/recipes'
import { useAuthStore } from '../stores/auth'

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
  return scheduledRecipesData.value.filter(item => item.date === date)
}

async function loadData() {
  loading.value = true
  error.value = ''
  
  try {
    // Load scheduled recipes
    await calendarStore.fetchScheduledRecipes()
    
    // Load all recipe books and their recipes
    await recipeBooksStore.fetchBooks()
    
    // Load recipes and snapshots
    const allRecipes = []
    for (const book of recipeBooksStore.books) {
      if (book.recipes && book.recipes.length > 0) {
        for (const recipeId of book.recipes) {
          try {
            await recipesStore.fetchRecipe(recipeId)
            const recipe = recipesStore.currentRecipe
            if (recipe) {
              let defaultSnapshotName = null
              if (recipe.defaultSnapshot) {
                await recipesStore.fetchSnapshots(recipeId)
                const snapshot = recipesStore.snapshots.find(s => s._id === recipe.defaultSnapshot)
                if (snapshot) {
                  defaultSnapshotName = snapshot.subname || 'Default'
                }
              }
              allRecipes.push({
                _id: recipe._id,
                name: recipe.name,
                defaultSnapshot: recipe.defaultSnapshot,
                defaultSnapshotName
              })
            }
          } catch (err) {
            console.error(`Failed to load recipe ${recipeId}:`, err)
          }
        }
      }
    }
    availableRecipes.value = allRecipes
    
    // Build scheduled recipes data with recipe names
    scheduledRecipesData.value = []
    
    // First, try to match by default snapshots
    for (const scheduled of calendarStore.scheduledRecipes) {
      const recipe = allRecipes.find(r => r.defaultSnapshot === scheduled.snapshot)
      if (recipe) {
        scheduledRecipesData.value.push({
          scheduledRecipe: scheduled,
          recipeName: recipe.name,
          snapshotName: recipe.defaultSnapshotName,
          date: scheduled.date,
          snapshot: scheduled.snapshot
        })
      } else {
        // Mark for later lookup
        scheduledRecipesData.value.push({
          scheduledRecipe: scheduled,
          recipeName: 'Loading...',
          snapshotName: null,
          date: scheduled.date,
          snapshot: scheduled.snapshot,
          needsLookup: true
        })
      }
    }
    
    // Lookup recipes for snapshots not found by default
    for (const item of scheduledRecipesData.value) {
      if (item.needsLookup) {
        let found = false
        for (const r of allRecipes) {
          try {
            await recipesStore.fetchRecipe(r._id)
            const recipeData = recipesStore.currentRecipe
            if (recipeData && recipeData.snapshots && recipeData.snapshots.includes(item.snapshot)) {
              await recipesStore.fetchSnapshots(r._id)
              const snapshot = recipesStore.snapshots.find(s => s._id === item.snapshot)
              if (snapshot) {
                item.recipeName = r.name
                item.snapshotName = snapshot.subname || 'Untitled'
                found = true
                break
              }
            }
          } catch (err) {
            // Continue searching
          }
        }
        if (!found) {
          item.recipeName = 'Unknown Recipe'
        }
        delete item.needsLookup
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to load calendar data'
  } finally {
    loading.value = false
  }
}

function handleDragStart(event, scheduled) {
  draggedItem.value = scheduled
  event.dataTransfer.effectAllowed = 'move'
}

function handleDragStartRecipe(event, recipe) {
  draggedRecipe.value = recipe
  event.dataTransfer.effectAllowed = 'copy'
}

async function handleDrop(event, date) {
  event.preventDefault()
  
  if (draggedItem.value) {
    // Moving existing scheduled item
    if (draggedItem.value.date !== date) {
      calendarStore.addPendingUpdate({
        type: 'move',
        oldScheduledRecipe: draggedItem.value.scheduledRecipe._id,
        snapshot: draggedItem.value.snapshot,
        newDate: date
      })
      
      // Update local state immediately
      draggedItem.value.date = date
      scheduledRecipesData.value = [...scheduledRecipesData.value]
    }
  } else if (draggedRecipe.value) {
    // Adding new recipe
    if (draggedRecipe.value.defaultSnapshot) {
      calendarStore.addPendingUpdate({
        type: 'add',
        snapshot: draggedRecipe.value.defaultSnapshot,
        date: date
      })
      
      // Add to local state immediately
      scheduledRecipesData.value.push({
        scheduledRecipe: { _id: 'pending-' + Date.now(), snapshot: draggedRecipe.value.defaultSnapshot, date },
        recipeName: draggedRecipe.value.name,
        snapshotName: draggedRecipe.value.defaultSnapshotName,
        date: date,
        snapshot: draggedRecipe.value.defaultSnapshot
      })
    }
  }
  
  draggedItem.value = null
  draggedRecipe.value = null
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

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.calendar-container {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  color: var(--color-dark-brown);
  margin-bottom: 2rem;
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
  margin-bottom: 2rem;
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

.calendar-wrapper {
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background-color: var(--color-light-brown);
}

.calendar-day {
  background-color: var(--color-cream);
  min-height: 120px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  position: relative;
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
}

.scheduled-item:hover {
  background-color: var(--color-dark-brown);
  transform: scale(1.02);
}

.scheduled-item:active {
  cursor: grabbing;
}

.remove-hint {
  font-size: 0.7rem;
  opacity: 0.8;
  display: block;
  margin-top: 0.25rem;
}

.empty-day {
  font-size: 0.75rem;
  color: var(--color-medium-brown);
  font-style: italic;
  text-align: center;
  padding: 0.5rem;
}

.recipe-panel {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.recipe-panel h3 {
  color: var(--color-dark-brown);
  margin-bottom: 1rem;
}

.recipe-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.recipe-option {
  background-color: var(--color-cream);
  border: 2px solid var(--color-light-brown);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  cursor: grab;
  transition: all 0.2s;
  min-width: 150px;
}

.recipe-option:hover {
  background-color: var(--color-gold);
  border-color: var(--color-medium-brown);
  transform: translateY(-2px);
}

.recipe-option:active {
  cursor: grabbing;
}

.recipe-option-name {
  font-weight: 600;
  color: var(--color-dark-brown);
  margin-bottom: 0.25rem;
}

.recipe-option-snapshot {
  font-size: 0.85rem;
  color: var(--color-medium-brown);
  font-style: italic;
}

.no-recipes {
  color: var(--color-medium-brown);
  font-style: italic;
  padding: 1rem;
  text-align: center;
}

.batch-controls {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background-color: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 100;
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
    left: 1rem;
    flex-direction: column;
    padding: 1rem;
  }
  
  .calendar-controls {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>

