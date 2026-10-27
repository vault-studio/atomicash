# 03 — Contenido inicial

Todos los valores son de partida y viven en `src/config/`. Unidades: daño por impacto, enfriamiento en segundos, velocidad en px/s, rango en px.

## 1. Supervivientes (8)

| id | Nombre | Rareza | PV | Vel. | Arma inicial | Pasiva |
|---|---|---|---|---|---|---|
| `mechanic` | Dot "Llave Inglesa" Harlow | Común | 100 | 200 | Llave giratoria | +15 % daño de armas cuerpo a cuerpo |
| `courier` | Benny Ruiz, mensajero | Común | 90 | 230 | Pistola de clavos | +10 % velocidad, +20 % imán |
| `nurse` | Enfermera Mae Calloway | Común | 110 | 190 | Jeringas | Regenera 0,5 PV/s |
| `ranger` | Silas Crow, rastreador | Raro | 100 | 210 | Rifle de cerrojo | +20 % daño a jefes |
| `chef` | Gus Pappas, cocinero del diner | Raro | 130 | 180 | Sartén boomerang | Los consumibles duran +50 % |
| `scientist` | Dra. Ilse Varga | Épico | 85 | 200 | Rayo de partículas | Los RADS dan el doble de bonus de daño |
| `robot` | Unidad K-9 "Kip" (robot mayordomo) | Épico | 150 | 170 | Tesla de pecho | Inmune al daño por RADS ≥90 |
| `mayor` | Alcaldesa Rosalind Vance | Legendario | 120 | 200 | Megáfono sónico | +1 hueco de arma (5 en total) |

Tres iniciales elegibles en el perfil psicológico: `mechanic`, `courier`, `nurse`.

## 2. Armas (12)

| id | Nombre | Tipo | Daño | Enfr. | Comportamiento | Por nivel (2→5) |
|---|---|---|---|---|---|---|
| `wrench` | Llave giratoria | Cuerpo | 12 | — | 1 llave orbita alrededor | +1 llave, +15 % daño |
| `nailgun` | Pistola de clavos | Proyectil | 8 | 0,4 | Dispara al más cercano | +1 clavo, −10 % enfr. |
| `syringe` | Jeringas | Proyectil | 10 | 1,0 | Abanico de 3; cura 1 PV por enemigo muerto | +1 jeringa, +curación |
| `boltrifle` | Rifle de cerrojo | Proyectil | 40 | 1,6 | Atraviesa 3 enemigos | +1 perforación, +20 % daño |
| `pan` | Sartén boomerang | Proyectil | 18 | 1,2 | Va y vuelve | +1 sartén, +tamaño |
| `particle` | Rayo de partículas | Rayo | 6/tick | — | Rayo continuo hacia el más cercano (manual opcional) | +ancho, +daño |
| `tesla` | Tesla de pecho | Cadena | 15 | 1,4 | Rayo que salta a 4 enemigos | +2 saltos |
| `megaphone` | Megáfono sónico | Cono | 14 | 1,0 | Cono que empuja | +ángulo, +empuje |
| `molotov` | Cóctel de gasolina | Área | 5/tick | 2,5 | Charco de fuego 3 s | +1 cóctel, +duración |
| `drone` | Dron tostadora | Invocación | 9 | 0,8 | Dron que orbita y dispara | +1 dron |
| `geiger` | Contador Geiger | Aura | 4/tick | — | Aura que daña; más grande con más RADS | +radio |
| `flak` | Escopeta de chatarra | Cono | 7×6 | 1,3 | 6 perdigones en cono | +2 perdigones |

## 3. Fusiones (Apaño) — 4 en el MVP

| Arma A (nv.5) | Arma B (nv.5) | Resultado | Efecto |
|---|---|---|---|
| `wrench` | `tesla` | **Dinamo giratoria** | 3 llaves electrificadas que encadenan rayos al golpear |
| `molotov` | `drone` | **Dron incendiario** | Drones que dejan rastro de fuego |
| `nailgun` | `flak` | **Remachadora pesada** | Ráfagas de clavos que perforan y rebotan |
| `geiger` | `particle` | **Núcleo inestable** | Aura que lanza rayos aleatorios; escala con RADS |

## 4. Enemigos (10)

| id | Nombre | PV | Daño | Vel. | Notas |
|---|---|---|---|---|---|
| `rat` | Rata de alcantarilla gigante | 8 | 4 | 120 | Enjambres |
| `fly` | Mosca de cloaca | 5 | 3 | 160 | Vuela en zigzag |
| `ghoul` | Necrófago de chatarra | 25 | 8 | 80 | Básico lento |
| `raider` | Saqueador con tubería | 40 | 10 | 100 | — |
| `gunner` | Saqueador tirador | 30 | 8 | 70 | Dispara a distancia, mantiene 250 px |
| `bot` | Robot cortacésped | 60 | 12 | 90 | Carga en línea recta cada 4 s |
| `crawler` | Reptador irradiado | 35 | 9 | 110 | Golpe +5 RADS |
| `bloater` | Hinchado | 50 | 0 | 60 | Explota al morir (área, +8 RADS) |
| `scorpion` | Escorpión de arena | 90 | 15 | 95 | Tanque |
| `turret` | Torreta de propaganda | 120 | 10 | 0 | Estática; dispara en ráfaga y emite eslóganes absurdos |

Variante **irradiada** de cualquier enemigo: brillo verde, ×1,5 PV, golpe +3 RADS, suelta chatarra ×2.

## 5. Jefes (3 en el MVP)

| id | Nombre | Minuto | PV | Patrón |
|---|---|---|---|---|
| `bigmama` | Mamá Rata | 5 (minijefe) | 1 500 | Invoca ratas, carga |
| `paradebot` | Robot del Desfile | 10 (minijefe) | 4 000 | Lanza confeti explosivo en anillos, láser giratorio |
| `colossus` | El Coloso de Hormigón (estatua animada del alcalde fundador) | 14 (jefe final) | 15 000 | 3 fases: pisotones en área, lluvia de escombros, invoca torretas |

## 6. Zonas

MVP: 1 zona. Resto definidas para el futuro.

1. **Afueras de Sunnydale** (MVP): urbanización de casas iguales en ruinas, coches con aletas, piscinas vacías.
2. Autopista 66 Rota.
3. Parque de atracciones "Atomiland".
4. Base de misiles del desierto.
5. Ciudad sumergida.
6. Centro comercial en ruinas.
7. Granja experimental.
8. Observatorio.
9. El Cráter (zona final).

## 7. Objetos equipables (6)

| id | Nombre | Efecto |
|---|---|---|
| `lucky_dice` | Dados de peluche | +15 suerte |
| `lead_apron` | Delantal de plomo | RADS suben −40 % |
| `roller_skates` | Patines | +20 % velocidad |
| `magnet` | Imán de nevera gigante | +60 % imán |
| `toolbelt` | Cinturón de herramientas | −15 % enfriamiento |
| `bobblehead` | Cabezón del atleta | +25 % daño, −15 % PV máx. |

## 8. Consumibles (4)

| id | Nombre | Efecto |
|---|---|---|
| `stim` | Estimulante | Cura 40 % PV |
| `iodine` | Yodo-Pak | −50 RADS |
| `grenade` | Granada de lata | Explosión 200 px, 150 daño |
| `jet` | Batido turbo | +40 % velocidad y daño 8 s |
