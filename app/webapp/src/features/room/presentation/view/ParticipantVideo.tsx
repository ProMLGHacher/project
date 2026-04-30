import { memo, useRef } from 'react'
import { cn } from '@core/design-system'
import { useAttachMediaStream } from '@core/react/useAttachMediaStream'

export const ParticipantVideo = memo(function ParticipantVideo({
  stream,
  muted,
  variant
}: {
  readonly stream: MediaStream
  readonly muted: boolean
  readonly variant: 'participant' | 'screen'
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useAttachMediaStream(ref, stream)

  return (
    <div className="absolute inset-0 z-0 grid place-items-center overflow-hidden bg-surface [contain:layout_paint_style]">
      <div
        className={cn(
          'absolute inset-0',
          variant === 'screen'
            ? 'bg-background/20'
            : 'bg-linear-to-br from-muted/70 via-background/20 to-background/65'
        )}
      />
      <video
        autoPlay
        className={cn(
          'relative h-full w-full translate-z-0 object-contain object-center [contain:paint]',
          variant === 'screen' && 'p-2 sm:p-3'
        )}
        muted={muted}
        playsInline
        ref={ref}
      />
    </div>
  )
})
