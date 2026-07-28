export function requireMultipleChoice(questions: { id?: string; type: string }[]): void {
  const bad = questions.filter((q) => q.type !== 'multiple-choice')
  if (bad.length > 0) {
    throw new Error(
      `Chỉ chấp nhận câu hỏi type 'multiple-choice'. Câu hỏi sai type: ${bad
        .map((q) => `${q.id ?? '(không có id)'} (type: ${q.type})`)
        .join(', ')}`,
    )
  }
}
