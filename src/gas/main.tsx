import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import GasApp from './GasApp'
import './gas.css'
import { getGasInitialRoute, normalizeGasBootstrap } from '../lib/gasBootstrap'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root tidak ditemukan.')

const bootstrap = normalizeGasBootstrap(window.__JN_BOOT__)
if (bootstrap.token) {
  sessionStorage.setItem('jn.customer.access-token', bootstrap.token)
}
if (bootstrap.page !== 'home') {
  const route = getGasInitialRoute(bootstrap)
  if (window.location.hash !== '#' + route) {
    window.location.hash = route
  }
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <GasApp />
    </HashRouter>
  </React.StrictMode>,
)
