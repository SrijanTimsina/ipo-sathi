import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardContent } from '#/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { useAuth } from '#/shared/hooks/useAuth'
import { Eye, EyeOff, Info } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const loginSchema = z.object({
  mobileNumber: z.string().min(7, 'Enter a valid mobile number'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobileNumber: '', password: '' },
  })

  async function onSubmit(values: LoginForm): Promise<void> {
    try {
      await login(values.mobileNumber, values.password)
      await router.navigate({ to: '/dashboard' })
    } catch {
      toast.error('Login failed. Check your credentials and try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        {/* Logo */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="IPO Sathi Logo"
            className="h-20 w-auto object-contain mb-2"
          />
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-green-400 to-cyan-500 bg-clip-text text-transparent">
            IPO Sathi
          </h1>
          <p className="text-muted-foreground text-center max-w-sm mt-2">
            Automated bulk IPO applications with real-time WhatsApp
            notifications.
          </p>
        </div>

        <Card>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input
                          id="mobile-number"
                          type="tel"
                          placeholder="98XXXXXXXX"
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="sr-only">
                              Toggle password visibility
                            </span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  id="login-submit"
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="p-5 bg-muted/30 border border-border/50 rounded-lg flex flex-col gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void router.navigate({ to: '/dashboard' })}
          >
            Continue without Sign In
          </Button>

          <div className="text-sm text-muted-foreground flex gap-3 items-start">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>
                All account information and MeroShare requests are made securely
                through your browser. The developer does not have access to any
                account information.
              </p>
              <p>
                <strong>Note:</strong> Auto-apply, auto result check, and
                WhatsApp messages are not available in this version.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center space-y-2 mt-8">
          <p className="text-lg text-muted-foreground">
            Built by{' '}
            <a
              href="https://srijantimsina.com.np"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors hover:underline"
            >
              Srijan Timsina
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
