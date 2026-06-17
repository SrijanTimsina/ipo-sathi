import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ProtectedRoute } from '#/shared/components/ProtectedRoute'
import { AppLayout } from '#/shared/components/AppLayout'
import { useCreateAccount } from '#/app/accounts/api/accounts.queries'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '#/components/ui/form'
import { Switch } from '#/components/ui/switch'
import { ArrowLeft, Check, ChevronsUpDown } from 'lucide-react'
import { useCapitals } from '#/app/ipo/api/ipo.queries'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/accounts/new')({
  component: NewAccountPage,
})

const accountSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  crn: z.string().min(1, 'CRN is required'),
  pin: z.string().min(1, 'PIN is required'),
  autoApply: z.boolean().optional(),
  autoReApply: z.boolean().optional(),
})

type AccountForm = z.infer<typeof accountSchema>

function NewAccountPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <NewAccountContent />
      </AppLayout>
    </ProtectedRoute>
  )
}

function NewAccountContent() {
  const router = useRouter()
  const createAccount = useCreateAccount()
  const { data: capitals } = useCapitals()
  const [open, setOpen] = useState(false)

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      clientId: '',
      username: '',
      password: '',
      crn: '',
      pin: '',
      autoApply: true,
      autoReApply: true,
    },
  })

  async function onSubmit(values: AccountForm): Promise<void> {
    try {
      await createAccount.mutateAsync(values)
      toast.success('Account added successfully')
      await router.navigate({ to: '/accounts' })
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        'Failed to add account. Please check your details.'
      toast.error(errorMessage)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add MeroShare Account</h1>
        </div>
      </div>

      <Card>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Depository Participant (Capital)</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            {field.value
                              ? capitals?.find(
                                  (capital) =>
                                    String(capital.id) === field.value,
                                )?.name
                              : 'Select Capital'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput placeholder="Search capital or DP code..." />
                          <CommandList>
                            <CommandEmpty>No capital found.</CommandEmpty>
                            <CommandGroup>
                              {capitals?.map((capital) => (
                                <CommandItem
                                  value={`${capital.name} ${capital.code}`}
                                  key={capital.id}
                                  onSelect={() => {
                                    form.setValue(
                                      'clientId',
                                      String(capital.id),
                                    )
                                    setOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      String(capital.id) === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    )}
                                  />
                                  {capital.name} ({capital.code})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          id="username"
                          placeholder="MeroShare username"
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
                        <Input
                          id="account-password"
                          type="text"
                          placeholder="MeroShare password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="crn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CRN Number</FormLabel>
                      <FormControl>
                        <Input id="crn" placeholder="Your CRN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction PIN</FormLabel>
                      <FormControl>
                        <Input
                          id="pin"
                          type="text"
                          placeholder="4-digit PIN"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="autoApply"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto Apply</FormLabel>
                        <FormDescription>
                          Automatically apply for new IPOs when they open.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="autoReApply"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Auto Re-Apply
                        </FormLabel>
                        <FormDescription>
                          Automatically re-apply if the IPO application is
                          rejected.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.history.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createAccount.isPending}>
                  {createAccount.isPending ? 'Saving…' : 'Add Account'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
