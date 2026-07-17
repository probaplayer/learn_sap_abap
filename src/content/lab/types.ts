export type ExerciseCategory =
  | 'algorithm'
  | 'selection-screen'
  | 'alv'
  | 'crud-lock'
  | 'bdc'
  | 'smartforms'
  | 'memory'
  | 'capstone'

export type ExerciseDifficulty = 'basic' | 'intermediate' | 'advanced'

export interface ExerciseMeta {
  id: string
  title: string
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  relatedExerciseIds: string[]
  sourceFiles: string[]
  problemStatement: string
  concepts: string[]
  tablesUsed: string[]
  walkthrough: string
  sampleOutput: string
}

export interface ExerciseFile {
  filename: string
  code: string
}

export interface Exercise extends ExerciseMeta {
  files: ExerciseFile[]
}

export const EXERCISE_CATEGORIES: Record<ExerciseCategory, string> = {
  algorithm: 'Nền tảng thuật toán',
  'selection-screen': 'Selection-Screen nâng cao',
  alv: 'ALV Report',
  'crud-lock': 'CRUD + Khóa dữ liệu',
  bdc: 'BDC / Mass upload',
  smartforms: 'Smart Forms',
  memory: 'ABAP Memory / SAP Memory',
  capstone: 'Report tổng hợp (capstone)',
}
