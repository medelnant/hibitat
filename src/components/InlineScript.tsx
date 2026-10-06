// Runs during HTML parsing on the server render. If React ever renders it in the browser
// (e.g. recovering from an error), the text/plain type keeps it inert and avoids React's
// script-tag warning; suppressHydrationWarning covers the type mismatch.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
