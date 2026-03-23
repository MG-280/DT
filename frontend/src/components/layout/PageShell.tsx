const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-transparent text-app-text">
    <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-5 px-5 py-6 lg:px-7">
      {children}
    </div>
  </div>
);

export default PageShell;