import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/auth-provider";
import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { login } from "@/lib/central/client";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isHydrated, setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      navigate(searchParams.get("redirect") ?? "/", { replace: true });
    }
  }, [isAuthenticated, isHydrated, navigate, searchParams]);

  const handleSubmit = async (formData: FormData) => {
    const nextEmail = formData.get("email");
    const password = formData.get("password");

    if (typeof nextEmail !== "string" || typeof password !== "string") {
      toast({
        type: "error",
        description: "Failed validating your submission!",
      });
      return;
    }

    setEmail(nextEmail);
    setIsSubmitting(true);

    try {
      const session = await login(nextEmail, password);
      setSession(session);
      setIsSuccessful(true);
      navigate(searchParams.get("redirect") ?? "/", { replace: true });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Invalid credentials!",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Use your email and password to sign in
          </p>
        </div>
        <AuthForm action={handleSubmit} defaultEmail={email}>
          <SubmitButton isPending={isSubmitting} isSuccessful={isSuccessful}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </SubmitButton>
          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {"Don't have an account? "}
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              to="/register"
            >
              Sign up
            </Link>
            {" for free."}
          </p>
        </AuthForm>
      </div>
    </div>
  );
}
