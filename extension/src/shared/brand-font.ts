import fontUrl from '../../assets/fonts/figtree-latin.woff2?inline'

// Register on the document so the same local font is available in shadow roots.
export const loadBrandFont = (): void => {
  const font = new FontFace('GmailClass Figtree', `url(${fontUrl})`, {
    style: 'normal',
    weight: '400 700',
    display: 'swap',
  })
  document.fonts.add(font)
  void font.load().catch(() => {
    document.fonts.delete(font)
  })
}
