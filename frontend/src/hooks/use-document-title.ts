import { useEffect } from 'react'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · QC Digital Service Portal` : 'QC Digital Service Portal'
    return () => {
      document.title = previous
    }
  }, [title])
}
