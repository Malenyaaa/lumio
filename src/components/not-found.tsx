import { Link } from '@/components/link'
import { notFoundMessages } from '@/components/messages'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/lib/i18n'

export function NotFound() {
  const t = useMessages(notFoundMessages)
  return (
    <div className="grid min-h-[60svh] place-items-center px-4 text-center">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <Button nativeButton={false} render={<Link to="/" />}>{t.home}</Button>
      </div>
    </div>
  )
}
