import { createApp } from 'vue'
// import { createPinia } from 'pinia'
import './mocks/index'

import 'element-plus/theme-chalk/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import { router } from './router/router'
import ElementPlus from 'element-plus'
// import Icon from './components/Icon.vue'

import './assets/main.css'

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
// app.use(createPinia())
app.use(ElementPlus)
app.use(router)
// app.use(Icon)

app.mount('#app')
// app.config.unwrapInjectedRef = true
