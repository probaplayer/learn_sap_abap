import { Link } from 'react-router-dom'
import { GENERATED_SETS } from '../content/generated'
import { MODULES } from '../content'

export function PracticePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-2">🎯 Luyện tập cá nhân hóa</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        Các bộ câu hỏi được soạn riêng dựa trên điểm yếu của bạn (qua Claude Desktop + MCP).
      </p>

      {GENERATED_SETS.length === 0 && (
        <p className="text-slate-500">Chưa có bộ luyện tập nào. Dùng Claude Desktop để tạo bộ đầu tiên.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GENERATED_SETS.map((set) => (
          <Link
            key={set.id}
            to={`/practice/${set.id}`}
            className="rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 py-3 hover:border-sky-400 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-bold">{set.title}</p>
              <span className="shrink-0 text-xs rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5">
                {MODULES[set.moduleId].shortName}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{set.note}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
