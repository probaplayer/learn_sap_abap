import { Link, useParams } from 'react-router-dom'
import type { ModuleId } from '../content/types'
import { MODULES, findTable, findTableAnyModule } from '../content'

export function WikiDetailPage() {
  const { moduleId, tableId } = useParams<{ moduleId: ModuleId; tableId: string }>()

  if (!moduleId || !tableId) return null
  const table = findTable(moduleId, tableId)
  const mod = MODULES[moduleId]

  if (!table) {
    return (
      <main className="p-8 text-center">
        <p className="mb-4">Không tìm thấy bảng này.</p>
        <Link to="/wiki" className="text-sky-600 dark:text-sky-400 hover:underline">
          ← Quay lại Wiki
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/wiki" className="text-sky-600 dark:text-sky-400 hover:underline text-sm">
        ← Quay lại Wiki
      </Link>
      <h1 className="text-3xl font-extrabold mt-2 mb-1 font-mono">{table.id}</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        {table.name} · thuộc module{' '}
        <Link to={`/module/${moduleId}`} className="text-sky-600 dark:text-sky-400 hover:underline">
          {mod.icon} {mod.shortName}
        </Link>
      </p>

      <section className="mb-6">
        <h2 className="font-extrabold text-lg mb-1">Công dụng</h2>
        <p>{table.purpose}</p>
      </section>

      <section className="mb-6">
        <h2 className="font-extrabold text-lg mb-1">Dùng ở đâu</h2>
        <p>{table.whereUsed}</p>
      </section>

      <section className="mb-6">
        <h2 className="font-extrabold text-lg mb-2">Field khóa</h2>
        <div className="rounded-xl border-2 border-slate-200 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600">
          {table.keyFields.map((f) => (
            <div key={f.field} className="flex gap-3 px-4 py-2">
              <span className="font-mono font-bold w-24 shrink-0">{f.field}</span>
              <span className="text-sm">{f.description}</span>
            </div>
          ))}
        </div>
      </section>

      {table.relatedTables.length > 0 && (
        <section>
          <h2 className="font-extrabold text-lg mb-2">Bảng liên quan</h2>
          <div className="flex flex-wrap gap-2">
            {table.relatedTables.map((rid) => {
              const related = findTableAnyModule(rid)
              return (
                <Link
                  key={rid}
                  to={related ? `/wiki/${related.module}/${related.id}` : '/wiki'}
                  className="rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-3 py-1 font-mono text-sm font-bold hover:bg-sky-200"
                >
                  {rid}
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
