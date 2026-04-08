import { redirect } from 'next/navigation'

// Root route — redirect to sign-in.
// Once auth middleware is in place this becomes a session check:
//   session → /library
//   no session → /sign-in
export default function RootPage() {
  redirect('/sign-in')
}
