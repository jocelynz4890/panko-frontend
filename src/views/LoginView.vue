<template>
  <div class="login-container">
    <div class="login-card">
      <img src="/assets/panko_logo.png" alt="Panko Logo" class="login-logo" />
      <h1>{{ isLogin ? "Let's cook up some memories!" : 'Start your recipe journey' }}</h1>
      
      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            placeholder="Enter your username"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            placeholder="Enter your password"
            minlength="6"
          />
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <button type="submit" class="submit-button" :disabled="loading">
          {{ loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up') }}
        </button>
      </form>
      
      <div class="toggle-section">
        <span>{{ isLogin ? "Don't have an account?" : 'Already have an account?' }}</span>
        <button @click="toggleMode" class="toggle-button">
          {{ isLogin ? 'Sign Up' : 'Log In' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function toggleMode() {
  isLogin.value = !isLogin.value
  error.value = ''
  username.value = ''
  password.value = ''
}

async function handleSubmit() {
  error.value = ''
  loading.value = true
  
  try {
    console.log('Submitting:', isLogin.value ? 'login' : 'register', username.value)
    const result = isLogin.value
      ? await authStore.login(username.value, password.value)
      : await authStore.register(username.value, password.value)
    
    console.log('Auth result:', result)
    
    if (result.success) {
      console.log('Authentication successful, redirecting...')
      console.log('Auth state:', {
        user: authStore.user,
        token: authStore.token,
        username: authStore.username,
        isAuthenticated: authStore.isAuthenticated
      })
      // Wait for next tick to ensure reactive state is updated
      await nextTick()
      // Use replace instead of push to avoid back button issues
      router.replace('/')
    } else {
      error.value = result.error || 'Authentication failed'
      console.error('Authentication failed:', result.error)
    }
  } catch (err) {
    console.error('Submit error:', err)
    error.value = err.message || 'An error occurred'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-cream);
  padding: 2rem;
}

.login-card {
  background-color: white;
  padding: 3rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-logo {
  height: 120px;
  width: auto;
  margin-bottom: 1.5rem;
}

h1 {
  color: var(--color-dark-brown);
  margin-bottom: 2rem;
  font-size: 1.8rem;
}

.login-form {
  text-align: left;
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
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-medium-brown);
}

.error-message {
  color: #d32f2f;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #ffebee;
  border-radius: 4px;
  font-size: 0.9rem;
}

.submit-button {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--color-medium-brown);
  color: white;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  transition: background-color 0.2s;
  margin-top: 1rem;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--color-dark-brown);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-light-brown);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--color-dark-brown);
}

.toggle-button {
  color: var(--color-medium-brown);
  text-decoration: underline;
  font-weight: 500;
  padding: 0;
  background: none;
}

.toggle-button:hover {
  color: var(--color-dark-brown);
}

@media (max-width: 480px) {
  .login-card {
    padding: 2rem 1.5rem;
  }
}
</style>

