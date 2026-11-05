// DevFest MTL 2026 — cloud fallback server for the agent panel.
// Zero-dependency (node:http + global fetch, Node 20.6+). The Gemini API key
// lives ONLY in this process (server/.env) — it never reaches the browser.
//
// Run:  cd server && node --env-file=.env index.mjs
// (or)  GEMINI_API_KEY=… node index.mjs
//
// POST /chat    { systemPrompt, tools: [{name, description, inputSchema}], messages }
//            →  { text }                       final answer
//            →  { toolCalls: [{name, args, thoughtSignature}] }  the model wants tools
//            (results come back in messages; the signature must ride back on the
//             tool-call message — Gemini 3.x rejects the round-trip without it)
// GET  /health  → { ok: true }

import http from 'node:http'

const PORT = Number(process.env.PORT || 8787)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
const ALLOWED_ORIGIN = 'http://localhost:5173'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/** Panel message → Gemini content. tool-result uses role "user" per Gemini REST docs. */
function mapMessage(message) {
  if (message.role === 'tool-call') {
    // Gemini 3.x thinking models issue a thought_signature with each call and
    // require it on the functionCall part echoed back in the next request.
    const part = { functionCall: { name: message.name, args: message.args ?? {} } }
    if (message.thoughtSignature) part.thoughtSignature = message.thoughtSignature
    return { role: 'model', parts: [part] }
  }
  if (message.role === 'tool-result') {
    return {
      role: 'user',
      parts: [
        { functionResponse: { name: message.name, response: { content: message.content } } },
      ],
    }
  }
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.text }],
  }
}

/** Gemini's function-declaration schema accepts only a subset of JSON Schema
 * (type, format, description, nullable, enum, items, properties, required).
 * Chrome's declarative form tools derive 2020-12-style schemas that also
 * carry anyOf/const/title, which Gemini rejects ("Unknown name 'const'…
 * Cannot find field") — strip unknown keys recursively; the derived schemas
 * keep their enum and description, which carry the same information. */
const GEMINI_SCHEMA_KEYS = new Set([
  'type',
  'format',
  'description',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
])

function sanitizeSchema(node) {
  if (Array.isArray(node)) return node.map(sanitizeSchema)
  if (node === null || typeof node !== 'object') return node
  const sanitized = {}
  for (const [key, value] of Object.entries(node)) {
    if (!GEMINI_SCHEMA_KEYS.has(key)) continue
    if (key === 'properties') {
      // `properties` maps property NAME → schema; the names are arbitrary
      // and must survive — only their VALUES are schemas to sanitize.
      const properties = {}
      for (const [name, schema] of Object.entries(value)) {
        properties[name] = sanitizeSchema(schema)
      }
      sanitized.properties = properties
    } else {
      sanitized[key] = sanitizeSchema(value)
    }
  }
  return sanitized
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  res.end(body)
}

async function handleChat(res, body) {
  if (!GEMINI_API_KEY) {
    sendJson(res, 500, {
      error: 'GEMINI_API_KEY is not set — copy server/.env.example to server/.env.',
    })
    return
  }
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    sendJson(res, 400, { error: 'Request body must be JSON.' })
    return
  }

  const request = {
    systemInstruction: { parts: [{ text: payload.systemPrompt ?? '' }] },
    contents: (payload.messages ?? []).map(mapMessage),
  }
  const tools = payload.tools ?? []
  if (tools.length > 0) {
    request.tools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: sanitizeSchema(tool.inputSchema ?? { type: 'object' }),
        })),
      },
    ]
  }

  const upstream = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(request),
  })
  const data = await upstream.json()
  if (!upstream.ok) {
    sendJson(res, 502, { error: data?.error?.message ?? `Gemini responded ${upstream.status}.` })
    return
  }

  const parts = data.candidates?.[0]?.content?.parts ?? []
  // Thought signatures are response metadata, not per-call: Gemini 3.x can
  // attach them to ANY part ("living inside functionCall parts or the final
  // part of a response") and signs a parallel-call batch only once — observed
  // live: a two-call response where only the first functionCall is signed.
  // Capture every signature in the response and backfill any toolCall that
  // lacks its own, or Gemini rejects the echo of the unsigned sibling.
  const signatures = parts.map((part) => part.thoughtSignature).filter(Boolean)
  const responseSignature = signatures.at(-1)
  const toolCalls = parts
    .filter((part) => part.functionCall)
    .map((part) => ({
      name: part.functionCall.name,
      args: part.functionCall.args ?? {},
      thoughtSignature: part.thoughtSignature ?? responseSignature,
    }))
  if (toolCalls.length > 0) {
    sendJson(res, 200, { toolCalls })
    return
  }
  const text = parts
    .filter((part) => typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  sendJson(res, 200, { text })
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    })
    res.end()
    return
  }
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, model: GEMINI_MODEL })
    return
  }
  if (req.method === 'POST' && req.url === '/chat') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) req.destroy()
    })
    req.on('end', () => {
      handleChat(res, body).catch((err) => sendJson(res, 500, { error: String(err) }))
    })
    return
  }
  sendJson(res, 404, { error: 'Not found.' })
})

server.listen(PORT, () => {
  console.log(`DevFest cloud fallback on http://localhost:${PORT} (model: ${GEMINI_MODEL})`)
})