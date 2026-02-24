import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PaperDetail from './pages/PaperDetail'

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/paper/:id" element={<PaperDetail />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
