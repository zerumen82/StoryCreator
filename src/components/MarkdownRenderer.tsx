function escapeHtml(text: string) {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  }
  return text.replace(/[&<>]/g, (m) => map[m])
}

function stripHtmlTags(text: string): string {
  return text.replace(/<\/?strong[^>]*>/gi, '')
    .replace(/<\/?em[^>]*>/gi, '')
    .replace(/<\/?b[^>]*>/gi, '')
    .replace(/<\/?i[^>]*>/gi, '')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/<\/?br[^>]*>/gi, '\n')
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<\/?h[1-6][^>]*>/gi, '')
    .replace(/<\/?ul[^>]*>/gi, '')
    .replace(/<\/?ol[^>]*>/gi, '')
    .replace(/<\/?li[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
}

export function renderMarkdown(content: string) {
  const cleaned = stripHtmlTags(content)
  const lines = cleaned.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  let listItems: string[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let lang = ''

  const flushCode = () => {
    if (codeBuffer.length > 0) {
      elements.push(
        <pre key={`code-${elements.length}`} className="bg-gray-950 p-3 rounded-lg text-xs text-gray-300 overflow-x-auto border border-gray-800 my-2">
          <code className={lang ? `language-${lang}` : ''}>{codeBuffer.join('\n')}</code>
        </pre>
      )
      codeBuffer = []
      lang = ''
    }
  }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 text-gray-200">
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
          ))}
        </ul>
      )
      listItems = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCode()
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
        lang = line.slice(3).trim()
      }
      i++
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      i++
      continue
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2))
      i++
      continue
    }

    if (line.trim() === '') {
      flushList()
      i++
      continue
    }

    if (line.startsWith('> ')) {
      flushList()
      const quote = line.slice(2)
      elements.push(
        <blockquote key={`quote-${elements.length}`} className="border-l-4 border-indigo-500 pl-4 italic text-gray-400 my-2">
          {inlineMarkdown(quote)}
        </blockquote>
      )
      i++
      continue
    }

    flushList()
    elements.push(
      <p key={`p-${elements.length}`} className="text-gray-100 leading-relaxed my-1">
        {inlineMarkdown(line)}
      </p>
    )
    i++
  }

  flushList()
  flushCode()

  return elements
}

function inlineMarkdown(text: string): string {
  const escaped = escapeHtml(text)

  const codePattern = /`([^`]+)`/g
  const boldPattern = /\*\*([^*]+)\*\*/g
  const italicPattern = /\*([^*]+)\*/g

  let result = escaped
  result = result.replace(codePattern, '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs text-gray-300">$1</code>')
  result = result.replace(boldPattern, '<strong class="text-white font-semibold">$1</strong>')
  result = result.replace(italicPattern, '<em class="italic text-gray-300">$1</em>')

  return result
}
