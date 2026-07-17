import { Link } from 'react-router-dom'
import { MODULE_ORDER, MODULES } from '../content'

export function MapPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-2">Chọn thế giới để khám phá</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        Mỗi module là một thế giới SAP riêng — học cú pháp ABAP và nghiệp vụ song song.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {MODULE_ORDER.map((id) => {
          const mod = MODULES[id]
          return (
            <Link
              key={id}
              to={`/module/${id}`}
              className="rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow border-2"
              style={{ borderColor: mod.color, backgroundColor: `${mod.color}18` }}
            >
              <div className="text-4xl mb-2">{mod.icon}</div>
              <h2 className="text-xl font-extrabold mb-1">{mod.shortName}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{mod.description}</p>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
