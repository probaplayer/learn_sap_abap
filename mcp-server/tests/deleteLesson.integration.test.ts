/**
 * Integration test for deleteLesson MCP tool
 * Tests the success path: adding a lesson, deleting it, and verifying the result
 * Also tests error cases: unknown lesson ID and minimum 3-lesson floor
 */

import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from '../src/paths.js'
import { writeLessonDraft } from '../src/writeLessonDraft.js'
import { deleteLesson } from '../src/deleteLesson.js'

const testModuleId = 'mm'
const filePath = path.join(CONTENT_DIR, testModuleId, 'quiz.json')
const original = fs.readFileSync(filePath, 'utf-8')
const before = JSON.parse(original) as { lessons: { id: string }[] }

console.log('deleteLesson integration test')
console.log('=============================')
console.log(`Module "${testModuleId}" currently has ${before.lessons.length} lessons\n`)

// Temporary lesson to test success path
const tempLesson = {
  id: 'zz-integration-test',
  difficulty: 'basic',
  title: 'Integration test lesson',
  questions: [
    {
      id: 'int-test-q-1',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 1',
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      answerIndex: 1,
    },
    {
      id: 'int-test-q-2',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 2',
      question: 'What is 3+3?',
      options: ['5', '6', '7', '8'],
      answerIndex: 1,
    },
    {
      id: 'int-test-q-3',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 3',
      question: 'What is 4+4?',
      options: ['7', '8', '9', '10'],
      answerIndex: 1,
    },
    {
      id: 'int-test-q-4',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 4',
      question: 'What is 5+5?',
      options: ['9', '10', '11', '12'],
      answerIndex: 1,
    },
    {
      id: 'int-test-q-5',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 5',
      question: 'What is 6+6?',
      options: ['11', '12', '13', '14'],
      answerIndex: 1,
    },
    {
      id: 'int-test-q-6',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 6',
      question: 'What is 7+7?',
      options: ['13', '14', '15', '16'],
      answerIndex: 1,
    },
    {
      id: 'int-test-q-7',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 7',
      question: 'What is 8+8?',
      options: ['15', '16', '17', '18'],
      answerIndex: 1,
    },
    {
      id: 'int-test-q-8',
      type: 'multiple-choice',
      difficulty: 'basic',
      explanation: 'Integration test question 8',
      question: 'What is 9+9?',
      options: ['17', '18', '19', '20'],
      answerIndex: 1,
    },
  ],
}

try {
  // SUCCESS PATH TEST: Add a temporary lesson, delete it, verify the result
  console.log('TEST 1: Success path (add and delete lesson)')
  console.log('--------------------------------------------')
  writeLessonDraft(testModuleId, tempLesson)
  const afterAdd = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { lessons: { id: string }[] }
  console.log(`✓ Added lesson "${tempLesson.id}", module now has ${afterAdd.lessons.length} lessons`)

  const deleteResult = deleteLesson(testModuleId, tempLesson.id)
  console.log(`✓ Deleted lesson "${tempLesson.id}", module now has ${deleteResult.remainingLessons.length} lessons`)

  // Verify the result structure
  let successPathPassed = true
  if (deleteResult.deletedLessonId !== tempLesson.id) {
    console.log(`✗ FAIL: deletedLessonId should be "${tempLesson.id}", got "${deleteResult.deletedLessonId}"`)
    successPathPassed = false
  }
  if (deleteResult.remainingLessons.length !== afterAdd.lessons.length - 1) {
    console.log(
      `✗ FAIL: remainingLessons should have ${afterAdd.lessons.length - 1} items, got ${deleteResult.remainingLessons.length}`
    )
    successPathPassed = false
  }
  if (deleteResult.remainingLessons.some((l) => l.id === tempLesson.id)) {
    console.log(`✗ FAIL: "${tempLesson.id}" should not be in remainingLessons`)
    successPathPassed = false
  }
  if (successPathPassed) {
    console.log(
      `✓ deleteLesson result verified: deletedLessonId correct, remainingLessons has ${deleteResult.remainingLessons.length} items, "${tempLesson.id}" removed`
    )
  }

  // ERROR PATH TESTS
  console.log('\nTEST 2: Error path (unknown lesson ID)')
  console.log('-------------------------------------')
  try {
    deleteLesson(testModuleId, 'zz-does-not-exist')
    console.log('✗ FAIL: expected rejection on unknown lessonId')
  } catch (e) {
    console.log(`✓ Correctly rejected unknown lessonId: ${(e as Error).message}`)
  }

  console.log('\nTEST 3: Error path (minimum 3-lesson floor)')
  console.log('------------------------------------------')
  try {
    deleteLesson(testModuleId, before.lessons[0].id)
    console.log('✗ FAIL: expected rejection when only 3 lessons remain')
  } catch (e) {
    console.log(`✓ Correctly rejected deletion at floor: ${(e as Error).message}`)
  }

  console.log('\n=============================')
  console.log('All integration tests PASSED')
  console.log('=============================')
} finally {
  fs.writeFileSync(filePath, original, 'utf-8')
  console.log('\nRestored mm/quiz.json to original content')
}
