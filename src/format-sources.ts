import type { RAGSource, SourceFormat } from './types.js'

function buildMetaLine(source: RAGSource): string {
  const m = source.metadata ?? {}
  const parts: string[] = []
  if (m.title) parts.push(m.title)
  if (m.url) parts.push(m.url)
  if (m.date) parts.push(m.date)
  if (m.author) parts.push(`by ${m.author}`)
  if (m.page != null) parts.push(`p.${m.page}`)
  return parts.join(' | ')
}

function buildXmlAttrs(source: RAGSource, index: number): string {
  const m = source.metadata ?? {}
  const attrs: string[] = [`id="${index}"`]
  if (m.title) attrs.push(`title="${m.title}"`)
  if (m.url) attrs.push(`url="${m.url}"`)
  if (m.date) attrs.push(`date="${m.date}"`)
  if (m.author) attrs.push(`author="${m.author}"`)
  if (m.page != null) attrs.push(`page="${m.page}"`)
  return attrs.join(' ')
}

export function formatSources(
  sources: RAGSource[],
  format: SourceFormat,
  showMetadata: boolean,
  customFn?: (sources: RAGSource[]) => string
): string {
  switch (format) {
    case 'numbered': {
      return sources
        .map((s, i) => {
          const num = i + 1
          let block = `[${num}] ${s.content}`
          if (showMetadata) {
            const meta = buildMetaLine(s)
            if (meta) block += `\n\nSource: ${meta}`
          }
          return block
        })
        .join('\n\n')
    }

    case 'xml': {
      return sources
        .map((s, i) => {
          const num = i + 1
          if (showMetadata) {
            const attrs = buildXmlAttrs(s, num)
            return `<source ${attrs}>\n${s.content}\n</source>`
          }
          return `<source id="${num}">\n${s.content}\n</source>`
        })
        .join('\n\n')
    }

    case 'markdown': {
      return sources
        .map((s, i) => {
          const num = i + 1
          const m = s.metadata ?? {}
          const title = m.title ? `: ${m.title}` : ''
          let block = `## Source ${num}${title}\n\n${s.content}`
          if (showMetadata) {
            const meta = buildMetaLine(s)
            if (meta) block += `\n\n_${meta}_`
          }
          block += '\n\n---'
          return block
        })
        .join('\n\n')
    }

    case 'json': {
      const items = sources.map((s, i) => {
        const base: Record<string, unknown> = { index: i + 1, content: s.content }
        if (showMetadata && s.metadata) {
          const m = s.metadata
          if (m.title != null) base.title = m.title
          if (m.url != null) base.url = m.url
          if (m.date != null) base.date = m.date
          if (m.author != null) base.author = m.author
          if (m.page != null) base.page = m.page
        }
        return base
      })
      return JSON.stringify(items, null, 2)
    }

    case 'custom': {
      if (!customFn) {
        throw new Error('customFormat function must be provided when sourceFormat is "custom"')
      }
      return customFn(sources)
    }

    default: {
      throw new Error(`Unknown source format: ${format as string}`)
    }
  }
}
