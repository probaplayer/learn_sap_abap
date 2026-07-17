export type NodeState = 'locked' | 'unlocked' | 'completed' | 'perfect'

interface MapNodeProps {
  label: string
  state: NodeState
  onClick?: () => void
  icon?: string
}

const STATE_STYLES: Record<NodeState, string> = {
  locked: 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed',
  unlocked: 'bg-green-500 text-white hover:bg-green-600 cursor-pointer shadow-lg',
  completed: 'bg-sky-500 text-white hover:bg-sky-600 cursor-pointer shadow-lg',
  perfect: 'bg-amber-400 text-white hover:bg-amber-500 cursor-pointer shadow-lg',
}

export function MapNode({ label, state, onClick, icon }: MapNodeProps) {
  return (
    <button
      disabled={state === 'locked'}
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center justify-center w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 font-extrabold text-2xl transition-transform hover:scale-105 ${STATE_STYLES[state]}`}
    >
      <span>{state === 'locked' ? '🔒' : icon ?? '⭐'}</span>
    </button>
  )
}
