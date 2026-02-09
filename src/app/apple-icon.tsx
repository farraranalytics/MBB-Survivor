import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D1B2A',
          borderRadius: 36,
        }}
      >
        {/* Basketball — filled circle with seam lines */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: '#FF5722',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Horizontal seam */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: 4,
              background: 'rgba(13,27,42,0.35)',
            }}
          />
          {/* Vertical seam */}
          <div
            style={{
              position: 'absolute',
              width: 4,
              height: '100%',
              background: 'rgba(13,27,42,0.35)',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
