import Vue from 'vue'
import Router from 'vue-router'
import Trade from '@/components/Trade'

Vue.use(Router)

export default new Router({
  // mode: 'history',
  routes: [
    {
      path: '/',
      name: 'Trade',
      component: Trade
    }
  ]
})
