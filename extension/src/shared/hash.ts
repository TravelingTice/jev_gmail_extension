export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const fingerprintMetadata = async (fields: {
  senderName: string | null
  senderAddress: string | null
  subject: string | null
  snippet: string | null
  dateLabel: string | null
}): Promise<string> =>
  sha256Hex(
    JSON.stringify([
      fields.senderName,
      fields.senderAddress,
      fields.subject,
      fields.snippet,
      fields.dateLabel,
    ]),
  )

export const configHash = async (material: unknown): Promise<string> =>
  sha256Hex(JSON.stringify(material))
