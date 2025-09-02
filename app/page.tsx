import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Shopify Analytics
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Private analytics dashboard for your Shopify store
          </p>
        </div>

        <Link href="/login">
          <Button size="lg" className="px-8">
            Login to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
