import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ModuleId, QuizQuestion } from '../content/types'
import { MODULES, findQuestion, getAllLessonsByModule, getLesson } from '../content'
import { useProgress } from '../state/ProgressContext'
import { QuestionCard } from '../components/QuestionCard'

export function LessonPage() {
  const { moduleId, lessonId } = useParams<{ moduleId: ModuleId; lessonId: string }>()
  const { reviewQuestionIds, recordAnswer, completeLesson } = useProgress()

  const isReview = lessonId === 'review'

  const questions: QuizQuestion[] = useMemo(() => {
    if (!moduleId) return []
    if (isReview) {
      return reviewQuestionIds(moduleId)
        .map((qid) => findQuestion(moduleId, qid))
        .filter((q): q is QuizQuestion => Boolean(q))
    }
    if (!lessonId) return []
    return getLesson(moduleId, lessonId)?.questions ?? []
    // reviewQuestionIds intentionally excluded: pool is only read once when the lesson starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, lessonId, isReview])

  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [summary, setSummary] = useState({ xpEarned: 0, mistakeCount: 0, newBadges: [] as string[] })

  const mistakeCountRef = useRef(0)
  const xpEarnedRef = useRef(0)

  if (!moduleId || !MODULES[moduleId]) {
    return <main className="p-8 text-center">Không tìm thấy module.</main>
  }

  if (questions.length === 0) {
    return (
      <main className="p-8 text-center">
        <p className="mb-4">Không có câu hỏi nào ở đây.</p>
        <Link to={`/module/${moduleId}`} className="text-sky-600 dark:text-sky-400 hover:underline">
          ← Quay lại module
        </Link>
      </main>
    )
  }

  function handleAnswered(correct: boolean) {
    const question = questions[index]
    const xp = recordAnswer({
      moduleId: moduleId!,
      questionId: question.id,
      correct,
      isReview,
    })
    xpEarnedRef.current += xp
    if (!correct) mistakeCountRef.current += 1

    if (index + 1 < questions.length) {
      setIndex((prev) => prev + 1)
      return
    }

    let newBadges: string[] = []
    if (!isReview && lessonId) {
      const result = completeLesson({
        moduleId: moduleId!,
        lessonId,
        mistakeCount: mistakeCountRef.current,
        lessonsByModule: getAllLessonsByModule(),
      })
      xpEarnedRef.current += result.bonusXp
      newBadges = result.newlyEarnedBadges
    }
    setSummary({ xpEarned: xpEarnedRef.current, mistakeCount: mistakeCountRef.current, newBadges })
    setFinished(true)
  }

  if (finished) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold mb-4">🎉 Hoàn thành!</h1>
        <p className="text-lg mb-2">
          Đúng {questions.length - summary.mistakeCount}/{questions.length} câu
        </p>
        <p className="text-lg font-bold text-amber-500 mb-6">+{summary.xpEarned} XP</p>
        {summary.newBadges.length > 0 && (
          <div className="mb-6">
            <p className="font-bold mb-2">🏆 Huy hiệu mới:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {summary.newBadges.map((b) => (
                <span key={b} className="rounded-full bg-amber-100 dark:bg-amber-900 px-3 py-1 text-sm font-semibold">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}
        <Link
          to={`/module/${moduleId}`}
          className="inline-block rounded-xl bg-green-500 text-white font-extrabold uppercase tracking-wide px-6 py-3 hover:bg-green-600"
        >
          Quay lại module
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
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Câu {index + 1}/{questions.length}
        </p>
      </div>
      <QuestionCard key={questions[index].id} question={questions[index]} onAnswered={handleAnswered} />
    </main>
  )
}
