// Armas automáticas (F1-06, F2-01): turno de cada arma y despacho a su función de disparo.
// Sin allocations: proyectiles y efectos salen de pools; las consultas usan buffers del World.
import { type Weapon, type World } from '../../types';
import { fireGeiger, fireHammer, fireMegaphone, fireOrbit, fireUnstable } from './auras';
import { fireCobalt, fireDarts, fireNails, fireRifle, fireShotgun } from './guns';
import { fireCocktail, fireFirecrackers } from './thrown';
import { fireDefib, fireTesla } from './zaps';

export function updateWeapon(w: World, wp: Weapon, dt: number): void {
  switch (wp.id) {
    case 'llave':
    case 'dinamo':
      fireOrbit(w, wp, dt);
      return;
    case 'geiger':
      fireGeiger(w, wp, dt);
      return;
    case 'nucleo_inestable':
      fireUnstable(w, wp, dt);
      return;
  }

  wp.cd -= dt;
  if (wp.cd > 0) return;

  switch (wp.id) {
    case 'pistola_clavos':
    case 'remachadora':
      fireNails(w, wp);
      return;
    case 'jeringa':
    case 'dardos_incendiarios':
      fireDarts(w, wp);
      return;
    case 'escopeta_chatarra':
      fireShotgun(w, wp);
      return;
    case 'rifle_cerrojo':
      fireRifle(w, wp);
      return;
    case 'coctel':
      fireCocktail(w, wp);
      return;
    case 'petardos':
      fireFirecrackers(w, wp);
      return;
    case 'tesla':
      fireTesla(w, wp);
      return;
    case 'martillo_pilon':
      fireHammer(w, wp);
      return;
    case 'megafono':
      fireMegaphone(w, wp);
      return;
    case 'desfibrilador':
      fireDefib(w, wp);
      return;
    case 'nucleo_cobalto':
      fireCobalt(w, wp);
      return;
  }
}

export function updateWeapons(w: World, dt: number): void {
  // Aturdido no ataca (decisión del usuario tras probarlo; CAMBIOS §2 decía que el autoataque seguía).
  if (w.player.deadAt !== null || w.player.stun > 0) return;
  // El array puede cambiar solo al elegir tarjeta (con el motor parado), así que se recorre tal cual.
  for (let i = 0; i < w.weapons.length; i++) updateWeapon(w, w.weapons[i]!, dt);
}
