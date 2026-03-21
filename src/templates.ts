export interface TemplateDefinition {
  system: string
  queryFraming: string
  contextPlacement: 'user' | 'system'
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  qa: {
    system: `You are a helpful assistant. Answer questions based only on the provided context. If the context doesn't contain enough information to answer, say so clearly.`,
    queryFraming: 'Based on the context above, please answer: {{query}}',
    contextPlacement: 'user',
  },
  summarize: {
    system: `You are a summarization assistant. Create concise, accurate summaries based on the provided context.`,
    queryFraming: '{{query}}',
    contextPlacement: 'user',
  },
  compare: {
    system: `You are an analytical assistant. Compare and contrast information from the provided sources objectively.`,
    queryFraming: 'Using the sources provided, {{query}}',
    contextPlacement: 'user',
  },
  extract: {
    system: `You are a data extraction assistant. Extract specific information from the provided context as structured data.`,
    queryFraming: 'Extract from the context: {{query}}',
    contextPlacement: 'user',
  },
  conversational: {
    system: `You are a conversational assistant with access to relevant context. Respond naturally while incorporating the provided information.`,
    queryFraming: '{{query}}',
    contextPlacement: 'user',
  },
  cite: {
    system: `You are a research assistant. Answer questions with citations to the provided sources. Format citations as [1], [2], etc.`,
    queryFraming: '{{query}}\n\nPlease cite relevant sources using [source number] notation.',
    contextPlacement: 'user',
  },
}

const customTemplates: Record<string, TemplateDefinition> = {}

export function defineTemplate(name: string, def: TemplateDefinition): void {
  customTemplates[name] = def
}

export function getTemplate(name: string): TemplateDefinition | undefined {
  return TEMPLATES[name] ?? customTemplates[name]
}
