import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { credentialsSchema } from '@/contract/session'
import { NO_INTENDED_DESTINATION, readIntendedDestination } from '@/session/intended-destination'
import { signInFailureMessage, useSignIn } from '@/session/queries'

export const Route = createFileRoute('/login')({
  // The address is the only thing that remembers where the Account was going,
  // and it is read here rather than trusted: a destination this application
  // will not send anyone to is replaced by nothing at all.
  //
  // The key is always named, and named as `undefined` when there is no
  // destination. A route inherits the search its parents parsed and merges its
  // own validation on top, so returning an object without the key would leave
  // the raw, unvetted value the address carried standing underneath — which is
  // precisely the value this is here to refuse.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: readIntendedDestination(search),
  }),
  component: LoginPage,
})

type FieldErrors = Partial<Record<'email' | 'password', string[]>>

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const signIn = useSignIn()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // The fields are uncontrolled and read once, on submit. Nothing here holds a
  // password in React state, and nothing keeps it after the request is made.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)
    const credentials = credentialsSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    })

    if (!credentials.success) {
      setFieldErrors(z.flattenError(credentials.error).fieldErrors)
      // Nothing was sent, so any answer still on screen from the last attempt
      // is now a lie — without this, a rejected password reads as rejected
      // again next to a field error the API never saw.
      signIn.reset()
      return
    }

    setFieldErrors({})
    signIn.mutate(credentials.data, {
      // By the time this runs the session is in the cache, so the guard on the
      // way to the destination finds an answer waiting and asks nothing of the
      // API. Somewhere sensible when nothing was asked for: the root, which
      // decides which Shop this Account belongs at.
      onSuccess: () => navigate({ to: redirect ?? NO_INTENDED_DESTINATION }),
    })
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Sign in</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Validated on submit rather than by the browser, so that the rules
              are the contract's and not a second set written in HTML. */}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Field
              name="email"
              label="Email"
              type="email"
              autoComplete="username"
              errors={fieldErrors.email}
            />
            <Field
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              errors={fieldErrors.password}
            />

            {signIn.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {signInFailureMessage(signIn.error)}
              </p>
            ) : null}

            <Button type="submit" disabled={signIn.isPending}>
              {signIn.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function Field({
  name,
  label,
  errors,
  ...input
}: React.ComponentProps<typeof Input> & { name: string; label: string; errors?: string[] }) {
  const errorId = `${name}-error`

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        {...input}
      />
      {errors ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  )
}
