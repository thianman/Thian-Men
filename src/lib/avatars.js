// Avatar cache + upload helpers.
import { supabase } from './supabase.js'

const cache = new Map() // url → HTMLImageElement

// Load an image by URL (cached). Returns the img if already decoded, or null.
// The parent should call again next frame; images load in the background.
export function getAvatarImage(url) {
  if (!url) return null
  const cached = cache.get(url)
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  cache.set(url, img)
  return null
}

// Take an image File, crop centered square, downscale to 256×256, encode as WebP.
export async function processAvatarFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('Not an image')
  if (file.size > 5 * 1024 * 1024) throw new Error('File is too big (5MB max)')
  const bmp = await createImageBitmap(file).catch(async () => {
    // Fallback for older browsers
    return await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = URL.createObjectURL(file)
    })
  })
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const w = bmp.width || bmp.naturalWidth
  const h = bmp.height || bmp.naturalHeight
  const src = Math.min(w, h)
  const sx = (w - src) / 2, sy = (h - src) / 2
  ctx.drawImage(bmp, sx, sy, src, src, 0, 0, size, size)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('Could not encode image')
  if (blob.size > 2 * 1024 * 1024) throw new Error('Compressed image is still >2MB')
  return blob
}

// Upload the processed blob to Supabase Storage at avatars/<userId>/avatar.webp
export async function uploadAvatar(userId, blob) {
  const path = `${userId}/avatar.webp`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true, contentType: 'image/webp',
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
