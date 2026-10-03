import type { Metadata } from "next";
import { codeLength } from "@/lib/access";
import { CodeForm } from "./CodeForm";
import styles from "./unlock.module.css";

export const metadata: Metadata = { title: "Unlock · Mycalorie" };

/** Read the code length per request, so changing ACCESS_CODE never needs a rebuild. */
export const dynamic = "force-dynamic";

/** Only same-site paths are honoured as a return destination. */
function safeDestination(next: string | string[] | undefined): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  const { next } = await searchParams;
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="unlock-heading">
        <header className={styles.header}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={`mono ${styles.host}`}>mycalorie</span>
        </header>
        <div className={styles.body}>
          <h1 id="unlock-heading" className={styles.title}>
            Enter your access code
          </h1>
          <p className={styles.hint}>This device stays unlocked for six months.</p>
          <CodeForm length={codeLength()} destination={safeDestination(next)} />
        </div>
      </section>
    </main>
  );
}
