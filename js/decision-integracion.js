(function () {
  "use strict";

  const escenarios = {
    vivienda: {
      pesos: { vivienda: 60, pobreza: 40 },
      campos: ["pct_hogares_con_carga_alquiler", "pct_pobreza"],
      accion: "Contrastar alquiler, pobreza y oferta de vivienda asequible con evidencia de campo."
    },
    seguridad: {
      pesos: { seguridad: 50, vial: 50 },
      campos: ["delitos_graves_por_1000", "heridos_transito_por_10000"],
      accion: "Verificar las denuncias, los incidentes viales y las condiciones locales."
    },
    ambiente: {
      pesos: { aire: 60, pobreza: 40 },
      campos: ["pm25", "pct_pobreza"],
      accion: "Contrastar la calidad del aire con mediciones locales y vulnerabilidad social."
    }
  };

  const crear = (tipo, texto) => {
    const nodo = document.createElement(tipo);
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  };

  function presentar(config, destino) {
    destino.replaceChildren();

    const grupos = DIAGNOSTICO.grupos();
    const primero = grupos && grupos[0];

    if (!primero || !primero.miembros || !primero.miembros.length) {
      destino.appendChild(crear("p", "No hay datos suficientes para establecer candidatos."));
      return;
    }

    const distritos = LG.distritos();
    const porId = new Map(distritos.map(d => [String(d.puma), d]));

    destino.appendChild(crear("h3", "Distritos candidatos para investigar"));

    const rango = DIAGNOSTICO.textoRango(primero);
    destino.appendChild(crear(
      "p",
      "Primer grupo de atencion. Puestos posibles: " + rango +
      ". Se presentan juntos porque sus intervalos se superponen."
    ));

    const lista = crear("ul");

    primero.miembros
      .map(id => porId.get(String(id)))
      .filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach(d => {
        const elemento = crear("li");
        const intervalo = DIAGNOSTICO.intervalo(d.puma);

        const boton = crear(
          "button",
          d.nombre + " (" + d.borough + ") - " +
          DIAGNOSTICO.textoRango(intervalo) + " - Ver en mapa"
        );

        boton.type = "button";
        boton.className = "enlace";

        boton.addEventListener("click", () => {
          DIAGNOSTICO.elegir(d.puma);
          if (window.MAPA && MAPA.seleccionar) {
            MAPA.seleccionar(d.puma, true);
          }
          document.getElementById("gemelo")
            .scrollIntoView({ behavior: "smooth" });
        });

        elemento.appendChild(boton);
        lista.appendChild(elemento);
      });

    destino.appendChild(lista);

    const fuentes = config.campos.map(campo => {
      const metrica = LG.metrica(campo);
      if (!metrica) return campo;

      const ids = LG.ids(metrica.fuente).join(", ");
      return (metrica.etiqueta || campo) +
        " [" + ids + "] " + (metrica.vigencia || "");
    });

    destino.appendChild(crear(
      "p", "Indicadores y fuentes: " + fuentes.join("; ")
    ));

    destino.appendChild(crear(
      "p", "Siguiente paso verificable: " + config.accion
    ));

    destino.appendChild(crear(
      "p",
      "Los candidatos no constituyen una decision definitiva. " +
      "El indice depende de los pesos y los margenes de error disponibles. " +
      "No demuestra causalidad."
    ));

    const panorama = crear("button", "Revisar diagnostico");
    panorama.type = "button";
    panorama.className = "chip";
    panorama.addEventListener("click", () => {
      document.getElementById("panorama")
        .scrollIntoView({ behavior: "smooth" });
    });
    destino.appendChild(panorama);
  }

  function iniciar() {
    const tarjeta = document.getElementById("guiaDecision");
    const selector = document.getElementById("preguntaDecision");

    if (!tarjeta || !selector || !window.DIAGNOSTICO ||
        !window.LG || !document.getElementById("dgA")) {
      return false;
    }

    if (document.getElementById("decisionIntegracion")) {
      return true;
    }

    const seccion = crear("section");
    seccion.id = "decisionIntegracion";
    seccion.style.marginTop = "18px";
    seccion.style.paddingTop = "14px";
    seccion.style.borderTop = "1px solid var(--border, #7775)";

    tarjeta.appendChild(seccion);

    function actualizar() {
      seccion.replaceChildren();

      const config = escenarios[selector.value];
      if (!config) return;

      const boton = crear("button", "Aplicar escenario al diagnostico y mapa");
      boton.type = "button";
      boton.className = "chip";

      const resultado = crear("div");
      resultado.id = "decisionCandidatos";
      resultado.setAttribute("aria-live", "polite");

      resultado.appendChild(crear(
        "p", "Aplica el escenario para consultar los distritos candidatos."
      ));

      boton.addEventListener("click", () => {
        DIAGNOSTICO.personalizar(config.pesos);
        if (window.MAPA && MAPA.indice) MAPA.indice();
        presentar(config, resultado);
      });

      seccion.appendChild(boton);
      seccion.appendChild(resultado);
    }

    selector.addEventListener("change", actualizar);
    actualizar();
    return true;
  }

  let intentos = 0;
  const espera = setInterval(() => {
    if (iniciar() || ++intentos >= 80) clearInterval(espera);
  }, 250);
})();
