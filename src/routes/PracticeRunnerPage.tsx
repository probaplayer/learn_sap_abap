import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findGeneratedSet } from '../content/generated'
import { useProgress } from '../state/ProgressContext'
import { QuestionCard } from '../components/QuestionCard'

export function PracticeRunnerPage() {
  const { setId } = useParams<{ setId: string }>()
  const set = setId ? findGeneratedSet(setId) : undefined
  const { recordPracticeAnswer } = useProgress()

  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const xpEarnedRef = useRef(0)

  if (!set) {
    return (
      <main className="p-8 text-center">
        <p className="mb-4">Không tìm thấy bộ luyện tập này.</p>
        <Link to="/practice" className="text-sky-600 dark:text-sky-400 hover:underline">
          ← Quay lại luyện tập
        </Link>
      </main>
    )
  }

  function handleAnswered(correct: boolean) {
    xpEarnedRef.current += recordPracticeAnswer(correct)

    if (index + 1 < set!.questions.length) {
      setIndex((prev) => prev + 1)
      return
    }
    setFinished(true)
  }

  if (finished) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold mb-4">🎉 Hoàn thành!</h1>
        <p className="text-lg font-bold text-amber-500 mb-6">+{xpEarnedRef.current} XP</p>
        <Link
          to="/practice"
          className="inline-block rounded-xl bg-green-500 text-white font-extrabold uppercase tracking-wide px-6 py-3 hover:bg-green-600"
        >
          Quay lại luyện tập
        </Link>
      </main>
    )
  }

  return (
    <main className="px-4 py-8">
      <div className="max-w-xl mx-auto mb-4">
        <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(index / set.questions.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Câu {index + 1}/{set.questions.length}
        </p>
      </div>
      <QuestionCard key={set.questions[index].id} question={set.questions[index]} onAnswered={handleAnswered} />
    </main>
  )
}
