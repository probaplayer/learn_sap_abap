import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import abap from 'react-syntax-highlighter/dist/esm/languages/prism/abap'
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark'

SyntaxHighlighter.registerLanguage('abap', abap)

interface AbapCodeBlockProps {
  code: string
}

export function AbapCodeBlock({ code }: AbapCodeBlockProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-700">
      <SyntaxHighlighter
        language="abap"
        style={oneDark}
        showLineNumbers
        customStyle={{ margin: 0, fontSize: '0.8rem', maxHeight: '32rem', overflowX: 'auto' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
