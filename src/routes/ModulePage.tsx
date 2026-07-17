import { useNavigate, useParams } from 'react-router-dom'
import type { ModuleId, Track } from '../content/types'
import { MODULES, getLessons } from '../content'
import { lessonKey } from '../state/progress'
import { useProgress } from '../state/ProgressContext'
import { MapNode } from '../components/MapNode'
import type { NodeState } from '../components/MapNode'

const TRACK_LABEL: Record<Track, string> = {
  syntax: '⌨️ Cú pháp ABAP',
  business: '💼 Nghiệp vụ',
}

function TrackPath({ moduleId, track }: { moduleId: ModuleId; track: Track }) {
  const navigate = useNavigate()
  const { progress, isLessonUnlocked } = useProgress()
  const lessons = getLessons(moduleId, track)
  const lessonIds = lessons.map((l) => l.id)

  return (
    <div className="flex-1">
      <h3 className="font-extrabold text-lg mb-4 text-center">{TRACK_LABEL[track]}</h3>
      <div className="flex flex-col items-center gap-6">
        {lessons.map((lesson) => {
          const key = lessonKey(moduleId, track, lesson.id)
          const unlocked = isLessonUnlocked(moduleId, track, lessonIds, lesson.id)
          const done = progress.completedLessons.includes(key)
          const perfect = progress.perfectLessons.includes(key)

          let state: NodeState = 'locked'
          if (perfect) state = 'perfect'
          else if (done) state = 'completed'
          else if (unlocked) state = 'unlocked'

          return (
            <div key={lesson.id} className="flex flex-col items-center gap-1">
              <MapNode
                label={lesson.title}
                state={state}
                onClick={() => navigate(`/lesson/${moduleId}/${track}/${lesson.id}`)}
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center w-24">
                {lesson.title}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: ModuleId }>()
  const navigate = useNavigate()
  const { reviewQuestionIds } = useProgress()

  if (!moduleId || !MODULES[moduleId]) {
    return <main className="p-8 text-center">Không tìm thấy module.</main>
  }

  const mod = MODULES[moduleId]
  const reviewCount = reviewQuestionIds(moduleId).length

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2 flex-wrap">
          <span>{mod.icon}</span> <span>{mod.name}</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{mod.businessPurpose}</p>
      </div>

      <div className="flex flex-col items-center gap-2 mb-8">
        <MapNode
          label="Ôn tập"
          state={reviewCount > 0 ? 'unlocked' : 'locked'}
          icon="🔁"
          onClick={() => reviewCount > 0 && navigate(`/lesson/${moduleId}/syntax/review`)}
        />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          🔁 Ôn tập {reviewCount > 0 ? `(${reviewCount})` : ''}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-10 sm:gap-8">
        <TrackPath moduleId={moduleId} track="syntax" />
        <TrackPath moduleId={moduleId} track="business" />
      </div>
    </main>
  )
}
