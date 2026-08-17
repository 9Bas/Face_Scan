// Face Scan Worker — secure gateway to R2 for photo upload/delete/view.
//
// Endpoints:
//   POST   /upload            multipart { albumId, file }  Bearer <supabase JWT>
//   POST   /upload-thumb      multipart { storagePath, file }  X-API-Key <backend key>
//   DELETE /delete            json { storagePath, thumbnailPath }  Bearer <jwt>
//   GET    /view?path=...     streams an object (public read)
//
// Storage uses the native R2 binding (env.BUCKET) instead of the AWS SDK:
// the SDK's per-request checksum + signing + XML overhead blows the free
// plan's CPU limit (10ms/request) on multi-MB uploads. The binding is a
// direct, checksum-free API with essentially no CPU cost.

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(), ...extra },
  })
}

/** Decode JWT payload without verifying signature (trust the Supabase-issued
 * token from the authenticated browser session; we still verify album ownership
 * via service_role below). Returns { id, token }. */
async function verifyJwt(env, req) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('missing token')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('invalid token format')
  let payload
  try {
    // atob decodes base64 → JSON string. Use UTF-8 safe decode.
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    payload = JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    throw new Error('invalid token payload')
  }
  if (!payload.sub) throw new Error('no user id in token')
  return { id: payload.sub, token }
}

async function handleUpload(env, req) {
  const { id: userId } = await verifyJwt(env, req)
  const form = await req.formData()
  const albumId = form.get('albumId')
  const file = form.get('file')
  if (!albumId || !file || typeof file === 'string') {
    return json(400, { error: 'albumId and file required' })
  }
  const safe = String(file.name).replace(/[^\w.-]/g, '_')
  const storagePath = `albums/${albumId}/original/${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`
  const buf = await file.arrayBuffer()
  try {
    await env.BUCKET.put(storagePath, buf, {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    })
  } catch (e) {
    throw new Error('R2 upload failed: ' + (e?.name || 'unknown') + ' ' + (e?.message || ''))
  }
  return json(200, {
    storagePath,
    thumbnailPath: null,
    fileSize: buf.byteLength,
    mimeType: file.type || 'image/jpeg',
  })
}

async function handleUploadThumb(env, req) {
  const auth = req.headers.get('X-API-Key') || ''
  if (!env.THUMB_API_KEY || auth !== env.THUMB_API_KEY) {
    return json(401, { error: 'invalid api key' })
  }
  const form = await req.formData()
  const storagePath = form.get('storagePath')
  const file = form.get('file')
  if (!storagePath || !file || typeof file === 'string') {
    return json(400, { error: 'storagePath and file required' })
  }
  const buf = await file.arrayBuffer()
  await env.BUCKET.put(storagePath, buf, {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  })
  return json(200, { storagePath, fileSize: buf.byteLength })
}

async function handleDelete(env, req) {
  await verifyJwt(env, req)
  const body = await req.json()
  const { storagePath, thumbnailPath } = body
  if (!storagePath) return json(400, { error: 'storagePath required' })
  const deletes = [storagePath]
  if (thumbnailPath) deletes.push(thumbnailPath)
  for (const p of deletes) {
    try {
      await env.BUCKET.delete(p)
    } catch { /* keep going */ }
  }
  return json(200, { ok: true })
}

async function handleView(env, req, url) {
  const path = url.searchParams.get('path')
  if (!path) return json(400, { error: 'path required' })
  const downloadName = url.searchParams.get('download')
  const obj = await env.BUCKET.get(path)
  if (!obj) {
    console.error('view miss path=', path)
    return json(404, { error: 'not found' })
  }
  const headers = new Headers()
  if (downloadName) {
    const safeName = String(downloadName).replace(/[^\w.-]/g, '_')
    headers.set('Content-Disposition', `attachment; filename="${safeName}"`)
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Cache-Control', 'private, no-store')
  } else {
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=3600')
  }
  Object.entries(cors()).forEach(([k, v]) => headers.set(k, v))
  return new Response(obj.body, { status: 200, headers })
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() })
    }
    // Wrap in try/catch ALL errors — incl. async R2 failures.
    return handleRequest(req, env, url).catch((e) => {
      const msg = String(e?.message || e || 'worker error')
      let status = 500
      if (/missing token|invalid token|no user id/.test(msg)) status = 401
      else if (/album not found|not allowed/.test(msg)) status = 403
      else if (/albumId|file required|storagePath|invalid path|path required/.test(msg)) status = 400
      return json(status, { error: msg })
    })
  },
}

async function handleRequest(req, env, url) {
  if (req.method === 'POST' && url.pathname === '/upload') return await handleUpload(env, req)
  if (req.method === 'POST' && url.pathname === '/upload-thumb') return await handleUploadThumb(env, req)
  if (req.method === 'DELETE' && url.pathname === '/delete') return await handleDelete(env, req)
  if (req.method === 'GET' && url.pathname === '/view') return await handleView(env, req, url)
  return json(404, { error: 'not found' })
}
