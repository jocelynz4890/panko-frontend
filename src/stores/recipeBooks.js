// Pinia store responsible for managing recipe books for the authenticated user.
// Exposes reactive state for the list of books, the currently selected book,
// and async actions for fetching, creating, editing, and deleting books.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { recipeBookAPI } from '../api/api'
import { useAuthStore } from './auth'

export const useRecipeBooksStore = defineStore('recipeBooks', () => {
  const books = ref([])
  const currentBook = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const authStore = useAuthStore()

  /**
   * Load all recipe books that belong to the current authenticated user.
   * Uses the recipeBookAPI service to retrieve data from the backend.
   *
   * @returns {Promise<void>}
   */
  async function fetchBooks() {
    if (!authStore.token) return
    
    loading.value = true
    error.value = null
    try {
      const response = await recipeBookAPI.getBooks(null)
      books.value = response.data.books || response.data
    } catch (err) {
      error.value = err.message || 'Failed to fetch recipe books'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single recipe book by its id and set it as the currentBook.
   * Some backend responses wrap the book in a "books" array; this function
   * normalizes that shape to always expose a single book object.
   *
   * @param {string} bookId - The id of the recipe book to load.
   * @returns {Promise<object|null>} The loaded book object, if found.
   */
  async function fetchBook(bookId) {
    loading.value = true
    error.value = null
    try {
      const response = await recipeBookAPI.getBook(bookId)
      console.log('fetchBook response:', response.data)
      const books = response.data.books || response.data
      const book = Array.isArray(books) ? books[0] : books
      console.log('Extracted book:', book)
      console.log('Book dishes:', book?.dishes)
      currentBook.value = book
      return currentBook.value
    } catch (err) {
      error.value = err.message || 'Failed to fetch recipe book'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new recipe book with the given name and cover index, then
   * refresh the list of books so the UI stays in sync with the backend.
   *
   * @param {string} name - Display name for the new recipe book.
   * @param {number} coverIndex - Index of the cover asset to use.
   * @returns {Promise<object|null>} The created book from the backend.
   */
  async function createBook(name, coverIndex) {
    if (!authStore.token) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await recipeBookAPI.createRecipeBook(null, name, coverIndex)
      await fetchBooks()
      return response.data.book
    } catch (err) {
      error.value = err.message || 'Failed to create recipe book'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a recipe book by id and refresh the list of books afterwards.
   *
   * @param {string} bookId - The id of the book to delete.
   * @returns {Promise<void>}
   */
  async function deleteBook(bookId) {
    loading.value = true
    error.value = null
    try {
      await recipeBookAPI.deleteRecipeBook(bookId)
      await fetchBooks()
    } catch (err) {
      error.value = err.message || 'Failed to delete recipe book'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Rename an existing recipe book. If the renamed book is currently
   * selected, keep the local currentBook state in sync with the server.
   *
   * @param {string} bookId - The id of the book to rename.
   * @param {string} newName - The new name to assign.
   * @returns {Promise<void>}
   */
  async function editBookName(bookId, newName) {
    loading.value = true
    error.value = null
    try {
      await recipeBookAPI.editRecipeBookName(bookId, newName)
      await fetchBooks()
      // Update current book if it's the one being edited
      if (currentBook.value && currentBook.value._id === bookId) {
        currentBook.value.name = newName
      }
    } catch (err) {
      error.value = err.message || 'Failed to rename recipe book'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a dish to a specific recipe book. If that book is currently open,
   * it is re-fetched so that its list of dishes stays up to date.
   *
   * @param {string} dishId - The id of the dish being added.
   * @param {string} bookId - The id of the book that will contain the dish.
   * @returns {Promise<void>}
   */
  async function addDishToBook(dishId, bookId) {
    loading.value = true
    error.value = null
    try {
      await recipeBookAPI.addDishToBook(dishId, bookId)
      // Reload the current book if it's the one we're modifying
      if (currentBook.value && currentBook.value._id === bookId) {
        await fetchBook(bookId)
      }
    } catch (err) {
      error.value = err.message || 'Failed to add dish to book'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    books,
    currentBook,
    loading,
    error,
    fetchBooks,
    fetchBook,
    createBook,
    deleteBook,
    editBookName,
    addDishToBook
  }
})

