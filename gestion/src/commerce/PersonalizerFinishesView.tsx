import { useState } from "react";
import { appliqueRimFinishCatalog, rimFinishCatalog } from "../../../personalizador/src/catalog/rimFinishCatalog";
import { flejeFinishCatalog } from "../../../personalizador/src/catalog/flejeFinishCatalog";

type Finish = { id: string; name: string; image: string };

const groups: { id: string; title: string; description: string; finishes: Finish[]; shape: "round" | "band" }[] = [
  { id: "virola", title: "Virola con grabado láser", description: "Terminaciones para la virola con grabado láser.", finishes: rimFinishCatalog, shape: "round" },
  { id: "apliques", title: "Virola con apliques", description: "Terminaciones para apliques de bronce o alpaca.", finishes: appliqueRimFinishCatalog, shape: "round" },
  { id: "fleje", title: "Fleje", description: "Terminaciones para el frente y el dorso del fleje.", finishes: flejeFinishCatalog, shape: "band" },
];

function FinishCard({ finish, shape }: { finish: Finish; shape: "round" | "band" }) {
  const [failed, setFailed] = useState(false);
  return <article className="personalizer-finishes__card">
    <div className={`personalizer-finishes__image is-${shape}`}>
      {failed ? <span>Imagen no disponible</span> : <img src={finish.image} alt="" loading="lazy" onError={() => setFailed(true)} />}
    </div>
    <strong>{finish.name}</strong>
  </article>;
}

export function PersonalizerFinishesView() {
  const total = groups.reduce((count, group) => count + group.finishes.length, 0);
  return <section className="personalizer-finishes" aria-label="Terminaciones del Personalizador">
    <header className="personalizer-icons__header">
      <div><h2>Terminaciones del Personalizador</h2><p>Estas terminaciones se usan en el Personalizador y al registrar ventas minoristas personalizadas.</p></div>
      <span>{total} terminaciones</span>
    </header>
    {groups.map((group) => <section className="personalizer-finishes__group" key={group.id} aria-labelledby={`finish-group-${group.id}`}>
      <div className="personalizer-finishes__group-heading">
        <div><h3 id={`finish-group-${group.id}`}>{group.title}</h3><p>{group.description}</p></div>
        <span>{group.finishes.length}</span>
      </div>
      <div className="personalizer-finishes__grid">
        {group.finishes.map((finish) => <FinishCard key={finish.id} finish={finish} shape={group.shape} />)}
      </div>
    </section>)}
  </section>;
}
