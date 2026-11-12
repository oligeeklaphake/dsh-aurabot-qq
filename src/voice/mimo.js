import { readFile, mkdir, writeFile, readdir, stat, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { dataDir } from '../core/store.js'

export async function mimoSpeech(text, config) {
  const cfg = config || {}
  if (!cfg.apiKey) throw new Error('请在语音设置里填写 MiMo API Key')
  const clean = String(text || '').trim()
  if (!clean) throw new Error('要念的文字是空的')
  const reference = await readFile(cfg.refAudio || dataDir('voice', 'mimo-reference.wav')).catch(() => {
    throw new Error('找不到 MiMo 参考音频，请检查语音设置')
  })
  if (reference.length > 7 * 1024 * 1024) throw new Error('MiMo 参考音频过大，请使用较短的 WAV 或 MP3')
  const mime = String(cfg.refAudio || '').toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
  const speeds = {
    slow: '请用较慢的语速说话，吐字清楚。',
    fast: '请用较快的语速说话，吐字清楚。',
    'very-fast': '请用很快的语速说话，吐字清楚。',
    fastest: '请用极快的语速说话，像连珠炮一样，尽量减少停顿，同时保持吐字清晰。',
  }
  const instruction = speeds[cfg.speed]
  const messages = instruction ? [{ role: 'user', content: instruction }] : []
  messages.push({ role: 'assistant', content: clean })
  const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'mimo-v2.5-tts-voiceclone',
      messages,
      audio: { format: 'wav', voice: `data:${mime};base64,${reference.toString('base64')}` },
    }),
    signal: AbortSignal.timeout(180000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`MiMo HTTP ${response.status}：${result.error?.message || result.message || '语音合成失败'}`)
  const encoded = result.choices?.[0]?.message?.audio?.data
  if (!encoded) throw new Error('MiMo 没有返回语音')
  const audio = Buffer.from(encoded, 'base64')
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') throw new Error('MiMo 返回的音频格式无效')
  const dir = dataDir('voice-cache')
  await mkdir(dir, { recursive: true })
  for (const name of await readdir(dir)) {
    if (!/^mimo-[0-9a-f-]+\.wav$/i.test(name)) continue
    const path = join(dir, name)
    const info = await stat(path).catch(() => null)
    if (info && Date.now() - info.mtimeMs > 86400000) await unlink(path).catch(() => {})
  }
  const file = join(dir, `mimo-${randomUUID()}.wav`)
  await writeFile(file, audio)
  return { file, engine: 'mimo' }
}
