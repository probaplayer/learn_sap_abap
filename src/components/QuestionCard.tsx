import { useMemo, useState } from 'react'
import type { QuizQuestion } from '../content/types'
import { isAnswerCorrect } from '../lib/quizScoring'
import type { UserAnswer } from '../lib/quizScoring'

interface QuestionCardProps {
  question: QuizQuestion
  onAnswered: (correct: boolean) => void
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function QuestionCard({ question, onAnswered }: QuestionCardProps) {
  const [answer, setAnswer] = useState<UserAnswer | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const shuffledRightOptions = useMemo(() => {
    if (question.type !== 'matching') return []
    return shuffle(question.pairs.map((p) => p.right))
  }, [question])

  const isReady = useMemo(() => {
    if (!answer) return false
    if (answer.type === 'fill-blank') return answer.text.trim().length > 0
    if (answer.type === 'matching' && question.type === 'matching') {
      return question.pairs.every((p) => Boolean(answer.mapping[p.left]))
    }
    return true
  }, [answer, question])

  const correct = submitted && answer ? isAnswerCorrect(question, answer) : null

  function handleCheck() {
    if (!isReady) return
    setSubmitted(true)
  }

  function handleContinue() {
    onAnswered(Boolean(correct))
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-md p-6 max-w-xl w-full mx-auto">
      {question.type === 'multiple-choice' && (
        <div>
          <p className="text-lg font-bold mb-4">{question.question}</p>
          <div className="flex flex-col gap-3">
            {question.options.map((opt, idx) => {
              const isSelected = answer?.type === 'multiple-choice' && answer.selectedIndex === idx
              return (
                <button
                  key={idx}
                  disabled={submitted}
                  onClick={() => setAnswer({ type: 'multiple-choice', selectedIndex: idx })}
                  className={`text-left rounded-xl border-2 px-4 py-3 font-semibold transition-colors ${
                    isSelected
                      ? 'border-sky-400 bg-sky-50 dark:bg-sky-950'
                      : 'border-slate-200 dark:border-slate-600 hover:border-sky-300'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {question.type === 'true-false' && (
        <div>
          <p className="text-lg font-bold mb-4">{question.statement}</p>
          <div className="flex gap-3">
            {[true, false].map((val) => {
              const isSelected = answer?.type === 'true-false' && answer.selectedValue === val
              return (
                <button
                  key={String(val)}
                  disabled={submitted}
                  onClick={() => setAnswer({ type: 'true-false', selectedValue: val })}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 font-bold transition-colors ${
                    isSelected
                      ? 'border-sky-400 bg-sky-50 dark:bg-sky-950'
                      : 'border-slate-200 dark:border-slate-600 hover:border-sky-300'
                  }`}
                >
                  {val ? 'Đúng' : 'Sai'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {question.type === 'fill-blank' && (
        <div>
          <p className="text-lg font-bold mb-4">{question.prompt}</p>
          <input
            type="text"
            disabled={submitted}
            value={answer?.type === 'fill-blank' ? answer.text : ''}
            onChange={(e) => setAnswer({ type: 'fill-blank', text: e.target.value })}
            placeholder="Nhập câu trả lời..."
            className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 py-3 font-semibold focus:border-sky-400 outline-none"
          />
        </div>
      )}

      {question.type === 'matching' && (
        <div>
          <p className="text-lg font-bold mb-4">Ghép cặp cho đúng:</p>
          <div className="flex flex-col gap-3">
            {question.pairs.map((pair) => {
              const mapping = answer?.type === 'matching' ? answer.mapping : {}
              return (
                <div key={pair.left} className="flex items-center gap-3">
                  <span className="font-mono font-bold w-28 shrink-0">{pair.left}</span>
                  <select
                    disabled={submitted}
                    value={mapping[pair.left] ?? ''}
                    onChange={(e) => {
                      const nextMapping = { ...mapping, [pair.left]: e.target.value }
                      setAnswer({ type: 'matching', mapping: nextMapping })
                    }}
                    className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-600 px-3 py-2"
                  >
                    <option value="" disabled>
                      -- chọn --
                    </option>
                    {shuffledRightOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {submitted && (
        <div
          className={`mt-4 rounded-xl p-4 ${
            correct ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200'
          }`}
        >
          <p className="font-bold mb-1">{correct ? '✅ Chính xác!' : '❌ Chưa đúng'}</p>
          <p className="text-sm">{question.explanation}</p>
        </div>
      )}

      <div className="mt-5">
        {!submitted ? (
          <button
            onClick={handleCheck}
            disabled={!isReady}
            className="w-full rounded-xl bg-green-500 disabled:bg-slate-300 disabled:dark:bg-slate-600 text-white font-extrabold uppercase tracking-wide py-3 hover:bg-green-600 transition-colors"
          >
            Kiểm tra
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="w-full rounded-xl bg-sky-500 text-white font-extrabold uppercase tracking-wide py-3 hover:bg-sky-600 transition-colors"
          >
            Tiếp tục
          </button>
        )}
      </div>
    </div>
  )
}
