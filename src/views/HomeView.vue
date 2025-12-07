<template>
  <div class="home-container">
    <h1 class="page-title">My Recipe Books</h1>
    
    <div v-if="loading" class="loading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div class="books-grid">
      <div
        v-for="book in books"
        :key="book._id"
        class="book-card"
      >
        <div class="book-cover" @click="openBook(book._id)">
          <img :src="getBookCover(book)" :alt="book.name" />
        </div>
        <div class="book-name" @click="openBook(book._id)">{{ book.name }}</div>
        <div class="book-actions">
          <button 
            class="action-button rename-button" 
            @click.stop="handleRenameClick(book)"
            title="Rename book"
          >
            <img src="/assets/pencil.png" alt="Rename" class="action-icon" />
          </button>
          <button 
            class="action-button delete-button" 
            @click.stop="handleDeleteClick(book)"
            title="Delete book"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div class="book-card add-book" @click="showAddBookModal = true">
        <div class="add-button">
          <img src="/assets/plus_sign.png" alt="Add" class="plus-icon" />
        </div>
        <div class="book-name">Add Book</div>
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
        <p>Are you sure you want to delete "{{ bookToDelete?.name }}"? This action cannot be undone.</p>
        
        <div v-if="deleteError" class="error-message">{{ deleteError }}</div>
        
        <div class="modal-actions">
          <button type="button" @click="closeDeleteModal" class="cancel-button">Cancel</button>
          <button type="button" @click="handleDeleteBook" :disabled="deleting" class="submit-button delete-confirm-button">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Add Book Modal -->
    <div v-if="showAddBookModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>Create New Recipe Book</h2>
        <form @submit.prevent="handleCreateBook">
          <div class="form-group">
            <label for="bookName">Book Name</label>
            <input
              id="bookName"
              v-model="newBookName"
              type="text"
              required
              placeholder="Enter book name"
              maxlength="50"
            />
          </div>
          
          <div class="form-group">
            <label>Select Cover</label>
            <div class="cover-carousel">
              <div
                v-for="(cover, index) in bookCovers"
                :key="index"
                class="cover-option"
                :class="{ selected: selectedCoverIndex === index }"
                @click="selectedCoverIndex = index"
              >
                <img :src="cover" :alt="`Cover ${index + 1}`" />
              </div>
            </div>
          </div>
          
          <div v-if="createError" class="error-message">{{ createError }}</div>
          
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="cancel-button">Cancel</button>
            <button type="submit" :disabled="creating" class="submit-button">
              {{ creating ? 'Creating...' : 'Create Book' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeBooksStore } from '../stores/recipeBooks'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const recipeBooksStore = useRecipeBooksStore()
const authStore = useAuthStore()

const showAddBookModal = ref(false)
const newBookName = ref('')
const selectedCoverIndex = ref(0)
const createError = ref('')
const creating = ref(false)

const showRenameModal = ref(false)
const renameBookName = ref('')
const bookToRename = ref(null)
const renameError = ref('')
const renaming = ref(false)

const showDeleteModal = ref(false)
const bookToDelete = ref(null)
const deleteError = ref('')
const deleting = ref(false)

// Dynamically load book covers from /assets/covers folder
const bookCovers = ref([])

async function loadBookCovers() {
  // In a Vite app, we can use import.meta.glob to dynamically import all covers
  const coverModules = import.meta.glob('/assets/covers/*.png', { eager: true })
  const covers = []
  
  for (const path in coverModules) {
    const module = coverModules[path]
    if (module.default) {
      covers.push(module.default)
    }
  }
  
  // Sort covers by filename to ensure consistent order
  covers.sort()
  bookCovers.value = covers
}

const books = computed(() => recipeBooksStore.books)
const loading = computed(() => recipeBooksStore.loading)
const error = computed(() => recipeBooksStore.error)

function getBookCover(book) {
  // Use the stored coverIndex if available, otherwise fall back to hash
  let index = 0
  if (book.coverIndex !== undefined && book.coverIndex !== null) {
    index = book.coverIndex
  } else if (book._id) {
    index = parseInt(book._id.slice(-1), 16) % bookCovers.value.length
  }
  // Ensure index is within bounds
  if (index < 0 || index >= bookCovers.value.length) {
    index = 0
  }
  return bookCovers.value[index]
}

function openBook(bookId) {
  router.push(`/book/${bookId}`)
}

function closeModal() {
  showAddBookModal.value = false
  newBookName.value = ''
  selectedCoverIndex.value = 0
  createError.value = ''
}

function handleRenameClick(book) {
  bookToRename.value = book
  renameBookName.value = book.name
  renameError.value = ''
  showRenameModal.value = true
}

function closeRenameModal() {
  showRenameModal.value = false
  renameBookName.value = ''
  bookToRename.value = null
  renameError.value = ''
}

async function handleRenameBook() {
  if (!bookToRename.value || !renameBookName.value.trim()) {
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
    await recipeBooksStore.editBookName(bookToRename.value._id, renameBookName.value.trim())
    closeRenameModal()
  } catch (err) {
    renameError.value = err.message || 'Failed to rename book'
  } finally {
    renaming.value = false
  }
}

function handleDeleteClick(book) {
  bookToDelete.value = book
  deleteError.value = ''
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  bookToDelete.value = null
  deleteError.value = ''
}

async function handleDeleteBook() {
  if (!bookToDelete.value) return
  
  deleting.value = true
  deleteError.value = ''
  
  try {
    await recipeBooksStore.deleteBook(bookToDelete.value._id)
    closeDeleteModal()
  } catch (err) {
    deleteError.value = err.message || 'Failed to delete book'
  } finally {
    deleting.value = false
  }
}

async function handleCreateBook() {
  if (!newBookName.value.trim()) {
    createError.value = 'Please enter a book name'
    return
  }
  
  creating.value = true
  createError.value = ''
  
  try {
    await recipeBooksStore.createBook(newBookName.value.trim(), selectedCoverIndex.value)
    closeModal()
  } catch (err) {
    createError.value = err.message || 'Failed to create book'
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  loadBookCovers()
  if (authStore.isAuthenticated) {
    await recipeBooksStore.fetchBooks()
  }
})
</script>

<style scoped>
.home-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  color: var(--color-dark-brown);
  margin-bottom: 2rem;
  font-size: 2rem;
  text-align: center;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  color: var(--color-dark-brown);
}

.error {
  color: #d32f2f;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.book-card {
  position: relative;
  transition: transform 0.2s;
  text-align: center;
}

.book-card:hover {
  transform: translateY(-5px);
}

.book-cover {
  cursor: pointer;
}

.book-name {
  cursor: pointer;
}

.book-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.book-card:hover .book-actions {
  opacity: 1;
}

.action-button {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon {
  width: 20px;
  height: 20px;
}

.action-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.delete-confirm-button {
  background-color: #d32f2f;
}

.delete-confirm-button:hover:not(:disabled) {
  background-color: #b71c1c;
}

.book-cover {
  width: 100%;
  aspect-ratio: 3/4;
  background: transparent;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 0.5rem;
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-name {
  color: var(--color-dark-brown);
  font-size: 1rem;
  font-weight: 500;
  margin-top: 0.5rem;
}

.add-book {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  border: 2px dashed var(--color-medium-brown);
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.3);
}

.add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.add-button .plus-icon {
  width: 48px;
  height: 48px;
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
  font-size: 1.2rem;
  background-color: var(--color-cream);
  font-family: 'Caveat', cursive;
  font-weight: 500;
}

.cover-carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 1rem 0;
  scroll-snap-type: x mandatory;
  background: transparent;
}

.cover-option {
  flex-shrink: 0;
  width: 120px;
  height: 160px;
  border: 3px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  scroll-snap-align: center;
  overflow: hidden;
  background: transparent;
}

.cover-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  padding: 4px;
  box-sizing: border-box;
}

.cover-option.selected {
  border-color: var(--color-medium-brown);
  transform: scale(1.1);
  z-index: 1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

.error-message {
  color: #d32f2f;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #ffebee;
  border-radius: 4px;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .books-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1.5rem;
  }
  
  .modal-content {
    padding: 1.5rem;
  }
  
  .cover-option {
    width: 100px;
    height: 133px;
  }
}
</style>

