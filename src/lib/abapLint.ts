export interface LintIssue {
  line: number
  severity: 'error' | 'warning'
  message: string
}

interface CleanedLine {
  text: string
  unterminatedString: boolean
}

/**
 * Blanks out comment and string-literal content on a single physical line so
 * keyword matching never fires on text that only looks like ABAP inside a
 * literal or a comment. ABAP literals cannot span lines, so a string still
 * "open" at end-of-line means it was never closed.
 */
function cleanLine(line: string): CleanedLine {
  if (line.length > 0 && line[0] === '*') {
    return { text: ' '.repeat(line.length), unterminatedString: false }
  }

  let result = ''
  let inString = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === "'") {
        if (line[i + 1] === "'") {
          result += '  '
          i++
          continue
        }
        inString = false
      }
      result += ' '
      continue
    }
    if (ch === "'") {
      inString = true
      result += ' '
      continue
    }
    if (ch === '"') {
      result += ' '.repeat(line.length - i)
      break
    }
    result += ch
  }
  return { text: result, unterminatedString: inString }
}

const BLOCK_KEYWORDS: Record<string, string> = {
  FORM: 'ENDFORM',
  IF: 'ENDIF',
  LOOP: 'ENDLOOP',
  CASE: 'ENDCASE',
  DO: 'ENDDO',
  WHILE: 'ENDWHILE',
  TRY: 'ENDTRY',
  CLASS: 'ENDCLASS',
  METHOD: 'ENDMETHOD',
  MODULE: 'ENDMODULE',
}
const OPEN_TO_CLOSE = BLOCK_KEYWORDS
const CLOSE_TO_OPEN: Record<string, string> = Object.fromEntries(
  Object.entries(BLOCK_KEYWORDS).map(([open, close]) => [close, open]),
)
const KEYWORD_PATTERN = new RegExp(
  `\\b(${Object.keys(OPEN_TO_CLOSE).join('|')}|${Object.values(OPEN_TO_CLOSE).join('|')})\\b`,
  'gi',
)

/**
 * Lightweight, honest static checks — not a real ABAP compiler. Verifies
 * block keywords are balanced, that END* block terminators end their line
 * with a period, and flags single-quote string literals left open at
 * end-of-line (ABAP literals cannot span lines).
 */
export function lintAbap(source: string): LintIssue[] {
  const issues: LintIssue[] = []
  const lines = source.split('\n')
  const stack: { keyword: string; line: number }[] = []

  lines.forEach((rawLine, idx) => {
    const lineNumber = idx + 1
    const { text: cleaned, unterminatedString } = cleanLine(rawLine)

    if (unterminatedString) {
      issues.push({
        line: lineNumber,
        severity: 'warning',
        message: "Chuỗi văn bản có thể chưa đóng bằng dấu nháy đơn (') — literal ABAP không được xuống dòng.",
      })
    }

    for (const match of cleaned.matchAll(KEYWORD_PATTERN)) {
      const keyword = match[0].toUpperCase()

      if (keyword in OPEN_TO_CLOSE) {
        // "CALL METHOD ..." invokes a method dynamically as a single
        // statement — it never opens a METHOD...ENDMETHOD block.
        const precedingWord = cleaned.slice(0, match.index).trimEnd().split(/\s+/).pop()
        if (keyword === 'METHOD' && precedingWord?.toUpperCase() === 'CALL') {
          continue
        }
        stack.push({ keyword, line: lineNumber })
        continue
      }

      const expectedOpen = CLOSE_TO_OPEN[keyword]
      const top = stack[stack.length - 1]
      if (!top || top.keyword !== expectedOpen) {
        issues.push({
          line: lineNumber,
          severity: 'error',
          message: top
            ? `Gặp ${keyword} nhưng khối đang mở gần nhất là ${top.keyword} (dòng ${top.line}) — có thể thiếu ${OPEN_TO_CLOSE[top.keyword]} hoặc thừa ${keyword}.`
            : `Gặp ${keyword} nhưng không có khối ${expectedOpen} nào đang mở.`,
        })
      } else {
        stack.pop()
      }

      const trimmed = cleaned.trimEnd()
      if (!trimmed.endsWith('.')) {
        issues.push({
          line: lineNumber,
          severity: 'warning',
          message: `${keyword} nên kết thúc bằng dấu chấm '.' để đóng statement.`,
        })
      }
    }
  })

  for (const unclosed of stack) {
    issues.push({
      line: unclosed.line,
      severity: 'error',
      message: `${unclosed.keyword} chưa được đóng bằng ${OPEN_TO_CLOSE[unclosed.keyword]} trước khi hết file.`,
    })
  }

  return issues.sort((a, b) => a.line - b.line)
}
