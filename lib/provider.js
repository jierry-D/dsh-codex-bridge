import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'

const REASONING_LEVELS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max'])

const dshAccessTokenAuth = Object.freeze({
  name: 'DSH OpenAI Codex OAuth token',
  async resolve({ credential }) {
    if (credential?.type !== 'api_key' || typeof credential.key !== 'string' || credential.key.length === 0) return undefined
    return { auth: { apiKey: credential.key }, source: 'DSH OpenAI Codex OAuth' }
  },
})

function codexModel(model) {
  if (!model.reasoning) return model
  const thinkingLevelMap = { off: null, minimal: null }
  for (const level of REASONING_LEVELS) {
    const mapped = model.thinkingLevelMap?.[level]
    thinkingLevelMap[level] = mapped === null || ((level === 'xhigh' || level === 'max') && mapped === undefined)
      ? null
      : mapped ?? level
  }
  return { ...model, thinkingLevelMap }
}

export const DEFAULT_CODEX_REASONING_LEVEL = 'medium'

export function createCodexProvider() {
  const provider = openaiCodexProvider()
  const getModels = provider.getModels.bind(provider)
  const stream = (method, model, context, options) => {
    const streamOptions = { ...options }
    delete streamOptions.temperature
    return provider[method](model, context, streamOptions)
  }

  return {
    ...provider,
    stream: (model, context, options) => stream('stream', model, context, options),
    streamSimple: (model, context, options) => stream('streamSimple', model, context, options),
    auth: { ...provider.auth, apiKey: dshAccessTokenAuth },
    getModels: () => getModels().map(codexModel),
  }
}
