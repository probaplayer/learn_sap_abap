import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MODULE_ORDER, MODULES, TABLES } from '../content'

export function WikiPage() {
  const [query, setQuery] = useState('')

  const filteredByModule = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MODULE_ORDER.map((moduleId) => ({
      moduleId,
      tables: TABLES[moduleId].filter(
        (t) => !q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
      ),
    })).filter((group) => group.tables.length > 0)
  }, [query])

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-4">📖 Wiki tra cứu</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm theo tên bảng, vd: MARA..."
        className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 py-3 mb-8 outline-none focus:border-sky-400"
      />

      {filteredByModule.map(({ moduleId, tables }) => {
        const mod = MODULES[moduleId]
        return (
          <section key={moduleId} className="mb-8">
            <h2 className="text-xl font-extrabold mb-3 flex items-center gap-2">
              {mod.icon} {mod.shortName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tables.map((t) => (
                <Link
                  key={t.id}
                  to={`/wiki/${moduleId}/${t.id}`}
                  className="rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 py-3 hover:border-sky-400 transition-colors"
                >
                  <p className="font-mono font-extrabold">{t.id}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{t.purpose}</p>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
