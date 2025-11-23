<template>
  <div id="app">
    <Navbar v-if="isAuthenticated" />
    <router-view />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import Navbar from './components/Navbar.vue'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

onMounted(async () => {
  // Validate token on app mount
  if (localStorage.getItem('user') && localStorage.getItem('token')) {
    await authStore.validateToken()
  }
})
</script>

<style scoped>
#app {
  min-height: 100vh;
  background-color: #FED8B1;
}
</style>

