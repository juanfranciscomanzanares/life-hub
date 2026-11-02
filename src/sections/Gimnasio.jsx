import { useState } from "react";
import { Dumbbell, CalendarDays, ListChecks, TrendingUp, BookOpen, Flag } from "lucide-react";
import { usePersisted } from "../lib/store";
import { SectionTitle, todayISO } from "../lib/ui";
import { nuevoId, nuevaSerie, setsDe, abrirSesion } from "../lib/gym";
import Sesion from "./gym/Sesion.jsx";
import Rutinas from "./gym/Rutinas.jsx";
import Progreso from "./gym/Progreso.jsx";
import Ejercicios from "./gym/Ejercicios.jsx";
import Plan from "./gym/Plan.jsx";
import { semanaDelPlan, dentroDelPlan, objetivoDe, notaObjetivo } from "../lib/planFisico";

/*
  Gimnasio en tres pestañas:

  - Sesión: lo que has hecho un día concreto, ejercicio a ejercicio y serie a
    serie, cada una con su peso y sus repeticiones.
  - Rutinas: tus propias rutinas. Al empezar una, vuelca sus ejercicios en el
    día actual con las series objetivo listas para rellenar.
  - Progreso: gráficas por ejercicio, récords personales e historial por día.
  - Plan: el plan físico de tenis de mesa de 12 semanas (src/lib/planFisico.js),
    con lo que toca hoy, las guías y los tests.

  Los datos siguen en la clave `lh_gym`, una fila por ejercicio y día, porque
  otras seis secciones (Analítica, Calendario, Coach, Logros, Metas, Resumen)
  la leen para contar entrenamientos. El detalle por serie vive en el campo
  `sets`, añadido sin romper las filas antiguas (ver src/lib/gym.js).
*/
const PESTANAS = [
  { id: "sesion", nombre: "Sesión", icono: CalendarDays },
  { id: "plan", nombre: "Plan", icono: Flag },
  { id: "rutinas", nombre: "Rutinas", icono: ListChecks },
  { id: "ejercicios", nombre: "Ejercicios", icono: BookOpen },
  { id: "progreso", nombre: "Progreso", icono: TrendingUp },
];

export default function Gimnasio() {
  const [filas, setFilas] = usePersisted("lh_gym", []);
  const [sesiones, setSesiones] = usePersisted("lh_gym_sesiones", []);
  const [planFisico] = usePersisted("lh_plan_fisico", {});
  const [pestana, setPestana] = useState("sesion");
  const [fecha, setFecha] = useState(todayISO());

  /*
    Empezar una rutina crea las filas del día con las series objetivo a peso 0,
    salvo que ya hayas hecho ese ejercicio antes: en ese caso se reutilizan los
    pesos de la última vez, que es lo que normalmente quieres igualar o superar.
    Los ejercicios ya registrados hoy no se duplican.
  */
  const empezarRutina = (rutina) => {
    /*
      Las rutinas del plan físico cambian según la semana (descarga, una serie
      menos de pierna en potencia, la sentadilla a 4 series...). Fuera de las
      12 semanas, o si el plan no está activo, se usan las series base.
    */
    const semanaPlan =
      rutina.plan && planFisico?.inicio ? semanaDelPlan(planFisico.inicio, fecha) : null;
    const semana = dentroDelPlan(semanaPlan) ? semanaPlan : null;

    const yaHoy = new Set(filas.filter((f) => f.fecha === fecha).map((f) => f.ejercicio));

    const nuevas = rutina.ejercicios
      .filter((ej) => !yaHoy.has(ej.nombre))
      .map((ej) => {
        const anterior = filas
          .filter((f) => f.ejercicio === ej.nombre && f.fecha < fecha)
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
        // setsDe y no anterior.sets: las filas antiguas no tienen ese campo y
        // se perderían los pesos del histórico previo al cambio de formato.
        const pesoPrevio = anterior
          ? Math.max(0, ...setsDe(anterior).map((s) => Number(s.peso) || 0))
          : 0;

        const { series, reps } = rutina.plan ? objetivoDe(ej, semana) : ej;

        return {
          id: nuevoId(),
          fecha,
          ejercicio: ej.nombre,
          // En las del plan, el objetivo de la semana queda escrito en la nota
          // ("Objetivo: 4×6-8 · RIR 3 → 2 · descanso 2 min"): las reps de un
          // rango no caben en un solo número.
          nota: rutina.plan ? notaObjetivo(ej, semana) : "",
          rutina: rutina.nombre,
          sets: Array.from({ length: Math.max(1, series) }, () => nuevaSerie(pesoPrevio, reps)),
        };
      });

    if (nuevas.length) {
      setFilas([...nuevas, ...filas]);
      // Empezar una rutina es empezar la sesión: a partir de aquí cuenta el
      // tiempo y aparece el botón de terminarla.
      setSesiones(abrirSesion(sesiones, fecha));
    }
    setPestana("sesion");
  };

  const verDia = (f) => {
    setFecha(f);
    setPestana("sesion");
  };

  return (
    <div>
      <SectionTitle
        icon={Dumbbell}
        title="Gimnasio"
        subtitle="Tus rutinas, serie a serie, con su progreso"
      />

      <div className="lh-pestanas mb-5 gap-1.5 pb-1" role="tablist">
        {PESTANAS.map(({ id, nombre, icono: Icono }) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              pestana === id
                ? "bg-indigo-500 text-white"
                : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
            }`}
          >
            <Icono size={16} /> {nombre}
          </button>
        ))}
      </div>

      {pestana === "sesion" && (
        <Sesion
          fecha={fecha}
          setFecha={setFecha}
          filas={filas}
          setFilas={setFilas}
          sesiones={sesiones}
          setSesiones={setSesiones}
        />
      )}
      {pestana === "plan" && <Plan filas={filas} onEmpezar={empezarRutina} />}
      {pestana === "rutinas" && <Rutinas onEmpezar={empezarRutina} />}
      {pestana === "ejercicios" && <Ejercicios />}
      {pestana === "progreso" && <Progreso filas={filas} onVerDia={verDia} />}
    </div>
  );
}
