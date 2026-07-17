import { Link } from 'react-router-dom'
import { MODULE_ORDER, MODULES, getLessonIds } from '../content'
import { lessonKey } from '../state/progress'
import { useProgress } from '../state/ProgressContext'
import type { Track } from '../content/types'

const TRACKS: Track[] = ['syntax', 'business']

// Alternating left/center/right alignment gives the single path its
// Duolingo-style zigzag while staying simple flexbox (no SVG, no risk of
// overflow on narrow phones).
const ZIGZAG = ['self-center', 'self-start', 'self-end', 'self-start', 'self-end']

function useModuleProgress(moduleId: (typeof MODULE_ORDER)[number]) {
  const { progress } = useProgress()
  const lessonIds = TRACKS.flatMap((track) => getLessonIds(moduleId, track).map((id) => lessonKey(moduleId, track, id)))
  const completed = lessonIds.filter((key) => progress.completedLessons.includes(key)).length
  return { completed, total: lessonIds.length }
}

function RoadmapNode({ moduleId, isSuggestedNext }: { moduleId: (typeof MODULE_ORDER)[number]; isSuggestedNext: boolean }) {
  const mod = MODULES[moduleId]
  const { completed, total } = useModuleProgress(moduleId)
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const done = percent === 100

  return (
    <Link to={`/module/${moduleId}`} className="flex flex-col items-center gap-2 w-32 sm:w-36">
      <div className="relative">
        {isSuggestedNext && !done && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 text-white text-[10px] font-extrabold px-2 py-0.5 shadow">
            BẮT ĐẦU ĐÂY
          </span>
        )}
        <div
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-3xl sm:text-4xl transition-transform hover:scale-105"
          style={{ backgroundColor: done ? '#ffc800' : mod.color }}
        >
          {mod.icon}
        </div>
      </div>
      <p className="font-extrabold text-center text-sm sm:text-base">{mod.shortName}</p>
      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-green-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {completed}/{total} bài {done && '· Hoàn thành 🎉'}
      </p>
    </Link>
  )
}

export function MapPage() {
  const { progress } = useProgress()

  const suggestedNextId =
    MODULE_ORDER.find((id) => {
      const lessonIds = TRACKS.flatMap((track) => getLessonIds(id, track).map((lid) => lessonKey(id, track, lid)))
      return lessonIds.some((key) => !progress.completedLessons.includes(key))
    }) ?? MODULE_ORDER[0]

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-2 text-center">Lộ trình học SAP</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-10 text-center">
        Thứ tự gợi ý bên dưới — nhưng bạn có thể bấm vào module bất kỳ, không bị khóa.
      </p>

      <div className="relative flex flex-col items-center gap-14">
        <div className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-1 bg-slate-200 dark:bg-slate-700 rounded-full -z-10" />
        {MODULE_ORDER.map((id, idx) => (
          <div key={id} className={`flex ${ZIGZAG[idx % ZIGZAG.length]}`}>
            <RoadmapNode moduleId={id} isSuggestedNext={id === suggestedNextId} />
          </div>
        ))}
      </div>
    </main>
  )
}
