import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { findExercise } from '../content/lab'
import { EXERCISE_CATEGORIES } from '../content/lab/types'
import type { ExerciseDifficulty } from '../content/lab/types'
import { findTableAnyModule } from '../content'
import { AbapCodeBlock } from '../components/AbapCodeBlock'
import { lintAbap } from '../lib/abapLint'
import type { LintIssue } from '../lib/abapLint'

const DIFFICULTY_LABEL: Record<ExerciseDifficulty, string> = {
  basic: 'Cơ bản',
  intermediate: 'Trung bình',
  advanced: 'Nâng cao',
}

function TableBadge({ tableId }: { tableId: string }) {
  const found = findTableAnyModule(tableId)
  const className =
    'rounded-full px-3 py-1 text-sm font-mono font-bold ' +
    (found
      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
      : 'bg-slate-100 dark:bg-slate-700')
  if (found) {
    return (
      <Link to={`/wiki/${found.module}/${found.id}`} className={className}>
        {tableId}
      </Link>
    )
  }
  return <span className={className}>{tableId}</span>
}

export function LabDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const exercise = exerciseId ? findExercise(exerciseId) : undefined

  const [mainTab, setMainTab] = useState<'code' | 'explain'>('code')
  const [fileIndex, setFileIndex] = useState(0)
  const [runResult, setRunResult] = useState<LintIssue[] | null>(null)

  if (!exercise) {
    return (
      <main className="p-8 text-center">
        <p className="mb-4">Không tìm thấy bài tập.</p>
        <Link to="/lab" className="text-sky-600 dark:text-sky-400 hover:underline">
          ← Quay lại Code Lab
        </Link>
      </main>
    )
  }

  const activeFile = exercise.files[fileIndex]

  function selectFile(idx: number) {
    setFileIndex(idx)
    setRunResult(null)
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/lab" className="text-sky-600 dark:text-sky-400 hover:underline text-sm">
        ← Quay lại Code Lab
      </Link>
      <div className="flex items-center justify-between gap-2 mt-2 mb-1">
        <h1 className="text-2xl font-extrabold">{exercise.title}</h1>
        <span className="shrink-0 text-xs rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1">
          {DIFFICULTY_LABEL[exercise.difficulty]}
        </span>
      </div>
      <p className="text-slate-500 dark:text-slate-400 mb-6">{EXERCISE_CATEGORIES[exercise.category]}</p>

      <div className="flex gap-2 mb-4 border-b-2 border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setMainTab('code')}
          className={`px-4 py-2 font-extrabold ${
            mainTab === 'code'
              ? 'border-b-4 border-green-500 text-green-600 dark:text-green-400'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          📝 Code
        </button>
        <button
          onClick={() => setMainTab('explain')}
          className={`px-4 py-2 font-extrabold ${
            mainTab === 'explain'
              ? 'border-b-4 border-green-500 text-green-600 dark:text-green-400'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          📖 Giải thích
        </button>
      </div>

      {mainTab === 'code' && (
        <div>
          {exercise.files.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {exercise.files.map((f, idx) => (
                <button
                  key={f.filename}
                  onClick={() => selectFile(idx)}
                  className={`text-xs font-mono rounded-lg px-3 py-1.5 border-2 ${
                    idx === fileIndex
                      ? 'border-sky-400 bg-sky-50 dark:bg-sky-950'
                      : 'border-slate-200 dark:border-slate-600'
                  }`}
                >
                  {f.filename}
                </button>
              ))}
            </div>
          )}

          <AbapCodeBlock code={activeFile.code} />

          <button
            onClick={() => setRunResult(lintAbap(activeFile.code))}
            className="mt-3 rounded-xl bg-sky-500 text-white font-extrabold uppercase tracking-wide px-5 py-2.5 hover:bg-sky-600"
          >
            ▶ Chạy thử
          </button>

          {runResult && (
            <div className="mt-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 p-4">
              <h3 className="font-extrabold mb-2">1. Kiểm tra cú pháp</h3>
              {runResult.length === 0 ? (
                <p className="text-green-600 dark:text-green-400 font-semibold">
                  ✅ Không phát hiện lỗi cân bằng khối / cú pháp cơ bản.
                </p>
              ) : (
                <ul className="space-y-1 mb-2">
                  {runResult.map((issue, i) => (
                    <li
                      key={i}
                      className={
                        issue.severity === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {issue.severity === 'error' ? '❌' : '⚠️'} Dòng {issue.line}: {issue.message}
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="font-extrabold mb-2 mt-4">2. Kết quả minh họa</h3>
              <div className="md-content">
                <ReactMarkdown>{exercise.sampleOutput}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {mainTab === 'explain' && (
        <div className="space-y-6">
          <section>
            <h2 className="font-extrabold text-lg mb-1">Đề bài</h2>
            <p>{exercise.problemStatement}</p>
          </section>

          <section>
            <h2 className="font-extrabold text-lg mb-2">Kỹ thuật ABAP chính</h2>
            <div className="flex flex-wrap gap-2">
              {exercise.concepts.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-3 py-1 text-sm font-semibold"
                >
                  {c}
                </span>
              ))}
            </div>
          </section>

          {exercise.tablesUsed.length > 0 && (
            <section>
              <h2 className="font-extrabold text-lg mb-2">Bảng / cấu trúc dữ liệu</h2>
              <div className="flex flex-wrap gap-2">
                {exercise.tablesUsed.map((t) => (
                  <TableBadge key={t} tableId={t} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-extrabold text-lg mb-2">Giải thích từng bước</h2>
            <div className="md-content">
              <ReactMarkdown>{exercise.walkthrough}</ReactMarkdown>
            </div>
          </section>

          {exercise.relatedExerciseIds.length > 0 && (
            <section>
              <h2 className="font-extrabold text-lg mb-2">Bài liên quan</h2>
              <div className="flex flex-wrap gap-2">
                {exercise.relatedExerciseIds.map((id) => {
                  const related = findExercise(id)
                  if (!related) return null
                  return (
                    <Link
                      key={id}
                      to={`/lab/${id}`}
                      className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                      {related.title}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}
