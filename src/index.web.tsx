import 'react-native-reanimated'
import "@expo/metro-runtime"
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web"
import { App } from "expo-router/build/qualified-entry"
import { renderRootComponent } from "expo-router/build/renderRootComponent"
import { version } from 'canvaskit-wasm/package.json'

// This file should only import and register the root. No components or exports
// should be added here.
LoadSkiaWeb({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${version}/bin/full/${file}`
  },
}).then(async () => {
  renderRootComponent(App)
})
