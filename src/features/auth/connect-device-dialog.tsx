import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api'
import { IconDeviceTvOld, IconLoader2 } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CodeInput } from '@/components/code-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { messagesFor, useMessages } from '@/lib/i18n'
import { connectDeviceMessages } from './messages'
import { useAuthedSession } from './session'

const CODE_LENGTH = 6

/** Approves the Quick Connect code another device (TV, phone, a new Lumio) is showing. */
export function ConnectDeviceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { api, session } = useAuthedSession()
  const [code, setCode] = useState('')
  const t = useMessages(connectDeviceMessages)

  const authorize = useMutation({
    mutationFn: async (value: string) => {
      const { data: ok } = await getAuthenticationApi(api).authorizeQuickConnect({ code: value, userId: session.userId })
      if (!ok) throw new Error('rejected')
    },
    onSuccess: () => {
      toast.success(messagesFor(connectDeviceMessages).connected)
      setCode('')
      onOpenChange(false)
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (code.length === CODE_LENGTH) authorize.mutate(code)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCode('')
          authorize.reset()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 grid size-12 place-items-center rounded-full bg-muted">
            <IconDeviceTvOld className="size-6" />
          </div>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-balance">
            {t.description}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5 pt-2" onSubmit={onSubmit}>
          <CodeInput
            autoFocus
            label={t.codeLabel}
            length={CODE_LENGTH}
            value={code}
            invalid={authorize.isError}
            disabled={authorize.isPending}
            onChange={(value) => {
              setCode(value)
              if (authorize.isError) authorize.reset()
            }}
            // A full code is sent right away; the button is there for retrying.
            onComplete={(value) => authorize.mutate(value)}
          />
          <p className="min-h-5 text-center text-sm text-destructive" aria-live="polite">
            {authorize.isError && t.invalid}
          </p>
          <Button type="submit" size="lg" disabled={code.length < CODE_LENGTH || authorize.isPending}>
            {authorize.isPending && <IconLoader2 className="animate-spin" />}
            {t.connect}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
