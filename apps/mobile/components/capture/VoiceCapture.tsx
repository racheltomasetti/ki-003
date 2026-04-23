import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { uploadMedia } from '@ki/services'
import { useCreateCapture, useAddTagToCapture } from '@/hooks/useCaptures'
import { useAddCaptureToProject } from '@/hooks/useProjects'
import { Waveform, BAR_COUNT, normalizeDb, simulatedAmplitude } from './Waveform'
import { ReviewCapture } from './ReviewCapture'
import { ThemedLogo } from './ThemedLogo'
import { useAppTheme } from '@/hooks/useAppTheme'

const MAX_RECORDING_SECONDS = 600
const LOGO_SIZE = 200

type CaptureState = 'idle' | 'recording' | 'processing' | 'review' | 'error'

interface VoiceCaptureProps {
  onComplete?: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

async function transcribeAudio(uri: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', {
    uri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as unknown as Blob)
  formData.append('model', 'whisper-1')
  formData.append('language', 'en')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Transcription failed: ${text}`)
  }
  const data = await response.json()
  return data.text as string
}

export function VoiceCapture({ onComplete }: VoiceCaptureProps = {}) {
  const { isDark, colors } = useAppTheme()
  const router = useRouter()
  const { session } = useAuthStore()
  const createCapture = useCreateCapture()
  const addTagToCapture = useAddTagToCapture()
  const addCaptureToProject = useAddCaptureToProject()

  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(BAR_COUNT).fill(0.05))
  const [transcript, setTranscript] = useState('')
  const [capturedAt, setCapturedAt] = useState<Date>(new Date())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true })
  const audioUriRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef<CaptureState>('idle')

  useEffect(() => { stateRef.current = captureState }, [captureState])

  const rotation = useSharedValue(0)
  const logoScale = useSharedValue(1)
  // Worklet-readable flag: 0 = processing (force scale=1), 1 = allow scale animation
  const scaleEnabled = useSharedValue(1)

  useEffect(() => {
    if (captureState === 'processing') {
      scaleEnabled.value = 0
      cancelAnimation(logoScale)
      logoScale.value = 1
      rotation.value = withRepeat(
        withTiming(360, { duration: 1800, easing: Easing.linear }),
        -1,
        false,
      )
    } else if (captureState === 'recording') {
      scaleEnabled.value = 1
      cancelAnimation(rotation)
      rotation.value = 0
      logoScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      )
    } else {
      scaleEnabled.value = 0
      cancelAnimation(rotation)
      cancelAnimation(logoScale)
      rotation.value = 0
      logoScale.value = 1
    }
  }, [captureState])

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scaleEnabled.value ? logoScale.value : 1 },
    ],
  }))

  const stopRecordingInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleStop = useCallback(async () => {
    if (stateRef.current !== 'recording') return
    stopRecordingInterval()
    setCaptureState('processing')

    try {
      await recorder.stop()
      const uri = recorder.uri
      if (!uri) throw new Error('No audio recorded.')
      audioUriRef.current = uri

      const text = await transcribeAudio(uri)
      setTranscript(text)
      setCaptureState('review')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Something went wrong.')
      setCaptureState('error')
    }
  }, [recorder, stopRecordingInterval])

  const handleStart = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync()
    if (!permission.granted) {
      setErrorMessage('Microphone access is required to capture your thoughts.')
      setCaptureState('error')
      return
    }

    setElapsed(0)
    setAmplitudes(Array(BAR_COUNT).fill(0.05))
    setCapturedAt(new Date())
    setCaptureState('recording')

    await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
    await recorder.prepareToRecordAsync()
    recorder.record()

    intervalRef.current = setInterval(() => {
      if (stateRef.current !== 'recording') return

      setElapsed(prev => {
        const next = prev + 0.08
        if (next >= MAX_RECORDING_SECONDS) handleStop()
        return next
      })

      const rawLevel = (recorder as unknown as { currentLevel?: number }).currentLevel
      const amp = typeof rawLevel === 'number'
        ? normalizeDb(rawLevel)
        : simulatedAmplitude(0.3)
      setAmplitudes(prev => [...prev.slice(1), amp])
    }, 80)
  }

  const handleLogoPress = () => {
    if (captureState === 'idle') handleStart()
    else if (captureState === 'recording') handleStop()
  }

  const handleSave = async (mediaLocalUris: string[], tagIds: string[], projectIds: string[]) => {
    const userId = session!.user.id

    const mediaPaths: string[] = []
    for (const uri of mediaLocalUris) {
      try {
        const response = await fetch(uri)
        const blob = await response.blob()
        const ext = uri.split('.').pop() ?? 'jpg'
        const uploaded = await uploadMedia(supabase, userId, blob, `image/${ext}`)
        if (uploaded) mediaPaths.push(uploaded.path)
      } catch {
        // Non-fatal — skip failed image uploads
      }
    }

    const capture = await createCapture.mutateAsync({
      type: 'voice',
      source_type: 'voice',
      enrichment_profile: 'personal',
      body: transcript,
      media_paths: mediaPaths.length > 0 ? mediaPaths : undefined,
      captured_at: capturedAt.toISOString(),
    })

    for (const tagId of tagIds) {
      await addTagToCapture.mutateAsync({ captureId: capture.id, tagId })
    }

    for (const projectId of projectIds) {
      await addCaptureToProject.mutateAsync({ captureId: capture.id, projectId })
    }

    if (audioUriRef.current) {
      FileSystem.deleteAsync(audioUriRef.current, { idempotent: true }).catch(() => {})
      audioUriRef.current = null
    }

    setCaptureState('idle')
    setTranscript('')
    setElapsed(0)
    if (onComplete) {
      onComplete()
    } else {
      router.replace('/(tabs)/library')
    }
  }

  const handleDiscard = async () => {
    stopRecordingInterval()
    if (audioUriRef.current) {
      await FileSystem.deleteAsync(audioUriRef.current, { idempotent: true })
      audioUriRef.current = null
    }
    setTranscript('')
    setAmplitudes(Array(BAR_COUNT).fill(0.05))
    setElapsed(0)
    setCaptureState('idle')
  }

  const textColor = colors.foregroundMuted
  const isRecording = captureState === 'recording'
  const isProcessing = captureState === 'processing'

  if (captureState === 'review') {
    return (
      <ReviewCapture
        transcript={transcript}
        capturedAt={capturedAt}
        onTranscriptChange={setTranscript}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={createCapture.isPending}
      />
    )
  }

  if (captureState === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { fontFamily: 'Poppins-Regular', color: '#9e2a2b' }]}>
          {errorMessage}
        </Text>
        <TouchableOpacity onPress={handleDiscard} style={styles.retryButton}>
          <Text style={{ fontFamily: 'Poppins-Medium', color: colors.foreground, fontSize: 14 }}>
            Try again
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.centered}>
      <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.8} disabled={isProcessing}>
        <Animated.View style={logoAnimStyle} collapsable={false}>
          <ThemedLogo isDark={isDark} size={LOGO_SIZE} />
        </Animated.View>
      </TouchableOpacity>

      {/* Always rendered — reserves space so logo never shifts */}
      <View style={styles.waveformContainer}>
        {isRecording && (
          <>
            <Waveform amplitudes={amplitudes} color={colors.foreground} />
            <Text style={[styles.timer, { fontFamily: 'Poppins-Regular', color: textColor }]}>
              {formatDuration(elapsed)}
            </Text>
          </>
        )}
        {isProcessing && (
          <Text style={[styles.processingText, { fontFamily: 'Poppins-Regular', color: textColor }]}>
            Processing your capture…
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  waveformContainer: {
    width: '100%',
    height: 90,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  timer: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  processingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
})
