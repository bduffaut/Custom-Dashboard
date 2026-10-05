<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { ShieldBan, X } from 'lucide-vue-next'
import WidgetCard from './WidgetCard.vue'

// Manual IP blocklist saved into the widget props with updateProps, so it survives a reload
// Shows that typing and clicking never drag the widget

const props = withDefaults(defineProps<{ ips?: string[] }>(), { ips: () => [] })
const { updateProps } = useWidget()

const draft = ref('')
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([12]?\d|3[0-2]))?$/
const valid = computed(() => IPV4.test(draft.value.trim()))
const duplicate = computed(() => props.ips.includes(draft.value.trim()))

function block() {
  if (!valid.value || duplicate.value) return
  updateProps({ ips: [draft.value.trim(), ...props.ips] })
  draft.value = ''
}

function unblock(ip: string) {
  updateProps({ ips: props.ips.filter((i) => i !== ip) })
}
</script>

<template>
  <WidgetCard title="Firewall blocklist" :icon="ShieldBan">
    <div class="fw">
      <form class="fw__form" @submit.prevent="block">
        <input v-model="draft" class="w-input mono" placeholder="185.220.101.4 or a /24 range" aria-label="IP address to block" />
        <button class="w-btn w-btn--danger" type="submit" :disabled="!valid || duplicate">Block</button>
      </form>
      <p v-if="draft && !valid" class="fw__hint">Enter an IPv4 address, optionally with a CIDR suffix.</p>
      <p v-else-if="duplicate" class="fw__hint">Already blocked.</p>
      <ul class="fw__list">
        <li v-for="ip in ips" :key="ip">
          <span class="fw__ip mono"><span class="fw__dot" />{{ ip }}</span>
          <button class="fw__remove" :title="`Unblock ${ip}`" @click="unblock(ip)"><X :size="13" /></button>
        </li>
        <li v-if="!ips.length" class="fw__empty">No manual blocks.</li>
      </ul>
    </div>
  </WidgetCard>
</template>

<style scoped>
.fw {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fw__form {
  display: flex;
  gap: 6px;
}

.fw__form input {
  flex: 1;
}

.fw__ip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fw__dot {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--critical);
  box-shadow: 0 0 6px rgb(208 59 59 / 0.7);
}

.fw__list li {
  transition: background 0.15s;
}

.fw__list li:hover {
  background: rgb(255 255 255 / 0.025);
}

.fw__hint {
  margin: 0;
  font-size: 11px;
  color: var(--warning);
}

.fw__list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.fw__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 2px;
  border-bottom: 1px solid var(--grid-line);
  font-size: 13px;
}

.fw__remove {
  display: grid;
  place-items: center;
  padding: 3px;
  border: none;
  background: none;
  color: var(--text-faint);
}

.fw__remove:hover {
  color: var(--critical);
}

.fw__empty {
  color: var(--text-faint);
  justify-content: center !important;
}
</style>
