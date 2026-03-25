import { defineConfig } from 'vite' 
import react from '@vitejs/plugin-react' 

// https://vite.dev/config/ - Documentation officielle
export default defineConfig({
  plugins: [react()], // Active le support de React dans le bundle Vite
})
