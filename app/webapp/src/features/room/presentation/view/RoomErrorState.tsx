import { Button, Card, CardContent } from '@core/design-system'

export interface RoomErrorStateProps {
  readonly title: string
  readonly description: string
  readonly actionLabel: string
  readonly onAction: () => void
}

export function RoomErrorState({ title, description, actionLabel, onAction }: RoomErrorStateProps) {
  return (
    <Card className="grid min-h-[28rem] place-items-center rounded-lg">
      <CardContent className="max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-2xl font-medium text-muted-foreground">
          !
        </div>
        <h2 className="mt-5 text-2xl font-medium text-foreground sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        <Button className="mt-6 rounded-md px-6" onClick={onAction} type="button">
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
