import { SignUp } from "@clerk/nextjs";

export const SignUpView = () => {
  return (
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/workspace"
    />
  );
};
