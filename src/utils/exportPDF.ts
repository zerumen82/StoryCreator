// Exportar el historial de una conversacion a PDF, imprimiendo una ventana
// oculta con solo el contenido de la conversacion. No necesita dependencias:
// en Electron el dialogo "Guardar como PDF" del navegador lo hace el resto.
//
// Uso:
//   exportConversationToPDF({ title, characterName, messages })
//
// messages: los ChatMessage de la conversacion (user/assistant/system).

import type { ChatMessage } from '../types'

export interface PDFExportOptions {
  title: string
  characterName?: string | null
  messages: ChatMessage[]
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderMessages(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const isUser = m.role === 'user'
      const label = isUser ? 'Tú' : 'IA'
      const time = new Date(m.timestamp).toLocaleString('es-ES')
      return `
      <div class="msg ${isUser ? 'user' : 'assistant'}">
        <div class="meta">
          <span class="who">${label}</span>
          <span class="time">${time}</span>
        </div>
        <div class="content">${escapeHtml(m.content)}</div>
      </div>`
    })
    .join('\n')
}

export function exportConversationToPDF(options: PDFExportOptions): void {
  const { title, characterName, messages } = options
  const date = new Date().toLocaleDateString('es-ES')

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a2e;
    margin: 0;
    padding: 40px 50px;
    background: #ffffff;
  }
  h1 {
    font-size: 22px;
    margin: 0 0 4px 0;
    color: #2d1b69;
  }
  .subtitle {
    font-size: 12px;
    color: #666;
    margin-bottom: 28px;
    padding-bottom: 12px;
    border-bottom: 2px solid #7c3aed;
  }
  .msg {
    margin-bottom: 18px;
    page-break-inside: avoid;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #888;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .who { font-weight: bold; color: #7c3aed; }
  .user .who { color: #4338ca; }
  .content {
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    background: #fafafa;
    border-left: 3px solid #ddd;
    padding: 10px 14px;
    border-radius: 0 6px 6px 0;
  }
  .user .content {
    background: #f3f0ff;
    border-left-color: #a78bfa;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">
    ${characterName ? `Con: ${escapeHtml(characterName)} · ` : ''}Exportado el ${date} · StoryCreator
  </div>
  ${renderMessages(messages)}
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) {
    alert('No se pudo abrir la ventana de impresión. Revisa el bloqueador de ventanas.')
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  // Pequeño delay para que el navegador pinte el contenido antes del dialogo
  setTimeout(() => printWindow.print(), 300)
}
