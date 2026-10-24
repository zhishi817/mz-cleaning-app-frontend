import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av'

type Source = { uri: string; headers?: Record<string, string> }
type Props = { source: Source; testID?: string }

export default function CleaningMediaVideo({ source, testID = 'cleaning-media-video' }: Props) {
  const [attempt, setAttempt] = useState(0)
  // Remount atomically on source/auth changes or retry. No render for task B
  // may reuse task A's playable bytes, state or late player callbacks.
  return <CleaningMediaVideoAttempt key={`${source.uri}\n${source.headers?.Authorization || ''}\n${attempt}`} source={source} testID={testID} onRetry={() => setAttempt((value) => value + 1)} />
}

function CleaningMediaVideoAttempt({ source, testID, onRetry }: Props & { onRetry: () => void }) {
  const player = useRef<Video | null>(null)
  const [playableSource, setPlayableSource] = useState<Source | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [controlNotice, setControlNotice] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)
  const uri = source.uri
  const authorization = source.headers?.Authorization

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    const controller = new AbortController()
    setLoaded(false)
    setPlaying(false)
    setBuffering(false)
    setError(null)
    setPlayableSource(null)
    setAspectRatio(16 / 9)
    if (!uri) {
      setError('没有可读取的视频来源，请返回任务后重试')
      return () => { active = false }
    }
    // HTML video cannot attach Authorization headers. Keep the same protected
    // endpoint and read its bytes with fetch; never put credentials in a URL.
    if (Platform.OS === 'web' && authorization && /^https?:/i.test(uri)) {
      void fetch(uri, { headers: { Authorization: authorization }, signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(response.status === 403 ? '无查看此视频的权限' : response.status === 401 ? '登录已失效，请重新登录' : '视频读取失败，请重试')
          const blob = await response.blob()
          if (!blob.size) throw new Error('视频内容为空，请重试')
          if (!active) return
          objectUrl = URL.createObjectURL(blob)
          setPlayableSource({ uri: objectUrl })
        })
        .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : '视频读取失败，请重试') })
    } else setPlayableSource(source)
    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // Headers are authenticated by their value, not the caller's object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, authorization])

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      if (status.error) setError('视频无法播放，请重试；若仍失败请联系管理员')
      return
    }
    setLoaded(true)
    setPlaying(status.isPlaying)
    setBuffering(status.isBuffering)
  }

  return (
    <View testID={testID} style={styles.container}>
      <View testID={`${testID}-frame`} style={[styles.frame, { aspectRatio }]}>
        {playableSource && !error ? <Video
          ref={player}
          testID={`${testID}-player`}
          source={playableSource}
          style={styles.video}
          videoStyle={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          useNativeControls
          onPlaybackStatusUpdate={onStatus}
          onReadyForDisplay={(event) => {
            const naturalSize = event?.naturalSize
            if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) setAspectRatio(naturalSize.width / naturalSize.height)
          }}
          onError={() => setError('视频无法播放，请重试；若仍失败请联系管理员')}
        /> : null}
        {(!loaded || buffering) && !error ? <View style={styles.message} pointerEvents="none"><ActivityIndicator color="#FFFFFF" /><Text style={styles.messageText}>{loaded ? '视频缓冲中…' : '视频加载中…'}</Text></View> : null}
      </View>
      {error ? <View style={styles.error}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" testID={`${testID}-retry`} onPress={onRetry} style={styles.button}><Text style={styles.buttonText}>重新读取视频</Text></Pressable></View> : null}
      {loaded && !error ? <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? '暂停视频' : '播放视频'} onPress={() => { const current = player.current; if (current) void (playing ? current.pauseAsync() : current.playAsync()).catch(() => setError('视频无法播放，请重试')) }} style={styles.button}><Text style={styles.buttonText}>{playing ? '暂停' : '播放'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="全屏查看视频" onPress={() => { void player.current?.presentFullscreenPlayer().catch(() => setControlNotice('暂时无法全屏，可继续在当前页面播放')) }} style={styles.button}><Text style={styles.buttonText}>全屏</Text></Pressable>
        <Text style={styles.hint}>拖动播放器进度条回看</Text>
      </View> : null}
      {controlNotice && !error ? <Text accessibilityRole="alert" style={styles.hint}>{controlNotice}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 10 },
  frame: { width: '100%', backgroundColor: '#111827', overflow: 'hidden', borderRadius: 10 },
  video: { width: '100%', height: '100%' },
  message: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8 },
  messageText: { color: '#FFFFFF' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  button: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#2563EB' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  hint: { color: '#64748B', fontSize: 12 },
  error: { gap: 8, padding: 12, backgroundColor: '#FFF7ED', borderRadius: 10 },
  errorText: { color: '#9A3412' },
})
