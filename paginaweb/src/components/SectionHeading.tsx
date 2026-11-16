export function SectionHeading({
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <h2 className="display-lg">{title}</h2>
      {body && <div data-copy className="mt-6 max-w-2xl text-base leading-8 text-[var(--ink)]/65 md:text-lg">{body}</div>}
    </div>
  );
}
