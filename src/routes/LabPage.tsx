import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXERCISES } from '../content/lab'
import { EXERCISE_CATEGORIES } from '../content/lab/types'
import type { ExerciseCategory, ExerciseDifficulty } from '../content/lab/types'

const DIFFICULTY_LABEL: Record<ExerciseDifficulty, string> = {
  basic: 'Cơ bản',
  intermediate: 'Trung bình',
  advanced: 'Nâng cao',
}

export function LabPage() {
  const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | 'all'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<ExerciseDifficulty | 'all'>('all')

  const filtered = useMemo(
    () =>
      EXERCISES.filter(
        (ex) =>
          (categoryFilter === 'all' || ex.category === categoryFilter) &&
          (difficultyFilter === 'all' || ex.difficulty === difficultyFilter),
      ),
    [categoryFilter, difficultyFilter],
  )

  const grouped = useMemo(() => {
    const map = new Map<ExerciseCategory, typeof EXERCISES>()
    for (const ex of filtered) {
      const list = map.get(ex.category) ?? []
      list.push(ex)
      map.set(ex.category, list)
    }
    return map
  }, [filtered])

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-2">🧪 Code Lab</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        Thư viện bài tập ABAP thật — xem code, đọc đề bài suy luận ngược, và chạy thử kiểm tra cú pháp.
      </p>

      <div className="flex flex-wrap gap-3 mb-8">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExerciseCategory | 'all')}
          className="rounded-lg border-2 border-slate-200 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-800"
        >
          <option value="all">Tất cả chủ đề</option>
          {Object.entries(EXERCISE_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value as ExerciseDifficulty | 'all')}
          className="rounded-lg border-2 border-slate-200 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-800"
        >
          <option value="all">Mọi độ khó</option>
          <option value="basic">Cơ bản</option>
          <option value="intermediate">Trung bình</option>
          <option value="advanced">Nâng cao</option>
        </select>
      </div>

      {Array.from(grouped.entries()).map(([category, exercises]) => (
        <section key={category} className="mb-8">
          <h2 className="text-xl font-extrabold mb-3">{EXERCISE_CATEGORIES[category]}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exercises.map((ex) => (
              <Link
                key={ex.id}
                to={`/lab/${ex.id}`}
                className="rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 py-3 hover:border-sky-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-bold">{ex.title}</p>
                  <span className="shrink-0 text-xs rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5">
                    {DIFFICULTY_LABEL[ex.difficulty]}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{ex.problemStatement}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && <p className="text-slate-500">Không có bài tập nào khớp bộ lọc.</p>}
    </main>
  )
}
