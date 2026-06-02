import { Card, CardContent } from "@/components/ui/Card";

export function DecksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">My Decks</h1>
      <Card>
        <CardContent>
          <p className="text-muted text-sm">
            Deck list, Moxfield import, and the precon library are wired up in Faza 6 & 7.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
