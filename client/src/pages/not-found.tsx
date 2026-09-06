// The catch-all 404 — most often reached by a RECIPIENT with a broken
// or truncated share link (WhatsApp/iMessage clipping), so it must be a
// warm brand moment with a way home, never dev-speak (audit 2026-07-27).
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-keeper-paper px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center mx-auto mb-4">
            <Compass className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-keeper-ink mb-2">
            We couldn't find that page
          </h1>
          <p className="text-sm text-keeper-body mb-6">
            If someone sent you a card link, it may not have copied across in
            full — ask them to share it again.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-go hover:bg-go-hover text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            data-testid="link-404-home"
          >
            Go to the homepage
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
