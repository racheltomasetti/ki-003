// Protected layout — middleware handles the redirect if no session.
// Nav shell goes here in Checkpoint D when library is built.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream dark:bg-charcoal">
      {children}
    </div>
  )
}
