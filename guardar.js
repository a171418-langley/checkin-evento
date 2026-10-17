/*************************************************
 * guardar.js — guarda el diseño de diseno.html en un evento.
 *
 * Al cargar, agrega arriba de la página la tarjeta "1. Evento"
 * (contraseña + lista de eventos activos o programados que aún no
 * tienen diseño) y deja la tarjeta de abajo solo con el botón
 * "Guardar en el evento seleccionado".
 *
 * Se carga DESPUÉS del script principal de diseno.html, con
 *   <script src="guardar.js"></script>
 * y usa sus variables: imagen, qr y nombreConfig.
 *************************************************/
(function () {

  "use strict";

  const URL_APPS_SCRIPT =
    "https://script.google.com/macros/s/AKfycbzq5DsVjAo3iuENvsCpI7KpaBi7W1PoXEvk6PePB0m367auHQzxCiLaVoUUhlBNPu6L/exec";

  // Tope del PNG original.
  const MAX_BYTES = 5 * 1024 * 1024;

  const MENSAJE_NO_AUTORIZADO = "Acceso no autorizado.";

  const ESTILO_BOTON =
    "width:100%;margin-top:14px;padding:14px;border:none;" +
    "border-radius:8px;background:#222;color:#fff;font-size:16px;" +
    "font-weight:bold;cursor:pointer";

  const ESTILO_CAMPO =
    "width:100%;padding:10px;border:1px solid #ccc;" +
    "border-radius:8px;font-size:16px";

  const $ = id => document.getElementById(id);


  // ================================================
  // TARJETA "1. EVENTO" (arriba de la página)
  // ================================================
  function crearTarjetaEvento() {

    // La contraseña ahora se pide arriba: se quita la de abajo.
    const etiquetaVieja = document.querySelector('label[for="claveAdmin"]');

    if (etiquetaVieja) etiquetaVieja.remove();

    const campoViejo = $("claveAdmin");

    if (campoViejo) campoViejo.remove();

    const tarjeta = document.createElement("div");

    tarjeta.className = "tarjeta";

    tarjeta.innerHTML =
      "<h2>1. Evento</h2>" +
      '<label for="claveAdmin">Contraseña de administrador</label>' +
      '<input type="password" id="claveAdmin" autocomplete="off" ' +
        'style="' + ESTILO_CAMPO + '">' +
      '<button id="btnCargarEventos" type="button" ' +
        'style="' + ESTILO_BOTON + '">Cargar eventos</button>' +
      '<label for="selectorEvento">Evento del diseño</label>' +
      '<select id="selectorEvento" disabled>' +
        '<option value="">Primero carga los eventos</option>' +
      "</select>" +
      '<small class="nota">Solo aparecen eventos activos o programados ' +
        "que todavía no tienen diseño.</small>" +
      '<div id="msgEventos" role="status" style="margin-top:12px"></div>';

    const contenedor = document.querySelector(".contenedor");
    const titulo = contenedor.querySelector("h1");

    contenedor.insertBefore(
      tarjeta,
      titulo ? titulo.nextSibling : contenedor.firstChild
    );

    $("btnGuardar").textContent = "Guardar en el evento seleccionado";
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
          : "No se pudo comunicar con el servidor."
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


  // ================================================
  // LISTA DE EVENTOS
  // ================================================
  async function cargarEventos() {

    const msg = $("msgEventos");
    const boton = $("btnCargarEventos");
    const selector = $("selectorEvento");

    const clave = $("claveAdmin").value.trim();

    if (!clave) {
      msg.textContent = "Escribe la contraseña de administrador.";
      return;
    }

    boton.disabled = true;
    msg.textContent = "Consultando eventos...";

    const datos = await llamarServidor(
      { accion: "listarEventos", clave: clave },
      30000
    );

    boton.disabled = false;

    if (!datos || datos.ok !== true) {

      selector.disabled = true;

      msg.textContent =
        datos && datos.mensaje === MENSAJE_NO_AUTORIZADO
          ? "❌ Contraseña incorrecta."
          : "❌ " + ((datos && datos.mensaje) || "No se pudo consultar.");

      return;
    }

    const disponibles = (datos.eventos || []).filter(function (evento) {
      return !evento.tieneDiseno;
    });

    selector.replaceChildren();

    if (disponibles.length === 0) {

      selector.appendChild(new Option("No hay eventos sin diseño", ""));
      selector.disabled = true;

      msg.textContent =
        "No hay eventos activos o programados sin diseño.";

      return;
    }

    selector.appendChild(new Option("Selecciona un evento…", ""));

    disponibles.forEach(function (evento) {

      selector.appendChild(
        new Option(
          evento.id + " — " + evento.nombre + " (" + evento.estado +
          ", " + evento.fechaInicio + " " + evento.horaInicio + ")",
          evento.id
        )
      );
    });

    selector.disabled = false;

    msg.textContent = "✅ " + disponibles.length +
      (disponibles.length === 1 ? " evento disponible." : " eventos disponibles.");
  }


  // ================================================
  // GUARDAR
  // ================================================
  async function guardar() {

    const msg = $("msgGuardar");
    const btn = $("btnGuardar");

    const archivo = $("archivo").files[0];
    const clave = $("claveAdmin").value.trim();
    const idEvento = $("selectorEvento").value;

    if (!clave) {
      msg.textContent = "Escribe la contraseña arriba y carga los eventos.";
      return;
    }

    if (!idEvento) {
      msg.textContent = "Primero selecciona el evento (arriba, en 1. Evento).";
      return;
    }

    if (!archivo || !imagen) {
      msg.textContent = "Primero sube la imagen PNG.";
      return;
    }

    if (archivo.size > MAX_BYTES) {
      msg.textContent =
        "El PNG pesa más de 5 MB. Comprímelo e inténtalo de nuevo.";
      return;
    }

    btn.disabled = true;
    msg.textContent = "Guardando...";

    let texto = "";

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

      texto = (datos.ok ? "✅ " : "❌ ") + datos.mensaje;

      // El evento ya tiene diseño: sale de la lista.
      if (datos.ok) {
        await cargarEventos();
      }

    } catch (error) {

      texto = "❌ " + error.message;

    } finally {

      btn.disabled = false;
      msg.textContent = texto;
    }
  }


  // ================================================
  // INICIO
  // ================================================
  crearTarjetaEvento();

  $("btnCargarEventos").addEventListener("click", cargarEventos);

  $("claveAdmin").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") {
      cargarEventos();
    }
  });

  $("btnGuardar").addEventListener("click", guardar);

})();
