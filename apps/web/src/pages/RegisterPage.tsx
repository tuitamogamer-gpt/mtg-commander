import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function RegisterPage() {
  return (
    <div className="max-w-md mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted text-sm">Auth form wired up in Faza 4.</p>
        </CardContent>
      </Card>
    </div>
  );
}
