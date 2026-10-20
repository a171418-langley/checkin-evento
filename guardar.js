/*************************************************
 * guardar.js — guarda el diseño de diseno.html en un evento.
 *
 * Al cargar, agrega arriba de la página el paso "1. Elige el
 * evento" (contraseña + lista de eventos en curso o próximos que
 * aún no tienen diseño). El botón del paso 4 guarda el diseño en el
 * evento elegido.
 *
 * Se carga DESPUÉS del script principal de diseno.html, con
 *   <script src="guardar.js"></script>
 * y usa sus variables: imagen, qr, nombreConfig, DISENO_ANCHO y
 * DISENO_ALTO.
 *************************************************/
(function () {

  "use strict";

  const URL_APPS_SCRIPT =
    "https://script.google.com/macros/s/AKfycbzq5DsVjAo3iuENvsCpI7KpaBi7W1PoXEvk6PePB0m367auHQzxCiLaVoUUhlBNPu6L/exec";

  // Tope del PNG original.
  const MAX_BYTES = 5 * 1024 * 1024;

  const MENSAJE_NO_AUTORIZADO = "Acceso no autorizado.";

  const MESES = ["ene", "feb", "mar", "abr", "may", "jun",
                 "jul", "ago", "sep", "oct", "nov", "dic"];

  const $ = id => document.getElementById(id);


  // ================================================
  // MENSAJES
  // ================================================
  function avisar(id, texto, tipo) {

    const caja = $(id);

    caja.textContent = texto || "";
    caja.style.color =
      tipo === "error" ? "#b4413c" :
      tipo === "ok" ? "#2f8f5b" :
      "#5b6876";
    caja.style.fontWeight = tipo === "ok" ? "700" : "400";
  }


  // ================================================
  // PASO 1: ELEGIR EL EVENTO
  // ================================================
  function crearPasoEvento() {

    // Por si la página trae todavía la contraseña en el paso 4.
    const etiquetaVieja = document.querySelector('label[for="claveAdmin"]');
    if (etiquetaVieja) etiquetaVieja.remove();

    const campoViejo = $("claveAdmin");
    if (campoViejo) campoViejo.remove();

    const tarjeta = document.createElement("div");

    tarjeta.className = "tarjeta";

    tarjeta.innerHTML =
      '<h2><span class="num">1</span> Elige el evento</h2>' +
      '<label for="claveAdmin" style="margin-top:0">Contraseña de administrador</label>' +
      '<input type="password" id="claveAdmin" autocomplete="current-password">' +
      '<button id="btnCargarEventos" type="button" class="btn btn-secundario">Ver eventos</button>' +
      '<label for="selectorEvento">Evento</label>' +
      '<select id="selectorEvento" disabled>' +
        '<option value="">Primero escribe la contraseña y toca "Ver eventos"</option>' +
      "</select>" +
      '<span class="nota">Solo aparecen los eventos que todavía no tienen diseño.</span>' +
      '<div id="msgEventos" role="status"></div>';

    const pasoImagen = $("pasoImagen");

    pasoImagen.parentNode.insertBefore(tarjeta, pasoImagen);
  }


  // ================================================
  // COMUNICACIÓN
  // ================================================
  async function llamarServidor(cuerpo, esperaMs) {

    const controlador = new AbortController();

    const temporizador = setTimeout(function () {
      controlador.abort();
    }, esperaMs);

    try {

      // Sin cabeceras especiales: así el navegador no hace la consulta
      // previa (preflight) que Apps Script no admite.
      const respuesta = await fetch(URL_APPS_SCRIPT, {
        method: "POST",
        body: JSON.stringify(cuerpo),
        signal: controlador.signal
      });

      return await respuesta.json();

    } catch (error) {

      return {
        ok: false,
        mensaje: error.name === "AbortError"
          ? "El servidor tardó demasiado en responder."
          : "No se pudo comunicar con el servidor. Revisa tu conexión."
      };

    } finally {

      clearTimeout(temporizador);
    }
  }


  function leerComoBase64(archivo) {

    return new Promise(function (resolve, reject) {

      const lector = new FileReader();

      lector.onload = function () {
        resolve(String(lector.result).split(",")[1]);
      };

      lector.onerror = function () {
        reject(new Error("No se pudo leer la imagen."));
      };

      lector.readAsDataURL(archivo);
    });
  }


  /** "28/10/2026" + "10:30" → "28 oct, 10:30" */
  function fechaCorta(fecha, hora) {

    const p = String(fecha || "").split("/").map(Number);

    if (p.length !== 3) return fecha + " " + hora;

    return p[0] + " " + MESES[p[1] - 1] + ", " + hora;
  }


  // ================================================
  // LISTA DE EVENTOS
  // ================================================
  async function cargarEventos() {

    const boton = $("btnCargarEventos");
    const selector = $("selectorEvento");

    const clave = $("claveAdmin").value.trim();

    if (!clave) {
      avisar("msgEventos", "Escribe la contraseña de administrador.", "error");
      $("claveAdmin").focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = "Buscando eventos…";
    avisar("msgEventos", "");

    const datos = await llamarServidor({ accion: "listarEventos", clave: clave }, 30000);

    boton.disabled = false;
    boton.textContent = "Ver eventos";

    if (!datos || datos.ok !== true) {

      selector.disabled = true;

      avisar(
        "msgEventos",
        datos && datos.mensaje === MENSAJE_NO_AUTORIZADO
          ? "Contraseña incorrecta."
          : (datos && datos.mensaje) || "No se pudieron consultar los eventos.",
        "error"
      );

      return;
    }

    const disponibles = (datos.eventos || []).filter(function (evento) {
      return !evento.tieneDiseno;
    });

    selector.replaceChildren();

    if (disponibles.length === 0) {

      selector.appendChild(new Option("No hay eventos sin diseño", ""));
      selector.disabled = true;

      avisar("msgEventos", "Todos los eventos en curso o próximos ya tienen su diseño.");

      return;
    }

    selector.appendChild(new Option("Elige el evento…", ""));

    disponibles.forEach(function (evento) {

      selector.appendChild(
        new Option(
          evento.nombre + " (" + fechaCorta(evento.fechaInicio, evento.horaInicio) + ")",
          evento.id
        )
      );
    });

    // Si solo hay uno, se elige solo.
    if (disponibles.length === 1) {
      selector.value = disponibles[0].id;
    }

    selector.disabled = false;
    selector.focus();

    avisar(
      "msgEventos",
      disponibles.length === 1
        ? "Hay 1 evento esperando su diseño."
        : "Hay " + disponibles.length + " eventos esperando su diseño.",
      "ok"
    );
  }


  // ================================================
  // GUARDAR
  // ================================================
  async function guardar() {

    const btn = $("btnGuardar");

    const archivo = $("archivo").files[0];
    const clave = $("claveAdmin").value.trim();
    const selector = $("selectorEvento");
    const idEvento = selector.value;

    if (!clave || !idEvento) {
      avisar("msgGuardar", "Primero elige el evento en el paso 1.", "error");
      return;
    }

    if (!archivo || !imagen) {
      avisar("msgGuardar", "Primero sube la imagen en el paso 2.", "error");
      return;
    }

    if (archivo.size > MAX_BYTES) {
      avisar("msgGuardar", "La imagen pesa más de 5 MB. Pídele al diseñador una versión más ligera.", "error");
      return;
    }

    const esperada = DISENO_ANCHO / DISENO_ALTO;
    const real = imagen.naturalWidth / imagen.naturalHeight;

    if (Math.abs(real - esperada) / esperada > 0.02) {
      avisar(
        "msgGuardar",
        "La imagen debe medir " + DISENO_ANCHO + " × " + DISENO_ALTO + " px.",
        "error"
      );
      return;
    }

    const nombreEvento = selector.options[selector.selectedIndex].text;

    if (!confirm("¿Guardar este diseño en " + nombreEvento + "?\n\nDespués ya no se puede cambiar desde aquí.")) {
      return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando…";
    avisar("msgGuardar", "");

    try {

      const pngBase64 = await leerComoBase64(archivo);

      const datos = await llamarServidor(
        {
          accion: "guardarPlantilla",
          clave: clave,
          idEvento: idEvento,
          pngBase64: pngBase64,
          config: {
            anchoPx: imagen.naturalWidth,
            altoPx: imagen.naturalHeight,
            qr: { x: qr.x, y: qr.y, tam: qr.tam },
            nombre: {
              x: nombreConfig.x,
              y: nombreConfig.y,
              ancho: nombreConfig.ancho,
              alto: nombreConfig.alto,
              fuenteTam: nombreConfig.fuenteTam,
              fuente: nombreConfig.fuente,
              color: nombreConfig.color,
              alineacion: nombreConfig.alineacion
            }
          }
        },
        90000
      );

      if (datos.ok) {

        avisar("msgGuardar", "✓ " + datos.mensaje + " Ya puedes cerrar esta página.", "ok");

        // El evento ya tiene diseño: sale de la lista.
        await cargarEventos();

      } else {

        avisar("msgGuardar", datos.mensaje, "error");
      }

    } catch (error) {

      avisar("msgGuardar", error.message, "error");

    } finally {

      btn.disabled = false;
      btn.textContent = "Guardar diseño";
    }
  }


  // ================================================
  // INICIO
  // ================================================
  crearPasoEvento();

  $("btnCargarEventos").addEventListener("click", cargarEventos);

  $("claveAdmin").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") cargarEventos();
  });

  $("btnGuardar").addEventListener("click", guardar);

})();
