import React, { useEffect, useMemo, useState } from 'react'
import { TouchableOpacity, View, useWindowDimensions, Image as RNImage, Platform, Text } from 'react-native'
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler'
import { Canvas, Group, Image, useAnimatedImageValue, useImage } from '@shopify/react-native-skia'
import { Easing, Extrapolation, cancelAnimation, interpolate, runOnJS, useAnimatedReaction, useDerivedValue, useFrameCallback, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Audio } from 'expo-av'
import useHotkeys from '@/hook/useHotkeys'

const GRAVITY = 700
const JUMP_FORCE = -360
const IMAGE_SWAP_FROM_SCORE = 15
const BIRD_HEIGHT = 40
const BIRD_WIDTH = 64
const PIPE_WIDTH = 104
const PIPE_HEIGHT = 640
const PIPE_DISTANCE = 190

const App = () => {
  const { width: w, height: h } = useWindowDimensions()
  const [bgSound, setBgSound] = useState<Audio.Sound>()
  const [jumpSound, setJumpSound] = useState<Audio.Sound>()
  const [score, setScore] = useState(0)
  const [isPlayingFistTime, setIsPlayingFirstTime] = useState(true)

  const insets = useSafeAreaInsets()
  const bg = useImage(require('../sprites/background-day.png'))
  const bgNight = useImage(require('../sprites/background-night.png'))
  const bird = useAnimatedImageValue(require('../sprites/bird.gif'))
  const pipeTop = useImage(require('../sprites/pipe-green-top.png'))
  const pipeBottom = useImage(require('../sprites/pipe-green-bottom.png'))
  const base = useImage(require('../sprites/base.png'))
  const gameOver = useImage(require('../sprites/gameover.png'))
  const [isShowTryAgain, setIsShowTryAgain] = useState(false)
  const isGameOver = useSharedValue(false)

  const width = useMemo(() => {
    if (Platform.OS === 'web') {
      if (w > 800) return 800
    }
    return w
  }, [w])

  const height = useMemo(() => {
    if (Platform.OS === 'web') {
      if (h > 800) return 800
    } 
    return h
  }, [h])

  const pipeX = useSharedValue(width)
  const pipeTopY = useSharedValue(height / 2 + 200)
  const pipeBottomY = useDerivedValue(() => pipeTopY.value - PIPE_DISTANCE - PIPE_HEIGHT)

  const baseX = useSharedValue(0)
  const birdX = width / 4 - 20
  const birdY = useSharedValue(200)
  const birdVelocity = useSharedValue(200)

  const gameOverOpacity = useDerivedValue(() => {
    return isGameOver.value
      ? withTiming(1, { duration: 800 })
      : 0
  })

  const loadSound = async () => {
    try {
      const { sound: _bgSound } = await Audio.Sound.createAsync(require('../assets/audios/cruising-down-8bit-lane-159615.mp3'))
      const { sound: _jumpSound } = await Audio.Sound.createAsync(require('../assets/audios/cartoon-jump.mp3'))
      await _bgSound.setIsLoopingAsync(true)
      await _bgSound.setVolumeAsync(0.7)
      setBgSound(_bgSound)
      setJumpSound(_jumpSound)
    } catch (e) {
      console.log('e:', e)
    }
  }

  const birdRotation = useDerivedValue(() => {
    if (!isPlayingFistTime) return [
      { rotate: interpolate(birdVelocity.value, [-500, 500], [-0.5, 0.5], Extrapolation.CLAMP) }
    ]
    return []
  })

  const bgOpacity = useSharedValue(1)
  const bgNightOpacity = useSharedValue(0)

  const birdOrigin = useDerivedValue(() => {
    return { x: width / 4 - 20, y: birdY.value + 20 }
  })

  const restart = () => {
    setIsShowTryAgain(false)
    isGameOver.value = false
    birdY.value = 200
    baseX.value = 0
    birdVelocity.value = 200
    runOnJS(setScore)(0)
    bgOpacity.value = 1
    bgNightOpacity.value = 0
    pipeX.value = width
    setTimeout(() => {
      pipeX.value = withRepeat(
        withTiming(-140, { duration: 3000, easing: Easing.linear })
      , -1)
    }, 1000)
    baseX.value = withRepeat(
      withTiming(-width, { duration: 3000, easing: Easing.linear })
    , -1)
  }

  const onGameOver = () => {
    isGameOver.value = true
    cancelAnimation(baseX)
    cancelAnimation(pipeX)
    runOnJS(setIsShowTryAgain)(true)
  }

  const onTap = () => {
    if (!isPlayingFistTime) {
      if (!isGameOver.value) {
        birdVelocity.value = JUMP_FORCE
        runOnJS(() => jumpSound?.playFromPositionAsync(0).catch((e) => console.log('e:', e)))()
        // runOnJS(jumpSound?.stopAsync)().then(() => console.log('stop'))
        // ().then(() => {
        //   jumpSound?.playAsync().catch(() => {})
        // }).catch((e) => {})
      }
    } else {
      runOnJS(() => bgSound?.playAsync().catch((e) => console.log('e:', e)))()
      runOnJS(setIsPlayingFirstTime)(false)
      runOnJS(restart)()
    }
  }

  const gesture = Gesture.Tap().onStart(onTap)
  useHotkeys('space', () => onTap())

  useAnimatedReaction(
    () => birdY.value,
    (currentValue, previousValue) => {
      if (
        !isGameOver.value &&
        currentValue !== previousValue &&
        previousValue
      ) {
        const isTouchTopOrBottomScreen = (
          (currentValue > height - 150 && previousValue > height - 150) ||
          (currentValue <= 0 && previousValue > 0)
        )
        const isTouchTopPipe = (
          birdX - 15 >= pipeX.value - BIRD_WIDTH &&
          currentValue >= pipeTopY.value - BIRD_HEIGHT &&
          birdX + 5 <= pipeX.value + PIPE_WIDTH
        )
        const isTouchBottomPipe = (
          birdX - 15 >= pipeX.value - BIRD_WIDTH &&
          currentValue - 23 <= PIPE_HEIGHT + pipeBottomY.value - BIRD_HEIGHT &&
          birdX + 5 <= pipeX.value + PIPE_WIDTH
        )

        if (isTouchTopOrBottomScreen || isTouchTopPipe || isTouchBottomPipe) {
          runOnJS(onGameOver)()
        }
      }
    },
  )

  useAnimatedReaction(
    () => pipeX.value,
    (currentValue, previousValue) => {
      const passPipe = width / 5
      if (
        currentValue !== previousValue &&
        previousValue &&
        currentValue < passPipe &&
        previousValue > passPipe
      ) {
        runOnJS(setScore)(score + 1)
      }
      if (
        currentValue !== previousValue &&
        previousValue &&
        currentValue <= -PIPE_WIDTH &&
        previousValue >= -PIPE_WIDTH
      ) {
        const min = 200
        const max = Math.floor(height - min)
        pipeTopY.value = Math.floor(Math.random() * (max - min + 1)) + min
      }
    }
  )

  useFrameCallback(({ timeSincePreviousFrame: dt }) => {
    if (dt && !isGameOver.value && !isPlayingFistTime) {
      birdY.value = birdY.value + (birdVelocity.value * dt / 1000)
      birdVelocity.value = birdVelocity.value + (GRAVITY * dt) / 1000
    }
  })

  useEffect(() => {
    loadSound()
  }, [])

  useEffect(() => {
    if (score > 0 && score % IMAGE_SWAP_FROM_SCORE === 0) {
      if (bgOpacity.value === 1) {
        bgOpacity.value = withTiming(0, { duration: 1000 })
        setTimeout(() => {
          bgNightOpacity.value = withTiming(1, { duration: 1500 })
        }, 800)
      } else {
        bgNightOpacity.value = withTiming(0, { duration: 1000 })
        setTimeout(() => {
          bgOpacity.value = withTiming(1, { duration: 1500 })
        }, 800)
      }
    }
  }, [score])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <View style={{ height, position: 'relative', flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ccc' }}>
          <Canvas
            style={{
              width,
              height,
              backgroundColor: '#000',
              margin: 'auto'
            }}
          >
            <Image
              height={height - 100}
              width={width}
              image={bg}
              fit='cover'
              opacity={bgOpacity}
            />
            <Image
              height={height - 100}
              width={width}
              image={bgNight}
              fit='cover'
              opacity={bgNightOpacity}
            />
            <Image
              width={PIPE_WIDTH}
              height={PIPE_HEIGHT}
              image={pipeBottom}
              x={pipeX}
              y={pipeBottomY}
            />
            <Image
              width={PIPE_WIDTH}
              height={PIPE_HEIGHT}
              image={pipeTop}
              x={pipeX}
              y={pipeTopY}
            />
            <Image
              width={width * 2}
              height={100}
              image={base}
              fit='fill'
              y={height - 100}
              x={baseX}
            />
            <Group
              transform={birdRotation}
              origin={birdOrigin}
            >
              <Image
                height={BIRD_HEIGHT}
                width={BIRD_WIDTH}
                image={bird}
                x={birdX}
                y={birdY}
              />
            </Group>
            <Image
              height={84}
              width={width * 0.7}
              x={width / 2 - (width * 0.7 / 2)}
              y={height / 2 - 84}
              image={gameOver}
              opacity={gameOverOpacity}
              fit="contain"
            />
          </Canvas>
          {isShowTryAgain && (
          <TouchableOpacity
            style={{ backgroundColor: 'white', borderRadius: 250, paddingHorizontal: 16, paddingVertical: 6, position: 'absolute', top: insets.bottom + 50 + height / 2, zIndex: 10 }}
            onPress={runOnJS(restart)}
          >
            <RNImage
              source={require('../sprites/tryagain.png')}
              resizeMode="contain"
              style={{
                width: 250,
                height: 40,
                resizeMode: 'contain',
              }}
            />
          </TouchableOpacity>
          )}
          <Text
            style={{
              position: 'absolute',
              top: insets.top + 20,
              width: '100%',
              textAlign: 'center',
              color: 'white',
              fontSize: 34,
              fontWeight: '900'
            }}
          >
            {`Score: ${score}`}
          </Text>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

export default App
