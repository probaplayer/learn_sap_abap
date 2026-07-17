import { HashRouter, Route, Routes } from 'react-router-dom'
import { ProgressProvider } from './state/ProgressContext'
import { ProgressHeader } from './components/ProgressHeader'
import { MapPage } from './routes/MapPage'
import { ModulePage } from './routes/ModulePage'
import { LessonPage } from './routes/LessonPage'
import { WikiPage } from './routes/WikiPage'
import { WikiDetailPage } from './routes/WikiDetailPage'
import { LabPage } from './routes/LabPage'
import { LabDetailPage } from './routes/LabDetailPage'

function App() {
  return (
    <ProgressProvider>
      <HashRouter>
        <ProgressHeader />
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/module/:moduleId" element={<ModulePage />} />
          <Route path="/lesson/:moduleId/:track/:lessonId" element={<LessonPage />} />
          <Route path="/wiki" element={<WikiPage />} />
          <Route path="/wiki/:moduleId/:tableId" element={<WikiDetailPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/lab/:exerciseId" element={<LabDetailPage />} />
        </Routes>
      </HashRouter>
    </ProgressProvider>
  )
}

export default App
