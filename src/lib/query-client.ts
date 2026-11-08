import { QueryClient } from '@tanstack/react-query'

/** The app's one query client (also restored from and saved to the browser, see query-persist). */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
})
