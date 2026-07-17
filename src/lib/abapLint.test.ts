import { describe, expect, it } from 'vitest'
import { lintAbap } from './abapLint'

describe('lintAbap', () => {
  it('reports no issues for well-formed balanced code', () => {
    const code = [
      'FORM do_something.',
      '  IF sy-subrc = 0.',
      '    LOOP AT itab INTO DATA(ls_line).',
      '      WRITE ls_line-field.',
      '    ENDLOOP.',
      '  ELSEIF sy-subrc = 4.',
      '    MODIFY itab FROM ls_line.',
      '  ENDIF.',
      'ENDFORM.',
    ].join('\n')

    expect(lintAbap(code)).toEqual([])
  })

  it('does not treat "CALL METHOD ..." as opening a METHOD...ENDMETHOD block', () => {
    const code = [
      'FORM f.',
      '  CALL METHOD cl_gui_frontend_services=>file_open_dialog',
      "    EXPORTING file_filter = 'x'.",
      'ENDFORM.',
    ].join('\n')
    expect(lintAbap(code)).toEqual([])
  })

  it('does not treat ELSEIF or MODIFY as IF keywords', () => {
    const code = ['FORM f.', '  ELSEIF sy-subrc = 0.', '  MODIFY itab FROM ls_line.', 'ENDFORM.'].join('\n')
    expect(lintAbap(code)).toEqual([])
  })

  it('flags a missing ENDFORM at end of file', () => {
    const code = ['FORM do_something.', '  WRITE ls_line-field.'].join('\n')
    const issues = lintAbap(code)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ line: 1, severity: 'error' })
    expect(issues[0].message).toContain('FORM')
  })

  it('flags mismatched nesting when a closing keyword does not match the innermost open block', () => {
    const code = ['FORM f.', '  IF sy-subrc = 0.', '    LOOP AT itab INTO DATA(ls_line).', '  ENDIF.', 'ENDFORM.'].join(
      '\n',
    )
    const issues = lintAbap(code)
    expect(issues.some((i) => i.severity === 'error' && i.line === 4)).toBe(true)
  })

  it('warns when an END* keyword is missing its terminating period', () => {
    const code = ['FORM f.', '  WRITE 1.', 'ENDFORM'].join('\n')
    const issues = lintAbap(code)
    expect(issues.some((i) => i.line === 3 && i.message.includes('dấu chấm'))).toBe(true)
  })

  it('warns about an unterminated single-quote string literal', () => {
    const code = ["FORM f.", "  WRITE 'hello.", 'ENDFORM.'].join('\n')
    const issues = lintAbap(code)
    expect(issues.some((i) => i.line === 2 && i.message.includes('nháy đơn'))).toBe(true)
  })

  it('ignores keywords that appear inside string literals or comments', () => {
    const code = [
      'FORM f.',
      "  WRITE 'please call ENDFORM manually'.",
      '* this comment talks about IF and ENDIF but means nothing',
      'ENDFORM.',
    ].join('\n')
    expect(lintAbap(code)).toEqual([])
  })

  it('treats a line starting with * as a full comment', () => {
    const code = ['FORM f.', '*IF this were real code it would break things', 'ENDFORM.'].join('\n')
    expect(lintAbap(code)).toEqual([])
  })
})
