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

