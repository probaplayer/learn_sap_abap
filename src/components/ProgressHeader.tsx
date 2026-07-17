import { Link } from 'react-router-dom'
import { useProgress } from '../state/ProgressContext'

export function ProgressHeader() {
  const { progress, level } = useProgress()

  return (
    <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
      <Link to="/" className="font-extrabold text-xl text-green-600 dark:text-green-400">
        🎓 SAP Quest
      </Link>
      <div className="flex items-center gap-4 font-bold text-sm">
        <span title="Cấp độ">🏅 Lv.{level}</span>
        <span title="Tổng XP">⚡ {progress.xp} XP</span>
        <span title="Chuỗi ngày học liên tiếp">🔥 {progress.streak}</span>
        <Link to="/wiki" className="text-sky-600 dark:text-sky-400 hover:underline">
          📖 Wiki
        </Link>
        <Link to="/lab" className="text-sky-600 dark:text-sky-400 hover:underline">
          🧪 Code Lab
        </Link>
      </div>
    </header>
  )
}
