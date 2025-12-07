<template>
  <Teleport to="body">
    <div v-if="show" class="confirm-dialog-overlay" @click.self="handleCancel">
      <div class="confirm-dialog">
        <h3 class="confirm-dialog-title">{{ title }}</h3>
        <p class="confirm-dialog-message">{{ message }}</p>
        <div class="confirm-dialog-buttons">
          <button @click="handleCancel" class="cancel-btn">{{ cancelText }}</button>
          <button @click="handleConfirm" class="confirm-btn" :class="{ 'danger': danger }">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Confirm'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  danger: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['confirm', 'cancel', 'update:show'])

function handleConfirm() {
  emit('confirm')
  emit('update:show', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:show', false)
}

// Close on Escape key
const handleEscape = (e) => {
  if (e.key === 'Escape' && props.show) {
    handleCancel()
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    window.addEventListener('keydown', handleEscape)
  } else {
    window.removeEventListener('keydown', handleEscape)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.confirm-dialog {
  background-color: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.confirm-dialog-title {
  color: var(--color-dark-brown);
  font-size: 1.5rem;
  margin: 0 0 1rem 0;
  font-weight: 600;
}

.confirm-dialog-message {
  color: var(--color-dark-brown);
  font-size: 1rem;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
}

.confirm-dialog-buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.cancel-btn,
.confirm-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
}

.cancel-btn {
  background-color: var(--color-light-brown);
  color: var(--color-dark-brown);
}

.cancel-btn:hover {
  background-color: var(--color-gold);
}

.confirm-btn {
  background-color: var(--color-medium-brown);
  color: white;
}

.confirm-btn:hover {
  background-color: var(--color-dark-brown);
}

.confirm-btn.danger {
  background-color: #d32f2f;
  color: white;
}

.confirm-btn.danger:hover {
  background-color: #b71c1c;
}
</style>

