import { createHash, randomUUID } from 'crypto'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'

/**
 * S3 abstraction layer for document storage (Air-Gap compliant).
 * 
 * RN-01: Only SHA-256 hashes are stored in the database — no clinical data.
 * Documents are stored on disk or S3 and keyed by SHA-256 hash.
 * 
 * In production, replace this with @aws-sdk/client-s3.
 * For development, uses local filesystem at UPLOAD_DIR.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), '.uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface S3Document {
  key: string       // SHA-256 hash
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
}

/**
 * Compute SHA-256 hash of a Buffer (Air-Gap RN-01)
 */
export function computeSHA256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Store a document at the given key (SHA-256 hash).
 * Returns document metadata.
 */
export async function storeDocument(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<S3Document> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  const key = computeSHA256(buffer)

  // Ensure upload dir exists
  await mkdir(UPLOAD_DIR, { recursive: true })

  // Write to disk — use first 2 chars as prefix dir for scalability
  const prefix = key.slice(0, 2)
  const destDir = join(UPLOAD_DIR, prefix)
  await mkdir(destDir, { recursive: true })
  const destPath = join(destDir, key)
  await writeFile(destPath, buffer)

  return {
    key,
    originalName,
    mimeType,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  }
}

/**
 * Retrieve a document by its SHA-256 hash key.
 * Returns null if not found.
 */
export async function getDocument(
  key: string
): Promise<{ buffer: Buffer; mimeType: string; originalName: string } | null> {
  const prefix = key.slice(0, 2)
  const destPath = join(UPLOAD_DIR, prefix, key)

  try {
    const buffer = await readFile(destPath)
    return { buffer, mimeType: 'application/octet-stream', originalName: key }
  } catch {
    return null
  }
}

/**
 * Delete a document by its SHA-256 hash key.
 */
export async function deleteDocument(key: string): Promise<boolean> {
  const prefix = key.slice(0, 2)
  const destPath = join(UPLOAD_DIR, prefix, key)

  try {
    await unlink(destPath)
    return true
  } catch {
    return false
  }
}
