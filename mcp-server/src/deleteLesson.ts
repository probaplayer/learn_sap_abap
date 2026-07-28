import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'

export interface DeleteLessonResult {
  deletedLessonId: string
  remainingLessons: { id: string; title: string; difficulty: string; questionCount: number }[]
}

export function deleteLesson(moduleId: string, lessonId: string): DeleteLessonResult {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    moduleId: string
    lessons: { id: string; title: string; difficulty: string; questions: unknown[] }[]
  }
  const idx = file.lessons.findIndex((l) => l.id === lessonId)
  if (idx === -1) {
    throw new Error(
      `Không tìm thấy lesson id "${lessonId}" trong module "${moduleId}". Lesson hiện có: ${file.lessons
        .map((l) => l.id)
        .join(', ')}`,
    )
  }
  if (file.lessons.length - 1 < 3) {
    throw new Error(
      `Module "${moduleId}" hiện có ${file.lessons.length} lesson — cần giữ tối thiểu 3, không thể xóa thêm`,
    )
  }

  file.lessons.splice(idx, 1)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return {
    deletedLessonId: lessonId,
    remainingLessons: file.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      difficulty: l.difficulty,
      questionCount: l.questions.length,
    })),
  }
}
