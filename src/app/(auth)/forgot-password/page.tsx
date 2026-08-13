import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { isSelfHosted } from "@/lib/selfHosted";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm selfHosted={isSelfHosted()} />;
}
