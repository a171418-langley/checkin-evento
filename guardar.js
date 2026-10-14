/*************************************************
 * guardar.js — guarda el diseño de diseno.html en el evento
 * actual (PNG + posiciones del QR y del nombre).
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

  const $ = id => document.getElementById(id);


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


  async function guardar() {

    const msg = $("msgGuardar");
    const btn = $("btnGuardar");

    const archivo = $("archivo").files[0];
    const clave = $("claveAdmin").value.trim();

    if (!archivo || !imagen) {
      msg.textContent = "Primero sube la imagen PNG.";
      return;
    }

    if (!clave) {
      msg.textContent = "Escribe la contraseña de administrador.";
      return;
    }

    if (archivo.size > MAX_BYTES) {
      msg.textContent = "El PNG pesa más de 5 MB. Comprímelo e inténtalo de nuevo.";
      return;
    }

    btn.disabled = true;
    msg.textContent = "Guardando...";

    try {

      const pngBase64 = await leerComoBase64(archivo);

      // Sin cabeceras especiales: así el navegador no hace
      // la consulta previa (preflight) que Apps Script no admite.
      const respuesta = await fetch(URL_APPS_SCRIPT, {
        method: "POST",
        body: JSON.stringify({
          accion: "guardarPlantilla",
          clave: clave,
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
        })
      });

      const datos = await respuesta.json();

      msg.textContent = (datos.ok ? "✅ " : "❌ ") + datos.mensaje;

    } catch (error) {

      msg.textContent =
        "❌ No se pudo confirmar el guardado: " + error.message +
        ". Revisa en Drive si apareció el archivo.";

    } finally {

      btn.disabled = false;
    }
  }


  $("btnGuardar").addEventListener("click", guardar);

})();
