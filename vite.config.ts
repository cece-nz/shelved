import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: mimic the Netlify Hardcover function so `npm run dev` enriches
// ISBN lookups locally, exactly like production. Reads HARDCOVER_TOKEN from
// your .env / .env.local (server-side only — never exposed to the client).
function hardcoverDevApi(): Plugin {
  return {
    name: 'hardcover-dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')

      server.middlewares.use(
        '/.netlify/functions/hardcover',
        async (req, res) => {
          const send = (status: number, body: unknown) => {
            res.statusCode = status
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(body))
          }
          try {
            const { hardcoverLookup } = await server.ssrLoadModule(
              '/src/lib/hardcoverServer.ts',
            )
            const url = new URL(
              req.originalUrl ?? req.url ?? '',
              'http://localhost',
            )
            const result = await hardcoverLookup(
              url.searchParams.get('isbn'),
              env.HARDCOVER_TOKEN,
            )
            send(result.error === 'missing_isbn' ? 400 : 200, result)
          } catch (err) {
            send(200, { match: false, error: String(err) })
          }
        },
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), hardcoverDevApi()],
  server: {
    port: 5175,
    strictPort: true,
  },
})
