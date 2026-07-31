import { Home, GraduationCap, Dumbbell, Wallet, Menu } from "lucide-react";

/*
  Barra de navegación inferior, solo en móvil.

  En el teléfono la app se usa como PWA y la cabecera queda arriba del todo, a
  desgana para el pulgar. Esta barra deja a mano las cuatro secciones que más se
  abren, y el botón de la derecha despliega el menú completo con el resto.

  Cuatro y no seis: con el ancho de un iPhone, a partir de cinco los iconos se
  aprietan y las etiquetas empiezan a cortarse.
*/
const ATAJOS = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "universidad", label: "Uni", icon: GraduationCap },
  { id: "gimnasio", label: "Gym", icon: Dumbbell },
  { id: "finanzas", label: "Dinero", icon: Wallet },
];

export default function BarraInferior({ active, onNavigate, onAbrirMenu, menuAbierto }) {
  return (
    <nav
      aria-label="Navegación principal"
      /*
        El padding de abajo respeta la barra de gestos del iPhone; sin él, el
        último milímetro de los botones cae bajo la franja del sistema.
      */
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md lg:hidden"
    >
      <ul className="flex items-stretch">
        {ATAJOS.map(({ id, label, icon: Icono }) => {
          const activo = active === id && !menuAbierto;
          return (
            <li key={id} className="flex-1">
              <button
                onClick={() => onNavigate(id)}
                aria-current={activo ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  activo ? "text-seccion-400" : "text-slate-500"
                }`}
              >
                {/* La pastilla de fondo marca la sección activa sin depender
                    solo del color del icono, que en acero se distingue poco. */}
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                    activo ? "bg-seccion-500/20" : ""
                  }`}
                >
                  <Icono size={19} aria-hidden="true" />
                </span>
                {label}
              </button>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            onClick={onAbrirMenu}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            className={`flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
              menuAbierto ? "text-indigo-400" : "text-slate-500"
            }`}
          >
            <span
              className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                menuAbierto ? "bg-indigo-500/20" : ""
              }`}
            >
              <Menu size={19} aria-hidden="true" />
            </span>
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}
