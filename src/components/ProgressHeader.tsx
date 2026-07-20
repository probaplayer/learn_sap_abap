import { Link } from 'react-router-dom'
import { useProgress } from '../state/ProgressContext'
import type { ProgressState } from '../state/types'

function downloadProgressExport(progress: ProgressState) {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sap-quest-progress.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function ProgressHeader() {
  const { progress, level } = useProgress()

  return (
    <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <Link to="/" className="font-extrabold text-lg sm:text-xl text-green-600 dark:text-green-400 shrink-0">
        🎓 <span className="hidden sm:inline">SAP Quest</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4 font-bold text-xs sm:text-sm">
        <span title="Cấp độ">🏅 Lv.{level}</span>
        <span title="Tổng XP">⚡ {progress.xp}</span>
        <span title="Chuỗi ngày học liên tiếp">🔥 {progress.streak}</span>
        <button
          onClick={() => downloadProgressExport(progress)}
          title="Xuất tiến trình học (dùng với MCP server + Claude Desktop)"
          className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
        >
          ⬇️ <span className="hidden sm:inline">Xuất</span>
        </button>
        <Link to="/wiki" className="text-sky-600 dark:text-sky-400 hover:underline" title="Wiki">
          📖 <span className="hidden sm:inline">Wiki</span>
        </Link>
        <Link to="/lab" className="text-sky-600 dark:text-sky-400 hover:underline" title="Code Lab">
          🧪 <span className="hidden sm:inline">Code Lab</span>
        </Link>
        <Link to="/practice" className="text-sky-600 dark:text-sky-400 hover:underline" title="Luyện tập cá nhân hóa">
          🎯 <span className="hidden sm:inline">Luyện tập</span>
        </Link>
      </div>
    </header>
  )
}
