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
    if (!authStore.user) return
    
    loading.value = true
    error.value = null
    try {
      const response = await recipeBookAPI.getBooks(authStore.user)
      books.value = response.data
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
      currentBook.value = response.data[0]
      return currentBook.value
    } catch (err) {
      error.value = err.message || 'Failed to fetch recipe book'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createBook(name, coverIndex) {
    if (!authStore.user) return null
    
    loading.value = true
    error.value = null
    try {
      const response = await recipeBookAPI.createRecipeBook(authStore.user, name, coverIndex)
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

  async function addRecipeToBook(recipeId, bookId) {
    loading.value = true
    error.value = null
    try {
      await recipeBookAPI.addRecipeToBook(recipeId, bookId)
      // Reload the current book if it's the one we're modifying
      if (currentBook.value && currentBook.value._id === bookId) {
        await fetchBook(bookId)
      }
    } catch (err) {
      error.value = err.message || 'Failed to add recipe to book'
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
    addRecipeToBook
  }
})

