import {defineConfig} from 'vite';
import {pwa} from './tools/build-pwa';
import {runtimePublicAssets} from './tools/build-public-assets';
export default defineConfig({base:'./',plugins:[runtimePublicAssets(),pwa()],build:{target:'es2022',copyPublicDir:false}});
