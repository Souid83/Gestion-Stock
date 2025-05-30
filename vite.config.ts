import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // ⬅️ à ajouter

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src') // ⬅️ alias à ajouter
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
