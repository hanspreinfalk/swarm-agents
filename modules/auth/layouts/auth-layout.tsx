export const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="grid min-h-dvh w-full place-items-center bg-muted/30 px-4">
      {children}
    </div>
  );
};
