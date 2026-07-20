import { redirect } from 'next/navigation'

export default function HomePage() {
  // Server-side redirect (better for SEO)
  redirect('/home-new')
}
