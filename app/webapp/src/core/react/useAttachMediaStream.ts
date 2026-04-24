import { useEffect, type RefObject } from 'react'

export function useAttachMediaStream(
  targetRef: RefObject<HTMLMediaElement | null>,
  stream: MediaStream | null
) {
  useEffect(() => {
    const target = targetRef.current
    if (!target) {
      return
    }

    if (target.srcObject !== stream) {
      target.srcObject = stream
    }
  }, [targetRef, stream])
}
