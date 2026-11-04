import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ProfileForm } from "@/features/profile/profile-form";
import { DerivedValuesList } from "@/features/profile/derived-values";
import { computeDerived, getProfile } from "@/features/profile/service";

/**
 * Profile page. Guards on the session and scopes the read to the signed-in
 * user's id (the data-ownership rule). Shows the computed values alongside the
 * create/update form; when no profile exists yet the form renders its empty
 * state and the summary shows the domain library's "missing input" signals.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(user.id);
  const derived = profile ? computeDerived(profile) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold">
          FitMind AI
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <section>
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">
          {profile
            ? "Update your details and we'll recompute your estimates."
            : "Tell us about yourself to see your personalized estimates. Everything except what's needed for the math is optional."}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Computed values</CardTitle>
        </CardHeader>
        <CardContent>
          {derived ? (
            <DerivedValuesList derived={derived} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No profile yet. Fill in the form below and save to see your BMI, BMR, TDEE,
              daily calorie target, and macro split.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            These are orientational estimates, not medical advice. For flagged situations the
            app disables automatic targeting and asks you to consult a professional.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{profile ? "Edit your details" : "Create your profile"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </main>
  );
}
