<template>
  <nav class="navbar">
    <div class="navbar-left">
      <img src="/assets/panko_logo.png" alt="Panko Logo" class="logo" />
      <span class="username">{{ username }}</span>
    </div>
    <div class="navbar-right">
      <button @click="$router.push('/')" class="nav-button">Home</button>
      <button @click="$router.push('/calendar')" class="nav-button">Calendar</button>
      <button @click="handleSignOut" class="nav-button">Sign Out</button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = computed(() => authStore.username)

function handleSignOut() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: var(--color-medium-brown);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  height: 40px;
  width: auto;
}

.username {
  font-size: 1.1rem;
  color: var(--color-cream);
  font-weight: 500;
}

.navbar-right {
  display: flex;
  gap: 1rem;
}

.nav-button {
  padding: 0.5rem 1rem;
  background-color: var(--color-light-brown);
  color: var(--color-dark-brown);
  border-radius: 4px;
  font-size: 0.95rem;
  transition: background-color 0.2s;
}

.nav-button:hover {
  background-color: var(--color-gold);
}

@media (max-width: 768px) {
  .navbar {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
  }
  
  .logo {
    height: 30px;
  }
  
  .username {
    font-size: 0.9rem;
  }
  
  .nav-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }
}
</style>

