# User Story: Login con credenciales inválidas

**Como** usuario registrado
**Quiero** recibir un mensaje de error claro cuando ingreso credenciales incorrectas
**Para** entender que debo corregir mi email o contraseña

## Criterios de aceptación

- Si el email no existe, se muestra el mensaje "No existe una cuenta con ese email".
- Si el email existe pero la contraseña es incorrecta, se muestra "Contraseña incorrecta".
- Después de 5 intentos fallidos, el botón de login se deshabilita por 60 segundos.
- El campo de contraseña nunca debe mostrar el texto en claro (siempre type="password").
