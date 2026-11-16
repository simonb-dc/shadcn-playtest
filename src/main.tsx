import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './index.css'
import DemoPage from '@/demo/DemoPage'

// ?theme=dark adds .dark to <html>. Default light.
const theme = new URLSearchParams(window.location.search).get('theme')
document.documentElement.classList.toggle('dark', theme === 'dark')

function ToDemo() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/demo', search }} replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/demo" element={<DemoPage />} />
        <Route path="*" element={<ToDemo />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
