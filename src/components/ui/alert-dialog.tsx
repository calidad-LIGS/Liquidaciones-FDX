import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  cancelLabel?: string
  actionLabel: string
  onConfirm: () => void
  destructive?: boolean
}

function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = 'Cancelar',
  actionLabel,
  onConfirm,
  destructive,
}: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
          {actionLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export { AlertDialog }
