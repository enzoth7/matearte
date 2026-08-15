export function SectionHeading({
  eyebrow,
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
      <p className={`eyebrow text-[var(--leather)] ${align === "center" ? "justify-center" : ""}`}>{eyebrow}</p>
      <h2 className="display-lg mt-6">{title}</h2>
      {body && <p className="mt-6 max-w-2xl text-base leading-8 text-black/65 md:text-lg">{body}</p>}
    </div>
  );
}
