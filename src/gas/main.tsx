import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import GasApp from './GasApp'
import './gas/gas.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root tidak ditemukan.')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <GasApp />
    </HashRouter>
  </React.StrictMode>,
)
