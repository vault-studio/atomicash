# ATOMIC ASH — CAMBIOS DE JUGABILIDAD

## Objetivo
Que sobrevivir exija leer a los enemigos y moverse con intención, y que cada build tenga un papel claro. Ninguna build debe ser buena contra todo, y ninguna estrategia de movimiento (correr en círculos, ir en línea recta o quedarse quieto) debe neutralizar a todos los enemigos.

## Alcance
- Solo el Acto 1, «Las Afueras», con los 3 personajes (Dot, Mae, El Errante).
- Enemigos solo humanoides o robots/máquinas.
- Se trabaja sobre el proyecto existente, en una rama de Git, reutilizando los sistemas que ya hay.
- No se toca el arte existente. Si un enemigo nuevo no tiene sprite, usa un placeholder simple que se distinga a simple vista de los demás.

## Orden de prioridades
1. Valores en datos y depurador básico (apartado 6): sin ellos no se puede ajustar ni probar nada de lo demás.
2. Interceptores y tiradores (apartados 2 y 3), que salen desde el principio de la partida.
3. Velocidad, enfurecimiento y habilidades de los enemigos (apartado 1).
4. Roles de enemigos y cercos (apartado 4).
5. Tiradores especiales (apartado 3).
6. Especialización de armas y builds, y blindaje (apartado 5).
7. Estadísticas completas y exportación (apartado 6).
8. Balance final con el depurador.

---

## 1. Velocidad de los enemigos
- **Enfurecimiento:** algunos enemigos, al enfurecerse, corren más que los personajes y pueden alcanzarlos de verdad.
  - Condición propuesta (configurable): al bajar de cierto porcentaje de vida, al morir un aliado cercano o tras X segundos persiguiendo al jugador.
  - Debe verse claramente: cambio de color o tamaño, o un indicador encima.
  - Dura un tiempo limitado y luego tiene enfriamiento, para que el jugador pueda reaccionar.
- **Habilidades de velocidad:** otros enemigos tienen una habilidad que les sube la velocidad un tiempo corto (carrera o embestida).
  - Algunas se lanzan hacia donde _va a estar_ el jugador (por delante de su dirección de movimiento), no hacia donde está.
  - Siempre telegrafiadas: una pausa breve o marca en el suelo antes de lanzarse.
- Todos los valores (velocidad base, velocidad enfurecido, duración, enfriamiento, condición) se editan desde el depurador.

## 2. Interceptores
- Disponibles desde el principio de la partida.
- Mucho más rápidos que el jugador, pero giran despacio. Se esquivan con un cambio de dirección brusco en el momento justo.
- Intentan cerrar una de las rutas de salida del jugador en vez de ir directos a él.
- Si alcanzan al jugador tras una carrera de más de 2 segundos, lo aturden 1 segundo.
  - Tras un aturdimiento, el jugador es inmune a otro durante unos segundos (valor configurable), para que no se encadenen.
  - Durante el aturdimiento el autoataque sigue activo.
- Máximo 2 interceptores en pantalla a la vez.
- Valores configurables: velocidad, velocidad de giro, duración mínima de carrera para aturdir, duración del aturdimiento, inmunidad posterior y límite en pantalla.

## 3. Tiradores
- **Tiradores normales:** disponibles desde el principio. Disparan o crean una zona de peligro que obliga a moverse.
- **Tiradores especiales:** en vez de una sola zona, lanzan varios disparos a la vez que caen en línea por delante del jugador, siguiendo la dirección en la que se mueve. Si no cambia de dirección, se los come todos.
  - Cada impacto se marca en el suelo antes de caer, con tiempo suficiente para reaccionar.
  - Aparecen más tarde que los normales (minuto configurable).
- Contrarrestan el correr en línea recta, igual que los interceptores contrarrestan el correr en círculos.
- Valores configurables: número de disparos, separación, tiempo de aviso, daño, cadencia, alcance y minuto de aparición.

## 4. Roles de enemigos y cercos
- **Perseguidores:** avanzan hacia el jugador y mantienen la presión. Castigan quedarse quieto.
- **Interceptores:** cierran una de las rutas de salida (apartado 2).
- **Pesados:** lentos, con mucha vida, ocupan espacio y cuesta atravesarlos. Bloquean huecos del cerco.
- **Normales:** rellenan los huecos para que el cerco no tenga puntos débiles demasiado evidentes.
- **Tiradores:** obligan a cambiar de posición (apartado 3).
- Los cercos combinan varios roles y siempre dejan al menos una salida posible, aunque cueste encontrarla. Nunca debe haber una situación sin salida.
- No hace falta colisión física entre todos los enemigos: las hordas deben seguir moviéndose con fluidez. Solo los pesados bloquean de verdad.

## 5. Armas y builds
- Tres especializaciones claras:
  - **Hordas:** daño de área o en cadena, poco daño por impacto.
  - **Jefes:** mucho daño concentrado en un solo objetivo.
  - **Élites y blindados:** daño que atraviesa armadura o la reduce, y control (empuje, ralentización, interrupción de habilidades).
- **Blindaje:** algunos enemigos (élites, pesados) restan una cantidad fija a cada impacto. Así las armas de muchos golpes pequeños rinden mal contra ellos y las de golpe fuerte rinden bien.
- Cada build debe tener una debilidad real. Por ejemplo, la de hordas sufre contra jefes y blindados, y la de jefes se ve desbordada por las hordas.
- Comprobar con las estadísticas del depurador que ninguna build es la mejor en todas las situaciones.

## 6. Depurador
Panel de desarrollo aparte del juego normal (superposición o pantalla propia, la que sea más sencilla de implementar) que solo existe en modo desarrollo.

### 6.1 Valores en datos
- Todos los valores de personajes, enemigos y armas pasan a un archivo de datos (por ejemplo, JSON). Nada de números sueltos en el código.
- **Personajes:** vida, velocidad, armadura, regeneración y armas iniciales.
- **Enemigos:** rol, vida, daño, velocidad base, velocidad enfurecido y condición, habilidad (tipo, duración, enfriamiento), velocidad de giro, blindaje, XP que dan, minuto desde el que pueden salir (y hasta cuál), peso de aparición y límite en pantalla.
- **Armas:** daño, cadencia, área, alcance, perforación, cadena, empuje, ralentización y daño contra blindaje, por nivel.
- **Oleadas y cercos:** composición, frecuencia y minuto de aparición.

### 6.2 Edición y exportación
- Editar cualquier valor desde el panel. Los cambios se aplican en la siguiente partida, o en la actual si resulta igual de sencillo.
- Exportar los valores actuales a un archivo para guardarlos como nuevos valores por defecto, e importar uno anterior.
- Botón para volver a los valores por defecto.

### 6.3 Herramientas de prueba
- Elegir personaje y build inicial.
- Generar enemigos concretos o un cerco concreto.
- Invocar jefes.
- Cambiar la velocidad del juego y pausar.
- Reiniciar la partida al instante.
- Modo invencible.
- Semilla fija, para repetir la misma partida.

### 6.4 Estadísticas
Se recogen en cada partida y se pueden exportar (JSON o CSV) para comparar builds y versiones.

- **Supervivencia:** duración de la partida, minuto y causa de la muerte (qué tipo de enemigo dio el último golpe), vida perdida por minuto.
- **Daño recibido por fuente:** cuánto daño hace cada tipo de enemigo. Indica qué enemigo está fuera de balance.
- **Daño infligido por arma:** daño total, DPS medio y porcentaje del total de cada arma.
- **Tiempo para matar** cada tipo de enemigo con la build actual.
- **Ritmo:** bajas por minuto, XP por minuto y minuto en el que se alcanza cada nivel.
- **Presión:** enemigos en pantalla por minuto y número de veces que el jugador queda rodeado.
- **Esquivas:** aturdimientos recibidos, cargas de interceptor esquivadas frente a recibidas, impactos de tiradores esquivados frente a recibidos.
- **Decisiones:** mejoras elegidas y en qué minuto.

## 7. Dificultad justa
- Todo ataque importante se telegrafía y da tiempo para reaccionar.
- Nada de daño inevitable, ataques invisibles ni situaciones sin salida.
- Ajustar primero los comportamientos y después los números.
- No subir de forma indiscriminada la vida o el daño de todos los enemigos.
- Cambiar pocos valores cada vez y comparar con las estadísticas de antes.

## 8. Qué NO implementar
- Resistencia o fatiga al correr.
- Apuntado manual obligatorio.
- Colisión física completa entre todos los enemigos.
- Subir estadísticas como única solución a la dificultad.
- Arte nuevo definitivo.
- Contenido de otros actos.
