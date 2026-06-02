import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function LoginPage() {
  return (
    <div className="max-w-md mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted text-sm">Auth form wired up in Faza 4.</p>
        </CardContent>
      </Card>
    </div>
  );
}
