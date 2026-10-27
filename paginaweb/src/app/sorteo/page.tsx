import type { Metadata } from "next";
import Image from "next/image";
import { RuralRaffleForm } from "@/components/RuralRaffleForm";
import { ruralCityOptions, ruralCountryOptions } from "@/lib/rural-locations";
import styles from "./RuralPage.module.css";

export const metadata: Metadata = {
  title: { absolute: "MateArte Uruguay | Sorteo" },
  description: "Registrate sin contraseña y participá del sorteo de MateArte en La Rural.",
  robots: { index: false, follow: false },
};

export default function RuralPage() {
  return (
    <main id="contenido" className={`${styles.page} rural-campaign-page`}>
      <div className={styles.grain} aria-hidden="true" />
      <section className={styles.shell}>
        <div className={styles.visual}>
          <Image
            src="/assets/matearte/home-v2/mate-imperial.webp"
            alt="Mate artesanal de MateArte"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
          />
          <div className={styles.visualCopy}>
            <span>Tradición que se comparte</span>
          </div>
        </div>

        <div className={styles.content}>
          <h1><em>Ya estás cerca.</em></h1>
          <p className={styles.lead}>Dejanos tus datos y contanos qué productos te interesan. Completás el formulario en menos de un minuto.</p>
          <RuralRaffleForm countries={ruralCountryOptions} initialCities={ruralCityOptions("UY", "", 500).cities} />
        </div>
      </section>
    </main>
  );
}
