import { View } from 'react-native'

export const BAR_COUNT = 44
const BAR_MIN_HEIGHT = 3
const BAR_MAX_HEIGHT = 52

interface WaveformProps {
  amplitudes: number[] // BAR_COUNT values, each 0–1
  color: string
}

export function Waveform({ amplitudes, color }: WaveformProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: BAR_MAX_HEIGHT + BAR_MIN_HEIGHT,
        gap: 3,
        paddingHorizontal: 2,
      }}
    >
      {amplitudes.map((amp, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: BAR_MIN_HEIGHT + amp * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT),
            backgroundColor: color,
            borderRadius: 2,
            opacity: 0.5 + amp * 0.5, // quieter bars are slightly faded
          }}
        />
      ))}
    </View>
  )
}

/** Normalize a dBFS metering value to 0–1. Voice sits roughly -60 to -10 dBFS. */
export function normalizeDb(db: number): number {
  const min = -60
  const max = -10
  return Math.max(0, Math.min(1, (db - min) / (max - min)))
}

/** Produces a natural-looking pseudo-random amplitude for fallback / silence. */
export function simulatedAmplitude(base = 0.15): number {
  return Math.max(0.05, Math.min(1, base + (Math.random() - 0.5) * 0.2))
}
