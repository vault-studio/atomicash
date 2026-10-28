// Textos de tarjetas y armas a partir de la config: los números nunca se escriben a mano en i18n.
import type { TFunction } from 'i18next';
import { PLAYER } from '../config/run';
import { FUSIONS, WEAPONS, scaled, type WeaponId } from '../config/weapons';
import { TRAITS } from '../config/traits';
import type { Card, World } from '../engine/types';

const f1 = (x: number): number => Math.round(x * 10) / 10;

/** Parámetros de la descripción de un arma a nivel `l` (i18n `weapons.<id>.desc`). */
export function weaponParams(id: WeaponId, l: number): Record<string, number> {
  switch (id) {
    case 'llave': {
      const W = WEAPONS.llave;
      return { n: l, dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)) };
    }
    case 'pistola_clavos': {
      const W = WEAPONS.pistola_clavos;
      return { n: l, dmg: W.dmg, cd: f1(W.cd * Math.pow(W.cdPerLvl, l - 1)) };
    }
    case 'jeringa': {
      const W = WEAPONS.jeringa;
      return { n: 2 + l, dmg: W.dmg, heal: f1(W.healBase + W.healPerLvl * l) };
    }
    case 'coctel': {
      const W = WEAPONS.coctel;
      return {
        n: l,
        dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)),
        tick: W.poolTick,
        dur: f1(W.dur + W.durPerLvl * (l - 1)),
      };
    }
    case 'tesla': {
      const W = WEAPONS.tesla;
      return { dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)), jumps: W.jumps + W.jumpsPerLvl * (l - 1) };
    }
    case 'geiger': {
      const W = WEAPONS.geiger;
      return {
        dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)),
        tick: W.tickCd,
        r: W.r + W.rPerLvl * (l - 1),
        k: W.rPerRad,
      };
    }
    case 'escopeta_chatarra': {
      const W = WEAPONS.escopeta_chatarra;
      return { n: W.pellets + W.pelletsPerLvl * (l - 1), dmg: W.dmg };
    }
    case 'megafono': {
      const W = WEAPONS.megafono;
      return {
        dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)),
        deg: Math.round(((W.angle + W.anglePerLvl * (l - 1)) * 180) / Math.PI),
      };
    }
    case 'rifle_cerrojo': {
      const W = WEAPONS.rifle_cerrojo;
      return { dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)), pierce: W.pierce, cd: W.cd };
    }
    case 'martillo_pilon': {
      const W = WEAPONS.martillo_pilon;
      return { dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)), r: W.r + W.rPerLvl * (l - 1), cd: W.cd };
    }
    case 'petardos': {
      const W = WEAPONS.petardos;
      return {
        step: W.step + W.stepPerLvl * (l - 1),
        dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)),
        r: W.r + W.rPerLvl * (l - 1),
      };
    }
    case 'desfibrilador': {
      const W = WEAPONS.desfibrilador;
      return {
        n: W.targets + l,
        dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)),
        pct: Math.round(W.regenBonus * 100),
      };
    }
    case 'nucleo_cobalto': {
      const W = WEAPONS.nucleo_cobalto;
      return {
        dmg: f1(scaled(W.dmg, W.dmgPerLvl, l)),
        pierce: W.pierce + l,
        pct: Math.round(W.radBonus * 100),
      };
    }
    case 'dinamo': {
      const W = WEAPONS.dinamo;
      return { n: W.count, dmg: W.dmg, jumps: W.chainJumps, chain: W.chainDmg };
    }
    case 'remachadora': {
      const W = WEAPONS.remachadora;
      return { n: W.count, dmg: W.dmg, cd: W.cd, pierce: W.pierce };
    }
    case 'nucleo_inestable': {
      const W = WEAPONS.nucleo_inestable;
      return { dmg: W.dmg, r: W.r, n: W.bolts, bolt: W.boltDmg, cd: W.boltCd };
    }
    case 'dardos_incendiarios': {
      const W = WEAPONS.dardos_incendiarios;
      return { n: W.count, dmg: W.dmg, fire: W.poolDmg, heal: W.healBase };
    }
  }
}

export interface CardView {
  cls: string;
  tag: string;
  title: string;
  desc: string;
}

export function cardView(t: TFunction, w: World, c: Card): CardView {
  switch (c.kind) {
    case 'up': {
      const wp = w.weapons.find((x) => x.id === c.id);
      const l = (wp?.lvl ?? 1) + 1;
      return {
        cls: 'weapon',
        tag: t('cards.upgrade'),
        title: `${t(`weapons.${c.id}.name`)} ${l - 1}→${l}`,
        desc: t(`weapons.${c.id}.desc`, weaponParams(c.id, l)),
      };
    }
    case 'new': {
      const owner = (WEAPONS[c.id] as { owner?: string }).owner;
      return {
        cls: owner ? 'weapon exclusive' : 'weapon',
        tag: t(owner ? 'cards.exclusive' : 'cards.newWeapon'),
        title: t(`weapons.${c.id}.name`),
        desc: t(`weapons.${c.id}.desc`, weaponParams(c.id, 1)),
      };
    }
    case 'fusion': {
      const f = FUSIONS.find((x) => x.result === c.id)!;
      return {
        cls: 'fusion',
        tag: t('cards.fusion'),
        title: t(`weapons.${c.id}.name`),
        desc: t('cards.fusionDesc', {
          a: t(`weapons.${f.a}.short`),
          b: t(`weapons.${f.b}.short`),
          desc: t(`weapons.${c.id}.desc`, weaponParams(c.id, PLAYER.maxWeaponLevel)),
        }),
      };
    }
    case 'trait': {
      const picks = w.traitPicks[c.id] ?? 0;
      return {
        cls: c.rarity === 'common' ? '' : c.rarity,
        tag: `${t('cards.trait')} · ${t(`rarity.${c.rarity}`)}`,
        title: t(`traits.${c.id}.name`) + (picks ? ` ×${picks + 1}` : ''),
        desc: t(`traits.${c.id}.desc`, { v: c.value, max: TRAITS[c.id].max }),
      };
    }
    case 'item':
      return {
        cls: 'rare',
        tag: t('cards.item'),
        title: t(`items.${c.id}.name`),
        desc: t(`items.${c.id}.desc`),
      };
    case 'heal':
      return { cls: '', tag: t('cards.supply'), title: t('cards.heal'), desc: t('cards.healDesc') };
    case 'purge':
      return { cls: '', tag: t('cards.supply'), title: t('cards.purge'), desc: t('cards.purgeDesc') };
  }
}
