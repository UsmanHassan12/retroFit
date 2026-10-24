/** Navy greeting banner with the green ring artwork from the dashboard design. */
export function WelcomeBanner({ name, highlight, suffix }: { name: string; highlight: string; suffix: string }) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <section className="relative isolate overflow-hidden rounded-t-[20px] bg-[radial-gradient(110%_140%_at_20%_100%,#1f3b48_0%,#0b1c30_60%)] px-6 pt-10 pb-32 sm:px-12 sm:pt-12 sm:pb-[150px]">
      <div aria-hidden className="absolute -top-16 -right-6 -z-10 hidden sm:block">
        <span className="absolute top-0 right-6 size-[200px] rounded-full border-[18px] border-brand" />
        <span className="absolute top-[78px] -right-14 size-[180px] rounded-full border-[18px] border-brand/80" />
        <span className="absolute top-[175px] right-[130px] size-[190px] rounded-full bg-brand/40 blur-[1px]" />
      </div>
      <h1 className="font-display text-3xl font-bold text-white sm:text-[35px]">
        {greeting} {name}!
      </h1>
      <p className="mt-3 text-base text-faint">
        You have <span className="text-brand-200">{highlight}</span> {suffix}
      </p>
    </section>
  );
}
