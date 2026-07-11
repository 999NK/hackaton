export function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  html = html.replace(
    /```(\w+)?\n?([\s\S]*?)```/g,
    '<pre class="bg-black/40 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono text-emerald-400"><code>$2</code></pre>',
  )

  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-black/40 px-1.5 py-0.5 rounded text-sm font-mono text-emerald-400">$1</code>',
  )

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  html = html.replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-3 mb-1">$1</h1>')

  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')

  html = html.replace(/\n/g, '<br/>')
  html = html.replace(/(<pre[^>]*>)([\s\S]*?)(<\/pre>)/g, (_, pre, content, end) => {
    return pre + content.replace(/<br\/>/g, '\n') + end
  })

  return html
}
