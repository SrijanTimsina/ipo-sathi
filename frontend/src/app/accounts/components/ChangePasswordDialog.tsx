import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { MeroShareBrowserClient, MeroShareAuthError } from '#/app/ipo/api/ipo.meroshare-client'
import { useUpdateAccount } from '#/app/accounts/api/accounts.queries'
import type { BrokerAccount } from '#/shared/types/api'

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(4, 'Password must be at least 4 characters')
      .max(15, 'Password must be at most 15 characters')
      .refine(
        (val) => (val.match(/[a-z]/g) || []).length >= 3,
        'Password must contain at least 3 lowercase letters',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

interface ChangePasswordDialogProps {
  account: BrokerAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ChangePasswordDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [isChanging, setIsChanging] = useState(false)
  const updateAccount = useUpdateAccount()

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: PasswordForm) {
    if (!account) return

    setIsChanging(true)
    try {
      const client = new MeroShareBrowserClient()
      
      // Step 1: Re-authenticate to get the temporary token for password reset
      let needsPasswordChange = false
      try {
        await client.login(
          account.clientId,
          account.username,
          account.password || '',
          true,
        )
      } catch (error) {
        if (error instanceof MeroShareAuthError && (error.authResponse.passwordExpired || error.authResponse.changePassword)) {
          needsPasswordChange = true
        } else {
          throw error // Rethrow if it's a real login error, like invalid credentials
        }
      }

      if (!needsPasswordChange) {
        toast.error('Account does not require a password change.')
        onOpenChange(false)
        return
      }

      // Step 2: Call changePassword with the client that now holds the temporary token
      await client.changePassword(
        account.password || '',
        values.newPassword,
        values.confirmPassword,
      )

      // Step 3: Update local DB
      await updateAccount.mutateAsync({
        id: account.id,
        payload: { password: values.newPassword },
      })

      toast.success('Password changed successfully')
      form.reset()
      onSuccess()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to change password')
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change MeroShare Password</DialogTitle>
          <DialogDescription>
            Your MeroShare password has expired. Please set a new one. (4-15 characters, at least 3 lowercase letters).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="New Password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Confirm Password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isChanging}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isChanging}>
                {isChanging ? 'Changing...' : 'Change Password'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
