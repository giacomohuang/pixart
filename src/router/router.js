import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // scrollBehavior(to, from, savedPosition) {
  //   return { top: 0 }
  // },
  routes: [
    // { path: '/approval/edit', name: 'approval_edit', component: () => import('@/views/Approval/ApprovalEditView.vue') },
    // { path: '/org/edit', name: 'org_edit', component: () => import('@/views/Org/OrgEditView.vue') },
    { path: '/', name: 'editor', component: () => import('@/views/Editor.vue') }

    // {
    //   path: '/about',
    //   name: 'about',
    //   // route level code-splitting
    //   // this generates a separate chunk (About.[hash].js) for this route
    //   // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/about.vue')
    // }
  ]
})
