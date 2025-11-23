import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authAPI } from '../api/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(null)
  const username = ref('')

  const isAuthenticated = computed(() => !!user.value && !!token.value)

  function setAuth(userId, authToken, userUsername) {
    user.value = userId
    token.value = authToken
    username.value = userUsername
    localStorage.setItem('user', userId)
    localStorage.setItem('token', authToken)
    localStorage.setItem('username', userUsername)
  }

  function clearAuth() {
    user.value = null
    token.value = null
    username.value = ''
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    localStorage.removeItem('username')
  }

  async function login(username, password) {
    try {
      const response = await authAPI.authenticate(username, password)
      console.log('Login response:', response)
      console.log('Login response.data:', response.data)
      console.log('Login response.data type:', typeof response.data)
      console.log('Login response.data keys:', response.data ? Object.keys(response.data) : 'null')
      
      // The response should be a direct object from the API
      const data = response.data
      
      if (!data) {
        console.error('No data in response')
        return { success: false, error: 'No response from server' }
      }
      
      if (data.error) {
        return { success: false, error: data.error }
      }
      
      // Check for user in the response
      const userId = data.user || data.userId || data._id
      
      console.log('Extracted userId:', userId)
      
      if (!userId) {
        console.error('Missing user ID in response. Response structure:', JSON.stringify(data, null, 2))
        return { success: false, error: 'Invalid response from server: missing user ID' }
      }
      
      // The authenticate endpoint only returns user, not token
      // We need to create a session separately to get the token
      console.log('Creating session for user:', userId)
      try {
        const sessionResponse = await authAPI.createSession(userId)
        console.log('Session response:', sessionResponse.data)
        const sessionData = sessionResponse.data
        
        if (sessionData.error) {
          return { success: false, error: sessionData.error }
        }
        
        const authToken = sessionData.token
        if (!authToken) {
          return { success: false, error: 'Failed to create session: no token returned' }
        }
        
        setAuth(userId, authToken, username)
        return { success: true }
      } catch (sessionError) {
        console.error('Failed to create session:', sessionError)
        return { success: false, error: sessionError.message || 'Failed to create session' }
      }
    } catch (error) {
      console.error('Login error:', error)
      console.error('Login error response:', error.response)
      return { success: false, error: error.message || 'Login failed' }
    }
  }

  async function register(username, password) {
    try {
      const response = await authAPI.register(username, password)
      console.log('Register response:', response)
      console.log('Register response.data:', response.data)
      console.log('Register response.data type:', typeof response.data)
      console.log('Register response.data keys:', response.data ? Object.keys(response.data) : 'null')
      
      // The response should be a direct object from the API
      const data = response.data
      
      if (!data) {
        console.error('No data in register response')
        return { success: false, error: 'No response from server' }
      }
      
      if (data.error) {
        return { success: false, error: data.error }
      }
      
      const userId = data.user
      
      console.log('Extracted userId from register:', userId)
      
      if (!userId) {
        console.error('Missing user ID in register response. Response structure:', JSON.stringify(data, null, 2))
        return { success: false, error: 'Invalid response from server: missing user ID' }
      }
      
      // After registration, automatically log in
      const loginResult = await login(username, password)
      if (loginResult.success) {
        return { success: true }
      }
      return loginResult
    } catch (error) {
      console.error('Register error:', error)
      console.error('Register error response:', error.response)
      return { success: false, error: error.message || 'Registration failed' }
    }
  }

  async function validateToken() {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    const storedUsername = localStorage.getItem('username')
    
    if (!storedUser || !storedToken) {
      clearAuth()
      return false
    }

    try {
      // Try validateToken first (API spec format)
      try {
        const response = await authAPI.validateToken(storedUser, storedToken)
        const data = response.data
        if (data.error) {
          throw new Error(data.error)
        }
        setAuth(storedUser, storedToken, storedUsername || '')
        return true
      } catch (err) {
        // If validateToken fails, try validateSession (concept method)
        console.log('validateToken failed, trying validateSession')
        const response = await authAPI.validateSession(storedToken)
        const data = response.data
        if (data.error) {
          throw new Error(data.error)
        }
        // Verify the user matches
        if (data.user !== storedUser) {
          throw new Error('Token user mismatch')
        }
        setAuth(storedUser, storedToken, storedUsername || '')
        return true
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      clearAuth()
      return false
    }
  }

  function logout() {
    clearAuth()
  }

  // Initialize from localStorage on store creation
  const storedUser = localStorage.getItem('user')
  const storedToken = localStorage.getItem('token')
  const storedUsername = localStorage.getItem('username')
  if (storedUser && storedToken) {
    user.value = storedUser
    token.value = storedToken
    username.value = storedUsername || ''
  }

  return {
    user,
    token,
    username,
    isAuthenticated,
    login,
    register,
    validateToken,
    logout
  }
})

