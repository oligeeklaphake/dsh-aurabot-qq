export const DEFAULT_MODELSCOPE_MODELS = ['Qwen/Qwen-Image-2.1', 'MiniMax/MiniMax-H3-Image']

const modelId = (value) => typeof value === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value.trim()) ? value.trim() : ''

export function normalizeModelScopeModels(raw, legacy = '') {
  const models = new Map()
  const previous = modelId(legacy)
  const entries = Array.isArray(raw?.models) ? raw.models : [previous, ...DEFAULT_MODELSCOPE_MODELS]
  for (const entry of entries) {
    const id = modelId(entry)
    if (id && !models.has(id.toLowerCase())) models.set(id.toLowerCase(), id)
  }
  const list = [...models.values()]
  const wanted = modelId(raw?.defaultModel) || previous
  return { models: list, defaultModel: models.get(wanted.toLowerCase()) || list[0] || '' }
}

export function modelScopeModels(config) {
  return normalizeModelScopeModels(config.modelScope, config.model)
}
