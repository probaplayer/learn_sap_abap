import { useNavigate, useParams } from 'react-router-dom'
import type { ModuleId } from '../content/types'
import { MODULES, getLessons } from '../content'
import { lessonKey } from '../state/progress'
import { useProgress } from '../state/ProgressContext'
import { MapNode } from '../components/MapNode'
import type { NodeState } from '../components/MapNode'

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: ModuleId }>()
  const navigate = useNavigate()
  const { progress, isLessonUnlocked, reviewQuestionIds } = useProgress()

  if (!moduleId || !MODULES[moduleId]) {
    return <main className="p-8 text-center">Không tìm thấy module.</main>
  }

  const mod = MODULES[moduleId]
  const reviewCount = reviewQuestionIds(moduleId).length
  const lessons = getLessons(moduleId)
  const lessonIds = lessons.map((l) => l.id)

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
          onClick={() => reviewCount > 0 && navigate(`/lesson/${moduleId}/review`)}
        />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          🔁 Ôn tập {reviewCount > 0 ? `(${reviewCount})` : ''}
        </span>
      </div>

      <div className="flex flex-col items-center gap-6">
        {lessons.map((lesson) => {
          const key = lessonKey(moduleId, lesson.id)
          const unlocked = isLessonUnlocked(moduleId, lessonIds, lesson.id)
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
                onClick={() => navigate(`/lesson/${moduleId}/${lesson.id}`)}
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center w-24">
                {lesson.title}
              </span>
            </div>
          )
        })}
      </div>
    </main>
  )
}
