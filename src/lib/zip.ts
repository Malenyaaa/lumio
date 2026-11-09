/**
 * Reads the files of a zip archive in the browser (stored or deflated entries, as exports from services come), one at a
 * time, without a library: the archive's directory at its end says where each file is, and the browser's
 * DecompressionStream unpacks it. No ZIP64 (archives beyond 4 GB) and no encryption.
 */
export interface ZipEntry {
  name: string
  size: number
  read: () => Promise<Uint8Array>
}

const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
const LOCAL_HEADER = 0x04034b50

export async function zipEntries(file: Blob): Promise<ZipEntry[]> {
  // The end record sits in the last 22 bytes, plus a comment of up to 64 KB.
  const tailStart = Math.max(0, file.size - 22 - 65_535)
  const tail = new DataView(await file.slice(tailStart).arrayBuffer())
  let end = -1
  for (let at = tail.byteLength - 22; at >= 0; at--) {
    if (tail.getUint32(at, true) === END_OF_DIRECTORY) {
      end = at
      break
    }
  }
  if (end < 0) throw new Error('Not a zip archive')
  const count = tail.getUint16(end + 10, true)
  const directorySize = tail.getUint32(end + 12, true)
  const directoryStart = tail.getUint32(end + 16, true)
  const directory = new DataView(await file.slice(directoryStart, directoryStart + directorySize).arrayBuffer())
  const names = new TextDecoder()
  const entries: ZipEntry[] = []
  let at = 0
  for (let index = 0; index < count && at + 46 <= directory.byteLength; index++) {
    if (directory.getUint32(at, true) !== DIRECTORY_ENTRY) break
    const method = directory.getUint16(at + 10, true)
    const compressedSize = directory.getUint32(at + 20, true)
    const size = directory.getUint32(at + 24, true)
    const nameLength = directory.getUint16(at + 28, true)
    const extraLength = directory.getUint16(at + 30, true)
    const commentLength = directory.getUint16(at + 32, true)
    const offset = directory.getUint32(at + 42, true)
    const name = names.decode(new Uint8Array(directory.buffer, directory.byteOffset + at + 46, nameLength))
    at += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    entries.push({
      name,
      size,
      read: async () => {
        // The local header repeats the name and may have extra data of another length than in the directory.
        const header = new DataView(await file.slice(offset, offset + 30).arrayBuffer())
        if (header.getUint32(0, true) !== LOCAL_HEADER) throw new Error(`Damaged entry: ${name}`)
        const start = offset + 30 + header.getUint16(26, true) + header.getUint16(28, true)
        const data = file.slice(start, start + compressedSize)
        if (method === 0) return new Uint8Array(await data.arrayBuffer())
        if (method !== 8) throw new Error(`Unsupported compression in ${name}`)
        const stream = data.stream().pipeThrough(new DecompressionStream('deflate-raw'))
        return new Uint8Array(await new Response(stream).arrayBuffer())
      },
    })
  }
  return entries
}
